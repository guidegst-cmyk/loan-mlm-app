-- ============================================================
-- Unread tracking + enable Supabase Realtime on notifications
-- ============================================================

create table notification_reads (
    notification_id uuid not null references notifications(id),
    agent_id        uuid not null references agents(id),
    read_at         timestamptz not null default now(),
    primary key (notification_id, agent_id)
);

-- Allow the notifications table to stream INSERT events over Supabase Realtime
alter publication supabase_realtime add table notifications;
