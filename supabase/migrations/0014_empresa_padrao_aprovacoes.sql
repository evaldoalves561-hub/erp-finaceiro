-- Cadastro padronizado de empresa (PJ ou pessoa física) e tabela de aprovações (alçadas)
-- para compra, pagamento e conclusão de conciliação. Só acrescenta; nada é apagado.

-- ===================== 1) Empresa: pessoa jurídica ou física
alter table public.empresas
  add column if not exists tipo_pessoa text not null default 'pj' check (tipo_pessoa in ('pj', 'pf'));

-- ===================== 2) Modelos de plano de contas (PJ e PF)
alter table public.plano_contas_modelo add column if not exists modelo text not null default 'pj'
  check (modelo in ('pj', 'pf'));
alter table public.plano_contas_modelo drop constraint if exists plano_contas_modelo_pkey;
alter table public.plano_contas_modelo add primary key (modelo, codigo);

-- contas de transferência entre contas bancárias (não entram na DRE) nos dois modelos
insert into public.plano_contas_modelo (modelo, codigo, nome, pai, tipo, grupo_dre, analitica) values
 ('pj','8','Transferências entre contas',null,'despesa',null,false),
 ('pj','8.01.001','Transferência · entrada','8','receita',null,true),
 ('pj','8.01.002','Transferência · saída','8','despesa',null,true)
on conflict do nothing;

insert into public.plano_contas_modelo (modelo, codigo, nome, pai, tipo, grupo_dre, analitica) values
 ('pf','3','Receitas',null,'receita',null,false),
 ('pf','3.01','Rendimentos','3','receita',null,false),
 ('pf','3.01.001','Salário','3.01','receita','receita_bruta',true),
 ('pf','3.01.002','13º salário e férias','3.01','receita','receita_bruta',true),
 ('pf','3.01.003','Pró-labore e retiradas','3.01','receita','receita_bruta',true),
 ('pf','3.01.004','Aluguéis recebidos','3.01','receita','receita_bruta',true),
 ('pf','3.01.005','Serviços e trabalhos extras','3.01','receita','receita_bruta',true),
 ('pf','3.01.006','Outras receitas','3.01','receita','receita_bruta',true),
 ('pf','3.02','Descontos na fonte','3','despesa',null,false),
 ('pf','3.02.001','INSS','3.02','despesa','deducoes',true),
 ('pf','3.02.002','IRRF','3.02','despesa','deducoes',true),
 ('pf','5','Despesas',null,'despesa',null,false),
 ('pf','5.01','Moradia','5','despesa',null,false),
 ('pf','5.01.001','Aluguel, condomínio e IPTU','5.01','despesa','despesas_operacionais',true),
 ('pf','5.01.002','Energia, água e gás','5.01','despesa','despesas_operacionais',true),
 ('pf','5.01.003','Internet, TV e telefone','5.01','despesa','despesas_operacionais',true),
 ('pf','5.02','Alimentação','5','despesa',null,false),
 ('pf','5.02.001','Mercado','5.02','despesa','despesas_operacionais',true),
 ('pf','5.02.002','Restaurantes e delivery','5.02','despesa','despesas_operacionais',true),
 ('pf','5.03','Transporte','5','despesa',null,false),
 ('pf','5.03.001','Combustível e transporte','5.03','despesa','despesas_operacionais',true),
 ('pf','5.03.002','Carro: seguro, IPVA e manutenção','5.03','despesa','despesas_operacionais',true),
 ('pf','5.04','Saúde','5','despesa',null,false),
 ('pf','5.04.001','Plano de saúde','5.04','despesa','despesas_operacionais',true),
 ('pf','5.04.002','Farmácia e consultas','5.04','despesa','despesas_operacionais',true),
 ('pf','5.05','Educação, lazer e pessoal','5','despesa',null,false),
 ('pf','5.05.001','Educação','5.05','despesa','despesas_operacionais',true),
 ('pf','5.05.002','Lazer e viagens','5.05','despesa','despesas_operacionais',true),
 ('pf','5.05.003','Roupas e cuidados pessoais','5.05','despesa','despesas_operacionais',true),
 ('pf','5.05.004','Assinaturas e aplicativos','5.05','despesa','despesas_operacionais',true),
 ('pf','5.05.005','Outras despesas','5.05','despesa','despesas_operacionais',true),
 ('pf','6','Resultado financeiro',null,'despesa',null,false),
 ('pf','6.01.001','Tarifas bancárias e IOF','6','despesa','resultado_financeiro',true),
 ('pf','6.01.002','Rendimentos de aplicações','6','receita','resultado_financeiro',true),
 ('pf','6.01.003','Juros e multas pagos','6','despesa','resultado_financeiro',true),
 ('pf','6.02.001','Empréstimos e financiamentos','6','despesa','resultado_financeiro',true),
 ('pf','7','Imposto de renda',null,'despesa',null,false),
 ('pf','7.01.001','Imposto de renda pessoa física','7','despesa','ir_csll',true),
 ('pf','8','Transferências entre contas',null,'despesa',null,false),
 ('pf','8.01.001','Transferência · entrada','8','receita',null,true),
 ('pf','8.01.002','Transferência · saída','8','despesa',null,true)
on conflict do nothing;

create or replace function privado.copiar_plano_padrao(p_empresa uuid, p_modelo text default 'pj')
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.plano_contas_modelo where modelo = coalesce(p_modelo, 'pj') order by length(codigo), codigo loop
    insert into public.plano_contas (empresa_id, codigo, nome, tipo, grupo_dre, analitica, conta_pai)
    values (p_empresa, r.codigo, r.nome, coalesce(r.tipo, 'despesa'), r.grupo_dre, r.analitica,
            (select id from public.plano_contas where empresa_id = p_empresa and codigo = r.pai))
    on conflict (empresa_id, codigo) do nothing;
  end loop;
  if coalesce(p_modelo, 'pj') = 'pf' then
    insert into public.centros_custo (empresa_id, codigo, nome) values
      (p_empresa, 'CASA', 'Casa'), (p_empresa, 'PES', 'Pessoal')
    on conflict (empresa_id, codigo) do nothing;
  else
    insert into public.centros_custo (empresa_id, codigo, nome) values
      (p_empresa, 'COM', 'Comercial'), (p_empresa, 'OPE', 'Operação'),
      (p_empresa, 'ADM', 'Administrativo'), (p_empresa, 'FIN', 'Financeiro')
    on conflict (empresa_id, codigo) do nothing;
  end if;
end $$;
revoke execute on function privado.copiar_plano_padrao(uuid, text) from public, anon, authenticated;

-- copia o plano de contas e os centros de custo de outra empresa (cliente parecido)
create or replace function privado.copiar_plano_de(p_empresa uuid, p_origem uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select c.*, (select codigo from public.plano_contas x where x.id = c.conta_pai) as cod_pai
             from public.plano_contas c where c.empresa_id = p_origem and c.ativa
            order by length(c.codigo), c.codigo loop
    insert into public.plano_contas (empresa_id, codigo, nome, tipo, grupo_dre, analitica, conta_pai)
    values (p_empresa, r.codigo, r.nome, r.tipo, r.grupo_dre, r.analitica,
            (select id from public.plano_contas where empresa_id = p_empresa and codigo = r.cod_pai))
    on conflict (empresa_id, codigo) do nothing;
  end loop;
  insert into public.centros_custo (empresa_id, codigo, nome, responsavel)
    select p_empresa, codigo, nome, responsavel from public.centros_custo where empresa_id = p_origem
  on conflict (empresa_id, codigo) do nothing;
end $$;
revoke execute on function privado.copiar_plano_de(uuid, uuid) from public, anon, authenticated;

-- Nova empresa: dados completos, modelo PJ/PF ou cópia de outra empresa
drop function if exists public.criar_empresa(text, text, text);
create or replace function public.criar_empresa(
  p_cnpj text, p_razao_social text, p_nome_fantasia text default null,
  p_tipo text default 'pj', p_regime text default null, p_atividade text default null,
  p_cor text default null, p_copiar_de uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_tipo text := coalesce(p_tipo, 'pj');
begin
  if not privado.sou_master() then
    raise exception 'Somente a conta master pode criar empresas';
  end if;
  if v_tipo = 'pj' and length(p_cnpj) <> 14 then raise exception 'O CNPJ precisa ter 14 dígitos'; end if;
  if v_tipo = 'pf' and length(p_cnpj) not in (11, 14) then raise exception 'O CPF precisa ter 11 dígitos'; end if;
  insert into empresas (cnpj, razao_social, nome_fantasia, tipo_pessoa, regime_tributario, atividade, cor)
    values (p_cnpj, p_razao_social, nullif(trim(p_nome_fantasia), ''), v_tipo,
            case when v_tipo = 'pj' then p_regime end, case when v_tipo = 'pj' then p_atividade end, p_cor)
    returning id into v_id;
  insert into usuarios_empresas (usuario_id, empresa_id, papel) values (auth.uid(), v_id, 'admin')
    on conflict do nothing;
  if p_copiar_de is not null then
    perform privado.copiar_plano_de(v_id, p_copiar_de);
    -- garante as contas de transferência mesmo copiando de outra empresa
    insert into public.plano_contas (empresa_id, codigo, nome, tipo, grupo_dre, analitica, conta_pai)
      select v_id, m.codigo, m.nome, m.tipo, m.grupo_dre, m.analitica, null
        from public.plano_contas_modelo m
       where m.modelo = v_tipo and m.codigo = '8'
         and not exists (select 1 from public.plano_contas x where x.empresa_id = v_id and x.nome ilike 'transfer%')
    on conflict (empresa_id, codigo) do nothing;
    insert into public.plano_contas (empresa_id, codigo, nome, tipo, grupo_dre, analitica, conta_pai)
      select v_id, m.codigo, m.nome, m.tipo, m.grupo_dre, m.analitica,
             (select id from public.plano_contas where empresa_id = v_id and codigo = '8')
        from public.plano_contas_modelo m
       where m.modelo = v_tipo and m.pai = '8'
         and exists (select 1 from public.plano_contas where empresa_id = v_id and codigo = '8' and nome ilike 'transfer%')
    on conflict (empresa_id, codigo) do nothing;
  else
    perform privado.copiar_plano_padrao(v_id, v_tipo);
  end if;
  return v_id;
end $$;
revoke execute on function public.criar_empresa(text, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.criar_empresa(text, text, text, text, text, text, text, uuid) to authenticated;

-- ===================== 3) Tabela de aprovações (alçadas)
-- Para cada processo e faixa de valor: quem pode aprovar e se precisa ser outra pessoa.
-- Vale a faixa de maior "valor_a_partir" que não passe do valor do documento.
create table if not exists public.alcadas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  processo           text not null check (processo in ('compra', 'pagamento', 'conciliacao')),
  valor_a_partir     numeric(14,2) not null default 0 check (valor_a_partir >= 0),
  aprovador          text not null default 'admin' check (aprovador in ('master', 'admin', 'financeiro')),
  outra_pessoa       boolean not null default true,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  unique (empresa_id, processo, valor_a_partir)
);
create index if not exists idx_alcadas_emp on public.alcadas (empresa_id, processo);

-- histórico de cada aprovação ou recusa
create table if not exists public.aprovacoes (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas(id) on delete cascade,
  processo           text not null check (processo in ('compra', 'pagamento', 'conciliacao')),
  referencia_id      uuid not null,
  descricao          text,
  valor              numeric(14,2),
  decisao            text not null check (decisao in ('aprovado', 'recusado')),
  solicitado_por     uuid,
  decidido_por       uuid default auth.uid(),
  decidido_por_nome  text,
  decidido_em        timestamptz not null default now(),
  observacao         text
);
create index if not exists idx_aprovacoes_emp on public.aprovacoes (empresa_id, decidido_em desc);

-- Pode aprovar? master sempre; senão o papel exigido pela faixa (admin aprova o que o financeiro aprova).
-- Sem faixa cadastrada: quem pode editar a empresa aprova.
create or replace function privado.pode_aprovar(p_empresa uuid, p_processo text, p_valor numeric, p_solicitante uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare a record; v_papel text;
begin
  if privado.sou_master() then return null; end if;
  select * into a from public.alcadas
   where empresa_id = p_empresa and processo = p_processo and ativo and valor_a_partir <= abs(coalesce(p_valor, 0))
   order by valor_a_partir desc limit 1;
  select papel::text into v_papel from public.usuarios_empresas
   where usuario_id = (select auth.uid()) and empresa_id = p_empresa;
  if a.id is null then
    if v_papel in ('admin', 'financeiro') then return null; end if;
    return 'Seu acesso não permite aprovar';
  end if;
  if a.outra_pessoa and p_solicitante is not null and p_solicitante = (select auth.uid()) then
    return 'Pela tabela de aprovações, outra pessoa precisa aprovar';
  end if;
  if a.aprovador = 'master' then return 'Pela tabela de aprovações, este valor só a conta master aprova'; end if;
  if a.aprovador = 'admin' and coalesce(v_papel, '') <> 'admin' then
    return 'Pela tabela de aprovações, este valor precisa do administrador da empresa';
  end if;
  if a.aprovador = 'financeiro' and coalesce(v_papel, '') not in ('admin', 'financeiro') then
    return 'Pela tabela de aprovações, este valor precisa do financeiro ou do administrador';
  end if;
  return null;
end $$;
revoke execute on function privado.pode_aprovar(uuid, text, numeric, uuid) from public, anon;
grant execute on function privado.pode_aprovar(uuid, text, numeric, uuid) to authenticated;

-- o app consulta antes de mostrar o botão Aprovar
create or replace function public.posso_aprovar(p_empresa uuid, p_processo text, p_valor numeric, p_solicitante uuid default null)
returns text language sql stable security definer set search_path = public as $$
  select privado.pode_aprovar(p_empresa, p_processo, p_valor, p_solicitante)
$$;
revoke execute on function public.posso_aprovar(uuid, text, numeric, uuid) from public, anon;
grant execute on function public.posso_aprovar(uuid, text, numeric, uuid) to authenticated;

create or replace function privado.nome_usuario() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nome, email) from public.perfis where usuario_id = (select auth.uid())
$$;

alter table public.alcadas enable row level security;
alter table public.aprovacoes enable row level security;
create policy alcadas_leitura on public.alcadas for select to authenticated
  using (empresa_id in (select privado.minhas_empresas()));
-- só master e administrador da empresa mexem na tabela de aprovações
create policy alcadas_grava on public.alcadas for all to authenticated
  using ((select privado.sou_master()) or exists (select 1 from public.usuarios_empresas ue where ue.usuario_id = (select auth.uid()) and ue.empresa_id = alcadas.empresa_id and ue.papel = 'admin'))
  with check ((select privado.sou_master()) or exists (select 1 from public.usuarios_empresas ue where ue.usuario_id = (select auth.uid()) and ue.empresa_id = alcadas.empresa_id and ue.papel = 'admin'));
create policy aprovacoes_leitura on public.aprovacoes for select to authenticated
  using (empresa_id in (select privado.minhas_empresas()));
grant select, insert, update, delete on public.alcadas to authenticated;
grant select on public.aprovacoes to authenticated;

-- ---------- pagamento: o lote só é aprovado por quem a tabela permite
create or replace function privado.pagamento_lote_valida() returns trigger
language plpgsql set search_path = public as $$
declare v_erro text;
begin
  if new.status = old.status then return new; end if;
  if new.status = 'aprovado' then
    if old.status <> 'rascunho' then raise exception 'Só um lote em rascunho pode ser aprovado'; end if;
    if (select auth.uid()) is not null and (select auth.uid()) = old.criado_por and not privado.sou_master()
       and not exists (select 1 from public.alcadas where empresa_id = old.empresa_id and processo = 'pagamento' and ativo) then
      raise exception 'Quem criou o lote não pode aprová-lo';
    end if;
    v_erro := privado.pode_aprovar(old.empresa_id, 'pagamento', old.total, old.criado_por);
    if v_erro is not null then raise exception '%', v_erro; end if;
    new.aprovado_por := (select auth.uid());
    new.aprovado_em := now();
    insert into public.aprovacoes (empresa_id, processo, referencia_id, descricao, valor, decisao, solicitado_por, decidido_por_nome)
      values (old.empresa_id, 'pagamento', old.id, 'Lote de pagamento ' || lpad(old.numero::text, 4, '0'), old.total, 'aprovado', old.criado_por,
              coalesce(new.aprovado_por_nome, privado.nome_usuario()));
  elsif new.status = 'remessa_gerada' and old.status not in ('aprovado', 'remessa_gerada') then
    raise exception 'Aprove o lote antes de gerar a remessa';
  elsif new.status = 'processado' and old.status <> 'remessa_gerada' then
    raise exception 'Gere a remessa antes de ler o retorno';
  elsif new.status = 'rascunho' then
    raise exception 'Lote aprovado não volta para rascunho';
  elsif new.status = 'cancelado' and old.status = 'processado' then
    raise exception 'Lote já processado pelo banco';
  elsif new.status = 'cancelado' and old.status = 'rascunho' then
    insert into public.aprovacoes (empresa_id, processo, referencia_id, descricao, valor, decisao, solicitado_por, decidido_por_nome)
      values (old.empresa_id, 'pagamento', old.id, 'Lote de pagamento ' || lpad(old.numero::text, 4, '0'), old.total, 'recusado', old.criado_por, privado.nome_usuario());
  end if;
  return new;
end $$;

-- ---------- compra: a aprovação da cotação segue a tabela
create or replace function privado.compras_aprovacao_alcada() returns trigger
language plpgsql set search_path = public as $$
declare v_erro text;
begin
  if new.status = 'aprovado' and old.status is distinct from 'aprovado' then
    v_erro := privado.pode_aprovar(new.empresa_id, 'compra', new.valor_aprovado, old.criado_por);
    if v_erro is not null then raise exception '%', v_erro; end if;
    insert into public.aprovacoes (empresa_id, processo, referencia_id, descricao, valor, decisao, solicitado_por, decidido_por_nome)
      values (new.empresa_id, 'compra', new.id, 'Compra ' || coalesce(new.numero::text, '') || ' · ' || new.titulo, new.valor_aprovado, 'aprovado', old.criado_por,
              coalesce(new.aprovado_por, privado.nome_usuario()));
  end if;
  return new;
end $$;
drop trigger if exists trg_compras_aprovacao_alcada on public.compras_pedidos;
create trigger trg_compras_aprovacao_alcada before update of status on public.compras_pedidos
  for each row execute function privado.compras_aprovacao_alcada();

-- ---------- conciliação: concluir um extrato pede aprovação
alter table public.extratos
  add column if not exists situacao text not null default 'aberto' check (situacao in ('aberto', 'aguardando_aprovacao', 'concluido')),
  add column if not exists enviado_aprovacao_por uuid,
  add column if not exists enviado_aprovacao_em timestamptz,
  add column if not exists concluido_por uuid,
  add column if not exists concluido_por_nome text,
  add column if not exists concluido_em timestamptz;

-- linhas de transferência sem a outra ponta conciliada (débito numa conta e crédito na outra)
create or replace function public.transferencias_sem_par(p_extrato uuid)
returns table (linha_id uuid, lancamento_id uuid) language sql stable security invoker set search_path = public as $$
  select el.id, l.id
    from extrato_linhas el
    join parcelas p on p.id = el.parcela_id
    join lancamentos l on l.id = p.lancamento_id
    join plano_contas c on c.id = l.conta_id and c.grupo_dre is null and c.nome ilike 'transfer%'
    join lancamentos par on (par.id = l.vinculo_id or par.vinculo_id = l.id)
   where el.extrato_id = p_extrato
     and not exists (
       select 1 from extrato_linhas e2 join parcelas p2 on p2.id = e2.parcela_id
        where p2.lancamento_id = par.id)
$$;
grant execute on function public.transferencias_sem_par(uuid) to authenticated;

create or replace function privado.extrato_situacao_valida() returns trigger
language plpgsql set search_path = public as $$
declare v_erro text; v_total numeric; v_pend int; v_tr int;
begin
  if new.situacao = old.situacao then return new; end if;
  if new.situacao = 'aguardando_aprovacao' then
    select count(*) into v_pend from public.extrato_linhas where extrato_id = old.id and status in ('nao_lancado', 'valor_diferente');
    if v_pend > 0 then raise exception 'Ainda há % linha(s) pendente(s) neste extrato', v_pend; end if;
    select count(*) into v_tr from public.transferencias_sem_par(old.id);
    if v_tr > 0 then raise exception 'Há % transferência(s) sem a outra ponta conciliada: importe o extrato da outra conta', v_tr; end if;
    new.enviado_aprovacao_por := (select auth.uid()); new.enviado_aprovacao_em := now();
  elsif new.situacao = 'concluido' then
    select count(*) into v_tr from public.transferencias_sem_par(old.id);
    if v_tr > 0 then raise exception 'Há % transferência(s) sem a outra ponta conciliada', v_tr; end if;
    select coalesce(sum(abs(valor)), 0) into v_total from public.extrato_linhas where extrato_id = old.id;
    v_erro := privado.pode_aprovar(old.empresa_id, 'conciliacao', v_total, coalesce(old.enviado_aprovacao_por, (select auth.uid())));
    if v_erro is not null then raise exception '%', v_erro; end if;
    new.concluido_por := (select auth.uid()); new.concluido_em := now(); new.concluido_por_nome := privado.nome_usuario();
    insert into public.aprovacoes (empresa_id, processo, referencia_id, descricao, valor, decisao, solicitado_por, decidido_por_nome)
      values (old.empresa_id, 'conciliacao', old.id, 'Conciliação ' || coalesce(old.arquivo_nome, ''), v_total, 'aprovado', old.enviado_aprovacao_por, new.concluido_por_nome);
  elsif new.situacao = 'aberto' then
    if old.situacao = 'aguardando_aprovacao' then
      insert into public.aprovacoes (empresa_id, processo, referencia_id, descricao, decisao, solicitado_por, decidido_por_nome)
        values (old.empresa_id, 'conciliacao', old.id, 'Conciliação ' || coalesce(old.arquivo_nome, ''), 'recusado', old.enviado_aprovacao_por, privado.nome_usuario());
    elsif old.situacao = 'concluido' and not privado.sou_master() then
      raise exception 'Só a conta master reabre uma conciliação concluída';
    end if;
    new.concluido_por := null; new.concluido_em := null; new.concluido_por_nome := null;
  end if;
  return new;
end $$;
drop trigger if exists trg_extrato_situacao on public.extratos;
create trigger trg_extrato_situacao before update of situacao on public.extratos
  for each row execute function privado.extrato_situacao_valida();

-- extrato concluído não muda
create or replace function privado.extrato_linha_trava() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.extratos where id = coalesce(new.extrato_id, old.extrato_id) and situacao = 'concluido') then
    raise exception 'Conciliação concluída: peça à conta master para reabrir';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trg_extrato_linha_trava on public.extrato_linhas;
create trigger trg_extrato_linha_trava before update or delete on public.extrato_linhas
  for each row execute function privado.extrato_linha_trava();
