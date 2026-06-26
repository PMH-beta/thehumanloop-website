/* =====================================================================
   THE HUMAN LOOP — main.js
   Requires three.js (loaded before this file).
   Blocks in order:
     - Page load / fade-in
     - NAV (pixel-precise color clipping)          [Section 1]
     - Counter animation                           [Section 5]
     - Hero: trail cursor, letters, 3D tilt        [Section 1]
     - Floating letters                            [Section 1]
     - Trail ghost reveal                          [Section 2]
     - Mobile draw mode + hamburger menu           [Section 1]
     - Globe (three.js + value words)              [Section 3]
     - Step cards tap-active                       [Section 4]
     - Cookie banner + legal modals                [global]
     - Bioluminescence touch effect                [global]
   ===================================================================== */

// Fade in body when all assets loaded (or after max timeout)
window.addEventListener('load', () => document.body.classList.add('loaded'));
setTimeout(() => document.body.classList.add('loaded'), 2000); // safety fallback

// ============================================
// NAV — pixel-precise color via clip-path wrappers
// ============================================
const wrapCream = document.getElementById('wrapCream');
const wrapYellow = document.getElementById('wrapYellow');
const navBaseWrap = document.getElementById('navBaseWrap');

function getSectionRange(sectionId) {
  const el = document.getElementById(sectionId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.bottom <= 0 || r.top >= innerHeight) return null;
  return { top: Math.max(0, r.top), bottom: Math.min(innerHeight, r.bottom) };
}

function rangeToInset(range) {
  if (!range) return 'inset(100% 0 0 0)';
  return `inset(${range.top}px 0 ${innerHeight - range.bottom}px 0)`;
}

function updateNavClips() {
  const cream = getSectionRange('how');
  const yellow = getSectionRange('counterSection');

  // Color overlays: only show inside their section (pixel-precise mask)
  wrapCream.style.clipPath = rangeToInset(cream);
  wrapYellow.style.clipPath = rangeToInset(yellow);

  // Real nav: hide in color sections (color layers take over there — they're clickable)
  const bands = [];
  if (cream) bands.push(cream);
  if (yellow) bands.push(yellow);
  bands.sort((a, b) => a.top - b.top);

  if (bands.length === 0) {
    navBaseWrap.style.clipPath = 'none';
    return;
  }
  const visibleParts = [];
  let cursor = 0;
  bands.forEach(b => {
    if (b.top > cursor) visibleParts.push({ top: cursor, bottom: b.top });
    cursor = Math.max(cursor, b.bottom);
  });
  if (cursor < innerHeight) visibleParts.push({ top: cursor, bottom: innerHeight });

  if (visibleParts.length === 0) {
    navBaseWrap.style.clipPath = 'inset(100% 0 0 0)';
  } else if (visibleParts.length === 1) {
    navBaseWrap.style.clipPath = rangeToInset(visibleParts[0]);
  } else {
    const pts = [];
    visibleParts.forEach((p) => {
      pts.push(`0 ${p.top}px`, `100% ${p.top}px`, `100% ${p.bottom}px`, `0 ${p.bottom}px`);
    });
    navBaseWrap.style.clipPath = `polygon(${pts.join(', ')})`;
  }
}
window.addEventListener('scroll', updateNavClips, { passive: true });
window.addEventListener('resize', updateNavClips);
updateNavClips();

// ============================================
// COUNTER ANIMATION
// ============================================
const counterAmount = document.getElementById('counterAmount');
const counterBarFill = document.getElementById('counterBarFill');
const TARGET = 4200;
const GOAL = 10000;
const PERCENT = (TARGET / GOAL) * 100;

function animateCounter() {
  const duration = 2500;
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(TARGET * eased);
    counterAmount.textContent = val.toLocaleString('de-DE') + ' €';
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  counterBarFill.style.width = PERCENT + '%';
}

const counterObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      animateCounter();
      counterObs.disconnect();
    }
  });
}, { threshold: 0.3 });
counterObs.observe(document.querySelector('.section-counter'));

// ============================================
// HERO — TRAIL CURSOR + LETTERS + 3D TILT
// ============================================

function splitLetters(text, container) {
  container.innerHTML = '';
  const spans = [];
  [...text].forEach((char) => {
    const span = document.createElement('span');
    span.className = 'logo-letter';
    span.textContent = char === ' ' ? '\u00A0' : char;
    container.appendChild(span);
    spans.push(span);
  });
  return spans;
}

const allLetters = [
  ...splitLetters('The', document.getElementById('line1')),
  ...splitLetters('Human', document.getElementById('line2')),
  ...splitLetters('Loop', document.getElementById('line3')),
];

function splitNavyLetters(text, container) {
  container.innerHTML = '';
  const spans = [];
  [...text].forEach((char) => {
    const span = document.createElement('span');
    span.className = 'logo-letter';
    span.style.opacity = '1';
    span.textContent = char === ' ' ? '\u00A0' : char;
    container.appendChild(span);
    spans.push(span);
  });
  return spans;
}
const allNavyLetters = [
  ...splitNavyLetters('The', document.getElementById('navyLine1')),
  ...splitNavyLetters('Human', document.getElementById('navyLine2')),
  ...splitNavyLetters('Loop', document.getElementById('navyLine3')),
];
function syncNavyTransforms() {
  for (let i = 0; i < allLetters.length && i < allNavyLetters.length; i++) {
    allNavyLetters[i].style.transform = allLetters[i].style.transform || 'none';
    allNavyLetters[i].style.opacity = getComputedStyle(allLetters[i]).opacity;
  }
  requestAnimationFrame(syncNavyTransforms);
}
syncNavyTransforms();

const trailCanvas = document.getElementById('trailCanvas');
const tCtx = trailCanvas.getContext('2d');
const cursor = document.getElementById('cursor');
const cursorDot = document.getElementById('cursorDot');
const hero = document.getElementById('hero');

const isTouchDev = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 1366;
let drawModeActive = false;

const TRAIL_WIDTH = 30;
let mouseX = -200, mouseY = -200;
let cursorX = -200, cursorY = -200, dotX = -200, dotY = -200;
let trailPoints = [];
let mouseSpeed = 0;
let lastMoveTime = 0;
let lastMoveX = 0, lastMoveY = 0;
let wasInHero = false;

const MIN_VISIBLE = 3;
const MAX_VISIBLE = 280;

function resizeTrail() {
  trailCanvas.width = hero.offsetWidth;
  trailCanvas.height = hero.offsetHeight;
}
resizeTrail();
window.addEventListener('resize', resizeTrail);

document.addEventListener('mousemove', e => {
  if (isTouchDev) return;
  mouseX = e.clientX;
  mouseY = e.clientY;

  const heroRect = hero.getBoundingClientRect();
  const inHero = e.clientY >= heroRect.top && e.clientY <= heroRect.bottom;

  if (inHero) {
    cursor.classList.remove('hidden');
    cursorDot.classList.remove('hidden');
    document.body.classList.remove('outside-hero');
  } else {
    cursor.classList.add('hidden');
    cursorDot.classList.add('hidden');
    document.body.classList.add('outside-hero');
  }

  if (!inHero) {
    wasInHero = false;
    mouseSpeed *= 0.85;
    return;
  }

  const justEntered = !wasInHero;
  wasInHero = true;

  const now = performance.now();
  const dt = now - lastMoveTime;
  if (dt > 0) {
    const dist = Math.hypot(e.clientX - lastMoveX, e.clientY - lastMoveY);
    const instantSpeed = dist / Math.max(dt, 1) * 16;
    mouseSpeed = mouseSpeed * 0.7 + instantSpeed * 0.3;
  }
  lastMoveTime = now;
  lastMoveX = e.clientX;
  lastMoveY = e.clientY;

  const nx = e.clientX;
  const ny = e.clientY - heroRect.top;
  const last = trailPoints[trailPoints.length - 1];

  if (!last || justEntered) {
    trailPoints.push({ x: nx, y: ny });
    return;
  }
  const gap = Math.hypot(nx - last.x, ny - last.y);
  if (gap > 200) { trailPoints.push({ x: nx, y: ny }); return; }
  const STEP = 3;
  if (gap > STEP) {
    const steps = Math.ceil(gap / STEP);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      trailPoints.push({
        x: last.x + (nx - last.x) * t,
        y: last.y + (ny - last.y) * t,
      });
    }
  } else if (gap > 1) {
    trailPoints.push({ x: nx, y: ny });
  }
});

function animateCursor() {
  if (!isTouchDev) {
    cursorX += (mouseX - cursorX) * 0.12;
    cursorY += (mouseY - cursorY) * 0.12;
    dotX += (mouseX - dotX) * 0.35;
    dotY += (mouseY - dotY) * 0.35;
    cursor.style.left = cursorX + 'px';
    cursor.style.top = cursorY + 'px';
    cursorDot.style.left = dotX + 'px';
    cursorDot.style.top = dotY + 'px';
  }
  requestAnimationFrame(animateCursor);
}
animateCursor();

function drawTrail() {
  tCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
  const heroR = hero.getBoundingClientRect();
  const cursorOutsideHero = isTouchDev
    ? !drawModeActive
    : (mouseY < heroR.top || mouseY > heroR.bottom);

  if (cursorOutsideHero) {
    const removeCount = Math.max(8, Math.ceil(trailPoints.length * 0.15));
    trailPoints.splice(0, removeCount);
    mouseSpeed *= 0.75;
  } else {
    mouseSpeed *= 0.94;
  }

  const speedNorm = Math.min(mouseSpeed / 12, 1);
  const targetVisible = Math.floor(MIN_VISIBLE + (MAX_VISIBLE - MIN_VISIBLE) * speedNorm);
  const excess = trailPoints.length - targetVisible;
  if (excess > 0) {
    const removeCount = Math.min(excess, Math.max(4, Math.ceil(excess * 0.35)));
    trailPoints.splice(0, removeCount);
  }

  if (trailPoints.length < 2) { requestAnimationFrame(drawTrail); return; }
  const FADE_ZONE = Math.min(12, Math.floor(trailPoints.length * 0.25));

  function drawTrailPath(ctx) {
    for (let i = 1; i < trailPoints.length; i++) {
      const p0 = trailPoints[i - 1], p1 = trailPoints[i];
      if (!p0 || !p1) continue;
      const segGap = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (segGap > 200) continue;
      let alpha = 1.0;
      if (i < FADE_ZONE) { alpha = i / FADE_ZONE; alpha = alpha * alpha; }
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      if (i < trailPoints.length - 1 && trailPoints[i + 1]) {
        const p2 = trailPoints[i + 1];
        const nextGap = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (nextGap < 200) {
          const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
          ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
        } else ctx.lineTo(p1.x, p1.y);
      } else ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(255, 208, 0, ${alpha})`;
      ctx.stroke();
    }
  }

  tCtx.lineWidth = TRAIL_WIDTH;
  tCtx.lineCap = 'round';
  tCtx.lineJoin = 'round';
  drawTrailPath(tCtx);

  const navyOvEl = document.getElementById('navyOverlay');
  const navyOvNavEl = document.getElementById('navyOverlayNav');
  if (trailPoints.length > 3) {
    const r = TRAIL_WIDTH / 2 + 4;
    const allPts = trailPoints.filter(p => p != null);
    const step = Math.max(1, Math.floor(allPts.length / 80));
    let pts = [];
    for (let i = 0; i < allPts.length; i += step) pts.push(allPts[i]);
    if (pts[pts.length - 1] !== allPts[allPts.length - 1]) pts.push(allPts[allPts.length - 1]);
    let filtered = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y) < 200) filtered.push(pts[i]);
    }
    pts = filtered;
    if (pts.length >= 3) {
      const normals = pts.map((p, i, arr) => {
        let nx = 0, ny = 0, c = 0;
        if (i < arr.length - 1) {
          const d = Math.hypot(arr[i+1].x - p.x, arr[i+1].y - p.y) || 1;
          nx += -(arr[i+1].y - p.y) / d; ny += (arr[i+1].x - p.x) / d; c++;
        }
        if (i > 0) {
          const d = Math.hypot(p.x - arr[i-1].x, p.y - arr[i-1].y) || 1;
          nx += -(p.y - arr[i-1].y) / d; ny += (p.x - arr[i-1].x) / d; c++;
        }
        if (c) { nx /= c; ny /= c; }
        const len = Math.hypot(nx, ny) || 1;
        return { x: nx / len, y: ny / len };
      });
      const top = pts.map((p, i) => `${(p.x + normals[i].x * r).toFixed(1)}px ${(p.y + normals[i].y * r).toFixed(1)}px`);
      const bottom = pts.map((p, i) => `${(p.x - normals[i].x * r).toFixed(1)}px ${(p.y - normals[i].y * r).toFixed(1)}px`).reverse();
      const polyClip = `polygon(${[...top, ...bottom].join(',')})`;
      navyOvEl.style.clipPath = polyClip;
      navyOvNavEl.style.clipPath = polyClip;
    } else { navyOvEl.style.clipPath = 'circle(0% at 0 0)'; navyOvNavEl.style.clipPath = 'circle(0% at 0 0)'; }
  } else { navyOvEl.style.clipPath = 'circle(0% at 0 0)'; navyOvNavEl.style.clipPath = 'circle(0% at 0 0)'; }

  requestAnimationFrame(drawTrail);
}
drawTrail();

// 3D Tilt
const imageWrapperBg = document.getElementById('imageWrapperBg');
const imageWrapperPersons = document.getElementById('imageWrapperPersons');
let targetRotX = 0, targetRotY = 0, currentRotX = 0, currentRotY = 0;

hero.addEventListener('mousemove', e => {
  if (isTouchDev) return;
  const rect = hero.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  targetRotY = x * 8;
  targetRotX = y * -5;
});
hero.addEventListener('mouseleave', () => { targetRotX = 0; targetRotY = 0; });

function animate3D() {
  currentRotX += (targetRotX - currentRotX) * 0.06;
  currentRotY += (targetRotY - currentRotY) * 0.06;
  imageWrapperBg.style.transform = `translate(${currentRotY * -10}px, ${currentRotX * 10}px) rotateX(${currentRotX * 0.6}deg) rotateY(${currentRotY * 0.6}deg) scale(1.08)`;
  imageWrapperPersons.style.transform = `translate(${currentRotY * -4}px, ${currentRotX * 4}px) rotateX(${currentRotX * 0.4}deg) rotateY(${currentRotY * 0.4}deg) scale(1.03)`;
  requestAnimationFrame(animate3D);
}
animate3D();

// Prevent image drag
['heroImageBg', 'heroImagePersons'].forEach(id => {
  const el = document.getElementById(id);
  el.setAttribute('draggable', 'false');
  el.addEventListener('dragstart', e => e.preventDefault());
});

// ============================================
// FLOATING LETTERS
// ============================================
const CATCH_RADIUS = 70;
class FloatingLetter {
  constructor(el, index) {
    this.el = el;
    this.index = index;
    this.phase = 'falling';
    const vw = window.innerWidth, vh = window.innerHeight;
    const rect = el.getBoundingClientRect();
    this.homeAbsX = rect.left + rect.width / 2;
    this.homeAbsY = rect.top + rect.height / 2;
    this.x = (Math.random() - 0.3) * vw * 0.9 - this.homeAbsX + vw * 0.15;
    this.y = -(60 + Math.random() * 200);
    this.rot = (Math.random() - 0.5) * 30;
    this.vx = (Math.random() - 0.5) * 1.2;
    this.vy = 0.8 + Math.random() * 1.5;
    this.vrot = (Math.random() - 0.5) * 1.5;
    const letterW = rect.width || 60, letterH = rect.height || 80;
    const margin = Math.max(60, letterW);
    const availW = Math.max(100, vw - margin * 2 - letterW);
    const availH = Math.max(100, vh - margin * 2 - letterH);
    this.floatTargetX = margin + Math.random() * availW - this.homeAbsX + letterW / 2;
    this.floatTargetY = margin + Math.random() * availH - this.homeAbsY + letterH / 2;
    this.floatRot = (Math.random() - 0.5) * 20;
    this.driftPhase = Math.random() * Math.PI * 2;
    this.driftAmpX = 10 + Math.random() * 20;
    this.driftAmpY = 8 + Math.random() * 15;
    this.driftSpeed = 0.004 + Math.random() * 0.006;
    this.delay = 50 + Math.random() * 350;
    this.started = false;
    this.startTime = performance.now() + this.delay;
    this.el.style.opacity = '0';
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rot}deg)`;
  }
  update(now) {
    if (now < this.startTime) return;
    if (!this.started) { this.started = true; this.el.style.opacity = '1'; }
    if (this.phase === 'done') return;
    if (this.phase === 'falling') {
      const dy = this.floatTargetY - this.y, dx = this.floatTargetX - this.x, dr = this.floatRot - this.rot;
      this.vx += dx * 0.002; this.vy += dy * 0.002; this.vrot += dr * 0.008;
      this.vx *= 0.975; this.vy *= 0.975; this.vrot *= 0.975;
      this.x += this.vx; this.y += this.vy; this.rot += this.vrot;
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8 && Math.abs(this.vy) < 0.4) {
        this.phase = 'floating';
        this.floatEnterT = 0;
      }
    }
    if (this.phase === 'floating') {
      this.driftPhase += this.driftSpeed;
      // Ease-in factor over ~60 frames so transition from falling is smooth
      if (this.floatEnterT === undefined) this.floatEnterT = 1;
      else this.floatEnterT = Math.min(1, this.floatEnterT + 0.02);
      const f = this.floatEnterT;
      this.x = this.floatTargetX + Math.sin(this.driftPhase) * this.driftAmpX * f;
      this.y = this.floatTargetY + Math.cos(this.driftPhase * 0.7) * this.driftAmpY * f;
      this.rot = this.floatRot + Math.sin(this.driftPhase * 0.5) * 3 * f;
    }
    if (this.phase === 'caught') {
      const dx = 0 - this.x, dy = 0 - this.y, dr = 0 - this.rot;
      this.vx += dx * 0.06; this.vy += dy * 0.06; this.vrot += dr * 0.08;
      this.vx *= 0.83; this.vy *= 0.83; this.vrot *= 0.83;
      this.x += this.vx; this.y += this.vy; this.rot += this.vrot;
      if (Math.abs(dx) < 0.4 && Math.abs(dy) < 0.4 && Math.abs(this.vx) < 0.08 && Math.abs(this.vy) < 0.08) {
        this.x = 0; this.y = 0; this.rot = 0; this.phase = 'done';
      }
    }
    // Hard clamp position to viewport bounds
    // - If user has pressed Draw (this.activated): always clamp to keep letters in viewport
    // - Otherwise (initial spawn from above): only clamp once letter has entered viewport
    const screenY0 = this.homeAbsY + this.y;
    const screenX0 = this.homeAbsX + this.x;
    const inViewport = screenY0 > 0 && screenY0 < window.innerHeight
                    && screenX0 > 0 && screenX0 < window.innerWidth;
    if (this.phase !== 'done' && (this.activated || inViewport)) {
      const vw = window.innerWidth, vh = window.innerHeight;
      const m = 30;
      if (screenX0 < m) { this.x = m - this.homeAbsX; if (this.vx < 0) this.vx = -this.vx * 0.4; }
      else if (screenX0 > vw - m) { this.x = vw - m - this.homeAbsX; if (this.vx > 0) this.vx = -this.vx * 0.4; }
      if (screenY0 < m) { this.y = m - this.homeAbsY; if (this.vy < 0) this.vy = -this.vy * 0.4; }
      else if (screenY0 > vh - m) { this.y = vh - m - this.homeAbsY; if (this.vy > 0) this.vy = -this.vy * 0.4; }
    }
    this.el.style.transform = `translate(${this.x}px, ${this.y}px) rotate(${this.rot}deg)`;
  }
  getScreenPos() {
    const rect = this.el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  catch() {
    if (this.phase === 'floating' || this.phase === 'falling') {
      this.phase = 'caught';
      this.vx = 0; this.vy = 0; this.vrot = 0;
    }
  }
}
const letterObjects = allLetters.map((el, i) => new FloatingLetter(el, i));

document.addEventListener('mousemove', e => {
  letterObjects.forEach(lo => {
    if (lo.phase === 'floating' || lo.phase === 'falling') {
      const pos = lo.getScreenPos();
      const dist = Math.hypot(e.clientX - pos.x, e.clientY - pos.y);
      if (dist < CATCH_RADIUS) lo.catch();
    }
  });
});

function getHoverParams() {
  const vw = window.innerWidth;
  const scale = vw / 375;
  return {
    radius: Math.min(150 * scale, 300),
    push: Math.min(18 * scale, 35),
    scaleFactor: Math.min(0.06 * scale, 0.1),
    rotFactor: Math.min(3 * scale, 6),
  };
}
function updateSettledHover(e) {
  const heroRect = hero.getBoundingClientRect();
  const inHero = e.clientY >= heroRect.top && e.clientY <= heroRect.bottom;
  const hp = getHoverParams();
  letterObjects.forEach(lo => {
    if (lo.phase !== 'done') return;
    const rect = lo.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (inHero && dist < hp.radius) {
      const strength = 1 - (dist / hp.radius);
      const eased = strength * strength * strength;
      const angle = Math.atan2(cy - e.clientY, cx - e.clientX);
      const push = hp.push * eased;
      const tx = Math.cos(angle) * push, ty = Math.sin(angle) * push;
      const sc = 1 + hp.scaleFactor * eased;
      const rot = Math.cos(angle) * hp.rotFactor * eased;
      lo.el.style.transform = `translate(${tx}px, ${ty}px) scale(${sc}) rotate(${rot}deg)`;
    } else lo.el.style.transform = 'translate(0, 0) scale(1) rotate(0deg)';
  });
}
document.addEventListener('mousemove', updateSettledHover);

function tick() {
  const now = performance.now();
  letterObjects.forEach(lo => lo.update(now));
  requestAnimationFrame(tick);
}
tick();

// Trail history for ghost
const MIN_TRAIL_POINTS = 25;
let savedTrails = [];
let currentStroke = [];
let strokeTimeout = null;

document.addEventListener('mousemove', e => {
  currentStroke.push({ x: e.clientX, y: e.clientY });
  clearTimeout(strokeTimeout);
  strokeTimeout = setTimeout(() => {
    if (currentStroke.length >= MIN_TRAIL_POINTS) {
      savedTrails.push([...currentStroke]);
      if (savedTrails.length > 5) savedTrails.shift();
    }
    currentStroke = [];
  }, 300);
});

// Reveal section 2 with trail ghost
const ghostCanvas = document.getElementById('trailGhost');
const gCtx = ghostCanvas.getContext('2d');
const sectionAbout = document.getElementById('about');
let sectionRevealed = false;

function resizeGhost() {
  ghostCanvas.width = sectionAbout.offsetWidth;
  ghostCanvas.height = sectionAbout.offsetHeight;
}
function drawGhostTrail(points) {
  resizeGhost();
  const canvasW = ghostCanvas.width, canvasH = ghostCanvas.height;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  points.forEach(p => {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  });
  const trailW = maxX - minX || 1, trailH = maxY - minY || 1;
  // Reserve room for the stroke width — solve for scale such that
  // scaledTrail + lineWidth(scaled) fits within 80% of canvas
  // lineWidth = max(20, 30*scale)
  // We need: trail*scale + max(20, 30*scale) <= 0.8 * canvas
  // Approximation: try scale assuming small line, then refine
  const targetW = canvasW * 0.8;
  const targetH = canvasH * 0.8;
  let scale = Math.min(targetW / trailW, targetH / trailH);
  const lineW = Math.max(20, 30 * scale);
  // Now refine: trail*scale + lineW <= target → scale <= (target - lineW) / trail
  const refinedX = (targetW - lineW) / trailW;
  const refinedY = (targetH - lineW) / trailH;
  scale = Math.min(scale, refinedX, refinedY);
  if (scale <= 0) scale = 0.1;
  const finalLineW = Math.max(20, 30 * scale);
  const offsetX = (canvasW - trailW * scale) / 2 - minX * scale;
  const offsetY = (canvasH - trailH * scale) / 2 - minY * scale;
  gCtx.clearRect(0, 0, canvasW, canvasH);
  gCtx.lineCap = 'round'; gCtx.lineJoin = 'round';
  gCtx.lineWidth = finalLineW;
  gCtx.strokeStyle = '#FFD000';
  gCtx.beginPath();
  gCtx.moveTo(points[0].x * scale + offsetX, points[0].y * scale + offsetY);
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i], next = points[i + 1];
    const mx = ((p.x + next.x) / 2) * scale + offsetX;
    const my = ((p.y + next.y) / 2) * scale + offsetY;
    gCtx.quadraticCurveTo(p.x * scale + offsetX, p.y * scale + offsetY, mx, my);
  }
  const last = points[points.length - 1];
  gCtx.lineTo(last.x * scale + offsetX, last.y * scale + offsetY);
  gCtx.stroke();
}

function revealSection() {
  if (sectionRevealed) return;
  sectionRevealed = true;
  let candidates = [];
  if (trailPoints.length >= MIN_TRAIL_POINTS) candidates.push(trailPoints.map(p => ({ x: p.x, y: p.y })));
  if (currentStroke.length >= MIN_TRAIL_POINTS) candidates.push([...currentStroke]);
  savedTrails.forEach(s => { if (s.length >= MIN_TRAIL_POINTS) candidates.push(s); });
  let bestTrail = null;
  candidates.forEach(c => { if (!bestTrail || c.length > bestTrail.length) bestTrail = c; });
  if (bestTrail) drawGhostTrail(bestTrail);
  sectionAbout.classList.add('revealed');
}
function resetSection() {
  if (!sectionRevealed) return;
  sectionRevealed = false;
  sectionAbout.classList.remove('revealed');
  gCtx.clearRect(0, 0, ghostCanvas.width, ghostCanvas.height);
  savedTrails = [];
}
const heroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting && sectionRevealed) resetSection(); });
}, { threshold: 0.9 });
heroObserver.observe(hero);
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => { if (entry.isIntersecting && !sectionRevealed) revealSection(); });
}, { threshold: 0.1 });
sectionObserver.observe(sectionAbout);

// ============================================
// MOBILE DRAW MODE
// ============================================
const drawBtn = document.getElementById('drawBtn');
let mobileFullTrail = [];

if (isTouchDev) {
  document.body.style.cursor = 'auto';
  cursor.style.display = 'none';
  cursorDot.style.display = 'none';
  drawBtn.style.display = 'block';

  let autoCatchTimer = setTimeout(() => {
    letterObjects.forEach(lo => lo.catch());
  }, 4000);

  function activateDrawMode() {
    drawModeActive = true;
    drawBtn.classList.add('active');
    clearTimeout(autoCatchTimer);
    scrollYBeforeLock = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYBeforeLock}px`;
    document.body.style.width = '100%';
    hero.classList.add('draw-locked');
    trailCanvas.style.display = 'block';
    trailPoints = []; mobileFullTrail = []; mouseSpeed = 0;
    letterObjects.forEach(lo => {
      // Reset for ALL phases — re-activation must reset everyone
      // Note: do NOT recompute homeAbsX/Y here — they're the static DOM position;
      // recomputing while transform is applied would corrupt them with current visual pos
      const vw = window.innerWidth, vh = window.innerHeight;
      const letterW = lo.el.offsetWidth || 60, letterH = lo.el.offsetHeight || 80;
      const margin = Math.max(40, letterW * 0.8);
      const availW = Math.max(100, vw - margin * 2 - letterW);
      const availH = Math.max(100, vh - margin * 2 - letterH);
      lo.floatTargetX = margin + Math.random() * availW - lo.homeAbsX + letterW / 2;
      lo.floatTargetY = margin + Math.random() * availH - lo.homeAbsY + letterH / 2;
      lo.floatRot = (Math.random() - 0.5) * 20;
      lo.driftPhase = Math.random() * Math.PI * 2;
      lo.phase = 'falling';
      // Strong initial velocity (capped) + random burst for liveliness
      const dx = lo.floatTargetX - lo.x;
      const dy = lo.floatTargetY - lo.y;
      const VMAX = 12;
      lo.vx = Math.max(-VMAX, Math.min(VMAX, dx * 0.08 + (Math.random() - 0.5) * 6));
      lo.vy = Math.max(-VMAX, Math.min(VMAX, dy * 0.08 + (Math.random() - 0.5) * 6));
      lo.vrot = (lo.floatRot - lo.rot) * 0.12 + (Math.random() - 0.5) * 12;
      lo.floatEnterT = undefined;
      lo.started = true;
      lo.activated = true;
      lo.el.style.opacity = '1';
    });
  }
  function deactivateDrawMode() {
    drawModeActive = false;
    drawBtn.classList.remove('active');
    if (mobileFullTrail.length > 2) {
      savedTrails.push([...mobileFullTrail]);
      if (savedTrails.length > 5) savedTrails.shift();
      currentStroke = [...mobileFullTrail];
    }
    hero.classList.remove('draw-locked');
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, 0);
    if (mobileFullTrail.length > 2) {
      // draw after body layout is restored so section dims are accurate
      const _trailSnap = [...mobileFullTrail];
      requestAnimationFrame(() => {
        drawGhostTrail(_trailSnap);
        sectionRevealed = true;
        sectionAbout.classList.add('revealed');
      });
    }
    mouseSpeed = 0;
    trailPoints = []; mobileFullTrail = [];
    tCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    document.getElementById('navyOverlay').style.clipPath = 'circle(0% at 0 0)';
    const _navyOvNav = document.getElementById('navyOverlayNav');
    if (_navyOvNav) _navyOvNav.style.clipPath = 'circle(0% at 0 0)';
    letterObjects.forEach(lo => lo.catch());
  }
  drawBtn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (drawModeActive) deactivateDrawMode(); else activateDrawMode();
  });

  let touchDrawing = false;
  hero.addEventListener('touchstart', (e) => {
    if (!drawModeActive) return;
    if (e.target === drawBtn || drawBtn.contains(e.target)) return;
    if (hamburger && (e.target === hamburger || hamburger.contains(e.target))) return;
    if (mobileMenu && mobileMenu.classList.contains('open')) return;
    touchDrawing = true;
    const touch = e.touches[0];
    const heroRect = hero.getBoundingClientRect();
    trailPoints.push({ x: touch.clientX, y: touch.clientY - heroRect.top });
    mobileFullTrail.push({ x: touch.clientX, y: touch.clientY - heroRect.top });
    mouseSpeed = 12;
  }, { passive: true });

  hero.addEventListener('touchmove', (e) => {
    if (mobileMenu && mobileMenu.classList.contains('open')) return;
    const touch = e.touches[0];
    const heroRect = hero.getBoundingClientRect();
    if (drawModeActive) {
      const x = (touch.clientX - heroRect.left) / heroRect.width - 0.5;
      const y = (touch.clientY - heroRect.top) / heroRect.height - 0.5;
      targetRotY = x * 8; targetRotX = y * -5;
    }
    if (!drawModeActive || !touchDrawing) return;
    e.preventDefault();
    const nx = touch.clientX;
    const ny = touch.clientY - heroRect.top;
    const last = trailPoints[trailPoints.length - 1];
    if (last) {
      const gap = Math.hypot(nx - last.x, ny - last.y);
      if (gap > 3) {
        const steps = Math.ceil(gap / 3);
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const pt = { x: last.x + (nx - last.x) * t, y: last.y + (ny - last.y) * t };
          trailPoints.push(pt); mobileFullTrail.push(pt);
        }
      }
    } else {
      trailPoints.push({ x: nx, y: ny }); mobileFullTrail.push({ x: nx, y: ny });
    }
    mouseSpeed = 15;
    letterObjects.forEach(lo => {
      if (lo.phase === 'floating' || lo.phase === 'falling') {
        const pos = lo.getScreenPos();
        const dist = Math.hypot(touch.clientX - pos.x, touch.clientY - pos.y);
        if (dist < 80) lo.catch();
      }
    });
  }, { passive: false });

  hero.addEventListener('touchend', () => {
    touchDrawing = false;
    targetRotX = 0; targetRotY = 0;
  }, { passive: true });
}

// Hamburger Menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  let menuScrollY = 0;
  function openMenu() {
    hamburger.classList.add('open');
    mobileMenu.classList.add('open');
    menuScrollY = window.scrollY;
    document.body.style.top = `-${menuScrollY}px`;
    document.body.classList.add('menu-open');
    if (drawBtn) drawBtn.style.display = 'none';
    trailPoints = []; mouseSpeed = 0;
    tCtx.clearRect(0, 0, trailCanvas.width, trailCanvas.height);
    document.getElementById('navyOverlay').style.clipPath = 'circle(0% at 0 0)';
  }
  function closeMenu() {
    hamburger.classList.remove('open');
    mobileMenu.classList.remove('open');
    document.body.classList.remove('menu-open');
    document.body.style.top = '';
    window.scrollTo(0, menuScrollY);
    if (drawBtn) drawBtn.style.display = 'block';
  }
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation(); e.preventDefault();
    if (mobileMenu.classList.contains('open')) closeMenu(); else openMenu();
  });
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => closeMenu());
  });
  document.addEventListener('click', (e) => {
    if (mobileMenu.classList.contains('open') &&
        !mobileMenu.contains(e.target) &&
        !hamburger.contains(e.target)) closeMenu();
  });
}

// ============================================
// GLOBE (SECTION 3)
// ============================================
class Sp{
  constructor(v=0,s=.04,d=.73){this.t=v;this.c=v;this.v=0;this.s=s;this.d=d}
  set(t){this.t=t}
  tick(){this.v+=(this.t-this.c)*this.s;this.v*=this.d;this.c+=this.v}
}

const OC=[126,120,210],LA=[89,107,66];
const MW=2048,MH=1024;
const mC=document.createElement('canvas');mC.width=MW;mC.height=MH;
const mX=mC.getContext('2d');
function l2m(lo,la){return[(lo+180)/360*MW,(90-la)/180*MH]}
function ch(p,n){let r=p;for(let i=0;i<n;i++){const o=[];for(let j=0;j<r.length;j++){const a=r[j],b=r[(j+1)%r.length];o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25]);o.push([a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}r=o}return r}
function bl(raw){const pts=ch(raw,4).map(p=>l2m(p[0],p[1]));mX.beginPath();let a=(pts[0][0]+pts[1][0])/2,b=(pts[0][1]+pts[1][1])/2;mX.moveTo(a,b);for(let i=1;i<=pts.length;i++){const c=pts[i%pts.length],n=pts[(i+1)%pts.length];mX.quadraticCurveTo(c[0],c[1],(c[0]+n[0])/2,(c[1]+n[1])/2)}mX.closePath();mX.fill()}
mX.fillStyle=`rgb(${OC})`;mX.fillRect(0,0,MW,MH);mX.fillStyle=`rgb(${LA})`;
bl([[-145,72],[-130,74],[-115,72],[-105,68],[-95,66],[-85,64],[-75,60],[-65,55],[-58,50],[-62,46],[-66,44],[-72,42],[-78,38],[-82,34],[-84,30],[-88,28],[-94,26],[-100,24],[-106,26],[-110,28],[-116,32],[-120,36],[-124,42],[-126,48],[-130,54],[-136,58],[-142,62],[-150,66],[-155,70],[-145,72]]);
bl([[-100,24],[-96,22],[-92,18],[-88,16],[-84,14],[-80,10],[-78,8],[-80,12],[-84,16],[-90,20],[-96,22],[-100,24]]);
bl([[-78,8],[-72,10],[-64,8],[-56,4],[-48,0],[-42,-4],[-38,-10],[-36,-16],[-38,-22],[-42,-28],[-48,-34],[-54,-40],[-60,-48],[-64,-52],[-68,-52],[-72,-46],[-74,-38],[-76,-28],[-78,-18],[-80,-10],[-82,-2],[-80,4],[-78,8]]);
bl([[-10,36],[-6,40],[-8,44],[-4,48],[-2,52],[-4,56],[0,60],[6,64],[14,68],[22,70],[30,68],[34,64],[32,58],[28,52],[24,46],[20,42],[14,40],[8,38],[2,36],[-4,36],[-10,36]]);
bl([[-16,34],[-14,28],[-16,22],[-14,16],[-10,10],[-4,6],[4,4],[12,2],[18,-2],[24,-8],[30,-14],[34,-22],[34,-28],[30,-34],[24,-36],[18,-36],[12,-32],[8,-24],[6,-16],[2,-8],[-4,0],[-10,6],[-14,12],[-18,18],[-18,26],[-16,34]]);
bl([[34,62],[42,66],[54,70],[68,72],[84,74],[100,74],[116,72],[130,70],[142,66],[154,62],[164,56],[160,48],[150,42],[140,38],[132,34],[124,28],[118,24],[112,18],[106,12],[100,6],[96,0],[92,4],[86,10],[80,16],[74,20],[68,24],[62,28],[56,34],[50,40],[46,46],[42,52],[38,56],[34,62]]);
bl([[72,26],[78,26],[84,22],[88,16],[86,8],[80,4],[74,8],[70,16],[68,22],[72,26]]);
bl([[36,30],[40,24],[46,18],[52,16],[56,20],[56,26],[50,30],[44,32],[38,32],[36,30]]);
bl([[96,20],[100,16],[104,10],[104,2],[100,0],[96,4],[94,12],[96,20]]);
bl([[118,-16],[128,-12],[138,-12],[146,-16],[152,-22],[154,-30],[150,-38],[142,-40],[132,-38],[122,-32],[116,-24],[118,-16]]);
bl([[-52,62],[-42,60],[-32,66],[-24,72],[-22,78],[-28,82],[-40,82],[-50,78],[-56,72],[-54,66],[-52,62]]);
bl([[96,-2],[104,0],[114,0],[122,-2],[130,-6],[138,-8],[136,-12],[126,-10],[116,-8],[106,-6],[96,-2]]);

const globeCanvas=document.getElementById('globeCanvas');
const pixelSize=640;
globeCanvas.width=pixelSize;globeCanvas.height=pixelSize;

const gRenderer=new THREE.WebGLRenderer({canvas:globeCanvas,alpha:true,antialias:true});
gRenderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
gRenderer.setSize(pixelSize,pixelSize,false);
gRenderer.setClearColor(0x000000,0);
const gScene=new THREE.Scene();
const gCamera=new THREE.PerspectiveCamera(30,1,0.1,100);
gCamera.position.z=4.1;
const gTexture=new THREE.CanvasTexture(mC);
gTexture.minFilter=THREE.LinearFilter;gTexture.magFilter=THREE.LinearFilter;
const gMaterial=new THREE.MeshBasicMaterial({map:gTexture});
const gGeometry=new THREE.SphereGeometry(1,64,64);
const globe=new THREE.Mesh(gGeometry,gMaterial);
gScene.add(globe);

let gRotY=0, gRotX=0.3;
const gRYsp=new Sp(0,.035,.88), gRXsp=new Sp(.3,.035,.88);
let grabbed=false, grabSX=0, grabSY=0, grabRY0=0, grabRX0=0;
let grabVelX=0, grabVelY=0, lastGrabX=0, lastGrabY=0;
let schubsForce=new Sp(0,.06,.8);

globeCanvas.addEventListener('pointerdown',e=>{
  e.preventDefault();grabbed=true;
  grabSX=e.clientX;grabSY=e.clientY;
  lastGrabX=e.clientX;lastGrabY=e.clientY;
  grabRY0=gRotY;grabRX0=gRotX;grabVelX=0;grabVelY=0;
});
window.addEventListener('pointermove',e=>{
  if(!grabbed||isTouchG)return;
  const vx=e.clientX-lastGrabX, vy=e.clientY-lastGrabY;
  grabVelX=grabVelX*.5+vx*.5;
  grabVelY=grabVelY*.5+vy*.5;
  lastGrabX=e.clientX;lastGrabY=e.clientY;
  gRotY=grabRY0+(e.clientX-grabSX)*.012;
  gRotX=grabRX0+(e.clientY-grabSY)*.012;
  const speed=Math.hypot(grabVelX,grabVelY);
  schubsForce.set(Math.min(speed/8,1));
});
window.addEventListener('pointerup',()=>{
  if(!isTouchG){
    gRYsp.v+=grabVelX*.008;
    gRXsp.v+=grabVelY*.008;
    grabbed=false;schubsForce.set(0);
  }
});

const globeSection=document.getElementById('globeSection');
let mouseAX=innerWidth/2, mouseAY=innerHeight/2;
let isTouchG=false;
let lastMouseGX=innerWidth/2, lastMouseGY=innerHeight/2;
let mouseVelGX=0, mouseVelGY=0;

// Global mouse tracking for globe (so it knows when mouse leaves section)
document.addEventListener('mousemove',e=>{
  if(isTouchG)return;
  mouseAX=e.clientX;mouseAY=e.clientY;
  mouseVelGX=mouseVelGX*.6+(e.clientX-lastMouseGX)*.4;
  mouseVelGY=mouseVelGY*.6+(e.clientY-lastMouseGY)*.4;
  lastMouseGX=e.clientX;lastMouseGY=e.clientY;
  const rect=globeSection.getBoundingClientRect();
  const inSection = e.clientY >= rect.top && e.clientY <= rect.bottom;
  if(!grabbed && inSection){
    const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    gRotY=(e.clientX-cx)*.003;
    gRotX=(e.clientY-cy)*.002;
  }
});

globeSection.addEventListener('touchstart',e=>{
  if (innerWidth > 1024) return; // ignore touch on desktop/hybrid devices
  isTouchG=true;
  const t=e.touches[0];
  const rect=globeSection.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const gSize=Math.min(320,innerWidth*.4);
  const dist=Math.hypot(t.clientX-cx,t.clientY-cy);
  if(dist<gSize*.7){
    grabbed=true;
    grabSX=t.clientX;grabSY=t.clientY;
    lastGrabX=t.clientX;lastGrabY=t.clientY;
    grabRY0=gRotY;grabRX0=gRotX;grabVelX=0;grabVelY=0;
  }
},{passive:true});
globeSection.addEventListener('touchmove',e=>{
  if(!grabbed)return;
  e.preventDefault();
  const t=e.touches[0];
  const vx=t.clientX-lastGrabX, vy=t.clientY-lastGrabY;
  grabVelX=grabVelX*.5+vx*.5;
  grabVelY=grabVelY*.5+vy*.5;
  lastGrabX=t.clientX;lastGrabY=t.clientY;
  gRotY=grabRY0+(t.clientX-grabSX)*.012;
  gRotX=grabRX0+(t.clientY-grabSY)*.012;
  const rect=globeSection.getBoundingClientRect();
  const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
  const dragDX=t.clientX-grabSX, dragDY=t.clientY-grabSY;
  const maxOff=Math.min(innerWidth,innerHeight)*0.75;
  const rawOff=Math.hypot(dragDX,dragDY)*1.4;
  const clampedOff=Math.min(rawOff,maxOff);
  const offAng=Math.atan2(dragDY,dragDX);
  mouseAX=cx-Math.cos(offAng)*clampedOff;
  mouseAY=cy-Math.sin(offAng)*clampedOff;
},{passive:false});
globeSection.addEventListener('touchend',()=>{
  grabbed=false;schubsForce.set(0);
  mouseAX=innerWidth/2;mouseAY=innerHeight/2;
},{passive:true});

const TEXTS=['Hilfsbereitschaft','Empathie','Innovation','Fortschritt','Gemeinschaft','Nachhaltigkeit','Transparenz','Vertrauen','Zukunft','Wachstum'];
const COUNT=TEXTS.length;
function getGlobeRadius(){return Math.min(160,innerWidth*.2)}

const globeWords=TEXTS.map((text,i)=>{
  const el=document.createElement('div');
  el.className='globe-word';el.textContent=text;globeSection.appendChild(el);
  const angle=(i/COUNT)*Math.PI*2;
  const initR=130; // close to home distance so no jump
  return{
    el,angle,
    spX:new Sp(Math.cos(angle)*initR,.07,.68),
    spY:new Sp(Math.sin(angle)*initR,.07,.68),
    spS:new Sp(.5,.08,.7),
    spO:new Sp(0,.08,.7),
  };
});

function animateGlobe(){
  const rect=globeSection.getBoundingClientRect();
  // Words visible over adjacent sections too (±viewport)
  const extendedVis = rect.bottom > -innerHeight && rect.top < innerHeight * 2;
  const isVisible = extendedVis;
  if (!isVisible) {
    // Hide all words when section not visible
    globeWords.forEach(w => { w.el.style.opacity = 0; });
    requestAnimationFrame(animateGlobe);
    return;
  }

  // Mouse inside section +10% margin?
  const pad = innerHeight * 0.1;
  const mouseInSection = mouseAY >= rect.top - pad && mouseAY <= rect.bottom + pad
                      && mouseAX >= rect.left - pad && mouseAX <= rect.right + pad;
  document.body.classList.toggle('globe-grab-zone', mouseInSection);

  const cxV=rect.left+rect.width/2, cyV=rect.top+rect.height/2;
  const vMin=Math.min(innerWidth,innerHeight);
  const responsiveDamp=Math.min(1,vMin/800);
  const actualGR=getGlobeRadius();
  const HOME_DIST=actualGR*0.95;
  const isTablet = isTouchG && innerWidth >= 768 && innerWidth <= 1366;
  const sigma = isTablet ? 0.4 : (isTouchG ? 0.3 : 0.45);

  gRYsp.set(gRotY);gRYsp.tick();
  gRXsp.set(gRotX);gRXsp.tick();
  // Apply rotation deltas (this frame's change) as world-axis rotations
  // so direction always matches finger motion regardless of current orientation
  if (window._lastGRY === undefined) { window._lastGRY = gRYsp.c; window._lastGRX = gRXsp.c; }
  const dY = gRYsp.c - window._lastGRY;
  const dX = gRXsp.c - window._lastGRX;
  if (dY) globe.rotateOnWorldAxis(new THREE.Vector3(0,1,0), dY);
  if (dX) globe.rotateOnWorldAxis(new THREE.Vector3(1,0,0), dX);
  window._lastGRY = gRYsp.c;
  window._lastGRX = gRXsp.c;
  gRenderer.render(gScene,gCamera);

  schubsForce.tick();
  const schubs=schubsForce.c;
  const dx=mouseAX-cxV, dy=mouseAY-cyV;
  const mDist=Math.hypot(dx,dy);
  const maxD=Math.max(innerWidth,innerHeight)*.5;
  const t=Math.min(mDist/maxD,1);
  const mAng=Math.atan2(dy,dx);
  const mDirX=mDist>1?dx/mDist:0;
  const mDirY=mDist>1?dy/mDist:0;

  // Mouse-presence fade (smooth) — 0 when far outside, 1 when inside
  // Lerp toward target over time for smooth transition (~0.5s)
  if (typeof window._globeMouseFade === 'undefined') window._globeMouseFade = 0;
  // On mobile/touch: only show words while actively grabbing the globe
  // On desktop: show when mouse is in section
  const targetPresence = isTouchG ? (grabbed ? 1 : 0) : ((mouseInSection || grabbed) ? 1 : 0);
  // Slower lerp on touch for smoother fade
  const lerpSpeed = isTouchG ? 0.04 : 0.08;
  window._globeMouseFade += (targetPresence - window._globeMouseFade) * lerpSpeed;
  const mouseFade = window._globeMouseFade;

  // On touch: when fully released and faded out, force opacity springs to 0
  // so residual values don't cause flicker when scrolling past the section
  if (isTouchG && !grabbed && mouseFade < 0.01) {
    globeWords.forEach(w => {
      w.spO.c = 0; w.spO.v = 0; w.spO.t = 0;
      w.el.style.opacity = 0;
    });
  }

  globeWords.forEach(w=>{
    const angDiff=Math.atan2(Math.sin(w.angle-mAng),Math.cos(w.angle-mAng));
    const absAng=Math.abs(angDiff);
    const gauss=Math.exp(-(absAng*absAng)/(2*sigma*sigma));
    const dragDamp=isTablet?0.35:(isTouchG?1.0:responsiveDamp);
    const tabletGate=isTablet?gauss:1;
    const peakDrag=gauss*t*vMin*0.4*dragDamp*mouseFade;
    const baseDrag=t*vMin*0.1*dragDamp*mouseFade*tabletGate;
    // Tablet chain: neighbors get a soft additional pull that stretches from main
    const chainBoost=isTablet?Math.pow(gauss,0.6)*t*vMin*0.18*dragDamp*mouseFade:0;
    const schubAng=Math.atan2(grabVelY,grabVelX);
    const schubAngDiff=Math.abs(Math.atan2(Math.sin(w.angle-schubAng),Math.cos(w.angle-schubAng)));
    const schubSigma=isTablet?0.22:0.6;
    const schubGauss=Math.exp(-(schubAngDiff*schubAngDiff)/(2*schubSigma*schubSigma));
    const uniformPush=(grabbed&&!isTouchG)?vMin*0.18*responsiveDamp*mouseFade:0;
    const directionalPush=schubs*vMin*0.15*responsiveDamp*schubGauss*mouseFade;
    const mobileSpread=(isTouchG&&!isTablet)?vMin*0.04:0;
    const homeR=isTablet?(actualGR*0.60):(HOME_DIST+mobileSpread);
    const homeX=Math.cos(w.angle)*homeR;
    const homeY=Math.sin(w.angle)*homeR;
    const totalDrag=baseDrag+peakDrag;
    let newX, newY;
    if(isTablet){
      // Tablet: words push outward along their OWN angle (radial emergence)
      const radialPush=totalDrag+chainBoost+uniformPush+directionalPush;
      newX=Math.cos(w.angle)*(homeR+radialPush);
      newY=Math.sin(w.angle)*(homeR+radialPush);
    } else {
      newX=homeX+mDirX*totalDrag+Math.cos(w.angle)*(uniformPush+directionalPush);
      newY=homeY+mDirY*totalDrag+Math.sin(w.angle)*(uniformPush+directionalPush);
    }
    // Tablet: clamp max distance from center per-word based on gauss — neighbors travel less
    if(isTablet){
      const maxR=actualGR*(0.60 + Math.pow(gauss,0.6)*0.70);
      const r=Math.hypot(newX,newY);
      if(r>maxR){ newX=newX*maxR/r; newY=newY*maxR/r; }
    }
    w.spX.set(newX);w.spX.tick();
    w.spY.set(newY);w.spY.tick();
    // Tablet: also clamp the spring-smoothed output to prevent bounce beyond maxR
    if(isTablet){
      const maxR=actualGR*(0.60 + Math.pow(gauss,0.6)*0.70);
      const r2=Math.hypot(w.spX.c,w.spY.c);
      if(r2>maxR){
        w.spX.c=w.spX.c*maxR/r2;
        w.spY.c=w.spY.c*maxR/r2;
      }
    }
    const posX=w.spX.c, posY=w.spY.c;
    const projection=posX*mDirX+posY*mDirY;
    const distFromCenter=Math.hypot(posX,posY);
    const globeRadius=actualGR+15;
    const maxProj=isTablet?actualGR*0.55:vMin*0.5;
    const normProj=Math.max(-1,Math.min(1,projection/maxProj));
    const scaleMax=isTablet?1.4:(isTouchG?(0.6+0.6):(0.15+0.85*responsiveDamp));
    let targetScale;
    if(isTablet){
      // Tablet: scale + opacity driven by travel distance from home (60%) toward max (~130%)
      const tabletHomeR=actualGR*0.60;
      const tabletRange=actualGR*0.70; // distance from 60% to 130%
      const emergence=Math.max(0,Math.min(1,(distFromCenter-tabletHomeR)/tabletRange));
      targetScale=emergence*scaleMax;
    } else if(normProj>0){
      const scaleBoost=isTouchG?1.6:1.0;
      const scaledNorm=Math.min(1,normProj*scaleBoost);
      targetScale=0.15+scaledNorm*(scaleMax-0.15);
    }
    else targetScale=0.15+normProj*0.07;
    if(grabbed&&!isTouchG) targetScale=Math.max(targetScale,0.4);
    if(isTouchG&&grabbed&&!isTablet) targetScale=Math.max(targetScale,0.6);
    if(!isTablet) targetScale+=schubs*schubGauss*(isTouchG?0.45:0.25);
    targetScale=Math.max(isTablet?0:0.06,Math.min(scaleMax,targetScale));
    w.spS.set(targetScale);w.spS.tick();
    const fadeZone=isTablet?(actualGR*0.35):50;
    let targetOp;
    if(isTablet){
      const tabletHomeR=actualGR*0.60;
      const tabletRange=actualGR*0.70;
      targetOp=Math.max(0,Math.min(1,(distFromCenter-tabletHomeR)/tabletRange));
    } else {
      targetOp=Math.max(0,Math.min(1,(distFromCenter-globeRadius)/fadeZone));
    }
    if(grabbed&&!isTouchG) targetOp=Math.max(targetOp,0.7);
    if(!isTablet) targetOp=Math.max(targetOp,schubs*schubGauss*0.6);
    // Touch: spring-based fade handled naturally
    // Apply mouse-presence multiplier to the original opacity logic
    targetOp *= mouseFade;
    w.spO.set(targetOp);w.spO.tick();
    const sc=w.spS.c;
    const op=w.spO.c;
    const z=op>0.3?55+Math.round(sc*10):30;
    let wx=cxV+w.spX.c, wy=cyV+w.spY.c;
    if(isTablet){
      // Clamp to section bounds with a margin — prevents words from bleeding into S2/S4 or beyond left/right
      const margin=20;
      wx=Math.max(rect.left+margin,Math.min(rect.right-margin,wx));
      wy=Math.max(rect.top+margin,Math.min(rect.bottom-margin,wy));
    }
    w.el.style.transform=`translate(-50%,-50%) translate(${wx}px,${wy}px) scale(${sc})`;
    w.el.style.opacity=Math.max(0,op);
    w.el.style.zIndex=z;
  });
  requestAnimationFrame(animateGlobe);
}
animateGlobe();

// Step cards: tap-active class for reliable touch hover on all devices
const allStepCards = document.querySelectorAll('.step-card');
allStepCards.forEach(card => {
  // pointerdown fires more reliably on iOS Safari than touchstart during scroll gestures
  card.addEventListener('pointerdown', () => card.classList.add('tap-active'));
  card.addEventListener('touchstart', () => card.classList.add('tap-active'), {passive: true});
});
function clearAllTapActive() {
  allStepCards.forEach(c => c.classList.remove('tap-active'));
}
document.addEventListener('touchend', clearAllTapActive, {passive: true});
document.addEventListener('touchcancel', clearAllTapActive, {passive: true});
document.addEventListener('pointerup', clearAllTapActive);
let stepTouchStartX = null, stepTouchStartY = null, stepTouchCard = null;
function trackStepTouchStart(x, y, target) {
  const card = target.closest && target.closest('.step-card');
  if (card) {
    stepTouchStartX = x;
    stepTouchStartY = y;
    stepTouchCard = card;
  } else {
    stepTouchStartX = stepTouchStartY = null;
    stepTouchCard = null;
  }
}
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (t) trackStepTouchStart(t.clientX, t.clientY, e.target);
}, {passive: true});
document.addEventListener('pointerdown', (e) => {
  trackStepTouchStart(e.clientX, e.clientY, e.target);
});
document.addEventListener('touchmove', (e) => {
  if (!stepTouchCard) return;
  const t = e.touches[0];
  if (!t) return;
  const r = stepTouchCard.getBoundingClientRect();
  const stillOverCard = t.clientX >= r.left && t.clientX <= r.right
                     && t.clientY >= r.top && t.clientY <= r.bottom;
  const movedY = Math.abs(t.clientY - stepTouchStartY);
  if (!stillOverCard && movedY > 20) {
    clearAllTapActive();
    stepTouchCard = null;
  }
}, {passive: true});

// ============================================
// COOKIE BANNER + LEGAL MODALS
// ============================================
const cookieBanner = document.getElementById('cookieBanner');
const legalModal = document.getElementById('legalModal');

function getConsent() {
  try { return localStorage.getItem('thl-cookie-consent'); } catch(e) { return null; }
}
function setConsent(v) {
  try { localStorage.setItem('thl-cookie-consent', v); } catch(e) {}
}

function showBanner() {
  setTimeout(() => cookieBanner.classList.add('visible'), 400);
}
function hideBanner() {
  cookieBanner.classList.remove('visible');
}
function acceptCookies() {
  setConsent('accepted');
  hideBanner();
}
function declineCookies() {
  setConsent('declined');
  hideBanner();
}
function resetCookies() {
  try { localStorage.removeItem('thl-cookie-consent'); } catch(e) {}
  showBanner();
}

function openLegal(which) {
  document.getElementById('legalImpressum').style.display = which === 'impressum' ? 'block' : 'none';
  document.getElementById('legalDatenschutz').style.display = which === 'datenschutz' ? 'block' : 'none';
  legalModal.classList.add('visible');
  legalModal.querySelector('.legal-modal-inner').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function closeLegal() {
  legalModal.classList.remove('visible');
  document.body.style.overflow = '';
}

// ESC closes modal
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && legalModal.classList.contains('visible')) closeLegal();
});



// ============================================
// BIOLUMINESCENCE TOUCH EFFECT (touch devices)
// Triggers only after 1s of holding (no movement) — doesn't disturb scrolling.
// Effect grows from touch position to fullscreen color-inversion over ~4s.
// ============================================
if (isTouchDev) {
  const bioLumi = document.getElementById('bioLumi');
  const heroEl = document.getElementById('hero');
  const globeCv = document.getElementById('globeCanvas');
  let bioActive = false;
  let bioStartT = 0;
  let bioRAF = null;
  let bioStartTimer = null;
  let bioTouchStartX = 0, bioTouchStartY = 0;
  const HOLD_DELAY_MS = 1000;       // 1 second hold required
  const MOVE_CANCEL_PX = 14;        // if finger moves more than this before delay → it's a scroll, abort
  let maskDirty = true;

  function updateBioMask() {
    if (!globeCv) { bioLumi.style.removeProperty('--bio-mask'); return; }
    const r = globeCv.getBoundingClientRect();
    if (r.width <= 0 || r.bottom < 0 || r.top > innerHeight) {
      bioLumi.style.removeProperty('--bio-mask');
      return;
    }
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.min(r.width, r.height) / 2;
    const inner = radius + 4;
    const outer = radius + 20;
    const mask = `radial-gradient(circle at ${cx}px ${cy}px, transparent 0, transparent ${inner}px, #000 ${outer}px)`;
    bioLumi.style.setProperty('--bio-mask', mask);
  }
  window.addEventListener('scroll', () => { maskDirty = true; }, { passive: true });
  window.addEventListener('resize', () => { maskDirty = true; });

  function bioTick() {
    if (!bioActive) return;
    const elapsed = performance.now() - bioStartT;
    const maxR = Math.hypot(innerWidth, innerHeight);
    const r = Math.min(60 + (elapsed / 4000) * maxR, maxR);
    bioLumi.style.setProperty('--bio-r', r + 'px');
    if (maskDirty) { updateBioMask(); maskDirty = false; }
    bioRAF = requestAnimationFrame(bioTick);
  }

  function startBio(x, y) {
    bioLumi.style.setProperty('--bio-x', x + 'px');
    bioLumi.style.setProperty('--bio-y', y + 'px');
    bioLumi.style.setProperty('--bio-r', '60px');
    maskDirty = true;
    updateBioMask();
    bioLumi.classList.add('active');
    bioActive = true;
    bioStartT = performance.now();
    bioRAF = requestAnimationFrame(bioTick);
  }

  function clearBioStartTimer() {
    if (bioStartTimer) { clearTimeout(bioStartTimer); bioStartTimer = null; }
  }

  function endBio() {
    clearBioStartTimer();
    bioActive = false;
    if (bioRAF) { cancelAnimationFrame(bioRAF); bioRAF = null; }
    bioLumi.classList.remove('active');
  }

  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    if (heroEl && heroEl.contains(e.target)) return;
    if (drawModeActive) return;
    if (grabbed) return;
    if (e.target.closest('input, textarea, .legal-modal, .cookie-banner')) return;
    bioTouchStartX = t.clientX; bioTouchStartY = t.clientY;
    clearBioStartTimer();
    bioStartTimer = setTimeout(() => {
      bioStartTimer = null;
      if (drawModeActive || grabbed) return;
      startBio(bioTouchStartX, bioTouchStartY);
    }, HOLD_DELAY_MS);
  }, { passive: true });

  document.addEventListener('touchend', endBio, { passive: true });
  document.addEventListener('touchcancel', endBio, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!t) return;
    // Cancel if user moved during hold-delay (= scroll)
    if (bioStartTimer) {
      const dx = t.clientX - bioTouchStartX;
      const dy = t.clientY - bioTouchStartY;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        clearBioStartTimer();
      }
      return;
    }
    if (!bioActive) return;
    bioLumi.style.setProperty('--bio-x', t.clientX + 'px');
    bioLumi.style.setProperty('--bio-y', t.clientY + 'px');
  }, { passive: true });
}


// Show banner on first visit
if (!getConsent()) showBanner();
