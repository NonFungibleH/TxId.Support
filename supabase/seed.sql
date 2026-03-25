-- Seed a demo organisation and project for local development
insert into organisations (id, clerk_org_id, name)
values (
  '00000000-0000-0000-0000-000000000001',
  'org_demo_local',
  'TxID Support Demo'
) on conflict do nothing;

insert into projects (id, org_id, name, publishable_key, secret_key)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Demo Project',
  'pk_demo_local_key',
  'sk_demo_local_secret'
) on conflict do nothing;
