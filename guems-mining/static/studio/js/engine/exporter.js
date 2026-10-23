// Exportation vidéo.
//  1. Moteur principal : WebCodecs + Mediabunny — rendu image par image (précis à l'image près),
//     décodage exact des vidéos sources, encodage MP4 (H.264/AVC…) ou WebM (VP9/VP8/AV1) selon le navigateur.
//  2. Repli : MediaRecorder (WebM) en temps réel, si WebCodecs est indisponible.
// Le fichier produit est réellement encodé dans le navigateur ; aucun serveur n'est utilisé.

import {
  Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, AudioBufferSource,
  Input, BlobSource, ALL_FORMATS, CanvasSink, getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
  QUALITY_LOW, QUALITY_MEDIUM, QUALITY_HIGH, QUALITY_VERY_HIGH,
} from '../../vendor/mediabunny.min.mjs';
import { Renderer } from './renderer.js';
import { projectDuration } from '../model.js';

export const RESOLUTIONS = { '480p': 480, '720p': 720, '1080p': 1080, '1440p': 1440, '2160p': 2160 };
const QUALITIES = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH, 'very-high': QUALITY_VERY_HIGH };

export const webCodecsSupported = () => typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';

// Dimensions de sortie : la résolution choisie s'applique au petit côté ; dimensions paires.
export function outputSize(project, resolution) {
  const short = RESOLUTIONS[resolution] || 1080;
  const ar = project.width / project.height;
  let w; let h;
  if (ar >= 1) { h = short; w = Math.round(short * ar); } else { w = short; h = Math.round(short / ar); }
  return { width: w - (w % 2), height: h - (h % 2) };
}

// Codecs réellement encodables par ce navigateur pour un format donné.
export async function probeFormats(project, resolution = '1080p') {
  const { width, height } = outputSize(project, resolution);
  const res = {};
  if (!webCodecsSupported()) return { webcodecs: false, mediaRecorder: typeof MediaRecorder === 'function' };
  for (const [key, Fmt] of [['mp4', Mp4OutputFormat], ['webm', WebMOutputFormat]]) {
    const fmt = new Fmt();
    const video = await getFirstEncodableVideoCodec(fmt.getSupportedVideoCodecs(), { width, height }).catch(() => null);
    const audio = await getFirstEncodableAudioCodec(fmt.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: 48000 }).catch(() => null);
    res[key] = { video, audio };
  }
  return { webcodecs: true, ...res, mediaRecorder: typeof MediaRecorder === 'function' };
}

class ExportFrameSource {
  constructor(media) { this.media = media; this.sinks = new Map(); this.inputs = []; }
  async image(m) {
    const img = await this.media.image(m.id);
    return { image: img, width: img.naturalWidth || m.width, height: img.naturalHeight || m.height };
  }
  async sink(mediaId) {
    if (!this.sinks.has(mediaId)) {
      this.sinks.set(mediaId, (async () => {
        const input = new Input({ source: new BlobSource(this.media.blob(mediaId)), formats: ALL_FORMATS });
        this.inputs.push(input);
        const track = await input.getPrimaryVideoTrack();
        if (!track) return null;
        if (!(await track.canDecode())) throw new Error(`La vidéo « ${this.media.get(mediaId)?.name} » ne peut pas être décodée par ce navigateur.`);
        return new CanvasSink(track, { poolSize: 2 });
      })());
    }
    return this.sinks.get(mediaId);
  }
  async video(clip, m, srcT) {
    const sink = await this.sink(m.id);
    if (!sink) return null;
    const wrapped = await sink.getCanvas(srcT);
    if (!wrapped) return null;
    return { image: wrapped.canvas, width: wrapped.canvas.width, height: wrapped.canvas.height };
  }
  dispose() { for (const i of this.inputs) { try { i.dispose?.(); } catch { /* */ } } }
}

/**
 * @param {object} o
 * @param {object} o.project
 * @param {import('../media.js').MediaManager} o.media
 * @param {import('./audio.js').AudioEngine} o.audio
 * @param {'mp4'|'webm'} o.format
 * @param {string} o.resolution
 * @param {number} o.fps
 * @param {'low'|'medium'|'high'|'very-high'} o.quality
 * @param {(p:{phase:string, progress:number, frame?:number, frames?:number})=>void} o.onProgress
 * @param {AbortSignal} o.signal
 */
export async function exportVideo({ project, media, audio, format = 'mp4', resolution = '1080p', fps, quality = 'high', range = null, onProgress = () => {}, signal }) {
  fps = fps || project.fps;
  const { width, height } = outputSize(project, resolution);
  const start = range?.start || 0;
  const end = Math.min(range?.end ?? projectDuration(project), projectDuration(project));
  const duration = Math.max(1 / fps, end - start);
  const frames = Math.round(duration * fps);

  if (!webCodecsSupported()) throw new Error('WebCodecs indisponible dans ce navigateur : utilisez l\'export en temps réel (WebM).');
  const fmt = format === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' });
  const videoCodec = await getFirstEncodableVideoCodec(fmt.getSupportedVideoCodecs(), { width, height, quality: QUALITIES[quality] });
  if (!videoCodec) throw new Error(`Ce navigateur ne sait pas encoder de vidéo ${format.toUpperCase()} en ${width}×${height}. Essayez une autre résolution ou l'autre format.`);

  onProgress({ phase: 'Préparation (polices, médias, mixage audio)…', progress: 0 });
  const renderer = new Renderer();
  await renderer.loadFonts(project);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;

  // Audio : mixage hors ligne de toute la piste son.
  let mix = null;
  let audioCodec = null;
  const full = await audio.mixdown(project, end, media).catch((e) => { console.warn(e); return null; });
  if (full) {
    audioCodec = await getFirstEncodableAudioCodec(fmt.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: full.sampleRate, quality: QUALITIES[quality] });
    if (audioCodec) mix = sliceBuffer(full, start, end);
  }
  if (signal?.aborted) throw abortError();

  const target = new BufferTarget();
  const output = new Output({ format: fmt, target });
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, quality: QUALITIES[quality], keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });
  let audioSource = null;
  if (mix && audioCodec) { audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITIES[quality] }); output.addAudioTrack(audioSource); }
  await output.start();

  const frameSource = new ExportFrameSource(media);
  const env = { media: { get: (id) => media.get(id) }, frames: frameSource };
  const t0 = performance.now();
  try {
    if (audioSource) await audioSource.add(mix);
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw abortError();
      const t = start + i / fps;
      await renderer.render(canvas, project, t, env);
      await videoSource.add(i / fps, 1 / fps);
      if (i % 3 === 0 || i === frames - 1) {
        const elapsed = (performance.now() - t0) / 1000;
        const eta = i > 5 ? (elapsed / (i + 1)) * (frames - i - 1) : null;
        onProgress({ phase: `Rendu et encodage de l'image ${i + 1} / ${frames}`, progress: (i + 1) / frames, frame: i + 1, frames, eta });
      }
    }
    onProgress({ phase: 'Finalisation du fichier…', progress: 1 });
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    frameSource.dispose();
  }
  const mime = await output.getMimeType().catch(() => fmt.mimeType);
  const blob = new Blob([target.buffer], { type: fmt.mimeType });
  return { blob, mime, width, height, fps, frames, duration, videoCodec, audioCodec: audioSource ? audioCodec : null, extension: fmt.fileExtension, seconds: (performance.now() - t0) / 1000 };
}

function sliceBuffer(buf, start, end) {
  if (start <= 0 && Math.abs(end - buf.duration) < 1 / buf.sampleRate) return buf;
  const s = Math.floor(start * buf.sampleRate); const e = Math.min(buf.length, Math.ceil(end * buf.sampleRate));
  const out = new AudioBuffer({ length: Math.max(1, e - s), numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(s, e), c);
  return out;
}

const abortError = () => Object.assign(new Error('Export annulé.'), { name: 'AbortError' });

// Repli temps réel : capture du canvas pendant la lecture du projet (WebM via MediaRecorder).
export async function exportRealtime({ project, media, audio, resolution = '720p', fps, onProgress = () => {}, signal }) {
  if (typeof MediaRecorder !== 'function') throw new Error('Aucun moteur d\'export disponible dans ce navigateur.');
  fps = fps || project.fps;
  const { width, height } = outputSize(project, resolution);
  const renderer = new Renderer();
  await renderer.loadFonts(project);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const stream = canvas.captureStream(fps);
  const ctx = audio.context();
  if (ctx.state === 'suspended') await ctx.resume();
  const dest = ctx.createMediaStreamDestination();
  dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((res) => { rec.onstop = res; });
  // Les vidéos sources sont lues par des éléments <video> synchronisés.
  const videos = new Map();
  const env = {
    media: { get: (id) => media.get(id) },
    frames: {
      image: async (m) => { const img = await media.image(m.id); return { image: img, width: img.naturalWidth, height: img.naturalHeight }; },
      video: async (clip, m, srcT) => {
        let v = videos.get(clip.id);
        if (!v) { v = document.createElement('video'); v.muted = true; v.src = media.url(m.id); v.preload = 'auto'; videos.set(clip.id, v); await new Promise((r) => { v.onloadeddata = r; }); }
        if (Math.abs(v.currentTime - srcT) > 0.2) v.currentTime = srcT;
        if (v.paused) v.play().catch(() => {});
        return v.readyState >= 2 ? { image: v, width: v.videoWidth, height: v.videoHeight } : null;
      },
    },
  };
  const duration = projectDuration(project);
  const when = ctx.currentTime + 0.15;
  const nodes = await audio.schedule(ctx, dest, project, 0, when, media);
  rec.start(250);
  await new Promise((resolve, reject) => {
    const loop = async () => {
      if (signal?.aborted) { nodes.forEach((n) => { try { n.stop(); } catch { /* */ } }); reject(abortError()); return; }
      const t = Math.max(0, ctx.currentTime - when);
      if (t >= duration) { resolve(); return; }
      await renderer.render(canvas, project, t, env);
      onProgress({ phase: `Enregistrement en temps réel ${t.toFixed(1)} s / ${duration.toFixed(1)} s`, progress: t / duration });
      requestAnimationFrame(loop);
    };
    loop();
  }).finally(() => { rec.stop(); videos.forEach((v) => v.pause()); });
  await done;
  return { blob: new Blob(chunks, { type: 'video/webm' }), mime, width, height, fps, duration, extension: '.webm', videoCodec: mime, audioCodec: null };
}
