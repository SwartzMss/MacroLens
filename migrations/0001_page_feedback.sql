CREATE TABLE IF NOT EXISTS page_feedback (
  page_id TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  reason TEXT CHECK (reason IS NULL OR reason IN (
    'too_complex',
    'missing_example',
    'unclear_chart',
    'incomplete',
    'questionable'
  )),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (page_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS page_feedback_page_id_idx ON page_feedback (page_id);
