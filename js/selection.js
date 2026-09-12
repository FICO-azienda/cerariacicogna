/* ══════════════════════════════════════════════════════════════
   CCSel — selezione condivisa fra le pagine
   ──────────────────────────────────────────────────────────────
   Raccoglie TUTTI i prodotti che l'utente sceglie lungo il sito:
   uno non sostituisce l'altro, si accumulano in una lista.
   Ogni voce puo' essere:
     · un prodotto singolo          → { tipo:'prodotto', prodotto:{…} }
     · un abbinamento candela+profumo → { tipo:'abbinamento', candela:{…}, profumo:{…} }

   "Parla con noi" / "Contattaci" allega da solo l'intera lista alla
   richiesta, senza che l'utente debba reinserire nulla.

   Il sito e' statico e naviga a pagina piena: l'unico modo di portare
   lo stato da una pagina all'altra e' localStorage.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var KEY = 'cc-selezione';
  var TTL = 7 * 24 * 60 * 60 * 1000;   /* la selezione scade dopo 7 giorni */
  var MAX = 20;                        /* tetto di sicurezza */

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return [];
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.voci)) return [];
      if (Date.now() - (s.ts || 0) > TTL) { localStorage.removeItem(KEY); return []; }
      return s.voci;
    } catch (e) { return []; }
  }

  function write(voci) {
    try {
      if (!voci.length) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify({ voci: voci.slice(0, MAX), ts: Date.now() }));
    } catch (e) { /* storage pieno o disabilitato */ }
    try { window.dispatchEvent(new CustomEvent('ccsel:change')); } catch (e) {}
  }

  /* rende assoluto un src relativo, così l'immagine si vede da qualsiasi pagina */
  function absUrl(u) {
    if (!u) return '';
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  }

  /* Un tetto serve: senza, un dito appoggiato sullo zero manda in cereria
     una richiesta da centomila pezzi che nessuno ha voluto davvero. */
  var QTA_MAX = 1000;
  function limiteQta(v) {
    var n = parseInt(v, 10);
    if (!(n > 0)) return 0;
    return n > QTA_MAX ? QTA_MAX : n;
  }

  function pulisci(item) {
    if (!item || !item.name) return null;
    return {
      name: String(item.name).trim(),
      ref:  item.ref ? String(item.ref).trim() : '',
      img:  absUrl(item.img),
      cat:  item.cat ? String(item.cat) : '',
      url:  absUrl(item.url || location.href),
      /* quantita' e foto del profumo: le porta l'assistente quando la
         richiesta nasce da una proposta con dei numeri. Opzionali. */
      qta:  limiteQta(item.qta),
      /* oltre il tetto non e' un errore: e' una fornitura da concordare.
         Il numero resta a 1000 e questo flag dice che il vero valore
         lo si scrive nel messaggio e lo confermiamo per email. */
      oltre: !!item.oltre,
      imgProfumo: absUrl(item.imgProfumo)
    };
  }

  /* chiave di identità: evita doppioni della stessa identica scelta */
  function chiave(v) {
    return v.tipo === 'abbinamento'
      ? 'a:' + (v.candela.ref || v.candela.name) + '+' + (v.profumo.ref || v.profumo.name)
      : 'p:' + (v.prodotto.ref || v.prodotto.name);
  }

  var CCSel = {

    /* ── lettura ── */
    voci:   read,
    count:  function () { return read().length; },
    vuota:  function () { return read().length === 0; },

    /* ── scrittura ── */

    /* aggiunge un prodotto singolo alla lista (non sostituisce gli altri) */
    aggiungiProdotto: function (item) {
      var p = pulisci(item);
      if (!p) return false;
      var voci = read();
      var v = { tipo: 'prodotto', prodotto: p };
      var k = chiave(v);
      var i = voci.findIndex(function (x) { return chiave(x) === k; });
      if (i >= 0) { voci[i] = v; }         /* già presente: aggiorna e basta */
      else voci.push(v);
      write(voci);
      return i < 0;                         /* true se è una nuova aggiunta */
    },

    /* aggiunge un abbinamento candela + profumo */
    aggiungiAbbinamento: function (candela, profumo) {
      var c = pulisci(candela), p = pulisci(profumo);
      if (!c || !p) return false;
      var voci = read();
      var v = { tipo: 'abbinamento', candela: c, profumo: p };
      var k = chiave(v);
      var i = voci.findIndex(function (x) { return chiave(x) === k; });
      if (i >= 0) { voci[i] = v; }
      else voci.push(v);
      write(voci);
      return i < 0;
    },

    /* rimuove la voce in posizione idx */
    rimuovi: function (idx) {
      var voci = read();
      if (idx < 0 || idx >= voci.length) return;
      voci.splice(idx, 1);
      write(voci);
    },

    svuota: function () { write([]); },

    QTA_MAX: QTA_MAX,

    /* Cambia i pezzi di una riga. Sopra il tetto non fallisce: fissa il
       massimo e segna la riga come "da concordare", che e' la risposta
       onesta a chi ne vuole tremila. Restituisce cosa e' stato applicato. */
    setQta: function (idx, valore) {
      var voci = read();
      var v = voci[idx];
      if (!v) return null;
      /* In un abbinamento la quantita' e' quella della candela: il profumo
         non si conta a parte, e' la profumazione di quelle candele li'. */
      var bersaglio = (v.tipo === 'abbinamento') ? v.candela : v.prodotto;
      if (!bersaglio) return null;
      var chiesto = parseInt(valore, 10);
      var esito = {
        qta: limiteQta(chiesto),
        oltre: (chiesto > QTA_MAX)
      };
      bersaglio.qta = esito.qta;
      bersaglio.oltre = esito.oltre;
      write(voci);
      return esito;
    },

    /* la quantita' di una voce, qualunque sia il suo tipo */
    qtaDi: function (v) {
      if (!v) return { qta: 0, oltre: false };
      var o = (v.tipo === 'abbinamento') ? v.candela : v.prodotto;
      return { qta: (o && o.qta) || 0, oltre: !!(o && o.oltre) };
    },

    /* ── candela "in transito" verso la Fragrance Library ──
       Serve per l'abbinamento: la candela viaggia a parte, così funziona
       anche se l'utente non l'ha ancora aggiunta alla richiesta. */
    setCandelaInCorso: function (item) {
      var p = pulisci(item);
      if (!p) return;
      try { sessionStorage.setItem(KEY + '-candela', JSON.stringify(p)); } catch (e) {}
    },
    getCandelaInCorso: function () {
      try {
        var raw = sessionStorage.getItem(KEY + '-candela');
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },

    /* ── formattazione ── */

    /* etichetta breve di una singola voce */
    etichetta: function (v) {
      return v.tipo === 'abbinamento'
        ? v.candela.name + ' + ' + v.profumo.name
        : v.prodotto.name;
    },

    /* blocco di testo pronto da allegare al corpo del messaggio */
    toText: function (voci) {
      voci = voci || read();
      if (!voci.length) return '';
      var righe = voci.map(function (v, i) {
        var n = (i + 1) + '. ';
        if (v.tipo === 'abbinamento') {
          var q = v.candela.oltre
                ? '  —  oltre ' + QTA_MAX + ' pz (quantita\' esatta da concordare)'
                : (v.candela.qta ? '  —  ' + v.candela.qta + ' pz' : '');
          return n + 'ABBINAMENTO' + q + '\n'
               + '   Candela: ' + v.candela.name + (v.candela.ref ? '  [rif. ' + v.candela.ref + ']' : '') + '\n'
               + '   Profumo: ' + v.profumo.name + (v.profumo.ref ? '  [rif. ' + v.profumo.ref + ']' : '');
        }
        return n + v.prodotto.name
             + (v.prodotto.oltre
                  ? '  —  oltre ' + QTA_MAX + ' pz (quantita\' esatta da concordare)'
                  : (v.prodotto.qta ? '  —  ' + v.prodotto.qta + ' pz' : ''))
             + (v.prodotto.ref ? '  [rif. ' + v.prodotto.ref + ']' : '');
      });
      return (voci.length === 1 ? 'PRODOTTO SELEZIONATO' : 'PRODOTTI SELEZIONATI (' + voci.length + ')')
           + '\n' + righe.join('\n');
    },

    /* valore coerente per la select "Interesse" in contatti.html */
    interesse: function (voci) {
      voci = voci || read();
      if (!voci.length) return '';
      var cats = voci.map(function (v) {
        return (v.tipo === 'abbinamento' ? 'home-collection' : (v.prodotto.cat || '')).toLowerCase();
      });
      var uniche = cats.filter(function (c, i) { return c && cats.indexOf(c) === i; });
      if (uniche.length !== 1) return '';    /* categorie miste: lascia scegliere */
      var c = uniche[0];
      if (c.indexOf('liturg') === 0 || ['forniture', 'lumini', 'accessori'].indexOf(c) >= 0) return 'liturgico';
      if (c.indexOf('garden') === 0 || ['citronelle', 'cerabianca', 'ricariche'].indexOf(c) >= 0) return 'garden';
      if (c === 'private-label') return 'private-label';
      return 'home-collection';
    },

    /* ── conferma visiva riutilizzabile ── */
    conferma: function (testo) {
      var el = document.createElement('div');
      el.className = 'ccsel-toast';
      el.setAttribute('role', 'status');
      el.textContent = testo;
      document.body.appendChild(el);
      requestAnimationFrame(function () { el.classList.add('on'); });
      setTimeout(function () {
        el.classList.remove('on');
        setTimeout(function () { el.remove(); }, 400);
      }, 2600);
    }
  };

  window.CCSel = CCSel;

  /* stile del toast e del carrello, iniettati una volta sola */
  var st = document.createElement('style');
  st.textContent =
    '.ccsel-toast{position:fixed;left:50%;bottom:34px;transform:translate(-50%,14px);z-index:900;' +
    'background:#2a231a;color:#f7f2e8;padding:15px 26px;font-family:var(--ff-sans,sans-serif);' +
    'font-weight:300;font-size:.52rem;letter-spacing:.2em;text-transform:uppercase;' +
    'opacity:0;transition:opacity .35s,transform .35s;pointer-events:none;max-width:88vw;text-align:center}' +
    '.ccsel-toast.on{opacity:1;transform:translate(-50%,0)}' +
    /* carrello in nav: pastiglia oro, leggibile sia su nav chiara sia su nav scura */
    '.ccsel-cart{display:none;align-items:center;gap:7px;flex:0 0 auto;margin-left:12px;' +
    'padding:7px 12px;background:#c4922a;color:#1a1610;text-decoration:none;' +
    'font-family:var(--ff-sans,sans-serif);font-weight:400;font-size:.46rem;letter-spacing:.12em;' +
    'text-transform:uppercase;white-space:nowrap;transition:background .3s,transform .3s;' +
    'position:relative;z-index:201}' +
    '.ccsel-cart.on{display:inline-flex}' +
    /* col carrello attivo il "Contattaci" è ridondante: stessa destinazione, e la nav resta larga il giusto */
    'nav.ccsel-has .nav-cta{display:none}' +
    '.ccsel-cart:hover{background:#d8a63c}' +
    '.ccsel-cart svg{width:13px;height:13px;display:block;flex:0 0 auto}' +
    '.ccsel-cart-n{font-weight:400;letter-spacing:.06em}' +
    '.ccsel-cart.bump{animation:ccselBump .45s cubic-bezier(.34,1.56,.64,1)}' +
    '@keyframes ccselBump{0%{transform:scale(1)}40%{transform:scale(1.16)}100%{transform:scale(1)}}' +
    '@media(max-width:1100px){.ccsel-cart-txt{display:none}}' +
    '@media(max-width:600px){.ccsel-cart{padding:7px 10px;margin-left:8px}}';
  document.head.appendChild(st);

  /* ── carrello in alto a destra: compare appena si seleziona qualcosa ── */
  function montaCarrello() {
    var nav = document.querySelector('nav');
    if (!nav || nav.querySelector('.ccsel-cart')) return;

    var a = document.createElement('a');
    a.className = 'ccsel-cart';
    a.href = 'contatti.html';
    a.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 8h16l-1.4 11.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 8Z"/>' +
      '<path d="M8.5 8V6.2a3.5 3.5 0 0 1 7 0V8"/></svg>' +
      '<span class="ccsel-cart-txt">Selezione</span>' +
      '<span class="ccsel-cart-n"></span>';

    /* subito prima dell'hamburger, così resta l'ultimo elemento a destra */
    var burger = nav.querySelector('.nav-hamburger');
    if (burger) nav.insertBefore(a, burger);
    else nav.appendChild(a);

    var prima = -1;
    function aggiorna() {
      var n = CCSel.count();
      a.classList.toggle('on', n > 0);
      nav.classList.toggle('ccsel-has', n > 0);
      a.querySelector('.ccsel-cart-n').textContent = n ? '(' + n + ')' : '';
      a.setAttribute('aria-label', n === 1 ? '1 prodotto selezionato, vai ai contatti'
                                           : n + ' prodotti selezionati, vai ai contatti');
      if (prima >= 0 && n > prima) {
        a.classList.remove('bump');
        void a.offsetWidth;          /* riavvia l'animazione */
        a.classList.add('bump');
      }
      prima = n;
    }
    aggiorna();
    window.addEventListener('ccsel:change', aggiorna);
    /* selezione fatta in un'altra scheda del browser */
    window.addEventListener('storage', function (e) { if (e.key === KEY) aggiorna(); });
  }

  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', montaCarrello);
  else montaCarrello();

  /* ── schede prodotto (product-*.html) ──
     Non si aggiunge nulla per la sola visita: si aggiunge quando l'utente
     clicca la CTA di contatto, così la richiesta parte già con il prodotto. */
  document.addEventListener('DOMContentLoaded', function () {
    var file = location.pathname.split('/').pop() || '';
    if (file.indexOf('product-') !== 0) return;

    var cat = '';
    if (file.indexOf('product-lit-') === 0) cat = 'liturgico';
    else if (file.indexOf('product-garden-') === 0 || file.indexOf('product-citronella') === 0 ||
             file.indexOf('product-padella') === 0 || file.indexOf('product-fiaccola') === 0 ||
             file.indexOf('product-olio') === 0 || file.indexOf('product-set-giardino') === 0) cat = 'garden';
    else if (file.indexOf('product-hc-') === 0) cat = 'home-collection';

    document.querySelectorAll('a.pd-cta[href="contatti.html"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var titolo = document.querySelector('.pd-title');
        if (!titolo) return;
        e.preventDefault();
        var img = document.querySelector('.pd-gallery img');
        CCSel.aggiungiProdotto({
          name: titolo.textContent.trim(),
          ref:  file.replace(/\.html$/, '') + (location.hash || ''),
          img:  img ? img.src : '',
          cat:  cat,
          url:  location.href
        });
        location.href = 'contatti.html';
      });
    });
  });
})();
