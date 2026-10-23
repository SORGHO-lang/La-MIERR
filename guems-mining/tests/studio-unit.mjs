// Tests unitaires du Studio (logique pure, sans navigateur) : node tests/studio-unit.mjs
import assert from 'node:assert/strict';
import { getEasing, valueAt, setKeyframe, removeKeyframe, keyframeAt, shiftKeyframes, interpolate } from '../static/studio/js/engine/easing.js';
import { createProject, createClip, createTrack, fitsOnTrack, firstFreeSlot, projectDuration, trackAccepts, sanitizeProject } from '../static/studio/js/model.js';
import { buildProject, normalizePlan, scalePlan, planDuration } from '../static/studio/js/builder.js';
import { TEMPLATES, CATEGORIES } from '../static/studio/js/templates.js';
import { localPlan } from '../static/studio/js/ai/planner.js';
import { parseSrt } from '../static/studio/js/subtitles.js';
import { transitionState, TRANSITIONS } from '../static/studio/js/engine/transitions.js';
import { outputSize } from '../static/studio/js/engine/exporter.js';

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`✓ ${name}`); };

test('courbes d\'accélération', () => {
  for (const name of ['linear', 'easeIn', 'easeOut', 'easeInOut', 'easeOutBack', 'easeOutElastic', 'easeOutBounce']) {
    assert.ok(Math.abs(getEasing(name)(0)) < 1e-9, name);
    assert.ok(Math.abs(getEasing(name)(1) - 1) < 1e-9, name);
  }
  assert.equal(getEasing('cubic-bezier(0.42,0,0.58,1)')(0.5).toFixed(3), '0.500');
  assert.equal(getEasing('inconnue')(0.3), 0.3);
});

test('images clés : interpolation, couleurs, ajout, suppression, décalage', () => {
  const c = { keyframes: {} };
  setKeyframe(c, 'x', 0, 0, 'linear');
  setKeyframe(c, 'x', 2, 100, 'linear');
  assert.equal(valueAt(c, 'x', 1, 0), 50);
  assert.equal(valueAt(c, 'x', -1, 0), 0);
  assert.equal(valueAt(c, 'x', 5, 0), 100);
  setKeyframe(c, 'x', 2, 80);
  assert.equal(c.keyframes.x.length, 2, 'mise à jour au même instant');
  assert.ok(keyframeAt(c, 'x', 2));
  removeKeyframe(c, 'x', 2);
  assert.equal(c.keyframes.x.length, 1);
  assert.equal(interpolate('#000000', '#ffffff', 0.5), '#808080');
  const d = { keyframes: { y: [{ t: 0, v: 0 }, { t: 1, v: 1 }, { t: 3, v: 3 }] } };
  shiftKeyframes(d, 1);
  assert.deepEqual(d.keyframes.y.map((k) => k.t), [0, 2]);
});

test('pistes : chevauchements et emplacement libre', () => {
  const t = createTrack('video');
  t.clips.push(createClip('image', { start: 0, duration: 5 }), createClip('image', { start: 8, duration: 2 }));
  assert.equal(fitsOnTrack(t, 4, 2), false);
  assert.equal(fitsOnTrack(t, 5, 3), true);
  assert.equal(firstFreeSlot(t, 1, 4), 10);
  assert.equal(firstFreeSlot(t, 1, 3), 5);
  assert.ok(trackAccepts(t, createClip('text')));
  assert.ok(!trackAccepts(t, createClip('audio')));
  assert.ok(!trackAccepts(createTrack('audio'), createClip('image')));
});

test('projet : durée et réparation', () => {
  const p = createProject({ aspect: '9:16', fps: 25 });
  assert.equal(p.width, 1080); assert.equal(p.height, 1920); assert.equal(p.fps, 25);
  p.tracks[1].clips.push(createClip('text', { start: 3, duration: 4 }));
  assert.equal(projectDuration(p), 7);
  const bad = sanitizeProject({ tracks: [{ clips: [{ start: 0, duration: -1 }, { start: 1, duration: 2 }] }], width: 99999, fps: 7 });
  assert.equal(bad.tracks[0].clips.length, 1); assert.equal(bad.width, 7680); assert.equal(bad.fps, 30);
  assert.throws(() => sanitizeProject(null));
});

test('les 18 modèles couvrent les 14 catégories et produisent des compositions sans chevauchement', () => {
  assert.equal(TEMPLATES.length, 18);
  assert.deepEqual(new Set(TEMPLATES.map((t) => t.category)), new Set(Object.keys(CATEGORIES)));
  for (const tpl of TEMPLATES) {
    const p = buildProject(tpl.plan, {});
    assert.ok(Math.abs(projectDuration(p) - planDuration(normalizePlan(tpl.plan))) < 1.01, `${tpl.id} durée`);
    for (const tr of p.tracks) for (const c of tr.clips) {
      assert.ok(trackAccepts(tr, c), `${tpl.id} : clip ${c.type} sur piste ${tr.kind}`);
      assert.ok(fitsOnTrack(tr, c.start, c.duration, c.id), `${tpl.id} : chevauchement sur ${tr.name}`);
    }
  }
});

test('plan : normalisation d\'une sortie non fiable et mise à l\'échelle', () => {
  const p = normalizePlan({ aspect: '3:2', scenes: [{ duration: 999, visual: 'xxx', textAnimation: 'boom', transition: 'nope', effects: ['glow', 'rm -rf'], camera: 'fly' }], style: { palette: { primary: 'red' } } });
  assert.equal(p.aspect, '16:9');
  assert.equal(p.scenes[0].duration, 60);
  assert.equal(p.scenes[0].visual, 'text');
  assert.ok(TRANSITIONS[p.scenes[0].transition]);
  assert.deepEqual(p.scenes[0].effects, ['glow']);
  assert.match(p.style.palette.primary, /^#[0-9A-F]{6}$/i);
  const q = normalizePlan({ scenes: [{ duration: 2 }, { duration: 6 }] });
  scalePlan(q, 16);
  assert.equal(planDuration(q), 16);
});

test('médias assignés aux scènes, musique répétée sur toute la durée', () => {
  const plan = { scenes: [{ duration: 4, visual: 'logo', headline: 'A' }, { duration: 6, visual: 'media', headline: 'B' }, { duration: 5, visual: 'cta', headline: 'C', subtext: 'D' }] };
  const p = buildProject(plan, { logo: { id: 'm1', kind: 'image', name: 'logo.png' }, visuals: [{ id: 'm2', kind: 'video', name: 'v.mp4', duration: 10 }], music: { id: 'm3', kind: 'audio', name: 'a.mp3', duration: 4 } });
  const clips = p.tracks.flatMap((t) => t.clips);
  assert.ok(clips.some((c) => c.type === 'image' && c.mediaId === 'm1'));
  assert.ok(clips.some((c) => c.type === 'video' && c.mediaId === 'm2'));
  const music = clips.filter((c) => c.mediaId === 'm3');
  assert.equal(music.length, 4);
  assert.ok(Math.abs(music.reduce((a, c) => a + c.duration, 0) - 15) < 1e-6);
  assert.deepEqual(new Set(p.mediaIds), new Set(['m1', 'm2', 'm3']));
});

test('planificateur local (sans IA)', () => {
  const p = localPlan('Crée une publicité de 30 secondes pour « Kora Café », appel à l\'action 70 00 00 00, style cinématique');
  assert.equal(p.source.kind, 'local');
  assert.equal(planDuration(p), 30);
  assert.ok(p.scenes.some((s) => s.headline.includes('Kora Café')));
  assert.ok(p.scenes.at(-1).subtext.includes('70 00 00 00'));
  assert.equal(localPlan('Une vidéo TikTok de 15 s pour mon salon').aspect, '9:16');
});

test('sous-titres SRT', () => {
  const cues = parseSrt('1\r\n00:00:01,000 --> 00:00:02,500\r\nBonjour <i>à tous</i>\r\n\r\n2\n00:00:03.000 --> 00:00:04,000\nLigne 1\nLigne 2\n\n3\nmauvais bloc');
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { start: 1, end: 2.5, content: 'Bonjour à tous' });
  assert.equal(cues[1].content, 'Ligne 1\nLigne 2');
});

test('transitions d\'entrée et de sortie', () => {
  const c = { duration: 4, transitionIn: { type: 'fade', duration: 1 }, transitionOut: { type: 'slide-left', duration: 1 } };
  assert.equal(transitionState(c, 0.5, 100, 100, 1).alpha, 0.5);
  assert.equal(transitionState(c, 2, 100, 100, 1), null);
  assert.ok(transitionState(c, 3.5, 100, 100, 1).dx < 0);
});

test('dimensions d\'export (petit côté, dimensions paires)', () => {
  assert.deepEqual(outputSize({ width: 1920, height: 1080 }, '720p'), { width: 1280, height: 720 });
  assert.deepEqual(outputSize({ width: 1080, height: 1920 }, '1080p'), { width: 1080, height: 1920 });
  assert.deepEqual(outputSize({ width: 1080, height: 1350 }, '2160p'), { width: 2160, height: 2700 });
  const s = outputSize({ width: 1920, height: 1080 }, '480p');
  assert.equal(s.width % 2, 0);
});

console.log(`\n${n} groupes de tests réussis.`);
