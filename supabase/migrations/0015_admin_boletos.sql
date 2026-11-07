-- Administração do app e diagnóstico dos boletos do Gmail.
--  1. app_config: parâmetros que a conta master ajusta pela tela Administração
--     (nome do app, aviso para todos, telas escondidas, formas de pagamento...), sem mexer no HTML.
--  2. app_config_hist: quem mudou o quê e quando.
--  3. boletos_email_token: o script do Gmail avisa a cada execução (mesmo sem boleto novo),
--     informa a versão e lê os ajustes de busca feitos no app.
--  4. boletos_email: guarda o link do boleto quando ele vem em link e não em PDF;
--     remetentes marcados como "ignorar sempre" já entram como ignorados.

-- ---------- 1. parâmetros do app
create table if not exists public.app_config (
  chave         text primary key check (chave ~ '^[a-z0-9_.]{2,60}$'),
  valor         jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid() references auth.users(id) on delete set null
);
alter table public.app_config enable row level security;
-- todo usuário logado lê (o app precisa do nome, do aviso e das telas escondidas)
create policy app_config_leitura on public.app_config for select to authenticated using (true);
-- só a conta master altera
create policy app_config_master_ins on public.app_config for insert to authenticated with check ((select privado.sou_master()));
create policy app_config_master_upd on public.app_config for update to authenticated
  using ((select privado.sou_master())) with check ((select privado.sou_master()));
create policy app_config_master_del on public.app_config for delete to authenticated using ((select privado.sou_master()));
grant select, insert, update, delete on public.app_config to authenticated;

-- ---------- 2. histórico de alterações
create table if not exists public.app_config_hist (
  id         bigint generated always as identity primary key,
  chave      text not null,
  antes      jsonb,
  depois     jsonb,
  usuario_id uuid,
  usuario    text,
  quando     timestamptz not null default now()
);
create index if not exists app_config_hist_quando_idx on public.app_config_hist (quando desc);
alter table public.app_config_hist enable row level security;
create policy app_config_hist_master on public.app_config_hist for select to authenticated using ((select privado.sou_master()));
grant select on public.app_config_hist to authenticated;

create or replace function privado.app_config_registra() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.valor is not distinct from old.valor then return new; end if;
  insert into app_config_hist (chave, antes, depois, usuario_id, usuario)
  values (coalesce(new.chave, old.chave),
          case when tg_op = 'INSERT' then null else old.valor end,
          case when tg_op = 'DELETE' then null else new.valor end,
          auth.uid(),
          (select coalesce(nome, email) from perfis where usuario_id = auth.uid()));
  if tg_op = 'DELETE' then return old; end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;
drop trigger if exists app_config_hist_trg on public.app_config;
create trigger app_config_hist_trg before insert or update or delete on public.app_config
  for each row execute function privado.app_config_registra();

-- ---------- 3. diagnóstico e ajustes da busca no Gmail
alter table public.boletos_email_token
  add column if not exists ultima_execucao timestamptz,
  add column if not exists ultimo_resumo   jsonb,
  add column if not exists config          jsonb not null default '{}'::jsonb;

-- Chamado pelo script no começo e no fim de cada execução. Devolve os ajustes de busca do app.
create or replace function public.registrar_leitura_boletos(p_token uuid, p_resumo jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cfg jsonb;
begin
  update boletos_email_token
     set ultima_execucao = now(),
         ultimo_resumo = case when p_resumo is null then ultimo_resumo
                              else jsonb_strip_nulls(p_resumo) - 'token' end
   where token = p_token
  returning config into v_cfg;
  if not found then raise exception 'código de integração inválido'; end if;
  return coalesce(v_cfg, '{}'::jsonb);
end $$;
revoke execute on function public.registrar_leitura_boletos(uuid, jsonb) from public;
grant execute on function public.registrar_leitura_boletos(uuid, jsonb) to anon, authenticated;

-- ---------- 4. link do boleto e remetentes ignorados
alter table public.boletos_email
  add column if not exists link text check (link is null or (length(link) <= 600 and link ~ '^https?://'));

create or replace function public.receber_boleto_email(p_token uuid, p_dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_emp   uuid;
  v_cfg   jsonb;
  v_linha text := nullif(regexp_replace(coalesce(p_dados->>'linha_digitavel', ''), '\D', '', 'g'), '');
  v_chave text;
  v_rem   text := lower(coalesce(p_dados->>'remetente', ''));
  v_status text := 'novo';
  v_link  text := nullif(left(coalesce(p_dados->>'link', ''), 600), '');
  v_n     int;
begin
  select empresa_id, config into v_emp, v_cfg from boletos_email_token where token = p_token;
  if v_emp is null then raise exception 'código de integração inválido'; end if;
  update boletos_email_token set ultimo_uso = now() where empresa_id = v_emp;
  if v_linha is not null and length(v_linha) not between 44 and 48 then v_linha := null; end if;
  if v_link is not null and v_link !~ '^https?://' then v_link := null; end if;
  -- remetente marcado no app como "ignorar sempre"
  if exists (select 1 from jsonb_array_elements_text(coalesce(v_cfg->'ignorar_remetentes', '[]'::jsonb)) r
             where length(r) > 2 and position(lower(r) in v_rem) > 0) then
    v_status := 'ignorado';
  end if;
  v_chave := coalesce(v_linha, 'msg:' || left(coalesce(p_dados->>'gmail_id', ''), 100) || ':' || left(coalesce(p_dados->>'anexo', ''), 200));
  insert into boletos_email (empresa_id, chave, gmail_id, remetente, assunto, recebido_em, anexo, linha_digitavel,
                             valor, vencimento, beneficiario, documento_beneficiario, observacao, link, status)
  values (v_emp, v_chave, left(p_dados->>'gmail_id', 100), left(p_dados->>'remetente', 300), left(p_dados->>'assunto', 500),
          (p_dados->>'recebido_em')::timestamptz, left(p_dados->>'anexo', 300), v_linha,
          nullif(p_dados->>'valor', '')::numeric, nullif(p_dados->>'vencimento', '')::date,
          left(p_dados->>'beneficiario', 200), nullif(left(regexp_replace(coalesce(p_dados->>'documento_beneficiario', ''), '\D', '', 'g'), 20), ''),
          left(p_dados->>'observacao', 500), v_link, v_status)
  on conflict (empresa_id, chave) do update
    -- o mesmo boleto lido de novo completa o que faltava (ex.: valor ou beneficiário que não veio da primeira vez)
    set valor = coalesce(boletos_email.valor, excluded.valor),
        vencimento = coalesce(boletos_email.vencimento, excluded.vencimento),
        beneficiario = coalesce(boletos_email.beneficiario, excluded.beneficiario),
        documento_beneficiario = coalesce(boletos_email.documento_beneficiario, excluded.documento_beneficiario),
        link = coalesce(boletos_email.link, excluded.link)
    where boletos_email.valor is null or boletos_email.vencimento is null
       or boletos_email.beneficiario is null or boletos_email.documento_beneficiario is null;
  get diagnostics v_n = row_count;
  if v_n > 0 and not exists (select 1 from boletos_email where empresa_id = v_emp and chave = v_chave and criado_em < now()) then
    return case when v_status = 'ignorado' then 'ignorado' else 'novo' end;
  end if;
  return 'repetido';
end $$;
revoke execute on function public.receber_boleto_email(uuid, jsonb) from public;
grant execute on function public.receber_boleto_email(uuid, jsonb) to anon, authenticated;
