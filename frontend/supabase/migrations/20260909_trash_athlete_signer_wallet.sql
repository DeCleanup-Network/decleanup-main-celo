-- Trash Athlete: wallet_address is the signer EOA (import / MetaMask address).
-- Early rows may have stored the smart account; normalize known pairs when found.
-- Run after deploy of signer-first submit. Safe to re-run.

comment on column public.trash_athlete_challenges.wallet_address is
  'Signer EOA (MetaMask / import address). Rewards and history key off this, not the smart account.';

-- dailytrashmobs@gmail.com: SA 0x1879… → signer 0xd9a8…
update public.trash_athlete_challenges
set wallet_address = lower('0xd9a8bb9a09aa616fa0616c4713ce1eb0ff6224d8'),
    updated_at = now()
where lower(wallet_address) = lower('0x1879468b1632d82d16d715a30a4eb932a1fc0189');
