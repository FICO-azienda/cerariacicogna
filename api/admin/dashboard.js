/* Vercel: GET /api/admin/dashboard?periodo=…&cliente=…&tipo=…&stato=…&categoria=… */
import { gestisciDashboard } from '../../assistant/src/admin/dashboard-endpoint.mjs';

function filtriDaUrl(req) {
  const p = (req.query && Object.keys(req.query).length) ? req.query : Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const [da, a] = String(p.periodo || '').split('..');
  return { da: da || '', a: a || '', cliente: p.cliente || '', tipo: p.tipo || '', stato: p.stato || '', categoria: p.categoria || '' };
}

export default function handler(req, res) {
  return gestisciDashboard(req, res, filtriDaUrl(req));
}
