
-- CallPilot: database schema
-- Run this in the Supabase SQL Editor.

create table if not exists public.calls (
    id uuid primary key default gen_random_uuid(),
    prospect_name text not null default 'Unnamed prospect',
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    current_stage integer not null default 1
        check (current_stage between 1 and 8),
    outcome text,
    next_step text,
    ai_summary text,
    status text not null default 'in_progress'
        check (status in ('in_progress', 'completed'))
);

create table if not exists public.call_stage_results (
    id uuid primary key default gen_random_uuid(),
    call_id uuid not null
        references public.calls(id) on delete cascade,
    stage_number integer not null
        check (stage_number between 1 and 8),
    stage_status text not null default 'reached'
        check (
            stage_status in (
                'reached',
                'completed',
                'skipped',
                'abandoned'
            )
        ),
    what_happened text,
    prospect_words text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (call_id, stage_number)
);

create index if not exists idx_calls_started_at
    on public.calls (started_at desc);

create index if not exists idx_calls_status
    on public.calls (status);

create index if not exists idx_stage_results_call_id
    on public.call_stage_results (call_id);

-- Only the backend's privileged key should access these tables.
alter table public.calls enable row level security;
alter table public.call_stage_results enable row level security;

revoke all on public.calls from anon, authenticated;
revoke all on public.call_stage_results from anon, authenticated;

grant all on public.calls to service_role;
grant all on public.call_stage_results to service_role;
