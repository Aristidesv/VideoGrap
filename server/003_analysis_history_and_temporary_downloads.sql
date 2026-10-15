CREATE TABLE IF NOT EXISTS analysis_history (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  video_title text NOT NULL,
  thumbnail text,
  channel text NOT NULL DEFAULT '',
  duration integer NOT NULL DEFAULT 0 CHECK (duration >= 0),
  analyzed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS analysis_history_user_analyzed_idx
  ON analysis_history (user_id, analyzed_at DESC);

ALTER TABLE download_jobs
  ADD COLUMN IF NOT EXISTS file_expires_at timestamptz;
