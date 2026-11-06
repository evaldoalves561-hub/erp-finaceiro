-- Boletos que chegam por e-mail (Gmail).
-- Um script do Google (Apps Script) roda na conta Gmail do usuário, acha os boletos
-- e manda para cá pela função receber_boleto_email, usando um código secreto por empresa.
-- No app, cada boleto fica em "Boletos do e-mail" até alguém lançar como conta a pagar ou ignorar.

create table if not exists public.boletos_email_token (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  token      uuid not null unique default gen_random_uuid(),
  criado_em  timestamptz not null default now(),
  ultimo_uso timestamptz
);
alter table public.boletos_email_token enable row level security;
create policy boletos_token_editor on public.boletos_email_token for all to authenticated
  using ((select privado.pode_editar(empresa_id))) with check ((select privado.pode_editar(empresa_id)));
grant select, insert, update, delete on public.boletos_email_token to authenticated;

create table if not exists public.boletos_email (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete cascade,
  chave           text not null,           -- linha digitável (só dígitos) ou id da mensagem, evita duplicar
  gmail_id        text,
  remetente       text check (length(remetente) <= 300),
  assunto         text check (length(assunto) <= 500),
  recebido_em     timestamptz,
  anexo           text check (length(anexo) <= 300),
  linha_digitavel text check (linha_digitavel ~ '^[0-9]{44,48}$'),
  valor           numeric(14,2),
  vencimento      date,
  beneficiario    text check (length(beneficiario) <= 200),
  documento_beneficiario text check (length(documento_beneficiario) <= 20),
  observacao      text check (length(observacao) <= 500),
  status          text not null default 'novo' check (status in ('novo', 'lancado', 'ignorado')),
  lancamento_id   uuid references public.lancamentos(id) on delete set null,
  criado_em       timestamptz not null default now(),
  unique (empresa_id, chave)
);
create index if not exists boletos_email_status_idx on public.boletos_email (empresa_id, status);
alter table public.boletos_email enable row level security;
create policy boletos_email_leitura on public.boletos_email for select to authenticated
  using (empresa_id in (select privado.minhas_empresas()));
create policy boletos_email_altera on public.boletos_email for update to authenticated
  using ((select privado.pode_editar(empresa_id))) with check ((select privado.pode_editar(empresa_id)));
create policy boletos_email_apaga on public.boletos_email for delete to authenticated
  using ((select privado.pode_editar(empresa_id)));
grant select, update, delete on public.boletos_email to authenticated;

-- Porta de entrada do script do Gmail. Só grava com um código válido.
create or replace function public.receber_boleto_email(p_token uuid, p_dados jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_emp   uuid;
  v_linha text := nullif(regexp_replace(coalesce(p_dados->>'linha_digitavel', ''), '\D', '', 'g'), '');
  v_chave text;
  v_n     int;
begin
  select empresa_id into v_emp from boletos_email_token where token = p_token;
  if v_emp is null then raise exception 'código de integração inválido'; end if;
  update boletos_email_token set ultimo_uso = now() where empresa_id = v_emp;
  if v_linha is not null and length(v_linha) not between 44 and 48 then v_linha := null; end if;
  v_chave := coalesce(v_linha, 'msg:' || left(coalesce(p_dados->>'gmail_id', ''), 100) || ':' || left(coalesce(p_dados->>'anexo', ''), 200));
  insert into boletos_email (empresa_id, chave, gmail_id, remetente, assunto, recebido_em, anexo, linha_digitavel,
                             valor, vencimento, beneficiario, documento_beneficiario, observacao)
  values (v_emp, v_chave, left(p_dados->>'gmail_id', 100), left(p_dados->>'remetente', 300), left(p_dados->>'assunto', 500),
          (p_dados->>'recebido_em')::timestamptz, left(p_dados->>'anexo', 300), v_linha,
          nullif(p_dados->>'valor', '')::numeric, nullif(p_dados->>'vencimento', '')::date,
          left(p_dados->>'beneficiario', 200), nullif(left(regexp_replace(coalesce(p_dados->>'documento_beneficiario', ''), '\D', '', 'g'), 20), ''),
          left(p_dados->>'observacao', 500))
  on conflict (empresa_id, chave) do nothing;
  get diagnostics v_n = row_count;
  return case when v_n > 0 then 'novo' else 'repetido' end;
end $$;
revoke execute on function public.receber_boleto_email(uuid, jsonb) from public;
grant execute on function public.receber_boleto_email(uuid, jsonb) to anon, authenticated;
