-- Content pipeline: manager submits picks -> Claude Code routine writes the
-- newsletter/article + image prompts -> Codex generates the images.
-- Safe to re-run top to bottom.

-- One row per manager submission (newsletter or article)
CREATE TABLE IF NOT EXISTS content_jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('newsletter', 'article')),
  items       JSONB NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'writing', 'written', 'failed')),
  content     TEXT,
  error       TEXT,
  claimed_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS content_jobs_status ON content_jobs (status, created_at);

-- One row per image Claude asks for (4 per newsletter, 1 per article)
CREATE TABLE IF NOT EXISTS image_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id       UUID NOT NULL REFERENCES content_jobs (id) ON DELETE CASCADE,
  section_key  TEXT NOT NULL CHECK (section_key IN ('world', 'tools', 'insights', 'trending', 'hero')),
  title        TEXT NOT NULL,
  prompt       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'generating', 'done', 'failed')),
  image_url    TEXT,
  error        TEXT,
  claimed_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, section_key)
);

CREATE INDEX IF NOT EXISTS image_jobs_status ON image_jobs (status, created_at);

-- Keep updated_at current on every write
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS content_jobs_updated_at ON content_jobs;
CREATE TRIGGER content_jobs_updated_at BEFORE UPDATE ON content_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS image_jobs_updated_at ON image_jobs;
CREATE TRIGGER image_jobs_updated_at BEFORE UPDATE ON image_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Row Level Security: anon may only read (the Drafts page listens via realtime).
-- No write policies — every write goes through the server with the service role key.
ALTER TABLE content_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read content_jobs" ON content_jobs;
CREATE POLICY "Public read content_jobs" ON content_jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read image_jobs" ON image_jobs;
CREATE POLICY "Public read image_jobs" ON image_jobs FOR SELECT USING (true);

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'content_jobs')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE content_jobs; END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'image_jobs')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE image_jobs; END IF;
END $$;
