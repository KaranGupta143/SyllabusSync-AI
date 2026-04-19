-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Syllabi table
CREATE TABLE public.syllabi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  title TEXT NOT NULL,
  topics TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chunks table with embeddings (768 dims for Gemini text-embedding-004)
CREATE TABLE public.syllabus_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syllabus_id UUID NOT NULL REFERENCES public.syllabi(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  topic TEXT,
  page_ref TEXT,
  embedding vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.syllabus_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON public.syllabus_chunks (syllabus_id);

-- Quiz attempts (one row per question answered)
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT NOT NULL,
  syllabus_id UUID REFERENCES public.syllabi(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL,
  user_answer TEXT,
  correct_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false,
  question_type TEXT NOT NULL DEFAULT 'mcq',
  grounding_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.quiz_attempts (device_id);
CREATE INDEX ON public.quiz_attempts (topic);

-- Enable RLS
ALTER TABLE public.syllabi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Anonymous device-based access: permissive policies (no auth in this app)
CREATE POLICY "Public read syllabi" ON public.syllabi FOR SELECT USING (true);
CREATE POLICY "Public insert syllabi" ON public.syllabi FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete syllabi" ON public.syllabi FOR DELETE USING (true);

CREATE POLICY "Public read chunks" ON public.syllabus_chunks FOR SELECT USING (true);
CREATE POLICY "Public insert chunks" ON public.syllabus_chunks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete chunks" ON public.syllabus_chunks FOR DELETE USING (true);

CREATE POLICY "Public read attempts" ON public.quiz_attempts FOR SELECT USING (true);
CREATE POLICY "Public insert attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (true);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION public.match_syllabus_chunks(
  query_embedding vector(768),
  match_syllabus_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  topic TEXT,
  page_ref TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.content,
    c.topic,
    c.page_ref,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.syllabus_chunks c
  WHERE c.syllabus_id = match_syllabus_id
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;