/* ══════════════════════════════════════════════════════════════
   email-template.mjs — impaginazione delle email
   ──────────────────────────────────────────────────────────────
   Le email non sono pagine web: niente flexbox, niente grid,
   niente <style> nel <head> (Gmail lo rimuove), niente font
   scaricati. Si impagina con tabelle e stile in linea, come nel
   2005 — e' l'unico modo perche' resa sia uguale su Gmail, Apple
   Mail, Outlook e i telefoni.
   ══════════════════════════════════════════════════════════════ */
import { config, EMAIL_SUPPORTO } from './config.mjs';

/* ── colori del brand ─────────────────────────────────────── */
const C = {
  scuro:   '#1a1610',
  oro:     '#c4922a',
  crema:   '#f7f4ee',
  carta:   '#ffffff',      /* impaginazione su bianco, come le email dei brand di moda */
  testo:   '#2e2a24',
  tenue:   '#9a9186',
  bordo:   '#e8e3d9',
  /* Le stesse due tinte, scurite quel tanto che basta a superare 4.5:1 sul
     fondo crema del banner: li' il testo e' piccolo e in maiuscoletto, e
     l'oro chiaro si fermava a 2,5. Nel resto dell'email, su bianco, le
     versioni chiare vanno bene e restano quelle. */
  oroScuro:   '#8b681e',
  tenueScuro: '#766d62',
};
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS  = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const esc = v => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Nelle email servono indirizzi assoluti e pubblici: un "images/x.webp"
   o un localhost non verrebbero mai caricati dal client di posta. */
export function urlAssoluto(u) {
  const v = String(u || '').trim();
  if (!v) return '';
  /* https ovunque, tranne quando il dominio configurato e' locale: li' il
     server e' in chiaro e un https:// non caricherebbe (serve per le anteprime). */
  const dom = String(config.dominioSito).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const schema = /^(localhost|127\.|0\.0\.0\.0)/.test(dom) ? 'http://' : 'https://';
  const base = schema + dom;
  try {
    const parsed = new URL(v);
    /* solo http/https: "javascript:", "data:" e simili non entrano in un src o
       in un href. Arrivano dal browser del visitatore, quindi non mi fido. */
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    /* un indirizzo di sviluppo non ha senso in un'email: lo riporto al dominio vero */
    if (/^(localhost|127\.|0\.0\.0\.0)/.test(parsed.hostname) && !/^(localhost|127\.|0\.0\.0\.0)/.test(dom)) return base + parsed.pathname + parsed.search;
    return v;
  } catch (e) {
    /* non e' un indirizzo assoluto: lo tratto come percorso interno, ma solo
       se ha l'aspetto di un percorso e non di uno schema travestito */
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return '';
    return base + '/' + v.replace(/^\//, '');
  }
}

/* Tutti i link del sito passano di qui, come le immagini: cosi' lo schema
   (http in locale, https in produzione) e' deciso in un posto solo. Prima
   erano scritti a mano con https:// fisso e in anteprima non si aprivano. */
export function linkSito(percorso = '') {
  const dom = String(config.dominioSito).replace(/^https?:\/\//, '').replace(/\/$/, '');
  const schema = /^(localhost|127\.|0\.0\.0\.0)/.test(dom) ? 'http://' : 'https://';
  const p = String(percorso).replace(/^\//, '');
  return schema + dom + (p ? '/' + p : '');
}

/* ── etichette leggibili al posto dei codici interni ──────── */
const INTERESSI = {
  'liturgico': 'Articoli Liturgici',
  'garden': 'Linea Garden',
  'home-collection': 'Home Collection',
  'private-label': 'Private Label / B2B',
  'collaborazioni': 'Collaborazioni',
  'campionario': 'Richiesta campionario',
  'altro': 'Altro',
};
/* In inglese "Linea Garden" resta un nome proprio a meta': la linea si
   chiama Garden, ma la parola "linea" va tradotta come il resto. */
const INTERESSI_EN = {
  'liturgico': 'Liturgical Candles',
  'garden': 'Garden Line',
  'home-collection': 'Home Collection',
  'private-label': 'Private Label / B2B',
  'collaborazioni': 'Collaborations',
  'campionario': 'Sample request',
  'altro': 'Other',
};
export const etichettaInteresse = (v, lang = 'it') => {
  const k = String(v || '').toLowerCase();
  const mappa = lang === 'en' ? INTERESSI_EN : INTERESSI;
  return mappa[k] || INTERESSI[k] || (v ? String(v) : '');
};

/* ── le due lingue della conferma ──────────────────────────────
   Solo la conferma al cliente cambia lingua: la richiesta che arriva
   in cereria resta sempre in italiano, perche' la legge chi lavora
   qui e non deve tradurre nulla per capire cosa serve.
   I nomi dei prodotti non si traducono: sono nomi propri, e in
   cereria devono restare cercabili come sono scritti a catalogo. */
const L = {
  it: {
    htmlLang: 'it',
    preheader: 'Abbiamo ricevuto la tua richiesta: ti rispondiamo a breve.',
    occhiello: 'Richiesta ricevuta',
    grazie: nome => 'Grazie' + (nome ? ', ' + nome : ''),
    presa: 'Abbiamo ricevuto la tua richiesta e la stiamo prendendo in carico. '
         + 'Ti risponderemo a breve, appena i nostri collaboratori saranno pronti '
         + 'a darti un riscontro completo.',
    articoli: 'Articoli richiesti',
    altri: n => `e altri ${n} articoli.`,
    pezzi: 'PZ',
    oltre: n => `OLTRE ${n} PZ`,
    daConcordare: 'QUANTITÀ DA CONCORDARE',
    tuoMessaggio: 'Il tuo messaggio',
    tornaAlSito: 'Torna al sito',
    riordina: 'Riordina in un clic',
    bannerOcchiello: 'Il tuo accesso riservato',
    bannerTitolo: 'La prossima volta, in un clic',
    spiegaLink: (n) =>
      'Questo collegamento è riservato a te: apre il sito con '
      + (n ? 'i tuoi ' + n + (n === 1 ? ' articolo già pronto' : ' articoli già pronti') : 'i tuoi dati già compilati')
      + ' e i tuoi dati compilati, senza registrazione e senza password.',
    nonInoltrare: 'Proprio per questo <strong>ti chiediamo di non inoltrarlo</strong>.',
    validita: 'Resta valido dodici mesi e possiamo disattivarlo quando vuoi.',
    automatica: 'Questa è una conferma automatica, non serve rispondere.',
    perAggiungere: 'Per aggiungere qualcosa scrivici a',
    oChiamaci: 'o chiamaci allo',
    linee: ['Home Collection', 'Garden', 'Liturgico'],
  },
  en: {
    htmlLang: 'en',
    preheader: 'We have received your enquiry: we will get back to you shortly.',
    occhiello: 'Enquiry received',
    grazie: nome => 'Thank you' + (nome ? ', ' + nome : ''),
    presa: 'We have received your enquiry and it is now with our team. '
         + 'We will get back to you shortly, as soon as we can give you '
         + 'a complete answer.',
    articoli: 'Items requested',
    altri: n => `and ${n} more items.`,
    pezzi: 'PCS',
    oltre: n => `OVER ${n} PCS`,
    daConcordare: 'QUANTITY TO BE AGREED',
    tuoMessaggio: 'Your message',
    tornaAlSito: 'Back to the site',
    riordina: 'Reorder in one click',
    bannerOcchiello: 'Your reserved access',
    bannerTitolo: 'Next time, in one click',
    spiegaLink: (n) =>
      'This link is reserved for you: it opens the site with '
      + (n ? 'your ' + n + (n === 1 ? ' item ready' : ' items ready') : 'your details already filled in')
      + ' and your details filled in, with no account and no password.',
    nonInoltrare: 'For that reason, <strong>please do not forward it</strong>.',
    validita: 'It stays valid for twelve months and we can disable it whenever you wish.',
    automatica: 'This is an automatic confirmation, there is no need to reply.',
    perAggiungere: 'To add anything, write to us at',
    oChiamaci: 'or call us on',
    linee: ['Home Collection', 'Garden', 'Liturgical'],
  },
};
export const lingua = v => (String(v || '').toLowerCase() === 'en' ? 'en' : 'it');

/* ── mattoni ──────────────────────────────────────────────── */
const paragrafo = (t, extra = '') =>
  `<p style="margin:0 0 18px;font-family:${SERIF};font-size:16px;line-height:1.8;color:${C.testo};${extra}">${t}</p>`;

/* etichette minuscole in maiuscoletto spaziato: sono la cifra di queste email */
const etichetta = (t, allineamento = 'left') =>
  `<p style="margin:0 0 14px;font-family:${SANS};font-size:10px;font-weight:400;letter-spacing:3px;`
  + `text-transform:uppercase;color:${C.tenue};text-align:${allineamento};">${esc(t)}</p>`;

const filo = (spazio = 32) =>
  `<tr><td style="padding:0 26px;"><div style="height:1px;background:${C.bordo};margin:${spazio}px 0;"></div></td></tr>`;

/* ── articoli: immagini grandi, quantita' incolonnata a destra ── */
function schedeArticoli(articoli, d = L.it) {
  if (!articoli || !articoli.length) return '';

  const righe = articoli.slice(0, 20).map((a, i) => {
    const img = urlAssoluto(a.img);
    const imgProf = urlAssoluto(a.imgProfumo);
    const url = urlAssoluto(a.url);
    const nome = esc(a.nome || '');
    const foto = u => `<img src="${esc(u)}" width="76" alt="" style="display:block;width:76px;height:96px;object-fit:cover;background:${C.crema};border:0;">`;

    const colonnaFoto = img
      ? (imgProf
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>`
            + `<td style="padding-right:5px;">${foto(img)}</td><td>${foto(imgProf)}</td></tr></table>`
          : foto(img))
      : `<div style="width:76px;height:96px;background:${C.crema};"></div>`;

    const titolo = url
      ? `<a href="${esc(url)}" style="color:${C.scuro};text-decoration:none;">${nome}</a>`
      : nome;

    return `
      <tr>
        <td style="padding:${i ? '24px' : '0'} 16px 0 0;vertical-align:top;">${colonnaFoto}</td>
        <td style="padding:${i ? '26px' : '0'} 0 0;vertical-align:top;">
          <p style="margin:0 0 5px;font-family:${SERIF};font-size:16px;line-height:1.4;color:${C.scuro};">${titolo}</p>
          ${(() => {
            /* Solo etichette che significano qualcosa per chi legge: le
               categorie interne del catalogo ("sand", "rock") sotto un
               prodotto che si chiama gia' Sand sono rumore, non aiuto. */
            const et = etichettaInteresse(a.categoria, d.htmlLang);
            const nota = et && et.toLowerCase() !== String(a.categoria || '').toLowerCase();
            return nota
              ? `<p style="margin:0 0 5px;font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.tenue};">${esc(et)}</p>`
              : '';
          })()}
          ${a.oltre
            ? `<p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:1.5px;color:${C.scuro};">${d.oltre(a.quantita || 1000)}`
              + `<br><span style="font-size:10px;letter-spacing:2px;color:${C.oro};">${d.daConcordare}</span></p>`
            : (a.quantita ? `<p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:1.5px;color:${C.scuro};">${a.quantita} ${d.pezzi}</p>` : '')}
        </td>
      </tr>`;
  }).join('');

  const extra = articoli.length > 20
    ? `<p style="margin:22px 0 0;font-family:${SERIF};font-size:14px;color:${C.tenue};">${d.altri(articoli.length - 20)}</p>`
    : '';

  return `
    <tr><td style="padding:0 26px;">
      ${etichetta(d.articoli)}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${righe}</table>
      ${extra}
    </td></tr>`;
}

/* ── il collegamento riservato ─────────────────────────────────
   Sostituisce il generico "torna al sito" con qualcosa che al
   cliente serve davvero: la sua richiesta gia' pronta la prossima
   volta. Il testo dice a chiare lettere che e' personale — perche'
   chi ha il link vede quei dati, e una mail si inoltra in un
   secondo senza pensarci. */
function bloccoLinkPersonale(link, quantiProdotti, d = L.it) {
  if (!link) return '';
  /* Un banner, non un bottone in mezzo al testo: e' la cosa piu' utile
     dell'email e deve staccarsi dal resto. Fondo crema e un filo d'oro
     sopra e sotto — nessun bordo pieno, che in Outlook si sgrana.
     Tutto a tabelle: qui dentro flexbox non esiste. */
  return `
      <tr><td style="padding:38px 26px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="width:100%;background:${C.crema};">
          <tr><td style="height:2px;line-height:2px;font-size:0;background:${C.oro};">&nbsp;</td></tr>
          <tr><td align="center" style="padding:32px 24px 34px;">

            <p style="margin:0 0 12px;font-family:${SANS};font-size:10px;letter-spacing:3px;
               text-transform:uppercase;color:${C.oroScuro};">${esc(d.bannerOcchiello)}</p>

            <p style="margin:0 0 14px;font-family:${SERIF};font-size:23px;line-height:1.35;color:${C.scuro};">
              ${esc(d.bannerTitolo)}
            </p>

            <p style="margin:0 auto 24px;max-width:380px;font-family:${SERIF};font-size:15px;
               line-height:1.75;color:${C.testo};">
              ${d.spiegaLink(quantiProdotti)}
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
              <tr><td style="background:${C.scuro};">
                <a href="${esc(link)}" style="display:inline-block;color:#ffffff;
                   font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;
                   padding:16px 42px;text-decoration:none;">${esc(d.riordina)}</a>
              </td></tr>
            </table>

            <p style="margin:22px auto 0;max-width:380px;font-family:${SANS};font-size:10px;
               letter-spacing:1.4px;line-height:1.9;text-transform:uppercase;color:${C.tenueScuro};">
              ${d.nonInoltrare.replace(/<\/?strong>/g, '')}<br>${esc(d.validita)}
            </p>

          </td></tr>
          <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.bordo};">&nbsp;</td></tr>
        </table>
      </td></tr>`;
}

/* ── scheletro ────────────────────────────────────────────────
   Intestazione bianca col marchio centrato, niente fasce colorate:
   il colore lo mettono le foto dei prodotti, non la grafica. */
function scheletro({ preheader, contenuto, d = L.it }) {
  return `<!DOCTYPE html>
<html lang="${d.htmlLang}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
</head>
<body style="margin:0;padding:0;background:${C.crema};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${C.crema};">
  <tr><td align="center" style="padding:40px 6px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px;background:${C.carta};">

      <tr><td align="center" style="padding:40px 26px 28px;">
        <img src="${urlAssoluto('logo-stork.png')}" width="46" height="46" alt="" style="display:block;width:46px;height:46px;border:0;margin:0 auto 16px;">
        <p style="margin:0;font-family:${SERIF};font-size:17px;letter-spacing:5px;text-transform:uppercase;color:${C.scuro};">Cereria Cicogna</p>
      </td></tr>

      ${contenuto}

      <tr><td align="center" style="padding:32px 26px 40px;background:${C.crema};">
        <p style="margin:0 0 12px;font-family:${SANS};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:${C.tenue};">
          <a href="${esc(linkSito('home-collection.html'))}" style="color:${C.tenue};text-decoration:none;">${d.linee[0]}</a>
          &nbsp;·&nbsp;<a href="${esc(linkSito('garden.html'))}" style="color:${C.tenue};text-decoration:none;">${d.linee[1]}</a>
          &nbsp;·&nbsp;<a href="${esc(linkSito('liturgico.html'))}" style="color:${C.tenue};text-decoration:none;">${d.linee[2]}</a>
        </p>
        <p style="margin:0 0 6px;font-family:${SERIF};font-size:13px;line-height:1.8;color:${C.tenue};">
          ${esc(config.indirizzoAzienda)}<br>
          <a href="tel:+39023543707" style="color:${C.tenue};text-decoration:none;">${esc(config.telefono)}</a>
          &nbsp;·&nbsp;<a href="mailto:${esc(EMAIL_SUPPORTO)}" style="color:${C.tenue};text-decoration:none;">${esc(EMAIL_SUPPORTO)}</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ── 1. conferma al cliente ───────────────────────────────── */
export function htmlConferma(d) {
  const t = L[lingua(d.lingua)];
  const nome = (d.nome || '').trim();
  const contenuto = `
      <tr><td align="center" style="padding:0 26px 6px;">
        ${etichetta(t.occhiello, 'center')}
        <p style="margin:0 0 20px;font-family:${SERIF};font-size:30px;line-height:1.3;color:${C.scuro};">
          ${esc(t.grazie(nome))}
        </p>
        <p style="margin:0 auto 16px;max-width:420px;font-family:${SERIF};font-size:16px;line-height:1.8;color:${C.testo};">
          ${t.presa}
        </p>
      </td></tr>

      ${filo(34)}

      ${schedeArticoli(d.articoli, t)}

      ${filo(34)}

      <tr><td style="padding:0 26px;">
        ${etichetta(t.tuoMessaggio)}
        <p style="margin:0;font-family:${SERIF};font-size:15px;line-height:1.8;color:${C.testo};white-space:pre-wrap;">${esc(String(d.messaggio || '').slice(0, 2000))}</p>
      </td></tr>

      ${d.linkPersonale
        ? bloccoLinkPersonale(d.linkPersonale, (d.articoli || []).length, t)
        : `<tr><td align="center" style="padding:34px 26px 8px;">
        <a href="${esc(linkSito())}" style="display:inline-block;background:${C.scuro};color:#ffffff;
           font-family:${SANS};font-size:11px;letter-spacing:2.5px;text-transform:uppercase;
           padding:16px 40px;text-decoration:none;">${t.tornaAlSito}</a>
      </td></tr>`}

      <tr><td align="center" style="padding:20px 26px 38px;">
        <p style="margin:0;font-family:${SERIF};font-size:14px;line-height:1.8;color:${C.tenue};">
          ${t.automatica}<br>
          ${t.perAggiungere}
          <a href="mailto:${esc(EMAIL_SUPPORTO)}" style="color:${C.testo};">${esc(EMAIL_SUPPORTO)}</a>
          ${t.oChiamaci} ${esc(config.telefono)}.
        </p>
      </td></tr>`;

  return scheletro({ preheader: t.preheader, contenuto, d: t });
}

/* ── 2. richiesta interna ─────────────────────────────────── */
export function htmlRichiesta(d) {
  const riga = (k, v) => v
    ? `<tr>
         <td style="padding:0 16px 10px 0;font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${C.tenue};white-space:nowrap;vertical-align:top;">${esc(k)}</td>
         <td style="padding:0 0 10px;font-family:${SERIF};font-size:16px;color:${C.scuro};vertical-align:top;">${v}</td>
       </tr>`
    : '';

  const contenuto = `
      <tr><td style="padding:0 26px 6px;">
        ${etichetta('Nuova richiesta dal sito')}
        <p style="margin:0 0 24px;font-family:${SERIF};font-size:26px;line-height:1.3;color:${C.scuro};">
          ${esc((d.nome || '') + (d.cognome ? ' ' + d.cognome : '')) || 'Richiesta senza nome'}
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${riga('Email', `<a href="mailto:${esc(d.email)}" style="color:${C.scuro};">${esc(d.email)}</a>`)}
          ${riga('Azienda', esc(d.azienda))}
          ${riga('Interesse', esc(etichettaInteresse(d.oggetto)))}
          ${riga('Lingua', lingua(d.lingua) === 'en'
            ? `Inglese <span style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${C.oro};">RISPONDERE IN INGLESE</span>`
            : '')}
          ${riga('Cliente', d.linkPersonale
            ? (d.clienteNuovo ? 'Nuovo' : 'Gia\' nostro cliente')
            : '')}
          ${riga('Fornitura', d.fornitura && d.fornitura.descrizione
            ? esc(d.fornitura.descrizione).replace(/\n/g, '<br>')
              + (d.fornitura.tipo === 'ricorrente' && d.fornitura.ogniMesi
                  ? ` <span style="font-family:${SANS};font-size:10px;letter-spacing:1.5px;color:${C.oro};">DA PROGRAMMARE</span>` : '')
            : '')}
        </table>
      </td></tr>

      ${filo(30)}

      ${schedeArticoli(d.articoli)}

      ${filo(30)}

      ${d.linkPersonale ? `
      <tr><td style="padding:0 26px 30px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"
               style="width:100%;background:${C.crema};">
          <tr><td style="padding:18px 20px;">
            <p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:2px;
               text-transform:uppercase;color:${C.tenue};">
              Collegamento riservato &middot; gia' inviato nella conferma
            </p>
            <!-- l'indirizzo per intero serve per rimandarlo a mano (WhatsApp, telefono):
                 sta qui in fondo, a tutta larghezza, dove andare a capo non storce nulla -->
            <a href="${esc(d.linkPersonale)}" style="font-family:${SANS};font-size:11px;
               line-height:1.7;color:${C.testo};word-break:break-all;">${esc(d.linkPersonale)}</a>
          </td></tr>
        </table>
      </td></tr>` : ''}

      <tr><td style="padding:0 26px 34px;">
        ${etichetta('Messaggio')}
        <p style="margin:0 0 22px;font-family:${SERIF};font-size:15px;line-height:1.8;color:${C.testo};white-space:pre-wrap;">${esc(d.messaggio)}</p>
        <p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:.5px;color:${C.tenue};">
          Rispondendo a questa email scrivi direttamente a ${esc(d.nome || 'chi ha inviato la richiesta')}.
        </p>
      </td></tr>`;

  return scheletro({ preheader: `Richiesta da ${d.nome || 'sito'}${d.azienda ? ' · ' + d.azienda : ''}`
    + (lingua(d.lingua) === 'en' ? ' · in inglese' : ''), contenuto });
}
