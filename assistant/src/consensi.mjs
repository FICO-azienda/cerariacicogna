/* ══════════════════════════════════════════════════════════════
   consensi.mjs — newsletter e promemoria di riacquisto, separati
   ──────────────────────────────────────────────────────────────
   Due consensi, due basi giuridiche, mai scambiati:

   · newsletter — solo se la casella nel modulo contatti viene
     spuntata (consenso esplicito, mai richiesto per completare
     l'invio della richiesta);
   · promemoriaRiacquisto — acceso di default per chi scrive per una
     richiesta commerciale, sulla base del "soft spam" (art. 130 c.4
     Codice Privacy): prodotti analoghi a quelli richiesti, con
     opposizione sempre libera e gratuita in ogni email.

   Questo file e' l'unico punto che li tocca: chi manda una email
   (mailer/scheduler) o riceve un modulo (contatto.mjs) passa sempre
   di qui, mai dall'adattatore ordini direttamente — cosi' la regola
   "non si scambiano" vive in un posto solo.
   ══════════════════════════════════════════════════════════════ */
import { impostaConsenso, impostaConsensoPerCodice, trovaPerEmail } from './ordini/index.mjs';

export async function registraConsensi(email, { newsletter, promemoriaRiacquisto } = {}) {
  const patch = {};
  if (typeof newsletter === 'boolean') patch.newsletter = newsletter;
  /* il consenso al promemoria NON si spegne mai da qui: lo spegne solo
     un'opposizione esplicita (link di disiscrizione). Il modulo contatti
     non lo chiede perche' non serve chiederlo, non perche' e' implicito
     nel silenzio — e' il soft spam a permetterlo, con l'opt-out sempre
     disponibile. */
  if (typeof promemoriaRiacquisto === 'boolean') patch.promemoriaRiacquisto = promemoriaRiacquisto;
  if (!Object.keys(patch).length) return null;
  return impostaConsenso(email, patch);
}

/* Opposizione: da qui in poi quell'email non riceve piu' promemoria
   commerciali, qualunque cosa ordini in futuro — la newsletter (se mai
   attivata) resta un consenso a parte e non viene toccata. */
export async function opponiPromemoria(codice) {
  return impostaConsensoPerCodice(codice, { promemoriaRiacquisto: false });
}

export async function opponiNewsletter(codice) {
  return impostaConsensoPerCodice(codice, { newsletter: false });
}

export async function puoRiceverePromemoria(email) {
  const c = await trovaPerEmail(email);
  return Boolean(c && !c.revocato && c.consenso && c.consenso.promemoriaRiacquisto !== false);
}
