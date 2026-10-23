// Composants d'interface partagés : icônes, boîtes de dialogue, notifications.

import { el } from '../util.js';

const P = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M18 5 9 12l9 7V5Z"/><path d="M6 5v14"/>',
  next: '<path d="m6 5 9 7-9 7V5Z"/><path d="M18 5v14"/>',
  start: '<path d="M19 20 9 12l10-8v16Z"/><path d="M5 19V5"/>',
  end: '<path d="m5 4 10 8-10 8V4Z"/><path d="M19 5v14"/>',
  loop: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  split: '<path d="M12 3v18"/><path d="M5 8 2 12l3 4"/><path d="m19 8 3 4-3 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  magnet: '<path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  volume: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
  film: '<rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/>',
  type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
  shapes: '<rect x="3" y="3" width="8" height="8" rx="1"/><circle cx="17" cy="17" r="4"/><path d="M17 3l4 7h-8z"/>',
  wand: '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  zoomIn: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M8 11h6"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/>',
};

export function icon(name, cls = 'ico') {
  const span = document.createElement('span');
  span.style.display = 'inline-flex';
  span.innerHTML = `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  return span.firstElementChild;
}

export function button(label, { icon: ic, cls = '', title, onclick, disabled, pressed, iconOnly = false } = {}) {
  const b = el('button', { type: 'button', class: `btn ${cls} ${iconOnly ? 'icon' : ''}`.trim(), title: title || (iconOnly ? label : undefined), 'aria-label': iconOnly ? label : undefined, onclick, disabled });
  if (pressed !== undefined) b.setAttribute('aria-pressed', String(Boolean(pressed)));
  if (ic) b.append(icon(ic));
  if (!iconOnly) b.append(label);
  return b;
}

// Boîte de dialogue modale. Renvoie { dialog, body, foot, close, closed }.
export function openDialog({ title, wide = false, content, actions = [], onClose } = {}) {
  const body = el('div', { class: 'dlg-body' }, content ? [].concat(content) : []);
  const foot = el('div', { class: 'dlg-foot' });
  const d = el('dialog', { class: wide ? 'wide' : '' }, [
    el('div', { class: 'dlg' }, [
      el('div', { class: 'dlg-head' }, [el('h2', { text: title }), button('Fermer', { icon: 'close', iconOnly: true, cls: 'ghost', onclick: () => close() })]),
      body,
      foot,
    ]),
  ]);
  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  const close = (value) => { if (d.open) d.close(); d.remove(); onClose?.(value); resolveClosed(value); };
  d.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  for (const a of actions) foot.append(button(a.label, { cls: a.cls, icon: a.icon, onclick: () => a.onclick ? a.onclick(close) : close(a.value), disabled: a.disabled }));
  if (!actions.length) foot.remove();
  document.body.append(d);
  d.showModal();
  return { dialog: d, body, foot, close, closed };
}

export function confirmDialog(message, { title = 'Confirmation', confirmLabel = 'Confirmer', danger = false } = {}) {
  return openDialog({
    title,
    content: el('p', { text: message, style: { margin: '0' } }),
    actions: [{ label: 'Annuler', value: false }, { label: confirmLabel, cls: danger ? 'danger' : 'primary', value: true }],
  }).closed.then(Boolean);
}

export function toast(message, type = 'info', ms = 4200) {
  let box = document.querySelector('.toasts');
  if (!box) { box = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(box); }
  const t = el('div', { class: `toast ${type}`, text: message });
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

export function field(label, control, hint) {
  return el('label', { class: 'field' }, [el('span', { text: label }), control, hint ? el('small', { class: 'muted', text: hint }) : null]);
}

export function select(options, value, onchange, attrs = {}) {
  const s = el('select', { ...attrs, onchange: (e) => onchange?.(e.target.value) });
  for (const [v, label] of Object.entries(options)) s.append(el('option', { value: v, text: label, selected: String(v) === String(value) }));
  return s;
}
