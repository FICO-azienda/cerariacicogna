/* ══════════════════════════════════════════════════════════════
   admin/login-endpoint.mjs — POST /api/admin/login { password }
   ══════════════════════════════════════════════════════════════ */
import { passwordValida, creaSessione, configurato } from './auth.mjs';
import { corpoJSON } from '../corpo-richiesta.mjs';
import { creaLimitatore } from '../tentativi.mjs';
import { registra } from '../log.mjs';
import { cors } from '../cors.mjs';

const { bloccato, segnaBuco } = creaLimitatore({ soglia: 8, finestraMs: 15 * 60 * 1000 });

export async function gestisciLogin(req, res, ip) {
  cors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };

  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  if (!configurato()) return invia(503, { ok: false, errore: 'pannello non configurato' });
  if (bloccato(ip)) { registra({ ip, evento: 'admin-limite' }); return invia(429, { ok: false }); }

  let dati;
  try { dati = await corpoJSON(req); } catch (e) { return invia(400, { ok: false }); }

  if (!passwordValida(dati.password)) {
    segnaBuco(ip);
    registra({ ip, evento: 'admin-login-fallito' });
    return invia(401, { ok: false });
  }

  registra({ ip, evento: 'admin-login' });
  return invia(200, { ok: true, token: creaSessione() });
}
