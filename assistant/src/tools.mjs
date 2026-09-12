/* ══════════════════════════════════════════════════════════════
   tools.mjs — i due strumenti dell'assistente
   ──────────────────────────────────────────────────────────────
   mostra_prodotti  → schede cliccabili nel widget, con "aggiungi
                      alla selezione". Valida i nomi contro il
                      catalogo: e' qui che si impedisce di fatto
                      al modello di inventare prodotti.
   passa_a_umano    → prepara la bozza di email verso l'azienda.
                      Prepara: non invia. L'invio resta un gesto
                      della persona, dal suo client di posta.
   ══════════════════════════════════════════════════════════════ */
import { trova, azienda, immagineVariante, trovaProfumo } from './catalog.mjs';

export const definizioni = [
  {
    name: 'mostra_prodotti',
    description:
      'Mostra da uno a tre prodotti del catalogo come schede cliccabili, con un ' +
      'pulsante per aggiungerli alla Selezione del sito. Usalo dopo aver capito ' +
      "l'esigenza, non come elenco. I nomi devono essere esattamente quelli del " +
      'catalogo: nomi inesistenti vengono rifiutati.',
    input_schema: {
      type: 'object',
      properties: {
        prodotti: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string', description: 'Nome esatto come compare nel catalogo' },
              perche: { type: 'string', description: 'Una riga: perche\' proprio questo, per questa richiesta' },
            },
            required: ['nome', 'perche'],
          },
        },
      },
      required: ['prodotti'],
    },
  },
  {
    name: 'passa_a_umano',
    description:
      "Prepara una bozza di email verso l'azienda quando la richiesta esce dal tuo " +
      'perimetro: prezzi e preventivi, reclami, danni, private label, forniture ' +
      'continuative, o qualsiasi cosa su cui non hai una risposta certa. Non invia ' +
      "nulla: la persona vede la bozza e decide. Dopo averlo usato, dillo in chiaro " +
      "nella risposta ('le ho preparato il messaggio da inviare'). " +
      'Quando la richiesta e\' per un evento, un locale o una fornitura, compila ' +
      'anche fabbisogno: una proposta di quantita\' che fa partire il preventivo ' +
      'gia\' con dei numeri, invece di un generico "vorrei delle candele".',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['preventivo', 'reclamo', 'private-label', 'personalizzazione', 'fornitura', 'informazione-mancante', 'altro'],
        },
        oggetto: { type: 'string', description: "Oggetto dell'email, breve e specifico" },
        riepilogo: {
          type: 'string',
          description:
            "Riassunto utile a chi rispondera': cosa cerca, per quale uso, " +
            'vincoli emersi, prodotti di cui avete parlato. Niente convenevoli.',
        },
        fornitura: {
          type: 'object',
          description:
            'Come si ripete la fornitura. Compilalo quando emerge un ritmo, anche '
            + 'approssimativo: e\' il dato che permette all\'azienda di programmare i '
            + 'rifornimenti invece di aspettare che il cliente si rifaccia vivo. '
            + 'Il ritmo cambia con la linea: gli articoli liturgici di solito sono '
            + 'continuativi (lumini, ceri), la linea Garden e\' stagionale, la Home '
            + 'Collection e\' piu\' spesso una tantum. Se non emerge nulla, ometti.',
          properties: {
            tipo: {
              type: 'string',
              enum: ['una-tantum', 'ricorrente', 'stagionale'],
              description: 'una-tantum = acquisto singolo; ricorrente = a cadenza regolare; stagionale = concentrato in un periodo dell\'anno',
            },
            ogni_mesi: {
              type: 'integer',
              description: 'Ogni quanti mesi si ripete, se ricorrente (es. 2 per "ogni due mesi", 1 per "mensile")',
            },
            periodo: {
              type: 'string',
              description: 'Il periodo dell\'anno, se stagionale (es. "maggio-settembre", "Avvento", "Commemorazione dei defunti")',
            },
            note: {
              type: 'string',
              description: 'Quanto detto dal cliente sul ritmo, con parole sue, se non riducibile ai campi sopra',
            },
          },
        },
        contesto: {
          type: 'string',
          description:
            "I numeri dell'esigenza, in una riga: quanti tavoli o punti luce, quante " +
            "ore di durata, interno o esterno, per quante volte all'anno. Serve " +
            "all'azienda per controllare i conti. Ometti se non e' emerso nulla.",
        },
        fabbisogno: {
          type: 'array',
          maxItems: 6,
          description:
            'Proposta di quantita\', una riga per prodotto. Mettila solo quando hai ' +
            'elementi concreti da cui calcolarla (numero di tavoli, ore, superficie): ' +
            'se non li hai, chiedili prima invece di tirare a indovinare.',
          items: {
            type: 'object',
            properties: {
              nome: { type: 'string', description: 'Nome esatto dal catalogo' },
              quantita: { type: 'integer', description: 'Numero di pezzi consigliato' },
              colore:  { type: 'string', description: 'Colore scelto, se emerso (es. marrone, grigio, bianco)' },
              misura:  { type: 'string', description: 'Misura scelta, se il prodotto ne ha piu\' di una (piccolo, medio, grande)' },
              profumo: { type: 'string', description: 'Profumazione scelta, col nome esatto della Fragrance Library (es. Winter Tree)' },
              calcolo: {
                type: 'string',
                description:
                  'Come esce quel numero, in poche parole: "3 per tavolo su 8 tavoli", ' +
                  '"30 ore di durata, coprono tutta la serata". Se ti sei basato sulle ' +
                  'ore di combustione, dillo. Questa riga finisce nell\'email: deve ' +
                  "reggere alla lettura di chi in cereria fa il preventivo.",
              },
            },
            required: ['nome', 'quantita', 'calcolo'],
          },
        },
      },
      required: ['motivo', 'oggetto', 'riepilogo'],
    },
  },
];

/* Riduce la ricorrenza a una forma sola, leggibile e confrontabile:
   serve sia al testo dell'email sia a chi un domani vorra' calendarizzare. */
export function normalizzaFornitura(f) {
  if (!f || !f.tipo) return null;
  const tipo = ['una-tantum', 'ricorrente', 'stagionale'].includes(f.tipo) ? f.tipo : 'una-tantum';
  const mesi = parseInt(f.ogni_mesi, 10);
  const ogniMesi = (mesi > 0 && mesi <= 24) ? mesi : 0;
  const periodo = String(f.periodo || '').slice(0, 80);
  const note = String(f.note || '').slice(0, 200);

  let descrizione;
  if (tipo === 'ricorrente') {
    descrizione = ogniMesi
      ? (ogniMesi === 1 ? 'Rifornimento mensile' : 'Rifornimento ogni ' + ogniMesi + ' mesi')
      : 'Fornitura ricorrente, cadenza da definire';
  } else if (tipo === 'stagionale') {
    descrizione = 'Fornitura stagionale' + (periodo ? ' · ' + periodo : ', periodo da definire');
  } else {
    descrizione = 'Acquisto una tantum';
  }
  if (note) descrizione += '\n' + note;

  return { tipo, ogniMesi, periodo, note, descrizione };
}

/* ── esecuzione ──────────────────────────────────────────────── */
/* Ogni handler ritorna { risultato, evento } :
     risultato → torna al modello come tool_result
     evento    → viene spinto al widget via SSE (puo' mancare)        */

function eseguiMostraProdotti(input) {
  const richiesti = Array.isArray(input.prodotti) ? input.prodotti.slice(0, 3) : [];
  const trovati = [], mancanti = [];

  richiesti.forEach(r => {
    const p = trova(r.nome);
    if (!p) { mancanti.push(r.nome); return; }
    trovati.push({
      nome: p.nome,
      linea: p.linea,
      descrizione: p.descrizione || '',
      perche: String(r.perche || '').slice(0, 200),
      pagina: p.pagina,
      immagine: p.immagine || '',
      categoria: p.categoria || '',
      varianti: p.varianti || [],
    });
  });

  if (!trovati.length) {
    return {
      risultato:
        'Nessuno di questi prodotti esiste in catalogo: ' + mancanti.join(', ') +
        '. Non sono stati mostrati. Usa solo i nomi che trovi nel catalogo.',
      errore: true,
    };
  }

  let msg = (trovati.length === 1 ? 'Mostrata 1 scheda: ' : 'Mostrate ' + trovati.length + ' schede: ')
    + trovati.map(p => p.nome).join(', ') + '.';
  if (mancanti.length) msg += ' Non esistono in catalogo e sono stati ignorati: ' + mancanti.join(', ') + '.';
  msg += ' La persona puo\' aggiungerli alla Selezione con un clic.';

  return { risultato: msg, evento: { type: 'prodotti', prodotti: trovati } };
}

function eseguiPassaAUmano(input, ctx) {
  const righe = [String(input.riepilogo || '').slice(0, 2000)];

  if (input.contesto) righe.push('', 'CONTESTO', String(input.contesto).slice(0, 400));

  /* la ricorrenza in chiaro: e' il dato che serve per programmare i rifornimenti */
  const forn = normalizzaFornitura(input.fornitura);
  if (forn) righe.push('', 'FORNITURA', forn.descrizione);

  /* proposta di quantita': i nomi passano dal catalogo come per le schede,
     cosi' non finisce in email un prodotto che non esiste */
  const fabbisogno = Array.isArray(input.fabbisogno) ? input.fabbisogno.slice(0, 6) : [];
  const validi = [], ignorati = [];
  fabbisogno.forEach(r => {
    const p = trova(r.nome);
    const q = parseInt(r.quantita, 10);
    if (!p || !(q > 0)) { ignorati.push(r.nome); return; }
    /* la foto deve essere quella della variante chiesta: "Sand piccolo marrone"
       con la foto del Sand bianco e' un errore che si vede subito */
    const colore = String(r.colore || '').slice(0, 40);
    const misura = String(r.misura || '').slice(0, 40);
    const prof   = trovaProfumo(r.profumo);
    const dettagli = [misura, colore, prof ? prof.nome : (r.profumo || '')].filter(Boolean).join(', ');

    validi.push({
      nome: p.nome, quantita: q,
      colore, misura,
      profumo: prof ? prof.nome : String(r.profumo || '').slice(0, 60),
      formato: dettagli,                       /* etichetta leggibile, per il testo */
      calcolo: String(r.calcolo || '').slice(0, 200),
      /* pagina, foto e categoria servono al widget per mettere il prodotto
         nella Selezione quando si va al modulo: senza, la richiesta partirebbe
         citando i prodotti a parole ma senza allegarli */
      pagina: p.pagina || '',
      immagine: immagineVariante(p, colore, misura),
      immagineProfumo: prof ? (prof.immagine || '') : '',
      categoria: p.categoria || '',
    });
  });

  if (validi.length) {
    righe.push('', 'PROPOSTA DI QUANTITA\'');
    validi.forEach(r => {
      righe.push('· ' + r.nome + (r.formato ? ' (' + r.formato + ')' : '') + ' — ' + r.quantita + ' pz');
      if (r.calcolo) righe.push('    ' + r.calcolo);
    });
    righe.push('', 'Le quantita\' sopra sono una stima dell\'assistente sulla base di quanto',
                   'emerso in chat: servono a far partire il preventivo con dei numeri,',
                   'non sono un impegno. Vanno confermate dalla cereria.');
  }

  /* La firma chiude sempre il messaggio; la Selezione si infila subito prima.
     Mando al widget anche le due meta' separate: cosi' puo' ricomporre il corpo
     con la Selezione aggiornata al momento del clic, invece di restare fermo
     a com'era quando la bozza e' stata scritta. */
  const coda = ['— — —', 'Messaggio preparato dall\'assistente del sito.',
                'Motivo: ' + (input.motivo || 'altro')];

  const testa = righe.join('\n');
  if (ctx && ctx.selezione) righe.push('', ctx.selezione);
  righe.push('', ...coda);

  const oggetto = String(input.oggetto || 'Richiesta dal sito').slice(0, 120);
  const corpo = righe.join('\n');

  let risultato =
    'Bozza pronta' + (validi.length ? ' con la proposta di quantita\' (' +
      validi.map(r => r.nome + ' ×' + r.quantita).join(', ') + ')' : '') + '. ' +
    'La persona la vede nella chat con un pulsante per aprirla nel proprio programma ' +
    'di posta verso ' + azienda.email + '. Non e\' stata inviata: dille di controllarla ' +
    'e inviarla, oppure che puo\' scrivere direttamente a quell\'indirizzo.';
  if (ignorati.length) {
    risultato += ' Righe scartate perche\' il prodotto non e\' in catalogo o la quantita\' ' +
                 'non e\' un numero: ' + ignorati.join(', ') + '.';
  }

  return {
    risultato,
    evento: {
      type: 'escalation',
      email: azienda.email,
      oggetto,
      corpo,
      /* le due meta' senza Selezione, per la ricomposizione lato widget */
      corpoTesta: testa,
      corpoCoda: coda.join('\n'),
      motivo: input.motivo || 'altro',
      fabbisogno: validi,
      fornitura: forn,
      mailto: 'mailto:' + azienda.email + '?subject=' + encodeURIComponent(oggetto) + '&body=' + encodeURIComponent(corpo),
    },
  };
}

export function esegui(nome, input, ctx) {
  try {
    if (nome === 'mostra_prodotti') return eseguiMostraProdotti(input);
    if (nome === 'passa_a_umano')   return eseguiPassaAUmano(input, ctx);
    return { risultato: 'Strumento sconosciuto: ' + nome, errore: true };
  } catch (e) {
    return { risultato: 'Errore interno nello strumento ' + nome + '. Prosegui senza.', errore: true };
  }
}
