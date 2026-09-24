/* Vercel: GET /api/unsubscribe?c=CODICE&tipo=promemoria|newsletter */
import { gestisciUnsubscribe } from '../assistant/src/unsubscribe-endpoint.mjs';

export default function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             (req.socket && req.socket.remoteAddress) || 'sconosciuto';
  const url = new URL(req.url, 'http://x');
  const codice = (req.query && req.query.c) || url.searchParams.get('c') || '';
  const tipo = (req.query && req.query.tipo) || url.searchParams.get('tipo') || '';
  return gestisciUnsubscribe(req, res, codice, tipo, ip);
}
