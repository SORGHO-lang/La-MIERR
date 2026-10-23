// Client de l'assistant IA. Les appels passent par le serveur (api/ai.php) qui détient la clé API :
// aucune clé n'est jamais envoyée au navigateur.

import { TEXT_ANIMATIONS } from '../engine/text.js';
import { TRANSITIONS } from '../engine/transitions.js';
import { SCENE_VISUALS, SCENE_EFFECTS, CAMERA_MOVES, GLOBAL_EFFECTS, normalizePlan } from '../builder.js';
import { FONTS } from '../model.js';

const ENDPOINT = new URL('../../api/ai.php', import.meta.url).href;
const CODE_KEY = 'gm-studio-ai-code';

// Vocabulaire autorisé : le serveur construit le schéma JSON de sortie à partir de ces listes.
export const VOCABULARY = {
  visuals: SCENE_VISUALS,
  textAnimations: Object.keys(TEXT_ANIMATIONS),
  transitions: Object.keys(TRANSITIONS),
  sceneEffects: SCENE_EFFECTS,
  cameraMoves: CAMERA_MOVES,
  globalEffects: GLOBAL_EFFECTS,
  fonts: FONTS,
};

export class AIError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const MESSAGES = {
  not_configured: 'Le service d\'IA n\'est pas configuré sur le serveur (clé API absente). Utilisez le planificateur local ou configurez la clé (voir la documentation).',
  sdk_missing: 'La bibliothèque Anthropic n\'est pas installée sur le serveur (composer install).',
  code_required: 'Code d\'accès requis pour utiliser l\'assistant IA.',
  code_invalid: 'Code d\'accès incorrect.',
  rate: 'Trop de requêtes. Patientez un instant avant de réessayer.',
  auth: 'Clé API refusée par le fournisseur d\'IA. Vérifiez la configuration du serveur.',
  network: 'Le serveur n\'a pas pu joindre le service d\'IA (réseau ou délai dépassé).',
  refusal: 'La demande a été refusée par le modèle. Reformulez votre brief.',
  invalid_output: 'La réponse du modèle n\'a pas pu être lue. Réessayez.',
  bad_request: 'Requête invalide.',
  server: 'Erreur du serveur d\'IA.',
  unreachable: 'Le serveur de l\'assistant est injoignable. L\'assistant IA nécessite l\'hébergement PHP du site (il ne fonctionne pas dans l\'aperçu hors ligne).',
};

export const getCode = () => { try { return sessionStorage.getItem(CODE_KEY) || ''; } catch { return ''; } };
export const setCode = (c) => { try { sessionStorage.setItem(CODE_KEY, c); } catch { /* */ } };

async function call(action, payload = {}, signal) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Studio-Code': getCode() },
      body: JSON.stringify({ action, ...payload }),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new AIError('unreachable', MESSAGES.unreachable);
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new AIError(res.status === 404 ? 'unreachable' : 'server', res.status === 404 ? MESSAGES.unreachable : `${MESSAGES.server} (HTTP ${res.status})`);
  if (!res.ok || data.ok === false) {
    const code = data.error || 'server';
    throw new AIError(code, data.message ? `${MESSAGES[code] || MESSAGES.server} ${data.message}`.trim() : (MESSAGES[code] || MESSAGES.server));
  }
  return data;
}

export const status = (signal) => call('status', {}, signal);

export async function generatePlan({ brief, aspect, duration, brand, assets }, signal) {
  const data = await call('plan', { brief, aspect, duration, brand, assets, vocabulary: VOCABULARY }, signal);
  const plan = normalizePlan(data.plan);
  plan.source = { kind: 'ai', model: data.model, label: `Plan proposé par l'IA (${data.model})` };
  return plan;
}

export async function revisePlan({ plan, instruction, assets }, signal) {
  const clean = { ...plan };
  delete clean.source;
  const data = await call('revise', { plan: clean, instruction, assets, vocabulary: VOCABULARY }, signal);
  const next = normalizePlan(data.plan);
  next.source = { kind: 'ai', model: data.model, label: `Plan révisé par l'IA (${data.model})` };
  return next;
}
