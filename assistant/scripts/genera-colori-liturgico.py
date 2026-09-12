#!/usr/bin/env python3
"""
genera-colori-liturgico.py
──────────────────────────────────────────────────────────────
Nella griglia di liturgico.html i lumini mostrano un pallino per
ogni variante. Il colore del pallino NON e' scritto a mano: viene
misurato dalla foto del pezzo, perche' nei dati la variante ha
solo l'immagine e nessuna etichetta. Un colore inventato direbbe
al cliente una cosa che nessuno ha confermato; uno misurato dice
esattamente quello che vedra' cliccando.

Serve Pillow (gia' presente). Dopo ogni modifica alle foto:
    npm run colori-liturgico
"""
import colorsys, json, os, re, sys
from PIL import Image

QUI = os.path.dirname(os.path.abspath(__file__))
SITO = os.path.abspath(os.path.join(QUI, '..', '..'))
SORGENTE = os.path.join(SITO, 'product-lit-lumini.html')
DESTINAZIONE = os.path.join(SITO, 'liturgico.html')
INIZIO = '/* ⟦colori-lumini:inizio⟧ generato da genera-colori-liturgico.py — non modificare a mano */'
FINE = '/* ⟦colori-lumini:fine⟧ */'


# ── la tavolozza del liturgico ───────────────────────────────
# Sono gli stessi colori che le forniture (Linea Angelo, Aure, Papa)
# usano gia' nella stessa griglia: il rosso e' un rosso solo, il blu
# un blu solo. Misurare la tinta foto per foto dava sfumature diverse
# per lo stesso vetro — un azzurrino qui, un blu la' — e sulla pagina
# sembravano prodotti diversi. Verde e ambra non c'erano e li ho
# aggiunti in tono con gli altri.
TAVOLOZZA = [
    ('bianco',      'Bianco',      '#ffffff'),
    ('rosso',       'Rosso',       '#b51212'),
    ('blu',         'Blu',         '#1a3a7a'),
    ('verde',       'Verde',       '#1f6b3a'),
    ('ambra',       'Ambra',       '#d38416'),
    ('gialla',      'Gialla',      '#e8b820'),
]
# il trasparente non ha un colore: nella griglia e' un cerchio
# tratteggiato vuoto, ed e' gia' cosi' per le forniture
TRASPARENTE = ('trasparente', 'Trasparente', None)


def _rgb(hx):
    return tuple(int(hx[i:i + 2], 16) for i in (1, 3, 5))


def colore_del_pezzo(percorso):
    """Classifica la variante in uno dei colori della tavolozza.

    La foto serve a capire QUALE colore e', non a deciderne la tinta:
    quella la mette la tavolozza, uguale per tutto il liturgico.
    Guardo il centro dell'inquadratura, dove c'e' il pezzo, e tengo la
    fetta piu' satura, che e' il vetro colorato."""
    percorso = percorso.split('?')[0]
    intero = os.path.join(SITO, percorso)
    if not os.path.exists(intero):
        return None
    im = Image.open(intero).convert('RGB')
    w, h = im.size
    im = im.crop((int(w * .28), int(h * .28), int(w * .72), int(h * .80))).resize((90, 90))
    px = list(im.getdata())
    dati = []
    for r, g, b in px:
        _, ll, ss = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        dati.append((ss, ll, (r, g, b)))
    satura = sorted(dati, key=lambda d: -d[0])
    top = satura[:max(1, len(satura) // 8)]
    if sum(d[0] for d in top) / len(top) < 0.18:
        base = [d for d in dati if d[1] > 0.5] or dati
    else:
        base = top
    m = [sum(c[2][i] for c in base) // len(base) for i in range(3)]

    # canali quasi uguali e chiaro: e' bianco oppure trasparente. Le due
    # cose non si distinguono in modo affidabile dalla foto — l'ho provato
    # su luminosita', varianza e contrasto fra parete e centro, e il
    # segnale non regge su tutta la gamma. Le do' per bianche e le segnalo,
    # cosi' chi conosce i prodotti corregge in un colpo solo.
    if max(m) - min(m) < 26 and sum(m) / 3 > 190:
        return TAVOLOZZA[0], True

    # Altrimenti classifico per TINTA, non per distanza in RGB: un verde
    # salvia e un verde bottiglia sono lontanissimi come numeri ma sono lo
    # stesso colore, e la distanza li mandava su voci sbagliate.
    hh = colorsys.rgb_to_hls(m[0] / 255, m[1] / 255, m[2] / 255)[0] * 360
    if hh >= 345 or hh < 16:   cid = 'rosso'
    elif hh < 45:              cid = 'ambra'
    elif hh < 70:              cid = 'gialla'
    elif hh < 180:             cid = 'verde'
    elif hh < 265:             cid = 'blu'
    else:                      cid = 'rosso'      # magenta/viola: nel liturgico non esistono
    vicina = next(v for v in TAVOLOZZA if v[0] == cid)
    return vicina, False


def main():
    s = open(SORGENTE, encoding='utf-8').read()
    nomi = re.findall(r"^\s*name:\s*'((?:[^'\\]|\\.)*)'", s, re.M)
    blocchi = re.findall(r"^\s*colors:\s*\[(.*?)\],\s*$", s, re.M | re.S)
    if len(nomi) != len(blocchi):
        sys.exit(f'nomi ({len(nomi)}) e blocchi colore ({len(blocchi)}) non coincidono')

    mappa, mancanti, neutri = {}, [], []
    for i, b in enumerate(blocchi):
        foto = re.findall(r"src\s*:\s*'([^']+)'", b)
        if len(foto) < 2:
            continue
        voci = []
        for f in foto:
            esito = colore_del_pezzo(f)
            if esito is None:
                mancanti.append(f)
                continue
            (cid, label, hx), neutro = esito
            voci.append({'src': f, 'id': cid, 'label': label, 'hex': hx})
            if neutro:
                neutri.append((nomi[i], f))
        if len(voci) > 1:
            mappa[i] = voci

    righe = []
    for i, voci in mappa.items():
        dentro = ', '.join(
            "{src:'%s',id:'%s',label:'%s',hex:%s}" % (
                v['src'], v['id'], v['label'],
                ("'%s'" % v['hex']) if v['hex'] else 'null')
            for v in voci)
        righe.append(f'      {i}: [{dentro}],')

    nuovo = INIZIO + '\n    const COLORI_LUMINI = {\n' + '\n'.join(righe) + '\n    };\n    ' + FINE

    dest = open(DESTINAZIONE, encoding='utf-8').read()
    i = dest.find(INIZIO)
    if i < 0:
        for vecchio in (INIZIO.replace('.py', '.mjs'),):
            i = dest.find(vecchio)
            if i >= 0:
                break
    if i < 0:
        sys.exit('marcatori non trovati in liturgico.html')
    j = dest.find(FINE, i) + len(FINE)
    open(DESTINAZIONE, 'w', encoding='utf-8').write(dest[:i] + nuovo + dest[j:])

    print('tavolozza del liturgico → liturgico.html')
    for i, voci in mappa.items():
        print(f'   #{str(i).ljust(3)} {nomi[i][:30].ljust(32)} ' + ' '.join(v['label'].lower() for v in voci))
    senza = [(i, n) for i, n in enumerate(nomi) if i not in mappa]
    if senza:
        print('   senza varianti: ' + ' · '.join(f'#{i} {n}' for i, n in senza))
    if mancanti:
        print('   FOTO MANCANTI: ' + ', '.join(mancanti))
    if neutri:
        print(f'\n   {len(neutri)} varianti date per BIANCHE: dalla foto non si distingue')
        print('   il bianco pieno dal vetro trasparente. Da confermare:')
        for n, f in neutri:
            print(f'     {n[:30].ljust(32)} {f}')


main()
