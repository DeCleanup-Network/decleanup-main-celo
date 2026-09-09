-- Trash Athlete reward package is level 1 (Safe mint) + 30 DCU + 150 $cDCU — not level 3.
alter table public.trash_athlete_challenges
  alter column level_target set default 1;

update public.trash_athlete_challenges
set level_target = 1,
    updated_at = now()
where level_target = 3;
