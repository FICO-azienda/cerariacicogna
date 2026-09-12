/* ══════════════════════════════════════════════════════════════
   clienti.mjs — registro dei clienti abituali e loro codici
   ──────────────────────────────────────────────────────────────
   Non e' un sistema di account: non ci sono password. Ogni cliente
   ricorrente ha un codice casuale che vive solo dentro il suo link.
   Il codice non contiene dati: e' il server che, ricevendolo, cerca
   qui chi e'. Chi ha il link vede quei dati, quindi il codice e' a
   tutti gli effetti una credenziale — lungo, con scadenza, revocabile.

   ATTENZIONE: file con dati personali. Va dichiarato nella privacy,
   escluso dal controllo di versione, e ripulito dai codici scaduti.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BASE } from './paths.mjs';

const FILE = process.env.CC_CLIENTI || path.join(BASE, 'data', 'clienti.json');

/* 32 caratteri esadecimali = 128 bit. Indovinarlo a tentativi non e'
   praticabile, e il limite sulle richieste chiude anche quella strada. */
export const nuovoCodice = () => crypto.randomBytes(16).toString('hex');

function leggi() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch (e) { return { clienti: [] }; }
}

function scrivi(dati) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(dati, null, 1) + '\n');
}

export function elenco() { return leggi().clienti; }

/* Confronto a tempo costante: un confronto normale esce al primo carattere
   diverso, e quella differenza di tempo si puo' misurare per indovinare il
   codice un pezzo alla volta. */
function stessoCodice(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

export function trovaPerCodice(codice) {
  const c = String(codice || '').trim();
  if (!/^[a-f0-9]{32}$/.test(c)) return null;         /* forma sbagliata: nemmeno cerco */
  const cliente = leggi().clienti.find(x => stessoCodice(x.codice, c));
  if (!cliente) return null;
  if (cliente.revocato) return null;
  if (cliente.scadenza && new Date(cliente.scadenza) < new Date()) return null;
  return cliente;
}

/* Cio' che il sito puo' sapere: mai il codice, mai note interne. */
export function versionePubblica(cliente) {
  return {
    nome: cliente.nome || '',
    cognome: cliente.cognome || '',
    azienda: cliente.azienda || '',
    email: cliente.email || '',
    linea: cliente.linea || '',
    prodotti: (cliente.prodotti || []).map(p => ({
      nome: p.nome, quantita: p.quantita || 0, oltre: Boolean(p.oltre),
      immagine: p.immagine || '', imgProfumo: p.imgProfumo || '',
      pagina: p.pagina || '', categoria: p.categoria || '',
    })),
  };
}

export function aggiungi(cliente) {
  const dati = leggi();
  const voce = {
    codice: nuovoCodice(),
    creato: new Date().toISOString(),
    /* un link che vive per sempre e' un link che prima o poi finisce
       dove non dovrebbe: dodici mesi, rinnovabili */
    scadenza: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    revocato: false,
    ...cliente,
  };
  dati.clienti.push(voce);
  scrivi(dati);
  return voce;
}

/* ══ Un cliente, un link ══════════════════════════════════════
   Il link nasce da solo dentro la mail di conferma. La regola e'
   una sola: un codice per indirizzo email, non uno per ordine —
   altrimenti chi ordina cinque volte si ritrova cinque chiavi
   valide sparse nella casella, e revocarne una non servirebbe a
   niente. A ogni nuova richiesta lo stesso codice si aggiorna con
   i prodotti freschi e la scadenza riparte da oggi: chi ordina
   regolarmente non se lo vede mai scadere sotto le mani, chi
   sparisce per un anno si'.
   ═══════════════════════════════════════════════════════════ */
const normalizzaEmail = e => String(e || '').trim().toLowerCase();

export const MESI_VALIDITA = 12;
const fraUnAnno = () =>
  new Date(Date.now() + MESI_VALIDITA * 30.44 * 24 * 3600 * 1000).toISOString();

export function daRichiesta({ nome, email, azienda, linea, prodotti }) {
  const mail = normalizzaEmail(email);
  if (!mail) return null;

  const dati = leggi();
  const esistente = dati.clienti.find(c => normalizzaEmail(c.email) === mail);

  if (esistente) {
    esistente.nome = nome || esistente.nome;
    esistente.azienda = azienda || esistente.azienda;
    esistente.linea = linea || esistente.linea;
    /* i prodotti sono quelli dell'ultimo ordine: e' cio' che il cliente
       si aspetta di ritrovare aprendo il link, non un archivio storico */
    if (prodotti && prodotti.length) esistente.prodotti = prodotti;
    esistente.scadenza = fraUnAnno();
    esistente.ultimoOrdine = new Date().toISOString();
    /* una richiesta nuova dallo stesso indirizzo riapre un link revocato:
       se e' stato revocato apposta va cancellata la voce, non aggiornata */
    if (esistente.revocato) { scrivi(dati); return null; }   /* revocato apposta: nessun link */
    scrivi(dati);
    /* "nuovo" serve solo alla mail interna e viene aggiunto DOPO aver
       scritto: e' un'informazione su questa richiesta, non sul cliente */
    return { ...esistente, nuovo: false };
  }

  const creato = aggiungi({ nome, email: mail, azienda, linea, prodotti: prodotti || [],
                            scadenza: fraUnAnno(), ultimoOrdine: new Date().toISOString() });
  return { ...creato, nuovo: true };
}

export function revoca(codice) {
  const dati = leggi();
  const c = dati.clienti.find(x => x.codice === codice);
  if (!c) return false;
  c.revocato = true;
  c.revocatoIl = new Date().toISOString();
  scrivi(dati);
  return true;
}
