CREATE TABLE IF NOT EXISTS moods (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  sticker TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  nickname TEXT NOT NULL DEFAULT '',
  x REAL NOT NULL,
  y REAL NOT NULL,
  size INTEGER NOT NULL,
  rotation REAL NOT NULL,
  created_at INTEGER NOT NULL,
  delete_hash TEXT NOT NULL,
  visitor_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS moods_page_date ON moods(page, created_at DESC);
CREATE INDEX IF NOT EXISTS moods_visitor_date ON moods(visitor_hash, created_at DESC);
