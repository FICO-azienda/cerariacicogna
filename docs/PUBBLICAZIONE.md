# Pubblicazione e recupero da Plesk

Il sito sta su **Plesk di Libra** (`plesk10.libra.it`), cartella
`/var/www/vhosts/cerariacicogna.com/httpdocs`. Il codice sta su GitHub.
**Le due copie non si sincronizzano da sole**: GitHub non pubblica su Plesk,
e quello che si cambia su Plesk (o dal pannello) non torna su GitHub.

---

## 1. Regole per ogni pacchetto da pubblicare

1. **Solo i file cambiati**, ognuno nella sua cartella giusta dentro lo zip.
   Mai lo zip dell'intero sito: sovrascriverebbe i dati e le regole del
   server.
2. **Mai dentro uno zip**: `assistant/data/clienti.json`,
   `richieste.jsonl`, `chat.log`, `riordini.json`,
   `stati-ordini-locali.json`, `promemoria-eventi.jsonl`, `.env`.
   E nemmeno `CLAUDE.md` e la cartella `docs/`: sono note di lavoro,
   e `.htaccess` non le protegge.
3. **Neanche** `assistant/data/regole-categorie.json`, a meno che lo scopo
   del pacchetto sia proprio cambiare le regole e si sia prima recuperata la
   versione del server: il pannello la riscrive ogni volta che si preme Salva.
4. Se è cambiato un `.js` o `.css` con `?v=`, nel pacchetto ci sono anche
   **tutte** le pagine con il numero alzato.
5. Prima di preparare lo zip: `npm test` deve dare 18 su 18 (o più, se se ne
   aggiungono) e la modifica va vista funzionare nel browser in locale.
6. Lo zip si prepara con l'elenco dei file stampato a schermo e ricontrollato
   contro le regole 2 e 3.
7. Ogni pubblicazione si annota in `docs/STORICO.md`, con data e commit.

## 2. Passi di pubblicazione (da confermare alla prima occasione)

> Questi passi sono ricostruiti da CLAUDE.md e dalle schermate standard di
> Plesk: la vecchia sessione li dava a voce e non li ha scritti. Alla prima
> pubblicazione vera vanno ricontrollati e corretti qui.

1. Accedere a Plesk e aprire **Siti web e domini** → `cerariacicogna.com`.
2. Aprire **Gestione file** (File Manager) ed entrare in `httpdocs`.
3. **Prima di tutto, una copia di sicurezza dei file che verranno
   sostituiti**: selezionarli, scegliere **Aggiungi all'archivio**, poi
   spostare l'archivio **fuori** da `httpdocs` (nella cartella superiore) e
   scaricarlo. Un archivio lasciato dentro `httpdocs` è scaricabile da
   chiunque.
4. Caricare lo zip del pacchetto in `httpdocs` con **Carica**.
5. Cliccare sullo zip → **Estrai file**, spuntando la sovrascrittura.
6. Cancellare lo zip appena estratto.
7. Se il pacchetto contiene file del backend (`app.js` o qualcosa in
   `assistant/src/`, `assistant/config/`, `assistant/data/`): aprire
   **Node.js** e premere **Riavvia app**. Le sole pagine non lo richiedono.
8. Aprire il sito con **Cmd+Shift+R** e controllare la modifica. Poi
   controllare che l'assistente risponda e che il pannello si apra.
   Non fare decine di prove ravvicinate: il fail2ban blocca l'IP.

## 3. Recupero dello stato del server (da fare una volta, adesso)

Serve a sapere se il repository corrisponde davvero a quello che è online, e
a mettere in salvo i dati che esistono solo lì. **Solo lettura e download:
non si cambia niente del sito.**

### 3a. Una copia completa, da tenere al sicuro (sul vostro computer)

1. Plesk → **Siti web e domini** → `cerariacicogna.com` → **Gestione file**.
2. Salire **sopra** `httpdocs` (la cartella principale del dominio, dove si
   vedono `httpdocs`, `logs`…). È importante: un archivio creato qui non è
   raggiungibile dal web.
3. Mettere la spunta solo su `httpdocs` → **Aggiungi all'archivio** → nome
   `httpdocs-2026-10-24.zip`.
4. Cliccare sull'archivio creato → **Scarica**. Conservarlo sul computer:
   contiene i dati dei clienti, **non va mandato a nessuno**.
5. Tornare in Gestione file e **cancellare** l'archivio dal server.

### 3b. Una copia senza foto né dati personali, da caricare qui in chat

1. Stessa cartella sopra `httpdocs`. Creare una cartella `confronto`.
2. Entrare in `httpdocs`, spuntare tutto **tranne** `images`, `video`,
   `videos`, `node_modules` e la cartella `assistant`; **Copia** in
   `../confronto`.
3. Entrare in `httpdocs/assistant`, spuntare `src`, `config`, `widget`,
   `scripts`, `server.mjs` → **Copia** in `../confronto/assistant`.
4. Entrare in `httpdocs/assistant/data` e copiare **solo** questi file in
   `confronto/assistant/data`: `catalog.json`, `regole-categorie.json`,
   `stati-ordine.json`, `azienda.json`, `home-collection.json`.
   Gli altri contengono dati personali e non servono al confronto.
5. Spuntare `confronto` → **Aggiungi all'archivio** → `confronto.zip` →
   **Scarica** → cancellare dal server sia lo zip sia la cartella.
6. Caricare `confronto.zip` in questa chat.

### 3c. Due cose da leggere a schermo (senza fotografare i valori)

1. Plesk → `cerariacicogna.com` → **Node.js**: annotare versione di Node,
   "Radice documento", "Radice applicazione", "File di avvio", modalità
   (production/development), e **solo i nomi** delle variabili d'ambiente,
   non i valori. Uno screenshot va bene **solo con i valori coperti**: le
   chiavi sono già state esposte una volta.
2. Plesk → **Attività pianificate**: dire se ce n'è qualcuna, e cosa esegue.
3. Elenco dei file in `httpdocs/images`: basta sapere il numero di file
   (Gestione file lo mostra in fondo). Il repository ne ha 546 più la
   cartella `_garden_bg_backup`; se il numero è diverso ci sono foto
   caricate solo sul server.

### Cosa farà Claude con questi materiali

Confronto file per file fra `confronto.zip` e il repository, poi:

- i file uguali: niente;
- i file diversi o presenti solo sul server: elenco con spiegazione, e —
  solo dopo conferma — portati nel repository come commit a parte
  ("Allineamento con il server di Plesk"), così la storia lo dice;
- `regole-categorie.json` del server: diventa la versione di riferimento
  nel repository.

## 4. Spostare il ciclo promemoria o cambiare il segreto

`CC_CRON_SECRET` (Plesk) e `CRON_SECRET` (GitHub → Settings → Secrets and
variables → Actions) devono essere identici. Si cambiano **insieme**; dopo,
si lancia il workflow a mano da GitHub → Actions → "Promemoria di
riacquisto" → Run workflow, e deve risultare verde.
