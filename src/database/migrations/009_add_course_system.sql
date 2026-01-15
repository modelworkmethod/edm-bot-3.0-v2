-- Course Hosting System

-- Course modules
CREATE TABLE IF NOT EXISTS course_modules (
  id SERIAL PRIMARY KEY,
  module_number INTEGER NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  total_videos INTEGER DEFAULT 0,
  estimated_duration_minutes INTEGER,
  unlock_requirements JSONB, -- {"level": 5, "xp": 1000, "previous_module": 1}
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Course videos
CREATE TABLE IF NOT EXISTS course_videos (
  id SERIAL PRIMARY KEY,
  module_id INTEGER REFERENCES course_modules(id) ON DELETE CASCADE,
  video_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL, -- YouTube/Vimeo URL
  duration_minutes INTEGER,
  transcript TEXT,
  key_concepts TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(module_id, video_number)
);

-- User module progress
CREATE TABLE IF NOT EXISTS user_module_progress (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  module_id INTEGER REFERENCES course_modules(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'locked', -- 'locked', 'in_progress', 'completed'
  videos_watched INTEGER DEFAULT 0,
  completion_percentage INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  UNIQUE(user_id, module_id)
);

-- User video progress
CREATE TABLE IF NOT EXISTS user_video_progress (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  video_id INTEGER REFERENCES course_videos(id) ON DELETE CASCADE,
  watched BOOLEAN DEFAULT false,
  watch_time_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMP,
  notes TEXT,
  UNIQUE(user_id, video_id)
);

-- Course Q&A
CREATE TABLE IF NOT EXISTS course_questions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  module_id INTEGER REFERENCES course_modules(id),
  video_id INTEGER REFERENCES course_videos(id),
  question TEXT NOT NULL,
  answered BOOLEAN DEFAULT false,
  answer TEXT,
  asked_at TIMESTAMP DEFAULT NOW(),
  answered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_module_progress ON user_module_progress(user_id, module_id);
CREATE INDEX IF NOT EXISTS idx_user_video_progress ON user_video_progress(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_course_questions_user ON course_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_course_questions_answered ON course_questions(answered);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 009_add_course_system.sql completed successfully';
END $$;

