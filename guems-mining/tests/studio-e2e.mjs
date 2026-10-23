// Test de bout en bout du Studio dans Chromium (Playwright) :
// modèles, création de projet, import de médias, lecture, découpe/annulation,
// export vidéo réel (vérifié par ffprobe) et assistant IA via un faux serveur d'API.
//
// Prérequis : PHP, ffmpeg/ffprobe, Playwright (npm i -D playwright ou installation globale).
// Usage : npm run build && node tests/studio-e2e.mjs

import { spawn, execSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(join(execSync('npm root -g').toString().trim(), 'playwright')); }

const work = mkdtempSync(join(tmpdir(), 'gm-studio-e2e-'));
const ff = (...a) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...a]);
ff('-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=30', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '4', '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libopus', join(work, 'clip.webm'));
ff('-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=44100', '-t', '8', join(work, 'musique.wav'));
ff('-f', 'lavfi', '-i', 'color=c=orange:size=1280x720', '-frames:v', '1', join(work, 'photo.png'));
const mediaDir = join(ROOT, 'dist', '__e2e');
mkdirSync(mediaDir, { recursive: true });
for (const f of ['clip.webm', 'musique.wav', 'photo.png']) copyFileSync(join(work, f), join(mediaDir, f));

const hash = execFileSync('php', ['-r', "echo password_hash('test-code', PASSWORD_DEFAULT);"]).toString();
writeFileSync(join(work, 'config.php'), `<?php return ['anthropic_api_key' => 'sk-ant-test', 'access_code_hash' => '${hash}', 'base_url' => 'http://127.0.0.1:8913'];\n`);
const servers = [
  spawn('php', ['-S', '127.0.0.1:8912', '-t', join(ROOT, 'dist')], { env: { ...process.env, GM_STUDIO_CONFIG: join(work, 'config.php') }, stdio: 'ignore' }),
  spawn('php', ['-S', '127.0.0.1:8913', join(ROOT, 'tests', 'fixtures', 'mock-anthropic.php')], { stdio: 'ignore' }),
];
const BASE = 'http://127.0.0.1:8912/studio/';
await new Promise((r) => setTimeout(r, 800));

const browser = await playwright.chromium.launch();
const errors = [];
let failed = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(BASE);
  await p.getByRole('button', { name: 'Modèles vidéo' }).click();
  await p.locator('dialog .card').filter({ hasText: 'Présentation d\'entreprise' }).getByRole('button', { name: 'Personnaliser' }).click();
  await p.locator('dialog[open] input[type=file]').last().setInputFiles([join(work, 'clip.webm'), join(work, 'photo.png'), join(work, 'musique.wav')]);
  await p.locator('dialog[open]').last().getByText('clip.webm').first().waitFor({ timeout: 20000 });
  await p.getByRole('button', { name: 'Créer le projet' }).click();
  await p.waitForURL(/#\/projet\//);
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => ({ clips: window.__studio.store.project.tracks.reduce((a, t) => a + t.clips.length, 0), media: window.__studio.store.project.mediaIds.length }));
  assert.ok(info.clips > 20, 'composition multipiste');
  assert.equal(info.media, 3, 'médias intégrés');
  console.log('✓ modèle personnalisé avec médias → composition multipiste');

  await p.evaluate(() => window.__studio.store.setTime(5));
  await p.keyboard.press('Space'); await p.waitForTimeout(1200); await p.keyboard.press('Space');
  assert.ok(await p.evaluate(() => window.__studio.store.time) > 5.8, 'lecture');
  console.log('✓ lecture temps réel');

  const count = () => p.evaluate(() => window.__studio.store.project.tracks.reduce((a, t) => a + t.clips.length, 0));
  const n0 = await count();
  await p.locator('.clip.shape, .clip.image, .clip.video').first().click();
  await p.evaluate(() => { const s = window.__studio.store; const c = s.selected.clip; s.setTime(c.start + c.duration / 2); });
  await p.keyboard.press('s'); assert.equal(await count(), n0 + 1);
  await p.keyboard.press('Control+z'); assert.equal(await count(), n0);
  await p.keyboard.press('Control+Shift+z'); assert.equal(await count(), n0 + 1);
  console.log('✓ découpe, annuler, rétablir');

  await p.getByRole('button', { name: 'Exporter' }).click();
  await p.locator('dialog[open] .note.ok').waitFor({ timeout: 15000 });
  await p.locator('dialog[open] label.option-card', { hasText: 'WebM' }).click();
  await p.locator('dialog[open] select').first().selectOption('480p');
  await p.evaluate(() => { const s = window.__studio.store; s.mutate('raccourcir', (pr) => { for (const t of pr.tracks) t.clips = t.clips.filter((c) => c.start < 4); for (const t of pr.tracks) for (const c of t.clips) c.duration = Math.min(c.duration, 4 - c.start); }); });
  await p.getByRole('button', { name: 'Lancer l\'exportation' }).click();
  await p.locator('dialog[open] video.result').waitFor({ timeout: 180000 });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Télécharger la vidéo' }).click()]);
  const out = join(work, 'export.webm');
  await dl.saveAs(out);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', out]).toString());
  assert.ok(probe.streams.some((s) => s.codec_type === 'video' && s.width === 852 && s.height === 480), 'piste vidéo 480p');
  assert.ok(probe.streams.some((s) => s.codec_type === 'audio'), 'piste audio');
  assert.ok(Math.abs(Number(probe.format.duration) - 4) < 0.2, 'durée');
  console.log(`✓ export réel : ${probe.streams.map((s) => s.codec_name).join(' + ')}, ${Number(probe.format.duration).toFixed(2)} s`);
  await p.keyboard.press('Escape');

  await p.goto(BASE);
  await p.locator('.ai-card textarea').fill('Crée une publicité de 20 secondes pour « Test SARL », style cinématique, appel à l\'action final.');
  await p.getByRole('button', { name: 'Créer avec l\'assistant' }).click();
  await p.locator('dialog[open] .note.ok').waitFor({ timeout: 10000 });
  await p.getByRole('button', { name: 'Générer avec l\'IA' }).click();
  await p.locator('dialog[open] input[type=password]').fill('test-code');
  await p.getByRole('button', { name: 'Valider' }).click();
  await p.locator('dialog[open] .scene').first().waitFor({ timeout: 20000 });
  await p.getByRole('button', { name: 'Créer le projet vidéo' }).click();
  await p.waitForURL(/#\/projet\//);
  console.log('✓ assistant IA (API simulée) → storyboard → projet');
  assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
  console.log('\nTous les tests de bout en bout sont réussis.');
} catch (e) {
  failed = true;
  console.error('✗', e.message);
} finally {
  await browser.close();
  servers.forEach((s) => s.kill());
  rmSync(mediaDir, { recursive: true, force: true });
  rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
