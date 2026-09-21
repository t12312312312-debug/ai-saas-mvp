-- Run once: creates the pgvector extension and the two tables the MVP needs.
CREATE EXTENSION IF NOT EXISTS vector;

-- Your knowledge base, chunked into small notes.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536),        -- matches OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Every answer given, for billing + analytics. One row = one billable event.
CREATE TABLE IF NOT EXISTS usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,   -- prevents double-billing on retry
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  cost_usd NUMERIC(10,6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  free_answers_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast similarity search on the embedding column.
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_idx
  ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
