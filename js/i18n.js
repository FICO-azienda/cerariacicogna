/* ============================================================
   Cereria Cicogna — i18n IT/EN
   Traduzione live senza ricaricare. Nessun markup per-elemento:
   il dizionario è chiave = testo italiano esatto (normalizzato).
   - Ricorda la scelta in localStorage (cc-lang)
   - Toggle IT/EN nel menu su ogni pagina
   - Selettore lingua che compare appena finisce l'intro video (home)
   ============================================================ */
(function () {
  'use strict';

  /* ---- Dizionario IT -> EN (home + navigazione + footer) ---- */
  var DICT = {
    'Chiedilo all\u2019assistente': 'Ask the assistant',

    // <title>
    "Cereria Cicogna — Industria Ceraria, Novate Milanese": "Cereria Cicogna — Wax Manufactory, Novate Milanese",
    // brand / legale (invariati)
    "Industria F.lli Cicogna · Novate Milanese": "F.lli Cicogna Manufactory · Novate Milanese",
    // NAV
    "Home Collection": "Home Collection",
    "Garden": "Garden",
    "Liturgico": "Liturgical",
    "Private Label": "Private Label",
    "Fragrance Library": "Fragrance Library",
    "Collaborazioni": "Collaborations",
    "Chi Siamo": "About Us",
    "Contattaci": "Contact Us",
    "Contatti": "Contact",
    // MEGA-MENU
    "Prodotti": "Products",
    "Vedi tutti": "View all",
    "Candele profumate per arredare e impreziosire ogni ambiente della casa.": "Scented candles to furnish and enrich every room of the home.",
    "Sand": "Sand", "Rock": "Rock", "Glass": "Glass", "Metallic": "Metallic",
    "Ceri": "Pillar Candles",
    "Linea Garden": "Garden Line",
    "Candele per esterni e interni, pensate per ogni stagione all'aperto.": "Candles for outdoors and indoors, designed for every season outside.",
    "Citronelle": "Citronella",
    "Cera Bianca": "White Wax",
    "Ricariche": "Refills",
    "Articoli Liturgici": "Liturgical Items",
    "Ceri, lumini e arredi sacri per chiese, santuari e cerimonie religiose.": "Candles, votive lights and sacred furnishings for churches, sanctuaries and religious ceremonies.",
    "Lumini da chiesa": "Church votive lights",
    "Accessori": "Accessories",
    "Forniture": "Supplies",
    // VIDEO HERO
    "Novate Milanese (MI)": "Novate Milanese (MI)",
    "La stessa luce, da generazioni.": "The same light, for generations.",
    "Dal sacro al quotidiano.": "From the sacred to the everyday.",
    "Entra": "Enter",
    "Scorri": "Scroll",
    "Salta ↓": "Skip ↓",
    // HERO HOME
    "Cereria Cicogna · Novate Milanese": "Cereria Cicogna · Novate Milanese",
    "Luce.": "Light.", "Materia.": "Matter.", "Silenzio.": "Silence.",
    "Candele artigianali dove la tradizione incontra la ricerca estetica. Luce che dura nel tempo.": "Artisan candles where tradition meets aesthetic research. Light that endures.",
    "Scopri le collezioni": "Discover the collections",
    // caption carosello (statica + JS)
    "La collezione in vetro": "The glass collection",
    "La collezione a colori": "The collection in colour",
    "Geometrie di luce": "Geometries of light",
    "Forma e materia": "Form and matter",
    "Colore e composizione": "Colour and composition",
    // CATEGORIE
    "Le nostre linee": "Our lines",
    "Da dove vuoi cominciare?": "Where would you like to begin?",
    "Candele per interni": "Indoor candles",
    "Home": "Home", "Collection": "Collection",
    "Scopri la collezione →": "Discover the collection →",
    "Ceri, lumini e devozione": "Candles, lights & devotion",
    // gallery
    "Oltre 50 anni di artigianalità": "Over 50 years of craftsmanship",
    // SCENT CTA
    "Libreria Olfattiva": "Olfactory Library",
    "Trova la tua fragranza": "Find your fragrance",
    "Un archivio di profumi d'autore e note naturali, da comporre su misura per la tua candela.": "An archive of signature perfumes and natural notes, to compose bespoke for your candle.",
    "Esplora la Fragrance Library": "Explore the Fragrance Library",
    "Oppure richiedi un profumo su misura →": "Or request a bespoke fragrance →",
    // HERITAGE
    '"Ogni candela che esce dalle nostre mani': '"Every candle that leaves our hands',
    "porta con sé la stessa dedizione —": "carries the same dedication —",
    "quella che abbiamo ricevuto, e che oggi": "the one we received, and that today",
    "tramandiamo": "we pass on",
    "La Cereria Cicogna nasce dall'intuizione di Luigi Cicogna e cresce di generazione in generazione: tre generazioni di maestri cerai in Lombardia, una tradizione che Filippo e Fabio Cicogna portano avanti oggi con la stessa cura di sempre. Le chiese e i santuari più importanti del nord Italia si affidano a noi da decenni — una fiducia costruita in silenzio, candela dopo candela. Nel tempo, questa dedizione ha trovato nuovi spazi: la casa, il giardino, la tavola. Le materie prime non cambiano. Il metodo non cambia. Il cognome nemmeno.": "Cereria Cicogna was born from the vision of Luigi Cicogna and has grown generation after generation: three generations of master wax-makers in Lombardy, a tradition that Filippo and Fabio Cicogna carry on today with the same care as always. The most important churches and sanctuaries of northern Italy have relied on us for decades — a trust built in silence, candle after candle. Over time, this dedication has found new spaces: the home, the garden, the table. The raw materials do not change. The method does not change. Nor does the family name.",
    "La nostra storia →": "Our story →",
    // B2B
    "Per professionisti": "For professionals",
    "Fornitura su misura": "Bespoke supply",
    "per locali ed eventi": "for venues & events",
    "Ristoranti, hotel, catering e organizzatori di eventi: progettiamo candele private label con la vostra identità visiva. Quantità flessibili, consegne puntuali, assistenza dedicata.": "Restaurants, hotels, catering and event planners: we design private-label candles with your visual identity. Flexible quantities, punctual deliveries, dedicated assistance.",
    "Candele in bicchiere con etichetta personalizzata": "Glass candles with a custom label",
    "Accessori liturgici per chiese e parrocchie": "Liturgical accessories for churches and parishes",
    "Forniture ricorrenti per hotel e ristoranti": "Recurring supplies for hotels and restaurants",
    "Campionari su richiesta": "Samples on request",
    "Richiedi informazioni": "Request information",
    // PRODUZIONE
    "La nostra produzione": "Our production",
    "Dalla cera": "From the wax",
    "al prodotto finito": "to the finished product",
    "Tre generazioni di esperienza incontrano le tecnologie più avanzate: ogni candela nasce da materiali selezionati e da una lavorazione curata in ogni fase, dalla colata al confezionamento.": "Three generations of experience meet the most advanced technologies: every candle is born from selected materials and craftsmanship cared for at every stage, from pouring to packaging.",
    "Selezione della cera": "Wax selection",
    "Colata e raffreddamento": "Pouring & cooling",
    "Confezionamento": "Packaging",
    // FOOTER
    "Industria ceraria artigianale.": "Artisan wax manufactory.",
    "Dal sacro al quotidiano,": "From the sacred to the everyday,",
    "la stessa luce da generazioni.": "the same light for generations.",
    "Linee": "Lines",
    "Azienda": "Company",
    "Per professionisti": "For professionals",
    "Privacy": "Privacy",
    "Cookie": "Cookie"
  };

  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  // unisce il dizionario delle pagine interne (js/i18n-pages.js), se presente
  if (window.CC_DICT_PAGES) {
    for (var pk in window.CC_DICT_PAGES) {
      if (window.CC_DICT_PAGES.hasOwnProperty(pk) && !(pk in DICT)) DICT[pk] = window.CC_DICT_PAGES[pk];
    }
  }

  // mappe bidirezionali IT<->EN, senza cache per-nodo:
  // traduce in base al TESTO ATTUALE, quindi robusto con marquee/cloni/caroselli
  var IT2EN = {}, EN2IT = {};
  for (var k in DICT) {
    if (!DICT.hasOwnProperty(k)) continue;
    var ik = norm(k), ek = norm(DICT[k]);
    IT2EN[ik] = DICT[k];
    if (!(ek in EN2IT)) EN2IT[ek] = k;
  }

  var STORE = 'cc-lang';
  var LANG = localStorage.getItem(STORE) || 'it';
  var origTitle = null, enTitle = null;
  var mo = null;

  function translateNode(node) {
    var raw = node.nodeValue;
    if (!raw) return;
    var key = norm(raw);
    if (!key) return;
    var target = (LANG === 'en') ? IT2EN[key] : EN2IT[key];
    if (target == null) return;
    var lead = (raw.match(/^\s*/) || [''])[0];
    var trail = (raw.match(/\s*$/) || [''])[0];
    var val = lead + target + trail;
    if (node.nodeValue !== val) node.nodeValue = val;
  }

  /* Anche i testi dentro gli attributi: il suggerimento grigio dei campi
     ("Descrivi la tua richiesta…"), le etichette per i lettori di schermo,
     i tooltip. Restavano in italiano con il sito in inglese, perche' non
     sono nodi di testo e il traduttore non li vedeva. */
  var ATTRIBUTI = ['placeholder', 'aria-label', 'title', 'alt'];

  function translateAttrs(el) {
    if (!el || el.nodeType !== 1 || !el.getAttribute) return;
    for (var i = 0; i < ATTRIBUTI.length; i++) {
      var nome = ATTRIBUTI[i];
      var raw = el.getAttribute(nome);
      if (!raw) continue;
      var key = norm(raw);
      if (!key) continue;
      var target = (LANG === 'en') ? IT2EN[key] : EN2IT[key];
      if (target != null && raw !== target) el.setAttribute(nome, target);
    }
  }

  function walkAttrs(root) {
    if (!root || !root.querySelectorAll) return;
    translateAttrs(root);
    var sel = ATTRIBUTI.map(function (a) { return '[' + a + ']'; }).join(',');
    var nodi = root.querySelectorAll(sel);
    for (var i = 0; i < nodi.length; i++) translateAttrs(nodi[i]);
  }

  function walk(root) {
    if (!root) return;
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode; if (!p) return NodeFilter.FILTER_REJECT;
        var t = p.nodeName;
        if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEXTAREA') return NodeFilter.FILTER_REJECT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var list = [], n;
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(translateNode);
  }

  function applyAll() {
    if (mo) mo.disconnect();
    if (origTitle === null) { origTitle = document.title; enTitle = IT2EN[norm(origTitle)] || origTitle; }
    document.title = (LANG === 'en') ? enTitle : origTitle;
    if (document.body) { walk(document.body); walkAttrs(document.body); }
    document.documentElement.lang = LANG;
    if (mo && document.body) mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    updateToggle();
  }

  /* dinamico: marquee/cloni, caption che ruota, carrello iniettato, ecc. */
  function startObserver() {
    if (!window.MutationObserver || mo) return;
    mo = new MutationObserver(function (muts) {
      mo.disconnect();
      muts.forEach(function (m) {
        if (m.type === 'characterData') translateNode(m.target);
        else if (m.type === 'childList') m.addedNodes.forEach(function (nd) {
          if (nd.nodeType === 3) translateNode(nd);
          else if (nd.nodeType === 1) { walk(nd); walkAttrs(nd); }
        });
      });
      mo.takeRecords();
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  }

  function setLang(l) {
    LANG = l;
    localStorage.setItem(STORE, l);
    applyAll();
    /* Chi non passa dal dizionario (il widget dell'assistente, che ha i suoi
       testi) ha bisogno di sapere che la lingua e' cambiata. */
    try { window.dispatchEvent(new CustomEvent('cc-lang:change', { detail: { lang: l } })); } catch (e) {}
  }

  /* ---- UI: toggle nel menu ---- */
  function updateToggle() {
    document.querySelectorAll('.cc-lang-btn').forEach(function (b) {
      b.classList.toggle('on', b.dataset.l === LANG);
    });
  }

  function injectStyle() {
    if (document.getElementById('cc-i18n-style')) return;
    var s = document.createElement('style'); s.id = 'cc-i18n-style';
    s.textContent =
      '.cc-lang{display:inline-flex;align-items:center;gap:7px;flex:0 0 auto;margin:0 clamp(16px,1.8vw,28px) 0 0;font-family:"Montserrat",sans-serif;font-size:.5rem;font-weight:400;letter-spacing:.18em;}' +
      '.cc-lang-btn{background:none;border:none;padding:2px 1px;cursor:pointer;color:inherit;opacity:.5;letter-spacing:.18em;text-transform:uppercase;transition:opacity .25s,color .25s;}' +
      '.cc-lang-btn.on{opacity:1;color:var(--c-gold,#c4922a);}' +
      '.cc-lang-btn:hover{opacity:.9;}' +
      '.cc-lang-sep{opacity:.35;}' +
      '.cc-langmodal{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:rgba(16,12,6,.55);backdrop-filter:blur(3px);opacity:0;transition:opacity .5s ease;}' +
      '.cc-langmodal.on{opacity:1;}' +
      '.cc-langcard{background:#f8f3ea;color:#1a1612;padding:44px 52px;max-width:440px;width:86%;text-align:center;box-shadow:0 40px 90px -30px rgba(0,0,0,.5);}' +
      '.cc-langcard .k{font-family:"Montserrat",sans-serif;font-size:.5rem;letter-spacing:.32em;text-transform:uppercase;color:#c4922a;margin-bottom:18px;}' +
      '.cc-langcard h3{font-family:"Cormorant",serif;font-weight:300;font-size:1.7rem;line-height:1.3;margin:0 0 26px;letter-spacing:.02em;}' +
      '.cc-langcard .row{display:flex;gap:14px;justify-content:center;}' +
      '.cc-langcard button{flex:1;font-family:"Montserrat",sans-serif;font-size:.54rem;letter-spacing:.2em;text-transform:uppercase;padding:14px 10px;background:none;border:1px solid rgba(26,22,18,.3);color:#1a1612;cursor:pointer;transition:background .3s,color .3s,border-color .3s;}' +
      '.cc-langcard button:hover{background:#1a1612;color:#f8f3ea;border-color:#1a1612;}';
    document.head.appendChild(s);
  }

  function injectToggle() {
    document.querySelectorAll('nav').forEach(function (nav) {
      if (nav.querySelector('.cc-lang')) return;
      var box = document.createElement('div');
      box.className = 'cc-lang';
      box.innerHTML = '<button class="cc-lang-btn" data-l="it" type="button" aria-label="Italiano">IT</button>' +
        '<span class="cc-lang-sep" aria-hidden="true">/</span>' +
        '<button class="cc-lang-btn" data-l="en" type="button" aria-label="English">EN</button>';
      box.querySelectorAll('.cc-lang-btn').forEach(function (b) {
        b.addEventListener('click', function () { setLang(b.dataset.l); });
      });
      var cta = nav.querySelector('.nav-cta');
      if (cta && cta.parentNode === nav) nav.insertBefore(box, cta);
      else nav.appendChild(box);
    });
    updateToggle();
  }

  /* ---- Selettore dopo l'intro video (solo home, prima scelta) ---- */
  function showChooser() {
    if (document.querySelector('.cc-langmodal')) return;
    var m = document.createElement('div');
    m.className = 'cc-langmodal';
    m.innerHTML = '<div class="cc-langcard"><p class="k">Cereria Cicogna</p>' +
      '<h3>Scegli la lingua<br><span style="font-style:italic;opacity:.7">Choose your language</span></h3>' +
      '<div class="row"><button type="button" data-l="it">Italiano</button>' +
      '<button type="button" data-l="en">English</button></div></div>';
    document.body.appendChild(m);
    m.querySelectorAll('button').forEach(function (b) {
      b.addEventListener('click', function () {
        setLang(b.dataset.l);
        m.classList.remove('on');
        setTimeout(function () { m.remove(); }, 500);
      });
    });
    setTimeout(function () { m.classList.add('on'); }, 30);
  }

  function watchIntro() {
    var gate = document.getElementById('v-hero');
    if (!gate) return;                 // non è la home
    var obs = new MutationObserver(function () {
      var hidden = gate.style.display === 'none' || getComputedStyle(gate).display === 'none';
      if (hidden) { obs.disconnect(); showChooser(); }
    });
    obs.observe(gate, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function init() {
    injectStyle();
    injectToggle();
    applyAll();
    startObserver();
    watchIntro();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CCI18n = { set: setLang, get: function () { return LANG; }, refresh: applyAll };
})();
