/* ══════════════════════════════════════════════════════════════
   cliente-endpoint.mjs — GET /api/cliente?c=CODICE
   ──────────────────────────────────────────────────────────────
   Risolve il codice di un link personale e restituisce i dati del
   cliente. Il codice e' una credenziale: qui si difende dai
   tentativi a forza bruta e non si dice mai se un codice
   inesistente sia scaduto, revocato o mai esistito — una risposta
   diversa per ogni caso sarebbe un modo per esplorare il registro.
   ══════════════════════════════════════════════════════════════ */
import { trovaPerCodice, versionePubblica } from './ordini/index.mjs';
import { registra } from './log.mjs';
import { creaLimitatore } from './tentativi.mjs';
import { cors } from './cors.mjs';

/* Chi cerca di indovinare sbaglia sempre, quindi si blocca lo stesso; un
   cliente vero che apre il suo link dieci volte in un pomeriggio non si
   trova la porta chiusa in faccia — e nemmeno i suoi colleghi, che escono
   tutti dallo stesso IP aziendale. */
const { bloccato, segnaBuco } = creaLimitatore();

export async function gestisciCliente(req, res, codice, ip) {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    /* un link personale non deve finire in nessuna cache condivisa */
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(JSON.stringify(corpo));
  };

  if (bloccato(ip)) {
    registra({ ip, evento: 'cliente-limite' });
    return invia(429, { ok: false });
  }

  const cliente = await trovaPerCodice(codice);
  if (!cliente) { segnaBuco(ip); return invia(404, { ok: false }); }

  registra({ ip, evento: 'link-personale', cliente: cliente.nome || cliente.azienda || '' });
  return invia(200, { ok: true, cliente: versionePubblica(cliente) });
}
