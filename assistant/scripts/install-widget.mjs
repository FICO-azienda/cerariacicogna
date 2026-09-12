#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   install-widget.mjs — aggiunge (o toglie) il widget dalle pagine
   ──────────────────────────────────────────────────────────────
   Inserisce una riga sola prima di </body> in ogni pagina del sito.
   La riga e' marcata, cosi' si puo' rimuovere o aggiornare senza
   lasciare residui.

     node assistant/scripts/install-widget.mjs --endpoint https://…/api/chat
     node assistant/scripts/install-widget.mjs --rimuovi

   Opzioni:
     --endpoint URL   dove risponde /api/chat (obbligatorio in installazione)
     --privacy  URL   pagina privacy linkata nel banner di trasparenza
     --rimuovi        toglie il widget da tutte le pagine
     --prova          mostra cosa farebbe, senza scrivere niente
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '../src/paths.mjs';

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : null; };
const flag = n => process.argv.includes('--' + n);

const MARCA = 'cc-assistant';
const rimuovi = flag('rimuovi'), prova = flag('prova');
const endpoint = arg('endpoint'), privacy = arg('privacy');

if (!rimuovi && !endpoint) {
  console.error('Serve --endpoint https://.../api/chat  (oppure --rimuovi)');
  process.exit(1);
}

/* le pagine del sito: tutti gli .html tranne i file di lavoro */
const pagine = fs.readdirSync(SITE)
  .filter(f => f.endsWith('.html') && !f.startsWith('_') && !f.endsWith('.bak'));

const riga = '  <script src="assistant/widget/cc-assistant.js"'
  + ' data-endpoint="' + endpoint + '"'
  + (privacy ? ' data-privacy="' + privacy + '"' : '')
  + ' defer></script>';

let toccate = 0;
pagine.forEach(f => {
  const p = path.join(SITE, f);
  let src = fs.readFileSync(p, 'utf8');
  const prima = src;

  /* via la versione precedente, se c'e' */
  src = src.replace(new RegExp('^[ \\t]*<script[^>]*' + MARCA + '[^>]*>\\s*<\\/script>[ \\t]*\\r?\\n', 'gm'), '');

  if (!rimuovi) {
    if (!/<\/body>/i.test(src)) { console.warn('  saltata (niente </body>): ' + f); return; }
    src = src.replace(/([ \t]*)<\/body>/i, riga + '\n$1</body>');
  }

  if (src === prima) return;
  toccate++;
  if (!prova) fs.writeFileSync(p, src);
  console.log('  ' + (rimuovi ? 'tolto da  ' : 'aggiunto a ') + f);
});

console.log('\n' + (prova ? '[prova] ' : '') + toccate + ' pagine su ' + pagine.length + '.');
if (!rimuovi && !prova && toccate) console.log('Ricordati che il widget non funziona finche\' il backend non risponde su ' + endpoint);
