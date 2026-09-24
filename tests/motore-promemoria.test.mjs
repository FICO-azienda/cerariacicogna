import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valutaCliente, prossimoPromemoria } from '../assistant/src/motore-promemoria.mjs';
import { calcolaFrequenzaMedia, rilevaPatternB2B } from '../assistant/src/archivio.mjs';

const REGOLE = {
  liturgico: { attivo: true, giorni: 45, secondoDopo: 15, maxPromemoria: 2, sogliaMinima: 0, stagionalita: null, esclusi: [] },
  garden: { attivo: true, giorni: 60, secondoDopo: null, maxPromemoria: 1, sogliaMinima: 0, stagionalita: { da: '04-01', a: '09-30' }, esclusi: [] },
};

function cliente(extra) {
  return { email: 'a@b.it', nome: 'Ada', codice: 'x', consenso: { promemoriaRiacquisto: true }, promemoria: [], frequenzaMediaGiorni: null, ...extra };
}

function richiesta(ts, articoli) { return { ts, articoli }; }

test('nessun promemoria prima della soglia di categoria', () => {
  const oggi = new Date('2026-01-01');
  const storico = [richiesta('2025-12-20T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 10 }])];
  const esito = valutaCliente(cliente(), storico, REGOLE, oggi);
  assert.equal(esito.length, 0);
});

test('promemoria dovuto dopo i giorni di categoria', () => {
  const oggi = new Date('2026-02-10');   // 52 giorni dopo il 20/12, soglia liturgico=45
  const storico = [richiesta('2025-12-20T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 10 }])];
  const esito = valutaCliente(cliente(), storico, REGOLE, oggi);
  assert.equal(esito.length, 1);
  assert.equal(esito[0].categoria, 'liturgico');
  assert.equal(esito[0].tipo, 'primo');
});

test('non manda un secondo promemoria se il primo non è mai partito', () => {
  const oggi = new Date('2026-03-01');
  const storico = [richiesta('2025-12-20T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 10 }])];
  // nessun promemoria registrato: deve proporre "primo", non "secondo"
  const esito = valutaCliente(cliente(), storico, REGOLE, oggi);
  assert.equal(esito[0].tipo, 'primo');
});

test('rispetta il tetto massimo di promemoria per lo stesso ordine', () => {
  const oggi = new Date('2026-03-01');
  const storico = [richiesta('2025-12-20T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 10 }])];
  const c = cliente({
    promemoria: [
      { richiestaTs: '2025-12-20T00:00:00Z', categoria: 'liturgico', tipo: 'primo' },
      { richiestaTs: '2025-12-20T00:00:00Z', categoria: 'liturgico', tipo: 'secondo' },
    ],
  });
  const esito = valutaCliente(c, storico, REGOLE, oggi);
  assert.equal(esito.length, 0);   // maxPromemoria liturgico = 2, già raggiunto
});

test('niente promemoria se ha già riordinato la stessa categoria', () => {
  const oggi = new Date('2026-03-01');
  const storico = [
    richiesta('2025-12-20T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 10 }]),
    richiesta('2026-02-15T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 12 }]),
  ];
  const esito = valutaCliente(cliente(), storico, REGOLE, oggi);
  // il riferimento è ora l'ordine del 15/2: solo 14 giorni fa, non ancora dovuto
  assert.equal(esito.length, 0);
});

test('rispetta la stagionalità', () => {
  const storico = [richiesta('2025-10-01T00:00:00Z', [{ nome: 'Citronella', categoria: 'garden', quantita: 4 }])];
  // fuori stagione (novembre), anche se i giorni sono passati
  const fuori = valutaCliente(cliente(), storico, REGOLE, new Date('2025-11-15'));
  assert.equal(fuori.length, 0);
  // dentro la finestra 04-01/09-30 dell'anno dopo
  const dentro = valutaCliente(cliente(), storico, REGOLE, new Date('2026-05-01'));
  assert.equal(dentro.length, 1);
});

test('la frequenza personale sostituisce quella di categoria dal terzo ordine', () => {
  const storico = [
    richiesta('2025-11-01T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 5 }]),
    richiesta('2025-11-21T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 5 }]),   // +20gg
    richiesta('2025-12-11T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 5 }]),   // +20gg
  ];
  const media = calcolaFrequenzaMedia(storico);
  assert.equal(media, 20);
  // con la regola di categoria (45gg) non sarebbe ancora dovuto 25 giorni dopo;
  // con la frequenza personale (20gg) sì.
  const c = cliente({ frequenzaMediaGiorni: media });
  const esito = valutaCliente(c, storico, REGOLE, new Date('2026-01-05'));   // 25gg dopo l'ultimo
  assert.equal(esito.length, 1);
});

test('calcolaFrequenzaMedia richiede almeno 3 richieste', () => {
  const storico = [richiesta('2025-01-01T00:00:00Z', []), richiesta('2025-01-20T00:00:00Z', [])];
  assert.equal(calcolaFrequenzaMedia(storico), null);
});

test('calcolaFrequenzaMedia scarta valori fuori dai limiti ragionevoli', () => {
  const storico = [
    richiesta('2025-01-01T00:00:00Z', []),
    richiesta('2025-01-02T00:00:00Z', []),   // 1 giorno: troppo vicino
    richiesta('2025-01-03T00:00:00Z', []),
  ];
  assert.equal(calcolaFrequenzaMedia(storico), null);
});

test('rileva un pattern B2B su ordini ricorrenti simili', () => {
  const storico = [
    richiesta('2025-01-01T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 48 }, { nome: 'Lumini', quantita: 24 }]),
    richiesta('2025-02-15T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 50 }, { nome: 'Lumini', quantita: 24 }]),
    richiesta('2025-04-01T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 46 }, { nome: 'Lumini', quantita: 25 }]),
  ];
  const pattern = rilevaPatternB2B(storico);
  assert.ok(pattern);
  assert.equal(pattern.ricorrente, true);
  const nomi = pattern.articoliTipici.map(a => a.nome.toLowerCase());
  assert.ok(nomi.includes('cero avorio'));
  assert.ok(nomi.includes('lumini'));
});

test('non rileva un pattern se le quantità oscillano troppo', () => {
  const storico = [
    richiesta('2025-01-01T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 10 }]),
    richiesta('2025-02-15T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 40 }]),
    richiesta('2025-04-01T00:00:00Z', [{ nome: 'Cero Avorio', quantita: 12 }]),
  ];
  assert.equal(rilevaPatternB2B(storico), null);
});

test('prossimoPromemoria indica la data stimata quando non è ancora dovuto', () => {
  const storico = [richiesta('2026-01-01T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 5 }])];
  const p = prossimoPromemoria(cliente(), storico, REGOLE, new Date('2026-01-10'));
  assert.ok(p);
  assert.equal(p.categoria, 'liturgico');
  assert.equal(p.dataStimata.toISOString().slice(0, 10), '2026-02-15');   // 1/1 + 45gg
});

test('nessun promemoria per chi si è opposto', () => {
  const storico = [richiesta('2025-12-01T00:00:00Z', [{ nome: 'Cero', categoria: 'liturgico', quantita: 5 }])];
  const c = cliente({ consenso: { promemoriaRiacquisto: false } });
  const esito = valutaCliente(c, storico, REGOLE, new Date('2026-03-01'));
  assert.equal(esito.length, 0);
});
