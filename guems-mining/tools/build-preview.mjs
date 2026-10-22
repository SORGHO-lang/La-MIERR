// Regroupe le site généré (dist/) en UN SEUL fichier HTML autonome, consultable sans serveur :
// toutes les pages FR/EN, styles, scripts et images intégrés, navigation par ancres (#fr-contact…).
// Usage : node build.mjs && node tools/build-preview.mjs   →   preview/guems-mining-apercu.html
// Le formulaire n'envoie rien dans l'aperçu : l'envoi réel nécessite contact.php sur l'hébergement.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'preview');
if (!existsSync(DIST)) throw new Error('Lancez d\'abord « node build.mjs ».');

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon' };
const dataUri = (rel) => {
  const file = join(DIST, rel);
  const type = MIME[extname(file).toLowerCase()];
  if (!type || !existsSync(file)) return null;
  const buf = readFileSync(file);
  return type === 'image/svg+xml'
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buf.toString('utf8'))}`
    : `data:${type};base64,${buf.toString('base64')}`;
};

// Chaque image n'est intégrée qu'une fois ; les pages y font référence par une clé.
const assets = [];
const assetIndex = new Map();
const assetKey = (rel) => {
  if (!assetIndex.has(rel)) {
    const uri = dataUri(rel);
    if (!uri) return null;
    assetIndex.set(rel, assets.length);
    assets.push(uri);
  }
  return `gm-asset:${assetIndex.get(rel)}`;
};

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const routeOf = (urlPath) => urlPath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-') || 'fr';

const pages = walk(DIST)
  .filter((f) => f.endsWith('.html') && !f.includes('/admin/') && f !== join(DIST, 'index.html'))
  .map((f) => {
    const rel = relative(DIST, f).split('\\').join('/');
    const route = rel === '404.html' ? '404' : routeOf(rel.replace(/index\.html$/, ''));
    const html = readFileSync(f, 'utf8');
    const lang = html.match(/<html lang="(\w+)"/)[1];
    const title = html.match(/<title>([^<]*)<\/title>/)[1]
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
      .replace(/<script src="[^"]*main\.js[^"]*"[^>]*><\/script>/, '');
    // Liens internes → ancres ; ressources → données intégrées.
    body = body.replace(/(href|src|srcset)="([^"]+)"/g, (m, attr, val) => {
      if (attr === 'href' && /^\/(fr|en)\//.test(val)) {
        return `href="#${routeOf(val.split('#')[0].split('?')[0])}"`;
      }
      const parts = val.split(',').map((s) => {
        const [u, d] = s.trim().split(/\s+/);
        if (!u.startsWith('/')) return s.trim();
        const key = assetKey(u.split('?')[0].slice(1));
        return key ? `${key}${d ? ` ${d}` : ''}` : s.trim();
      });
      return `${attr}="${parts.join(', ')}"`;
    });
    return { route, lang, title, body };
  });

let css = readFileSync(join(DIST, 'assets/css/style.css'), 'utf8')
  .replace(/url\("\.\.\/img\/([^"]+)"\)/g, (m, p) => `url("${dataUri(`assets/img/${p}`)}")`);
const js = readFileSync(join(DIST, 'assets/js/main.js'), 'utf8')
  .replace(/^\(function \(\) \{/m, 'window.gmInit = function () {')
  .replace(/\}\)\(\);\s*$/, '};');

const routes = Object.fromEntries(pages.map((p) => [p.route, { lang: p.lang, title: p.title }]));
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

const html = `<title>GUEM'S MINING SARL</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700;800&display=swap">
<style>
:root { color-scheme: light; }
${css}
</style>
<div id="gm-app"></div>
${pages.map((p) => `<template data-route="${p.route}">${p.body}</template>`).join('\n')}
<script>
${esc(js)}
</script>
<script>
(function () {
  var ROUTES = ${JSON.stringify(routes)};
  var ASSETS = ${JSON.stringify(assets)};
  function resolveAssets(root) {
    root.querySelectorAll('[src^="gm-asset:"], [srcset*="gm-asset:"]').forEach(function (el) {
      ['src', 'srcset'].forEach(function (a) {
        var v = el.getAttribute(a);
        if (v) el.setAttribute(a, v.replace(/gm-asset:(\\d+)/g, function (m, i) { return ASSETS[+i]; }));
      });
    });
  }
  var app = document.getElementById('gm-app');
  var PREVIEW = {
    fr: "Aperçu : l'envoi réel des messages sera actif une fois le site publié sur l'hébergement avec contact.php configuré. Vous pouvez nous joindre au +226 76 32 87 49.",
    en: 'Preview: messages will be sent for real once the site is published on the hosting with contact.php configured. You can reach us on +226 76 32 87 49.'
  };
  // Dans l'aperçu, le formulaire n'a pas de serveur : on le dit clairement, sans simuler d'envoi.
  var realFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (String(url).indexOf('contact.php') !== -1) {
      return Promise.resolve(new Response(JSON.stringify({ ok: false, error: 'preview' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch.apply(this, arguments);
  };
  function show(route, keepScroll) {
    var tpl = document.querySelector('template[data-route="' + route + '"]');
    if (!tpl) return false;
    document.body.classList.remove('menu-open');
    app.innerHTML = '';
    var frag = tpl.content.cloneNode(true);
    resolveAssets(frag);
    app.appendChild(frag);
    document.documentElement.lang = ROUTES[route].lang;
    document.documentElement.classList.add('js');
    document.title = ROUTES[route].title;
    try { localStorage.setItem('gm-lang', ROUTES[route].lang); } catch (e) {}
    var data = document.getElementById('form-i18n');
    if (data) {
      var d = JSON.parse(data.textContent);
      d.status.preview = PREVIEW[ROUTES[route].lang];
      data.textContent = JSON.stringify(d);
    }
    window.gmInit();
    if (!keepScroll) window.scrollTo(0, 0);
    return true;
  }
  window.addEventListener('hashchange', function () { show(location.hash.slice(1)); });
  var start = location.hash.slice(1);
  if (!ROUTES[start]) {
    var l = 'fr';
    try { l = localStorage.getItem('gm-lang') === 'en' ? 'en' : 'fr'; } catch (e) {}
    start = l;
  }
  show(start, true);
})();
</script>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'guems-mining-apercu.html'), html);
console.log(`Aperçu généré : preview/guems-mining-apercu.html (${pages.length} pages, ${(html.length / 1024).toFixed(0)} Ko)`);
