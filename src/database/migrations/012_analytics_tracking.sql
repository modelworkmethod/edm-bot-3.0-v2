-- ============================================
-- ANALYTICS & PROGRESS TRACKING TABLES
-- ============================================

-- Daily metrics tracking
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Action metrics
  approaches_count INT DEFAULT 0,
  numbers_collected INT DEFAULT 0,
  conversations_count INT DEFAULT 0,
  dates_count INT DEFAULT 0,
  closes_count INT DEFAULT 0,
  second_dates INT DEFAULT 0,
  
  -- Quality metrics
  approach_quality_avg DECIMAL(3,1), -- 1-10 rating
  conversation_quality_avg DECIMAL(3,1),
  date_quality_avg DECIMAL(3,1),
  
  -- Response rates (%)
  number_response_rate DECIMAL(5,2),
  date_conversion_rate DECIMAL(5,2),
  close_rate DECIMAL(5,2),
  
  -- Emotional/state metrics
  morning_state INT, -- 1-10
  afternoon_state INT,
  evening_state INT,
  daily_avg_state DECIMAL(3,1),
  energy_level INT, -- 1-10
  confidence_level INT, -- 1-10
  anxiety_level INT, -- 1-10
  
  -- Habit tracking
  meditation_completed BOOLEAN DEFAULT false,
  meditation_duration_mins INT,
  workout_completed BOOLEAN DEFAULT false,
  stats_submitted BOOLEAN DEFAULT false,
  journal_completed BOOLEAN DEFAULT false,
  
  -- Notes
  wins TEXT,
  struggles TEXT,
  insights TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date 
ON daily_metrics (user_id, date);


-- Weekly aggregations (computed automatically)
CREATE TABLE IF NOT EXISTS weekly_metrics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  
  -- Totals
  total_approaches INT DEFAULT 0,
  total_numbers INT DEFAULT 0,
  total_conversations INT DEFAULT 0,
  total_dates INT DEFAULT 0,
  total_closes INT DEFAULT 0,
  
  -- Averages
  avg_daily_approaches DECIMAL(4,1),
  avg_quality_score DECIMAL(3,1),
  avg_emotional_state DECIMAL(3,1),
  avg_energy DECIMAL(3,1),
  avg_confidence DECIMAL(3,1),
  
  -- Conversion rates
  number_response_rate DECIMAL(5,2),
  date_conversion_rate DECIMAL(5,2),
  close_rate DECIMAL(5,2),
  
  -- Habit adherence (%)
  meditation_adherence DECIMAL(5,2),
  workout_adherence DECIMAL(5,2),
  stats_adherence DECIMAL(5,2),
  
  -- Streaks
  approach_streak INT DEFAULT 0,
  meditation_streak INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, week_start)
);

CREATE INDEX idx_weekly_metrics_user ON weekly_metrics(user_id, week_start DESC);

-- Monthly aggregations
CREATE TABLE IF NOT EXISTS monthly_metrics (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  month DATE NOT NULL, -- First day of month
  
  -- Totals
  total_approaches INT DEFAULT 0,
  total_numbers INT DEFAULT 0,
  total_dates INT DEFAULT 0,
  total_closes INT DEFAULT 0,
  
  -- Quality progression
  early_month_quality DECIMAL(3,1),
  mid_month_quality DECIMAL(3,1),
  late_month_quality DECIMAL(3,1),
  quality_improvement DECIMAL(4,1), -- Can be negative
  
  -- State progression
  early_month_state DECIMAL(3,1),
  late_month_state DECIMAL(3,1),
  state_improvement DECIMAL(4,1),
  
  -- Conversion funnel
  approach_to_number_rate DECIMAL(5,2),
  number_to_date_rate DECIMAL(5,2),
  date_to_close_rate DECIMAL(5,2),
  
  -- Breakthroughs
  breakthrough_count INT DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, month)
);

CREATE INDEX idx_monthly_metrics_user ON monthly_metrics(user_id, month DESC);

-- Skill progression milestones
CREATE TABLE IF NOT EXISTS skill_milestones (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  skill_type VARCHAR(50) NOT NULL, -- 'approaching', 'texting', 'dating', 'closing'
  milestone_name VARCHAR(100) NOT NULL,
  achieved_at TIMESTAMP DEFAULT NOW(),
  
  -- Context
  metric_value DECIMAL(10,2), -- The value when achieved
  previous_best DECIMAL(10,2),
  
  -- Details
  description TEXT,
  celebration_sent BOOLEAN DEFAULT false
);

CREATE INDEX idx_skill_milestones_user ON skill_milestones(user_id, achieved_at DESC);

-- Moving averages (pre-computed for performance)
CREATE TABLE IF NOT EXISTS moving_averages (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  
  -- Different window sizes
  ma_7day DECIMAL(10,2),  -- 7-day moving average
  ma_14day DECIMAL(10,2), -- 14-day
  ma_30day DECIMAL(10,2), -- 30-day
  
  current_value DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, metric_name, date)
);

CREATE INDEX idx_moving_averages_user_metric ON moving_averages(user_id, metric_name, date DESC);

-- Correlation insights (computed periodically)
CREATE TABLE IF NOT EXISTS metric_correlations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  
  -- What correlates with success?
  meditation_success_correlation DECIMAL(4,2), -- -1 to 1
  workout_success_correlation DECIMAL(4,2),
  morning_state_success_correlation DECIMAL(4,2),
  
  -- What predicts good days?
  morning_state_predicts_approaches DECIMAL(4,2),
  meditation_predicts_quality DECIMAL(4,2),
  
  -- Lag effects
  yesterday_meditation_today_confidence DECIMAL(4,2),
  
  -- Sample size
  days_analyzed INT,
  last_computed TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Trend detection (computed automatically)
CREATE TABLE IF NOT EXISTS trend_alerts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  metric_name VARCHAR(50) NOT NULL,
  trend_type VARCHAR(20) NOT NULL, -- 'improving', 'declining', 'plateau', 'breakthrough'
  
  -- Trend strength
  trend_strength DECIMAL(4,2), -- 0-1
  statistical_significance DECIMAL(4,2), -- p-value
  
  -- Details
  description TEXT,
  recommendation TEXT,
  
  detected_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT false,
  
  -- For coach alerts
  coach_notified BOOLEAN DEFAULT false
);

CREATE INDEX idx_trend_alerts_user ON trend_alerts(user_id, detected_at DESC);
CREATE INDEX idx_trend_alerts_unacknowledged ON trend_alerts(user_id, acknowledged) WHERE acknowledged = false;

-- Functions to auto-compute moving averages
CREATE OR REPLACE FUNCTION compute_moving_average(
  p_user_id VARCHAR(255),
  p_metric_name VARCHAR(50),
  p_date DATE
) RETURNS VOID AS $$
BEGIN
  INSERT INTO moving_averages (user_id, metric_name, date, ma_7day, ma_14day, ma_30day, current_value)
  SELECT 
    p_user_id,
    p_metric_name,
    p_date,
    AVG(CASE WHEN date >= p_date - INTERVAL '7 days' THEN 
      CASE p_metric_name
        WHEN 'emotional_state' THEN daily_avg_state
        WHEN 'approaches' THEN approaches_count::DECIMAL
        WHEN 'number_response_rate' THEN number_response_rate
        WHEN 'confidence' THEN confidence_level::DECIMAL
        WHEN 'energy' THEN energy_level::DECIMAL
      END
    END),
    AVG(CASE WHEN date >= p_date - INTERVAL '14 days' THEN 
      CASE p_metric_name
        WHEN 'emotional_state' THEN daily_avg_state
        WHEN 'approaches' THEN approaches_count::DECIMAL
        WHEN 'number_response_rate' THEN number_response_rate
        WHEN 'confidence' THEN confidence_level::DECIMAL
        WHEN 'energy' THEN energy_level::DECIMAL
      END
    END),
    AVG(CASE WHEN date >= p_date - INTERVAL '30 days' THEN 
      CASE p_metric_name
        WHEN 'emotional_state' THEN daily_avg_state
        WHEN 'approaches' THEN approaches_count::DECIMAL
        WHEN 'number_response_rate' THEN number_response_rate
        WHEN 'confidence' THEN confidence_level::DECIMAL
        WHEN 'energy' THEN energy_level::DECIMAL
      END
    END),
    CASE p_metric_name
      WHEN 'emotional_state' THEN daily_avg_state
      WHEN 'approaches' THEN approaches_count::DECIMAL
      WHEN 'number_response_rate' THEN number_response_rate
      WHEN 'confidence' THEN confidence_level::DECIMAL
      WHEN 'energy' THEN energy_level::DECIMAL
    END as current_value
  FROM daily_metrics
  WHERE user_id = p_user_id
  AND date <= p_date
  AND date >= p_date - INTERVAL '30 days'
  ON CONFLICT (user_id, metric_name, date) 
  DO UPDATE SET
    ma_7day = EXCLUDED.ma_7day,
    ma_14day = EXCLUDED.ma_14day,
    ma_30day = EXCLUDED.ma_30day,
    current_value = EXCLUDED.current_value;
END;
$$ LANGUAGE plpgsql;

