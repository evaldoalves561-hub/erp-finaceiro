-- Pagamentos a fornecedores por arquivo CNAB 240 (FEBRABAN): dados bancários do favorecido,
-- código de barras do boleto na parcela, lotes de pagamento com aprovação, remessa e retorno.
-- Somente acrescenta estruturas; não apaga dados.

-- Dados para pagar o fornecedor
alter table parceiros add column if not exists banco_codigo text;
alter table parceiros add column if not exists agencia text;
alter table parceiros add column if not exists agencia_dv text;
alter table parceiros add column if not exists conta text;
alter table parceiros add column if not exists conta_dv text;
alter table parceiros add column if not exists tipo_conta text check (tipo_conta in ('corrente', 'poupanca'));
alter table parceiros add column if not exists pix_tipo text check (pix_tipo in ('cpf_cnpj', 'email', 'telefone', 'aleatoria'));
alter table parceiros add column if not exists pix_chave text;
alter table parceiros add column if not exists dados_pgto_conferidos boolean not null default false;
alter table parceiros add column if not exists dados_pgto_alterados_em timestamptz;

-- Mudou banco, conta ou chave PIX: volta a exigir conferência (fraude comum em contas a pagar)
create or replace function privado.parceiro_dados_pgto() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.banco_codigo, new.agencia, new.agencia_dv, new.conta, new.conta_dv, new.pix_chave)
     is distinct from (old.banco_codigo, old.agencia, old.agencia_dv, old.conta, old.conta_dv, old.pix_chave) then
    new.dados_pgto_alterados_em := now();
    if new.dados_pgto_conferidos is not distinct from old.dados_pgto_conferidos then
      new.dados_pgto_conferidos := false;
    end if;
  end if;
  return new;
end $$;
create trigger trg_parceiro_dados_pgto before update on parceiros
  for each row execute function privado.parceiro_dados_pgto();

-- Boleto e modalidade na parcela
alter table parcelas add column if not exists codigo_barras text check (codigo_barras is null or codigo_barras ~ '^[0-9]{44}$');
alter table parcelas add column if not exists modalidade_pgto text check (modalidade_pgto in ('boleto', 'pix', 'ted', 'credito_conta'));

-- Convênio de pagamentos e numeração dos arquivos por conta bancária
alter table contas_bancarias add column if not exists agencia_dv text;
alter table contas_bancarias add column if not exists conta_dv text;
alter table contas_bancarias add column if not exists convenio_pagamento text;
alter table contas_bancarias add column if not exists cnab_sequencial int not null default 0;

create table pagamento_lotes (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references empresas(id) on delete cascade,
  conta_bancaria_id uuid not null references contas_bancarias(id),
  numero            int not null,                 -- NSA: sequencial do arquivo na conta
  data_pagamento    date not null,
  status            text not null default 'rascunho'
                    check (status in ('rascunho', 'aprovado', 'remessa_gerada', 'processado', 'cancelado')),
  total             numeric(14,2) not null default 0,
  criado_por        uuid default auth.uid(),
  criado_por_nome   text,
  aprovado_por      uuid,
  aprovado_por_nome text,
  aprovado_em       timestamptz,
  remessa_nome      text,
  remessa           text,                         -- conteúdo do arquivo enviado ao banco
  remessa_em        timestamptz,
  retorno_nome      text,
  retorno           text,
  retorno_em        timestamptz,
  criado_em         timestamptz not null default now(),
  unique (conta_bancaria_id, numero)
);

create table pagamento_itens (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references empresas(id) on delete cascade,
  lote_id          uuid not null references pagamento_lotes(id) on delete cascade,
  parcela_id       uuid not null references parcelas(id),
  seu_numero       text not null,                 -- identifica o item no retorno
  modalidade       text not null check (modalidade in ('boleto', 'pix', 'ted', 'credito_conta')),
  valor            numeric(14,2) not null check (valor > 0),
  favorecido       text,
  documento        text,
  status           text not null default 'pendente'
                   check (status in ('pendente', 'agendado', 'pago', 'rejeitado')),
  ocorrencias      text,
  ocorrencias_txt  text,
  data_efetiva     date,
  valor_efetivo    numeric(14,2),
  unique (lote_id, seu_numero)
);

create index if not exists idx_pl_emp on pagamento_lotes (empresa_id, status);
create index if not exists idx_pl_conta on pagamento_lotes (conta_bancaria_id);
create index if not exists idx_pi_lote on pagamento_itens (lote_id);
create index if not exists idx_pi_parcela on pagamento_itens (parcela_id);

-- Quem cria o lote não aprova (exceto a conta master); aprovado não volta a rascunho
create or replace function privado.pagamento_lote_valida() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status = old.status then return new; end if;
  if new.status = 'aprovado' then
    if old.status <> 'rascunho' then raise exception 'Só um lote em rascunho pode ser aprovado'; end if;
    if (select auth.uid()) is not null and (select auth.uid()) = old.criado_por and not privado.sou_master() then
      raise exception 'Quem criou o lote não pode aprová-lo';
    end if;
    new.aprovado_por := (select auth.uid());
    new.aprovado_em := now();
  elsif new.status = 'remessa_gerada' and old.status not in ('aprovado', 'remessa_gerada') then
    raise exception 'Aprove o lote antes de gerar a remessa';
  elsif new.status = 'processado' and old.status <> 'remessa_gerada' then
    raise exception 'Gere a remessa antes de ler o retorno';
  elsif new.status = 'rascunho' then
    raise exception 'Lote aprovado não volta para rascunho';
  elsif new.status = 'cancelado' and old.status = 'processado' then
    raise exception 'Lote já processado pelo banco';
  end if;
  return new;
end $$;
create trigger trg_pagamento_lote_valida before update of status on pagamento_lotes
  for each row execute function privado.pagamento_lote_valida();

do $$
declare t text;
begin
  foreach t in array array['pagamento_lotes', 'pagamento_itens'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (empresa_id in (select privado.minhas_empresas())) with check (empresa_id in (select privado.minhas_empresas()))', t || '_por_empresa', t);
    execute format('create policy %I on %I as restrictive for insert to authenticated with check ((select privado.pode_editar(empresa_id)))', t || '_grava', t);
    execute format('create policy %I on %I as restrictive for update to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_altera', t);
    execute format('create policy %I on %I as restrictive for delete to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_apaga', t);
  end loop;
end $$;
