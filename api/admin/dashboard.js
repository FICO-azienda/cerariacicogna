/* Vercel: GET /api/admin/dashboard */
import { gestisciDashboard } from '../../assistant/src/admin/dashboard-endpoint.mjs';

export default function handler(req, res) {
  return gestisciDashboard(req, res);
}
