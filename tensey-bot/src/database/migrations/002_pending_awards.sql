-- Pending XP awards (ensures no XP lost on restart)
CREATE TABLE IF NOT EXISTS pending_xp_awards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  challenge_idx INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  award_scheduled_at TEXT NOT NULL,
  awarded_at TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate pending awards
  UNIQUE(user_id, challenge_idx, awarded_at)
);

CREATE INDEX idx_pending_awards_due 
ON pending_xp_awards(award_scheduled_at) 
WHERE awarded_at IS NULL;

CREATE INDEX idx_pending_awards_user 
ON pending_xp_awards(user_id);

