-- Migration: Create archetype_history table
-- Tracks every archetype change for trend analysis and coaching insights
BEGIN;

-- Create archetype_history table
CREATE TABLE IF NOT EXISTS archetype_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  previous_archetype VARCHAR(20),
  new_archetype VARCHAR(20) NOT NULL,
  warrior_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  mage_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  templar_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  warrior_percent DECIMAL(5,2) NOT NULL,
  mage_percent DECIMAL(5,2) NOT NULL,
  total_xp INTEGER NOT NULL DEFAULT 0,
  volatility DECIMAL(5,3) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_archetype_history_user_id 
  ON archetype_history(user_id);

CREATE INDEX IF NOT EXISTS idx_archetype_history_changed_at 
  ON archetype_history(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_archetype_history_user_date 
  ON archetype_history(user_id, changed_at DESC);

COMMIT;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 022_create_archetype_history.sql completed successfully';
END $$;

