/* ══════════════════════════════════════════════════════════════
   api/chat.js — punto d'ingresso serverless
   ──────────────────────────────────────────────────────────────
   Sta nella radice del sito perche' Vercel cerca le funzioni solo
   in /api. La logica e' tutta in assistant/src/handler.mjs, cosi'
   il server locale e la produzione eseguono lo stesso codice.
   ══════════════════════════════════════════════════════════════ */
export { default } from '../assistant/src/handler.mjs';
export const config = { maxDuration: 60 };
