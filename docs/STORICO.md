# Storico delle modifiche

Due parti. La prima è ricostruita **solo dalla cronologia Git**: niente di
ciò che non risulta da un commit è stato aggiunto. La seconda si compila da
qui in avanti, a ogni sessione.

Le modifiche fatte direttamente su Plesk o dal pannello prima del 24/10/2026
**non sono note** e non compaiono qui (vedi `docs/STATO-DEL-PROGETTO.md`, §4).

---

## Parte 1 — Cronologia ricostruita (12/09 → 24/10/2026)

### 12 settembre 2026 — nascita, su GitHub Pages
- `8d27b86` Versione iniziale: vetrina B2B in HTML/CSS/JS con GSAP, 39
  pagine, foto WebP, SEO (sitemap, robots, Open Graph, JSON-LD), assistente
  AI di catalogo con percorso a pulsanti, Selezione per i preventivi.
- `ffd4e5e` `.nojekyll` per GitHub Pages.
- `d975838` Privacy: hosting dichiarato GitHub, non Vercel.

### 24 settembre 2026 — promemoria di riacquisto e passaggio a Plesk
Lavoro su due rami, fatto da due sessioni diverse.

Ramo `feature/promemoria-riacquisto` (mattina):
- `358fde6` Promemoria di riacquisto senza account: motore, pagina di
  riordino con token, pannello admin, newsletter separata, scheduler,
  GitHub Actions, `js/cc-api.js`, 18 test.
- `183a0e7` Ordini e clienti spostati su Google Sheets, stati ordine,
  email al cambio di stato, dashboard estesa.
- `94a59a4` `riordino.html` bilingue.
- `2617c39` Intestazioni più corte nel foglio Google.

Ramo `main` (sera):
- `9d4a0f0` Correzioni della messa in produzione su Plesk: menu a panino
  sotto gli 800px, hero e testate sul telefono, favicon cicogna, IT/EN
  leggibile, foto dei titolari, schermata del modulo onesta, privacy
  allineata, `.htaccess` di protezione, `app.js`. Link personale che
  chiamava `localhost` corretto.
- `3519ac5` Unione del ramo dei promemoria.
- `e2e148a` Promemoria sul server di Libra **senza** Google Sheets
  (`ordini/locale.mjs`, scelta dell'adattatore a ogni chiamata), le 8 rotte
  in `app.js`, `await` su ogni gestore (una richiesta sbagliata faceva
  cadere tutto il sito).

### 25 settembre 2026
- `14ba9e6` Traduzioni di consenso, segnaposto e attributi; 17 voci nuove.
- `99d95e3` Pannello: ordini gestiti da qui (stato, pagamento, importo,
  note) e ordini presi a voce, con scheda cliente. Contrasto delle tabelle.
- `4f0c1da` Mesi da spuntare al posto delle date; **esclusi agosto,
  settembre, ottobre** su tutte e quattro le categorie; prodotti a menu;
  riquadri di priorità.
- `0743d12` Via il riquadro "Spediti".
- `8190f20` Esclusioni da elenco cercabile per gruppo, storico per cliente,
  tendine chiuse.
- `311a618` Clienti suggeriti da elenco (niente schede doppie per la stessa
  persona).

### 26 settembre 2026
- `4cb0779` Consenso assente = scheda vecchia, non disiscrizione.
- `2c4e076` Ordini nascosti e ripristinabili; campo "origine" salvato;
  `?api=` solo in locale.
- `da57024`, `7566216`, `b8a5564` Pannello in tre schede, bianco e marrone,
  IBM Plex, fuori dallo stile del sito.

### 28 settembre 2026
Ramo `feature/promemoria-riacquisto`, mattina (**mai unito a `main`**):
- `b9c2f89`, `495913d`, `78ea9f1`, `dd3fcf8`, `8087f5c` — esperimenti
  sull'intro video della home (toglierla, rimetterla dalla candela spenta,
  due giri ed entrata automatica, tratto 2,65→9,70 s con rallentatore).

Ramo `main`, sera:
- `803b1e6` Hero: tolti i primi 2,67 s dal file (6,2 → 1,8 MB), video
  schiarito.
- `2c8d144` Hero sul telefono: fascia 16:9, video intero, testo sopra.

### 6 ottobre 2026
- `46c4abe` Altezze vere dei prodotti liturgici (il numero nel nome è un
  codice): 20 schede corrette nei 5 file. Collegate le foto per colore (126
  combinazioni). Nuovo: 40 Coperchio Pioggia Angelo. Moplen, 60/8, 60/8 P.
- `5d4294b` `percorso.json` eredita il `?v=` del widget; 38 pagine a `v=13`.
- `b05fdd3` Foto anche al passo delle misure; ripiego sulla foto del
  prodotto se manca quella della variante; 259 passaggi del widget
  verificati. 40 Coperchio Pioggia Angelo spostato in Linea Aure.

### 24 ottobre 2026
- `ebbfba9` `CLAUDE.md`: note per chi riprende il progetto.

---

## Parte 2 — Registro delle sessioni

Una voce per ogni sessione che cambia qualcosa. Formato:

```
### AAAA-MM-GG — titolo breve
- Cosa: …
- Perché: …
- File: …
- Commit: …   Ramo: …
- Pubblicato su Plesk: sì (data) / no
- Da sapere per la prossima volta: …
```

### 2026-10-24 — Passaggio di consegne a Claude Code
- Cosa: ricognizione completa del repository e della cronologia; creata la
  cartella `docs/` (architettura, stato, pubblicazione, storico); CLAUDE.md
  aggiornato senza togliere nulla; aggiunto `stati-ordini-locali.json` a
  `.gitignore`.
- Perché: la nuova sessione non aveva il contesto della precedente; serviva
  una memoria scritta nel repository.
- Trovati: 5 commit mai uniti sull'intro video; GitHub Pages ancora attivo;
  cancellazione a 24 mesi promessa ma non implementata; generatori del
  catalogo che perderebbero i collegamenti foto-colore.
- File del sito toccati: nessuno.
- Ramo: `claude/brave-volta-tjoo76`.
- Pubblicato su Plesk: no (non c'era niente da pubblicare).
- Da sapere: il confronto con il server è ancora da fare
  (`docs/PUBBLICAZIONE.md`, §3).
