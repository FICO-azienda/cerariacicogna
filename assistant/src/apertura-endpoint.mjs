/* ══════════════════════════════════════════════════════════════
   apertura-endpoint.mjs — GET /api/promemoria-aperto?id=…
   ──────────────────────────────────────────────────────────────
   Un pixel da 1x1 nell'email di promemoria: se il client di posta
   carica le immagini, registriamo che l'email e' stata aperta.
   E' una misura debole per costruzione — Gmail la passa da un proxy
   suo (apertura vera o falsa, non si distingue), Apple Mail Privacy
   Protection la precarica sempre (ogni apertura sembra immediata,
   anche quella mai avvenuta), e chi blocca le immagini non genera
   nessun segnale. La dashboard admin la mostra etichettata "se
   disponibile", non come un numero su cui contare.
   ══════════════════════════════════════════════════════════════ */
import { registraEvento } from './scheduler.mjs';

/* GIF trasparente 1x1, la piu' piccola possibile. */
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64');

export function gestisciApertura(req, res, id) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, private');

  /* venti caratteri esadecimali: la forma di idPromemoria() in scheduler.mjs.
     Qualsiasi altra cosa non e' un id nostro, e non la registro. */
  if (/^[a-f0-9]{20}$/.test(String(id || ''))) {
    registraEvento({ tipo: 'aperto', promemoriaId: id });
  }
  return res.end(PIXEL);
}
