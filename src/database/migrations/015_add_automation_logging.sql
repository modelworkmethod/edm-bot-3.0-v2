-- Automation logging and monitoring

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  
  -- Event info
  event_type VARCHAR(100) NOT NULL, -- 'sales_call_processed', 'ongoing_call_processed', etc.
  event_id VARCHAR(255), -- External reference (Fathom ID, etc.)
  
  -- Client info
  client_email VARCHAR(255),
  client_id VARCHAR(100), -- Airtable record ID
  
  -- Processing
  status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'partial'
  processing_time_ms INTEGER,
  
  -- Details
  details TEXT,
  error_message TEXT,
  
  -- Metadata
  triggered_by VARCHAR(50), -- 'zapier', 'manual', 'scheduled'
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_type ON automation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_automation_logs_client ON automation_logs(client_email);

-- Airtable sync cache (for Discord <-> Airtable linking)
CREATE TABLE IF NOT EXISTS airtable_sync_cache (
  discord_id VARCHAR(255) PRIMARY KEY,
  airtable_client_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  synced_at TIMESTAMP DEFAULT NOW(),
  last_engagement_sync TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_cache_airtable ON airtable_sync_cache(airtable_client_id);
CREATE INDEX IF NOT EXISTS idx_sync_cache_email ON airtable_sync_cache(email);

-- Webhook request log
CREATE TABLE IF NOT EXISTS webhook_requests (
  id SERIAL PRIMARY KEY,
  
  -- Request info
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10),
  
  -- Source
  source_ip VARCHAR(50),
  user_agent TEXT,
  
  -- Auth
  authenticated BOOLEAN DEFAULT false,
  api_key_used VARCHAR(100),
  
  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  
  -- Payload (truncated)
  request_payload TEXT,
  response_payload TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_requests_endpoint ON webhook_requests(endpoint);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_created ON webhook_requests(created_at);

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Migration 015_add_automation_logging.sql completed successfully';
END $$;

