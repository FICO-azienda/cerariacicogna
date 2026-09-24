/* ══════════════════════════════════════════════════════════════
   ordini/stato-endpoint.mjs — POST /api/ordine-stato-cambiato
   ──────────────────────────────────────────────────────────────
   Lo chiama Apps Script (onModificaOrdine in Codice.gs) quando
   qualcuno dello staff cambia lo Stato di un ordine nel foglio. Non
   lo chiama mai il sito ne' un visitatore: e' backend-a-backend,
   protetto dallo stesso segreto condiviso della chiamata inversa
   (CC_SHEETS_SECRET) — la stessa coppia fidata, nei due sensi.

   Decide SE mandare un'email (solo per gli stati con inviaEmail:true
   in assistant/data/stati-ordine.json) e la manda. Non aggiorna piu'
   nulla sul foglio: quello lo fa gia' Apps Script da solo per le
   date di spedizione/consegna.
   ══════════════════════════════════════════════════════════════ */
import { corpoJSON } from '../corpo-richiesta.mjs';
import { stessoCodice } from '../clienti.mjs';
import { mandaEmail } from './stati.mjs';
import { inviaStatoOrdine, postaAttiva } from '../mailer.mjs';
import { registra } from '../log.mjs';

function segretoValido(fornito) {
  const atteso = String(process.env.CC_SHEETS_SECRET || '');
  if (!atteso || atteso.length < 16) return false;
  return stessoCodice(atteso, String(fornito || ''));
}

export async function gestisciStatoOrdine(req, res) {
  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };

  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  let dati;
  try { dati = await corpoJSON(req); } catch (e) { return invia(400, { ok: false }); }

  if (!segretoValido(dati.segreto)) return invia(403, { ok: false });

  const { idOrdine, stato, email, nome, lingua, articoli } = dati;
  if (!idOrdine || !stato || !email) return invia(400, { ok: false, errore: 'dati mancanti' });

  if (!mandaEmail(stato)) {
    registra({ evento: 'stato-ordine', idOrdine, stato, emailInviata: false });
    return invia(200, { ok: true, emailInviata: false });
  }

  if (!postaAttiva()) {
    registra({ evento: 'stato-ordine', idOrdine, stato, emailInviata: false, motivo: 'posta non configurata' });
    return invia(200, { ok: true, emailInviata: false });
  }

  const esito = await inviaStatoOrdine({ email, nome, idOrdine, stato, lingua, articoli: articoli || [] });
  registra({ evento: 'stato-ordine', idOrdine, stato, emailInviata: esito.ok, motivo: esito.ok ? '' : esito.motivo });

  return invia(200, { ok: true, emailInviata: esito.ok });
}
