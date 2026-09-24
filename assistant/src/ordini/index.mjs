/* Punto unico da cui il resto del backend legge/scrive ordini e clienti.
   Due adattatori, stessa interfaccia:
     - sheets.mjs  Google Sheets, se configurato (CC_SHEETS_URL + SECRET);
     - locale.mjs  i file del server, che e' dove i dati stanno gia'.
   La scelta si fa a ogni chiamata, non all'avvio: cosi' aggiungere il
   foglio domani non richiede di toccare niente qui, basta impostare le
   due variabili e riavviare.
   Nessun altro file del backend deve sapere quale dei due sta rispondendo. */
import * as sheets from './sheets.mjs';
import * as locale from './locale.mjs';

const adattatore = () => (sheets.sheetsConfigurato() ? sheets : locale);

export const sheetsConfigurato = sheets.sheetsConfigurato;

export const creaOrdine               = (...a) => adattatore().creaOrdine(...a);
export const trovaOrdine              = (...a) => adattatore().trovaOrdine(...a);
export const ordiniPerEmail           = (...a) => adattatore().ordiniPerEmail(...a);
export const tuttiOrdini              = (...a) => adattatore().tuttiOrdini(...a);
export const aggiornaStatoOrdine      = (...a) => adattatore().aggiornaStatoOrdine(...a);

export const daRichiesta              = (...a) => adattatore().daRichiesta(...a);
export const trovaPerEmail            = (...a) => adattatore().trovaPerEmail(...a);
export const trovaPerCodice           = (...a) => adattatore().trovaPerCodice(...a);
export const clientiAttivi            = (...a) => adattatore().clientiAttivi(...a);
export const elencoClienti            = (...a) => adattatore().elencoClienti(...a);
export const impostaConsenso          = (...a) => adattatore().impostaConsenso(...a);
export const impostaConsensoPerCodice = (...a) => adattatore().impostaConsensoPerCodice(...a);
export const aggiornaFrequenza        = (...a) => adattatore().aggiornaFrequenza(...a);
export const registraPromemoriaInviato= (...a) => adattatore().registraPromemoriaInviato(...a);
export const versionePubblica         = (...a) => adattatore().versionePubblica(...a);
