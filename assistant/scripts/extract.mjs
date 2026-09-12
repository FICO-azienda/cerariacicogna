/* ══════════════════════════════════════════════════════════════
   extract.mjs — logica di lettura del catalogo dalle pagine HTML
   ──────────────────────────────────────────────────────────────
   Funzioni pure: ricevono il testo dei file, non toccano il disco.
   Il sito e' statico e il catalogo vive dentro l'HTML in due forme:
     1. schede scritte a mano  → <article class="product-card">
     2. array di dati nel JS   → const PRODUCTS / PERFUMES / VARIANTS
   Qui si leggono entrambe.  Nessuna dipendenza esterna.
   ══════════════════════════════════════════════════════════════ */

/* ripulisce un frammento di HTML e lo riduce a testo leggibile */
export function testo(html) {
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')        /* nelle card il nome va a capo */
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&egrave;/g, 'è').replace(/&agrave;/g, 'à')
    .replace(/\s+/g, ' ').trim();
}

/* ── 1. schede statiche <article class="product-card"> ───────── */
export function schedeStatiche(src, meta) {
  const out = [];
  const re = /<article class="product-card[^"]*"([^>]*)>([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(src))) {
    const attrs = m[1], body = m[2];
    const pick = cls => {
      const r = new RegExp('<[a-z0-9]+ class="' + cls + '"[^>]*>([\\s\\S]*?)<\\/[a-z0-9]+>');
      const x = body.match(r);
      return x ? testo(x[1]) : '';
    };
    const nome = pick('product-card-name');
    if (!nome) continue;
    const href = (body.match(/href="([^"]+)"/) || ['', ''])[1];
    const img  = (body.match(/<img[^>]+src="([^"]+)"/) || ['', ''])[1];
    out.push({
      nome,
      linea: meta.linea,
      categoria: (attrs.match(/data-category="([^"]*)"/) || ['', ''])[1],
      famiglia: pick('product-card-tag'),
      descrizione: pick('product-card-type'),
      pagina: href || meta.pagina,
      immagine: img.split('?')[0],
    });
  }
  return out;
}

/* ── 2. array e oggetti letterali dentro il JS della pagina ──── */
/* Ritaglia `const NOME = [ … ]` contando le parentesi e saltando
   quelle che compaiono dentro stringhe o commenti.                */
export function letterale(src, nome) {
  const dich = new RegExp('(?:const|let|var)\\s+' + nome + '\\s*=');
  const i = src.search(dich);
  if (i < 0) return null;
  const iq = src.indexOf('[', i), ig = src.indexOf('{', i);
  const apre = (iq >= 0 && (iq < ig || ig < 0)) ? '[' : '{';
  const chiude = apre === '[' ? ']' : '}';
  const start = apre === '[' ? iq : ig;
  if (start < 0) return null;
  let liv = 0, str = null, cm = null;
  for (let k = start; k < src.length; k++) {
    const c = src[k], n = src[k + 1];
    if (cm) {
      if (cm === '//' && c === '\n') cm = null;
      else if (cm === '/*' && c === '*' && n === '/') { cm = null; k++; }
      continue;
    }
    if (str) { if (c === '\\') k++; else if (c === str) str = null; continue; }
    if (c === '/' && n === '/') { cm = '//'; continue; }
    if (c === '/' && n === '*') { cm = '/*'; continue; }
    if (c === '"' || c === "'" || c === '`') { str = c; continue; }
    if (c === apre) liv++;
    else if (c === chiude) { liv--; if (liv === 0) return src.slice(start, k + 1); }
  }
  return null;
}

export function valuta(src, nome) {
  const txt = letterale(src, nome);
  if (!txt) return null;
  try { return new Function('return (' + txt + ')')(); }
  catch (e) { return null; }
}

/* ── prodotti "in evidenza" fuori dalla griglia ───────────────
   Il Lumino Carta sta in un blocco suo (.lumino-spot), non fra le schede:
   senza questo l'assistente rispondeva che non esiste. Si legge dal markup,
   cosi' se cambiano testo o foto il catalogo si aggiorna da solo. */
export function inEvidenza(src, pagina) {
  const out = [];
  const re = /<section class="lumino-spot"[\s\S]*?<\/section>/g;
  let m;
  while ((m = re.exec(src))) {
    const blocco = m[0];
    const titolo = (blocco.match(/<h2 class="lumino-spot-title">([^<]+)<\/h2>/) || [, ''])[1].trim();
    if (!titolo) continue;
    const occhiello = testo((blocco.match(/<span class="lumino-spot-eyebrow">([\s\S]*?)<\/span>/) || [, ''])[1]);
    const corpo = testo((blocco.match(/<p class="lumino-spot-body">([\s\S]*?)<\/p>/) || [, ''])[1]);
    const punti = [...blocco.matchAll(/<li>([^<]+)<\/li>/g)].map(x => testo(x[1]));
    const img = (blocco.match(/<img[^>]+src="([^"]+)"/) || [, ''])[1].split('?')[0];
    out.push({
      nome: titolo,
      linea: 'Articoli Liturgici',
      categoria: 'lumini',
      famiglia: occhiello || 'Novità',
      descrizione: corpo + (punti.length ? ' · ' + punti.join(' · ') : ''),
      pagina,
      immagine: img,
    });
  }
  return out;
}

/* ── forniture liturgiche (array PRODUCTS) ───────────────────── */
export function forniture(sorgenti) {
  const out = [];
  sorgenti.forEach(s => {
    const arr = valuta(s.src, 'PRODUCTS') || [];
    arr.forEach(p => {
      if (!p || !p.name) return;
      /* la foto e' quella della variante di default, come nella scheda del sito */
      const vars = p.vars || [];
      const def = vars.find(v => v.id === p.def) || vars[0];
      out.push({
        nome: p.name,
        linea: 'Articoli Liturgici',
        categoria: p.line || 'forniture',
        famiglia: p.tag || '',
        descrizione: p.desc || '',
        varianti: vars.map(v => v.label).filter(Boolean),
        pagina: s.pagina,
        immagine: def && def.file ? 'images/' + def.file : '',
      });
    });
  });
  return dedup(out);
}

/* ── fragranze e note olfattive (fragrance-library.html) ─────── */
export function fragranze(src, srcGlass) {
  const profumi = valuta(src, 'PERFUMES') || [];
  const note    = valuta(src, 'NOTES') || [];
  const nomeNota = s => { const n = note.find(x => x.s === s); return n ? n.n : s; };

  /* le foto dei profumi stanno nella mappa PERF di glass-candles.html */
  const perf = (srcGlass ? valuta(srcGlass, 'PERF') : null) || {};
  const fotoDi = nome => {
    for (const k in perf) {
      if (perf[k] && perf[k].n === nome) return String(perf[k].img || '').split('?')[0];
    }
    return '';
  };

  return {
    profumi: profumi.map(p => ({
      nome: p.n,
      famiglia_olfattiva: p.f,
      note: (p.notes || []).map(nomeNota),
      descrizione: p.d,
      immagine: fotoDi(p.n),
      pagina: 'fragrance-library.html',
    })),
    note_olfattive: note.map(n => ({ nome: n.n, famiglia: n.f, descrizione: n.d })),
  };
}

/* ── Scent Glass: colore ↔ profumo di serie ──────────────────── */
export function scentGlass(src) {
  const variants = valuta(src, 'VARIANTS') || [];
  const perf     = valuta(src, 'PERF') || {};
  const assoc    = valuta(src, 'ASSOC') || {};
  return variants.map(v => ({
    nome: 'Scent Glass ' + v.color,
    colore: v.color,
    profumo_di_serie: v.perfume,
    famiglia_olfattiva: v.family,
    note: v.notes,
    descrizione: v.perfumeDesc,
    profumi_alternativi: (assoc[v.id] || []).map(id => (perf[id] || {}).n).filter(Boolean),
    pagina: 'glass-candles.html#' + v.id,
    immagine: 'images/glass-' + v.id + '-front.webp',  /* frontale, non dall'alto: e' quella che mostriamo nelle schede */
  }));
}

export function dedup(arr) {
  const visti = {};
  return arr.filter(x => {
    const k = x.linea + '|' + x.nome;
    if (visti[k]) return false;
    visti[k] = 1;
    return true;
  });
}
