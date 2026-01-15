-- Add confidence and tension fields to CTJ system

-- Make message_id nullable for modal-based entries
ALTER TABLE ctj_entries
  ALTER COLUMN message_id DROP NOT NULL;

-- Add confidence and tension fields
ALTER TABLE ctj_entries
  ADD COLUMN IF NOT EXISTS confidence INTEGER CHECK (confidence >= 1 AND confidence <= 10),
  ADD COLUMN IF NOT EXISTS tension INTEGER CHECK (tension >= 1 AND tension <= 10);

-- Add indexes for querying by confidence/tension
CREATE INDEX IF NOT EXISTS idx_ctj_entries_confidence ON ctj_entries(confidence);
CREATE INDEX IF NOT EXISTS idx_ctj_entries_tension ON ctj_entries(tension);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 019_add_ctj_confidence_tension.sql completed successfully';
END $$;


