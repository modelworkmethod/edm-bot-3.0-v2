-- Coaching Analytics & Risk Scoring

-- User risk assessments (calculated daily)
CREATE TABLE IF NOT EXISTS user_risk_scores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  risk_score INTEGER NOT NULL, -- 0-100 (100 = highest risk)
  risk_tier VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
  
  -- Risk factors
  days_since_submission INTEGER,
  streak_breaks_30d INTEGER,
  xp_velocity_trend VARCHAR(20), -- 'increasing', 'stable', 'declining'
  chat_activity_score INTEGER, -- 0-100
  wins_participation_score INTEGER, -- 0-100
  course_engagement_score INTEGER, -- 0-100
  
  -- Actionable insights
  primary_concern VARCHAR(100),
  recommended_action VARCHAR(100),
  urgency_level INTEGER, -- 1-5
  
  calculated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_user ON user_risk_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_tier ON user_risk_scores(risk_tier);
CREATE INDEX IF NOT EXISTS idx_risk_urgency ON user_risk_scores(urgency_level);

-- User behavior patterns (trends over time)
CREATE TABLE IF NOT EXISTS user_behavior_patterns (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  pattern_type VARCHAR(50) NOT NULL, -- 'action_junkie', 'analysis_paralysis', 'streaky', 'steady', 'plateau'
  confidence_score INTEGER, -- 0-100
  supporting_evidence JSONB,
  detected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patterns_user ON user_behavior_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON user_behavior_patterns(pattern_type);

-- Coaching interventions (suggested and executed)
CREATE TABLE IF NOT EXISTS coaching_interventions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  intervention_type VARCHAR(50) NOT NULL, -- 'reengagement', 'celebration', 'challenge', 'resource', 'accountability'
  
  -- AI suggestion
  suggested_message TEXT,
  reasoning TEXT,
  
  -- Coach review
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'edited', 'rejected', 'sent'
  reviewed_by VARCHAR(255),
  final_message TEXT,
  
  -- Execution
  sent_at TIMESTAMP,
  user_responded BOOLEAN DEFAULT false,
  response_time INTEGER, -- seconds
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interventions_user ON coaching_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_interventions_status ON coaching_interventions(status);
CREATE INDEX IF NOT EXISTS idx_interventions_type ON coaching_interventions(intervention_type);

-- User engagement metrics (aggregated daily)
CREATE TABLE IF NOT EXISTS user_engagement_metrics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  
  -- Activity counts
  stats_submitted INTEGER DEFAULT 0,
  chat_messages INTEGER DEFAULT 0,
  wins_posted INTEGER DEFAULT 0,
  journal_entries INTEGER DEFAULT 0,
  course_videos INTEGER DEFAULT 0,
  tensey_clicks INTEGER DEFAULT 0,
  
  -- Quality metrics
  avg_chat_sentiment DECIMAL(3,2), -- -1.0 to 1.0
  approach_to_date_ratio DECIMAL(3,2),
  
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_engagement_user_date ON user_engagement_metrics(user_id, date);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 011_add_coaching_analytics.sql completed successfully';
END $$;

