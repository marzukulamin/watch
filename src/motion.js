import { animate, stagger } from 'animejs';
export const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let cleanups = [];
let animations = [];
const run = (targets, options) => {
  if (reduced.matches) return;
  const a = animate(targets, options);
  animations.push(a);
  return a;
};
export function clearMotion() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  animations.forEach((a) => a.cancel());
  animations = [];
}
export function pageMotion() {
  const films = document.querySelectorAll('[data-lazy-video]');
  if (!reduced.matches && !navigator.connection?.saveData) {
    const filmObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach(({ target: film, isIntersecting }) => {
          if (isIntersecting) {
            if (!film.src) film.src = film.dataset.lazyVideo;
            if (!film.dataset.userPaused && !document.hidden)
              film
                .play()
                .then(() => film.classList.add('playing'))
                .catch(() => {});
          } else film.pause();
        }),
      { threshold: 0.08 },
    );
    films.forEach((f) => filmObserver.observe(f));
    const visibility = () => {
      films.forEach((f) => {
        if (document.hidden || reduced.matches) f.pause();
        else if (
          !f.dataset.userPaused &&
          f.getBoundingClientRect().bottom > 0 &&
          f.getBoundingClientRect().top < innerHeight
        )
          f.play().catch(() => {});
      });
    };
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', visibility);
    cleanups.push(() => {
      filmObserver.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      reduced.removeEventListener('change', visibility);
      films.forEach((f) => {
        f.pause();
        f.removeAttribute('src');
        f.load();
      });
    });
  }
  if (reduced.matches) return;
  const main = document.querySelector('main');
  run(main, { opacity: [0, 1], y: [20, 0], duration: 650, ease: 'outQuart' });
  const chars = [...document.querySelectorAll('[data-letter]')];
  chars.forEach((el) => {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = [...text]
      .map((c) =>
        c === ' '
          ? '<span class="letter-space" aria-hidden="true">&nbsp;</span>'
          : `<span class="letter" aria-hidden="true">${c === '&' ? '&amp;' : c === '<' ? '&lt;' : c}</span>`,
      )
      .join('');
  });
  const heroLetters = document.querySelectorAll('.hero .letter');
  run(heroLetters, {
    y: ['110%', 0],
    opacity: [0, 1],
    rotate: [6, 0],
    delay: stagger(25, { start: 100 }),
    duration: 1000,
    ease: 'outExpo',
  });
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        const letters = entry.target.querySelectorAll('.letter');
        if (letters.length)
          run(letters, {
            y: ['100%', 0],
            opacity: [0, 1],
            delay: stagger(18),
            duration: 850,
            ease: 'outExpo',
          });
        else run(entry.target, { y: [45, 0], opacity: [0, 1], duration: 850, ease: 'outQuart' });
      });
    },
    { threshold: 0.13 },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
  cleanups.push(() => observer.disconnect());
  let raf = 0;
  const scroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const doc = document.documentElement;
      document
        .querySelector('.scroll-progress')
        ?.style.setProperty(
          '--progress',
          `${scrollY / Math.max(1, doc.scrollHeight - innerHeight)}`,
        );
      document.querySelectorAll('[data-parallax]').forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) {
          const offset = (r.top - innerHeight * 0.35) * Number(el.dataset.parallax || 0.12);
          el.style.transform = `translate3d(0,${offset}px,0)`;
        }
      });
      document.querySelectorAll('.scroll-word').forEach((el) => {
        const r = el.getBoundingClientRect();
        const p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.85)));
        el.style.setProperty('--fill', `${p * 100}%`);
      });
    });
  };
  addEventListener('scroll', scroll, { passive: true });
  scroll();
  cleanups.push(() => {
    removeEventListener('scroll', scroll);
    cancelAnimationFrame(raf);
  });
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    if (!matchMedia('(hover:hover)').matches) return;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      el.style.translate = `${(e.clientX - r.left - r.width / 2) * 0.11}px ${(e.clientY - r.top - r.height / 2) * 0.13}px`;
    };
    const leave = () => {
      el.style.translate = '0 0';
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    cleanups.push(() => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    });
  });
}
export function panelMotion(el) {
  run(el, { opacity: [0, 1], y: [24, 0], duration: 450, ease: 'outQuart' });
}
export function statusMotion(el) {
  run(el, { scale: [0.97, 1], opacity: [0.3, 1], duration: 320, ease: 'outQuart' });
}
