// src/lib/undoCache.js
const crypto = require('crypto');

const MAP = new Map(); // id -> { beforeState, applyUndoFn, expiresAt }

function storeUndo(guildId, beforeState, applyUndoFn, ttlSeconds = 45) {
  const id = crypto.randomBytes(6).toString('hex');
  const expiresAt = Date.now() + ttlSeconds * 1000;
  MAP.set(id, { guildId, beforeState, applyUndoFn, expiresAt });
  // schedule removal
  setTimeout(() => { MAP.delete(id); }, ttlSeconds * 1000 + 2000);
  return id;
}

function consumeUndo(id) {
  const e = MAP.get(id);
  if (!e) return null;
  MAP.delete(id);
  return { beforeState: e.beforeState, applyUndoFn: e.applyUndoFn };
}

module.exports = { storeUndo, consumeUndo };
