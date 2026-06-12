alter table public.return_requests
  add column if not exists videos text[] not null default '{}';

comment on column public.return_requests.photos is
  'Customer photo evidence submitted before a return is reviewed.';

comment on column public.return_requests.videos is
  'Customer video evidence submitted before a return is reviewed.';
