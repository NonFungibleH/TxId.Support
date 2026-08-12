-- The case record for a bug/feedback finding: the request context it was filed
-- under (page, coarse device, country/region, surface), the same compliance
-- evidence the Conversations tab already shows per message.
--
-- The widget sends the page (pageUrl); country/device come from edge headers and
-- the user agent, coarsened, at /api/tickets time. No raw IP is stored (country
-- granularity only), matching messages.evidence.request.
alter table public.tickets add column if not exists request jsonb;
