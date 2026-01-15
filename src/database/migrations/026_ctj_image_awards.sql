CREATE TABLE IF NOT EXISTS ctj_image_awards (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL, -- YYYY-MM-DD (tu getLocalDayString)
  message_id TEXT,
  channel_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);
