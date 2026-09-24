/* ══════════════════════════════════════════════════════════════
   mailer.mjs — invio email tramite Resend
   ──────────────────────────────────────────────────────────────
   Resta spento finche' non ci sono CC_RESEND_KEY e CC_MITTENTE.
   Spento non e' un errore: l'endpoint lo dice al modulo, che
   ripiega sul mailto: come ha sempre fatto. Cosi' il sito funziona
   comunque, anche prima che il servizio di posta sia collegato.
   ══════════════════════════════════════════════════════════════ */
import { config, EMAIL_SUPPORTO } from './config.mjs';
import { htmlConferma, htmlRichiesta, htmlPromemoria, testoPromemoria, oggettoPromemoria, etichettaInteresse, lingua } from './email-template.mjs';

const API = 'https://api.resend.com/emails';

export function postaAttiva() {
  return Boolean(config.resendKey && config.mittente);
}

/* Un'intestazione email non puo' contenere a capo: chi li inserisce sta
   provando a iniettare destinatari o intestazioni sue. Li tolgo e basta. */
function pulisciIntestazione(v, max = 200) {
  return String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

const EMAIL_RE = /^[^\s@,;:<>"']+@[^\s@,;:<>"']+\.[A-Za-z]{2,}$/;
export const emailValida = v => EMAIL_RE.test(String(v || '').trim());

async function invia({ a, oggetto, testo, corpoHtml, rispondiA }) {
  if (!postaAttiva()) return { ok: false, motivo: 'posta non configurata' };

  const corpo = {
    from: config.mittente,
    to: [pulisciIntestazione(a)],
    subject: pulisciIntestazione(oggetto, 150),
    text: String(testo),
    html: corpoHtml,
  };
  if (rispondiA && emailValida(rispondiA)) corpo.reply_to = pulisciIntestazione(rispondiA);

  try {
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + config.resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      const dettaglio = await r.text().catch(() => '');
      return { ok: false, motivo: 'HTTP ' + r.status + ' ' + dettaglio.slice(0, 200) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, motivo: String(e && e.message).slice(0, 200) };
  }
}

/* ── 1. la richiesta che arriva in cereria ──────────────────── */
export function inviaRichiesta(d) {
  const righe = [
    'Nome: ' + d.nome + (d.cognome ? ' ' + d.cognome : ''),
    'Email: ' + d.email,
  ];
  if (d.azienda) righe.push('Azienda / ente: ' + d.azienda);
  if (d.oggetto) righe.push('Interesse: ' + etichettaInteresse(d.oggetto));
  if (d.fornitura && d.fornitura.descrizione) righe.push('Fornitura: ' + d.fornitura.descrizione);
  righe.push('', d.messaggio);
  if (lingua(d.lingua) === 'en') righe.push('Lingua: inglese — rispondere in inglese');
  if (d.articoli && d.articoli.length) {
    righe.push('', 'ARTICOLI RICHIESTI');
    d.articoli.forEach((a, i) => righe.push('  ' + (i + 1) + '. ' + a.nome));
  }
  righe.push('', '— — —', 'Inviato dal modulo di ' + config.dominioSito + '.',
             'Rispondendo a questa email scrivi direttamente a chi ha inviato la richiesta.');

  return invia({
    a: EMAIL_SUPPORTO,
    oggetto: 'Richiesta dal sito — ' + (d.nome || 'senza nome')
             + (d.oggetto ? ' · ' + etichettaInteresse(d.oggetto) : '')
             + (lingua(d.lingua) === 'en' ? ' · IN INGLESE' : ''),
    testo: righe.join('\n'),
    corpoHtml: htmlRichiesta(d),
    rispondiA: d.email,          /* rispondendo si scrive al cliente, non a noi */
  });
}

/* ── 2. la conferma a chi ha scritto ────────────────────────── */
export function inviaConferma(d) {
  /* Il sito da' del tu ("Descrivi la tua richiesta", "I tuoi dati"):
     l'email tiene lo stesso registro, altrimenti sembra scritta da un'altra
     azienda. Chi ha navigato in inglese la riceve in inglese; la copia che
     arriva in cereria resta in italiano, sempre. */
  const en = lingua(d.lingua) === 'en';
  const nome = (d.nome || '').trim();

  const righe = en
    ? [
        'Thank you' + (nome ? ', ' + nome : '') + '.',
        '',
        'We have received your enquiry and it is now with our team.',
        'We will get back to you shortly, as soon as we can give you a',
        'complete answer.',
        '',
        'This is an automatic confirmation, there is no need to reply. If you',
        'would like to add anything, write to us at ' + EMAIL_SUPPORTO,
        'or call us on ' + config.telefono + '.',
      ]
    : [
        'Grazie' + (nome ? ', ' + nome : '') + '.',
        '',
        'Abbiamo ricevuto la tua richiesta e la stiamo prendendo in carico.',
        'Ti risponderemo a breve, appena i nostri collaboratori saranno pronti a',
        'darti un riscontro completo.',
        '',
        'Questa e\' una conferma automatica, non serve rispondere. Se nel frattempo',
        'vuoi aggiungere qualcosa, scrivici a ' + EMAIL_SUPPORTO,
        'o chiamaci allo ' + config.telefono + '.',
      ];

  if (d.articoli && d.articoli.length) {
    righe.push('', '──────────', en ? 'ITEMS REQUESTED' : 'ARTICOLI RICHIESTI');
    d.articoli.forEach((a, i) => righe.push('  ' + (i + 1) + '. ' + a.nome));
  }

  if (d.linkPersonale) {
    righe.push('', '──────────',
      en ? 'REORDER IN ONE CLICK' : 'RIORDINA IN UN CLIC', '',
      d.linkPersonale, '',
      en ? 'This link is reserved for you: please do not forward it.'
         : 'Questo collegamento e\' riservato a te: ti chiediamo di non inoltrarlo.');
  }

  righe.push('', '──────────', en ? 'YOUR MESSAGE' : 'IL TUO MESSAGGIO', '',
             String(d.messaggio || '').slice(0, 2000),
             '', '— — —', config.nomeAzienda, config.indirizzoAzienda, config.dominioSito);

  return invia({
    a: d.email,
    oggetto: en ? 'We have received your enquiry — ' + config.nomeAzienda
                : 'Abbiamo ricevuto la tua richiesta — ' + config.nomeAzienda,
    testo: righe.join('\n'),
    corpoHtml: htmlConferma(d),
    rispondiA: EMAIL_SUPPORTO,
  });
}

/* ── 3. il promemoria di riacquisto ─────────────────────────── */
export function inviaPromemoria(d) {
  return invia({
    a: d.email,
    oggetto: oggettoPromemoria(d.lingua) + ' — ' + config.nomeAzienda,
    testo: testoPromemoria(d),
    corpoHtml: htmlPromemoria(d),
    rispondiA: EMAIL_SUPPORTO,
  });
}
