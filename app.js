/* ══════════════════════════════════════════════════════════════
   app.js — avvio dell'applicazione sul server (Plesk / Passenger)
   ──────────────────────────────────────────────────────────────
   In sviluppo il sito e l'API stanno su due porte diverse. Qui no:
   un solo processo serve le pagine E risponde sotto /api/, perche'
   e' cosi' che Plesk si aspetta di far girare un'applicazione Node.

   Differenza importante da assistant/server.mjs: se manca la chiave
   dell'assistente questo NON si spegne. Un processo che esce in
   avvio, su un server, viene riavviato all'infinito e porta giu'
   tutto il sito — pagine comprese. Qui invece le pagine restano
   servite e solo l'assistente risponde che non e' disponibile.

   Plesk: file di avvio = app.js, radice applicazione = questa
   cartella, e la porta arriva in process.env.PORT.
   ══════════════════════════════════════════════════════════════ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = path.dirname(fileURLToPath(import.meta.url));

/* .env in locale; sul server le variabili le mette Plesk */
const envFile = path.join(RADICE, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(riga => {
    const m = riga.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const chiaveOk = (() => {
  const k = (process.env.ANTHROPIC_API_KEY || '').trim();
  return Boolean(k) && !/^sk-ant-\.\.\.$|^sk-ant-xxx/i.test(k) && k.length >= 20;
})();
if (!chiaveOk) {
  console.error('[avvio] ANTHROPIC_API_KEY mancante o segnaposto: il sito funziona, '
              + 'l\'assistente no. Impostala fra le variabili d\'ambiente in Plesk.');
}

/* La pulizia dei dati scaduti, come promesso nella privacy.
   Senza "await": Passenger carica questo file con require(), e require()
   rifiuta un modulo ESM che contenga un await al livello piu' esterno
   (ERR_REQUIRE_ASYNC_MODULE). Un solo await qui basterebbe a impedire
   l'avvio dell'applicazione sul server. */
import('./assistant/src/pulizia.mjs')
  .then(m => m.avviaPulizia())
  .catch(e => console.error('[avvio] pulizia non avviata: ' + e.message));

/* Il ciclo giornaliero dei promemoria di riacquisto. Come sopra:
   niente await, o Passenger non riesce a caricare questo file. */
import('./assistant/src/scheduler.mjs')
  .then(m => m.avviaScheduler())
  .catch(e => console.error('[avvio] promemoria non avviati: ' + e.message));

/* ── tipi di file ── */
const TIPI = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webp': 'image/webp',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

/* Cosa non deve MAI uscire dal server, anche se qualcuno indovina il nome:
   la chiave, i dati dei clienti, il codice sorgente dell'applicazione. */
const VIETATI = [/^\.env/, /^\.git/, /^node_modules/, /^assistant\/data\//,
                 /^assistant\/src\//, /^assistant\/scripts\//, /^assistant\/config\//,
                 /^_[^/]*\.html$/, /^package(-lock)?\.json$/, /^app\.js$/];

function serviStatico(req, res, pathname) {
  let rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';

  /* il percorso risolto deve restare dentro la cartella del sito:
     senza questo, un ../../ nell'indirizzo leggerebbe file di sistema */
  const completo = path.resolve(RADICE, rel);
  if (!completo.startsWith(RADICE + path.sep)) { res.statusCode = 403; return res.end('Vietato'); }

  const dentro = path.relative(RADICE, completo).split(path.sep).join('/');
  if (VIETATI.some(r => r.test(dentro))) { res.statusCode = 404; return res.end('Non trovato'); }

  fs.stat(completo, (err, st) => {
    if (err || !st.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const p404 = path.join(RADICE, '404.html');
      return res.end(fs.existsSync(p404) ? fs.readFileSync(p404) : 'Pagina non trovata');
    }
    const ext = path.extname(completo).toLowerCase();
    res.setHeader('Content-Type', TIPI[ext] || 'application/octet-stream');
    /* le pagine cambiano, le immagini no: cache lunga solo su cio' che
       porta gia' un ?v= nel nome quando viene aggiornato */
    res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=604800');
    fs.createReadStream(completo).pipe(res);
  });
}

const ipDi = req =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  || (req.socket && req.socket.remoteAddress) || 'sconosciuto';

/* Nota sul perche' ogni gestore e' chiamato con "await": senza, l'errore
   non passa dal try/catch qui sotto ma diventa un rifiuto non gestito, e
   Node chiude il processo. Una singola richiesta sbagliata porterebbe giu'
   tutto il sito, pagine comprese. */
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); }
  catch (e) { res.statusCode = 400; return res.end('Richiesta non valida'); }

  try {
    if (url.pathname === '/api/chat') {
      const { default: handler } = await import('./assistant/src/handler.mjs');
      return await handler(req, res);
    }

    if (url.pathname === '/api/cliente') {
      const { gestisciCliente } = await import('./assistant/src/cliente-endpoint.mjs');
      return await gestisciCliente(req, res, url.searchParams.get('c') || '', ipDi(req));
    }

    /* ── promemoria di riacquisto, riordino, pannello ──
       Le stesse rotte del server di sviluppo (assistant/server.mjs):
       qui vanno ripetute perche' online e' questo il file che risponde. */
    if (url.pathname === '/api/cron/promemoria') {
      const { gestisciCron } = await import('./assistant/src/cron-endpoint.mjs');
      return await gestisciCron(req, res, url.searchParams.get('secret') || '');
    }

    if (url.pathname === '/api/riordino') {
      const { gestisciRiordino } = await import('./assistant/src/riordino-endpoint.mjs');
      return await gestisciRiordino(req, res, url.searchParams.get('t') || '', ipDi(req));
    }

    if (url.pathname === '/api/unsubscribe') {
      const { gestisciUnsubscribe } = await import('./assistant/src/unsubscribe-endpoint.mjs');
      return await gestisciUnsubscribe(req, res, url.searchParams.get('c') || '',
                                 url.searchParams.get('tipo') || '', ipDi(req));
    }

    if (url.pathname === '/api/promemoria-aperto') {
      const { gestisciApertura } = await import('./assistant/src/apertura-endpoint.mjs');
      return await gestisciApertura(req, res, url.searchParams.get('id') || '');
    }

    if (url.pathname === '/api/admin/login') {
      const { gestisciLogin } = await import('./assistant/src/admin/login-endpoint.mjs');
      return await gestisciLogin(req, res, ipDi(req));
    }

    if (url.pathname === '/api/admin/regole') {
      const { gestisciRegole } = await import('./assistant/src/admin/regole-endpoint.mjs');
      return await gestisciRegole(req, res, url.searchParams.get('categoria') || '');
    }

    if (url.pathname === '/api/ordine-stato-cambiato') {
      const { gestisciStatoOrdine } = await import('./assistant/src/ordini/stato-endpoint.mjs');
      return await gestisciStatoOrdine(req, res);
    }

    if (url.pathname === '/api/admin/dashboard') {
      const { gestisciDashboard } = await import('./assistant/src/admin/dashboard-endpoint.mjs');
      const [da, a] = (url.searchParams.get('periodo') || '').split('..');
      return await gestisciDashboard(req, res, {
        da: da || '', a: a || '', cliente: url.searchParams.get('cliente') || '',
        tipo: url.searchParams.get('tipo') || '', stato: url.searchParams.get('stato') || '',
        categoria: url.searchParams.get('categoria') || '',
      });
    }

    if (url.pathname === '/api/contatto') {
      if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
      if (req.method !== 'POST')    { res.statusCode = 405; return res.end('Metodo non ammesso'); }
      let grezzo = '';
      req.on('data', c => { grezzo += c; if (grezzo.length > 100000) req.destroy(); });
      req.on('end', async () => {
        let dati;
        try { dati = JSON.parse(grezzo || '{}'); }
        catch (e) { res.statusCode = 400; return res.end('Richiesta non valida'); }
        const { gestisciContatto } = await import('./assistant/src/contatto.mjs');
        return await gestisciContatto(req, res, dati, ipDi(req));
      });
      return;
    }

    return serviStatico(req, res, url.pathname);
  } catch (e) {
    console.error('[errore] ' + url.pathname + ': ' + (e && e.stack || e));
    if (!res.headersSent) { res.statusCode = 500; res.end('Errore interno'); }
  }
});

const porta = process.env.PORT || 3000;
server.listen(porta, () => console.log('[avvio] in ascolto sulla porta ' + porta));
