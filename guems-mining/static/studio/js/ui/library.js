// Panneau de gauche : médias, textes, éléments graphiques, effets, transitions, sous-titres.

import { el, formatBytes, formatTime } from '../util.js';
import { icon, button, toast, confirmDialog } from './common.js';
import { ACCEPT_ATTR } from '../media.js';
import { createClip, createTrack, isVisual } from '../model.js';
import { LAYER_EFFECTS, FRAME_EFFECTS, defaultParams, newEffect } from '../engine/effects.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { MEDIA_MIME } from './timeline.js';
import { parseSrt } from '../subtitles.js';

// Préréglages de textes (motion design).
const TEXT_PRESETS = {
  title: { label: 'Grand titre', hint: 'Glisse vers le haut', make: (p) => ({ text: { content: 'Votre titre', size: Math.round(Math.min(p.width, p.height) * 0.1), animIn: { type: 'slide-up', duration: 0.7 } } }) },
  subtitle: { label: 'Sous-titre', hint: 'Fondu', make: (p) => ({ transform: { y: p.height * 0.12 }, text: { content: 'Votre sous-titre', font: 'Inter', weight: 500, size: Math.round(Math.min(p.width, p.height) * 0.04), animIn: { type: 'fade', duration: 0.6 } } }) },
  kinetic: { label: 'Mot par mot', hint: 'Typographie cinétique', make: (p) => ({ text: { content: 'CHAQUE MOT COMPTE', font: 'Anton', weight: 400, size: Math.round(Math.min(p.width, p.height) * 0.12), uppercase: true, animIn: { type: 'pop-words', duration: 1.2, stagger: 0.12 } } }) },
  typewriter: { label: 'Machine à écrire', hint: 'Lettre par lettre', make: (p) => ({ text: { content: 'Il était une fois…', font: 'Space Grotesk', weight: 500, size: Math.round(Math.min(p.width, p.height) * 0.06), animIn: { type: 'typewriter', duration: 1.6, stagger: 0.06 }, align: 'left' } }) },
  lowerThird: { label: 'Bandeau nom / fonction', hint: 'Lower third', make: (p) => ({ transform: { x: -p.width * 0.22, y: p.height * 0.32 }, text: { content: 'Prénom Nom\nFonction', size: Math.round(Math.min(p.width, p.height) * 0.04), align: 'left', boxWidth: 0.4, background: { enabled: true, color: '#F96A00', padding: 22, radius: 6 }, animIn: { type: 'mask-up', duration: 0.6 } } }) },
  quote: { label: 'Citation', hint: 'Serif élégant', make: (p) => ({ text: { content: '« Une citation inspirante. »', font: 'Playfair Display', weight: 600, italic: true, size: Math.round(Math.min(p.width, p.height) * 0.065), animIn: { type: 'blur-in', duration: 1 } } }) },
  cta: { label: 'Appel à l\'action', hint: 'Pop + fond', make: (p) => ({ text: { content: 'Contactez-nous', size: Math.round(Math.min(p.width, p.height) * 0.07), background: { enabled: true, color: '#F96A00', padding: 30, radius: 999 }, animIn: { type: 'pop', duration: 0.6 } } }) },
  outline: { label: 'Titre contour', hint: 'Lettres creuses + lueur', make: (p) => ({ text: { content: 'IMPACT', font: 'Archivo Black', weight: 400, size: Math.round(Math.min(p.width, p.height) * 0.16), color: '#0D0D0F', stroke: { width: 4, color: '#FFFFFF' }, animIn: { type: 'tracking', duration: 1 } } }) },
};

const SHAPE_PRESETS = {
  bg: { label: 'Fond dégradé', make: () => ({ shape: { kind: 'rect', fullFrame: true, fill: '#0F172A', fill2: '#F96A00', gradientAngle: 135 } }) },
  solid: { label: 'Fond uni', make: () => ({ shape: { kind: 'rect', fullFrame: true, fill: '#111111' } }) },
  bar: { label: 'Barre animée', make: () => ({ shape: { kind: 'rect', width: 700, height: 16, fill: '#F96A00', reveal: { type: 'grow-x', duration: 0.6 } } }) },
  button: { label: 'Bouton arrondi', make: () => ({ shape: { kind: 'rect', width: 560, height: 110, radius: 55, fill: '#F96A00', fill2: '#FFB15C', gradientAngle: 0, reveal: { type: 'scale', duration: 0.5 } } }) },
  circle: { label: 'Cercle', make: () => ({ shape: { kind: 'circle', width: 360, height: 360, fill: '#F96A00', reveal: { type: 'scale', duration: 0.6 } } }) },
  ring: { label: 'Anneau', make: () => ({ shape: { kind: 'circle', width: 420, height: 420, fill: '', stroke: { width: 10, color: '#FFFFFF' }, reveal: { type: 'scale', duration: 0.6 } } }) },
  triangle: { label: 'Triangle', make: () => ({ shape: { kind: 'triangle', width: 300, height: 260, fill: '#FFB15C' } }) },
  frame: { label: 'Cadre', make: () => ({ shape: { kind: 'rect', width: 1500, height: 820, fill: '', stroke: { width: 6, color: '#FFFFFF' }, radius: 12 } }) },
};

export class Library {
  constructor({ store, media, timeline, openTemplates, openAI }) {
    this.store = store;
    this.media = media;
    this.timeline = timeline;
    this.root = el('div', { class: 'panel library' });
    this.tabs = [
      ['media', 'Médias', 'image'], ['text', 'Textes', 'type'], ['shapes', 'Éléments', 'shapes'],
      ['effects', 'Effets', 'wand'], ['transitions', 'Transitions', 'layers'], ['ai', 'IA', 'sparkles'],
    ];
    this.current = 'media';
    this.tabBar = el('div', { class: 'tabs', role: 'tablist' });
    this.body = el('div', { class: 'panel-body' });
    this.root.append(this.tabBar, this.body);
    this.openTemplates = openTemplates;
    this.openAI = openAI;
    this.fileInput = el('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true, onchange: (e) => { this.importFiles([...e.target.files]); e.target.value = ''; } });
    this.root.append(this.fileInput);
    store.on('load', () => this.render());
    store.on('select', () => { if (['effects', 'transitions'].includes(this.current)) this.render(); });
    this.render();
  }

  render() {
    this.tabBar.replaceChildren(...this.tabs.map(([id, label, ic]) => {
      const b = el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(this.current === id), onclick: () => { this.current = id; this.render(); } }, [icon(ic), label]);
      return b;
    }));
    this.body.replaceChildren();
    if (!this.store.project) return;
    ({ media: () => this.renderMedia(), text: () => this.renderText(), shapes: () => this.renderShapes(), effects: () => this.renderEffects(), transitions: () => this.renderTransitions(), ai: () => this.renderAI() })[this.current]();
  }

  // ---------------------------------------------------------------- médias
  async importFiles(files) {
    if (!files.length) return;
    const status = el('p', { class: 'note', text: 'Import en cours…' });
    this.body.prepend(status);
    const { added, errors } = await this.media.import(files, ({ index, total, name }) => { status.textContent = `Import ${index}/${total} : ${name}`; });
    if (added.length) this.store.mutate('Importer des médias', (p) => { for (const m of added) if (!p.mediaIds.includes(m.id)) p.mediaIds.push(m.id); });
    if (added.length) toast(`${added.length} média(s) importé(s).`, 'success');
    for (const e of errors) toast(`Import refusé — ${e}`, 'error', 7000);
    this.current = 'media';
    this.render();
  }

  renderMedia() {
    const p = this.store.project;
    const drop = el('div', { class: 'dropzone' }, [
      el('p', { style: { margin: '0 0 8px' }, text: 'Glissez vos vidéos, images, logos, musiques ou voix off ici' }),
      button('Importer des fichiers', { icon: 'upload', cls: 'primary sm', onclick: () => this.fileInput.click() }),
      el('p', { class: 'small muted', style: { margin: '8px 0 0' }, text: 'MP4, WebM, MOV · PNG, JPG, WebP, SVG · MP3, WAV, OGG, M4A. Les fichiers restent dans votre navigateur.' }),
    ]);
    drop.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); drop.classList.add('over'); } });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); this.importFiles([...e.dataTransfer.files]); });
    this.body.append(drop);
    const items = this.media.list(p.mediaIds);
    if (!items.length) { this.body.append(el('p', { class: 'empty', text: 'Aucun média dans ce projet.' })); return; }
    const grid = el('div', { class: 'media-grid' });
    for (const m of items) {
      const thumb = el('div', { class: 'media-thumb', style: m.thumb ? { backgroundImage: `url(${m.thumb})` } : {} });
      if (!m.thumb) thumb.append(icon(m.kind === 'audio' ? 'music' : 'file', 'ico'));
      if (m.kind === 'audio' && m.waveform) thumb.replaceChildren(this.miniWave(m.waveform));
      const item = el('div', { class: 'media-item', draggable: 'true', tabindex: 0, title: `${m.name} — glisser sur la timeline ou double-cliquer pour ajouter` }, [
        thumb,
        el('span', { class: 'badge', text: { video: 'Vidéo', image: 'Image', audio: 'Audio' }[m.kind] }),
        el('div', { class: 'media-meta' }, [el('b', { text: m.name }), el('span', { class: 'muted', text: `${m.duration ? `${formatTime(m.duration, 100).slice(0, 5)} · ` : ''}${formatBytes(m.size)}` })]),
        el('div', { class: 'media-actions' }, [
          button('Ajouter à la timeline', { icon: 'plus', iconOnly: true, cls: 'sm primary', onclick: (e) => { e.stopPropagation(); this.timeline.addMediaClip(m.id); } }),
          button('Retirer du projet', { icon: 'trash', iconOnly: true, cls: 'sm', onclick: (e) => { e.stopPropagation(); this.removeMedia(m); } }),
        ]),
      ]);
      item.addEventListener('dragstart', (e) => { e.dataTransfer.setData(MEDIA_MIME, m.id); e.dataTransfer.effectAllowed = 'copy'; });
      item.addEventListener('dblclick', () => this.timeline.addMediaClip(m.id));
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.timeline.addMediaClip(m.id); });
      grid.append(item);
    }
    this.body.append(grid);
  }

  miniWave(wf) {
    const c = el('canvas', { width: 200, height: 60 });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#12B76A';
    wf.forEach((v, i) => { const x = (i / wf.length) * 200; const h = Math.max(1, v * 56); ctx.fillRect(x, 30 - h / 2, 1, h); });
    return c;
  }

  async removeMedia(m) {
    const used = this.store.project.tracks.some((t) => t.clips.some((c) => c.mediaId === m.id));
    if (used && !(await confirmDialog(`« ${m.name} » est utilisé dans la timeline. Retirer le média et ses clips ?`, { danger: true, confirmLabel: 'Retirer' }))) return;
    this.store.mutate('Retirer un média', (p) => {
      p.mediaIds = p.mediaIds.filter((id) => id !== m.id);
      for (const t of p.tracks) t.clips = t.clips.filter((c) => c.mediaId !== m.id);
    });
    this.render();
  }

  // ---------------------------------------------------------------- textes
  renderText() {
    const p = this.store.project;
    const grid = el('div', { class: 'preset-grid' }, Object.entries(TEXT_PRESETS).map(([id, pr]) => el('button', {
      type: 'button', class: 'preset', title: 'Ajouter à la tête de lecture',
      onclick: () => this.timeline.addClip(createClip('text', { start: this.store.time, duration: 4, name: pr.label, ...pr.make(p) }), { label: 'Ajouter un texte' }),
    }, [el('b', { text: pr.label }), el('span', { text: pr.hint })])));
    const srtInput = el('input', { type: 'file', accept: '.srt,text/plain', hidden: true, onchange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) this.importSrt(await f.text()); } });
    this.body.append(
      el('p', { class: 'small muted', text: 'Cliquez sur un style pour l\'ajouter à la tête de lecture, puis modifiez-le dans Propriétés.' }),
      grid,
      el('details', { class: 'group', open: true }, [el('summary', { text: 'Sous-titres' }), el('div', { class: 'group-body' }, [
        el('p', { class: 'small muted', text: 'Importez un fichier .srt : chaque sous-titre devient un texte synchronisé sur une piste dédiée.' }),
        button('Importer un fichier SRT', { icon: 'upload', cls: 'sm', onclick: () => srtInput.click() }),
        el('p', { class: 'note small', text: 'Transcription automatique de la voix : nécessite un service de reconnaissance vocale (non connecté). Voir la documentation du Studio.' }),
        srtInput,
      ])]),
    );
  }

  importSrt(text) {
    const cues = parseSrt(text);
    if (!cues.length) { toast('Aucun sous-titre valide trouvé dans ce fichier.', 'error'); return; }
    const p = this.store.project;
    const base = Math.min(p.width, p.height);
    this.store.mutate('Importer des sous-titres', (proj) => {
      const tr = createTrack('text', 'Sous-titres');
      proj.tracks.unshift(tr);
      for (const c of cues) {
        tr.clips.push(createClip('text', {
          start: c.start, duration: c.end - c.start, name: c.content.slice(0, 30),
          transform: { y: proj.height * 0.38 },
          text: { content: c.content, font: 'Inter', weight: 600, size: Math.round(base * 0.045), boxWidth: 0.86, background: { enabled: true, color: '#000000', padding: 14, radius: 6 }, animIn: { type: 'fade', duration: 0.12 }, animOut: { type: 'fade', duration: 0.12 } },
        }));
      }
    });
    toast(`${cues.length} sous-titre(s) importé(s).`, 'success');
  }

  // ---------------------------------------------------------------- formes
  renderShapes() {
    this.body.append(
      el('p', { class: 'small muted', text: 'Formes vectorielles animables : fonds, barres, boutons, cadres.' }),
      el('div', { class: 'preset-grid' }, Object.entries(SHAPE_PRESETS).map(([id, pr]) => el('button', {
        type: 'button', class: 'preset',
        onclick: () => this.timeline.addClip(createClip('shape', { start: this.store.time, duration: 5, name: pr.label, ...pr.make() }), { label: 'Ajouter une forme' }),
      }, [el('b', { text: pr.label })]))),
    );
  }

  // ---------------------------------------------------------------- effets
  renderEffects() {
    const sel = this.store.selected;
    const visual = sel && isVisual(sel.clip);
    this.body.append(
      el('details', { class: 'group', open: true }, [el('summary', { text: 'Effets de calque' }), el('div', { class: 'group-body' }, [
        el('p', { class: 'small muted', text: visual ? `S'applique au clip sélectionné : ${sel.clip.name || sel.clip.type}.` : 'Sélectionnez un clip visuel dans la timeline.' }),
        ...Object.entries(LAYER_EFFECTS).map(([id, def]) => el('button', {
          type: 'button', class: 'list-btn', disabled: !visual,
          onclick: () => { this.store.mutate(`Effet : ${def.label}`, () => { sel.clip.effects = sel.clip.effects || []; sel.clip.effects.push(newEffect(id)); }); toast(`${def.label} ajouté.`, 'success'); },
        }, [el('span', { text: def.label }), icon('plus')])),
      ])]),
      el('details', { class: 'group', open: true }, [el('summary', { text: 'Effets plein cadre et caméra' }), el('div', { class: 'group-body' }, [
        el('p', { class: 'small muted', text: 'Ajoutés sur une piste d\'effets à la tête de lecture ; ils agissent sur toutes les pistes situées en dessous.' }),
        ...Object.entries(FRAME_EFFECTS).map(([id, def]) => el('button', {
          type: 'button', class: 'list-btn',
          onclick: () => this.timeline.addClip(createClip('fx', { start: this.store.time, duration: Math.max(1, Math.min(5, this.store.duration - this.store.time || 5)), name: def.label, fx: { type: id, params: defaultParams(def) } }), { label: `Effet : ${def.label}` }),
        }, [el('span', { text: def.label }), icon('plus')])),
      ])]),
    );
  }

  renderTransitions() {
    const sel = this.store.selected;
    const visual = sel && isVisual(sel.clip);
    this.body.append(el('p', { class: 'small muted', text: visual ? 'Choisissez où appliquer la transition au clip sélectionné.' : 'Sélectionnez un clip visuel dans la timeline.' }));
    for (const [id, def] of Object.entries(TRANSITIONS)) {
      this.body.append(el('div', { class: 'row' }, [
        el('span', { class: 'grow', text: def.label }),
        button('Entrée', { cls: 'sm', disabled: !visual, onclick: () => this.store.mutate('Transition d\'entrée', () => { sel.clip.transitionIn = { type: id, duration: Math.min(0.6, sel.clip.duration / 2) }; }) }),
        button('Sortie', { cls: 'sm', disabled: !visual, onclick: () => this.store.mutate('Transition de sortie', () => { sel.clip.transitionOut = { type: id, duration: Math.min(0.6, sel.clip.duration / 2) }; }) }),
      ]));
    }
  }

  renderAI() {
    this.body.append(
      el('p', { class: 'small muted', text: 'Décrivez la vidéo souhaitée : l\'assistant propose un scénario, un storyboard et un plan de montage que vous pouvez appliquer puis retoucher.' }),
      button('Ouvrir l\'assistant IA', { icon: 'sparkles', cls: 'primary', onclick: () => this.openAI() }),
      button('Parcourir les modèles', { icon: 'grid', onclick: () => this.openTemplates() }),
    );
  }
}
