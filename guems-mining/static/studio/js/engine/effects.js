// Effets visuels.
//  - LAYER_EFFECTS : appliqués à un calque (clip) avant sa composition.
//  - FRAME_EFFECTS : clips « fx » appliqués à tout ce qui est sous leur piste.
// Tous les effets sont déterministes (fonction du temps) : l'aperçu et l'export sont identiques.
// Pour ajouter un effet : déclarer ses paramètres et une fonction apply().

import { rng, hash, rgba, clamp } from '../util.js';

const range = (key, label, min, max, step, def) => ({ key, label, type: 'range', min, max, step, default: def });
const color = (key, label, def) => ({ key, label, type: 'color', default: def });
const select = (key, label, options, def) => ({ key, label, type: 'select', options, default: def });

export function defaultParams(def) {
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

// --------------------------------------------------------------------------- calque
// apply(ctx, src, p, info) : dessine `src` (canvas du calque) transformé dans ctx (canvas vide de même taille).
export const LAYER_EFFECTS = {
  blur: {
    label: 'Flou', params: [range('amount', 'Intensité (px)', 0, 60, 0.5, 8)],
    apply(ctx, src, p, info) { ctx.filter = `blur(${p.amount * info.scale}px)`; ctx.drawImage(src, 0, 0); ctx.filter = 'none'; },
  },
  glow: {
    label: 'Lueur', params: [range('radius', 'Rayon (px)', 1, 80, 1, 24), range('strength', 'Intensité', 0, 3, 0.05, 1), color('color', 'Teinte', '#FFB15C'), range('tint', 'Teinte (mélange)', 0, 1, 0.05, 0)],
    apply(ctx, src, p, info) {
      ctx.drawImage(src, 0, 0);
      const g = info.scratch(src.width, src.height);
      g.ctx.filter = `blur(${p.radius * info.scale}px)`;
      g.ctx.drawImage(src, 0, 0);
      g.ctx.filter = 'none';
      if (p.tint > 0) { g.ctx.globalCompositeOperation = 'source-atop'; g.ctx.globalAlpha = p.tint; g.ctx.fillStyle = p.color; g.ctx.fillRect(0, 0, src.width, src.height); g.ctx.globalAlpha = 1; g.ctx.globalCompositeOperation = 'source-over'; }
      ctx.globalCompositeOperation = 'lighter';
      let s = p.strength;
      while (s > 0) { ctx.globalAlpha = Math.min(1, s); ctx.drawImage(g.canvas, 0, 0); s -= 1; }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  },
  shadow: {
    label: 'Ombre portée', params: [range('blur', 'Flou', 0, 80, 1, 30), range('x', 'Décalage X', -100, 100, 1, 0), range('y', 'Décalage Y', -100, 100, 1, 18), color('color', 'Couleur', '#000000'), range('opacity', 'Opacité', 0, 1, 0.05, 0.6)],
    apply(ctx, src, p, info) {
      ctx.shadowColor = rgba(p.color, p.opacity); ctx.shadowBlur = p.blur * info.scale; ctx.shadowOffsetX = p.x * info.scale; ctx.shadowOffsetY = p.y * info.scale;
      ctx.drawImage(src, 0, 0);
      ctx.shadowColor = 'transparent';
    },
  },
  color: {
    label: 'Correction colorimétrique', params: [range('brightness', 'Luminosité', 0, 2, 0.01, 1), range('contrast', 'Contraste', 0, 2, 0.01, 1), range('saturate', 'Saturation', 0, 3, 0.01, 1), range('hue', 'Teinte (°)', -180, 180, 1, 0), range('sepia', 'Sépia', 0, 1, 0.01, 0), range('grayscale', 'Noir et blanc', 0, 1, 0.01, 0), range('invert', 'Inversion', 0, 1, 0.01, 0)],
    apply(ctx, src, p) {
      ctx.filter = `brightness(${p.brightness}) contrast(${p.contrast}) saturate(${p.saturate}) hue-rotate(${p.hue}deg) sepia(${p.sepia}) grayscale(${p.grayscale}) invert(${p.invert})`;
      ctx.drawImage(src, 0, 0); ctx.filter = 'none';
    },
  },
  chromatic: {
    label: 'Aberration chromatique', params: [range('offset', 'Décalage (px)', 0, 40, 0.5, 6), range('angle', 'Angle (°)', 0, 360, 1, 0)],
    apply(ctx, src, p, info) {
      const d = p.offset * info.scale; const a = (p.angle * Math.PI) / 180;
      const dx = Math.cos(a) * d; const dy = Math.sin(a) * d;
      const channel = (col, ox, oy) => {
        const g = info.scratch(src.width, src.height);
        g.ctx.drawImage(src, 0, 0);
        g.ctx.globalCompositeOperation = 'multiply'; g.ctx.fillStyle = col; g.ctx.fillRect(0, 0, src.width, src.height);
        g.ctx.globalCompositeOperation = 'destination-in'; g.ctx.drawImage(src, 0, 0);
        g.ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(g.canvas, ox, oy);
      };
      ctx.globalCompositeOperation = 'lighter';
      channel('#FF0000', -dx, -dy); channel('#00FF00', 0, 0); channel('#0000FF', dx, dy);
      ctx.globalCompositeOperation = 'source-over';
    },
  },
  glitch: {
    label: 'Glitch numérique', params: [range('intensity', 'Intensité', 0, 1, 0.01, 0.5), range('slices', 'Tranches', 2, 40, 1, 12), range('speed', 'Vitesse', 1, 30, 1, 12), range('rgb', 'Séparation RVB (px)', 0, 30, 1, 6)],
    apply(ctx, src, p, info) {
      const r = rng(hash(info.clipId) + Math.floor(info.time * p.speed));
      const active = r() < 0.35 + p.intensity * 0.6;
      if (!active) { ctx.drawImage(src, 0, 0); return; }
      const h = src.height / p.slices;
      for (let i = 0; i < p.slices; i++) {
        const off = r() < p.intensity ? (r() - 0.5) * src.width * 0.12 * p.intensity : 0;
        ctx.drawImage(src, 0, i * h, src.width, h, off, i * h, src.width, h);
      }
      if (p.rgb > 0) {
        ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35;
        ctx.drawImage(src, p.rgb * info.scale * (r() - 0.5) * 2, 0);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
    },
  },
  wave: {
    label: 'Distorsion (ondulation)', params: [range('amplitude', 'Amplitude (px)', 0, 80, 1, 14), range('frequency', 'Fréquence', 0.5, 20, 0.5, 4), range('speed', 'Vitesse', 0, 10, 0.1, 2), select('axis', 'Axe', { x: 'Horizontal', y: 'Vertical' }, 'x')],
    apply(ctx, src, p, info) {
      const step = Math.max(2, Math.round(4 * info.scale));
      const amp = p.amplitude * info.scale;
      if (p.axis === 'y') {
        for (let x = 0; x < src.width; x += step) {
          const off = Math.sin((x / src.width) * p.frequency * Math.PI * 2 + info.time * p.speed * 2) * amp;
          ctx.drawImage(src, x, 0, step, src.height, x, off, step, src.height);
        }
      } else {
        for (let y = 0; y < src.height; y += step) {
          const off = Math.sin((y / src.height) * p.frequency * Math.PI * 2 + info.time * p.speed * 2) * amp;
          ctx.drawImage(src, 0, y, src.width, step, off, y, src.width, step);
        }
      }
    },
  },
  pixelate: {
    label: 'Pixellisation', params: [range('size', 'Taille des pixels', 2, 80, 1, 16)],
    apply(ctx, src, p, info) {
      const s = Math.max(1, p.size * info.scale);
      const w = Math.max(1, Math.round(src.width / s)); const h = Math.max(1, Math.round(src.height / s));
      const g = info.scratch(w, h);
      g.ctx.drawImage(src, 0, 0, w, h);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(g.canvas, 0, 0, w, h, 0, 0, src.width, src.height); ctx.imageSmoothingEnabled = true;
    },
  },
  outline: {
    label: 'Contour lumineux', params: [range('width', 'Épaisseur (px)', 1, 30, 1, 6), color('color', 'Couleur', '#F96A00')],
    apply(ctx, src, p, info) {
      const w = p.width * info.scale;
      const g = info.scratch(src.width, src.height);
      for (let a = 0; a < 16; a++) {
        const an = (a / 16) * Math.PI * 2;
        g.ctx.drawImage(src, Math.cos(an) * w, Math.sin(an) * w);
      }
      g.ctx.globalCompositeOperation = 'source-in'; g.ctx.fillStyle = p.color; g.ctx.fillRect(0, 0, src.width, src.height); g.ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(g.canvas, 0, 0); ctx.drawImage(src, 0, 0);
    },
  },
};

// --------------------------------------------------------------------------- image entière
// apply(ctx, p, info) : modifie le canvas principal (tout ce qui est déjà dessiné).
export const FRAME_EFFECTS = {
  camera: {
    label: 'Caméra (panoramique, zoom, profondeur de champ)', camera: true, params: [],
    apply() { /* géré par le moteur de rendu : transforme les calques situés sous la piste */ },
  },
  vignette: {
    label: 'Vignettage', params: [range('amount', 'Intensité', 0, 1, 0.01, 0.55), range('size', 'Taille', 0.1, 1.5, 0.01, 0.75), color('color', 'Couleur', '#000000')],
    apply(ctx, p, info) {
      const { W, H } = info;
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * p.size * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
      g.addColorStop(0, rgba(p.color, 0)); g.addColorStop(1, rgba(p.color, p.amount));
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    },
  },
  particles: {
    label: 'Particules', params: [
      select('style', 'Style', { sparks: 'Étincelles', dust: 'Poussière', bokeh: 'Bokeh', snow: 'Neige', embers: 'Braises' }, 'sparks'),
      range('count', 'Nombre', 5, 400, 1, 90), range('size', 'Taille', 0.2, 6, 0.1, 1.5), range('speed', 'Vitesse', 0, 4, 0.05, 1),
      color('color', 'Couleur', '#FFB15C'), range('opacity', 'Opacité', 0, 1, 0.01, 0.85)],
    apply(ctx, p, info) {
      const { W, H } = info;
      const r = rng(hash(info.clipId));
      const t = info.time;
      ctx.save();
      ctx.globalCompositeOperation = p.style === 'dust' || p.style === 'snow' ? 'source-over' : 'lighter';
      for (let i = 0; i < p.count; i++) {
        const x0 = r(); const y0 = r(); const s0 = 0.3 + r(); const ph = r() * Math.PI * 2; const v = 0.3 + r();
        let x; let y; let size; let alpha;
        const life = ((t * p.speed * 0.12 * v + y0) % 1 + 1) % 1;
        switch (p.style) {
          case 'snow': x = x0 * W + Math.sin(t * v + ph) * 30 * info.scale; y = life * (H + 40) - 20; size = 2 + s0 * 3; alpha = 0.9; break;
          case 'bokeh': x = (x0 * W + Math.sin(t * 0.2 * v + ph) * 60 * info.scale); y = y0 * H + Math.cos(t * 0.15 * v + ph) * 40 * info.scale; size = 18 + s0 * 40; alpha = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * v + ph)); break;
          case 'dust': x = (x0 * W + t * 12 * v * p.speed * info.scale) % W; y = y0 * H + Math.sin(t * v + ph) * 20 * info.scale; size = 1 + s0 * 1.5; alpha = 0.35 + 0.35 * Math.sin(t * 2 * v + ph); break;
          case 'embers': x = x0 * W + Math.sin(t * v * 2 + ph) * 40 * info.scale; y = H - life * (H + 40); size = 1.5 + s0 * 2.5; alpha = (1 - life) * 0.9; break;
          default: x = x0 * W + Math.sin(life * 6 + ph) * 25 * info.scale; y = H - life * H * 1.1; size = 1 + s0 * 2; alpha = Math.sin(life * Math.PI);
        }
        size *= p.size * info.scale;
        ctx.globalAlpha = clamp(alpha * p.opacity, 0, 1);
        if (p.style === 'bokeh') {
          const g = ctx.createRadialGradient(x, y, 0, x, y, size);
          g.addColorStop(0, rgba(p.color, 0.9)); g.addColorStop(1, rgba(p.color, 0));
          ctx.fillStyle = g;
        } else ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, size), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
  },
  grain: {
    label: 'Grain de film', params: [range('amount', 'Intensité', 0, 1, 0.01, 0.18), range('size', 'Taille', 1, 4, 1, 1)],
    apply(ctx, p, info) {
      const { W, H } = info;
      const tile = info.noiseTile(Math.floor(info.time * 24) % 8, p.size);
      ctx.save(); ctx.globalAlpha = p.amount; ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = ctx.createPattern(tile, 'repeat'); ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
  },
  'light-leak': {
    label: 'Fuite de lumière', params: [color('color', 'Couleur', '#FF7A1A'), color('color2', 'Couleur 2', '#FFD27A'), range('intensity', 'Intensité', 0, 1, 0.01, 0.45), range('speed', 'Vitesse', 0, 3, 0.05, 0.6)],
    apply(ctx, p, info) {
      const { W, H, time } = info;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const blobs = [[p.color, 0.15, 0.3, 0.9], [p.color2, 0.85, 0.7, 0.7]];
      blobs.forEach(([c, bx, by, rr], i) => {
        const x = W * (bx + Math.sin(time * p.speed + i * 2) * 0.15); const y = H * (by + Math.cos(time * p.speed * 0.8 + i) * 0.15);
        const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * rr * 0.6);
        g.addColorStop(0, rgba(c, p.intensity)); g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      });
      ctx.restore();
    },
  },
  letterbox: {
    label: 'Bandes cinéma', params: [range('ratio', 'Format', 1.5, 2.8, 0.01, 2.39), color('color', 'Couleur', '#000000')],
    apply(ctx, p, info) {
      const { W, H } = info;
      const h = Math.max(0, (H - W / p.ratio) / 2);
      ctx.fillStyle = p.color; ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
    },
  },
  'color-grade': {
    label: 'Étalonnage (tout le plan)', params: [range('brightness', 'Luminosité', 0, 2, 0.01, 1), range('contrast', 'Contraste', 0, 2, 0.01, 1.1), range('saturate', 'Saturation', 0, 3, 0.01, 1.15), range('hue', 'Teinte (°)', -180, 180, 1, 0), color('tint', 'Teinte de couleur', '#FF8A3D'), range('tintAmount', 'Force de la teinte', 0, 1, 0.01, 0.08)],
    apply(ctx, p, info) {
      const g = info.scratch(info.W, info.H);
      g.ctx.drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, info.W, info.H);
      ctx.filter = `brightness(${p.brightness}) contrast(${p.contrast}) saturate(${p.saturate}) hue-rotate(${p.hue}deg)`;
      ctx.drawImage(g.canvas, 0, 0); ctx.filter = 'none';
      if (p.tintAmount > 0) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = p.tintAmount; ctx.fillStyle = p.tint; ctx.fillRect(0, 0, info.W, info.H); ctx.restore(); }
    },
  },
  'glitch-frame': {
    label: 'Glitch (tout le plan)', params: [range('intensity', 'Intensité', 0, 1, 0.01, 0.4), range('speed', 'Vitesse', 1, 30, 1, 10)],
    apply(ctx, p, info) {
      const r = rng(hash(info.clipId) + Math.floor(info.time * p.speed));
      if (r() > 0.25 + p.intensity * 0.6) return;
      const g = info.scratch(info.W, info.H);
      g.ctx.drawImage(ctx.canvas, 0, 0);
      const n = 6 + Math.floor(r() * 10);
      for (let i = 0; i < n; i++) {
        const y = r() * info.H; const h = r() * info.H * 0.08 * p.intensity + 2;
        ctx.drawImage(g.canvas, 0, y, info.W, h, (r() - 0.5) * info.W * 0.1 * p.intensity, y, info.W, h);
      }
    },
  },
  flash: {
    label: 'Flash lumineux', params: [color('color', 'Couleur', '#FFFFFF'), range('peak', 'Intensité max.', 0, 1, 0.01, 0.9)],
    apply(ctx, p, info) {
      const x = info.local / Math.max(0.001, info.duration);
      const a = Math.sin(Math.PI * clamp(x, 0, 1)) * p.peak;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(0, 0, info.W, info.H); ctx.restore();
    },
  },
};

export function newEffect(type) {
  const def = LAYER_EFFECTS[type];
  if (!def) throw new Error(`Effet inconnu : ${type}`);
  return { type, enabled: true, params: defaultParams(def) };
}
