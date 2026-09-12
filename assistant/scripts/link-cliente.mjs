#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   link-cliente.mjs — crea, elenca e revoca i link personali
   ──────────────────────────────────────────────────────────────
     node assistant/scripts/link-cliente.mjs archivio
         mostra chi ha gia' scritto dal sito, con un numero
     node assistant/scripts/link-cliente.mjs crea 3
         crea il link per la richiesta numero 3 dell'archivio
     node assistant/scripts/link-cliente.mjs crea-a-mano
         crea un link inserendo i dati a mano (cliente storico)
     node assistant/scripts/link-cliente.mjs elenco
         i link attivi
     node assistant/scripts/link-cliente.mjs revoca CODICE
         disattiva un link (subito, per sempre)
   ══════════════════════════════════════════════════════════════ */
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { leggiRichieste } from '../src/archivio.mjs';
import { elenco, aggiungi, revoca } from '../src/clienti.mjs';
import { trova, immagineVariante, trovaProfumo } from '../src/catalog.mjs';

const SITO = process.env.CC_SITO || 'https://www.cerariacicogna.com';
const link = codice => SITO.replace(/\/$/, '') + '/index.html?c=' + codice;

const G = t => '\x1b[1m' + t + '\x1b[0m';
const g = t => '\x1b[2m' + t + '\x1b[0m';

/* L'archivio salva solo nome e quantita'. Qui ricucio le foto dal
   catalogo, cosi' la Selezione del cliente si riapre completa. */
function arricchisci(articoli) {
  return (articoli || []).map(a => {
    const p = trova(a.nome);
    const prodotto = Array.isArray(p) ? p[0] : p;
    if (!prodotto) return { nome: a.nome, quantita: a.quantita || 0 };
    const parole = a.nome.toLowerCase().split(/\s+/);
    const colore = (prodotto.varianti || []).find(v => parole.includes(v.toLowerCase()));
    const misura = (prodotto.misure || []).find(m => parole.includes(m.toLowerCase()));
    const prof = trovaProfumo(a.profumo || '');
    return {
      nome: a.nome,
      quantita: a.quantita || 0,
      categoria: prodotto.categoria || '',
      pagina: prodotto.pagina || '',
      immagine: immagineVariante(prodotto, colore, misura) || prodotto.immagine || '',
      imgProfumo: (prof && (prof.immagine || prof.img)) || '',
    };
  });
}

function stampaLink(v) {
  console.log('');
  console.log(G('  ' + [v.nome, v.azienda].filter(Boolean).join(' — ')));
  console.log('  ' + link(v.codice));
  console.log(g('  scade il ' + new Date(v.scadenza).toLocaleDateString('it-IT') +
                ' · codice ' + v.codice));
  console.log('');
  console.log(g('  Testo pronto da incollare in una mail:'));
  console.log('  ────────────────────────────────────────────');
  console.log('  Gentile ' + (v.nome || 'cliente') + ',');
  console.log('  per riordinare le ' + (v.prodotti || []).length + ' referenze di sempre le lasciamo');
  console.log('  un collegamento riservato: si apre gia\' compilato, senza');
  console.log('  registrazione e senza password.');
  console.log('');
  console.log('  ' + link(v.codice));
  console.log('');
  console.log('  Il collegamento e\' personale: la invitiamo a non inoltrarlo.');
  console.log('  Cereria Cicogna');
  console.log('  ────────────────────────────────────────────');
  console.log('');
}

const [, , comando, arg] = process.argv;

if (comando === 'archivio') {
  const r = leggiRichieste();
  if (!r.length) { console.log('\n  Nessuna richiesta in archivio.\n'); process.exit(0); }
  console.log('');
  r.forEach((v, i) => {
    console.log('  ' + G(String(i + 1).padStart(3)) + '  ' +
      (v.nome || '—').padEnd(24) + (v.azienda || '').padEnd(24) +
      g((v.articoli || []).length + ' art.  ' + (v.data || '').slice(0, 10)));
  });
  console.log('\n  ' + g('poi: node assistant/scripts/link-cliente.mjs crea <numero>') + '\n');

} else if (comando === 'crea') {
  const r = leggiRichieste();
  const v = r[Number(arg) - 1];
  if (!v) { console.error('\n  Numero non valido. Usa "archivio" per vedere la lista.\n'); process.exit(1); }
  stampaLink(aggiungi({
    nome: v.nome, azienda: v.azienda, email: v.email,
    linea: v.linea, prodotti: arricchisci(v.articoli),
  }));

} else if (comando === 'crea-a-mano') {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const nome = await rl.question('  Nome e cognome: ');
  const azienda = await rl.question('  Azienda (invio per saltare): ');
  const email = await rl.question('  Email: ');
  const linea = await rl.question('  Linea (Home Collection / Garden / Liturgica / ...): ');
  console.log('\n  Prodotti abituali, uno per riga. Riga vuota per finire.');
  console.log(g('  formato:  nome del prodotto | quantita | profumo\n'));
  const prodotti = [];
  for (;;) {
    const riga = (await rl.question('  > ')).trim();
    if (!riga) break;
    const [n, q, pr] = riga.split('|').map(s => (s || '').trim());
    prodotti.push({ nome: n, quantita: Number(q) || 0, profumo: pr || '' });
  }
  rl.close();
  stampaLink(aggiungi({ nome, azienda, email, linea, prodotti: arricchisci(prodotti) }));

} else if (comando === 'elenco') {
  const c = elenco();
  if (!c.length) { console.log('\n  Nessun link creato.\n'); process.exit(0); }
  console.log('');
  c.forEach(v => {
    const morto = v.revocato ? 'REVOCATO' :
      (new Date(v.scadenza) < new Date() ? 'SCADUTO' : '');
    console.log('  ' + (v.nome || '—').padEnd(24) + (v.azienda || '').padEnd(22) +
      g(v.codice.slice(0, 8) + '…  ') + (morto ? G(morto) : g('attivo')));
  });
  console.log('');

} else if (comando === 'revoca') {
  console.log(revoca(arg) ? '\n  Link revocato.\n' : '\n  Codice non trovato.\n');

} else {
  console.log(`
  ${G('Link personali')} — un indirizzo che apre il sito gia' compilato
  per un cliente, senza registrazione.

    ${G('archivio')}          chi ha scritto dal sito
    ${G('crea')} <numero>     crea il link per quella richiesta
    ${G('crea-a-mano')}       crea il link per un cliente storico
    ${G('elenco')}            i link gia' creati
    ${G('revoca')} <codice>   disattiva un link

  Il link non contiene i dati del cliente: contiene solo un codice
  casuale che il server sa tradurre. Chi ha il link vede quei dati,
  quindi va trattato come una chiave di casa.
`);
}
