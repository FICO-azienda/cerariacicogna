/* Punto unico da cui il resto del backend legge/scrive ordini e clienti.
   Oggi c'e' un solo adattatore (Google Sheets, sheets.mjs). Se un domani
   Sheets venisse sostituito da un database vero, si scrive un nuovo file
   con le stesse funzioni e si cambia solo questa riga — nessun altro file
   del backend deve saperlo. */
export * from './sheets.mjs';
