/* ══════════════════════════════════════════════════════════════
   motore-promemoria.mjs — chi e' "scaduto" oggi, e per cosa
   ──────────────────────────────────────────────────────────────
   Pura logica, senza email ne' scrittura: prende clienti + storico
   + regole e restituisce l'elenco dei promemoria da mandare oggi.
   Lo scheduler (scheduler.mjs) la chiama e si occupa del resto
   (token, invio, registrazione). Separata cosi' si puo' testare con
   dati finti, senza toccare file ne' rete — vedi tests/.

   ── Una scelta dichiarata: si lavora per CATEGORIA, non per singolo
   prodotto. E' l'unica granularita' che il catalogo offre oggi (vedi
   js/selection.js, che assegna liturgico / garden / home-collection /
   private-label e nient'altro): un intervallo per "Ceri Bianco 40"
   diverso da "Ceri Rosso 40" richiederebbe prima di marcare le pagine
   prodotto con una categoria piu' fine, cosa che oggi non esiste.

   ── L'intervallo di riferimento (categoria o personale) si applica
   all'ULTIMO ordine di quella categoria, non a ognuno: se il cliente
   ha gia' ricomprato qualcosa della stessa categoria, quell'acquisto
   piu' recente diventa il nuovo riferimento e il promemoria sul
   vecchio ordine semplicemente non viene piu' generato. E' cosi' che
   si rispetta "non mandare un promemoria se ha gia' riordinato nel
   frattempo", senza bisogno di un controllo separato.
   ══════════════════════════════════════════════════════════════ */

/* ── stagionalita': la finestra puo' attraversare il capodanno
   (es. "11-01" -> "02-28"), quindi il confronto non e' un semplice
   "fra due date" ma "fra due punti su un anno che si ripete". ── */
function dentroStagione(stagionalita, oggi) {
  if (!stagionalita) return true;
  const mmgg = d => (d.getMonth() + 1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0');
  const x = mmgg(oggi), da = stagionalita.da, a = stagionalita.a;
  return da <= a ? (x >= da && x <= a) : (x >= da || x <= a);
}

const giorniTra = (a, b) => Math.floor((b.getTime() - Date.parse(a)) / (24 * 3600 * 1000));

/* Ultima richiesta che contiene almeno un articolo della categoria data,
   e gli articoli di quella categoria dentro quella richiesta (esclusi gia'
   tolti, se la regola ne prevede). */
function ultimoOrdinePerCategoria(storico, categoria, esclusi) {
  const listaEsclusi = (esclusi || []).map(e => e.toLowerCase());
  for (let i = storico.length - 1; i >= 0; i--) {
    const articoli = (storico[i].articoli || []).filter(a =>
      String(a.categoria || '').toLowerCase() === categoria
      && !listaEsclusi.some(e => String(a.nome || '').toLowerCase().includes(e)));
    if (articoli.length) return { richiesta: storico[i], articoli };
  }
  return null;
}

/* Tutte le categorie che compaiono almeno una volta nello storico di un
   cliente: solo per quelle ha senso valutare un promemoria. */
function categorieDelCliente(storico) {
  const cats = new Set();
  storico.forEach(r => (r.articoli || []).forEach(a => { if (a.categoria) cats.add(String(a.categoria).toLowerCase()); }));
  return [...cats];
}

/* Un candidato per categoria: dice SE e QUANDO un promemoria e' previsto,
   dovuto oggi o no. E' il nucleo unico da cui derivano sia "chi e' dovuto
   oggi" (valutaCliente, per lo scheduler) sia "quando sara' il prossimo"
   (prossimoPromemoria, per la colonna omonima nella dashboard admin) —
   stessa regola, letta in due modi, non due implementazioni da tenere
   allineate a mano. */
function candidatiCliente(cliente, storico, regole, oggi) {
  const candidati = [];
  if (!cliente || !cliente.consenso || cliente.consenso.promemoriaRiacquisto === false) return candidati;
  if (!storico || !storico.length) return candidati;

  for (const categoria of categorieDelCliente(storico)) {
    const regola = regole[categoria];
    if (!regola || !regola.attivo) continue;

    const trovato = ultimoOrdinePerCategoria(storico, categoria, regola.esclusi);
    if (!trovato) continue;
    const { richiesta, articoli } = trovato;

    const quantitaTotale = articoli.reduce((s, a) => s + (a.quantita || 0), 0);
    if (regola.sogliaMinima && quantitaTotale < regola.sogliaMinima) continue;

    const giaInviati = (cliente.promemoria || [])
      .filter(p => p.richiestaTs === richiesta.ts && p.categoria === categoria);
    if (giaInviati.length >= regola.maxPromemoria) continue;

    const tipo = giaInviati.length === 0 ? 'primo' : 'secondo';
    if (tipo === 'secondo' && !regola.secondoDopo) continue;

    const baseGiorni = cliente.frequenzaMediaGiorni || regola.giorni;
    const sogliaGiorni = tipo === 'primo' ? baseGiorni : baseGiorni + regola.secondoDopo;
    const dataStimata = new Date(Date.parse(richiesta.ts) + sogliaGiorni * 24 * 3600 * 1000);

    candidati.push({
      categoria, tipo, richiesta, articoli, dataStimata,
      dovutoOra: giorniTra(richiesta.ts, oggi) >= sogliaGiorni && dentroStagione(regola.stagionalita, oggi),
      frequenzaUsata: cliente.frequenzaMediaGiorni ? 'personale' : 'categoria',
    });
  }
  return candidati;
}

/* La funzione pura: nessun file, nessuna email. cliente e storico sono
   gia' quelli di UNA persona; regole e' l'intero oggetto per categoria;
   oggi e' iniettabile per i test. */
export function valutaCliente(cliente, storico, regole, oggi = new Date()) {
  return candidatiCliente(cliente, storico, regole, oggi)
    .filter(c => c.dovutoOra)
    .map(c => ({
      email: cliente.email, nome: cliente.nome || '', codiceCliente: cliente.codice,
      lingua: cliente.lingua || 'it',
      categoria: c.categoria, tipo: c.tipo, richiesta: c.richiesta, articoli: c.articoli,
      frequenzaUsata: c.frequenzaUsata,
    }));
}

/* Il piu' vicino fra i promemoria non ancora dovuti (o null se non ce ne
   sono): per la colonna "Prossimo reminder" della dashboard, non per
   l'invio — quello resta valutaCliente/promemoriaDovuti. */
export function prossimoPromemoria(cliente, storico, regole, oggi = new Date()) {
  const futuri = candidatiCliente(cliente, storico, regole, oggi).filter(c => !c.dovutoOra);
  if (!futuri.length) return null;
  futuri.sort((a, b) => a.dataStimata - b.dataStimata);
  return { categoria: futuri[0].categoria, dataStimata: futuri[0].dataStimata };
}

/* ── orchestrazione: prende TUTTI i clienti attivi e il loro storico.
   Le funzioni che leggono i dati sono iniettate (non importate qui
   dentro) cosi' questo file resta testabile senza toccare ne' filesystem
   ne' rete — chi lo usa per davvero (scheduler.mjs) passa le funzioni
   dell'adattatore ordini (assistant/src/ordini/), che oggi parlano con
   Google Sheets. Async perche' quell'adattatore fa chiamate di rete;
   valutaCliente e candidatiCliente restano pure e sincrone. */
export async function promemoriaDovuti({ clientiAttivi, storicoPerEmail, regole, oggi = new Date() }) {
  const risultati = [];
  for (const cliente of await clientiAttivi()) {
    const storico = await storicoPerEmail(cliente.email);
    risultati.push(...valutaCliente(cliente, storico, regole, oggi));
  }
  return risultati;
}
