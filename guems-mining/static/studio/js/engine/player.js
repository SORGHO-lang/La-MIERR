// Lecteur d'aperçu temps réel : horloge audio, synchronisation des vidéos, rendu à chaque image.

import { Renderer } from './renderer.js';
import { clipEnd } from '../model.js';

export class Player {
  constructor({ canvas, store, media, audio }) {
    this.canvas = canvas;
    this.store = store;
    this.media = media;
    this.audio = audio;
    this.renderer = new Renderer();
    this.renderer.onFontLoaded = () => this.requestRender();
    this.videos = new Map(); // clipId → HTMLVideoElement
    this.playing = false;
    this.loop = false;
    this.quality = 0.5; // fraction de la résolution du projet utilisée en aperçu
    this.pending = false;
    this.rendering = false;
    this.startWall = 0;
    this.startTime = 0;
    this.listeners = new Set();

    this.env = {
      media: { get: (id) => this.media.get(id) },
      frames: {
        image: (m) => this.media.image(m.id).then((img) => ({ image: img, width: img.naturalWidth || m.width, height: img.naturalHeight || m.height })).catch(() => null),
        video: (clip, m, srcT) => this.videoFrame(clip, m, srcT),
      },
    };
    store.on('change', () => { this.syncVideos(); this.requestRender(); });
    store.on('time', () => { if (!this.playing) this.requestRender(); });
    store.on('load', () => { this.disposeVideos(); this.resize(); });
  }

  onTick(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  resize() {
    const p = this.store.project;
    if (!p) return;
    const w = Math.max(16, Math.round(p.width * this.quality));
    const h = Math.max(16, Math.round(p.height * this.quality));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.requestRender();
  }

  setQuality(q) { this.quality = q; this.resize(); }

  videoEl(clip, m) {
    let v = this.videos.get(clip.id);
    if (!v || v.dataset.media !== m.id) {
      v?.pause();
      v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      v.dataset.media = m.id;
      v.src = this.media.url(m.id);
      v.addEventListener('seeked', () => { if (!this.playing) this.requestRender(); });
      v.addEventListener('loadeddata', () => this.requestRender());
      this.videos.set(clip.id, v);
    }
    return v;
  }

  videoFrame(clip, m, srcT) {
    const v = this.videoEl(clip, m);
    if (!this.playing && Math.abs(v.currentTime - srcT) > 0.5 / (this.store.project.fps || 30) && !v.seeking) v.currentTime = srcT;
    if (v.readyState < 2) return null;
    return { image: v, width: v.videoWidth, height: v.videoHeight };
  }

  syncVideos() {
    const p = this.store.project;
    if (!p) return;
    const ids = new Set(p.tracks.flatMap((t) => t.clips.filter((c) => c.type === 'video').map((c) => c.id)));
    for (const [id, v] of this.videos) if (!ids.has(id)) { v.pause(); v.removeAttribute('src'); v.load(); this.videos.delete(id); }
  }

  disposeVideos() {
    for (const v of this.videos.values()) { v.pause(); v.removeAttribute('src'); v.load(); }
    this.videos.clear();
  }

  requestRender() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => { this.pending = false; this.renderNow(); });
  }

  async renderNow() {
    const p = this.store.project;
    if (!p || this.rendering) { if (this.rendering) this.dirty = true; return; }
    this.rendering = true;
    try {
      await this.renderer.render(this.canvas, p, this.store.time, this.env);
    } catch (err) {
      console.error('Erreur de rendu', err);
    } finally {
      this.rendering = false;
      if (this.dirty) { this.dirty = false; this.requestRender(); }
    }
  }

  async play() {
    const p = this.store.project;
    if (!p || this.playing) return;
    if (this.store.time >= this.store.duration - 0.01) this.store.setTime(0);
    this.playing = true;
    this.startTime = this.store.time;
    let audioStart = null;
    try { audioStart = await this.audio.play(p, this.startTime, this.media); } catch (err) { console.warn('Audio indisponible', err); }
    this.clock = audioStart !== null
      ? () => this.startTime + Math.max(0, this.audio.ctx.currentTime - audioStart)
      : (() => { const w = performance.now(); return () => this.startTime + (performance.now() - w) / 1000; })();
    this.emitState();
    const tick = async () => {
      if (!this.playing) return;
      let t = this.clock();
      const end = this.store.duration;
      if (t >= end) {
        if (this.loop) { this.pause(); this.store.setTime(0); this.play(); return; }
        this.pause(); this.store.setTime(end); return;
      }
      this.store.time = t;
      this.driveVideos(t);
      await this.renderNow();
      this.listeners.forEach((fn) => fn(t));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  driveVideos(t) {
    const p = this.store.project;
    for (const tr of p.tracks) for (const c of tr.clips) {
      if (c.type !== 'video') continue;
      const m = this.media.get(c.mediaId);
      if (!m) continue;
      const v = this.videoEl(c, m);
      const active = !tr.hidden && t >= c.start - 0.3 && t < clipEnd(c);
      if (!active) { if (!v.paused) v.pause(); continue; }
      const srcT = (c.in || 0) + Math.max(0, t - c.start) * (c.speed || 1);
      v.playbackRate = Math.min(16, Math.max(0.0625, c.speed || 1));
      if (t < c.start) { if (Math.abs(v.currentTime - c.in) > 0.05) v.currentTime = c.in; continue; }
      if (Math.abs(v.currentTime - srcT) > 0.25) v.currentTime = srcT;
      if (v.paused && srcT < (m.duration || Infinity)) v.play().catch(() => {});
    }
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.audio.stop();
    for (const v of this.videos.values()) v.pause();
    this.emitState();
    this.store.setTime(this.store.time);
    this.requestRender();
  }

  toggle() { if (this.playing) this.pause(); else this.play(); }

  emitState() { this.store.emit('playstate', this.playing); }

  // Image fixe au temps t sur un canvas quelconque (miniatures, modèles).
  async snapshot(canvas, project, t) {
    await this.renderer.render(canvas, project, t, this.env);
  }
}
