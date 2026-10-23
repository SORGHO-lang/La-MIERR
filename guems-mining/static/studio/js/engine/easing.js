// Courbes d'accélération (easing) et interpolation des images clés.

import { hexToRgb, rgbToHex } from '../util.js';

const c1 = 1.70158;
const c3 = c1 + 1;
const c4 = (2 * Math.PI) / 3;

function bounceOut(x) {
  const n1 = 7.5625; const d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

export const EASINGS = {
  linear: { label: 'Linéaire', fn: (x) => x },
  easeIn: { label: 'Accélération', fn: (x) => x * x * x },
  easeOut: { label: 'Décélération', fn: (x) => 1 - (1 - x) ** 3 },
  easeInOut: { label: 'Douce (entrée et sortie)', fn: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2) },
  easeOutQuart: { label: 'Décélération forte', fn: (x) => 1 - (1 - x) ** 4 },
  easeInOutSine: { label: 'Sinusoïdale', fn: (x) => -(Math.cos(Math.PI * x) - 1) / 2 },
  easeOutExpo: { label: 'Exponentielle', fn: (x) => (x === 1 ? 1 : 1 - 2 ** (-10 * x)) },
  easeOutBack: { label: 'Rebond léger (dépassement)', fn: (x) => 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2 },
  easeInBack: { label: 'Recul puis départ', fn: (x) => c3 * x * x * x - c1 * x * x },
  easeOutElastic: { label: 'Élastique', fn: (x) => (x === 0 ? 0 : x === 1 ? 1 : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1) },
  easeOutBounce: { label: 'Rebonds', fn: bounceOut },
  hold: { label: 'Maintien (sans interpolation)', fn: (x) => (x < 1 ? 0 : 1) },
};

// Courbe de Bézier cubique personnalisée « cubic-bezier(x1,y1,x2,y2) ».
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1; const bx = 3 * (x2 - x1) - cx; const ax = 1 - cx - bx;
  const cy = 3 * y1; const by = 3 * (y2 - y1) - cy; const ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    t = Math.min(1, Math.max(0, t));
    return sy(t);
  };
}

const bezierCache = new Map();
export function getEasing(name = 'linear') {
  if (EASINGS[name]) return EASINGS[name].fn;
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(name);
  if (m) {
    if (!bezierCache.has(name)) {
      const [a, b, c, d] = m[1].split(',').map(Number);
      bezierCache.set(name, [a, b, c, d].every(Number.isFinite) ? cubicBezier(a, b, c, d) : EASINGS.linear.fn);
    }
    return bezierCache.get(name);
  }
  return EASINGS.linear.fn;
}

const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

export function interpolate(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (isColor(a) && isColor(b)) {
    const A = hexToRgb(a); const B = hexToRgb(b);
    return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
  }
  return t < 1 ? a : b;
}

// Valeur d'une propriété à l'instant local t (secondes depuis le début du clip).
export function valueAt(clip, prop, t, base) {
  const kfs = clip.keyframes?.[prop];
  if (!kfs || kfs.length === 0) return base;
  if (t <= kfs[0].t) return kfs[0].v;
  const last = kfs[kfs.length - 1];
  if (t >= last.t) return last.v;
  for (let i = 0; i < kfs.length - 1; i++) {
    const k0 = kfs[i]; const k1 = kfs[i + 1];
    if (t >= k0.t && t <= k1.t) {
      const span = k1.t - k0.t || 1;
      return interpolate(k0.v, k1.v, getEasing(k0.ease)((t - k0.t) / span));
    }
  }
  return base;
}

const EPS = 1 / 240;
export function keyframeAt(clip, prop, t) {
  return clip.keyframes?.[prop]?.find((k) => Math.abs(k.t - t) < EPS) || null;
}

export function setKeyframe(clip, prop, t, v, ease = 'easeInOut') {
  clip.keyframes = clip.keyframes || {};
  const list = clip.keyframes[prop] || (clip.keyframes[prop] = []);
  const existing = list.find((k) => Math.abs(k.t - t) < EPS);
  if (existing) { existing.v = v; } else { list.push({ t, v, ease }); list.sort((a, b) => a.t - b.t); }
}

export function removeKeyframe(clip, prop, t) {
  const list = clip.keyframes?.[prop];
  if (!list) return;
  clip.keyframes[prop] = list.filter((k) => Math.abs(k.t - t) >= EPS);
  if (!clip.keyframes[prop].length) delete clip.keyframes[prop];
}

// Décale/étire les images clés quand le clip est raccourci par le début.
export function shiftKeyframes(clip, delta) {
  for (const prop of Object.keys(clip.keyframes || {})) {
    clip.keyframes[prop] = clip.keyframes[prop].map((k) => ({ ...k, t: k.t - delta })).filter((k) => k.t >= -EPS);
    if (!clip.keyframes[prop].length) delete clip.keyframes[prop];
  }
}
