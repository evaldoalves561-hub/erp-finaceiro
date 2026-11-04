-- O Supabase só preenche invited_at depois de criar o usuário, então a trava
-- "cadastro somente por convite" barrava o próprio convite do administrador.
-- Agora a função usuarios-admin registra o e-mail aqui antes de convidar,
-- e o gatilho aceita quem estiver na lista (ou já tiver invited_at).
create table if not exists public.convites_pendentes (
  email     text primary key,
  criado_em timestamptz not null default now()
);
alter table public.convites_pendentes enable row level security;
-- sem políticas: só a service role (função usuarios-admin) lê e grava
revoke all on public.convites_pendentes from anon, authenticated;

create or replace function privado.novo_usuario()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_master boolean := lower(new.email) = 'evaldoalves561@gmail.com';
  v_convidado boolean := new.invited_at is not null
    or exists (select 1 from public.convites_pendentes c where c.email = lower(new.email));
begin
  if not v_master and not v_convidado then
    raise exception 'Cadastro somente por convite do administrador';
  end if;
  insert into public.perfis (usuario_id, email, nome, master)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), v_master)
  on conflict (usuario_id) do nothing;
  delete from public.convites_pendentes where email = lower(new.email);
  return new;
end $function$;
