-- User progress tracking (local SQLite)
CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT NOT NULL,
  challenge_idx INTEGER NOT NULL,
  completed_count INTEGER DEFAULT 0,
  last_completed_at TEXT,
  PRIMARY KEY (user_id, challenge_idx)
);

CREATE INDEX idx_user_progress_user ON user_progress(user_id);

-- Artifacts (button message IDs)
CREATE TABLE IF NOT EXISTS artifacts (
  guild_id TEXT PRIMARY KEY,
  lb_channel_id TEXT,
  lb_message_id TEXT,
  open_channel_id TEXT,
  open_message_id TEXT,
  open_lb_channel_id TEXT,
  open_lb_message_id TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

