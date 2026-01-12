PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guilds (
  guild_id TEXT PRIMARY KEY,
  config_json TEXT,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS permission_changes (
  id TEXT PRIMARY KEY,
  guild_id TEXT,
  actor_id TEXT,
  target_type TEXT,
  target_id TEXT,
  action_type TEXT,
  before_state TEXT,
  after_state TEXT,
  timestamp INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS scheduled_tasks (
  task_id TEXT PRIMARY KEY,
  guild_id TEXT,
  owner_id TEXT,
  cron TEXT,
  next_run INTEGER,
  payload TEXT
);

CREATE TABLE IF NOT EXISTS undo_cache (
  action_id TEXT PRIMARY KEY,
  guild_id TEXT,
  before_state TEXT,
  expires_at INTEGER
);
