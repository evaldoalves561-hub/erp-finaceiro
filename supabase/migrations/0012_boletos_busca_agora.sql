-- Botão "Buscar boletos agora": o script do Gmail, publicado como app da web,
-- registra aqui o próprio endereço para o app poder chamá-lo na hora.
alter table public.boletos_email_token
  add column if not exists url_busca text check (url_busca ~ '^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$');

create or replace function public.registrar_busca_boletos(p_token uuid, p_url text)
returns text language plpgsql security definer set search_path = public as $$
begin
  update boletos_email_token set url_busca = p_url, ultimo_uso = now() where token = p_token;
  if not found then raise exception 'código de integração inválido'; end if;
  return 'ok';
end $$;
revoke execute on function public.registrar_busca_boletos(uuid, text) from public;
grant execute on function public.registrar_busca_boletos(uuid, text) to anon, authenticated;
