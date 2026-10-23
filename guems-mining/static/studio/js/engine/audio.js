// Moteur audio (Web Audio API) : lecture synchronisée et mixage hors ligne pour l'export.

import { clipEnd } from '../model.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map(); // mediaId → Promise<AudioBuffer|null>
    this.playing = [];
    this.master = null;
  }

  context() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  setMasterVolume(v) { if (this.master) this.master.gain.value = v; }

  // Décode la piste son d'un fichier (audio ou vidéo). null si aucune piste son.
  decode(mediaId, blob) {
    if (!this.buffers.has(mediaId)) {
      this.buffers.set(mediaId, (async () => {
        if (!blob) return null;
        const data = await blob.arrayBuffer();
        // Un OfflineAudioContext décode sans geste de l'utilisateur.
        const off = new OfflineAudioContext(2, 1, 48000);
        try { return await off.decodeAudioData(data); } catch { return null; }
      })());
    }
    return this.buffers.get(mediaId);
  }

  // Clips qui produisent du son.
  audibleClips(project) {
    const out = [];
    for (const tr of project.tracks) {
      if (tr.muted || tr.hidden) continue;
      for (const c of tr.clips) {
        if ((c.type === 'audio' || c.type === 'video') && c.mediaId && (c.volume ?? 1) > 0) out.push(c);
      }
    }
    return out;
  }

  async prepare(project, media) {
    await Promise.all(this.audibleClips(project).map((c) => this.decode(c.mediaId, media.blob(c.mediaId))));
  }

  // Programme la lecture de tous les clips audibles à partir de `from` (temps projet).
  async schedule(ctx, destination, project, from, when, media) {
    const nodes = [];
    for (const c of this.audibleClips(project)) {
      if (clipEnd(c) <= from) continue;
      const buf = await this.decode(c.mediaId, media.blob(c.mediaId));
      if (!buf) continue;
      const speed = c.speed || 1;
      const into = Math.max(0, from - c.start);
      const startAt = when + Math.max(0, c.start - from);
      const offset = (c.in || 0) + into * speed;
      const remaining = c.duration - into;
      if (offset >= buf.duration || remaining <= 0) continue;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = speed;
      const gain = ctx.createGain();
      const vol = c.volume ?? 1;
      // Fondus d'entrée et de sortie.
      const fi = c.fadeIn || 0; const fo = c.fadeOut || 0;
      const g = gain.gain;
      const at = (localT) => startAt + (localT - into);
      const level = (localT) => {
        let v = vol;
        if (fi > 0 && localT < fi) v *= localT / fi;
        if (fo > 0 && localT > c.duration - fo) v *= Math.max(0, (c.duration - localT) / fo);
        return v;
      };
      g.setValueAtTime(level(into), startAt);
      if (fi > 0 && into < fi) g.linearRampToValueAtTime(vol, at(fi));
      if (fo > 0) { g.setValueAtTime(level(Math.max(into, c.duration - fo)), at(Math.max(into, c.duration - fo))); g.linearRampToValueAtTime(0, at(c.duration)); }
      src.connect(gain).connect(destination);
      src.start(startAt, offset, Math.min(remaining * speed, buf.duration - offset));
      nodes.push(src);
    }
    return nodes;
  }

  async play(project, from, media) {
    const ctx = this.context();
    if (ctx.state === 'suspended') await ctx.resume();
    this.stop();
    const when = ctx.currentTime + 0.08;
    this.playing = await this.schedule(ctx, this.master, project, from, when, media);
    return when;
  }

  stop() {
    for (const n of this.playing) { try { n.stop(); } catch { /* déjà arrêté */ } }
    this.playing = [];
  }

  // Mixage complet du projet (pour l'export). Renvoie null s'il n'y a aucun son.
  async mixdown(project, duration, media, sampleRate = 48000) {
    if (!this.audibleClips(project).length) return null;
    await this.prepare(project, media);
    const length = Math.max(1, Math.ceil(duration * sampleRate));
    const off = new OfflineAudioContext(2, length, sampleRate);
    const nodes = await this.schedule(off, off.destination, project, 0, 0, media);
    if (!nodes.length) return null;
    return off.startRendering();
  }
}
