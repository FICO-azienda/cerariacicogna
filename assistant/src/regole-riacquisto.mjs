/* ══════════════════════════════════════════════════════════════
   regole-riacquisto.mjs — "Automazioni riacquisto" del pannello admin
   ──────────────────────────────────────────────────────────────
   Un valore per categoria (giorni, secondo promemoria, tetto,
   stagionalita', esclusioni), letto e scritto da qui. Il file e'
   regole-categorie.json: non contiene dati di clienti, quindi resta
   nel controllo di versione — e' configurazione, non un registro.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';

const FILE = process.env.CC_REGOLE || path.join(BASE, 'data', 'regole-categorie.json');

function leggi() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { categorie: {} }; }
}

function scrivi(dati) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(dati, null, 2) + '\n');
}

export function tutteLeRegole() { return leggi().categorie; }

export function regolaDi(categoria) {
  const c = leggi().categorie[String(categoria || '').toLowerCase()];
  return c || null;
}

/* Solo i campi che il pannello ammette: non si accetta un intero oggetto
   a scatola chiusa, altrimenti una richiesta malformata potrebbe scrivere
   chiavi arbitrarie nel file di configurazione. */
const numeroOns = (v, min, max, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

function normalizza(patch, precedente) {
  const p = precedente || {};
  const out = { ...p };
  if ('attivo' in patch) out.attivo = Boolean(patch.attivo);
  if ('giorni' in patch) out.giorni = numeroOns(patch.giorni, 1, 365, p.giorni || 45);
  if ('secondoDopo' in patch) {
    out.secondoDopo = patch.secondoDopo === null || patch.secondoDopo === ''
      ? null : numeroOns(patch.secondoDopo, 1, 180, p.secondoDopo || 15);
  }
  if ('maxPromemoria' in patch) out.maxPromemoria = numeroOns(patch.maxPromemoria, 1, 5, p.maxPromemoria || 2);
  if ('sogliaMinima' in patch) out.sogliaMinima = numeroOns(patch.sogliaMinima, 0, 100000, p.sogliaMinima || 0);
  if ('stagionalita' in patch) {
    const s = patch.stagionalita;
    out.stagionalita = (s && /^\d{2}-\d{2}$/.test(s.da) && /^\d{2}-\d{2}$/.test(s.a))
      ? { da: s.da, a: s.a } : null;
  }
  if ('esclusi' in patch) {
    out.esclusi = Array.isArray(patch.esclusi)
      ? patch.esclusi.map(v => String(v).trim().slice(0, 80)).filter(Boolean).slice(0, 50)
      : (p.esclusi || []);
  }
  return out;
}

/* Solo categorie gia' previste: il pannello non ne crea di nuove, perche'
   una categoria nasce quando una pagina prodotto le assegna un cat — vedi
   js/selection.js. Cambiare quello e' un intervento sul codice, non
   sull'automazione. */
export function aggiornaRegola(categoria, patch) {
  const cat = String(categoria || '').toLowerCase();
  const dati = leggi();
  if (!dati.categorie[cat]) return null;
  dati.categorie[cat] = normalizza(patch, dati.categorie[cat]);
  scrivi(dati);
  return dati.categorie[cat];
}
