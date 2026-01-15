-- Dueling System Tables

-- Duels
CREATE TABLE IF NOT EXISTS duels (
  id SERIAL PRIMARY KEY,
  challenger_id VARCHAR(255) NOT NULL,
  opponent_id VARCHAR(255) NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'completed', 'declined', 'forfeit'
  winner_id VARCHAR(255),
  
  -- Starting stats for both players
  challenger_start_xp INTEGER NOT NULL,
  challenger_start_warrior_affinity INTEGER NOT NULL,
  challenger_start_mage_affinity INTEGER NOT NULL,
  
  opponent_start_xp INTEGER NOT NULL,
  opponent_start_warrior_affinity INTEGER NOT NULL,
  opponent_start_mage_affinity INTEGER NOT NULL,
  
  -- Final stats
  challenger_final_xp INTEGER,
  challenger_final_warrior_affinity INTEGER,
  challenger_final_mage_affinity INTEGER,
  
  opponent_final_xp INTEGER,
  opponent_final_warrior_affinity INTEGER,
  opponent_final_mage_affinity INTEGER,
  
  -- Balance tracking
  challenger_balance_penalty BOOLEAN DEFAULT false,
  opponent_balance_penalty BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_duels_challenger ON duels(challenger_id);
CREATE INDEX IF NOT EXISTS idx_duels_opponent ON duels(opponent_id);
CREATE INDEX IF NOT EXISTS idx_duels_status ON duels(status);

-- Duel stats (track all stats submitted during duel window)
CREATE TABLE IF NOT EXISTS duel_stats (
  id SERIAL PRIMARY KEY,
  duel_id INTEGER REFERENCES duels(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  stat_name VARCHAR(255) NOT NULL,
  stat_value INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  warrior_affinity_change INTEGER,
  mage_affinity_change INTEGER,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_duel_stats_duel_id ON duel_stats(duel_id);
CREATE INDEX IF NOT EXISTS idx_duel_stats_user_id ON duel_stats(user_id);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 006_add_dueling_system.sql completed successfully';
END $$;

