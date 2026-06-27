-- F9: add unique constraint on ticket ref to prevent duplicate refs
alter table public.tickets add constraint tickets_ref_unique unique (ref);
