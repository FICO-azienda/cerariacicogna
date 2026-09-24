/* ══════════════════════════════════════════════════════════════
   link-personale.js — riconosce il cliente da un link riservato
   ──────────────────────────────────────────────────────────────
   Il link e' fatto cosi':  .../index.html?c=<32 caratteri casuali>
   Il codice non dice nulla di chi lo usa: e' il server che lo
   traduce in un nome. Nessuna registrazione, nessuna password.

   Appena letto, il codice viene tolto dalla barra degli indirizzi:
   cosi' non finisce in uno screenshot, in un segnalibro o nel
   referrer verso un altro sito. Chi arriva resta riconosciuto per
   la sessione, non oltre.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CHIAVE = 'cc-cliente';

  /* ── lingua: la stessa scelta del resto del sito ──────────────
     Il dizionario di i18n.js lavora sul testo gia' presente nel DOM;
     questa striscia nasce da JavaScript e cambia numeri e nome, quindi
     i suoi testi stanno qui e si riscrivono al cambio lingua. */
  function lang() {
    try {
      if (window.CCI18n && typeof window.CCI18n.get === 'function') {
        return window.CCI18n.get() === 'en' ? 'en' : 'it';
      }
      return localStorage.getItem('cc-lang') === 'en' ? 'en' : 'it';
    } catch (e) { return 'it'; }
  }

  var T = {
    it: {
      cta: 'Vai alla richiesta',
      chiudi: 'Chiudi',
      bentornato: function (nome) { return 'Bentornato' + (nome ? ', <strong>' + nome + '</strong>' : ''); },
      conArticoli: function (n) {
        return '. Abbiamo rimesso in Selezione ' + n + (n === 1 ? ' articolo' : ' articoli') +
               ' del suo ultimo ordine.';
      },
      senzaArticoli: '. I suoi dati sono gia\u2019 pronti nel modulo di contatto.',
      scaduto: 'Link personale non piu\u2019 valido.',
    },
    en: {
      cta: 'Go to your enquiry',
      chiudi: 'Close',
      bentornato: function (nome) { return 'Welcome back' + (nome ? ', <strong>' + nome + '</strong>' : ''); },
      conArticoli: function (n) {
        return '. We have restored ' + n + (n === 1 ? ' item' : ' items') +
               ' from your last order to your Selection.';
      },
      senzaArticoli: '. Your details are already filled in on the contact form.',
      scaduto: 'This personal link is no longer valid.',
    },
  };
  var t = function () { return T[lang()]; };

  /* ── dove vive l'API ──
     In sviluppo l'API sta su un'altra porta, e l'indirizzo e' scritto
     sul tag del widget. Online no: quell'indirizzo e' "localhost", cioe'
     il computer di chi guarda il sito, e la richiesta non arriverebbe
     da nessuna parte — il link personale risulterebbe sempre scaduto.
     Fuori dallo sviluppo si usa sempre la propria origine. */
  function endpoint() {
    var inLocale = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
    var s = document.querySelector('script[src*="cc-assistant.js"]');
    var e = inLocale && s && s.dataset.endpoint;
    return e ? e.replace(/\/api\/chat\/?$/, '/api/cliente') : '/api/cliente';
  }

  function noindex() {
    if (document.querySelector('meta[name="robots"][content*="noindex"]')) return;
    var m = document.createElement('meta');
    m.name = 'robots'; m.content = 'noindex, nofollow';
    document.head.appendChild(m);
  }

  /* ── il cliente riconosciuto, per il resto della navigazione ── */
  function ricorda(c) {
    try { sessionStorage.setItem(CHIAVE, JSON.stringify(c)); } catch (e) {}
    /* la risposta del server arriva dopo che le pagine si sono gia'
       disegnate: chi deve precompilare qualcosa aspetta questo segnale */
    try {
      document.dispatchEvent(new CustomEvent('cc-cliente:pronto', { detail: c }));
    } catch (e) {}
  }
  function ricordato() {
    try { return JSON.parse(sessionStorage.getItem(CHIAVE) || 'null'); }
    catch (e) { return null; }
  }
  function dimentica() {
    try { sessionStorage.removeItem(CHIAVE); } catch (e) {}
  }
  window.CCCliente = { dati: ricordato, esci: function () { dimentica(); location.reload(); } };

  /* ── rimette in Selezione i prodotti abituali ── */
  function riempiSelezione(c) {
    if (!window.CCSel || !c.prodotti || !c.prodotti.length) return 0;
    var nuovi = 0;
    c.prodotti.forEach(function (p) {
      if (!p.nome) return;
      var agg = window.CCSel.aggiungiProdotto({
        name: p.nome,                       /* CCSel usa name/cat/url, non i nomi italiani */
        img: p.immagine || '',
        imgProfumo: p.imgProfumo || '',
        qta: p.quantita || 0,
        oltre: !!p.oltre,
        cat: p.categoria || '',
        url: p.pagina || '',                /* cliccando si torna alla scheda */
        /* niente "ref": CCSel lo usa come identita' e la pagina e' la stessa
           per tutte le varianti — due Sand diversi si sovrascriverebbero.
           Senza ref, l'identita' e' il nome completo di colore e misura. */
      });
      if (agg) nuovi++;
    });
    return nuovi;
  }

  /* ── striscia di benvenuto, sobria, richiudibile ── */
  function striscia(c, quanti) {
    if (document.querySelector('.cc-bentornato')) return;

    var stile = document.createElement('style');
    stile.textContent =
      '.cc-bentornato{position:fixed;left:0;right:0;bottom:0;z-index:9998;' +
      'background:#1A1612;color:#F5F1EA;font-family:Montserrat,sans-serif;' +
      'padding:.85rem 1.1rem;display:flex;align-items:center;gap:.9rem;' +
      'box-shadow:0 -2px 18px rgba(0,0,0,.18);transform:translateY(100%);' +
      'transition:transform .5s cubic-bezier(.2,.8,.2,1)}' +
      '.cc-bentornato.aperta{transform:translateY(0)}' +
      '.cc-bentornato-t{flex:1;min-width:0;font-size:.82rem;line-height:1.45;letter-spacing:.01em}' +
      '.cc-bentornato-t strong{font-weight:600;color:#d9b86a}' +
      '.cc-bentornato a.cc-bentornato-cta{white-space:nowrap;color:#1A1612;background:#d9b86a;' +
      'text-decoration:none;padding:.5rem .95rem;border-radius:2px;font-size:.72rem;' +
      'letter-spacing:.12em;text-transform:uppercase;font-weight:600}' +
      '.cc-bentornato button{background:none;border:0;color:#8d8578;font-size:1.35rem;' +
      'line-height:1;cursor:pointer;padding:0 .2rem}' +
      '.cc-bentornato button:hover{color:#F5F1EA}' +
      '@media(max-width:600px){.cc-bentornato{flex-wrap:wrap;padding:.75rem .9rem}' +
      '.cc-bentornato-t{flex:1 1 100%;order:1;margin-bottom:.6rem}' +
      '.cc-bentornato a.cc-bentornato-cta{order:2;flex:1}' +
      '.cc-bentornato button{order:3}}';
    document.head.appendChild(stile);

    var barra = document.createElement('div');
    barra.className = 'cc-bentornato';
    barra.setAttribute('role', 'status');
    barra.innerHTML =
      '<div class="cc-bentornato-t"></div>' +
      '<a class="cc-bentornato-cta" href="contatti.html"></a>' +
      '<button type="button">&times;</button>';
    document.body.appendChild(barra);

    function scrivi() {
      var d = t();
      var nome = esc(c.nome || c.azienda || '');
      barra.querySelector('.cc-bentornato-t').innerHTML =
        d.bentornato(nome) + (quanti ? d.conArticoli(quanti) : d.senzaArticoli);
      barra.querySelector('.cc-bentornato-cta').textContent = d.cta;
      barra.querySelector('button').setAttribute('aria-label', d.chiudi);
    }
    scrivi();
    window.addEventListener('cc-lang:change', scrivi);
    /* lingua cambiata in un'altra scheda */
    window.addEventListener('storage', function (e) { if (e.key === 'cc-lang') scrivi(); });

    barra.querySelector('button').addEventListener('click', function () {
      barra.classList.remove('aperta');
      setTimeout(function () { barra.remove(); }, 500);
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { barra.classList.add('aperta'); });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function scaduto() {
    console.info('[Cereria] ' + t().scaduto);
  }

  /* ── avvio ── */
  function avvia() {
    var url = new URL(location.href);
    var codice = url.searchParams.get('c');

    if (!codice) {                       /* gia' riconosciuto in questa sessione */
      var c = ricordato();
      if (c) striscia(c, 0);
      return;
    }

    noindex();

    /* Il codice sparisce dalla barra appena la risposta e' arrivata, cosi'
       non finisce in uno screenshot ne' in un segnalibro. Ma NON prima:
       se il server non risponde (spento, rete assente) toglierlo subito
       vorrebbe dire buttare via il link — ricaricare la pagina non
       riproverebbe piu' e il cliente dovrebbe ritrovarsi l'email.
       Quindi: risposta ricevuta (anche un "non esiste") → via il codice;
       server irraggiungibile → il codice resta, e basta ricaricare. */
    function ripulisciUrl() {
      url.searchParams.delete('c');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }

    if (!/^[a-f0-9]{32}$/.test(codice)) { ripulisciUrl(); return scaduto(); }

    fetch(endpoint() + '?c=' + encodeURIComponent(codice), {
      headers: { 'Accept': 'application/json' },
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
    })
      .then(function (r) {
        /* il server ha parlato: il codice ha fatto il suo lavoro */
        ripulisciUrl();
        return r.ok ? r.json() : null;
      })
      .then(function (d) {
        if (!d || !d.ok || !d.cliente) return scaduto();
        ricorda(d.cliente);
        striscia(d.cliente, riempiSelezione(d.cliente));
      })
      .catch(function () {
        /* qui l'url e' gia' pulito se la risposta era arrivata; se invece
           non e' arrivata affatto, il codice e' ancora al suo posto */
        scaduto();
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
