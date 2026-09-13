/* =========================================================
   Suraj Kumar — Portfolio
   Vanilla JS: nav toggle, scroll reveal, blob canvas animation
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  initNav();
  initCursorGlow();
  initRevealOnScroll();
  initPortraitScan();
  initImageCursor();
  initBlobCanvas('heroBlob', { hueA: [76, 233, 208], hueB: [157, 123, 255], count: 3 });
  initBlobCanvas('contactBlob', { hueA: [255, 122, 69], hueB: [255, 77, 77], count: 3 });
  initPreloader();
});

/* =========================================================
   Preloader: 0→100 counter + progress bar, then a large
   glitch/scramble reveal of the name before the site appears.
   ========================================================= */
function initPreloader() {
  const preloader = document.getElementById('preloader');
  const countEl = document.getElementById('preloaderCount');
  const barFill = document.getElementById('preloaderBarFill');
  const introName = document.getElementById('introName');
  const introText = document.getElementById('introNameText');
  const scrambleTarget = document.getElementById('introNameScramble');
  const tagline = document.getElementById('introNameTagline');
  if (!preloader || !countEl || !barFill || !introName || !scrambleTarget) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAME = 'SURAJ KUMAR';

  function unlockScroll() {
    document.body.classList.remove('is-loading');
  }

  function removeOverlays() {
    preloader.remove();
    introName.remove();
    unlockScroll();
  }

  function runNameIntro() {
    if (prefersReducedMotion) {
      preloader.classList.add('is-hidden');
      unlockScroll();
      setTimeout(removeOverlays, 300);
      return;
    }

    preloader.classList.add('is-hidden');
    introName.classList.add('is-active');

    const scramble = new TextScramble(scrambleTarget);
    scramble.setText(NAME).then(() => {
      // Lock the name in with a gradient sheen + punch-in, then bring the
      // tagline up beneath it before wiping the whole overlay away.
      introText.classList.add('is-settled');
      if (tagline) requestAnimationFrame(() => tagline.classList.add('is-visible'));

      setTimeout(() => {
        introName.classList.add('is-leaving');
        setTimeout(removeOverlays, 900);
      }, 900);
    });
  }

  // Simulated-but-real load progress: ramps quickly, hesitates near the
  // top until the window has actually finished loading, then snaps to 100.
  let progress = 0;
  let lastRendered = -1;
  let windowLoaded = document.readyState === 'complete';
  const start = performance.now();
  const MIN_DURATION = 1100;

  window.addEventListener('load', () => { windowLoaded = true; });

  function render(value) {
    const rounded = Math.round(value);
    if (rounded !== lastRendered) {
      lastRendered = rounded;
      countEl.textContent = rounded;
      if (!prefersReducedMotion) {
        countEl.classList.remove('is-tick');
        // Force reflow so the animation can retrigger on every tick.
        void countEl.offsetWidth;
        countEl.classList.add('is-tick');
      }
    }
    barFill.style.width = `${value}%`;
  }

  function tick(now) {
    const elapsed = now - start;
    const canFinish = windowLoaded && elapsed > MIN_DURATION;

    if (progress < 92 && !canFinish) {
      progress += (92 - progress) * 0.03 + 0.2;
    } else {
      progress += (100 - progress) * 0.15 + 0.6;
    }
    progress = Math.min(progress, 100);
    render(progress);

    if (progress < 100) {
      requestAnimationFrame(tick);
    } else {
      setTimeout(runNameIntro, 200);
    }
  }

  if (prefersReducedMotion) {
    render(100);
    setTimeout(runNameIntro, 150);
  } else {
    requestAnimationFrame(tick);
  }

  // Absolute safety net: never trap a visitor behind the loader.
  setTimeout(() => {
    if (document.body.contains(preloader)) {
      progress = 100;
      render(100);
      runNameIntro();
    }
  }, 6000);
}

/* ---------- TextScramble: decode-style scramble reveal ----------
   Classic char-scramble effect (each character cycles through random
   glyphs before locking into its final letter, left → right).
*/
class TextScramble {
  constructor(el) {
    this.el = el;
    this.chars = '!<>-_\\/[]{}—=+*^?#________';
    this.frame = 0;
    this.frameRequest = null;
    this.queue = [];
    this.resolve = null;
  }

  setText(newText) {
    const oldText = this.el.textContent || '';
    const length = Math.max(oldText.length, newText.length);
    const promise = new Promise((resolve) => (this.resolve = resolve));
    this.queue = [];

    for (let i = 0; i < length; i++) {
      const from = oldText[i] || '';
      const to = newText[i] || '';
      const start = Math.floor(Math.random() * 12);
      const end = start + Math.floor(Math.random() * 18) + 8;
      this.queue.push({ from, to, start, end });
    }

    cancelAnimationFrame(this.frameRequest);
    this.frame = 0;
    this.update();
    return promise;
  }

  update() {
    let output = '';
    let complete = 0;

    for (let i = 0, n = this.queue.length; i < n; i++) {
      const { from, to, start, end, char } = this.queue[i];

      if (this.frame >= end) {
        complete++;
        output += to;
      } else if (this.frame >= start) {
        if (!char || Math.random() < 0.28) {
          this.queue[i].char = this.randomChar();
        }
        output += `<span class="is-scrambling">${this.queue[i].char}</span>`;
      } else {
        output += from;
      }
    }

    this.el.innerHTML = output;

    if (complete === this.queue.length) {
      this.resolve();
    } else {
      this.frameRequest = requestAnimationFrame(() => {
        this.frame++;
        this.update();
      });
    }
  }

  randomChar() {
    return this.chars[Math.floor(Math.random() * this.chars.length)];
  }
}

/* ---------- Image cursor (shows the matching hover.png crop over the portrait) ---------- */
function initImageCursor() {
  const figure = document.getElementById('portraitFigure');
  const cursor = document.getElementById('imageCursor');
  const crop = document.getElementById('imageCursorCrop');
  if (!figure || !cursor || !crop) return;

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!canHover) return; // touch devices keep the tap-to-scan behaviour instead

  let raf = null;
  let targetX = 0;
  let targetY = 0;
  let x = 0;
  let y = 0;

  function updateCrop(clientX, clientY) {
    // Map the pointer's position over the *photo* to a background-position
    // on hover.png, so the card always shows the slice of the x-ray
    // portrait that sits directly beneath the cursor — not the whole image.
    const rect = figure.getBoundingClientRect();
    const cursorSize = cursor.offsetWidth;
    const relX = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const relY = Math.min(Math.max(clientY - rect.top, 0), rect.height);

    crop.style.backgroundSize = `${rect.width}px ${rect.height}px`;
    crop.style.backgroundPosition = `${-(relX - cursorSize / 2)}px ${-(relY - cursorSize / 2)}px`;
  }

  function loop() {
    // Light easing so the card glides to the pointer instead of snapping.
    x += (targetX - x) * 0.32;
    y += (targetY - y) * 0.32;
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    raf = requestAnimationFrame(loop);
  }

  function show(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    x = targetX;
    y = targetY;
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    updateCrop(e.clientX, e.clientY);
    cursor.classList.add('is-active');
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function move(e) {
    targetX = e.clientX;
    targetY = e.clientY;
    updateCrop(e.clientX, e.clientY);
  }

  function hide() {
    cursor.classList.remove('is-active');
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  figure.addEventListener('mouseenter', show);
  figure.addEventListener('mousemove', move);
  figure.addEventListener('mouseleave', hide);
}

/* ---------- Portrait skeleton/x-ray scan (tap support for touch devices) ---------- */
function initPortraitScan() {
  const portrait = document.querySelector('.hero__portrait');
  if (!portrait) return;

  const isTouch = window.matchMedia('(hover: none)').matches;
  if (!isTouch) return;

  portrait.addEventListener('click', (e) => {
    e.preventDefault();
    portrait.classList.toggle('is-scanning');
  });
}

/* ---------- Navigation ---------- */
function initNav() {
  const nav = document.getElementById('nav');
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 20);
  });

  burger.addEventListener('click', () => {
    burger.classList.toggle('is-open');
    links.classList.toggle('is-open');
  });

  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => {
      burger.classList.remove('is-open');
      links.classList.remove('is-open');
    });
  });
}

/* ---------- Cursor glow ---------- */
function initCursorGlow() {
  const glow = document.getElementById('cursorGlow');
  if (!glow || window.matchMedia('(max-width: 900px)').matches) return;

  window.addEventListener('mousemove', (e) => {
    glow.style.transform = `translate(${e.clientX - 210}px, ${e.clientY - 210}px)`;
  });
}

/* ---------- Reveal on scroll ---------- */
function initRevealOnScroll() {
  const items = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('is-visible'), i * 60);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------- Animated blob canvas ----------
   Lightweight, dependency-free "liquid blob" made of
   several soft radial-gradient blobs drifting + pulsing.
*/
function initBlobCanvas(canvasId, opts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let width, height, dpr;
  let blobs = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makeBlobs() {
    blobs = [];
    const count = opts.count || 3;
    for (let i = 0; i < count; i++) {
      blobs.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.min(width, height) * (0.25 + Math.random() * 0.2),
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        phase: Math.random() * Math.PI * 2,
        color: i % 2 === 0 ? opts.hueA : opts.hueB,
      });
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    blobs.forEach((b) => {
      b.x += b.vx;
      b.y += b.vy;

      if (b.x < -b.r) b.x = width + b.r;
      if (b.x > width + b.r) b.x = -b.r;
      if (b.y < -b.r) b.y = height + b.r;
      if (b.y > height + b.r) b.y = -b.r;

      const pulse = 1 + Math.sin(time * 0.0004 + b.phase) * 0.12;
      const radius = b.r * pulse;

      const [r, g, bl] = b.color;
      const gradient = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${bl}, 0.35)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${bl}, 0.14)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${bl}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalCompositeOperation = 'source-over';

    if (!prefersReducedMotion) {
      requestAnimationFrame(draw);
    }
  }

  resize();
  makeBlobs();

  window.addEventListener('resize', () => {
    resize();
    makeBlobs();
  });

  if (prefersReducedMotion) {
    draw(0);
  } else {
    requestAnimationFrame(draw);
  }
}
