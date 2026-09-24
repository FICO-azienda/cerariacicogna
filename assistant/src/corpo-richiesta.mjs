/* Legge e fa il parse del corpo JSON di una richiesta POST/PUT — la stessa
   logica gia' scritta in handler.mjs per /api/chat, estratta perche' ora
   serve anche agli endpoint admin (login, automazioni). */
export function corpoJSON(req, limite = 100_000) {
  if (req.body !== undefined && req.body !== null) {       /* Vercel lo ha gia' letto */
    return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body);
  }
  return new Promise((risolvi, rifiuta) => {
    let dati = '';
    req.on('data', c => {
      dati += c;
      if (dati.length > limite) { rifiuta(new Error('richiesta troppo grande')); req.destroy(); }
    });
    req.on('end', () => { try { risolvi(JSON.parse(dati || '{}')); } catch (e) { rifiuta(e); } });
    req.on('error', rifiuta);
  });
}
