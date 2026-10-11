import { animate } from 'animejs';
import './intro.css';
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let active = null;
let seen = false;
try {
  seen = sessionStorage.getItem('verse_intro_seen') === 'watch-outlet-v2';
} catch {}
export function cancelIntro() {
  active?.finish(true);
}
export function shouldIntroduce() {
  return (
    !seen &&
    !motionQuery.matches &&
    !navigator.connection?.saveData &&
    location.pathname === '/' &&
    !location.hash
  );
}
export function playIntro({ replay = false, poster } = {}) {
  if (active) return active.done;
  if (motionQuery.matches || navigator.connection?.saveData) return Promise.resolve();
  seen = true;
  try {
    sessionStorage.setItem('verse_intro_seen', 'watch-outlet-v2');
  } catch {}
  const app = document.querySelector('#app'),
    previousFocus = document.activeElement;
  const overlay = document.createElement('section');
  overlay.className = 'cinematic-intro';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'VERSE cinematic introduction');
  overlay.innerHTML = `<div class="intro-atmosphere" aria-hidden="true"></div><div class="intro-identity" aria-hidden="true"><img src="/media/intro/verse-symbol.png" alt="" width="100" height="80"><span>VERSE</span><i class="identity-sweep"></i></div><div class="intro-stage" aria-hidden="true"><img class="intro-poster" alt="" width="1200" height="1200"><canvas></canvas><video muted playsinline preload="none" disablepictureinpicture></video><div class="intro-light"></div></div><div class="intro-finale" aria-hidden="true"><img src="/media/intro/verse-symbol.png" width="40" height="32" alt=""><span>VERSE</span><small>A DIFFERENT SENSE OF TIME</small></div><p class="intro-note">AN ORIGINAL WATCH CONCEPT</p><div class="intro-controls"><button class="intro-pause" aria-pressed="false">Pause intro</button><button class="intro-skip">Skip intro <span aria-hidden="true">↗</span></button></div><div class="intro-progress" aria-hidden="true"><i></i></div>`;
  if (poster) overlay.querySelector('.intro-poster').src = poster;
  document.body.append(overlay);
  const scrollYBefore = scrollY,
    overflowBefore = document.body.style.overflow;
  const initiallyInert = app.inert;
  app.inert = true;
  const banner = document.querySelector('#cookie-banner');
  const bannerInert = banner?.inert;
  if (banner) banner.inert = true;
  document.body.classList.add('intro-running');
  document.body.style.overflow = 'hidden';
  const skip = overlay.querySelector('.intro-skip'),
    pause = overlay.querySelector('.intro-pause');
  skip.focus({ preventScroll: true });
  let resolve;
  const done = new Promise((r) => (resolve = r));
  let scene,
    stopped = false,
    exiting = false,
    raf,
    elapsed = 0,
    last = 0,
    lastDraw = 0,
    paused = false,
    videoMode = false,
    videoReady = false,
    fallbackPending = false,
    videoLoading = false,
    videoStarted = false,
    finalHold = 0,
    storyDuration = 18,
    revealAt = 14.5;
  const video = overlay.querySelector('video');
  const animations = [];
  const timeout = setTimeout(() => {
    if (!paused && !document.hidden) finish(true);
  }, 30000); // Stalled loading cannot trap the user; deliberate pause is respected.
  function markCompleted() {
    document.dispatchEvent(new CustomEvent('verse:intro-complete'));
  }
  function cleanup() {
    stopped = true;
    cancelAnimationFrame(raf);
    clearTimeout(timeout);
    scene?.dispose();
    animations.forEach((a) => a.cancel());
    video.pause();
    video.removeAttribute('src');
    video.load();
    overlay.remove();
    document.removeEventListener('keydown', keyboard);
    document.removeEventListener('visibilitychange', visibility);
    motionQuery.removeEventListener('change', motionChange);
    app.inert = initiallyInert;
    if (banner) banner.inert = bannerInert;
    document.body.style.overflow = overflowBefore;
    document.body.classList.remove('intro-running');
    scrollTo({ top: scrollYBefore, behavior: 'instant' });
    active = null;
    if (replay && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    else document.querySelector('#main')?.focus({ preventScroll: true });
    markCompleted();
    resolve();
  }
  function finish(instant = false) {
    if (stopped || exiting) return;
    exiting = true;
    cancelAnimationFrame(raf);
    scene?.dispose();
    if (instant || motionQuery.matches) {
      cleanup();
      return;
    }
    overlay.dataset.phase = 'transition';
    animations.push(
      animate(overlay, { opacity: [1, 0], duration: 850, ease: 'inOutCubic', onComplete: cleanup }),
    );
  }
  active = { done, finish };
  function keyboard(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      finish();
    }
    if (ev.key === 'Tab') {
      const target = ev.shiftKey ? pause : skip;
      if (document.activeElement === target) {
        ev.preventDefault();
        (ev.shiftKey ? skip : pause).focus();
      }
    }
  }
  function visibility() {
    last = 0;
    if (document.hidden) video.pause();
    else if (!paused && videoMode && videoReady && videoStarted && !video.ended)
      video.play().catch(() => fallback());
  }
  function motionChange() {
    if (motionQuery.matches) finish(true);
  }
  document.addEventListener('keydown', keyboard);
  document.addEventListener('visibilitychange', visibility);
  motionQuery.addEventListener('change', motionChange);
  skip.onclick = () => finish();
  pause.onclick = () => {
    paused = !paused;
    last = 0;
    overlay.dataset.paused = String(paused);
    pause.textContent = paused ? 'Resume intro' : 'Pause intro';
    pause.setAttribute('aria-pressed', String(paused));
    if (videoMode) {
      if (paused) video.pause();
      else if (videoStarted && !video.ended) video.play().catch(() => fallback());
    }
  };
  // Always-visible exact branding, followed by local video or the real-time concept.
  const identity = overlay.querySelector('.intro-identity'),
    finale = overlay.querySelector('.intro-finale'),
    stage = overlay.querySelector('.intro-stage'),
    bar = overlay.querySelector('.intro-progress i');
  function frame(t) {
    if (stopped || exiting) return;
    let delta = 0;
    if (!document.hidden && !paused) {
      if (last) delta = Math.min((t - last) / 1000, 0.1);
      elapsed += delta;
      last = t;
    } else last = 0;
    if (videoLoading && !videoReady && elapsed > 1.1) elapsed = 1.1;
    const movieTime = video.currentTime;
    const s = videoMode && videoStarted ? 1.5 + movieTime : elapsed;
    overlay.dataset.phase =
      videoMode && videoStarted
        ? movieTime < 2
          ? 'components'
          : movieTime < 5
            ? 'assembly'
            : movieTime < 6.5
              ? 'rotation'
              : movieTime < 8
                ? 'zoom'
                : movieTime < 10
                  ? 'portal'
                  : movieTime < 13
                    ? 'outlet'
                    : movieTime < revealAt
                      ? 'doors'
                      : 'reveal'
        : s < 1.5
          ? 'identity'
          : s < 4
            ? 'components'
            : s < 6.5
              ? 'assembly'
              : s < 8
                ? 'rotation'
                : 'reveal';
    identity.style.opacity = String(
      Math.min(1, s / 0.6) * Math.max(0, Math.min(1, (1.8 - s) / 0.5)),
    );
    identity.style.transform = `translate(-50%,-50%) scale(${0.96 + Math.min(s, 1.5) * 0.027})`;
    stage.style.opacity = String(Math.max(0, Math.min(1, (s - 1.35) / 0.6)));
    const finaleProgress = Math.max(
      0,
      Math.min(1, (videoMode ? movieTime - revealAt : s - 8) / 0.7),
    );
    finale.style.opacity = String(finaleProgress);
    finale.style.transform = `translate(-50%,${Math.max(0, (1 - finaleProgress) * 14)}px)`;
    overlay.querySelector('.intro-note').style.opacity = String(
      Math.max(0, Math.min(1, (s - 1.5) / 0.5)),
    );
    bar.style.transform = `scaleX(${Math.min(s / (videoMode ? storyDuration + 1.5 : 10.5), 1)})`;
    if (!paused && !document.hidden && t - lastDraw > 1000 / (innerWidth < 768 ? 30 : 45)) {
      scene?.frame(s);
      lastDraw = t;
    }
    if (
      videoMode &&
      videoReady &&
      !videoStarted &&
      elapsed >= 1.5 &&
      video.paused &&
      !video.ended &&
      !paused &&
      !document.hidden
    ) {
      videoStarted = true;
      video.play().catch(() => fallback());
    }
    if (videoMode && video.ended) finalHold += delta;
    if ((!videoMode && s >= 10.5) || (videoMode && finalHold > 0.25)) {
      finish();
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  async function fallback() {
    if (stopped || exiting || fallbackPending) return;
    fallbackPending = true;
    videoMode = false;
    videoLoading = false;
    elapsed = Math.min(elapsed, 2);
    video.pause();
    overlay.classList.remove('intro-video');
    try {
      const { createAssemblyScene } = await import('./intro-scene.js');
      if (stopped || exiting) return;
      scene?.dispose();
      scene = createAssemblyScene(overlay.querySelector('canvas'));
      overlay.classList.add('intro-webgl');
    } catch {
      if (!stopped) {
        overlay.classList.add('intro-static');
        overlay.querySelector('.intro-note').textContent = 'SOURCE PRODUCT PHOTOGRAPH';
      }
    } finally {
      fallbackPending = false;
    }
  }
  fetch('/media/intro/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then(async (manifest) => {
      if (stopped || exiting) return;
      const source = innerWidth < 768 ? manifest?.mobile : manifest?.desktop;
      if (
        manifest?.inspected === true &&
        source?.startsWith('/media/intro/') &&
        source.endsWith('.mp4')
      ) {
        videoMode = true;
        videoLoading = true;
        storyDuration = Number(manifest.duration_seconds) || 18;
        revealAt = Number(manifest.logo_reveal_seconds) || 14.5;
        overlay.classList.add('intro-video');
        if (manifest.poster?.startsWith('/media/intro/')) video.poster = manifest.poster;
        overlay.querySelector('.intro-note').textContent = 'A CINEMATIC BRAND CONCEPT';
        const fail = () => fallback();
        video.addEventListener('error', fail, { once: true });
        video.addEventListener(
          'loadeddata',
          () => {
            videoReady = true;
            videoLoading = false;
          },
          { once: true },
        );
        video.src = source;
        video.load();
        setTimeout(() => {
          if (!stopped && !videoReady) fallback();
        }, 5000);
      } else await fallback();
    })
    .catch(fallback);
  raf = requestAnimationFrame(frame);
  return done;
}
