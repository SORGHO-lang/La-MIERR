// Moteur de rendu : compose une image du projet au temps t sur un canvas.
// Identique pour l'aperçu et l'exportation ; seule la source des images vidéo change
// (élément <video> en aperçu, décodage image par image avec Mediabunny à l'export).

import { valueAt } from './easing.js';
import { drawText, roundRect, ensureFont, fontString } from './text.js';
import { LAYER_EFFECTS, FRAME_EFFECTS } from './effects.js';
import { transitionState } from './transitions.js';
import { ANIMATABLE, CAMERA_PROPS, BLEND_MODES, isVisual, clipEnd } from '../model.js';
import { hash, rng, clamp } from '../util.js';
import { getEasing } from './easing.js';

const DEG = Math.PI / 180;

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

export class Renderer {
  constructor() {
    this.pool = new Map(); // canvases réutilisables par taille
    this.noise = new Map();
    this.fontWaiters = new Set();
    this.onFontLoaded = null;
  }

  canvas(key, w, h) {
    const k = `${key}|${w}x${h}`;
    let c = this.pool.get(k);
    if (!c) { c = makeCanvas(w, h); this.pool.set(k, c); }
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.clearRect(0, 0, w, h);
    return { canvas: c, ctx };
  }

  noiseTile(seed, size) {
    const k = `${seed}|${size}`;
    if (!this.noise.has(k)) {
      const n = 128; const c = makeCanvas(n * size, n * size); const ctx = c.getContext('2d');
      const r = rng(seed * 977 + 13);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const v = Math.floor(r() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`; ctx.fillRect(x * size, y * size, size, size);
      }
      this.noise.set(k, c);
    }
    return this.noise.get(k);
  }

  // Valeurs animées d'un clip à l'instant local.
  props(clip, local) {
    const out = {};
    for (const k of Object.keys(ANIMATABLE)) out[k] = valueAt(clip, k, local, clip.transform?.[k] ?? ANIMATABLE[k].def);
    out.depth = clip.transform?.depth || 0;
    out.blend = clip.transform?.blend || 'normal';
    return out;
  }

  cameraValues(clip, local) {
    const out = {};
    for (const k of Object.keys(CAMERA_PROPS)) out[k] = valueAt(clip, k, local, clip.camera?.[k] ?? CAMERA_PROPS[k].def);
    return out;
  }

  // Polices nécessaires au rendu du projet (à attendre avant l'export).
  async loadFonts(project) {
    const list = [];
    for (const tr of project.tracks) for (const c of tr.clips) if (c.type === 'text') list.push(ensureFont(c.text.font, c.text.weight, c.text.italic));
    await Promise.all(list);
  }

  /**
   * @param {HTMLCanvasElement|OffscreenCanvas} target
   * @param {object} project
   * @param {number} t temps en secondes
   * @param {{ frames: { get(clip, sourceTime): Promise<{image,width,height}|null>|{image,width,height}|null }, media: Map }} env
   */
  async render(target, project, t, env) {
    const W = target.width; const H = target.height;
    const s = W / project.width;
    const main = target.getContext('2d');
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.globalAlpha = 1; main.globalCompositeOperation = 'source-over'; main.filter = 'none';
    main.fillStyle = project.background || '#000000';
    main.fillRect(0, 0, W, H);

    const tracks = project.tracks;
    // Caméras actives (une par piste fx) : elles agissent sur les pistes situées en dessous.
    const cameras = [];
    tracks.forEach((tr, i) => {
      if (tr.hidden || tr.kind !== 'fx') return;
      for (const c of tr.clips) {
        if (c.fx?.type === 'camera' && t >= c.start && t < clipEnd(c)) cameras.push({ index: i, values: this.cameraValues(c, t - c.start), clip: c });
      }
    });

    for (let i = tracks.length - 1; i >= 0; i--) {
      const tr = tracks[i];
      if (tr.hidden || tr.kind === 'audio') continue;
      const active = tr.clips.filter((c) => t >= c.start && t < clipEnd(c)).sort((a, b) => a.start - b.start);
      for (const clip of active) {
        const local = t - clip.start;
        if (clip.type === 'fx') {
          const def = FRAME_EFFECTS[clip.fx?.type];
          if (!def || def.camera) continue;
          main.save();
          def.apply(main, { ...defaults(def), ...(clip.fx.params || {}) }, {
            W, H, scale: s, time: t, local, duration: clip.duration, clipId: clip.id,
            scratch: (w, h) => this.canvas('frame-scratch', w, h), noiseTile: (seed, size) => this.noiseTile(seed, size),
          });
          main.restore();
        } else if (isVisual(clip)) {
          const cam = cameras.find((c) => c.index < i);
          await this.drawLayer(main, project, clip, local, t, s, env, cam?.values);
        }
      }
    }
  }

  async drawLayer(main, project, clip, local, t, s, env, cam) {
    const W = main.canvas.width; const H = main.canvas.height;
    const p = this.props(clip, local);
    const tr = transitionState(clip, local, W, H, hash(clip.id));
    const alpha = clamp(p.opacity * (tr?.alpha ?? 1), 0, 1);
    if (alpha <= 0.001) { if (tr?.overlay) this.overlay(main, tr.overlay, W, H); return; }

    const L = this.canvas('layer', W, H);
    const ctx = L.ctx;
    ctx.translate(W / 2, H / 2);
    let dofBlur = 0;
    if (cam) {
      const depth = p.depth;
      const r = rng(Math.floor(t * 30));
      const shake = cam.shake * s;
      ctx.rotate(cam.camRotation * DEG);
      const z = cam.camZoom ** (1 + depth * 0.6);
      ctx.scale(z, z);
      ctx.translate(-cam.camX * s * (1 + depth) + (r() - 0.5) * shake, -cam.camY * s * (1 + depth) + (r() - 0.5) * shake);
      dofBlur = Math.abs(depth - cam.focus) * cam.aperture;
    }
    ctx.translate(p.x * s + (tr?.dx || 0), p.y * s + (tr?.dy || 0));
    ctx.rotate((p.rotation + (tr?.rotation || 0)) * DEG);
    const sc = p.scale * (tr?.scale ?? 1);
    // Pseudo-3D (2,5D) : la rotation sur Y/X est rendue par une compression perspective.
    const fx3d = Math.cos(p.rotateY * DEG); const fy3d = Math.cos(p.rotateX * DEG);
    ctx.scale(sc * fx3d, sc * fy3d);

    await this.drawContent(ctx, project, clip, local, s, env);

    // Effets du calque, appliqués en chaîne.
    let src = L;
    let flip = 0;
    for (const fx of clip.effects || []) {
      const def = LAYER_EFFECTS[fx.type];
      if (!def || fx.enabled === false) continue;
      const dst = this.canvas(`fx${flip}`, W, H);
      flip = 1 - flip;
      def.apply(dst.ctx, src.canvas, { ...defaults(def), ...fx.params }, {
        scale: s, time: t, clipId: clip.id, scratch: (w, h) => this.canvas('layer-scratch', w, h),
      });
      dst.ctx.setTransform(1, 0, 0, 1, 0, 0);
      src = dst;
    }

    main.save();
    if (tr?.clip) { main.beginPath(); tr.clip(main, W, H); main.clip(); }
    main.globalAlpha = alpha;
    main.globalCompositeOperation = BLEND_MODES[p.blend] || 'source-over';
    const blur = (p.blur + (tr?.blur || 0) + dofBlur) * s;
    if (blur > 0.3) main.filter = `blur(${blur.toFixed(2)}px)`;
    main.drawImage(src.canvas, 0, 0);
    main.restore();
    if (tr?.overlay) this.overlay(main, tr.overlay, W, H);
  }

  overlay(main, ov, W, H) {
    if (!ov || ov.alpha <= 0) return;
    main.save(); main.globalAlpha = clamp(ov.alpha, 0, 1); main.fillStyle = ov.color; main.fillRect(0, 0, W, H); main.restore();
  }

  async drawContent(ctx, project, clip, local, s, env) {
    const PW = project.width * s; const PH = project.height * s;
    if (clip.type === 'text') {
      const f = fontString(clip.text);
      if (document.fonts && !document.fonts.check(f)) {
        const key = f;
        if (!this.fontWaiters.has(key)) {
          this.fontWaiters.add(key);
          ensureFont(clip.text.font, clip.text.weight, clip.text.italic).then(() => this.onFontLoaded?.());
        }
      }
      ctx.scale(s, s);
      drawText(ctx, clip, local, project.width);
      return;
    }
    if (clip.type === 'shape') { this.drawShape(ctx, clip, local, s, PW, PH); return; }

    const media = env.media.get(clip.mediaId);
    if (!media) { this.placeholder(ctx, PW, PH, 'Média manquant'); return; }
    let frame = null;
    if (clip.type === 'image') frame = await env.frames.image(media);
    else {
      const srcT = clamp(clip.in + local * (clip.speed || 1), 0, Math.max(0, (media.duration || 0) - 0.001));
      frame = await env.frames.video(clip, media, srcT);
    }
    if (!frame) { this.placeholder(ctx, PW, PH, ''); return; }
    const crop = clip.crop || { l: 0, t: 0, r: 0, b: 0 };
    const sx = frame.width * crop.l; const sy = frame.height * crop.t;
    const sw = Math.max(1, frame.width * (1 - crop.l - crop.r)); const sh = Math.max(1, frame.height * (1 - crop.t - crop.b));
    let dw = PW; let dh = PH;
    const ar = sw / sh; const par = PW / PH;
    if (clip.fit === 'contain') { if (ar > par) dh = PW / ar; else dw = PH * ar; }
    else if (clip.fit === 'cover') { if (ar > par) dw = PH * ar; else dh = PW / ar; }
    else if (clip.fit === 'none') { dw = sw * s; dh = sh * s; }
    ctx.drawImage(frame.image, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
  }

  drawShape(ctx, clip, local, s, PW, PH) {
    const sh = clip.shape;
    const w = sh.fullFrame ? PW : sh.width * s;
    const h = sh.fullFrame ? PH : sh.height * s;
    let reveal = 1;
    if (sh.reveal && sh.reveal.type !== 'none') reveal = getEasing('easeOutQuart')(clamp(local / Math.max(0.01, sh.reveal.duration), 0, 1));
    ctx.save();
    if (sh.reveal?.type === 'grow-x') ctx.scale(reveal, 1);
    else if (sh.reveal?.type === 'grow-y') ctx.scale(1, reveal);
    else if (sh.reveal?.type === 'scale') ctx.scale(reveal, reveal);
    let fill = sh.fill;
    if (sh.fill2) {
      const a = (sh.gradientAngle || 0) * DEG;
      const dx = Math.cos(a) * w / 2; const dy = Math.sin(a) * h / 2;
      fill = ctx.createLinearGradient(-dx, -dy, dx, dy);
      fill.addColorStop(0, sh.fill); fill.addColorStop(1, sh.fill2);
    }
    ctx.beginPath();
    switch (sh.kind) {
      case 'circle': ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); break;
      case 'triangle': ctx.moveTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(-w / 2, h / 2); ctx.closePath(); break;
      case 'line': ctx.rect(-w / 2, -Math.max(1, h * 0.02) / 2, w, Math.max(1, h * 0.02)); break;
      default: roundRect(ctx, -w / 2, -h / 2, w, h, (sh.radius || 0) * s);
    }
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (sh.stroke?.width > 0) { ctx.lineWidth = sh.stroke.width * s; ctx.strokeStyle = sh.stroke.color; ctx.stroke(); }
    ctx.restore();
  }

  placeholder(ctx, w, h, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    if (label) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = `${Math.round(h / 20)}px system-ui`; ctx.textAlign = 'center'; ctx.fillText(label, 0, 0); }
  }
}

const defaultsCache = new WeakMap();
function defaults(def) {
  if (!defaultsCache.has(def)) defaultsCache.set(def, Object.fromEntries(def.params.map((p) => [p.key, p.default])));
  return defaultsCache.get(def);
}
