-- Secondary XP System Tables

-- Log of all secondary XP actions
CREATE TABLE IF NOT EXISTS secondary_xp_log (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'barbie', 'texting_practice', 'journal', 'duels'
  action VARCHAR(50) NOT NULL,
  xp_earned INTEGER NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_secondary_xp_user_id ON secondary_xp_log(user_id);
CREATE INDEX IF NOT EXISTS idx_secondary_xp_category ON secondary_xp_log(category);
CREATE INDEX IF NOT EXISTS idx_secondary_xp_created_at ON secondary_xp_log(created_at);

-- Active multiplier boosts (from texting practice, etc)
CREATE TABLE IF NOT EXISTS active_multiplier_boosts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  multiplier DECIMAL(4,2) NOT NULL, -- e.g., 1.10 for +10%
  applies_to TEXT[], -- Array of stat names
  expires_at TIMESTAMP NOT NULL,
  source VARCHAR(50) NOT NULL, -- 'texting_practice', 'event', etc
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boosts_user_id ON active_multiplier_boosts(user_id);
CREATE INDEX IF NOT EXISTS idx_boosts_expires_at ON active_multiplier_boosts(expires_at);

-- Clean up expired boosts periodically (cron job will handle this)
-- For now, queries will check expires_at > NOW()

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 005_add_secondary_xp_system.sql completed successfully';
END $$;

