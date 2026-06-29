-- Approve verifier application for dashboard + app UX (Supabase).
-- Does NOT grant on-chain VERIFIER_ROLE — run grant-verifier-role.ts for that.
--
-- Run in Supabase SQL Editor (decleanup project).

INSERT INTO public.verifier_applications (address, applied_at, status, reviewed_at, notes, processing)
SELECT
  '0x50418699cb44bfda9c9afc9b7a0b0d244d8927d2',
  (extract(epoch from now()) * 1000)::bigint,
  'APPROVED',
  (extract(epoch from now()) * 1000)::bigint,
  'Operator-approved verifier',
  false
WHERE NOT EXISTS (
  SELECT 1
  FROM public.verifier_applications
  WHERE lower(address) = lower('0x50418699cb44bfda9c9afc9b7a0b0d244d8927d2')
    AND status = 'APPROVED'
);

-- Verify:
-- SELECT id, address, status, applied_at FROM public.verifier_applications
-- WHERE lower(address) = lower('0x50418699cb44bfda9c9afc9b7a0b0d244d8927d2');
