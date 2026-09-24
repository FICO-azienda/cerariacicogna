/* ══════════════════════════════════════════════════════════════
   ordini/sheets.mjs — Google Sheets come database di ordini e clienti
   ──────────────────────────────────────────────────────────────
   Non parla con Google direttamente: parla con un Web App di Google
   Apps Script pubblicato DENTRO il foglio stesso (vedi
   google-apps-script/Codice.gs). Niente account di sviluppo Google
   Cloud, niente chiave di servizio da proteggere — solo un indirizzo
   e un segreto condiviso, come gli altri endpoint di questo backend.

   Questo e' l'UNICO file che sa che il database e' un foglio Google.
   Tutto il resto del backend (contatto.mjs, scheduler.mjs, motore-
   promemoria.mjs, la dashboard) passa da qui — se un domani Sheets
   diventasse un vero database, si riscrive solo questo file.

   Le forme dei dati (cliente, ordine) ricalcano apposta quelle che
   clienti.mjs e archivio.mjs usavano su file locali: cosi' il motore
   dei promemoria, gia' scritto e testato, non ha dovuto cambiare —
   gli si passano queste funzioni al posto di quelle.
   ══════════════════════════════════════════════════════════════ */
import { nuovoCodice, stessoCodice } from '../clienti.mjs';
import { nuovoIdOrdine } from './id.mjs';
import { STATO_INIZIALE } from './stati.mjs';

const URL_SHEET = () => process.env.CC_SHEETS_URL || '';
const SEGRETO = () => process.env.CC_SHEETS_SECRET || '';

export function sheetsConfigurato() {
  return Boolean(URL_SHEET() && SEGRETO());
}

async function chiamata(azione, dati = {}) {
  if (!sheetsConfigurato()) throw new Error('Google Sheets non configurato (CC_SHEETS_URL/CC_SHEETS_SECRET)');
  const r = await fetch(URL_SHEET(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ segreto: SEGRETO(), azione, dati }),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error('Sheets HTTP ' + r.status);
  const corpo = await r.json();
  if (!corpo || corpo.ok !== true) throw new Error('Sheets: ' + (corpo && corpo.errore || 'risposta non valida'));
  return corpo.risultato;
}

const normalizzaEmail = e => String(e || '').trim().toLowerCase();

/* ══ ordini ══════════════════════════════════════════════════ */

export async function creaOrdine({ nome, cognome, email, azienda, telefono, indirizzo, linea,
                                    articoli, fornitura, messaggio, lingua, promemoriaRif }) {
  const mail = normalizzaEmail(email);
  const ordine = {
    id: nuovoIdOrdine(),
    ts: new Date().toISOString(),
    nome: nome || '', cognome: cognome || '', email: mail, azienda: azienda || '',
    telefono: telefono || '', indirizzo: indirizzo || '',
    tipoCliente: azienda ? 'B2B' : 'B2C',
    linea: linea || '',
    articoli: articoli || [],
    prezzoTotale: '', metodoPagamento: '', statoPagamento: '',
    stato: STATO_INIZIALE,
    dataPrevistaSpedizione: '', dataSpedizione: '', dataConsegna: '',
    fornitura: fornitura || null,
    note: '', messaggio: String(messaggio || '').slice(0, 2000),
    lingua: lingua === 'en' ? 'en' : 'it',
    promemoriaRif: promemoriaRif || '',
  };
  await chiamata('creaOrdine', { ordine });
  return ordine;
}

export async function trovaOrdine(id) {
  return chiamata('trovaOrdine', { id });
}

export async function ordiniPerEmail(email) {
  const mail = normalizzaEmail(email);
  if (!mail) return [];
  const righe = await chiamata('ordiniPerEmail', { email: mail });
  return (righe || []).slice().sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

export async function tuttiOrdini() {
  return chiamata('tuttiOrdini', {});
}

export async function aggiornaStatoOrdine(id, stato) {
  return chiamata('aggiornaStatoOrdine', { id, stato });
}

/* ══ clienti ═════════════════════════════════════════════════
   Stessa politica di clienti.mjs: un codice per email, non per
   ordine. daRichiesta() crea o aggiorna la scheda cliente e le
   assegna il codice del link personale, esattamente come prima. */

const consensoIniziale = () => ({ newsletter: false, promemoriaRiacquisto: true, aggiornato: new Date().toISOString() });
const MESI_VALIDITA = 12;
const fraUnAnno = () => new Date(Date.now() + MESI_VALIDITA * 30.44 * 24 * 3600 * 1000).toISOString();

export async function daRichiesta({ nome, email, azienda, telefono, indirizzo, linea, lingua, prodotti }) {
  const mail = normalizzaEmail(email);
  if (!mail) return null;

  const esistente = await chiamata('trovaCliente', { email: mail });

  if (esistente) {
    if (esistente.revocato) return null;
    const aggiornato = await chiamata('aggiornaCliente', {
      email: mail,
      patch: {
        nome: nome || esistente.nome, azienda: azienda || esistente.azienda,
        telefono: telefono || esistente.telefono, indirizzo: indirizzo || esistente.indirizzo,
        linea: linea || esistente.linea, lingua: lingua || esistente.lingua,
        prodotti: (prodotti && prodotti.length) ? prodotti : esistente.prodotti,
        scadenza: fraUnAnno(), ultimoOrdine: new Date().toISOString(),
      },
    });
    return { ...aggiornato, nuovo: false };
  }

  const nuovo = {
    codice: nuovoCodice(), creato: new Date().toISOString(), scadenza: fraUnAnno(), revocato: false,
    nome: nome || '', email: mail, azienda: azienda || '', telefono: telefono || '', indirizzo: indirizzo || '',
    linea: linea || '', lingua: lingua || 'it', prodotti: prodotti || [],
    ultimoOrdine: new Date().toISOString(),
    consenso: consensoIniziale(), frequenzaMediaGiorni: null, promemoria: [],
  };
  await chiamata('creaCliente', { cliente: nuovo });
  return { ...nuovo, nuovo: true };
}

export async function trovaPerEmail(email) {
  const mail = normalizzaEmail(email);
  if (!mail) return null;
  return chiamata('trovaCliente', { email: mail });
}

export async function trovaPerCodice(codice) {
  const c = String(codice || '').trim();
  if (!/^[a-f0-9]{32}$/.test(c)) return null;
  const cliente = await chiamata('trovaClientePerCodice', { codice: c });
  if (!cliente) return null;
  if (!stessoCodice(cliente.codice, c)) return null;   /* doppio controllo, a tempo costante */
  if (cliente.revocato) return null;
  if (cliente.scadenza && new Date(cliente.scadenza) < new Date()) return null;
  return cliente;
}

export function versionePubblica(cliente) {
  return {
    nome: cliente.nome || '', cognome: cliente.cognome || '', azienda: cliente.azienda || '',
    email: cliente.email || '', linea: cliente.linea || '',
    prodotti: (cliente.prodotti || []).map(p => ({
      nome: p.nome, quantita: p.quantita || 0, oltre: Boolean(p.oltre),
      immagine: p.immagine || '', imgProfumo: p.imgProfumo || '',
      pagina: p.pagina || '', categoria: p.categoria || '',
    })),
  };
}

export async function clientiAttivi() {
  const tutti = await chiamata('elencoClienti', {});
  const ora = new Date();
  return (tutti || []).filter(c => !c.revocato && (!c.scadenza || new Date(c.scadenza) >= ora));
}

export async function elencoClienti() {
  return chiamata('elencoClienti', {});
}

export async function impostaConsenso(email, patch) {
  return chiamata('aggiornaCliente', { email: normalizzaEmail(email), patch: { consenso: patch, consensoPatch: true } });
}

export async function impostaConsensoPerCodice(codice, patch) {
  const cliente = await chiamata('trovaClientePerCodice', { codice: String(codice || '').trim() });
  if (!cliente || !stessoCodice(cliente.codice, codice)) return null;
  const aggiornato = await chiamata('aggiornaCliente', { email: cliente.email, patch: { consenso: patch, consensoPatch: true } });
  return { consenso: aggiornato.consenso, email: aggiornato.email };
}

export async function aggiornaFrequenza(email, frequenzaMediaGiorni) {
  await chiamata('aggiornaCliente', { email: normalizzaEmail(email), patch: { frequenzaMediaGiorni } });
  return true;
}

export async function registraPromemoriaInviato(email, voce) {
  await chiamata('aggiungiPromemoria', { email: normalizzaEmail(email), voce: { ts: new Date().toISOString(), ...voce } });
  return true;
}
