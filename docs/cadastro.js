// ===================== Cadastro padronizado de empresa (PJ ou pessoa física) e menu lateral recolhível
(()=>{
if(typeof S==='undefined'||typeof FORMS==='undefined')return;

// ---------- menu lateral recolhível (lembra a escolha neste aparelho)
const app=document.getElementById('app'),bt=document.getElementById('btnRecolhe');
function aplicaMenu(mini){app.classList.toggle('mini',mini);if(bt){bt.setAttribute('aria-label',mini?'Abrir menu':'Recolher menu');bt.title=mini?'Abrir menu':'Recolher menu';bt.setAttribute('aria-expanded',String(!mini))}}
aplicaMenu(!!lsGet('gg_menu_mini'));
bt?.addEventListener('click',()=>{const mini=!app.classList.contains('mini');lsSet('gg_menu_mini',mini);aplicaMenu(mini)});

// ---------- nova empresa
const PAPEL_ADM={admin:'Administrador da empresa',financeiro:'Financeiro',leitura:'Só consulta'};
const opts=(o,sel)=>Object.entries(o).map(([v,n])=>`<option value="${v}" ${v===sel?'selected':''}>${esc(n)}</option>`).join('');
window.formNovaEmpresa=function(){
  const cor=CORES_EMP[S.empresas.length%CORES_EMP.length];
  return `<h3>Nova empresa</h3><p class="muted" style="margin:0">Tudo o que a empresa precisa para começar: plano de contas, centros de custo, contas de transferência, conta bancária, tabela de aprovações e o primeiro usuário.</p>
  <form data-form="empresa" class="form-grid nova-emp">
    <div class="field wide"><label>Tipo de cadastro</label><div class="seg" role="radiogroup" aria-label="Tipo de cadastro">
      <label class="segop"><input type="radio" name="tipo" value="pj" checked> Empresa (CNPJ)</label><label class="segop"><input type="radio" name="tipo" value="pf"> Pessoa física (CPF)</label></div></div>
    <div class="field"><label for="eDoc" data-lbl-doc>CNPJ</label><input id="eDoc" name="doc" required inputmode="numeric" placeholder="00.000.000/0001-00"></div>
    <div class="field" style="grid-column:span 2"><label for="eRazao" data-lbl-razao>Razão social</label><input id="eRazao" name="razao" required autocomplete="off"></div>
    <div class="field wide"><label for="eFant">Nome fantasia (é o nome que aparece no app e nos relatórios)</label><input id="eFant" name="fantasia" autocomplete="off" placeholder="Ex.: Café Serra"></div>
    <div class="field" data-pj><label for="eReg">Regime tributário</label><select id="eReg" name="regime"><option value="">Definir depois</option>${opts(REGIMES,'simples_nacional')}</select></div>
    <div class="field" data-pj style="grid-column:span 2"><label for="eAtv">Atividade principal</label><select id="eAtv" name="atividade"><option value="">Definir depois</option>${opts(ATIVIDADES,'')}</select></div>
    <div class="field wide"><label for="ePlano">Plano de contas</label><select id="ePlano" name="plano"><option value="" data-lbl-modelo>Modelo padrão para empresa (receitas, deduções, custos, despesas, IR/CSLL)</option>
      ${S.empresas.map(e=>`<option value="${e.id}">Copiar de ${esc(nomeEmp(e))}</option>`).join('')}</select></div>
    <div class="field wide"><label for="eCor">Cor da empresa</label><div class="cores">${CORES_EMP.map(c=>`<button type="button" class="cor" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}<input id="eCor" type="color" name="cor" value="${cor}" aria-label="Outra cor"></div></div>
    <div class="wide sec-tit">Conta bancária principal <span class="muted">(opcional, dá para cadastrar mais depois)</span></div>
    <div class="field"><label for="eBanco">Banco</label><input id="eBanco" name="banco" list="dlBancosNE" placeholder="Nubank, Itaú, PicPay…" autocomplete="off"><datalist id="dlBancosNE">${BANCOS_BR.map(([n,c])=>`<option value="${esc(n)}">${c}</option>`).join('')}</datalist></div>
    <div class="field"><label for="eAg">Agência</label><input id="eAg" name="agencia" inputmode="numeric" placeholder="0001"></div>
    <div class="field"><label for="eCc">Conta</label><input id="eCc" name="conta" placeholder="12345-6"></div>
    <div class="wide sec-tit">Primeiro usuário da empresa <span class="muted">(opcional: o cliente recebe um convite)</span></div>
    <div class="field"><label for="eUNome">Nome</label><input id="eUNome" name="unome" autocomplete="off"></div>
    <div class="field"><label for="eUMail">E-mail</label><input id="eUMail" name="umail" type="email" autocomplete="off"></div>
    <div class="field"><label for="eUPapel">Acesso</label><select id="eUPapel" name="upapel">${opts(PAPEL_ADM,'admin')}</select></div>
    <label class="wide chk" data-pj><input type="checkbox" name="alcadas" checked> Criar a tabela de aprovações recomendada (pagamentos e compras aprovados pelo financeiro; acima de R$ 10.000 e conciliação, pelo administrador)</label>
    <div class="wide" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Criar empresa</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`};

function trocaTipo(f){const pf=f.tipo.value==='pf';
  f.querySelectorAll('[data-pj]').forEach(x=>x.hidden=pf);
  f.querySelector('[data-lbl-doc]').textContent=pf?'CPF':'CNPJ';f.doc.placeholder=pf?'000.000.000-00':'00.000.000/0001-00';
  f.querySelector('[data-lbl-razao]').textContent=pf?'Nome completo':'Razão social';
  f.fantasia.placeholder=pf?'Ex.: Evaldo (pessoal)':'Ex.: Café Serra';
  f.querySelector('[data-lbl-modelo]').textContent=pf?'Modelo padrão pessoa física (salário, moradia, alimentação, saúde, IRPF)':'Modelo padrão para empresa (receitas, deduções, custos, despesas, IR/CSLL)';
  if(f.alcadas)f.alcadas.checked=!pf}
document.addEventListener('change',ev=>{const f=ev.target.form;if(f?.dataset.form==='empresa'&&ev.target.name==='tipo')trocaTipo(f)});
document.addEventListener('click',ev=>{const c=ev.target.closest('form[data-form=empresa] [data-cor]');if(c){c.closest('form').cor.value=c.dataset.cor}});

window.criarEmpresaPadrao=async function(f){
  const tipo=f.tipo.value,doc=soDig(f.doc.value),razao=f.razao.value.trim();
  if(tipo==='pj'&&doc.length!==14)return toast('O CNPJ precisa ter 14 dígitos.');
  if(tipo==='pf'&&doc.length!==11)return toast('O CPF precisa ter 11 dígitos.');
  if(!razao)return toast(tipo==='pf'?'Informe o nome completo.':'Informe a razão social.');
  const umail=f.umail.value.trim();if(umail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(umail))return toast('Confira o e-mail do usuário.');
  const p={p_cnpj:doc,p_razao_social:razao,p_nome_fantasia:f.fantasia.value.trim()||null,p_tipo:tipo,
    p_regime:tipo==='pj'?f.regime.value||null:null,p_atividade:tipo==='pj'?f.atividade.value||null:null,p_cor:corValida(f.cor.value)?f.cor.value:null,p_copiar_de:f.plano.value||null};
  let {data:id,error}=await sb.rpc('criar_empresa',p);
  if(error&&/function|parameter|schema cache/i.test(error.message)){
    if(tipo==='pf'||p.p_copiar_de)return toast('O banco ainda não foi atualizado para pessoa física e cópia de plano. Peça a atualização.');
    ({data:id,error}=await sb.rpc('criar_empresa',{p_cnpj:doc,p_razao_social:razao,p_nome_fantasia:p.p_nome_fantasia}))}
  if(error)throw error;
  const avisos=[];
  // regime e atividade (no banco antigo a função não grava)
  if(tipo==='pj'&&(p.p_regime||p.p_atividade))await sb.from('empresas').update({regime_tributario:p.p_regime,atividade:p.p_atividade}).eq('id',id);
  const banco=f.banco.value.trim();
  if(banco){const cod=(BANCOS_BR.find(([n])=>norm(n)===norm(banco))||[])[1]||null;
    const {error:eb}=await sb.from('contas_bancarias').insert({empresa_id:id,banco_nome:banco,banco_codigo:cod,agencia:f.agencia.value.trim()||'a informar',conta:f.conta.value.trim()||'a informar',saldo_inicial:0});
    if(eb)avisos.push('conta bancária não cadastrada ('+traduz(eb)+')')}
  if(tipo==='pj'&&f.alcadas?.checked){const r=[['pagamento',0,'financeiro',true],['pagamento',10000,'admin',true],['compra',0,'financeiro',false],['compra',10000,'admin',false],['conciliacao',0,'admin',false]]
      .map(([processo,valor_a_partir,aprovador,outra_pessoa])=>({empresa_id:id,processo,valor_a_partir,aprovador,outra_pessoa,ativo:true}));
    const {error:ea}=await sb.from('alcadas').insert(r);if(ea)avisos.push('tabela de aprovações não criada')}
  let link=null;
  if(umail){try{const r=await chamarAdmin({acao:'convidar',email:umail,redirectTo:BASE_URL,nome:f.unome.value.trim()||umail.split('@')[0],
      acessos:[{empresa_id:id,papel:f.upapel.value,departamento_id:null,predios:[]}],empresas:[id],papel:f.upapel.value,predios:[]});
    if(r?.link)link=r.link}catch(e){avisos.push('convite não enviado ('+traduz(e)+')')}}
  S.sel=new Set();S.usuarios=null;fecharDrawer();await recarregarCad();
  if(link){mostrarLink(umail,link,true);return}
  toast((tipo==='pf'?'Cadastro criado':'Empresa criada')+' com plano de contas'+(banco?', conta bancária':'')+(umail?' e convite enviado':'')+'.'+(avisos.length?' Atenção: '+avisos.join('; ')+'.':''));
};

// ---------- editar dados da empresa
window.formDadosEmp=function(empId){const e=empresa(empId);if(!e)return;const pf=e.tipo_pessoa==='pf';
  drawer(`<h3>Dados · ${esc(nomeEmp(e))}</h3>
  <form data-form="dados-emp" data-emp="${e.id}" data-tipo="${pf?'pf':'pj'}" class="form-grid">
    <div class="field"><label for="dDoc">${pf?'CPF':'CNPJ'}</label><input id="dDoc" name="doc" inputmode="numeric" value="${esc(fmtCnpj(e.cnpj))}" ${S.master?'':'readonly'}></div>
    <div class="field" style="grid-column:span 2"><label for="dRazao">${pf?'Nome completo':'Razão social'}</label><input id="dRazao" name="razao" required value="${esc(e.razao_social)}"></div>
    <div class="field wide"><label for="dFant">Nome fantasia (é o nome que aparece no app e nos relatórios)</label><input id="dFant" name="fantasia" value="${esc(e.nome_fantasia||'')}" placeholder="${esc(e.razao_social)}"></div>
    ${pf?'':`<div class="field"><label for="dReg">Regime tributário</label><select id="dReg" name="regime"><option value="">Não definido</option>${opts(REGIMES,e.regime_tributario)}</select></div>
    <div class="field" style="grid-column:span 2"><label for="dAtv">Atividade principal</label><select id="dAtv" name="atividade"><option value="">Não definida</option>${opts(ATIVIDADES,e.atividade)}</select></div>`}
    <div class="wide" style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">Salvar</button><button type="button" class="btn ghost" data-acao="fechar">Cancelar</button></div></form>`)};

// ---------- botão rápido "Novo lançamento" em qualquer tela
const fab=document.createElement('button');fab.className='fab';fab.type='button';fab.dataset.acao='novo-lanc';fab.title='Novo lançamento';fab.setAttribute('aria-label','Novo lançamento');
fab.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Lançar</span>';
app.appendChild(fab);
function mostraFab(){fab.hidden=!(S.user&&typeof podeEditarAlguma==='function'&&podeEditarAlguma())||location.hash==='#lancamentos'}
addEventListener('hashchange',mostraFab);setInterval(mostraFab,2000);mostraFab();
// estilos do formulário
const st=document.createElement('style');st.textContent=`
.nova-emp .seg{display:inline-flex;flex-wrap:wrap}.nova-emp .seg{width:max-content;max-width:100%}.segop{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;white-space:nowrap;cursor:pointer;font-weight:600;font-size:13px;color:var(--ink-2);background:var(--surface)}
.segop:has(input:checked){background:var(--accent-soft);color:var(--accent-ink)}.segop input{accent-color:var(--accent);margin:0}
.sec-tit{font-size:11.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--ink-2);font-weight:700;border-top:1px solid var(--line);padding-top:12px;margin-top:4px}
.sec-tit .muted{text-transform:none;letter-spacing:0;font-weight:400}
.chk{display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--ink-2)}.chk input{margin-top:3px;accent-color:var(--accent)}
[data-pj][hidden]{display:none!important}
.fab{position:fixed;right:max(20px,env(safe-area-inset-right,0px));bottom:max(20px,env(safe-area-inset-bottom,0px));z-index:30;display:flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border:0;border-radius:999px;padding:12px 18px 12px 14px;font:inherit;font-weight:700;box-shadow:0 6px 18px rgba(0,0,0,.18);cursor:pointer}
.fab:hover{filter:brightness(1.08)}.fab[hidden]{display:none}
@media (max-width:820px){.fab span{display:none}.fab{padding:14px}}`;document.head.appendChild(st);
})();
