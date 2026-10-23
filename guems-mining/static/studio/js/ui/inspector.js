// Panneau des propriétés : réglages du clip sélectionné (ou du projet), images clés, effets, transitions.

import { el, clamp } from '../util.js';
import { button, field, select, toast } from './common.js';
import { ANIMATABLE, CAMERA_PROPS, BLEND_MODES, FONTS, ASPECTS, FPS_OPTIONS, isVisual, clipEnd, fitsOnTrack } from '../model.js';
import { valueAt, keyframeAt, setKeyframe, removeKeyframe, EASINGS } from '../engine/easing.js';
import { LAYER_EFFECTS, FRAME_EFFECTS, defaultParams, newEffect } from '../engine/effects.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { TEXT_ANIMATIONS } from '../engine/text.js';

const BLEND_LABELS = { normal: 'Normal', screen: 'Superposition claire (screen)', multiply: 'Produit (multiply)', overlay: 'Incrustation (overlay)', add: 'Addition (lumière)', lighten: 'Éclaircir', darken: 'Assombrir', 'soft-light': 'Lumière douce' };

// Préréglages de mouvement : images clés générées en un clic.
export const MOTION_PRESETS = {
  'ken-burns-in': { label: 'Zoom lent avant', apply: (c) => [['scale', 0, 1, 'linear'], ['scale', c.duration, 1.15, 'linear']] },
  'ken-burns-out': { label: 'Zoom lent arrière', apply: (c) => [['scale', 0, 1.15, 'linear'], ['scale', c.duration, 1, 'linear']] },
  'pop-in': { label: 'Apparition « pop »', apply: () => [['scale', 0, 0, 'easeOutBack'], ['scale', 0.5, 1, 'linear'], ['opacity', 0, 0, 'easeOut'], ['opacity', 0.25, 1, 'linear']] },
  'slide-left': { label: 'Entrée par la gauche', apply: (c, W) => [['x', 0, -W * 0.6, 'easeOutQuart'], ['x', 0.7, c.transform.x || 0, 'linear'], ['opacity', 0, 0, 'easeOut'], ['opacity', 0.4, 1, 'linear']] },
  'slide-up': { label: 'Entrée par le bas', apply: (c, W, H) => [['y', 0, H * 0.4, 'easeOutQuart'], ['y', 0.7, c.transform.y || 0, 'linear'], ['opacity', 0, 0, 'easeOut'], ['opacity', 0.4, 1, 'linear']] },
  'spin-in': { label: 'Entrée en rotation', apply: () => [['rotation', 0, -180, 'easeOutQuart'], ['rotation', 0.8, 0, 'linear'], ['scale', 0, 0.2, 'easeOutQuart'], ['scale', 0.8, 1, 'linear']] },
  'flip-3d': { label: 'Retournement 3D', apply: () => [['rotateY', 0, 90, 'easeOutBack'], ['rotateY', 0.8, 0, 'linear']] },
  float: { label: 'Flottement continu', apply: (c) => { const out = []; for (let t = 0, i = 0; t <= c.duration; t += 1.5, i++) out.push(['y', t, (c.transform.y || 0) + (i % 2 ? -12 : 12), 'easeInOutSine']); return out; } },
  'fade-in-out': { label: 'Fondu entrée/sortie', apply: (c) => [['opacity', 0, 0, 'easeOut'], ['opacity', 0.5, 1, 'linear'], ['opacity', Math.max(0.5, c.duration - 0.5), 1, 'easeIn'], ['opacity', c.duration, 0, 'linear']] },
  'focus-pull': { label: 'Mise au point (flou → net)', apply: () => [['blur', 0, 25, 'easeOut'], ['blur', 0.9, 0, 'linear']] },
};

export class Inspector {
  constructor({ store, player, media }) {
    this.store = store;
    this.player = player;
    this.media = media;
    this.root = el('div', { class: 'panel inspector' });
    this.head = el('div', { class: 'panel-head' }, [el('h2', { text: 'Propriétés' })]);
    this.body = el('div', { class: 'panel-body' });
    this.root.append(this.head, this.body);
    this.bindings = [];
    this.signature = '';
    store.on('select', () => this.render());
    store.on('load', () => this.render());
    store.on('change', () => { if (this.sig() !== this.signature) this.render(); else this.refresh(); });
    store.on('time', () => this.refresh());
    player.onTick(() => this.refreshThrottled());
    this.lastTick = 0;
  }

  refreshThrottled() { const n = performance.now(); if (n - this.lastTick > 150) { this.lastTick = n; this.refresh(); } }

  sig() {
    const sel = this.store.selected;
    if (!sel) return `project:${this.store.project?.id}`;
    const c = sel.clip;
    return JSON.stringify([c.id, c.type, (c.effects || []).map((e) => e.type), c.fx?.type, c.text?.background?.enabled, c.shape?.fill2 ? 1 : 0, c.transitionIn?.type, c.transitionOut?.type]);
  }

  refresh() { for (const b of this.bindings) b(); }

  render() {
    this.bindings = [];
    this.signature = this.sig();
    this.body.replaceChildren();
    const p = this.store.project;
    if (!p) return;
    const sel = this.store.selected;
    if (!sel) { this.renderProject(p); return; }
    const { track, clip } = sel;
    this.renderClip(p, track, clip);
  }

  // ---------------------------------------------------------------- contrôles génériques
  edit(label, fn, gesture) { this.store.mutate(label, fn, { gesture }); }

  numberCtl(label, get, set, { min = -1e6, max = 1e6, step = 1, slider = true, gesture } = {}) {
    const num = el('input', { type: 'number', min, max, step, 'aria-label': label });
    const range = slider && Number.isFinite(min) && Number.isFinite(max) && max - min < 1e5 ? el('input', { type: 'range', min, max, step, 'aria-label': label }) : null;
    const g = gesture || `${label}-${Math.random()}`;
    const apply = (v, end) => {
      const n = clamp(Number(v), min, max);
      if (!Number.isFinite(n)) return;
      set(n, g);
      if (end) this.store.endGesture();
    };
    num.addEventListener('change', () => apply(num.value, true));
    range?.addEventListener('input', () => apply(range.value, false));
    range?.addEventListener('change', () => this.store.endGesture());
    const sync = () => {
      const v = get();
      const shown = Math.round(v * 1000) / 1000;
      if (document.activeElement !== num) num.value = String(shown);
      if (range && document.activeElement !== range) range.value = String(v);
    };
    sync();
    this.bindings.push(sync);
    return { node: el('div', { class: 'ctl grow' }, [range, num]), sync };
  }

  prop(label, ctl, extra = null) {
    return el('div', { class: 'prop' }, [el('label', { text: label, title: label }), ctl.node || ctl, extra || el('span')]);
  }

  // Propriété animable avec bouton d'image clé.
  animatedProp(clip, key, def, base) {
    const local = () => clamp(this.store.time - clip.start, 0, clip.duration);
    const get = () => valueAt(clip, key, local(), base.get());
    const ctl = this.numberCtl(def.label, get, (v, g) => {
      this.edit(def.label, () => {
        if (clip.keyframes?.[key]?.length) setKeyframe(clip, key, local(), v);
        else base.set(v);
      }, g);
    }, { min: def.min ?? -5000, max: def.max ?? 5000, step: def.step });
    const kfBtn = el('button', { type: 'button', class: 'kf-btn', title: 'Ajouter / retirer une image clé à la tête de lecture' });
    const ease = select(Object.fromEntries(Object.entries(EASINGS).map(([k, v]) => [k, v.label])), 'easeInOut', (v) => {
      this.edit('Courbe d\'animation', () => { const k = keyframeAt(clip, key, local()); if (k) k.ease = v; });
    }, { 'aria-label': 'Courbe de l\'image clé', style: { gridColumn: '2 / 4', height: '26px', fontSize: '12px' } });
    kfBtn.addEventListener('click', () => {
      const t = this.store.time;
      if (t < clip.start || t > clipEnd(clip)) { toast('Placez la tête de lecture sur le clip pour poser une image clé.'); return; }
      this.edit('Image clé', () => {
        if (keyframeAt(clip, key, local())) removeKeyframe(clip, key, local());
        else setKeyframe(clip, key, local(), get());
      });
    });
    const sync = () => {
      const k = keyframeAt(clip, key, local());
      kfBtn.classList.toggle('on', Boolean(k));
      kfBtn.classList.toggle('has', Boolean(clip.keyframes?.[key]?.length));
      ease.hidden = !k;
      if (k && document.activeElement !== ease) ease.value = k.ease || 'linear';
    };
    sync();
    this.bindings.push(sync);
    return [this.prop(def.label, ctl, kfBtn), el('div', { class: 'prop' }, [el('span'), ease])];
  }

  section(title, children, open = true) {
    return el('details', { class: 'group', open }, [el('summary', { text: title }), el('div', { class: 'group-body' }, children)]);
  }

  color(label, get, set) {
    const input = el('input', { type: 'color', 'aria-label': label });
    const g = `${label}-${Math.random()}`;
    input.addEventListener('input', () => set(input.value, g));
    input.addEventListener('change', () => this.store.endGesture());
    const sync = () => { if (document.activeElement !== input) input.value = (get() || '#000000').slice(0, 7); };
    sync(); this.bindings.push(sync);
    return this.prop(label, el('div', { class: 'ctl' }, [input]));
  }

  check(label, get, set) {
    const input = el('input', { type: 'checkbox', 'aria-label': label });
    input.addEventListener('change', () => set(input.checked));
    const sync = () => { input.checked = Boolean(get()); };
    sync(); this.bindings.push(sync);
    return this.prop(label, el('div', { class: 'ctl' }, [input]));
  }

  choose(label, options, get, set) {
    const s = select(options, get(), (v) => set(v), { 'aria-label': label });
    this.bindings.push(() => { if (document.activeElement !== s) s.value = String(get()); });
    return this.prop(label, el('div', { class: 'ctl grow' }, [s]));
  }

  // ---------------------------------------------------------------- projet
  renderProject(p) {
    this.head.firstChild.textContent = 'Projet';
    const name = el('input', { type: 'text', value: p.name, 'aria-label': 'Nom du projet' });
    name.addEventListener('change', () => this.edit('Renommer le projet', () => { p.name = name.value.trim().slice(0, 120) || 'Sans titre'; }));
    this.body.append(
      el('p', { class: 'note', text: 'Sélectionnez un clip dans la timeline pour modifier ses propriétés.' }),
      this.section('Réglages du projet', [
        field('Nom', name),
        this.choose('Format', Object.fromEntries(Object.entries(ASPECTS).map(([k, v]) => [k, v.label])), () => p.aspect, (v) => this.edit('Format du projet', () => { p.aspect = v; p.width = ASPECTS[v].w; p.height = ASPECTS[v].h; })),
        this.choose('Images/s', Object.fromEntries(FPS_OPTIONS.map((f) => [f, `${f} i/s`])), () => p.fps, (v) => this.edit('Fréquence d\'images', () => { p.fps = Number(v); })),
        this.color('Fond', () => p.background, (v, g) => this.edit('Couleur de fond', () => { p.background = v; }, g)),
        this.choose('Qualité d\'aperçu', { 0.25: 'Basse (25 %)', 0.5: 'Moyenne (50 %)', 0.75: 'Haute (75 %)', 1: 'Pleine (100 %)' }, () => this.player.quality, (v) => this.player.setQuality(Number(v))),
      ]),
      this.section('Informations', [
        el('p', { class: 'small muted', text: `${p.width} × ${p.height} px · ${p.fps} i/s · durée ${this.store.duration.toFixed(2)} s · ${p.tracks.length} pistes · ${p.tracks.reduce((a, t) => a + t.clips.length, 0)} clips` }),
      ]),
    );
  }

  // ---------------------------------------------------------------- clip
  renderClip(p, track, clip) {
    const typeLabel = { video: 'Clip vidéo', image: 'Image', audio: 'Clip audio', text: 'Texte', shape: 'Forme', fx: 'Effet' }[clip.type];
    this.head.firstChild.textContent = typeLabel;
    const name = el('input', { type: 'text', value: clip.name || '', placeholder: typeLabel, 'aria-label': 'Nom du clip' });
    name.addEventListener('change', () => this.edit('Renommer le clip', () => { clip.name = name.value.slice(0, 80); }));
    const media = clip.mediaId ? this.media.get(clip.mediaId) : null;
    const maxDur = media?.duration && (clip.type === 'video' || clip.type === 'audio') ? (media.duration - (clip.in || 0)) / (clip.speed || 1) : 3600;

    this.body.append(this.section('Général', [
      field('Nom', name),
      this.prop('Début (s)', this.numberCtl('Début', () => clip.start, (v, g) => {
        if (!fitsOnTrack(track, v, clip.duration, clip.id)) { toast('Emplacement occupé sur cette piste.'); this.refresh(); return; }
        this.edit('Déplacer le clip', () => { clip.start = v; }, g);
      }, { min: 0, max: 36000, step: 0.01, slider: false })),
      this.prop('Durée (s)', this.numberCtl('Durée', () => clip.duration, (v, g) => {
        const d = Math.min(v, maxDur);
        if (!fitsOnTrack(track, clip.start, d, clip.id)) { toast('Le clip chevaucherait le suivant.'); this.refresh(); return; }
        this.edit('Durée du clip', () => { clip.duration = d; }, g);
      }, { min: 0.1, max: 36000, step: 0.01, slider: false })),
      media ? el('p', { class: 'small muted', text: `Source : ${media.name}${media.duration ? ` · ${media.duration.toFixed(2)} s` : ''}${media.width ? ` · ${media.width}×${media.height}` : ''}` }) : null,
    ]));

    if (clip.type === 'text') this.body.append(this.textSection(clip));
    if (clip.type === 'shape') this.body.append(this.shapeSection(clip));
    if (clip.type === 'fx') this.body.append(...this.fxSection(clip));
    if (isVisual(clip)) {
      this.body.append(this.transformSection(p, clip));
      if (clip.type === 'video' || clip.type === 'image') this.body.append(this.framingSection(clip));
    }
    if (clip.type === 'video' || clip.type === 'audio') this.body.append(this.timingAudioSection(clip, media));
    if (isVisual(clip)) {
      this.body.append(this.effectsSection(clip), this.transitionsSection(clip));
    }
  }

  transformSection(p, clip) {
    const T = clip.transform;
    const rows = [];
    for (const [key, def] of Object.entries(ANIMATABLE)) rows.push(...this.animatedProp(clip, key, def, { get: () => T[key] ?? def.def, set: (v) => { T[key] = v; } }));
    rows.push(this.prop('Profondeur', this.numberCtl('Profondeur (parallaxe)', () => T.depth || 0, (v, g) => this.edit('Profondeur', () => { T.depth = v; }, g), { min: -1, max: 1, step: 0.05 })));
    rows.push(this.choose('Fusion', BLEND_LABELS, () => T.blend || 'normal', (v) => this.edit('Mode de fusion', () => { T.blend = v; })));
    const presets = el('div', { class: 'preset-grid' }, Object.entries(MOTION_PRESETS).map(([id, pr]) => el('button', {
      type: 'button', class: 'preset', onclick: () => this.edit(`Animation : ${pr.label}`, () => {
        for (const [prop, t, v, ease] of pr.apply(clip, p.width, p.height)) { if (t <= clip.duration + 1e-6) setKeyframe(clip, prop, clamp(t, 0, clip.duration), v, ease); }
      }),
    }, [el('b', { text: pr.label })])));
    rows.push(el('div', { class: 'row' }, [
      el('span', { class: 'label grow', text: 'Préréglages de mouvement' }),
      button('Effacer les images clés', { cls: 'sm', onclick: () => this.edit('Effacer les images clés', () => { clip.keyframes = {}; }) }),
    ]), presets);
    rows.push(el('p', { class: 'small muted', text: 'Le losange pose une image clé à la tête de lecture. Dès qu\'une propriété est animée, toute modification crée ou met à jour l\'image clé à l\'instant courant. Rotation 3D : rendu 2,5D (perspective simulée).' }));
    return this.section('Transformation et animation', rows);
  }

  framingSection(clip) {
    const crop = clip.crop || (clip.crop = { l: 0, t: 0, r: 0, b: 0 });
    const cropCtl = (k, label) => this.prop(label, this.numberCtl(label, () => crop[k], (v, g) => this.edit('Recadrage', () => { crop[k] = v; }, g), { min: 0, max: 0.45, step: 0.005 }));
    return this.section('Cadrage et recadrage', [
      this.choose('Ajustement', { cover: 'Remplir le cadre', contain: 'Contenir (sans rognage)', fill: 'Étirer', none: 'Taille d\'origine' }, () => clip.fit, (v) => this.edit('Ajustement', () => { clip.fit = v; })),
      cropCtl('l', 'Rogner gauche'), cropCtl('r', 'Rogner droite'), cropCtl('t', 'Rogner haut'), cropCtl('b', 'Rogner bas'),
    ], false);
  }

  timingAudioSection(clip, media) {
    const rows = [
      this.prop('Vitesse', this.numberCtl('Vitesse', () => clip.speed || 1, (v, g) => this.edit('Vitesse', () => {
        const old = clip.speed || 1;
        clip.speed = v;
        clip.duration = clip.duration * old / v;
        if (media?.duration) clip.duration = Math.min(clip.duration, (media.duration - (clip.in || 0)) / v);
      }, g), { min: 0.1, max: 8, step: 0.05 })),
      this.prop('Point d\'entrée (s)', this.numberCtl('Point d\'entrée', () => clip.in || 0, (v, g) => this.edit('Point d\'entrée', () => {
        clip.in = media?.duration ? Math.min(v, media.duration - 0.1) : v;
        if (media?.duration) clip.duration = Math.min(clip.duration, (media.duration - clip.in) / (clip.speed || 1));
      }, g), { min: 0, max: media?.duration || 3600, step: 0.01 })),
      this.prop('Volume', this.numberCtl('Volume', () => clip.volume ?? 1, (v, g) => this.edit('Volume', () => { clip.volume = v; }, g), { min: 0, max: 2, step: 0.01 })),
      this.prop('Fondu entrée (s)', this.numberCtl('Fondu audio entrée', () => clip.fadeIn || 0, (v, g) => this.edit('Fondu audio', () => { clip.fadeIn = Math.min(v, clip.duration / 2); }, g), { min: 0, max: 10, step: 0.1 })),
      this.prop('Fondu sortie (s)', this.numberCtl('Fondu audio sortie', () => clip.fadeOut || 0, (v, g) => this.edit('Fondu audio', () => { clip.fadeOut = Math.min(v, clip.duration / 2); }, g), { min: 0, max: 10, step: 0.1 })),
    ];
    if (clip.type === 'video' && media && !media.hasAudio) rows.push(el('p', { class: 'small muted', text: 'Cette vidéo ne contient pas de piste son lisible.' }));
    return this.section('Temps et audio', rows);
  }

  textSection(clip) {
    const t = clip.text;
    const area = el('textarea', { rows: 3, 'aria-label': 'Texte' });
    area.value = t.content;
    area.addEventListener('input', () => this.edit('Modifier le texte', () => { t.content = area.value.slice(0, 2000); }, `txt-${clip.id}`));
    area.addEventListener('blur', () => this.store.endGesture());
    this.bindings.push(() => { if (document.activeElement !== area) area.value = t.content; });
    const n = (label, key, opts, obj = t) => this.prop(label, this.numberCtl(label, () => obj[key], (v, g) => this.edit(label, () => { obj[key] = v; }, g), opts));
    const anims = Object.fromEntries(Object.entries(TEXT_ANIMATIONS).map(([k, v]) => [k, v.label]));
    return el('div', { class: 'stack' }, [
      this.section('Texte', [
        area,
        this.choose('Police', Object.fromEntries(FONTS.map((f) => [f, f])), () => t.font, (v) => this.edit('Police', () => { t.font = v; })),
        this.choose('Graisse', { 300: 'Fine', 400: 'Normale', 500: 'Moyenne', 600: 'Semi-grasse', 700: 'Grasse', 800: 'Extra-grasse', 900: 'Noire' }, () => t.weight, (v) => this.edit('Graisse', () => { t.weight = Number(v); })),
        n('Taille (px)', 'size', { min: 8, max: 600, step: 1 }),
        this.color('Couleur', () => t.color, (v, g) => this.edit('Couleur du texte', () => { t.color = v; }, g)),
        this.choose('Alignement', { left: 'Gauche', center: 'Centré', right: 'Droite' }, () => t.align, (v) => this.edit('Alignement', () => { t.align = v; })),
        n('Interligne', 'lineHeight', { min: 0.7, max: 3, step: 0.05 }),
        n('Espacement', 'letterSpacing', { min: -0.1, max: 1, step: 0.01 }),
        n('Largeur max.', 'boxWidth', { min: 0.1, max: 1, step: 0.01 }),
        this.check('Majuscules', () => t.uppercase, (v) => this.edit('Majuscules', () => { t.uppercase = v; })),
        this.check('Italique', () => t.italic, (v) => this.edit('Italique', () => { t.italic = v; })),
      ]),
      this.section('Animation du texte', [
        this.choose('Entrée', anims, () => t.animIn.type, (v) => this.edit('Animation d\'entrée', () => { t.animIn.type = v; })),
        n('Durée entrée', 'duration', { min: 0, max: 5, step: 0.05 }, t.animIn),
        n('Décalage', 'stagger', { min: 0, max: 0.5, step: 0.01 }, t.animIn),
        this.choose('Sortie', anims, () => t.animOut.type, (v) => this.edit('Animation de sortie', () => { t.animOut.type = v; })),
        n('Durée sortie', 'duration', { min: 0, max: 5, step: 0.05 }, t.animOut),
      ]),
      this.section('Contour, ombre et fond', [
        n('Contour (px)', 'width', { min: 0, max: 30, step: 0.5 }, t.stroke),
        this.color('Couleur contour', () => t.stroke.color, (v, g) => this.edit('Contour', () => { t.stroke.color = v; }, g)),
        n('Ombre (flou)', 'blur', { min: 0, max: 80, step: 1 }, t.shadow),
        this.color('Couleur ombre', () => t.shadow.color, (v, g) => this.edit('Ombre', () => { t.shadow.color = v; }, g)),
        n('Ombre Y', 'y', { min: -60, max: 60, step: 1 }, t.shadow),
        this.check('Bandeau de fond', () => t.background.enabled, (v) => this.edit('Bandeau de fond', () => { t.background.enabled = v; })),
        t.background.enabled ? this.color('Couleur bandeau', () => t.background.color, (v, g) => this.edit('Bandeau', () => { t.background.color = v; }, g)) : null,
        t.background.enabled ? n('Marge bandeau', 'padding', { min: 0, max: 120, step: 1 }, t.background) : null,
        t.background.enabled ? n('Arrondi', 'radius', { min: 0, max: 120, step: 1 }, t.background) : null,
        this.check('Mots en couleur', () => t.highlight?.enabled, (v) => this.edit('Mots en couleur', () => { t.highlight = { ...(t.highlight || { words: '', color: '#F96A00' }), enabled: v }; })),
        this.textInput('Mots à colorer', () => t.highlight?.words || '', (v) => this.edit('Mots en couleur', () => { t.highlight = { ...(t.highlight || { color: '#F96A00', enabled: true }), words: v }; })),
        this.color('Couleur des mots', () => t.highlight?.color || '#F96A00', (v, g) => this.edit('Mots en couleur', () => { t.highlight = { ...(t.highlight || { words: '', enabled: true }), color: v }; }, g)),
      ], false),
    ]);
  }

  textInput(label, get, set) {
    const input = el('input', { type: 'text', 'aria-label': label });
    input.addEventListener('change', () => set(input.value.slice(0, 200)));
    this.bindings.push(() => { if (document.activeElement !== input) input.value = get(); });
    input.value = get();
    return this.prop(label, el('div', { class: 'ctl grow' }, [input]));
  }

  shapeSection(clip) {
    const s = clip.shape;
    const n = (label, key, opts, obj = s) => this.prop(label, this.numberCtl(label, () => obj[key], (v, g) => this.edit(label, () => { obj[key] = v; }, g), opts));
    return this.section('Forme', [
      this.choose('Type', { rect: 'Rectangle', circle: 'Ellipse', triangle: 'Triangle', line: 'Ligne' }, () => s.kind, (v) => this.edit('Type de forme', () => { s.kind = v; })),
      this.check('Plein cadre', () => s.fullFrame, (v) => this.edit('Plein cadre', () => { s.fullFrame = v; })),
      n('Largeur', 'width', { min: 1, max: 8000, step: 1 }),
      n('Hauteur', 'height', { min: 1, max: 8000, step: 1 }),
      n('Arrondi', 'radius', { min: 0, max: 2000, step: 1 }),
      this.color('Couleur', () => s.fill, (v, g) => this.edit('Couleur', () => { s.fill = v; }, g)),
      this.check('Dégradé', () => Boolean(s.fill2), (v) => this.edit('Dégradé', () => { s.fill2 = v ? '#FFB15C' : ''; })),
      s.fill2 ? this.color('Couleur 2', () => s.fill2, (v, g) => this.edit('Dégradé', () => { s.fill2 = v; }, g)) : null,
      s.fill2 ? n('Angle (°)', 'gradientAngle', { min: 0, max: 360, step: 1 }) : null,
      n('Contour (px)', 'width', { min: 0, max: 100, step: 0.5 }, s.stroke),
      this.color('Couleur contour', () => s.stroke.color, (v, g) => this.edit('Contour', () => { s.stroke.color = v; }, g)),
      this.choose('Révélation', { none: 'Aucune', 'grow-x': 'Déploiement horizontal', 'grow-y': 'Déploiement vertical', scale: 'Agrandissement' }, () => s.reveal?.type || 'none', (v) => this.edit('Révélation', () => { s.reveal = { duration: 0.6, ...(s.reveal || {}), type: v }; })),
    ]);
  }

  fxSection(clip) {
    const def = FRAME_EFFECTS[clip.fx.type];
    const out = [this.section('Effet', [
      this.choose('Type d\'effet', Object.fromEntries(Object.entries(FRAME_EFFECTS).map(([k, v]) => [k, v.label])), () => clip.fx.type, (v) => this.edit('Type d\'effet', () => { clip.fx = { type: v, params: defaultParams(FRAME_EFFECTS[v]) }; })),
      el('p', { class: 'small muted', text: 'Un clip d\'effet s\'applique à tout ce qui se trouve sur les pistes situées en dessous de la sienne.' }),
      ...this.paramControls(def, clip.fx.params, 'Effet'),
    ])];
    if (def?.camera) {
      clip.camera = clip.camera || {};
      const rows = [];
      for (const [key, d] of Object.entries(CAMERA_PROPS)) rows.push(...this.animatedProp(clip, key, d, { get: () => clip.camera[key] ?? d.def, set: (v) => { clip.camera[key] = v; } }));
      rows.push(el('p', { class: 'small muted', text: 'Parallaxe et profondeur de champ : réglez la « Profondeur » de chaque calque (−1 lointain, +1 proche). Le flou dépend de l\'écart entre la profondeur du calque et le plan de netteté.' }));
      out.push(this.section('Caméra', rows));
    }
    return out;
  }

  paramControls(def, params, label) {
    if (!def) return [];
    return def.params.map((pd) => {
      if (params[pd.key] === undefined) params[pd.key] = pd.default;
      if (pd.type === 'color') return this.color(pd.label, () => params[pd.key], (v, g) => this.edit(label, () => { params[pd.key] = v; }, g));
      if (pd.type === 'select') return this.choose(pd.label, pd.options, () => params[pd.key], (v) => this.edit(label, () => { params[pd.key] = v; }));
      return this.prop(pd.label, this.numberCtl(pd.label, () => params[pd.key], (v, g) => this.edit(label, () => { params[pd.key] = v; }, g), { min: pd.min, max: pd.max, step: pd.step }));
    });
  }

  effectsSection(clip) {
    const list = el('div', { class: 'stack' });
    (clip.effects || []).forEach((fx, i) => {
      const def = LAYER_EFFECTS[fx.type];
      if (!def) return;
      const enabled = el('input', { type: 'checkbox', checked: fx.enabled !== false, 'aria-label': `Activer ${def.label}` });
      enabled.addEventListener('change', () => this.edit('Activer l\'effet', () => { fx.enabled = enabled.checked; }));
      list.append(el('div', { class: 'effect-card' }, [
        el('header', {}, [enabled, el('span', { class: 'grow', text: def.label }),
          button('Monter', { icon: 'prev', iconOnly: true, cls: 'sm ghost', disabled: i === 0, onclick: () => this.edit('Ordre des effets', () => { const a = clip.effects; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }) }),
          button('Retirer l\'effet', { icon: 'trash', iconOnly: true, cls: 'sm ghost', onclick: () => this.edit('Retirer l\'effet', () => { clip.effects.splice(i, 1); }) })]),
        ...this.paramControls(def, fx.params, def.label),
      ]));
    });
    const add = select({ '': 'Ajouter un effet…', ...Object.fromEntries(Object.entries(LAYER_EFFECTS).map(([k, v]) => [k, v.label])) }, '', (v) => {
      if (!v) return;
      this.edit('Ajouter un effet', () => { clip.effects = clip.effects || []; clip.effects.push(newEffect(v)); });
    }, { 'aria-label': 'Ajouter un effet' });
    return this.section(`Effets (${(clip.effects || []).length})`, [list, add], Boolean(clip.effects?.length));
  }

  transitionsSection(clip) {
    const opts = { '': 'Aucune', ...Object.fromEntries(Object.entries(TRANSITIONS).map(([k, v]) => [k, v.label])) };
    const make = (which, label) => [
      this.choose(label, opts, () => clip[which]?.type || '', (v) => this.edit('Transition', () => { clip[which] = v ? { type: v, duration: clip[which]?.duration || Math.min(0.6, clip.duration / 2) } : null; })),
      clip[which] ? this.prop('Durée (s)', this.numberCtl(`Durée ${label}`, () => clip[which].duration, (v, g) => this.edit('Durée de transition', () => { clip[which].duration = Math.min(v, clip.duration); }, g), { min: 0.05, max: 5, step: 0.05 })) : null,
    ];
    return this.section('Transitions', [
      ...make('transitionIn', 'Entrée'), ...make('transitionOut', 'Sortie'),
      el('p', { class: 'small muted', text: 'Fondu enchaîné : faites chevaucher deux clips sur deux pistes et appliquez une transition d\'entrée au clip du dessus.' }),
    ], Boolean(clip.transitionIn || clip.transitionOut));
  }
}

export { BLEND_MODES };
