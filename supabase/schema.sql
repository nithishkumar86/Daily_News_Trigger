-- AI News Table
CREATE TABLE IF NOT EXISTS ai_news (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Rank"      INTEGER NOT NULL,
  "Topic"     TEXT NOT NULL,
  "Title"     TEXT NOT NULL,
  "Summary"   TEXT NOT NULL,
  "Image"     TEXT,
  "Link"      TEXT NOT NULL,
  "Date"      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_news_date_rank ON ai_news ("Date", "Rank");
CREATE INDEX IF NOT EXISTS ai_news_date_topic ON ai_news ("Date", "Topic");

-- Investment News Table
CREATE TABLE IF NOT EXISTS investment_news (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Rank"      INTEGER NOT NULL,
  "Topic"     TEXT NOT NULL,
  "Title"     TEXT NOT NULL,
  "Summary"   TEXT NOT NULL,
  "Image"     TEXT,
  "Link"      TEXT NOT NULL,
  "Date"      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_news_date_rank ON investment_news ("Date", "Rank");

-- Job Hire/Fire News Table
CREATE TABLE IF NOT EXISTS job_hire_fire (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "Rank"      INTEGER NOT NULL,
  "Topic"     TEXT NOT NULL,
  "Title"     TEXT NOT NULL,
  "Summary"   TEXT NOT NULL,
  "Image"     TEXT,
  "Link"      TEXT NOT NULL,
  "Date"      DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_hire_fire_date_rank ON job_hire_fire ("Date", "Rank");

-- Cleanup Log Table
CREATE TABLE IF NOT EXISTS cleanup_log (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  last_cleaned  DATE
);

INSERT INTO cleanup_log (id, last_cleaned) VALUES (1, '2000-01-01')
ON CONFLICT (id) DO NOTHING;

-- Row Level Security
ALTER TABLE ai_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_news ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_hire_fire ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleanup_log ENABLE ROW LEVEL SECURITY;

-- Public read policies (anon key can SELECT)
DROP POLICY IF EXISTS "Public read ai_news" ON ai_news;
CREATE POLICY "Public read ai_news" ON ai_news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service insert ai_news" ON ai_news;
CREATE POLICY "Service insert ai_news" ON ai_news FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service delete ai_news" ON ai_news;
CREATE POLICY "Service delete ai_news" ON ai_news FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read investment_news" ON investment_news;
CREATE POLICY "Public read investment_news" ON investment_news FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service insert investment_news" ON investment_news;
CREATE POLICY "Service insert investment_news" ON investment_news FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service delete investment_news" ON investment_news;
CREATE POLICY "Service delete investment_news" ON investment_news FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read job_hire_fire" ON job_hire_fire;
CREATE POLICY "Public read job_hire_fire" ON job_hire_fire FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service insert job_hire_fire" ON job_hire_fire;
CREATE POLICY "Service insert job_hire_fire" ON job_hire_fire FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service delete job_hire_fire" ON job_hire_fire;
CREATE POLICY "Service delete job_hire_fire" ON job_hire_fire FOR DELETE USING (true);

DROP POLICY IF EXISTS "Public read cleanup_log" ON cleanup_log;
CREATE POLICY "Public read cleanup_log" ON cleanup_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service update cleanup_log" ON cleanup_log;
CREATE POLICY "Service update cleanup_log" ON cleanup_log FOR ALL USING (true);

-- Enable Realtime
-- ALTER PUBLICATION ... ADD TABLE is not idempotent; guard each one so this
-- file can be re-run from top to bottom without aborting.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ai_news')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE ai_news; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'investment_news')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE investment_news; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'job_hire_fire')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE job_hire_fire; END IF;
END $$;

-- Storage: public bucket for daily news cover images.
-- Webhook downloads the agent's temporary image URL and uploads here;
-- the DB stores only the permanent public CDN URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;
