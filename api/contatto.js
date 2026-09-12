/* ══════════════════════════════════════════════════════════════
   api/contatto.js — punto d'ingresso serverless del modulo contatti
   Stessa logica del server locale: vive in /api perche' e' li' che
   Vercel cerca le funzioni.
   ══════════════════════════════════════════════════════════════ */
import { gestisciContatto } from '../assistant/src/contatto.mjs';

export default async function handler(req, res) {
  const origine = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origine || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST')    { res.statusCode = 405; return res.end('Metodo non ammesso'); }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
           || (req.socket && req.socket.remoteAddress) || 'sconosciuto';
  const dati = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  return gestisciContatto(req, res, dati, ip);
}
