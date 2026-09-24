/* ══════════════════════════════════════════════════════════════
   admin/dashboard-endpoint.mjs — GET /api/admin/dashboard
   ──────────────────────────────────────────────────────────────
   Due famiglie di numeri:
   · quelli sui PROMEMORIA (inviati/aperti/click/conversione) — dagli
     eventi in promemoria-eventi.jsonl, locale, come prima;
   · quelli sugli ORDINI (di oggi, aperti, in preparazione, da
     spedire, pagamenti mancanti, fatturato, prodotti piu' ordinati,
     clienti B2B principali) — da Google Sheets, tramite l'adattatore
     ordini.

   Fatturato e valore medio ordine vengono dal campo "Prezzo Totale"
   che lo staff compila a mano nel foglio (il sito non ha prezzi
   online, vedi motore-promemoria.mjs): sono quindi affidabili solo
   quanto lo e' quel campo. Le righe senza prezzo non entrano nella
   media, per non farla scendere per un vuoto che non e' uno zero.

   Filtri (tutti opzionali, in query string): periodo=AAAA-MM-DD..AAAA-MM-DD,
   cliente=(email o pezzo di nome), tipo=B2C|B2B, stato=codice, categoria=…
   ══════════════════════════════════════════════════════════════ */
import { sessioneValida, tokenDaRichiesta } from './auth.mjs';
import { elencoClienti, ordiniPerEmail, tuttiOrdini } from '../ordini/index.mjs';
import { tutteLeRegole } from '../regole-riacquisto.mjs';
import { prossimoPromemoria } from '../motore-promemoria.mjs';
import { leggiEventi } from '../scheduler.mjs';
import { elencoStati } from '../ordini/stati.mjs';
import { cors } from '../cors.mjs';

function statoCliente(c, oggi) {
  if (c.revocato) return 'link revocato';
  if (c.scadenza && new Date(c.scadenza) < oggi) return 'link scaduto';
  if (!c.consenso || c.consenso.promemoriaRiacquisto === false) return 'disiscritto';
  return 'attivo';
}

const numeroOns = v => {
  const n = Number(String(v == null ? '' : v).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

const STESSO_GIORNO = (a, b) => a.toDateString() === b.toDateString();

function applicaFiltri(ordini, f) {
  return ordini.filter(o => {
    if (f.da && Date.parse(o.ts) < Date.parse(f.da)) return false;
    if (f.a && Date.parse(o.ts) > Date.parse(f.a) + 24 * 3600 * 1000 - 1) return false;
    if (f.cliente) {
      const q = f.cliente.toLowerCase();
      const match = (o.email || '').toLowerCase().includes(q) || (o.nome || '').toLowerCase().includes(q) || (o.azienda || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (f.tipo && o.tipoCliente !== f.tipo) return false;
    if (f.stato && o.stato !== f.stato) return false;
    if (f.categoria && !(o.articoli || []).some(a => a.categoria === f.categoria)) return false;
    return true;
  });
}

/* stati che contano ancora come "lavoro da fare", non chiusi */
const STATI_APERTI = ['nuovo', 'confermato', 'pagamento', 'pagato', 'preparazione', 'produzione', 'pronto'];

export async function calcolaDashboard(oggi = new Date(), filtri = {}) {
  const eventi = leggiEventi();
  const idInviati = new Set(eventi.filter(e => e.tipo === 'inviato').map(e => e.promemoriaId));
  const idAperti = new Set(eventi.filter(e => e.tipo === 'aperto' && idInviati.has(e.promemoriaId)).map(e => e.promemoriaId));
  const idClick = new Set(eventi.filter(e => e.tipo === 'click' && idInviati.has(e.promemoriaId)).map(e => e.promemoriaId));

  const tuttiOrd = await tuttiOrdini();
  const ordDaPromemoria = tuttiOrd.filter(o => o.promemoriaRif);
  const ordini = applicaFiltri(tuttiOrd, filtri);

  const totInviati = idInviati.size;

  const oggiOrdini = ordini.filter(o => STESSO_GIORNO(new Date(o.ts), oggi));
  const aperti = ordini.filter(o => STATI_APERTI.includes(o.stato));
  const inPreparazione = ordini.filter(o => o.stato === 'preparazione' || o.stato === 'produzione');
  const daSpedire = ordini.filter(o => o.stato === 'pronto');
  const spediti = ordini.filter(o => o.stato === 'spedito' || o.stato === 'consegnato');
  const pagamentiMancanti = ordini.filter(o => o.stato !== 'annullato' && (!o.statoPagamento || /^(da ricevere|non pagato)$/i.test(String(o.statoPagamento).trim())));

  const importi = ordini.map(o => numeroOns(o.prezzoTotale)).filter(n => n !== null);
  const fatturato = Math.round(importi.reduce((s, n) => s + n, 0) * 100) / 100;
  const valoreMedio = importi.length ? Math.round((fatturato / importi.length) * 100) / 100 : 0;

  /* clienti B2B principali: per fatturato dichiarato (i prezzi manuali),
     poi per numero di ordini quando il prezzo manca. */
  const perCliente = new Map();
  ordini.filter(o => o.tipoCliente === 'B2B').forEach(o => {
    const k = o.email;
    const v = perCliente.get(k) || { nome: o.nome, azienda: o.azienda, email: o.email, ordini: 0, totale: 0 };
    v.ordini++; v.totale += numeroOns(o.prezzoTotale) || 0;
    perCliente.set(k, v);
  });
  const clientiB2BPrincipali = [...perCliente.values()]
    .sort((a, b) => (b.totale - a.totale) || (b.ordini - a.ordini)).slice(0, 8);

  /* prodotti piu' ordinati, per quantita' totale */
  const perProdotto = new Map();
  ordini.forEach(o => (o.articoli || []).forEach(a => {
    const v = perProdotto.get(a.nome) || { nome: a.nome, quantita: 0, ordini: 0 };
    v.quantita += a.quantita || 0; v.ordini++;
    perProdotto.set(a.nome, v);
  }));
  const prodottiPiuOrdinati = [...perProdotto.values()].sort((a, b) => b.quantita - a.quantita).slice(0, 10);

  const regole = tutteLeRegole();
  const clienti = await elencoClienti();
  const tabella = [];
  for (const c of clienti) {
    const storico = await ordiniPerEmail(c.email);
    const ultima = storico[storico.length - 1] || null;
    const prossimo = prossimoPromemoria(c, storico, regole, oggi);
    tabella.push({
      nome: c.nome || c.azienda || c.email,
      email: c.email,
      ultimoOrdine: ultima ? ultima.ts : (c.ultimoOrdine || null),
      categoria: ultima ? [...new Set((ultima.articoli || []).map(a => a.categoria).filter(Boolean))].join(', ') : '',
      ultimoAcquisto: ultima ? (ultima.articoli || []).map(a => a.nome).slice(0, 3).join(', ') : '',
      prossimoReminder: prossimo ? prossimo.dataStimata.toISOString() : null,
      frequenzaMediaGiorni: c.frequenzaMediaGiorni || null,
      stato: statoCliente(c, oggi),
    });
  }
  tabella.sort((a, b) => {
    const da = a.prossimoReminder ? Date.parse(a.prossimoReminder) : Infinity;
    const db = b.prossimoReminder ? Date.parse(b.prossimoReminder) : Infinity;
    return da - db;
  });

  /* "da ricontattare": il prossimo reminder e' oggi o gia' passato —
     stessa logica del motore, letta come "e' il momento", non come
     previsione futura. */
  const daRicontattare = tabella.filter(r => r.prossimoReminder && Date.parse(r.prossimoReminder) <= oggi.getTime());

  const topFrequenti = clienti
    .filter(c => c.frequenzaMediaGiorni)
    .sort((a, b) => a.frequenzaMediaGiorni - b.frequenzaMediaGiorni)
    .slice(0, 8)
    .map(c => ({ nome: c.nome || c.azienda || c.email, frequenzaMediaGiorni: c.frequenzaMediaGiorni }));

  return {
    metriche: {
      inviati: totInviati, aperti: idAperti.size, apertureAttendibili: false, click: idClick.size,
      ordiniDaPromemoria: ordDaPromemoria.length,
      programmati: tabella.filter(r => r.prossimoReminder).length,
      conversionRate: totInviati ? Math.round((ordDaPromemoria.length / totInviati) * 1000) / 10 : 0,
      ordiniOggi: oggiOrdini.length, ordiniAperti: aperti.length, ordiniInPreparazione: inPreparazione.length,
      ordiniDaSpedire: daSpedire.length, ordiniSpediti: spediti.length, pagamentiMancanti: pagamentiMancanti.length,
      fatturato, valoreMedio, ordiniTotali: ordini.length,
    },
    clienti: tabella,
    topFrequenti,
    daRicontattare,
    clientiB2BPrincipali,
    prodottiPiuOrdinati,
    stati: elencoStati(),
  };
}

export async function gestisciDashboard(req, res, filtri = {}) {
  cors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };
  if (!sessioneValida(tokenDaRichiesta(req))) return invia(401, { ok: false });
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  try {
    return invia(200, { ok: true, ...(await calcolaDashboard(new Date(), filtri)) });
  } catch (e) {
    console.error('[dashboard] ' + (e && e.stack || e));
    return invia(502, { ok: false, errore: 'Google Sheets non raggiungibile' });
  }
}
