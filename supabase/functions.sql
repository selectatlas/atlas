-- ============================================================
-- Castd.ai - Database Functions
-- Run this in: Supabase Dashboard > SQL Editor
-- Run AFTER schema.sql
-- ============================================================

-- Cosine similarity search over profile_embeddings
-- Returns profile_id + similarity score (higher = more similar)
CREATE OR REPLACE FUNCTION match_talent(
  query_embedding vector(1536),
  match_count     int DEFAULT 20
)
RETURNS TABLE (
  profile_id uuid,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    profile_id,
    1 - (embedding <=> query_embedding) AS similarity
  FROM profile_embeddings
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
