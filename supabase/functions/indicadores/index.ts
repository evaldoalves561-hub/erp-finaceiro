// Indicadores do Banco Central (SGS): Selic meta (432), IGP-M mensal (189) e dólar PTAX venda (1).
// Busca no servidor para evitar bloqueio de CORS no navegador. Resposta em cache por 6 horas.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

let cache: { t: number; d: unknown } | null = null;

async function serie(codigo: number, n: number): Promise<{ data: string; valor: string }[]> {
  const r = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/${n}?formato=json`,
    { headers: { accept: "application/json" } },
  );
  if (!r.ok) throw new Error(`SGS ${codigo}: HTTP ${r.status}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (!cache || Date.now() - cache.t > 6 * 3600e3) {
      const [s, i, d] = await Promise.all([serie(432, 1), serie(189, 12), serie(1, 2)]);
      const acum12 = (i.reduce((a, x) => a * (1 + Number(x.valor) / 100), 1) - 1) * 100;
      const ult = d[d.length - 1];
      cache = {
        t: Date.now(),
        d: {
          selic: { valor: Number(s[0].valor), data: s[0].data },
          igpm: { mes: Number(i[i.length - 1].valor), acum12, data: i[i.length - 1].data },
          dolar: {
            valor: Number(ult.valor),
            var: d.length > 1 ? (Number(ult.valor) / Number(d[0].valor) - 1) * 100 : 0,
            data: ult.data,
          },
          atualizado_em: new Date().toISOString(),
        },
      };
    }
    return new Response(JSON.stringify(cache.d), {
      headers: { ...cors, "content-type": "application/json", "cache-control": "max-age=21600" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String((e as Error).message || e) }), {
      status: 502,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
