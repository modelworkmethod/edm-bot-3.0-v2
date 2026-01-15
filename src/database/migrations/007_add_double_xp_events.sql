-- Double XP Events System

CREATE TABLE IF NOT EXISTS double_xp_events (
  id SERIAL PRIMARY KEY,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  multiplier DECIMAL(3,2) DEFAULT 2.0, -- 2.0 = 2x XP
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed'
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_double_xp_status ON double_xp_events(status);
CREATE INDEX IF NOT EXISTS idx_double_xp_time ON double_xp_events(start_time, end_time);

-- Double XP event notifications (track who's been notified)
CREATE TABLE IF NOT EXISTS double_xp_notifications (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES double_xp_events(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- '24h', '6h', '1h', 'started', 'ending'
  sent_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_double_xp_notif_event ON double_xp_notifications(event_id);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 007_add_double_xp_events.sql completed successfully';
END $$;

