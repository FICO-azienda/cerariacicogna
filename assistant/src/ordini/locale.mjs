/* ══════════════════════════════════════════════════════════════
   ordini/locale.mjs — gli stessi dati, ma sui file del server
   ──────────────────────────────────────────────────────────────
   L'adattatore Google Sheets (sheets.mjs) presuppone che il foglio
   esista e sia configurato: senza, ogni lettura lancia un errore.
   Ma il sito gira su un server con un disco suo, dove clienti e
   richieste sono gia' salvati da prima che Sheets esistesse.

   Questo file espone le stesse funzioni leggendo di li'. Serve a
   due cose: far funzionare tutto senza Google, e non perdere i
   dati dei clienti che ci sono gia'.

   Un "ordine", qui, e' una richiesta arrivata dal modulo: e' la
   stessa cosa vista da due angoli. L'identificativo e' l'istante
   in cui e' arrivata, che e' gia' unico per costruzione.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from '../paths.mjs';
import { registraRichiesta, leggiRichieste, storicoPerEmail } from '../archivio.mjs';
import * as clienti from '../clienti.mjs';

const FILE_STATI = process.env.CC_STATI_ORDINE_LOCALI
  || path.join(BASE, 'data', 'stati-ordini-locali.json');

function leggiStati() {
  try { return JSON.parse(fs.readFileSync(FILE_STATI, 'utf8')); }
  catch (e) { return {}; }
}

function conStato(ordine, stati) {
  return {
    ...ordine,
    id: ordine.ts,
    stato: (stati[ordine.ts] && stati[ordine.ts].stato) || '',
    statoPagamento: (stati[ordine.ts] && stati[ordine.ts].statoPagamento) || '',
    dataStimata: (stati[ordine.ts] && stati[ordine.ts].dataStimata) || '',
  };
}

/* ── ordini ── */
export async function creaOrdine(d) {
  /* registraRichiesta parla la lingua del modulo (img, url): qui si
     arriva con i nomi gia' normalizzati, quindi si ritraducono. */
  const voce = registraRichiesta({
    nome: d.nome, cognome: d.cognome, email: d.email, azienda: d.azienda,
    oggetto: d.linea, fornitura: d.fornitura, messaggio: d.messaggio,
    promemoriaRif: d.promemoriaRif,
    articoli: (d.articoli || []).map(a => ({
      nome: a.nome, quantita: a.quantita, oltre: a.oltre, categoria: a.categoria,
      img: a.immagine || a.img || '', imgProfumo: a.imgProfumo || '',
      url: a.pagina || a.url || '',
    })),
  });
  return { ...(voce || {}), id: voce ? voce.ts : '' };
}

export async function ordiniPerEmail(email) {
  const stati = leggiStati();
  return storicoPerEmail(email).map(o => conStato(o, stati));
}

export async function tuttiOrdini() {
  const stati = leggiStati();
  return leggiRichieste().map(o => conStato(o, stati));
}

export async function trovaOrdine(id) {
  return (await tuttiOrdini()).find(o => o.id === id) || null;
}

export async function aggiornaStatoOrdine(id, stato) {
  const stati = leggiStati();
  stati[id] = { ...(stati[id] || {}), stato, aggiornato: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(FILE_STATI), { recursive: true });
    fs.writeFileSync(FILE_STATI, JSON.stringify(stati, null, 2));
  } catch (e) { console.warn('[ordini] stato non salvato: ' + e.message); }
  return trovaOrdine(id);
}

/* ── clienti: gia' tutto in clienti.mjs, qui solo i nomi combacianti ── */
export const daRichiesta               = async d => clienti.daRichiesta(d);
export const trovaPerEmail             = async e => clienti.trovaPerEmail(e);
export const trovaPerCodice            = async c => clienti.trovaPerCodice(c);
export const clientiAttivi             = async () => clienti.clientiAttivi();
export const elencoClienti             = async () => clienti.elenco();
export const impostaConsenso           = async (e, p) => clienti.impostaConsenso(e, p);
export const impostaConsensoPerCodice  = async (c, p) => clienti.impostaConsensoPerCodice(c, p);
export const aggiornaFrequenza         = async (e, g) => clienti.aggiornaFrequenza(e, g);
export const registraPromemoriaInviato = async (e, v) => clienti.registraPromemoriaInviato(e, v);
export const versionePubblica          = c => clienti.versionePubblica(c);
