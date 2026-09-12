#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   build-catalog.mjs — genera data/catalog.json dalle pagine del sito
   ──────────────────────────────────────────────────────────────
   Uso:  node assistant/scripts/build-catalog.mjs
   Va rilanciato ogni volta che si aggiungono o modificano prodotti
   nelle pagine del sito: l'assistente consiglia solo cio' che trova
   qui dentro, quindi un catalogo vecchio significa risposte vecchie.

   Le famiglie della Home Collection sono generate a runtime dal JS
   della pagina (colori × misure) e non sono leggibili staticamente:
   stanno in data/home-collection.json, scritto a mano.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { schedeStatiche, forniture, fragranze, scentGlass, dedup, inEvidenza } from './extract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(here, '..');            /* assistant/ */
const SITE = path.resolve(BASE, '..');            /* radice del sito */

const sito = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const dati = f => JSON.parse(fs.readFileSync(path.join(BASE, 'data', f), 'utf8'));

console.log('Leggo il sito in ' + SITE);

const prodotti = dedup([
  ...schedeStatiche(sito('garden.html'),    { linea: 'Linea Garden',      pagina: 'garden.html' }),
  ...schedeStatiche(sito('liturgico.html'), { linea: 'Articoli Liturgici', pagina: 'liturgico.html' }),
  ...inEvidenza(sito('liturgico.html'), 'liturgico.html'),
  ...forniture([
    { src: sito('forniture.html'), pagina: 'forniture.html' },
    { src: sito('liturgico.html'), pagina: 'liturgico.html' },
  ]),
  ...dati('home-collection.json'),
]);

const { profumi, note_olfattive } = fragranze(sito('fragrance-library.html'), sito('glass-candles.html'));

/* ── indice delle varianti ────────────────────────────────────
   Sand, Rock, Nilla e Metallic hanno una foto per ogni combinazione di
   colore e misura. Invece di indovinare i nomi dei file li scandisco:
   se domani cambiano, l'indice si rifa' da solo. Ogni foto viene indicizzata
   con le parole che compaiono nel suo percorso ("sand marrone piccolo"),
   cosi' la ricerca puo' incrociarle con quanto chiede il cliente. */
function indiceVarianti(cartella) {
  const radice = path.join(SITE, 'images', 'hc', cartella);
  if (!fs.existsSync(radice)) return [];
  const trovate = [];
  (function scendi(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(v => {
      const p = path.join(dir, v.name);
      if (v.isDirectory()) return scendi(p);
      if (!/\.webp$/i.test(v.name)) return;
      /* "…2.webp" sono le viste dall'alto: la scheda vuole la frontale */
      if (/\d\.webp$/i.test(v.name) && !/nilla/.test(cartella)) return;
      if (/nilla alto/.test(p)) return;
      const rel = path.relative(SITE, p).split(path.sep).join('/');
      const parole = rel.toLowerCase()
        .replace(/^images\/hc\//, '').replace(/\.webp$/, '')
        .split(/[\/\s_-]+/).filter(Boolean);
      trovate.push({ file: rel, parole: [...new Set(parole)] });
    });
  })(radice);
  return trovate;
}

const CARTELLE = { 'Sand': 'sand bianco', 'Rock': 'roccia', 'Nilla': 'nilla 8', 'Metallic': 'metallic' };
prodotti.forEach(p => {
  if (p.linea !== 'Home Collection') return;
  if (p.nome === 'Sand')     p.varianti_immagini = [].concat(indiceVarianti('sand bianco'), indiceVarianti('sand grigio'), indiceVarianti('sand marrone'));
  else if (p.nome === 'Rock')     p.varianti_immagini = indiceVarianti('roccia');
  else if (p.nome === 'Nilla')    p.varianti_immagini = [].concat(indiceVarianti('nilla 8'), indiceVarianti('nilla 10'), indiceVarianti('nilla 12'));
  else if (p.nome === 'Metallic') p.varianti_immagini = indiceVarianti('metallic');
});

const catalogo = {
  generato: new Date().toISOString().slice(0, 10),
  azienda: dati('azienda.json'),
  prodotti,
  profumi,
  note_olfattive,
  scent_glass: scentGlass(sito('glass-candles.html')),
};

const out = path.join(BASE, 'data', 'catalog.json');
fs.writeFileSync(out, JSON.stringify(catalogo, null, 1));

console.log('  prodotti     ' + prodotti.length);
console.log('  profumi      ' + profumi.length);
console.log('  note         ' + note_olfattive.length);
console.log('  scent glass  ' + catalogo.scent_glass.length);
console.log('Scritto ' + path.relative(SITE, out) + '  (' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB)');

if (!prodotti.length) { console.error('\nATTENZIONE: nessun prodotto trovato. Il markup delle schede e\' cambiato?'); process.exit(1); }
