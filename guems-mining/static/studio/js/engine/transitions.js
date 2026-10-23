// Transitions d'entrée et de sortie des clips visuels.
// Une transition renvoie des modificateurs appliqués au calque pendant sa durée :
//   { alpha, dx, dy, scale, rotation, blur, clip: (ctx, W, H) => void, overlay: { color, alpha } }
// p ∈ [0,1] : 0 = invisible (début d'entrée / fin de sortie), 1 = pleinement visible.
// Pour un fondu enchaîné, placer le clip entrant sur une piste au-dessus, en chevauchement.

import { getEasing } from './easing.js';
import { rng } from '../util.js';

const ease = getEasing('easeInOut');

export const TRANSITIONS = {
  fade: { label: 'Fondu', fn: (p) => ({ alpha: p }) },
  'fade-black': { label: 'Fondu au noir', fn: (p) => ({ overlay: { color: '#000000', alpha: 1 - p } }) },
  'fade-white': { label: 'Fondu au blanc', fn: (p) => ({ overlay: { color: '#FFFFFF', alpha: 1 - p } }) },
  'slide-left': { label: 'Glissement vers la gauche', fn: (p, W) => ({ dx: (1 - ease(p)) * W }) },
  'slide-right': { label: 'Glissement vers la droite', fn: (p, W) => ({ dx: -(1 - ease(p)) * W }) },
  'slide-up': { label: 'Glissement vers le haut', fn: (p, W, H) => ({ dy: (1 - ease(p)) * H }) },
  'slide-down': { label: 'Glissement vers le bas', fn: (p, W, H) => ({ dy: -(1 - ease(p)) * H }) },
  'wipe-left': { label: 'Volet vers la gauche', fn: (p) => ({ clip: (ctx, W, H) => { ctx.rect(W * (1 - ease(p)), 0, W, H); } }) },
  'wipe-right': { label: 'Volet vers la droite', fn: (p) => ({ clip: (ctx, W, H) => { ctx.rect(0, 0, W * ease(p), H); } }) },
  'wipe-up': { label: 'Volet vers le haut', fn: (p) => ({ clip: (ctx, W, H) => { ctx.rect(0, H * (1 - ease(p)), W, H); } }) },
  'wipe-diagonal': {
    label: 'Volet diagonal',
    fn: (p) => ({ clip: (ctx, W, H) => { const e = ease(p) * (W + H); ctx.moveTo(0, 0); ctx.lineTo(e, 0); ctx.lineTo(e - H, H); ctx.lineTo(0, H); ctx.closePath(); } }),
  },
  circle: { label: 'Iris (cercle)', fn: (p) => ({ clip: (ctx, W, H) => { ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * ease(p), 0, Math.PI * 2); } }) },
  'zoom-in': { label: 'Zoom avant', fn: (p) => ({ scale: 0.6 + 0.4 * ease(p), alpha: p }) },
  'zoom-out': { label: 'Zoom arrière', fn: (p) => ({ scale: 1.6 - 0.6 * ease(p), alpha: p }) },
  'blur-dissolve': { label: 'Fondu flouté', fn: (p) => ({ alpha: p, blur: (1 - p) * 30 }) },
  spin: { label: 'Rotation', fn: (p) => ({ rotation: (1 - ease(p)) * -180, scale: ease(p), alpha: p }) },
  'whip-pan': { label: 'Panoramique filé', fn: (p, W) => ({ dx: (1 - ease(p)) * W * 1.2, blur: (1 - p) * 40 * (p > 0.05 ? 1 : 0), alpha: Math.min(1, p * 4) }) },
  glitch: {
    label: 'Glitch',
    fn: (p, W, H, seed) => {
      const r = rng(seed + Math.floor(p * 18));
      return p >= 1 ? {} : { alpha: r() > 0.3 ? Math.min(1, p * 1.5) : 0.15, dx: (r() - 0.5) * W * 0.08 * (1 - p), overlay: r() > 0.7 ? { color: '#FFFFFF', alpha: 0.15 * (1 - p) } : null };
    },
  },
  flash: { label: 'Flash blanc', fn: (p) => ({ overlay: { color: '#FFFFFF', alpha: Math.max(0, 1 - p * 1.4) } }) },
};

// Modificateurs combinés (entrée + sortie) pour un clip au temps local t.
export function transitionState(clip, t, W, H, seed) {
  const mods = [];
  const tin = clip.transitionIn;
  const tout = clip.transitionOut;
  if (tin && TRANSITIONS[tin.type] && t < tin.duration) mods.push(TRANSITIONS[tin.type].fn(Math.max(0, t / tin.duration), W, H, seed));
  if (tout && TRANSITIONS[tout.type] && t > clip.duration - tout.duration) {
    const p = Math.max(0, (clip.duration - t) / tout.duration);
    const m = TRANSITIONS[tout.type].fn(p, W, H, seed + 7);
    // En sortie, les déplacements partent dans la direction opposée.
    if (m.dx) m.dx = -m.dx;
    if (m.dy) m.dy = -m.dy;
    mods.push(m);
  }
  if (!mods.length) return null;
  return mods.reduce((acc, m) => ({
    alpha: (acc.alpha ?? 1) * (m.alpha ?? 1),
    dx: (acc.dx || 0) + (m.dx || 0),
    dy: (acc.dy || 0) + (m.dy || 0),
    scale: (acc.scale ?? 1) * (m.scale ?? 1),
    rotation: (acc.rotation || 0) + (m.rotation || 0),
    blur: (acc.blur || 0) + (m.blur || 0),
    clip: m.clip || acc.clip,
    overlay: m.overlay || acc.overlay,
  }), {});
}
