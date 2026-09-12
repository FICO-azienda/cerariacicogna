/* ══════════════════════════════════════════════════════════════
   contatto.mjs — endpoint /api/contatto
   ──────────────────────────────────────────────────────────────
   Riceve il modulo della pagina Contatti, manda la richiesta in
   cereria e la conferma a chi ha scritto. Se la posta non e'
   configurata risponde 503 con {posta:false}: il modulo lo capisce
   e ripiega sul mailto:, senza mostrare errori al visitatore.
   ══════════════════════════════════════════════════════════════ */
import { config, EMAIL_SUPPORTO } from './config.mjs';
import { postaAttiva, emailValida, inviaRichiesta, inviaConferma } from './mailer.mjs';
import { registra } from './log.mjs';
import { registraRichiesta } from './archivio.mjs';
import { daRichiesta } from './clienti.mjs';
import { linkSito } from './email-template.mjs';

const ORA = 60 * 60 * 1000;
const invii = new Map();          /* ip → [timestamp, ...] */

/* Questo endpoint manda email a un indirizzo scelto da chi compila:
   senza un tetto stretto diventerebbe un modo per spedire posta a nome
   nostro. Cinque all'ora per visitatore sono piu' che sufficienti. */
function troppiInvii(ip) {
  const ora = Date.now();
  const arr = (invii.get(ip) || []).filter(t => ora - t < ORA);
  invii.set(ip, arr);
  if (invii.size > 5000) invii.clear();          /* la mappa non deve crescere all'infinito */
  if (arr.length >= config.maxInviiOra) return true;
  arr.push(ora);
  return false;
}

const testo = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* dall'url completo alla sola pagina: e' cio' che serve al link personale
   per riaprire la scheda, e non porta con se' l'origine di questa visita */
const paginaDi = u => {
  try { return new URL(u, 'http://x').pathname.replace(/^\//, ''); }
  catch (e) { return ''; }
};

const LINEE = {
  'home-collection': 'Home Collection', 'garden': 'Garden',
  'liturgico': 'Liturgica', 'private-label': 'Private Label',
  'collaborazioni': 'Collaborazioni',
};
const etichettaLinea = v => LINEE[String(v || '').toLowerCase()] || '';

export async function gestisciContatto(req, res, dati, ip) {
  const invia = (codice, corpo) => {
    res.statusCode = codice;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(corpo));
  };

  if (!postaAttiva()) return invia(503, { ok: false, posta: false });

  const d = {
    nome:      testo(dati.nome, 80),
    cognome:   testo(dati.cognome, 80),
    email:     testo(dati.email, 160),
    azienda:   testo(dati.azienda, 120),
    oggetto:   testo(dati.oggetto, 60),
    lingua:    testo(dati.lingua, 4) === 'en' ? 'en' : 'it',
    messaggio: testo(dati.messaggio, 5000),
    selezione: testo(dati.selezione, 2000),
    /* articoli strutturati: nome, foto e link, per le schede nell'email */
    articoli: Array.isArray(dati.articoli) ? dati.articoli.slice(0, 20).map(a => ({
      nome:       testo(a && a.nome, 120),
      img:        testo(a && a.img, 400),
      imgProfumo: testo(a && a.imgProfumo, 400),
      url:        testo(a && a.url, 400),
      categoria:  testo(a && a.categoria, 40),
      quantita:   (parseInt(a && a.quantita, 10) > 0) ? parseInt(a.quantita, 10) : 0,
      /* "oltre il tetto": non e' una quantita' ma una fornitura da concordare */
      oltre:      Boolean(a && a.oltre),
    })).filter(a => a.nome) : [],
    /* cadenza della fornitura: arriva gia' normalizzata dalla bozza */
    fornitura: dati.fornitura && typeof dati.fornitura === 'object' ? {
      tipo:     testo(dati.fornitura.tipo, 20),
      ogniMesi: parseInt(dati.fornitura.ogniMesi, 10) > 0 ? parseInt(dati.fornitura.ogniMesi, 10) : 0,
      periodo:  testo(dati.fornitura.periodo, 80),
      note:     testo(dati.fornitura.note, 200),
      descrizione: testo(dati.fornitura.descrizione, 300),
    } : null,
  };

  if (!d.nome || !d.messaggio) return invia(400, { ok: false, errore: 'dati mancanti' });
  if (!emailValida(d.email))   return invia(400, { ok: false, errore: 'email non valida' });

  if (troppiInvii(ip)) {
    registra({ ip, evento: 'contatto-limite' });
    return invia(429, { ok: false, errore: 'limite',
      messaggio: 'Hai gia\' inviato diverse richieste. Riprova piu\' tardi oppure scrivici a ' + EMAIL_SUPPORTO + '.' });
  }

  /* ── il collegamento riservato per il prossimo riordino ──
     Un codice per indirizzo email, non uno per ordine: chi torna
     ritrova sempre lo stesso link, aggiornato con l'ultimo ordine e
     con la scadenza che riparte. Se il registro non e' scrivibile
     (Vercel non ha un disco che duri) si prosegue senza link: la
     conferma deve partire lo stesso. */
  try {
    const cliente = daRichiesta({
      nome: [d.nome, d.cognome].filter(Boolean).join(' '),
      email: d.email,
      azienda: d.azienda,
      linea: etichettaLinea(d.oggetto),
      prodotti: d.articoli.map(a => ({
        nome: a.nome, quantita: a.quantita, oltre: a.oltre,
        immagine: a.img, imgProfumo: a.imgProfumo,
        pagina: paginaDi(a.url), categoria: a.categoria,
      })),
    });
    if (cliente) {
      d.linkPersonale = linkSito('index.html') + '?c=' + cliente.codice;
      d.clienteNuovo = cliente.nuovo;
    }
  } catch (e) {
    console.warn('[contatto] link personale non creato: ' + e.message);
  }

  /* La richiesta all'azienda e' quella che conta: se fallisce, il modulo
     deve ripiegare sul mailto:. La conferma al cliente e' un di piu':
     se fallisce solo lei, la richiesta e' comunque arrivata. */
  const richiesta = await inviaRichiesta(d);
  if (!richiesta.ok) {
    console.error('[contatto] richiesta non inviata: ' + richiesta.motivo);
    registra({ ip, evento: 'contatto-errore', messaggio: richiesta.motivo });
    return invia(502, { ok: false, posta: true, errore: 'invio fallito' });
  }

  const conferma = await inviaConferma(d);
  if (!conferma.ok) console.warn('[contatto] conferma non inviata: ' + conferma.motivo);

  /* la richiesta resta anche come dato, non solo dentro un'email */
  const archiviata = registraRichiesta(d);

  registra({ ip, evento: 'contatto', oggetto: d.oggetto, conferma: conferma.ok,
             cadenza: d.fornitura ? d.fornitura.tipo : 'non indicata',
             prossima: archiviata ? archiviata.prossima : '' });
  return invia(200, { ok: true, conferma: conferma.ok });
}
