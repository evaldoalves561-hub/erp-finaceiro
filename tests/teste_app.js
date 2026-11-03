// Teste do app com um Supabase falso (rotas interceptadas no navegador)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const APP=require('path').join(__dirname,'..','docs');const OUT=process.argv[2]||'.';
const UID='11111111-1111-4111-8111-111111111111';
let n=0;const id=()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;
// ---------- dados falsos
const empresas=[{id:id(),cnpj:'12345678000190',razao_social:'Café Serra Comércio Ltda',nome_fantasia:'Café Serra',ativa:true},{id:id(),cnpj:'98765432000110',razao_social:'Atlântico Administração de Imóveis Ltda',nome_fantasia:'Atlântico',ativa:true}];
const predios=[{id:id(),empresa_id:empresas[0].id,nome:'Matriz · Santos'},{id:id(),empresa_id:empresas[0].id,nome:'CD · Cubatão'},{id:id(),empresa_id:empresas[1].id,nome:'Edifício Mar Azul'}];
const MOD=[['3','Receitas',null,'receita',null,0],['3.01.001','Venda de produtos','3','receita','receita_bruta',1],['3.01.002','Serviços e aluguéis','3','receita','receita_bruta',1],['3.02.001','Impostos sobre vendas','3','despesa','deducoes',1],['4','Custos',null,'despesa',null,0],['4.01.001','Mercadorias (CMV)','4','despesa','custos',1],['5','Despesas operacionais',null,'despesa',null,0],['5.01.001','Salários e encargos','5','despesa','despesas_operacionais',1],['5.02.001','Aluguel','5','despesa','despesas_operacionais',1],['5.03.001','Marketing','5','despesa','despesas_operacionais',1],['6.01.001','Tarifas bancárias','5','despesa','resultado_financeiro',1],['9.99','Conta sem grupo','5','despesa',null,1]];
const plano=[];empresas.forEach(e=>{const m={};MOD.forEach(r=>{const c={id:id(),empresa_id:e.id,codigo:r[0],nome:r[1],conta_pai:r[2]?m[r[2]]:null,tipo:r[3],grupo_dre:r[4],analitica:!!r[5],ativa:true};m[r[0]]=c.id;plano.push(c)})});
const centros=[];empresas.forEach(e=>['COM Comercial','OPE Operação','ADM Administrativo'].forEach(x=>centros.push({id:id(),empresa_id:e.id,codigo:x.split(' ')[0],nome:x.split(' ')[1]})));
const bancos=[{id:id(),empresa_id:empresas[0].id,banco_nome:'Itaú',banco_codigo:'341',agencia:'0412',conta:'33871-2',saldo_inicial:0},{id:id(),empresa_id:empresas[1].id,banco_nome:'Santander',banco_codigo:'033',agencia:'0087',conta:'13004521-7',saldo_inicial:0}];
const parceiros=[{id:id(),empresa_id:empresas[0].id,documento:'23456789000101',nome:'Torrefação Serra Azul'},{id:id(),empresa_id:empresas[0].id,documento:null,nome:'Mercado Bom Preço'}];
const lanc=[],parc=[];const cc=(e,c)=>centros.find(x=>x.empresa_id===e&&x.codigo===c).id;const ct=(e,c)=>plano.find(x=>x.empresa_id===e&&x.codigo===c).id;
for(const ano of [2025,2026])for(let m=1;m<=12;m++){if(ano===2026&&m>10)break;
  const lin=[[0,0,'3.01.001',80000,'COM'],[0,1,'3.01.001',30000,'COM'],[0,0,'3.02.001',-9000,'ADM'],[0,0,'4.01.001',-42000,'OPE'],[0,1,'4.01.001',-15000,'OPE'],[0,0,'5.01.001',-18000,'ADM'],[0,0,'5.02.001',-6000,'ADM'],[0,1,'5.03.001',-2500,'COM'],[0,0,'6.01.001',-300,'ADM'],[1,2,'3.01.002',25000,'COM'],[1,2,'5.01.001',-9000,'ADM'],[1,null,'5.02.001',-3000,'ADM']];
  if(m===3)lin.push([0,0,'9.99',-500,'ADM']);
  lin.forEach(([ei,pi,cod,v,c])=>{const e=empresas[ei].id;const f=(1+(ano-2025)*.12)*(1+Math.sin(m)*.08);const val=Math.round(v*f*100)/100;const l={id:id(),empresa_id:e,predio_id:pi==null?null:predios[pi].id,conta_id:ct(e,cod),centro_custo_id:cc(e,c),parceiro_id:cod==='4.01.001'&&ei===0?parceiros[0].id:null,competencia:`${ano}-${String(m).padStart(2,'0')}-15`,valor:val,descricao:cod+' '+m+'/'+ano};lanc.push(l);
    const venc=new Date(Date.UTC(ano,m,10)).toISOString().slice(0,10);const pago=venc<'2026-10-25';
    parc.push({id:id(),empresa_id:e,lancamento_id:l.id,numero:1,vencimento:venc,valor:val,data_pagamento:pago?venc:null,valor_pago:pago?val:null,forma_pagamento:'Boleto',status:pago?'paga':'aberta',conta_bancaria_id:bancos[ei].id})})}
const perfis=[{usuario_id:UID,email:'evaldoalves561@gmail.com',nome:'Evaldo',master:true,ativo:true}];
const DB={empresas,predios,plano_contas:plano,centros_custo:centros,contas_bancarias:bancos,parceiros,lancamentos:lanc,parcelas:parc,perfis,usuarios_empresas:empresas.map(e=>({usuario_id:UID,empresa_id:e.id,papel:'admin'})),produtos:[],importacoes:[]};
const usuarios=[{...perfis[0],ultimo_acesso:'2026-11-03T10:00:00Z',convite_aceito:true,empresas:empresas.map(e=>e.id),papel:'admin',predios:[]},{usuario_id:id(),email:'ana@exemplo.com',nome:'Ana Souza',master:false,ativo:true,ultimo_acesso:null,convite_aceito:false,empresas:[empresas[0].id],papel:'financeiro',predios:[predios[0].id]}];
// ---------- PostgREST falso
function filtrar(rows,q){
  for(const [k,v] of q){if(['select','order','limit','offset'].includes(k))continue;const [op,...r]=v.split('.');const val=r.join('.');
    rows=rows.filter(x=>{const a=x[k];if(op==='eq')return String(a)===val;if(op==='gte')return a!=null&&a>=val;if(op==='lte')return a!=null&&a<=val;if(op==='is')return a==null;return true})}
  const o=q.get('order');if(o){const [c,d]=o.split('.');rows=rows.slice().sort((x,y)=>String(x[c]).localeCompare(String(y[c]))*(d==='desc'?-1:1))}
  const l=q.get('limit');if(l)rows=rows.slice(0,+l);return rows}
function embutir(t,rows,sel){if(t==='parcelas'&&/lancamentos\(/.test(sel))return rows.map(p=>{const l=lanc.find(x=>x.id===p.lancamento_id);return {...p,lancamentos:l?{predio_id:l.predio_id,descricao:l.descricao,conta_id:l.conta_id,parceiro_id:l.parceiro_id,competencia:l.competencia}:null}});return rows}
const log=[];
async function rotear(route){const req=route.request();const u=new URL(req.url());const m=req.method();const p=u.pathname;
  const J=(b,s=200)=>route.fulfill({status:s,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(b)});
  if(m==='OPTIONS')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  const user={id:UID,email:'evaldoalves561@gmail.com',aud:'authenticated',role:'authenticated'};
  if(p==='/auth/v1/token'){const tok='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:UID,exp:Math.floor(Date.now()/1e3)+3600})).toString('base64url')+'.x';return J({access_token:tok,token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1e3)+3600,refresh_token:'r',user})}
  if(p==='/auth/v1/user')return J(user);
  if(p==='/auth/v1/logout')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}});
  if(p==='/functions/v1/usuarios-admin'){const b=req.postDataJSON();log.push('fn:'+b.acao);if(b.acao==='listar')return J({usuarios});return J({ok:true})}
  if(p==='/rest/v1/rpc/criar_empresa'){const b=req.postDataJSON();const e={id:id(),cnpj:b.p_cnpj,razao_social:b.p_razao_social,nome_fantasia:b.p_nome_fantasia};empresas.push(e);log.push('rpc criar_empresa');return J(e.id)}
  const t=p.replace('/rest/v1/','');const tab=DB[t];if(!tab)return J({message:'tabela '+t},404);
  if(m==='GET'){let rows=filtrar(tab,u.searchParams);rows=embutir(t,rows,u.searchParams.get('select')||'');
    const rg=req.headers()['range'];if(rg){const [a,b]=rg.split('-').map(Number);rows=rows.slice(a,b+1)}
    if((req.headers()['accept']||'').includes('vnd.pgrst.object'))return J(rows[0]||null);return J(rows)}
  if(m==='POST'){let b=req.postDataJSON();const arr=Array.isArray(b)?b:[b];arr.forEach(x=>{x.id=x.id||id();tab.push(x)});log.push(`insert ${t} ${arr.length}`);
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
    await pg.fill('#aEmail','evaldoalves561@gmail.com');await pg.fill('#aSenha','x12345678');await pg.click('form[data-form=login] button');await pg.waitForSelector('.tile',{timeout:8000});
    await shot(pg,'painel');
    for(const r of ['dre','fluxo','contas','lancamentos','plano','empresas','importar','usuarios','auditoria']){await pg.evaluate(r=>location.hash=r,r);await pg.waitForTimeout(700);await shot(pg,r)}
    await pg.evaluate(()=>location.hash='dre');await pg.waitForTimeout(500);await pg.click('[data-abre=dop]');await pg.click('[data-dre=unid]');await shot(pg,'dre-unid');await pg.click('[data-dre=comp]');await shot(pg,'dre-comp');
    await pg.click('#fTipo [data-per=mes]');await shot(pg,'dre-mes');
    // filtro
    await pg.click('#fEmp');await pg.waitForTimeout(200);await shot(pg,'pop');await pg.click(`[data-fe="${empresas[1].id}"]`);await pg.click('[data-acao=pop-fechar]');await pg.evaluate(()=>location.hash='painel');await shot(pg,'painel-filtro');
    // novo lançamento
    await pg.evaluate(()=>location.hash='lancamentos');await pg.waitForTimeout(500);await pg.click('[data-acao=novo-lanc]');await pg.waitForTimeout(200);await shot(pg,'novo-lanc');
    await pg.selectOption('#lConta',{index:1});await pg.fill('#lValor','1.234,56');await pg.fill('#lParc','Fornecedor Novo');await pg.click('form[data-form=lanc] button:not([type=button])');await pg.waitForTimeout(800);
    // baixa
    await pg.evaluate(()=>location.hash='contas');await pg.waitForTimeout(600);const bx=await pg.$('[data-acao=baixar]');if(bx){await bx.click();await pg.waitForTimeout(300);await shot(pg,'baixa');await pg.click('form[data-form=baixa] button:not([type=button])');await pg.waitForTimeout(600)}else errs.push('sem parcela para baixar');
    // usuários
    await pg.evaluate(()=>location.hash='usuarios');await pg.waitForTimeout(600);await pg.click('[data-acao=convidar]');await pg.waitForTimeout(200);await shot(pg,'convite');
    await pg.fill('#uNome','Bruno');await pg.fill('#uEmail','bruno@exemplo.com');await pg.check(`[data-up="${predios[2].id}"]`);await pg.click('form[data-form=usuario] button:not([type=button])');await pg.waitForTimeout(600);
    // empresa nova
    await pg.evaluate(()=>location.hash='empresas');await pg.waitForTimeout(500);await pg.click('[data-acao=nova-empresa]');await pg.fill('#eCnpj','11.111.111/0001-11');await pg.fill('#eRazao','Teste SA');await pg.click('form[data-form=empresa] button:not([type=button])');await pg.waitForTimeout(800);
    // importação
    await pg.evaluate(()=>location.hash='importar');await pg.waitForTimeout(600);
    await pg.setInputFiles('#arqImp',{name:'antigos.csv',mimeType:'text/csv',buffer:Buffer.from(['CNPJ Empresa;Prédio;Data Competência;Data Vencimento;Data Pagamento;Conta Contábil;Centro de Custo;Produto/Serviço;Cliente/Fornecedor;CPF/CNPJ Parceiro;Documento;Descrição;Valor;Banco;Agência;Conta Corrente;Forma de Pagamento',
      '12.345.678/0001-90;Matriz · Santos;05/01/2024;05/02/2024;05/02/2024;3.01.001;Comercial;;Mercado Bom Preço;;NF 1;Venda;18.420,50;Itaú;0412;33871-2;Boleto',
      '12.345.678/0001-90;;10/01/2024;09/02/2024;;4.01.001;Logística;;Fornecedor Z;55.555.555/0001-55;NF 2;Compra;-8.520,00;;;;Boleto',
      '12.345.678/0001-90;Prédio X;31/02/2024;;;4.09.999;;;;;;;abc;;;;',
      '98.765.432/0001-10;Edifício Mar Azul;12/02/2024;;12/02/2024;3.01.002;COM;;Cliente Y;;;Aluguel;9800;Santander;0087;9999;PIX'].join('\n'))});
    await pg.waitForTimeout(600);await shot(pg,'import-conf');await pg.click('[data-acao=importar]');await pg.waitForTimeout(1500);await shot(pg,'import-feito');
  });
  await rodar({width:390,height:844},'mob',async pg=>{await pg.fill('#aEmail','evaldoalves561@gmail.com');await pg.fill('#aSenha','x');await pg.click('form[data-form=login] button');await pg.waitForSelector('.tile',{timeout:8000});await shot(pg,'m-painel');
    for(const r of ['dre','usuarios','importar']){await pg.evaluate(r=>location.hash=r,r);await pg.waitForTimeout(700);await shot(pg,'m-'+r)}});
  await b.close();srv.close();
  console.log('LOG',log.join(' | '));console.log('ERROS',errs.length?errs.join('\n'):'nenhum');
  const novos=lanc.filter(l=>l.importacao_id);console.log('importados',novos.length,novos.map(l=>l.valor+' '+l.competencia+' cc:'+(centros.find(c=>c.id===l.centro_custo_id)?.nome)+' parc:'+(parceiros.find(p=>p.id===l.parceiro_id)?.nome)).join(' ; '));
})();
