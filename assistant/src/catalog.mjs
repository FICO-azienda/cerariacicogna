/* ══════════════════════════════════════════════════════════════
   catalog.mjs — catalogo in memoria + testo per il system prompt
   ──────────────────────────────────────────────────────────────
   Il catalogo e' piccolo (una novantina di voci) e cambia di rado:
   invece di farlo cercare al modello con un tool, glielo diamo
   intero nel system prompt, in forma compatta e con prompt caching.
   Meno latenza, meno giri, e soprattutto: il modello vede i nomi
   veri, e mostra_prodotti rifiuta tutto cio' che non e' in catalogo.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from './paths.mjs';

const catalogo = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'catalog.json'), 'utf8'));

/* indice per nome normalizzato: serve a validare cio' che il modello propone */
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const indice = new Map();
const tutti = [
  ...catalogo.prodotti,
  ...catalogo.scent_glass.map(g => ({ ...g, linea: 'Home Collection', categoria: 'scent-glass' })),
];
tutti.forEach(p => indice.set(norm(p.nome), p));

/* ── testo compatto per il system prompt ─────────────────────── */
function rigaProdotto(p) {
  const bit = [p.nome];
  if (p.descrizione) bit.push(p.descrizione);
  if (p.varianti && p.varianti.length) bit.push('colori: ' + p.varianti.join(', '));
  /* Segno esplicitamente il formato unico: senza, il modello tende a chiedere
     "quale formato?" anche dove non c'e' nulla da scegliere. */
  if (p.misure && p.misure.length > 1) bit.push('misure fra cui scegliere: ' + p.misure.join(', '));
  else if (!/misure/i.test(p.descrizione || '')) bit.push('FORMATO UNICO');
  bit.push('→ ' + p.pagina);
  return '- ' + bit.join(' · ');
}

function sezione(titolo, righe) {
  return righe.length ? '\n### ' + titolo + '\n' + righe.join('\n') : '';
}

export function catalogoTesto() {
  const perLinea = new Map();
  catalogo.prodotti.forEach(p => {
    const k = p.linea + (p.famiglia ? ' — ' + p.famiglia : '');
    if (!perLinea.has(k)) perLinea.set(k, []);
    perLinea.get(k).push(rigaProdotto(p));
  });

  let out = '## Catalogo prodotti (aggiornato al ' + catalogo.generato + ')\n';
  out += 'Questi e solo questi sono i prodotti esistenti. Non inventarne altri.\n';
  for (const [k, righe] of perLinea) out += sezione(k, righe);

  out += '\n\n## Scent Glass — colore e profumo di serie\n';
  out += 'Quando consigli un colore preciso usa il nome per colore (es. "Scent Glass Red"),\n'
       + 'non la voce generica "Scent Glass": ogni colore ha la sua foto, e mostrare\n'
       + 'quella sbagliata accanto al nome del colore fa una figura pessima.\n';
  out += catalogo.scent_glass.map(g =>
    '- ' + g.colore + ': di serie "' + g.profumo_di_serie + '" (' + g.famiglia_olfattiva + '; ' + g.note + ')'
    + (g.profumi_alternativi.length ? ' · alternative: ' + g.profumi_alternativi.join(', ') : '')
    + ' → ' + g.pagina).join('\n');

  out += '\n\n## Fragrance Library — profumi\n';
  out += catalogo.profumi.map(p =>
    '- ' + p.nome + ' (' + p.famiglia_olfattiva + '): ' + p.descrizione
    + (p.note.length ? ' Note: ' + p.note.join(', ') + '.' : '')).join('\n');

  out += '\n\n## Fragrance Library — note olfattive singole\n';
  out += catalogo.note_olfattive.map(n => '- ' + n.nome + ' (' + n.famiglia + '): ' + n.descrizione).join('\n');

  return out;
}

/* ── validazione: esiste davvero questo prodotto? ────────────── */
export function trova(nome) {
  const k = norm(nome);
  if (indice.has(k)) return indice.get(k);
  /* tolleranza: match parziale su nome intero, ma solo se univoco */
  const cand = [...indice.entries()].filter(([n]) => n.includes(k) || k.includes(n));
  return cand.length === 1 ? cand[0][1] : null;
}

/* ── foto giusta per colore e misura ─────────────────────────
   "Sand piccolo marrone" non deve mostrare il Sand bianco: cerco fra le
   varianti indicizzate quella che contiene tutte le parole chieste. */
export function immagineVariante(prodotto, colore, misura) {
  var varianti = prodotto && prodotto.varianti_immagini;
  if (!varianti || !varianti.length) return prodotto ? (prodotto.immagine || '') : '';

  var cercate = [colore, misura].filter(Boolean)
    .flatMap(v => norm(v).split(' ')).filter(Boolean);
  if (!cercate.length) return prodotto.immagine || varianti[0].file;

  var migliore = null, punteggioMigliore = -1;
  varianti.forEach(v => {
    var punti = cercate.filter(c => v.parole.indexOf(c) >= 0).length;
    if (punti > punteggioMigliore) { punteggioMigliore = punti; migliore = v; }
  });
  /* se non combacia nulla meglio la foto generica che una variante a caso */
  return punteggioMigliore > 0 ? migliore.file : (prodotto.immagine || '');
}

/* ── foto del profumo ────────────────────────────────────────── */
const profumiIdx = new Map();
(catalogo.profumi || []).forEach(p => profumiIdx.set(norm(p.nome), p));

export function trovaProfumo(nome) {
  var k = norm(nome);
  if (!k) return null;
  if (profumiIdx.has(k)) return profumiIdx.get(k);
  var cand = [...profumiIdx.entries()].filter(([n]) => n.includes(k) || k.includes(n));
  return cand.length === 1 ? cand[0][1] : null;
}

export const azienda = catalogo.azienda;
export const generato = catalogo.generato;
export const quanti = tutti.length;
