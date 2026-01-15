-- Create table for per-day stats (user_daily)
CREATE TABLE IF NOT EXISTS user_daily (
  user_id TEXT NOT NULL,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);