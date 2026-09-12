#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   genera-percorso.mjs — costruisce l'albero del percorso guidato
   ──────────────────────────────────────────────────────────────
   Le domande non sono scritte a mano: nascono dal catalogo. Cosi'
   coprono tutto e restano vere quando un prodotto cambia, invece
   di scollarsi in silenzio come farebbe un elenco compilato una
   volta sola.

   Esce assistant/widget/percorso.json, che il widget legge da
   fermo: nessuna chiamata all'API, costo zero.

     node assistant/scripts/genera-percorso.mjs
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { BASE } from '../src/paths.mjs';

const catalogo = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'catalog.json'), 'utf8'));

/* ── l'inglese dei termini di catalogo ────────────────────────
   Esplicito, non a regole: "Cera bianca · Misure 12 · 16 · 19 cm"
   spezzato sui separatori diventerebbe un pasticcio, e un errore di
   traduzione in un listino non si vede finche' non lo legge un
   cliente. Cio' che manca resta in italiano e viene segnalato qui
   sotto, cosi' un prodotto nuovo non passa inosservato. */
const VOC = JSON.parse(fs.readFileSync(path.join(BASE, 'config', 'traduzioni.json'), 'utf8'));
const mancanti = new Set();
function en(it) {
  const v = String(it == null ? '' : it).trim();
  if (!v) return '';
  if (VOC[v]) return VOC[v];
  mancanti.add(v);
  return v;                       /* meglio l'italiano che una traduzione inventata */
}
const USCITA = path.join(BASE, 'widget', 'percorso.json');

/* ── le famiglie olfattive del catalogo sono 20 sfumature diverse:
      in un menu diventerebbero un muro. Le raccolgo in sei gruppi
      che una persona riconosce senza essere un profumiere. ── */
const GRUPPI = [
  { id: 'floreale', it: 'Floreale',            en: 'Floral' },
  { id: 'agrumato', it: 'Agrumato e fresco',   en: 'Citrus and fresh' },
  { id: 'verde',    it: 'Verde e aromatico',   en: 'Green and aromatic' },
  { id: 'legnoso',  it: 'Legnoso e caldo',     en: 'Woody and warm' },
  { id: 'dolce',    it: 'Dolce e goloso',      en: 'Sweet and gourmand' },
  { id: 'incenso',  it: 'Incenso e resine',    en: 'Incense and resins' },
];

/* Nel catalogo la famiglia olfattiva e' scritta con la nota dominante
   per prima — "citrus floral green" e' prima di tutto un agrume. Guardo
   quella, non una parola qualsiasi: cercando ovunque, "citrus floral
   green" finiva fra i verdi e l'agrumato restava con un profumo solo. */
const DOMINANTE = {
  powdery: 'floreale', floral: 'floreale',
  citrus: 'agrumato', marine: 'agrumato',
  green: 'verde', aromatic: 'verde', balsamic: 'verde',
  woody: 'legnoso', tobacco: 'legnoso', amber: 'legnoso', oriental: 'legnoso',
  gourmand: 'dolce', fruity: 'dolce', creamy: 'dolce', tropical: 'dolce', spicy: 'dolce',
  resin: 'incenso', incense: 'incenso',
};

function gruppoDi(f) {
  const parole = String(f.famiglia_olfattiva || '').toLowerCase().split(/\s+/).filter(Boolean);
  for (const parola of parole) if (DOMINANTE[parola]) return DOMINANTE[parola];
  return 'floreale';
}

const profumi = catalogo.profumi.map(f => ({
  nome: f.nome,
  gruppo: gruppoDi(f),
  famiglia: f.famiglia_olfattiva || '',
  note: (f.note || []).slice(0, 4),
  note_en: (f.note || []).slice(0, 4).map(en),
  descrizione: f.descrizione || '',
  immagine: f.immagine || '',
}));

/* ── i prodotti, per linea e famiglia ── */
const perLinea = {};
catalogo.prodotti.forEach(p => {
  const l = p.linea || 'Altro';
  const f = p.famiglia || p.categoria || 'Altro';
  perLinea[l] = perLinea[l] || {};
  (perLinea[l][f] = perLinea[l][f] || []).push({
    nome: p.nome,                 /* i nomi dei prodotti sono nomi propri: non si traducono */
    descrizione: p.descrizione || '',
    descrizione_en: p.descrizione ? en(p.descrizione) : '',
    varianti_en: (p.varianti || []).map(en),
    misure_en: (p.misure || []).map(en),
    pagina: p.pagina || '',
    immagine: p.immagine || '',
    categoria: p.categoria || '',
    varianti: p.varianti || [],
    misure: p.misure || [],
    varianti_immagini: p.varianti_immagini || [],
  });
});

/* Solo la Home Collection si abbina a una profumazione: i lumini da
   chiesa e le citronelle hanno la loro e non si sceglie. */
const CON_PROFUMO = new Set(['Home Collection']);

const linee = Object.entries(perLinea).map(([nome, famiglie]) => ({
  nome,
  chiedeProfumo: CON_PROFUMO.has(nome),
  famiglie: Object.entries(famiglie).map(([f, prodotti]) => ({ nome: f, nome_en: en(f), prodotti })),
}));

const dati = {
  generato: new Date().toISOString().slice(0, 10),
  daCatalogoDel: catalogo.generato,
  gruppiProfumo: GRUPPI.map(g => ({ id: g.id, it: g.it, en: g.en })),
  profumi,
  linee,
};

fs.mkdirSync(path.dirname(USCITA), { recursive: true });
fs.writeFileSync(USCITA, JSON.stringify(dati));

const nProd = catalogo.prodotti.length;
const nFam = linee.reduce((s, l) => s + l.famiglie.length, 0);
console.log(`percorso.json — ${linee.length} linee, ${nFam} famiglie, ${nProd} prodotti, ${profumi.length} profumazioni`);
GRUPPI.forEach(g => {
  const n = profumi.filter(p => p.gruppo === g.id).length;
  console.log('   ' + g.it.padEnd(22) + n);
});
console.log('   ' + (Math.round(fs.statSync(USCITA).size / 1024)) + ' KB');
if (mancanti.size) {
  console.log('\n   ' + mancanti.size + ' termini SENZA inglese — restano in italiano.');
  console.log('   Aggiungili a assistant/config/traduzioni.json:');
  [...mancanti].slice(0, 20).forEach(m => console.log('     · ' + m.slice(0, 90)));
} else {
  console.log('   inglese: completo');
}
