/* ══════════════════════════════════════════════════════════════
   scheduler.mjs — un ciclo al giorno: chi e' dovuto, chi riceve
   ──────────────────────────────────────────────────────────────
   Il motore (motore-promemoria.mjs) dice CHI e COSA; questo file fa
   il resto: genera il token di riordino, compone l'email, la manda,
   registra che e' partita. Idempotente per costruzione: se il ciclo
   gira due volte lo stesso giorno (il timer interno E il cron
   esterno di riserva si sovrappongono), il secondo giro non trova
   piu' nulla di dovuto, perche' registraPromemoriaInviato ha gia'
   segnato il primo invio prima che il secondo arrivi a valutarlo.

   Due modi di farlo partire, entrambi puntano qui:
   1. avviaScheduler() — un timer nel processo Node, se resta acceso
      (vedi server.mjs, stesso schema di avviaPulizia());
   2. l'endpoint /api/cron/promemoria (api/cron/promemoria.js),
      protetto da CC_CRON_SECRET, richiamato una volta al giorno da
      un trigger esterno indipendente dall'hosting del sito — vedi
      .github/workflows/promemoria.yml.
   ══════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { BASE } from './paths.mjs';
import { clientiAttivi, registraPromemoriaInviato, ordiniPerEmail } from './ordini/index.mjs';
import { rilevaPatternB2B } from './archivio.mjs';
import { tutteLeRegole } from './regole-riacquisto.mjs';
import { promemoriaDovuti } from './motore-promemoria.mjs';
import { creaToken } from './token-riordino.mjs';
import { inviaPromemoria, postaAttiva } from './mailer.mjs';
import { linkSito } from './email-template.mjs';

const EVENTI_FILE = process.env.CC_EVENTI_PROMEMORIA || path.join(BASE, 'data', 'promemoria-eventi.jsonl');

/* Un evento per riga, come richieste.jsonl e log.mjs: e' la fonte della
   dashboard admin (inviati, aperti, cliccati, convertiti in ordine). */
export function registraEvento(voce) {
  try {
    fs.mkdirSync(path.dirname(EVENTI_FILE), { recursive: true });
    fs.appendFileSync(EVENTI_FILE, JSON.stringify({ ts: new Date().toISOString(), ...voce }) + '\n');
  } catch (e) {
    console.warn('[promemoria] evento non registrato: ' + e.message);
  }
}

export function leggiEventi() {
  try { return fs.readFileSync(EVENTI_FILE, 'utf8').split('\n').filter(Boolean).map(r => { try { return JSON.parse(r); } catch (e) { return null; } }).filter(Boolean); }
  catch (e) { return []; }
}

/* Identificativo stabile del promemoria: stessa email + stesso ordine +
   stessa categoria + stesso "primo/secondo" produce sempre lo stesso id.
   Non e' un segreto (viaggia in chiaro nel pixel di apertura e nell'URL di
   riordino solo insieme al token firmato): serve solo a mettere in fila
   invio, apertura, clic e ordine dello STESSO promemoria, non a
   autenticare nulla — quello lo fa il token opaco di token-riordino.mjs. */
export function idPromemoria(email, richiestaTs, categoria, tipo) {
  return crypto.createHash('sha256').update([email, richiestaTs, categoria, tipo].join('|')).digest('hex').slice(0, 20);
}

export async function eseguiCicloPromemoria({ oggi = new Date() } = {}) {
  if (!postaAttiva()) {
    console.warn('[promemoria] posta non configurata (CC_RESEND_KEY/CC_MITTENTE): ciclo saltato');
    return { inviati: 0, falliti: 0, dovuti: 0 };
  }

  const regole = tutteLeRegole();
  const dovuti = await promemoriaDovuti({ clientiAttivi, storicoPerEmail: ordiniPerEmail, regole, oggi });

  let inviati = 0, falliti = 0;
  for (const p of dovuti) {
    const pattern = rilevaPatternB2B(await ordiniPerEmail(p.email));
    const id = idPromemoria(p.email, p.richiesta.ts, p.categoria, p.tipo);

    const token = creaToken({ email: p.email, richiestaTs: p.richiesta.ts, promemoriaId: id, categoria: p.categoria });
    if (!token) { falliti++; continue; }

    const linkRiordino = linkSito('riordino.html') + '?t=' + token.codice;
    const linkDisiscrizione = linkSito('api/unsubscribe') + '?c=' + p.codiceCliente + '&tipo=promemoria';
    const linkApertura = linkSito('api/promemoria-aperto') + '?id=' + id;

    const esito = await inviaPromemoria({
      email: p.email, nome: p.nome, lingua: p.lingua,
      articoli: p.articoli.map(a => ({
        nome: a.nome, quantita: a.quantita, oltre: a.oltre,
        img: a.immagine, imgProfumo: a.imgProfumo, url: a.pagina, categoria: a.categoria,
      })),
      linkRiordino, linkDisiscrizione, linkApertura,
      ricorrente: Boolean(pattern && pattern.ricorrente),
    });

    if (esito.ok) {
      inviati++;
      await registraPromemoriaInviato(p.email, { richiestaTs: p.richiesta.ts, categoria: p.categoria, tipo: p.tipo, promemoriaId: id });
      registraEvento({ tipo: 'inviato', email: p.email, categoria: p.categoria, richiestaTipo: p.tipo, promemoriaId: id, frequenzaUsata: p.frequenzaUsata });
    } else {
      falliti++;
      console.warn('[promemoria] invio fallito per ' + p.email + ': ' + esito.motivo);
    }
  }

  if (dovuti.length) {
    console.log('[promemoria] ciclo: ' + inviati + ' inviati, ' + falliti + ' falliti su ' + dovuti.length + ' dovuti');
  }
  return { inviati, falliti, dovuti: dovuti.length };
}

/* Timer nel processo, sullo stesso schema di avviaPulizia() in
   pulizia.mjs. Non esegue subito all'avvio: un riavvio del processo (un
   deploy, un crash recuperato) non deve far ripartire un giro extra lo
   stesso giorno in cui magari il cron esterno e' gia' passato — idempotente
   o no, mandare due volte la stessa email a distanza di minuti e' comunque
   un'esperienza brutta per chi la riceve. Il giro giornaliero basta. */
export function avviaScheduler() {
  const GIORNO = 24 * 60 * 60 * 1000;
  const t = setInterval(() => {
    eseguiCicloPromemoria().catch(e => console.error('[promemoria] ciclo fallito: ' + (e && e.stack || e)));
  }, GIORNO);
  if (t.unref) t.unref();
  return t;
}
