// Fenêtre d'exportation : choix du format, rendu réel, progression, aperçu et téléchargement.

import { el, formatBytes, downloadBlob } from '../util.js';
import { openDialog, button, field, select, toast } from './common.js';
import { exportVideo, exportRealtime, probeFormats, outputSize, RESOLUTIONS, webCodecsSupported } from '../engine/exporter.js';
import { FPS_OPTIONS, projectDuration } from '../model.js';

const CODEC_LABELS = { avc: 'H.264 (AVC)', hevc: 'H.265 (HEVC)', vp9: 'VP9', vp8: 'VP8', av1: 'AV1', aac: 'AAC', opus: 'Opus', mp3: 'MP3', vorbis: 'Vorbis', flac: 'FLAC' };

export function openExport({ store, media, audio, player }) {
  const p = store.project;
  player.pause();
  const state = { format: 'mp4', resolution: p.height >= 1080 || p.width >= 1080 ? '1080p' : '720p', fps: p.fps, quality: 'high' };
  const info = el('div', { class: 'note', text: 'Analyse des capacités d\'encodage de ce navigateur…' });
  const formatBox = el('div', { class: 'option-cards' });
  const preview = el('canvas', { style: { width: '100%', maxHeight: '220px', objectFit: 'contain', background: '#000', borderRadius: '8px' } });
  const sizeText = el('span', { class: 'small muted' });
  const progressBar = el('div');
  const progressWrap = el('div', { class: 'stack', hidden: true }, [el('div', { class: 'progress' }, [progressBar]), el('p', { class: 'small', style: { margin: 0 } })]);
  const resultBox = el('div', { class: 'stack' });
  let caps = null;
  let controller = null;
  let busy = false;

  const updateSize = () => { const s = outputSize(p, state.resolution); sizeText.textContent = `Sortie : ${s.width} × ${s.height} px · ${state.fps} i/s · ${projectDuration(p).toFixed(2)} s`; };
  const resSelect = select(Object.fromEntries(Object.keys(RESOLUTIONS).map((r) => [r, r === '2160p' ? '2160p (4K)' : r])), state.resolution, (v) => { state.resolution = v; updateSize(); refreshCaps(); });
  const fpsSelect = select(Object.fromEntries(FPS_OPTIONS.map((f) => [f, `${f} i/s`])), state.fps, (v) => { state.fps = Number(v); updateSize(); });
  const qSelect = select({ low: 'Légère (petit fichier)', medium: 'Standard', high: 'Haute', 'very-high': 'Très haute (gros fichier)' }, state.quality, (v) => { state.quality = v; });
  const startBtn = button('Lancer l\'exportation', { icon: 'download', cls: 'primary', onclick: () => start() });
  const cancelBtn = button('Annuler l\'exportation', { cls: 'danger', onclick: () => controller?.abort() });
  cancelBtn.hidden = true;

  const body = el('div', { class: 'stack' }, [
    el('div', { class: 'grid-2' }, [
      el('div', { class: 'stack' }, [
        el('span', { class: 'label', text: 'Format du fichier' }), formatBox,
        el('div', { class: 'grid-3' }, [field('Résolution', resSelect), field('Images/s', fpsSelect), field('Qualité', qSelect)]),
        sizeText, info,
      ]),
      el('div', { class: 'stack' }, [el('span', { class: 'label', text: 'Prévisualisation (image à la tête de lecture)' }), preview,
        el('p', { class: 'small muted', style: { margin: 0 }, text: 'Lisez le projet dans l\'éditeur pour le prévisualiser en mouvement avant l\'export.' })]),
    ]),
    el('div', { class: 'row' }, [startBtn, cancelBtn]),
    progressWrap,
    resultBox,
  ]);
  const dlg = openDialog({ title: 'Exporter la vidéo', wide: true, content: body, onClose: () => controller?.abort() });

  // Image de prévisualisation.
  const s0 = outputSize(p, '720p');
  preview.width = s0.width; preview.height = s0.height;
  player.snapshot(preview, p, store.time).catch(() => {});
  updateSize();

  function drawFormats() {
    const opts = [
      ['mp4', 'MP4', caps?.mp4],
      ['webm', 'WebM', caps?.webm],
    ];
    formatBox.replaceChildren(...opts.map(([id, label, c]) => {
      const ok = Boolean(c?.video);
      const input = el('input', { type: 'radio', name: 'fmt', value: id, checked: state.format === id, disabled: !ok, onchange: () => { state.format = id; } });
      return el('label', { class: 'option-card', style: { opacity: ok ? 1 : 0.45 } }, [input, el('b', { text: label }),
        el('span', { text: ok ? `${CODEC_LABELS[c.video] || c.video}${c.audio ? ` + ${CODEC_LABELS[c.audio] || c.audio}` : ' (sans son)'}` : 'Non disponible dans ce navigateur' })]);
    }));
  }

  async function refreshCaps() {
    if (!webCodecsSupported()) {
      caps = null;
      info.className = 'note warn';
      info.textContent = 'WebCodecs n\'est pas disponible : export en temps réel (WebM) uniquement. Utilisez un navigateur récent (Chrome, Edge, Safari 17+, Firefox 130+) pour l\'export image par image.';
      formatBox.replaceChildren(el('p', { class: 'small', text: 'WebM (temps réel, MediaRecorder)' }));
      return;
    }
    caps = await probeFormats(p, state.resolution);
    if (!caps.mp4?.video && caps.webm?.video) state.format = 'webm';
    drawFormats();
    const c = caps[state.format];
    if (!caps.mp4?.video && !caps.webm?.video) { info.className = 'note err'; info.textContent = `Aucun encodeur vidéo disponible en ${state.resolution}. Essayez une résolution inférieure.`; startBtn.disabled = true; return; }
    startBtn.disabled = false;
    info.className = 'note ok';
    info.textContent = `Rendu image par image dans le navigateur avec WebCodecs. ${c?.audio ? '' : 'Ce navigateur ne peut pas encoder l\'audio dans ce format : la vidéo sera muette.'} ${state.resolution === '2160p' ? 'La 4K demande beaucoup de mémoire et de temps.' : ''}`;
  }
  refreshCaps().catch((e) => { info.className = 'note err'; info.textContent = e.message; });

  async function start() {
    if (busy) return;
    busy = true;
    controller = new AbortController();
    startBtn.disabled = true; cancelBtn.hidden = false; progressWrap.hidden = false; resultBox.replaceChildren();
    const label = progressWrap.querySelector('p');
    const onProgress = ({ phase, progress, eta }) => {
      progressBar.style.width = `${Math.round(progress * 100)}%`;
      label.textContent = `${phase}${eta ? ` — environ ${Math.ceil(eta)} s restantes` : ''}`;
    };
    try {
      const opts = { project: JSON.parse(JSON.stringify(p)), media, audio, format: state.format, resolution: state.resolution, fps: state.fps, quality: state.quality, onProgress, signal: controller.signal };
      const res = webCodecsSupported() ? await exportVideo(opts) : await exportRealtime(opts);
      const url = URL.createObjectURL(res.blob);
      const fileName = `${(p.name || 'video').replace(/[^\p{L}\p{N} _-]+/gu, '').trim().replace(/\s+/g, '-') || 'video'}-${state.resolution}${res.extension}`;
      resultBox.replaceChildren(
        el('p', { class: 'note ok', text: `Export terminé : ${res.width}×${res.height}, ${res.fps} i/s, ${res.duration.toFixed(2)} s, ${formatBytes(res.blob.size)} · vidéo ${CODEC_LABELS[res.videoCodec] || res.videoCodec}${res.audioCodec ? ` · audio ${CODEC_LABELS[res.audioCodec] || res.audioCodec}` : ' · sans piste audio'}${res.seconds ? ` · rendu en ${res.seconds.toFixed(1)} s` : ''}.` }),
        el('video', { class: 'result', src: url, controls: true, playsinline: true }),
        el('div', { class: 'row' }, [button('Télécharger la vidéo', { icon: 'download', cls: 'primary', onclick: () => downloadBlob(res.blob, fileName) }), el('span', { class: 'small muted', text: fileName })]),
      );
      toast('Vidéo exportée.', 'success');
    } catch (e) {
      if (e.name === 'AbortError') { toast('Export annulé.'); resultBox.replaceChildren(el('p', { class: 'note', text: 'Export annulé.' })); }
      else { console.error(e); resultBox.replaceChildren(el('p', { class: 'note err', text: `Échec de l'export : ${e.message}` })); }
    } finally {
      busy = false; startBtn.disabled = false; cancelBtn.hidden = true;
    }
  }
  return dlg;
}
