-- Confidence Tension Journal Analysis System

CREATE TABLE IF NOT EXISTS ctj_entries (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL UNIQUE,
  channel_id VARCHAR(255) NOT NULL,
  image_url TEXT,
  entry_text TEXT,
  submitted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctj_entries_user_id ON ctj_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ctj_entries_submitted ON ctj_entries(submitted_at);

-- AI analysis results
CREATE TABLE IF NOT EXISTS ctj_analysis (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES ctj_entries(id) ON DELETE CASCADE,
  analysis_text TEXT NOT NULL,
  sentiment VARCHAR(50), -- 'breakthrough', 'progress', 'stuck', 'resistance'
  key_themes TEXT[], -- Array of identified themes
  teachable_moment BOOLEAN DEFAULT false,
  breakthrough_score INTEGER, -- 0-100
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ctj_analysis_entry ON ctj_analysis(entry_id);
CREATE INDEX IF NOT EXISTS idx_ctj_breakthrough ON ctj_analysis(teachable_moment);

-- Breakthrough posts (for public sharing)
CREATE TABLE IF NOT EXISTS breakthrough_posts (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES ctj_entries(id),
  analysis_id INTEGER REFERENCES ctj_analysis(id),
  posted_to_channel VARCHAR(255),
  posted_at TIMESTAMP DEFAULT NOW()
);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 008_add_ctj_analysis.sql completed successfully';
END $$;

