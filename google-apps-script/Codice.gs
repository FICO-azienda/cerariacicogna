/* ══════════════════════════════════════════════════════════════
   Codice.gs — il foglio Google diventa il database di ordini e clienti
   ──────────────────────────────────────────────────────────────
   Va incollato nell'editor Apps Script DENTRO il foglio Google Sheets
   (Estensioni → Apps Script). Non tocca nient'altro: crea da solo le
   due schede "Ordini" e "Clienti" con le intestazioni, se non esistono
   ancora.

   Setup, una volta sola (istruzioni complete nella guida che ti ho
   dato in chat):
   1. Incolla questo file al posto del codice di esempio.
   2. Estensioni → Apps Script → icona ingranaggio → "Proprietà dello
      script" → aggiungi:
        SEGRETO       = una stringa lunga a caso (la stessa che metti
                         come CC_SHEETS_SECRET sul backend)
        BACKEND_URL   = https://tuobackend.onrender.com/api/ordine-stato-cambiato
   3. Esegui UNA VOLTA la funzione "installaTrigger" dal menu in alto
      (richiede di autorizzare lo script — è normale, è il tuo foglio).
      Senza questo passo il cambio di stato non manda l'email: le
      funzioni "semplici" di Apps Script non possono chiamare l'esterno,
      solo quelle installate cosi' possono.
   4. Distribuisci → Nuova implementazione → tipo "App web" →
      "Chiunque abbia il link" può eseguire → Distribuisci. Copia
      l'URL: è il CC_SHEETS_URL da mettere sul backend.
   ══════════════════════════════════════════════════════════════ */

var FOGLIO_ORDINI = 'Ordini';
var FOGLIO_CLIENTI = 'Clienti';

var COLONNE_ORDINI = [
  'ID Ordine', 'Data Ordine', 'Nome', 'Cognome', 'Email', 'Azienda', 'Telefono', 'Indirizzo',
  'Tipo Cliente', 'Linea', 'Prodotti', 'Articoli (JSON)', 'Prezzo Totale', 'Metodo Pagamento',
  'Stato Pagamento', 'Stato', 'Data Prevista', 'Data Spedizione', 'Data Consegna',
  'Note', 'Messaggio', 'Lingua', 'Promemoria Rif',
];

var COLONNE_CLIENTI = [
  'Codice', 'Email', 'Nome', 'Azienda', 'Telefono', 'Indirizzo', 'Linea', 'Lingua',
  'Creato', 'Scadenza', 'Revocato', 'Revocato Il', 'Ultimo Ordine', 'Frequenza (gg)',
  'Consenso (JSON)', 'Prodotti Abituali (JSON)', 'Promemoria (JSON)', 'Note Interne',
];

var STATI_ORDINE = ['nuovo', 'confermato', 'pagamento', 'pagato', 'preparazione', 'produzione',
                     'pronto', 'spedito', 'consegnato', 'annullato'];

/* ── fogli: li crea al volo se non esistono, con le intestazioni e
   un menu a tendina sulla colonna Stato — cosi' lo staff non può
   scrivere uno stato inventato per errore. ── */
function foglio(nome, colonne) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var f = ss.getSheetByName(nome);
  if (!f) {
    f = ss.insertSheet(nome);
    f.getRange(1, 1, 1, colonne.length).setValues([colonne]).setFontWeight('bold');
    f.setFrozenRows(1);
    if (nome === FOGLIO_ORDINI) {
      var colStato = colonne.indexOf('Stato') + 1;
      var regola = SpreadsheetApp.newDataValidation().requireValueInList(STATI_ORDINE, true).build();
      f.getRange(2, colStato, 2000, 1).setDataValidation(regola);
    }
  }
  return f;
}

/* ── lettura/scrittura per nome di colonna, non per indice fisso:
   se un domani si riordinano le colonne a mano nel foglio, il codice
   non si rompe. ── */
function leggiTutto(f) {
  var dati = f.getDataRange().getValues();
  if (dati.length < 2) return [];
  var intestazioni = dati[0];
  return dati.slice(1).filter(function (r) { return r.some(function (v) { return v !== ''; }); })
    .map(function (r, i) {
      var o = { _riga: i + 2 };
      intestazioni.forEach(function (h, j) { o[h] = r[j]; });
      return o;
    });
}

function trovaRigaPer(f, colonna, valore) {
  var righe = leggiTutto(f);
  return righe.find(function (r) { return String(r[colonna] || '').toLowerCase() === String(valore || '').toLowerCase(); }) || null;
}

function scriviRiga(f, colonne, oggetto) {
  var riga = colonne.map(function (c) { return oggetto[c] !== undefined ? oggetto[c] : ''; });
  f.appendRow(riga);
}

function aggiornaCella(f, numeroRiga, colonne, nomeColonna, valore) {
  var idx = colonne.indexOf(nomeColonna) + 1;
  if (idx > 0) f.getRange(numeroRiga, idx).setValue(valore);
}

var jsonSicuro = function (v, fallback) { try { return JSON.parse(v || 'null') || fallback; } catch (e) { return fallback; } };

/* ── conversione riga foglio ↔ oggetto ordine/cliente che il backend si aspetta ── */
function rigaAOrdine(r) {
  if (!r) return null;
  return {
    id: r['ID Ordine'], ts: r['Data Ordine'], nome: r['Nome'], cognome: r['Cognome'], email: r['Email'],
    azienda: r['Azienda'], telefono: r['Telefono'], indirizzo: r['Indirizzo'], tipoCliente: r['Tipo Cliente'],
    linea: r['Linea'], articoli: jsonSicuro(r['Articoli (JSON)'], []),
    prezzoTotale: r['Prezzo Totale'], metodoPagamento: r['Metodo Pagamento'], statoPagamento: r['Stato Pagamento'],
    stato: r['Stato'], dataPrevistaSpedizione: r['Data Prevista'], dataSpedizione: r['Data Spedizione'],
    dataConsegna: r['Data Consegna'], note: r['Note'], messaggio: r['Messaggio'], lingua: r['Lingua'],
    promemoriaRif: r['Promemoria Rif'],
  };
}

function ordineARiga(o) {
  return {
    'ID Ordine': o.id, 'Data Ordine': o.ts, 'Nome': o.nome, 'Cognome': o.cognome, 'Email': o.email,
    'Azienda': o.azienda, 'Telefono': o.telefono, 'Indirizzo': o.indirizzo, 'Tipo Cliente': o.tipoCliente,
    'Linea': o.linea, 'Prodotti': (o.articoli || []).map(function (a) { return a.nome + (a.quantita ? ' x' + a.quantita : ''); }).join(', '),
    'Articoli (JSON)': JSON.stringify(o.articoli || []), 'Prezzo Totale': o.prezzoTotale || '',
    'Metodo Pagamento': o.metodoPagamento || '', 'Stato Pagamento': o.statoPagamento || '', 'Stato': o.stato,
    'Data Prevista': o.dataPrevistaSpedizione || '', 'Data Spedizione': o.dataSpedizione || '',
    'Data Consegna': o.dataConsegna || '', 'Note': o.note || '', 'Messaggio': o.messaggio || '',
    'Lingua': o.lingua || 'it', 'Promemoria Rif': o.promemoriaRif || '',
  };
}

function rigaACliente(r) {
  if (!r) return null;
  return {
    codice: r['Codice'], email: r['Email'], nome: r['Nome'], azienda: r['Azienda'], telefono: r['Telefono'],
    indirizzo: r['Indirizzo'], linea: r['Linea'], lingua: r['Lingua'], creato: r['Creato'], scadenza: r['Scadenza'],
    revocato: Boolean(r['Revocato']), revocatoIl: r['Revocato Il'], ultimoOrdine: r['Ultimo Ordine'],
    frequenzaMediaGiorni: r['Frequenza (gg)'] || null,
    consenso: jsonSicuro(r['Consenso (JSON)'], { newsletter: false, promemoriaRiacquisto: true }),
    prodotti: jsonSicuro(r['Prodotti Abituali (JSON)'], []),
    promemoria: jsonSicuro(r['Promemoria (JSON)'], []),
    noteInterne: r['Note Interne'],
    _riga: r._riga,
  };
}

function clienteARiga(c) {
  return {
    'Codice': c.codice, 'Email': c.email, 'Nome': c.nome || '', 'Azienda': c.azienda || '',
    'Telefono': c.telefono || '', 'Indirizzo': c.indirizzo || '', 'Linea': c.linea || '', 'Lingua': c.lingua || 'it',
    'Creato': c.creato, 'Scadenza': c.scadenza, 'Revocato': c.revocato ? 'VERO' : '', 'Revocato Il': c.revocatoIl || '',
    'Ultimo Ordine': c.ultimoOrdine || '', 'Frequenza (gg)': c.frequenzaMediaGiorni || '',
    'Consenso (JSON)': JSON.stringify(c.consenso || {}), 'Prodotti Abituali (JSON)': JSON.stringify(c.prodotti || []),
    'Promemoria (JSON)': JSON.stringify(c.promemoria || []), 'Note Interne': c.noteInterne || '',
  };
}

/* ══ azioni richiamabili dal backend ══════════════════════════ */

function az_creaOrdine(dati) {
  scriviRiga(foglio(FOGLIO_ORDINI, COLONNE_ORDINI), COLONNE_ORDINI, ordineARiga(dati.ordine));
  return dati.ordine;
}

function az_trovaOrdine(dati) {
  return rigaAOrdine(trovaRigaPer(foglio(FOGLIO_ORDINI, COLONNE_ORDINI), 'ID Ordine', dati.id));
}

function az_ordiniPerEmail(dati) {
  return leggiTutto(foglio(FOGLIO_ORDINI, COLONNE_ORDINI))
    .filter(function (r) { return String(r['Email'] || '').toLowerCase() === String(dati.email || '').toLowerCase(); })
    .map(rigaAOrdine);
}

function az_tuttiOrdini() {
  return leggiTutto(foglio(FOGLIO_ORDINI, COLONNE_ORDINI)).map(rigaAOrdine);
}

function az_aggiornaStatoOrdine(dati) {
  var f = foglio(FOGLIO_ORDINI, COLONNE_ORDINI);
  var riga = trovaRigaPer(f, 'ID Ordine', dati.id);
  if (!riga) return null;
  aggiornaCella(f, riga._riga, COLONNE_ORDINI, 'Stato', dati.stato);
  riga['Stato'] = dati.stato;
  return rigaAOrdine(riga);
}

function az_trovaCliente(dati) {
  return rigaACliente(trovaRigaPer(foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI), 'Email', dati.email));
}

function az_trovaClientePerCodice(dati) {
  return rigaACliente(trovaRigaPer(foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI), 'Codice', dati.codice));
}

function az_elencoClienti() {
  return leggiTutto(foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI)).map(rigaACliente);
}

function az_creaCliente(dati) {
  scriviRiga(foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI), COLONNE_CLIENTI, clienteARiga(dati.cliente));
  return dati.cliente;
}

function az_aggiornaCliente(dati) {
  var f = foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI);
  var riga = trovaRigaPer(f, 'Email', dati.email);
  if (!riga) return null;
  var c = rigaACliente(riga);
  var p = dati.patch || {};
  ['nome', 'azienda', 'telefono', 'indirizzo', 'linea', 'lingua', 'ultimoOrdine', 'scadenza', 'frequenzaMediaGiorni', 'noteInterne']
    .forEach(function (k) { if (p[k] !== undefined) c[k] = p[k]; });
  if (p.prodotti !== undefined) c.prodotti = p.prodotti;
  if (p.consensoPatch) c.consenso = Object.assign({}, c.consenso, p.consenso, { aggiornato: new Date().toISOString() });
  var nuovaRiga = clienteARiga(c);
  COLONNE_CLIENTI.forEach(function (col, i) { f.getRange(riga._riga, i + 1).setValue(nuovaRiga[col]); });
  c.email = riga['Email'];
  return c;
}

function az_aggiungiPromemoria(dati) {
  var f = foglio(FOGLIO_CLIENTI, COLONNE_CLIENTI);
  var riga = trovaRigaPer(f, 'Email', dati.email);
  if (!riga) return false;
  var promemoria = jsonSicuro(riga['Promemoria (JSON)'], []);
  promemoria.push(dati.voce);
  if (promemoria.length > 20) promemoria = promemoria.slice(-20);
  aggiornaCella(f, riga._riga, COLONNE_CLIENTI, 'Promemoria (JSON)', JSON.stringify(promemoria));
  return true;
}

var AZIONI = {
  creaOrdine: az_creaOrdine, trovaOrdine: az_trovaOrdine, ordiniPerEmail: az_ordiniPerEmail,
  tuttiOrdini: az_tuttiOrdini, aggiornaStatoOrdine: az_aggiornaStatoOrdine,
  trovaCliente: az_trovaCliente, trovaClientePerCodice: az_trovaClientePerCodice,
  elencoClienti: az_elencoClienti, creaCliente: az_creaCliente, aggiornaCliente: az_aggiornaCliente,
  aggiungiPromemoria: az_aggiungiPromemoria,
};

/* ── punto d'ingresso del Web App ── */
function doPost(e) {
  var risposta;
  try {
    var corpo = JSON.parse(e.postData.contents);
    var segretoAtteso = PropertiesService.getScriptProperties().getProperty('SEGRETO');
    if (!segretoAtteso || corpo.segreto !== segretoAtteso) {
      risposta = { ok: false, errore: 'segreto non valido' };
    } else {
      var azione = AZIONI[corpo.azione];
      if (!azione) {
        risposta = { ok: false, errore: 'azione sconosciuta: ' + corpo.azione };
      } else {
        risposta = { ok: true, risultato: azione(corpo.dati || {}) };
      }
    }
  } catch (err) {
    risposta = { ok: false, errore: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(risposta)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, messaggio: 'Web App attivo. Usa POST.' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ══ cambio stato → avvisa il backend, che manda l'email ══════
   Trigger INSTALLABILE (non la funzione onEdit semplice): solo cosi'
   puo' chiamare l'esterno. Va collegato una volta sola con
   installaTrigger(), vedi istruzioni in cima al file. */
function onModificaOrdine(e) {
  try {
    var f = e.range.getSheet();
    if (f.getName() !== FOGLIO_ORDINI) return;
    var intestazioni = f.getRange(1, 1, 1, f.getLastColumn()).getValues()[0];
    var colStato = intestazioni.indexOf('Stato') + 1;
    if (e.range.getColumn() !== colStato || e.range.getRow() === 1) return;

    var riga = e.range.getRow();
    var valori = f.getRange(riga, 1, 1, intestazioni.length).getValues()[0];
    var oggetto = {};
    intestazioni.forEach(function (h, i) { oggetto[h] = valori[i]; });

    /* data spedizione/consegna: registrate da sole quando lo stato
       arriva li', se non gia' compilate a mano prima. */
    var oggi = new Date();
    if (oggetto['Stato'] === 'spedito' && !oggetto['Data Spedizione']) {
      aggiornaCella(f, riga, intestazioni, 'Data Spedizione', oggi);
    }
    if (oggetto['Stato'] === 'consegnato' && !oggetto['Data Consegna']) {
      aggiornaCella(f, riga, intestazioni, 'Data Consegna', oggi);
    }

    var backendUrl = PropertiesService.getScriptProperties().getProperty('BACKEND_URL');
    var segreto = PropertiesService.getScriptProperties().getProperty('SEGRETO');
    if (!backendUrl || !segreto) return;

    UrlFetchApp.fetch(backendUrl, {
      method: 'post',
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        segreto: segreto,
        idOrdine: oggetto['ID Ordine'], stato: oggetto['Stato'], email: oggetto['Email'],
        nome: oggetto['Nome'], lingua: oggetto['Lingua'] || 'it',
        articoli: jsonSicuro(oggetto['Articoli (JSON)'], []),
      }),
    });
  } catch (err) {
    /* un errore qui non deve rompere la modifica del foglio da parte
       dello staff: al massimo l'email di quel cambio stato non parte. */
    console.error(String(err));
  }
}

/* Da eseguire UNA VOLTA dal menu "Esegui" dell'editor Apps Script. */
function installaTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onModificaOrdine') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onModificaOrdine').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
}
