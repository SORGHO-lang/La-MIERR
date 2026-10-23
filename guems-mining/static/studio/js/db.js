// Persistance locale (IndexedDB) : projets et fichiers médias.
// Les médias restent dans le navigateur de l'utilisateur ; rien n'est envoyé à un serveur.

const DB_NAME = 'gm-studio';
const VERSION = 1;
let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de données bloquée par un autre onglet.'));
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction annulée'));
  });
}
const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const db = {
  async listProjects() {
    const all = await tx('projects', 'readonly', (s) => req2p(s.getAll()));
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  getProject: (id) => tx('projects', 'readonly', (s) => req2p(s.get(id))),
  putProject: (p) => tx('projects', 'readwrite', (s) => req2p(s.put(p))),
  deleteProject: (id) => tx('projects', 'readwrite', (s) => req2p(s.delete(id))),
  getMedia: (id) => tx('media', 'readonly', (s) => req2p(s.get(id))),
  putMedia: (m) => tx('media', 'readwrite', (s) => req2p(s.put(m))),
  deleteMedia: (id) => tx('media', 'readwrite', (s) => req2p(s.delete(id))),
  async storageEstimate() {
    if (!navigator.storage?.estimate) return null;
    try { await navigator.storage.persist?.(); } catch { /* facultatif */ }
    return navigator.storage.estimate();
  },
};
