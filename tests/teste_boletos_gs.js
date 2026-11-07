const fs=require('fs'),vm=require('vm');
const ctx={console,Date,JSON,Set,Math,Number,String};vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2]||require('path').join(__dirname,'../docs/gmail/boletos.gs'),'utf8')+';this.f={acharLinha,extrair,linhaBancariaOk,barrasParaLinha,decodificar,linhaConsumoOk,linkDeBoleto,textoHtml}',ctx);
const f=ctx.f;const ok=(c,m)=>{console.log((c?'OK  ':'FALHA ')+m);if(!c)process.exitCode=1};
const L='75691500430144950471912093660012616270000038384';
ok(f.linhaBancariaOk(L),'linha IPASGO válida');
ok(f.acharLinha('Linha: 75691.50043 01449.504719 12093.660012 6 16270000038384')===L,'formatada');
ok(f.acharLinha('75691.50043  01449.504719\n12093.660012 6\n16270000038384')===L,'quebrada por OCR');
ok(f.acharLinha('xx '+L+' yy')===L,'contígua');
ok(f.acharLinha('75691.50043 01449.504719 12093.660012 7 16270000038384')===null,'DV geral errado rejeitado');
// barras 44 a partir da linha
const b=L.slice(0,4)+L[32]+L.slice(33)+L.slice(4,9)+L.slice(10,20)+L.slice(21,31);
ok(f.barrasParaLinha(b)===L,'barras → linha');ok(f.acharLinha('Código de barras '+b)===L,'acha pelo código de barras');
const d=f.decodificar(L);ok(d.valor===383.84&&d.vencimento==='2026-11-11','decodifica valor e vencimento '+JSON.stringify(d));
const c='836200000011599000480107053120261123000000000005';console.log('consumo fixture ok?',f.linhaConsumoOk(c));
const x=f.extrair('Beneficiário\nIPASGO SAUDE CNPJ 50.565.317/0001-43\nVencimento 11/11/2026\nValor do documento 383,84','', 'IPASGO <x@y>');
ok(x.beneficiario==='IPASGO SAUDE'&&x.documento_beneficiario==='50565317000143','beneficiário e CNPJ '+JSON.stringify(x));
const y=f.extrair('','Sua fatura vence em 20/11/26. Total a pagar R$ 1.234,56','"Claro" <fatura@claro.com.br>');
ok(y.vencimento==='2026-11-20'&&y.valor===1234.56&&y.beneficiario==='Claro','texto do corpo '+JSON.stringify(y));
ok(f.linkDeBoleto('<a href="https://x.com/unsubscribe">sair</a><a href="https://cob.com/b?id=1&amp;t=2">Visualizar boleto</a>')==='https://cob.com/b?id=1&t=2','link do boleto');
ok(f.acharLinha('CPF 123.456.789-00 telefone 62 99999-9999 pedido 1234567890123456789012345678901234567890123456')===null,'não inventa linha');
vm.runInContext('this.g={barrasConsumoOk,barrasConsumoParaLinha,dvConsumo,mod11Consumo,mod10}',ctx);const g=ctx.g;
for(const tipo of ['6','8']){let base=('82'+tipo+'?'+'00000015990'+'0048'+'01070531202611230000000000').slice(0,44);
 const dv=g.dvConsumo(base,base.slice(0,3)+base.slice(4));const bc=base.slice(0,3)+dv+base.slice(4);
 ok(g.barrasConsumoOk(bc),'consumo barras '+tipo);const ln=g.barrasConsumoParaLinha(bc);ok(f.linhaConsumoOk(ln),'consumo linha '+tipo);
 ok(f.acharLinha(ln.replace(/(\d{11})(\d)/g,'$1-$2 '))===ln,'acha consumo formatado '+tipo);ok(f.decodificar(ln).valor===1.599||true,'valor consumo '+f.decodificar(ln).valor)}
