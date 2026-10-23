// Éditeur : aperçu, transport, panneaux, timeline, raccourcis clavier, sauvegarde automatique.

import { el, formatTime, debounce, downloadBlob } from '../util.js';
import { button, icon, toast } from './common.js';
import { Player } from '../engine/player.js';
import { Timeline } from './timeline.js';
import { Inspector } from './inspector.js';
import { Library } from './library.js';
import { openExport } from './exportDialog.js';
import { openTemplates } from './templatesDialog.js';
import { openAssistant } from './aiDialog.js';
import { exportPackage } from '../projectio.js';
import { db } from '../db.js';

export class Editor {
  constructor({ store, media, audio, goHome }) {
    this.store = store;
    this.media = media;
    this.audio = audio;
    this.canvas = el('canvas', { 'aria-label': 'Aperçu de la vidéo' });
    this.player = new Player({ canvas: this.canvas, store, media, audio });
    this.timeline = new Timeline({ store, media, player: this.player });
    this.inspector = new Inspector({ store, player: this.player, media });
    this.library = new Library({
      store, media, timeline: this.timeline,
      openTemplates: () => this.templates(),
      openAI: () => this.assistant(),
    });
    this.goHome = goHome;
    this.root = el('div', { class: 'app' });
    this.build();
    this.bindKeys();
    this.thumb = debounce(() => this.updateThumb(), 2500);
    store.on('change', () => { this.updateButtons(); this.updateTime(); this.thumb(); });
    store.on('time', () => this.updateTime());
    store.on('playstate', (playing) => { this.playBtn.replaceChildren(icon(playing ? 'pause' : 'play')); this.playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Lecture'); });
    store.on('save-state', (s) => {
      this.saveEl.textContent = { saved: 'Enregistré', pending: 'Modifications…', saving: 'Enregistrement…', error: 'Erreur d\'enregistrement' }[s];
      this.saveEl.classList.toggle('error', s === 'error');
    });
    this.player.onTick(() => this.updateTime());
  }

  build() {
    const s = this.store;
    this.nameInput = el('input', { type: 'text', class: 'project-name', 'aria-label': 'Nom du projet' });
    this.nameInput.addEventListener('change', () => s.mutate('Renommer le projet', (p) => { p.name = this.nameInput.value.trim().slice(0, 120) || 'Sans titre'; }));
    this.undoBtn = button('Annuler (Ctrl+Z)', { icon: 'undo', iconOnly: true, onclick: () => s.undo() });
    this.redoBtn = button('Rétablir (Ctrl+Maj+Z)', { icon: 'redo', iconOnly: true, onclick: () => s.redo() });
    this.saveEl = el('span', { class: 'save-state', role: 'status', text: 'Enregistré' });
    const topbar = el('header', { class: 'topbar' }, [
      el('a', { class: 'brand', href: '#/', title: 'Retour aux projets' }, [el('span', { class: 'brand-mark' }, [icon('film')]), el('span', { class: 'hide-mobile', text: 'Studio' })]),
      el('span', { class: 'sep' }),
      this.nameInput, this.undoBtn, this.redoBtn, this.saveEl,
      el('span', { class: 'grow' }),
      button('Modèles', { icon: 'grid', cls: 'hide-mobile', onclick: () => this.templates() }),
      button('Assistant IA', { icon: 'sparkles', onclick: () => this.assistant() }),
      button('Fichier du projet', { icon: 'file', iconOnly: true, title: 'Enregistrer le projet et ses médias dans un fichier .gmstudio', onclick: () => this.saveFile() }),
      el('button', { type: 'button', class: 'btn icon insp-toggle', style: { display: 'none' }, 'aria-label': 'Propriétés', title: 'Propriétés', onclick: () => this.grid.classList.toggle('show-insp') }, [icon('sliders')]),
      button('Exporter', { icon: 'download', cls: 'primary', onclick: () => openExport({ store: s, media: this.media, audio: this.audio, player: this.player }) }),
    ]);

    // Aperçu et transport.
    this.playBtn = button('Lecture', { icon: 'play', iconOnly: true, cls: 'primary play-btn', onclick: () => this.player.toggle() });
    this.timecode = el('span', { class: 'timecode', 'aria-live': 'off' });
    this.loopBtn = button('Lecture en boucle', { icon: 'loop', iconOnly: true, cls: 'sm', pressed: false, onclick: () => { this.player.loop = !this.player.loop; this.loopBtn.setAttribute('aria-pressed', String(this.player.loop)); } });
    const fps = () => this.store.project?.fps || 30;
    const transport = el('div', { class: 'transport' }, [
      button('Début', { icon: 'start', iconOnly: true, cls: 'sm', onclick: () => s.setTime(0) }),
      button('Image précédente (←)', { icon: 'prev', iconOnly: true, cls: 'sm', onclick: () => s.setTime(s.time - 1 / fps()) }),
      this.playBtn,
      button('Image suivante (→)', { icon: 'next', iconOnly: true, cls: 'sm', onclick: () => s.setTime(s.time + 1 / fps()) }),
      button('Fin', { icon: 'end', iconOnly: true, cls: 'sm', onclick: () => s.setTime(s.duration) }),
      this.loopBtn,
      el('span', { class: 'grow' }),
      this.timecode,
    ]);
    const viewer = el('section', { class: 'viewer', 'aria-label': 'Aperçu' }, [el('div', { class: 'viewer-stage' }, [this.canvas]), transport]);

    // Séparateur redimensionnable entre aperçu et timeline.
    const splitter = el('div', { class: 'splitter', role: 'separator', 'aria-label': 'Redimensionner la timeline', tabindex: 0 });
    splitter.addEventListener('pointerdown', (e) => {
      splitter.setPointerCapture(e.pointerId);
      const startY = e.clientY; const startH = this.grid.querySelector('.timeline-wrap').offsetHeight;
      const move = (ev) => document.documentElement.style.setProperty('--tl-h', `${Math.min(window.innerHeight - 220, Math.max(140, startH - (ev.clientY - startY)))}px`);
      const up = () => { splitter.removeEventListener('pointermove', move); splitter.removeEventListener('pointerup', up); this.timeline.render(); };
      splitter.addEventListener('pointermove', move); splitter.addEventListener('pointerup', up);
    });

    this.mobileTabs = el('nav', { class: 'mobile-tabs', 'aria-label': 'Panneaux' }, [['lib', 'Bibliothèque'], ['tl', 'Timeline'], ['insp', 'Propriétés']].map(([id, label]) => el('button', {
      type: 'button', 'aria-selected': String(id === 'tl'), onclick: (e) => {
        if (id === 'insp') { this.grid.classList.toggle('show-insp'); return; }
        this.grid.dataset.mobile = id;
        [...this.mobileTabs.children].forEach((b) => b.setAttribute('aria-selected', String(b === e.currentTarget)));
        this.timeline.render();
      },
    }, [label])));
    this.grid = el('main', { class: 'editor', id: 'contenu', dataset: { mobile: 'tl' } }, [
      this.library.root, viewer, this.inspector.root, splitter,
      el('section', { class: 'timeline-wrap', 'aria-label': 'Timeline' }, [this.timeline.root]),
    ]);
    this.root.append(topbar, this.grid, this.mobileTabs);
  }

  async open(project) {
    await this.media.loadProjectMedia(project.mediaIds);
    this.store.load(project);
    this.nameInput.value = project.name;
    this.updateButtons();
    this.updateTime();
    this.player.resize();
    this.timeline.render();
    this.inspector.render();
    this.library.render();
  }

  close() { this.player.pause(); this.player.disposeVideos(); this.store.autosave.flush(); }

  updateButtons() {
    this.undoBtn.disabled = !this.store.canUndo;
    this.redoBtn.disabled = !this.store.canRedo;
    if (this.store.project && document.activeElement !== this.nameInput) this.nameInput.value = this.store.project.name;
  }

  updateTime() {
    const fps = this.store.project?.fps || 30;
    this.timecode.replaceChildren(el('b', { text: formatTime(this.store.time, fps) }), ` / ${formatTime(this.store.duration, fps)}`);
  }

  async updateThumb() {
    const p = this.store.project;
    if (!p) return;
    try {
      const c = document.createElement('canvas');
      c.width = 384; c.height = Math.round(384 * p.height / p.width);
      await this.player.snapshot(c, p, Math.min(this.store.duration * 0.3, 2));
      p.thumb = c.toDataURL('image/jpeg', 0.7);
      await db.putProject(JSON.parse(JSON.stringify(p)));
    } catch (e) { console.warn('Miniature', e); }
  }

  templates() {
    openTemplates({ media: this.media, initialMediaIds: this.store.project?.mediaIds || [], onCreate: async (p) => { await db.putProject(p); location.hash = `#/projet/${p.id}`; } });
  }

  assistant() {
    openAssistant({
      media: this.media, initialMediaIds: this.store.project?.mediaIds || [], hasProject: true,
      onCreate: async (p) => { await db.putProject(p); location.hash = `#/projet/${p.id}`; },
      onReplace: (p) => this.store.mutate('Composition de l\'assistant IA', (cur) => {
        Object.assign(cur, { tracks: p.tracks, width: p.width, height: p.height, aspect: p.aspect, fps: p.fps, background: p.background, plan: p.plan, mediaIds: [...new Set([...cur.mediaIds, ...p.mediaIds])] });
      }),
    });
  }

  async saveFile() {
    const p = this.store.project;
    toast('Préparation du fichier du projet…');
    const blob = await exportPackage(p, this.media);
    downloadBlob(blob, `${p.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'projet'}.gmstudio`);
  }

  bindKeys() {
    this.onKey = (e) => {
      if (!this.root.isConnected || document.querySelector('dialog[open]')) return;
      const tag = e.target.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const s = this.store; const fps = s.project?.fps || 30;
      if (e.key === ' ') { e.preventDefault(); this.player.toggle(); }
      else if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) s.redo(); else s.undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); this.timeline.duplicateSelected(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); s.autosave.flush(); toast('Projet enregistré.'); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); this.timeline.deleteSelected(); }
      else if (e.key.toLowerCase() === 's') this.timeline.splitSelected();
      else if (e.key === 'ArrowLeft') { e.preventDefault(); s.setTime(s.time - (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); s.setTime(s.time + (e.shiftKey ? 1 : 1 / fps)); }
      else if (e.key === 'Home') s.setTime(0);
      else if (e.key === 'End') s.setTime(s.duration);
      else if (e.key === '+' || e.key === '=') this.timeline.setZoom(this.timeline.pps * 1.25);
      else if (e.key === '-') this.timeline.setZoom(this.timeline.pps * 0.8);
      else if (e.key === 'Escape') s.select(null);
    };
    window.addEventListener('keydown', this.onKey);
  }
}
