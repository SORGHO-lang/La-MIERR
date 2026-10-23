// Import et gestion des médias (vidéos, images, logos, musiques, voix off).
// Contrôles : type MIME autorisé, extension, taille maximale, lecture effective du fichier.

import { uid } from './util.js';
import { db } from './db.js';

export const LIMITS = { video: 4 * 1024 ** 3, image: 50 * 1024 ** 2, audio: 500 * 1024 ** 2 };
const ACCEPT = {
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-matroska'],
  image: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/flac'],
};
const EXT = { mp4: 'video', m4v: 'video', webm: 'video', mov: 'video', mkv: 'video', ogv: 'video', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image', gif: 'image', svg: 'image', avif: 'image', mp3: 'audio', wav: 'audio', ogg: 'audio', oga: 'audio', m4a: 'audio', aac: 'audio', flac: 'audio', opus: 'audio' };
export const ACCEPT_ATTR = [...ACCEPT.video, ...ACCEPT.image, ...ACCEPT.audio, ...Object.keys(EXT).map((e) => `.${e}`)].join(',');

export function classify(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  for (const [kind, list] of Object.entries(ACCEPT)) if (list.includes(file.type)) return kind;
  if (!file.type && EXT[ext]) return EXT[ext];
  if (file.type && EXT[ext] && file.type.split('/')[0] === EXT[ext]) return EXT[ext];
  return null;
}

const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);

function loadVideoMeta(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement('video');
    v.preload = 'auto'; v.muted = true; v.playsInline = true; v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error('Vidéo illisible par ce navigateur (codec non pris en charge ?).'));
  });
}
const seek = (v, t) => new Promise((res) => { v.onseeked = () => res(); v.currentTime = t; });

function thumbFrom(source, w, h, max = 240) {
  const r = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r));
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72);
}

export function peaks(buffer, n = 400) {
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / n));
  const out = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    const end = Math.min(data.length, (i + 1) * step);
    for (let j = i * step; j < end; j += 8) m = Math.max(m, Math.abs(data[j]));
    out.push(Math.round(m * 100) / 100);
  }
  return out;
}

export class MediaManager {
  constructor(audio) {
    this.audio = audio; // AudioEngine, pour décoder les pistes son
    this.items = new Map(); // id → enregistrement (sans blob)
    this.blobs = new Map();
    this.urls = new Map();
    this.images = new Map();
  }

  get(id) { return this.items.get(id); }
  list(ids) { return ids.map((id) => this.items.get(id)).filter(Boolean); }

  async loadProjectMedia(ids) {
    for (const id of ids) {
      if (this.items.has(id)) continue;
      const rec = await db.getMedia(id);
      if (rec) this.register(rec);
    }
  }

  register(rec) {
    const { blob, ...meta } = rec;
    this.items.set(rec.id, meta);
    this.blobs.set(rec.id, blob);
  }

  url(id) {
    if (!this.urls.has(id)) {
      const b = this.blobs.get(id);
      if (!b) return null;
      this.urls.set(id, URL.createObjectURL(b));
    }
    return this.urls.get(id);
  }
  blob(id) { return this.blobs.get(id); }

  async image(id) {
    if (!this.images.has(id)) {
      this.images.set(id, new Promise((resolve, reject) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image illisible'));
        img.src = this.url(id);
      }));
    }
    return this.images.get(id);
  }

  // Importe des fichiers ; renvoie { added: [...], errors: [...] }.
  async import(files, onProgress = () => {}) {
    const added = []; const errors = [];
    let i = 0;
    for (const file of files) {
      i++;
      onProgress({ index: i, total: files.length, name: file.name });
      try {
        const kind = classify(file);
        if (!kind) throw new Error('format non pris en charge');
        if (file.size > LIMITS[kind]) throw new Error(`fichier trop volumineux (max. ${Math.round(LIMITS[kind] / 1024 ** 2)} Mo)`);
        if (file.size === 0) throw new Error('fichier vide');
        const rec = { id: uid('med'), name: file.name.slice(0, 160), kind, mime: file.type || '', size: file.size, createdAt: Date.now(), blob: file };
        const url = URL.createObjectURL(file);
        try {
          if (kind === 'video') {
            const v = await withTimeout(loadVideoMeta(url), 20000, 'Lecture des métadonnées trop longue.');
            rec.duration = v.duration; rec.width = v.videoWidth; rec.height = v.videoHeight;
            if (!rec.width) throw new Error('aucune piste vidéo lisible');
            await withTimeout(seek(v, Math.min(1, v.duration * 0.1)), 10000, 'Miniature impossible');
            rec.thumb = thumbFrom(v, rec.width, rec.height);
            const strip = [];
            for (let k = 0; k < 6; k++) { await withTimeout(seek(v, (v.duration * (k + 0.5)) / 6), 8000, ''); strip.push(thumbFrom(v, rec.width, rec.height, 120)); }
            rec.strip = strip;
            v.removeAttribute('src'); v.load();
          } else if (kind === 'image') {
            const img = await withTimeout(new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image illisible')); im.src = url; }), 15000, 'Image trop longue à lire');
            rec.width = img.naturalWidth || 1000; rec.height = img.naturalHeight || 1000;
            rec.thumb = thumbFrom(img, rec.width, rec.height);
          }
          if (kind === 'audio' || kind === 'video') {
            const buf = await this.audio.decode(rec.id, file).catch(() => null);
            if (kind === 'audio' && !buf) throw new Error('piste audio illisible');
            rec.hasAudio = Boolean(buf);
            if (buf) { rec.waveform = peaks(buf); if (kind === 'audio') rec.duration = buf.duration; }
          }
        } finally {
          URL.revokeObjectURL(url);
        }
        await db.putMedia(rec);
        this.register(rec);
        added.push(this.items.get(rec.id));
      } catch (err) {
        errors.push(`${file.name} : ${err.message}`);
      }
    }
    return { added, errors };
  }
}
