/* Vercel: GET /api/riordino?t=CODICE — risolve il link "Riordina" di un promemoria. */
import { gestisciRiordino } from '../assistant/src/riordino-endpoint.mjs';

export default function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             (req.socket && req.socket.remoteAddress) || 'sconosciuto';
  const codice = (req.query && req.query.t) ||
                 new URL(req.url, 'http://x').searchParams.get('t') || '';
  return gestisciRiordino(req, res, codice, ip);
}
