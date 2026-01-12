// src/lib/undoCache.js
const { v4: uuidv4 } = require('uuid');
const cache = new Map(); // actionId -> { guildId, beforeState, applyUndoFn, expiresAt }

function storeUndo(guildId, beforeState, applyUndoFn, ttlSeconds = 45) {
  const id = uuidv4();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  cache.set(id, { guildId, beforeState, applyUndoFn, expiresAt });
  setTimeout(() => cache.delete(id), ttlSeconds * 1000 + 2000);
  return id;
}

function consumeUndo(id) {
  const data = cache.get(id);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    cache.delete(id);
    return null;
  }
  cache.delete(id);
  return data;
}

module.exports = { storeUndo, consumeUndo };
