-- Boss Raid System Tables

-- Raid events
CREATE TABLE IF NOT EXISTS raid_events (
  id SERIAL PRIMARY KEY,
  raid_type VARCHAR(50) NOT NULL, -- 'warrior' or 'mage'
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, active, completed, failed
  target_points INTEGER NOT NULL, -- Points needed to win
  current_points INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Raid contributions
CREATE TABLE IF NOT EXISTS raid_contributions (
  id SERIAL PRIMARY KEY,
  raid_id INTEGER REFERENCES raid_events(id),
  user_id VARCHAR(255) NOT NULL,
  stat_type VARCHAR(255) NOT NULL,
  value INTEGER NOT NULL,
  points_earned INTEGER NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_raid_contributions_raid_id ON raid_contributions(raid_id);
CREATE INDEX IF NOT EXISTS idx_raid_contributions_user_id ON raid_contributions(user_id);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 002_add_raid_system.sql completed successfully';
END $$;

