// Assistant IA : brief → scénario et storyboard → plan de montage → composition éditable.

import { el, deepClone } from '../util.js';
import { openDialog, button, field, select, toast } from './common.js';
import { status as aiStatus, generatePlan, revisePlan, setCode, getCode, AIError } from '../ai/assistant.js';
import { localPlan } from '../ai/planner.js';
import { buildProject, planDuration, scalePlan } from '../builder.js';
import { ASPECTS } from '../model.js';
import { TEXT_ANIMATIONS } from '../engine/text.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { AssetPicker } from './assets.js';
import { renderPlanThumb } from './templatesDialog.js';

const VISUAL_LABELS = { logo: 'Logo', media: 'Média', text: 'Texte', kinetic: 'Typo cinétique', cta: 'Appel à l\'action', split: 'Écran partagé', 'lower-third': 'Bandeau' };

export function openAssistant({ media, initialMediaIds = [], brief = '', hasProject = false, onCreate, onReplace }) {
  let plan = null;
  let configured = false;
  let controller = null;
  const statusEl = el('p', { class: 'note', text: 'Vérification du service d\'IA…' });
  const briefInput = el('textarea', { rows: 4, placeholder: 'Ex. : Crée une publicité vidéo de 30 secondes pour une entreprise, avec un style cinématique, un logo animé, des titres dynamiques, des transitions élégantes, une musique entraînante et un appel à l\'action final.', 'aria-label': 'Brief' });
  briefInput.value = brief;
  const aspect = select({ '': 'Automatique', ...Object.fromEntries(Object.entries(ASPECTS).map(([k, v]) => [k, v.label])) }, '', null);
  const duration = el('input', { type: 'number', min: 3, max: 600, step: 1, placeholder: 'Auto' });
  const brand = el('input', { type: 'text', placeholder: 'Nom de la marque (facultatif)' });
  const picker = new AssetPicker({ media, initialIds: initialMediaIds });
  const result = el('div', { class: 'stack' });
  const progress = el('p', { class: 'note', hidden: true });

  const genBtn = button('Générer avec l\'IA', { icon: 'sparkles', cls: 'primary', onclick: () => run('ai') });
  const localBtn = button('Plan local (sans IA)', { onclick: () => run('local') });

  const body = el('div', { class: 'stack' }, [
    statusEl,
    field('Décrivez la vidéo souhaitée', briefInput),
    el('div', { class: 'grid-3' }, [field('Format', aspect), field('Durée (s)', duration), field('Marque', brand)]),
    el('details', { class: 'group' }, [el('summary', { text: 'Médias à utiliser (logo, images, vidéos, musique, voix off)' }), el('div', { class: 'group-body' }, [picker.root])]),
    el('div', { class: 'row' }, [genBtn, localBtn]),
    progress,
    result,
  ]);
  const dlg = openDialog({ title: 'Assistant IA de création vidéo', wide: true, content: body, onClose: () => controller?.abort() });

  aiStatus().then((s) => {
    configured = s.configured;
    statusEl.className = `note ${configured ? 'ok' : 'warn'}`;
    statusEl.textContent = configured
      ? `Assistant IA connecté (${s.model}). Un code d'accès vous sera demandé.`
      : 'Le service d\'IA n\'est pas configuré sur ce serveur : le bouton « Plan local » propose un plan à partir des modèles, sans IA.';
    genBtn.disabled = !configured;
  }).catch((e) => {
    statusEl.className = 'note warn';
    statusEl.textContent = e instanceof AIError ? e.message : 'Service d\'IA indisponible.';
    genBtn.disabled = true;
  });

  async function askCode() {
    const input = el('input', { type: 'password', autocomplete: 'off', 'aria-label': 'Code d\'accès' });
    const d = openDialog({ title: 'Code d\'accès à l\'assistant IA', content: [el('p', { class: 'small muted', text: 'Ce code protège les crédits d\'IA de votre compte. Il est conservé uniquement pendant cette session.' }), input], actions: [{ label: 'Annuler', value: null }, { label: 'Valider', cls: 'primary', onclick: (close) => close(input.value) }] });
    setTimeout(() => input.focus(), 50);
    const v = await d.closed;
    if (v) setCode(v);
    return v;
  }

  async function run(mode) {
    const text = briefInput.value.trim();
    if (text.length < 10) { toast('Décrivez votre vidéo en quelques phrases.', 'error'); return; }
    const opts = { brief: text, aspect: aspect.value || undefined, duration: Number(duration.value) || undefined, brand: brand.value.trim() || undefined, assets: picker.summary() };
    if (mode === 'local') { plan = localPlan(text, opts); if (plan.scenes.length && !picker.summary().visuals) downgradeMedia(plan); showPlan(); return; }
    if (!getCode() && !(await askCode())) return;
    controller = new AbortController();
    setBusy(true, 'L\'IA analyse votre brief et construit le storyboard… (cela peut prendre une minute)');
    try {
      plan = await generatePlan(opts, controller.signal);
      if (opts.duration) scalePlan(plan, opts.duration);
      showPlan();
    } catch (e) {
      handleError(e);
    } finally { setBusy(false); }
  }

  function downgradeMedia(p) {
    // Sans images ni vidéos, les scènes « média » deviennent des scènes de texte sur fond animé.
    p.scenes.forEach((s) => { if (s.visual === 'media' || s.visual === 'split') s.visual = 'text'; });
  }

  function handleError(e) {
    if (e.name === 'AbortError') return;
    if (e instanceof AIError && (e.code === 'code_invalid' || e.code === 'code_required')) setCode('');
    toast(e.message, 'error', 8000);
    progress.hidden = false; progress.className = 'note err'; progress.textContent = e.message;
  }

  function setBusy(busy, msg) {
    genBtn.disabled = busy || !configured; localBtn.disabled = busy;
    progress.hidden = !busy; progress.className = 'note'; if (msg) progress.textContent = msg;
  }

  function showPlan() {
    const p = plan;
    const thumb = el('canvas', { width: 480, height: 270, style: { width: '100%', maxWidth: '420px', borderRadius: '8px', background: '#000' } });
    renderPlanThumb(thumb, p, media).catch(() => {});
    const scenes = el('div', { class: 'storyboard' }, p.scenes.map((s, i) => {
      const h = el('input', { type: 'text', value: s.headline, 'aria-label': `Titre de la scène ${i + 1}` });
      const sub = el('input', { type: 'text', value: s.subtext, 'aria-label': `Texte de la scène ${i + 1}` });
      const d = el('input', { type: 'number', min: 0.5, max: 60, step: 0.5, value: s.duration, style: { width: '80px' }, 'aria-label': `Durée de la scène ${i + 1}` });
      h.addEventListener('input', () => { s.headline = h.value; });
      sub.addEventListener('input', () => { s.subtext = sub.value; });
      d.addEventListener('change', () => { s.duration = Math.max(0.5, Number(d.value) || s.duration); total.textContent = `Durée totale : ${planDuration(p).toFixed(1)} s`; });
      return el('div', { class: 'scene' }, [el('span', { class: 'num', text: String(i + 1) }), el('div', { class: 'stack', style: { gap: '6px' } }, [
        el('div', { class: 'row' }, [el('b', { class: 'grow', text: s.purpose || VISUAL_LABELS[s.visual] }), d, el('span', { class: 'small muted', text: 's' })]),
        h, sub,
        el('div', { class: 'scene-meta' }, [
          el('span', { class: 'badge accent', text: VISUAL_LABELS[s.visual] }),
          el('span', { class: 'badge', text: TEXT_ANIMATIONS[s.textAnimation]?.label }),
          el('span', { class: 'badge', text: `Transition : ${TRANSITIONS[s.transition]?.label}` }),
          s.camera !== 'static' ? el('span', { class: 'badge', text: `Caméra : ${s.camera}` }) : null,
          ...s.effects.map((e) => el('span', { class: 'badge', text: e })),
        ]),
        s.mediaHint ? el('p', { class: 'small muted', style: { margin: 0 }, text: `Image idéale : ${s.mediaHint}` }) : null,
        s.voiceover ? el('p', { class: 'small', style: { margin: 0 }, text: `Voix off : « ${s.voiceover} »` }) : null,
      ])]);
    }));
    const total = el('span', { class: 'small muted', text: `Durée totale : ${planDuration(p).toFixed(1)} s` });
    const instruction = el('input', { type: 'text', placeholder: 'Ex. : rends le ton plus énergique, raccourcis à 20 secondes, ajoute une scène sur la sécurité…', 'aria-label': 'Modification à demander' });
    const reviseBtn = button('Modifier avec l\'IA', { icon: 'wand', disabled: !configured, onclick: async () => {
      if (instruction.value.trim().length < 3) return;
      if (!getCode() && !(await askCode())) return;
      controller = new AbortController();
      setBusy(true, 'L\'IA révise le plan…');
      try { plan = await revisePlan({ plan, instruction: instruction.value.trim(), assets: picker.summary() }, controller.signal); showPlan(); } catch (e) { handleError(e); } finally { setBusy(false); }
    } });
    const music = p.music || {};
    result.replaceChildren(
      el('hr', { style: { border: 0, borderTop: '1px solid var(--line)', width: '100%' } }),
      el('div', { class: 'row' }, [el('h3', { class: 'grow', text: p.title }), el('span', { class: `badge ${p.source?.kind === 'ai' ? 'accent' : ''}`, text: p.source?.label || '' })]),
      p.summary ? el('p', { class: 'muted', style: { margin: 0 }, text: p.summary }) : null,
      el('div', { class: 'grid-2' }, [
        thumb,
        el('div', { class: 'stack small' }, [
          el('div', { text: `Format ${p.aspect} · ${p.scenes.length} scènes · ambiance « ${p.style.mood} »` }),
          el('div', { text: `Polices : ${p.style.fontHeading} / ${p.style.fontBody} · effets globaux : ${p.style.effects.join(', ') || 'aucun'}` }),
          el('div', { class: 'row' }, Object.values(p.style.palette).map((c) => el('span', { title: c, style: { width: '22px', height: '22px', borderRadius: '50%', background: c, border: '1px solid var(--line-2)' } }))),
          el('div', { text: `Musique suggérée : ${music.mood || '—'}${music.bpm ? ` · ${music.bpm} BPM` : ''}` }),
          music.suggestions?.length ? el('ul', { style: { margin: 0, paddingLeft: '18px' } }, music.suggestions.map((m) => el('li', { text: m }))) : null,
          el('p', { class: 'muted', style: { margin: 0 }, text: 'Importez la musique choisie (libre de droits ou sous licence) dans « Médias à utiliser ». Aucune musique n\'est générée.' }),
          p.notes ? el('p', { class: 'note warn', text: p.notes }) : null,
        ]),
      ]),
      el('div', { class: 'row' }, [el('h3', { class: 'grow', text: 'Storyboard' }), total]),
      scenes,
      el('div', { class: 'row' }, [instruction, reviseBtn]),
      el('div', { class: 'row', style: { justifyContent: 'flex-end' } }, [
        hasProject ? button('Remplacer le projet actuel', { onclick: () => apply('replace') }) : null,
        button('Créer le projet vidéo', { icon: 'film', cls: 'primary', onclick: () => apply('create') }),
      ]),
    );
  }

  function apply(mode) {
    try {
      const project = buildProject(deepClone(plan), { ...picker.assets(), name: plan.title });
      dlg.close();
      if (mode === 'replace') onReplace(project); else onCreate(project);
      toast('Composition créée : chaque élément reste modifiable dans la timeline.', 'success');
    } catch (e) { toast(`Création impossible : ${e.message}`, 'error'); }
  }

  return dlg;
}
