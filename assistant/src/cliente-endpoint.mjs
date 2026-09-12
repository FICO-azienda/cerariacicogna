/* ══════════════════════════════════════════════════════════════
   cliente-endpoint.mjs — GET /api/cliente?c=CODICE
   ──────────────────────────────────────────────────────────────
   Risolve il codice di un link personale e restituisce i dati del
   cliente. Il codice e' una credenziale: qui si difende dai
   tentativi a forza bruta e non si dice mai se un codice
   inesistente sia scaduto, revocato o mai esistito — una risposta
   diversa per ogni caso sarebbe un modo per esplorare il registro.
   ══════════════════════════════════════════════════════════════ */
import { trovaPerCodice, versionePubblica } from './clienti.mjs';
import { registra } from './log.mjs';
import { config } from './config.mjs';

const ORA = 60 * 60 * 1000;
const tentativi = new Map();

/* Conto solo i tentativi ANDATI A VUOTO. Chi cerca di indovinare sbaglia
   sempre, quindi si blocca lo stesso; un cliente vero che apre il suo link
   dieci volte in un pomeriggio non si trova la porta chiusa in faccia —
   e nemmeno i suoi colleghi, che escono tutti dallo stesso IP aziendale. */
function bloccato(ip) {
  const ora = Date.now();
  const arr = (tentativi.get(ip) || []).filter(t => ora - t < ORA);
  tentativi.set(ip, arr);
  if (tentativi.size > 5000) tentativi.clear();
  return arr.length >= 20;
}

function segnaBuco(ip) {
  const arr = tentativi.get(ip) || [];
  arr.push(Date.now());
  tentativi.set(ip, arr);
}

/* In produzione sito e API stanno sulla stessa origine e questo non
   servirebbe; in locale il sito e' su una porta e il server su un'altra. */
function cors(req, res) {
  const origine = req.headers.origin;
  const lista = config.originiAmmesse;
  if (!lista.length) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origine && lista.includes(origine)) res.setHeader('Access-Control-Allow-Origin', origine);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

export function gestisciCliente(req, res, codice, ip) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    /* un link personale non deve finire in nessuna cache condivisa */
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(JSON.stringify(corpo));
  };

  if (bloccato(ip)) {
    registra({ ip, evento: 'cliente-limite' });
    return invia(429, { ok: false });
  }

  const cliente = trovaPerCodice(codice);
  if (!cliente) { segnaBuco(ip); return invia(404, { ok: false }); }

  registra({ ip, evento: 'link-personale', cliente: cliente.nome || cliente.azienda || '' });
  return invia(200, { ok: true, cliente: versionePubblica(cliente) });
}
