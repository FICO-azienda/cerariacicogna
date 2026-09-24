import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = path.join(os.tmpdir(), 'cc-test-riordini-' + Date.now() + '.json');
process.env.CC_RIORDINI = tmp;
const { creaToken, trovaToken, pulisciScaduti, GIORNI_VALIDITA } = await import('../assistant/src/token-riordino.mjs');

test.after(() => { try { fs.unlinkSync(tmp); } catch (e) {} });

test('un token appena creato si risolve nello stesso ordine', () => {
  const voce = creaToken({ email: 'cliente@esempio.it', richiestaTs: '2026-01-01T00:00:00Z', promemoriaId: 'abc123', categoria: 'liturgico' });
  assert.ok(voce && voce.codice);
  const trovato = trovaToken(voce.codice);
  assert.ok(trovato);
  assert.equal(trovato.email, 'cliente@esempio.it');
  assert.equal(trovato.richiestaTs, '2026-01-01T00:00:00Z');
});

test('un codice inesistente o malformato non risolve nulla', () => {
  assert.equal(trovaToken('non-esiste'), null);
  assert.equal(trovaToken(''), null);
  assert.equal(trovaToken('a'.repeat(32)), null);   // forma giusta, contenuto inesistente
});

test('il token non espone email o dati in chiaro nel codice stesso', () => {
  const voce = creaToken({ email: 'segreto@esempio.it', richiestaTs: '2026-01-01T00:00:00Z', promemoriaId: 'x', categoria: 'garden' });
  assert.doesNotMatch(voce.codice, /segreto/);
  assert.match(voce.codice, /^[a-f0-9]{32}$/);
});

test('la scadenza è nel futuro per il numero di giorni previsto', () => {
  const voce = creaToken({ email: 'a@b.it', richiestaTs: '2026-01-01T00:00:00Z', promemoriaId: 'x', categoria: 'garden' });
  const giorni = (Date.parse(voce.scadenza) - Date.now()) / (24 * 3600 * 1000);
  assert.ok(Math.abs(giorni - GIORNI_VALIDITA) < 1);
});

test('pulisciScaduti non tocca i token ancora validi', () => {
  creaToken({ email: 'a@b.it', richiestaTs: '2026-01-01T00:00:00Z', promemoriaId: 'y', categoria: 'garden' });
  const tolti = pulisciScaduti();
  assert.equal(tolti, 0);
});
