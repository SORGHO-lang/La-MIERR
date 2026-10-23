// Planificateur local (SANS intelligence artificielle) : analyse le brief par mots-clés et
// adapte un modèle existant. Il est présenté comme tel dans l'interface ; il sert de solution
// de repli quand le service d'IA n'est pas configuré.

import { TEMPLATES, findTemplate } from '../templates.js';
import { normalizePlan, scalePlan } from '../builder.js';

const RULES = [
  { re: /tiktok|reels?|shorts?|story|stories|vertical|9[:/]16/i, aspect: '9:16' },
  { re: /instagram|carr[ée]|1[:/]1|feed/i, aspect: '1:1' },
];
const CATEGORY_RULES = [
  { re: /logo anim|révélation de logo|logo reveal/i, tpl: 'logo-reveal' },
  { re: /intro|ouverture|générique d.ouverture/i, tpl: 'intro-channel' },
  { re: /outro|générique de fin|fin de vidéo/i, tpl: 'outro-subscribe' },
  { re: /immobili|villa|appartement|maison à vendre|agence immo/i, tpl: 'real-estate' },
  { re: /formation|tutoriel|cours|module|pédagog/i, tpl: 'training-module' },
  { re: /clip|musique|chanson|artiste|lyrics|paroles/i, tpl: 'music-clip' },
  { re: /événement|evenement|festival|concert|salon|conférence|soirée|lancement officiel/i, tpl: 'event-teaser' },
  { re: /produit|application|appli|gadget|nouveau modèle|lancement/i, tpl: 'product-launch' },
  { re: /institution|ministère|ong|association|fondation|rapport annuel/i, tpl: 'corporate-institutional' },
  { re: /histoire|storytelling|émotion|témoignage|parcours/i, tpl: 'story-brand' },
  { re: /typographi|kinetic|cinétique|manifeste/i, tpl: 'kinetic-manifesto' },
  { re: /tiktok|reels?|shorts?/i, tpl: 'social-tiktok' },
  { re: /instagram/i, tpl: 'social-instagram-square' },
  { re: /15 ?s|courte|spot|promo|soldes|offre/i, tpl: 'ad-flash-15' },
  { re: /présentation d.entreprise|qui sommes|corporate|entreprise|société|sarl|minière|mining/i, tpl: 'promo-company' },
];

function extract(brief) {
  const out = {};
  const dur = /(\d{1,3})\s*(?:s\b|sec|secondes?|seconds?)/i.exec(brief);
  const min = /(\d{1,2})\s*(?:min|minutes?)/i.exec(brief);
  if (dur) out.duration = Number(dur[1]);
  else if (min) out.duration = Number(min[1]) * 60;
  out.aspect = RULES.find((r) => r.re.test(brief))?.aspect || '16:9';
  const quoted = /[«"“]\s*([^»"”]{2,60})\s*[»"”]/.exec(brief);
  const named = /(?:pour|de)\s+(?:l['’]entreprise|la société|la marque|l['’]agence|le restaurant|la boutique)?\s*([A-Z0-9][\w'’&.-]*(?:\s+[A-Z0-9][\w'’&.-]*){0,3})/.exec(brief);
  out.brand = (quoted?.[1] || named?.[1] || '').trim();
  out.phone = /(\+?\d[\d\s.-]{7,}\d)/.exec(brief)?.[1] || '';
  out.email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(brief)?.[0] || '';
  out.url = /(?:https?:\/\/)?(?:www\.)[\w.-]+\.[a-z]{2,}/i.exec(brief)?.[0] || '';
  out.cinematic = /cin[ée]ma|cinématique|épique|premium|luxe/i.test(brief);
  out.energetic = /dynamique|énergique|rythm|punchy|entraînant/i.test(brief);
  return out;
}

export function localPlan(brief, { aspect, duration } = {}) {
  const info = extract(brief || '');
  // Une demande de publicité prime sur les éléments cités (logo animé, transitions…).
  const isAd = /publicit|\bpub\b|spot|réclame|annonce publicitaire|commercial/i.test(brief);
  const tplId = isAd ? ((info.duration && info.duration <= 15) || /\b15 ?s/i.test(brief) ? 'ad-flash-15' : 'ad-cinematic-30')
    : CATEGORY_RULES.find((r) => r.re.test(brief))?.tpl || 'ad-cinematic-30';
  const tpl = findTemplate(tplId) || TEMPLATES[0];
  const plan = normalizePlan({ ...JSON.parse(JSON.stringify(tpl.plan)), title: info.brand ? `Vidéo — ${info.brand}` : tpl.name });
  plan.aspect = aspect || (tplId.startsWith('social-tiktok') || tplId === 'kinetic-manifesto' ? '9:16' : info.aspect);
  if (info.cinematic) plan.style.effects = [...new Set([...plan.style.effects, 'letterbox', 'grain', 'vignette'])];
  if (info.energetic) plan.scenes.forEach((s) => { if (s.textAnimation === 'mask-up') s.textAnimation = 'pop-words'; });
  const contact = [info.phone, info.email, info.url].filter(Boolean).join(' · ');
  plan.scenes.forEach((s) => {
    if (info.brand) s.headline = s.headline.replace(/VOTRE MARQUE|Votre entreprise|Votre institution|Votre nom/gi, info.brand);
    if (s.visual === 'cta' && contact) s.subtext = contact;
  });
  scalePlan(plan, duration || info.duration || null);
  plan.source = { kind: 'local', template: tpl.id, label: `Plan généré localement à partir du modèle « ${tpl.name} » (sans IA)` };
  plan.music = { mood: plan.music?.mood || tpl.plan.music?.mood || plan.style.mood, bpm: plan.music?.bpm || null, suggestions: [] };
  return plan;
}
