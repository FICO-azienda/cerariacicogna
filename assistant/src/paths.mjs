/* percorsi condivisi: assistant/ e' la radice di tutto cio' che serve al server */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BASE = path.resolve(here, '..');
export const SITE = path.resolve(BASE, '..');
