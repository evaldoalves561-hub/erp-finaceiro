-- Usuários da empresa por departamento e gestão de pessoas (colaboradores, férias, atestados e afastamentos).
-- Dois níveis de controle de usuários:
--   * conta master (Gevans): vê e administra tudo, como antes;
--   * administrador da empresa (papel 'admin'): convida e gerencia os usuários da própria empresa,
--     organizados por departamento (feito pela função usuarios-admin, que confere o escopo).
-- Novo papel 'rh': cuida da gestão de pessoas e só consulta o financeiro.

alter type papel_usuario add value if not exists 'rh';

-- ---------- departamentos
create table if not exists public.departamentos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  nome            text not null check (length(trim(nome)) between 1 and 80),
  responsavel     text,
  centro_custo_id uuid references public.centros_custo(id) on delete set null,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, nome)
);
create index if not exists departamentos_cc_idx on public.departamentos (centro_custo_id);

-- usuário do app ligado a um departamento dentro de cada empresa
alter table public.usuarios_empresas
  add column if not exists departamento_id uuid references public.departamentos(id) on delete set null;
create index if not exists usuarios_empresas_depto_idx on public.usuarios_empresas (departamento_id);

-- ---------- colaboradores
create table if not exists public.colaboradores (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  departamento_id uuid references public.departamentos(id) on delete set null,
  predio_id       uuid references public.predios(id) on delete set null,   -- unidade
  usuario_id      uuid references auth.users(id) on delete set null,       -- se também usa o app
  nome            text not null check (length(trim(nome)) between 1 and 120),
  cpf             text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  cargo           text,
  email           text,
  telefone        text,
  nascimento      date,
  admissao        date not null,
  desligamento    date check (desligamento is null or desligamento >= admissao),
  contrato        text not null default 'clt' check (contrato in ('clt','pj','estagio','temporario','socio')),
  salario         numeric(14,2) check (salario is null or salario >= 0),
  ferias_quitadas_ate date,   -- férias de períodos aquisitivos terminados até esta data já foram tiradas (histórico anterior ao app)
  observacao      text,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, cpf)
);
create index if not exists colaboradores_empresa_idx on public.colaboradores (empresa_id);
create index if not exists colaboradores_depto_idx on public.colaboradores (departamento_id);
create index if not exists colaboradores_predio_idx on public.colaboradores (predio_id);
create index if not exists colaboradores_usuario_idx on public.colaboradores (usuario_id);

-- ---------- férias, atestados, afastamentos, licenças e faltas
create table if not exists public.ausencias (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references public.empresas(id) on delete cascade,
  colaborador_id uuid not null references public.colaboradores(id) on delete cascade,
  tipo           text not null check (tipo in ('ferias','atestado','afastamento','licenca','falta','folga')),
  inicio         date not null,
  fim            date not null,
  dias           integer generated always as (fim - inicio + 1) stored,
  abono_dias     integer not null default 0 check (abono_dias between 0 and 10),  -- férias vendidas
  status         text not null default 'aprovada' check (status in ('solicitada','aprovada','recusada')),
  cid            text check (cid is null or length(cid) <= 10),
  motivo         text,
  criado_por     uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em      timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists ausencias_colab_idx on public.ausencias (colaborador_id, inicio);
create index if not exists ausencias_empresa_idx on public.ausencias (empresa_id, inicio);
create index if not exists ausencias_criado_por_idx on public.ausencias (criado_por);

-- a ausência sempre pertence à mesma empresa do colaborador
create or replace function privado.ausencia_empresa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select empresa_id into new.empresa_id from public.colaboradores where id = new.colaborador_id;
  if new.empresa_id is null then raise exception 'Colaborador não encontrado'; end if;
  return new;
end $$;
drop trigger if exists trg_ausencia_empresa on public.ausencias;
create trigger trg_ausencia_empresa before insert or update of colaborador_id on public.ausencias
  for each row execute function privado.ausencia_empresa();

-- ---------- permissões
-- papel comparado como texto: o valor 'rh' acabou de ser criado nesta mesma transação
create or replace function privado.cuida_pessoas(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.sou_master() or exists (
    select 1 from public.usuarios_empresas ue join public.perfis p on p.usuario_id = ue.usuario_id and p.ativo
     where ue.usuario_id = (select auth.uid()) and ue.empresa_id = p_empresa and ue.papel::text in ('admin', 'rh'))
$$;
revoke execute on function privado.cuida_pessoas(uuid) from public, anon;
grant execute on function privado.cuida_pessoas(uuid) to authenticated;

alter table public.departamentos enable row level security;
alter table public.colaboradores enable row level security;
alter table public.ausencias enable row level security;

-- departamentos: todos da empresa enxergam; admin e RH cadastram
create policy departamentos_leitura on public.departamentos for select to authenticated
  using (empresa_id in (select privado.minhas_empresas()));
create policy departamentos_grava on public.departamentos for insert to authenticated
  with check ((select privado.cuida_pessoas(empresa_id)));
create policy departamentos_altera on public.departamentos for update to authenticated
  using ((select privado.cuida_pessoas(empresa_id))) with check ((select privado.cuida_pessoas(empresa_id)));
create policy departamentos_apaga on public.departamentos for delete to authenticated
  using ((select privado.cuida_pessoas(empresa_id)));

-- colaboradores (tem salário e CPF): só master, admin e RH da empresa; a pessoa vê o próprio cadastro
create policy colaboradores_leitura on public.colaboradores for select to authenticated
  using ((select privado.cuida_pessoas(empresa_id)) or usuario_id = (select auth.uid()));
create policy colaboradores_grava on public.colaboradores for insert to authenticated
  with check ((select privado.cuida_pessoas(empresa_id)));
create policy colaboradores_altera on public.colaboradores for update to authenticated
  using ((select privado.cuida_pessoas(empresa_id))) with check ((select privado.cuida_pessoas(empresa_id)));
create policy colaboradores_apaga on public.colaboradores for delete to authenticated
  using ((select privado.cuida_pessoas(empresa_id)));

-- ausências: master, admin e RH; a pessoa vê as próprias
create policy ausencias_leitura on public.ausencias for select to authenticated
  using ((select privado.cuida_pessoas(empresa_id))
      or colaborador_id in (select id from public.colaboradores where usuario_id = (select auth.uid())));
create policy ausencias_grava on public.ausencias for insert to authenticated
  with check ((select privado.cuida_pessoas(empresa_id)));
create policy ausencias_altera on public.ausencias for update to authenticated
  using ((select privado.cuida_pessoas(empresa_id))) with check ((select privado.cuida_pessoas(empresa_id)));
create policy ausencias_apaga on public.ausencias for delete to authenticated
  using ((select privado.cuida_pessoas(empresa_id)));

grant select, insert, update, delete on public.departamentos, public.colaboradores, public.ausencias to authenticated;

-- departamentos iniciais a partir dos centros de custo de cada empresa (pode renomear ou apagar depois)
insert into public.departamentos (empresa_id, nome, centro_custo_id)
select c.empresa_id, c.nome, c.id from public.centros_custo c
on conflict (empresa_id, nome) do nothing;
