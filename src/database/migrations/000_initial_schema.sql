BEGIN;

CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(255) PRIMARY KEY,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  faction VARCHAR(50),
  archetype VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users_stats (
  user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
  stat_name VARCHAR(100) NOT NULL,
  total_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, stat_name)
);

CREATE TABLE IF NOT EXISTS daily_records (
  user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE,
  date DATE NOT NULL,
  stat_name VARCHAR(100) NOT NULL,
  count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, date, stat_name)
);

CREATE INDEX IF NOT EXISTS idx_users_xp ON users(xp DESC);
CREATE INDEX IF NOT EXISTS idx_users_faction ON users(faction);
CREATE INDEX IF NOT EXISTS idx_users_stats_user ON users_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_records_user_date ON daily_records(user_id, date DESC);

COMMIT;

