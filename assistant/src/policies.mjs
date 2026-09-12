/* ══════════════════════════════════════════════════════════════
   policies.mjs — carica config/FAQ_POLICIES.md e ne toglie i buchi
   ──────────────────────────────────────────────────────────────
   Regola non negoziabile: l'assistente puo' parlare di spedizioni,
   resi, materiali e tempi SOLO leggendo questo documento. Le voci
   ancora marcate [DA COMPILARE] vengono rimosse prima di arrivare
   al modello, cosi' una policy non scritta non puo' essere inventata:
   semplicemente non esiste nel suo contesto.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';

const MARCATORE = '[DA COMPILARE]';

const grezzo = fs.readFileSync(path.join(BASE, 'config', 'FAQ_POLICIES.md'), 'utf8');

/* Toglie il blocco di istruzioni iniziale (le righe che iniziano con >)
   e ogni paragrafo che contiene il marcatore. Un paragrafo = testo fino
   alla riga vuota successiva, cosi' spariscono anche le note esplicative
   che seguono il marcatore sulla riga dopo. */
function ripulisci(md) {
  const paragrafi = md.split(/\n\s*\n/);
  return paragrafi
    .filter(p => !p.includes(MARCATORE))
    .filter(p => !p.trim().split('\n').every(r => r.trim().startsWith('>')))
    .join('\n\n')
    /* un titolo rimasto senza contenuto sotto non serve a nessuno */
    .replace(/\n(#{2,3} [^\n]+)\n(?=\n*#{2,3} )/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export const policies = ripulisci(grezzo);

/* quante voci restano da scrivere: serve al log di avvio e alla /health */
export const daCompilare = (grezzo.match(/\[DA COMPILARE\]/g) || []).length;

/* true quando il documento e' cosi' vuoto da non poter rispondere a nulla */
export const policiesVuote = policies.replace(/[#>\s-]/g, '').length < 200;
