-- Optional short cleanup video (off-chain; IPFS CID stored after submit).

alter table public.cleanup_feed
  add column if not exists optional_video_cid text not null default '';

comment on column public.cleanup_feed.optional_video_cid is
  'Optional MP4/MOV video CID (max ~10s), uploaded off-chain after submission.';
