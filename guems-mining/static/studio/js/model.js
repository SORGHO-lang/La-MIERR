// Modèle de données d'un projet de montage.
//
// project = { id, name, width, height, fps, background, tracks[], mediaIds[], createdAt, updatedAt, thumb }
// track   = { id, kind: 'video'|'text'|'audio'|'fx', name, muted, hidden, locked, clips[] }
// clip    = { id, type, start, duration, ... } — start/duration en secondes sur la timeline.
//   type 'video'|'image' : mediaId, in (décalage source), speed, volume, fit, crop
//   type 'audio'         : mediaId, in, speed, volume, fadeIn, fadeOut
//   type 'text'          : text {…}
//   type 'shape'         : shape {…}
//   type 'fx'            : effet appliqué à tout ce qui se trouve sous la piste (vignette, particules, caméra…)
// Les propriétés animables vivent dans clip.transform et clip.keyframes[prop] = [{ t, v, ease }].

import { uid, deepClone } from './util.js';

export const ASPECTS = {
  '16:9': { label: 'Horizontal 16:9', w: 1920, h: 1080 },
  '9:16': { label: 'Vertical 9:16 (TikTok, Reels)', w: 1080, h: 1920 },
  '1:1': { label: 'Carré 1:1', w: 1080, h: 1080 },
  '4:5': { label: 'Portrait 4:5 (Instagram)', w: 1080, h: 1350 },
};
export const FPS_OPTIONS = [24, 25, 30, 50, 60];

export const FONTS = [
  'Inter', 'Manrope', 'Montserrat', 'Poppins', 'Bebas Neue', 'Anton', 'Oswald',
  'Archivo Black', 'Space Grotesk', 'Playfair Display', 'DM Serif Display', 'Caveat',
];

export const BLEND_MODES = {
  normal: 'source-over', screen: 'screen', multiply: 'multiply', overlay: 'overlay',
  add: 'lighter', lighten: 'lighten', darken: 'darken', 'soft-light': 'soft-light',
};

export const ANIMATABLE = {
  x: { label: 'Position X', step: 1, def: 0 },
  y: { label: 'Position Y', step: 1, def: 0 },
  scale: { label: 'Échelle', step: 0.01, min: 0, max: 20, def: 1 },
  rotation: { label: 'Rotation (°)', step: 0.5, def: 0 },
  opacity: { label: 'Opacité', step: 0.01, min: 0, max: 1, def: 1 },
  rotateY: { label: 'Rotation 3D Y (°)', step: 1, def: 0 },
  rotateX: { label: 'Rotation 3D X (°)', step: 1, def: 0 },
  blur: { label: 'Flou (px)', step: 0.5, min: 0, max: 80, def: 0 },
};
export const CAMERA_PROPS = {
  camX: { label: 'Panoramique X', step: 1, def: 0 },
  camY: { label: 'Panoramique Y', step: 1, def: 0 },
  camZoom: { label: 'Zoom caméra', step: 0.01, min: 0.1, max: 10, def: 1 },
  camRotation: { label: 'Roulis (°)', step: 0.5, def: 0 },
  focus: { label: 'Plan de netteté', step: 0.05, min: -1, max: 1, def: 0 },
  aperture: { label: 'Profondeur de champ (flou)', step: 0.5, min: 0, max: 40, def: 0 },
  shake: { label: 'Tremblement', step: 0.5, min: 0, max: 60, def: 0 },
};

export function createProject({ name = 'Nouveau projet', aspect = '16:9', fps = 30, background = '#000000' } = {}) {
  const a = ASPECTS[aspect] || ASPECTS['16:9'];
  const now = Date.now();
  return {
    id: uid('prj'), version: 1, name, aspect, width: a.w, height: a.h, fps, background,
    tracks: [
      createTrack('fx', 'Effets'),
      createTrack('text', 'Textes'),
      createTrack('video', 'Vidéo 2'),
      createTrack('video', 'Vidéo 1'),
      createTrack('audio', 'Musique'),
      createTrack('audio', 'Voix / sons'),
    ],
    mediaIds: [], createdAt: now, updatedAt: now, thumb: '',
  };
}

export function createTrack(kind, name) {
  return { id: uid('trk'), kind, name: name || ({ video: 'Vidéo', text: 'Textes', audio: 'Audio', fx: 'Effets' }[kind]), muted: false, hidden: false, locked: false, clips: [] };
}

const baseTransform = () => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, rotateY: 0, rotateX: 0, blur: 0, depth: 0, blend: 'normal' });

export function createClip(type, props = {}) {
  const base = { id: uid('clp'), type, start: 0, duration: 5, keyframes: {}, effects: [], transitionIn: null, transitionOut: null, name: '' };
  const visual = { transform: baseTransform() };
  switch (type) {
    case 'video':
      return deep({ ...base, ...visual, mediaId: null, in: 0, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0, fit: 'cover', crop: { l: 0, t: 0, r: 0, b: 0 } }, props);
    case 'image':
      return deep({ ...base, ...visual, mediaId: null, fit: 'cover', crop: { l: 0, t: 0, r: 0, b: 0 } }, props);
    case 'audio':
      return deep({ ...base, mediaId: null, in: 0, speed: 1, volume: 1, fadeIn: 0, fadeOut: 0 }, props);
    case 'text':
      return deep({
        ...base, ...visual, duration: 4,
        text: {
          content: 'Votre titre', font: 'Manrope', weight: 800, size: 110, color: '#FFFFFF', align: 'center',
          lineHeight: 1.1, letterSpacing: 0, uppercase: false, italic: false, boxWidth: 0.8,
          stroke: { width: 0, color: '#000000' }, shadow: { blur: 0, color: '#000000', x: 0, y: 0 },
          background: { enabled: false, color: '#F96A00', padding: 24, radius: 8 },
          animIn: { type: 'slide-up', duration: 0.7, stagger: 0.04 }, animOut: { type: 'fade', duration: 0.4, stagger: 0.02 },
          highlight: { enabled: false, words: '', color: '#F96A00' },
        },
      }, props);
    case 'shape':
      return deep({
        ...base, ...visual,
        shape: { kind: 'rect', width: 600, height: 120, radius: 0, fill: '#F96A00', fill2: '', gradientAngle: 90, stroke: { width: 0, color: '#FFFFFF' }, fullFrame: false, reveal: { type: 'none', duration: 0.6 } },
      }, props);
    case 'fx':
      return deep({ ...base, fx: { type: 'vignette', params: {} }, camera: { camX: 0, camY: 0, camZoom: 1, camRotation: 0, focus: 0, aperture: 0, shake: 0 } }, props);
    default:
      throw new Error(`Type de clip inconnu : ${type}`);
  }
}

// Fusion profonde simple (objets uniquement, les tableaux sont remplacés).
function deep(target, src) {
  const out = deepClone(target);
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deep(out[k], v);
    else out[k] = deepClone(v);
  }
  return out;
}
export { deep as mergeDeep };

export const clipEnd = (c) => c.start + c.duration;
export const projectDuration = (p) => Math.max(1, ...p.tracks.flatMap((t) => t.clips.map(clipEnd)));
export const isVisual = (c) => ['video', 'image', 'text', 'shape'].includes(c.type);
export const trackAccepts = (track, clip) => (track.kind === 'audio' ? clip.type === 'audio'
  : track.kind === 'fx' ? clip.type === 'fx'
    : isVisual(clip));

export function findClip(project, clipId) {
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { track, clip };
  }
  return null;
}

// Vérifie qu'un clip ne chevauche aucun autre clip de la même piste.
export function fitsOnTrack(track, start, duration, ignoreId) {
  return start >= -1e-6 && !track.clips.some((c) => c.id !== ignoreId && start < clipEnd(c) - 1e-6 && start + duration > c.start + 1e-6);
}

// Premier emplacement libre ≥ start sur la piste.
export function firstFreeSlot(track, start, duration) {
  let s = Math.max(0, start);
  const sorted = [...track.clips].sort((a, b) => a.start - b.start);
  for (const c of sorted) {
    if (s + duration <= c.start + 1e-6) break;
    if (s < clipEnd(c)) s = clipEnd(c);
  }
  return s;
}

// Contrôle et répare un projet chargé (fichier importé ou ancienne version).
export function sanitizeProject(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.tracks)) throw new Error('Fichier de projet invalide.');
  p.width = Math.max(16, Math.min(7680, Number(p.width) || 1920));
  p.height = Math.max(16, Math.min(7680, Number(p.height) || 1080));
  p.fps = FPS_OPTIONS.includes(Number(p.fps)) ? Number(p.fps) : 30;
  p.mediaIds = Array.isArray(p.mediaIds) ? p.mediaIds : [];
  for (const t of p.tracks) {
    t.clips = (t.clips || []).filter((c) => c && typeof c.start === 'number' && c.duration > 0);
    for (const c of t.clips) { c.keyframes = c.keyframes || {}; c.effects = c.effects || []; }
  }
  return p;
}
