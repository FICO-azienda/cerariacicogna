/* ══════════════════════════════════════════════════════════════
   ratelimit.mjs — tetto ai messaggi per visitatore
   ──────────────────────────────────────────────────────────────
   Finestra scorrevole di un'ora, tenuta in memoria. Basta e avanza
   per un sito vetrina su un singolo processo. ATTENZIONE: su un
   hosting serverless che scala su piu' istanze ogni istanza ha il
   suo contatore — con traffico serio va spostato su Redis/Upstash.
   ══════════════════════════════════════════════════════════════ */
import { config } from './config.mjs';

const ORA = 60 * 60 * 1000;
const visite = new Map();   /* chiave → [timestamp, ...] */

function colpi(chiave, ora) {
  const arr = (visite.get(chiave) || []).filter(t => ora - t < ORA);
  visite.set(chiave, arr);
  return arr;
}

/* pulizia periodica: senza, la mappa cresce all'infinito */
let ultimaPulizia = 0;
function pulisci(ora) {
  if (ora - ultimaPulizia < ORA) return;
  ultimaPulizia = ora;
  for (const [k, arr] of visite) {
    const vivi = arr.filter(t => ora - t < ORA);
    if (vivi.length) visite.set(k, vivi); else visite.delete(k);
  }
}

export function consenti(ip, sessione, messaggiSessione) {
  const ora = Date.now();
  pulisci(ora);

  if (messaggiSessione > config.maxMessaggiSessione) {
    return { ok: false, motivo: 'sessione' };
  }
  const perIp = colpi('ip:' + ip, ora);
  if (perIp.length >= config.maxMessaggiOra) {
    return { ok: false, motivo: 'frequenza', riprovaTra: Math.ceil((ORA - (ora - perIp[0])) / 60000) };
  }
  perIp.push(ora);
  if (sessione) colpi('s:' + sessione, ora).push(ora);
  return { ok: true };
}
