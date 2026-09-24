/* ══════════════════════════════════════════════════════════════
   unsubscribe-endpoint.mjs — GET /api/unsubscribe?c=CODICE&tipo=…
   ──────────────────────────────────────────────────────────────
   Un clic, nessuna conferma via email, nessun login: e' quello che
   la legge chiede per l'opposizione a comunicazioni commerciali —
   "in modo agevole e gratuitamente" (art. 130 c.4 Codice Privacy).
   Riusa il codice cliente gia' esistente (assistant/src/ordini/): non
   serve un terzo registro solo per questo.

   tipo=promemoria spegne SOLO i promemoria di riacquisto.
   tipo=newsletter spegne SOLO la newsletter.
   Sono due interruttori diversi (consenti.mjs): questo endpoint non
   ne tocca mai uno chiedendo dell'altro.
   ══════════════════════════════════════════════════════════════ */
import { opponiPromemoria, opponiNewsletter } from './consensi.mjs';
import { registra } from './log.mjs';
import { creaLimitatore } from './tentativi.mjs';

const { bloccato, segnaBuco } = creaLimitatore();

function pagina({ titolo, corpo }) {
  return `<!DOCTYPE html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${titolo} — Cereria Cicogna</title>
<style>
  body{margin:0;background:#FAFAF8;font-family:Georgia,'Times New Roman',serif;color:#2e2a24;}
  .box{max-width:480px;margin:0 auto;padding:120px 26px 80px;text-align:center;}
  h1{font-family:Helvetica,Arial,sans-serif;font-weight:300;font-size:1.5rem;letter-spacing:.02em;color:#1a1610;margin-bottom:18px;}
  p{font-size:1.02rem;line-height:1.8;color:#4a443b;}
  a{color:#1a1610;}
</style></head><body><div class="box"><h1>${titolo}</h1><p>${corpo}</p>
<p><a href="/">Torna al sito</a></p></div></body></html>`;
}

export async function gestisciUnsubscribe(req, res, codice, tipo, ip) {
  const invia = (n, html) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(html);
  };

  if (bloccato(ip)) return invia(429, pagina({ titolo: 'Troppi tentativi', corpo: 'Riprova più tardi.' }));

  const azione = tipo === 'newsletter' ? opponiNewsletter : opponiPromemoria;
  const esito = await azione(codice);

  if (!esito) {
    segnaBuco(ip);
    /* non distinguo "codice inesistente" da "gia' disiscritto": in
       entrambi i casi il risultato che interessa a chi legge e' lo
       stesso, non ricevera' piu' nulla — e non regalo un modo per
       capire se un codice e' valido provandone a caso. */
    return invia(200, pagina({
      titolo: 'Fatto',
      corpo: 'Questo collegamento non è (più) attivo, ma se lo era già non riceverai comunque queste comunicazioni.',
    }));
  }

  registra({ ip, evento: 'unsubscribe', tipo: tipo === 'newsletter' ? 'newsletter' : 'promemoria' });

  return invia(200, pagina({
    titolo: 'Preferenza aggiornata',
    corpo: tipo === 'newsletter'
      ? 'Non riceverai più le nostre email di novità e offerte. Le eventuali email operative (conferme di richiesta, risposte dirette) non sono toccate da questa scelta.'
      : 'Non riceverai più i promemoria di riacquisto. Le eventuali email operative (conferme di richiesta, risposte dirette) non sono toccate da questa scelta.',
  }));
}
