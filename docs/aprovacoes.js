// ===================== Aprovações: tabela de alçadas (compra, pagamento e conciliação), pendências e histórico
(()=>{
if(typeof S==='undefined'||typeof ROTAS==='undefined')return;

const PROC={pagamento:['Pagamento ao banco','#pagamentos'],compra:['Compra','#compras'],conciliacao:['Conciliação de extrato','#auditoria']};
const QUEM={master:'Só a conta master',admin:'Administrador da empresa',financeiro:'Financeiro ou administrador'};
IC.aprovacoes='<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>';

// ---------- regras (mesma lógica do banco, para mostrar ou esconder o botão Aprovar)
async function carregarAlcadas(forcar){if(S.alcadas&&!forcar)return S.alcadas;const {data,error}=await sb.from('alcadas').select('*').order('valor_a_partir');S.alcadas=error?[]:data;S._alcadasErro=error?error.message:null;return S.alcadas}
function faixa(emp,proc,valor){return (S.alcadas||[]).filter(a=>a.empresa_id===emp&&a.processo===proc&&a.ativo&&+a.valor_a_partir<=Math.abs(+valor||0)).sort((a,b)=>b.valor_a_partir-a.valor_a_partir)[0]||null}
// devolve null quando a pessoa pode aprovar, ou o motivo de não poder
window.regraAprov=function(emp,proc,valor,solicitante){
  if(S.master)return null;const a=faixa(emp,proc,valor),p=S.papeis?.[emp];
  if(!a){if(proc==='pagamento'&&solicitante&&solicitante===S.user?.id)return 'outra pessoa aprova';return ['admin','financeiro'].includes(p)?null:'sem permissão para aprovar'}
  if(a.outra_pessoa&&solicitante&&solicitante===S.user?.id)return 'outra pessoa aprova';
  if(a.aprovador==='master')return 'só a conta master aprova';
  if(a.aprovador==='admin'&&p!=='admin')return 'o administrador aprova';
  if(a.aprovador==='financeiro'&&!['admin','financeiro'].includes(p))return 'o financeiro aprova';
  return null};
window.quemAprova=function(emp,proc,valor){const a=faixa(emp,proc,valor);if(!a)return proc==='pagamento'?'Outra pessoa com acesso financeiro':'Financeiro ou administrador';return QUEM[a.aprovador]+(a.outra_pessoa?' (não pode ser quem pediu)':'')};

// ---------- dados da tela
async function pendencias(){
  const emps=selEmp().map(e=>e.id);const out=[];
  const [lt,cp,ex]=await Promise.all([
    sb.from('pagamento_lotes').select('id,empresa_id,numero,total,criado_por,criado_por_nome,criado_em,data_pagamento').eq('status','rascunho').in('empresa_id',emps),
    sb.from('compras_pedidos').select('id,empresa_id,numero,titulo,criado_por,solicitante,criado_em').eq('status','cotacao').in('empresa_id',emps),
    sb.from('extratos').select('id,empresa_id,conta_bancaria_id,arquivo_nome,periodo_inicio,periodo_fim,enviado_aprovacao_por,enviado_aprovacao_em').eq('situacao','aguardando_aprovacao').in('empresa_id',emps)]);
  (lt.data||[]).forEach(l=>out.push({proc:'pagamento',id:l.id,emp:l.empresa_id,desc:`Lote ${String(l.numero).padStart(4,'0')} · pagar em ${dataBR(l.data_pagamento)}`,valor:+l.total,quem:l.criado_por_nome||'',solic:l.criado_por,quando:l.criado_em}));
  if(cp.data?.length){const {data:cots}=await sb.from('compras_cotacoes').select('pedido_id,total').in('pedido_id',cp.data.map(p=>p.id));
    cp.data.forEach(p=>{const ts=(cots||[]).filter(c=>c.pedido_id===p.id).map(c=>+c.total);if(!ts.length)return;out.push({proc:'compra',id:p.id,emp:p.empresa_id,desc:`Pedido ${p.numero||''} · ${p.titulo}`,valor:Math.min(...ts),quem:p.solicitante||'',solic:p.criado_por,quando:p.criado_em,extra:`${ts.length} cotaç${ts.length>1?'ões':'ão'}`})})}
  if(ex.data?.length){const {data:ls}=await sb.from('extrato_linhas').select('extrato_id,valor').in('extrato_id',ex.data.map(x=>x.id));
    ex.data.forEach(x=>{const v=sum((ls||[]).filter(l=>l.extrato_id===x.id).map(l=>Math.abs(+l.valor)));const b=banco(x.conta_bancaria_id);
      out.push({proc:'conciliacao',id:x.id,emp:x.empresa_id,desc:`${b?b.banco_nome:'Extrato'} · ${dataBR(x.periodo_inicio)} a ${dataBR(x.periodo_fim)}`,valor:v,quem:'',solic:x.enviado_aprovacao_por,quando:x.enviado_aprovacao_em})})}
  const faltam=[lt,ex].some(r=>r.error&&/relation|column|does not exist|schema cache/i.test(r.error.message));
  return {out,faltam}}

async function vAprovacoes(){
  if(!S.empresas.length)return semEmpresa();
  await carregarAlcadas(true);
  if(S._alcadasErro)return vazio('Falta atualizar o banco','<p style="margin:0">A tabela de aprovações começa a funcionar depois da atualização do banco de dados.</p>');
  const {out}=await pendencias();
  const emps=selEmp();const hist=(await sb.from('aprovacoes').select('*').in('empresa_id',emps.map(e=>e.id)).order('decidido_em',{ascending:false}).limit(60)).data||[];
  const mes=HOJE.slice(0,7),noMes=hist.filter(h=>String(h.decidido_em).slice(0,7)===mes);
  const minhas=out.filter(p=>!regraAprov(p.emp,p.proc,p.valor,p.solic));
  const tile=(l,v,c,cl='')=>`<div class="tile ${cl}"><div class="lbl">${l}</div><div class="val">${v}</div><div class="cmp">${c}</div></div>`;
  const cont=k=>out.filter(p=>p.proc===k);
  const tiles=`<section class="grid g-tiles" style="grid-template-columns:repeat(4,minmax(0,1fr))">
    ${tile('Para você aprovar',minhas.length,minhas.length?brl2.format(sum(minhas.map(p=>p.valor))):'nada pendente')}
    ${['pagamento','compra','conciliacao'].map(k=>tile({pagamento:'Pagamentos ao banco',compra:'Compras',conciliacao:'Conciliações'}[k],cont(k).length,cont(k).length?brl2.format(sum(cont(k).map(p=>p.valor)))+' aguardando':'nenhum aguardando')).join('')}
  </section>`;
  const linhaP=p=>{const motivo=regraAprov(p.emp,p.proc,p.valor,p.solic);
    const ac=!motivo&&p.proc!=='compra'?`<button class="btn sm good" data-apr="aprovar" data-proc="${p.proc}" data-id="${p.id}">Aprovar</button>${p.proc==='conciliacao'?` <button class="btn sm ghost" data-apr="recusar" data-proc="${p.proc}" data-id="${p.id}">Devolver</button>`:''}`:'';
    return `<tr><td><span class="chip ${p.proc==='pagamento'?'warn':p.proc==='compra'?'info':'mute'}">${PROC[p.proc][0]}</span></td><td>${esc(p.desc)}${p.extra?`<span class="unit">${esc(p.extra)}</span>`:''}${S.empresas.length>1?`<span class="unit">${esc(nomeEmp(empresa(p.emp)))}</span>`:''}</td>
      <td class="n">${brl2.format(p.valor)}</td><td style="font-size:12.5px">${esc(p.quem||'–')}${p.quando?`<span class="unit">${dataBR(String(p.quando).slice(0,10))}</span>`:''}</td>
      <td style="font-size:12.5px;min-width:180px">${esc(quemAprova(p.emp,p.proc,p.valor))}${motivo?`<span class="unit">${esc(motivo)}</span>`:''}</td>
      <td style="white-space:nowrap">${ac} <a class="btn sm ghost" href="${PROC[p.proc][1]}">Abrir</a></td></tr>`};
  const pend=`<div class="panel"><div class="ph"><div><h2>Aguardando aprovação</h2><p class="hint">${esc(escopo())} · pagamento só vai para o banco, compra só é feita e conciliação só fecha depois de aprovados aqui ou na própria tela.</p></div></div>
    ${out.length?`<div class="tbl-wrap"><table><thead><tr><th>Processo</th><th>O que é</th><th class="n">Valor</th><th>Pedido por</th><th>Quem aprova</th><th></th></tr></thead><tbody>${out.sort((a,b)=>String(b.quando).localeCompare(String(a.quando))).map(linhaP).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Nada aguardando aprovação.</p>'}</div>`;
  // tabela de alçadas
  if(!S.alcEmp||!S.empresas.some(e=>e.id===S.alcEmp))S.alcEmp=(emps[0]||S.empresas[0]).id;
  const ed=S.master||S.papeis[S.alcEmp]==='admin';
  const rs=(S.alcadas||[]).filter(a=>a.empresa_id===S.alcEmp);
  const tab=`<div class="panel"><div class="ph"><div><h2>Tabela de aprovações</h2><p class="hint">Para cada processo, a partir de qual valor e quem aprova. Vale a faixa de maior valor que o documento alcança. Sem faixa, aprova quem tem acesso financeiro.</p></div>
    <div class="ctrls"><select id="alcEmp" aria-label="Empresa">${S.empresas.map(e=>`<option value="${e.id}" ${e.id===S.alcEmp?'selected':''}>${esc(nomeEmp(e))}</option>`).join('')}</select>${ed?`${rs.length?'':'<button class="btn ghost" data-apr="modelo">Usar modelo recomendado</button>'}<button class="btn" data-apr="nova">Nova faixa</button>`:''}</div></div>
    ${rs.length?`<div class="tbl-wrap"><table><thead><tr><th>Processo</th><th class="n">A partir de</th><th>Quem aprova</th><th>Quem pediu pode aprovar?</th><th>Situação</th><th></th></tr></thead><tbody>
      ${['pagamento','compra','conciliacao'].flatMap(k=>rs.filter(a=>a.processo===k).sort((a,b)=>a.valor_a_partir-b.valor_a_partir)).map(a=>`<tr><td>${PROC[a.processo][0]}</td><td class="n">${brl2.format(+a.valor_a_partir)}</td><td>${QUEM[a.aprovador]}</td><td>${a.outra_pessoa?'Não, outra pessoa aprova':'Sim'}</td><td>${a.ativo?'<span class="chip good">Ativa</span>':'<span class="chip mute">Desligada</span>'}</td>
        <td>${ed?`<button class="linkbtn small" data-apr="editar" data-id="${a.id}">Editar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Nenhuma faixa cadastrada para esta empresa.</p>'}</div>`;
  const histH=`<div class="panel"><h2>Histórico de aprovações</h2><p class="hint">${noMes.length} decis${noMes.length===1?'ão':'ões'} neste mês</p>
    ${hist.length?`<div class="tbl-wrap"><table><thead><tr><th>Quando</th><th>Processo</th><th>O que</th><th class="n">Valor</th><th>Decisão</th><th>Por</th></tr></thead><tbody>
    ${hist.map(h=>`<tr><td class="mono">${dataBR(String(h.decidido_em).slice(0,10))}</td><td>${PROC[h.processo]?.[0]||h.processo}</td><td>${esc(h.descricao||'')}${S.empresas.length>1?`<span class="unit">${esc(nomeEmp(empresa(h.empresa_id)))}</span>`:''}</td><td class="n">${h.valor!=null?brl2.format(+h.valor):'–'}</td><td>${h.decisao==='aprovado'?'<span class="chip good">Aprovado</span>':'<span class="chip bad">Devolvido</span>'}</td><td>${esc(h.decidido_por_nome||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Nenhuma aprovação registrada ainda.</p>'}</div>`;
  return tiles+pend+tab+histH;
}

function formAlcada(id){const a=id?(S.alcadas||[]).find(x=>x.id===id):{processo:'pagamento',valor_a_partir:0,aprovador:'financeiro',outra_pessoa:true,ativo:true};if(!a)return;
  const o=(m,v)=>Object.entries(m).map(([k,n])=>`<option value="${k}" ${k===v?'selected':''}>${esc(Array.isArray(n)?n[0]:n)}</option>`).join('');
  drawer(`<h3>${id?'Editar faixa':'Nova faixa'} · ${esc(nomeEmp(empresa(S.alcEmp)))}</h3>
  <form data-form="alcada" data-id="${id||''}" class="form-grid">
    <div class="field"><label for="alP">Processo</label><select id="alP" name="processo">${o(PROC,a.processo)}</select></div>
    <div class="field"><label for="alV">A partir de (R$)</label><input id="alV" name="valor" inputmode="decimal" value="${fmtIn(+a.valor_a_partir)}"></div>
    <div class="field"><label for="alQ">Quem aprova</label><select id="alQ" name="aprovador">${o(QUEM,a.aprovador)}</select></div>
    <label class="wide chk"><input type="checkbox" name="outra" ${a.outra_pessoa?'checked':''}> Quem pediu não pode aprovar (outra pessoa precisa aprovar)</label>
    <label class="wide chk"><input type="checkbox" name="ativo" ${a.ativo?'checked':''}> Faixa ativa</label>
    <div class="wide" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Salvar</button>${id?`<button type="button" class="btn ghost" data-apr="excluir" data-id="${id}" style="color:var(--bad)">Excluir</button>`:''}<button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`)}
FORMS.alcada=async f=>{const v=parseValor(f.valor.value||'0');if(isNaN(v)||v<0)return toast('Informe um valor válido.');
  const row={empresa_id:S.alcEmp,processo:f.processo.value,valor_a_partir:r2(v),aprovador:f.aprovador.value,outra_pessoa:f.outra.checked,ativo:f.ativo.checked};
  const {error}=f.dataset.id?await sb.from('alcadas').update(row).eq('id',f.dataset.id):await sb.from('alcadas').insert(row);
  if(error){if(/duplicate|unique/i.test(error.message))return toast('Já existe uma faixa com esse valor para esse processo.');throw error}
  fecharDrawer();toast('Tabela de aprovações atualizada.');await carregarAlcadas(true);render(true)};

document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-apr]');if(!b)return;const a=b.dataset.apr;
  try{
    if(a==='nova')formAlcada();
    else if(a==='editar')formAlcada(b.dataset.id);
    else if(a==='excluir'){if(!confirm('Excluir esta faixa da tabela de aprovações?'))return;const {error}=await sb.from('alcadas').delete().eq('id',b.dataset.id);if(error)throw error;fecharDrawer();await carregarAlcadas(true);render(true)}
    else if(a==='modelo'){b.disabled=true;const r=[['pagamento',0,'financeiro',true],['pagamento',10000,'admin',true],['compra',0,'financeiro',false],['compra',10000,'admin',false],['conciliacao',0,'admin',false]]
      .map(([processo,valor_a_partir,aprovador,outra_pessoa])=>({empresa_id:S.alcEmp,processo,valor_a_partir,aprovador,outra_pessoa,ativo:true}));
      const {error}=await sb.from('alcadas').insert(r);if(error)throw error;toast('Modelo recomendado aplicado. Ajuste os valores se quiser.');await carregarAlcadas(true);render(true)}
    else if(a==='aprovar'||a==='recusar'){b.disabled=true;const id=b.dataset.id;
      if(b.dataset.proc==='pagamento'){const {error}=await sb.from('pagamento_lotes').update({status:'aprovado',aprovado_por_nome:S.perfil?.nome||S.user?.email||'',aprovado_em:new Date().toISOString()}).eq('id',id);if(error)throw error;toast('Lote aprovado. Gere a remessa em Pagamentos ao banco.')}
      else if(b.dataset.proc==='conciliacao'){const {error}=await sb.from('extratos').update({situacao:a==='aprovar'?'concluido':'aberto'}).eq('id',id);if(error)throw error;toast(a==='aprovar'?'Conciliação aprovada e concluída.':'Conciliação devolvida para ajustes.')}
      render(true)}
  }catch(e){console.error(e);toast(traduz(e));b.disabled=false}});
document.addEventListener('change',ev=>{if(ev.target.id==='alcEmp'){S.alcEmp=ev.target.value;render(true)}});

// ---------- registro no app: primeira tela do grupo Controle
const iCtrl=ROTAS.findIndex(x=>x[0]==='g'&&x[1]==='Controle');
if(!ROTAS.some(x=>x[0]==='aprovacoes'))ROTAS.splice(iCtrl>=0?iCtrl+1:ROTAS.length,0,['aprovacoes','Aprovações']);
TITULOS.aprovacoes='Aprovações';VIEWS.aprovacoes=vAprovacoes;USA_EMP.add('aprovacoes');
// números no menu: aprovações que esperam por você e boletos novos do e-mail
async function contadores(){if(!S.user||!S.empresas?.length)return;const n={};
  try{const {out}=await pendencias();n.aprovacoes=out.filter(p=>!regraAprov(p.emp,p.proc,p.valor,p.solic)).length}catch(e){}
  try{const {count}=await sb.from('boletos_email').select('id',{count:'exact',head:true}).eq('status','novo').in('empresa_id',S.empresas.map(e=>e.id));n.boletos=count||0}catch(e){}
  const k=JSON.stringify(n);if(k!==S._navK){S._navK=k;S.navCount=n;renderNav(rota())}}
window.atualizaContadores=contadores;
const _carregarAlcadas=carregarAlcadas;
window.carregarAlcadas=async f=>{const r=await _carregarAlcadas(f);setTimeout(contadores,50);return r};
document.addEventListener('click',ev=>{if(ev.target.closest('[data-apr=aprovar],[data-apr=recusar],[data-pg=aprovar],[data-acao=ext-concluir],[data-acao=ext-devolver],[data-acao=ext-enviar]'))setTimeout(contadores,1500)});
if(S.user){window.carregarAlcadas(true);renderNav(rota());render()}
})();
