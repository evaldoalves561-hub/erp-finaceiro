-- ERP financeiro multiempresa: estrutura base (Fases 1 a 4)
-- Aplicado no projeto Supabase erp-financeiro (vovomhtwqfnlidqlmycu) em 2026-11-03. Ajustes em 0002.

-- =========================================================
-- Empresas e acesso
-- =========================================================
create table empresas (
  id            uuid primary key default gen_random_uuid(),
  cnpj          text not null unique,
  razao_social  text not null,
  nome_fantasia text,
  ativa         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create type papel_usuario as enum ('admin', 'financeiro', 'leitura');

create table usuarios_empresas (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  papel      papel_usuario not null default 'leitura',
  primary key (usuario_id, empresa_id)
);

-- Empresas que o usuario logado pode ver
create or replace function minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from usuarios_empresas where usuario_id = auth.uid()
$$;

-- =========================================================
-- Plano de contas, centros de custo e premissas
-- =========================================================
create type tipo_conta as enum ('receita', 'despesa');
create type grupo_dre as enum (
  'receita_bruta', 'deducoes', 'custos', 'despesas_operacionais',
  'resultado_financeiro', 'outras', 'ir_csll', 'nao_operacional'
);

create table plano_contas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  codigo      text not null,               -- ex.: 3.01.002
  nome        text not null,
  conta_pai   uuid references plano_contas(id),
  tipo        tipo_conta not null,
  grupo_dre   grupo_dre,
  analitica   boolean not null default true, -- so contas analiticas recebem lancamentos
  ativa       boolean not null default true,
  unique (empresa_id, codigo)
);

create table centros_custo (
  id         uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo     text not null,
  nome       text not null,
  unique (empresa_id, codigo)
);

-- Premissas de prazo por conta: quando compra e como paga
create type regra_pagamento as enum ('dias_corridos', 'dia_fixo_mes_seguinte', 'a_vista');

create table premissas_conta (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  conta_id          uuid not null references plano_contas(id) on delete cascade,
  vigencia_inicio   date not null,
  vigencia_fim      date,
  antecedencia_compra_dias int not null default 0, -- compra X dias antes da competencia
  regra             regra_pagamento not null default 'dias_corridos',
  prazos_dias       int[] not null default '{30}', -- ex.: {30,60,90} = 3 parcelas
  dia_fixo          int check (dia_fixo between 1 and 31),
  forma_pagamento   text,
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);

-- =========================================================
-- Cadastros
-- =========================================================
create table parceiros (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  documento   text,                         -- CNPJ ou CPF
  nome        text not null,
  cliente     boolean not null default false,
  fornecedor  boolean not null default false,
  conta_padrao_id uuid references plano_contas(id), -- conta usada nas NFs deste fornecedor
  unique (empresa_id, documento)
);

create type tipo_item as enum ('produto', 'servico');

create table produtos (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  codigo        text not null,
  nome          text not null,
  tipo          tipo_item not null,
  unidade       text not null default 'UN',
  ncm           text,
  controla_estoque boolean not null default true,
  conta_receita_id uuid references plano_contas(id),
  conta_custo_id   uuid references plano_contas(id),
  preco_padrao  numeric(14,2),
  custo_padrao  numeric(14,4),
  meta_mensal   numeric(14,2),
  unique (empresa_id, codigo)
);

-- =========================================================
-- Orcamento com espelhos (versoes congeladas)
-- =========================================================
create table orcamento_versoes (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nome        text not null,               -- ex.: Original 2027, Revisao Abril
  ano         int not null,
  origem_id   uuid references orcamento_versoes(id), -- espelho copiado de outra versao
  congelada   boolean not null default false,
  congelada_em timestamptz,
  criado_em   timestamptz not null default now(),
  unique (empresa_id, nome)
);

create table orcamento_linhas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  versao_id     uuid not null references orcamento_versoes(id) on delete cascade,
  conta_id      uuid not null references plano_contas(id),
  centro_custo_id uuid references centros_custo(id),
  produto_id    uuid references produtos(id),
  competencia   date not null check (extract(day from competencia) = 1), -- 1o dia do mes
  valor         numeric(14,2) not null
);

-- Orcamento de caixa, gerado a partir das linhas + premissas
create table orcamento_caixa (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  versao_id   uuid not null references orcamento_versoes(id) on delete cascade,
  linha_id    uuid not null references orcamento_linhas(id) on delete cascade,
  conta_id    uuid not null references plano_contas(id),
  data_caixa  date not null,
  valor       numeric(14,2) not null
);

-- Espelho congelado nao aceita alteracao
create or replace function bloqueia_versao_congelada() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from orcamento_versoes v
             where v.id = coalesce(new.versao_id, old.versao_id) and v.congelada) then
    raise exception 'Versao de orcamento congelada (espelho) nao pode ser alterada';
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_orc_linhas_congelada before insert or update or delete on orcamento_linhas
  for each row execute function bloqueia_versao_congelada();
create trigger trg_orc_caixa_congelada before insert or update or delete on orcamento_caixa
  for each row execute function bloqueia_versao_congelada();

-- =========================================================
-- Notas fiscais
-- =========================================================
create type origem_nf as enum ('email', 'foto', 'upload_xml', 'manual');
create type status_nf as enum ('a_revisar', 'confirmada', 'cancelada');

create table notas_fiscais (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  chave_acesso   text check (chave_acesso ~ '^[0-9]{44}$'),
  numero         text,
  serie          text,
  data_emissao   date,
  emitente_id    uuid references parceiros(id),
  emitente_cnpj  text,
  valor_total    numeric(14,2),
  origem         origem_nf not null,
  status         status_nf not null default 'a_revisar',
  arquivo_path   text,                     -- caminho no Supabase Storage
  dados_brutos   jsonb,                    -- resultado da leitura (XML ou foto)
  criado_em      timestamptz not null default now(),
  unique (empresa_id, chave_acesso)        -- mesma NF nao entra duas vezes
);

create table nf_itens (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references empresas(id) on delete cascade,
  nf_id         uuid not null references notas_fiscais(id) on delete cascade,
  produto_id    uuid references produtos(id),
  codigo_fornecedor text,
  descricao     text not null,
  ncm           text,
  cfop          text,
  unidade       text,
  quantidade    numeric(14,4) not null,
  valor_unitario numeric(14,6) not null,
  valor_total   numeric(14,2) not null
);

create table nf_duplicatas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  nf_id       uuid not null references notas_fiscais(id) on delete cascade,
  numero      text,
  vencimento  date not null,
  valor       numeric(14,2) not null
);

-- =========================================================
-- Realizado: lancamentos e parcelas
-- =========================================================
create type status_parcela as enum ('aberta', 'paga', 'cancelada');

create table lancamentos (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  conta_id       uuid not null references plano_contas(id),
  centro_custo_id uuid references centros_custo(id),
  produto_id     uuid references produtos(id),
  parceiro_id    uuid references parceiros(id),
  nf_id          uuid references notas_fiscais(id),
  competencia    date not null,
  descricao      text,
  valor          numeric(14,2) not null,   -- receita positiva, despesa negativa
  criado_em      timestamptz not null default now()
);

create table parcelas (
  id             uuid primary key default gen_random_uuid(),
  empresa_id     uuid not null references empresas(id) on delete cascade,
  lancamento_id  uuid not null references lancamentos(id) on delete cascade,
  numero         int not null default 1,
  vencimento     date not null,
  valor          numeric(14,2) not null,
  data_pagamento date,
  valor_pago     numeric(14,2),
  forma_pagamento text,
  status         status_parcela not null default 'aberta'
);

-- =========================================================
-- Estoque
-- =========================================================
create type tipo_movimento as enum ('entrada', 'saida', 'ajuste');

create table estoque_movimentos (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresas(id) on delete cascade,
  produto_id   uuid not null references produtos(id),
  data         date not null,
  tipo         tipo_movimento not null,
  quantidade   numeric(14,4) not null check (quantidade > 0),
  custo_unitario numeric(14,6),            -- obrigatorio em entradas
  nf_item_id   uuid references nf_itens(id),
  observacao   text
);

-- Saldo e custo medio ponderado por produto
create or replace view estoque_saldos with (security_invoker = true) as
select
  empresa_id,
  produto_id,
  sum(case when tipo = 'saida' then -quantidade else quantidade end) as quantidade,
  sum(case when tipo = 'entrada' then quantidade * custo_unitario end)
    / nullif(sum(case when tipo = 'entrada' then quantidade end), 0) as custo_medio
from estoque_movimentos
group by empresa_id, produto_id;

-- =========================================================
-- Relatorios
-- =========================================================
create or replace view dre_realizado with (security_invoker = true) as
select l.empresa_id, date_trunc('month', l.competencia)::date as mes,
       c.grupo_dre, c.codigo, c.nome as conta, sum(l.valor) as valor
from lancamentos l join plano_contas c on c.id = l.conta_id
group by 1, 2, 3, 4, 5;

create or replace view fluxo_caixa_realizado with (security_invoker = true) as
select p.empresa_id, date_trunc('month', p.data_pagamento)::date as mes,
       c.codigo, c.nome as conta,
       sum(case when coalesce(p.valor_pago, p.valor) > 0 then coalesce(p.valor_pago, p.valor) else 0 end) as entradas,
       sum(case when coalesce(p.valor_pago, p.valor) < 0 then coalesce(p.valor_pago, p.valor) else 0 end) as saidas
from parcelas p
join lancamentos l on l.id = p.lancamento_id
join plano_contas c on c.id = l.conta_id
where p.status = 'paga'
group by 1, 2, 3, 4;

-- =========================================================
-- Seguranca: cada usuario so enxerga as empresas dele
-- =========================================================
alter table empresas enable row level security;
create policy empresas_acesso on empresas for all
  using (id in (select minhas_empresas())) with check (id in (select minhas_empresas()));

alter table usuarios_empresas enable row level security;
create policy usuarios_empresas_proprio on usuarios_empresas for select
  using (usuario_id = auth.uid());

-- Cria a empresa e ja vincula o usuario logado como admin
create or replace function criar_empresa(p_cnpj text, p_razao_social text, p_nome_fantasia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado';
  end if;
  insert into empresas (cnpj, razao_social, nome_fantasia)
    values (p_cnpj, p_razao_social, p_nome_fantasia) returning id into v_id;
  insert into usuarios_empresas (usuario_id, empresa_id, papel) values (auth.uid(), v_id, 'admin');
  return v_id;
end $$;

revoke execute on function criar_empresa(text, text, text) from public, anon;
grant execute on function criar_empresa(text, text, text) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'plano_contas','centros_custo','premissas_conta','parceiros','produtos',
    'orcamento_versoes','orcamento_linhas','orcamento_caixa',
    'notas_fiscais','nf_itens','nf_duplicatas','lancamentos','parcelas','estoque_movimentos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all using (empresa_id in (select minhas_empresas())) with check (empresa_id in (select minhas_empresas()))',
      t || '_por_empresa', t);
    execute format('create index on %I (empresa_id)', t);
  end loop;
end $$;
