/* ══════════════════════════════════════════════════════════════
   riordino-endpoint.mjs — GET /api/riordino?t=CODICE
   ──────────────────────────────────────────────────────────────
   Risolve il token del promemoria e restituisce l'ordine a cui si
   riferisce: articoli, quantita', e se sono ancora a catalogo. Non
   restituisce prezzi ne' un totale — il sito non ne ha (vedi
   privacy.html e assistant/README.md: "non da' prezzi ne' preventivi").
   Aprire il link conta come un clic: e' il segnale che la dashboard
   admin usa per il tasso di conversione dei promemoria.
   ══════════════════════════════════════════════════════════════ */
import { trovaToken } from './token-riordino.mjs';
import { storicoPerEmail } from './archivio.mjs';
import { trova as prodottoInCatalogo } from './catalog.mjs';
import { registra } from './log.mjs';
import { registraEvento } from './scheduler.mjs';
import { creaLimitatore } from './tentativi.mjs';
import { cors } from './cors.mjs';

const { bloccato, segnaBuco } = creaLimitatore();

export function gestisciRiordino(req, res, codice, ip) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(JSON.stringify(corpo));
  };

  if (bloccato(ip)) { registra({ ip, evento: 'riordino-limite' }); return invia(429, { ok: false }); }

  const voce = trovaToken(codice);
  if (!voce) { segnaBuco(ip); return invia(404, { ok: false }); }

  const richiesta = storicoPerEmail(voce.email).find(r => r.ts === voce.richiestaTs);
  if (!richiesta) return invia(404, { ok: false });

  const articoli = (richiesta.articoli || []).map(a => ({
    nome: a.nome, quantita: a.quantita || 0, oltre: Boolean(a.oltre),
    categoria: a.categoria || '', immagine: a.immagine || '', imgProfumo: a.imgProfumo || '',
    pagina: a.pagina || '',
    disponibile: Boolean(prodottoInCatalogo(a.nome)),
  }));

  registra({ ip, evento: 'riordino-aperto', categoria: voce.categoria });
  registraEvento({ tipo: 'click', email: voce.email, categoria: voce.categoria, promemoriaId: voce.promemoriaId });

  return invia(200, {
    ok: true,
    promemoriaId: voce.promemoriaId,
    cliente: { nome: richiesta.nome || '', email: voce.email },
    dataOrdine: richiesta.ts,
    categoria: voce.categoria,
    articoli,
  });
}
