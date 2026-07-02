-- Link tickets to the conversation that generated them
alter table public.tickets
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

create index if not exists tickets_conversation_id_idx on public.tickets(conversation_id);
