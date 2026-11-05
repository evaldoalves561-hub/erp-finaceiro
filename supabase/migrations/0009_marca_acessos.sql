-- Identidade visual por empresa (cor e logo) e registro de acessos.
alter table public.empresas
  add column if not exists cor  text check (cor is null or cor ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists logo text check (logo is null or (logo like 'data:image/%' and length(logo) < 200000));

create table if not exists public.acessos (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  empresa_id  uuid references public.empresas(id) on delete set null,
  entrou_em   timestamptz not null default now(),
  dispositivo text check (length(dispositivo) <= 120)
);
create index if not exists acessos_entrou_em_idx on public.acessos (entrou_em desc);
create index if not exists acessos_usuario_idx on public.acessos (usuario_id);
create index if not exists acessos_empresa_idx on public.acessos (empresa_id);
alter table public.acessos enable row level security;
-- cada pessoa só registra a própria entrada, numa empresa liberada para ela
create policy acessos_registra on public.acessos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (empresa_id is null or empresa_id in (select privado.minhas_empresas())));
-- só a conta master consulta o registro
create policy acessos_master on public.acessos for select to authenticated
  using ((select privado.sou_master()));
grant select, insert on public.acessos to authenticated;
