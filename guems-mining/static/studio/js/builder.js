// Constructeur de compositions : transforme un « plan » (scènes, textes, style) en projet multipiste.
// Utilisé par les modèles, l'assistant IA et le planificateur local.
//
// plan = {
//   title, aspect: '16:9'|'9:16'|'1:1'|'4:5', fps?,
//   style: { palette: { background, primary, accent, text }, fontHeading, fontBody, mood, effects: [...] },
//   music: { mood, bpm, suggestions: [] },
//   scenes: [{ duration, visual: 'logo'|'media'|'text'|'kinetic'|'cta'|'split'|'lower-third',
//              headline, subtext, textAnimation, transition, effects: [], camera }]
// }

import { createProject, createTrack, createClip, ASPECTS, fitsOnTrack } from './model.js';
import { setKeyframe } from './engine/easing.js';
import { FRAME_EFFECTS, LAYER_EFFECTS, defaultParams } from './engine/effects.js';
import { TEXT_ANIMATIONS } from './engine/text.js';
import { TRANSITIONS } from './engine/transitions.js';
import { clamp } from './util.js';

export const SCENE_VISUALS = ['logo', 'media', 'text', 'kinetic', 'cta', 'split', 'lower-third'];
export const CAMERA_MOVES = ['static', 'slow-zoom-in', 'slow-zoom-out', 'pan-left', 'pan-right', 'push-in', 'shake', 'parallax'];
export const GLOBAL_EFFECTS = ['vignette', 'grain', 'particles-sparks', 'particles-dust', 'particles-bokeh', 'light-leak', 'letterbox', 'color-grade-warm', 'color-grade-cool'];
export const SCENE_EFFECTS = ['glow', 'shadow', 'glitch', 'chromatic', 'blur-in', 'flash'];

const DEFAULT_STYLE = {
  palette: { background: '#0F0F10', primary: '#F96A00', accent: '#FFB15C', text: '#FFFFFF' },
  fontHeading: 'Manrope', fontBody: 'Inter', mood: 'cinématique', effects: ['vignette'],
};

// Normalise et sécurise un plan (provenant d'un modèle, de l'IA ou d'un fichier).
export function normalizePlan(input) {
  const plan = typeof input === 'object' && input ? JSON.parse(JSON.stringify(input)) : {};
  plan.title = String(plan.title || 'Vidéo').slice(0, 120);
  plan.aspect = ASPECTS[plan.aspect] ? plan.aspect : '16:9';
  plan.fps = [24, 25, 30, 50, 60].includes(plan.fps) ? plan.fps : 30;
  const st = plan.style || {};
  const pal = st.palette || {};
  const hex = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  plan.style = {
    palette: {
      background: hex(pal.background, DEFAULT_STYLE.palette.background),
      primary: hex(pal.primary, DEFAULT_STYLE.palette.primary),
      accent: hex(pal.accent, DEFAULT_STYLE.palette.accent),
      text: hex(pal.text, DEFAULT_STYLE.palette.text),
    },
    fontHeading: st.fontHeading || DEFAULT_STYLE.fontHeading,
    fontBody: st.fontBody || DEFAULT_STYLE.fontBody,
    mood: String(st.mood || DEFAULT_STYLE.mood).slice(0, 60),
    effects: (Array.isArray(st.effects) ? st.effects : DEFAULT_STYLE.effects).filter((e) => GLOBAL_EFFECTS.includes(e)),
  };
  plan.music = plan.music && typeof plan.music === 'object' ? plan.music : {};
  plan.scenes = (Array.isArray(plan.scenes) ? plan.scenes : []).slice(0, 30).map((sc) => ({
    duration: clamp(Number(sc.duration) || 3, 0.5, 60),
    visual: SCENE_VISUALS.includes(sc.visual) ? sc.visual : 'text',
    headline: String(sc.headline ?? '').slice(0, 200),
    subtext: String(sc.subtext ?? '').slice(0, 400),
    textAnimation: TEXT_ANIMATIONS[sc.textAnimation] ? sc.textAnimation : 'slide-up',
    transition: TRANSITIONS[sc.transition] ? sc.transition : 'fade',
    effects: (Array.isArray(sc.effects) ? sc.effects : []).filter((e) => SCENE_EFFECTS.includes(e)),
    camera: CAMERA_MOVES.includes(sc.camera) ? sc.camera : 'static',
    purpose: String(sc.purpose || '').slice(0, 200),
    mediaHint: String(sc.mediaHint || '').slice(0, 200),
    voiceover: String(sc.voiceover || '').slice(0, 600),
  }));
  if (!plan.scenes.length) plan.scenes.push({ duration: 3, visual: 'text', headline: plan.title, subtext: '', textAnimation: 'slide-up', transition: 'fade', effects: [], camera: 'static' });
  return plan;
}

export const planDuration = (plan) => plan.scenes.reduce((a, s) => a + s.duration, 0);

// Met les durées des scènes à l'échelle pour atteindre une durée totale.
export function scalePlan(plan, total) {
  const cur = planDuration(plan);
  if (!total || !cur) return plan;
  const k = total / cur;
  plan.scenes.forEach((s) => { s.duration = Math.max(0.5, Math.round(s.duration * k * 10) / 10); });
  return plan;
}

/**
 * @param {object} rawPlan
 * @param {{ logo?: object, visuals?: object[], music?: object, voice?: object, name?: string }} assets
 *   objets média (enregistrements du MediaManager)
 */
export function buildProject(rawPlan, assets = {}) {
  const plan = normalizePlan(rawPlan);
  const project = createProject({ name: assets.name || plan.title, aspect: plan.aspect, fps: plan.fps, background: plan.style.palette.background });
  const W = project.width; const H = project.height;
  const base = Math.min(W, H);
  const vertical = H > W;
  const pal = plan.style.palette;
  const fx = createTrack('fx', 'Effets');
  const titles = createTrack('text', 'Titres');
  const subs = createTrack('text', 'Textes secondaires');
  const deco = createTrack('video', 'Habillage');
  const planB = createTrack('video', 'Plans B');
  const planA = createTrack('video', 'Plans A');
  const music = createTrack('audio', 'Musique');
  const voice = createTrack('audio', 'Voix off');
  project.tracks = [fx, titles, subs, deco, planB, planA, music, voice];
  project.plan = plan;
  // Place un clip sur la première piste libre de son groupe (crée une piste au besoin : jamais de chevauchement).
  const groups = { titles: [titles], subs: [subs], deco: [deco], fx: [fx] };
  const put = (group, clip) => {
    const list = groups[group];
    let track = list.find((t) => fitsOnTrack(t, clip.start, clip.duration));
    if (!track) {
      track = createTrack(list[0].kind, `${list[0].name} ${list.length + 1}`);
      project.tracks.splice(project.tracks.indexOf(list[list.length - 1]) + 1, 0, track);
      list.push(track);
    }
    track.clips.push(clip);
    return clip;
  };

  const visuals = (assets.visuals || []).filter(Boolean);
  let vIndex = 0;
  const nextVisual = () => (visuals.length ? visuals[vIndex++ % visuals.length] : null);
  const headSize = Math.round(base * (vertical ? 0.095 : 0.088));
  const subSize = Math.round(base * 0.04);
  const TR = 0.6; // durée des transitions entre scènes

  let T = 0;
  let prevBg = null;
  plan.scenes.forEach((sc, i) => {
    const d = sc.duration;
    const next = plan.scenes[i + 1];
    const tail = next ? Math.min(TR, next.duration / 2, d / 2) : 0;
    const onA = i % 2 === 0;
    const bgTrack = onA ? planA : planB;

    // --- Fond de la scène (média ou dégradé), prolongé pour le fondu enchaîné.
    const media = sc.visual === 'media' || sc.visual === 'split' || sc.visual === 'lower-third' ? nextVisual() : null;
    let bg;
    if (media) {
      bg = createClip(media.kind === 'video' ? 'video' : 'image', { mediaId: media.id, start: T, duration: d + tail, fit: 'cover', name: media.name });
      if (media.kind === 'video') bg.volume = 0;
      applyCamera(bg, sc.camera, d + tail, base);
    } else {
      bg = createClip('shape', {
        start: T, duration: d + tail, name: 'Fond',
        shape: { kind: 'rect', fullFrame: true, fill: shade(pal.background, 0.0), fill2: mix(pal.background, pal.primary, 0.35), gradientAngle: 120 + i * 35 },
      });
      setKeyframe(bg, 'scale', 0, 1.0, 'linear'); setKeyframe(bg, 'scale', d + tail, 1.08, 'linear');
    }
    // Transition : portée par le clip du dessus pendant le chevauchement.
    if (i > 0 && prevBg) {
      const type = sc.transition;
      if (onA) prevBg.transitionOut = { type, duration: Math.min(TR, prevBg.duration / 2) };
      else bg.transitionIn = { type, duration: Math.min(TR, d / 2) };
    } else if (i === 0) {
      bg.transitionIn = { type: 'fade-black', duration: 0.6 };
    }
    if (i === plan.scenes.length - 1) bg.transitionOut = { type: 'fade-black', duration: 0.8 };
    bgTrack.clips.push(bg);
    prevBg = bg;

    // Voile de lisibilité au-dessus des images.
    if (media && (sc.headline || sc.subtext)) {
      const veil = createClip('shape', { start: T, duration: d, name: 'Voile', shape: { kind: 'rect', fullFrame: true, fill: '#000000', fill2: '' } });
      veil.transform.opacity = sc.visual === 'lower-third' ? 0.15 : 0.42;
      veil.transitionIn = { type: 'fade', duration: 0.4 };
      veil.transitionOut = { type: 'fade', duration: 0.4 };
      put('deco', veil);
    }

    const textIn = sc.textAnimation;
    const tOff = Math.min(0.25, d * 0.1);
    const textDur = Math.max(0.6, d - tOff - 0.1);
    const heading = (content, extra = {}) => createClip('text', mergeText({
      start: T + tOff, duration: textDur, name: 'Titre',
      text: { content, font: plan.style.fontHeading, weight: 800, size: headSize, color: pal.text, boxWidth: vertical ? 0.86 : 0.78, shadow: { blur: Math.round(headSize * 0.35), color: '#00000088', x: 0, y: Math.round(headSize * 0.05) }, animIn: { type: textIn, duration: 0.8, stagger: 0.05 }, animOut: { type: 'fade', duration: 0.35 } },
    }, extra));
    const subtext = (content, extra = {}) => createClip('text', mergeText({
      start: T + tOff + 0.35, duration: Math.max(0.5, textDur - 0.35), name: 'Sous-titre',
      text: { content, font: plan.style.fontBody, weight: 500, size: subSize, color: mix(pal.text, pal.accent, 0.15), boxWidth: vertical ? 0.84 : 0.66, lineHeight: 1.35, animIn: { type: 'fade', duration: 0.7 }, animOut: { type: 'fade', duration: 0.3 } },
    }, extra));

    switch (sc.visual) {
      case 'logo': {
        if (assets.logo) {
          const logo = createClip('image', { mediaId: assets.logo.id, start: T + 0.1, duration: d - 0.1, fit: 'contain', name: 'Logo' });
          const target = vertical ? 0.62 : 0.45;
          setKeyframe(logo, 'scale', 0, target * 0.6, 'easeOutBack'); setKeyframe(logo, 'scale', 0.9, target, 'linear'); setKeyframe(logo, 'scale', d - 0.1, target * 1.04, 'linear');
          setKeyframe(logo, 'opacity', 0, 0, 'easeOut'); setKeyframe(logo, 'opacity', 0.5, 1, 'linear');
          logo.transform.y = sc.headline ? -base * 0.06 : 0;
          logo.effects.push({ type: 'glow', enabled: true, params: { ...defaultParams(LAYER_EFFECTS.glow), radius: 30, strength: 0.6, color: pal.accent, tint: 0.3 } });
          logo.transitionOut = { type: 'fade', duration: 0.4 };
          put('deco', logo);
          if (sc.headline) put('titles', heading(sc.headline, { transform: { y: base * 0.26 }, text: { size: Math.round(headSize * 0.55), animIn: { type: 'tracking', duration: 1 } } }));
        } else {
          put('titles', heading(sc.headline || plan.title, { text: { size: Math.round(headSize * 1.25), animIn: { type: 'tracking', duration: 1.1 } } }));
        }
        if (sc.subtext) put('subs', subtext(sc.subtext, { transform: { y: base * (assets.logo ? 0.34 : 0.14) } }));
        break;
      }
      case 'kinetic': {
        const words = (sc.headline || plan.title).split(/\s+/).filter(Boolean).slice(0, 12);
        const per = d / Math.max(1, words.length);
        words.forEach((w, k) => {
          const c = heading(w, { start: T + k * per, duration: Math.max(0.3, per), text: { size: Math.round(headSize * 1.6), color: k % 2 ? pal.primary : pal.text, uppercase: true, animIn: { type: 'pop', duration: Math.min(0.4, per * 0.6) }, animOut: { type: 'none', duration: 0 } } });
          setKeyframe(c, 'scale', 0, 1, 'linear'); setKeyframe(c, 'scale', Math.max(0.3, per), 1.12, 'linear');
          put('titles', c);
        });
        if (sc.subtext) put('subs', subtext(sc.subtext, { transform: { y: base * 0.22 } }));
        break;
      }
      case 'cta': {
        put('titles', heading(sc.headline || 'Contactez-nous', { transform: { y: -base * 0.1 }, text: { animIn: { type: textIn === 'none' ? 'pop' : textIn, duration: 0.8 } } }));
        const btnW = Math.round(base * (vertical ? 0.78 : 0.62)); const btnH = Math.round(base * 0.11);
        const btn = createClip('shape', { start: T + 0.6, duration: d - 0.7, name: 'Bouton', shape: { kind: 'rect', width: btnW, height: btnH, radius: btnH / 2, fill: pal.primary, fill2: pal.accent, gradientAngle: 0, reveal: { type: 'grow-x', duration: 0.6 } } });
        btn.transform.y = base * 0.1;
        btn.effects.push({ type: 'shadow', enabled: true, params: { ...defaultParams(LAYER_EFFECTS.shadow), blur: 40, y: 16, opacity: 0.5, color: pal.primary } });
        btn.transitionOut = { type: 'fade', duration: 0.3 };
        put('deco', btn);
        put('subs', createClip('text', mergeText({
          start: T + 0.9, duration: Math.max(0.5, d - 1), name: 'Appel à l\'action',
          transform: { y: base * 0.1 },
          text: { content: sc.subtext || '', font: plan.style.fontHeading, weight: 800, size: Math.round(subSize * 1.15), color: contrastOn(pal.primary), boxWidth: 0.9, animIn: { type: 'fade', duration: 0.5 }, animOut: { type: 'fade', duration: 0.3 } },
        })));
        break;
      }
      case 'lower-third': {
        const y = H * 0.32;
        const barW = Math.round(W * (vertical ? 0.86 : 0.5));
        const bar = createClip('shape', { start: T + 0.2, duration: d - 0.3, name: 'Bandeau', shape: { kind: 'rect', width: barW, height: Math.round(base * 0.17), radius: 6, fill: pal.background, reveal: { type: 'grow-x', duration: 0.5 } } });
        bar.transform.x = vertical ? 0 : -W / 2 + barW / 2 + W * 0.06; bar.transform.y = y; bar.transform.opacity = 0.88;
        bar.transitionOut = { type: 'wipe-left', duration: 0.4 };
        const accent = createClip('shape', { start: T + 0.2, duration: d - 0.3, name: 'Accent', shape: { kind: 'rect', width: Math.round(base * 0.012), height: Math.round(base * 0.17), fill: pal.primary, reveal: { type: 'grow-y', duration: 0.4 } } });
        accent.transform.x = bar.transform.x - barW / 2; accent.transform.y = y;
        accent.transitionOut = { type: 'fade', duration: 0.3 };
        put('deco', bar); put('deco', accent);
        const tx = vertical ? 0 : bar.transform.x;
        put('titles', heading(sc.headline, { start: T + 0.45, duration: d - 0.6, transform: { x: tx, y: y - base * 0.035 }, text: { size: Math.round(subSize * 1.5), align: vertical ? 'center' : 'center', boxWidth: barW / W * 0.92, animIn: { type: 'mask-up', duration: 0.6 } } }));
        if (sc.subtext) put('subs', subtext(sc.subtext, { start: T + 0.65, duration: d - 0.8, transform: { x: tx, y: y + base * 0.045 }, text: { size: Math.round(subSize * 0.95), boxWidth: barW / W * 0.92, animIn: { type: 'mask-up', duration: 0.6 } } }));
        break;
      }
      case 'split': {
        if (bg.type !== 'shape') { bg.transform.x = vertical ? 0 : W * 0.22; bg.transform.scale = vertical ? 1 : 0.62; if (!vertical) bg.fit = 'cover'; }
        put('titles', heading(sc.headline, { transform: { x: vertical ? 0 : -W * 0.22, y: vertical ? -H * 0.28 : -base * 0.05 }, text: { align: vertical ? 'center' : 'left', boxWidth: vertical ? 0.86 : 0.42 } }));
        if (sc.subtext) put('subs', subtext(sc.subtext, { transform: { x: vertical ? 0 : -W * 0.22, y: vertical ? H * 0.3 : base * 0.12 }, text: { align: vertical ? 'center' : 'left', boxWidth: vertical ? 0.84 : 0.42 } }));
        break;
      }
      default: {
        if (sc.headline) put('titles', heading(sc.headline, { transform: { y: sc.subtext ? -base * 0.05 : 0 } }));
        if (sc.subtext) put('subs', subtext(sc.subtext, { transform: { y: base * 0.1 } }));
      }
    }

    // Effets de scène.
    for (const e of sc.effects) {
      if (e === 'flash') { const f = createClip('fx', { start: T, duration: Math.min(0.5, d), name: 'Flash', fx: { type: 'flash', params: defaultParams(FRAME_EFFECTS.flash) } }); put('fx', f); continue; }
      const targets = [...groups.titles, ...groups.deco].flatMap((tr) => tr.clips).filter((c) => c.start >= T - 1e-6 && c.start < T + d);
      for (const c of targets) {
        if (e === 'blur-in') { setKeyframe(c, 'blur', 0, 18, 'easeOut'); setKeyframe(c, 'blur', 0.6, 0, 'linear'); continue; }
        if (LAYER_EFFECTS[e] && !c.effects.some((x) => x.type === e)) {
          const params = defaultParams(LAYER_EFFECTS[e]);
          if (e === 'glow') { params.color = pal.accent; params.radius = 18; params.strength = 0.5; }
          if (e === 'glitch') { params.intensity = 0.35; }
          c.effects.push({ type: e, enabled: true, params });
        }
      }
    }
    if (sc.camera === 'shake') put('fx', createClip('fx', { start: T, duration: d, name: 'Caméra', fx: { type: 'camera', params: {} }, camera: { shake: 10 } }));
    T += d;
  });

  // Effets globaux sur toute la durée (ajoutés sur des pistes fx dédiées pour éviter les chevauchements).
  const total = T;
  plan.style.effects.forEach((e) => {
    const [type, variant] = e.startsWith('particles-') ? ['particles', e.split('-')[1]] : e.startsWith('color-grade-') ? ['color-grade', e.split('-')[2]] : [e, null];
    const def = FRAME_EFFECTS[type];
    if (!def) return;
    const params = defaultParams(def);
    if (type === 'particles') { params.style = variant; params.color = variant === 'dust' ? '#FFFFFF' : pal.accent; params.count = variant === 'bokeh' ? 22 : 80; }
    if (type === 'color-grade') { params.tint = variant === 'cool' ? '#3D8BFF' : '#FF8A3D'; }
    if (type === 'light-leak') { params.color = pal.primary; params.color2 = pal.accent; }
    const track = createTrack('fx', def.label);
    track.clips.push(createClip('fx', { start: 0, duration: total, name: def.label, fx: { type, params } }));
    project.tracks.splice(1, 0, track);
  });
  for (const tr of [...project.tracks]) if (tr.kind !== 'audio' && !tr.clips.length && tr !== planA) project.tracks.splice(project.tracks.indexOf(tr), 1);

  // Musique (répétée si plus courte que la vidéo) et voix off.
  if (assets.music?.duration) {
    let t = 0;
    while (t < total - 0.05) {
      const d = Math.min(assets.music.duration, total - t);
      const c = createClip('audio', { mediaId: assets.music.id, start: t, duration: d, name: assets.music.name, volume: 0.8, fadeIn: t === 0 ? 0.6 : 0, fadeOut: t + d >= total - 0.05 ? 1.5 : 0 });
      music.clips.push(c); t += d;
    }
  }
  if (assets.voice?.duration) voice.clips.push(createClip('audio', { mediaId: assets.voice.id, start: Math.min(0.3, total / 10), duration: Math.min(assets.voice.duration, total), name: assets.voice.name, volume: 1 }));
  project.mediaIds = [...new Set([assets.logo, ...visuals, assets.music, assets.voice].filter(Boolean).map((m) => m.id))];
  return project;
}

function mergeText(base, extra = {}) {
  const out = { ...base, ...extra };
  out.text = { ...base.text, ...(extra.text || {}) };
  if (extra.transform) out.transform = { ...extra.transform };
  return out;
}

function applyCamera(clip, move, d, base) {
  const k = (p, a, b, e = 'linear') => { setKeyframe(clip, p, 0, a, e); setKeyframe(clip, p, d, b, e); };
  switch (move) {
    case 'slow-zoom-in': k('scale', 1, 1.14); break;
    case 'slow-zoom-out': k('scale', 1.16, 1); break;
    case 'pan-left': clip.transform.scale = 1.15; k('x', base * 0.06, -base * 0.06); break;
    case 'pan-right': clip.transform.scale = 1.15; k('x', -base * 0.06, base * 0.06); break;
    case 'push-in': k('scale', 1, 1.3, 'easeInOut'); break;
    case 'parallax': clip.transform.scale = 1.1; k('x', base * 0.04, -base * 0.04); k('y', base * 0.015, -base * 0.015); break;
    default: break;
  }
}

function parse(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toHex(rgb) { return `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`; }
function mix(a, b, t) { const A = parse(a); const B = parse(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
function shade(a, t) { return mix(a, '#000000', t); }
function contrastOn(hex) { const [r, g, b] = parse(hex); return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111111' : '#FFFFFF'; }
