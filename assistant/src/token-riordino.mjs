/* ══════════════════════════════════════════════════════════════
   token-riordino.mjs — il collegamento "Riordina" dentro un promemoria
   ──────────────────────────────────────────────────────────────
   Non e' il codice cliente di clienti.mjs: quello punta sempre
   all'ULTIMO ordine, questo punta a UNA richiesta precisa — quella
   per cui il promemoria e' partito. Un cliente puo' avere un
   promemoria "ceri" ancora aperto mentre nel frattempo ha gia'
   ordinato dell'altro; il link deve riaprire i ceri, non l'ultima
   cosa comprata.

   Stessa logica del codice cliente, stesso motivo: un codice casuale
   che da solo non dice niente, verificato qui col confronto a tempo
   costante gia' scritto in clienti.mjs. Nel link non viaggia mai
   l'email in chiaro ne' altro dato leggibile — solo un riferimento
   che va cercato in questo registro.

   ATTENZIONE: file con dati personali (email). Va escluso dal
   controllo di versione e ripulito dei codici scaduti, come
   clienti.json e richieste.jsonl.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';
import { nuovoCodice, stessoCodice } from './clienti.mjs';

const FILE = process.env.CC_RIORDINI || path.join(BASE, 'data', 'riordini.json');

/* Il tempo per agire su un promemoria e' molto piu' corto del link
   personale (dodici mesi): qui il codice scade prima che la scorta di cui
   parla il promemoria smetta di avere senso. */
export const GIORNI_VALIDITA = 30;

function leggi() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { riordini: [] }; }
}

function scrivi(dati) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(dati, null, 1) + '\n');
}

/* Un token per ogni promemoria mandato: se lo stesso cliente riceve un
   secondo promemoria per lo stesso ordine (categoria "secondoDopo"), il
   codice e' un altro, cosi' un link vecchio che gira ancora non riapre un
   carrello che nel frattempo e' stato gia' modificato altrove. */
export function creaToken({ email, richiestaTs, promemoriaId, categoria }) {
  const mail = String(email || '').trim().toLowerCase();
  if (!mail || !richiestaTs) return null;

  const dati = leggi();
  const voce = {
    codice: nuovoCodice(),
    email: mail,
    richiestaTs,
    promemoriaId: promemoriaId || '',
    categoria: categoria || '',
    creato: new Date().toISOString(),
    scadenza: new Date(Date.now() + GIORNI_VALIDITA * 24 * 3600 * 1000).toISOString(),
  };
  dati.riordini.push(voce);
  scrivi(dati);
  return voce;
}

export function trovaToken(codice) {
  const c = String(codice || '').trim();
  if (!/^[a-f0-9]{32}$/.test(c)) return null;
  const voce = leggi().riordini.find(x => stessoCodice(x.codice, c));
  if (!voce) return null;
  if (voce.scadenza && new Date(voce.scadenza) < new Date()) return null;
  return voce;
}

/* Scaduti: via, come per clienti.json — vedi pulizia.mjs. */
export function pulisciScaduti() {
  const dati = leggi();
  const prima = dati.riordini.length;
  dati.riordini = dati.riordini.filter(v => v.scadenza && new Date(v.scadenza) >= new Date());
  const tolti = prima - dati.riordini.length;
  if (tolti) scrivi(dati);
  return tolti;
}
