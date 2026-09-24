/* ══════════════════════════════════════════════════════════════
   pulizia.mjs — fa scadere davvero i dati che la privacy promette
   ──────────────────────────────────────────────────────────────
   Una privacy policy che dice "90 giorni" e poi tiene tutto per
   sempre e' una dichiarazione falsa, non una svista. Qui i termini
   scritti in privacy.html diventano cancellazioni vere.

   Ordini e clienti vivono ora su Google Sheets (assistant/src/ordini/),
   non piu' su file locali: la loro conservazione la decide chi gestisce
   il foglio, non questo script. Qui restano solo i dati che il backend
   Node genera e tiene per conto suo: il registro delle conversazioni
   con l'assistente e i link di riordino scaduti.

   Gira all'avvio del server e una volta al giorno.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import { config } from './config.mjs';
import { pulisciScaduti as pulisciRiordini } from './token-riordino.mjs';

const GIORNO = 24 * 60 * 60 * 1000;

/* I termini dichiarati ai visitatori. Cambiarli qui significa
   cambiarli anche in privacy.html: sono la stessa promessa. */
export const TERMINI = {
  conversazioni: 90,        /* giorni */
};

const vecchio = (iso, giorni) => {
  const t = Date.parse(iso);
  return !Number.isFinite(t) || (Date.now() - t) > giorni * GIORNO;
};

/* ── 1. il registro delle conversazioni ── */
function pulisciLog(file, giorni) {
  if (!file || !fs.existsSync(file)) return 0;
  const righe = fs.readFileSync(file, 'utf8').split('\n');
  let tolte = 0;
  const tenute = righe.filter(r => {
    if (!r.trim()) return false;
    /* leggo il JSON davvero invece di cercare "ts" con un'espressione
       regolare: bastava uno spazio dopo i due punti per non trovarlo, e la
       cancellazione sarebbe fallita in silenzio — il modo peggiore, perche'
       la privacy avrebbe continuato a promettere una scadenza inesistente */
    let v = null;
    try { v = JSON.parse(r.replace(/^\[chat\]\s*/, '')); } catch (e) { return true; }
    const ts = v && (v.ts || v.data);
    if (!ts) return true;                   /* riga senza data: non la butto */
    if (vecchio(ts, giorni)) { tolte++; return false; }
    return true;
  });
  if (tolte) fs.writeFileSync(file, tenute.join('\n') + (tenute.length ? '\n' : ''));
  return tolte;
}

export function pulisci() {
  const esito = {
    conversazioni: pulisciLog(config.logFile, TERMINI.conversazioni),
    riordini: pulisciRiordini(),
  };
  const tot = esito.conversazioni + esito.riordini;
  if (tot) {
    console.log('[pulizia] cancellati: ' + esito.conversazioni + ' righe di conversazione, '
      + esito.riordini + ' link di riordino scaduti');
  }
  return esito;
}

/* All'avvio e poi una volta al giorno. unref: il timer non deve tenere
   in vita il processo da solo. */
export function avviaPulizia() {
  pulisci();
  const t = setInterval(pulisci, GIORNO);
  if (t.unref) t.unref();
  return t;
}
