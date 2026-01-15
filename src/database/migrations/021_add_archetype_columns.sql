-- Add archetype tracking columns to users table
BEGIN;

-- Add columns for tracking warrior/mage/templar points
DO $$
BEGIN
  -- Add archetype_warrior column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='archetype_warrior'
  ) THEN
    ALTER TABLE users ADD COLUMN archetype_warrior DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add archetype_mage column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='archetype_mage'
  ) THEN
    ALTER TABLE users ADD COLUMN archetype_mage DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add archetype_templar column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='archetype_templar'
  ) THEN
    ALTER TABLE users ADD COLUMN archetype_templar DECIMAL(10,2) DEFAULT 0;
  END IF;

  -- Add total_xp column for dampening calculation
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='total_xp'
  ) THEN
    ALTER TABLE users ADD COLUMN total_xp INTEGER DEFAULT 0;
    -- Initialize total_xp to current xp values
    UPDATE users SET total_xp = xp WHERE total_xp = 0;
  END IF;
END $$;

-- Add index for archetype queries
CREATE INDEX IF NOT EXISTS idx_users_archetype ON users(archetype_warrior, archetype_mage);

COMMIT;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 021_add_archetype_columns.sql completed successfully';
END $$;

