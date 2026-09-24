#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   server.mjs — server di sviluppo
   ──────────────────────────────────────────────────────────────
   Serve /api/chat e il file del widget, e basta: le pagine del sito
   continua a servirle il tuo python -m http.server sulla 8899.
   In produzione questo file non serve: su Vercel gira api/chat.js.

   Avvio:  node assistant/server.mjs      (dopo aver messo la chiave in .env)
   ══════════════════════════════════════════════════════════════ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { BASE, SITE } from './src/paths.mjs';

/* .env letto a mano: una dipendenza in meno */
const envFile = path.join(SITE, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(riga => {
    const m = riga.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

/* il segnaposto di .env.example passerebbe un semplice controllo di presenza,
   e l'errore arriverebbe solo alla prima domanda di un visitatore */
const chiave = (process.env.ANTHROPIC_API_KEY || '').trim();
if (!chiave || /^sk-ant-\.\.\.$|^sk-ant-xxx/i.test(chiave) || chiave.length < 20) {
  console.error('\n  ' + (chiave ? 'ANTHROPIC_API_KEY e\' ancora il segnaposto di esempio.' : 'Manca ANTHROPIC_API_KEY.'));
  console.error('  Apri .env (nella cartella del sito) e incolla la chiave vera,');
  console.error('  creata su console.anthropic.com.\n');
  process.exit(1);
}

const { default: handler } = await import('./src/handler.mjs');
/* I termini scritti in privacy.html vanno fatti scadere davvero: all'avvio
   e poi una volta al giorno. */
const { avviaPulizia } = await import('./src/pulizia.mjs');
avviaPulizia();
/* Promemoria di riacquisto: un giro al giorno, finche' questo processo
   resta acceso. Il trigger esterno (GitHub Actions) e' il paracadute se
   non resta acceso — vedi scheduler.mjs. */
const { avviaScheduler } = await import('./src/scheduler.mjs');
avviaScheduler();
const { config } = await import('./src/config.mjs');
const { daCompilare, policiesVuote } = await import('./src/policies.mjs');
const { quanti } = await import('./src/catalog.mjs');
const { postaAttiva } = await import('./src/mailer.mjs');

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/chat') return handler(req, res);

  if (url.pathname === '/api/cliente') {
    const { gestisciCliente } = await import('./src/cliente-endpoint.mjs');
    const ip = (req.socket && req.socket.remoteAddress) || 'sconosciuto';
    return gestisciCliente(req, res, url.searchParams.get('c') || '', ip);
  }

  if (url.pathname === '/api/cron/promemoria') {
    const { gestisciCron } = await import('./src/cron-endpoint.mjs');
    return gestisciCron(req, res, url.searchParams.get('secret') || '');
  }

  if (url.pathname === '/api/riordino') {
    const { gestisciRiordino } = await import('./src/riordino-endpoint.mjs');
    const ip = (req.socket && req.socket.remoteAddress) || 'sconosciuto';
    return gestisciRiordino(req, res, url.searchParams.get('t') || '', ip);
  }

  if (url.pathname === '/api/unsubscribe') {
    const { gestisciUnsubscribe } = await import('./src/unsubscribe-endpoint.mjs');
    const ip = (req.socket && req.socket.remoteAddress) || 'sconosciuto';
    return gestisciUnsubscribe(req, res, url.searchParams.get('c') || '', url.searchParams.get('tipo') || '', ip);
  }

  if (url.pathname === '/api/promemoria-aperto') {
    const { gestisciApertura } = await import('./src/apertura-endpoint.mjs');
    return gestisciApertura(req, res, url.searchParams.get('id') || '');
  }

  if (url.pathname === '/api/admin/login') {
    const { gestisciLogin } = await import('./src/admin/login-endpoint.mjs');
    const ip = (req.socket && req.socket.remoteAddress) || 'sconosciuto';
    return gestisciLogin(req, res, ip);
  }

  if (url.pathname === '/api/admin/regole') {
    const { gestisciRegole } = await import('./src/admin/regole-endpoint.mjs');
    return gestisciRegole(req, res, url.searchParams.get('categoria') || '');
  }

  if (url.pathname === '/api/admin/dashboard') {
    const { gestisciDashboard } = await import('./src/admin/dashboard-endpoint.mjs');
    return gestisciDashboard(req, res);
  }

  if (url.pathname === '/api/contatto') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    if (req.method !== 'POST')    { res.statusCode = 405; return res.end('Metodo non ammesso'); }

    let grezzo = '';
    req.on('data', c => { grezzo += c; if (grezzo.length > 100000) req.destroy(); });
    req.on('end', async () => {
      let dati; try { dati = JSON.parse(grezzo || '{}'); }
      catch (e) { res.statusCode = 400; return res.end('Richiesta non valida'); }
      const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || req.socket.remoteAddress || 'sconosciuto';
      const { gestisciContatto } = await import('./src/contatto.mjs');
      return gestisciContatto(req, res, dati, ip);
    });
    return;
  }

  if (url.pathname === '/cc-assistant.js') {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(fs.readFileSync(path.join(BASE, 'widget', 'cc-assistant.js')));
  }

  res.statusCode = 404;
  res.end('Solo /api/chat e /cc-assistant.js');
});

server.listen(config.porta, () => {
  console.log('\n  Assistente Cereria Cicogna');
  console.log('  ──────────────────────────');
  console.log('  in ascolto      http://localhost:' + config.porta + '/api/chat');
  console.log('  modello         ' + config.modello + ' (effort: ' + config.effort + ')');
  console.log('  catalogo        ' + quanti + ' voci');
  console.log('  policy          ' + (policiesVuote
    ? 'documento VUOTO — l\'assistente rimandera\' sempre all\'azienda'
    : daCompilare + ' voci ancora da compilare'));
  console.log('  limiti          ' + config.maxMessaggiOra + ' messaggi/ora per visitatore');
  console.log('  posta           ' + (postaAttiva()
    ? 'attiva — il modulo invia e manda la conferma'
    : 'non configurata — il modulo usa mailto: (vedi CC_RESEND_KEY)') + '\n');
});
