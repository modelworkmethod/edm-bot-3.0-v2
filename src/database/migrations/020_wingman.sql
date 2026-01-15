-- Wingman Matcher System
-- Weekly pairing with private threads in matchups channel

BEGIN;

-- Wingman runs (one per week)
CREATE TABLE IF NOT EXISTS wingman_runs (
  id BIGSERIAL PRIMARY KEY,
  run_key TEXT UNIQUE NOT NULL,          -- e.g., '2025-W41'
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  matchups_message_id TEXT,              -- weekly summary message in #wingman-matchups
  pinned BOOLEAN DEFAULT FALSE,
  stats JSONB DEFAULT '{}'::jsonb,       -- pairs_count, eligible_count, skipped_count, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pair history (avoid repeats)
CREATE TABLE IF NOT EXISTS wingman_pairs (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT REFERENCES wingman_runs(id) ON DELETE CASCADE,
  user_a_id TEXT NOT NULL,
  user_b_id TEXT NOT NULL,
  thread_id TEXT,                         -- private thread id in matchups channel
  alpha_user_id TEXT,                     -- first to message
  beta_user_id TEXT,                      -- second to message
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, user_a_id, user_b_id)
);

-- Index to help repeat-avoidance lookups
CREATE INDEX IF NOT EXISTS idx_wingman_pairs_users ON wingman_pairs (user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_wingman_runs_key ON wingman_runs (run_key);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 020_wingman.sql completed successfully';
END $$;

COMMIT;


