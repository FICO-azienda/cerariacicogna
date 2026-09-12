/* ══════════════════════════════════════════════════════════════
   cc-assistant.js — assistente di catalogo, widget per il sito
   ──────────────────────────────────────────────────────────────
   Si installa con una riga sola, in fondo al <body> di ogni pagina:

     <script src="assistant/widget/cc-assistant.js"
             data-endpoint="http://localhost:8787/api/chat" defer></script>

   Nessuna dipendenza. Parla con /api/chat in Server-Sent Events e
   si aggancia a CCSel (js/selection.js) quando c'e': i prodotti
   consigliati finiscono nella stessa Selezione del resto del sito.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var script   = document.currentScript || (function () { var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
  /* In sviluppo il sito e' su una porta e l'API su un'altra, quindi le
     pagine portano un data-endpoint con l'indirizzo locale. In produzione
     stanno sulla stessa origine e quell'attributo va IGNORATO: se restasse
     buono, il sito pubblicato chiederebbe le risposte al computer di chi
     lo sta guardando, e l'assistente sarebbe morto per tutti. */
  var inLocale = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
  var ENDPOINT = (inLocale && script && script.dataset.endpoint) || '/api/chat';
  /* L'albero delle domande sta accanto a questo file: il widget lo legge
     da fermo, senza passare dal server e senza costare nulla. */
  var PERCORSO_URL = (script && script.dataset.percorso)
    || (script && script.src ? script.src.replace(/[^/]*$/, 'percorso.json') : 'percorso.json');
  var PRIVACY  = (script && script.dataset.privacy)  || '';
  var EMAIL    = (script && script.dataset.email)    || 'info@cerariacicogna.com';

  /* ── lingua: la stessa scelta del resto del sito ───────────── */
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
      apri: 'Parla con noi', titolo: 'Assistente', sottotitolo: 'Cereria Cicogna',
      avviso: 'Stai parlando con un assistente automatico. Non inserire dati di pagamento.',
      privacy: 'Privacy', chiudi: 'Chiudi',
      placeholder: 'Che tipo di candela cerchi?',
      invia: 'Invia',
      benvenuto: 'Buongiorno. Posso aiutarla a orientarsi tra le nostre linee — casa, giardino o articoli liturgici — e a trovare la profumazione giusta. Che cosa sta cercando?',
      spunti: ['Candele per un ristorante', 'Qualcosa per il giardino', 'Lumini per la chiesa', 'Che profumazioni avete?'],
      aggiungi: 'Aggiungi alla selezione', aggiunto: 'Aggiunto', vedi: 'Vedi la scheda',
      bozza: 'Messaggio pronto da inviare', apriMail: 'Vai al modulo e invia',
      erroreTitolo: 'Non riesco a rispondere',
      scrivici: 'Scrivici a', sta: 'sto scrivendo'
    },
    en: {
      apri: 'Talk to us', titolo: 'Assistant', sottotitolo: 'Cereria Cicogna',
      avviso: 'You are talking to an automated assistant. Never enter payment details.',
      privacy: 'Privacy', chiudi: 'Close',
      placeholder: 'What kind of candle are you looking for?',
      invia: 'Send',
      benvenuto: 'Good morning. I can help you find your way around our lines — home, garden or liturgical items — and choose the right fragrance. What are you looking for?',
      spunti: ['Candles for a restaurant', 'Something for the garden', 'Votive lights for a church', 'What fragrances do you have?'],
      aggiungi: 'Add to selection', aggiunto: 'Added', vedi: 'View product',
      bozza: 'Message ready to send', apriMail: 'Go to the form and send',
      erroreTitolo: 'I cannot answer right now',
      scrivici: 'Write to us at', sta: 'typing'
    }
  };
  var t = T[lang()];

  /* ── stile ─────────────────────────────────────────────────── */
  var CSS = ''
    + '.cca-fab{position:fixed;right:22px;bottom:22px;z-index:950;display:inline-flex;align-items:center;gap:10px;'
    + 'padding:14px 20px;border:none;cursor:pointer;background:#1a1610;color:#f2e8d0;'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.5rem;font-weight:400;letter-spacing:.2em;'
    + 'text-transform:uppercase;box-shadow:0 18px 40px -18px rgba(0,0,0,.6);transition:background .3s,transform .3s}'
    + '.cca-fab:hover{background:#2a231a;transform:translateY(-2px)}'
    + '.cca-fab svg{width:15px;height:15px;flex:0 0 auto}'
    + '.cca-fab.hide{display:none}'
    + '.cca-panel{position:fixed;right:22px;bottom:22px;z-index:951;width:400px;max-width:calc(100vw - 44px);'
    + 'height:min(620px,calc(100vh - 44px));display:none;flex-direction:column;background:#faf7f1;color:#1a1610;'
    + 'box-shadow:0 40px 90px -30px rgba(0,0,0,.5);opacity:0;transform:translateY(12px);transition:opacity .3s,transform .3s}'
    + '.cca-panel.on{display:flex}.cca-panel.in{opacity:1;transform:translateY(0)}'
    + '.cca-head{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:18px 20px;background:#1a1610;color:#f2e8d0;'
    + 'cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}'
    + '.cca-head:active{cursor:grabbing}'
    + '.cca-panel.trascino{transition:none;will-change:left,top}'
    + '.cca-panel.trascino .cca-body{pointer-events:none}'
    /* sul telefono il pannello e\' a schermo intero: spostarlo non ha senso */
    + '@media(max-width:620px){.cca-head{cursor:default}}'
    + '.cca-head-txt{flex:1;min-width:0}'
    + '.cca-head-k{font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.44rem;letter-spacing:.28em;text-transform:uppercase;color:#c4922a}'
    + '.cca-head-n{font-family:var(--ff-display,"Cormorant SC",serif);font-size:1.05rem;font-weight:300;letter-spacing:.06em;margin-top:3px}'
    + '.cca-x{background:none;border:none;color:inherit;cursor:pointer;font-size:1.1rem;line-height:1;padding:6px;opacity:.7}'
    + '.cca-x:hover{opacity:1}'
    + '.cca-avviso{flex:0 0 auto;padding:9px 20px;background:#efe7d7;border-bottom:1px solid rgba(26,22,16,.09);'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.46rem;line-height:1.7;letter-spacing:.04em;color:#5f574a}'
    + '.cca-avviso a{color:#8a6a1f}'
    + '.cca-body{flex:1;overflow-y:auto;overscroll-behavior:contain;padding:20px;display:flex;flex-direction:column;gap:14px}'
    + '.cca-msg{max-width:88%;font-family:var(--ff-serif,"Cormorant",serif);font-size:1rem;line-height:1.65;white-space:pre-wrap;word-wrap:break-word}'
    + '.cca-msg.bot{align-self:flex-start;color:#1a1610}'
    + '.cca-msg.me{align-self:flex-end;background:#1a1610;color:#f2e8d0;padding:11px 15px;font-size:.95rem}'
    + '.cca-card{align-self:flex-start;width:100%;display:flex;gap:13px;padding:13px;background:#fff;border:1px solid rgba(26,22,16,.1)}'
    + '.cca-card img{width:74px;height:74px;object-fit:cover;flex:0 0 auto;background:#f0ebe1}'
    + '.cca-card-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}'
    + '.cca-card-k{font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.42rem;letter-spacing:.2em;text-transform:uppercase;color:#9a8f7c}'
    + '.cca-card-n{font-family:var(--ff-display,"Cormorant SC",serif);font-size:.95rem;font-weight:400;letter-spacing:.03em}'
    + '.cca-card-p{font-family:var(--ff-serif,"Cormorant",serif);font-size:.86rem;line-height:1.5;color:#5f574a}'
    + '.cca-card-r{display:flex;gap:8px;flex-wrap:wrap;margin-top:3px}'
    + '.cca-btn{font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.44rem;letter-spacing:.16em;text-transform:uppercase;'
    + 'padding:8px 12px;border:1px solid rgba(26,22,16,.25);background:none;color:#1a1610;cursor:pointer;text-decoration:none;'
    + 'display:inline-block;transition:background .25s,color .25s}'
    + '.cca-btn:hover{background:#1a1610;color:#f2e8d0}'
    + '.cca-btn.pieno{background:#c4922a;border-color:#c4922a;color:#1a1610}'
    + '.cca-btn.pieno:hover{background:#d8a63c;color:#1a1610}'
    + '.cca-btn[disabled]{opacity:.45;cursor:default;background:none;color:#1a1610}'
    + '.cca-mail{align-self:flex-start;width:100%;padding:14px;background:#f2e8d0;border-left:2px solid #c4922a}'
    + '.cca-mail-k{font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.42rem;letter-spacing:.2em;text-transform:uppercase;color:#8a6a1f;margin-bottom:7px}'
    + '.cca-mail-o{font-family:var(--ff-display,"Cormorant SC",serif);font-size:.95rem;margin-bottom:6px}'
    /* articoli con foto dentro la bozza: ci sono sempre, non dipendono
       dal fatto che il modello abbia mostrato le schede prima */
    + '.cca-mail-art{display:flex;flex-direction:column;gap:8px;margin:10px 0 12px}'
    + '.cca-mail-riga{display:flex;align-items:center;gap:10px}'
    + '.cca-mail-riga img{width:38px;height:38px;object-fit:cover;flex:0 0 auto;background:#efe7d7;border:1px solid rgba(26,22,16,.12)}'
    + '.cca-mail-riga-n{font-family:var(--ff-serif,"Cormorant",serif);font-size:.9rem;color:#1a1610;flex:1;min-width:0;line-height:1.35}'
    + '.cca-mail-riga-q{font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.5rem;letter-spacing:.1em;color:#8a6a1f;white-space:nowrap}'
    + '.cca-mail-c{font-family:var(--ff-serif,"Cormorant",serif);font-size:.86rem;line-height:1.55;color:#5f574a;white-space:pre-wrap;'
    + 'max-height:190px;overflow:auto;margin-bottom:10px}'
    + '.cca-spunti{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start}'
    + '.cca-punt{width:5px;height:5px;background:#9a8f7c;border-radius:50%;display:inline-block;margin-right:4px;animation:ccaP 1.2s infinite}'
    + '.cca-punt:nth-child(2){animation-delay:.15s}.cca-punt:nth-child(3){animation-delay:.3s}'
    + '@keyframes ccaP{0%,60%,100%{opacity:.25}30%{opacity:1}}'

    /* ── percorso guidato ──────────────────────────────────────
       Il piede con la casella di scrittura resta chiuso finche' il
       percorso non ha fatto qualche passo: la classe .cca-libero lo
       apre. Chi ha una richiesta normale non lo vede mai. */
    + '.cca-foot{flex:0 0 auto;display:none;gap:9px;padding:13px;border-top:1px solid rgba(26,22,16,.1);background:#faf7f1}'
    + '.cca-panel.cca-libero .cca-foot{display:flex}'
    + '.cca-q{font-family:var(--ff-serif,"Cormorant",serif);font-size:1.02rem;color:#1a1610}'
    + '.cca-scelte{display:flex;flex-direction:column;gap:6px;align-self:stretch;margin:2px 0 4px}'
    /* a griglia quando le voci hanno una foto: si scelgono con l\'occhio */
    + '.cca-scelte-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(148px,1fr));gap:6px}'
    + '.cca-scelte-q{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}'
    + '.cca-scelta{display:flex;align-items:center;gap:10px;text-align:left;width:100%;cursor:pointer;'
    + 'background:#fff;border:1px solid rgba(26,22,16,.14);padding:10px 12px;color:#1a1610;'
    + 'transition:border-color .2s,background .2s}'
    + '.cca-scelta:hover{border-color:#c4922a;background:#fffdf8}'
    /* molti prodotti sono bianchi fotografati su fondo bianco: senza una
       cornice, a 42 pixel sembrano riquadri vuoti */
    + '.cca-scelta img{flex:0 0 auto;width:42px;height:52px;object-fit:cover;background:#f3efe7;'
    + 'border:1px solid rgba(26,22,16,.09)}'
    + '.cca-scelta-t{display:flex;flex-direction:column;gap:2px;min-width:0}'
    + '.cca-scelta strong{font-family:var(--ff-serif,"Cormorant",serif);font-size:.98rem;font-weight:500;line-height:1.25}'
    + '.cca-scelta em{font-family:var(--ff-sans,"Montserrat",sans-serif);font-style:normal;font-size:.4rem;'
    + 'letter-spacing:.12em;text-transform:uppercase;color:#8a8073;line-height:1.6;overflow:hidden}'
    + '.cca-scelta-q{justify-content:center;font-family:var(--ff-sans,"Montserrat",sans-serif);'
    + 'font-size:.62rem;letter-spacing:.1em;padding:13px 6px}'
    + '.cca-qta-altro{grid-column:1/-1;display:flex;gap:6px;margin-top:2px}'
    + '.cca-qta-altro input{flex:1;min-width:0;border:1px solid rgba(26,22,16,.14);background:#fff;padding:11px 12px;'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.56rem;letter-spacing:.1em;color:#1a1610}'
    + '.cca-qta-altro input:focus{outline:none;border-color:#c4922a}'
    + '.cca-qta-altro button{flex:0 0 auto;border:none;background:#1a1610;color:#fff;cursor:pointer;padding:0 16px;font-size:.8rem}'
    + '.cca-indietro{align-self:flex-start;background:none;border:none;cursor:pointer;padding:6px 0;margin-top:2px;'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.4rem;letter-spacing:.14em;'
    + 'text-transform:uppercase;color:#8a8073;text-decoration:underline;text-underline-offset:3px}'
    + '.cca-indietro:hover{color:#1a1610}'
    + '.cca-sblocco{align-self:stretch;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;'
    + 'margin:10px 0 2px;padding-top:11px;border-top:1px solid rgba(26,22,16,.1)}'
    + '.cca-sblocco span{font-family:var(--ff-serif,"Cormorant",serif);font-size:.9rem;color:#8a8073}'
    + '.cca-sblocco-b{background:none;border:none;cursor:pointer;padding:0;'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.42rem;letter-spacing:.14em;'
    + 'text-transform:uppercase;color:#c4922a;text-decoration:underline;text-underline-offset:3px}'
    + '.cca-sblocco-b:hover{color:#1a1610}'
    + '.cca-in{flex:1;border:1px solid rgba(26,22,16,.2);background:#fff;padding:11px 13px;resize:none;max-height:110px;'
    + 'font-family:var(--ff-serif,"Cormorant",serif);font-size:.98rem;line-height:1.5;color:#1a1610}'
    + '.cca-in:focus{outline:none;border-color:#c4922a}'
    + '.cca-send{flex:0 0 auto;border:none;background:#c4922a;color:#1a1610;cursor:pointer;padding:0 16px;'
    + 'font-family:var(--ff-sans,"Montserrat",sans-serif);font-size:.44rem;letter-spacing:.16em;text-transform:uppercase}'
    + '.cca-send:hover{background:#d8a63c}.cca-send[disabled]{opacity:.4;cursor:default}'
    + '@media(max-width:620px){.cca-panel{right:0;bottom:0;width:100vw;max-width:100vw;height:100dvh}'
    + '.cca-fab{right:14px;bottom:14px;padding:12px 16px}}'
    + '@media(prefers-reduced-motion:reduce){.cca-panel,.cca-fab{transition:none}.cca-punt{animation:none}}';

  var st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);

  /* ── impalcatura ───────────────────────────────────────────── */
  var fab = document.createElement('button');
  fab.className = 'cca-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', t.apri);
  fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.6 9.6 0 0 1-2.9-.4L3 21l1.6-4.6A8.2 8.2 0 0 1 3.6 11.5 8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4Z"/></svg>'
    + '<span>' + t.apri + '</span>';

  var panel = document.createElement('div');
  panel.className = 'cca-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', t.titolo + ' ' + t.sottotitolo);
  panel.innerHTML =
      '<div class="cca-head">'
    +   '<div class="cca-head-txt"><div class="cca-head-k">' + t.titolo + '</div><div class="cca-head-n">' + t.sottotitolo + '</div></div>'
    +   '<button class="cca-x" type="button" aria-label="' + t.chiudi + '">&#10005;</button>'
    + '</div>'
    + '<div class="cca-avviso">' + t.avviso + (PRIVACY ? ' <a href="' + PRIVACY + '" target="_blank" rel="noopener">' + t.privacy + '</a>.' : '') + '</div>'
    + '<div class="cca-body" aria-live="polite"></div>'
    + '<div class="cca-foot">'
    +   '<textarea class="cca-in" rows="1" placeholder="' + t.placeholder + '" aria-label="' + t.placeholder + '"></textarea>'
    +   '<button class="cca-send" type="button">' + t.invia + '</button>'
    + '</div>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body  = panel.querySelector('.cca-body');
  var input = panel.querySelector('.cca-in');
  var send  = panel.querySelector('.cca-send');

  /* ── stato ─────────────────────────────────────────────────── */
  var storico = [];
  var occupato = false;

  /* ── memoria della conversazione ────────────────────────────
     Il sito naviga a pagina piena: senza questo, cliccare "Vedi la scheda"
     su un prodotto chiudeva la chat e buttava via tutto il discorso.
     Registro cosa e' stato mostrato (non solo il testo: anche le schede
     prodotto e le bozze) e lo ricostruisco alla pagina dopo.
     sessionStorage: dura quanto la scheda del browser, non oltre. */
  var CHIAVE_MEM = 'cc-chat';
  var registro = [];          /* [{k:'bot'|'me'|'prodotti'|'mail'|'errore', d:…}] */
  var eraAperta = false;

  function salva() {
    try {
      sessionStorage.setItem(CHIAVE_MEM, JSON.stringify({
        aperta: eraAperta, registro: registro.slice(-60), storico: storico.slice(-40), ts: Date.now()
      }));
    } catch (e) { /* storage pieno o disabilitato: si perde la memoria, non la chat */ }
  }

  function leggiMemoria() {
    try {
      var raw = sessionStorage.getItem(CHIAVE_MEM);
      if (!raw) return null;
      var m = JSON.parse(raw);
      if (!m || !Array.isArray(m.registro)) return null;
      return m;
    } catch (e) { return null; }
  }
  var sessione = (function () {
    try {
      var s = sessionStorage.getItem('cc-assist-id');
      if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem('cc-assist-id', s); }
      return s;
    } catch (e) { return 'anon'; }
  })();

  /* ── utilita' di disegno ───────────────────────────────────── */
  function giu() { body.scrollTop = body.scrollHeight; }

  var inRicostruzione = false;

  function bolla(classe, testo) {
    var d = document.createElement('div');
    d.className = 'cca-msg ' + classe;
    d.textContent = testo || '';
    body.appendChild(d); giu();
    if (!inRicostruzione) { registro.push({ k: classe === 'me' ? 'me' : 'bot', d: testo || '' }); salva(); }
    return d;
  }

  function spunti() {
    var w = document.createElement('div');
    w.className = 'cca-spunti';
    t.spunti.forEach(function (s) {
      var b = document.createElement('button');
      b.className = 'cca-btn'; b.type = 'button'; b.textContent = s;
      b.addEventListener('click', function () { w.remove(); manda(s); });
      w.appendChild(b);
    });
    body.appendChild(w); giu();
  }


  /* ══════════════════════════════════════════════════════════════
     PERCORSO GUIDATO — domande a pulsanti, costo zero
     ──────────────────────────────────────────────────────────────
     Ogni passo e' una domanda con delle risposte gia' pronte: non
     tocca l'API, quindi non costa nulla e risponde all'istante.
     Le domande non sono scritte a mano — nascono dal catalogo
     (percorso.json, rigenerato da genera-percorso.mjs), cosi'
     coprono tutti i prodotti e non si scollano quando ne aggiungi.

     Si va dal macro allo specifico: linea → famiglia → prodotto →
     colore → misura → profumazione → quantita' → cadenza → bozza.

     La scrittura libera — che invece costa — resta chiusa finche'
     il percorso non ha fatto qualche passo: chi ha una richiesta
     normale non ne ha bisogno, e chi ce l'ha strana la trova li'
     quando serve davvero.
     ══════════════════════════════════════════════════════════════ */

  var PASSI_PRIMA_DEL_TESTO = 3;
  var CHIAVE_PERC = 'cc-percorso';
  var percorso = null;               /* i dati, caricati una volta sola */
  var passiFatti = 0;
  var scelte = {};                   /* linea, famiglia, prodotto, colore, misura, profumo, qta, cadenza */
  var testoSbloccato = false;

  var TP = {
    it: {
      apertura: 'Le faccio qualche domanda: in tre o quattro passaggi le preparo la richiesta.',
      dove: 'Da dove cominciamo?',
      macro: [
        ['home', 'Per la casa, il negozio o l’hotel'],
        ['garden', 'Per il giardino o il dehors'],
        ['liturgico', 'Per la chiesa o la parrocchia'],
        ['private', 'Con il vostro marchio'],
        ['collab', 'Un progetto su misura'],
        ['info', 'Ho solo una domanda'],
      ],
      famiglia: 'Che tipo di prodotto?',
      prodotto: 'Quale in particolare?',
      colore: 'Che colore?',
      misura: 'Che misura?',
      gruppo: 'Che tipo di profumazione preferisce?',
      profumo: 'Quale di queste?',
      quantita: 'Quanti pezzi le servono?',
      quantitaAltro: 'Un’altra quantità',
      cadenza: 'Le serve una volta sola o con regolarità?',
      cadenze: [
        ['una-tantum', 'Una volta sola'],
        ['mensile', 'Ogni mese'],
        ['trimestrale', 'Ogni due o tre mesi'],
        ['stagionale', 'Solo in certi periodi dell’anno'],
      ],
      fine: 'Ecco fatto. Ho messo tutto in Selezione.',
      ancora: 'Aggiungo un altro prodotto',
      chiudi: 'Prepara la richiesta',
      indietro: 'Torna indietro',
      liberoInvito: 'La sua richiesta è particolare?',
      libero: 'Scrivimi liberamente',
      infoTit: 'Su cosa?',
      salta: 'Nessuna in particolare',
      nonSo: 'Non saprei, mi consigli lei',
    },
    en: {
      apertura: 'Let me ask you a few questions: in three or four steps I will prepare your enquiry.',
      dove: 'Where shall we start?',
      macro: [
        ['home', 'For the home, shop or hotel'],
        ['garden', 'For the garden or terrace'],
        ['liturgico', 'For a church or parish'],
        ['private', 'With your own brand'],
        ['collab', 'A bespoke project'],
        ['info', 'I just have a question'],
      ],
      famiglia: 'What kind of product?',
      prodotto: 'Which one in particular?',
      colore: 'Which colour?',
      misura: 'Which size?',
      gruppo: 'What kind of fragrance do you prefer?',
      profumo: 'Which of these?',
      quantita: 'How many pieces do you need?',
      quantitaAltro: 'A different quantity',
      cadenza: 'Do you need it once, or regularly?',
      cadenze: [
        ['una-tantum', 'Just once'],
        ['mensile', 'Every month'],
        ['trimestrale', 'Every two or three months'],
        ['stagionale', 'Only at certain times of year'],
      ],
      fine: 'All done. I have added everything to your Selection.',
      ancora: 'Add another product',
      chiudi: 'Prepare the enquiry',
      indietro: 'Go back',
      liberoInvito: 'Is your request unusual?',
      libero: 'Write to me freely',
      infoTit: 'About what?',
      salta: 'No preference',
      nonSo: 'I am not sure, please advise',
    },
  };
  function tp() { return TP[lang()]; }

  /* L'etichetta segue la lingua, il VALORE resta sempre quello italiano:
     e' la chiave con cui ritrovo la voce nel catalogo e il nome che
     leggera' chi in cereria deve preparare la merce. Tradurre anche
     quello vorrebbe dire mandare in produzione un ordine scritto in una
     lingua che li' non si usa. */
  function et(oggetto, campo) {
    if (lang() === 'en') {
      var e = oggetto[campo + '_en'];
      if (e) return e;
    }
    return oggetto[campo] || '';
  }
  function etLista(oggetto, campo, i) {
    if (lang() === 'en') {
      var e = oggetto[campo + '_en'];
      if (e && e[i]) return e[i];
    }
    return (oggetto[campo] || [])[i] || '';
  }

  /* ── il percorso deve sopravvivere al cambio pagina ───────────
     La conversazione viene gia' rimessa a schermo, ma le domande
     tornavano senza i loro pulsanti: si restava davanti a una
     domanda a cui non si poteva piu' rispondere. Qui tengo da parte
     a che punto si era e cosa si era scelto, e al ritorno ridisegno
     quel passo. Le funzioni sono registrate per nome, cosi' quello
     che salvo e' una parola e non una chiusura. */
  var passoCorrente = null;
  var PASSI = {};
  /* Ogni giro del percorso aggiunge un paragrafo, non riscrive la bozza:
     chi chiede prima un Private Label e poi delle citronelle deve
     ritrovarsele tutte e due nel messaggio. */
  var CHIAVE_PEZZI = 'cc-pezzi';
  var pezziBozza = (function () {
    /* I pezzi vivono oltre il singolo giro: chi torna dall'assistente per
       aggiungere un secondo prodotto deve ritrovare nel modulo anche il
       primo. Si azzerano solo quando la richiesta viene inviata. */
    try { return JSON.parse(sessionStorage.getItem(CHIAVE_PEZZI) || '[]') || []; }
    catch (e) { return []; }
  })();

  var giaScritti = (function () {
    try { return parseInt(sessionStorage.getItem('cc-pezzi-scritti'), 10) || 0; }
    catch (e) { return 0; }
  })();

  function salvaPezzi() {
    try { sessionStorage.setItem('cc-pezzi-scritti', String(giaScritti)); } catch (e) {}
    try { sessionStorage.setItem(CHIAVE_PEZZI, JSON.stringify(pezziBozza)); } catch (e) {}
  }

  function segna(nome, fn) { PASSI[nome] = fn; return function () { passoCorrente = nome; salvaPercorso(); return fn.apply(null, arguments); }; }

  function salvaPercorso() {
    try {
      sessionStorage.setItem(CHIAVE_PERC, JSON.stringify({
        passo: passoCorrente, scelte: scelte, passiFatti: passiFatti,
        pezzi: pezziBozza, sbloccato: testoSbloccato, ts: Date.now(),
      }));
    } catch (e) {}
  }

  function riprendiPercorso() {
    var st;
    try { st = JSON.parse(sessionStorage.getItem(CHIAVE_PERC) || 'null'); } catch (e) { return false; }
    if (!st || !st.passo || !PASSI[st.passo]) return false;
    if (st.ts && Date.now() - st.ts > 2 * 60 * 60 * 1000) return false;
    scelte = st.scelte || {};
    passiFatti = st.passiFatti || 0;
    pezziBozza = st.pezzi || [];
    if (st.sbloccato) { testoSbloccato = true; panel.classList.add('cca-libero'); }
    passoCorrente = st.passo;
    conPercorso(function () { PASSI[st.passo](); }, function () {
      testoSbloccato = true; panel.classList.add('cca-libero');
    });
    return true;
  }

  /* Le informazioni che possiamo dare per certe. Tutto cio' che non e'
     scritto qui non compare: una risposta che nessuno ha approvato non
     deve poter uscire da un pulsante piu' di quanto possa uscire dal
     modello. Le voci mancanti mandano a un contatto umano. */
  var INFO = {
    it: [
      ['dove', 'Dove siete?', 'Siamo in Via Damiano Chiesa 84, 20026 Novate Milanese (MI).'],
      ['orari', 'Che orari fate?', 'Lunedi’ – Venerdi’: 8:30 – 12:30 e 14:00 – 18:00. Il sabato su appuntamento.'],
      ['telefono', 'Come vi chiamo?', 'Al numero 02.35.43.707, oppure ci scriva a info@cerariacicogna.com.'],
      ['linee', 'Che cosa producete?', 'Tre linee: Home Collection per la casa e la ristorazione, Linea Garden per gli esterni, Articoli Liturgici per chiese e cimiteri. In piu’ facciamo Private Label — candele con il marchio del cliente — e progetti su misura con stampi dedicati.'],
      ['profumi', 'Che profumazioni avete?', ''],   /* riempito dal catalogo */
      ['prezzi', 'Quanto costano?', 'Sul sito non ci sono prezzi: ogni richiesta si chiude con un preventivo scritto da noi, perche’ dipende da quantita’, personalizzazioni e tempi. Mi dica cosa le serve e le preparo la richiesta.'],
    ],
    en: [
      ['dove', 'Where are you?', 'We are at Via Damiano Chiesa 84, 20026 Novate Milanese (MI), Italy.'],
      ['orari', 'What are your hours?', 'Monday to Friday: 8:30 – 12:30 and 14:00 – 18:00. Saturdays by appointment.'],
      ['telefono', 'How do I call you?', 'On +39 02.35.43.707, or write to info@cerariacicogna.com.'],
      ['linee', 'What do you make?', 'Three lines: Home Collection for the home and hospitality, Garden Line for outdoors, and Liturgical Articles for churches and cemeteries. We also do Private Label — candles under the client’s own brand — and bespoke projects with dedicated moulds.'],
      ['profumi', 'What fragrances do you have?', ''],
      ['prezzi', 'How much do they cost?', 'There are no prices on the site: every enquiry ends with a written quotation from us, because it depends on quantity, customisation and timing. Tell me what you need and I will prepare the enquiry.'],
    ],
  };

  /* ── i mattoni: una domanda, dei pulsanti ── */
  function domanda(testo) {
    var d = document.createElement('div');
    d.className = 'cca-msg bot cca-q';
    d.textContent = testo;
    body.appendChild(d); giu();
    return d;
  }

  /* voci = [[valore, etichetta, sottotitolo?, immagine?], ...] */
  function scelta(voci, alClick, opzioni) {
    opzioni = opzioni || {};
    var w = document.createElement('div');
    w.className = 'cca-scelte' + (opzioni.griglia ? ' cca-scelte-g' : '');

    voci.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'cca-scelta'; b.type = 'button';
      if (v[3]) {
        var im = document.createElement('img');
        im.src = v[3]; im.alt = ''; im.loading = 'lazy';
        im.onerror = function () { im.remove(); };
        b.appendChild(im);
      }
      var txt = document.createElement('span');
      txt.className = 'cca-scelta-t';
      txt.appendChild(Object.assign(document.createElement('strong'), { textContent: v[1] }));
      if (v[2]) txt.appendChild(Object.assign(document.createElement('em'), { textContent: v[2] }));
      b.appendChild(txt);
      b.addEventListener('click', function () {
        /* la scelta resta a schermo come risposta data, gli altri
           pulsanti spariscono: rileggendo la chat si capisce il percorso */
        bolla('me', v[1]);
        w.remove();
        passiFatti++;
        forseSblocca();
        alClick(v[0], v[1]);
      });
      w.appendChild(b);
    });

    if (opzioni.indietro) {
      var ind = document.createElement('button');
      ind.className = 'cca-indietro'; ind.type = 'button'; ind.textContent = tp().indietro;
      ind.addEventListener('click', function () { w.remove(); opzioni.indietro(); });
      w.appendChild(ind);
    }

    body.appendChild(w); giu();
    return w;
  }

  /* ── la scrittura libera si apre solo dopo qualche passo ── */
  function forseSblocca() {
    if (testoSbloccato || passiFatti < PASSI_PRIMA_DEL_TESTO) return;
    testoSbloccato = true;
    panel.classList.add('cca-libero');
    var w = document.createElement('div');
    w.className = 'cca-sblocco';
    w.innerHTML = '<span>' + tp().liberoInvito + '</span>';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cca-sblocco-b'; b.textContent = tp().libero;
    b.addEventListener('click', function () { w.remove(); input.focus(); });
    w.appendChild(b);
    body.appendChild(w); giu();
  }

  /* ── il ramo delle informazioni ── */
  var ramoInfo = segna('info', function () {
    var voci = INFO[lang()].map(function (v) { return [v[0], v[1]]; });
    domanda(tp().infoTit);
    scelta(voci, function (id) {
      var voce = INFO[lang()].find(function (v) { return v[0] === id; });
      var risposta = voce[2];
      if (id === 'profumi' && percorso) {
        risposta = (lang() === 'en' ? 'Twenty-two, divided into six families. ' : 'Ventidue, divise in sei famiglie. ')
          + percorso.gruppiProfumo.map(function (g) {
              var n = percorso.profumi.filter(function (p) { return p.gruppo === g.id; });
              return g[lang()] + ': ' + n.map(function (p) { return p.nome; }).join(', ');
            }).join('. ') + '.';
      }
      bolla('bot', risposta);
      domanda(tp().dove);
      scelta(tp().macro, vaiMacro);
    }, { indietro: inizio });
  });

  var NOME_LINEA = { home: 'Home Collection', garden: 'Linea Garden', liturgico: 'Articoli Liturgici' };

  function lineaDati(nome) {
    return percorso.linee.find(function (l) { return l.nome === nome; });
  }

  function vaiMacro(id) {
    scelte = {};
    if (id === 'info') return ramoInfo();
    if (id === 'private' || id === 'collab') return ramoProgetto(id);
    scelte.linea = NOME_LINEA[id];
    passoFamiglia();
  }

  /* ── 2. famiglia ── */
  var passoFamiglia = segna('famiglia', function () {
    var l = lineaDati(scelte.linea);
    if (!l) return inizio();
    if (l.famiglie.length === 1) { scelte.famiglia = l.famiglie[0].nome; return passoProdotto(); }
    domanda(tp().famiglia);
    scelta(l.famiglie.map(function (f) {
      var quanti = f.prodotti.length;
      return [f.nome, et(f, 'nome'), quanti > 1 ? quanti + (lang() === 'en' ? ' models' : ' modelli') : '',
              f.prodotti[0] && f.prodotti[0].immagine];
    }), function (v) { scelte.famiglia = v; passoProdotto(); }, { griglia: true, indietro: inizio });
  });

  /* ── 3. prodotto ── */
  var passoProdotto = segna('prodotto', function () {
    var l = lineaDati(scelte.linea);
    var f = l.famiglie.find(function (x) { return x.nome === scelte.famiglia; });
    if (!f) return passoFamiglia();
    if (f.prodotti.length === 1) { scelte.prodotto = f.prodotti[0]; return passoColore(); }
    domanda(tp().prodotto);
    scelta(f.prodotti.map(function (p) {
      return [p.nome, p.nome, et(p, 'descrizione').slice(0, 70), p.immagine];
    }), function (v) {
      scelte.prodotto = f.prodotti.find(function (p) { return p.nome === v; });
      passoColore();
    }, { griglia: true, indietro: passoFamiglia });
  });

  /* ── 4. colore ── */
  var passoColore = segna('colore', function () {
    var p = scelte.prodotto;
    if (!p.varianti || !p.varianti.length) return passoMisura();
    domanda(tp().colore);
    scelta(p.varianti.map(function (c, i) { return [c, etLista(p, 'varianti', i), '', fotoVariante(p, c, null)]; }),
      function (v) { scelte.colore = v; passoMisura(); },
      { griglia: true, indietro: passoProdotto });
  });

  /* ── 5. misura ── */
  var passoMisura = segna('misura', function () {
    var p = scelte.prodotto;
    if (!p.misure || !p.misure.length) return passoProfumo();
    domanda(tp().misura);
    scelta(p.misure.map(function (m, i) { return [m, etLista(p, 'misure', i)]; }),
      function (v) { scelte.misura = v; passoProfumo(); },
      { indietro: p.varianti && p.varianti.length ? passoColore : passoProdotto });
  });

  /* ── 6. profumazione, in due passi: prima la famiglia, poi il nome.
        Ventidue pulsanti tutti insieme non si guardano nemmeno. ── */
  var passoProfumo = segna('profumo', function () {
    var l = lineaDati(scelte.linea);
    if (!l.chiedeProfumo) return passoQuantita();
    domanda(tp().gruppo);
    var voci = percorso.gruppiProfumo
      .filter(function (g) { return percorso.profumi.some(function (p) { return p.gruppo === g.id; }); })
      .map(function (g) {
        var n = percorso.profumi.filter(function (p) { return p.gruppo === g.id; });
        return [g.id, g[lang()], n.map(function (p) { return p.nome; }).join(' · ')];
      });
    voci.push(['-', tp().nonSo]);
    scelta(voci, function (v) {
      if (v === '-') return passoQuantita();
      domanda(tp().profumo);
      var lista = percorso.profumi.filter(function (p) { return p.gruppo === v; })
        .map(function (p) { return [p.nome, p.nome, et(p, 'note').join ? et(p, 'note').join(' · ')
                                    : (p.note || []).join(' · '), p.immagine]; });
      scelta(lista, function (nome) {
        scelte.profumo = percorso.profumi.find(function (p) { return p.nome === nome; });
        passoQuantita();
      }, { griglia: true, indietro: passoProfumo });
    }, { indietro: scelte.misura ? passoMisura : passoColore });
  });

  /* ── 7. quantita' ── */
  var passoQuantita = segna('quantita', function () {
    domanda(tp().quantita);
    var w = document.createElement('div');
    w.className = 'cca-scelte cca-scelte-q';
    [6, 12, 24, 50, 100, 250].forEach(function (n) {
      var b = document.createElement('button');
      b.className = 'cca-scelta cca-scelta-q'; b.type = 'button'; b.textContent = n;
      b.addEventListener('click', function () {
        bolla('me', n + ' pz'); w.remove(); passiFatti++; forseSblocca();
        scelte.qta = n; passoCadenza();
      });
      w.appendChild(b);
    });
    /* Un campo per chi ha un numero suo. Stesso tetto del modulo: sopra
       i mille non e' un errore, e' una fornitura da concordare. */
    var f = document.createElement('form');
    f.className = 'cca-qta-altro';
    f.innerHTML = '<input type="text" inputmode="numeric" maxlength="5" placeholder="' + tp().quantitaAltro + '">'
                + '<button type="submit">&rarr;</button>';
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt(f.querySelector('input').value.replace(/[^0-9]/g, ''), 10);
      if (!(n > 0)) return;
      scelte.oltre = n > 1000;
      scelte.qta = scelte.oltre ? 1000 : n;
      bolla('me', scelte.oltre ? (lang() === 'en' ? 'over 1000 pcs' : 'oltre 1000 pz') : n + ' pz');
      w.remove(); passiFatti++; forseSblocca(); passoCadenza();
    });
    w.appendChild(f);
    body.appendChild(w); giu();
  });

  /* ── 8. cadenza ── */
  var passoCadenza = segna('cadenza', function () {
    domanda(tp().cadenza);
    scelta(tp().cadenze, function (v, etichetta) {
      scelte.cadenza = { tipo: v, descrizione: etichetta };
      concludi();
    }, { indietro: passoQuantita });
  });

  /* ── 9. in Selezione, poi la bozza ── */
  function concludi() {
    var p = scelte.prodotto;
    /* "Sand" e' il nome a catalogo e resta com'e'; colore e misura invece
       li aggiungo io, e chi legge il sito in inglese deve leggerli in
       inglese. In cereria arriva comunque la foto della variante esatta
       accanto alla riga, quindi non c'e' modo di sbagliare a prendere. */
    var iColore = (p.varianti || []).indexOf(scelte.colore);
    var iMisura = (p.misure || []).indexOf(scelte.misura);
    var nome = [
      p.nome,
      iColore >= 0 ? etLista(p, 'varianti', iColore) : scelte.colore,
      iMisura >= 0 ? etLista(p, 'misure', iMisura) : scelte.misura,
    ].filter(Boolean).join(' · ');
    scelte.nomeComposto = nome;      /* serve al paragrafo: e' il prodotto di QUESTO giro */

    if (window.CCSel) {
      window.CCSel.aggiungiProdotto({
        name: nome,
        img: fotoVariante(p, scelte.colore, scelte.misura) || p.immagine,
        imgProfumo: scelte.profumo ? scelte.profumo.immagine : '',
        qta: scelte.qta || 0,
        oltre: !!scelte.oltre,
        cat: p.categoria || '',
        url: p.pagina || '',
      });
    }
    if (scelte.cadenza) {
      try { sessionStorage.setItem('cc-fornitura', JSON.stringify(scelte.cadenza)); } catch (e) {}
    }

    pezziBozza.push(paragrafoProdotto());
    salvaPezzi();
    fineGiro(tp().fine);
  }

  /* ══ il messaggio gia' scritto ═══════════════════════════════
     Non e' generato dal modello: e' un modello di testo in cui
     cambiano solo le parti che dipendono da cosa e' stato scelto —
     la linea, la cadenza, l'eventuale quantita' da concordare.
     Costo zero e sempre la stessa forma, che per una richiesta
     commerciale e' un pregio: si legge in fretta perche' e' sempre
     fatta uguale.

     Gli articoli NON si ricopiano nel testo: la pagina Contatti li
     allega gia' come schede con le foto, e finirebbero due volte. */
  function paragrafoProdotto() {
    var en = lang() === 'en';
    /* Il nome e' quello scelto in questo giro, non "l'unico in Selezione":
       dal secondo prodotto in poi la Selezione ne contiene piu' d'uno e il
       paragrafo finiva a dire "gli articoli in elenco" invece di nominarlo. */
    var uno = scelte.nomeComposto || '';

    /* Il primo paragrafo si presenta, quelli dopo si agganciano con
       "Inoltre": senza, la richiesta sembrava tre lettere diverse
       incollate una sotto l'altra, ognuna che ricominciava da capo. */
    var seguito = pezziBozza.length > 0;

    var APERTURA = {
      'Home Collection': en
        ? (seguito ? 'In addition, still for the Home Collection:'
                   : 'I am writing about your Home Collection candles.')
        : (seguito ? 'Inoltre, sempre per la Home Collection:'
                   : 'Vi scrivo a proposito delle vostre candele Home Collection.'),
      'Linea Garden': en
        ? (seguito ? 'In addition, for the Garden line:'
                   : 'I am writing about your Garden line, for outdoor use.')
        : (seguito ? 'Inoltre, per la Linea Garden:'
                   : 'Vi scrivo a proposito della Linea Garden, per esterni.'),
      'Articoli Liturgici': en
        ? (seguito ? 'In addition, for the liturgical articles:'
                   : 'I am writing about your liturgical articles.')
        : (seguito ? 'Inoltre, per gli articoli liturgici:'
                   : 'Vi scrivo a proposito dei vostri articoli liturgici.'),
    };

    var CADENZA = {
      'una-tantum':  en ? 'It is a one-off order.' : 'Si tratta di una fornitura una tantum.',
      'mensile':     en ? 'I would need this supply every month, on a regular basis.'
                        : 'Mi servirebbe questa fornitura ogni mese, con regolarità.',
      'trimestrale': en ? 'I would need this supply every two or three months.'
                        : 'Mi servirebbe questa fornitura ogni due o tre mesi.',
      'stagionale':  en ? 'I need it only at certain times of the year.'
                        : 'Mi serve solo in certi periodi dell’anno.',
    };

    var righe = [];
    var apre = APERTURA[scelte.linea] || (seguito
      ? (en ? 'In addition:' : 'Inoltre:')
      : (en ? 'I am writing about your candles.' : 'Vi scrivo a proposito delle vostre candele.'));

    /* dopo i due punti la frase prosegue in minuscolo */
    var chiede = uno
      ? (seguito
          ? (en ? 'I would also like a quotation for ' : 'vorrei un preventivo anche per ')
          : (en ? 'I would like a quotation for ' : 'Vorrei un preventivo per ')) + uno + '.'
      : (seguito
          ? (en ? 'I would also like a quotation for the items listed below.'
                : 'vorrei un preventivo anche per gli articoli in elenco.')
          : (en ? 'I would like a quotation for the items listed below.'
                : 'Vorrei un preventivo per gli articoli in elenco.'));

    righe.push(apre + ' ' + chiede);

    if (scelte.cadenza && CADENZA[scelte.cadenza.tipo]) righe.push(CADENZA[scelte.cadenza.tipo]);

    /* Sopra il tetto il numero nel modulo dice 1000: il vero valore
       deve stare scritto qui, altrimenti si perde. */
    if (scelte.oltre) {
      righe.push(en
        ? 'Please note the quantity is above 1000 pieces: I would like to agree the exact figure with you.'
        : 'La quantità è superiore ai 1000 pezzi: vorrei concordare con voi il numero esatto.');
    }

    if (scelte.profumo) {
      var note = (en && scelte.profumo.note_en && scelte.profumo.note_en.length)
        ? scelte.profumo.note_en : (scelte.profumo.note || []);
      righe.push((en ? 'Fragrance chosen: ' : 'Profumazione scelta: ') + scelte.profumo.nome
        + (note.length ? ' (' + note.join(', ') + ')' : '') + '.');
    }

    return {
      motivo: { 'Home Collection': 'home-collection', 'Linea Garden': 'garden',
                'Articoli Liturgici': 'liturgico' }[scelte.linea] || '',
      testo: righe.join('\n\n'),
    };
  }

  /* L'unica uscita verso il modulo. Saluto e congedo si scrivono una
     volta sola; in mezzo vanno tutti i pezzi raccolti, che si tratti di
     prodotti a catalogo o di un progetto Private Label. */
  function vaiAlModulo() {
    var en = lang() === 'en';
    var corpi = pezziBozza.map(function (p) { return p.testo; }).filter(Boolean);
    var primo = pezziBozza.find(function (p) { return p.motivo; });
    var saluto = en ? 'Good morning,' : 'Buongiorno,';
    var congedo = en
      ? 'Could you send me a written quotation with prices and lead times? Thank you.'
      : 'Potete mandarmi un preventivo scritto con prezzi e tempi di consegna? Grazie.';

    /* I pezzi aggiunti in QUESTA tornata: servono al modulo per accodarli
       quando la persona ha gia' messo mano al testo a mano. Dal secondo
       prodotto in poi sono solo un'aggiunta — niente saluto, niente
       congedo, che nel messaggio devono restare uno per parte. */
    var nuoviDaQui = corpi.slice(giaScritti);

    try {
      sessionStorage.setItem('cc-bozza', JSON.stringify({
        ts: Date.now(),
        motivo: primo ? primo.motivo : '',
        oggetto: '',
        corpo: saluto + '\n\n' + corpi.join('\n\n') + '\n\n' + congedo,
        aggiunta: nuoviDaQui.join('\n\n'),
        congedo: congedo,
      }));
      sessionStorage.removeItem(CHIAVE_PERC);
    } catch (e) {}
    giaScritti = corpi.length;
    salvaPezzi();
    location.href = 'contatti.html';
  }

  /* Le due fini del percorso — prodotto a catalogo e progetto — offrono
     le stesse due strade: se ne aggiunge un altro, oppure si chiude. */
  /* Anche la fine e' un passo, e va registrata come gli altri: chiudendo
     e riaprendo la chat tornava il "Ecco fatto" senza i due pulsanti, e da
     li' non si poteva ne' aggiungere altro ne' andare al modulo. */
  var fineScelte = segna('fine', function () {
    scelta([['ancora', tp().ancora], ['chiudi', tp().chiudi]], function (v) {
      if (v === 'ancora') { scelte = {}; return inizio(); }
      vaiAlModulo();
    });
  });

  function fineGiro(testoFine) {
    bolla('bot', testoFine);
    fineScelte();
  }

  /* La foto giusta della variante: il catalogo indicizza i file per
     parole, cosi' "sand marrone piccolo" trova il suo e non il bianco. */
  function fotoVariante(p, colore, misura) {
    var vi = p.varianti_immagini || [];
    if (!vi.length) return p.immagine || '';
    var cercate = [colore, misura].filter(Boolean).map(function (s) { return String(s).toLowerCase(); });
    if (!cercate.length) return p.immagine || '';
    var migliore = null, punti = -1;
    vi.forEach(function (v) {
      var n = cercate.filter(function (c) {
        return (v.parole || []).some(function (w) { return String(w).toLowerCase() === c; });
      }).length;
      if (n > punti) { punti = n; migliore = v; }
    });
    return (punti > 0 && migliore) ? migliore.file : (p.immagine || '');
  }

  /* ── Private Label e Collaborazioni: qui non c'e' un catalogo da
        percorrere, ci sono le tre cose che servono per richiamare. ── */
  function ramoProgetto(id) {
    var en = lang() === 'en';
    var T = en ? {
      q1: 'What do you have in mind?',
      opz: [['etichetta', 'Candles with my logo on the label'],
            ['fragranza', 'My own fragrance'],
            ['forma', 'A dedicated shape or mould'],
            ['tutto', 'The whole thing, from scratch']],
      q2: 'Roughly how many pieces?',
      q3: 'When do you need them?',
      tempi: [['subito', 'As soon as possible'], ['mesi', 'Within a few months'],
              ['anno', 'It is for next year'], ['aperto', 'No fixed date yet']],
      fine: 'Perfect. I have noted it down: our team will get back to you with a written quotation.',
    } : {
      q1: 'Che cosa ha in mente?',
      opz: [['etichetta', 'Candele con il mio logo sull’etichetta'],
            ['fragranza', 'Una fragranza mia'],
            ['forma', 'Una forma o uno stampo dedicato'],
            ['tutto', 'Tutto quanto, da zero']],
      q2: 'Piu’ o meno quanti pezzi?',
      q3: 'Per quando le servono?',
      tempi: [['subito', 'Il prima possibile'], ['mesi', 'Entro qualche mese'],
              ['anno', 'E’ per l’anno prossimo'], ['aperto', 'Non ho ancora una data']],
      fine: 'Perfetto. Ho preso nota: i nostri collaboratori le risponderanno con un preventivo scritto.',
    };
    var raccolto = { tipo: id === 'private' ? 'Private Label' : 'Collaborazione' };

    domanda(T.q1);
    scelta(T.opz, function (v, et) {
      raccolto.cosa = et;
      domanda(T.q2);
      scelta([[100, '100'], [250, '250'], [500, '500'], [1000, '1000'], ['piu', en ? 'More' : 'Di piu’']],
        function (q, qe) {
          raccolto.quanti = qe;
          domanda(T.q3);
          scelta(T.tempi, function (t2, te) {
            raccolto.quando = te;
            /* Anche un progetto e' un pezzo della richiesta, non la fine
               della conversazione: si puo' aggiungere dell'altro dopo. */
            pezziBozza.push({
              motivo: id === 'private' ? 'private-label' : 'personalizzazione',
              /* "inoltre" solo se qualcosa e' gia' stato chiesto prima:
                 in apertura suonerebbe come la risposta a una domanda
                 che nessuno ha fatto */
              testo: (pezziBozza.length
                        ? (en ? 'I am also interested in ' : 'Sono inoltre interessato a ')
                        : (en ? 'I am interested in ' : 'Sono interessato a '))
                   + raccolto.tipo + '.\n'
                   + (en ? 'What I have in mind: ' : 'Cosa ho in mente: ') + raccolto.cosa + '\n'
                   + (en ? 'Approximate quantity: ' : 'Quantità indicativa: ') + raccolto.quanti + '\n'
                   + (en ? 'Timing: ' : 'Tempi: ') + raccolto.quando,
            });
            salvaPezzi();
            fineGiro(T.fine);
          }, { indietro: function () { ramoProgetto(id); } });
        }, { indietro: function () { ramoProgetto(id); } });
    }, { indietro: inizio });
  }

  /* ── avvio del percorso ── */
  var inizio = segna('inizio', function () {
    scelte = {};
    domanda(tp().dove);
    scelta(tp().macro, vaiMacro);
  });

  /* I dati si caricano una volta sola; chi ne ha bisogno passa di qui.
     Se non arrivano, il widget torna quello di prima — si scrive e basta —
     invece di restare muto. */
  function conPercorso(poi, seFallisce) {
    if (percorso) return poi();
    fetch(PERCORSO_URL, { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) throw new Error('percorso non disponibile');
        percorso = d;
        poi();
      })
      .catch(function () {
        if (seFallisce) seFallisce();
      });
  }

  function ripiego() {
    testoSbloccato = true;
    panel.classList.add('cca-libero');
    bolla('bot', t.benvenuto);
    spunti();
  }

  function avviaPercorso() {
    conPercorso(function () { bolla('bot', tp().apertura); inizio(); }, ripiego);
  }

  function schedaProdotto(p) {
    var c = document.createElement('div');
    c.className = 'cca-card';
    c.innerHTML =
        '<div class="cca-card-b">'
      +   '<div class="cca-card-k"></div><div class="cca-card-n"></div><div class="cca-card-p"></div>'
      +   '<div class="cca-card-r"></div>'
      + '</div>';

    /* la foto si mette per proprieta', non dentro l'HTML: i nomi dei file del
       sito contengono spazi e apostrofi. Se manca, la scheda resta di solo
       testo invece di mostrare l'icona di immagine rotta. */
    if (p.immagine) {
      var im = document.createElement('img');
      im.alt = ''; im.loading = 'lazy';
      im.onerror = function () { im.remove(); };
      im.src = p.immagine;
      c.insertBefore(im, c.firstChild);
    }
    c.querySelector('.cca-card-k').textContent = p.linea || '';
    c.querySelector('.cca-card-n').textContent = p.nome || '';
    c.querySelector('.cca-card-p').textContent = p.perche || p.descrizione || '';

    var riga = c.querySelector('.cca-card-r');

    var add = document.createElement('button');
    add.className = 'cca-btn pieno'; add.type = 'button'; add.textContent = t.aggiungi;
    add.addEventListener('click', function () {
      if (window.CCSel) {
        /* niente ref: CCSel usa ref come identita', e piu' prodotti condividono
           la stessa pagina (Sand, Rock, Nilla stanno tutti su home-collection.html),
           quindi con il ref uno sovrascriveva l'altro. Il nome invece e' univoco. */
        window.CCSel.aggiungiProdotto({ name: p.nome, ref: '', img: p.immagine, cat: p.categoria, url: p.pagina });
        if (window.CCSel.conferma) window.CCSel.conferma(t.aggiunto + ' — ' + p.nome);
      }
      add.textContent = t.aggiunto; add.disabled = true;
    });
    riga.appendChild(add);

    if (p.pagina) {
      var a = document.createElement('a');
      a.className = 'cca-btn'; a.href = p.pagina; a.textContent = t.vedi;
      riga.appendChild(a);
    }
    body.appendChild(c); giu();
    if (!inRicostruzione) { registro.push({ k: 'prodotto', d: p }); salva(); }
  }

  function schedaMail(ev) {
    var c = document.createElement('div');
    c.className = 'cca-mail';
    c.innerHTML = '<div class="cca-mail-k">' + t.bozza + '</div><div class="cca-mail-o"></div><div class="cca-mail-c"></div>';
    c.querySelector('.cca-mail-o').textContent = ev.oggetto || '';

    /* Gli articoli con la foto, dentro la bozza. Prima comparivano solo se il
       modello aveva chiamato mostra_prodotti, e capitava che aggiornasse la
       bozza senza rifarlo: la richiesta restava senza immagini. Qui invece
       arrivano dalla bozza stessa, quindi ci sono a ogni versione. */
    var articoli = (ev.fabbisogno && ev.fabbisogno.length)
      ? ev.fabbisogno
      : registro.filter(function (v) { return v.k === 'prodotto'; }).map(function (v) {
          return { nome: v.d.nome, immagine: v.d.immagine, pagina: v.d.pagina, formato: '' };
        });

    if (articoli.length) {
      var box = document.createElement('div');
      box.className = 'cca-mail-art';
      articoli.slice(0, 6).forEach(function (a) {
        var r = document.createElement('div');
        r.className = 'cca-mail-riga';
        [a.immagine, a.immagineProfumo].forEach(function (src) {
          if (!src) return;
          var im = document.createElement('img');
          im.alt = ''; im.loading = 'lazy';
          im.onerror = function () { im.remove(); };
          im.src = src;
          r.appendChild(im);
        });
        var nm = document.createElement('span');
        nm.className = 'cca-mail-riga-n';
        nm.textContent = a.nome + (a.formato ? ' · ' + a.formato : '');
        r.appendChild(nm);
        if (a.quantita) {
          var q = document.createElement('span');
          q.className = 'cca-mail-riga-q';
          q.textContent = '× ' + a.quantita;
          r.appendChild(q);
        }
        box.appendChild(r);
      });
      c.querySelector('.cca-mail-o').insertAdjacentElement('afterend', box);
    }

    var testoCorpo = c.querySelector('.cca-mail-c');
    var a = document.createElement('button');
    a.type = 'button';
    a.className = 'cca-btn pieno';
    a.textContent = t.apriMail;

    /* La bozza non resta ferma a com'era quando l'assistente l'ha scritta:
       se nel frattempo la persona aggiunge o toglie prodotti dalla Selezione,
       il corpo e il link si rifanno con l'elenco aggiornato. */
    function ricomponi() {
      var sel = '';
      try { if (window.CCSel && !window.CCSel.vuota()) sel = window.CCSel.toText(); } catch (e) {}

      var corpo;
      if (ev.corpoTesta !== undefined && ev.corpoCoda !== undefined) {
        corpo = ev.corpoTesta + (sel ? '\n\n' + sel : '') + '\n\n' + ev.corpoCoda;
      } else {
        corpo = ev.corpo || '';           /* bozza vecchia: la lascio com'e' */
      }

      /* In chat mostro sempre il messaggio intero. */
      testoCorpo.textContent = corpo;

      /* Nel link invece no: oltre ~2000 caratteri diversi programmi di posta
         troncano il corpo senza dirlo, e il destinatario riceve un messaggio
         tagliato a meta'. Se la Selezione e' lunga, nel link la accorcio e
         rimando alla Selezione del sito, che parte comunque dai Contatti. */
      /* Il messaggio non finisce piu' in un link mailto (che dipende dal programma
         di posta configurato, e che sopra i ~2000 caratteri veniva troncato in
         silenzio). Va invece nel modulo della pagina Contatti, dove la persona
         puo' rileggerlo, correggerlo e aggiungere i propri dati prima di inviare.
         Passa da sessionStorage e non dall'indirizzo: il testo puo' contenere
         dettagli della richiesta e non deve finire nella cronologia del browser. */
      a.onclick = function () {
        /* I prodotti citati nella bozza finiscono nella Selezione, cosi' la
           richiesta arriva con gli articoli allegati e non solo nominati nel
           testo. CCSel scarta da solo i doppioni se erano gia' stati aggiunti. */
        try {
          var daAggiungere = (ev.fabbisogno && ev.fabbisogno.length)
            ? ev.fabbisogno
            : registro.filter(function (v) { return v.k === 'prodotto'; }).map(function (v) { return v.d; });

          if (window.CCSel && daAggiungere.length) {
            daAggiungere.forEach(function (p) {
              if (!p || !p.nome) return;
              /* Lo stesso prodotto puo' comparire piu' volte con profumazioni
                 diverse (6 Sand Winter Tree + 6 Sand Bessa): il formato entra
                 nel nome, altrimenti l'identita' coincide e uno cancella l'altro. */
              var etichetta = p.nome + (p.formato ? ' · ' + String(p.formato).slice(0, 60) : '');
              window.CCSel.aggiungiProdotto({
                name: etichetta,
                ref:  '',                     /* vedi sopra: l'identita' e' il nome */
                img:  p.immagine || '',
                cat:  p.categoria || '',
                url:  p.pagina || '',
                qta:  p.quantita || 0,
                imgProfumo: p.immagineProfumo || ''
              });
            });
          }
        } catch (e) { /* la Selezione non e' indispensabile: la bozza parte comunque */ }

        try {
          sessionStorage.setItem('cc-bozza', JSON.stringify({
            oggetto: ev.oggetto || '',
            corpo:   (ev.corpoTesta !== undefined ? ev.corpoTesta : corpo)
                     + (ev.corpoCoda ? '\n\n' + ev.corpoCoda : ''),
            motivo:  ev.motivo || '',
            ts: Date.now()
          }));
          /* la cadenza viaggia a parte: la usa il modulo, non il testo */
          if (ev.fornitura) sessionStorage.setItem('cc-fornitura', JSON.stringify(ev.fornitura));
          else sessionStorage.removeItem('cc-fornitura');
        } catch (e) { /* storage pieno o disabilitato: si va comunque al modulo */ }

        /* Se siamo gia' sulla pagina Contatti, cambiare l'ancora non ricarica
           nulla e il modulo resterebbe com'era: qui lo si compila sul posto. */
        if (typeof window.ccApplicaBozza === 'function') {
          window.ccApplicaBozza();
          chiudi();
          return;
        }
        location.href = 'contatti.html#modulo';
      };

      function componi(testo) {
        return 'mailto:' + EMAIL
             + '?subject=' + encodeURIComponent(ev.oggetto || '')
             + '&body='    + encodeURIComponent(testo);
      }
    }

    ricomponi();
    window.addEventListener('ccsel:change', ricomponi);
    /* Selezione modificata in un'altra scheda del browser */
    window.addEventListener('storage', function (e) { if (e.key === 'cc-selezione') ricomponi(); });

    c.appendChild(a);
    body.appendChild(c); giu();
    if (!inRicostruzione) { registro.push({ k: 'mail', d: ev }); salva(); }
  }

  function schedaErrore(msg) {
    var c = document.createElement('div');
    c.className = 'cca-mail';
    c.innerHTML = '<div class="cca-mail-k">' + t.erroreTitolo + '</div><div class="cca-mail-c"></div>';
    c.querySelector('.cca-mail-c').textContent = msg;
    var a = document.createElement('a');
    a.className = 'cca-btn'; a.href = 'mailto:' + EMAIL; a.textContent = t.scrivici + ' ' + EMAIL;
    c.appendChild(a);
    body.appendChild(c); giu();
  }

  function attesa() {
    var d = document.createElement('div');
    d.className = 'cca-msg bot';
    d.setAttribute('aria-label', t.sta);
    d.innerHTML = '<span class="cca-punt"></span><span class="cca-punt"></span><span class="cca-punt"></span>';
    body.appendChild(d); giu();
    return d;
  }

  /* ── invio ─────────────────────────────────────────────────── */
  function selezioneCorrente() {
    try { return window.CCSel && !window.CCSel.vuota() ? window.CCSel.toText() : ''; }
    catch (e) { return ''; }
  }

  async function manda(testo) {
    if (occupato || !testo.trim()) return;
    occupato = true; send.disabled = true;

    /* gli spunti servono solo a rompere il ghiaccio: al primo messaggio spariscono,
       anche quando la persona ha scritto di suo invece di cliccarne uno */
    var sp = body.querySelector('.cca-spunti');
    if (sp) sp.remove();

    bolla('me', testo);
    storico.push({ role: 'user', content: testo });
    input.value = ''; input.style.height = 'auto';

    var puntini = attesa();
    var bollaBot = null;
    var risposta = '';

    var pezzo = '';                     /* testo della bolla in corso */
    function scrivi(delta) {
      if (!bollaBot) { if (puntini.parentNode) puntini.remove(); bollaBot = bolla('bot', ''); pezzo = ''; }
      pezzo += delta; risposta += delta;
      bollaBot.textContent = pezzo;
      /* la bolla cresce mentre arriva il testo: tengo allineata l'ultima voce */
      for (var i = registro.length - 1; i >= 0; i--) {
        if (registro[i].k === 'bot') { registro[i].d = pezzo; break; }
      }
      giu();
    }

    try {
      var r = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaggio: testo,
          storico: storico.slice(0, -1),
          sessione: sessione,
          selezione: selezioneCorrente(),
          lingua: lang()          /* la lingua scelta sul sito, non quella indovinata dal testo */
        })
      });

      if (r.status === 429) {
        var j = await r.json();
        puntini.remove(); schedaErrore(j.messaggio || '');
        occupato = false; send.disabled = false;
        return;
      }
      if (!r.ok || !r.body) throw new Error('HTTP ' + r.status);

      var lettore = r.body.getReader();
      var dec = new TextDecoder();
      var buf = '';

      while (true) {
        var blocco = await lettore.read();
        if (blocco.done) break;
        buf += dec.decode(blocco.value, { stream: true });
        var blocchi = buf.split('\n\n');
        buf = blocchi.pop();
        blocchi.forEach(function (b) {
          var riga = b.split('\n').find(function (x) { return x.indexOf('data: ') === 0; });
          if (!riga) return;
          var ev;
          try { ev = JSON.parse(riga.slice(6)); } catch (e) { return; }
          if (ev.type === 'testo') { scrivi(ev.delta); return; }
          /* schede e bozze chiudono la bolla in corso: il testo che segue
             deve comparire sotto di esse, non risalire sopra */
          if (puntini.parentNode) puntini.remove();
          bollaBot = null;
          if (ev.type === 'prodotti')        ev.prodotti.forEach(schedaProdotto);
          else if (ev.type === 'escalation') schedaMail(ev);
          else if (ev.type === 'errore')     schedaErrore(ev.messaggio);
        });
      }

      if (puntini.parentNode) puntini.remove();
      if (risposta) storico.push({ role: 'assistant', content: risposta });
      /* il testo arriva a pezzi e aggiorna la memoria senza salvarla ogni volta
         (sarebbero decine di scritture): la salvo qui, a risposta finita */
      salva();

    } catch (e) {
      if (puntini.parentNode) puntini.remove();
      salva();
      if (!risposta) schedaErrore(
        lang() === 'en'
          ? 'Connection problem. Please write to us directly.'
          : 'Problema di collegamento. Ci scriva pure direttamente.'
      );
    }

    occupato = false; send.disabled = false; input.focus();
  }

  /* ── interazioni ───────────────────────────────────────────── */
  var aperto = false;

  /* Rimette a schermo la conversazione della pagina precedente. */
  function ricostruisci(mem) {
    inRicostruzione = true;
    registro = mem.registro || [];
    storico  = mem.storico  || [];
    registro.forEach(function (v) {
      if (v.k === 'me' || v.k === 'bot') bolla(v.k === 'me' ? 'me' : 'bot', v.d);
      else if (v.k === 'prodotto')       schedaProdotto(v.d);
      else if (v.k === 'mail')           schedaMail(v.d);
    });
    inRicostruzione = false;
    /* La conversazione e' tornata a schermo: ora rimetto anche i pulsanti
       del passo in cui si era. Se non c'e' un passo da riprendere — percorso
       gia' concluso, o memoria scaduta — non si deve restare davanti a un
       muro: offro comunque una strada per continuare. */
    if (!riprendiPercorso()) viaLibera();
    giu();
  }

  /* L'ultima parola non e' mai "fine": si puo' sempre ricominciare, e la
     scrittura libera resta a disposizione perche' chi e' arrivato fin qui
     ha gia' fatto piu' dei tre passi che la sbloccano. */
  function viaLibera() {
    if (body.querySelector('.cca-scelte')) return;      /* c'e' gia' una scelta aperta */
    testoSbloccato = true;
    panel.classList.add('cca-libero');
    conPercorso(function () {
      scelta([['ancora', tp().ancora], ['chiudi', tp().chiudi]], function (v) {
        if (v === 'ancora') { scelte = {}; return inizio(); }
        vaiAlModulo();
      });
    }, function () {});
  }

  function apri(daMemoria) {
    aperto = true; eraAperta = true;
    panel.classList.add('on'); fab.classList.add('hide');
    /* un reflow forzato invece di requestAnimationFrame: rAF non parte se la
       scheda e' in secondo piano, e il pannello resterebbe invisibile */
    void panel.offsetHeight;
    panel.classList.add('in');
    if (!storico.length && !body.children.length) avviaPercorso();
    if (!daMemoria) salva();
    ripristinaPosizione();
    setTimeout(function () { input.focus(); }, 120);
  }
  function chiudi() {
    aperto = false; eraAperta = false; salva();
    panel.classList.remove('in');
    setTimeout(function () { panel.classList.remove('on'); fab.classList.remove('hide'); }, 260);
  }


  /* ── cambio lingua ──────────────────────────────────────────
     I testi del widget non stanno nel dizionario del sito (li tiene qui
     dentro), quindi al cambio lingua vanno riscritti a mano. I messaggi gia'
     scambiati restano come sono: sono la conversazione, non l'interfaccia. */
  function applicaLingua() {
    t = T[lang()];

    fab.setAttribute('aria-label', t.apri);
    var etichettaFab = fab.querySelector('span');
    if (etichettaFab) etichettaFab.textContent = t.apri;

    panel.setAttribute('aria-label', t.titolo + ' ' + t.sottotitolo);
    panel.querySelector('.cca-head-k').textContent = t.titolo;
    panel.querySelector('.cca-head-n').textContent = t.sottotitolo;
    panel.querySelector('.cca-x').setAttribute('aria-label', t.chiudi);

    var avviso = panel.querySelector('.cca-avviso');
    if (avviso) {
      avviso.innerHTML = t.avviso + (PRIVACY
        ? ' <a href="' + PRIVACY + '" target="_blank" rel="noopener">' + t.privacy + '</a>.' : '');
    }

    input.placeholder = t.placeholder;
    input.setAttribute('aria-label', t.placeholder);
    send.textContent = t.invia;

    /* i pulsanti dentro le schede gia' a schermo sono interfaccia, non testo
       della conversazione: si aggiornano anche loro */
    body.querySelectorAll('.cca-card').forEach(function (c) {
      var add = c.querySelector('.cca-btn.pieno');
      if (add) add.textContent = add.disabled ? t.aggiunto : t.aggiungi;
      var vedi = c.querySelector('a.cca-btn');
      if (vedi) vedi.textContent = t.vedi;
    });
    body.querySelectorAll('.cca-mail').forEach(function (m) {
      var k = m.querySelector('.cca-mail-k');
      if (k && !/errore|cannot/i.test(k.textContent)) k.textContent = t.bozza;
      var b = m.querySelector('button.cca-btn.pieno');
      if (b) b.textContent = t.apriMail;
    });
    /* Il benvenuto e' testo nostro, non una risposta del modello: finche' la
       conversazione non e' cominciata segue la lingua. Dopo il primo messaggio
       resta com'e', perche' a quel punto fa parte del discorso. */
    var iniziata = registro.some(function (v) { return v.k === 'me'; });
    if (!iniziata) {
      var primaBolla = body.querySelector('.cca-msg.bot');
      if (primaBolla) {
        primaBolla.textContent = t.benvenuto;
        var voceBenvenuto = registro.find(function (v) { return v.k === 'bot'; });
        if (voceBenvenuto) { voceBenvenuto.d = t.benvenuto; salva(); }
      }
    }

    body.querySelectorAll('.cca-spunti').forEach(function (w) {
      var bottoni = w.querySelectorAll('.cca-btn');
      t.spunti.forEach(function (testoSpunto, i) {
        if (bottoni[i]) bottoni[i].textContent = testoSpunto;
      });
    });
  }

  window.addEventListener('cc-lang:change', applicaLingua);
  /* lingua cambiata in un'altra scheda del browser */
  window.addEventListener('storage', function (e) { if (e.key === 'cc-lang') applicaLingua(); });

  /* ── spostare il pannello ───────────────────────────────────
     Si trascina dall'intestazione. La posizione resta per tutta la visita,
     anche cambiando pagina. Sul telefono non si fa: li' il pannello occupa
     gia' tutto lo schermo e trascinarlo darebbe solo fastidio. */
  var MARGINE = 8;
  var CHIAVE_POS = 'cc-chat-pos';

  function telefono() { return window.innerWidth <= 620; }

  function applicaPosizione(x, y) {
    var r = panel.getBoundingClientRect();
    /* non deve poter uscire dallo schermo: senza questo si perde dietro un bordo */
    var maxX = window.innerWidth  - r.width  - MARGINE;
    var maxY = window.innerHeight - r.height - MARGINE;
    x = Math.max(MARGINE, Math.min(x, Math.max(MARGINE, maxX)));
    y = Math.max(MARGINE, Math.min(y, Math.max(MARGINE, maxY)));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    return { x: x, y: y };
  }

  function salvaPosizione(p) {
    try { sessionStorage.setItem(CHIAVE_POS, JSON.stringify(p)); } catch (e) {}
  }

  function ripristinaPosizione() {
    if (telefono()) return;
    try {
      var p = JSON.parse(sessionStorage.getItem(CHIAVE_POS) || 'null');
      if (p && typeof p.x === 'number') applicaPosizione(p.x, p.y);
    } catch (e) {}
  }

  var testa = panel.querySelector('.cca-head');
  var trascino = null;

  testa.addEventListener('pointerdown', function (e) {
    if (telefono()) return;
    /* la X e' dentro l'intestazione: cliccarla non deve iniziare un trascinamento */
    if (e.target.closest('.cca-x')) return;
    if (e.button !== undefined && e.button !== 0) return;

    var r = panel.getBoundingClientRect();
    trascino = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    applicaPosizione(r.left, r.top);          /* da right/bottom a left/top */
    panel.classList.add('trascino');
    try { testa.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  testa.addEventListener('pointermove', function (e) {
    if (!trascino) return;
    applicaPosizione(e.clientX - trascino.dx, e.clientY - trascino.dy);
  });

  function fineTrascinamento(e) {
    if (!trascino) return;
    trascino = null;
    panel.classList.remove('trascino');
    try { testa.releasePointerCapture(e.pointerId); } catch (err) {}
    var r = panel.getBoundingClientRect();
    salvaPosizione({ x: r.left, y: r.top });
  }
  testa.addEventListener('pointerup', fineTrascinamento);
  testa.addEventListener('pointercancel', fineTrascinamento);

  /* se la finestra si rimpicciolisce, il pannello potrebbe restare fuori */
  window.addEventListener('resize', function () {
    if (telefono()) {
      panel.style.left = panel.style.top = panel.style.right = panel.style.bottom = '';
      return;
    }
    if (panel.style.left) {
      var r = panel.getBoundingClientRect();
      salvaPosizione(applicaPosizione(r.left, r.top));
    }
  });

  /* Ripresa: se sulla pagina precedente la chat era aperta, qui si riapre
     con dentro la stessa conversazione. Chiuderla e' una scelta esplicita
     della persona e viene rispettata anche cambiando pagina. */
  (function riprendi() {
    var mem = leggiMemoria();
    if (!mem) return;
    /* una conversazione di ore fa non e' piu' la stessa visita */
    if (mem.ts && Date.now() - mem.ts > 2 * 60 * 60 * 1000) {
      try { sessionStorage.removeItem(CHIAVE_MEM); } catch (e) {}
      return;
    }
    if (mem.registro && mem.registro.length) ricostruisci(mem);
    if (mem.aperta) apri(true);
  })();

  fab.addEventListener('click', function () { apri(); });
  panel.querySelector('.cca-x').addEventListener('click', chiudi);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && aperto) chiudi(); });

  send.addEventListener('click', function () { manda(input.value); });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); manda(input.value); }
  });
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 110) + 'px';
  });

  /* ── una maniglia per il resto del sito ───────────────────────
     Serve alla pagina Contatti: da li' si riapre il percorso per
     aggiungere un altro articolo senza dover tornare indietro fra
     le pagine del catalogo. */
  /* ── cambio lingua a percorso aperto ──────────────────────────
     I pulsanti sono gia' disegnati e non si traducono da soli: il
     dizionario del sito lavora sui testi che riconosce, e questi
     nascono qui. Ridisegno il passo in cui si e', togliendo prima la
     domanda e le scelte vecchie. */
  window.addEventListener('cc-lang:change', function () {
    if (!passoCorrente || !PASSI[passoCorrente]) return;
    var vecchi = body.querySelectorAll('.cca-q, .cca-scelte, .cca-sblocco');
    for (var i = 0; i < vecchi.length; i++) vecchi[i].remove();
    PASSI[passoCorrente]();
    if (testoSbloccato) { testoSbloccato = false; passiFatti = PASSI_PRIMA_DEL_TESTO; forseSblocca(); }
  });

  window.ccAssistente = {
    apri: function () { if (!aperto) apri(); },
    nuovoPercorso: function () {
      if (!aperto) apri();
      scelte = {};
      passoCorrente = null;
      /* I pulsanti del giro precedente sono ancora a schermo e resterebbero
         cliccabili sotto la domanda nuova: due percorsi vivi insieme, e chi
         schiaccia quelli vecchi si ritrova dove non voleva. */
      var vecchi = body.querySelectorAll('.cca-scelte, .cca-sblocco');
      for (var i = 0; i < vecchi.length; i++) vecchi[i].remove();
      conPercorso(function () {
        domanda(tp().dove);
        scelta(tp().macro, vaiMacro);
      }, ripiego);
    },
  };
})();
