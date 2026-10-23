// État central de l'éditeur : projet courant, sélection, tête de lecture, historique et sauvegarde.

import { Emitter, deepClone, debounce } from './util.js';
import { db } from './db.js';
import { findClip, projectDuration } from './model.js';

const HISTORY_LIMIT = 150;

export class Store extends Emitter {
  constructor() {
    super();
    this.project = null;
    this.selection = null; // id du clip sélectionné
    this.time = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.dirty = false;
    this.saveState = 'saved';
    this.gesture = null; // regroupe les modifications continues (glisser un curseur…)
    this.autosave = debounce(() => this.save(), 800);
  }

  load(project) {
    this.project = project;
    this.selection = null;
    this.time = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.emit('load', project);
    this.emit('change', { reason: 'load' });
  }

  get duration() { return this.project ? projectDuration(this.project) : 0; }
  get selected() { return this.selection && this.project ? findClip(this.project, this.selection) : null; }

  select(clipId) {
    if (this.selection === clipId) return;
    this.selection = clipId;
    this.emit('select', clipId);
  }

  setTime(t) {
    this.time = Math.max(0, Math.min(t, this.duration));
    this.emit('time', this.time);
  }

  // Applique une modification au projet et l'enregistre dans l'historique.
  // options.gesture : clé de regroupement ; les appels successifs avec la même clé
  // ne créent qu'une seule étape d'annulation.
  mutate(label, fn, { gesture = null } = {}) {
    if (!this.project) return;
    if (!gesture || this.gesture !== gesture) {
      this.undoStack.push({ label, snapshot: JSON.stringify(this.project), selection: this.selection });
      if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
      this.redoStack = [];
    }
    this.gesture = gesture;
    fn(this.project);
    this.touch(label);
  }

  endGesture() { this.gesture = null; }

  touch(label = '') {
    this.project.updatedAt = Date.now();
    this.saveState = 'pending';
    this.emit('save-state', this.saveState);
    this.emit('change', { reason: label });
    this.autosave();
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  undo() {
    const step = this.undoStack.pop();
    if (!step) return;
    this.redoStack.push({ label: step.label, snapshot: JSON.stringify(this.project), selection: this.selection });
    this.restore(step);
  }

  redo() {
    const step = this.redoStack.pop();
    if (!step) return;
    this.undoStack.push({ label: step.label, snapshot: JSON.stringify(this.project), selection: this.selection });
    this.restore(step);
  }

  restore(step) {
    this.gesture = null;
    this.project = JSON.parse(step.snapshot);
    if (this.selection && !findClip(this.project, this.selection)) this.selection = null;
    this.emit('select', this.selection);
    this.touch(`annuler : ${step.label}`);
  }

  async save() {
    if (!this.project) return;
    this.saveState = 'saving';
    this.emit('save-state', this.saveState);
    try {
      await db.putProject(deepClone(this.project));
      this.saveState = 'saved';
    } catch (err) {
      console.error(err);
      this.saveState = 'error';
    }
    this.emit('save-state', this.saveState);
  }
}
