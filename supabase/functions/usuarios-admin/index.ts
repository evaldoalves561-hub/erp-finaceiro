// Administração de usuários em dois níveis:
//  * conta master: vê e administra todos os usuários de todas as empresas;
//  * administrador da empresa (papel "admin"): convida e gerencia só os usuários das empresas que administra,
//    organizados por departamento. Não enxerga nem altera a equipe master nem o acesso a outras empresas.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PAPEIS = ["admin", "financeiro", "rh", "leitura"];
type AcessoEmp = { empresa_id: string; papel?: string; departamento_id?: string | null; predios?: string[] };
type Corpo = { acessos?: AcessoEmp[]; empresas?: string[]; predios?: string[]; papel?: string };

// aceita o formato novo (acessos por empresa) e o antigo (lista de empresas com um papel só)
function lerAcessos(b: Corpo): AcessoEmp[] {
  if (Array.isArray(b.acessos)) return b.acessos;
  return (b.empresas ?? []).map((e) => ({ empresa_id: e, papel: b.papel, predios: b.predios ?? [] }));
}

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
    if (!eu?.ativo) return json({ erro: "Seu acesso está desativado." }, 403);
    const master = !!eu.master;

    // empresas que esta pessoa administra
    let escopo: string[];
    if (master) {
      const { data } = await admin.from("empresas").select("id");
      escopo = (data ?? []).map((e) => e.id);
    } else {
      const { data } = await admin.from("usuarios_empresas").select("empresa_id").eq("usuario_id", user.id).eq("papel", "admin");
      escopo = (data ?? []).map((e) => e.empresa_id);
      if (!escopo.length) return json({ erro: "Somente a conta master ou o administrador da empresa gerencia usuários." }, 403);
    }
    const noEscopo = new Set(escopo);

    const [{ data: preds }, { data: deps }] = await Promise.all([
      admin.from("predios").select("id, empresa_id").in("empresa_id", escopo),
      admin.from("departamentos").select("id, empresa_id").in("empresa_id", escopo),
    ]);
    const predioEmp = new Map((preds ?? []).map((p) => [p.id, p.empresa_id]));
    const deptoEmp = new Map((deps ?? []).map((d) => [d.id, d.empresa_id]));

    const body = await req.json();

    // vínculos de uma pessoa com empresas do escopo
    const vinculos = async (usuarioId: string) => {
      const { data } = await admin.from("usuarios_empresas").select("empresa_id").eq("usuario_id", usuarioId);
      return (data ?? []).map((x) => x.empresa_id as string);
    };
    // o administrador da empresa só mexe em quem já está numa empresa dele e não é master
    const podeMexer = async (usuarioId: string) => {
      if (master) return true;
      const { data: p } = await admin.from("perfis").select("master").eq("usuario_id", usuarioId).maybeSingle();
      if (!p || p.master) return false;
      return (await vinculos(usuarioId)).some((e) => noEscopo.has(e));
    };

    // regrava os acessos só nas empresas do escopo; acessos a outras empresas ficam como estão
    const gravarAcessos = async (usuarioId: string, lista: AcessoEmp[]) => {
      const validos = lista.filter((a) => noEscopo.has(a.empresa_id));
      for (const a of validos) {
        if (a.papel && !PAPEIS.includes(a.papel)) throw new Error("Papel inválido.");
        if (a.departamento_id && deptoEmp.get(a.departamento_id) !== a.empresa_id) throw new Error("Departamento não pertence à empresa.");
        for (const p of a.predios ?? []) if (predioEmp.get(p) !== a.empresa_id) throw new Error("Unidade não pertence à empresa.");
      }
      const { error: e1 } = await admin.from("usuarios_empresas").delete().eq("usuario_id", usuarioId).in("empresa_id", escopo);
      if (e1) throw e1;
      const idsPred = [...predioEmp.keys()];
      if (idsPred.length) {
        const { error: e2 } = await admin.from("usuarios_predios").delete().eq("usuario_id", usuarioId).in("predio_id", idsPred);
        if (e2) throw e2;
      }
      if (validos.length) {
        const { error } = await admin.from("usuarios_empresas").insert(validos.map((a) => ({
          usuario_id: usuarioId, empresa_id: a.empresa_id, papel: a.papel ?? "leitura", departamento_id: a.departamento_id || null,
        })));
        if (error) throw error;
      }
      const up = validos.flatMap((a) => (a.predios ?? []).map((p) => ({ usuario_id: usuarioId, predio_id: p })));
      if (up.length) {
        const { error } = await admin.from("usuarios_predios").insert(up);
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
        const usuarios = (perfis ?? [])
          .map((p) => {
            const meus = (ue ?? []).filter((x) => x.usuario_id === p.usuario_id && noEscopo.has(x.empresa_id));
            const u = auth.get(p.usuario_id);
            const acessos = meus.map((x) => ({
              empresa_id: x.empresa_id,
              papel: x.papel,
              departamento_id: x.departamento_id ?? null,
              predios: (up ?? []).filter((y) => y.usuario_id === p.usuario_id && predioEmp.get(y.predio_id) === x.empresa_id).map((y) => y.predio_id),
            }));
            const todas = (ue ?? []).filter((x) => x.usuario_id === p.usuario_id).length;
            return {
              ...p,
              ultimo_acesso: u?.last_sign_in_at ?? null,
              convite_aceito: !!u?.email_confirmed_at || !!u?.last_sign_in_at,
              acessos,
              outras_empresas: todas - meus.length, // acessos fora do seu escopo (só a quantidade)
              // formato antigo, mantido para compatibilidade
              empresas: acessos.map((a) => a.empresa_id),
              papel: acessos[0]?.papel ?? "leitura",
              predios: acessos.flatMap((a) => a.predios),
            };
          })
          .filter((u) => master || (!u.master && u.acessos.length));
        return json({ usuarios, master, escopo });
      }
      case "convidar": {
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ erro: "E-mail inválido." }, 400);
        const acessos = lerAcessos(body).filter((a) => noEscopo.has(a.empresa_id));
        if (!acessos.length) return json({ erro: "Escolha pelo menos uma empresa que você administra." }, 400);

        // já tem cadastro (ex.: usa o app em outra empresa): só acrescenta o acesso
        const { data: existente } = await admin.from("perfis").select("usuario_id, master").eq("email", email).maybeSingle();
        if (existente) {
          if (existente.master) return json({ erro: "Este e-mail é da equipe master." }, 400);
          const atuais = await vinculos(existente.usuario_id);
          const outros = atuais.filter((e) => !noEscopo.has(e));
          if (atuais.some((e) => noEscopo.has(e))) return json({ erro: "Esta pessoa já tem acesso. Use Editar." }, 400);
          await gravarAcessos(existente.usuario_id, acessos);
          return json({ ok: true, usuario_id: existente.usuario_id, existente: true, outras_empresas: outros.length });
        }

        // libera o e-mail no gatilho "somente por convite" antes de criar o usuário
        const { error: eConv } = await admin.from("convites_pendentes").upsert({ email });
        if (eConv) return json({ erro: eConv.message }, 500);
        let novo = await admin.auth.admin.inviteUserByEmail(email, { data: { nome: body.nome }, redirectTo: body.redirectTo });
        let link: string | null = null;
        if (novo.error && /already|registered|exists/i.test(novo.error.message)) return json({ erro: "Este e-mail já tem cadastro." }, 400);
        if (novo.error) {
          // E-mail não saiu (ex.: SMTP padrão do Supabase só envia para a equipe): gera o link para enviar por WhatsApp
          let g = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { nome: body.nome }, redirectTo: body.redirectTo } });
          if (g.error) g = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: body.redirectTo } });
          if (g.error) return json({ erro: g.error.message }, 400);
          novo = { data: { user: g.data.user }, error: null } as typeof novo;
          link = g.data.properties?.action_link ?? null;
        }
        const uid = novo.data.user!.id;
        if (body.nome) await admin.from("perfis").update({ nome: body.nome }).eq("usuario_id", uid);
        await gravarAcessos(uid, acessos);
        return json({ ok: true, usuario_id: uid, link, email_enviado: !link });
      }
      case "atualizar": {
        const id = String(body.usuario_id);
        if (!(await podeMexer(id))) return json({ erro: "Você não administra este usuário." }, 403);
        if (id === user.id && body.ativo === false) return json({ erro: "Você não pode desativar a própria conta." }, 400);
        if (body.ativo === false && !master) {
          const fora = (await vinculos(id)).filter((e) => !noEscopo.has(e));
          if (fora.length) return json({ erro: "Esta pessoa também usa o app em outra empresa. Para tirar o acesso só da sua, desmarque a empresa." }, 400);
        }
        const mud: Record<string, unknown> = {};
        if (body.nome) mud.nome = body.nome;
        if (typeof body.ativo === "boolean") mud.ativo = body.ativo;
        if (Object.keys(mud).length) await admin.from("perfis").update(mud).eq("usuario_id", id);
        if (typeof body.ativo === "boolean") await admin.auth.admin.updateUserById(id, { ban_duration: body.ativo === false ? "876000h" : "none" });
        // ninguém altera o próprio acesso (evita o administrador tirar o próprio papel sem querer)
        if (id !== user.id) await gravarAcessos(id, lerAcessos(body));
        return json({ ok: true });
      }
      case "link": {
        // Link de acesso para enviar por mensagem: convite se ainda não entrou, senão redefinição de senha
        const email = String(body.email ?? "").trim().toLowerCase();
        const { data: p } = await admin.from("perfis").select("usuario_id").eq("email", email).maybeSingle();
        if (!p || !(await podeMexer(p.usuario_id))) return json({ erro: "Você não administra este usuário." }, 403);
        let g = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: body.redirectTo } });
        if (g.error) g = await admin.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo: body.redirectTo } });
        if (g.error) return json({ erro: g.error.message }, 400);
        return json({ ok: true, link: g.data.properties?.action_link });
      }
      case "reenviar": {
        const email = String(body.email ?? "").trim().toLowerCase();
        const { data: p } = await admin.from("perfis").select("usuario_id").eq("email", email).maybeSingle();
        if (!p || !(await podeMexer(p.usuario_id))) return json({ erro: "Você não administra este usuário." }, 403);
        const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo: body.redirectTo });
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
