-- Faturamento com taxas da maquininha, configuração de impostos por empresa e apuração (contas a pagar dos impostos).

-- Regime tributário da empresa
alter table empresas add column if not exists regime_tributario text
  check (regime_tributario in ('simples_nacional', 'lucro_presumido', 'lucro_real'));
alter table empresas add column if not exists atividade text
  check (atividade in ('servicos', 'comercio', 'misto', 'locacao'));

-- Impostos calculados sobre o faturamento (pela data de emissão da NF)
create table impostos_config (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references empresas(id) on delete cascade,
  imposto            text not null,                 -- PIS, COFINS, ISS, ICMS, DAS, IRPJ, CSLL, CBS, IBS
  periodicidade      text not null default 'mensal' check (periodicidade in ('mensal', 'trimestral')),
  aliquota           numeric(7,4) not null,         -- em %, ex.: 3.0000
  presuncao          numeric(7,4),                  -- % da receita que vira base (IRPJ/CSLL no lucro presumido)
  adicional_aliquota numeric(7,4),                  -- IRPJ: adicional de 10%
  adicional_limite   numeric(14,2),                 -- sobre a base que passar de R$ 60 mil no trimestre
  dia_vencimento     int not null default 20 check (dia_vencimento between 1 and 31),
  conta_id           uuid references plano_contas(id),
  vigencia_inicio    date not null default '2000-01-01',
  vigencia_fim       date,
  unique (empresa_id, imposto, vigencia_inicio)
);

-- Acordos com a maquininha / adquirente
create table acordos_cartao (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references empresas(id) on delete cascade,
  prestador       text not null,                    -- Stone, Cielo, Rede, PagSeguro...
  modalidade      text not null check (modalidade in ('debito', 'credito_vista', 'credito_parcelado', 'pix', 'voucher')),
  parcelas_de     int not null default 1,
  parcelas_ate    int not null default 1,
  taxa_percentual numeric(7,4) not null,            -- MDR em %
  taxa_fixa       numeric(10,2) not null default 0, -- R$ por transação
  prazo_dias      int not null default 30,          -- D+N do primeiro recebimento
  antecipacao     boolean not null default false,   -- recebe tudo no prazo, mesmo parcelado
  conta_id        uuid references plano_contas(id), -- conta da despesa com a taxa
  vigencia_inicio date not null default '2000-01-01',
  vigencia_fim    date,
  ativo           boolean not null default true,
  check (parcelas_ate >= parcelas_de)
);

-- Apuração lançada (gera o lançamento e a parcela a pagar do imposto)
create table apuracoes (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  imposto          text not null,
  periodo_inicio   date not null,
  periodo_fim      date not null,
  base             numeric(14,2) not null,
  aliquota_efetiva numeric(9,6) not null,
  valor            numeric(14,2) not null,
  vencimento       date not null,
  criado_em        timestamptz not null default now(),
  unique (empresa_id, imposto, periodo_inicio)
);

-- Lançamentos passam a saber de onde vieram e como foram recebidos
alter table lancamentos add column if not exists origem text not null default 'manual'
  check (origem in ('manual', 'importacao', 'faturamento', 'taxa_cartao', 'apuracao'));
alter table lancamentos add column if not exists numero_nf text;
alter table lancamentos add column if not exists forma_recebimento text;
alter table lancamentos add column if not exists parcelas_receb int;
alter table lancamentos add column if not exists acordo_id uuid references acordos_cartao(id) on delete set null;
alter table lancamentos add column if not exists vinculo_id uuid references lancamentos(id) on delete cascade;
alter table lancamentos add column if not exists apuracao_id uuid references apuracoes(id) on delete cascade;

create index if not exists idx_impostos_config_emp on impostos_config (empresa_id);
create index if not exists idx_impostos_config_conta on impostos_config (conta_id);
create index if not exists idx_acordos_emp on acordos_cartao (empresa_id);
create index if not exists idx_acordos_conta on acordos_cartao (conta_id);
create index if not exists idx_apuracoes_emp on apuracoes (empresa_id);
create index if not exists idx_lanc_acordo on lancamentos (acordo_id);
create index if not exists idx_lanc_vinculo on lancamentos (vinculo_id);
create index if not exists idx_lanc_apuracao on lancamentos (apuracao_id);

do $$
declare t text;
begin
  foreach t in array array['impostos_config', 'acordos_cartao', 'apuracoes'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (empresa_id in (select privado.minhas_empresas())) with check (empresa_id in (select privado.minhas_empresas()))', t || '_por_empresa', t);
    execute format('create policy %I on %I as restrictive for insert to authenticated with check ((select privado.pode_editar(empresa_id)))', t || '_grava', t);
    execute format('create policy %I on %I as restrictive for update to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_altera', t);
    execute format('create policy %I on %I as restrictive for delete to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_apaga', t);
  end loop;
end $$;

-- Contas novas no plano padrão (e nas empresas que já existem)
insert into plano_contas_modelo (codigo, nome, pai, tipo, grupo_dre, analitica) values
 ('3.02.003', 'PIS e COFINS', '3.02', 'despesa', 'deducoes', true),
 ('3.02.004', 'ISS', '3.02', 'despesa', 'deducoes', true),
 ('3.02.005', 'ICMS', '3.02', 'despesa', 'deducoes', true),
 ('3.02.006', 'CBS e IBS (reforma tributária)', '3.02', 'despesa', 'deducoes', true),
 ('6.01.004', 'Taxas de maquininha e antecipação', '6', 'despesa', 'resultado_financeiro', true),
 ('7', 'Impostos sobre o lucro', null, 'despesa', null, false),
 ('7.01.001', 'IRPJ', '7', 'despesa', 'ir_csll', true),
 ('7.01.002', 'CSLL', '7', 'despesa', 'ir_csll', true)
on conflict (codigo) do nothing;

do $$
declare e record;
begin
  for e in select id from empresas loop
    perform privado.copiar_plano_padrao(e.id);
  end loop;
end $$;
