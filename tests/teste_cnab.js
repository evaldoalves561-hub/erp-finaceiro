// Teste do motor CNAB 240: remessa (TED, crédito em conta, PIX, boleto), boleto e leitura de retorno.
// Rodar: node tests/teste_cnab.js
const assert=require('assert');const C=require('../docs/pagamentos.js');
const dvMod11=s=>{let soma=0,p=2;for(let i=s.length-1;i>=0;i--){soma+=(+s[i])*p;p=p===9?2:p+1}let dv=11-soma%11;return dv===0||dv>9?1:dv};
function montaBarras(banco,venc,valor,livre){const fator=Math.round((new Date(venc+'T12:00:00Z')-new Date('2022-05-29T12:00:00Z'))/864e5);
  const semDv=banco+'9'+String(fator).padStart(4,'0')+String(Math.round(valor*100)).padStart(10,'0')+livre;return semDv.slice(0,4)+dvMod11(semDv)+semDv.slice(4)}
const mod10=s=>{let soma=0,p=2;for(let i=s.length-1;i>=0;i--){let x=(+s[i])*p;soma+=x>9?x-9:x;p=p===2?1:2}return (10-soma%10)%10};
function linhaDigitavel(b){const c1=b.slice(0,4)+b.slice(19,24),c2=b.slice(24,34),c3=b.slice(34,44);return c1+mod10(c1)+c2+mod10(c2)+c3+mod10(c3)+b[4]+b.slice(5,19)}
let ok=0;const t=(n,f)=>{f();ok++;console.log('ok -',n)};

const bar=montaBarras('341','2026-11-20',1234.56,'1091234567812345678901230');
t('boleto pelo código de barras',()=>{const b=C.boleto(bar,'2026-11-04');assert.equal(b.erro,undefined);assert.equal(b.banco,'341');assert.equal(b.valor,1234.56);assert.equal(b.venc,'2026-11-20')});
t('boleto pela linha digitável',()=>{const ld=linhaDigitavel(bar);assert.equal(ld.length,47);assert.equal(C.barras(ld),bar);assert.equal(C.boleto(ld,'2026-11-04').valor,1234.56)});
t('boleto com dígito errado é recusado',()=>{const ruim=bar.slice(0,4)+((+bar[4]+1)%10)+bar.slice(5);assert.ok(C.boleto(ruim,'2026-11-04').erro)});
t('conta de consumo é recusada',()=>assert.ok(C.boleto('8'.padEnd(44,'1'),'2026-11-04').erro));

const emp={cnpj:'12.345.678/0001-90',nome:'Café Serra Comércio Ltda'};
const conta={banco:'380',bancoNome:'PicPay',agencia:'0001',agencia_dv:'',conta:'1234567',conta_dv:'8',convenio:'ABC123'};
const fav={nome:'Torrefação Serra Azul',doc:'23.456.789/0001-01',banco:'341',agencia:'0412',agencia_dv:'',conta:'33871',conta_dv:'2'};
const itens=[
  {seu:'L00001I0001',modalidade:'ted',valor:4517.5,data:'2026-11-10',fav},
  {seu:'L00001I0002',modalidade:'pix',valor:300,data:'2026-11-10',fav:{...fav,pix_tipo:'email',pix_chave:'financeiro@serraazul.com.br'}},
  {seu:'L00001I0003',modalidade:'boleto',valor:1234.56,data:'2026-11-10',barras:bar,venc:'2026-11-20',valorTitulo:1234.56,fav},
  {seu:'L00001I0004',modalidade:'credito_conta',valor:99.9,data:'2026-11-10',fav:{...fav,banco:'380'}},
];
const rem=C.remessa({emp,conta,nsa:1,agora:new Date('2026-11-04T15:30:00Z'),itens});
const L=rem.split('\r\n').filter(Boolean);
t('todas as linhas com 240 posições',()=>L.forEach(l=>assert.equal(l.length,240)));
t('header e trailer do arquivo',()=>{assert.equal(L[0].slice(0,8),'38000000');assert.equal(L[0].slice(18,32),'12345678000190');assert.equal(L[0][142],'1');assert.equal(L[0].slice(157,163),'000001');
  const tr=L[L.length-1];assert.equal(tr.slice(3,8),'99999');assert.equal(+tr.slice(17,23),4);assert.equal(+tr.slice(23,29),L.length)});
t('um lote por forma de lançamento',()=>{const hs=L.filter(l=>l[7]==='1').map(l=>l.slice(11,13)).sort();assert.deepEqual(hs,['01','31','41','45'])});
t('totais dos lotes',()=>{L.filter(l=>l[7]==='5').forEach(tr=>{const lote=tr.slice(3,7);const det=L.filter(l=>l.slice(3,7)===lote&&l[7]==='3');assert.equal(+tr.slice(17,23),det.length+2);
  const soma=det.filter(l=>l[13]==='A').reduce((s,l)=>s+ +l.slice(119,134),0)+det.filter(l=>l[13]==='J'&&l.slice(17,19)!=='52').reduce((s,l)=>s+ +l.slice(152,167),0);assert.equal(+tr.slice(23,41),soma)})});
t('segmento J com código de barras e J-52',()=>{const j=L.find(l=>l[13]==='J'&&l.slice(17,61)===bar);assert.ok(j);assert.equal(j.slice(182,202).trim(),'L00001I0003');assert.ok(L.some(l=>l[13]==='J'&&l.slice(17,19)==='52'))});
t('PIX com chave no segmento B',()=>{const b=L.find(l=>l[13]==='B'&&l.includes('FINANCEIRO@SERRAAZUL.COM.BR')||l[13]==='B'&&l.includes('financeiro@serraazul.com.br'));assert.ok(b);assert.equal(b.slice(14,16),'02')});
t('TED com câmara 018 e conta do favorecido',()=>{const a=L.find(l=>l[13]==='A'&&l.slice(73,93).trim()==='L00001I0001');assert.equal(a.slice(17,20),'018');assert.equal(a.slice(20,23),'341');assert.equal(a.slice(29,41),'000000033871');assert.equal(+a.slice(119,134),451750)});

// retorno simulado a partir da remessa: TED paga, PIX agendado, boleto pago, crédito rejeitado
const oc={L00001I0001:'00',L00001I0002:'BD',L00001I0003:'00',L00001I0004:'AN'};
const ret=L.map(l=>{let s=l;if(l[7]==='0')s=s.slice(0,142)+'2'+s.slice(143);
  if(l[7]==='3'&&l[13]==='A'){const seu=l.slice(73,93).trim();s=s.slice(0,154)+'10112026'+l.slice(119,134)+s.slice(177,230)+oc[seu].padEnd(10,' ')}
  if(l[7]==='3'&&l[13]==='J'&&l.slice(17,19)!=='52'){const seu=l.slice(182,202).trim();s=s.slice(0,230)+oc[seu].padEnd(10,' ')}
  return s}).join('\r\n');
t('leitura do retorno',()=>{const r=C.retorno(ret);assert.equal(r.banco,'380');assert.equal(r.itens.length,4);
  const by=Object.fromEntries(r.itens.map(i=>[i.seu,i]));assert.equal(by.L00001I0001.status,'pago');assert.equal(by.L00001I0001.data,'2026-11-10');assert.equal(by.L00001I0001.valor,4517.5);
  assert.equal(by.L00001I0002.status,'agendado');assert.equal(by.L00001I0003.status,'pago');assert.equal(by.L00001I0003.valor,1234.56);assert.equal(by.L00001I0004.status,'rejeitado');assert.match(by.L00001I0004.txt,/Conta do favorecido/)});
t('arquivo que não é CNAB é recusado',()=>assert.throws(()=>C.retorno('qualquer coisa')));
if(require.main===module)console.log(`\n${ok} testes passaram`);
module.exports={montaBarras,linhaDigitavel};
