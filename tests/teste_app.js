// Teste do app com um Supabase falso (rotas interceptadas no navegador)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=require('path').join(__dirname,'../docs');const OUT=process.argv[2]||'.';
const UID='11111111-1111-4111-8111-111111111111';
let n=0;const id=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
// ---------- dados falsos
const empresas=[{id:id(),cnpj:'12345678000190',razao_social:'Café Serra Comércio Ltda',nome_fantasia:'Café Serra',ativa:true,regime_tributario:'lucro_presumido',atividade:'comercio'},{id:id(),cnpj:'98765432000110',razao_social:'Atlântico Administração de Imóveis Ltda',nome_fantasia:'Atlântico',ativa:true,regime_tributario:'simples_nacional',atividade:'locacao'}];
const predios=[{id:id(),empresa_id:empresas[0].id,nome:'Matriz · Santos'},{id:id(),empresa_id:empresas[0].id,nome:'CD · Cubatão'},{id:id(),empresa_id:empresas[1].id,nome:'Edifício Mar Azul'}];
const MOD=[['3','Receitas',null,'receita',null,0],['3.01.001','Venda de produtos','3','receita','receita_bruta',1],['3.01.002','Serviços e aluguéis','3','receita','receita_bruta',1],['3.02.001','Impostos sobre vendas','3','despesa','deducoes',1],['4','Custos',null,'despesa',null,0],['4.01.001','Mercadorias (CMV)','4','despesa','custos',1],['5','Despesas operacionais',null,'despesa',null,0],['5.01','Pessoal','5','despesa',null,0],['5.01.001','Salários e encargos','5.01','despesa','despesas_operacionais',1],['5.02.001','Aluguel','5','despesa','despesas_operacionais',1],['5.03.001','Marketing','5','despesa','despesas_operacionais',1],['6.01.001','Tarifas bancárias','5','despesa','resultado_financeiro',1],['6.01.004','Taxas de maquininha','5','despesa','resultado_financeiro',1],['3.02.003','PIS e COFINS','3','despesa','deducoes',1],['3.02.004','ISS','3','despesa','deducoes',1],['7','Impostos sobre o lucro',null,'despesa',null,0],['7.01.001','IRPJ','7','despesa','ir_csll',1],['7.01.002','CSLL','7','despesa','ir_csll',1],['9.99','Conta sem grupo','5','despesa',null,1]];
const plano=[];empresas.forEach(e=>{const m={};MOD.forEach(r=>{const c={id:id(),empresa_id:e.id,codigo:r[0],nome:r[1],conta_pai:r[2]?m[r[2]]:null,tipo:r[3],grupo_dre:r[4],analitica:!!r[5],ativa:true};m[r[0]]=c.id;plano.push(c)})});
const centros=[];empresas.forEach(e=>['COM Comercial','OPE Operação','ADM Administrativo'].forEach(x=>centros.push({id:id(),empresa_id:e.id,codigo:x.split(' ')[0],nome:x.split(' ')[1]})));
const bancos=[{id:id(),empresa_id:empresas[0].id,banco_nome:'Itaú',banco_codigo:'341',agencia:'0412',conta:'33871-2',saldo_inicial:0},{id:id(),empresa_id:empresas[0].id,banco_nome:'Nubank',banco_codigo:'260',agencia:'0001',conta:'1234567-8',saldo_inicial:0},{id:id(),empresa_id:empresas[1].id,banco_nome:'Santander',banco_codigo:'033',agencia:'0087',conta:'13004521-7',saldo_inicial:0}];
const parceiros=[{id:id(),empresa_id:empresas[0].id,documento:'23456789000101',nome:'Torrefação Serra Azul'},{id:id(),empresa_id:empresas[0].id,documento:null,nome:'Mercado Bom Preço'}];
const lanc=[],parc=[];const cc=(e,c)=>centros.find(x=>x.empresa_id===e&&x.codigo===c).id;const ct=(e,c)=>plano.find(x=>x.empresa_id===e&&x.codigo===c).id;
for(const ano of [2025,2026])for(let m=1;m<=12;m++){if(ano===2026&&m>10)break;
  const lin=[[0,0,'3.01.001',80000,'COM'],[0,1,'3.01.001',30000,'COM'],[0,0,'3.02.001',-9000,'ADM'],[0,0,'4.01.001',-42000,'OPE'],[0,1,'4.01.001',-15000,'OPE'],[0,0,'5.01.001',-18000,'ADM'],[0,0,'5.02.001',-6000,'ADM'],[0,1,'5.03.001',-2500,'COM'],[0,0,'6.01.001',-300,'ADM'],[1,2,'3.01.002',25000,'COM'],[1,2,'5.01.001',-9000,'ADM'],[1,null,'5.02.001',-3000,'ADM']];
  if(m===3)lin.push([0,0,'9.99',-500,'ADM']);
  lin.forEach(([ei,pi,cod,v,c])=>{const e=empresas[ei].id;const f=(1+(ano-2025)*.12)*(1+Math.sin(m)*.08);const val=Math.round(v*f*100)/100;const l={id:id(),empresa_id:e,predio_id:pi==null?null:predios[pi].id,conta_id:ct(e,cod),centro_custo_id:cc(e,c),parceiro_id:cod==='4.01.001'&&ei===0?parceiros[0].id:null,competencia:`${ano}-${String(m).padStart(2,'0')}-15`,valor:val,descricao:cod+' '+m+'/'+ano};lanc.push(l);
    if(cod==='3.01.001'&&ei===0){l.forma_recebimento=pi===0?'credito_vista':'pix';l.origem='faturamento';if(pi===0){const t={id:id(),empresa_id:e,predio_id:l.predio_id,conta_id:ct(e,'6.01.004'),centro_custo_id:cc(e,'COM'),competencia:l.competencia,valor:-Math.round(val*2.99)/100,descricao:'Taxa Stone',origem:'taxa_cartao',vinculo_id:l.id};lanc.push(t)}}
    const venc=new Date(Date.UTC(ano,m,10)).toISOString().slice(0,10);const pago=venc<'2026-10-25';
    parc.push({id:id(),empresa_id:e,lancamento_id:l.id,numero:1,vencimento:venc,valor:val,data_pagamento:pago?venc:null,valor_pago:pago?val:null,forma_pagamento:'Boleto',status:pago?'paga':'aberta',conta_bancaria_id:bancos[ei].id})})}
const perfis=[{usuario_id:UID,email:'evaldoalves561@gmail.com',nome:'Evaldo',master:true,ativo:true}];
const impostos=[['PIS','mensal',.65,null,null,null,25,'3.02.003'],['COFINS','mensal',3,null,null,null,25,'3.02.003'],['ICMS','mensal',4,null,null,null,20,'3.02.004'],['IRPJ','trimestral',15,8,10,60000,31,'7.01.001'],['CSLL','trimestral',9,12,null,null,31,'7.01.002']].map(r=>({id:id(),empresa_id:empresas[0].id,imposto:r[0],periodicidade:r[1],aliquota:r[2],presuncao:r[3],adicional_aliquota:r[4],adicional_limite:r[5],dia_vencimento:r[6],conta_id:ct(empresas[0].id,r[7]),vigencia_inicio:'2000-01-01',vigencia_fim:null})).concat([{id:id(),empresa_id:empresas[1].id,imposto:'DAS',periodicidade:'mensal',aliquota:11.2,presuncao:null,adicional_aliquota:null,adicional_limite:null,dia_vencimento:20,conta_id:ct(empresas[1].id,'3.02.001'),vigencia_inicio:'2000-01-01',vigencia_fim:null}]);
const acordos=[{id:id(),empresa_id:empresas[0].id,prestador:'Stone',modalidade:'credito_vista',parcelas_de:1,parcelas_ate:1,taxa_percentual:2.99,taxa_fixa:0,prazo_dias:30,antecipacao:false,conta_id:null,vigencia_inicio:'2000-01-01',vigencia_fim:null,ativo:true},{id:id(),empresa_id:empresas[0].id,prestador:'Stone',modalidade:'debito',parcelas_de:1,parcelas_ate:1,taxa_percentual:1.39,taxa_fixa:0,prazo_dias:1,antecipacao:false,conta_id:null,vigencia_inicio:'2000-01-01',vigencia_fim:null,ativo:true},{id:id(),empresa_id:empresas[0].id,prestador:'Stone',modalidade:'credito_parcelado',parcelas_de:2,parcelas_ate:6,taxa_percentual:3.89,taxa_fixa:0,prazo_dias:30,antecipacao:false,conta_id:null,vigencia_inicio:'2000-01-01',vigencia_fim:null,ativo:true}];
const premissas=[['3.01.001','dias_corridos',[30],null],['4.01.001','dias_corridos',[30,60],null],['5.01.001','dia_fixo_mes_seguinte',null,5],['3.02.001','dia_fixo_mes_seguinte',null,20]].map(([c,r,p,d])=>({id:id(),empresa_id:empresas[0].id,conta_id:ct(empresas[0].id,c),vigencia_inicio:'2000-01-01',vigencia_fim:null,antecedencia_compra_dias:c==='4.01.001'?15:0,regra:r,prazos_dias:p||[30],dia_fixo:d,forma_pagamento:null}));
const boletos=[{id:id(),empresa_id:empresas[0].id,chave:'a',status:'novo',remetente:'Claro <fatura@claro.com.br>',assunto:'Sua fatura Claro chegou',recebido_em:'2026-11-02T09:00:00Z',linha_digitavel:'34191123415678901234356789012343716360000015990',valor:159.9,vencimento:'2026-11-20',beneficiario:'Claro S.A.',documento_beneficiario:'40432544000147',criado_em:'2026-11-02T10:00:00Z'},
 {id:id(),empresa_id:empresas[0].id,chave:'b',status:'novo',remetente:'Sabesp <conta@sabesp.com.br>',assunto:'Conta de água · outubro',recebido_em:'2026-10-28T09:00:00Z',linha_digitavel:'836200000011599000480107053120261123000000000005',valor:159.9,vencimento:'2026-11-01',beneficiario:'Sabesp',criado_em:'2026-10-28T10:00:00Z'},
 {id:id(),empresa_id:empresas[0].id,chave:'c',status:'novo',remetente:'Escola Aprender <financeiro@aprender.com>',assunto:'Boleto mensalidade novembro',recebido_em:'2026-11-04T09:00:00Z',linha_digitavel:null,valor:null,vencimento:null,observacao:'Não consegui ler o PDF (pode ter senha). Confira o anexo no e-mail.',criado_em:'2026-11-04T10:00:00Z'},
 {id:id(),empresa_id:empresas[0].id,chave:'d',status:'ignorado',remetente:'Loja X',assunto:'Boleto de exemplo',valor:89,vencimento:'2026-10-15',criado_em:'2026-10-10T10:00:00Z'}];
const DB={boletos_email:boletos,boletos_email_token:[],acessos:[],orcamento_versoes:[],orcamento_linhas:[],orcamento_caixa:[],premissas_conta:premissas,impostos_config:impostos,acordos_cartao:acordos,apuracoes:[],empresas,predios,plano_contas:plano,centros_custo:centros,contas_bancarias:bancos,parceiros,lancamentos:lanc,parcelas:parc,perfis,usuarios_empresas:empresas.map(e=>({usuario_id:UID,empresa_id:e.id,papel:'admin'})),produtos:[],importacoes:[],extratos:[],extrato_linhas:[],regras_classificacao:[]};
const usuarios=[{...perfis[0],ultimo_acesso:'2026-11-03T10:00:00Z',convite_aceito:true,empresas:empresas.map(e=>e.id),papel:'admin',predios:[]},{usuario_id:id(),email:'ana@exemplo.com',nome:'Ana Souza',master:false,ativo:true,ultimo_acesso:null,convite_aceito:false,empresas:[empresas[0].id],papel:'financeiro',predios:[predios[0].id]}];
// ---------- PostgREST falso
function filtrar(rows,q){
  for(const [k,v] of q){if(['select','order','limit','offset'].includes(k))continue;const [op,...r]=v.split('.');const val=r.join('.');
    rows=rows.filter(x=>{const a=x[k];if(op==='eq')return String(a)===val;if(op==='gte')return a!=null&&a>=val;if(op==='lte')return a!=null&&a<=val;if(op==='is')return a==null;if(op==='in')return val.replace(/^\(|\)$/g,'').split(',').map(x=>x.replace(/^"|"$/g,'')).includes(String(a));return true})}
  const o=q.get('order');if(o){const [c,d]=o.split('.');rows=rows.slice().sort((x,y)=>String(x[c]).localeCompare(String(y[c]))*(d==='desc'?-1:1))}
  const l=q.get('limit');if(l)rows=rows.slice(0,+l);return rows}
function embutir(t,rows,sel){if(t==='parcelas'&&/lancamentos\(/.test(sel))return rows.map(p=>{const l=lanc.find(x=>x.id===p.lancamento_id);return {...p,lancamentos:l?{predio_id:l.predio_id,descricao:l.descricao,conta_id:l.conta_id,parceiro_id:l.parceiro_id,centro_custo_id:l.centro_custo_id,competencia:l.competencia}:null}});return rows}
const log=[];
async function rotear(route){const req=route.request();const u=new URL(req.url());const m=req.method();const p=u.pathname;
  const J=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(b)});
  if(m==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  const user={id:UID,email:'evaldoalves561@gmail.com',aud:'authenticated',role:'authenticated'};
  if(p==='/auth/v1/token'){const tok='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:UID,exp:Math.floor(Date.now()/1e3)+3600})).toString('base64url')+'.x';return J({access_token:tok,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1e3)+3600,refresh_token:'r',user})}
  if(p==='/auth/v1/user')return J(user);
  if(p==='/auth/v1/logout')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});
  if(p==='/functions/v1/usuarios-admin'){const b=req.postDataJSON();log.push('fn:'+b.acao);if(b.acao==='listar')return J({usuarios});if(b.acao==='convidar')return J({ok:true,link:'https://vovomhtwqfnlidqlmycu.supabase.co/auth/v1/verify?token=abc&type=invite'});return J({ok:true})}
  if(p==='/functions/v1/indicadores')return J({selic:{valor:15,data:'05/11/2026'},igpm:{mes:-0.36,acum12:-1.2,data:'01/10/2026'},dolar:{valor:5.38,var:-0.4,data:'03/11/2026'}});
  if(p==='/rest/v1/rpc/criar_empresa'){const b=req.postDataJSON();const e={id:id(),cnpj:b.p_cnpj,razao_social:b.p_razao_social,nome_fantasia:b.p_nome_fantasia};empresas.push(e);log.push('rpc criar_empresa');return J(e.id)}
  const t=p.replace('/rest/v1/','');const tab=DB[t];if(!tab)return J({message:'tabela '+t},404);
  if(m==='HEAD'){const rows=filtrar(tab,u.searchParams);return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-expose-headers':'*','content-range':'0-0/'+rows.length}})}
  if(m==='GET'){let rows=filtrar(tab,u.searchParams);rows=embutir(t,rows,u.searchParams.get('select')||'');
    const rg=req.headers()['range'];if(rg){const [a,b]=rg.split('-').map(Number);rows=rows.slice(a,b+1)}
    if((req.headers()['accept']||'').includes('vnd.pgrst.object'))return J(rows[0]||null);return J(rows)}
  if(m==='POST'){let b=req.postDataJSON();const arr=Array.isArray(b)?b:[b];arr.forEach(x=>{x.id=x.id||id();x.criado_em=x.criado_em||new Date().toISOString();tab.push(x)});log.push(`insert ${t} ${arr.length}`);
    if((req.headers()['accept']||'').includes('vnd.pgrst.object'))return J(arr[0],201);return J(arr,201)}
  if(m==='PATCH'){const b=req.postDataJSON();filtrar(tab,u.searchParams).forEach(x=>Object.assign(x,b));log.push('update '+t);return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}})}
  if(m==='DELETE'){const del=new Set(filtrar(tab,u.searchParams));for(let i=tab.length-1;i>=0;i--)if(del.has(tab[i]))tab.splice(i,1);log.push('delete '+t+' '+del.size);return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}})}
}
// ---------- servidor estático
const srv=http.createServer((q,r)=>{let f=path.join(APP,decodeURIComponent(q.url.split('?')[0]));if(f.endsWith('/'))f+='index.html';fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return}r.writeHead(200,{'content-type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.js')?'text/javascript':'application/octet-stream'});r.end(d)})}).listen(8765);
(async()=>{
  const b=await chromium.launch();const errs=[];
  async function rodar(vp,nome,passos){const ctx=await b.newContext({viewport:vp,deviceScaleFactor:1});const pg=await ctx.newPage();
    pg.on('pageerror',e=>errs.push(nome+': '+e.message));pg.on('console',m=>{if(m.type()==='error'&&!/fonts.googleapis|ERR_/.test(m.text()))errs.push(nome+' console: '+m.text())});
    await pg.route('https://vovomhtwqfnlidqlmycu.supabase.co/**',rotear);await pg.route('https://fonts.googleapis.com/**',r=>r.abort());
    await pg.goto('http://localhost:8765/');await pg.waitForTimeout(400);await passos(pg);await ctx.close()}
  const shot=async(pg,n)=>{await pg.waitForTimeout(500);const ov=await pg.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(ov>0)errs.push(n+': overflow horizontal '+ov+'px');await pg.screenshot({path:`${OUT}/t-${n}.png`,fullPage:true})};
  await rodar({width:1366,height:900},'desk',async pg=>{
    await shot(pg,'login');
    await pg.fill('#aEmail','evaldoalves561@gmail.com');await pg.fill('#aSenha','x12345678');await pg.click('form[data-form=login] button');await pg.waitForSelector('[data-entra]',{timeout:8000});await shot(pg,'entrada');await pg.click('[data-entra="*"]');await pg.waitForSelector('.tile',{timeout:8000});
    await shot(pg,'painel');
    await pg.evaluate(()=>location.hash='empresas');await pg.waitForTimeout(600);await pg.click(`[data-acao=marca-emp][data-emp="${empresas[0].id}"]`);await pg.waitForTimeout(200);await pg.click('[data-cor="#9b2c48"]');await shot(pg,'marca-form');await pg.click('form[data-form=marca] button:not([type=button])');await pg.waitForTimeout(800);if(empresas[0].cor!=='#9b2c48')errs.push('cor não salva');
    await pg.click('[data-acao=trocar-empresa]');await pg.waitForTimeout(300);await shot(pg,'trocar');await pg.click(`[data-entra="${empresas[0].id}"]`);await pg.waitForTimeout(300);await pg.evaluate(()=>location.hash='painel');await pg.waitForTimeout(800);await shot(pg,'painel-marca');if(DB.acessos.length<2)errs.push('acessos não registrados: '+DB.acessos.length);await pg.click('[data-acao=trocar-empresa]');await pg.waitForTimeout(300);await pg.click('[data-entra="*"]');await pg.waitForTimeout(500);
    for(const r of ['dre','fluxo','contas','lancamentos','plano','empresas','importar','usuarios','auditoria']){await pg.evaluate(r=>location.hash=r,r);await pg.waitForTimeout(700);await shot(pg,r)}
    await pg.evaluate(()=>location.hash='boletos');await pg.waitForTimeout(800);await shot(pg,'boletos');
    await pg.click('[data-acao=bol-config]');await pg.waitForTimeout(200);await shot(pg,'boletos-ligar');await pg.click('[data-acao=bol-gerar]');await pg.waitForTimeout(800);await shot(pg,'boletos-script');
    if(!DB.boletos_email_token.length)errs.push('token não gerado');await pg.click('[data-acao=fechar]');
    await pg.click(`[data-acao=bol-lancar][data-id="${boletos[0].id}"]`);await pg.waitForTimeout(400);await shot(pg,'boletos-lancar');
    await pg.selectOption('#lConta',{index:8});await pg.click('form[data-form=lanc] button:not([type=button])');await pg.waitForTimeout(900);await shot(pg,'boletos-depois');
    if(boletos[0].status!=='lancado')errs.push('boleto não marcado como lançado');
    await pg.evaluate(()=>location.hash='dre');await pg.waitForTimeout(500);await pg.click('[data-abre=dop]');await pg.click('[data-dre=unid]');await shot(pg,'dre-unid');await pg.click('[data-dre=comp]');await shot(pg,'dre-comp');
    await pg.click('#fTipo [data-per=mes]');await shot(pg,'dre-mes');
    await pg.click('[data-dre=mes]');await pg.waitForTimeout(400);
    for(let i=0;i<4;i++){const a=await pg.$$('tr.arv.click');for(const x of a){const t=(await x.textContent()).trim();if(t.startsWith('▸')){await x.click();await pg.waitForTimeout(250);break}}}
    await shot(pg,'dre-niveis');
    await pg.evaluate(()=>location.hash='fluxo');await pg.waitForTimeout(700);await pg.click('[data-abre="fx|despesas_operacionais"]');await pg.waitForTimeout(300);const f1=await pg.$('tr.arv.click');if(f1){await f1.click();await pg.waitForTimeout(300)}await shot(pg,'fluxo-niveis');
    await pg.click('#fMais');await pg.waitForTimeout(300);await shot(pg,'filtros');await pg.check('[data-fx=cc][value="Administrativo"]');await pg.click('form[data-form=filtros] button:not([type=button])');await pg.waitForTimeout(800);await shot(pg,'fluxo-filtrado');
    await pg.evaluate(()=>location.hash='painel');await pg.waitForTimeout(800);await shot(pg,'painel-filtrado');await pg.click('[data-acao=limpar-fx]');await pg.waitForTimeout(600);
    // filtro
    await pg.click('#fEmp');await pg.waitForTimeout(200);await shot(pg,'pop');await pg.click(`[data-fe="${empresas[1].id}"]`);await pg.click('[data-acao=pop-fechar]');await pg.evaluate(()=>location.hash='painel');await shot(pg,'painel-filtro');
    // novo lançamento
    await pg.evaluate(()=>location.hash='lancamentos');await pg.waitForTimeout(500);await pg.click('[data-acao=novo-lanc]');await pg.waitForTimeout(200);await shot(pg,'novo-lanc');
    await pg.selectOption('#lConta',{index:1});await pg.fill('#lValor','1.234,56');await pg.fill('#lParc','Fornecedor Novo');await pg.click('form[data-form=lanc] button:not([type=button])');await pg.waitForTimeout(800);
    {const n0=lanc.length;await pg.waitForSelector('form[data-form=replicar]',{timeout:4000});await pg.selectOption('#rN','3');await shot(pg,'replicar');await pg.click('form[data-form=replicar] button:not([type=button])');await pg.waitForTimeout(900);if(lanc.length!==n0+3)errs.push('replicar: esperava +3, veio +'+(lanc.length-n0));const novos=lanc.slice(-3).map(l=>l.competencia).join(',');console.log('REPLICADOS',novos)}
    {await pg.evaluate(()=>location.hash='lancamentos');await pg.waitForTimeout(700);const tr=await pg.$('tr[data-lanc]');const lid=await tr.getAttribute('data-lanc');await tr.click();await pg.waitForTimeout(500);await shot(pg,'lanc-detalhe');await pg.click('[data-acao=editar-lanc]');await pg.waitForTimeout(300);
     await pg.fill('#lValor','777,77');await pg.fill('#lDesc','Editado no teste');await pg.fill('#lPag','2026-11-03');await shot(pg,'lanc-editar');await pg.click('form[data-form=lanc-edit] button:not([type=button])');await pg.waitForTimeout(900);
     const L=lanc.find(x=>x.id===lid),P=parc.filter(x=>x.lancamento_id===lid);console.log('EDITADO',L.valor,L.descricao,JSON.stringify(P.map(x=>[x.valor,x.status,x.data_pagamento,x.valor_pago])));if(Math.abs(L.valor)!==777.77||L.descricao!=='Editado no teste')errs.push('edição do lançamento não salvou')}
    // baixa
    await pg.evaluate(()=>location.hash='contas');await pg.waitForTimeout(600);const bx=await pg.$('[data-acao=baixar]');if(bx){await bx.click();await pg.waitForTimeout(300);await shot(pg,'baixa');await pg.click('form[data-form=baixa] button:not([type=button])');await pg.waitForTimeout(600)}else errs.push('sem parcela para baixar');
    // usuários
    await pg.evaluate(()=>location.hash='usuarios');await pg.waitForTimeout(600);await pg.click('[data-acao=convidar]');await pg.waitForTimeout(200);await shot(pg,'convite');
    await pg.fill('#uNome','Bruno');await pg.fill('#uEmail','bruno@exemplo.com');await pg.check(`[data-up="${predios[2].id}"]`);await pg.click('form[data-form=usuario] button:not([type=button])');await pg.waitForTimeout(600);await shot(pg,'link-acesso');
    // empresa nova
    await pg.evaluate(()=>location.hash='empresas');await pg.waitForTimeout(500);await pg.click('[data-acao=nova-empresa]');await pg.fill('#eCnpj','11.111.111/0001-11');await pg.fill('#eRazao','Teste SA');await pg.click('form[data-form=empresa] button:not([type=button])');await pg.waitForTimeout(800);
    // faturamento
    await pg.evaluate(()=>location.hash='faturamento');await pg.waitForTimeout(900);await shot(pg,'faturamento');
    await pg.click('#fTipo [data-per=ano]');await pg.waitForTimeout(700);await shot(pg,'faturamento-ano');
    await pg.fill('#compras','40');await pg.press('#compras','Tab');await pg.waitForTimeout(500);
    const lp=await pg.$('[data-acao=lancar-pendentes]');if(lp){await lp.click();await pg.waitForTimeout(1500)}else errs.push('sem pendentes');
    await shot(pg,'faturamento-lancado');
    await pg.click('[data-acao=novo-fat]');await pg.waitForTimeout(300);await pg.selectOption('#fEmp2',empresas[0].id);await pg.waitForTimeout(200);await pg.fill('#fVal','1.000,00');await pg.selectOption('#fForma','credito_parcelado');await pg.fill('#fParc','3');await pg.dispatchEvent('#fParc','input');await pg.waitForTimeout(200);await shot(pg,'novo-fat');
    await pg.click('form[data-form=fat] button:not([type=button])');await pg.waitForTimeout(800);
    await pg.evaluate(()=>location.hash='tributos');await pg.waitForTimeout(600);await shot(pg,'tributos');
    await pg.click('[data-acao=definir-regime]');await pg.waitForTimeout(200);await shot(pg,'regime');await pg.click('[data-acao=fechar]');
    // orçamento travado, forecast e desvios
    await pg.evaluate(()=>location.hash='orcamento');await pg.waitForTimeout(700);await pg.selectOption('#orcEmp',empresas[0].id);await pg.waitForTimeout(500);await shot(pg,'orc-vazio');
    await pg.click('[data-acao=nova-versao][data-tipo=orcamento]');await pg.waitForTimeout(200);await pg.fill('#vAno','2026');await pg.fill('#vNome','Orçamento 2026');await pg.fill('#vAj','5');await shot(pg,'orc-novo');
    await pg.click('form[data-form=versao] button:not([type=button])');await pg.waitForTimeout(1200);await shot(pg,'orc-consolidado');await pg.selectOption('#orcPredio',predios[0].id);await pg.waitForTimeout(500);
    const cel=await pg.$('input.cel');await cel.fill('99.000');await cel.dispatchEvent('input');await pg.click('[data-acao=repetir]');await shot(pg,'orc-editar');
    await pg.click('[data-acao=salvar-orc]');await pg.waitForTimeout(1200);
    await pg.click('[data-acao=travar-versao]');await pg.waitForTimeout(200);await shot(pg,'orc-travar');await pg.click('[data-acao=travar-confirma]');await pg.waitForTimeout(1200);
    if(!DB.orcamento_versoes[0]?.congelada)errs.push('versão não travou');if(!DB.orcamento_caixa.length)errs.push('caixa orçado não gravado');
    await pg.click('[data-acao=nova-versao][data-tipo=forecast]');await pg.waitForTimeout(200);await pg.fill('#vAno','2026');await pg.selectOption('#vCorte','9');await pg.fill('#vNome','Forecast 2026 · Set');await pg.click('form[data-form=versao] button:not([type=button])');await pg.waitForTimeout(1200);await shot(pg,'orc-forecast');
    await pg.click('[data-orctab=acomp]');await pg.waitForTimeout(800);await pg.click('[data-abre=orb]');await pg.waitForTimeout(300);await shot(pg,'orc-acomp');
    await pg.click('[data-ver="'+DB.orcamento_versoes[0].id+'"]');await pg.click('[data-orctab=caixa]');await pg.waitForTimeout(900);await shot(pg,'orc-caixa');
    await pg.evaluate(()=>location.hash='premissas');await pg.waitForTimeout(600);await pg.selectOption('#premEmp',empresas[0].id);await pg.waitForTimeout(400);await shot(pg,'premissas');await pg.click('[data-acao=editar-premissa]');await pg.waitForTimeout(200);await shot(pg,'premissa-form');
    await pg.fill('#pPrazos','30/60/90');await pg.click('form[data-form=premissa] button:not([type=button])');await pg.waitForTimeout(600);console.log('TOAST',await pg.evaluate(()=>[document.querySelector('.toast')?.textContent,typeof FORMS.premissa,!!document.querySelector('form[data-form=premissa]'),JSON.stringify(S.premissas.slice(0,1))]));
    // contas bancárias
    await pg.evaluate(()=>location.hash='bancos');await pg.waitForTimeout(900);await shot(pg,'bancos');
    await pg.click('[data-acao=nova-conta-banc]');await pg.waitForTimeout(200);await pg.selectOption('#bEmp',empresas[0].id);await pg.fill('#bNome','Caixa Econômica Federal');await pg.dispatchEvent('#bNome','input');await pg.fill('#bAg','1234');await pg.fill('#bCc','00012345-6');await pg.fill('#bSaldo','2.500,00');await shot(pg,'banco-novo');
    await pg.click('form[data-form=banco] button:not([type=button])');await pg.waitForTimeout(900);const cx=bancos.find(x=>x.banco_nome==='Caixa Econômica Federal');if(!cx||cx.banco_codigo!=='104'||cx.saldo_inicial!==2500)errs.push('banco novo errado '+JSON.stringify(cx));
    await pg.click(`[data-acao=editar-banco][data-id="${cx.id}"]`);await pg.waitForTimeout(200);await pg.fill('#bCc','99999-0');await pg.click('form[data-form=banco] button:not([type=button])');await pg.waitForTimeout(900);if(cx.conta!=='99999-0')errs.push('edição do banco não salvou');await shot(pg,'bancos-depois');
    // salário líquido
    await pg.evaluate(()=>location.hash='salario');await pg.waitForTimeout(700);await pg.selectOption('#salEmp',empresas[0].id);await pg.waitForTimeout(500);await shot(pg,'salario-vazio');
    await pg.fill('#salBruto','5.900,00');await pg.press('#salBruto','Enter');await pg.waitForTimeout(800);await shot(pg,'salario');
    console.log('SAL',await pg.evaluate(()=>JSON.stringify(calcSalario(5900,0,0))),await pg.evaluate(()=>JSON.stringify(calcSalario(6000,0,0).ir)),await pg.evaluate(()=>JSON.stringify(calcSalario(4800,0,0).ir.total)));
    {const n0=DB.orcamento_linhas.length;await pg.click('form[data-form=sal-orc] button:not([type=button])');await pg.waitForTimeout(1500);const nl=DB.orcamento_linhas.length-n0;console.log('SAL-ORC linhas',nl,DB.orcamento_linhas.slice(-4).map(l=>l.competencia+' '+l.valor).join(' ; '),'contas novas',plano.filter(c=>c.codigo.startsWith('3.09')).map(c=>c.codigo+' '+c.nome).join(', '))}
    // extratos: OFX do Itaú com uma linha que já tem baixa, uma tarifa e um PIX novo
    {const pg_=parc.find(p=>p.status==='paga'&&p.conta_bancaria_id===bancos[0].id&&p.data_pagamento==='2026-10-10');const v=pg_.valor_pago.toFixed(2);
     const ofx=`OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST><DTSTART>20261001<DTEND>20261031\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261011120000<TRNAMT>${v}<FITID>A1<MEMO>PAGTO BOLETO\n</STMTTRN><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261015<TRNAMT>-45.90<FITID>A2<MEMO>TARIFA PACOTE DE SERVICOS\n</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261020<TRNAMT>500.00<FITID>A3<MEMO>PIX RECEBIDO CLIENTE ABC LTDA\n</STMTTRN></BANKTRANLIST><LEDGERBAL><BALAMT>1234.56<DTASOF>20261031</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
     await pg.evaluate(()=>location.hash='auditoria');await pg.waitForTimeout(800);await pg.selectOption('#extEmp',empresas[0].id);await pg.waitForTimeout(500);await pg.selectOption('#extBanco',bancos[0].id);await pg.waitForTimeout(500);await shot(pg,'ext-vazio');
     await pg.setInputFiles('#arqExt',{name:'itau_out.ofx',mimeType:'application/x-ofx',buffer:Buffer.from(ofx)});await pg.waitForTimeout(1200);await shot(pg,'ext-previa');
     await pg.click('[data-acao=ext-gravar]');await pg.waitForTimeout(1200);await shot(pg,'ext-conc');
     const st=DB.extrato_linhas.map(l=>l.status+':'+l.valor+':'+(l.conta_sugerida_id?plano.find(c=>c.id===l.conta_sugerida_id).nome:'-'));console.log('EXT OFX',st.join(' | '));
     if(DB.extrato_linhas.find(l=>l.documento==='A1')?.status!=='conciliado')errs.push('OFX: linha com baixa não conciliou');
     const pix=DB.extrato_linhas.find(l=>l.documento==='A3');await pg.selectOption(`[data-extconta="${pix.id}"]`,ct(empresas[0].id,'3.01.002'));await pg.waitForTimeout(200);
     await pg.click('[data-acao=ext-sel-todas]');await pg.waitForTimeout(500);const nL=lanc.length;await pg.click('[data-acao=ext-lancar]');await pg.waitForTimeout(1500);await shot(pg,'ext-lancado');
     console.log('EXT lançados',lanc.length-nL,'regras',DB.regras_classificacao.map(r=>r.padrao).join(','),'status',DB.extrato_linhas.map(l=>l.status).join(','));
     if(lanc.length-nL!==2)errs.push('extrato: esperava 2 lançamentos');
     // reenvio do mesmo arquivo: tudo repetido
     await pg.setInputFiles('#arqExt',{name:'itau_out.ofx',mimeType:'application/x-ofx',buffer:Buffer.from(ofx)});await pg.waitForTimeout(1200);
     if(!(await pg.$('[data-acao=ext-gravar][disabled]')))errs.push('extrato repetido não foi reconhecido');await pg.click('[data-acao=ext-cancelar]');
     // PDF no layout do Nubank
     await pg.selectOption('#extBanco',bancos[1].id);await pg.waitForTimeout(500);
     await pg.setInputFiles('#arqExt',path.join(__dirname,'fixtures/extrato_nubank_exemplo.pdf'));await pg.waitForTimeout(2500);await shot(pg,'ext-pdf');
     const lidas=await pg.evaluate(()=>S.ext.prev&&S.ext.prev.lin.map(l=>l.data+' '+l.valor+' '+l.historico));console.log('EXT PDF',JSON.stringify(lidas));
     if(!lidas||lidas.length!==4)errs.push('PDF Nubank: esperava 4 movimentações');
     await pg.click('[data-acao=ext-gravar]');await pg.waitForTimeout(1200);await shot(pg,'ext-pdf-conc');}
    // plano de contas e transferências
    await pg.evaluate(()=>location.hash='plano');await pg.waitForTimeout(700);await pg.selectOption('#planoEmp',empresas[0].id);await pg.waitForTimeout(700);await shot(pg,'plano');
    {const c=plano.find(x=>x.empresa_id===empresas[0].id&&x.codigo==='5.02.001');await pg.click(`[data-acao=editar-conta][data-id="${c.id}"]`);await pg.waitForTimeout(300);await shot(pg,'conta-editar');await pg.fill('#cCod','5.02.009');await pg.fill('#cNome','Aluguel e condomínio');await pg.click('form[data-form=conta] button:not([type=button])');await pg.waitForTimeout(900);if(c.codigo!=='5.02.009'||c.nome!=='Aluguel e condomínio')errs.push('edição da conta não salvou: '+c.codigo+' '+c.nome)}
    {const pai=plano.find(x=>x.empresa_id===empresas[0].id&&x.codigo==='5');await pg.click(`[data-acao=nova-subconta][data-id="${pai.id}"]`);await pg.waitForTimeout(300);const cod=await pg.inputValue('#cCod');await pg.fill('#cNome','Plano de saúde IPASGO');await shot(pg,'subconta');await pg.click('form[data-form=conta] button:not([type=button])');await pg.waitForTimeout(900);const nv=plano.find(x=>x.nome==='Plano de saúde IPASGO');console.log('SUBCONTA',cod,nv?.conta_pai===pai.id);if(!nv)errs.push('subconta não criada')}
    await pg.click('[data-acao=criar-transf]');await pg.waitForTimeout(900);await shot(pg,'plano-transf');console.log('TRANSF CONTAS',plano.filter(x=>/Transfer/.test(x.nome)&&x.empresa_id===empresas[0].id).map(x=>x.codigo+' '+x.nome).join(', '));
    await pg.evaluate(()=>location.hash='bancos');await pg.waitForTimeout(800);await pg.click('[data-acao=nova-transf]');await pg.waitForTimeout(300);await pg.selectOption('#tEmp',empresas[0].id);await pg.dispatchEvent('#tEmp','change');await pg.fill('#tVal','1.000,00');await shot(pg,'transf');
    {const n0=lanc.length,p0=parc.length;await pg.click('form[data-form=transf] button:not([type=button])');await pg.waitForTimeout(1200);if(lanc.length!==n0+2||parc.length!==p0+2)errs.push('transferência não gravou 2+2');await shot(pg,'bancos-transf');console.log('TRANSF',JSON.stringify(lanc.slice(-2).map(l=>[l.valor,l.vinculo_id?'vinc':''])))}
    await pg.evaluate(()=>location.hash='dre');await pg.waitForTimeout(800);if(await pg.evaluate(()=>!!document.querySelector('.chip.warn')&&/sem grupo/.test(document.body.textContent)))console.log('aviso sem grupo presente (pode ser de dado antigo)');
    // importação
    await pg.evaluate(()=>location.hash='importar');await pg.waitForTimeout(600);
    await pg.setInputFiles('#arqImp',{name:'antigos.csv',mimeType:'text/csv',buffer:Buffer.from(['CNPJ Empresa;Prédio;Data Competência;Data Vencimento;Data Pagamento;Conta Contábil;Centro de Custo;Produto/Serviço;Cliente/Fornecedor;CPF/CNPJ Parceiro;Documento;Descrição;Valor;Banco;Agência;Conta Corrente;Forma de Pagamento',
      '12.345.678/0001-90;Matriz · Santos;05/01/2024;05/02/2024;05/02/2024;3.01.001;Comercial;;Mercado Bom Preço;;NF 1;Venda;18.420,50;Itaú;0412;33871-2;Boleto',
      '12.345.678/0001-90;;10/01/2024;09/02/2024;;4.01.001;Logística;;Fornecedor Z;55.555.555/0001-55;NF 2;Compra;-8.520,00;;;;Boleto',
      '12.345.678/0001-90;Prédio X;31/02/2024;;;4.09.999;;;;;;;abc;;;;',
      '98.765.432/0001-10;Edifício Mar Azul;12/02/2024;;12/02/2024;3.01.002;COM;;Cliente Y;;;Aluguel;9800;Santander;0087;9999;PIX'].join('\n'))});
    await pg.waitForTimeout(600);await shot(pg,'import-conf');await pg.click('[data-acao=importar]');await pg.waitForTimeout(1500);await shot(pg,'import-feito');
  });
  await rodar({width:390,height:844},'mob',async pg=>{await pg.fill('#aEmail','evaldoalves561@gmail.com');await pg.fill('#aSenha','x');await pg.click('form[data-form=login] button');await pg.waitForSelector('[data-entra]',{timeout:8000});await shot(pg,'m-entrada');await pg.click('[data-entra="*"]');await pg.waitForSelector('.tile',{timeout:8000});await shot(pg,'m-painel');await pg.evaluate(()=>location.hash='boletos');await pg.waitForTimeout(800);await shot(pg,'m-boletos');
    for(const r of ['dre','usuarios','importar','orcamento','premissas','bancos','auditoria']){await pg.evaluate(r=>location.hash=r,r);await pg.waitForTimeout(700);await shot(pg,'m-'+r)}
    await pg.evaluate(()=>{location.hash='salario'});await pg.waitForTimeout(500);await pg.fill('#salBruto','5900');await pg.press('#salBruto','Enter');await pg.waitForTimeout(700);await shot(pg,'m-salario')});
  await b.close();srv.close();
  console.log('LOG',log.join(' | '));console.log('ORC',DB.orcamento_versoes.map(v=>v.nome+' '+v.tipo+' trav:'+v.congelada).join('; '),'linhas',DB.orcamento_linhas.length,'caixa',DB.orcamento_caixa.length,'premissa1',JSON.stringify(premissas[0].prazos_dias));console.log('ERROS',errs.length?errs.join('\n'):'nenhum');
  const novos=lanc.filter(l=>l.importacao_id);console.log('importados',novos.length,novos.map(l=>l.valor+' '+l.competencia+' cc:'+(centros.find(c=>c.id===l.centro_custo_id)?.nome)+' parc:'+(parceiros.find(p=>p.id===l.parceiro_id)?.nome)).join(' ; '));
})();
