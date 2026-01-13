const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const PERSIST_PATH = path.join(DATA_DIR, 'undo.json');

let store = {};
try {
  if (fs.existsSync(PERSIST_PATH)) {
    const raw = fs.readFileSync(PERSIST_PATH, 'utf8');
    store = JSON.parse(raw || '{}');
  }
} catch (err) {
  store = {};
}

function persist() {
  try { fs.writeFileSync(PERSIST_PATH, JSON.stringify(store)); } catch (e) { /* ignore */ }
}

function makeId() {
  return `u_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
}

/**
 * storeUndo(guildId, beforeState, applyUndoFn, ttlSeconds)
 * - beforeState: arbitrary object to pass to applyUndoFn when undoing
 * - applyUndoFn: async function(beforeState) { ... } that will apply the undo
 * - ttlSeconds: how long Undo is available
 */
function storeUndo(guildId, beforeState, applyUndoFn, ttlSeconds = 45) {
  const id = makeId();
  const expiry = Date.now() + ttlSeconds * 1000;
  store[id] = { guildId, beforeState, expiry };
  // persist small metadata only; the actual applyUndoFn is kept in-memory in a map
  persist();

  // keep the actual function in a transient map
  _fns[id] = applyUndoFn;

  // schedule cleanup
  setTimeout(() => {
    delete store[id];
    delete _fns[id];
    persist();
  }, ttlSeconds * 1000 + 2000);

  return id;
}

// transient function map (not persisted)
const _fns = {};

/**
 * consumeUndo(id)
 * - returns { beforeState, applyUndoFn } or null if expired/missing
 * - consumes (removes) the entry so it can't be used again
 */
function consumeUndo(id) {
  const entry = store[id];
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    delete store[id];
    delete _fns[id];
    persist();
    return null;
  }
  const fn = _fns[id];
  delete store[id];
  delete _fns[id];
  persist();
  return { beforeState: entry.beforeState, applyUndoFn: fn };
}

module.exports = { storeUndo, consumeUndo };
