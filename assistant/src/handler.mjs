/* ══════════════════════════════════════════════════════════════
   handler.mjs — l'endpoint /api/chat
   ──────────────────────────────────────────────────────────────
   Scritto sulle req/res di Node, quindi lo stesso file funziona
   sotto il server locale e come funzione serverless su Vercel.
   Risponde in Server-Sent Events: il widget mostra la risposta
   mentre arriva, invece di aspettare il punto finale.
   ══════════════════════════════════════════════════════════════ */
import { config, EMAIL_SUPPORTO } from './config.mjs';
import { consenti } from './ratelimit.mjs';
import { registra } from './log.mjs';
import { conversa, preparaMessaggi } from './chat.mjs';
import { daCompilare, policiesVuote } from './policies.mjs';
import { quanti, generato } from './catalog.mjs';
import { gestisciContatto } from './contatto.mjs';
import { postaAttiva } from './mailer.mjs';

const CORTESIA =
  'Mi scusi, in questo momento non riesco a rispondere. ' +
  'Ci scriva pure a ' + EMAIL_SUPPORTO + ' o al numero 02.35.43.707: le rispondiamo noi.';

function cors(req, res) {
  const origine = req.headers.origin;
  const lista = config.originiAmmesse;
  if (!lista.length) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origine && lista.includes(origine)) res.setHeader('Access-Control-Allow-Origin', origine);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function corpo(req) {
  if (req.body !== undefined && req.body !== null) {       /* Vercel lo ha gia' letto */
    return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body);
  }
  return new Promise((risolvi, rifiuta) => {
    let dati = '';
    req.on('data', c => {
      dati += c;
      if (dati.length > 100_000) { rifiuta(new Error('richiesta troppo grande')); req.destroy(); }
    });
    req.on('end', () => { try { risolvi(JSON.parse(dati || '{}')); } catch (e) { rifiuta(e); } });
    req.on('error', rifiuta);
  });
}

/* distingue la chiave vera dal segnaposto di .env.example */
function chiaveValida() {
  const k = (process.env.ANTHROPIC_API_KEY || '').trim();
  return Boolean(k) && !/^sk-ant-\.\.\.$|^sk-ant-xxx/i.test(k) && k.length >= 20;
}

const ipDi = req =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  (req.socket && req.socket.remoteAddress) || 'sconosciuto';

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (req.method === 'GET') {                 /* diagnostica */
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({
      ok: true,
      modello: config.modello,
      effort: config.effort,
      catalogo: { voci: quanti, generato },
      policy: { voci_da_compilare: daCompilare, documento_vuoto: policiesVuote },
      chiave_api: chiaveValida() ? 'ok' : (process.env.ANTHROPIC_API_KEY ? 'segnaposto' : 'assente'),
      posta: postaAttiva() ? 'attiva' : 'non configurata (il modulo usa mailto:)',
    }));
  }

  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Metodo non ammesso'); }

  let dati;
  try { dati = await corpo(req); }
  catch (e) { res.statusCode = 400; return res.end('Richiesta non valida'); }

  const testo = String(dati.messaggio || '').trim();
  if (!testo) { res.statusCode = 400; return res.end('Messaggio vuoto'); }

  const ip = ipDi(req);
  const sessione = String(dati.sessione || '').slice(0, 64);
  const storico = Array.isArray(dati.storico) ? dati.storico : [];

  const limite = consenti(ip, sessione, storico.filter(m => m.role === 'user').length + 1);
  if (!limite.ok) {
    res.statusCode = 429;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    registra({ ip, sessione, evento: 'limite', motivo: limite.motivo });
    return res.end(JSON.stringify({
      errore: 'limite',
      messaggio: limite.motivo === 'sessione'
        ? 'Questa conversazione e\' diventata lunga. Per continuare ci scriva a ' + EMAIL_SUPPORTO + '.'
        : 'Ha scritto parecchi messaggi in poco tempo. Riprovi tra ' + (limite.riprovaTra || 60) +
          ' minuti, oppure ci scriva a ' + EMAIL_SUPPORTO + '.',
    }));
  }

  /* ── SSE ── */
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (res.flushHeaders) res.flushHeaders();

  const invia = ev => { try { res.write('data: ' + JSON.stringify(ev) + '\n\n'); } catch (e) {} };

  registra({ ip, sessione, ruolo: 'utente', testo });

  try {
    const esito = await conversa({
      messaggi: preparaMessaggi(storico, testo),
      contesto: {
        selezione: typeof dati.selezione === 'string' ? dati.selezione.slice(0, 1500) : '',
        lingua: dati.lingua === 'en' ? 'en' : 'it',
      },
      onEvento: invia,
    });
    registra({ ip, sessione, ruolo: 'assistente', testo: esito.testo, uso: esito.uso, motivo: esito.motivo });
    invia({ type: 'fine' });
  } catch (e) {
    console.error('[chat] ' + (e && e.stack ? e.stack : e));
    registra({ ip, sessione, evento: 'errore', messaggio: String(e && e.message) });
    invia({ type: 'errore', messaggio: CORTESIA, email: EMAIL_SUPPORTO });
  }
  res.end();
}
