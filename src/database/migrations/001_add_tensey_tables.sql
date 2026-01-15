-- Migration: Add Tensey tables to PostgreSQL
-- Consolidates SQLite Tensey data into main database

-- Tensey completions table (replaces SQLite user_completions)
CREATE TABLE IF NOT EXISTS tensey_completions (
  user_id VARCHAR(255) NOT NULL,
  challenge_idx INTEGER NOT NULL,
  completed_at TIMESTAMP DEFAULT NOW(),
  reps INTEGER DEFAULT 1,
  PRIMARY KEY (user_id, challenge_idx)
);

-- Tensey ledger table (replaces SQLite tensey_ledger)
CREATE TABLE IF NOT EXISTS tensey_ledger (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  challenge_idx INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_tensey_ledger_user_id ON tensey_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_tensey_ledger_created_at ON tensey_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_tensey_completions_user_id ON tensey_completions(user_id);

-- Add Tensey counter column to users table if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'social_freedom_exercises_tenseys'
  ) THEN
    ALTER TABLE users ADD COLUMN social_freedom_exercises_tenseys INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create function to update counter when ledger changes
CREATE OR REPLACE FUNCTION update_tensey_counter()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users 
  SET social_freedom_exercises_tenseys = (
    SELECT COALESCE(SUM(amount), 0) 
    FROM tensey_ledger 
    WHERE user_id = NEW.user_id
  )
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_tensey_counter'
  ) THEN
    CREATE TRIGGER trigger_update_tensey_counter
    AFTER INSERT ON tensey_ledger
    FOR EACH ROW
    EXECUTE FUNCTION update_tensey_counter();
  END IF;
END $$;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 001_add_tensey_tables.sql completed successfully';
END $$;

