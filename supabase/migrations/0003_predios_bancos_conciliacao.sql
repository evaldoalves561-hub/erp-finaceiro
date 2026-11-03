-- Predios (unidades), contas bancarias, conciliacao de extratos e regras de classificacao
-- Somente acrescenta estruturas; nao apaga nada.

create schema if not exists privado;
grant usage on schema privado to authenticated;
create or replace function privado.minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from public.usuarios_empresas where usuario_id = (select auth.uid())
$$;
revoke execute on function privado.minhas_empresas() from public, anon;
grant execute on function privado.minhas_empresas() to authenticated;

create table predios (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome       text not null,
  endereco   text,
  ativo      boolean not null default true,
  unique (empresa_id, nome)
);

create table contas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  predio_id     uuid references predios(id),
  banco_nome    text not null,
  banco_codigo  text,
  agencia       text not null,
  conta         text not null,
  saldo_inicial numeric(14,2) not null default 0,
  data_saldo_inicial date,
  ativa         boolean not null default true,
  unique (empresa_id, banco_codigo, agencia, conta)
);

alter table centros_custo add column if not exists responsavel text;

alter table lancamentos add column predio_id uuid references predios(id);
alter table orcamento_linhas add column predio_id uuid references predios(id);
alter table notas_fiscais add column predio_id uuid references predios(id);
alter table estoque_movimentos add column predio_id uuid references predios(id);
alter table parcelas add column conta_bancaria_id uuid references contas_bancarias(id);
alter table parcelas add column centro_custo_id uuid references centros_custo(id);

-- Extratos bancarios enviados para auditoria
create table extratos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  conta_bancaria_id uuid not null references contas_bancarias(id) on delete cascade,
  arquivo_nome      text,
  arquivo_path      text,
  periodo_inicio    date,
  periodo_fim       date,
  saldo_final       numeric(14,2),
  enviado_em        timestamptz not null default now()
);

create type status_conciliacao as enum ('conciliado', 'valor_diferente', 'nao_lancado', 'lancado_na_auditoria', 'ignorado');

create table extrato_linhas (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  extrato_id      uuid not null references extratos(id) on delete cascade,
  data            date not null,
  historico       text not null,
  documento       text,
  valor           numeric(14,2) not null,
  status          status_conciliacao not null default 'nao_lancado',
  parcela_id      uuid references parcelas(id),      -- baixa do sistema que bateu com a linha
  diferenca       numeric(14,2),
  conta_sugerida_id uuid references plano_contas(id),
  confianca       text check (confianca in ('alta', 'media', 'baixa')),
  motivo_sugestao text
);

-- Regras aprendidas: historico do banco -> conta do plano
create table regras_classificacao (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid references empresas(id) on delete cascade, -- null = vale para o grupo
  padrao      text not null,                                  -- trecho do historico, ex.: GOOGLE WORKSPACE
  conta_id    uuid not null references plano_contas(id),
  centro_custo_id uuid references centros_custo(id),
  vezes_usada int not null default 0,
  criado_em   timestamptz not null default now()
);

-- Importacoes de dados antigos (planilhas)
create table importacoes (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid references empresas(id) on delete cascade,
  arquivo_nome text not null,
  linhas_lidas int not null,
  linhas_importadas int not null,
  linhas_com_erro int not null,
  erros        jsonb,
  criado_em    timestamptz not null default now()
);
alter table lancamentos add column importacao_id uuid references importacoes(id);

alter table regras_classificacao enable row level security;
create policy regras_classificacao_por_empresa on regras_classificacao for all to authenticated
  using (empresa_id is null or empresa_id in (select privado.minhas_empresas()))
  with check (empresa_id in (select privado.minhas_empresas()));

alter table importacoes enable row level security;
create policy importacoes_por_empresa on importacoes for all to authenticated
  using (empresa_id in (select privado.minhas_empresas())) with check (empresa_id in (select privado.minhas_empresas()));

do $$
declare t text;
begin
  foreach t in array array['predios','contas_bancarias','extratos','extrato_linhas'] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (empresa_id in (select privado.minhas_empresas())) with check (empresa_id in (select privado.minhas_empresas()))',
      t || '_por_empresa', t);
    execute format('create index on %I (empresa_id)', t);
  end loop;
end $$;

create index on contas_bancarias (predio_id);
create index on lancamentos (predio_id);
create index on lancamentos (importacao_id);
create index on orcamento_linhas (predio_id);
create index on notas_fiscais (predio_id);
create index on estoque_movimentos (predio_id);
create index on parcelas (conta_bancaria_id);
create index on parcelas (centro_custo_id);
create index on extratos (conta_bancaria_id);
create index on extrato_linhas (extrato_id);
create index on extrato_linhas (parcela_id);
create index on extrato_linhas (conta_sugerida_id);
create index on regras_classificacao (empresa_id);
create index on regras_classificacao (conta_id);
create index on regras_classificacao (centro_custo_id);
create index on importacoes (empresa_id);
