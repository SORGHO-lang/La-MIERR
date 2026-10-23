// Fichier de projet portable « .gmstudio » : projet + médias, pour sauvegarder ou changer d'ordinateur.
// Format binaire : "GMSTUDIO" (8 octets) | longueur de l'en-tête JSON (uint32) | en-tête JSON | fichiers concaténés.

import { db } from './db.js';
import { sanitizeProject } from './model.js';
import { uid } from './util.js';

const MAGIC = 'GMSTUDIO';

export async function exportPackage(project, media) {
  const files = [];
  const entries = [];
  let offset = 0;
  for (const id of project.mediaIds) {
    const meta = media.get(id); const blob = media.blob(id);
    if (!meta || !blob) continue;
    entries.push({ ...meta, offset, length: blob.size });
    files.push(blob);
    offset += blob.size;
  }
  const header = new TextEncoder().encode(JSON.stringify({ format: 1, project, media: entries }));
  const head = new Uint8Array(12);
  head.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(head.buffer).setUint32(8, header.length, true);
  return new Blob([head, header, ...files], { type: 'application/octet-stream' });
}

export async function importPackage(file, mediaManager) {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPackage = new TextDecoder().decode(head.slice(0, 8)) === MAGIC;
  let data;
  let base = 0;
  if (isPackage) {
    const len = new DataView(head.buffer).getUint32(8, true);
    if (len > 50 * 1024 * 1024) throw new Error('En-tête de projet invalide.');
    data = JSON.parse(await file.slice(12, 12 + len).text());
    base = 12 + len;
  } else {
    data = { project: JSON.parse(await file.text()), media: [] }; // projet JSON simple (sans médias)
  }
  const project = sanitizeProject(data.project);
  project.id = uid('prj');
  project.name = `${project.name} (importé)`;
  project.updatedAt = Date.now();
  for (const m of data.media || []) {
    const { offset, length, ...meta } = m;
    if (typeof offset !== 'number' || typeof length !== 'number' || base + offset + length > file.size) continue;
    const blob = file.slice(base + offset, base + offset + length, meta.mime || '');
    const rec = { ...meta, blob };
    await db.putMedia(rec);
    mediaManager.register(rec);
  }
  await db.putProject(project);
  return project;
}
