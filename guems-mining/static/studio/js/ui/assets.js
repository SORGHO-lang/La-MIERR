// Sélecteur de médias pour les modèles et l'assistant IA (logo, images/vidéos, musique, voix off).

import { el } from '../util.js';
import { button, field, select, toast } from './common.js';
import { ACCEPT_ATTR } from '../media.js';

export class AssetPicker {
  constructor({ media, initialIds = [] }) {
    this.media = media;
    this.ids = [...new Set(initialIds)];
    this.state = { logo: '', visuals: new Set(), music: '', voice: '' };
    this.root = el('div', { class: 'stack' });
    this.fileInput = el('input', { type: 'file', multiple: true, accept: ACCEPT_ATTR, hidden: true, onchange: (e) => { this.import([...e.target.files]); e.target.value = ''; } });
    this.render();
  }

  async import(files) {
    const { added, errors } = await this.media.import(files);
    for (const m of added) {
      this.ids.push(m.id);
      if (m.kind === 'image' && !this.state.logo && /logo/i.test(m.name)) this.state.logo = m.id;
      else if (m.kind === 'video' || m.kind === 'image') this.state.visuals.add(m.id);
      else if (m.kind === 'audio' && !this.state.music) this.state.music = m.id;
    }
    errors.forEach((e) => toast(`Import refusé — ${e}`, 'error', 7000));
    this.render();
  }

  get items() { return this.media.list(this.ids); }

  render() {
    const items = this.items;
    const images = items.filter((m) => m.kind === 'image');
    const visuals = items.filter((m) => m.kind === 'image' || m.kind === 'video');
    const audios = items.filter((m) => m.kind === 'audio');
    const opt = (list, empty) => ({ '': empty, ...Object.fromEntries(list.map((m) => [m.id, m.name])) });
    const visualList = el('div', { class: 'media-grid' }, visuals.map((m) => {
      const checked = this.state.visuals.has(m.id);
      const box = el('input', { type: 'checkbox', checked, 'aria-label': m.name, onchange: (e) => { if (e.target.checked) this.state.visuals.add(m.id); else this.state.visuals.delete(m.id); } });
      return el('label', { class: 'media-item', style: { cursor: 'pointer' } }, [
        el('div', { class: 'media-thumb', style: m.thumb ? { backgroundImage: `url(${m.thumb})` } : {} }),
        el('div', { class: 'media-meta row' }, [box, el('b', { text: m.name })]),
      ]);
    }));
    this.root.replaceChildren(
      el('div', { class: 'row' }, [
        el('span', { class: 'grow small muted', text: `${items.length} média(s) disponible(s). Les images et vidéos cochées sont utilisées dans l'ordre des scènes.` }),
        button('Importer des médias', { icon: 'upload', cls: 'sm', onclick: () => this.fileInput.click() }),
        this.fileInput,
      ]),
      el('div', { class: 'grid-3' }, [
        field('Logo', select(opt(images, 'Aucun'), this.state.logo, (v) => { this.state.logo = v; })),
        field('Musique', select(opt(audios, 'Aucune'), this.state.music, (v) => { this.state.music = v; })),
        field('Voix off', select(opt(audios, 'Aucune'), this.state.voice, (v) => { this.state.voice = v; })),
      ]),
      visuals.length ? visualList : el('p', { class: 'small muted', text: 'Aucune image ni vidéo : les scènes utiliseront des fonds animés.' }),
    );
  }

  assets() {
    const g = (id) => (id ? this.media.get(id) : null);
    return {
      logo: g(this.state.logo),
      visuals: [...this.state.visuals].map(g).filter(Boolean),
      music: g(this.state.music),
      voice: g(this.state.voice),
    };
  }

  summary() {
    const a = this.assets();
    return { logo: Boolean(a.logo), visuals: a.visuals.length, music: Boolean(a.music), voice: Boolean(a.voice) };
  }
}
