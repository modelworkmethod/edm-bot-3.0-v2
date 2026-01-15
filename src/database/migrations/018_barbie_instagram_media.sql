-- ============================================
-- BARBIE LIST INSTAGRAM MEDIA (SCREENSHOTS)
-- Migration 018: Add media storage for Instagram screenshots
-- ============================================

-- Create media storage table for Instagram screenshots
CREATE TABLE IF NOT EXISTS barbie_instagram_media (
  id BIGSERIAL PRIMARY KEY,
  contact_id BIGINT NOT NULL REFERENCES barbie_list(id) ON DELETE CASCADE,
  uploader_user_id TEXT NOT NULL,
  message_id TEXT,                   -- Discord message ID that carried the upload (optional)
  attachment_url TEXT NOT NULL,      -- Discord CDN URL (we only store URL, not files)
  caption TEXT,                      -- Optional caption for the media
  width INT,                         -- Image width in pixels
  height INT,                        -- Image height in pixels
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bim_contact ON barbie_instagram_media(contact_id);
CREATE INDEX IF NOT EXISTS idx_bim_uploader ON barbie_instagram_media(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_bim_uploaded_at ON barbie_instagram_media(uploaded_at DESC);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 018_barbie_instagram_media.sql completed successfully';
  RAISE NOTICE 'Created table: barbie_instagram_media';
  RAISE NOTICE 'Users can now attach Instagram screenshots to contacts with metadata and captions';
END $$;

