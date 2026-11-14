drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger on_auth_user_confirmed after update of email_confirmed_at on auth.users for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null) execute function public.handle_user_confirmed();