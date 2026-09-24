/* Vercel/host: POST /api/ordine-stato-cambiato — chiamato da Apps Script
   quando lo staff cambia lo stato di un ordine nel foglio Google. */
import { gestisciStatoOrdine } from '../assistant/src/ordini/stato-endpoint.mjs';

export default function handler(req, res) {
  return gestisciStatoOrdine(req, res);
}
