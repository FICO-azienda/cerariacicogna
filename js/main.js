/* ═══════════════════════════════════════════════════
   CERARIA CICOGNA — main.js
   GSAP + ScrollTrigger shared logic
   ═══════════════════════════════════════════════════ */

/* ── PAGE LOADER: mostra 3 puntini discreti solo se la pagina ci mette a caricare.
   Sfondo leggermente sfocato; non lampeggia sui caricamenti veloci ("se non lagga, no"). */
(function () {
  if (document.readyState === 'complete') return;            // già pronta: nessun loader
  var el = document.createElement('div');
  el.id = 'page-loader';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<span></span><span></span><span></span>';
  var mount = function () { (document.body || document.documentElement).appendChild(el); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  var shown = false;
  var timer = setTimeout(function () {                        // soglia: appare solo se sta ancora caricando
    if (document.readyState !== 'complete') { el.classList.add('is-visible'); shown = true; }
  }, 420);

  window.addEventListener('load', function () {
    clearTimeout(timer);
    if (shown) { el.classList.remove('is-visible'); setTimeout(function () { el.remove(); }, 560); }
    else if (el.parentNode) { el.remove(); }                 // mai mostrato: rimosso subito
  });
})();

document.addEventListener('DOMContentLoaded', () => {

  gsap.registerPlugin(ScrollTrigger);

  /* ── NAV BRAND: reload to show pre-home hero ─────────────────── */
  const navBrand = document.querySelector('.nav-brand');
  if (navBrand) {
    navBrand.addEventListener('click', e => {
      const p = window.location.pathname;
      if (p === '/' || p.endsWith('/index.html') || p === '') {
        e.preventDefault();
        window.location.reload();
      }
    });
  }

  /* ── NAV SCROLL BEHAVIOUR ─────────────────────── */
  const nav = document.getElementById('main-nav');
  const linesNav = document.getElementById('lines-nav');
  if (nav) {
    /* Position lines-nav immediately below main-nav using its real height.
       We use inline style (highest specificity) and add the transition only
       after the first frame so there is no animated jump on page load. */
    let linesTransitionAdded = false;
    const positionLines = () => {
      const h = nav.offsetHeight + 'px';
      if (linesNav) {
        linesNav.style.top = h;
        if (!linesTransitionAdded) {
          requestAnimationFrame(() => {
            linesNav.style.transition = 'top .5s ease, background .7s';
            linesTransitionAdded = true;
          });
        }
      }
      document.querySelectorAll('.nav-mega').forEach(m => { m.style.top = h; });
    };

    let compactTimer;
    const onScroll = () => {
      const scrolled = window.scrollY > 60;
      nav.classList.toggle('scrolled', scrolled);
      /* After nav CSS transition finishes (~500ms), re-measure and reposition */
      clearTimeout(compactTimer);
      compactTimer = setTimeout(positionLines, 520);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', positionLines, { passive: true });
    onScroll();
    positionLines();
  }


  /* ── DESKTOP DROPDOWN ────────────────────────── */
  const dropItems = document.querySelectorAll('.nav-has-drop');
  if (dropItems.length) {
    let closeTimer;

    const openDrop = (item) => {
      clearTimeout(closeTimer);
      dropItems.forEach(i => {
        if (i !== item) {
          i.classList.remove('drop-open');
          const l = i.querySelector('[aria-haspopup]');
          if (l) l.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.add('drop-open');
      const link = item.querySelector('[aria-haspopup]');
      if (link) link.setAttribute('aria-expanded', 'true');
    };

    const scheduledClose = (item) => {
      closeTimer = setTimeout(() => {
        item.classList.remove('drop-open');
        const link = item.querySelector('[aria-haspopup]');
        if (link) link.setAttribute('aria-expanded', 'false');
      }, 180);
    };

    dropItems.forEach(item => {
      const topLink = item.querySelector('[aria-haspopup]');
      const drop = item.querySelector('.nav-drop');
      if (!drop) return;

      item.addEventListener('mouseenter', () => openDrop(item));
      item.addEventListener('mouseleave', () => scheduledClose(item));

      /* Keyboard: ArrowDown / Enter opens; Esc closes */
      if (topLink) {
        topLink.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown' || (e.key === 'Enter' && !item.classList.contains('drop-open'))) {
            e.preventDefault();
            openDrop(item);
            const first = drop.querySelector('a');
            if (first) first.focus();
          } else if (e.key === 'Escape') {
            item.classList.remove('drop-open');
            topLink.setAttribute('aria-expanded', 'false');
          }
        });
      }

      /* Arrow keys within dropdown */
      const dropLinks = [...drop.querySelectorAll('a')];
      dropLinks.forEach((a, idx) => {
        a.addEventListener('keydown', e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (dropLinks[idx + 1]) dropLinks[idx + 1].focus(); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); if (dropLinks[idx - 1]) dropLinks[idx - 1].focus(); else if (topLink) topLink.focus(); }
          else if (e.key === 'Escape') { item.classList.remove('drop-open'); if (topLink) { topLink.setAttribute('aria-expanded', 'false'); topLink.focus(); } }
          else if (e.key === 'Tab') { scheduledClose(item); }
        });
      });
    });

    /* Click outside closes all */
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-has-drop')) {
        dropItems.forEach(i => {
          i.classList.remove('drop-open');
          const l = i.querySelector('[aria-haspopup]');
          if (l) l.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  /* ── MOBILE ACCORDION ─────────────────────────── */
  document.querySelectorAll('.mm-expand').forEach(btn => {
    btn.addEventListener('click', () => {
      const li = btn.closest('.mm-has-sub');
      const sub = li.querySelector('.mm-sub');
      const isOpen = !sub.hidden;
      /* Close all siblings */
      li.closest('ul').querySelectorAll('.mm-has-sub').forEach(s => {
        s.querySelector('.mm-sub').hidden = true;
        s.querySelector('.mm-expand').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        sub.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ── MOBILE MENU ──────────────────────────────── */
  const hamburger = document.getElementById('nav-hamburger');
  const mobileMenu = document.getElementById('mobile-menu');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('active', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('active');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });

    // Elastic pull-down: trascina giù → resistenza → scatta su
    let pullStartY = 0;
    let pulling = false;

    mobileMenu.addEventListener('touchstart', e => {
      pullStartY = e.touches[0].clientY;
      pulling = false;
      mobileMenu.style.transition = '';
    }, { passive: true });

    mobileMenu.addEventListener('touchmove', e => {
      if (!mobileMenu.classList.contains('open')) return;
      if (mobileMenu.scrollTop > 0) return;
      const deltaY = e.touches[0].clientY - pullStartY;
      if (deltaY > 0) {
        pulling = true;
        const pull = Math.min(deltaY * 0.22, 68);
        mobileMenu.style.transition = 'none';
        mobileMenu.style.transform = `translateY(${pull}px)`;
      }
    }, { passive: true });

    mobileMenu.addEventListener('touchend', () => {
      if (!pulling) return;
      pulling = false;
      mobileMenu.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.25, 0.64, 1)';
      mobileMenu.style.transform = '';
    }, { passive: true });
  }

  /* ── GENERIC SCROLL REVEALS ───────────────────── */
  /* Elements already in viewport animate immediately; below-fold use ScrollTrigger */
  const vh = window.innerHeight;

  /* Use fromTo so the "to" state is always opacity:1 regardless of CSS class */
  function revealEl(el, fromVars, toVars, delay) {
    const inView = el.getBoundingClientRect().top < vh * 0.96;
    if (inView) {
      gsap.fromTo(el, fromVars, { ...toVars, delay: (delay || 0) + 0.25 });
    } else {
      gsap.fromTo(el, fromVars, {
        ...toVars,
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none'
        }
      });
    }
  }

  gsap.utils.toArray('.reveal-up').forEach((el, i) => {
    revealEl(el, { opacity: 0, y: 38 }, { opacity: 1, y: 0, duration: 1, ease: 'power3.out' }, i * 0.06);
  });

  gsap.utils.toArray('.reveal-fade').forEach((el, i) => {
    revealEl(el, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: 'power2.out' }, i * 0.06);
  });

  gsap.utils.toArray('.reveal-left').forEach((el, i) => {
    revealEl(el, { opacity: 0, x: -32 }, { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }, i * 0.06);
  });

  gsap.utils.toArray('.reveal-right').forEach((el, i) => {
    revealEl(el, { opacity: 0, x: 32 }, { opacity: 1, x: 0, duration: 1, ease: 'power3.out' }, i * 0.06);
  });

  /* ── STAGGERED GROUPS ─────────────────────────── */
  gsap.utils.toArray('.reveal-stagger').forEach(group => {
    const items = Array.from(group.children);
    const inView = group.getBoundingClientRect().top < vh * 0.96;
    const tween = {
      opacity: 1, y: 0,
      duration: 0.85, stagger: 0.12,
      ease: 'power3.out'
    };
    if (!inView) {
      tween.scrollTrigger = {
        trigger: group,
        start: 'top 82%',
        toggleActions: 'play none none none'
      };
    } else {
      tween.delay = 0.3;
    }
    gsap.fromTo(items, { opacity: 0, y: 32 }, tween);
  });

});


/* ═══════════════════════════════════════════════════
   FOTO PRODOTTO — un'unica immagine con indice stabile
   (home / garden / liturgico).
   • Passando il mouse sulla card l'immagine AVANZA e RESTA
     (nessun ritorno all'immagine iniziale all'uscita).
   • Le frecce ‹ › cambiano subito l'immagine e la mantengono.
   Niente overlay hover: così frecce e hover controllano lo
   stesso fotogramma senza conflitti.
   Richiamare initCardArrows() dopo aver creato le card.
   ═══════════════════════════════════════════════════ */
window.initCardArrows = function (root) {
  (root || document).querySelectorAll('.product-card').forEach(card => {
    const visual = card.querySelector('.product-card-visual');
    if (!visual || visual.dataset.arrowsInit) return;

    /* elenco immagini: data-gallery (JSON) oppure base + hover nel DOM */
    let list = [];
    if (card.dataset.gallery) { try { list = JSON.parse(card.dataset.gallery); } catch (e) {} }
    const base = visual.querySelector('.img-base') || visual.querySelector('img');
    if (!list.length) {
      const hover = visual.querySelector('.img-hover');
      if (base)  list.push(base.getAttribute('src'));
      if (hover) list.push(hover.getAttribute('src'));
    }
    list = [...new Set(list.filter(Boolean))];
    if (list.length < 2 || !base) return;

    visual.dataset.arrowsInit = '1';
    card.classList.add('has-arrows');

    /* niente overlay: l'immagine mostrata è sempre .img-base */
    const hoverImg = visual.querySelector('.img-hover');
    if (hoverImg) hoverImg.style.display = 'none';

    let i = Math.max(0, list.indexOf(base.getAttribute('src')));
    const show = n => { i = (n + list.length) % list.length; base.setAttribute('src', list[i]); };

    /* l'immagine cambia SOLO con le frecce, non al passaggio del mouse */

    const mk = (dir, cls, glyph, label) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'card-nav ' + cls;
      b.setAttribute('aria-label', label);
      b.innerHTML = glyph;
      b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); show(i + dir); });
      return b;
    };
    visual.appendChild(mk(-1, 'prev', '&#8249;', 'Immagine precedente'));
    visual.appendChild(mk( 1, 'next', '&#8250;', 'Immagine successiva'));
  });
};
