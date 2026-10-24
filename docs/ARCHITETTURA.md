# Architettura — come è fatto il sito

Ricostruita il 24 ottobre 2026 leggendo il codice di `main` (commit
`ebbfba9`). Tutto quello che c'è qui è **verificato nel codice**; quello che
riguarda il server è segnato come tale.

---

## 1. Il quadro in una pagina

```
 visitatore ──► nginx (Plesk Libra) ──► file statici dal disco
                     │                   (pagine .html, css, js, images, video)
                     │
                     └─ /api/... ──► Passenger ──► app.js (Node)
                                                   │
                                                   ├─ assistant/src/*      la logica
                                                   ├─ assistant/data/*     i dati, su file
                                                   ├─ Anthropic API        l'assistente in chat
                                                   └─ Resend               le email

 GitHub Actions (ogni giorno ~06:00 UTC) ──► /api/cron/promemoria?secret=...
```

- **Pagine**: HTML/CSS/JS puro, con GSAP per le animazioni. Nessun framework,
  nessuna compilazione: il file nel repository è il file che va online.
- **Applicazione Node**: un processo solo (`app.js`), avviato da Passenger.
  Serve le rotte `/api/...`; in teoria serve anche i file statici, ma in
  produzione quelli li serve nginx direttamente (vedi CLAUDE.md).
- **Dati**: su file JSON/JSONL in `assistant/data/`, sul disco del server.
  Nessun database.

## 2. Cartelle e file

| Percorso | Cosa contiene | Va online? |
|---|---|---|
| `*.html` (radice) | 40 file: 13 pagine di sezione, 24 schede prodotto, `admin.html`, `riordino.html` e `scent-family.html` (solo un rinvio) | sì |
| `css/main.css` | foglio di stile unico del sito (non usato da `admin.html`) | sì |
| `js/main.js` | GSAP, menu, caricamento, animazioni comuni | sì |
| `js/selection.js` | la "Selezione" (carrello senza prezzi) in `localStorage`, scade dopo 7 giorni | sì |
| `js/i18n.js` + `js/i18n-pages.js` | traduzione IT→EN dal vivo; il dizionario ha come chiave il testo italiano esatto | sì |
| `js/link-personale.js` | riconosce il cliente da `?c=<codice>` e toglie il codice dalla barra | sì |
| `js/cc-api.js` | dice alle pagine dov'è il backend (vuoto = stesso dominio) | sì |
| `assistant/widget/` | `cc-assistant.js` (widget chat + percorso a domande) e `percorso.json` | sì — è l'unica cartella di `assistant/` leggibile dal browser |
| `assistant/src/` | tutto il backend | sì, ma bloccato da `.htaccess` |
| `assistant/config/` | `persona.md` (tono), `FAQ_POLICIES.md` (policy), `traduzioni.json` | sì, bloccato |
| `assistant/data/` | catalogo, regole promemoria, stati ordine **e i dati dei clienti** | sì, bloccato |
| `assistant/scripts/` | generatori e strumenti da riga di comando | sì, bloccato |
| `assistant/server.mjs` | server **di sviluppo** (stesse rotte di `app.js`) | non serve online |
| `app.js` | file di avvio di produzione | sì, bloccato |
| `api/` | involucri per Vercel, **non usati** su Plesk (manca anche `admin/ordini`) | inutili |
| `google-apps-script/Codice.gs` | adattatore Google Sheets, **non attivo** (`CC_SHEETS_URL` vuota) | no |
| `tests/` | 18 test (motore promemoria, token di riordino) | no |
| `images/` (546 file, 107 MB), `video/`, `videos/` | foto e filmati | sì |
| `images/_garden_bg_backup/` | 38 PNG (55 MB) originali delle foto Garden, prima della scontornatura | online ma inutile |
| `chi-siamo.html.bak`, `css/main.css.bak` | copie vecchie del primo commit | online ma inutili |
| `.htaccess` | **la vera protezione** dei file interni | sì |
| `.github/workflows/promemoria.yml` | il cron esterno dei promemoria | resta su GitHub |
| `.claude/launch.json` | configurazione del browser di anteprima della vecchia sessione (porta 8900, Mac) | no |

## 3. Le rotte dell'applicazione

Identiche in `app.js` (produzione) e `assistant/server.mjs` (sviluppo) —
verificato. **Ogni rotta nuova va aggiunta in tutti e due i file**, e in
`app.js` con `return await` dentro il try/catch.

| Rotta | Modulo | Cosa fa |
|---|---|---|
| `/api/chat` | `handler.mjs` → `chat.mjs` | assistente AI in streaming (SSE). GET = stato del servizio |
| `/api/cliente?c=` | `cliente-endpoint.mjs` | traduce un codice personale in nome/azienda/prodotti abituali |
| `/api/contatto` (POST) | `contatto.mjs` | modulo contatti: salva la richiesta, crea/aggiorna la scheda cliente, manda 2 email (all'azienda + conferma al cliente) |
| `/api/riordino?t=` | `riordino-endpoint.mjs` | dati della pagina `riordino.html` da un token firmato |
| `/api/unsubscribe?c=&tipo=` | `unsubscribe-endpoint.mjs` | disiscrizione da promemoria o newsletter |
| `/api/promemoria-aperto?id=` | `apertura-endpoint.mjs` | pixel di apertura delle email |
| `/api/cron/promemoria?secret=` | `cron-endpoint.mjs` | un giro del ciclo promemoria (chiamato da GitHub Actions) |
| `/api/ordine-stato-cambiato` | `ordini/stato-endpoint.mjs` | webhook di Google Sheets — inattivo finché Sheets non è configurato |
| `/api/admin/login` | `admin/login-endpoint.mjs` | password del pannello → sessione firmata |
| `/api/admin/dashboard` | `admin/dashboard-endpoint.mjs` | numeri, ordini e clienti del pannello, con filtri |
| `/api/admin/regole` | `admin/regole-endpoint.mjs` | legge/**scrive** `regole-categorie.json` |
| `/api/admin/ordini[/azione]` | `admin/ordini-endpoint.mjs` | elenco, modifica, ordine preso a voce, nascondi/ripristina, menu prodotti |

All'avvio `app.js` lancia anche, senza `await`, `pulizia.mjs` (cancellazioni
periodiche) e `scheduler.mjs` (timer interno dei promemoria; in produzione il
vero innesco è GitHub Actions).

## 4. I dati

Tutti in `assistant/data/`. La colonna "Dove vive la verità" è la cosa da
ricordare prima di ogni pacchetto.

| File | Contenuto | Chi lo scrive | Dove vive la verità |
|---|---|---|---|
| `catalog.json` | 84 prodotti, 22 profumi, 42 note, 9 Scent Glass | generatore + mani | repository |
| `home-collection.json` | famiglie Home Collection (a mano) | mani | repository |
| `azienda.json` | dati aziendali per l'assistente | mani | repository |
| `stati-ordine.json` | i 10 stati possibili di un ordine | mani | repository |
| `regole-categorie.json` | regole dei promemoria per categoria | **il pannello (Salva)** e le mani | **server** se qualcuno ha premuto Salva dopo il 25/09/2026 |
| `clienti.json` | schede cliente, codici personali, consensi | il sito | **solo server** |
| `richieste.jsonl` | ogni richiesta dal modulo = un "ordine" | il sito | **solo server** |
| `stati-ordini-locali.json` | stato, pagamento, importo, note, "nascosto" scritti dal pannello | il pannello | **solo server** |
| `riordini.json` | token dei link di riordino | il ciclo promemoria | **solo server** |
| `promemoria-eventi.jsonl` | inviato / aperto / cliccato / convertito | il ciclo promemoria | **solo server** |
| `chat.log` | conversazioni con l'assistente (IP solo come hash) | il sito | **solo server** |

Le variabili d'ambiente `CC_ARCHIVIO`, `CC_CLIENTI`, `CC_REGOLE`,
`CC_RIORDINI`, `CC_EVENTI_PROMEMORIA`, `CC_STATI_ORDINE_LOCALI`,
`CC_LOG_FILE` possono spostare questi file altrove: se in Plesk ce n'è
qualcuna impostata, i dati non sono dove dice la tabella.

### Il cambio d'archivio Sheets ↔ file

`assistant/src/ordini/index.mjs` decide **a ogni chiamata**: Google Sheets se
`CC_SHEETS_URL` e `CC_SHEETS_SECRET` sono impostate, altrimenti i file. Oggi:
file. Attenzione: se un giorno si accende Sheets, i dati esistenti su file
**non vengono copiati** nel foglio; il pannello vedrebbe un archivio vuoto.

## 5. Variabili d'ambiente (impostate in Plesk, non nel repository)

Obbligatorie in produzione: `ANTHROPIC_API_KEY`, `CC_RESEND_KEY`,
`CC_MITTENTE`, `CC_TOKEN_SECRET`, `CC_ADMIN_PASSWORD`, `CC_CRON_SECRET`.
Consigliata: `CC_ORIGINI`. Le altre (modello, tetti, percorsi) hanno valori
predefiniti in `assistant/src/config.mjs`; elenco completo in `.env.example`.

Il modello predefinito è `claude-opus-5` con effort `low`
(`CC_MODELLO`, `CC_EFFORT`). Quali valori siano davvero impostati in Plesk
**non è verificabile dal repository**.

Su GitHub (Settings → Secrets → Actions): `PROMEMORIA_ENDPOINT`,
`CRON_SECRET` (= `CC_CRON_SECRET`).

## 6. Mappa delle dipendenze — cosa si rompe se si tocca cosa

| Se cambi… | …devi controllare anche |
|---|---|
| nome o descrizione di un prodotto | i 5 posti del catalogo (CLAUDE.md), le chiavi di `traduzioni.json`, i nomi in `esclusi` di `regole-categorie.json` (il motore confronta i nomi), gli ordini già registrati (portano il nome com'era) |
| un file `.js`/`.css` con `?v=` | il numero di versione in **tutte** le pagine che lo citano |
| `percorso.json` | basta alzare `?v=` di `cc-assistant.js` in tutte le pagine |
| `js/cc-api.js` | **non ha `?v=`** in nessuna pagina: una modifica arriva solo a chi non lo ha in cache |
| una rotta in `app.js` | la stessa rotta in `assistant/server.mjs`; `return await`; niente `await` in cima al file |
| un file nuovo che non deve essere pubblico | una riga `RedirectMatch 404` in `.htaccess` |
| la categoria `cat` assegnata da una pagina prodotto | le 4 categorie di `regole-categorie.json` (liturgico, garden, home-collection, private-label) |
| testi della privacy sui tempi di conservazione | `TERMINI` in `pulizia.mjs` (sono la stessa promessa) |
| un testo visibile in italiano | la voce corrispondente nel dizionario di `i18n.js`/`i18n-pages.js`, altrimenti in inglese resta italiano |
| i mesi esclusi dei promemoria | si cambiano dal pannello, **non** dal file nel repository (vedi §4) |

## 7. Versioni in cache oggi (`main`, 24/10/2026)

| File | Versione | Pagine |
|---|---|---|
| `css/main.css` | `v=22` | 37 pagine; `riordino.html` è rimasta a `v=13` |
| `js/i18n-pages.js` | `v=6` | 38 pagine; `riordino.html` a `v=3` |
| `js/i18n.js` | `v=8` | 39 |
| `js/main.js` | `v=8` | 37 (non in admin, riordino, scent-family) |
| `js/selection.js` | `v=7` | 38 |
| `js/link-personale.js` | `v=7` | 38 |
| `assistant/widget/cc-assistant.js` | `v=13` | 38 (non in admin, riordino) |
| `js/cc-api.js` | nessuna | 40 |

`scent-family.html` è solo un rinvio a `fragrance-library.html`.
