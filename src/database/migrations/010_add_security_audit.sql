-- Security & Audit Tables

-- Audit log for all admin actions
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  admin_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL, -- 'xp_adjustment', 'user_ban', 'data_export', etc
  target_user_id VARCHAR(255),
  details JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin ON audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- User warnings/strikes system
CREATE TABLE IF NOT EXISTS user_warnings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  warned_by VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  severity VARCHAR(50) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  evidence_message_id VARCHAR(255),
  evidence_channel_id VARCHAR(255),
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warnings_user ON user_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_severity ON user_warnings(severity);

-- User bans/timeouts
CREATE TABLE IF NOT EXISTS user_moderation (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  moderation_type VARCHAR(50) NOT NULL, -- 'timeout', 'ban', 'restriction'
  reason TEXT NOT NULL,
  moderator_id VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_user ON user_moderation(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_active ON user_moderation(active);
CREATE INDEX IF NOT EXISTS idx_moderation_expires ON user_moderation(expires_at);

-- Rate limit violations
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  command VARCHAR(100) NOT NULL,
  violation_count INTEGER DEFAULT 1,
  last_violation TIMESTAMP DEFAULT NOW(),
  flagged BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_violations_user ON rate_limit_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_violations_flagged ON rate_limit_violations(flagged);

-- Content flags (for review)
CREATE TABLE IF NOT EXISTS content_flags (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  content_type VARCHAR(50) NOT NULL, -- 'message', 'journal_entry', 'barbie_note'
  content_id VARCHAR(255),
  flag_reason VARCHAR(100) NOT NULL, -- 'toxic_language', 'harassment', 'explicit_content'
  flagged_by VARCHAR(50) DEFAULT 'auto', -- 'auto', 'user_report', 'admin'
  reviewed BOOLEAN DEFAULT false,
  reviewed_by VARCHAR(255),
  action_taken VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flags_user ON content_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_flags_reviewed ON content_flags(reviewed);
CREATE INDEX IF NOT EXISTS idx_flags_reason ON content_flags(flag_reason);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 010_add_security_audit.sql completed successfully';
END $$;

