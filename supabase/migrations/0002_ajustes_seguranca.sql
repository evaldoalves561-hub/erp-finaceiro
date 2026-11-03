-- Ajustes apontados pelo verificador do Supabase, sem apagar nada (nao exige confirmacao).
-- 1) public.minhas_empresas passa a delegar para privado.minhas_empresas e deixa de ser chamavel por anonimos
create schema if not exists privado;
grant usage on schema privado to authenticated;
create or replace function privado.minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select empresa_id from public.usuarios_empresas where usuario_id = (select auth.uid())
$$;
revoke execute on function privado.minhas_empresas() from public, anon;
grant execute on function privado.minhas_empresas() to authenticated;

create or replace function public.minhas_empresas() returns setof uuid
language sql stable security definer set search_path = public as $$
  select privado.minhas_empresas()
$$;
revoke execute on function public.minhas_empresas() from public, anon;
grant execute on function public.minhas_empresas() to authenticated;

alter policy usuarios_empresas_proprio on usuarios_empresas using (usuario_id = (select auth.uid()));

-- 2) indices nas chaves estrangeiras
create index if not exists idx_estoque_mov_produto on estoque_movimentos (produto_id);
create index if not exists idx_estoque_mov_nf_item on estoque_movimentos (nf_item_id);
create index if not exists idx_lanc_conta on lancamentos (conta_id);
create index if not exists idx_lanc_cc on lancamentos (centro_custo_id);
create index if not exists idx_lanc_produto on lancamentos (produto_id);
create index if not exists idx_lanc_parceiro on lancamentos (parceiro_id);
create index if not exists idx_lanc_nf on lancamentos (nf_id);
create index if not exists idx_nf_dup_nf on nf_duplicatas (nf_id);
create index if not exists idx_nf_itens_nf on nf_itens (nf_id);
create index if not exists idx_nf_itens_produto on nf_itens (produto_id);
create index if not exists idx_nf_emitente on notas_fiscais (emitente_id);
create index if not exists idx_orc_caixa_versao on orcamento_caixa (versao_id);
create index if not exists idx_orc_caixa_linha on orcamento_caixa (linha_id);
create index if not exists idx_orc_caixa_conta on orcamento_caixa (conta_id);
create index if not exists idx_orc_linhas_versao on orcamento_linhas (versao_id);
create index if not exists idx_orc_linhas_conta on orcamento_linhas (conta_id);
create index if not exists idx_orc_linhas_cc on orcamento_linhas (centro_custo_id);
create index if not exists idx_orc_linhas_produto on orcamento_linhas (produto_id);
create index if not exists idx_orc_versoes_origem on orcamento_versoes (origem_id);
create index if not exists idx_parceiros_conta on parceiros (conta_padrao_id);
create index if not exists idx_parcelas_lanc on parcelas (lancamento_id);
create index if not exists idx_plano_pai on plano_contas (conta_pai);
create index if not exists idx_premissas_conta on premissas_conta (conta_id);
create index if not exists idx_produtos_receita on produtos (conta_receita_id);
create index if not exists idx_produtos_custo on produtos (conta_custo_id);
create index if not exists idx_usuarios_empresas_emp on usuarios_empresas (empresa_id);
