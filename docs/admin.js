// ===================== Administração do sistema (só a conta master)
// Ajustes do app publicado sem mexer no banco nem no HTML: saúde do sistema, parâmetros,
// telas do menu, aviso para todos, verificação de dados e histórico de alterações.
// Os parâmetros ficam na tabela app_config (migração 0015). Sem ela, o app segue com o padrão.
(()=>{
if(typeof S==='undefined'||typeof ROTAS==='undefined')return;

IC.admin='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';
IC.ajuda='<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><circle cx="12" cy="17.5" r=".6" fill="currentColor"/>';

// ---------- parâmetros: padrão + o que estiver salvo no banco
const PADRAO={
  'app.marca':{nome:APP_NOME,sub:APP_SUB},
  'app.aviso':{ativo:false,texto:'',tipo:'info',ate:''},
  'app.telas_ocultas':[],
  'app.rotulos':{},
  'app.formas_pagamento':['PIX','Boleto','Transferência','Cartão de crédito','Cartão de débito','Débito automático','Dinheiro'],
  'app.suporte':{whatsapp:'',email:''},
  'app.alerta_dias':7,
};
const ORIG={nome:APP_NOME,sub:APP_SUB,titulos:{...TITULOS},rotas:ROTAS.map(r=>r[1])};
S.cfg=JSON.parse(JSON.stringify(PADRAO));S.cfgOk=null;
const cfg=k=>S.cfg[k]??PADRAO[k];
window.appCfg=cfg;

async function carregarConfig(){
  const {data,error}=await sb.from('app_config').select('chave,valor,atualizado_em');
  if(error){S.cfgOk=false;S.cfgErro=error.message;return}
  S.cfgOk=true;S.cfgRows=data||[];
  const c=JSON.parse(JSON.stringify(PADRAO));(data||[]).forEach(r=>{c[r.chave]=r.valor});S.cfg=c;aplicarConfig();
}
function aplicarConfig(){
  const m=cfg('app.marca')||{};APP_NOME=m.nome||ORIG.nome;APP_SUB=m.sub||ORIG.sub;
  // nomes das telas no menu
  const rot=cfg('app.rotulos')||{};
  ROTAS.forEach((r,i)=>{if(r[0]==='g')return;const orig=ORIG.titulos[r[0]]??r[1];if(ORIG.titulos[r[0]]==null)ORIG.titulos[r[0]]=r[1];r[1]=rot[r[0]]||orig;TITULOS[r[0]]=r[1]});
  // formas de pagamento sugeridas nos campos de lançamento
  let dl=document.getElementById('dlFormas');if(!dl){dl=document.createElement('datalist');dl.id='dlFormas';document.body.appendChild(dl)}
  dl.innerHTML=(cfg('app.formas_pagamento')||[]).map(f=>`<option value="${esc(f)}">`).join('');
  S._marca=null;if(S.user&&typeof marcaPelaSelecao==='function')marcaPelaSelecao();
  avisoGeral();
}
// aviso para todos os usuários, no topo de todas as telas
function avisoGeral(){
  const a=cfg('app.aviso')||{};const ativo=a.ativo&&a.texto&&(!a.ate||a.ate>=HOJE);
  let el=document.getElementById('avisoGeral');const v=document.getElementById('view');if(!v)return;
  if(!ativo){el?.remove();return}
  if(!el){el=document.createElement('div');el.id='avisoGeral';v.parentNode.insertBefore(el,v)}
  el.className='effect';el.setAttribute('role','status');
  el.style.cssText=`margin:14px max(24px,env(safe-area-inset-right,0px)) 0 max(24px,env(safe-area-inset-left,0px));max-width:1272px;display:flex;gap:10px;align-items:flex-start;${a.tipo==='alerta'?'border-left-color:var(--warn);background:var(--warn-soft)':''}`;
  el.innerHTML=`${icone(a.tipo==='alerta'?'alerta':'ajuda',16)||''}<span>${esc(a.texto)}</span>`;
}
// campos "Forma de pagamento" ganham a lista de sugestões
new MutationObserver(()=>document.querySelectorAll('#lForma,#pForma,input[name=forma]').forEach(i=>{if(i.tagName==='INPUT'&&!i.getAttribute('list'))i.setAttribute('list','dlFormas')})).observe(document.getElementById('layer')||document.body,{childList:true,subtree:true});

// carrega os parâmetros junto com os cadastros
const _carregarCadastros=carregarCadastros;
carregarCadastros=async function(){await _carregarCadastros();await carregarConfig()};

// telas escondidas: somem do menu de todos; a conta master continua vendo (marcadas como ocultas)
const _podeVer=podeVer;
podeVer=function(r){if(r==='admin')return !!S.master;if(!S.master&&(cfg('app.telas_ocultas')||[]).includes(r))return false;return _podeVer(r)};
const _renderNav=renderNav;
renderNav=function(r){_renderNav(r);
  const oc=new Set(cfg('app.telas_ocultas')||[]);
  if(S.master&&oc.size)document.querySelectorAll('#nav a[href^="#"]').forEach(a=>{if(oc.has(a.getAttribute('href').slice(1))&&!a.querySelector('.oculta'))a.insertAdjacentHTML('beforeend','<span class="soon oculta" title="Escondida para os outros usuários">oculta</span>')});
  const sp=cfg('app.suporte')||{};const ft=document.getElementById('sideFoot');
  if(ft&&(sp.whatsapp||sp.email)&&!ft.querySelector('[data-ajuda]')){
    const w=soDig(sp.whatsapp);const href=w?`https://wa.me/${w.length<=11?'55'+w:w}`:`mailto:${sp.email}`;
    ft.insertAdjacentHTML('afterbegin',`<a data-ajuda href="${esc(href)}" target="_blank" rel="noopener" style="color:var(--side-ink);display:flex;gap:6px;align-items:center;margin-bottom:6px;font-size:12.5px">${icone('ajuda',14)} Ajuda e suporte</a>`)}
};

// ---------- tela
const CHECKS=[
  ['0009','Cor e logo de cada empresa','empresas','cor'],
  ['0010','Colaboradores e departamentos','departamentos','id'],
  ['0011','Boletos do e-mail','boletos_email','id'],
  ['0012','Botão “Buscar boletos agora”','boletos_email_token','url_busca'],
  ['0013','Pagamentos ao banco (CNAB)','pagamento_lotes','id'],
  ['0014','Aprovações e cadastro PF/PJ','alcadas','id'],
  ['0015','Administração e diagnóstico do Gmail','app_config','chave'],
];
async function saude(){
  const res=await Promise.all(CHECKS.map(async c=>{const {error}=await sb.from(c[2]).select(c[3],{head:true,count:'exact'}).limit(1);return {c,ok:!error,erro:error?.message}}));
  const conta=async(t,f)=>{let q=sb.from(t).select('*',{count:'exact',head:true});if(f)q=f(q);const {count,error}=await q;return error?null:count};
  const [nLanc,nAbertas,nBol,tks,acs,nUsr]=await Promise.all([
    conta('lancamentos'),conta('parcelas',q=>q.eq('status','aberta').lt('vencimento',HOJE)),conta('boletos_email',q=>q.eq('status','novo')),
    sb.from('boletos_email_token').select('*').then(r=>r.data||[]),
    sb.from('acessos').select('usuario_id,empresa_id,entrou_em,dispositivo').order('entrou_em',{ascending:false}).limit(8).then(r=>r.error?[]:r.data),
    conta('perfis',q=>q.eq('ativo',true))]);
  return {res,nLanc,nAbertas,nBol,tks,acs,nUsr};
}
const quando=ts=>{if(!ts)return 'nunca';const min=Math.round((Date.now()-new Date(ts))/60000);return min<2?'agora há pouco':min<60?`há ${min} min`:min<1440?`há ${Math.round(min/60)} h`:`há ${Math.round(min/1440)} dia${min>=2880?'s':''}`};
window.estadoGmail=function(t){
  const ult=t.ultima_execucao||t.ultimo_uso;const h=ult?(Date.now()-new Date(ult))/36e5:Infinity;const v=t.ultimo_resumo?.versao||0;
  if(!ult)return ['Ainda não rodou','warn','O script foi gerado mas ainda não leu nenhum e-mail. Confira se a função “instalar” foi executada.'];
  if(!t.ultima_execucao)return ['Script antigo','warn','O script instalado é de uma versão antiga e não avisa quando roda. Copie o script novo e cole por cima do antigo.'];
  if(h>6)return ['Parado','bad',`A última leitura foi ${quando(ult)}. O script parou: abra script.google.com e execute “instalar” de novo.`];
  if(v<3)return ['Desatualizado','warn','Copie o script novo e cole por cima do antigo.'];
  if((t.ultimo_resumo?.erros||[]).length)return ['Com erros','warn',(t.ultimo_resumo.erros||[]).slice(-1)[0]];
  return ['Funcionando','good',`Última leitura ${quando(ult)}.`];
};
function tile(lbl,val,cmp){return `<div class="tile"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="cmp">${cmp}</div></div>`}

async function vAdmin(){
  if(!S.master)return vazio('Só a conta master','<p style="margin:0">Esta tela é da conta master.</p>');
  await carregarConfig();
  const tab=S.admTab||'saude';
  const tabs=`<div class="tabs" role="tablist">${[['saude','Saúde do sistema'],['parametros','Parâmetros e aviso'],['telas','Telas do menu'],['dados','Verificar dados'],['historico','Histórico']].map(([id,n])=>`<button role="tab" data-admtab="${id}" class="${tab===id?'on':''}" aria-selected="${tab===id}">${n}</button>`).join('')}</div>`;
  const semCfg=S.cfgOk===false?`<div class="effect" style="border-left-color:var(--warn);background:var(--warn-soft);margin-bottom:12px">Falta aplicar a atualização do banco <b>0015</b>. Até lá dá para ver a saúde do sistema e verificar os dados, mas os parâmetros não podem ser salvos.</div>`:'';
  let corpo='';
  if(tab==='saude')corpo=await tSaude();
  else if(tab==='parametros')corpo=tParametros();
  else if(tab==='telas')corpo=tTelas();
  else if(tab==='dados')corpo=await tDados();
  else corpo=await tHistorico();
  return tabs+semCfg+corpo;
}

async function tSaude(){
  const d=await saude();const ok=d.res.filter(r=>r.ok).length;
  const gm=d.tks.map(t=>({t,e:estadoGmail(t)}));const pior=gm.find(g=>g.e[1]==='bad')||gm.find(g=>g.e[1]==='warn')||gm[0];
  const pctOk=Math.round(ok/d.res.length*100);
  return `<section class="grid g-tiles" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">
    ${tile('Atualizações do banco',`${ok}/${d.res.length}`,`<div class="bar-cell"><span style="width:${Math.max(8,pctOk)}px;flex:none;background:var(--${ok===d.res.length?'good':'warn'})"></span>${ok===d.res.length?'<span class="chip good">em dia</span>':`<span class="chip warn">${d.res.length-ok} pendente${d.res.length-ok>1?'s':''}</span>`}</div>`)}
    ${tile('Leitura do Gmail',pior?`<span style="font-size:17px">${pior.e[0]}</span>`:'<span style="font-size:17px">Desligada</span>',pior?`<span class="chip ${pior.e[1]}">${esc(nomeEmp(empresa(pior.t.empresa_id))||'')}</span>`:'<a href="#boletos">Ligar em Boletos do e-mail</a>')}
    ${tile('Usuários ativos',d.nUsr??'–',`${S.empresas.length} empresa${S.empresas.length===1?'':'s'} · ${S.predios.length} unidade${S.predios.length===1?'':'s'}`)}
    ${tile('Lançamentos',d.nLanc!=null?num.format(d.nLanc):'–',`${d.nAbertas?`<span class="chip bad">${d.nAbertas} conta${d.nAbertas>1?'s':''} vencida${d.nAbertas>1?'s':''}</span>`:'<span class="chip good">nada vencido</span>'}`)}
    ${tile('Boletos para lançar',d.nBol??'–',`<a href="#boletos">Abrir boletos</a>`)}
  </section>
  <section class="grid g-2">
  <div class="panel"><div class="ph"><div><h2>Atualizações do banco de dados</h2><p class="hint">Cada função nova do app precisa da sua atualização no banco. O que estiver pendente fica desligado no app até ser aplicado.</p></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nº</th><th>Função</th><th>Situação</th></tr></thead><tbody>
    ${d.res.map(r=>`<tr><td class="mono">${r.c[0]}</td><td>${esc(r.c[1])}</td><td>${r.ok?'<span class="chip good">Aplicada</span>':'<span class="chip warn">Pendente</span>'}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="panel"><div class="ph"><div><h2>Integrações</h2><p class="hint">Leitura de boletos no Gmail de cada empresa</p></div></div>
    ${gm.length?`<div class="alerts">${gm.map(({t,e})=>{const r=t.ultimo_resumo||{};return `<a class="alert" href="#boletos" style="color:inherit;text-decoration:none"><span class="dot" style="background:var(--${e[1]==='good'?'good':e[1]==='bad'?'bad':'warn'})"></span><div><b>${esc(nomeEmp(empresa(t.empresa_id))||'Empresa')} · ${e[0]}</b><small>${esc(e[2])}${r.conversas!=null?` · ${r.conversas} conversas, ${r.novos||0} boletos novos na última leitura`:''}${r.versao?` · script v${r.versao}`:''}</small></div></a>`}).join('')}</div>`:'<p class="muted" style="margin:0">Nenhuma empresa ligada ao Gmail ainda. <a href="#boletos">Ligar agora</a>.</p>'}
    <h2 style="margin-top:16px">Últimos acessos</h2>
    ${d.acs.length?`<div class="alerts">${d.acs.map(a=>`<div class="alert"><span class="dot" style="background:var(--accent)"></span><div><b>${esc(nomeEmp(empresa(a.empresa_id))||'Todas as empresas')}</b><small>${quando(a.entrou_em)} · ${esc(a.dispositivo||'')}</small></div></div>`).join('')}</div>`:'<p class="muted" style="margin:0">Sem registros.</p>'}
  </div></section>`;
}

function tParametros(){
  const m=cfg('app.marca')||{},a=cfg('app.aviso')||{},sp=cfg('app.suporte')||{};const dis=S.cfgOk===false?'disabled':'';
  return `<form data-form="adm-param" class="panel">
    <div class="ph"><div><h2>Parâmetros do app</h2><p class="hint">Valem para todos os usuários assim que você salvar. Nada aqui apaga dados.</p></div></div>
    <div class="form-grid">
      <div class="field"><label for="admNome">Nome do app</label><input id="admNome" name="nome" maxlength="40" value="${esc(m.nome||APP_NOME)}"></div>
      <div class="field"><label for="admSub">Nome da empresa dona do app</label><input id="admSub" name="sub" maxlength="60" value="${esc(m.sub||APP_SUB)}"></div>
      <div class="field"><label for="admWhats">WhatsApp de suporte</label><input id="admWhats" name="whatsapp" inputmode="tel" placeholder="(62) 99999-9999" value="${esc(sp.whatsapp||'')}"></div>
      <div class="field"><label for="admMail">E-mail de suporte</label><input id="admMail" name="email" type="email" value="${esc(sp.email||'')}"></div>
      <div class="field wide"><label for="admFormas">Formas de pagamento sugeridas (uma por linha)</label><textarea id="admFormas" name="formas" rows="4">${esc((cfg('app.formas_pagamento')||[]).join('\n'))}</textarea></div>
      <div class="field"><label for="admDias">Avisar boletos que vencem em até (dias)</label><input id="admDias" name="dias" type="number" min="1" max="60" value="${+cfg('app.alerta_dias')||7}"></div>
    </div>
    <h2 style="margin-top:18px">Aviso para todos os usuários</h2><p class="hint">Aparece no topo de todas as telas. Bom para avisar manutenção, mudança de prazo ou novidade.</p>
    <div class="form-grid">
      <div class="field wide"><label for="admAviso">Texto do aviso</label><textarea id="admAviso" name="aviso" rows="2" maxlength="300" placeholder="Ex.: Fechamento de outubro até dia 5. Lance todas as notas até lá.">${esc(a.texto||'')}</textarea></div>
      <div class="field"><label for="admTipo">Tipo</label><select id="admTipo" name="tipo"><option value="info" ${a.tipo!=='alerta'?'selected':''}>Informação</option><option value="alerta" ${a.tipo==='alerta'?'selected':''}>Alerta</option></select></div>
      <div class="field"><label for="admAte">Mostrar até (opcional)</label><input id="admAte" name="ate" type="date" value="${esc(a.ate||'')}"></div>
      <label class="wide" style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="ativo" ${a.ativo?'checked':''}> Mostrar o aviso agora</label>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px"><button class="btn" ${dis}>Salvar parâmetros</button></div></form>`;
}

function tTelas(){
  const oc=new Set(cfg('app.telas_ocultas')||[]),rot=cfg('app.rotulos')||{};const dis=S.cfgOk===false?'disabled':'';
  let grupo='';const linhas=[];
  ROTAS.forEach(r=>{if(r[0]==='g'){grupo=r[1];return}if(r[0]==='admin')return;
    linhas.push(`<tr><td class="muted">${esc(grupo)}</td><td><span class="nl" style="display:flex;gap:8px;align-items:center">${icone(r[0],16)}${esc(ORIG.titulos[r[0]]||r[1])}</span></td>
    <td><input name="rot_${r[0]}" value="${esc(rot[r[0]]||'')}" placeholder="${esc(ORIG.titulos[r[0]]||r[1])}" aria-label="Novo nome para ${esc(ORIG.titulos[r[0]]||r[1])}" style="width:100%;min-width:140px;border:1px solid var(--line);border-radius:6px;padding:5px 8px;background:var(--surface);color:var(--ink)"></td>
    <td style="text-align:center"><input type="checkbox" name="ver_${r[0]}" ${oc.has(r[0])?'':'checked'} aria-label="Mostrar ${esc(r[1])}"></td></tr>`)});
  return `<form data-form="adm-telas" class="panel"><div class="ph"><div><h2>Telas do menu</h2><p class="hint">Esconda o que o cliente ainda não usa e troque o nome de uma tela se quiser. Você, como master, continua vendo tudo (com a marca “oculta”).</p></div>
    <div class="ctrls"><button class="btn" ${dis}>Salvar telas</button></div></div>
    <div class="tbl-wrap"><table><thead><tr><th>Grupo</th><th>Tela</th><th>Nome no menu</th><th style="text-align:center">Mostrar</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div></form>`;
}

// ---------- verificação de dados
async function verificar(){
  const ids=S.empresas.map(e=>e.id);const out=[];
  const venc60=addDias(HOJE,-60);
  const [velhas,bolOrf,lanc]=await Promise.all([
    sb.from('parcelas').select('id',{count:'exact',head:true}).eq('status','aberta').lt('vencimento',venc60),
    sb.from('boletos_email').select('id,beneficiario,remetente,valor,vencimento').eq('status','lancado').is('lancamento_id',null).then(r=>r.error?[]:r.data),
    lancAno(S.ano).catch(()=>[])]);
  // contas a pagar/receber esquecidas
  if(velhas.count)out.push({id:'velhas',nivel:'warn',titulo:`${velhas.count} conta${velhas.count>1?'s':''} em aberto vencida${velhas.count>1?'s':''} há mais de 60 dias`,txt:'Provavelmente já foram pagas e faltou dar baixa, ou devem ser canceladas.',link:'#contas'});
  // boletos lançados cujo lançamento foi apagado
  if(bolOrf.length)out.push({id:'bol',nivel:'warn',titulo:`${bolOrf.length} boleto${bolOrf.length>1?'s':''} marcado${bolOrf.length>1?'s':''} como lançado, mas o lançamento foi apagado`,txt:'Volte para a lista de boletos para lançar de novo.',acao:['adm-fix-bol','Voltar para a lista'],dados:bolOrf.map(b=>b.id)});
  // parceiros repetidos (mesmo nome ou mesmo CNPJ/CPF na mesma empresa)
  const grupos={};S.parceiros.filter(p=>ids.includes(p.empresa_id)).forEach(p=>{[soDig(p.documento).length>=11?'d:'+soDig(p.documento):null,'n:'+norm(p.nome).replace(/\b(LTDA|ME|EPP|S\.?A\.?|EIRELI)\b|[^A-Z0-9 ]/g,'').replace(/\s+/g,' ').trim()].filter(Boolean).forEach(k=>{(grupos[p.empresa_id+'|'+k]=grupos[p.empresa_id+'|'+k]||new Map()).set(p.id,p)})});
  const vistos=new Set();const reps=Object.values(grupos).map(m=>[...m.values()]).filter(g=>g.length>1).filter(g=>{const k=g.map(p=>p.id).sort().join();if(vistos.has(k))return false;vistos.add(k);return true});
  if(reps.length)out.push({id:'parc',nivel:'info',titulo:`${reps.length} fornecedor${reps.length>1?'es':''}/cliente${reps.length>1?'s':''} cadastrado${reps.length>1?'s':''} mais de uma vez`,txt:'Juntar deixa o DRE por fornecedor e as sugestões de conta mais certas.',lista:reps.slice(0,15).map(g=>({txt:g.map(p=>p.nome+(p.documento?' ('+fmtCnpj(p.documento)+')':'')).join(' · '),emp:g[0].empresa_id,acao:['adm-juntar','Juntar'],dados:g.map(p=>p.id)}))});
  // contas que não aparecem no DRE
  const semGrupo=S.contas.filter(c=>ids.includes(c.empresa_id)&&c.analitica&&c.ativa&&['receita','despesa'].includes(c.tipo)&&!c.grupo_dre);
  if(semGrupo.length)out.push({id:'dre',nivel:'warn',titulo:`${semGrupo.length} conta${semGrupo.length>1?'s':''} do plano sem grupo do DRE`,txt:'Os lançamentos nessas contas não aparecem no DRE. Abra a conta e escolha o grupo.',link:'#plano',lista:semGrupo.slice(0,15).map(c=>({txt:`${c.codigo} ${c.nome}`,emp:c.empresa_id}))});
  // lançamentos repetidos no ano
  const dup={};lanc.forEach(l=>{const k=[l.empresa_id,l.conta_id,l.valor,l.competencia,l.parceiro_id||'',norm(l.descricao)].join('|');(dup[k]=dup[k]||[]).push(l)});
  const dups=Object.values(dup).filter(g=>g.length>1&&!g.some(l=>l.origem==='faturamento'));
  if(dups.length)out.push({id:'dup',nivel:'warn',titulo:`${dups.length} lançamento${dups.length>1?'s':''} que parece${dups.length>1?'m':''} repetido${dups.length>1?'s':''} em ${S.ano}`,txt:'Mesma conta, valor, data, parceiro e descrição. Abra e exclua o que sobrou.',lista:dups.slice(0,20).map(g=>({txt:`${dataBR(g[0].competencia)} · ${conta(g[0].conta_id)?.nome||''} · ${brl2.format(g[0].valor)} · ${g.length} vezes`,emp:g[0].empresa_id,lanc:g[1].id}))});
  // empresas sem conta bancária
  const semBanco=S.empresas.filter(e=>!S.bancos.some(b=>b.empresa_id===e.id));
  if(semBanco.length)out.push({id:'banco',nivel:'info',titulo:`${semBanco.length} empresa${semBanco.length>1?'s':''} sem conta bancária`,txt:semBanco.map(nomeEmp).join(', ')+'. Sem conta bancária o fluxo de caixa e a conciliação ficam incompletos.',link:'#bancos'});
  return out;
}
async function tDados(){
  const r=S.admVerif;
  const cab=`<div class="panel"><div class="ph"><div><h2>Verificar dados</h2><p class="hint">Procura problemas comuns em todas as empresas: contas esquecidas, cadastros repetidos, contas fora do DRE e lançamentos em dobro.</p></div>
    <div class="ctrls"><button class="btn" data-acao="adm-verificar">${icone('buscar',15)} ${r?'Verificar de novo':'Verificar agora'}</button></div></div>`;
  if(!r)return cab+'<p class="muted" style="margin:0">Clique em “Verificar agora”. Leva poucos segundos e não altera nada.</p></div>';
  if(!r.length)return cab+'<div class="effect" style="border-left-color:var(--good);background:var(--good-soft)">Tudo certo. Nenhum problema encontrado.</div></div>';
  const cor={warn:'warn',bad:'bad',info:'accent'};
  return cab+`<div class="alerts">${r.map((p,i)=>`<div class="alert"><span class="dot" style="background:var(--${cor[p.nivel]})"></span><div style="flex:1;min-width:0"><b>${esc(p.titulo)}</b><small>${esc(p.txt)}</small>
    ${p.lista?`<ul style="margin:6px 0 0;padding-left:18px;font-size:13px;display:grid;gap:4px">${p.lista.map((x,j)=>`<li>${esc(x.txt)}${S.empresas.length>1?` <span class="muted">· ${esc(nomeEmp(empresa(x.emp)))}</span>`:''}${x.acao?` <button class="linkbtn small" data-acao="${x.acao[0]}" data-i="${i}" data-j="${j}">${x.acao[1]}</button>`:''}${x.lanc?` <button class="linkbtn small" data-lanc="${x.lanc}">Abrir</button>`:''}</li>`).join('')}</ul>`:''}</div>
    <div style="display:flex;gap:6px;flex:none">${p.link?`<a class="btn ghost" href="${p.link}">Abrir</a>`:''}${p.acao?`<button class="btn ghost" data-acao="${p.acao[0]}" data-i="${i}">${p.acao[1]}</button>`:''}</div></div>`).join('')}</div></div>`;
}

async function tHistorico(){
  const {data,error}=await sb.from('app_config_hist').select('*').order('quando',{ascending:false}).limit(100);
  if(error)return '<div class="panel"><p class="muted" style="margin:0">O histórico começa a funcionar depois da atualização 0015 do banco.</p></div>';
  const nomeChave={'app.marca':'Nome do app','app.aviso':'Aviso para todos','app.telas_ocultas':'Telas escondidas','app.rotulos':'Nomes das telas','app.formas_pagamento':'Formas de pagamento','app.suporte':'Suporte','app.alerta_dias':'Aviso de vencimento'};
  const txt=v=>v==null?'–':typeof v==='object'?(Array.isArray(v)?v.join(', ')||'(vazio)':Object.entries(v).filter(([,x])=>x!==''&&x!=null).map(([k,x])=>`${k}: ${typeof x==='object'?JSON.stringify(x):x}`).join(' · ')||'(vazio)'):String(v);
  return `<div class="panel"><div class="ph"><div><h2>Histórico de alterações</h2><p class="hint">Quem mudou cada parâmetro e quando. Últimas ${data.length}.</p></div></div>
    ${data.length?`<div class="tbl-wrap"><table><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Ficou</th></tr></thead><tbody>${data.map(h=>`<tr><td class="mono">${dataBR(h.quando.slice(0,10))} ${h.quando.slice(11,16)}</td><td>${esc(h.usuario||'')}</td><td>${esc(nomeChave[h.chave]||h.chave)}</td><td class="wrap" style="max-width:420px">${esc(txt(h.depois))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted" style="margin:0">Nenhuma alteração ainda.</p>'}</div>`;
}

// ---------- gravação
async function salvar(pares){
  const rows=Object.entries(pares).filter(([k,v])=>JSON.stringify(v)!==JSON.stringify(S.cfg[k])).map(([chave,valor])=>({chave,valor}));
  if(!rows.length){toast('Nada mudou.');return}
  const {error}=await sb.from('app_config').upsert(rows,{onConflict:'chave'});if(error)throw error;
  await carregarConfig();toast('Salvo. Já vale para todos os usuários.');renderNav(rota());render(true);
}
Object.assign(FORMS,{
  async 'adm-param'(f){
    const formas=f.formas.value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,30);
    await salvar({'app.marca':{nome:f.nome.value.trim()||ORIG.nome,sub:f.sub.value.trim()||ORIG.sub},
      'app.suporte':{whatsapp:f.whatsapp.value.trim(),email:f.email.value.trim()},
      'app.formas_pagamento':formas,'app.alerta_dias':Math.min(60,Math.max(1,+f.dias.value||7)),
      'app.aviso':{ativo:f.ativo.checked&&!!f.aviso.value.trim(),texto:f.aviso.value.trim(),tipo:f.tipo.value,ate:f.ate.value||''}})},
  async 'adm-telas'(f){
    const oc=[],rot={};ROTAS.forEach(r=>{if(r[0]==='g'||r[0]==='admin')return;const v=f['ver_'+r[0]];if(v&&!v.checked)oc.push(r[0]);const n=f['rot_'+r[0]]?.value.trim();if(n)rot[r[0]]=n.slice(0,40)});
    await salvar({'app.telas_ocultas':oc,'app.rotulos':rot})},
});
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-admtab]');if(t){S.admTab=t.dataset.admtab;render(true);return}
  const b=ev.target.closest('[data-acao^="adm-"]');if(!b)return;
  try{
    if(b.dataset.acao==='adm-verificar'){b.disabled=true;b.textContent='Verificando…';S.admVerif=await verificar();render(true)}
    else if(b.dataset.acao==='adm-fix-bol'){const p=S.admVerif[+b.dataset.i];b.disabled=true;const {error}=await sb.from('boletos_email').update({status:'novo'}).in('id',p.dados);if(error)throw error;toast('Boletos de volta na lista para lançar.');S.admVerif=await verificar();render(true)}
    else if(b.dataset.acao==='adm-juntar'){const x=S.admVerif[+b.dataset.i].lista[+b.dataset.j];const ps=x.dados.map(parceiro).filter(Boolean);
      const fica=ps.slice().sort((a,b)=>(soDig(b.documento).length-soDig(a.documento).length)||(a.nome.length-b.nome.length))[0];const saem=ps.filter(p=>p.id!==fica.id).map(p=>p.id);
      if(!confirm(`Juntar em “${fica.nome}”? Os lançamentos dos outros ${saem.length} cadastro(s) passam para ele.`))return;b.disabled=true;
      const {error}=await sb.from('lancamentos').update({parceiro_id:fica.id}).in('parceiro_id',saem);if(error)throw error;
      const {error:e2}=await sb.from('parceiros').delete().in('id',saem);
      if(e2)toast('Lançamentos juntados. Os cadastros antigos ficaram porque estão ligados a compras ou notas.');else toast('Cadastros juntados.');
      await carregarCadastros();invalidar();S.admVerif=await verificar();render(true)}
  }catch(e){console.error(e);toast(traduz(e));b.disabled=false}
});

// ---------- registro no app: grupo Sistema, no fim do menu
if(!ROTAS.some(x=>x[0]==='admin'))ROTAS.push(['g','Sistema'],['admin','Administração']);
TITULOS.admin='Administração';VIEWS.admin=vAdmin;ORIG.titulos.admin='Administração';
if(S.user)carregarConfig().then(()=>{renderNav(rota())});
})();
