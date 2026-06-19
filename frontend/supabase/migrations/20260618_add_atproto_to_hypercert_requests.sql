-- Adiciona colunas ATProto na tabela existente hypercert_requests
ALTER TABLE public.hypercert_requests
ADD COLUMN IF NOT EXISTS at_uri TEXT,
ADD COLUMN IF NOT EXISTS at_cid TEXT,
ADD COLUMN IF NOT EXISTS at_published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS at_publish_error TEXT,
ADD COLUMN IF NOT EXISTS at_version TEXT DEFAULT 'lexicon-v1';

-- Índice para buscas futuras por at_uri
CREATE INDEX IF NOT EXISTS idx_hypercert_requests_at_uri
  ON public.hypercert_requests(at_uri)
  WHERE at_uri IS NOT NULL;
