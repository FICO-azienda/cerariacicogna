/* ══════════════════════════════════════════════════════════════
   config.mjs — tutte le manopole in un posto solo
   Valori da variabili d'ambiente; i default sono quelli sensati
   per un sito con poco traffico. Vedi .env.example.
   ══════════════════════════════════════════════════════════════ */
const n = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));
import path from 'node:path';
import { BASE } from './paths.mjs';

const b = (v, d) => (v === undefined || v === '' ? d : /^(1|true|si|sì|yes)$/i.test(v));

export const config = {
  /* modello */
  modello: process.env.CC_MODELLO || 'claude-opus-5',
  effort:  process.env.CC_EFFORT  || 'low',      /* low | medium | high | xhigh | max */
  maxTokens: n(process.env.CC_MAX_TOKENS, 2000),
  fallbacks: b(process.env.CC_FALLBACKS, true),  /* fallback lato server sui rifiuti */

  /* limiti di consumo */
  maxMessaggiOra:      n(process.env.CC_MAX_MSG_ORA, 30),   /* per visitatore */
  maxMessaggiSessione: n(process.env.CC_MAX_MSG_SESSIONE, 40),
  maxCaratteriMessaggio: n(process.env.CC_MAX_CARATTERI, 2000),
  maxTurniStorico:     n(process.env.CC_MAX_TURNI, 20),
  maxGiriTool:         n(process.env.CC_MAX_GIRI_TOOL, 4),

  /* rete */
  porta: n(process.env.PORT, 8787),
  originiAmmesse: (process.env.CC_ORIGINI || '').split(',').map(s => s.trim()).filter(Boolean),

  /* posta (Resend). Senza chiave e mittente il modulo resta sul mailto: */
  resendKey: process.env.CC_RESEND_KEY || '',
  mittente:  process.env.CC_MITTENTE || '',        /* es. "Cereria Cicogna <no-reply@cerariacicogna.com>" */
  maxInviiOra: n(process.env.CC_MAX_INVII_ORA, 5), /* moduli inviati per visitatore */

  /* dati usati nelle email */
  nomeAzienda:      'Cereria Cicogna',
  indirizzoAzienda: 'Via Damiano Chiesa 84, 20026 Novate Milanese (MI)',
  telefono:         '02.35.43.707',
  dominioSito:      process.env.CC_DOMINIO || 'cerariacicogna.com',

  /* log */
  logAttivo: b(process.env.CC_LOG, true),
  /* In locale il file lo tiene l'applicazione, cosi' pulizia.mjs puo'
     farci scadere dentro le conversazioni come promesso nella privacy.
     Su Vercel resta stdout: li' il disco non dura e i log li tiene la
     piattaforma con la sua ritenzione, molto piu' corta. */
  logFile:   process.env.CC_LOG_FILE
             || (process.env.VERCEL ? '' : path.join(BASE, 'data', 'chat.log')),
};

export const EMAIL_SUPPORTO = process.env.CC_EMAIL_SUPPORTO || 'info@cerariacicogna.com';
