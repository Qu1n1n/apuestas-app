-- Cuando alguien se registra en Supabase Auth, creamos automáticamente
-- su fila correspondiente en la tabla "usuarios".

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.usuarios (id, nombre, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
