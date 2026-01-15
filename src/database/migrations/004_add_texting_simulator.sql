-- Texting Simulator System

-- Scenario templates
CREATE TABLE IF NOT EXISTS texting_scenarios (
  id SERIAL PRIMARY KEY,
  scenario_name VARCHAR(255) NOT NULL,
  scenario_type VARCHAR(50) NOT NULL, -- 'post-approach', 'date-setup', 'maintenance', 'recovery'
  difficulty VARCHAR(50) NOT NULL, -- 'beginner', 'intermediate', 'advanced'
  description TEXT,
  context TEXT NOT NULL, -- The setup/situation
  girl_personality TEXT, -- Her vibe/personality traits
  approach_notes TEXT, -- What happened during approach
  created_by VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User simulation attempts
CREATE TABLE IF NOT EXISTS texting_attempts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  scenario_id INTEGER REFERENCES texting_scenarios(id),
  status VARCHAR(50) DEFAULT 'in_progress', -- 'in_progress', 'completed', 'abandoned'
  score INTEGER, -- 0-100
  feedback TEXT,
  messages_sent INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Message exchanges in simulation
CREATE TABLE IF NOT EXISTS texting_messages (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER REFERENCES texting_attempts(id) ON DELETE CASCADE,
  sender VARCHAR(50) NOT NULL, -- 'user' or 'girl'
  message_text TEXT NOT NULL,
  is_correct_choice BOOLEAN,
  feedback TEXT,
  sentiment_score INTEGER, -- -10 to +10 (negative to positive)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_texting_attempts_user_id ON texting_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_texting_messages_attempt_id ON texting_messages(attempt_id);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 004_add_texting_simulator.sql completed successfully';
END $$;

