/* CORS per gli endpoint GET/POST chiamati con fetch() da pagine che possono
   stare su un'origine diversa da quella del backend — in sviluppo sempre
   (pagine su una porta, server su un'altra), in produzione se le pagine
   statiche e il processo Node finiscono su host diversi (vedi
   assistant/README.md, sezione Deploy). Stessa logica gia' scritta in
   handler.mjs e cliente-endpoint.mjs, un posto solo. */
import { config } from './config.mjs';

export function cors(req, res, metodi = 'GET, OPTIONS') {
  const origine = req.headers.origin;
  const lista = config.originiAmmesse;
  if (!lista.length) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origine && lista.includes(origine)) res.setHeader('Access-Control-Allow-Origin', origine);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', metodi);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
}
