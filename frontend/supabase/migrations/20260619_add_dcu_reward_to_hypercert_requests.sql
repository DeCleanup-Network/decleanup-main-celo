-- Track DCU bonus grant for idempotent server fallback after Hypercert mint
ALTER TABLE public.hypercert_requests
  ADD COLUMN IF NOT EXISTS dcu_reward_tx_hash text;

CREATE INDEX IF NOT EXISTS idx_hypercert_requests_dcu_reward_tx_hash
  ON public.hypercert_requests (dcu_reward_tx_hash)
  WHERE dcu_reward_tx_hash IS NOT NULL;
