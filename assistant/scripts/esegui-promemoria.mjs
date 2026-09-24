#!/usr/bin/env node
/* Esegue un ciclo di promemoria a mano — utile per provare senza aspettare
   il timer del processo o il trigger esterno. Legge .env come server.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../src/paths.mjs';

const envFile = path.join(SITE, '.env');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(riga => {
    const m = riga.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const { eseguiCicloPromemoria } = await import('../src/scheduler.mjs');
const esito = await eseguiCicloPromemoria();
console.log('[promemoria] ' + JSON.stringify(esito));
