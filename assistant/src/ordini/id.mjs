/* ID ordine leggibile: data + 4 caratteri casuali. Non serve un contatore
   sincronizzato con Sheets (che non lo offre in scrittura concorrente
   sicura) — la parte casuale basta a evitare collisioni per i volumi di
   un'azienda come questa, e la data lo rende ordinabile a colpo d'occhio. */
import crypto from 'node:crypto';

export function nuovoIdOrdine(data = new Date()) {
  const giorno = data.toISOString().slice(0, 10).replace(/-/g, '');
  const suffisso = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${giorno}-${suffisso}`;
}
