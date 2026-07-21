-- Message reactions and reply-to quoting.
--
-- reply_to_id is set at insert time only: messages has no UPDATE policy by
-- design, so replies are immutable once sent (matching message content).
-- Reactions live in a side table for the same reason.

alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null;

-- One reaction per user per message (WhatsApp semantics); changing your
-- reaction is an upsert on the primary key. The emoji set is fixed and
-- mirrored in src/lib/reactions.ts (REACTION_EMOJIS) — extending it needs a
-- new migration updating this check plus that constant.
create table public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '🎉')),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

create index message_reactions_message_idx
  on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

-- Participants of the message's thread can see all its reactions.
create policy "reactions_select_participant"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_thread_participant(m.thread_id)
    )
  );

-- Users may only write their own reaction, and only on messages in threads
-- they participate in.
create policy "reactions_insert_own"
  on public.message_reactions for insert
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_thread_participant(m.thread_id)
    )
  );

create policy "reactions_update_own"
  on public.message_reactions for update
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and public.is_thread_participant(m.thread_id)
    )
  );

create policy "reactions_delete_own"
  on public.message_reactions for delete
  using (profile_id = auth.uid());
