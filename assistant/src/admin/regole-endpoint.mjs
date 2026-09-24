/* ══════════════════════════════════════════════════════════════
   admin/regole-endpoint.mjs — GET/PUT /api/admin/regole
   ──────────────────────────────────────────────────────────────
   GET restituisce tutte le regole per categoria ("Automazioni
   riacquisto"); PUT ne aggiorna una sola, quella indicata in
   ?categoria=…, coi soli campi passati nel corpo.
   ══════════════════════════════════════════════════════════════ */
import { sessioneValida, tokenDaRichiesta } from './auth.mjs';
import { tutteLeRegole, aggiornaRegola } from '../regole-riacquisto.mjs';
import { corpoJSON } from '../corpo-richiesta.mjs';
import { cors } from '../cors.mjs';

export async function gestisciRegole(req, res, categoria) {
  cors(req, res, 'GET, PUT, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };

  if (!sessioneValida(tokenDaRichiesta(req))) return invia(401, { ok: false });

  if (req.method === 'GET') return invia(200, { ok: true, categorie: tutteLeRegole() });

  if (req.method === 'PUT') {
    if (!categoria) return invia(400, { ok: false, errore: 'categoria mancante' });
    let patch;
    try { patch = await corpoJSON(req); } catch (e) { return invia(400, { ok: false }); }
    const aggiornata = aggiornaRegola(categoria, patch);
    if (!aggiornata) return invia(404, { ok: false, errore: 'categoria sconosciuta' });
    return invia(200, { ok: true, regola: aggiornata });
  }

  res.statusCode = 405;
  res.end();
}
