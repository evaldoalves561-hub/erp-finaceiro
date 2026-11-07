// ===================== Esteira de compras e estoque (módulo separado do index.html)
// Pedido -> Confirmação -> Cotação -> Aprovação (verba do orçamento travado) -> Compra (contas a pagar)
// -> Acompanhamento de entrega -> Entrada no estoque.
(()=>{
if(typeof S==='undefined'||typeof ROTAS==='undefined')return;

// ---------- ícones e estilos
Object.assign(IC,{
 compras:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h3l2.4 12h11l2-8H7"/>',
 cpedido:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
 cconf:'<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.7 2.7L16 10"/>',
 ccot:'<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7l-2.6 6a3 3 0 0 0 5.2 0zM20 7l-2.6 6a3 3 0 0 0 5.2 0z"/>',
 caprov:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 ccompra:'<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
 centrega:'<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="6" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/>',
 cestoque:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
 cx:'<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
 cverba:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
 cparc:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 15h3"/>',
 calerta:'<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
 crelogio:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
});
document.head.insertAdjacentHTML('beforeend',`<style>
.kb-wrap{overflow-x:auto;margin:0 -4px;padding:0 4px 4px}
.kb{display:grid;grid-template-columns:repeat(6,minmax(158px,1fr));gap:8px;min-width:1000px}
.kb-col{background:var(--surface-2);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0}
.kb-h{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:.05em}
.kb-h span.t{display:flex;align-items:center;gap:6px}
.kb-h .tot{font-family:var(--f-num);font-weight:500;text-transform:none;letter-spacing:0;color:var(--ink-3)}
.kb-n{font-family:var(--f-num);font-size:11px;background:var(--surface);border-radius:9px;padding:0 7px;color:var(--ink)}
.kc{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:4px;cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
.kc:hover{border-color:var(--accent)}
.kc:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.kc .top_{display:flex;justify-content:space-between;gap:6px;align-items:center;font-size:11.5px;color:var(--ink-3)}
.kc b{font-size:13px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}
.kc small{color:var(--ink-2);font-size:11.5px;overflow-wrap:anywhere}
.kc .val{font-family:var(--f-num);font-size:13px;font-variant-numeric:tabular-nums}
.kc .ft{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap}
.kb-vazio{font-size:12px;color:var(--ink-3);text-align:center;padding:14px 4px;border:1px dashed var(--line);border-radius:8px}
.kb-mais{font-size:12px;color:var(--ink-2);text-align:center}
.prog{height:4px;border-radius:2px;background:var(--surface-2);overflow:hidden}.prog i{display:block;height:100%;background:var(--good)}
.stp{display:flex;align-items:flex-start;overflow-x:auto;padding:4px 0 2px}
.stp .s{flex:1 0 74px;display:flex;flex-direction:column;align-items:center;gap:5px;position:relative;font-size:11.5px;color:var(--ink-3);text-align:center}
.stp .s:not(:first-child)::before{content:"";position:absolute;top:15px;right:50%;width:100%;height:2px;background:var(--line);z-index:0}
.stp .s.ok:not(:first-child)::before,.stp .s.cur:not(:first-child)::before{background:var(--good)}
.stp .b{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--surface);border:2px solid var(--line);position:relative;z-index:1}
.stp .s.ok{color:var(--ink-2)}.stp .s.ok .b{background:var(--good);border-color:var(--good);color:#fff}
.stp .s.cur{color:var(--ink);font-weight:700}.stp .s.cur .b{border-color:var(--accent);color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.stp .s.cx .b{border-color:var(--bad);color:var(--bad)}
.meter{display:flex;height:12px;border-radius:6px;overflow:hidden;background:var(--surface-2)}
.meter i{display:block;height:100%}
.meter i+i{box-shadow:-2px 0 0 var(--surface)}
.m-real{background:var(--accent)}.m-comp{background:var(--warn)}.m-esta{background:repeating-linear-gradient(135deg,var(--good) 0 5px,color-mix(in srgb,var(--good) 55%,transparent) 5px 10px)}.m-esta.over{background:repeating-linear-gradient(135deg,var(--bad) 0 5px,color-mix(in srgb,var(--bad) 55%,transparent) 5px 10px)}
.vb{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:10px}
.vb div{background:var(--surface-2);border-radius:7px;padding:7px 9px;min-width:0}.vb small{display:block;font-size:11px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.05em}.vb span{font-family:var(--f-num);font-size:13px}
.box{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.box h4{margin:0;font-size:13.5px;display:flex;align-items:center;gap:8px}
.cmp-sheet{width:min(900px,100%)!important}.cmp-sheet>*{flex-shrink:0}
.cot td.best{background:var(--good-soft);color:var(--good);font-weight:600}
.cot th.cz{white-space:normal;min-width:130px}
.tl{display:flex;flex-direction:column;gap:0;border-left:2px solid var(--line);margin-left:6px;padding-left:14px}
.tl div{position:relative;padding:4px 0 8px;font-size:12.5px}.tl div::before{content:"";position:absolute;left:-20px;top:9px;width:10px;height:10px;border-radius:50%;background:var(--accent);border:2px solid var(--surface)}
.tl small{color:var(--ink-3);display:block}
.it-row{display:grid;grid-template-columns:minmax(0,2.6fr) 70px 60px 100px auto auto;gap:6px;align-items:end}
.it-row .field label{font-size:11px}
.it-row input{padding:7px 8px}
.ck{display:flex;gap:5px;align-items:center;font-size:12px;color:var(--ink-2);padding-bottom:9px;white-space:nowrap}
.btn.sm{padding:4px 10px;font-size:12.5px}.btn.bad{background:var(--bad)}.btn.good{background:var(--good)}
.icbtn{background:none;border:1px solid var(--line);border-radius:6px;width:32px;height:34px;cursor:pointer;color:var(--ink-2);display:grid;place-items:center}
.vbar{display:flex;flex-direction:column;gap:3px;min-width:160px}
.acts-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
@media (max-width:820px){.vb{grid-template-columns:repeat(2,minmax(0,1fr))}.it-row{grid-template-columns:minmax(0,1fr) 70px 60px;}.it-row .vu{grid-column:1/2}.cmp-sheet{width:100%!important}}
</style>`);

// ---------- estado e utilitários
const C={dados:null,estoque:null,produtos:null,verOcultos:false,estEmp:null};
const pv=v=>{if(typeof v==="number")return v;const t=String(v??"").trim();return t?parseCel(t):NaN};
const qtd=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3});
const ETAPAS=[['pedido','Pedido','cpedido'],['confirmado','Confirmado','cconf'],['cotacao','Em cotação','ccot'],['aprovado','Aprovado','caprov'],['comprado','Em entrega','centrega'],['entregue','Entregue','cestoque']];
const ST={pedido:['Pedido','mute'],confirmado:['Confirmado','info'],cotacao:['Em cotação','warn'],aprovado:['Aprovado','good'],comprado:['Em entrega','info'],entregue:['Entregue','good'],cancelado:['Cancelado','bad']};
const PASSOS=[['Pedido','cpedido'],['Confirmação','cconf'],['Cotação','ccot'],['Aprovação','caprov'],['Compra','ccompra'],['Entrega','centrega'],['Estoque','cestoque']];
const numPC=p=>'PC-'+String(p.numero??'').padStart(4,'0');
const quem=()=>S.perfil?.nome||S.user?.email||'';
const chipSt=s=>`<span class="chip ${ST[s][1]}">${ST[s][0]}</span>`;
const tic=(ic,cor)=>`<span class="tic tic-${cor}">${icone(ic,15)}</span>`;
const mesTxt=iso=>iso?MESES[+iso.slice(5,7)-1]+'/'+iso.slice(0,4):'';
const parsePrazos=s=>{const t=String(s||'').trim().toLowerCase();if(!t||/vista/.test(t))return [0];const a=t.split(/[^0-9]+/).filter(Boolean).map(Number);return a.length?a:[0]};
const condTxt=pr=>!pr||!pr.length||(pr.length===1&&!+pr[0])?'À vista':`${pr.length}x · ${pr.join('/')} dias`;
function parcelasDe(total,prazos,base){const pr=prazos&&prazos.length?prazos:[0];const q=pr.length,parte=r2(total/q);return pr.map((d,i)=>({n:i+1,venc:addDias(base,+d),valor:i<q-1?parte:r2(total-parte*(q-1))}))}
const produtoDe=id=>(C.produtos||[]).find(p=>p.id===id);

async function dados(forcar){
  if(forcar||!C.dados)C.dados=Promise.all([
    todos(()=>sb.from('compras_pedidos').select('*').order('numero',{ascending:false})),
    todos(()=>sb.from('compras_itens').select('*').order('ordem')),
    todos(()=>sb.from('compras_cotacoes').select('*').order('criado_em')),
    todos(()=>sb.from('compras_cotacao_itens').select('*')),
    todos(()=>sb.from('compras_eventos').select('*').order('criado_em')),
    todos(()=>sb.from('produtos').select('*').order('nome')),
  ]).then(([ped,itens,cot,cotIt,ev,prod])=>{C.produtos=prod;return {ped,itens,cot,cotIt,ev}}).catch(e=>{C.dados=null;throw e});
  return C.dados;
}
async function estoque(forcar){
  if(forcar||!C.estoque)C.estoque=todos(()=>sb.from('estoque_movimentos').select('*').order('data',{ascending:false})).catch(e=>{C.estoque=null;throw e});
  return C.estoque;
}
function recarregar(){C.dados=null;C.estoque=null}
const itensDe=(D,p)=>D.itens.filter(i=>i.pedido_id===p.id).sort((a,b)=>a.ordem-b.ordem);
const cotsDe=(D,p)=>D.cot.filter(c=>c.pedido_id===p.id);
const estimado=(D,p)=>sum(itensDe(D,p).map(i=>(+i.quantidade)*(+i.valor_estimado||0)));
const valorPed=(D,p)=>p.valor_aprovado!=null?+p.valor_aprovado:estimado(D,p);
const cotDoPed=(D,p)=>D.cot.find(c=>c.id===p.cotacao_id);
const atrasada=p=>p.status==='comprado'&&p.previsao_entrega&&p.previsao_entrega<HOJE;
const recebidoPct=(D,p)=>{const it=itensDe(D,p);const t=sum(it.map(i=>+i.quantidade));return t?sum(it.map(i=>Math.min((+i.qtd_recebida||0),+i.quantidade)))/t:0};
async function evento(p,etapa,descricao){const {error}=await sb.from('compras_eventos').insert({empresa_id:p.empresa_id,pedido_id:p.id,etapa,descricao,usuario:quem()});if(error)throw error}
async function atualiza(p,campos){const {error}=await sb.from('compras_pedidos').update(campos).eq('id',p.id);if(error)throw error}

// ---------- verba do orçamento travado (conta + unidade, mês e acumulado no ano)
async function verba(D,p,valor){
  const ano=+p.competencia.slice(0,4),m=+p.competencia.slice(5,7);
  const vs=(await versoesDe(p.empresa_id)).filter(v=>v.ano===ano&&v.tipo!=='forecast'&&v.congelada).sort((a,b)=>String(b.congelada_em||'').localeCompare(String(a.congelada_em||'')));
  const v=vs[0]||null;
  const esc_=x=>x.empresa_id===p.empresa_id&&x.conta_id===p.conta_id&&(!p.predio_id||!x.predio_id||x.predio_id===p.predio_id);
  const mm=x=>+x.competencia.slice(5,7);
  const o={versao:v,orcMes:0,orcAc:0,orcAno:0,realMes:0,realAc:0,compMes:0,compAc:0,valor};
  if(v)(await linhasDe(v.id)).filter(esc_).forEach(l=>{const x=Math.abs(+l.valor);o.orcAno+=x;if(mm(l)<=m)o.orcAc+=x;if(mm(l)===m)o.orcMes+=x});
  (await lancAno(ano)).filter(esc_).forEach(l=>{const x=-(+l.valor);if(mm(l)<=m)o.realAc+=x;if(mm(l)===m)o.realMes+=x});
  D.ped.filter(q=>q.id!==p.id&&q.status==='aprovado'&&esc_(q)&&+q.competencia.slice(0,4)===ano).forEach(q=>{const x=+q.valor_aprovado||0;if(mm(q)<=m)o.compAc+=x;if(mm(q)===m)o.compMes+=x});
  o.dispMes=r2(o.orcMes-o.realMes-o.compMes);o.dispAc=r2(o.orcAc-o.realAc-o.compAc);
  o.acima=valor>o.dispAc+0.005;
  return o;
}
function verbaHtml(o,p){
  if(!o.versao)return `<div class="msg err">Não há orçamento travado de ${p.competencia.slice(0,4)} para ${esc(nomeEmp(empresa(p.empresa_id)))}. Sem orçamento, a compra só pode ser aprovada com justificativa.</div>`;
  const base=Math.max(o.orcAc,o.realAc+o.compAc+o.valor,1);const w=x=>Math.max(0,x)/base*100;
  return `<div class="meter" role="img" aria-label="Verba acumulada até ${mesTxt(p.competencia)}: orçado ${brl.format(o.orcAc)}, realizado ${brl.format(o.realAc)}, comprometido ${brl.format(o.compAc)}, esta compra ${brl.format(o.valor)}">
      <i class="m-real" style="width:${w(o.realAc)}%" title="Realizado ${brl.format(o.realAc)}"></i><i class="m-comp" style="width:${w(o.compAc)}%" title="Comprometido ${brl.format(o.compAc)}"></i><i class="m-esta ${o.acima?'over':''}" style="width:${w(o.valor)}%" title="Esta compra ${brl.format(o.valor)}"></i></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Realizado</span><span><i style="background:var(--warn)"></i>Outras compras aprovadas</span><span><i style="background:var(--${o.acima?'bad':'good'})"></i>Esta compra</span><span><i style="background:var(--surface-2);border:1px solid var(--line)"></i>Livre</span></div>
    <div class="vb"><div><small>Orçado até ${MESES[+p.competencia.slice(5,7)-1]}</small><span>${brl.format(o.orcAc)}</span></div><div><small>Realizado</small><span>${brl.format(o.realAc)}</span></div><div><small>Comprometido</small><span>${brl.format(o.compAc)}</span></div><div><small>Disponível</small><span style="color:var(--${o.dispAc<0?'bad':'ink'})">${brl.format(o.dispAc)}</span></div></div>
    <p class="muted" style="margin:0;font-size:12px">Só ${mesTxt(p.competencia)}: orçado ${brl.format(o.orcMes)}, disponível ${brl.format(o.dispMes)}. Orçamento do ano na conta: ${brl.format(o.orcAno)} (${esc(o.versao.nome)}, travado).</p>`;
}
function parcelasHtml(ps,titulo){return `<div class="tbl-wrap"><table><thead><tr><th>${titulo||'Parcela'}</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${ps.map(x=>`<tr><td>${x.n}/${ps.length}</td><td>${dataBR(x.venc)}</td><td class="n">${brl2.format(x.valor)}</td></tr>`).join('')}<tr class="tot"><td colspan="2">Total</td><td class="n">${brl2.format(sum(ps.map(x=>x.valor)))}</td></tr></tbody></table></div>`}

// ---------- tela: esteira de compras
async function vCompras(){
  const D=await dados();
  const ped=D.ped.filter(p=>naSel(p.empresa_id,p.predio_id));
  const ativos=ped.filter(p=>p.status!=='cancelado');
  const por=s=>ativos.filter(p=>p.status===s);
  const valorDe=ps=>sum(ps.map(p=>valorPed(D,p)));
  const abertos=ativos.filter(p=>['pedido','confirmado','cotacao'].includes(p.status));
  const aguard=por('cotacao').filter(p=>cotsDe(D,p).length);
  const atras=por('comprado').filter(atrasada);
  const mesAtual=HOJE.slice(0,7);
  const entMes=por('entregue').filter(p=>(p.entregue_em||'').startsWith(mesAtual));
  const tiles=[
    ['Pedidos em andamento',String(abertos.length),`<span class="chip mute">${k(valorDe(abertos))} estimado</span>`,'cpedido','accent'],
    ['Aguardando aprovação',String(aguard.length),aguard.length?`<span class="chip warn">${k(valorDe(aguard.map(p=>({...p,valor_aprovado:Math.min(...cotsDe(D,p).map(c=>+c.total))}))))}</span>`:'<span class="chip good">em dia</span>','caprov','warn'],
    ['Verba reservada',k(valorDe(por('aprovado'))),`<span class="chip info">${por('aprovado').length} aprovada${por('aprovado').length===1?'':'s'} a comprar</span>`,'cverba','accent'],
    ['Em entrega',String(por('comprado').length),atras.length?`<span class="chip bad">${atras.length} atrasada${atras.length>1?'s':''}</span>`:'<span class="chip good">no prazo</span>','centrega','accent'],
    ['Recebido no mês',k(valorDe(entMes)),`<span class="chip good">${entMes.length} entrega${entMes.length===1?'':'s'}</span>`,'cestoque','good'],
  ];
  const card=p=>{const e=empresa(p.empresa_id),pr=predio(p.predio_id);const nC=cotsDe(D,p).length;const pc=p.status==='comprado'?recebidoPct(D,p):0;
    const venc=p.status==='comprado'?(p.previsao_entrega?`<span class="chip ${atrasada(p)?'bad':'mute'}">${atrasada(p)?'atrasada · ':'entrega '}${dataBR(p.previsao_entrega)}</span>`:''):
      p.status==='entregue'?`<span class="chip good">${dataBR(p.entregue_em)}</span>`:p.necessidade?`<span class="chip ${p.necessidade<HOJE?'bad':'mute'}">precisa ${dataBR(p.necessidade)}</span>`:'';
    return `<button class="kc" data-pc="${p.id}"><span class="top_"><span class="mono">${numPC(p)}</span>${p.prioridade==='urgente'?'<span class="chip bad">urgente</span>':''}</span>
      <b>${esc(p.titulo)}</b><small>${esc(nomeEmp(e))}${pr?' · '+esc(pr.nome):''}</small>
      <span class="ft"><span class="val">${brl.format(valorPed(D,p))}</span>${p.status==='cotacao'?`<span class="chip ${nC?'warn':'mute'}">${nC} cotaç${nC===1?'ão':'ões'}</span>`:''}${p.acima_orcamento&&p.status!=='entregue'?'<span class="chip bad">acima da verba</span>':''}</span>
      ${venc?`<span class="ft">${venc}</span>`:''}${p.status==='comprado'?`<div class="prog" title="Recebido ${pct(pc)}"><i style="width:${pc*100}%"></i></div>`:''}</button>`};
  const col=([s,n,ic])=>{let ps=por(s);let mais='';if(s==='entregue'&&ps.length>8){mais=`<div class="kb-mais">+${ps.length-8} entregues antes</div>`;ps=ps.slice(0,8)}
    return `<div class="kb-col"><div class="kb-h"><span class="t">${icone(ic,15)}${n}</span><span class="kb-n">${por(s).length}</span></div><div class="kb-h" style="margin-top:-6px"><span class="tot">${k(valorDe(por(s)))}</span></div>
      ${ps.length?ps.map(card).join(''):'<div class="kb-vazio">Nada nesta etapa</div>'}${mais}</div>`};
  const pode=podeEditarAlguma();
  const cancel=ped.filter(p=>p.status==='cancelado');
  const [parc,vb]=await Promise.all([painelParcelas(D,ativos),painelVerbas(D,ativos)]);
  return `<section class="grid g-tiles">${tiles.map(t=>`<div class="tile"><div class="lbl">${tic(t[3],t[4])}${t[0]}</div><div class="val">${t[1]}</div><div class="cmp">${t[2]}</div></div>`).join('')}</section>
  <div class="panel"><div class="ph"><div><h2>Esteira de compras</h2><p class="hint">Pedido → confirmação → cotação → aprovação com verba do orçamento → compra (vira contas a pagar) → entrega → estoque. Clique num cartão para avançar.</p></div>
    <div class="acts-row">${cancel.length?`<button class="btn ghost sm" data-c="ver-cancelados">${C.verOcultos?'Esconder':'Ver'} ${cancel.length} cancelado${cancel.length>1?'s':''}</button>`:''}${pode?`<button class="btn" data-c="novo-pedido">${icone('compras',15)} Novo pedido</button>`:''}</div></div>
    ${ativos.length?`<div class="kb-wrap"><div class="kb">${ETAPAS.map(col).join('')}</div></div>`:`<div class="empty"><b>Nenhum pedido de compra</b>Comece com “Novo pedido”: descreva o que precisa, a conta do orçamento que paga e os itens.</div>`}
    ${C.verOcultos&&cancel.length?`<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>Pedido</th><th>Título</th><th>Empresa</th><th>Cancelado em</th><th>Motivo</th></tr></thead><tbody>${cancel.map(p=>`<tr class="click" data-pc="${p.id}"><td class="mono">${numPC(p)}</td><td>${esc(p.titulo)}</td><td>${esc(nomeEmp(empresa(p.empresa_id)))}</td><td>${dataBR(String(p.cancelado_em||'').slice(0,10))}</td><td class="wrap">${esc(p.motivo_cancelamento||'')}</td></tr>`).join('')}</tbody></table></div>`:''}
  </div>
  <section class="grid g-2e">${parc}${vb}</section>`;
}

// parcelas das compras: já em contas a pagar (finalizadas) + previstas (aprovadas, ainda não compradas)
async function painelParcelas(D,ativos){
  const abertas=await parcelasAbertas();
  const lancIds=new Set(ativos.filter(p=>p.lancamento_id).map(p=>p.lancamento_id));
  const reais=abertas.filter(x=>lancIds.has(x.lancamento_id)).map(x=>({venc:x.vencimento,valor:-(+x.valor)}));
  const prev=ativos.filter(p=>p.status==='aprovado').flatMap(p=>{const c=cotDoPed(D,p);return c?parcelasDe(+p.valor_aprovado||+c.total,c.prazos_dias,HOJE):[]});
  const meses=[...Array(6).keys()].map(i=>{const d=new Date(Date.UTC(+HOJE.slice(0,4),+HOJE.slice(5,7)-1+i,1));return d.toISOString().slice(0,7)});
  const atras=reais.filter(x=>x.venc.slice(0,7)<meses[0]);
  const somaM=(arr,m)=>sum(arr.filter(x=>x.venc.startsWith(m)).map(x=>x.valor));
  const R=meses.map(m=>somaM(reais,m)),P=meses.map(m=>somaM(prev,m));
  const depois=sum(reais.concat(prev).filter(x=>x.venc.slice(0,7)>meses[5]).map(x=>x.valor));
  const max=Math.max(1,...meses.map((_,i)=>R[i]+P[i]));
  const W=560,H=210,L=56,B=26,T=12,iw=W-L-10,ih=H-T-B,bw=iw/6;const y=v=>T+ih-v/max*ih;const step=niceStep(max/4);
  let s=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Parcelas de compras por mês de vencimento">`;
  for(let t=0;t<=max*1.001;t+=step)s+=`<line x1="${L}" x2="${W-10}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${L-8}" y="${y(t)+4}" text-anchor="end" font-size="11" fill="var(--ink-3)">${k(t).replace('R$ ','')}</text>`;
  meses.forEach((m,i)=>{const x=L+i*bw+bw*.22,w=bw*.56;
    if(R[i])s+=`<rect x="${x}" y="${y(R[i])}" width="${w}" height="${y(0)-y(R[i])}" fill="var(--accent)"><title>${mesTxt(m+'-01')} · em contas a pagar ${brl.format(R[i])}</title></rect>`;
    if(P[i])s+=`<rect x="${x}" y="${y(R[i]+P[i])}" width="${w}" height="${y(R[i])-y(R[i]+P[i])}" fill="var(--plan)" opacity=".8"><title>${mesTxt(m+'-01')} · previsto (aprovado) ${brl.format(P[i])}</title></rect>`;
    if(R[i]+P[i])s+=`<text x="${x+w/2}" y="${y(R[i]+P[i])-4}" text-anchor="middle" font-size="10.5" fill="var(--ink-2)">${k(R[i]+P[i]).replace('R$ ','')}</text>`;
    s+=`<text x="${L+i*bw+bw/2}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--ink-3)">${MESES[+m.slice(5)-1]}/${m.slice(2,4)}</text>`});
  s+='</svg>';
  return `<div class="panel"><h2>Parcelas das compras</h2><p class="hint">Vencimentos dos próximos 6 meses. Compras finalizadas já estão em contas a pagar e no fluxo de caixa; aprovadas entram pela condição da cotação.</p>
    ${reais.length||prev.length?s+`<div class="legend"><span><i style="background:var(--accent)"></i>Em contas a pagar ${k(sum(reais.map(x=>x.valor)))}</span><span><i style="background:var(--plan)"></i>Previsto (aprovado) ${k(sum(prev.map(x=>x.valor)))}</span>${depois?`<span>Depois de ${MESES[+meses[5].slice(5)-1]}: ${k(depois)}</span>`:''}${atras.length?`<span style="color:var(--bad)">Vencidas: ${k(sum(atras.map(x=>x.valor)))}</span>`:''}</div>`:'<p class="muted">Nenhuma parcela de compra a vencer.</p>'}</div>`;
}
// verba por conta: orçado do ano x realizado x compras aprovadas
async function painelVerbas(D,ativos){
  const ano=+HOJE.slice(0,4);
  const chaves=[...new Set(ativos.filter(p=>+p.competencia.slice(0,4)===ano).map(p=>p.empresa_id+'|'+p.conta_id))];
  if(!chaves.length)return `<div class="panel"><h2>Verba do orçamento por conta</h2><p class="hint">${ano} · contas usadas nas compras</p><p class="muted">Nenhuma compra em ${ano} ainda.</p></div>`;
  const rows=[];
  for(const ch of chaves){const [emp,ct]=ch.split('|');const o=await verba(D,{id:null,empresa_id:emp,conta_id:ct,predio_id:null,competencia:ano+'-12-01'},0);rows.push({emp,c:conta(ct),o})}
  rows.sort((a,b)=>b.o.orcAno-a.o.orcAno);
  return `<div class="panel"><h2>Verba do orçamento por conta</h2><p class="hint">${ano} · orçamento travado, realizado e compras aprovadas a comprar</p><div class="tbl-wrap"><table><thead><tr><th>Conta</th><th class="n">Orçado no ano</th><th>Uso</th><th class="n">Disponível</th></tr></thead><tbody>
    ${rows.map(({emp,c,o})=>{const b=Math.max(o.orcAno,o.realAc+o.compAc,1);const disp=o.orcAno-o.realAc-o.compAc;
      return `<tr><td>${esc(c?c.codigo+' '+c.nome:'?')}${S.empresas.length>1?`<span class="unit">${esc(nomeEmp(empresa(emp)))}</span>`:''}</td><td class="n">${o.versao?num.format(Math.round(o.orcAno)):'<span class="chip warn">sem orçamento</span>'}</td>
      <td><div class="vbar"><div class="meter" style="height:8px"><i class="m-real" style="width:${o.realAc/b*100}%"></i><i class="m-comp" style="width:${o.compAc/b*100}%"></i></div><small class="muted">${pct(o.orcAno?(o.realAc+o.compAc)/o.orcAno:NaN)} usado</small></div></td>
      <td class="n ${disp<0?'neg':''}">${num.format(Math.round(disp))}</td></tr>`}).join('')}</tbody></table></div>
    <div class="legend"><span><i style="background:var(--accent)"></i>Realizado</span><span><i style="background:var(--warn)"></i>Aprovado a comprar</span></div></div>`;
}

// ---------- detalhe do pedido (gaveta)
function abrirSheet(html){drawer(html);document.querySelector('#layer .sheet')?.classList.add('cmp-sheet')}
function passoAtual(D,p){return {pedido:1,confirmado:2,cotacao:cotsDe(D,p).length?3:2,aprovado:4,comprado:5,entregue:7,cancelado:-1}[p.status]}
function stepper(D,p){const cur=passoAtual(D,p);
  return `<div class="stp" aria-label="Etapas da compra">${PASSOS.map(([n,ic],i)=>{const cls=p.status==='cancelado'?(i===0?'ok':''):i<cur?'ok':i===cur?'cur':'';
    return `<div class="s ${cls}"><span class="b">${cls==='ok'?icone('cconf',16):icone(ic,16)}</span>${n}</div>`}).join('')}</div>`}
async function abrirPedido(id){
  const D=await dados();const p=D.ped.find(x=>x.id===id);if(!p)return;
  const e=empresa(p.empresa_id),pr=predio(p.predio_id),ct=conta(p.conta_id),cc=centro(p.centro_custo_id);const its=itensDe(D,p);const cots=cotsDe(D,p);const cot=cotDoPed(D,p);
  const ed=podeEditar(p.empresa_id);
  const kv=[['Solicitante',p.solicitante||'–'],['Precisa até',p.necessidade?dataBR(p.necessidade):'–'],['Competência',mesTxt(p.competencia)],['Valor estimado',brl2.format(estimado(D,p))],['Valor aprovado',p.valor_aprovado!=null?brl2.format(+p.valor_aprovado):'–'],['Fornecedor',cot?cot.fornecedor:'–']];
  const recCol=['comprado','entregue'].includes(p.status);
  const itTab=`<div class="tbl-wrap"><table><thead><tr><th>Item</th><th class="n">Qtd</th><th>Un</th><th class="n">Estimado un.</th>${cot?'<th class="n">Cotado un.</th>':''}<th class="n">Total</th>${recCol?'<th class="n">Recebido</th>':''}</tr></thead><tbody>
    ${its.map(i=>{const ci=cot&&D.cotIt.find(x=>x.cotacao_id===cot.id&&x.item_id===i.id);const vu=ci?+ci.valor_unitario:+i.valor_estimado||0;const prd=produtoDe(i.produto_id);
      return `<tr><td>${esc(i.descricao)}${prd?.controla_estoque?` <span class="chip info" title="Entra no estoque na entrega">${icone('cestoque',12)} estoque</span>`:''}</td><td class="n">${qtd.format(+i.quantidade)}</td><td>${esc(i.unidade)}</td><td class="n">${i.valor_estimado!=null?brl2.format(+i.valor_estimado):'–'}</td>${cot?`<td class="n">${ci?brl2.format(vu):'–'}</td>`:''}<td class="n">${brl2.format(vu*(+i.quantidade))}</td>${recCol?`<td class="n">${(+i.qtd_recebida||0)>=+i.quantidade?'<span class="chip good">✓ '+qtd.format((+i.qtd_recebida||0))+'</span>':qtd.format((+i.qtd_recebida||0))}</td>`:''}</tr>`}).join('')}</tbody></table></div>`;
  let etapa='';
  if(p.status==='pedido')etapa=`<div class="box"><h4>${tic('cconf','accent')}Próximo passo: confirmar o pedido</h4><p class="muted" style="margin:0">Confira itens, quantidades e a conta do orçamento. Depois de confirmado, o pedido vai para cotação.</p>
    ${ed?`<div class="acts-row"><button class="btn" data-c="confirmar" data-id="${p.id}">Confirmar pedido</button><button class="btn ghost" data-c="cancelar" data-id="${p.id}">Cancelar pedido</button></div>`:''}</div>`;
  else if(p.status==='confirmado'||p.status==='cotacao')etapa=`<div class="box"><h4>${tic('ccot','warn')}Cotações</h4>${cots.length?comparativo(D,p,its,cots,ed):'<p class="muted" style="margin:0">Registre os orçamentos dos fornecedores. Com uma ou mais cotações, escolha qual aprovar: o sistema confere a verba do orçamento e mostra as parcelas.</p>'}
    ${ed?`<div class="acts-row"><button class="btn${cots.length?' ghost':''}" data-c="nova-cotacao" data-id="${p.id}">+ Nova cotação</button><button class="btn ghost" data-c="cancelar" data-id="${p.id}">Cancelar pedido</button></div>`:''}</div>`;
  else if(p.status==='aprovado'){const o=await verba(D,p,+p.valor_aprovado);const ps=parcelasDe(+p.valor_aprovado,cot?.prazos_dias,HOJE);
    etapa=`<div class="box"><h4>${tic('caprov','good')}Aprovado por ${esc(p.aprovado_por||'')} em ${dataBR(String(p.aprovado_em||'').slice(0,10))}</h4>
      <p class="muted" style="margin:0">${esc(cot?.fornecedor||'')} · ${brl2.format(+p.valor_aprovado)} · ${condTxt(cot?.prazos_dias)}${cot?.prazo_entrega_dias!=null?` · entrega em ${cot.prazo_entrega_dias} dias`:''}${p.acima_orcamento?` · <b style="color:var(--bad)">acima da verba</b>: ${esc(p.justificativa||'')}`:''}</p>
      ${p.verba_disponivel!=null?`<p class="muted" style="margin:0;font-size:12px">Na aprovação: disponível ${brl.format(+p.verba_disponivel)} de ${brl.format(+p.verba_orcada)} orçados até o mês.</p>`:''}
      ${verbaHtml(o,p)}</div>
      <div class="box"><h4>${tic('cparc','warn')}Parcelas previstas (se comprar hoje)</h4>${parcelasHtml(ps)}</div>
      ${ed?`<div class="box"><h4>${tic('ccompra','accent')}Finalizar compra</h4>${formFinalizar(p,cot)}</div>`:''}`}
  else if(p.status==='comprado'){const parc=(await parcelasAbertas()).filter(x=>x.lancamento_id===p.lancamento_id);
    etapa=`<div class="box"><h4>${tic('centrega',atrasada(p)?'bad':'accent')}Acompanhamento da entrega</h4>
      <div class="kv"><div><small>Comprado em</small><span>${dataBR(p.comprado_em)}</span></div><div><small>Previsão</small><span style="color:var(--${atrasada(p)?'bad':'ink'})">${p.previsao_entrega?dataBR(p.previsao_entrega):'–'}${atrasada(p)?' · atrasada':''}</span></div><div><small>Pedido no fornecedor</small><span>${esc(p.pedido_fornecedor||'–')}</span></div><div><small>Transportadora</small><span>${esc(p.transportadora||'–')}</span></div><div><small>Rastreio</small><span>${esc(p.rastreio||'–')}</span></div><div><small>Recebido</small><span>${pct(recebidoPct(D,p))}</span></div></div>
      ${ed?`<div class="acts-row"><button class="btn" data-c="receber" data-id="${p.id}">${icone('cestoque',15)} Registrar recebimento</button><button class="btn ghost" data-c="atualizar-entrega" data-id="${p.id}">Atualizar entrega</button></div>`:''}</div>
      <div class="box"><h4>${tic('cparc','warn')}Em contas a pagar</h4>${parc.length?`<div class="tbl-wrap"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th class="n">Valor</th></tr></thead><tbody>${parc.map(x=>`<tr><td>${x.numero}</td><td>${dataBR(x.vencimento)}${x.vencimento<HOJE?' <span class="chip bad">vencida</span>':''}</td><td class="n">${brl2.format(-x.valor)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Todas as parcelas desta compra já foram pagas.</p>'}<a href="#contas" class="linkbtn small">Abrir contas a pagar</a></div>`}
  else if(p.status==='entregue'){const mv=(await estoque()).filter(m=>its.some(i=>i.id===m.compra_item_id));
    etapa=`<div class="box"><h4>${tic('cestoque','good')}Entregue em ${dataBR(p.entregue_em)}</h4>${mv.length?`<div class="tbl-wrap"><table><thead><tr><th>Entrada no estoque</th><th>Data</th><th class="n">Qtd</th><th class="n">Custo un.</th></tr></thead><tbody>${mv.map(m=>`<tr><td>${esc(produtoDe(m.produto_id)?.nome||'?')}</td><td>${dataBR(m.data)}</td><td class="n">${qtd.format(+m.quantidade)}</td><td class="n">${brl2.format(+m.custo_unitario)}</td></tr>`).join('')}</tbody></table></div><a href="#estoque" class="linkbtn small">Abrir estoque</a>`:'<p class="muted" style="margin:0">Itens sem produto de estoque (serviço ou consumo): nada entrou no estoque.</p>'}</div>`}
  else if(p.status==='cancelado')etapa=`<div class="msg err">Cancelado em ${dataBR(String(p.cancelado_em||'').slice(0,10))}${p.motivo_cancelamento?': '+esc(p.motivo_cancelamento):''}</div>`;
  if(p.status==='aprovado'&&ed)etapa+=`<div class="acts-row"><button class="btn ghost sm" data-c="desaprovar" data-id="${p.id}">Desfazer aprovação (volta para cotação)</button><button class="btn ghost sm" data-c="cancelar" data-id="${p.id}">Cancelar pedido</button></div>`;
  if(p.status==='comprado'&&ed)etapa+=`<div class="acts-row"><button class="btn ghost sm" data-c="cancelar" data-id="${p.id}">Cancelar compra</button></div>`;
  const ev=D.ev.filter(x=>x.pedido_id===p.id);
  abrirSheet(`<div class="ph" style="margin:0"><div><h3><span class="mono" style="color:var(--ink-3);font-weight:500">${numPC(p)}</span> ${esc(p.titulo)}</h3>
      <p class="muted" style="margin:4px 0 0;font-size:12.5px">${esc(nomeEmp(e))}${pr?' · '+esc(pr.nome):''} · ${esc(ct?ct.codigo+' '+ct.nome:'')}${cc?' · '+esc(cc.nome):''}</p></div>
      <div class="acts-row">${chipSt(p.status)}${p.prioridade==='urgente'?'<span class="chip bad">urgente</span>':''}<button class="btn ghost sm" data-acao="fechar">Fechar</button></div></div>
    ${stepper(D,p)}
    <div class="kv">${kv.map(([a,b])=>`<div><small>${a}</small><span>${esc(b)}</span></div>`).join('')}</div>
    ${p.observacao?`<p class="muted" style="margin:0">${esc(p.observacao)}</p>`:''}
    ${itTab}${etapa}
    ${ev.length?`<div><h4 style="margin:0 0 8px;font-size:13.5px">Histórico</h4><div class="tl">${ev.slice().reverse().map(x=>`<div><b>${esc(x.etapa)}</b>${x.descricao?' · '+esc(x.descricao):''}<small>${esc(x.usuario||'')} · ${new Date(x.criado_em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</small></div>`).join('')}</div></div>`:''}`);
}
function comparativo(D,p,its,cots,ed){
  const vu=(c,i)=>{const x=D.cotIt.find(y=>y.cotacao_id===c.id&&y.item_id===i.id);return x?+x.valor_unitario:null};
  const minTot=Math.min(...cots.map(c=>+c.total));
  const linha=(nome,f,best)=>`<tr><td>${nome}</td>${cots.map(c=>`<td class="n ${best&&best(c)?'best':''}">${f(c)}</td>`).join('')}</tr>`;
  let rows=its.map(i=>{const vals=cots.map(c=>vu(c,i)).filter(v=>v!=null);const mn=Math.min(...vals);
    return `<tr><td>${esc(i.descricao)} <span class="unit">${qtd.format(+i.quantidade)} ${esc(i.unidade)}</span></td>${cots.map(c=>{const v=vu(c,i);return `<td class="n ${v!=null&&cots.length>1&&v===mn?'best':''}">${v==null?'–':brl2.format(v)}<span class="unit">${v==null?'':brl2.format(v*(+i.quantidade))}</span></td>`}).join('')}</tr>`}).join('');
  rows+=linha('Frete',c=>brl2.format(+c.frete))+linha('Desconto',c=>+c.desconto?'-'+brl2.format(+c.desconto):'–');
  rows+=`<tr class="tot"><td>Total</td>${cots.map(c=>`<td class="n ${cots.length>1&&+c.total===minTot?'best':''}">${brl2.format(+c.total)}${cots.length>1&&+c.total===minTot?'<span class="unit">menor preço</span>':''}</td>`).join('')}</tr>`;
  rows+=linha('Pagamento',c=>condTxt(c.prazos_dias)+(c.forma_pagamento?`<span class="unit">${esc(c.forma_pagamento)}</span>`:''))+linha('Entrega',c=>c.prazo_entrega_dias!=null?c.prazo_entrega_dias+' dias':'–')+linha('Validade',c=>c.validade?dataBR(c.validade):'–');
  if(ed)rows+=`<tr><td></td>${cots.map(c=>`<td class="n"><button class="btn sm good" data-c="aprovar" data-id="${p.id}" data-cot="${c.id}">Aprovar</button> <button class="icbtn" style="display:inline-grid;vertical-align:middle;height:28px;width:28px" data-c="excluir-cotacao" data-cot="${c.id}" data-id="${p.id}" title="Excluir cotação" aria-label="Excluir cotação de ${esc(c.fornecedor)}">${icone('cx',14)}</button></td>`).join('')}</tr>`;
  return `<div class="tbl-wrap"><table class="cot"><thead><tr><th>Item</th>${cots.map(c=>`<th class="n cz">${esc(c.fornecedor)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ---------- formulários
const contasDesp=emp=>S.contas.filter(c=>c.empresa_id===emp&&c.analitica&&c.ativa&&c.tipo==='despesa').sort((a,b)=>a.codigo.localeCompare(b.codigo,undefined,{numeric:true}));
function opcoesPedido(emp){
  const cs=contasDesp(emp);const pad=cs.find(c=>c.grupo_dre==='custos')||cs[0];
  return {pred:`<option value="">${S.predios.some(p=>p.empresa_id===emp)?'Sem unidade definida':'Empresa toda'}</option>`+S.predios.filter(p=>p.empresa_id===emp).map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join(''),
    contas:cs.map(c=>`<option value="${c.id}" ${c===pad?'selected':''}>${esc(c.codigo)} ${esc(c.nome)}</option>`).join(''),
    cc:'<option value="">Sem centro de custo</option>'+S.centros.filter(c=>c.empresa_id===emp).map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join(''),
    prods:(C.produtos||[]).filter(p=>p.empresa_id===emp).map(p=>`<option value="${esc(p.codigo)} · ${esc(p.nome)}">`).join('')};
}
const linhaItem=(n)=>`<div class="it-row" data-item>
  <div class="field"><label for="iD${n}">Item ${n}</label><input id="iD${n}" name="desc" list="dlProd" autocomplete="off" placeholder="Produto ou serviço" required></div>
  <div class="field"><label for="iQ${n}">Qtd</label><input id="iQ${n}" name="qtd" inputmode="decimal" required value="1"></div>
  <div class="field"><label for="iU${n}">Un</label><input id="iU${n}" name="un" value="UN"></div>
  <div class="field vu"><label for="iV${n}">Estimado un. (R$)</label><input id="iV${n}" name="vu" inputmode="decimal" placeholder="0,00"></div>
  <label class="ck"><input type="checkbox" name="est" checked> Estoque</label>
  <button type="button" class="icbtn" data-c="item-del" aria-label="Remover item ${n}">${icone('cx',15)}</button></div>`;
async function formPedido(){
  await dados();
  const emp=selEmp().find(e=>podeEditar(e.id))||S.empresas.find(e=>podeEditar(e.id));if(!emp)return toast('Seu usuário não pode criar pedidos.');
  const o=opcoesPedido(emp.id);
  abrirSheet(`<h3>Novo pedido de compra</h3><p class="muted" style="margin:0">A conta escolhida é a do orçamento que vai pagar a compra: na aprovação, o sistema confere a verba dela no mês e no acumulado do ano.</p>
  <form data-form="cmp-pedido" class="form-grid">
    <div class="field wide"><label for="cTit">O que precisa comprar</label><input id="cTit" name="titulo" required placeholder="Ex.: Reposição de café em grãos para dezembro"></div>
    <div class="field"><label for="cEmp">Empresa</label><select id="cEmp" name="empresa" data-cmp-emp>${S.empresas.filter(e=>podeEditar(e.id)).map(e=>`<option value="${e.id}" ${e.id===emp.id?'selected':''}>${esc(nomeEmp(e))}</option>`).join('')}</select></div>
    <div class="field"><label for="cPred">Unidade</label><select id="cPred" name="predio">${o.pred}</select></div>
    <div class="field"><label for="cCC">Centro de custo</label><select id="cCC" name="centro">${o.cc}</select></div>
    <div class="field wide"><label for="cConta">Conta do orçamento</label><select id="cConta" name="conta" required>${o.contas}</select></div>
    <div class="field"><label for="cComp">Competência (mês da verba)</label><input id="cComp" name="competencia" type="month" required value="${HOJE.slice(0,7)}"></div>
    <div class="field"><label for="cNec">Precisa até</label><input id="cNec" name="necessidade" type="date"></div>
    <div class="field"><label for="cPri">Prioridade</label><select id="cPri" name="prioridade"><option value="normal">Normal</option><option value="urgente">Urgente</option><option value="baixa">Baixa</option></select></div>
    <div class="field wide"><label for="cSol">Solicitante</label><input id="cSol" name="solicitante" value="${esc(quem())}"></div>
    <div class="wide" style="display:flex;flex-direction:column;gap:8px"><b style="font-size:13px">Itens</b><p class="muted" style="margin:0;font-size:12px">Escolha um produto da lista ou digite um novo. “Estoque” marcado: na entrega o item entra no estoque (produtos novos são cadastrados).</p>
      <div id="cItens" style="display:flex;flex-direction:column;gap:8px">${linhaItem(1)}</div><datalist id="dlProd">${o.prods}</datalist>
      <div><button type="button" class="btn ghost sm" data-c="item-add">+ Item</button> <span class="muted" id="cTot" style="margin-left:8px;font-size:12.5px"></span></div></div>
    <div class="field wide"><label for="cObs">Observação</label><input id="cObs" name="observacao"></div>
    <div class="wide acts-row"><button class="btn">Criar pedido</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div>
  </form>`);
}
function lerItens(f){return [...f.querySelectorAll('[data-item]')].map((r,i)=>({ordem:i+1,desc:r.querySelector('[name=desc]').value.trim(),qtd:pv(r.querySelector('[name=qtd]').value),un:r.querySelector('[name=un]').value.trim()||'UN',vu:pv(r.querySelector('[name=vu]').value),est:r.querySelector('[name=est]').checked})).filter(x=>x.desc)}
function totalForm(f){const its=lerItens(f);const t=sum(its.map(i=>(i.qtd||0)*(isNaN(i.vu)?0:i.vu)));const el=document.getElementById('cTot');if(el)el.textContent=t?'Total estimado '+brl2.format(t):''}
async function produtoPara(emp,it){
  const lista=C.produtos.filter(p=>p.empresa_id===emp);
  const m=lista.find(p=>`${p.codigo} · ${p.nome}`===it.desc)||lista.find(p=>norm(p.nome)===norm(it.desc))||lista.find(p=>norm(p.codigo)===norm(it.desc));
  if(m)return m;if(!it.est)return null;
  let n=lista.length+1,cod;do{cod='P'+String(n++).padStart(4,'0')}while(lista.some(p=>p.codigo===cod));
  const {data,error}=await sb.from('produtos').insert({empresa_id:emp,codigo:cod,nome:it.desc,tipo:'produto',unidade:it.un,controla_estoque:true,custo_padrao:isNaN(it.vu)?null:it.vu}).select('*').single();
  if(error)throw error;C.produtos.push(data);S.produtos.push({id:data.id,empresa_id:emp,codigo:cod,nome:data.nome});return data;
}
function formCotacao(D,p){
  const its=itensDe(D,p);const forn=S.parceiros.filter(x=>x.empresa_id===p.empresa_id);
  abrirSheet(`<h3>Nova cotação · ${numPC(p)}</h3><p class="muted" style="margin:0">${esc(p.titulo)}</p>
  <form data-form="cmp-cotacao" data-id="${p.id}" class="form-grid">
    <div class="field wide"><label for="qForn">Fornecedor</label><input id="qForn" name="fornecedor" list="dlForn" autocomplete="off" required><datalist id="dlForn">${forn.map(x=>`<option value="${esc(x.nome)}">`).join('')}</datalist></div>
    <div class="wide tbl-wrap"><table><thead><tr><th>Item</th><th class="n">Qtd</th><th class="n">Preço unitário (R$)</th></tr></thead><tbody>${its.map(i=>`<tr><td>${esc(i.descricao)}</td><td class="n">${qtd.format(+i.quantidade)} ${esc(i.unidade)}</td><td class="n"><input class="cel" style="width:110px" name="vu_${i.id}" data-qtd="${+i.quantidade}" inputmode="decimal" required value="${i.valor_estimado!=null?fmtIn(+i.valor_estimado):''}"></td></tr>`).join('')}</tbody></table></div>
    <div class="field"><label for="qFrete">Frete (R$)</label><input id="qFrete" name="frete" inputmode="decimal" value="0"></div>
    <div class="field"><label for="qDesc">Desconto (R$)</label><input id="qDesc" name="desconto" inputmode="decimal" value="0"></div>
    <div class="field"><label>Total da cotação</label><b id="qTot" class="mono" style="padding:8px 0">–</b></div>
    <div class="field"><label for="qPraz">Condição (dias)</label><input id="qPraz" name="prazos" placeholder="à vista ou 30/60/90" value="30"></div>
    <div class="field"><label for="qForma">Forma de pagamento</label><select id="qForma" name="forma"><option>Boleto</option><option>PIX</option><option>Transferência</option><option>Cartão</option></select></div>
    <div class="field"><label for="qEnt">Entrega em (dias)</label><input id="qEnt" name="entrega" inputmode="numeric" placeholder="10"></div>
    <div class="field"><label for="qVal">Validade da proposta</label><input id="qVal" name="validade" type="date"></div>
    <div class="field" style="grid-column:span 2"><label for="qObs">Observação</label><input id="qObs" name="observacao"></div>
    <div class="wide" id="qParc"></div>
    <div class="wide acts-row"><button class="btn">Salvar cotação</button><button type="button" class="btn ghost" data-c="abrir" data-id="${p.id}">Voltar</button></div>
  </form>`);
  previewCot(document.querySelector('form[data-form="cmp-cotacao"]'));
}
function totalCot(f){let t=0;f.querySelectorAll('[name^=vu_]').forEach(x=>{const v=pv(x.value);if(!isNaN(v))t+=v*(+x.dataset.qtd)});const fr=pv(f.frete.value),de=pv(f.desconto.value);return r2(t+(isNaN(fr)?0:fr)-(isNaN(de)?0:de))}
function previewCot(f){if(!f)return;const t=totalCot(f);document.getElementById('qTot').textContent=brl2.format(t);const ps=parcelasDe(t,parsePrazos(f.prazos.value),HOJE);document.getElementById('qParc').innerHTML=t?`<p class="muted" style="margin:0 0 6px;font-size:12.5px">${condTxt(parsePrazos(f.prazos.value))} · vencimentos se a compra for feita hoje:</p>${parcelasHtml(ps)}`:''}
async function formAprovar(D,p,cotId){
  const c=D.cot.find(x=>x.id===cotId);const o=await verba(D,p,+c.total);const ps=parcelasDe(+c.total,c.prazos_dias,HOJE);
  abrirSheet(`<h3>Aprovar cotação · ${numPC(p)}</h3><p class="muted" style="margin:0">${esc(c.fornecedor)} · ${brl2.format(+c.total)} · ${condTxt(c.prazos_dias)}</p>
    <div class="box"><h4>${tic('cverba',o.acima?'bad':'good')}Verba no orçamento · ${esc(conta(p.conta_id)?.codigo||'')} ${esc(conta(p.conta_id)?.nome||'')}${p.predio_id?' · '+esc(predio(p.predio_id)?.nome||''):''}</h4>
      ${o.versao?(o.acima?`<div class="msg err">A compra passa a verba disponível em ${brl2.format(r2(o.valor-o.dispAc))}.</div>`:`<div class="msg ok">Tem verba: sobram ${brl2.format(r2(o.dispAc-o.valor))} até ${mesTxt(p.competencia)} depois desta compra.</div>`):''}${verbaHtml(o,p)}</div>
    <div class="box"><h4>${tic('cparc','warn')}Parcelamento</h4><p class="muted" style="margin:0;font-size:12.5px">Datas contadas a partir de hoje; ao finalizar a compra, contam da data da compra e vão para contas a pagar e o fluxo de caixa.</p>${parcelasHtml(ps)}</div>
    <form data-form="cmp-aprovar" data-id="${p.id}" data-cot="${c.id}" class="form-grid">
      ${o.acima||!o.versao?`<div class="field wide"><label for="aJus">Justificativa para aprovar acima da verba</label><textarea id="aJus" name="justificativa" rows="2" required></textarea></div>`:''}
      <div class="wide acts-row"><button class="btn ${o.acima||!o.versao?'bad':'good'}">${o.acima||!o.versao?'Aprovar acima da verba':'Aprovar cotação'}</button><button type="button" class="btn ghost" data-c="abrir" data-id="${p.id}">Voltar</button></div>
    </form>`);
  C.verbaAprov={pedido:p.id,o};
}
function formFinalizar(p,cot){
  const bancos=S.bancos.filter(b=>b.empresa_id===p.empresa_id);
  const prev=cot?.prazo_entrega_dias!=null?addDias(HOJE,+cot.prazo_entrega_dias):'';
  return `<p class="muted" style="margin:0;font-size:12.5px">Gera o lançamento na conta do orçamento e as parcelas em contas a pagar (entram no fluxo de caixa). Depois acompanhe a entrega.</p>
  <form data-form="cmp-finalizar" data-id="${p.id}" class="form-grid">
    <div class="field"><label for="fData">Data da compra</label><input id="fData" name="data" type="date" required value="${HOJE}"></div>
    <div class="field"><label for="fPrev">Previsão de entrega</label><input id="fPrev" name="previsao" type="date" value="${prev}"></div>
    <div class="field"><label for="fPF">Nº do pedido no fornecedor</label><input id="fPF" name="pedforn"></div>
    <div class="field" style="grid-column:span 2"><label for="fBanco">Pagar pela conta</label><select id="fBanco" name="banco"><option value="">Definir na baixa</option>${bancos.map(b=>`<option value="${b.id}">${esc(bancoTxt(b))}</option>`).join('')}</select></div>
    <div class="field"><label for="fForma">Forma</label><input id="fForma" name="forma" value="${esc(cot?.forma_pagamento||'Boleto')}"></div>
    <div class="wide"><button class="btn">${icone('ccompra',15)} Finalizar compra</button></div></form>`;
}
function formEntrega(D,p){abrirSheet(`<h3>Atualizar entrega · ${numPC(p)}</h3><form data-form="cmp-entrega" data-id="${p.id}" class="form-grid">
  <div class="field"><label for="eaPrev">Previsão de entrega</label><input id="eaPrev" name="previsao" type="date" value="${p.previsao_entrega||''}"></div>
  <div class="field"><label for="eaTr">Transportadora</label><input id="eaTr" name="transp" value="${esc(p.transportadora||'')}"></div>
  <div class="field"><label for="eaRa">Código de rastreio</label><input id="eaRa" name="rastreio" value="${esc(p.rastreio||'')}"></div>
  <div class="field wide"><label for="eaNota">Atualização (vai para o histórico)</label><input id="eaNota" name="nota" placeholder="Ex.: saiu para entrega, fornecedor adiou para sexta"></div>
  <div class="wide acts-row"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-c="abrir" data-id="${p.id}">Voltar</button></div></form>`)}
function formReceber(D,p){const its=itensDe(D,p);
  abrirSheet(`<h3>Registrar recebimento · ${numPC(p)}</h3><p class="muted" style="margin:0">Informe o que chegou. Itens com produto de estoque entram no estoque${p.predio_id?' de '+esc(predio(p.predio_id)?.nome||''):''} com o custo da cotação (frete e desconto rateados).</p>
  <form data-form="cmp-receber" data-id="${p.id}" class="form-grid">
    <div class="field"><label for="rData">Data do recebimento</label><input id="rData" name="data" type="date" required value="${HOJE}"></div>
    <div class="field" style="grid-column:span 2"><label for="rNF">Nota fiscal</label><input id="rNF" name="nf" placeholder="Nº da NF de entrada"></div>
    <div class="wide tbl-wrap"><table><thead><tr><th>Item</th><th class="n">Pedido</th><th class="n">Já recebido</th><th class="n">Recebendo agora</th></tr></thead><tbody>
      ${its.map(i=>{const falta=Math.max(0,+i.quantidade-((+i.qtd_recebida||0)));const prd=produtoDe(i.produto_id);return `<tr><td>${esc(i.descricao)}${prd?.controla_estoque?` <span class="chip info">${icone('cestoque',12)} estoque</span>`:''}</td><td class="n">${qtd.format(+i.quantidade)} ${esc(i.unidade)}</td><td class="n">${qtd.format((+i.qtd_recebida||0))}</td><td class="n"><input class="cel" name="rq_${i.id}" inputmode="decimal" value="${falta?String(falta).replace('.',','):''}" ${falta?'':'disabled'}></td></tr>`}).join('')}</tbody></table></div>
    <div class="wide acts-row"><button class="btn">${icone('cestoque',15)} Confirmar recebimento</button><button type="button" class="btn ghost" data-c="abrir" data-id="${p.id}">Voltar</button></div></form>`)}
function formCancelar(D,p){abrirSheet(`<h3>Cancelar ${numPC(p)}</h3><p class="muted" style="margin:0">${esc(p.titulo)}</p>
  ${p.status==='comprado'?'<div class="msg err">A compra já foi finalizada: o lançamento e as parcelas em aberto em contas a pagar serão excluídos. Se alguma parcela já foi paga, o cancelamento é bloqueado.</div>':''}
  <form data-form="cmp-cancelar" data-id="${p.id}" class="form-grid"><div class="field wide"><label for="xMot">Motivo</label><input id="xMot" name="motivo" required></div>
  <div class="wide acts-row"><button class="btn bad">Cancelar pedido</button><button type="button" class="btn ghost" data-c="abrir" data-id="${p.id}">Voltar</button></div></form>`)}

const FORMS_CMP={
  async 'cmp-pedido'(f){
    const emp=f.empresa.value;const its=lerItens(f);if(!its.length)return toast('Inclua pelo menos um item.');
    if(its.some(i=>isNaN(i.qtd)||i.qtd<=0))return toast('Confira as quantidades dos itens.');
    const {data:p,error}=await sb.from('compras_pedidos').insert({empresa_id:emp,predio_id:f.predio.value||null,titulo:f.titulo.value.trim(),solicitante:f.solicitante.value.trim()||null,prioridade:f.prioridade.value,conta_id:f.conta.value,centro_custo_id:f.centro.value||null,competencia:f.competencia.value+'-01',necessidade:f.necessidade.value||null,observacao:f.observacao.value.trim()||null,status:'pedido'}).select('*').single();
    if(error)throw error;
    const rows=[];for(const it of its){const prd=await produtoPara(emp,it);rows.push({empresa_id:emp,pedido_id:p.id,ordem:it.ordem,produto_id:prd?.id||null,descricao:prd&&prd.nome?prd.nome:it.desc,unidade:it.un,quantidade:it.qtd,valor_estimado:isNaN(it.vu)?null:it.vu})}
    const {error:e2}=await sb.from('compras_itens').insert(rows);if(e2)throw e2;
    await evento(p,'Pedido criado',its.length+' ite'+(its.length>1?'ns':'m'));
    recarregar();toast(`Pedido ${numPC(p)} criado. Próximo passo: confirmar.`);await abrirPedido(p.id);render(true)},
  async 'cmp-cotacao'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);const nome=f.fornecedor.value.trim();
    let parc=S.parceiros.find(x=>x.empresa_id===p.empresa_id&&norm(x.nome)===norm(nome));
    if(!parc){const {data,error}=await sb.from('parceiros').insert({empresa_id:p.empresa_id,nome,fornecedor:true}).select('id,empresa_id,documento,nome').single();if(error)throw error;S.parceiros.push(data);parc=data}
    const total=totalCot(f);if(!(total>0))return toast('Informe os preços da cotação.');
    const ent=parseInt(f.entrega.value,10);const fr=pv(f.frete.value),de=pv(f.desconto.value);
    const {data:c,error}=await sb.from('compras_cotacoes').insert({empresa_id:p.empresa_id,pedido_id:p.id,parceiro_id:parc.id,fornecedor:parc.nome,frete:isNaN(fr)?0:fr,desconto:isNaN(de)?0:de,total,prazos_dias:parsePrazos(f.prazos.value),forma_pagamento:f.forma.value,prazo_entrega_dias:isNaN(ent)?null:ent,validade:f.validade.value||null,observacao:f.observacao.value.trim()||null}).select('*').single();
    if(error)throw error;
    const rows=itensDe(D,p).map(i=>({empresa_id:p.empresa_id,cotacao_id:c.id,item_id:i.id,valor_unitario:pv(f['vu_'+i.id].value)||0}));
    const {error:e2}=await sb.from('compras_cotacao_itens').insert(rows);if(e2)throw e2;
    if(p.status==='confirmado')await atualiza(p,{status:'cotacao'});
    await evento(p,'Cotação registrada',`${parc.nome} · ${brl2.format(total)} · ${condTxt(c.prazos_dias)}`);
    recarregar();toast('Cotação salva.');await abrirPedido(p.id);render(true)},
  async 'cmp-aprovar'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);const c=D.cot.find(x=>x.id===f.dataset.cot);
    const o=await verba(D,p,+c.total);const jus=f.justificativa?.value.trim()||null;
    if((o.acima||!o.versao)&&!jus)return toast('Escreva a justificativa.');
    await atualiza(p,{status:'aprovado',cotacao_id:c.id,valor_aprovado:+c.total,aprovado_em:new Date().toISOString(),aprovado_por:quem(),verba_versao_id:o.versao?.id||null,verba_orcada:r2(o.orcAc),verba_realizada:r2(o.realAc),verba_comprometida:r2(o.compAc),verba_disponivel:o.dispAc,acima_orcamento:o.acima||!o.versao,justificativa:jus});
    await evento(p,'Cotação aprovada',`${c.fornecedor} · ${brl2.format(+c.total)}${o.acima||!o.versao?' · acima da verba: '+jus:' · dentro da verba'}`);
    recarregar();toast('Cotação aprovada. Verba reservada até a compra.');await abrirPedido(p.id);render(true)},
  async 'cmp-finalizar'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);const c=cotDoPed(D,p);if(!c)return toast('Aprove uma cotação antes.');
    const total=+p.valor_aprovado;const data=f.data.value;const lid=uuid();
    const {error}=await sb.from('lancamentos').insert({id:lid,empresa_id:p.empresa_id,predio_id:p.predio_id,conta_id:p.conta_id,centro_custo_id:p.centro_custo_id,parceiro_id:c.parceiro_id,competencia:p.competencia,descricao:`Compra ${numPC(p)} · ${p.titulo}`,valor:-total,origem:'compra'});
    if(error)throw error;
    const ps=parcelasDe(total,c.prazos_dias,data);
    const {error:e2}=await sb.from('parcelas').insert(ps.map(x=>({empresa_id:p.empresa_id,lancamento_id:lid,numero:x.n,vencimento:x.venc,valor:-x.valor,forma_pagamento:f.forma.value.trim()||null,status:'aberta',conta_bancaria_id:f.banco.value||null,centro_custo_id:p.centro_custo_id})));
    if(e2){await sb.from('lancamentos').delete().eq('id',lid);throw e2}
    await atualiza(p,{status:'comprado',comprado_em:data,finalizado_por:quem(),lancamento_id:lid,previsao_entrega:f.previsao.value||null,pedido_fornecedor:f.pedforn.value.trim()||null});
    await evento(p,'Compra finalizada',`${ps.length} parcela${ps.length>1?'s':''} em contas a pagar · 1º vencimento ${dataBR(ps[0].venc)}`);
    invalidar();recarregar();toast('Compra finalizada: parcelas lançadas em contas a pagar.');await abrirPedido(p.id);render(true)},
  async 'cmp-entrega'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);
    await atualiza(p,{previsao_entrega:f.previsao.value||null,transportadora:f.transp.value.trim()||null,rastreio:f.rastreio.value.trim()||null});
    await evento(p,'Entrega atualizada',[f.nota.value.trim(),f.previsao.value?'previsão '+dataBR(f.previsao.value):''].filter(Boolean).join(' · '));
    recarregar();toast('Entrega atualizada.');await abrirPedido(p.id);render(true)},
  async 'cmp-receber'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);const its=itensDe(D,p);const c=cotDoPed(D,p);
    const vu=i=>{const x=c&&D.cotIt.find(y=>y.cotacao_id===c.id&&y.item_id===i.id);return x?+x.valor_unitario:+i.valor_estimado||0};
    const sub=sum(its.map(i=>vu(i)*(+i.quantidade)));const fator=sub&&p.valor_aprovado!=null?(+p.valor_aprovado)/sub:1;
    const rec=its.map(i=>{const v=pv(f['rq_'+i.id]?.value);return {i,q:isNaN(v)?0:Math.min(v,+i.quantidade-((+i.qtd_recebida||0)))}}).filter(x=>x.q>0);
    if(!rec.length)return toast('Informe a quantidade recebida.');
    const movs=rec.filter(x=>produtoDe(x.i.produto_id)?.controla_estoque).map(x=>({empresa_id:p.empresa_id,produto_id:x.i.produto_id,predio_id:p.predio_id,data:f.data.value,tipo:'entrada',quantidade:x.q,custo_unitario:Math.round(vu(x.i)*fator*1e6)/1e6,compra_item_id:x.i.id,observacao:`${numPC(p)} · ${c?.fornecedor||''}${f.nf.value.trim()?' · NF '+f.nf.value.trim():''}`}));
    if(movs.length){const {error}=await sb.from('estoque_movimentos').insert(movs);if(error)throw error}
    for(const x of rec){const {error}=await sb.from('compras_itens').update({qtd_recebida:(+x.i.qtd_recebida||0)+x.q}).eq('id',x.i.id);if(error)throw error;x.i.qtd_recebida=(+x.i.qtd_recebida||0)+x.q}
    const completo=its.every(i=>(+i.qtd_recebida||0)>=+i.quantidade);
    if(completo)await atualiza(p,{status:'entregue',entregue_em:f.data.value});
    await evento(p,completo?'Entregue':'Recebimento parcial',`${rec.length} ite${rec.length>1?'ns':'m'}${movs.length?' · '+movs.length+' entrada'+(movs.length>1?'s':'')+' no estoque':''}${f.nf.value.trim()?' · NF '+f.nf.value.trim():''}`);
    recarregar();toast(completo?'Entrega concluída e estoque atualizado.':'Recebimento parcial registrado.');await abrirPedido(p.id);render(true)},
  async 'cmp-cancelar'(f){
    const D=await dados();const p=D.ped.find(x=>x.id===f.dataset.id);
    if(p.status==='comprado'&&p.lancamento_id){
      const {data:pg,error:e0}=await sb.from('parcelas').select('id').eq('lancamento_id',p.lancamento_id).eq('status','paga');if(e0)throw e0;
      if(pg.length)return toast('Há parcela paga desta compra: estorne em contas a pagar antes de cancelar.');
      const {error}=await sb.from('lancamentos').delete().eq('id',p.lancamento_id);if(error)throw error;invalidar()}
    await atualiza(p,{status:'cancelado',motivo_cancelamento:f.motivo.value.trim(),lancamento_id:null});
    await evento(p,'Cancelado',f.motivo.value.trim());recarregar();fecharDrawer();toast(`${numPC(p)} cancelado.`);render(true)},
  async 'cmp-produto'(f){
    const emp=f.empresa.value;const min=pv(f.minimo.value);
    const {data,error}=await sb.from('produtos').insert({empresa_id:emp,codigo:f.codigo.value.trim(),nome:f.nome.value.trim(),tipo:'produto',unidade:f.unidade.value.trim()||'UN',controla_estoque:true,estoque_minimo:isNaN(min)?null:min}).select('*').single();
    if(error)throw error;S.produtos.push({id:data.id,empresa_id:emp,codigo:data.codigo,nome:data.nome});recarregar();fecharDrawer();toast('Produto cadastrado.');render(true)},
  async 'cmp-mov'(f){
    const prd=(C.produtos||[]).find(p=>p.id===f.produto.value);const q=pv(f.qtd.value);if(!prd||isNaN(q)||q<=0)return toast('Escolha o produto e a quantidade.');
    const cu=pv(f.custo.value);
    const {error}=await sb.from('estoque_movimentos').insert({empresa_id:prd.empresa_id,produto_id:prd.id,predio_id:f.predio.value||null,data:f.data.value,tipo:f.tipo.value,quantidade:q,custo_unitario:isNaN(cu)?null:cu,observacao:f.obs.value.trim()||null});
    if(error)throw error;recarregar();fecharDrawer();toast('Movimento registrado.');render(true)},
};

// ---------- tela: estoque
async function vEstoque(){
  await dados();const mov=await estoque();
  const prods=(C.produtos||[]).filter(p=>S.empresas.some(e=>e.id===p.empresa_id));
  const ms=mov.filter(m=>naSel(m.empresa_id,m.predio_id));
  const G={};ms.forEach(m=>{const key=m.produto_id+'|'+(m.predio_id||'');const g=G[key]=G[key]||{produto_id:m.produto_id,empresa_id:m.empresa_id,predio_id:m.predio_id,q:0,qe:0,ve:0,ult:null};
    const s=m.tipo==='saida'?-1:1;g.q+=s*(+m.quantidade);if(m.tipo==='entrada'){g.qe+=+m.quantidade;g.ve+=(+m.quantidade)*(+m.custo_unitario||0)}if(!g.ult||m.data>g.ult)g.ult=m.data});
  const linhas=Object.values(G).map(g=>({...g,p:prods.find(x=>x.id===g.produto_id),cm:g.qe?g.ve/g.qe:0})).filter(g=>g.p).sort((a,b)=>a.p.nome.localeCompare(b.p.nome));
  const porProd={};linhas.forEach(g=>porProd[g.produto_id]=(porProd[g.produto_id]||0)+g.q);
  const abaixo=prods.filter(p=>p.estoque_minimo!=null&&(porProd[p.id]||0)<+p.estoque_minimo&&selEmp().some(e=>e.id===p.empresa_id));
  const valor=sum(linhas.map(g=>Math.max(0,g.q)*g.cm));const mes=HOJE.slice(0,7);
  const entMes=ms.filter(m=>m.tipo==='entrada'&&m.data.startsWith(mes));
  const D=await dados();const aCaminho=D.ped.filter(p=>p.status==='comprado'&&naSel(p.empresa_id,p.predio_id));
  const tiles=[['Itens com saldo',String(linhas.filter(g=>g.q>0).length),`<span class="chip mute">${prods.length} produtos cadastrados</span>`,'cestoque','accent'],
    ['Valor em estoque',k(valor),'<span class="chip mute">custo médio</span>','cverba','accent'],
    ['Entradas no mês',k(sum(entMes.map(m=>(+m.quantidade)*(+m.custo_unitario||0)))),`<span class="chip good">${entMes.length} movimento${entMes.length===1?'':'s'}</span>`,'centrega','good'],
    ['Abaixo do mínimo',String(abaixo.length),abaixo.length?'<span class="chip bad">repor</span>':'<span class="chip good">ok</span>','calerta',abaixo.length?'bad':'good'],
    ['Compras a caminho',String(aCaminho.length),`<a href="#compras" class="chip info" style="text-decoration:none">${k(sum(aCaminho.map(p=>+p.valor_aprovado||0)))}</a>`,'compras','warn']];
  const ed=podeEditarAlguma();
  const origem=m=>{if(m.compra_item_id){const it=D.itens.find(i=>i.id===m.compra_item_id);const p=it&&D.ped.find(x=>x.id===it.pedido_id);return p?`<button class="linkbtn small" data-pc="${p.id}">${numPC(p)}</button>`:'Compra'}return m.nf_item_id?'Nota fiscal':'Manual'};
  return `<section class="grid g-tiles">${tiles.map(t=>`<div class="tile"><div class="lbl">${tic(t[3],t[4])}${t[0]}</div><div class="val">${t[1]}</div><div class="cmp">${t[2]}</div></div>`).join('')}</section>
  <div class="panel"><div class="ph"><div><h2>Saldo por produto e unidade</h2><p class="hint">${esc(escopo())} · entradas das compras entregues, notas e movimentos manuais</p></div>
    ${ed?`<div class="acts-row"><button class="btn ghost" data-c="novo-produto">+ Produto</button><button class="btn" data-c="nova-mov">Movimentar estoque</button></div>`:''}</div>
    ${linhas.length?`<div class="tbl-wrap"><table><thead><tr><th>Produto</th><th>Unidade</th><th class="n">Saldo</th><th class="n">Custo médio</th><th class="n">Valor</th><th class="n">Mínimo</th><th>Última mov.</th></tr></thead><tbody>
    ${linhas.map(g=>{const min=g.p.estoque_minimo!=null?+g.p.estoque_minimo:null;const baixo=min!=null&&porProd[g.produto_id]<min;
      return `<tr><td>${esc(g.p.codigo)} · ${esc(g.p.nome)}${S.empresas.length>1?`<span class="unit">${esc(nomeEmp(empresa(g.empresa_id)))}</span>`:''}</td><td>${esc(predio(g.predio_id)?.nome||'Sem prédio')}</td><td class="n ${g.q<0?'neg':''}">${qtd.format(g.q)} ${esc(g.p.unidade||'')}</td><td class="n">${brl2.format(g.cm)}</td><td class="n">${num.format(Math.round(Math.max(0,g.q)*g.cm))}</td><td class="n">${min!=null?qtd.format(min)+(baixo?' <span class="chip bad">baixo</span>':''):'–'}</td><td>${dataBR(g.ult)}</td></tr>`}).join('')}
    <tr class="tot"><td colspan="4">Total</td><td class="n">${num.format(Math.round(valor))}</td><td colspan="2"></td></tr></tbody></table></div>`:`<div class="empty"><b>Estoque vazio</b>As entradas chegam pela esteira de compras (ao registrar a entrega) ou por “Movimentar estoque”.</div>`}</div>
  <div class="panel"><h2>Últimas movimentações</h2><p class="hint">Mais recentes primeiro</p>${ms.length?`<div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th class="n">Qtd</th><th class="n">Custo un.</th><th>Origem</th><th>Observação</th></tr></thead><tbody>
    ${ms.slice(0,40).map(m=>{const p=prods.find(x=>x.id===m.produto_id);return `<tr><td>${dataBR(m.data)}</td><td>${esc(p?.nome||'?')}</td><td><span class="chip ${m.tipo==='entrada'?'good':m.tipo==='saida'?'bad':'mute'}">${m.tipo}</span></td><td class="n">${qtd.format(+m.quantidade)}</td><td class="n">${m.custo_unitario!=null?brl2.format(+m.custo_unitario):'–'}</td><td>${origem(m)}</td><td class="wrap">${esc(m.observacao||'')}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Sem movimentações.</p>'}</div>`;
}
function formProduto(){const emps=S.empresas.filter(e=>podeEditar(e.id));const emp=selEmp().find(e=>podeEditar(e.id))||emps[0];
  abrirSheet(`<h3>Novo produto de estoque</h3><form data-form="cmp-produto" class="form-grid">
  <div class="field wide"><label for="pEmp">Empresa</label><select id="pEmp" name="empresa">${emps.map(e=>`<option value="${e.id}" ${e===emp?'selected':''}>${esc(nomeEmp(e))}</option>`).join('')}</select></div>
  <div class="field"><label for="pCod">Código</label><input id="pCod" name="codigo" required></div><div class="field" style="grid-column:span 2"><label for="pNome">Nome</label><input id="pNome" name="nome" required></div>
  <div class="field"><label for="pUn">Unidade</label><input id="pUn" name="unidade" value="UN"></div><div class="field"><label for="pMin">Estoque mínimo</label><input id="pMin" name="minimo" inputmode="decimal"></div>
  <div class="wide acts-row"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`)}
function formMov(){const prods=(C.produtos||[]).filter(p=>podeEditar(p.empresa_id)&&p.controla_estoque!==false);if(!prods.length)return toast('Cadastre um produto antes.');
  abrirSheet(`<h3>Movimentar estoque</h3><form data-form="cmp-mov" class="form-grid">
  <div class="field wide"><label for="mPrd">Produto</label><select id="mPrd" name="produto">${prods.map(p=>`<option value="${p.id}">${esc(p.codigo)} · ${esc(p.nome)}${S.empresas.length>1?' ('+esc(nomeEmp(empresa(p.empresa_id)))+')':''}</option>`).join('')}</select></div>
  <div class="field"><label for="mTipo">Tipo</label><select id="mTipo" name="tipo"><option value="saida">Saída (consumo/venda)</option><option value="entrada">Entrada</option><option value="ajuste">Ajuste (soma)</option></select></div>
  <div class="field"><label for="mQtd">Quantidade</label><input id="mQtd" name="qtd" inputmode="decimal" required></div><div class="field"><label for="mData">Data</label><input id="mData" name="data" type="date" value="${HOJE}" required></div>
  <div class="field"><label for="mPred">Unidade</label><select id="mPred" name="predio"><option value="">Sem unidade</option>${S.predios.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select></div>
  <div class="field"><label for="mCu">Custo unitário (entrada)</label><input id="mCu" name="custo" inputmode="decimal"></div><div class="field"><label for="mObs">Observação</label><input id="mObs" name="obs"></div>
  <div class="wide acts-row"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`)}

// ---------- eventos próprios do módulo
document.addEventListener('click',async ev=>{
  const pc=ev.target.closest('[data-pc]');if(pc&&!ev.target.closest('[data-c]')){ev.preventDefault();try{await abrirPedido(pc.dataset.pc)}catch(e){console.error(e);toast(traduz(e))}return}
  const b=ev.target.closest('[data-c]');if(!b)return;const a=b.dataset.c;
  try{
    if(a==='novo-pedido')await formPedido();
    else if(a==='ver-cancelados'){C.verOcultos=!C.verOcultos;render(true)}
    else if(a==='abrir')await abrirPedido(b.dataset.id);
    else if(a==='item-add'){const box=document.getElementById('cItens');box.insertAdjacentHTML('beforeend',linhaItem(box.children.length+1));box.lastElementChild.querySelector('input').focus()}
    else if(a==='item-del'){const box=document.getElementById('cItens');if(box.children.length>1){b.closest('[data-item]').remove();totalForm(box.closest('form'))}}
    else if(a==='novo-produto')formProduto();
    else if(a==='nova-mov'){await dados();formMov()}
    else{
      const D=await dados();const p=D.ped.find(x=>x.id===b.dataset.id);if(!p)return;b.disabled=true;
      if(a==='confirmar'){await atualiza(p,{status:'confirmado',confirmado_em:new Date().toISOString(),confirmado_por:quem()});await evento(p,'Pedido confirmado','');recarregar();toast('Pedido confirmado. Agora registre as cotações.');await abrirPedido(p.id);render(true)}
      else if(a==='nova-cotacao')formCotacao(D,p);
      else if(a==='excluir-cotacao'){if(!confirm('Excluir esta cotação?')){b.disabled=false;return}const {error}=await sb.from('compras_cotacoes').delete().eq('id',b.dataset.cot);if(error)throw error;await evento(p,'Cotação excluída','');recarregar();await abrirPedido(p.id);render(true)}
      else if(a==='aprovar')await formAprovar(D,p,b.dataset.cot);
      else if(a==='desaprovar'){await atualiza(p,{status:'cotacao'});await evento(p,'Aprovação desfeita','verba liberada');recarregar();toast('Aprovação desfeita: o pedido voltou para cotação.');await abrirPedido(p.id);render(true)}
      else if(a==='atualizar-entrega')formEntrega(D,p);
      else if(a==='receber')formReceber(D,p);
      else if(a==='cancelar')formCancelar(D,p);
    }
  }catch(e){console.error(e);toast(traduz(e));b.disabled=false}
});
document.addEventListener('input',ev=>{const f=ev.target.form;if(!f)return;if(f.dataset.form==='cmp-pedido')totalForm(f);else if(f.dataset.form==='cmp-cotacao')previewCot(f)});
document.addEventListener('change',ev=>{const t=ev.target;if(t.hasAttribute('data-cmp-emp')){const o=opcoesPedido(t.value),f=t.form;f.predio.innerHTML=o.pred;f.conta.innerHTML=o.contas;f.centro.innerHTML=o.cc;document.getElementById('dlProd').innerHTML=o.prods}});

// ---------- registro no app
delete EM_BREVE.estoque;
const est=ROTAS.find(x=>x[0]==='estoque');if(est)est[2]=0;
const iCtrl=ROTAS.findIndex(x=>x[0]==='g'&&x[1]==='Controle');
if(!ROTAS.some(x=>x[0]==='compras'))ROTAS.splice(iCtrl>=0?iCtrl+1:ROTAS.length,0,['compras','Esteira de compras']);
TITULOS.compras='Esteira de compras';TITULOS.estoque='Estoque';
IC.estoque=IC.estoque||IC.cestoque;
Object.assign(VIEWS,{compras:vCompras,estoque:vEstoque});
Object.assign(FORMS,FORMS_CMP);
USA_EMP.add('compras');USA_EMP.add('estoque');
if(S.user){renderNav(rota());render()}
})();
// pagamentos ao banco (CNAB) ficam em outro arquivo, carregado daqui para não mexer no index.html
if(typeof document!=='undefined'&&!document.querySelector('script[src="pagamentos.js"]')){const s=document.createElement('script');s.src='pagamentos.js';document.body.appendChild(s)}
