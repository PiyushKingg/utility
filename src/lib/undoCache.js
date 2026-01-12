const { v4: uuidv4 } = require('uuid');

const cache = new Map();

function storeUndo(guildId, beforeState, ttlSeconds = 40) {
  const actionId = uuidv4();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  cache.set(actionId, { guildId, beforeState, expiresAt });
  setTimeout(() => cache.delete(actionId), ttlSeconds * 1000 + 1000);
  return actionId;
}

function getUndo(actionId) {
  const data = cache.get(actionId);
  if (!data) return null;
  if (Date.now() > data.expiresAt) { cache.delete(actionId); return null; }
  return data;
}

function consumeUndo(actionId) {
  const data = getUndo(actionId);
  if (!data) return null;
  cache.delete(actionId);
  return data;
}

module.exports = { storeUndo, getUndo, consumeUndo };
