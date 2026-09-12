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
    articoli: (d.articoli || []).map(a => ({ nome: a.nome, quantita: a.quantita || 0 })),
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
