-- Barbie List (Contact Manager) System

CREATE TABLE IF NOT EXISTS barbie_list (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255) NOT NULL,
  met_location VARCHAR(255),
  met_date DATE,
  phone_number VARCHAR(50),
  instagram VARCHAR(255),
  notes TEXT,
  vibe_rating INTEGER CHECK (vibe_rating >= 1 AND vibe_rating <= 10),
  last_contacted DATE,
  next_action TEXT,
  tags TEXT[], -- Array of tags like 'date-prospect', 'high-interest', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbie_list_user_id ON barbie_list(user_id);
CREATE INDEX IF NOT EXISTS idx_barbie_list_tags ON barbie_list USING GIN(tags);

-- Barbie list interactions (texting history)
CREATE TABLE IF NOT EXISTS barbie_interactions (
  id SERIAL PRIMARY KEY,
  barbie_id INTEGER REFERENCES barbie_list(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  interaction_type VARCHAR(50) NOT NULL, -- 'text_sent', 'text_received', 'call', 'date', 'approach'
  content TEXT,
  sentiment VARCHAR(50), -- 'positive', 'neutral', 'negative', 'flirty'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_barbie_interactions_barbie_id ON barbie_interactions(barbie_id);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 003_add_barbie_list.sql completed successfully';
END $$;

