// Moteur de texte : mise en page (retour à la ligne), styles et animations par lettre / mot / ligne.

import { getEasing, EASINGS } from './easing.js';
import { clamp, rng, hash } from '../util.js';

// unit : granularité de l'animation ; mask : chaque ligne est découpée (révélation par masque).
export const TEXT_ANIMATIONS = {
  none: { label: 'Aucune', unit: 'all' },
  fade: { label: 'Fondu', unit: 'all' },
  'slide-up': { label: 'Glisse vers le haut', unit: 'lines' },
  'slide-down': { label: 'Glisse vers le bas', unit: 'lines' },
  'slide-left': { label: 'Arrive de la droite', unit: 'all' },
  'slide-right': { label: 'Arrive de la gauche', unit: 'all' },
  pop: { label: 'Pop (rebond)', unit: 'all', ease: 'easeOutBack' },
  'zoom-out': { label: 'Zoom arrière', unit: 'all' },
  'blur-in': { label: 'Mise au point (flou)', unit: 'all' },
  'mask-up': { label: 'Révélation par masque', unit: 'lines', mask: true },
  words: { label: 'Mot par mot', unit: 'words' },
  letters: { label: 'Lettre par lettre', unit: 'chars' },
  typewriter: { label: 'Machine à écrire', unit: 'chars', instant: true },
  'pop-words': { label: 'Mots qui rebondissent', unit: 'words', ease: 'easeOutBack' },
  tracking: { label: 'Espacement qui se resserre', unit: 'chars' },
  glitch: { label: 'Glitch', unit: 'all' },
};

const widthCache = new Map();
function measure(ctx, s) {
  const key = `${ctx.font}|${s}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    w = ctx.measureText(s).width;
    if (widthCache.size > 20000) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}

export function fontString(t, size = t.size) {
  return `${t.italic ? 'italic ' : ''}${t.weight || 700} ${size}px "${t.font || 'Inter'}", system-ui, sans-serif`;
}

// Découpe le texte en lignes tenant dans la largeur maximale.
export function layoutText(ctx, t, maxWidth) {
  ctx.font = fontString(t);
  const ls = (t.letterSpacing || 0) * t.size;
  const raw = (t.uppercase ? t.content.toUpperCase() : t.content || '').split('\n');
  const lines = [];
  const lineWidth = (s) => measure(ctx, s) + Math.max(0, s.length - 1) * ls;
  for (const para of raw) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = `${cur} ${words[i]}`;
      if (maxWidth > 0 && lineWidth(test) > maxWidth) { lines.push(cur); cur = words[i]; } else cur = test;
    }
    lines.push(cur);
  }
  const lh = t.size * (t.lineHeight || 1.15);
  const laid = lines.map((s) => ({ text: s, width: lineWidth(s) }));
  const width = Math.max(1, ...laid.map((l) => l.width));
  return { lines: laid, lineHeight: lh, width, height: lh * laid.length, ls };
}

// Construit la liste des unités animées (caractères, mots, lignes ou bloc entier).
function buildUnits(ctx, layout, t, unit) {
  const units = [];
  const align = t.align || 'center';
  const top = -layout.height / 2;
  layout.lines.forEach((line, li) => {
    const lineX = align === 'left' ? -layout.width / 2 : align === 'right' ? layout.width / 2 - line.width : -line.width / 2;
    const y = top + li * layout.lineHeight + layout.lineHeight / 2;
    const xAt = (i) => lineX + measure(ctx, line.text.slice(0, i)) + i * layout.ls;
    if (unit === 'chars') {
      for (let i = 0; i < line.text.length; i++) {
        if (line.text[i] === ' ') continue;
        units.push({ s: line.text[i], x: xAt(i), y, w: xAt(i + 1) - xAt(i), line: li, word: line.text.slice(0, i).split(' ').length - 1 });
      }
    } else if (unit === 'words') {
      let i = 0;
      for (const w of line.text.split(' ')) {
        if (w) units.push({ s: w, x: xAt(i), y, w: xAt(i + w.length) - xAt(i), line: li });
        i += w.length + 1;
      }
    } else {
      units.push({ s: line.text, x: lineX, y, w: line.width, line: li });
    }
  });
  return units;
}

// Mouvement d'une unité pour un préréglage et une progression e ∈ [0,1] (1 = position finale).
function unitState(type, e, u, size, seed) {
  const s = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0 };
  switch (type) {
    case 'none': break;
    case 'fade': s.alpha = e; break;
    case 'slide-up': case 'words': s.alpha = Math.min(1, e * 1.6); s.dy = (1 - e) * size * 0.7; break;
    case 'slide-down': s.alpha = Math.min(1, e * 1.6); s.dy = -(1 - e) * size * 0.7; break;
    case 'slide-left': s.alpha = Math.min(1, e * 2); s.dx = (1 - e) * size * 2; break;
    case 'slide-right': s.alpha = Math.min(1, e * 2); s.dx = -(1 - e) * size * 2; break;
    case 'pop': case 'pop-words': s.alpha = clamp(e * 3, 0, 1); s.scale = Math.max(0, e); break;
    case 'zoom-out': s.alpha = e; s.scale = 1 + (1 - e) * 0.7; break;
    case 'blur-in': s.alpha = e; s.blur = (1 - e) * 24; s.scale = 1 + (1 - e) * 0.08; break;
    case 'mask-up': s.dy = (1 - e) * size * 1.25; break;
    case 'letters': s.alpha = e; s.dy = (1 - e) * size * 0.5; s.rot = (1 - e) * -12; break;
    case 'typewriter': s.alpha = e > 0 ? 1 : 0; break;
    case 'tracking': s.alpha = e; s.dx = -u.cx * (1 - e) * 0.6; break;
    case 'glitch': {
      const r = rng(seed);
      const on = e < 1;
      s.alpha = on ? (r() > 0.25 ? e : 0.2) : 1;
      s.dx = on ? (r() - 0.5) * size * 0.6 * (1 - e) : 0;
      break;
    }
    default: s.alpha = e;
  }
  return s;
}

// Progression d'une unité pour l'entrée et la sortie.
function unitProgress(anim, idx, count, localT, clipDur, dir) {
  if (!anim || anim.type === 'none') return 1;
  const def = TEXT_ANIMATIONS[anim.type] || TEXT_ANIMATIONS.fade;
  const dur = Math.max(0.01, anim.duration ?? 0.6);
  const stagger = def.unit === 'all' || def.unit === 'lines' && count === 1 ? 0 : (anim.stagger ?? 0.04);
  const unitDur = def.instant ? 0.001 : Math.max(0.05, dur - stagger * (count - 1)) || dur;
  const order = dir === 'in' ? idx : count - 1 - idx;
  const start = order * stagger;
  const t = dir === 'in' ? localT : localT - (clipDur - dur);
  const p = clamp((t - start) / unitDur, 0, 1);
  const ease = getEasing(def.ease || 'easeOutQuart');
  return dir === 'in' ? ease(p) : 1 - EASINGS.easeIn.fn(p);
}

// Dessine le texte centré en (0,0) dans le repère courant.
export function drawText(ctx, clip, localT, projectW) {
  const t = clip.text;
  const maxWidth = (t.boxWidth || 0.8) * projectW;
  const layout = layoutText(ctx, t, maxWidth);
  const inType = t.animIn?.type || 'none';
  const outType = t.animOut?.type || 'none';
  const inDef = TEXT_ANIMATIONS[inType] || TEXT_ANIMATIONS.none;
  const outDef = TEXT_ANIMATIONS[outType] || TEXT_ANIMATIONS.none;
  const inOutDur = (t.animIn?.duration || 0) + (t.animOut?.duration || 0);
  const outActive = outType !== 'none' && localT > clip.duration - (t.animOut?.duration || 0) && clip.duration > inOutDur * 0.5;
  const def = outActive ? outDef : inDef;
  const type = outActive ? outType : inType;
  const units = buildUnits(ctx, layout, t, def.unit);
  const block = { x: -layout.width / 2, y: -layout.height / 2, w: layout.width, h: layout.height };

  // Fond (bandeau) derrière le bloc de texte, animé avec l'entrée.
  if (t.background?.enabled) {
    const blockP = unitProgress(outActive ? t.animOut : t.animIn, 0, 1, localT, clip.duration, outActive ? 'out' : 'in');
    const pad = t.background.padding ?? 20;
    ctx.save();
    ctx.globalAlpha *= clamp(blockP * 1.5, 0, 1);
    ctx.fillStyle = t.background.color;
    const w = (block.w + pad * 2) * (type === 'none' ? 1 : clamp(0.2 + blockP * 0.8, 0, 1));
    const bx = t.align === 'left' ? block.x - pad : t.align === 'right' ? block.x + block.w + pad - w : -w / 2;
    roundRect(ctx, bx, block.y - pad * 0.6, w, block.h + pad * 1.2, t.background.radius || 0);
    ctx.fill();
    ctx.restore();
  }

  const highlight = t.highlight?.enabled && t.highlight.words
    ? new Set(t.highlight.words.toLowerCase().split(/[\s,]+/).filter(Boolean)) : null;
  ctx.font = fontString(t);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${layout.ls}px`;
  const seedBase = hash(clip.id);
  units.forEach((u, i) => {
    u.cx = u.x + u.w / 2;
    const p = unitProgress(outActive ? t.animOut : t.animIn, i, units.length, localT, clip.duration, outActive ? 'out' : 'in');
    const st = unitState(type, p, u, t.size, seedBase + Math.floor(localT * 24) + i);
    if (st.alpha <= 0.001 || st.scale <= 0.001) return;
    ctx.save();
    if (def.mask) {
      ctx.beginPath();
      ctx.rect(block.x - t.size, u.y - layout.lineHeight / 2, block.w + t.size * 2, layout.lineHeight);
      ctx.clip();
    }
    ctx.globalAlpha *= st.alpha;
    ctx.translate(u.cx + st.dx, u.y + st.dy);
    if (st.rot) ctx.rotate((st.rot * Math.PI) / 180);
    if (st.scale !== 1) ctx.scale(st.scale, st.scale);
    if (st.blur > 0.3) ctx.filter = `blur(${st.blur.toFixed(1)}px)`;
    let color = t.color;
    if (highlight && highlight.has(u.s.toLowerCase().replace(/[^\p{L}\p{N}']/gu, ''))) color = t.highlight.color;
    if (t.shadow?.blur > 0 || t.shadow?.x || t.shadow?.y) {
      ctx.shadowColor = t.shadow.color; ctx.shadowBlur = t.shadow.blur; ctx.shadowOffsetX = t.shadow.x || 0; ctx.shadowOffsetY = t.shadow.y || 0;
    }
    if (t.stroke?.width > 0) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = t.stroke.width * 2;
      ctx.strokeStyle = t.stroke.color;
      ctx.strokeText(u.s, -u.w / 2, 0);
      ctx.shadowColor = 'transparent';
    }
    if (highlight && def.unit !== 'words' && def.unit !== 'chars') {
      drawHighlightedLine(ctx, u.s, -u.w / 2, t, highlight, layout.ls);
    } else {
      ctx.fillStyle = color;
      ctx.fillText(u.s, -u.w / 2, 0);
    }
    ctx.restore();
  });
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return block;
}

function drawHighlightedLine(ctx, line, x0, t, highlight, ls) {
  let x = x0;
  for (const word of line.split(/(\s+)/)) {
    if (!word) continue;
    ctx.fillStyle = highlight.has(word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '')) ? t.highlight.color : t.color;
    ctx.fillText(word, x, 0);
    x += ctx.measureText(word).width + word.length * ls;
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Chargement des polices avant le rendu (indispensable à l'exportation).
const fontPromises = new Map();
export function ensureFont(family, weight = 400, italic = false) {
  const key = `${family}|${weight}|${italic}`;
  if (!fontPromises.has(key)) {
    const p = document.fonts?.load ? document.fonts.load(`${italic ? 'italic ' : ''}${weight} 48px "${family}"`).catch(() => []) : Promise.resolve([]);
    fontPromises.set(key, p);
  }
  return fontPromises.get(key);
}
