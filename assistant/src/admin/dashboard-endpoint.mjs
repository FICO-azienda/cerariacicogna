/* ══════════════════════════════════════════════════════════════
   admin/dashboard-endpoint.mjs — GET /api/admin/dashboard
   ──────────────────────────────────────────────────────────────
   Aggrega gli eventi di promemoria-eventi.jsonl e lo stato dei
   clienti in poche metriche e nella tabella richiesta. Nessun
   fatturato: il sito non ha prezzi (vedi motore-promemoria.mjs e
   privacy.html), quindi la conversione si misura in richieste
   generate, non in euro.

   "Aperture" e' etichettata esplicitamente come stima debole: il
   pixel di apertura (apertura-endpoint.mjs) non e' un dato affidabile
   per costruzione, coi client di posta moderni.
   ══════════════════════════════════════════════════════════════ */
import { sessioneValida, tokenDaRichiesta } from './auth.mjs';
import { elenco } from '../clienti.mjs';
import { storicoPerEmail, leggiRichieste } from '../archivio.mjs';
import { tutteLeRegole } from '../regole-riacquisto.mjs';
import { prossimoPromemoria } from '../motore-promemoria.mjs';
import { leggiEventi } from '../scheduler.mjs';
import { cors } from '../cors.mjs';

function statoCliente(c, oggi) {
  if (c.revocato) return 'link revocato';
  if (c.scadenza && new Date(c.scadenza) < oggi) return 'link scaduto';
  if (!c.consenso || c.consenso.promemoriaRiacquisto === false) return 'disiscritto';
  return 'attivo';
}

export function calcolaDashboard(oggi = new Date()) {
  const eventi = leggiEventi();
  const idInviati = new Set(eventi.filter(e => e.tipo === 'inviato').map(e => e.promemoriaId));
  const idAperti = new Set(eventi.filter(e => e.tipo === 'aperto' && idInviati.has(e.promemoriaId)).map(e => e.promemoriaId));
  const idClick = new Set(eventi.filter(e => e.tipo === 'click' && idInviati.has(e.promemoriaId)).map(e => e.promemoriaId));
  const daPromemoria = leggiRichieste().filter(r => r.promemoriaRif);

  const totInviati = idInviati.size;
  const totOrdini = daPromemoria.length;

  const regole = tutteLeRegole();
  const clienti = elenco();
  const tabella = clienti.map(c => {
    const storico = storicoPerEmail(c.email);
    const ultima = storico[storico.length - 1] || null;
    const prossimo = prossimoPromemoria(c, storico, regole, oggi);
    return {
      nome: c.nome || c.azienda || c.email,
      email: c.email,
      ultimoOrdine: ultima ? ultima.ts : (c.ultimoOrdine || null),
      categoria: ultima ? [...new Set((ultima.articoli || []).map(a => a.categoria).filter(Boolean))].join(', ') : '',
      ultimoAcquisto: ultima ? (ultima.articoli || []).map(a => a.nome).slice(0, 3).join(', ') : '',
      prossimoReminder: prossimo ? prossimo.dataStimata.toISOString() : null,
      frequenzaMediaGiorni: c.frequenzaMediaGiorni || null,
      stato: statoCliente(c, oggi),
    };
  }).sort((a, b) => {
    const da = a.prossimoReminder ? Date.parse(a.prossimoReminder) : Infinity;
    const db = b.prossimoReminder ? Date.parse(b.prossimoReminder) : Infinity;
    return da - db;
  });

  const topFrequenti = clienti
    .filter(c => c.frequenzaMediaGiorni)
    .sort((a, b) => a.frequenzaMediaGiorni - b.frequenzaMediaGiorni)
    .slice(0, 8)
    .map(c => ({ nome: c.nome || c.azienda || c.email, frequenzaMediaGiorni: c.frequenzaMediaGiorni }));

  return {
    metriche: {
      inviati: totInviati,
      aperti: idAperti.size,
      apertureAttendibili: false,
      click: idClick.size,
      ordiniDaPromemoria: totOrdini,
      programmati: tabella.filter(r => r.prossimoReminder).length,
      conversionRate: totInviati ? Math.round((totOrdini / totInviati) * 1000) / 10 : 0,
    },
    clienti: tabella,
    topFrequenti,
  };
}

export function gestisciDashboard(req, res) {
  cors(req, res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };
  if (!sessioneValida(tokenDaRichiesta(req))) return invia(401, { ok: false });
  if (req.method !== 'GET') { res.statusCode = 405; return res.end(); }
  return invia(200, { ok: true, ...calcolaDashboard() });
}
