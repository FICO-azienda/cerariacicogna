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
   codice un pezzo alla volta. Esportata perche' token-riordino.mjs genera
   un secondo registro di codici opachi con la stessa identica esigenza:
   meglio un confronto solo, riusato, che due copie da mantenere allineate. */
export function stessoCodice(a, b) {
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

/* Consenso di default per un cliente appena creato: il promemoria di
   riacquisto e' acceso di default (si basa sul soft spam: chi ci scrive
   per una richiesta commerciale puo' ricevere, su prodotti analoghi, un
   promemoria facile da rifiutare — vedi privacy.html). La newsletter resta
   sempre spenta finche' non la spunta esplicitamente nel modulo: sono due
   consensi diversi, con basi giuridiche diverse, e non si scambiano mai. */
const consensoIniziale = () => ({ newsletter: false, promemoriaRiacquisto: true, aggiornato: new Date().toISOString() });

export function aggiungi(cliente) {
  const dati = leggi();
  const voce = {
    codice: nuovoCodice(),
    creato: new Date().toISOString(),
    /* un link che vive per sempre e' un link che prima o poi finisce
       dove non dovrebbe: dodici mesi, rinnovabili */
    scadenza: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    revocato: false,
    consenso: consensoIniziale(),
    frequenzaMediaGiorni: null,
    promemoria: [],
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

export function daRichiesta({ nome, email, azienda, linea, prodotti, lingua }) {
  const mail = normalizzaEmail(email);
  if (!mail) return null;

  const dati = leggi();
  const esistente = dati.clienti.find(c => normalizzaEmail(c.email) === mail);

  if (esistente) {
    esistente.nome = nome || esistente.nome;
    esistente.azienda = azienda || esistente.azienda;
    esistente.linea = linea || esistente.linea;
    /* la lingua in cui ha scritto l'ULTIMA volta: e' quella in cui gli
       arrivano i promemoria, come per la conferma di richiesta. */
    if (lingua) esistente.lingua = lingua;
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

  const creato = aggiungi({ nome, email: mail, azienda, linea, prodotti: prodotti || [], lingua: lingua || 'it',
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

/* ══ Automazioni di riacquisto: le funzioni che servono solo a quello ══
   Tutte a valle di daRichiesta: il cliente esiste gia' quando le si chiama. */

export function trovaPerEmail(email) {
  const mail = normalizzaEmail(email);
  if (!mail) return null;
  return leggi().clienti.find(c => normalizzaEmail(c.email) === mail) || null;
}

/* Un cliente NON revocato e NON scaduto: e' la platea a cui i promemoria
   possono rivolgersi. Un link scaduto non apre piu' nulla, quindi non ha
   senso invitarlo a usarlo. */
export function clientiAttivi() {
  const ora = new Date();
  return leggi().clienti.filter(c => !c.revocato && (!c.scadenza || new Date(c.scadenza) >= ora));
}

/* Consenso newsletter e consenso promemoria sono due interruttori distinti,
   mai scambiati: patch prende solo le chiavi passate, l'altra resta com'era. */
export function impostaConsenso(email, patch) {
  const mail = normalizzaEmail(email);
  const dati = leggi();
  const c = dati.clienti.find(x => normalizzaEmail(x.email) === mail);
  if (!c) return null;
  c.consenso = { ...consensoIniziale(), ...c.consenso, ...patch, aggiornato: new Date().toISOString() };
  scrivi(dati);
  return c.consenso;
}

/* Per il link di disiscrizione: stesso codice del link personale, che il
   cliente ha gia' in una vecchia email — non serve inventarne un altro. */
export function impostaConsensoPerCodice(codice, patch) {
  const dati = leggi();
  const c = dati.clienti.find(x => stessoCodice(x.codice, codice));
  if (!c) return null;
  c.consenso = { ...consensoIniziale(), ...c.consenso, ...patch, aggiornato: new Date().toISOString() };
  scrivi(dati);
  return { consenso: c.consenso, email: c.email };
}

/* Frequenza media ricalcolata dallo storico reale (archivio.mjs la calcola,
   qui la si registra sulla scheda cliente): e' il valore che il motore usa
   al posto di quello di categoria dal terzo ordine in poi. */
export function aggiornaFrequenza(email, frequenzaMediaGiorni) {
  const mail = normalizzaEmail(email);
  const dati = leggi();
  const c = dati.clienti.find(x => normalizzaEmail(x.email) === mail);
  if (!c) return false;
  c.frequenzaMediaGiorni = frequenzaMediaGiorni;
  scrivi(dati);
  return true;
}

/* Traccia dei promemoria gia' mandati: serve al motore per non rimandare lo
   stesso promemoria due volte e per rispettare il tetto massimo per ordine.
   Tiene solo gli ultimi 20: e' uno storico di servizio, non un registro. */
export function registraPromemoriaInviato(email, voce) {
  const mail = normalizzaEmail(email);
  const dati = leggi();
  const c = dati.clienti.find(x => normalizzaEmail(x.email) === mail);
  if (!c) return false;
  if (!Array.isArray(c.promemoria)) c.promemoria = [];
  c.promemoria.push({ ts: new Date().toISOString(), ...voce });
  if (c.promemoria.length > 20) c.promemoria = c.promemoria.slice(-20);
  scrivi(dati);
  return true;
}
