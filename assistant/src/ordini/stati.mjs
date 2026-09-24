import fs from 'node:fs';
import path from 'node:path';
import { BASE } from '../paths.mjs';

const FILE = process.env.CC_STATI_ORDINE || path.join(BASE, 'data', 'stati-ordine.json');

function leggi() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')).stati; }
  catch (e) { return []; }
}

export function elencoStati() { return leggi(); }

export function statoDi(codice) {
  return leggi().find(s => s.codice === codice) || null;
}

export function mandaEmail(codice) {
  const s = statoDi(codice);
  return Boolean(s && s.inviaEmail);
}

export const STATO_INIZIALE = 'nuovo';
