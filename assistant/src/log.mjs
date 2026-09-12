/* ══════════════════════════════════════════════════════════════
   log.mjs — traccia delle conversazioni, una riga JSON per turno
   ──────────────────────────────────────────────────────────────
   Serve a rileggere cosa chiede la gente e a correggere il tiro.
   Si tiene volutamente stretto: niente IP in chiaro (solo un hash
   troncato), niente contenuti oltre il testo del turno. Cancellare
   il file periodicamente fa parte della conformita' GDPR: la
   conservazione va dichiarata nella privacy policy.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { config } from './config.mjs';

const anonimo = ip => crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 10);

export function registra(voce) {
  if (!config.logAttivo) return;
  const riga = JSON.stringify({ ts: new Date().toISOString(), ...voce, ip: voce.ip ? anonimo(voce.ip) : undefined });
  if (!config.logFile) { console.log('[chat] ' + riga); return; }
  try { fs.appendFileSync(config.logFile, riga + '\n'); }
  catch (e) { console.warn('[chat] log non scritto: ' + e.message); }
}
