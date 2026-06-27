-- AI News Table
CREATE TABLE IF NOT EXISTS ai_news (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank        INTEGER NOT NULL,
  topic       TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  image       TEXT,
  link        TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_news_date_rank ON ai_news (date, rank);
CREATE INDEX IF NOT EXISTS ai_news_date_topic ON ai_news (date, topic);

-- Investment News Table
CREATE TABLE IF NOT EXISTS investment_news (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rank        INTEGER NOT NULL,
  topic       TEXT NOT NULL,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL,
  image       TEXT,
  link        TEXT NOT NULL,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS investment_news_date_rank ON investment_news (date, rank);

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

DROP POLICY IF EXISTS "Public read cleanup_log" ON cleanup_log;
CREATE POLICY "Public read cleanup_log" ON cleanup_log FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service update cleanup_log" ON cleanup_log;
CREATE POLICY "Service update cleanup_log" ON cleanup_log FOR ALL USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE ai_news;
ALTER PUBLICATION supabase_realtime ADD TABLE investment_news;
