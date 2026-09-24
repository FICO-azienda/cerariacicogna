/* ══════════════════════════════════════════════════════════════
   cron-endpoint.mjs — GET /api/cron/promemoria?secret=…
   ──────────────────────────────────────────────────────────────
   Il trigger esterno (GitHub Actions, vedi
   .github/workflows/promemoria.yml) chiama questo indirizzo una
   volta al giorno. E' l'unico endpoint del sito che puo' far partire
   email commerciali per conto proprio, quindi e' protetto da un
   segreto lungo — non dal CORS dei form, che qui non c'entra.
   ══════════════════════════════════════════════════════════════ */
import { stessoCodice } from './clienti.mjs';
import { eseguiCicloPromemoria } from './scheduler.mjs';

function segretoValido(fornito) {
  const atteso = String(process.env.CC_CRON_SECRET || '');
  /* senza un segreto configurato l'endpoint resta chiuso per chiunque:
     un default "aperto" qui sarebbe un modo per far mandare email a nome
     dell'azienda a chiunque trovi l'indirizzo */
  if (!atteso || atteso.length < 16) return false;
  return stessoCodice(atteso, String(fornito || ''));
}

export async function gestisciCron(req, res, segreto) {
  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };

  if (!segretoValido(segreto)) return invia(403, { ok: false });

  try {
    const esito = await eseguiCicloPromemoria();
    return invia(200, { ok: true, ...esito });
  } catch (e) {
    console.error('[cron-promemoria] ' + (e && e.stack || e));
    return invia(500, { ok: false, errore: String(e && e.message) });
  }
}
