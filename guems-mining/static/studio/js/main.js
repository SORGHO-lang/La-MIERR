// Point d'entrée du Studio : routage entre tableau de bord et éditeur.

import { el } from './util.js';
import { icon, toast } from './ui/common.js';
import { db } from './db.js';
import { Store } from './store.js';
import { AudioEngine } from './engine/audio.js';
import { MediaManager } from './media.js';
import { Dashboard } from './ui/dashboard.js';
import { Editor } from './ui/editor.js';
import { sanitizeProject } from './model.js';

const app = document.getElementById('app');

function unsupported() {
  const missing = [];
  if (!window.indexedDB) missing.push('IndexedDB');
  if (!window.AudioContext && !window.webkitAudioContext) missing.push('Web Audio');
  if (!HTMLCanvasElement.prototype.getContext) missing.push('Canvas');
  return missing;
}

const missing = unsupported();
if (missing.length) {
  app.replaceChildren(el('div', { class: 'empty', style: { margin: '40px' }, text: `Votre navigateur ne prend pas en charge : ${missing.join(', ')}. Utilisez une version récente de Chrome, Edge, Firefox ou Safari.` }));
} else {
  const audio = new AudioEngine();
  const media = new MediaManager(audio);
  const store = new Store();
  const goHome = () => { location.hash = '#/'; };
  const openProject = (id) => { location.hash = `#/projet/${id}`; };
  let editor = null;
  const dashboard = new Dashboard({ media, openProject });
  const dashShell = el('div', { class: 'app' }, [
    el('header', { class: 'topbar' }, [
      el('a', { class: 'brand', href: '#/' }, [el('span', { class: 'brand-mark' }, [icon('film')]), el('span', {}, ['Studio ', el('small', { text: 'montage vidéo et motion design' })])]),
      el('span', { class: 'grow' }),
      el('a', { class: 'btn ghost sm', href: '../', text: 'Retour au site' }),
    ]),
    dashboard.root,
  ]);

  async function route() {
    const m = /^#\/projet\/([\w-]+)$/.exec(location.hash);
    if (m) {
      const project = await db.getProject(m[1]).catch(() => null);
      if (!project) { toast('Projet introuvable.', 'error'); goHome(); return; }
      editor = editor || new Editor({ store, media, audio, goHome });
      app.replaceChildren(editor.root);
      document.title = `${project.name} — Studio`;
      await editor.open(sanitizeProject(project));
    } else {
      editor?.close();
      app.replaceChildren(dashShell);
      document.title = 'Studio vidéo';
      await dashboard.render();
    }
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', () => store.autosave.flush());
  route().catch((e) => { console.error(e); toast(`Erreur au démarrage : ${e.message}`, 'error'); });
  // Accès pour les tests automatisés et le débogage.
  window.__studio = { store, media, audio, get editor() { return editor; } };
}
