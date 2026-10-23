// Bibliothèque de modèles : aperçus rendus en direct, personnalisation complète, création du projet.

import { el, deepClone } from '../util.js';
import { openDialog, button, field, select, toast } from './common.js';
import { TEMPLATES, CATEGORIES } from '../templates.js';
import { buildProject, normalizePlan, scalePlan, planDuration } from '../builder.js';
import { ASPECTS, FONTS } from '../model.js';
import { Renderer } from '../engine/renderer.js';
import { AssetPicker } from './assets.js';

const renderer = new Renderer();

// Les rendus de miniatures partagent un moteur : ils sont exécutés l'un après l'autre.
let queue = Promise.resolve();
export function renderPlanThumb(canvas, plan, media, t = null) {
  const job = queue.then(() => drawPlanThumb(canvas, plan, media, t));
  queue = job.catch(() => {});
  return job;
}

async function drawPlanThumb(canvas, plan, media, t) {
  const project = buildProject(plan, {});
  const scale = canvas.width / project.width;
  canvas.height = Math.round(project.height * scale);
  await renderer.loadFonts(project);
  const env = { media: { get: (id) => media.get(id) }, frames: { image: async () => null, video: async () => null } };
  await renderer.render(canvas, project, t ?? Math.min(planDuration(project.plan) * 0.5, project.plan.scenes[0].duration * 0.7), env);
}

export function openTemplates({ media, initialMediaIds = [], onCreate }) {
  let category = 'all';
  const grid = el('div', { class: 'cards' });
  const chips = el('div', { class: 'chips' });
  const content = el('div', { class: 'stack' }, [chips, grid]);
  const dlg = openDialog({ title: 'Modèles vidéo', wide: true, content });

  const drawChips = () => {
    chips.replaceChildren(...[['all', 'Tous'], ...Object.entries(CATEGORIES)].map(([id, label]) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(category === id), onclick: () => { category = id; drawChips(); drawGrid(); },
    }, [label])));
  };
  const drawGrid = () => {
    grid.replaceChildren();
    for (const tpl of TEMPLATES.filter((t) => category === 'all' || t.category === category)) {
      const cv = el('canvas', { width: 320, height: 180 });
      const plan = normalizePlan(tpl.plan);
      grid.append(el('article', { class: 'card' }, [
        el('div', { class: 'card-thumb' }, [cv, el('span', { class: 'badge', text: `${plan.aspect} · ${planDuration(plan)} s` })]),
        el('div', { class: 'card-body' }, [
          el('h3', { text: tpl.name }), el('p', { text: tpl.description }), el('p', { class: 'small', text: CATEGORIES[tpl.category] }),
          el('div', { class: 'card-actions' }, [button('Personnaliser', { cls: 'primary sm', onclick: () => customize(tpl) })]),
        ]),
      ]));
      renderPlanThumb(cv, plan, media).catch((e) => console.warn(e));
    }
  };

  const customize = (tpl) => {
    const plan = normalizePlan(deepClone(tpl.plan));
    plan.title = tpl.name;
    const picker = new AssetPicker({ media, initialIds: initialMediaIds });
    const pal = plan.style.palette;
    const preview = el('canvas', { width: 480, height: 270, style: { width: '100%', borderRadius: '8px', background: '#000' } });
    const refresh = () => renderPlanThumb(preview, plan, media).catch(() => {});
    const colorInput = (key, label) => {
      const i = el('input', { type: 'color', value: pal[key], 'aria-label': label });
      i.addEventListener('input', () => { pal[key] = i.value; refresh(); });
      return field(label, i);
    };
    const durationInput = el('input', { type: 'number', min: 3, max: 600, step: 1, value: planDuration(plan) });
    const scenes = el('div', { class: 'storyboard' }, plan.scenes.map((s, i) => {
      const h = el('input', { type: 'text', value: s.headline, 'aria-label': `Titre scène ${i + 1}` });
      const sub = el('input', { type: 'text', value: s.subtext, 'aria-label': `Texte scène ${i + 1}` });
      h.addEventListener('input', () => { s.headline = h.value; });
      h.addEventListener('change', refresh);
      sub.addEventListener('input', () => { s.subtext = sub.value; });
      return el('div', { class: 'scene' }, [el('span', { class: 'num', text: String(i + 1) }), el('div', { class: 'stack', style: { gap: '6px' } }, [
        el('div', { class: 'small muted', text: `${s.duration} s · ${s.visual} · animation ${s.textAnimation} · transition ${s.transition}` }), h, sub,
      ])]);
    }));
    const body = el('div', { class: 'stack' }, [
      el('div', { class: 'grid-2' }, [
        el('div', { class: 'stack' }, [
          field('Nom du projet', el('input', { type: 'text', value: plan.title, oninput: (e) => { plan.title = e.target.value; } })),
          el('div', { class: 'grid-2' }, [
            field('Format', select(Object.fromEntries(Object.entries(ASPECTS).map(([k, v]) => [k, v.label])), plan.aspect, (v) => { plan.aspect = v; refresh(); })),
            field('Durée totale (s)', durationInput),
          ]),
          el('div', { class: 'grid-2' }, [
            field('Police des titres', select(Object.fromEntries(FONTS.map((f) => [f, f])), plan.style.fontHeading, (v) => { plan.style.fontHeading = v; refresh(); })),
            field('Police des textes', select(Object.fromEntries(FONTS.map((f) => [f, f])), plan.style.fontBody, (v) => { plan.style.fontBody = v; })),
          ]),
          el('div', { class: 'row', style: { gap: '14px', flexWrap: 'wrap' } }, [colorInput('background', 'Fond'), colorInput('primary', 'Principale'), colorInput('accent', 'Accent'), colorInput('text', 'Texte')]),
        ]),
        el('div', { class: 'stack' }, [preview, el('p', { class: 'small muted', text: 'Aperçu sans vos médias ; ils seront intégrés à la création du projet.' })]),
      ]),
      el('h3', { text: 'Textes des scènes' }), scenes,
      el('h3', { text: 'Vos médias' }), picker.root,
    ]);
    refresh();
    const d2 = openDialog({
      title: `Personnaliser : ${tpl.name}`, wide: true, content: body,
      actions: [{ label: 'Retour', value: null }, {
        label: 'Créer le projet', cls: 'primary', onclick: (close) => {
          const total = Number(durationInput.value);
          if (total && Math.abs(total - planDuration(plan)) > 0.05) scalePlan(plan, total);
          try {
            const project = buildProject(plan, { ...picker.assets(), name: plan.title });
            close(); dlg.close();
            onCreate(project);
          } catch (e) { toast(`Création impossible : ${e.message}`, 'error'); }
        },
      }],
    });
    return d2;
  };

  drawChips();
  drawGrid();
  return dlg;
}
