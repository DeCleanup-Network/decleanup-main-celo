-- In-app notifications, Web Push subscriptions, contributor welcome grants.
-- Prisma uses these quoted models via DATABASE_URL (service role / direct).
-- PostgREST: RLS on, no permissive policies (anon/authenticated denied).

create table if not exists public."UserNotification" (
  id text primary key,
  "userId" text not null references public."User"(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  href text,
  meta jsonb,
  "readAt" timestamptz,
  "createdAt" timestamptz not null default now()
);

create index if not exists "UserNotification_userId_createdAt_idx"
  on public."UserNotification" ("userId", "createdAt" desc);
create index if not exists "UserNotification_userId_readAt_idx"
  on public."UserNotification" ("userId", "readAt");
create index if not exists "UserNotification_type_idx"
  on public."UserNotification" (type);

create table if not exists public."PushSubscription" (
  id text primary key,
  "userId" text not null references public."User"(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists "PushSubscription_userId_idx"
  on public."PushSubscription" ("userId");

create table if not exists public."ContributorWelcomeGrant" (
  id text primary key,
  "contributorUserId" text not null references public."User"(id) on delete cascade,
  "submissionId" text not null,
  "amountDcu" integer not null default 10,
  status text not null default 'recorded',
  "grantedAt" timestamptz not null default now(),
  unique ("contributorUserId", "submissionId")
);

create index if not exists "ContributorWelcomeGrant_submissionId_idx"
  on public."ContributorWelcomeGrant" ("submissionId");

create table if not exists public."CleanupContributorEntry" (
  id text primary key,
  "submissionId" text not null,
  identifier text not null,
  normalized text not null,
  kind text not null,
  "createdAt" timestamptz not null default now(),
  unique ("submissionId", normalized)
);

create index if not exists "CleanupContributorEntry_submissionId_idx"
  on public."CleanupContributorEntry" ("submissionId");

alter table if exists public."User"
  add column if not exists "notifyEmail" boolean not null default true;
alter table if exists public."User"
  add column if not exists "notifyPush" boolean not null default true;

alter table if exists public."UserNotification" enable row level security;
alter table if exists public."UserNotification" force row level security;
alter table if exists public."PushSubscription" enable row level security;
alter table if exists public."PushSubscription" force row level security;
alter table if exists public."ContributorWelcomeGrant" enable row level security;
alter table if exists public."ContributorWelcomeGrant" force row level security;
alter table if exists public."CleanupContributorEntry" enable row level security;
alter table if exists public."CleanupContributorEntry" force row level security;

revoke all on table public."UserNotification" from anon, authenticated;
revoke all on table public."PushSubscription" from anon, authenticated;
revoke all on table public."ContributorWelcomeGrant" from anon, authenticated;
revoke all on table public."CleanupContributorEntry" from anon, authenticated;
