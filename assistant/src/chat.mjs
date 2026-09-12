/* ══════════════════════════════════════════════════════════════
   chat.mjs — il cuore: una conversazione con Claude, in streaming
   ──────────────────────────────────────────────────────────────
   Loop manuale (non il tool runner) perche' ogni strumento deve
   poter spingere un evento suo al widget — le schede prodotto e la
   bozza di email compaiono nella chat mentre la risposta scorre.
   ══════════════════════════════════════════════════════════════ */
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config.mjs';
import { systemPrompt } from './prompt.mjs';
import { definizioni, esegui } from './tools.mjs';

const client = new Anthropic();          /* la chiave arriva da ANTHROPIC_API_KEY */
const SYSTEM = systemPrompt();           /* costruito una volta: e' il prefisso in cache */

/* i fallback lato server sono utili ma recenti: se questo account o questa
   versione dell'SDK non li accetta, si spegne da solo e non ci riprova piu' */
let fallbackAttivi = config.fallbacks;

const BETA_FALLBACK = 'server-side-fallback-2026-07-01';

function parametri(messages) {
  const p = {
    model: config.modello,
    max_tokens: config.maxTokens,
    output_config: { effort: config.effort },
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    tools: definizioni,
    messages,
  };
  if (fallbackAttivi) { p.betas = [BETA_FALLBACK]; p.fallbacks = 'default'; }
  return p;
}

function apriStream(messages) {
  const p = parametri(messages);
  return fallbackAttivi ? client.beta.messages.stream(p) : client.messages.stream(p);
}

/* ── ripulitura dei blocchi prima di rimandarli indietro ─────── */
/* La risposta dell'SDK porta campi di sola uscita (es. `parsed` sui blocchi
   di testo) che l'API rifiuta se glieli si rimanda: al secondo giro, quello
   dopo uno strumento, si prende un 400. Si tiene solo cio' che e' ammesso in
   ingresso — i blocchi di ragionamento vanno riportati interi, firma inclusa. */
function ripulisciContenuto(blocchi) {
  return blocchi.map(b => {
    if (b.type === 'text') {
      const t = { type: 'text', text: b.text };
      if (b.citations) t.citations = b.citations;
      return t;
    }
    if (b.type === 'thinking')          return { type: 'thinking', thinking: b.thinking, signature: b.signature };
    if (b.type === 'redacted_thinking') return { type: 'redacted_thinking', data: b.data };
    if (b.type === 'tool_use')          return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
    return b;
  });
}

/* ── normalizzazione dello storico che arriva dal browser ────── */
export function preparaMessaggi(storico, testo) {
  const ammessi = (Array.isArray(storico) ? storico : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, config.maxCaratteriMessaggio) }))
    .slice(-config.maxTurniStorico);

  /* la conversazione deve iniziare con l'utente e alternarsi: due turni
     dello stesso ruolo di fila vengono rifiutati dall'API, quindi si uniscono */
  while (ammessi.length && ammessi[0].role !== 'user') ammessi.shift();

  const alternati = [];
  ammessi.forEach(m => {
    const ultimo = alternati[alternati.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += '\n\n' + m.content;
    else alternati.push({ ...m });
  });

  const nuovo = String(testo).slice(0, config.maxCaratteriMessaggio);
  const ultimo = alternati[alternati.length - 1];
  if (ultimo && ultimo.role === 'user') ultimo.content += '\n\n' + nuovo;
  else alternati.push({ role: 'user', content: nuovo });

  return alternati;
}

/* ── conversazione ───────────────────────────────────────────── */
/* onEvento riceve: {type:'testo',delta} {type:'prodotti',…}
                    {type:'escalation',…} {type:'fine',…}          */
export async function conversa({ messaggi, contesto = {}, onEvento }) {
  /* La lingua la sceglie il visitatore col selettore del sito, non si deduce
     dal testo: se passa a EN a meta' conversazione, le risposte devono
     seguirlo anche se i messaggi precedenti erano in italiano.
     Va come messaggio di sistema in coda: cosi' non tocca il prefisso in
     cache del system prompt, che resta identico a ogni richiesta. */
  if (contesto.lingua === 'en') {
    messaggi.push({
      role: 'system',
      content: 'The visitor has switched the site to English. Reply in English from now on, '
             + 'even if earlier messages in this conversation were in Italian. '
             + 'Keep product names, fragrance names and the company name unchanged.',
    });
  }

  let giri = 0;
  let testoFinale = '';
  let uso = { input: 0, output: 0, cache: 0 };

  while (true) {
    let finale;
    try {
      const stream = apriStream(messaggi);
      stream.on('text', t => { testoFinale += t; onEvento({ type: 'testo', delta: t }); });
      finale = await stream.finalMessage();
    } catch (e) {
      /* i fallback lato server non sono disponibili qui: riprova senza, una volta sola */
      /* si riprova solo se non era ancora uscito nulla a schermo */
      if (fallbackAttivi && !testoFinale && /fallback|beta/i.test(String(e && e.message))) {
        console.warn('[chat] fallback lato server non accettati, li disattivo: ' + e.message);
        fallbackAttivi = false;
        continue;
      }
      throw e;
    }

    if (finale.usage) {
      uso.input  += finale.usage.input_tokens || 0;
      uso.output += finale.usage.output_tokens || 0;
      uso.cache  += finale.usage.cache_read_input_tokens || 0;
    }

    /* rifiuto del modello: non e' un errore tecnico, ma non ha risposto */
    if (finale.stop_reason === 'refusal') {
      onEvento({ type: 'testo', delta: '\n\nNon riesco a rispondere a questa richiesta. Se serve, scriva pure a info@cerariacicogna.com.' });
      return { testo: testoFinale, uso, motivo: 'refusal' };
    }

    if (finale.stop_reason !== 'tool_use') {
      return { testo: testoFinale, uso, motivo: finale.stop_reason };
    }

    /* ── strumenti ── */
    if (++giri > config.maxGiriTool) {
      messaggi.push({ role: 'assistant', content: ripulisciContenuto(finale.content) });
      messaggi.push({
        role: 'user',
        content: finale.content.filter(x => x.type === 'tool_use').map(t => ({
          type: 'tool_result', tool_use_id: t.id, is_error: true,
          content: 'Limite di strumenti raggiunto per questo turno. Rispondi a parole, senza altri strumenti.',
        })),
      });
      continue;
    }

    const chiamate = finale.content.filter(x => x.type === 'tool_use');
    messaggi.push({ role: 'assistant', content: ripulisciContenuto(finale.content) });

    const risultati = chiamate.map(t => {
      const r = esegui(t.name, t.input, contesto);
      if (r.evento) onEvento(r.evento);
      return { type: 'tool_result', tool_use_id: t.id, content: r.risultato, ...(r.errore ? { is_error: true } : {}) };
    });

    messaggi.push({ role: 'user', content: risultati });
  }
}
