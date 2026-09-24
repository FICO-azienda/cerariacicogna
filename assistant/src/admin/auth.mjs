/* ══════════════════════════════════════════════════════════════
   admin/auth.mjs — una password sola, una sessione firmata
   ──────────────────────────────────────────────────────────────
   Non e' un sistema utenti: e' una porta con una chiave condivisa
   fra chi in azienda usa il pannello. Basta e avanza per uno
   strumento interno con pochissime persone — un vero sistema utenti
   sarebbe complessita' senza bisogno reale dietro.

   La sessione e' un token firmato (HMAC), non un record da cercare
   su disco: si verifica da solo, scade da solo, niente da ripulire.
   ══════════════════════════════════════════════════════════════ */
import crypto from 'node:crypto';
import { stessoCodice } from '../clienti.mjs';

const DURATA_MS = 12 * 60 * 60 * 1000;   /* 12 ore: un turno di lavoro */

const segreto = () => String(process.env.CC_TOKEN_SECRET || '');

function firma(payload) {
  return crypto.createHmac('sha256', segreto()).update(payload).digest('hex');
}

export function configurato() {
  return Boolean(segreto()) && segreto().length >= 16
    && Boolean(process.env.CC_ADMIN_PASSWORD) && process.env.CC_ADMIN_PASSWORD.length >= 8;
}

export function passwordValida(fornita) {
  if (!configurato()) return false;
  return stessoCodice(process.env.CC_ADMIN_PASSWORD, String(fornita || ''));
}

export function creaSessione() {
  if (!configurato()) return null;
  const payload = String(Date.now() + DURATA_MS);
  return Buffer.from(payload).toString('base64url') + '.' + firma(payload);
}

export function sessioneValida(token) {
  if (!configurato() || !token || typeof token !== 'string') return false;
  const punto = token.indexOf('.');
  if (punto < 0) return false;
  const b64 = token.slice(0, punto), fornita = token.slice(punto + 1);
  let payload;
  try { payload = Buffer.from(b64, 'base64url').toString('utf8'); } catch (e) { return false; }
  if (!stessoCodice(firma(payload), fornita)) return false;
  const scadenza = Number(payload);
  return Number.isFinite(scadenza) && Date.now() < scadenza;
}

/* estrae "Bearer TOKEN" dall'header Authorization */
export function tokenDaRichiesta(req) {
  const h = req.headers && req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return '';
  return h.slice(7).trim();
}
