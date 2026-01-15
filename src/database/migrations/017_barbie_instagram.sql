-- ============================================
-- BARBIE LIST INSTAGRAM ENHANCEMENT
-- Migration 017: Add Instagram fields and AI analysis
-- ============================================

-- Add Instagram-related fields to barbie_list table
ALTER TABLE barbie_list
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS instagram_last_checked TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_ig_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_ig_openers TEXT[] DEFAULT '{}';

-- Add privacy field for contact visibility control
ALTER TABLE barbie_list
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- Create index for Instagram handle lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_barbie_instagram_handle ON barbie_list (LOWER(instagram_handle));

-- Create index for privacy filtering
CREATE INDEX IF NOT EXISTS idx_barbie_list_privacy ON barbie_list (user_id, is_private);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 017_barbie_instagram.sql completed successfully';
  RAISE NOTICE 'Added Instagram fields: instagram_handle, instagram_url, instagram_last_checked, ai_ig_summary, ai_ig_openers, is_private';
END $$;
