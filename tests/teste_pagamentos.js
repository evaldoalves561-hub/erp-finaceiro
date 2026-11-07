// Teste da tela de pagamentos ao banco (CNAB 240) com o Supabase falso de teste_app.js
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
const bancos=[{id:id(),empresa_id:empresas[0].id,banco_nome:'Itaú',banco_codigo:'341',agencia:'0412',conta:'33871-2',saldo_inicial:0},{id:id(),empresa_id:empresas[1].id,banco_nome:'Santander',banco_codigo:'033',agencia:'0087',conta:'13004521-7',saldo_inicial:0}];
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
const DB={orcamento_versoes:[],orcamento_linhas:[],orcamento_caixa:[],premissas_conta:premissas,impostos_config:impostos,acordos_cartao:acordos,apuracoes:[],empresas,predios,plano_contas:plano,centros_custo:centros,contas_bancarias:bancos,parceiros,lancamentos:lanc,parcelas:parc,perfis,usuarios_empresas:empresas.map(e=>({usuario_id:UID,empresa_id:e.id,papel:'admin'})),produtos:[],importacoes:[]};
const usuarios=[{...perfis[0],ultimo_acesso:'2026-11-03T10:00:00Z',convite_aceito:true,empresas:empresas.map(e=>e.id),papel:'admin',predios:[]},{usuario_id:id(),email:'ana@exemplo.com',nome:'Ana Souza',master:false,ativo:true,ultimo_acesso:null,convite_aceito:false,empresas:[empresas[0].id],papel:'financeiro',predios:[predios[0].id]}];
// ---------- PostgREST falso
function filtrar(rows,q){
  for(const [k,v] of q){if(['select','order','limit','offset'].includes(k))continue;const [op,...r]=v.split('.');const val=r.join('.');
    rows=rows.filter(x=>{const a=x[k];if(op==='eq')return String(a)===val;if(op==='gte')return a!=null&&a>=val;if(op==='lte')return a!=null&&a<=val;if(op==='is')return a==null;return true})}
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
  if(p==='/functions/v1/usuarios-admin'){const b=req.postDataJSON();log.push('fn:'+b.acao);if(b.acao==='listar')return J({usuarios});return J({ok:true})}
  if(p==='/functions/v1/indicadores')return J({selic:{valor:15,data:'05/11/2026'},igpm:{mes:-0.36,acum12:-1.2,data:'01/10/2026'},dolar:{valor:5.38,var:-0.4,data:'03/11/2026'}});
  if(p==='/rest/v1/rpc/criar_empresa'){const b=req.postDataJSON();const e={id:id(),cnpj:b.p_cnpj,razao_social:b.p_razao_social,nome_fantasia:b.p_nome_fantasia};empresas.push(e);log.push('rpc criar_empresa');return J(e.id)}
  const t=p.replace('/rest/v1/','');const tab=DB[t];if(!tab)return J({message:'tabela '+t},404);
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
// ---------- pagamentos: tabelas extras
Object.assign(DB,{compras_pedidos:[],compras_itens:[],compras_cotacoes:[],compras_cotacao_itens:[],compras_eventos:[],estoque_movimentos:[],pagamento_lotes:[],pagamento_itens:[]});
const CN=require('../docs/pagamentos.js');const {montaBarras,linhaDigitavel}=require('./teste_cnab.js');
parceiros.push({id:id(),empresa_id:empresas[0].id,documento:'11222333000181',nome:'Gráfica Rápida',pix_tipo:'email',pix_chave:'pix@grafica.com.br',dados_pgto_conferidos:true});
// uma despesa com boleto e outra por PIX, vencendo na semana
const E0=empresas[0].id;const ct0=plano.find(x=>x.empresa_id===E0&&x.codigo==='5.03.001').id;
const lb={id:id(),empresa_id:E0,predio_id:predios[0].id,conta_id:ct0,parceiro_id:parceiros[2].id,competencia:'2026-11-01',valor:-850,descricao:'Panfletos'};lanc.push(lb);
parc.push({id:id(),empresa_id:E0,lancamento_id:lb.id,numero:1,vencimento:'2026-11-06',valor:-850,status:'aberta'});
const BAR=montaBarras('237','2026-11-09',1200,'1234567890123456789012345');
const lc={id:id(),empresa_id:E0,predio_id:predios[0].id,conta_id:ct0,parceiro_id:parceiros[1].id,competencia:'2026-11-01',valor:-1200,descricao:'Material de escritório'};lanc.push(lc);
parc.push({id:id(),empresa_id:E0,lancamento_id:lc.id,numero:1,vencimento:'2026-11-09',valor:-1200,status:'aberta'});
const LOGIN='teste@exemplo.com';
(async()=>{
  const b=await chromium.launch();const errs=[];
  const ctx=await b.newContext({viewport:{width:1366,height:900},deviceScaleFactor:1,acceptDownloads:true});const pg=await ctx.newPage();
  pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error'&&!/fonts.googleapis|ERR_/.test(m.text()))errs.push('console: '+m.text())});
  await pg.route('https://vovomhtwqfnlidqlmycu.supabase.co/**',rotear);await pg.route('https://fonts.googleapis.com/**',r=>r.abort());
  await pg.goto('http://localhost:8765/');await pg.waitForTimeout(400);
  const shot=async(n,p=pg)=>{await p.waitForTimeout(500);const ov=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);if(ov>0)errs.push(n+': overflow horizontal '+ov+'px');await p.screenshot({path:`${OUT}/p-${n}.png`,fullPage:true})};
  const sub=async sel=>{await pg.click(sel+' button:not([type=button])');await pg.waitForTimeout(900)};
  await pg.fill('#aEmail',LOGIN);await pg.fill('#aSenha','x12345678');await pg.click('form[data-form=login] button');await pg.waitForTimeout(1200);{const en=await pg.$('[data-entra="*"]')||await pg.$('[data-entra]');if(en)await en.click()}await pg.waitForSelector('.tile',{timeout:8000});
  await pg.evaluate(()=>location.hash='pagamentos');await pg.waitForTimeout(1200);
  await pg.selectOption('#pgEmp',E0);await pg.waitForTimeout(800);await shot('lista');
  // completar o boleto (linha digitável) e os dados da torrefação
  await pg.click(`tr:has-text("Material de escritório") [data-pg=dados]`);await pg.waitForTimeout(300);await pg.selectOption('#dMod','boleto');await pg.fill('#dBar',linhaDigitavel(BAR));await pg.dispatchEvent('#dBar','input');await pg.check('[name=conferido]');await shot('dados-boleto');await sub('form[data-form="pg-dados"]');
  await pg.click(`tr:has-text("4.01.001") [data-pg=dados] >> nth=0`).catch(()=>{});await pg.waitForTimeout(300);
  if(await pg.$('form[data-form="pg-dados"]')){await pg.selectOption('#dMod','ted');await pg.fill('#dDoc','23.456.789/0001-01');await pg.fill('#dBco','341');await pg.fill('#dAg','0412');await pg.fill('#dCc','33871');await pg.fill('[name=ccdv]','2');await pg.check('[name=conferido]');await sub('form[data-form="pg-dados"]')}
  await shot('lista-pronta');
  for(;;){const x=await pg.$('[data-pgsel]:not([disabled]):not(:checked)');if(!x)break;await x.click();await pg.waitForTimeout(400)}
  await pg.click('[data-pg=criar-lote]');await pg.waitForTimeout(1200);
  if(!DB.pagamento_lotes.length){console.log('TOAST',await pg.evaluate(()=>document.querySelector('.toast')?.textContent));await shot('erro-lote')}
  await shot('pos-lote');console.log('LOTES0',JSON.stringify(DB.pagamento_lotes.map(l=>[l.status,l.empresa_id===E0])));await pg.click('[data-pg=aprovar]');await pg.waitForTimeout(1000);
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:8000}),pg.click('[data-pg=remessa]')]);await pg.waitForTimeout(1000);
  const rem=require('fs').readFileSync(await dl.path(),'utf8');const L=rem.split('\r\n').filter(Boolean);if(L.some(l=>l.length!==240))errs.push('remessa com linha fora de 240');
  // retorno: tudo pago, menos o último
  const seus=DB.pagamento_itens.map(i=>i.seu_numero);
  const ret=L.map(l=>{let s=l;if(l[7]==='3'&&l[13]==='A'){const seu=l.slice(73,93).trim();s=s.slice(0,154)+'06112026'+l.slice(119,134)+s.slice(177,230)+(seu===seus[seus.length-1]?'AN':'00').padEnd(10,' ')}
    if(l[7]==='3'&&l[13]==='J'&&l.slice(17,19)!=='52'){s=s.slice(0,230)+'00'.padEnd(10,' ')}return s}).join('\r\n');
  await shot('lotes');
  await pg.setInputFiles('#pgRet',{name:'RET380_00001.RET',mimeType:'text/plain',buffer:Buffer.from(ret)});await pg.waitForTimeout(1800);await shot('retorno');
  await pg.click('[data-pglote]');await pg.waitForTimeout(400);await shot('lote-detalhe');
  const m=await b.newContext({viewport:{width:390,height:844}});const mp=await m.newPage();mp.on('pageerror',e=>errs.push('mob '+e.message));await mp.route('https://vovomhtwqfnlidqlmycu.supabase.co/**',rotear);await mp.route('https://fonts.googleapis.com/**',r=>r.abort());
  await mp.goto('http://localhost:8765/#pagamentos');await mp.waitForTimeout(400);await mp.fill('#aEmail',LOGIN);await mp.fill('#aSenha','x');await mp.click('form[data-form=login] button');await mp.waitForTimeout(1200);{const en=await mp.$('[data-entra="*"]')||await mp.$('[data-entra]');if(en)await en.click()}await mp.waitForTimeout(2200);await shot('m-pagamentos',mp);
  await b.close();srv.close();
  console.log('LOTES',DB.pagamento_lotes.map(l=>l.numero+':'+l.status+' '+l.total).join(', '));
  console.log('ITENS',DB.pagamento_itens.map(i=>i.seu_numero+' '+i.modalidade+' '+i.status+' '+(i.ocorrencias_txt||'')).join(' | '));
  console.log('PARCELAS PAGAS PELO CNAB',parc.filter(p=>/CNAB/.test(p.forma_pagamento||'')).map(p=>p.data_pagamento+' '+p.valor_pago).join('; '));
  console.log('ERROS',errs.length?errs.join('\n'):'nenhum');
})();
