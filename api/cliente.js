/* Vercel: GET /api/cliente?c=CODICE — risolve un link personale. */
import { gestisciCliente } from '../assistant/src/cliente-endpoint.mjs';

export default function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             (req.socket && req.socket.remoteAddress) || 'sconosciuto';
  const codice = (req.query && req.query.c) ||
                 new URL(req.url, 'http://x').searchParams.get('c') || '';
  return gestisciCliente(req, res, codice, ip);
}
