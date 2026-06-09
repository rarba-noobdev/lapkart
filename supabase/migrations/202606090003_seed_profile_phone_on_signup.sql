-- Phone-OTP login: new users sign up with a phone number (no email/password).
-- Seed profiles.phone from auth.users.phone and fall back to phone for the
-- display name when no full_name/email is present.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, new.phone),
    coalesce(new.phone, new.raw_user_meta_data->>'phone')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

commit;
