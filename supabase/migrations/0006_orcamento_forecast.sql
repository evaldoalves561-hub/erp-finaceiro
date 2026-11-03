-- Orçamento travado e forecast: tipo da versão, mês de corte do forecast e trava definitiva.

alter table orcamento_versoes add column if not exists tipo text not null default 'orcamento'
  check (tipo in ('orcamento', 'forecast'));
alter table orcamento_versoes add column if not exists mes_corte int check (mes_corte between 1 and 12); -- forecast: realizado até este mês
alter table orcamento_versoes add column if not exists observacao text;

create index if not exists idx_orc_linhas_versao_comp on orcamento_linhas (versao_id, competencia);
create index if not exists idx_orc_caixa_versao_data on orcamento_caixa (versao_id, data_caixa);

-- Versão travada não pode ser destravada, alterada nem apagada
create or replace function privado.protege_versao_travada() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.congelada then
    raise exception 'Versao travada (espelho) nao pode ser alterada nem apagada';
  end if;
  if tg_op = 'UPDATE' and new.congelada then
    new.congelada_em := now();
  end if;
  return coalesce(new, old);
end $$;

create trigger trg_protege_versao_travada before update or delete on orcamento_versoes
  for each row execute function privado.protege_versao_travada();
