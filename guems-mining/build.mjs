// Générateur du site statique bilingue GUEM'S MINING (aucune dépendance externe).
// Usage : node build.mjs   →   produit le dossier dist/
// Variable d'environnement facultative : SITE_URL (remplace siteUrl de content/site.json).

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { esc, md, stripMd, truncate, formatDate, icon } from './src/lib.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, 'dist');
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const site = readJson('content/site.json');
const T = { fr: readJson('content/i18n/fr.json'), en: readJson('content/i18n/en.json') };
const LANGS = ['fr', 'en'];
const SITE_URL = (process.env.SITE_URL || site.siteUrl).replace(/\/+$/, '');
const BASE = (`/${site.basePath || '/'}/`).replace(/\/+/g, '/');
const C = site.company;
const YEAR = new Date().getFullYear();

const warnings = [];
if (/example\.com/.test(SITE_URL)) warnings.push('siteUrl n\'est pas configuré (content/site.json ou SITE_URL) : canoniques et sitemap utilisent un domaine provisoire.');

// ---------------------------------------------------------------- contenus
function loadCollection(dir) {
  const p = join(ROOT, 'content', dir);
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(p, f), 'utf8')) }))
    .filter((x) => !x.draft)
    .map((x) => ({ ...x, slug: slugify(x.slug || x.file.replace(/\.json$/, '')) }));
}
function slugify(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const news = loadCollection('news')
  .filter((a) => a.title_fr || a.title_en)
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));
const projects = loadCollection('projects')
  .filter((p) => p.name_fr || p.name_en)
  .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(b.period).localeCompare(String(a.period)));

// ---------------------------------------------------------------- URLs
const asset = (p) => (/^https?:\/\//.test(p) ? p : BASE + String(p).replace(/^\/+/, ''));
function pagePath(lang, key, sub = '') {
  const slug = T[lang].pages[key].slug;
  return `${BASE}${lang}/${slug ? `${slug}/` : ''}${sub ? `${sub}/` : ''}`;
}
const abs = (path) => SITE_URL + path;

const fingerprint = (rel) => createHash('sha1').update(readFileSync(join(ROOT, 'static', rel))).digest('hex').slice(0, 8);
const CSS = `${asset('assets/css/style.css')}?v=${fingerprint('assets/css/style.css')}`;
const JS = `${asset('assets/js/main.js')}?v=${fingerprint('assets/js/main.js')}`;

const pick = (obj, field, lang) => obj[`${field}_${lang}`] || '';
// Contenu d'un élément dans la langue demandée, avec repli sur l'autre langue.
function localized(item, field, lang) {
  const own = pick(item, field, lang);
  if (own) return { value: own, lang };
  const other = lang === 'fr' ? 'en' : 'fr';
  return { value: pick(item, field, other), lang: other };
}
// Garantit une meta description suffisamment informative pour les contenus courts.
const describe = (text, lang) => {
  const d = truncate(stripMd(text || ''), 158);
  return d.length >= 70 ? d : truncate(`${d ? `${d} — ` : ''}${C.legalName} · ${T[lang].footer.tagline}`, 158);
};
const telHref = `tel:${C.phoneE164}`;
const waHref = (lang) => `https://wa.me/${C.whatsapp}?text=${encodeURIComponent(T[lang].contact.whatsappText)}`;

function img(path, fallback, alt = '', cls = '', eager = false) {
  const src = path ? asset(path) : asset(`assets/img/illustrations/${fallback}`);
  return `<img src="${esc(src)}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ''} ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

// ---------------------------------------------------------------- gabarit
const NAV = ['home', 'about', 'activities', 'expertise', 'projects', 'news', 'contact'];

function layout({ lang, key, path, alternates, title, description, body, jsonLd = [], ogImage, ogType = 'website', breadcrumbs, noindex = false, canonical }) {
  const t = T[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const alt = alternates || { fr: pagePath('fr', key), en: pagePath('en', key) };
  const canon = canonical || path;
  const og = abs(ogImage ? asset(ogImage) : asset('assets/img/og-image.jpg'));
  const navLinks = (cls) => NAV.map((k) => {
    const href = pagePath(lang, k);
    const current = k === key ? ' aria-current="page"' : '';
    return `<li><a class="${cls}" href="${href}"${current}>${esc(t.nav[k])}</a></li>`;
  }).join('');

  const crumbs = breadcrumbs ? [{ name: t.nav.home, path: pagePath(lang, 'home') }, ...breadcrumbs] : null;
  const ld = [...jsonLd];
  if (crumbs) {
    ld.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.path) })),
    });
  }

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${abs(canon)}">`}
${alt.fr ? `<link rel="alternate" hreflang="fr" href="${abs(alt.fr)}">` : ''}
${alt.en ? `<link rel="alternate" hreflang="en" href="${abs(alt.en)}">` : ''}
<link rel="alternate" hreflang="x-default" href="${abs(alt.fr || alt.en)}">
<meta name="theme-color" content="#101010">
<link rel="icon" href="${asset('favicon.ico')}" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="${asset('assets/img/favicon-32.png')}">
<link rel="apple-touch-icon" href="${asset('assets/img/apple-touch-icon.png')}">
<link rel="manifest" href="${asset('site.webmanifest')}">
<meta property="og:site_name" content="${esc(C.tradeName)}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(canon)}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${T[other].locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@500;600;700;800&display=swap">
<link rel="stylesheet" href="${CSS}">
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
<script>try{localStorage.setItem('gm-lang','${lang}')}catch(e){}document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip-link" href="#contenu">${esc(t.skip)}</a>
<div class="scroll-progress" aria-hidden="true"><span data-progress></span></div>
<div class="topbar">
  <div class="container topbar-inner">
    <p class="topbar-tagline">${esc(t.topbar.tagline)}</p>
    <div class="topbar-right">
    <ul class="topbar-links" aria-label="${esc(t.topbar.contactBar)}">
      <li><a href="${telHref}">${icon('phone')}<span>${esc(C.phone)}</span></a></li>
      <li><a href="${waHref(lang)}" target="_blank" rel="noopener noreferrer">${icon('whatsapp')}<span>WhatsApp</span></a></li>
      ${C.email ? `<li><a href="mailto:${esc(C.email)}">${icon('mail')}<span>${esc(C.email)}</span></a></li>` : ''}
    </ul>
    <a class="lang-switch" href="${alt[other] || pagePath(other, 'home')}" hreflang="${other}" lang="${other}" data-lang="${other}" title="${esc(t.switchLabel)}">
        <span aria-hidden="true">${icon('globe')}</span><span class="lang-current" aria-hidden="true">${lang.toUpperCase()}</span><span aria-hidden="true">/</span><span class="lang-other">${other.toUpperCase()}</span><span class="sr-only">${esc(t.switchLabel)}</span>
      </a>
    </div>
  </div>
</div>
<header class="site-header" data-header>
  <div class="container header-inner">
    <a class="brand" href="${pagePath(lang, 'home')}" aria-label="${esc(C.tradeName)} — ${esc(t.nav.home)}">
      <picture>
        <source srcset="${asset('assets/img/logo-guems-mining-480.webp')} 480w, ${asset('assets/img/logo-guems-mining-960.webp')} 960w" sizes="150px" type="image/webp">
        <img src="${asset('assets/img/logo-guems-mining-480.png')}" alt="${esc(C.tradeName)}" width="150" height="96">
      </picture>
    </a>
    <nav class="main-nav" id="main-nav" aria-label="${esc(t.nav.mainNav)}" data-nav>
      <ul>${navLinks('nav-link')}</ul>
      <div class="nav-mobile-extra">
        <a class="btn btn-primary" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)}</a>
        <a class="nav-phone" href="${telHref}">${icon('phone')}<span>${esc(C.phone)}</span></a>
      </div>
    </nav>
    <div class="header-actions">
      <a class="lang-switch lang-switch-mobile" href="${alt[other] || pagePath(other, 'home')}" hreflang="${other}" lang="${other}" data-lang="${other}" title="${esc(t.switchLabel)}">
        <span aria-hidden="true">${icon('globe')}</span><span class="lang-current" aria-hidden="true">${lang.toUpperCase()}</span><span aria-hidden="true">/</span><span class="lang-other">${other.toUpperCase()}</span><span class="sr-only">${esc(t.switchLabel)}</span>
      </a>
      <a class="header-phone" href="${telHref}"><span class="header-phone-icon">${icon('phone')}</span><span class="sr-only">${esc(t.topbar.ask)} ${esc(C.phone)}</span></a>
      <a class="btn btn-primary btn-square header-cta" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)}</a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-toggle data-label-open="${esc(t.nav.openMenu)}" data-label-close="${esc(t.nav.closeMenu)}">
        <span class="sr-only">${esc(t.nav.openMenu)}</span>${icon('menu', 'icon icon-open')}${icon('close', 'icon icon-close')}
      </button>
    </div>
  </div>
</header>
<main id="contenu" tabindex="-1">
${crumbs ? `<nav class="breadcrumbs container" aria-label="${esc(t.nav.breadcrumb)}"><ol>${crumbs.map((c, i) => (i === crumbs.length - 1 ? `<li><span aria-current="page">${esc(c.name)}</span></li>` : `<li><a href="${c.path}">${esc(c.name)}</a></li>`)).join('')}</ol></nav>` : ''}
${body}
</main>
${footer(lang)}
<a class="to-top" href="#contenu" data-to-top aria-label="${esc(t.common.backToTop)}">${icon('arrow', 'icon icon-up')}</a>
<script src="${JS}" defer></script>
</body>
</html>
`;
}

function footer(lang) {
  const t = T[lang];
  const social = Object.entries(C.social || {}).filter(([, v]) => v);
  return `<footer class="site-footer">
  <div class="container footer-grid">
    <div class="footer-brand">
      <p class="wordmark">GUEM<span>'</span>S <strong>MINING</strong></p>
      <p>${esc(t.footer.tagline)}</p>
      ${social.length ? `<ul class="social">${social.map(([k, v]) => `<li><a href="${esc(v)}" target="_blank" rel="noopener noreferrer" aria-label="${k}">${icon(k)}</a></li>`).join('')}</ul>` : ''}
    </div>
    <nav aria-label="${esc(t.footer.navTitle)}">
      <h2 class="footer-title">${esc(t.footer.navTitle)}</h2>
      <ul class="footer-links">${NAV.map((k) => `<li><a href="${pagePath(lang, k)}">${esc(t.nav[k])}</a></li>`).join('')}</ul>
    </nav>
    <div>
      <h2 class="footer-title">${esc(t.footer.contactTitle)}</h2>
      <address class="footer-contact">
        <p>${icon('pin')}<span>${esc(C.legalName)}<br>${esc(C.address.street)}, ${esc(C.address.city)}<br>${esc(C.address.country[lang])}</span></p>
        <p>${icon('phone')}<a href="${telHref}">${esc(C.phone)}</a></p>
        <p>${icon('whatsapp')}<a href="${waHref(lang)}" target="_blank" rel="noopener noreferrer">WhatsApp</a></p>
        ${C.email ? `<p>${icon('mail')}<a href="mailto:${esc(C.email)}">${esc(C.email)}</a></p>` : ''}
      </address>
    </div>
  </div>
  <div class="container footer-bottom">
    <p>© ${YEAR} ${esc(C.legalName)}. ${esc(t.footer.rights)}</p>
    <a href="${pagePath(lang, 'legal')}">${esc(t.footer.legal)}</a>
  </div>
</footer>`;
}

const orgLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: C.tradeName,
  legalName: C.legalName,
  url: abs(BASE),
  logo: abs(asset('assets/img/logo-guems-mining-480.png')),
  telephone: C.phoneE164,
  ...(C.email ? { email: C.email } : {}),
  address: {
    '@type': 'PostalAddress',
    streetAddress: C.address.street,
    addressLocality: C.address.city,
    addressCountry: C.address.countryCode,
  },
  ...(Object.values(C.social || {}).some(Boolean) ? { sameAs: Object.values(C.social).filter(Boolean) } : {}),
});

// Titre découpé en mots pour l'animation d'entrée (texte intact pour les lecteurs d'écran).
const splitTitle = (text) => esc(text).split(/\s+/).map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`).join(' ');

// ---------------------------------------------------------------- blocs
const pageHero = (eyebrow, title, lead, extra = '') => `
<section class="page-hero">
  <div class="page-hero-bg">${img(site.images.hero, 'terrain.svg', '', '', true)}</div>
  <div class="container page-hero-inner">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <h1 class="title-split" aria-label="${esc(title)}"><span aria-hidden="true">${splitTitle(title)}</span></h1>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${extra}
  </div>
</section>`;

const sectionHead = (eyebrow, title, text = '', h = 'h2', center = false) => `
<div class="section-head${center ? ' center' : ''} reveal">
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
  <${h}>${esc(title)}</${h}>
  ${text ? `<p>${esc(text)}</p>` : ''}
</div>`;

const featureCards = (items, cls = '') => `<div class="cards ${cls}">${items.map((it) => `
  <article class="card reveal">
    <span class="card-icon">${icon(it.icon)}</span>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.text)}</p>
  </article>`).join('')}</div>`;

const ctaBand = (lang) => {
  const t = T[lang];
  return `
<section class="cta-band">
  <div class="container cta-inner reveal">
    <div>
      <h2>${esc(t.home.finalCta.title)}</h2>
      <p>${esc(t.home.finalCta.text)}</p>
    </div>
    <div class="cta-actions">
      <a class="btn btn-primary" href="${pagePath(lang, 'contact')}">${esc(t.home.finalCta.button)} ${icon('arrow')}</a>
      <a class="btn btn-outline-light" href="${telHref}">${icon('phone')} ${esc(C.phone)}</a>
    </div>
  </div>
</section>`;
};

const activityCard = (lang, a, headingLevel = 3) => `
<article class="activity-card reveal" data-reveal="zoom" id="${esc(a.id)}">
  <div class="activity-media">${img(site.images[a.imageKey], a.fallback, '')}</div>
  <div class="activity-body">
    <p class="tag">${esc(a.tag)}</p>
    <h${headingLevel}>${esc(a.title)}</h${headingLevel}>
    <p>${esc(a.text)}</p>
  </div>
</article>`;

// ---------------------------------------------------------------- pages
function pageHome(lang) {
  const t = T[lang]; const h = t.home;
  const hse = site.features.showHsePolicy && h.hse.text;
  const latest = news.slice(0, 3);
  const body = `
<section class="hero">
  <div class="hero-bg">${img(site.images.hero, 'terrain.svg', '', '', true)}</div>
  <div class="container hero-inner">
    <div class="hero-text">
      <p class="eyebrow">${esc(h.eyebrow)}</p>
      <h1 class="title-split" aria-label="${esc(h.title)}"><span aria-hidden="true">${splitTitle(h.title)}</span></h1>
      <p class="lead">${esc(h.subtitle)}</p>
      <div class="hero-actions">
        <a class="btn btn-primary btn-lg btn-square" href="${pagePath(lang, 'activities')}">${esc(h.ctaPrimary)}</a>
        <a class="link-plain" href="${pagePath(lang, 'about')}">${esc(h.readMore)} ${icon('arrow')}</a>
      </div>
    </div>
    ${site.images.hero ? '' : `<div class="hero-visual" aria-hidden="true"><img src="${asset('assets/img/illustrations/pelleteuse.svg')}" alt="" fetchpriority="high"></div>`}
  </div>
</section>

<section class="hero-strip">
  <div class="container hero-strip-inner">
    <div class="strip-item">
      <span class="strip-icon">${icon('phone')}</span>
      <div><h2>${esc(h.strip.quick)}</h2><p>${esc(t.common.phone)} : <a href="${telHref}">${esc(C.phone)}</a><br>WhatsApp : <a href="${waHref(lang)}" target="_blank" rel="noopener noreferrer">${esc(C.phone)}</a></p></div>
    </div>
    <div class="strip-item">
      <span class="strip-icon">${icon('pin')}</span>
      <div><h2>${esc(h.strip.location)}</h2><p>${esc(C.address.street)}<br>${esc(C.address.city)}, ${esc(C.address.country[lang])}</p></div>
    </div>
    <div class="hero-box">
      <p class="hero-box-title">${esc(h.heroBox.title)}</p>
      <p>${esc(h.heroBox.text)}</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container about-split">
    <div class="reveal" data-reveal="left">
      <p class="eyebrow">${esc(h.intro.eyebrow)}</p>
      <h2>${esc(h.intro.title)}</h2>
      <blockquote class="quote">${esc(h.intro.text[0])}</blockquote>
      <p class="muted">${esc(h.intro.text[1])}</p>
      <a class="btn btn-primary btn-square" href="${pagePath(lang, 'about')}">${esc(h.intro.link)}</a>
    </div>
    <div class="about-media reveal" data-reveal="right">
      <span class="vertical-badge">${esc(h.aboutBadge)}</span>
      <div class="about-media-img">${img(site.images.about, 'strates.svg', '')}</div>
    </div>
  </div>
</section>

<section class="why-band">
  <div class="why-inner">
    <div class="why-media reveal" data-reveal="left">${img(site.images.activityMining, 'gradins.svg', '')}</div>
    <div class="why-panel reveal" data-reveal="right">
      <p class="eyebrow">${esc(h.positioning.eyebrow)}</p>
      <h2>${esc(h.positioning.title)}</h2>
      <p class="muted">${esc(h.positioning.text)}</p>
      <div class="why-facts">${h.whyFacts.map((f) => `<p><strong${/^\d+$/.test(f.value) ? ` data-count="${esc(f.value)}"` : ''}>${esc(f.value)}</strong><span>${esc(f.label)}</span></p>`).join('')}</div>
      <ul class="why-points">${h.positioning.points.map((pt) => `<li>${icon('check')}<span>${esc(pt)}</span></li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    ${sectionHead(h.services.eyebrow, h.services.title, '', 'h2', true)}
    <div class="service-grid">
      ${t.activities.items.map((a) => `
      <article class="service reveal">
        <span class="service-icon">${icon(a.fallback === 'gradins.svg' ? 'pickaxe' : 'layers')}</span>
        <p class="tag">${esc(a.tag)}</p>
        <h3>${esc(a.title)}</h3>
        <p>${esc(truncate(a.text, 150))}</p>
        <a class="link-plain" href="${pagePath(lang, 'activities')}#${esc(a.id)}">${esc(h.readMore)} ${icon('arrow')}</a>
      </article>`).join('')}
      <article class="service reveal">
        <span class="service-icon">${icon('handshake')}</span>
        <p class="tag">${esc(h.services.extra.tag)}</p>
        <h3>${esc(h.services.extra.title)}</h3>
        <p>${esc(h.services.extra.text)}</p>
        <a class="link-plain" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)} ${icon('arrow')}</a>
      </article>
    </div>
  </div>
</section>

<section class="section section-dark">
  <div class="container">
    ${sectionHead(h.why.eyebrow, h.why.title, '', 'h2', true)}
    ${featureCards(h.why.items, 'cards-dark')}
  </div>
</section>

<section class="section section-light">
  <div class="container">
    ${sectionHead(h.values.eyebrow, h.values.title, '', 'h2', true)}
    ${featureCards(h.values.items, 'cards-values')}
  </div>
</section>
${hse ? `
<section class="section">
  <div class="container narrow">${sectionHead(h.hse.eyebrow, h.hse.title)}<div class="prose reveal">${md(h.hse.text)}</div></div>
</section>` : ''}
${latest.length ? `
<section class="section">
  <div class="container">
    ${sectionHead(t.news.eyebrow, t.news.title)}
    <div class="news-grid">${latest.map((a) => newsCard(lang, a)).join('')}</div>
    <p class="section-link"><a class="link-arrow" href="${pagePath(lang, 'news')}">${esc(t.nav.news)} ${icon('arrow')}</a></p>
  </div>
</section>` : ''}
${ctaBand(lang)}`;
  return { body, jsonLd: [orgLd(), { '@context': 'https://schema.org', '@type': 'WebSite', name: C.tradeName, url: abs(BASE), inLanguage: lang }] };
}

function identityTable(lang) {
  const t = T[lang]; const r = t.about.identity.rows;
  const rows = [
    [r.legalName, C.legalName],
    [r.tradeName, C.tradeName],
    [r.legalForm, C.legalForm[lang]],
    [r.sector, C.sector[lang]],
    [r.seat, `${C.address.street}, ${C.address.city}, ${C.address.country[lang]}`],
    [r.capital, C.capital[lang]],
    [r.phone, C.phone],
  ].filter(([, v]) => v);
  return `<dl class="id-table">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
}

function pageAbout(lang) {
  const t = T[lang]; const a = t.about;
  const body = `
${pageHero(a.eyebrow, a.title, a.lead)}
<section class="section">
  <div class="container split">
    <div class="reveal">
      <h2>${esc(a.overview.title)}</h2>
      ${a.overview.text.map((p) => `<p>${esc(p)}</p>`).join('')}
    </div>
    <div class="reveal">
      <h2 class="h3">${esc(a.identity.title)}</h2>
      ${identityTable(lang)}
    </div>
  </div>
</section>
<section class="section section-dark">
  <div class="container">
    ${sectionHead('', a.purpose.title, a.purpose.text)}
    <div class="purpose-grid">
      <div class="purpose reveal"><span class="card-icon">${icon('pickaxe')}</span><p class="tag">${esc(a.purpose.main)}</p><h3>${esc(C.mainActivity[lang])}</h3></div>
      <div class="purpose reveal"><span class="card-icon">${icon('layers')}</span><p class="tag">${esc(a.purpose.secondary)}</p><h3>${esc(C.secondaryActivity[lang])}</h3></div>
    </div>
  </div>
</section>
<section class="section">
  <div class="container vm-grid">
    <article class="vm reveal"><span class="card-icon">${icon('eye')}</span><h2 class="h3">${esc(a.vision.title)}</h2><p>${esc(a.vision.text)}</p></article>
    <article class="vm reveal"><span class="card-icon">${icon('award')}</span><h2 class="h3">${esc(a.mission.title)}</h2><p>${esc(a.mission.text)}</p></article>
  </div>
</section>
<section class="section section-light">
  <div class="container">
    ${sectionHead('', a.values.title, '', 'h2', true)}
    ${featureCards(t.home.values.items, 'cards-values')}
  </div>
</section>
<section class="section">
  <div class="container narrow reveal">
    <h2>${esc(a.institutional.title)}</h2>
    <p>${esc(a.institutional.text)}</p>
  </div>
</section>
${ctaBand(lang)}`;
  return { body, breadcrumbs: [{ name: t.nav.about, path: pagePath(lang, 'about') }] };
}

function pageActivities(lang) {
  const t = T[lang]; const a = t.activities;
  const body = `
${pageHero(a.eyebrow, a.title, a.lead)}
<section class="section">
  <div class="container activity-list">
    ${a.items.map((it) => activityCard(lang, it, 2)).join('')}
  </div>
</section>
<section class="section section-light">
  <div class="container narrow center reveal">
    <h2>${esc(a.more.title)}</h2>
    <p>${esc(a.more.text)}</p>
    <div class="cta-actions center">
      <a class="btn btn-primary" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)} ${icon('arrow')}</a>
      <a class="btn btn-outline" href="${telHref}">${icon('phone')} ${esc(C.phone)}</a>
    </div>
  </div>
</section>`;
  return { body, breadcrumbs: [{ name: t.nav.activities, path: pagePath(lang, 'activities') }] };
}

function pageExpertise(lang) {
  const t = T[lang]; const e = t.expertise;
  const hse = [e.safety, e.environment];
  const validated = site.features.showHsePolicy && hse.some((s) => s.text);
  const body = `
${pageHero(e.eyebrow, e.title, e.lead)}
<section class="section">
  <div class="container">
    <div class="expertise-list">
      ${e.sections.map((s, i) => `
      <article class="expertise-item reveal">
        <span class="num">0${i + 1}</span>
        <span class="card-icon">${icon(s.icon)}</span>
        <div><h2 class="h3">${esc(s.title)}</h2><p>${esc(s.text)}</p></div>
      </article>`).join('')}
    </div>
  </div>
</section>
<section class="section section-dark">
  <div class="container">
    ${validated ? `<div class="hse-grid">
      ${hse.filter((s) => s.text).map((s) => `
      <article class="hse-item reveal">
        <span class="card-icon">${icon(s.icon)}</span>
        <h2 class="h3">${esc(s.title)}</h2>
        <div class="prose">${md(s.text)}</div>
      </article>`).join('')}
    </div>` : `
    <article class="hse-item hse-single reveal">
      <div class="hse-icons">${hse.map((s) => `<span class="card-icon">${icon(s.icon)}</span>`).join('')}</div>
      <h2 class="h3">${esc(e.hseTitle)}</h2>
      <p>${esc(e.hseFallback)}</p>
      <a class="link-arrow on-dark" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)} ${icon('arrow')}</a>
    </article>`}
  </div>
</section>
${ctaBand(lang)}`;
  return { body, breadcrumbs: [{ name: t.nav.expertise, path: pagePath(lang, 'expertise') }] };
}

function emptyState(lang, title, text, ic) {
  const t = T[lang];
  return `
<div class="empty-state reveal">
  <span class="card-icon">${icon(ic)}</span>
  <h2>${esc(title)}</h2>
  <p>${esc(text)}</p>
  <div class="cta-actions center">
    <a class="btn btn-primary" href="${pagePath(lang, 'contact')}">${esc(t.nav.cta)} ${icon('arrow')}</a>
    <a class="btn btn-outline" href="${telHref}">${icon('phone')} ${esc(C.phone)}</a>
  </div>
</div>`;
}

function projectCard(lang, p) {
  const t = T[lang];
  const name = localized(p, 'name', lang);
  const desc = localized(p, 'description', lang);
  const cover = p.images?.[0];
  return `
<article class="project-card reveal">
  <a href="${pagePath(lang, 'projects', p.slug)}">
    <div class="project-media">${img(cover?.src, 'gradins.svg', cover ? (cover[`alt_${lang}`] || name.value) : '')}</div>
    <div class="project-body">
      <h2 class="h3" lang="${name.lang}">${esc(name.value)}</h2>
      <p class="meta">${p.location ? `${icon('pin')} ${esc(p.location)}` : ''}${p.period ? ` <span>${icon('calendar')} ${esc(p.period)}</span>` : ''}</p>
      <p lang="${desc.lang}">${esc(truncate(stripMd(desc.value), 150))}</p>
      <span class="link-arrow">${esc(t.common.learnMore)} ${icon('arrow')}</span>
    </div>
  </a>
</article>`;
}

function pageProjects(lang) {
  const t = T[lang]; const p = t.projects;
  const body = `
${pageHero(p.eyebrow, p.title, p.lead)}
<section class="section">
  <div class="container">
    ${projects.length ? `<div class="project-grid">${projects.map((x) => projectCard(lang, x)).join('')}</div>` : emptyState(lang, p.empty.title, p.empty.text, 'folder')}
  </div>
</section>`;
  return { body, breadcrumbs: [{ name: t.nav.projects, path: pagePath(lang, 'projects') }] };
}

function shareBlock(lang, url, title) {
  const t = T[lang];
  const u = encodeURIComponent(url); const ti = encodeURIComponent(title);
  return `
<div class="share">
  <p>${esc(t.common.share)}</p>
  <ul>
    <li><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener noreferrer" aria-label="Facebook">${icon('facebook')}</a></li>
    <li><a href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">${icon('linkedin')}</a></li>
    <li><a href="https://x.com/intent/post?url=${u}&amp;text=${ti}" target="_blank" rel="noopener noreferrer" aria-label="X">${icon('x')}</a></li>
    <li><a href="https://wa.me/?text=${ti}%20${u}" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">${icon('whatsapp')}</a></li>
    <li><button type="button" data-copy="${esc(url)}" data-copied="${esc(t.common.linkCopied)}" aria-label="${esc(t.common.copyLink)}">${icon('link')}</button></li>
  </ul>
  <p class="copy-status" role="status" aria-live="polite"></p>
</div>`;
}

function pageProject(lang, p) {
  const t = T[lang];
  const name = localized(p, 'name', lang);
  const desc = localized(p, 'description', lang);
  const res = localized(p, 'results', lang);
  const path = pagePath(lang, 'projects', p.slug);
  const images = (p.images || []).filter((i) => i.src);
  const body = `
${pageHero(t.projects.eyebrow, name.value, '', `<p class="meta on-dark">${p.location ? `${icon('pin')} ${esc(p.location)}` : ''}${p.period ? ` <span>${icon('calendar')} ${esc(p.period)}</span>` : ''}</p>`).replace('<h1 class="title-split"', `<h1 lang="${name.lang}" class="title-split"`)}
<section class="section">
  <div class="container narrow">
    <dl class="id-table compact">
      ${p.location ? `<div><dt>${esc(t.common.location)}</dt><dd>${esc(p.location)}</dd></div>` : ''}
      ${p.period ? `<div><dt>${esc(t.common.period)}</dt><dd>${esc(p.period)}</dd></div>` : ''}
    </dl>
    <div class="prose" lang="${desc.lang}">${md(desc.value)}</div>
    ${res.value ? `<h2>${esc(t.common.results)}</h2><div class="prose" lang="${res.lang}">${md(res.value)}</div>` : ''}
    ${images.length ? `<div class="gallery">${images.map((i) => `<figure><a href="${esc(asset(i.src))}" target="_blank" rel="noopener">${img(i.src, '', i[`alt_${lang}`] || name.value)}</a>${i[`alt_${lang}`] ? `<figcaption>${esc(i[`alt_${lang}`])}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
    ${shareBlock(lang, abs(path), name.value)}
    <p><a class="link-arrow back" href="${pagePath(lang, 'projects')}">${icon('arrowLeft')} ${esc(t.common.backToProjects)}</a></p>
  </div>
</section>
${ctaBand(lang)}`;
  return {
    body, path,
    title: `${name.value} | ${C.legalName}`,
    description: describe(desc.value, lang),
    canonical: name.lang !== lang ? pagePath(name.lang, 'projects', p.slug) : path,
    alternates: { fr: p.name_fr ? pagePath('fr', 'projects', p.slug) : null, en: p.name_en ? pagePath('en', 'projects', p.slug) : null },
    ogImage: images[0]?.src,
    breadcrumbs: [{ name: t.nav.projects, path: pagePath(lang, 'projects') }, { name: name.value, path }],
  };
}

function newsCard(lang, a) {
  const t = T[lang];
  const title = localized(a, 'title', lang);
  const excerpt = localized(a, 'excerpt', lang);
  const bodyTxt = localized(a, 'body', lang);
  const summary = excerpt.value || truncate(stripMd(bodyTxt.value), 150);
  return `
<article class="news-card reveal" data-category="${esc(a.category || '')}">
  <a href="${pagePath(lang, 'news', a.slug)}">
    <div class="news-media">${img(a.image, 'strates.svg', a.image ? (a[`image_alt_${lang}`] || '') : '')}</div>
    <div class="news-body">
      <p class="meta">${a.category && t.categories[a.category] ? `<span class="tag">${esc(t.categories[a.category])}</span>` : ''}<time datetime="${esc(String(a.date).slice(0, 10))}">${esc(formatDate(a.date, lang))}</time></p>
      <h2 class="h3" lang="${title.lang}">${esc(title.value)}</h2>
      <p lang="${excerpt.value ? excerpt.lang : bodyTxt.lang}">${esc(summary)}</p>
      <span class="link-arrow">${esc(t.common.readMore)} ${icon('arrow')}</span>
    </div>
  </a>
</article>`;
}

function pageNews(lang) {
  const t = T[lang]; const n = t.news;
  const cats = [...new Set(news.map((a) => a.category).filter((c) => t.categories[c]))];
  const body = `
${pageHero(n.eyebrow, n.title, n.lead)}
<section class="section">
  <div class="container">
    ${news.length ? `
    ${cats.length > 1 ? `<div class="filters" role="group" aria-label="${esc(n.filterLabel)}" data-filters>
      <button type="button" class="chip" aria-pressed="true" data-filter="">${esc(t.common.allCategories)}</button>
      ${cats.map((c) => `<button type="button" class="chip" aria-pressed="false" data-filter="${esc(c)}">${esc(t.categories[c])}</button>`).join('')}
    </div>` : ''}
    <div class="news-grid" data-news-grid>${news.map((a) => newsCard(lang, a)).join('')}</div>
    <p class="filter-empty" data-filter-empty hidden>${esc(n.noneInCategory)}</p>` : emptyState(lang, n.empty.title, n.empty.text, 'newspaper')}
  </div>
</section>`;
  return { body, breadcrumbs: [{ name: t.nav.news, path: pagePath(lang, 'news') }] };
}

function pageArticle(lang, a) {
  const t = T[lang];
  const title = localized(a, 'title', lang);
  const bodyMd = localized(a, 'body', lang);
  const excerpt = localized(a, 'excerpt', lang);
  const path = pagePath(lang, 'news', a.slug);
  const fallback = title.lang !== lang;
  const otherPath = pagePath(title.lang, 'news', a.slug);
  const notice = fallback ? (lang === 'en' ? t.common.englishUnavailable : t.common.frenchUnavailable) : '';
  const desc = describe(excerpt.value || bodyMd.value, lang);
  const body = `
<article class="article">
  <header class="article-header">
    <div class="container narrow">
      <p class="meta">${a.category && t.categories[a.category] ? `<span class="tag">${esc(t.categories[a.category])}</span>` : ''}<span>${esc(t.common.publishedOn)} <time datetime="${esc(String(a.date).slice(0, 10))}">${esc(formatDate(a.date, lang))}</time></span></p>
      <h1 lang="${title.lang}">${esc(title.value)}</h1>
      ${notice ? `<p class="notice">${esc(notice)}</p>` : ''}
    </div>
  </header>
  ${a.image ? `<div class="container article-cover">${img(a.image, '', a[`image_alt_${lang}`] || a[`image_alt_${title.lang}`] || '', '', true)}</div>` : ''}
  <div class="container narrow">
    <div class="prose" lang="${bodyMd.lang}">${md(bodyMd.value)}</div>
    ${shareBlock(lang, abs(path), title.value)}
    <p><a class="link-arrow back" href="${pagePath(lang, 'news')}">${icon('arrowLeft')} ${esc(t.common.backToNews)}</a></p>
  </div>
</article>`;
  const hasFr = Boolean(a.title_fr); const hasEn = Boolean(a.title_en);
  return {
    body, path,
    canonical: fallback ? otherPath : path,
    title: `${title.value} | ${C.tradeName}`,
    description: desc,
    ogType: 'article',
    ogImage: a.image,
    alternates: { fr: hasFr ? pagePath('fr', 'news', a.slug) : null, en: hasEn ? pagePath('en', 'news', a.slug) : null },
    breadcrumbs: [{ name: t.nav.news, path: pagePath(lang, 'news') }, { name: title.value, path }],
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'NewsArticle',
      headline: title.value, datePublished: String(a.date).slice(0, 10), inLanguage: title.lang,
      ...(a.image ? { image: [abs(asset(a.image))] } : {}),
      mainEntityOfPage: abs(path),
      publisher: { '@type': 'Organization', name: C.legalName, logo: { '@type': 'ImageObject', url: abs(asset('assets/img/logo-guems-mining-480.png')) } },
    }],
  };
}

function pageContact(lang) {
  const t = T[lang]; const c = t.contact; const f = c.form;
  const endpoint = /^https?:\/\//.test(site.contact.endpoint) ? site.contact.endpoint : asset(site.contact.endpoint);
  const req = '<span class="req" aria-hidden="true">*</span>';
  const field = (id, label, input, required = true, hint = '') => `
      <div class="field" data-field="${id}">
        <label for="f-${id}">${esc(label)} ${required ? req : `<span class="opt">(${esc(f.optional)})</span>`}</label>
        ${input}
        ${hint}
        <p class="field-error" id="e-${id}" hidden></p>
      </div>`;
  const map = site.features.mapEmbedUrl;
  const body = `
${pageHero(c.eyebrow, c.title, c.lead)}
<section class="section">
  <div class="container contact-grid">
    <aside class="contact-aside reveal" data-reveal="left">
      <h2 class="h3">${esc(c.coordsTitle)}</h2>
      <address>
        <p class="contact-line">${icon('building')}<span><strong>${esc(C.legalName)}</strong></span></p>
        <p class="contact-line">${icon('pin')}<span>${esc(C.address.city)}, ${esc(C.address.street)}<br>${esc(C.address.country[lang])}</span></p>
        <p class="contact-line">${icon('phone')}<span>${esc(t.common.phone)} : <a href="${telHref}">${esc(C.phone)}</a></span></p>
        ${C.email ? `<p class="contact-line">${icon('mail')}<span><a href="mailto:${esc(C.email)}">${esc(C.email)}</a></span></p>` : ''}
      </address>
      <h2 class="h3">${esc(c.quickTitle)}</h2>
      <div class="quick-actions">
        <a class="btn btn-primary" href="${telHref}">${icon('phone')} ${esc(t.common.call)}</a>
        <a class="btn btn-whatsapp" href="${waHref(lang)}" target="_blank" rel="noopener noreferrer">${icon('whatsapp')} ${esc(t.common.whatsapp)}</a>
      </div>
      ${map ? `<h2 class="h3">${esc(c.mapTitle)}</h2><div class="map"><iframe src="${esc(map)}" title="${esc(c.mapTitle)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>` : ''}
    </aside>
    <div class="contact-form-wrap reveal" data-reveal="right">
      <h2 class="h3">${esc(c.formTitle)}</h2>
      <p class="form-note">${esc(f.required)}</p>
      <div class="form-status" role="status" aria-live="polite" tabindex="-1" data-form-status hidden></div>
      <form class="contact-form" action="${esc(endpoint)}" method="post" novalidate data-contact-form>
        <input type="hidden" name="lang" value="${lang}">
        <input type="hidden" name="ts" value="" data-ts>
        <div class="hp" aria-hidden="true"><label for="f-website">${esc(f.honeypot)}</label><input type="text" id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
        <div class="form-row">
          ${field('name', f.name, `<input type="text" id="f-name" name="name" autocomplete="name" required maxlength="120" aria-describedby="e-name">`)}
          ${field('company', f.company, `<input type="text" id="f-company" name="company" autocomplete="organization" maxlength="160">`, false)}
        </div>
        <div class="form-row">
          ${field('email', f.email, `<input type="email" id="f-email" name="email" autocomplete="email" required maxlength="160" aria-describedby="e-email">`)}
          ${field('phone', f.phone, `<input type="tel" id="f-phone" name="phone" autocomplete="tel" required maxlength="40" pattern="[0-9+()\\s.\\-]{6,40}" aria-describedby="e-phone">`)}
        </div>
        ${field('subject', f.subject, `<select id="f-subject" name="subject" required aria-describedby="e-subject"><option value="">${esc(f.subjectPlaceholder)}</option>${f.subjects.map((s) => `<option>${esc(s)}</option>`).join('')}</select>`)}
        ${field('message', f.message, `<textarea id="f-message" name="message" rows="6" required minlength="10" maxlength="5000" aria-describedby="e-message"></textarea>`)}
        <div class="field field-check" data-field="consent">
          <input type="checkbox" id="f-consent" name="consent" value="1" required aria-describedby="e-consent">
          <label for="f-consent">${esc(f.consent)} <a href="${pagePath(lang, 'legal')}">${esc(f.consentLink)}</a>. ${req}</label>
          <p class="field-error" id="e-consent" hidden></p>
        </div>
        <button class="btn btn-primary btn-lg" type="submit" data-sending="${esc(f.sending)}">${esc(f.submit)} ${icon('arrow')}</button>
      </form>
      <script type="application/json" id="form-i18n">${JSON.stringify({ errors: c.errors, status: c.status }).replace(/</g, '\\u003c')}</script>
    </div>
  </div>
</section>`;
  return { body, breadcrumbs: [{ name: t.nav.contact, path: pagePath(lang, 'contact') }], jsonLd: [orgLd()] };
}

function pageLegal(lang) {
  const t = T[lang]; const l = t.legal;
  const body = `
${pageHero(t.footer.legal, l.title, '')}
<section class="section">
  <div class="container narrow prose">
    <h2>${esc(l.publisherTitle)}</h2>
    ${identityTable(lang)}
    <h2>${esc(l.privacyTitle)}</h2>
    ${l.privacy.map((p) => `<p>${esc(p)}</p>`).join('')}
    <h2>${esc(l.ipTitle)}</h2>
    <p>${esc(l.ip)}</p>
  </div>
</section>`;
  return { body, breadcrumbs: [{ name: l.title, path: pagePath(lang, 'legal') }] };
}

// ---------------------------------------------------------------- écriture
rmSync(DIST, { recursive: true, force: true });
cpSync(join(ROOT, 'static'), DIST, { recursive: true });

const sitemap = [];
function write(urlPath, html) {
  const rel = urlPath.slice(BASE.length);
  const file = join(DIST, rel, rel.endsWith('.html') ? '' : 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

const PAGES = { home: pageHome, about: pageAbout, activities: pageActivities, expertise: pageExpertise, projects: pageProjects, news: pageNews, contact: pageContact, legal: pageLegal };

for (const lang of LANGS) {
  for (const [key, fn] of Object.entries(PAGES)) {
    const path = pagePath(lang, key);
    const r = fn(lang);
    write(path, layout({ lang, key, path, title: T[lang].pages[key].title, description: T[lang].pages[key].description, ...r }));
    if (lang === 'fr') sitemap.push({ fr: pagePath('fr', key), en: pagePath('en', key) });
  }
  for (const a of news) {
    const r = pageArticle(lang, a);
    write(r.path, layout({ lang, key: 'news', ...r }));
    if (lang === 'fr') sitemap.push({ fr: a.title_fr ? r.alternates.fr : null, en: a.title_en ? r.alternates.en : null });
  }
  for (const p of projects) {
    const r = pageProject(lang, p);
    write(r.path, layout({ lang, key: 'projects', ...r }));
    if (lang === 'fr') sitemap.push({ fr: r.alternates.fr, en: r.alternates.en });
  }
}

// Page d'entrée : redirection vers la langue mémorisée ou celle du navigateur.
writeFileSync(join(DIST, 'index.html'), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(C.legalName)}</title>
<meta name="description" content="${esc(T.fr.pages.home.description)}">
<link rel="canonical" href="${abs(pagePath('fr', 'home'))}">
<link rel="alternate" hreflang="fr" href="${abs(pagePath('fr', 'home'))}">
<link rel="alternate" hreflang="en" href="${abs(pagePath('en', 'home'))}">
<link rel="alternate" hreflang="x-default" href="${abs(pagePath('fr', 'home'))}">
<link rel="icon" href="${asset('favicon.ico')}" sizes="48x48">
<script>
(function(){var l;try{l=localStorage.getItem('gm-lang')}catch(e){}
if(l!=='fr'&&l!=='en'){l=(navigator.language||'fr').toLowerCase().indexOf('fr')===0?'fr':'en'}
location.replace(l==='en'?'${pagePath('en', 'home')}':'${pagePath('fr', 'home')}');})();
</script>
<noscript><meta http-equiv="refresh" content="0; url=${pagePath('fr', 'home')}"></noscript>
<style>body{font-family:system-ui,sans-serif;background:#101010;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#FF9A2E}</style>
</head>
<body><p><a href="${pagePath('fr', 'home')}" hreflang="fr">Français</a> · <a href="${pagePath('en', 'home')}" hreflang="en">English</a></p></body>
</html>
`);

// Page 404 bilingue.
writeFileSync(join(DIST, '404.html'), layout({
  lang: 'fr', key: '404', path: `${BASE}404.html`, noindex: true,
  alternates: { fr: pagePath('fr', 'home'), en: pagePath('en', 'home') },
  title: `${T.fr.notFound.title} | ${C.tradeName}`, description: T.fr.notFound.text,
  body: `
<section class="not-found">
  <div class="not-found-bg">${img('', 'terrain.svg', '', '', true)}</div>
  <div class="container not-found-inner">
    <p class="code" aria-hidden="true">404</p>
    <h1>${esc(T.fr.notFound.title)}</h1>
    <p>${esc(T.fr.notFound.text)}</p>
    <p lang="en" class="en"><strong>${esc(T.en.notFound.title)}.</strong> ${esc(T.en.notFound.text)}</p>
    <div class="cta-actions center">
      <a class="btn btn-primary" href="${pagePath('fr', 'home')}">${esc(T.fr.notFound.button)}</a>
      <a class="btn btn-outline-light" href="${pagePath('en', 'home')}" lang="en" hreflang="en">${esc(T.en.notFound.button)}</a>
    </div>
  </div>
</section>`,
}));

// Sitemap XML avec alternatives hreflang.
const today = new Date().toISOString().slice(0, 10);
const urls = sitemap.flatMap((s) => ['fr', 'en'].filter((l) => s[l]).map((l) => `  <url>
    <loc>${abs(s[l])}</loc>
    <lastmod>${today}</lastmod>
${['fr', 'en'].filter((x) => s[x]).map((x) => `    <xhtml:link rel="alternate" hreflang="${x}" href="${abs(s[x])}"/>`).join('\n')}
  </url>`));
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`);

writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Disallow: ${BASE}admin/
Disallow: ${BASE}contact.php

Sitemap: ${abs(`${BASE}sitemap.xml`)}
`);

writeFileSync(join(DIST, 'site.webmanifest'), JSON.stringify({
  name: C.legalName, short_name: C.tradeName, start_url: BASE, display: 'browser',
  background_color: '#101010', theme_color: '#101010',
  icons: [
    { src: asset('assets/img/icon-192.png'), sizes: '192x192', type: 'image/png' },
    { src: asset('assets/img/icon-512.png'), sizes: '512x512', type: 'image/png' },
  ],
}, null, 2));

console.log(`Site généré dans dist/ — ${urls.length} pages indexables, ${news.length} actualité(s), ${projects.length} projet(s).`);
for (const w of warnings) console.warn(`⚠  ${w}`);
