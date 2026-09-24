/* ══════════════════════════════════════════════════════════════
   tentativi.mjs — blocca chi indovina codici a forza bruta
   ──────────────────────────────────────────────────────────────
   Conta solo i tentativi ANDATI A VUOTO, per IP: chi cerca di
   indovinare un codice sbaglia sempre e quindi si blocca lo stesso;
   un cliente vero che riapre il suo link dieci volte in un
   pomeriggio non si trova la porta chiusa in faccia.

   Estratto da cliente-endpoint.mjs perche' riordino-endpoint.mjs ha
   esattamente lo stesso bisogno su un secondo registro di codici:
   stessa logica, un posto solo.
   ══════════════════════════════════════════════════════════════ */
export function creaLimitatore({ finestraMs = 60 * 60 * 1000, soglia = 20, maxIp = 5000 } = {}) {
  const mappa = new Map();
  return {
    bloccato(ip) {
      const ora = Date.now();
      const arr = (mappa.get(ip) || []).filter(t => ora - t < finestraMs);
      mappa.set(ip, arr);
      if (mappa.size > maxIp) mappa.clear();     /* la mappa non deve crescere all'infinito */
      return arr.length >= soglia;
    },
    segnaBuco(ip) {
      const arr = mappa.get(ip) || [];
      arr.push(Date.now());
      mappa.set(ip, arr);
    },
  };
}
