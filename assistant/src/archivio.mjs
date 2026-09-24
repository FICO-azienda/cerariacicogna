/* ══════════════════════════════════════════════════════════════
   archivio.mjs — registro delle richieste ricevute
   ──────────────────────────────────────────────────────────────
   Oggi una richiesta vive solo dentro un'email: per programmare i
   rifornimenti bisognerebbe rileggere la casella e interpretare le
   frasi. Qui invece resta come dato — linea, cadenza, articoli,
   quantita' — cosi' un domani si puo' costruirci sopra uno
   scadenzario senza dover indovinare niente.

   Una riga JSON per richiesta: si legge con qualsiasi cosa, si
   cancella una riga alla volta, non serve un database.

   ATTENZIONE (GDPR): contiene dati personali (nome, email). Va
   dichiarato nella privacy policy insieme al periodo di
   conservazione, e ripulito periodicamente.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';

const FILE = process.env.CC_ARCHIVIO || path.join(BASE, 'data', 'richieste.jsonl');

/* Quando ci si aspetta il prossimo rifornimento: un'indicazione, non una
   promessa. Serve a chi guarda l'elenco per capire cosa scade prima. */
function prossimaScadenza(fornitura, da = new Date()) {
  if (!fornitura || fornitura.tipo !== 'ricorrente' || !fornitura.ogniMesi) return '';
  const d = new Date(da.getTime());
  d.setMonth(d.getMonth() + fornitura.ogniMesi);
  return d.toISOString().slice(0, 10);
}

export function registraRichiesta(d) {
  const voce = {
    ts: new Date().toISOString(),
    nome: [d.nome, d.cognome].filter(Boolean).join(' '),
    email: d.email || '',
    azienda: d.azienda || '',
    linea: d.oggetto || '',
    fornitura: d.fornitura || null,
    prossima: prossimaScadenza(d.fornitura),
    /* categoria, immagine e pagina per articolo (non solo nome/quantita'):
       servono al motore promemoria per sapere quale regola applicare e alla
       pagina di riordino per ricostruire le schede senza dover incrociare
       altro. Un carrello misto (liturgico + garden) resta un'unica riga di
       richiesta ma ogni articolo porta la propria categoria. */
    articoli: (d.articoli || []).map(a => ({
      nome: a.nome, quantita: a.quantita || 0, oltre: Boolean(a.oltre),
      categoria: a.categoria || '', immagine: a.img || '', imgProfumo: a.imgProfumo || '',
      pagina: a.url || '',
    })),
    /* se questa richiesta nasce da un clic su un'email di promemoria, l'id
       di quel promemoria arriva fin qui: e' la base per calcolare quante
       richieste generano davvero i promemoria (dashboard admin). */
    promemoriaRif: d.promemoriaRif || '',
    messaggio: String(d.messaggio || '').slice(0, 1000),
  };
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(voce) + '\n');
    return voce;
  } catch (e) {
    /* l'archivio non deve mai far fallire l'invio: la richiesta e' gia' partita */
    console.warn('[archivio] non scritto: ' + e.message);
    return null;
  }
}

/* Rilettura, per costruirci sopra riepiloghi e promemoria. */
export function leggiRichieste({ linea, soloRicorrenti } = {}) {
  let righe = [];
  try { righe = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
  return righe.map(r => { try { return JSON.parse(r); } catch (e) { return null; } })
    .filter(Boolean)
    .filter(v => !linea || v.linea === linea)
    .filter(v => !soloRicorrenti || (v.fornitura && v.fornitura.tipo !== 'una-tantum'));
}

/* ══ Automazioni di riacquisto: lo storico e' la fonte, non clienti.json ══
   clienti.json tiene solo l'ultimo ordine (serve al link personale); lo
   storico completo, ordine per ordine, resta qui — una riga per richiesta,
   gia' con quello che serve: email, data, articoli, quantita', categoria. */
const normalizzaEmail = e => String(e || '').trim().toLowerCase();

export function storicoPerEmail(email) {
  const mail = normalizzaEmail(email);
  if (!mail) return [];
  let righe = [];
  try { righe = fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean); }
  catch (e) { return []; }
  return righe
    .map(r => { try { return JSON.parse(r); } catch (e) { return null; } })
    .filter(v => v && normalizzaEmail(v.email) === mail && v.ts)
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

/* Media degli intervalli reali fra un ordine e il successivo, non fra il
   primo e l'ultimo: due ordini vicini seguiti da uno lontano raccontano un
   comportamento diverso da tre ordini regolari, e solo la media degli
   intervalli lo distingue. Serve un minimo di 3 richieste (2 intervalli):
   con 2 sole un singolo intervallo puo' essere un caso isolato, non
   un'abitudine — "evitare automazioni troppo aggressive" vale anche qui.
   Il risultato resta fra 14 e 180 giorni: fuori da questa forchetta non e'
   piu' un ciclo di riacquisto plausibile, e' un errore nei dati (due
   richieste distratte lo stesso giorno, o un cliente tornato dopo anni). */
const MIN_RICHIESTE_PER_FREQUENZA = 3;
const FREQUENZA_MIN_GIORNI = 14;
const FREQUENZA_MAX_GIORNI = 180;

export function calcolaFrequenzaMedia(storico) {
  if (!storico || storico.length < MIN_RICHIESTE_PER_FREQUENZA) return null;
  const intervalli = [];
  for (let i = 1; i < storico.length; i++) {
    const giorni = (Date.parse(storico[i].ts) - Date.parse(storico[i - 1].ts)) / (24 * 3600 * 1000);
    if (Number.isFinite(giorni) && giorni > 0) intervalli.push(giorni);
  }
  if (!intervalli.length) return null;
  const media = Math.round(intervalli.reduce((s, g) => s + g, 0) / intervalli.length);
  if (media < FREQUENZA_MIN_GIORNI || media > FREQUENZA_MAX_GIORNI) return null;
  return media;
}

/* Pattern B2B: stesso insieme di articoli (nome) in almeno 3 delle ultime
   richieste, con quantita' che non oscillano piu' del 15% — la tolleranza
   serve perche' "48 ceri avorio" a volte arrivano scritti come 48, a volte
   come 50 per arrotondamento, senza che il pattern sia davvero cambiato. */
const MIN_RICHIESTE_PER_PATTERN = 3;
const TOLLERANZA_QUANTITA = 0.15;

export function rilevaPatternB2B(storico) {
  if (!storico || storico.length < MIN_RICHIESTE_PER_PATTERN) return null;
  const ultime = storico.slice(-MIN_RICHIESTE_PER_PATTERN);

  /* nomi presenti in OGNI richiesta delle ultime N */
  const insiemi = ultime.map(r => new Set((r.articoli || []).map(a => String(a.nome || '').toLowerCase()).filter(Boolean)));
  const comuni = [...insiemi[0]].filter(nome => insiemi.every(s => s.has(nome)));
  if (!comuni.length) return null;

  const tipici = comuni.map(nome => {
    const quantita = ultime.map(r => (r.articoli || []).find(a => String(a.nome || '').toLowerCase() === nome)?.quantita || 0);
    const media = quantita.reduce((s, q) => s + q, 0) / quantita.length;
    const stabile = quantita.every(q => media === 0 || Math.abs(q - media) / media <= TOLLERANZA_QUANTITA);
    if (!stabile) return null;
    const originale = (ultime[ultime.length - 1].articoli || []).find(a => String(a.nome || '').toLowerCase() === nome);
    return { nome: originale ? originale.nome : nome, quantita: Math.round(media) };
  }).filter(Boolean);

  if (!tipici.length) return null;
  return { ricorrente: true, articoliTipici: tipici };
}
