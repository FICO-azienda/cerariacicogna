/* ══════════════════════════════════════════════════════════════
   pulizia.mjs — fa scadere davvero i dati che la privacy promette
   ──────────────────────────────────────────────────────────────
   Una privacy policy che dice "90 giorni" e poi tiene tutto per
   sempre e' una dichiarazione falsa, non una svista. Qui i termini
   scritti in privacy.html diventano cancellazioni vere.

   Gira all'avvio del server e una volta al giorno.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';
import { config } from './config.mjs';

const GIORNO = 24 * 60 * 60 * 1000;

/* I termini dichiarati ai visitatori. Cambiarli qui significa
   cambiarli anche in privacy.html: sono la stessa promessa. */
export const TERMINI = {
  conversazioni: 90,        /* giorni */
  richieste: 730,           /* 24 mesi, dall'ULTIMO contatto di quella persona */
  clientiScaduti: 30,       /* giorni di tolleranza dopo la scadenza del link */
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

/* ── 2. l'archivio delle richieste ──
   "24 mesi dall'ultimo contatto" e' per PERSONA, non per riga: chi
   riscrive fa ripartire il conto, e le sue richieste vecchie restano
   finche' resta cliente. */
function pulisciArchivio(file, giorni) {
  if (!file || !fs.existsSync(file)) return 0;
  const righe = fs.readFileSync(file, 'utf8').split('\n').filter(r => r.trim());
  const voci = righe.map(r => { try { return { r, v: JSON.parse(r) }; } catch (e) { return null; } })
                    .filter(Boolean);

  const ultimoContatto = new Map();
  voci.forEach(({ v }) => {
    const chiave = String(v.email || '').trim().toLowerCase();
    if (!chiave) return;
    const t = Date.parse(v.data || v.ts || '');
    if (!Number.isFinite(t)) return;
    if (!ultimoContatto.has(chiave) || t > ultimoContatto.get(chiave)) ultimoContatto.set(chiave, t);
  });

  let tolte = 0;
  const tenute = voci.filter(({ v }) => {
    const chiave = String(v.email || '').trim().toLowerCase();
    const ultimo = ultimoContatto.get(chiave);
    if (!Number.isFinite(ultimo)) return true;
    if ((Date.now() - ultimo) > giorni * GIORNO) { tolte++; return false; }
    return true;
  }).map(({ r }) => r);

  if (tolte) fs.writeFileSync(file, tenute.join('\n') + (tenute.length ? '\n' : ''));
  return tolte;
}

/* ── 3. i link personali spenti ──
   Scaduti o revocati non aprono piu' nulla, ma i dati che ci stanno
   dietro (nome, email, prodotti) resterebbero li' a fare polvere. */
function pulisciClienti(file, tolleranza) {
  if (!file || !fs.existsSync(file)) return 0;
  let dati;
  try { dati = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return 0; }
  if (!dati || !Array.isArray(dati.clienti)) return 0;

  const prima = dati.clienti.length;
  dati.clienti = dati.clienti.filter(c => {
    if (c.revocato) return !vecchio(c.revocatoIl || c.creato, tolleranza);
    return !vecchio(c.scadenza, tolleranza);
  });
  const tolte = prima - dati.clienti.length;
  if (tolte) fs.writeFileSync(file, JSON.stringify(dati, null, 1) + '\n');
  return tolte;
}

export function pulisci() {
  const esito = {
    conversazioni: pulisciLog(config.logFile, TERMINI.conversazioni),
    richieste: pulisciArchivio(
      process.env.CC_ARCHIVIO || path.join(BASE, 'data', 'richieste.jsonl'), TERMINI.richieste),
    clienti: pulisciClienti(
      process.env.CC_CLIENTI || path.join(BASE, 'data', 'clienti.json'), TERMINI.clientiScaduti),
  };
  const tot = esito.conversazioni + esito.richieste + esito.clienti;
  if (tot) {
    console.log('[pulizia] cancellati: ' + esito.conversazioni + ' righe di conversazione, '
      + esito.richieste + ' richieste, ' + esito.clienti + ' link spenti');
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
