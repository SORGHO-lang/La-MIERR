// Timeline multipiste : déplacement, rognage, magnétisme, découpe, pistes, images clés.

import { el, clamp, formatTime, deepClone, uid } from '../util.js';
import { icon, button, toast, confirmDialog } from './common.js';
import { createClip, createTrack, clipEnd, fitsOnTrack, firstFreeSlot, trackAccepts, isVisual } from '../model.js';
import { shiftKeyframes } from '../engine/easing.js';

const ROW = { video: 54, text: 44, audio: 50, fx: 36 };
const KIND_COLOR = { video: 'var(--c-video)', text: 'var(--c-text)', audio: 'var(--c-audio)', fx: 'var(--c-fx)' };
const SNAP_PX = 8;
export const MEDIA_MIME = 'application/x-gm-media';

export class Timeline {
  constructor({ store, media, player }) {
    this.store = store;
    this.media = media;
    this.player = player;
    this.pps = 60; // pixels par seconde
    this.snap = true;
    this.root = el('div', { class: 'timeline' });
    this.build();
    store.on('change', () => this.render());
    store.on('select', () => this.render());
    store.on('time', () => this.placePlayhead());
    player.onTick(() => this.placePlayhead(true));
    store.on('load', () => { this.fitZoom(); this.render(); });
  }

  build() {
    const s = this.store;
    this.zoom = el('input', { type: 'range', class: 'zoom', min: 5, max: 400, step: 1, value: this.pps, 'aria-label': 'Zoom de la timeline', oninput: (e) => this.setZoom(Number(e.target.value)) });
    this.snapBtn = button('Magnétisme', { icon: 'magnet', iconOnly: true, cls: 'sm', pressed: true, onclick: () => { this.snap = !this.snap; this.snapBtn.setAttribute('aria-pressed', String(this.snap)); } });
    const toolbar = el('div', { class: 'tl-toolbar' }, [
      button('Couper à la tête de lecture (S)', { icon: 'split', iconOnly: true, cls: 'sm', onclick: () => this.splitSelected() }),
      button('Dupliquer (Ctrl+D)', { icon: 'copy', iconOnly: true, cls: 'sm', onclick: () => this.duplicateSelected() }),
      button('Supprimer (Suppr)', { icon: 'trash', iconOnly: true, cls: 'sm danger', onclick: () => this.deleteSelected() }),
      this.snapBtn,
      el('span', { class: 'sep', style: { width: '1px', height: '20px', background: 'var(--line)' } }),
      button('Piste vidéo', { icon: 'plus', cls: 'sm', onclick: () => this.addTrack('video') }),
      button('Piste texte', { icon: 'plus', cls: 'sm', onclick: () => this.addTrack('text') }),
      button('Piste audio', { icon: 'plus', cls: 'sm', onclick: () => this.addTrack('audio') }),
      button('Piste effets', { icon: 'plus', cls: 'sm', onclick: () => this.addTrack('fx') }),
      el('span', { class: 'grow' }),
      button('Ajuster', { icon: 'zoomOut', cls: 'sm', title: 'Afficher tout le projet', onclick: () => { this.fitZoom(); this.render(); } }),
      this.zoom,
    ]);
    this.heads = el('div', { class: 'tl-heads-inner' });
    this.headsWrap = el('div', { class: 'tl-heads' }, [this.heads]);
    this.content = el('div', { class: 'tl-content' });
    this.rulerCanvas = el('canvas');
    this.ruler = el('div', { class: 'tl-ruler', title: 'Cliquer ou glisser pour déplacer la tête de lecture' }, [this.rulerCanvas]);
    this.tracksEl = el('div');
    this.playhead = el('div', { class: 'playhead' });
    this.snapLine = el('div', { class: 'snap-line', hidden: true });
    this.content.append(this.ruler, this.tracksEl, this.playhead, this.snapLine);
    this.scroller = el('div', { class: 'tl-scroll' }, [this.content]);
    this.scroller.addEventListener('scroll', () => { this.headsWrap.scrollTop = this.scroller.scrollTop; this.drawRuler(); });
    this.scroller.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.setZoom(this.pps * (e.deltaY < 0 ? 1.15 : 0.87), e.clientX); }
    }, { passive: false });
    this.root.append(toolbar, el('div', { class: 'tl-main' }, [this.headsWrap, this.scroller]));

    // Tête de lecture : clic et glisser sur la règle.
    this.ruler.addEventListener('pointerdown', (e) => {
      this.ruler.setPointerCapture(e.pointerId);
      const move = (ev) => this.store.setTime(this.timeAt(ev.clientX));
      move(e);
      if (this.player.playing) this.player.pause();
      const up = () => { this.ruler.removeEventListener('pointermove', move); this.ruler.removeEventListener('pointerup', up); };
      this.ruler.addEventListener('pointermove', move);
      this.ruler.addEventListener('pointerup', up);
    });
    new ResizeObserver(() => { this.drawRuler(); this.layoutWidth(); }).observe(this.scroller);
  }

  timeAt(clientX) {
    const r = this.content.getBoundingClientRect();
    return Math.max(0, (clientX - r.left) / this.pps);
  }

  setZoom(pps, anchorX) {
    const old = this.pps;
    this.pps = clamp(pps, 5, 400);
    this.zoom.value = String(Math.round(this.pps));
    if (anchorX !== undefined) {
      const r = this.scroller.getBoundingClientRect();
      const t = (this.scroller.scrollLeft + anchorX - r.left) / old;
      this.render();
      this.scroller.scrollLeft = t * this.pps - (anchorX - r.left);
    } else this.render();
  }

  fitZoom() {
    const w = Math.max(200, (this.scroller.clientWidth || 800) - 40);
    this.pps = clamp(w / Math.max(5, this.store.duration + 1), 5, 400);
    this.zoom.value = String(Math.round(this.pps));
  }

  layoutWidth() {
    const total = Math.max(this.store.duration + 20, (this.scroller.clientWidth || 800) / this.pps);
    this.content.style.width = `${Math.ceil(total * this.pps)}px`;
    this.content.style.setProperty('--pps', this.pps);
  }

  drawRuler() {
    const c = this.rulerCanvas;
    const w = this.scroller.clientWidth; const h = 28;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr; c.height = h * dpr; c.style.width = `${w}px`; c.style.height = `${h}px`;
    c.style.left = `${this.scroller.scrollLeft}px`;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const major = steps.find((s) => s * this.pps >= 70) || 300;
    const minor = major / (major >= 1 ? 5 : 2);
    const t0 = this.scroller.scrollLeft / this.pps;
    const t1 = t0 + w / this.pps;
    ctx.fillStyle = '#9C9CA8'; ctx.strokeStyle = '#3A3A43';
    ctx.font = '10px ui-monospace, Menlo, monospace';
    const per = Math.round(major / minor);
    // Indices entiers : pas de dérive des nombres flottants sur les graduations.
    for (let k = Math.floor(t0 / minor); k * minor <= t1; k++) {
      const t = k * minor;
      const x = Math.round((t - t0) * this.pps) + 0.5;
      const isMajor = k % per === 0;
      ctx.beginPath(); ctx.moveTo(x, isMajor ? 12 : 20); ctx.lineTo(x, h); ctx.stroke();
      if (isMajor) {
        const m = Math.floor(t / 60); const sec = t - m * 60;
        const label = major >= 1 ? `${m}:${String(Math.round(sec)).padStart(2, '0')}` : `${m}:${sec.toFixed(major >= 0.5 ? 1 : 2).padStart(major >= 0.5 ? 4 : 5, '0')}`;
        ctx.fillText(label, x + 3, 11);
      }
    }
  }

  placePlayhead(follow = false) {
    const x = this.store.time * this.pps;
    this.playhead.style.transform = `translateX(${x}px)`;
    if (follow) {
      const sl = this.scroller.scrollLeft; const w = this.scroller.clientWidth;
      if (x > sl + w - 40 || x < sl) this.scroller.scrollLeft = Math.max(0, x - 60);
    }
  }

  render() {
    const p = this.store.project;
    if (!p) return;
    // Pendant un glisser-déposer, on ne reconstruit pas le DOM (l'élément saisi doit rester en place).
    if (this.gestureActive) { this.renderPending = true; return; }
    this.layoutWidth();
    this.heads.replaceChildren();
    this.tracksEl.replaceChildren();
    p.tracks.forEach((tr) => {
      const h = ROW[tr.kind] || 50;
      this.heads.append(this.renderHead(tr, h));
      const row = el('div', { class: `tl-track ${tr.locked ? 'locked' : ''}`, style: { '--row-h': `${h}px` }, dataset: { track: tr.id } });
      row.addEventListener('pointerdown', (e) => { if (e.target === row) { this.store.select(null); this.store.setTime(this.timeAt(e.clientX)); } });
      this.bindDrop(row, tr);
      for (const c of tr.clips) row.append(this.renderClip(tr, c));
      this.tracksEl.append(row);
    });
    this.drawRuler();
    this.placePlayhead();
  }

  renderHead(tr, h) {
    const p = this.store.project;
    const visual = tr.kind !== 'audio';
    const name = el('span', { class: 'name', text: tr.name, title: `${tr.name} — double-cliquer pour renommer` });
    name.addEventListener('dblclick', () => {
      const input = el('input', { type: 'text', value: tr.name, style: { height: '24px' } });
      name.replaceWith(input); input.focus(); input.select();
      const done = () => { const v = input.value.trim().slice(0, 40); if (v && v !== tr.name) this.store.mutate('Renommer la piste', () => { tr.name = v; }); else this.render(); };
      input.addEventListener('blur', done); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = tr.name; input.blur(); } });
    });
    const idx = p.tracks.indexOf(tr);
    return el('div', { class: 'tl-head', style: { '--row-h': `${h}px` } }, [
      el('span', { class: 'kind', style: { background: KIND_COLOR[tr.kind] } }),
      name,
      visual
        ? button(tr.hidden ? 'Afficher la piste' : 'Masquer la piste', { icon: tr.hidden ? 'eyeOff' : 'eye', iconOnly: true, cls: 'sm ghost', onclick: () => this.store.mutate('Visibilité de la piste', () => { tr.hidden = !tr.hidden; }) })
        : button(tr.muted ? 'Réactiver le son' : 'Couper le son', { icon: tr.muted ? 'mute' : 'volume', iconOnly: true, cls: 'sm ghost', onclick: () => this.store.mutate('Son de la piste', () => { tr.muted = !tr.muted; }) }),
      button(tr.locked ? 'Déverrouiller' : 'Verrouiller', { icon: tr.locked ? 'lock' : 'unlock', iconOnly: true, cls: 'sm ghost', onclick: () => this.store.mutate('Verrouillage de la piste', () => { tr.locked = !tr.locked; }) }),
      el('span', { class: 'hide-mobile', style: { display: 'flex' } }, [
        button('Monter la piste', { icon: 'prev', iconOnly: true, cls: 'sm ghost', disabled: idx === 0, onclick: () => this.moveTrack(tr, -1) }),
        button('Supprimer la piste', { icon: 'trash', iconOnly: true, cls: 'sm ghost', onclick: () => this.removeTrack(tr) }),
      ]),
    ]);
  }

  renderClip(tr, c) {
    const sel = this.store.selection === c.id;
    const m = c.mediaId ? this.media.get(c.mediaId) : null;
    const label = c.name || (c.type === 'text' ? c.text.content.split('\n')[0] : c.type === 'fx' ? (c.fx?.type || 'Effet') : c.type === 'shape' ? 'Forme' : m?.name || 'Média');
    const node = el('div', {
      class: `clip ${c.type} ${sel ? 'selected' : ''}`,
      style: { left: `${c.start * this.pps}px`, width: `${Math.max(4, c.duration * this.pps)}px` },
      title: `${label} — ${c.duration.toFixed(2)} s`, tabindex: 0, role: 'button', 'aria-pressed': String(sel), dataset: { clip: c.id },
    });
    if (c.type === 'video' && m?.strip?.length) {
      const strip = el('div', { class: 'clip-strip' });
      const h = (ROW[tr.kind] || 50) - 8;
      const tw = h * (m.width / m.height || 16 / 9);
      const n = Math.min(40, Math.ceil((c.duration * this.pps) / tw));
      for (let i = 0; i < n; i++) {
        const srcT = c.in + ((i + 0.5) * tw / this.pps) * (c.speed || 1);
        const k = clamp(Math.floor((srcT / (m.duration || 1)) * m.strip.length), 0, m.strip.length - 1);
        strip.append(el('img', { src: m.strip[k], alt: '', style: { width: `${tw}px` } }));
      }
      node.append(strip);
    } else if (c.type === 'image' && m?.thumb) {
      node.append(el('div', { class: 'clip-strip', style: { background: `url(${m.thumb}) left center / auto 100% repeat-x` } }));
    }
    if ((c.type === 'audio' || c.type === 'video') && m?.waveform?.length) node.append(this.waveform(c, m));
    node.append(el('div', { class: 'clip-label', text: `${c.speed && c.speed !== 1 ? `${c.speed}× · ` : ''}${label}` }));
    const tin = c.transitionIn?.duration; const tout = c.transitionOut?.duration;
    if (tin) node.append(el('div', { class: 'tr-mark', style: { left: '0', width: `${tin * this.pps}px` } }));
    if (tout) node.append(el('div', { class: 'tr-mark out', style: { right: '0', width: `${tout * this.pps}px` } }));
    if (sel) {
      const times = new Set();
      for (const list of Object.values(c.keyframes || {})) for (const k of list) times.add(Math.round(k.t * 1000) / 1000);
      for (const t of times) node.append(el('span', { class: 'kf', style: { left: `${t * this.pps}px` }, title: `Image clé à ${t.toFixed(2)} s` }));
    }
    node.append(el('div', { class: 'handle l', dataset: { edge: 'l' } }), el('div', { class: 'handle r', dataset: { edge: 'r' } }));
    node.addEventListener('pointerdown', (e) => this.onClipPointer(e, tr, c, node));
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.store.select(c.id); });
    return node;
  }

  waveform(c, m) {
    const cv = el('canvas', { class: 'wave' });
    const w = Math.max(4, Math.min(4000, Math.round(c.duration * this.pps)));
    cv.width = w; cv.height = 40;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const wf = m.waveform; const dur = m.duration || 1;
    for (let x = 0; x < w; x += 2) {
      const srcT = c.in + (x / this.pps) * (c.speed || 1);
      const v = wf[clamp(Math.floor((srcT / dur) * wf.length), 0, wf.length - 1)] || 0;
      const h = Math.max(1, v * 38 * (c.volume ?? 1));
      ctx.fillRect(x, 40 - h, 1.5, h);
    }
    return cv;
  }

  // ---------------------------------------------------------------- glisser / rogner
  onClipPointer(e, tr, c, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    this.gestureActive = true;
    node.setPointerCapture(e.pointerId);
    this.tracksEl.querySelectorAll('.clip.selected').forEach((n) => n.classList.remove('selected'));
    node.classList.add('selected');
    this.store.select(c.id);
    const finish = () => { this.gestureActive = false; if (this.renderPending) { this.renderPending = false; this.render(); } };
    if (tr.locked) { node.addEventListener('pointerup', finish, { once: true }); return; }
    const edge = e.target.dataset.edge;
    const startX = e.clientX; const startY = e.clientY;
    const orig = { start: c.start, duration: c.duration, in: c.in || 0 };
    const p = this.store.project;
    const m = c.mediaId ? this.media.get(c.mediaId) : null;
    let moved = false;
    let targetTrack = tr;
    let result = null;
    const snapPoints = [0, this.store.time, ...p.tracks.flatMap((t) => t.clips.filter((x) => x.id !== c.id).flatMap((x) => [x.start, clipEnd(x)]))];
    const snapT = (t) => {
      if (!this.snap) return { t, hit: null };
      let best = null; let bestD = SNAP_PX / this.pps;
      for (const s of snapPoints) { const d = Math.abs(s - t); if (d < bestD) { best = s; bestD = d; } }
      return best === null ? { t, hit: null } : { t: best, hit: best };
    };
    const showSnap = (hit) => { this.snapLine.hidden = hit === null; if (hit !== null) this.snapLine.style.left = `${hit * this.pps}px`; };

    const move = (ev) => {
      const dx = (ev.clientX - startX) / this.pps;
      if (!moved && Math.abs(ev.clientX - startX) < 3 && Math.abs(ev.clientY - startY) < 3) return;
      moved = true;
      node.classList.add('dragging');
      if (edge === 'l') {
        let ns = Math.max(0, orig.start + dx);
        ({ t: ns } = snapT(ns));
        let delta = ns - orig.start;
        const maxDelta = orig.duration - 0.1;
        if (c.type === 'video' || c.type === 'audio') delta = Math.max(delta, -orig.in / (c.speed || 1));
        delta = Math.min(delta, maxDelta);
        result = { start: orig.start + delta, duration: orig.duration - delta, in: (c.type === 'video' || c.type === 'audio') ? orig.in + delta * (c.speed || 1) : orig.in, delta };
        showSnap(snapT(result.start).hit);
      } else if (edge === 'r') {
        let ne = orig.start + orig.duration + dx;
        ({ t: ne } = snapT(ne));
        let dur = Math.max(0.1, ne - orig.start);
        if (m?.duration && (c.type === 'video' || c.type === 'audio')) dur = Math.min(dur, (m.duration - orig.in) / (c.speed || 1));
        result = { start: orig.start, duration: dur, in: orig.in };
        showSnap(snapT(orig.start + dur).hit);
      } else {
        let ns = Math.max(0, orig.start + dx);
        const a = snapT(ns); const b = snapT(ns + orig.duration);
        if (a.hit !== null) ns = a.t; else if (b.hit !== null) ns = b.t - orig.duration;
        showSnap(a.hit ?? b.hit);
        // Changement de piste (vertical).
        const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList?.contains('tl-track'));
        const cand = under && p.tracks.find((t) => t.id === under.dataset.track);
        if (cand && trackAccepts(cand, c) && !cand.locked) targetTrack = cand;
        result = { start: Math.max(0, ns), duration: orig.duration, in: orig.in };
        if (targetTrack !== tr) {
          const row = this.tracksEl.querySelector(`[data-track="${targetTrack.id}"]`);
          if (row && node.parentElement !== row) row.append(node);
        }
      }
      node.style.left = `${result.start * this.pps}px`;
      node.style.width = `${result.duration * this.pps}px`;
      const ok = fitsOnTrack(targetTrack, result.start, result.duration, c.id);
      node.classList.toggle('invalid', !ok);
    };
    const up = () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      this.snapLine.hidden = true;
      this.gestureActive = false;
      this.renderPending = false;
      if (!moved || !result) { this.render(); return; }
      if (!fitsOnTrack(targetTrack, result.start, result.duration, c.id)) {
        toast('Emplacement occupé : le clip chevaucherait un autre clip de la piste.', 'error');
        this.render();
        return;
      }
      this.store.mutate(edge ? 'Rogner le clip' : 'Déplacer le clip', () => {
        if (edge === 'l' && result.delta) shiftKeyframes(c, result.delta);
        c.start = result.start; c.duration = result.duration; if (c.in !== undefined) c.in = result.in;
        if (targetTrack !== tr) { tr.clips = tr.clips.filter((x) => x.id !== c.id); targetTrack.clips.push(c); }
      });
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------- dépôt depuis la médiathèque
  bindDrop(row, tr) {
    row.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(MEDIA_MIME)) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; row.classList.add('drop-ok');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-ok'));
    row.addEventListener('drop', (e) => {
      row.classList.remove('drop-ok');
      const id = e.dataTransfer.getData(MEDIA_MIME);
      if (!id) return;
      e.preventDefault();
      this.addMediaClip(id, { time: this.timeAt(e.clientX), track: tr });
    });
  }

  // Ajoute un média sur la timeline (piste compatible, premier emplacement libre).
  addMediaClip(mediaId, { time = this.store.time, track = null } = {}) {
    const m = this.media.get(mediaId);
    if (!m) return null;
    const type = m.kind === 'image' ? 'image' : m.kind;
    const p = this.store.project;
    const proto = createClip(type, { mediaId, duration: m.kind === 'image' ? 5 : Math.max(0.1, m.duration || 5), name: m.name });
    if (type === 'image' && m.width && m.height && Math.abs(m.width / m.height - p.width / p.height) > 0.2 && /logo|\.png$|\.svg$/i.test(m.name)) { proto.fit = 'contain'; proto.transform.scale = 0.5; }
    let added = null;
    this.store.mutate('Ajouter un média', (proj) => {
      if (!proj.mediaIds.includes(mediaId)) proj.mediaIds.push(mediaId);
      let tr = track && trackAccepts(track, proto) && !track.locked ? track : null;
      if (!tr) tr = proj.tracks.find((t) => trackAccepts(t, proto) && !t.locked && (type !== 'image' || t.kind === 'video')) || null;
      if (!tr) { tr = createTrack(type === 'audio' ? 'audio' : 'video'); proj.tracks.splice(type === 'audio' ? proj.tracks.length : 0, 0, tr); }
      proto.start = firstFreeSlot(tr, Math.max(0, time), proto.duration);
      tr.clips.push(proto);
      added = proto;
    });
    this.store.select(added.id);
    return added;
  }

  // Ajoute un clip généré (texte, forme, effet) au temps courant sur une piste compatible.
  addClip(clip, { kind = null, label = 'Ajouter un élément' } = {}) {
    let added = null;
    this.store.mutate(label, (proj) => {
      const want = kind || (clip.type === 'text' ? 'text' : clip.type === 'fx' ? 'fx' : clip.type === 'audio' ? 'audio' : 'video');
      let tr = proj.tracks.find((t) => t.kind === want && !t.locked && fitsOnTrack(t, clip.start, clip.duration));
      if (!tr) {
        tr = createTrack(want);
        const firstVisual = proj.tracks.findIndex((t) => t.kind !== 'fx');
        proj.tracks.splice(want === 'fx' ? 0 : want === 'audio' ? proj.tracks.length : Math.max(0, firstVisual), 0, tr);
      }
      tr.clips.push(clip);
      added = clip;
    });
    this.store.select(added.id);
    return added;
  }

  // ---------------------------------------------------------------- opérations
  splitSelected() {
    const sel = this.store.selected;
    const t = this.store.time;
    if (!sel) { toast('Sélectionnez d\'abord un clip.'); return; }
    const { track, clip } = sel;
    if (t <= clip.start + 0.05 || t >= clipEnd(clip) - 0.05) { toast('Placez la tête de lecture à l\'intérieur du clip pour le couper.'); return; }
    this.store.mutate('Couper le clip', () => {
      const local = t - clip.start;
      const right = deepClone(clip);
      right.id = uid('clp');
      right.start = t; right.duration = clip.duration - local;
      if (right.in !== undefined) right.in = (clip.in || 0) + local * (clip.speed || 1);
      shiftKeyframes(right, local);
      for (const prop of Object.keys(clip.keyframes || {})) {
        clip.keyframes[prop] = clip.keyframes[prop].filter((k) => k.t <= local + 1e-6);
        if (!clip.keyframes[prop].length) delete clip.keyframes[prop];
      }
      clip.duration = local;
      clip.transitionOut = null; right.transitionIn = null;
      if (clip.type === 'audio' || clip.type === 'video') { clip.fadeOut = 0; right.fadeIn = 0; }
      track.clips.push(right);
    });
  }

  duplicateSelected() {
    const sel = this.store.selected;
    if (!sel) return;
    const copy = deepClone(sel.clip);
    copy.id = uid('clp');
    this.store.mutate('Dupliquer le clip', () => {
      copy.start = firstFreeSlot(sel.track, clipEnd(sel.clip), copy.duration);
      sel.track.clips.push(copy);
    });
    this.store.select(copy.id);
  }

  deleteSelected() {
    const sel = this.store.selected;
    if (!sel) return;
    if (sel.track.locked) { toast('Piste verrouillée.'); return; }
    this.store.mutate('Supprimer le clip', () => { sel.track.clips = sel.track.clips.filter((c) => c.id !== sel.clip.id); });
    this.store.select(null);
  }

  addTrack(kind) {
    this.store.mutate('Ajouter une piste', (p) => {
      const tr = createTrack(kind, `${{ video: 'Vidéo', text: 'Textes', audio: 'Audio', fx: 'Effets' }[kind]} ${p.tracks.filter((t) => t.kind === kind).length + 1}`);
      if (kind === 'audio') p.tracks.push(tr); else if (kind === 'fx') p.tracks.unshift(tr); else p.tracks.splice(p.tracks.findIndex((t) => t.kind !== 'fx') + (kind === 'video' ? 1 : 0), 0, tr);
    });
  }

  moveTrack(tr, dir) {
    this.store.mutate('Réordonner les pistes', (p) => {
      const i = p.tracks.indexOf(tr); const j = i + dir;
      if (j < 0 || j >= p.tracks.length) return;
      [p.tracks[i], p.tracks[j]] = [p.tracks[j], p.tracks[i]];
    });
  }

  async removeTrack(tr) {
    if (tr.clips.length && !(await confirmDialog(`Supprimer la piste « ${tr.name} » et ses ${tr.clips.length} clip(s) ?`, { danger: true, confirmLabel: 'Supprimer' }))) return;
    this.store.mutate('Supprimer la piste', (p) => { p.tracks = p.tracks.filter((t) => t !== tr); });
  }
}

export { isVisual };
