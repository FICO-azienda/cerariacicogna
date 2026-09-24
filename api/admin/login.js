/* Vercel: POST /api/admin/login { password } */
import { gestisciLogin } from '../../assistant/src/admin/login-endpoint.mjs';

export default function handler(req, res) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
             (req.socket && req.socket.remoteAddress) || 'sconosciuto';
  return gestisciLogin(req, res, ip);
}
