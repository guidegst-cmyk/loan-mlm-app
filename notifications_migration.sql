-- ============================================================
-- ONE-WAY ADMIN NOTIFICATIONS / ANNOUNCEMENTS
-- Admin can broadcast to: everyone, a specific team (an agent +
-- their full downline), or a specific individual agent.
-- ============================================================

create table notifications (
    id             uuid primary key default gen_random_uuid(),
    title          text not null,
    message        text not null,
    target_type    text not null check (target_type in ('all','team','individual')),
    target_agent_id uuid references agents(id),   -- null when target_type = 'all'
    created_at     timestamptz not null default now()
);

create index idx_notifications_target on notifications(target_agent_id);
