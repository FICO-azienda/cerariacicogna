/* Vercel: GET/PUT /api/admin/regole?categoria=… */
import { gestisciRegole } from '../../assistant/src/admin/regole-endpoint.mjs';

export default function handler(req, res) {
  const categoria = (req.query && req.query.categoria) ||
                     new URL(req.url, 'http://x').searchParams.get('categoria') || '';
  return gestisciRegole(req, res, categoria);
}
