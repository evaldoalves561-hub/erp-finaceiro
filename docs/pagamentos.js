// ===================== Pagamentos a fornecedores por arquivo CNAB 240 (layout padrão FEBRABAN)
// Parcelas a pagar -> lote -> aprovação -> arquivo de remessa -> internet banking -> arquivo de retorno -> baixa.

// ---------- motor CNAB 240 (funções puras; também usadas pelo teste em Node)
const CNAB240=(()=>{
  const tira=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().replace(/[^A-Z0-9 .,\/\-@&_+]/g,' ');
  const A=(s,n)=>tira(s).slice(0,n).padEnd(n,' ');
  const N=(v,n)=>String(v??'').replace(/\D/g,'').slice(-n).padStart(n,'0');
  const V=(v,n)=>N(Math.round(Math.abs(+v||0)*100),n);
  const D=iso=>iso?iso.slice(8,10)+iso.slice(5,7)+iso.slice(0,4):'00000000';
  const B=n=>' '.repeat(n),Z=n=>'0'.repeat(n);
  const reg=(...p)=>{const s=p.join('');if(s.length!==240)throw new Error(`Registro CNAB com ${s.length} posições (${s.slice(7,8)}${s.slice(13,14)})`);return s};
  const addD=(iso,d)=>{const t=new Date(iso+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+d);return t.toISOString().slice(0,10)};
  const dif=(a,b)=>Math.abs((new Date(a+'T12:00:00Z')-new Date(b+'T12:00:00Z'))/864e5);
  // linha digitável (47) ou código de barras (44) de boleto bancário
  function barras(t){const d=String(t??'').replace(/\D/g,'');
    if(d.length===44)return d;
    if(d.length===47)return d.slice(0,4)+d[32]+d.slice(33,47)+d.slice(4,9)+d.slice(10,20)+d.slice(21,31);
    return null}
  function dvOk(b){const s=b.slice(0,4)+b.slice(5);let soma=0,p=2;for(let i=s.length-1;i>=0;i--){soma+=(+s[i])*p;p=p===9?2:p+1}let dv=11-soma%11;if(dv===0||dv>9)dv=1;return dv===+b[4]}
  function boleto(t,hoje){const b=barras(t);if(!b)return {erro:'Informe os 47 números da linha digitável ou os 44 do código de barras.'};
    if(b[0]==='8')return {erro:'Conta de consumo ou tributo (começa com 8): ainda não entra no arquivo de pagamentos.'};
    if(!dvOk(b))return {erro:'Código de barras com dígito verificador inválido. Confira a digitação.'};
    const fator=+b.slice(5,9);let venc=null;
    if(fator){const c=[addD('1997-10-07',fator),addD('2022-05-29',fator)];venc=c.sort((x,y)=>dif(x,hoje)-dif(y,hoje))[0]}
    return {barras:b,banco:b.slice(0,3),valor:+b.slice(9,19)/100,venc}}
  // forma de lançamento do lote (G029) por item
  function forma(it,bancoConta){
    if(it.modalidade==='boleto')return it.barras.slice(0,3)===bancoConta?'30':'31';
    if(it.modalidade==='pix')return '45';
    if(it.modalidade==='credito_conta')return '01';
    return '41'}
  const tipoInsc=doc=>String(doc||'').replace(/\D/g,'').length===11?'1':'2';
  const pixIni={telefone:'01',email:'02',cpf_cnpj:'03',aleatoria:'04'};
  // emp:{cnpj,nome}; conta:{banco,bancoNome,agencia,agencia_dv,conta,conta_dv,convenio}; itens:[{seu,modalidade,valor,data,barras,venc,valorTitulo,fav:{nome,doc,banco,agencia,agencia_dv,conta,conta_dv,pix_tipo,pix_chave}}]
  function remessa({emp,conta,nsa,agora,itens}){
    const bc=N(conta.banco,3),ag=N(conta.agencia,5),agdv=A(conta.agencia_dv,1),cc=N(conta.conta,12),ccdv=A(conta.conta_dv,1),conv=A(conta.convenio,20),cnpj=N(emp.cnpj,14);
    const empresaConta=()=>['2',cnpj,conv,ag,agdv,cc,ccdv,B(1),A(emp.nome,30)].join('');
    const dt=agora||new Date();const hoje=dt.toISOString().slice(0,10);const hora=dt.toISOString().slice(11,19).replace(/:/g,'');
    const L=[];
    L.push(reg(bc,'0000','0',B(9),empresaConta(),A(conta.bancoNome,30),B(10),'1',D(hoje),hora,N(nsa,6),'089','01600',B(20),B(20),B(29)));
    const grupos={};itens.forEach(it=>{const f=forma(it,bc);(grupos[f]=grupos[f]||[]).push(it)});
    let nLote=0,nRegs=1;
    for(const [f,its] of Object.entries(grupos)){
      nLote++;const lt=N(nLote,4);const j=f==='30'||f==='31';let seq=0;const det=[];
      for(const it of its){
        const fv=it.fav||{};
        if(j){
          det.push(reg(bc,lt,'3',N(++seq,5),'J','0','00',it.barras,A(fv.nome,30),D(it.venc||it.data),V(it.valorTitulo??it.valor,15),Z(15),Z(15),D(it.data),V(it.valor,15),Z(15),A(it.seu,20),B(20),'09',B(6),B(10)));
          det.push(reg(bc,lt,'3',N(++seq,5),'J',' ','00','52',tipoInsc(emp.cnpj),N(emp.cnpj,15),A(emp.nome,40),tipoInsc(fv.doc),N(fv.doc,15),A(fv.nome,40),'0',Z(15),B(40),B(53)));
        }else{
          const pix=f==='45';const camara=pix?'009':f==='01'?'000':'018';
          const comConta=!pix||!fv.pix_chave;
          det.push(reg(bc,lt,'3',N(++seq,5),'A','0','00',camara,comConta?N(fv.banco,3):Z(3),comConta?N(fv.agencia,5):Z(5),comConta?A(fv.agencia_dv,1):B(1),comConta?N(fv.conta,12):Z(12),comConta?A(fv.conta_dv,1):B(1),B(1),A(fv.nome,30),A(it.seu,20),D(it.data),'BRL',Z(15),V(it.valor,15),B(20),Z(8),Z(15),B(40),B(2),f==='41'?'00010':B(5),f==='41'?'CC':B(2),B(3),'0',B(10)));
          const ini=pix?(fv.pix_chave?(pixIni[fv.pix_tipo]||'04'):'05'):'   ';
          det.push(reg(bc,lt,'3',N(++seq,5),'B',pix?A(ini,2)+' ':B(3),tipoInsc(fv.doc),N(fv.doc,14),B(95),pix&&fv.pix_chave?String(fv.pix_chave).trim().slice(0,99).padEnd(99,' '):B(99),B(14)));
        }
      }
      L.push(reg(bc,lt,'1','C','20',f,j?'040':'045',B(1),empresaConta(),B(40),B(30),Z(5),B(15),B(20),Z(5),B(3),B(2),'01',B(6),B(10)));
      L.push(...det);
      L.push(reg(bc,lt,'5',B(9),N(det.length+2,6),V(its.reduce((s,x)=>s+(+x.valor),0),18),Z(18),Z(6),B(165),B(10)));
      nRegs+=det.length+2;
    }
    nRegs++;L.push(reg(bc,'9999','9',B(9),N(nLote,6),N(nRegs,6),Z(6),B(205)));
    return L.join('\r\n')+'\r\n';
  }
  const OCORR={'00':'Pago','01':'Saldo insuficiente','02':'Cancelado pelo pagador','03':'Débito autorizado pela agência','BD':'Agendado (inclusão aceita)','BE':'Alteração aceita','BF':'Exclusão aceita',
    'AA':'Controle inválido','AB':'Tipo de operação inválido','AC':'Tipo de serviço inválido','AD':'Forma de lançamento inválida','AE':'Tipo ou número de inscrição inválido','AF':'Convênio inválido',
    'AG':'Agência, conta ou dígito da empresa inválido','AH':'Sequencial do registro inválido','AI':'Segmento inválido','AJ':'Tipo de movimento inválido','AK':'Câmara de compensação inválida',
    'AL':'Banco do favorecido inválido','AM':'Agência do favorecido inválida','AN':'Conta do favorecido inválida','AO':'Nome do favorecido não informado','AP':'Data do pagamento inválida',
    'AQ':'Tipo ou quantidade de moeda inválido','AR':'Valor do pagamento inválido','AS':'Aviso ao favorecido inválido','AT':'CPF/CNPJ do favorecido inválido','HA':'Lote não aceito','HB':'Inscrição da empresa inválida',
    'HC':'Convênio com a empresa inexistente','HD':'Agência ou conta da empresa sem saldo','HE':'Tipo de serviço inválido para o contrato','IA':'Remetente/favorecido não identificado',
    'PA':'Chave PIX não encontrada','PB':'Chave PIX inválida','TA':'Lote não aceito: totais divergentes','YA':'Título não encontrado','ZA':'Agência ou conta do favorecido substituída',
    'ZI':'Beneficiário divergente','ZK':'Boleto já liquidado'};
  const txtOcorr=s=>(s.match(/.{1,2}/g)||[]).filter(c=>c.trim()).map(c=>`${c} ${OCORR[c]||'código do banco'}`).join('; ');
  function situacao(oc){const c=(oc.match(/.{1,2}/g)||[]).map(x=>x.trim()).filter(Boolean);if(c.includes('00')||c.includes('03'))return 'pago';if(c.length&&c.every(x=>['BD','BE'].includes(x)))return 'agendado';return c.length?'rejeitado':'agendado'}
  function retorno(txt){
    const ls=String(txt).split(/\r?\n/).filter(l=>l.length>=240);
    if(!ls.length||ls[0][7]!=='0')throw new Error('Arquivo de retorno inválido: não começa com o header CNAB 240.');
    const iso=s=>/^\d{8}$/.test(s)&&s!=='00000000'?s.slice(4,8)+'-'+s.slice(2,4)+'-'+s.slice(0,2):null;
    const out={banco:ls[0].slice(0,3),codigo:ls[0][142],nsa:+ls[0].slice(157,163),lotes:[],itens:[]};
    for(const l of ls){
      if(l[7]==='1'){const oc=l.slice(230,240).trim();if(oc&&!/^(00|BD)/.test(oc))out.lotes.push({lote:l.slice(3,7),ocorr:oc,txt:txtOcorr(oc)})}
      if(l[7]!=='3')continue;const seg=l[13];
      if(seg==='A'){const oc=l.slice(230,240).trim();out.itens.push({seu:l.slice(73,93).trim(),data:iso(l.slice(154,162))||iso(l.slice(93,101)),valor:+l.slice(162,177)/100||+l.slice(119,134)/100,ocorr:oc,txt:txtOcorr(oc),status:situacao(oc)})}
      else if(seg==='J'&&!(l.slice(17,19)==='52'&&!l.slice(187,240).trim())){const oc=l.slice(230,240).trim();out.itens.push({seu:l.slice(182,202).trim(),data:iso(l.slice(144,152)),valor:+l.slice(152,167)/100,ocorr:oc,txt:txtOcorr(oc),status:situacao(oc)})}
    }
    return out;
  }
  return {remessa,retorno,boleto,barras,forma,txtOcorr,OCORR};
})();
if(typeof module!=='undefined')module.exports=CNAB240;

// ---------- tela (só no navegador, dentro do app)
if(typeof window!=='undefined'&&typeof S!=='undefined'&&typeof ROTAS!=='undefined')(()=>{
Object.assign(IC,{
 pagamentos:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
 premessa:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
 pretorno:'<path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
 plote:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
});
const P={emp:null,conta:null,ate:null,parc:null,parceiros:null,lotes:null,itens:null,marcadas:new Set()};
const MOD={boleto:['Boleto','info'],pix:['PIX','good'],ted:['TED','mute'],credito_conta:['Crédito em conta','mute']};
const STL={rascunho:['Rascunho','mute'],aprovado:['Aprovado','info'],remessa_gerada:['Remessa gerada','warn'],processado:['Processado','good'],cancelado:['Cancelado','bad']};
const STI={pendente:['Aguardando retorno','mute'],agendado:['Agendado','info'],pago:['Pago','good'],rejeitado:['Rejeitado','bad']};
const chip=(m,k)=>m[k]?`<span class="chip ${m[k][1]}">${m[k][0]}</span>`:'';
const quem=()=>S.perfil?.nome||S.user?.email||'';
const tic=(ic,cor)=>`<span class="tic tic-${cor}">${icone(ic,15)}</span>`;
const pv=v=>{const t=String(v??'').trim();return t?parseCel(t):NaN};
async function carregar(forcar){
  if(forcar||!P.parc){
    const [pa,pr,lo,it]=await Promise.all([
      todos(()=>sb.from('parcelas').select('id,empresa_id,lancamento_id,numero,vencimento,valor,status,codigo_barras,modalidade_pgto,lancamentos(parceiro_id,descricao,predio_id)').eq('status','aberta').order('vencimento')),
      todos(()=>sb.from('parceiros').select('*').order('nome')),
      todos(()=>sb.from('pagamento_lotes').select('*').order('criado_em',{ascending:false})),
      todos(()=>sb.from('pagamento_itens').select('*'))]);
    P.parc=pa.filter(p=>+p.valor<0);P.parceiros=pr;P.lotes=lo;P.itens=it;
  }
}
const recarregar=async()=>{await carregar(true);invalidar();render(true)};
const fav=p=>P.parceiros.find(x=>x.id===p.lancamentos?.parceiro_id);
const contaPag=()=>S.bancos.find(b=>b.id===P.conta);
function modalidadeDe(p,f,bc){if(p.modalidade_pgto)return p.modalidade_pgto;if(p.codigo_barras)return 'boleto';if(f?.pix_chave)return 'pix';if(f?.conta)return f.banco_codigo&&bc&&f.banco_codigo.padStart(3,'0')===bc.padStart(3,'0')?'credito_conta':'ted';return null}
function pendencias(p,f,m){const x=[];
  if(!f)return ['sem fornecedor no lançamento'];
  if(!m)x.push('sem forma de pagamento');
  if(m==='boleto'&&!p.codigo_barras)x.push('falta código de barras');
  if(m==='pix'&&!f.pix_chave&&!f.conta)x.push('falta chave PIX');
  if((m==='ted'||m==='credito_conta')&&!(f.banco_codigo&&f.agencia&&f.conta))x.push('faltam banco, agência e conta');
  if(m!=='boleto'&&String(f.documento||'').replace(/\D/g,'').length<11)x.push('falta CPF/CNPJ');
  if(m!=='boleto'&&!f.dados_pgto_conferidos)x.push('dados bancários não conferidos');
  return x}
const emLote=()=>{const ativos=new Set(P.lotes.filter(l=>l.status!=='cancelado').map(l=>l.id));return new Set(P.itens.filter(i=>ativos.has(i.lote_id)&&i.status!=='rejeitado').map(i=>i.parcela_id))};

async function vPagamentos(){
  await carregar();
  const emps=S.empresas.filter(e=>selEmp().some(x=>x.id===e.id));
  if(!emps.some(e=>e.id===P.emp))P.emp=(emps[0]||S.empresas[0])?.id;
  const bancos=S.bancos.filter(b=>b.empresa_id===P.emp);
  if(!bancos.some(b=>b.id===P.conta))P.conta=bancos[0]?.id||null;
  P.ate=P.ate||addDias(HOJE,7);
  const cb=contaPag();const bc=cb?.banco_codigo||'';
  const bloqueadas=emLote();
  const lista=P.parc.filter(p=>p.empresa_id===P.emp&&p.vencimento<=P.ate&&!bloqueadas.has(p.id)).map(p=>{const f=fav(p);const m=modalidadeDe(p,f,bc);return {p,f,m,pend:pendencias(p,f,m)}});
  [...P.marcadas].forEach(id=>{if(!lista.some(x=>x.p.id===id&&!x.pend.length))P.marcadas.delete(id)});
  const sel=lista.filter(x=>P.marcadas.has(x.p.id));const totSel=sum(sel.map(x=>-x.p.valor));
  const lotes=P.lotes.filter(l=>selEmp().some(e=>e.id===l.empresa_id));
  const itensDe=l=>P.itens.filter(i=>i.lote_id===l.id);
  const mes=HOJE.slice(0,7);const pagosMes=P.itens.filter(i=>i.status==='pago'&&(i.data_efetiva||'').startsWith(mes)&&lotes.some(l=>l.id===i.lote_id));
  const rej=P.itens.filter(i=>i.status==='rejeitado'&&lotes.some(l=>l.id===i.lote_id&&l.status!=='cancelado'));
  const vencidas=lista.filter(x=>x.p.vencimento<HOJE);
  const tiles=[['A pagar até '+dataBR(P.ate),k(sum(lista.map(x=>-x.p.valor))),`<span class="chip ${vencidas.length?'bad':'mute'}">${vencidas.length?vencidas.length+' vencida'+(vencidas.length>1?'s':''):lista.length+' parcela'+(lista.length===1?'':'s')}</span>`,'contas','warn'],
    ['Lotes para aprovar',String(lotes.filter(l=>l.status==='rascunho').length),'<span class="chip mute">quem cria não aprova</span>','caprov','accent'],
    ['Aguardando retorno',String(lotes.filter(l=>l.status==='remessa_gerada').length),'<span class="chip info">remessas enviadas</span>','pretorno','accent'],
    ['Pago pelo banco no mês',k(sum(pagosMes.map(i=>+i.valor_efetivo||+i.valor))),`<span class="chip good">${pagosMes.length} pagamento${pagosMes.length===1?'':'s'}</span>`,'pagamentos','good'],
    ['Rejeitados',String(rej.length),rej.length?'<span class="chip bad">corrigir e reenviar</span>':'<span class="chip good">nenhum</span>','calerta',rej.length?'bad':'good']];
  const ed=podeEditar(P.emp);
  const avisoConta=!cb?'<div class="msg err">Cadastre a conta bancária pagadora em Empresas e unidades.</div>':!cb.banco_codigo?`<div class="msg err">A conta ${esc(bancoTxt(cb))} está sem o código do banco (PicPay = 380). <button class="linkbtn small" data-pg="conta-cnab">Completar</button></div>`:!cb.convenio_pagamento?`<div class="msg err" style="background:var(--warn-soft);color:var(--warn)">Sem código de convênio de pagamentos nesta conta. Muitos bancos exigem; peça ao banco. <button class="linkbtn small" data-pg="conta-cnab">Informar</button></div>`:'';
  return `<section class="grid g-tiles">${tiles.map(t=>`<div class="tile"><div class="lbl">${tic(t[3],t[4])}${t[0]}</div><div class="val">${t[1]}</div><div class="cmp">${t[2]}</div></div>`).join('')}</section>
  <div class="panel"><div class="ph"><div><h2>Parcelas a pagar</h2><p class="hint">Marque o que vai pagar, crie o lote, aprove e gere o arquivo de remessa para enviar no internet banking.</p></div>
    <div class="acts-row"><select id="pgEmp" aria-label="Empresa">${emps.map(e=>`<option value="${e.id}" ${e.id===P.emp?'selected':''}>${esc(nomeEmp(e))}</option>`).join('')}</select>
      <select id="pgConta" aria-label="Conta pagadora">${bancos.map(b=>`<option value="${b.id}" ${b.id===P.conta?'selected':''}>${esc(bancoTxt(b))}</option>`).join('')||'<option value="">Sem conta bancária</option>'}</select>
      <label class="muted" style="font-size:12.5px;display:flex;gap:6px;align-items:center">vencendo até <input type="date" id="pgAte" value="${P.ate}" style="font:inherit;border:1px solid var(--line);border-radius:6px;padding:5px 8px;background:var(--surface);color:var(--ink)"></label></div></div>
    ${avisoConta}
    ${lista.length?`<div class="tbl-wrap"><table><thead><tr><th><input type="checkbox" data-pg="todas" aria-label="Marcar todas" ${sel.length&&sel.length===lista.filter(x=>!x.pend.length).length?'checked':''}></th><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Forma</th><th class="n">Valor</th><th>Situação</th></tr></thead><tbody>
      ${lista.map(({p,f,m,pend})=>`<tr><td><input type="checkbox" data-pgsel="${p.id}" ${P.marcadas.has(p.id)?'checked':''} ${pend.length||!ed?'disabled':''} aria-label="Pagar parcela"></td><td>${dataBR(p.vencimento)}${p.vencimento<HOJE?' <span class="chip bad">vencida</span>':''}</td><td>${esc(f?.nome||'–')}</td><td class="wrap">${esc(p.lancamentos?.descricao||'')}${p.numero>1?` · parc. ${p.numero}`:''}</td><td>${chip(MOD,m)||'–'}</td><td class="n">${brl2.format(-p.valor)}</td>
        <td>${pend.length?`<span class="chip warn" title="${esc(pend.join(', '))}">${esc(pend[0])}${pend.length>1?' +'+(pend.length-1):''}</span>`:'<span class="chip good">pronto</span>'} ${ed?`<button class="linkbtn small" data-pg="dados" data-id="${p.id}">${pend.length?'Completar':'Editar'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>
      <div class="acts-row" style="margin-top:12px;justify-content:space-between"><span class="muted">${sel.length} marcada${sel.length===1?'':'s'} · <b class="mono">${brl2.format(totSel)}</b></span>${ed?`<div class="acts-row"><label class="muted" style="font-size:12.5px">Data do pagamento <input type="date" id="pgData" value="${HOJE}" style="font:inherit;border:1px solid var(--line);border-radius:6px;padding:5px 8px;background:var(--surface);color:var(--ink)"></label><button class="btn" data-pg="criar-lote" ${sel.length&&cb?.banco_codigo?'':'disabled'}>${icone('plote',15)} Criar lote</button></div>`:''}</div>`
    :'<div class="empty"><b>Nada a pagar neste período</b>Troque a data "vencendo até" ou a empresa.</div>'}
  </div>
  <div class="panel"><div class="ph"><div><h2>Lotes de pagamento</h2><p class="hint">O banco só paga depois que você enviar o arquivo e autorizar no internet banking. O retorno do banco dá baixa nas parcelas pagas.</p></div>
    ${ed?`<label class="btn ghost" style="cursor:pointer">${icone('pretorno',15)} Ler arquivo de retorno<input type="file" id="pgRet" accept=".ret,.txt,.RET,.TXT,text/plain" hidden></label>`:''}</div>
    ${lotes.length?`<div class="tbl-wrap"><table><thead><tr><th>Lote</th><th>Conta</th><th>Pagamento</th><th class="n">Itens</th><th class="n">Total</th><th>Situação</th><th>Criado / aprovado</th><th></th></tr></thead><tbody>
      ${lotes.map(l=>{const its=itensDe(l);const pg=its.filter(i=>i.status==='pago').length,rj=its.filter(i=>i.status==='rejeitado').length;const b=banco(l.conta_bancaria_id);const mesmo=l.criado_por===S.user?.id;
        const mot=typeof regraAprov==='function'?regraAprov(l.empresa_id,'pagamento',+l.total,l.criado_por):(mesmo&&!S.master?'outra pessoa aprova':null);
        const acao=l.status==='rascunho'?(mot?`<span class="muted" style="font-size:12px">${esc(mot)}</span>`:`<button class="btn sm good" data-pg="aprovar" data-id="${l.id}">Aprovar</button>`):l.status==='aprovado'?`<button class="btn sm" data-pg="remessa" data-id="${l.id}">${icone('premessa',14)} Gerar remessa</button>`:l.status==='remessa_gerada'||l.status==='processado'?`<button class="btn sm ghost" data-pg="baixar" data-id="${l.id}">${icone('premessa',14)} Arquivo</button>`:'';
        return `<tr class="click" data-pglote="${l.id}"><td class="mono">${String(l.numero).padStart(4,'0')}</td><td>${esc(b?bancoTxt(b):'')}</td><td>${dataBR(l.data_pagamento)}</td><td class="n">${its.length}${pg||rj?`<span class="unit">${pg} pago${pg===1?'':'s'}${rj?' · '+rj+' rejeitado'+(rj>1?'s':''):''}</span>`:''}</td><td class="n">${brl2.format(+l.total)}</td><td>${chip(STL,l.status)}</td><td style="font-size:12.5px">${esc(l.criado_por_nome||'')}${l.aprovado_por_nome?`<span class="unit">aprovado: ${esc(l.aprovado_por_nome)}</span>`:''}</td><td>${ed?acao:''}</td></tr>`}).join('')}</tbody></table></div>`:'<p class="muted">Nenhum lote ainda.</p>'}
  </div>`;
}
function abrirLote(id){
  const l=P.lotes.find(x=>x.id===id);if(!l)return;const its=P.itens.filter(i=>i.lote_id===l.id);const ed=podeEditar(l.empresa_id);
  drawer(`<div class="ph" style="margin:0"><div><h3>Lote ${String(l.numero).padStart(4,'0')} · ${brl2.format(+l.total)}</h3><p class="muted" style="margin:4px 0 0;font-size:12.5px">${esc(bancoTxt(banco(l.conta_bancaria_id)))} · pagamento em ${dataBR(l.data_pagamento)}</p></div><div class="acts-row">${chip(STL,l.status)}<button class="btn ghost sm" data-acao="fechar">Fechar</button></div></div>
    <div class="kv"><div><small>Criado por</small><span>${esc(l.criado_por_nome||'–')}</span></div><div><small>Aprovado por</small><span>${esc(l.aprovado_por_nome||'–')}</span></div><div><small>Remessa</small><span>${esc(l.remessa_nome||'–')}</span></div><div><small>Retorno</small><span>${esc(l.retorno_nome||'–')}</span></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Favorecido</th><th>Forma</th><th class="n">Valor</th><th>Situação</th><th>Banco</th></tr></thead><tbody>${its.map(i=>`<tr><td>${esc(i.favorecido||'')}<span class="unit mono">${esc(i.seu_numero)}</span></td><td>${chip(MOD,i.modalidade)}</td><td class="n">${brl2.format(+i.valor)}${i.valor_efetivo!=null&&+i.valor_efetivo!==+i.valor?`<span class="unit">pago ${brl2.format(+i.valor_efetivo)}</span>`:''}</td><td>${chip(STI,i.status)}${i.data_efetiva?`<span class="unit">${dataBR(i.data_efetiva)}</span>`:''}</td><td class="wrap" style="font-size:12px">${esc(i.ocorrencias_txt||'')}</td></tr>`).join('')}</tbody></table></div>
    ${ed&&['rascunho','aprovado','remessa_gerada'].includes(l.status)?`<div class="acts-row"><button class="btn ghost sm" data-pg="cancelar-lote" data-id="${l.id}">Cancelar lote</button><span class="muted" style="font-size:12px">${l.status==='remessa_gerada'?'Só cancele se o arquivo não foi enviado ao banco ou se você cancelou lá também.':'As parcelas voltam para a lista de pagamento.'}</span></div>`:''}`);
}
function formDados(pid){
  const p=P.parc.find(x=>x.id===pid);const f=fav(p);const cb=contaPag();const m=modalidadeDe(p,f,cb?.banco_codigo);
  drawer(`<h3>Dados de pagamento</h3><p class="muted" style="margin:0">${esc(f?.nome||'Lançamento sem fornecedor')} · ${brl2.format(-p.valor)} · vence ${dataBR(p.vencimento)}</p>
  ${f?`<form data-form="pg-dados" data-id="${p.id}" class="form-grid">
    <div class="field"><label for="dMod">Forma de pagamento</label><select id="dMod" name="modalidade">${Object.entries(MOD).map(([k_,v])=>`<option value="${k_}" ${k_===m?'selected':''}>${v[0]}</option>`).join('')}</select></div>
    <div class="field" style="grid-column:span 2"><label for="dBar">Boleto: linha digitável ou código de barras</label><input id="dBar" name="barras" inputmode="numeric" value="${esc(p.codigo_barras||'')}"><small class="muted" id="dBarInfo"></small></div>
    <div class="wide" style="border-top:1px solid var(--line);padding-top:10px"><b style="font-size:13px">Fornecedor (vale para todas as parcelas dele)</b></div>
    <div class="field"><label for="dDoc">CPF/CNPJ</label><input id="dDoc" name="doc" value="${esc(f.documento||'')}"></div>
    <div class="field"><label for="dPixT">Tipo de chave PIX</label><select id="dPixT" name="pixtipo"><option value="">–</option>${[['cpf_cnpj','CPF/CNPJ'],['email','E-mail'],['telefone','Telefone'],['aleatoria','Aleatória']].map(([a,b])=>`<option value="${a}" ${f.pix_tipo===a?'selected':''}>${b}</option>`).join('')}</select></div>
    <div class="field"><label for="dPix">Chave PIX</label><input id="dPix" name="pix" value="${esc(f.pix_chave||'')}"></div>
    <div class="field"><label for="dBco">Banco (código)</label><input id="dBco" name="banco" inputmode="numeric" maxlength="3" placeholder="341" value="${esc(f.banco_codigo||'')}"></div>
    <div class="field"><label for="dAg">Agência e dígito</label><div style="display:flex;gap:6px"><input id="dAg" name="agencia" inputmode="numeric" value="${esc(f.agencia||'')}"><input name="agdv" aria-label="Dígito da agência" style="width:52px" maxlength="1" value="${esc(f.agencia_dv||'')}"></div></div>
    <div class="field"><label for="dCc">Conta e dígito</label><div style="display:flex;gap:6px"><input id="dCc" name="conta" inputmode="numeric" value="${esc(f.conta||'')}"><input name="ccdv" aria-label="Dígito da conta" style="width:52px" maxlength="2" value="${esc(f.conta_dv||'')}"></div></div>
    <label class="wide ck" style="padding:0"><input type="checkbox" name="conferido" ${f.dados_pgto_conferidos?'checked':''}> Conferi os dados bancários com o fornecedor (por telefone ou documento). Se alguém mudar estes dados, a conferência é desfeita.</label>
    <div class="wide acts-row"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`:'<div class="msg err">O lançamento desta parcela não tem fornecedor. Edite o lançamento e informe o fornecedor.</div>'}`);
  infoBarras();
}
function infoBarras(){const i=document.getElementById('dBar');const o=document.getElementById('dBarInfo');if(!i||!o)return;if(!i.value.trim()){o.textContent='';return}const b=CNAB240.boleto(i.value,HOJE);o.textContent=b.erro||`Banco ${b.banco} · ${brl2.format(b.valor)}${b.venc?' · vence '+dataBR(b.venc):''}`;o.style.color=b.erro?'var(--bad)':'var(--good)'}
function formContaCnab(){const b=contaPag();if(!b)return;
  drawer(`<h3>Conta pagadora para CNAB</h3><p class="muted" style="margin:0">${esc(bancoTxt(b))}</p><form data-form="pg-conta" class="form-grid">
  <div class="field"><label for="cbB">Código do banco</label><input id="cbB" name="banco" inputmode="numeric" maxlength="3" placeholder="380" value="${esc(b.banco_codigo||'')}"></div>
  <div class="field"><label for="cbAd">Dígito da agência</label><input id="cbAd" name="agdv" maxlength="1" value="${esc(b.agencia_dv||'')}"></div>
  <div class="field"><label for="cbCd">Dígito da conta</label><input id="cbCd" name="ccdv" maxlength="2" value="${esc(b.conta_dv||'')}"></div>
  <div class="field wide"><label for="cbCv">Convênio de pagamentos (fornecido pelo banco)</label><input id="cbCv" name="convenio" value="${esc(b.convenio_pagamento||'')}"></div>
  <div class="wide acts-row"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`)}

function baixarArquivo(nome,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
async function criarLote(){
  const cb=contaPag();const data=document.getElementById('pgData')?.value||HOJE;
  const bc=cb.banco_codigo;const sel=P.parc.filter(p=>P.marcadas.has(p.id));
  const numero=(+cb.cnab_sequencial||0)+1;
  const total=r2(sum(sel.map(p=>-p.valor)));
  const {data:l,error}=await sb.from('pagamento_lotes').insert({empresa_id:P.emp,conta_bancaria_id:cb.id,numero,data_pagamento:data,total,status:'rascunho',criado_por_nome:quem()}).select('*').single();if(error)throw error;
  const {error:e1}=await sb.from('contas_bancarias').update({cnab_sequencial:numero}).eq('id',cb.id);if(e1)throw e1;cb.cnab_sequencial=numero;
  const rows=sel.map((p,i)=>{const f=fav(p);return {empresa_id:P.emp,lote_id:l.id,parcela_id:p.id,seu_numero:`L${String(numero).padStart(5,'0')}I${String(i+1).padStart(4,'0')}`,modalidade:modalidadeDe(p,f,bc),valor:r2(-p.valor),favorecido:f?.nome,documento:f?.documento,status:'pendente'}});
  const {error:e2}=await sb.from('pagamento_itens').insert(rows);if(e2){await sb.from('pagamento_lotes').delete().eq('id',l.id);throw e2}
  P.marcadas.clear();toast(`Lote ${String(numero).padStart(4,'0')} criado com ${rows.length} pagamento${rows.length>1?'s':''}. Agora ele precisa ser aprovado.`);await recarregar();
}
async function gerarRemessa(id){
  const l=P.lotes.find(x=>x.id===id);const cb=banco(l.conta_bancaria_id);const e=empresa(l.empresa_id);const its=P.itens.filter(i=>i.lote_id===l.id&&i.status!=='rejeitado');
  const itens=its.map(i=>{const p=P.parc.find(x=>x.id===i.parcela_id);const f=p?fav(p):P.parceiros.find(x=>x.nome===i.favorecido&&x.empresa_id===l.empresa_id);
    const bol=i.modalidade==='boleto'?CNAB240.boleto(p?.codigo_barras,l.data_pagamento):null;if(bol?.erro)throw new Error(`${i.favorecido}: ${bol.erro}`);
    return {seu:i.seu_numero,modalidade:i.modalidade,valor:+i.valor,data:l.data_pagamento,barras:bol?.barras,venc:bol?.venc,valorTitulo:bol?.valor||+i.valor,
      fav:{nome:f?.nome||i.favorecido,doc:f?.documento||i.documento,banco:f?.banco_codigo,agencia:f?.agencia,agencia_dv:f?.agencia_dv,conta:f?.conta,conta_dv:f?.conta_dv,pix_tipo:f?.pix_tipo,pix_chave:f?.pix_chave}}});
  const txt=CNAB240.remessa({emp:{cnpj:e.cnpj,nome:e.razao_social},conta:{banco:cb.banco_codigo,bancoNome:cb.banco_nome,agencia:cb.agencia,agencia_dv:cb.agencia_dv,conta:cb.conta,conta_dv:cb.conta_dv,convenio:cb.convenio_pagamento},nsa:l.numero,itens});
  const nome=`PAG${String(cb.banco_codigo).padStart(3,'0')}_${String(l.numero).padStart(5,'0')}.REM`;
  const {error}=await sb.from('pagamento_lotes').update({status:'remessa_gerada',remessa:txt,remessa_nome:nome,remessa_em:new Date().toISOString()}).eq('id',l.id);if(error)throw error;
  baixarArquivo(nome,txt);toast('Arquivo de remessa gerado. Envie no internet banking e autorize o pagamento.');await recarregar();
}
async function lerRetorno(file){
  const txt=await file.text();const r=CNAB240.retorno(txt);
  const porSeu=new Map(P.itens.map(i=>[i.seu_numero,i]));let pagos=0,rej=0,agend=0,nao=0;const lotesTocados=new Set();
  for(const x of r.itens){const it=porSeu.get(x.seu);if(!it){nao++;continue}
    const l=P.lotes.find(y=>y.id===it.lote_id);if(!l||!['remessa_gerada','processado'].includes(l.status)){nao++;continue}
    lotesTocados.add(l.id);
    const {error}=await sb.from('pagamento_itens').update({status:x.status,ocorrencias:x.ocorr,ocorrencias_txt:x.txt,data_efetiva:x.data,valor_efetivo:x.valor||null}).eq('id',it.id);if(error)throw error;
    if(x.status==='pago'&&it.status!=='pago'){const v=x.valor||+it.valor;const {error:e2}=await sb.from('parcelas').update({status:'paga',data_pagamento:x.data||l.data_pagamento,valor_pago:-r2(v),conta_bancaria_id:l.conta_bancaria_id,forma_pagamento:MOD[it.modalidade][0]+' (CNAB)'}).eq('id',it.parcela_id);if(e2)throw e2;pagos++}
    else if(x.status==='rejeitado')rej++;else if(x.status==='agendado')agend++;
    it.status=x.status;
  }
  for(const id of lotesTocados){const its=P.itens.filter(i=>i.lote_id===id);const fim=its.every(i=>['pago','rejeitado'].includes(i.status));
    const upd={retorno:txt,retorno_nome:file.name,retorno_em:new Date().toISOString()};if(fim&&P.lotes.find(l=>l.id===id).status==='remessa_gerada')upd.status='processado';
    const {error}=await sb.from('pagamento_lotes').update(upd).eq('id',id);if(error)throw error}
  const lerr=r.lotes.length?' Lote recusado pelo banco: '+r.lotes.map(x=>x.txt).join('; ')+'.':'';
  toast(`Retorno lido: ${pagos} pago${pagos===1?'':'s'}, ${agend} agendado${agend===1?'':'s'}, ${rej} rejeitado${rej===1?'':'s'}${nao?`, ${nao} não encontrado${nao>1?'s':''}`:''}.${lerr}`);await recarregar();
}

Object.assign(FORMS,{
  async 'pg-dados'(f){
    const p=P.parc.find(x=>x.id===f.dataset.id);const pr=fav(p);let barras=null;
    if(f.barras.value.trim()){const b=CNAB240.boleto(f.barras.value,HOJE);if(b.erro)return toast(b.erro);barras=b.barras}
    if(f.modalidade.value==='boleto'&&!barras)return toast('Informe o código de barras do boleto.');
    const {error}=await sb.from('parcelas').update({codigo_barras:barras,modalidade_pgto:f.modalidade.value}).eq('id',p.id);if(error)throw error;
    const novo={documento:soDig(f.doc.value)||null,pix_tipo:f.pixtipo.value||null,pix_chave:f.pix.value.trim()||null,banco_codigo:soDig(f.banco.value)||null,agencia:soDig(f.agencia.value)||null,agencia_dv:f.agdv.value.trim()||null,conta:soDig(f.conta.value)||null,conta_dv:f.ccdv.value.trim()||null};
    const mudou=['banco_codigo','agencia','agencia_dv','conta','conta_dv','pix_chave'].some(c=>(pr[c]||null)!==(novo[c]||null));
    const {error:e2}=await sb.from('parceiros').update({...novo,dados_pgto_conferidos:f.conferido.checked,...(mudou?{dados_pgto_alterados_em:new Date().toISOString()}:{})}).eq('id',pr.id);if(e2)throw e2;
    fecharDrawer();toast(mudou&&!f.conferido.checked?'Dados salvos. Confira com o fornecedor antes de pagar.':'Dados de pagamento salvos.');await recarregar()},
  async 'pg-conta'(f){const cb=contaPag();const {error}=await sb.from('contas_bancarias').update({banco_codigo:soDig(f.banco.value)||null,agencia_dv:f.agdv.value.trim()||null,conta_dv:f.ccdv.value.trim()||null,convenio_pagamento:f.convenio.value.trim()||null}).eq('id',cb.id);if(error)throw error;fecharDrawer();toast('Conta atualizada.');await recarregarCad()},
});

document.addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-pg]');
  if(!b){const lr=ev.target.closest('[data-pglote]');if(lr&&!ev.target.closest('button,input,label')){abrirLote(lr.dataset.pglote)}return}
  const a=b.dataset.pg;
  try{
    if(a==='dados')formDados(b.dataset.id);
    else if(a==='conta-cnab')formContaCnab();
    else if(a==='criar-lote'){b.disabled=true;await criarLote()}
    else if(a==='aprovar'){b.disabled=true;const {error}=await sb.from('pagamento_lotes').update({status:'aprovado',aprovado_por_nome:quem(),aprovado_em:new Date().toISOString()}).eq('id',b.dataset.id);if(error)throw error;toast('Lote aprovado. Gere o arquivo de remessa.');await recarregar()}
    else if(a==='remessa'){b.disabled=true;await gerarRemessa(b.dataset.id)}
    else if(a==='baixar'){const l=P.lotes.find(x=>x.id===b.dataset.id);if(l?.remessa)baixarArquivo(l.remessa_nome||'remessa.REM',l.remessa)}
    else if(a==='cancelar-lote'){if(!confirm('Cancelar este lote?'))return;const {error}=await sb.from('pagamento_lotes').update({status:'cancelado'}).eq('id',b.dataset.id);if(error)throw error;fecharDrawer();toast('Lote cancelado.');await recarregar()}
  }catch(e){console.error(e);toast(traduz(e));b.disabled=false}
});
document.addEventListener('change',async ev=>{const t=ev.target;
  try{
    if(t.id==='pgEmp'){P.emp=t.value;P.conta=null;P.marcadas.clear();render(true)}
    else if(t.id==='pgConta'){P.conta=t.value;P.marcadas.clear();render(true)}
    else if(t.id==='pgAte'){P.ate=t.value||HOJE;render(true)}
    else if(t.dataset.pgsel){t.checked?P.marcadas.add(t.dataset.pgsel):P.marcadas.delete(t.dataset.pgsel);render(true)}
    else if(t.dataset.pg==='todas'){document.querySelectorAll('[data-pgsel]:not(:disabled)').forEach(x=>t.checked?P.marcadas.add(x.dataset.pgsel):P.marcadas.delete(x.dataset.pgsel));render(true)}
    else if(t.id==='pgRet'&&t.files[0]){const f=t.files[0];t.value='';await lerRetorno(f)}
  }catch(e){console.error(e);toast(traduz(e))}
});
document.addEventListener('input',ev=>{if(ev.target.id==='dBar')infoBarras()});

// registro no app: depois de "Contas a pagar e receber"
const iC=ROTAS.findIndex(x=>x[0]==='contas');
if(!ROTAS.some(x=>x[0]==='pagamentos'))ROTAS.splice(iC>=0?iC+1:ROTAS.length,0,['pagamentos','Pagamentos ao banco']);
TITULOS.pagamentos='Pagamentos ao banco';VIEWS.pagamentos=vPagamentos;USA_EMP.add('pagamentos');
if(S.user){renderNav(rota());render()}
})();
