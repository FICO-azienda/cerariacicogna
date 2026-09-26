/* ══════════════════════════════════════════════════════════════
   cc-api.js — un solo posto per dire dov'è il backend
   ──────────────────────────────────────────────────────────────
   Le pagine (contatti.html, riordino.html, admin.html, il widget
   dell'assistente) devono chiamare /api/... Quando il sito e il
   backend sono sullo STESSO dominio (es. entrambi su Vercel), un
   indirizzo relativo basta. Ma se le pagine stanno su un hosting
   (es. Libra, GitHub Pages) e il backend su un altro (es. Render,
   Railway) — due domini diversi — serve l'indirizzo completo.

   Questo file e' l'UNICO posto da modificare quando succede: metti
   l'indirizzo del backend qui sotto, una volta sola.

   In sviluppo locale (localhost) punta sempre a :8787, a prescindere
   da questo file: non serve toccarlo per lavorare sul sito.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var inLocale = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);

  /* ↓↓↓ QUI: appena il backend e' online, incolla il suo indirizzo,
     senza barra finale. Esempio:
       var PRODUZIONE = 'https://cereria-cicogna.onrender.com';
     Se un giorno sito e backend finiscono sullo STESSO dominio,
     rimetti stringa vuota: le pagine torneranno a usare indirizzi
     relativi da sole. */
  var PRODUZIONE = '';

  /* Solo in locale si puo' dirottare il backend con ?api=... — serve a provare
     una copia su un'altra porta. Fuori da localhost e' ignorato di proposito:
     un link con ?api= truccato, mandato a chi gestisce il pannello, spedirebbe
     la password a un server altrui. */
  var forzato = '';
  if (inLocale) {
    try { forzato = new URLSearchParams(location.search).get('api') || ''; } catch (e) { forzato = ''; }
  }

  window.CC_API = forzato || (inLocale ? 'http://localhost:8787' : PRODUZIONE);
})();
