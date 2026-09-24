/* Vercel/host esterno: GET /api/cron/promemoria?secret=… — fa partire il
   ciclo giornaliero dei promemoria di riacquisto. Protetto da CC_CRON_SECRET,
   pensato per un trigger esterno (vedi .github/workflows/promemoria.yml). */
import { gestisciCron } from '../../assistant/src/cron-endpoint.mjs';

export default function handler(req, res) {
  const segreto = (req.query && req.query.secret) ||
                   new URL(req.url, 'http://x').searchParams.get('secret') || '';
  return gestisciCron(req, res, segreto);
}
