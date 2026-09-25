/* ══════════════════════════════════════════════════════════════
   admin/ordini-endpoint.mjs — l'elenco degli ordini, modificabile
   ──────────────────────────────────────────────────────────────
   Tre cose, tutte dietro la password del pannello:

   GET  /api/admin/ordini            l'elenco, dal piu' recente
   POST /api/admin/ordini/stato      segna pagato, spedito, il prezzo
   POST /api/admin/ordini/nuovo      aggiunge un ordine arrivato per
                                     telefono o di persona

   L'ultima serve piu' di quanto sembri: senza, chi ordina fuori dal
   sito non esiste per il sistema e non ricevera' mai un promemoria.
   Crea anche la scheda cliente, quindi da quel momento e' come se
   avesse scritto dal modulo — link di riordino compreso.
   ══════════════════════════════════════════════════════════════ */
import { sessioneValida, tokenDaRichiesta } from './auth.mjs';
import { corpoJSON } from '../corpo-richiesta.mjs';
import { cors } from '../cors.mjs';
import { registra } from '../log.mjs';
import { creaOrdine, tuttiOrdini, impostaDatiOrdine, daRichiesta, aggiornaFrequenza } from '../ordini/index.mjs';
import { calcolaFrequenzaMedia } from '../archivio.mjs';
import { emailValida } from '../mailer.mjs';

const testo = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

export async function gestisciOrdiniAdmin(req, res, azione, filtri = {}) {
  cors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  const invia = (n, corpo) => {
    res.statusCode = n;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, private');
    res.end(JSON.stringify(corpo));
  };

  if (!sessioneValida(tokenDaRichiesta(req))) return invia(401, { ok: false });

  /* ── il catalogo, diviso per linea ──
     Serve al menu a tendina del modulo "ordine preso a voce": scrivere il
     nome a mano porta a "Cero pasquale", "cero pasquale", "Cero Pasq." —
     tre prodotti diversi per il motore dei promemoria, che confronta le
     categorie e i nomi. Scegliendo da un elenco il nome e' sempre lo stesso. */
  if (azione === 'prodotti' && req.method === 'GET') {
    const { prodotti } = await import('../catalog.mjs');

    /* Il pannello ragiona per categoria di regola (liturgico, garden...),
       il catalogo per linea commerciale: questa e' la corrispondenza. Serve
       perche' nel riquadro del liturgico si possano escludere soltanto
       prodotti liturgici. */
    const PER_REGOLA = {
      'liturgico': 'Articoli Liturgici',
      'garden': 'Linea Garden',
      'home-collection': 'Home Collection',
    };
    const ETICHETTE = {
      lumini: 'Lumini', angelo: 'Linea Angelo', papa: 'Linea Papa', aure: 'Linea Aure',
      elettriche: 'Candele elettriche', 'accessori-candele': 'Accessori per candele',
      'accessori-altri': 'Altri accessori', cerabianca: 'Cera bianca', citronelle: 'Citronelle',
      ricariche: 'Ricariche', ceri: 'Ceri', glass: 'Glass', sand: 'Sand', rock: 'Rock', metallic: 'Metallic',
    };

    const tutti = prodotti();
    const perLinea = new Map();
    tutti.forEach(p => {
      const linea = p.linea || 'Altro';
      if (!perLinea.has(linea)) perLinea.set(linea, new Map());
      const sotto = perLinea.get(linea);
      const g = ETICHETTE[p.categoria] || p.categoria || 'Altro';
      if (!sotto.has(g)) sotto.set(g, new Set());
      sotto.get(g).add(p.nome);
    });

    const impacchetta = linea => {
      const sotto = perLinea.get(linea);
      if (!sotto) return [];
      return [...sotto.entries()]
        .map(([gruppo, nomi]) => ({ gruppo, prodotti: [...nomi].sort((a, b) => a.localeCompare(b, 'it')) }))
        .sort((a, b) => a.gruppo.localeCompare(b.gruppo, 'it'));
    };

    return invia(200, {
      ok: true,
      /* per il menu del modulo "ordine preso a voce": tutte le linee */
      gruppi: [...perLinea.keys()].map(linea => ({
        linea, prodotti: impacchetta(linea).reduce((acc, g) => acc.concat(g.prodotti), []),
      })),
      /* per le esclusioni: solo i prodotti della categoria di quella regola */
      perCategoria: Object.keys(PER_REGOLA).reduce((acc, chiave) => {
        acc[chiave] = impacchetta(PER_REGOLA[chiave]);
        return acc;
      }, {}),
    });
  }

  /* ── elenco ── */
  if (azione === '' && req.method === 'GET') {
    const limite = Math.min(parseInt(filtri.limite, 10) || 100, 500);
    const ordini = (await tuttiOrdini())
      .slice()
      .sort((a, b) => String(b.ts).localeCompare(String(a.ts)))
      .slice(0, limite)
      .map(o => ({
        id: o.id, ts: o.ts, nome: o.nome, email: o.email, azienda: o.azienda,
        linea: o.linea, origine: o.origine || 'sito',
        articoli: (o.articoli || []).map(a => ({ nome: a.nome, quantita: a.quantita || 0 })),
        stato: o.stato || '', statoPagamento: o.statoPagamento || '',
        prezzoTotale: o.prezzoTotale || '', note: o.note || '',
      }));
    return invia(200, { ok: true, ordini });
  }

  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }

  let dati;
  try { dati = await corpoJSON(req); } catch (e) { return invia(400, { ok: false, errore: 'dati non validi' }); }

  /* ── segna pagato / spedito / prezzo ── */
  if (azione === 'stato') {
    const id = testo(dati.id, 60);
    if (!id) return invia(400, { ok: false, errore: 'id mancante' });
    const patch = {};
    ['stato', 'statoPagamento', 'note'].forEach(k => {
      if (dati[k] !== undefined) patch[k] = testo(dati[k], 200);
    });
    if (dati.prezzoTotale !== undefined) {
      /* si accetta sia "1.234,50" sia "1234.50": chi scrive a mano usa la virgola */
      const grezzo = testo(dati.prezzoTotale, 20).replace(/[^0-9,.\-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
      patch.prezzoTotale = grezzo === '' ? '' : String(Number(grezzo) || 0);
    }
    const ordine = await impostaDatiOrdine(id, patch);
    if (!ordine) return invia(500, { ok: false, errore: 'non salvato' });
    registra({ evento: 'admin-ordine-stato', id, patch });
    return invia(200, { ok: true, ordine });
  }

  /* ── ordine preso fuori dal sito ── */
  if (azione === 'nuovo') {
    const d = {
      nome: testo(dati.nome, 80), cognome: testo(dati.cognome, 80),
      email: testo(dati.email, 160), azienda: testo(dati.azienda, 120),
      linea: testo(dati.linea, 60), messaggio: testo(dati.messaggio, 1000),
      articoli: (Array.isArray(dati.articoli) ? dati.articoli : []).slice(0, 30).map(a => ({
        nome: testo(a && a.nome, 120),
        quantita: parseInt(a && a.quantita, 10) > 0 ? parseInt(a.quantita, 10) : 0,
        categoria: testo(a && a.categoria, 40) || testo(dati.linea, 40),
      })).filter(a => a.nome),
    };
    if (!d.nome) return invia(400, { ok: false, errore: 'manca il nome' });
    if (!d.articoli.length) return invia(400, { ok: false, errore: 'manca almeno un articolo' });
    /* L'email non e' obbligatoria — al telefono capita di non averla — ma
       senza non si puo' mandare nessun promemoria: va detto a chi compila. */
    if (d.email && !emailValida(d.email)) return invia(400, { ok: false, errore: 'email non valida' });

    const ordine = await creaOrdine({ ...d, promemoriaRif: '', fornitura: null });
    if (!ordine || !ordine.id) return invia(500, { ok: false, errore: 'non salvato' });

    const patch = { origine: 'manuale' };
    if (dati.statoPagamento !== undefined) patch.statoPagamento = testo(dati.statoPagamento, 40);
    if (dati.prezzoTotale) patch.prezzoTotale = String(Number(String(dati.prezzoTotale).replace(',', '.')) || 0);
    await impostaDatiOrdine(ordine.id, patch);

    /* scheda cliente: e' cio' che rende questo ordine "riordinabile" */
    let cliente = null;
    if (d.email) {
      try {
        cliente = await daRichiesta({
          nome: [d.nome, d.cognome].filter(Boolean).join(' '), email: d.email,
          azienda: d.azienda, linea: d.linea,
          prodotti: d.articoli.map(a => ({ nome: a.nome, quantita: a.quantita, categoria: a.categoria })),
        });
        const { ordiniPerEmail } = await import('../ordini/index.mjs');
        await aggiornaFrequenza(d.email, calcolaFrequenzaMedia(await ordiniPerEmail(d.email)));
      } catch (e) { console.warn('[admin] cliente non aggiornato: ' + e.message); }
    }

    registra({ evento: 'admin-ordine-nuovo', id: ordine.id, conEmail: Boolean(d.email) });
    return invia(200, { ok: true, id: ordine.id, promemoriaAttivi: Boolean(cliente) });
  }

  return invia(404, { ok: false });
}
