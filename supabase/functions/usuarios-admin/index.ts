// Administração de usuários: só a conta master pode listar, convidar e alterar acessos.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Acesso = { empresas?: string[]; predios?: string[]; papel?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const quem = createClient(url, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await quem.auth.getUser();
    if (!user) return json({ erro: "Faça login novamente." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: eu } = await admin.from("perfis").select("master, ativo").eq("usuario_id", user.id).single();
    if (!eu?.master || !eu.ativo) return json({ erro: "Somente a conta master administra usuários." }, 403);

    const body = await req.json();

    const gravarAcessos = async (usuarioId: string, a: Acesso) => {
      await admin.from("usuarios_empresas").delete().eq("usuario_id", usuarioId);
      await admin.from("usuarios_predios").delete().eq("usuario_id", usuarioId);
      const papel = a.papel ?? "leitura";
      if (a.empresas?.length) {
        const { error } = await admin.from("usuarios_empresas").insert(a.empresas.map((e) => ({ usuario_id: usuarioId, empresa_id: e, papel })));
        if (error) throw error;
      }
      if (a.predios?.length) {
        const { error } = await admin.from("usuarios_predios").insert(a.predios.map((p) => ({ usuario_id: usuarioId, predio_id: p })));
        if (error) throw error;
      }
    };

    switch (body.acao) {
      case "listar": {
        const [{ data: perfis }, { data: ue }, { data: up }, lista] = await Promise.all([
          admin.from("perfis").select("*").order("criado_em"),
          admin.from("usuarios_empresas").select("*"),
          admin.from("usuarios_predios").select("*"),
          admin.auth.admin.listUsers({ perPage: 1000 }),
        ]);
        const auth = new Map(lista.data.users.map((u) => [u.id, u]));
        return json({
          usuarios: (perfis ?? []).map((p) => {
            const u = auth.get(p.usuario_id);
            return {
              ...p,
              ultimo_acesso: u?.last_sign_in_at ?? null,
              convite_aceito: !!u?.email_confirmed_at || !!u?.last_sign_in_at,
              empresas: (ue ?? []).filter((x) => x.usuario_id === p.usuario_id).map((x) => x.empresa_id),
              papel: (ue ?? []).find((x) => x.usuario_id === p.usuario_id)?.papel ?? "leitura",
              predios: (up ?? []).filter((x) => x.usuario_id === p.usuario_id).map((x) => x.predio_id),
            };
          }),
        });
      }
      case "convidar": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido." }, 400);
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { nome: body.nome }, redirectTo: body.redirectTo });
        if (error) return json({ erro: error.message.includes("already") ? "Este e-mail já tem cadastro." : error.message }, 400);
        if (body.nome) await admin.from("perfis").update({ nome: body.nome }).eq("usuario_id", data.user.id);
        await gravarAcessos(data.user.id, body);
        return json({ ok: true, usuario_id: data.user.id });
      }
      case "atualizar": {
        const id = String(body.usuario_id);
        if (id === user.id && body.ativo === false) return json({ erro: "Você não pode desativar a própria conta master." }, 400);
        await admin.from("perfis").update({ nome: body.nome, ativo: body.ativo }).eq("usuario_id", id);
        await admin.auth.admin.updateUserById(id, { ban_duration: body.ativo === false ? "876000h" : "none" });
        if (id !== user.id) await gravarAcessos(id, body);
        return json({ ok: true });
      }
      case "reenviar": {
        const { error } = await admin.auth.resetPasswordForEmail(String(body.email), { redirectTo: body.redirectTo });
        if (error) return json({ erro: error.message }, 400);
        return json({ ok: true });
      }
      default:
        return json({ erro: "Ação desconhecida." }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
