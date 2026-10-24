# Stato del progetto

Fotografia al **24 ottobre 2026**, fatta al passaggio dalla vecchia sessione
Claude a Claude Code. Va aggiornata quando qualcosa di quanto scritto cambia.

Ogni affermazione porta da dove viene:

- **[codice]** — letto nel repository, ramo `main`, commit `ebbfba9`
- **[git]** — ricavato dalla cronologia
- **[GitHub]** — visto su GitHub (Actions, rami)
- **[da verificare su Plesk]** — non verificabile senza accesso al server

---

## 1. Cosa vede il visitatore

| Sezione | Pagine | Note |
|---|---|---|
| Home | `index.html` | video d'apertura a schermo intero (`video/hero.mp4`, già accorciato e schiarito), poi sezione chiara. Sul telefono il video sta in una fascia 16:9 **[codice]** |
| Home Collection | `home-collection.html` + 7 schede `product-hc-*` | |
| Scent Glass / Fragrance Library / abbinamento | `glass-candles.html`, `fragrance-library.html`, `abbinamento.html` | abbinamento candela + profumo, finisce nella Selezione |
| Garden | `garden.html` + 11 schede (citronelle, fiaccole, cera bianca…) | |
| Liturgico | `liturgico.html` + 6 schede `product-lit-*` | catalogo come array JS nella pagina |
| Forniture | `forniture.html` | stesso array del liturgico |
| Collaborazioni, Private Label, Chi siamo | `personalizzazione.html`, `private-label.html`, `chi-siamo.html` | |
| Contatti | `contatti.html` | modulo con consenso promemoria/newsletter |
| Privacy | `privacy.html` | |
| Riordino | `riordino.html` | si apre solo dal link nell'email di promemoria |

Funzioni trasversali **[codice]**:

- **Selezione**: si aggiungono prodotti e abbinamenti da ogni pagina; il
  modulo contatti la allega da solo. Resta 7 giorni nel browser.
- **IT/EN**: traduzione dal vivo, anche di segnaposto e attributi.
- **Link personale** `?c=<codice>`: il cliente viene salutato per nome e
  ritrova i suoi prodotti abituali, senza account.
- **Assistente** (widget in basso, su 38 pagine): un percorso a domande
  (famiglia → prodotto → colore → misura → profumo, con la foto a ogni
  passo) e una chat con l'AI che conosce solo il catalogo e le policy
  compilate. Prepara bozze di email, non le invia.
- **Modulo contatti**: se la posta è configurata spedisce due email
  (all'azienda e conferma al cliente); se no, ripiega sul programma di posta
  del visitatore.

## 2. Il pannello (`admin.html`) **[codice] [git]**

Protetto da password (`CC_ADMIN_PASSWORD`), sessione firmata. Tre schede:

- **Ordini** — tre riquadri in evidenza (da incassare, da preparare e
  spedire, arrivati oggi); una scheda per ordine con stato, "Segna come
  pagato", importo, note, salvataggio automatico; ordine preso a voce con
  prodotti a menu per linea ed email suggerita dai clienti esistenti;
  "Nascondi" e riquadro "Ordini nascosti" per rimetterli; filtri in fondo,
  chiusi.
- **Clienti** — tabella, clic sul nome per lo storico ordini della persona.
- **Promemoria** — regole per categoria (giorni, secondo promemoria, tetto,
  mesi da spuntare, esclusioni da elenco cercabile), si salva con **Salva**;
  numeri di inviati/aperti/cliccati/ordini generati.

## 3. Automazioni e integrazioni

| Cosa | Stato | Fonte |
|---|---|---|
| Ciclo promemoria da GitHub Actions | **attivo**: 30 esecuzioni, tutte riuscite; l'ultima oggi 24/10 alle 10:05 UTC. Il server risponde 200, quindi l'applicazione Node in produzione è viva e il segreto combacia | [GitHub] |
| Email con Resend | configurato secondo CLAUDE.md | [da verificare su Plesk] |
| Assistente AI (Anthropic) | installato nelle pagine; se la chiave manca il sito resta su e la chat dice "non disponibile" | [codice]; chiave [da verificare su Plesk] |
| Pulizia automatica | cancella le conversazioni dopo 90 giorni e i link di riordino scaduti | [codice] |
| Google Sheets | presente nel codice, **spento** | [codice] + CLAUDE.md |
| **GitHub Pages** | **ancora acceso**: a ogni push su `main` GitHub ripubblica il sito (ultimo: oggi 10:39 UTC). Vedi §6 | [GitHub] |

## 4. Cosa è verificabile e cosa no

| Ambito | Dal repository | Serve Plesk |
|---|---|---|
| Pagine, stili, script, widget | completo | per sapere se online c'è la stessa versione |
| Backend e rotte | completo | idem |
| Catalogo, traduzioni, percorso del widget | completo | idem |
| Foto e video | completo per quelli nel repository | foto caricate direttamente sul server |
| Regole dei promemoria | versione del 25/09/2026 | **la versione attuale**, se modificata dal pannello |
| Clienti, richieste, stati ordine, eventi, chat | **niente** (esclusi di proposito) | tutto |
| Variabili d'ambiente, versione di Node, impostazioni Passenger | solo i nomi attesi | valori e impostazioni reali |
| `.htaccess` attivo sul server | versione del repository | se è stato ritoccato a mano |
| Attività pianificate in Plesk | — | se ce ne sono |

Il sito pubblicato **non è raggiungibile da questo ambiente di lavoro**: la
rete della sessione blocca `www.cerariacicogna.com`. Per confrontare
repository e produzione serve un archivio scaricato da Plesk
(procedura in `docs/PUBBLICAZIONE.md`, §3).

## 5. Lavoro rimasto fuori da `main`

Il ramo **`feature/promemoria-riacquisto`** ha **5 commit mai uniti** a
`main`, tutti del 28/09/2026 (mattina), tutti su `index.html`, tutti
sull'intro video **[git]**:

1. `b9c2f89` toglie l'intro video
2. `495913d` la rimette: parte dalla candela spenta, due giri, poi entra da sola
3. `78ea9f1` mostra solo il tratto 2,65 s → 6,30 s, poi lo stesso al rallentatore
4. `dd3fcf8` allunga il tratto a 9,75 s per far vedere la fiamma che cresce
5. `8087f5c` margine: taglio a 9,70 s

**Non vanno uniti così come sono.** La sera dello stesso giorno, su `main`,
il video `hero.mp4` è stato accorciato di 2,67 s all'inizio (`803b1e6`):
i tempi di quel ramo si riferiscono al file vecchio e oggi cadrebbero nel
punto sbagliato. Se online l'intro si comporta come descritto qui sopra
(entrata automatica dopo due giri), allora questi commit **sono stati
pubblicati** e il repository non lo sa: va controllato sul `index.html` del
server. In ogni caso la scelta di quale intro tenere spetta al committente.

## 6. Rischi e incongruenze trovati

In ordine di importanza. Nessuno è stato corretto: sono decisioni da prendere.

1. **Chiavi di produzione esposte** in uno screenshot (da CLAUDE.md), da
   rigenerare: Anthropic, Resend, `CC_TOKEN_SECRET`, `CC_CRON_SECRET`,
   password del pannello. Ricordare che `CC_CRON_SECRET` va cambiato **anche**
   nel secret `CRON_SECRET` di GitHub, o il ciclo promemoria si ferma; e che
   cambiare `CC_TOKEN_SECRET` invalida i link di riordino già spediti.
2. **GitHub Pages è ancora acceso.** Esiste quindi una seconda copia
   pubblica del sito su `github.io`, senza backend (assistente, modulo e
   pannello non funzionano lì) e con lo stesso contenuto: duplicato per i
   motori di ricerca e possibile fonte di confusione. Si spegne da GitHub →
   Settings → Pages. **[GitHub]**
3. **La cancellazione a 24 mesi promessa dalla privacy non esiste più.**
   `privacy.html` dice che richieste e schede cliente vengono cancellate
   automaticamente dopo 24 mesi dall'ultimo contatto. Quel codice è stato
   tolto da `pulizia.mjs` quando i dati sono passati a Google Sheets
   (`183a0e7`) e non è tornato quando si è tornati ai file (`e2e148a`).
   Non è urgente — i dati più vecchi risalgono a settembre 2026 — ma va
   rimesso prima di settembre 2028. **[codice] [git]**
4. **Rigenerare il catalogo oggi fa perdere lavoro.** Provato su una copia:
   `npm run catalogo` e `npm run percorso` producono file con gli stessi
   84 prodotti e le stesse descrizioni, ma **senza** i collegamenti
   foto-colore: si perdono 31 voci in `catalog.json` e 128 in
   `percorso.json` (il widget tornerebbe a mostrare la stessa foto per ogni
   colore). I generatori non vanno usati finché non imparano a conservare
   `varianti_immagini`. **[verificato]**
5. **`regole-categorie.json` sta nel repository ma viene riscritto dal
   pannello.** Un pacchetto che lo contiene cancella le regole salvate
   online. Va escluso da ogni zip, salvo modifiche decise apposta.
6. `.gitignore` non elencava `stati-ordini-locali.json` (CLAUDE.md diceva di
   sì): corretto il 24/10/2026.
7. `js/cc-api.js` non ha `?v=`: se un giorno cambia, i visitatori abituali
   tengono la copia vecchia.
8. `riordino.html` cita `main.css?v=13` e `i18n-pages.js?v=3`, le altre
   pagine `v=22` e `v=6`: chi apre un riordino potrebbe avere uno stile
   vecchio in cache. Da allineare alla prossima modifica di quella pagina.
9. `assistant/README.md` è in parte superato: parla di Vercel, di Google
   Sheets come archivio principale e di widget "non ancora installato".
   Fa fede `CLAUDE.md` + questa cartella `docs/`.
10. File inutili ma pubblicati: `chi-siamo.html.bak`, `css/main.css.bak`,
    `images/_garden_bg_backup/` (38 PNG, 55 MB), `video/hero_original.mp4`,
    la cartella `api/`. Non fanno danno; si possono togliere quando si vuole.
11. In locale questa macchina ha Node 22 (`/opt/node22`), non Node 24 come
    scritto in CLAUDE.md per il Mac: i test passano lo stesso (18/18).

## 7. Questioni aperte ereditate (da CLAUDE.md)

- 19 voci `[DA COMPILARE]` in `assistant/config/FAQ_POLICIES.md` — contate:
  sono ancora 19. Finché restano, l'assistente non risponde su quei temi.
- Foto: `30 P Stretto` e `50 P Stretto` dichiarati "Bianco" ma fotografati
  in rosso; `10 Angelo` ha la foto di una confezione da 4.
- 18 varianti liturgiche "bianco" forse "trasparente".
- `Cache-Control` per le pagine HTML nel `.htaccess`.

## 8. Siamo pronti a lavorare?

**Sul codice, sì**: il repository contiene tutto il necessario per far
girare sito e backend, i test passano, le regole sono documentate.

**Prima di pubblicare qualunque cosa**, serve una volta il confronto con il
server (`docs/PUBBLICAZIONE.md`, §3), per tre motivi: sapere se l'intro della
home online è quella di `main` o quella del ramo laterale; recuperare le
regole dei promemoria attuali; scoprire eventuali file modificati a mano su
Plesk. Fino ad allora ogni pacchetto deve contenere **solo i file toccati**,
mai la cartella intera.
