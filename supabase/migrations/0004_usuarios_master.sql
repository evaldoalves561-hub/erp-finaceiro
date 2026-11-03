-- Controle de usuarios: conta master, perfis, acesso por empresa e predio, cadastro so por convite.

create table perfis (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nome       text,
  master     boolean not null default false,
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now()
);

-- Restricao opcional por predio: sem linhas para uma empresa = ve todos os predios dela
create table usuarios_predios (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  predio_id  uuid not null references predios(id) on delete cascade,
  primary key (usuario_id, predio_id)
);
create index on usuarios_predios (predio_id);

create or replace function privado.sou_master() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select master and ativo from public.perfis where usuario_id = (select auth.uid())), false)
$$;
revoke execute on function privado.sou_master() from public, anon;
grant execute on function privado.sou_master() to authenticated;

-- Master enxerga todas as empresas; usuario inativo nao enxerga nenhuma
create or replace function privado.minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.id from public.empresas e where privado.sou_master()
  union
  select ue.empresa_id from public.usuarios_empresas ue
    join public.perfis p on p.usuario_id = ue.usuario_id and p.ativo
   where ue.usuario_id = (select auth.uid())
$$;

-- Cria o perfil ao criar o usuario; so o e-mail master pode se cadastrar sem convite
create or replace function privado.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_master boolean := lower(new.email) = 'evaldoalves561@gmail.com';
begin
  if not v_master and new.invited_at is null then
    raise exception 'Cadastro somente por convite do administrador';
  end if;
  insert into public.perfis (usuario_id, email, nome, master)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)), v_master)
  on conflict (usuario_id) do nothing;
  return new;
end $$;

create trigger trg_novo_usuario after insert on auth.users
  for each row execute function privado.novo_usuario();

-- Plano de contas padrao, copiado para cada empresa nova
create table plano_contas_modelo (
  codigo    text primary key,
  nome      text not null,
  pai       text,
  tipo      tipo_conta,
  grupo_dre grupo_dre,
  analitica boolean not null
);
alter table plano_contas_modelo enable row level security;
create policy plano_modelo_leitura on plano_contas_modelo for select to authenticated using (true);

insert into plano_contas_modelo (codigo, nome, pai, tipo, grupo_dre, analitica) values
 ('3','Receitas',null,'receita',null,false),
 ('3.01','Receita bruta','3','receita',null,false),
 ('3.01.001','Venda de produtos','3.01','receita','receita_bruta',true),
 ('3.01.002','Prestação de serviços e aluguéis','3.01','receita','receita_bruta',true),
 ('3.02','Deduções','3','despesa',null,false),
 ('3.02.001','Impostos sobre vendas (Simples)','3.02','despesa','deducoes',true),
 ('3.02.002','Devoluções','3.02','despesa','deducoes',true),
 ('4','Custos',null,'despesa',null,false),
 ('4.01.001','Mercadorias (CMV)','4','despesa','custos',true),
 ('4.01.002','Fretes de compra','4','despesa','custos',true),
 ('4.02.001','Serviços terceirizados (CSP)','4','despesa','custos',true),
 ('5','Despesas operacionais',null,'despesa',null,false),
 ('5.01.001','Salários e encargos','5','despesa','despesas_operacionais',true),
 ('5.01.002','Pró-labore','5','despesa','despesas_operacionais',true),
 ('5.02.001','Aluguel','5','despesa','despesas_operacionais',true),
 ('5.02.002','Contabilidade','5','despesa','despesas_operacionais',true),
 ('5.02.003','Softwares e assinaturas','5','despesa','despesas_operacionais',true),
 ('5.03.001','Marketing','5','despesa','despesas_operacionais',true),
 ('5.03.002','Comissões de vendas','5','despesa','despesas_operacionais',true),
 ('6','Resultado financeiro',null,'despesa',null,false),
 ('6.01.001','Tarifas bancárias e IOF','6','despesa','resultado_financeiro',true),
 ('6.01.002','Rendimentos de aplicações','6','receita','resultado_financeiro',true),
 ('6.01.003','Juros e multas pagos','6','despesa','resultado_financeiro',true);

create or replace function privado.copiar_plano_padrao(p_empresa uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select * from public.plano_contas_modelo order by length(codigo), codigo loop
    insert into public.plano_contas (empresa_id, codigo, nome, tipo, grupo_dre, analitica, conta_pai)
    values (p_empresa, r.codigo, r.nome, coalesce(r.tipo, 'despesa'), r.grupo_dre, r.analitica,
            (select id from public.plano_contas where empresa_id = p_empresa and codigo = r.pai))
    on conflict (empresa_id, codigo) do nothing;
  end loop;
  insert into public.centros_custo (empresa_id, codigo, nome) values
    (p_empresa, 'COM', 'Comercial'), (p_empresa, 'OPE', 'Operação'),
    (p_empresa, 'ADM', 'Administrativo'), (p_empresa, 'FIN', 'Financeiro')
  on conflict (empresa_id, codigo) do nothing;
end $$;

-- Somente o master cria empresas; ja nasce com plano de contas e centros de custo padrao
create or replace function public.criar_empresa(p_cnpj text, p_razao_social text, p_nome_fantasia text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not privado.sou_master() then
    raise exception 'Somente a conta master pode criar empresas';
  end if;
  insert into empresas (cnpj, razao_social, nome_fantasia)
    values (p_cnpj, p_razao_social, p_nome_fantasia) returning id into v_id;
  insert into usuarios_empresas (usuario_id, empresa_id, papel) values (auth.uid(), v_id, 'admin');
  perform privado.copiar_plano_padrao(v_id);
  return v_id;
end $$;

-- Perfis: cada um ve o seu; master ve e altera todos
alter table perfis enable row level security;
create policy perfis_leitura on perfis for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.sou_master()));
create policy perfis_master on perfis for update to authenticated
  using ((select privado.sou_master())) with check ((select privado.sou_master()));

create policy usuarios_empresas_master on usuarios_empresas for all to authenticated
  using ((select privado.sou_master())) with check ((select privado.sou_master()));

alter table usuarios_predios enable row level security;
create policy usuarios_predios_leitura on usuarios_predios for select to authenticated
  using (usuario_id = (select auth.uid()) or (select privado.sou_master()));
create policy usuarios_predios_master on usuarios_predios for all to authenticated
  using ((select privado.sou_master())) with check ((select privado.sou_master()));

-- Perfil de quem ja existir em auth.users (caso o master tenha se cadastrado antes)
insert into perfis (usuario_id, email, nome, master)
select id, email, split_part(email, '@', 1), lower(email) = 'evaldoalves561@gmail.com' from auth.users
on conflict (usuario_id) do nothing;

-- Papel "leitura" so consulta; "admin" e "financeiro" podem gravar (politicas restritivas, somadas as existentes)
create or replace function privado.pode_editar(p_empresa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.sou_master() or exists (
    select 1 from public.usuarios_empresas ue join public.perfis p on p.usuario_id = ue.usuario_id and p.ativo
     where ue.usuario_id = (select auth.uid()) and ue.empresa_id = p_empresa and ue.papel in ('admin', 'financeiro'))
$$;

-- Restricao por predio: se o usuario tem predios definidos para a empresa, so ve esses
create or replace function privado.predio_permitido(p_predio uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_predio is null or privado.sou_master() or exists (
    select 1 from public.usuarios_predios up where up.usuario_id = (select auth.uid()) and up.predio_id = p_predio)
  or not exists (
    select 1 from public.usuarios_predios up join public.predios pr on pr.id = up.predio_id
     where up.usuario_id = (select auth.uid())
       and pr.empresa_id = (select empresa_id from public.predios where id = p_predio))
$$;

revoke execute on function privado.pode_editar(uuid) from public, anon;
revoke execute on function privado.predio_permitido(uuid) from public, anon;
grant execute on function privado.pode_editar(uuid) to authenticated;
grant execute on function privado.predio_permitido(uuid) to authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'plano_contas','centros_custo','premissas_conta','parceiros','produtos',
    'orcamento_versoes','orcamento_linhas','orcamento_caixa',
    'notas_fiscais','nf_itens','nf_duplicatas','lancamentos','parcelas','estoque_movimentos',
    'predios','contas_bancarias','extratos','extrato_linhas','importacoes'
  ] loop
    execute format('create policy %I on %I as restrictive for insert to authenticated with check ((select privado.pode_editar(empresa_id)))', t || '_grava', t);
    execute format('create policy %I on %I as restrictive for update to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_altera', t);
    execute format('create policy %I on %I as restrictive for delete to authenticated using ((select privado.pode_editar(empresa_id)))', t || '_apaga', t);
  end loop;
  foreach t in array array['lancamentos','notas_fiscais','estoque_movimentos','contas_bancarias','orcamento_linhas'] loop
    execute format('create policy %I on %I as restrictive for select to authenticated using (privado.predio_permitido(predio_id))', t || '_por_predio', t);
  end loop;
end $$;

create policy predios_por_predio on predios as restrictive for select to authenticated using (privado.predio_permitido(id));
