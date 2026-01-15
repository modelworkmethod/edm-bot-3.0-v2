-- Create table for cumulative stats (user_stats)
CREATE TABLE IF NOT EXISTS user_stats (
  user_id TEXT NOT NULL,
  stat TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, stat)
);