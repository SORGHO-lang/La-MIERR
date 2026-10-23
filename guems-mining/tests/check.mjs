// Vérifications automatiques du site généré (dist/) :
// liens internes, ressources, H1 unique, métadonnées SEO, hreflang, textes alternatifs, sitemap.
// Usage : node build.mjs && node tests/check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const site = JSON.parse(readFileSync(join(ROOT, 'content/site.json'), 'utf8'));
const BASE = (`/${site.basePath || '/'}/`).replace(/\/+/g, '/');
const SITE_URL = (process.env.SITE_URL || site.siteUrl).replace(/\/+$/, '');

const errors = [];
const fail = (file, msg) => errors.push(`${relative(DIST, file)} : ${msg}`);

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const htmlFiles = walk(DIST).filter((f) => f.endsWith('.html') && !/\/admin\//.test(f));

function resolveLocal(url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean.startsWith(BASE)) return null;
  const rel = decodeURIComponent(clean.slice(BASE.length));
  const p = join(DIST, rel);
  if (clean.endsWith('/')) return join(p, 'index.html');
  return p;
}

const titles = new Map();
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const isRoot = file === join(DIST, 'index.html');
  const is404 = file.endsWith('404.html');

  if (!/<html lang="(fr|en)">/.test(html)) fail(file, 'attribut lang manquant');
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
  if (!title) fail(file, 'balise <title> manquante');
  if (!/<meta name="description" content="[^"]{50,}"/.test(html)) fail(file, 'meta description absente ou trop courte');

  if (!isRoot) {
    const h1 = (html.match(/<h1[\s>]/g) || []).length;
    if (h1 !== 1) fail(file, `${h1} balises H1 (attendu : 1)`);
    if (!is404) {
      if (!/<link rel="canonical" href="https?:\/\//.test(html)) fail(file, 'canonique absente');
      const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || '';
      const self = `${SITE_URL}${BASE}${relative(DIST, dirname(file)).split('\\').join('/')}/`;
      if (!/hreflang="x-default"/.test(html)) fail(file, 'hreflang x-default absent');
      // Une page de repli (contenu non traduit) pointe vers l'original : titre identique attendu.
      if (canonical === self) {
        if (titles.has(title)) fail(file, `titre dupliqué avec ${titles.get(title)}`);
        titles.set(title, relative(DIST, file));
      }
    }
  }

  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!/\balt="/.test(m[0])) fail(file, `image sans attribut alt : ${m[0].slice(0, 80)}`);
  }

  for (const m of html.matchAll(/\b(?:href|src|srcset)="([^"]+)"/g)) {
    for (const part of m[1].split(',').map((s) => s.trim().split(/\s+/)[0])) {
      if (!part || /^(https?:|mailto:|tel:|#|data:)/.test(part)) continue;
      const target = resolveLocal(part);
      if (!target) { fail(file, `lien relatif inattendu : ${part}`); continue; }
      if (!existsSync(target)) fail(file, `lien cassé : ${part}`);
    }
  }
}

// Les liens absolus vers le site doivent pointer vers des pages existantes.
const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
for (const m of sitemap.matchAll(/(?:<loc>|href=")([^<"]+)/g)) {
  const path = m[1].replace(SITE_URL, '');
  const target = resolveLocal(path);
  if (!target || !existsSync(target)) errors.push(`sitemap.xml : URL sans page correspondante ${m[1]}`);
}
for (const f of ['robots.txt', 'sitemap.xml', '404.html', 'favicon.ico', 'site.webmanifest', 'contact.php', '.htaccess']) {
  if (!existsSync(join(DIST, f))) errors.push(`fichier manquant : ${f}`);
}

// Parité des traductions : mêmes clés en français et en anglais.
const fr = JSON.parse(readFileSync(join(ROOT, 'content/i18n/fr.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(ROOT, 'content/i18n/en.json'), 'utf8'));
const keys = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${p}${k}.`) : [`${p}${k}`]));
const kf = new Set(keys(fr)); const ke = new Set(keys(en));
for (const k of kf) if (!ke.has(k)) errors.push(`traduction anglaise manquante : ${k}`);
for (const k of ke) if (!kf.has(k)) errors.push(`traduction française manquante : ${k}`);

if (errors.length) {
  console.error(`✗ ${errors.length} problème(s) :\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ ${htmlFiles.length} pages HTML vérifiées : liens, H1, métadonnées, hreflang, alt, sitemap et traductions OK.`);
