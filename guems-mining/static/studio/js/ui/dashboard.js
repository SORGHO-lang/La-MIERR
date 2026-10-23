// Tableau de bord : projets, création, modèles, assistant IA, import / export de projets.

import { el, formatTime, downloadBlob } from '../util.js';
import { button, openDialog, field, select, toast, confirmDialog, icon } from './common.js';
import { db } from '../db.js';
import { createProject, ASPECTS, FPS_OPTIONS, projectDuration } from '../model.js';
import { TEMPLATES, CATEGORIES } from '../templates.js';
import { normalizePlan, planDuration } from '../builder.js';
import { openTemplates, renderPlanThumb } from './templatesDialog.js';
import { openAssistant } from './aiDialog.js';
import { exportPackage, importPackage } from '../projectio.js';

export class Dashboard {
  constructor({ media, openProject }) {
    this.media = media;
    this.openProject = openProject;
    this.root = el('main', { class: 'dashboard', id: 'contenu' });
  }

  async render() {
    const projects = await db.listProjects();
    const brief = el('textarea', { rows: 4, placeholder: 'Décrivez la vidéo à créer : objectif, durée, format, ton, appel à l\'action…', 'aria-label': 'Brief pour l\'assistant IA' });
    const fileInput = el('input', { type: 'file', accept: '.gmstudio,.json', hidden: true, onchange: (e) => this.importProject(e.target.files[0]) });
    const inner = el('div', { class: 'dash-inner' }, [
      el('section', { class: 'dash-hero' }, [
        el('div', { class: 'hero-card' }, [
          el('h1', { text: 'Créez des vidéos et des animations professionnelles' }),
          el('p', { text: 'Montage multipiste, motion design par images clés, effets, transitions, modèles prêts à l\'emploi et assistant IA. Les rendus sont encodés directement dans votre navigateur.' }),
          el('div', { class: 'quick-actions' }, [
            button('Nouveau projet', { icon: 'plus', cls: 'primary', onclick: () => this.newProject() }),
            button('Modèles vidéo', { icon: 'grid', onclick: () => openTemplates({ media: this.media, onCreate: (p) => this.create(p) }) }),
            button('Importer un projet', { icon: 'upload', onclick: () => fileInput.click() }),
            fileInput,
          ]),
        ]),
        el('div', { class: 'ai-card' }, [
          el('h2', { class: 'row', style: { fontSize: '16px' } }, [icon('sparkles'), 'Assistant IA']),
          brief,
          button('Créer avec l\'assistant', { icon: 'sparkles', cls: 'primary', onclick: () => openAssistant({ media: this.media, brief: brief.value, onCreate: (p) => this.create(p) }) }),
        ]),
      ]),
      this.projectsSection(projects),
      this.templatesSection(),
    ]);
    this.root.replaceChildren(inner);
  }

  projectsSection(projects) {
    const grid = el('div', { class: 'cards' });
    if (!projects.length) grid.append(el('p', { class: 'empty', text: 'Aucun projet pour l\'instant. Créez un projet vide, partez d\'un modèle ou décrivez votre vidéo à l\'assistant.' }));
    for (const p of projects) {
      grid.append(el('article', { class: 'card' }, [
        el('button', { type: 'button', class: 'card-thumb', style: { border: 0, padding: 0, cursor: 'pointer', aspectRatio: '16 / 9' }, onclick: () => this.openProject(p.id), 'aria-label': `Ouvrir ${p.name}` }, [
          p.thumb ? el('img', { src: p.thumb, alt: '' }) : icon('film'),
          el('span', { class: 'badge', text: `${p.aspect} · ${formatTime(projectDuration(p), p.fps).slice(0, 5)}` }),
        ]),
        el('div', { class: 'card-body' }, [
          el('h3', { text: p.name }),
          el('p', { text: `Modifié le ${new Date(p.updatedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}` }),
          el('div', { class: 'card-actions' }, [
            button('Ouvrir', { cls: 'primary sm', onclick: () => this.openProject(p.id) }),
            button('Dupliquer', { icon: 'copy', iconOnly: true, cls: 'sm', onclick: () => this.duplicate(p) }),
            button('Enregistrer le fichier du projet', { icon: 'download', iconOnly: true, cls: 'sm', onclick: () => this.exportFile(p) }),
            button('Supprimer', { icon: 'trash', iconOnly: true, cls: 'sm danger', onclick: () => this.remove(p) }),
          ]),
        ]),
      ]));
    }
    return el('section', {}, [el('div', { class: 'section-title' }, [el('h2', { text: 'Mes projets' }), el('span', { class: 'muted small', text: 'Enregistrés dans ce navigateur' })]), grid]);
  }

  templatesSection() {
    const grid = el('div', { class: 'cards' });
    for (const tpl of TEMPLATES.slice(0, 8)) {
      const cv = el('canvas', { width: 320, height: 180 });
      const plan = normalizePlan(tpl.plan);
      grid.append(el('article', { class: 'card' }, [
        el('div', { class: 'card-thumb' }, [cv, el('span', { class: 'badge', text: `${plan.aspect} · ${planDuration(plan)} s` })]),
        el('div', { class: 'card-body' }, [el('h3', { text: tpl.name }), el('p', { text: CATEGORIES[tpl.category] })]),
      ]));
      renderPlanThumb(cv, plan, this.media).catch(() => {});
    }
    return el('section', {}, [
      el('div', { class: 'section-title' }, [el('h2', { text: 'Modèles prêts à l\'emploi' }), button('Voir les 18 modèles', { onclick: () => openTemplates({ media: this.media, onCreate: (p) => this.create(p) }) })]),
      grid,
    ]);
  }

  newProject() {
    const name = el('input', { type: 'text', value: 'Nouveau projet' });
    let aspect = '16:9'; let fps = 30;
    const cards = el('div', { class: 'option-cards' }, Object.entries(ASPECTS).map(([k, v]) => el('label', { class: 'option-card' }, [
      el('input', { type: 'radio', name: 'aspect', value: k, checked: k === aspect, onchange: () => { aspect = k; } }), el('b', { text: k }), el('span', { text: v.label }),
    ])));
    openDialog({
      title: 'Nouveau projet',
      content: [field('Nom du projet', name), el('span', { class: 'label', text: 'Format' }), cards, field('Images par seconde', select(Object.fromEntries(FPS_OPTIONS.map((f) => [f, `${f} i/s`])), fps, (v) => { fps = Number(v); }))],
      actions: [{ label: 'Annuler' }, { label: 'Créer', cls: 'primary', onclick: (close) => { close(); this.create(createProject({ name: name.value.trim() || 'Nouveau projet', aspect, fps })); } }],
    });
  }

  async create(project) {
    await db.putProject(project);
    this.openProject(project.id);
  }

  async duplicate(p) {
    const copy = JSON.parse(JSON.stringify(p));
    copy.id = `prj_${Math.random().toString(36).slice(2, 10)}`;
    copy.name = `${p.name} (copie)`;
    copy.createdAt = copy.updatedAt = Date.now();
    await db.putProject(copy);
    this.render();
  }

  async remove(p) {
    if (!(await confirmDialog(`Supprimer définitivement le projet « ${p.name} » ? Les médias importés restent disponibles pour vos autres projets.`, { danger: true, confirmLabel: 'Supprimer' }))) return;
    await db.deleteProject(p.id);
    toast('Projet supprimé.');
    this.render();
  }

  async exportFile(p) {
    await this.media.loadProjectMedia(p.mediaIds);
    const blob = await exportPackage(p, this.media);
    downloadBlob(blob, `${p.name.replace(/[^\p{L}\p{N} _-]+/gu, '').trim() || 'projet'}.gmstudio`);
  }

  async importProject(file) {
    if (!file) return;
    try {
      const p = await importPackage(file, this.media);
      toast('Projet importé.', 'success');
      this.openProject(p.id);
    } catch (e) { toast(`Import impossible : ${e.message}`, 'error'); }
  }
}
