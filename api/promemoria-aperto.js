/* Vercel: GET /api/promemoria-aperto?id=… — pixel di apertura email. */
import { gestisciApertura } from '../assistant/src/apertura-endpoint.mjs';

export default function handler(req, res) {
  const id = (req.query && req.query.id) ||
             new URL(req.url, 'http://x').searchParams.get('id') || '';
  return gestisciApertura(req, res, id);
}
