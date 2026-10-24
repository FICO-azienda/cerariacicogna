# Cereria Cicogna — note per chi ci lavora

Sito vetrina + assistente di catalogo dell'Industria F.lli Cicogna (Novate
Milanese, candele dal 1960). Pagine statiche servite da nginx, più una
piccola applicazione Node che risponde su `/api/...`.

Il committente non è uno sviluppatore: **si parla e si scrive in italiano**,
commenti compresi, e si spiega il *perché* prima del *come*. Quando una
modifica va messa online, si prepara uno zip e si danno i passi di Plesk
uno per uno, numerati.

---

## Come gira in produzione

Sta su **Plesk di Libra** (`plesk10.libra.it`), radice
`/var/www/vhosts/cerariacicogna.com/httpdocs`. Non è più su GitHub Pages.

Quattro vincoli scoperti sul campo, tutti costati tempo. Vanno rispettati,
non riscoperti:

- **`app.js` è il file di avvio e Passenger lo carica con `require()`.**
  Niente `await` al livello più esterno, o l'applicazione non parte e Plesk
  mostra la sua pagina d'errore al posto delle API. Le pagine continuano a
  funzionare perché le serve nginx, quindi il guasto sembra parziale.
  Per l'avvio asincrono si usa `import(...).then(...).catch(...)`.
- **Ogni gestore di rotta va chiamato con `return await` dentro il
  try/catch.** Senza l'`await`, un errore diventa un rifiuto non gestito e
  Node chiude il processo: va giù tutto il sito, non solo quella rotta.
- **nginx serve i file dal disco senza passare dall'applicazione.** Una
  lista di file vietati dentro `app.js` non protegge niente: la protezione
  vera è il `.htaccess` in `httpdocs`. Il riquadro "Direttive nginx
  aggiuntive" non è disponibile per questo account.
- **Le attività pianificate girano in chroot senza Node e senza rete**, non
  raggiungono nemmeno `127.0.0.1`, e il server non raggiunge il proprio
  indirizzo pubblico (niente NAT loopback). Per questo il ciclo giornaliero
  dei promemoria parte da **GitHub Actions**
  (`.github/workflows/promemoria.yml`, secret `PROMEMORIA_ENDPOINT` e
  `CRON_SECRET`), che chiama `/api/cron/promemoria` dall'esterno.

Le email partono con **Resend** (dominio verificato, regione Irlanda). I
record DNS stanno su register.it, il cui accesso ce l'ha Libra.

Sondare le rotte con molte richieste ravvicinate fa scattare il **fail2ban**
del server e blocca l'IP di casa per qualche minuto, sito e pannello
compresi. Le verifiche sul sito vero vanno distanziate.

## Dove stanno i dati

Clienti, richieste e log stanno **su file**, in `assistant/data/`, sul
server. `assistant/src/ordini/index.mjs` sceglie l'adattatore **a ogni
chiamata**:

- `sheets.mjs` se `CC_SHEETS_URL` è impostata (oggi non lo è);
- `locale.mjs` altrimenti — i file del server.

Nessun altro file del backend deve sapere quale dei due sta rispondendo.

I file con dati personali (`clienti.json`, `richieste.jsonl`, `chat.log`,
`riordini.json`, `stati-ordini-locali.json`, `promemoria-eventi.jsonl`) sono
in `.gitignore` e **non vanno mai dentro uno zip di consegna**. Prima di
mandare un pacchetto, controllare.

## Il catalogo è ripetuto in cinque posti

La stessa descrizione di prodotto vive in:

1. `forniture.html` — array JS dentro la pagina
2. `liturgico.html` — lo stesso array
3. `assistant/data/catalog.json` — per l'assistente e il pannello
4. `assistant/widget/percorso.json` — per il widget a domande
5. `assistant/config/traduzioni.json` — le descrizioni italiane sono le
   **chiavi** di questo dizionario IT→EN: cambiarle significa rinominare
   chiavi, non solo valori

Toccarne uno solo lascia il sito incoerente. Esistono generatori
(`npm run catalogo`, `npm run percorso`) ma il contenuto è stato modificato
a mano più volte: prima di rigenerare, verificare che non si perda nulla.

**Il numero nel nome di un prodotto liturgico è un codice, non una misura.**
"30 Angelo" è alto 10 cm, "100 P" ne è alto 24. Il sito pubblicava per mesi
il codice come se fosse l'altezza.

Nel widget, `varianti_immagini` collega ogni colore alla sua foto. Il
confronto è per **uguaglianza esatta** sulla stringa intera, quindi un
colore di due parole ("rosso scuro", "canna di fucile") va inserito per
intero fra le `parole`, non spezzato.

## Cache: il motivo per cui "non si vede"

Le pagine HTML non hanno intestazioni di scadenza, quindi il browser tiene
la copia che ha. Dentro quella copia ci sono i `?v=` di script e fogli di
stile. Perciò:

- quando cambia un file versionato (`cc-assistant.js`, `main.css`...) si
  **alza il numero di versione in tutte le pagine che lo citano**;
- `percorso.json` si porta dietro il `?v=` del widget da solo: alzare quello
  del widget basta a far arrivare anche il catalogo nuovo;
- il primo caricamento dopo un aggiornamento richiede comunque un
  **Cmd+Shift+R** da parte di chi ha già visitato il sito. Risolverlo alla
  radice richiede una riga di `Cache-Control` nel `.htaccess`; non è ancora
  stata messa.

## Lavorare in locale

```bash
export PATH="$HOME/.local/node/bin:$PATH"     # Node 24, non è di sistema
npm test                                       # 18 test, devono passare
PORT=8908 ANTHROPIC_API_KEY=finto node app.js  # il sito su localhost:8908
```

`js/cc-api.js` punta a `localhost:8787` quando l'indirizzo è locale. Per
provare su un'altra porta si usa `?api=http://localhost:8908`, che funziona
**solo** in locale: fuori è ignorato di proposito, perché un link truccato
manderebbe la password del pannello a un server altrui.

**Le porte 8787 e 8900 appartengono ad altre sessioni: non vanno chiuse.**

Per vedere davvero una modifica si usa il browser del pannello, non si
chiede al committente di controllare.

## Il pannello (`admin.html`)

Tre schede — Ordini, Clienti, Promemoria — bianco e marrone, caratteri di
sistema sostituiti da IBM Plex. **Non usa il foglio di stile del sito**: lì
serve essere belli, qui essere chiari. Negli ordini si salva da solo; nelle
regole dei promemoria bisogna premere Salva.

Gli ordini si **nascondono**, non si cancellano: la richiesta resta sul
disco, è il documento di ciò che il cliente ha chiesto.

Promemoria: **mai in agosto, settembre e ottobre** — sono i mesi pieni.
Il consenso assente significa scheda vecchia, non opposizione: solo un
rifiuto esplicito blocca l'invio.

## Cose aperte

- **Le chiavi di produzione sono comparse in uno screenshot** (Anthropic,
  Resend, `CC_TOKEN_SECRET`, `CC_CRON_SECRET`, password del pannello) e
  vanno tutte rigenerate.
- 19 voci `[DA COMPILARE]` nelle policy, in attesa di risposte dal
  committente.
- Foto da chiarire: `30 P Stretto` e `50 P Stretto` sono dichiarati "Bianco"
  ma fotografati in rosso; `10 Angelo` ha come foto una confezione da 4.
- 18 varianti liturgiche segnate "bianco" che forse sono "trasparente".
- `Cache-Control` nel `.htaccess`, vedi sopra.
