create table if not exists public.hypercert_requests (
  id text primary key,
  requester text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED', 'MINTED')),
  submitted_at bigint not null,
  reviewed_at bigint,
  reviewed_by text,
  rejection_reason text,
  metadata_cid text,
  hypercert_id text,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hypercert_requests_requester_idx on public.hypercert_requests (lower(requester));
create index if not exists hypercert_requests_status_idx on public.hypercert_requests (status);

create or replace function public.set_hypercert_requests_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_hypercert_requests_updated_at on public.hypercert_requests;
create trigger trg_hypercert_requests_updated_at
before update on public.hypercert_requests
for each row
execute function public.set_hypercert_requests_updated_at();

alter table public.hypercert_requests enable row level security;

-- All access via Next.js API using service role (bypasses RLS). No public policies.
