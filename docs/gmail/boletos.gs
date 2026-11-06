/**
 * Gevans Gestor · Boletos do Gmail
 *
 * Roda na sua conta Google (script.google.com), procura e-mails com boleto,
 * lê a linha digitável (no PDF anexo ou no texto do e-mail) e manda para o app,
 * que mostra cada boleto em "Boletos do e-mail" para você lançar como conta a pagar.
 *
 * Como instalar (uma vez):
 *  1. Em script.google.com crie um projeto novo e cole este arquivo inteiro.
 *  2. Em "Serviços" (+), adicione "Drive API" (é usada para ler o texto dos PDFs).
 *  3. Escolha a função "instalar" e clique em Executar. Autorize o acesso pedido.
 * Pronto: ele verifica o e-mail a cada hora. Para parar, execute "desinstalar".
 */
const CONFIG = {
  SUPABASE_URL: '__SUPABASE_URL__',
  SUPABASE_KEY: '__SUPABASE_KEY__',
  TOKEN: '__TOKEN__',
  // E-mails dos últimos 45 dias que falam de boleto e ainda não foram lidos por este script
  BUSCA: '(boleto OR "linha digitável" OR "linha digitavel" OR "código de barras" OR "codigo de barras" OR fatura) newer_than:45d -label:gestor-boleto-lido -in:sent',
  ROTULO: 'gestor-boleto-lido',
  MAX_CONVERSAS: 40,
};

function instalar() {
  desinstalar();
  ScriptApp.newTrigger('buscarBoletos').timeBased().everyHours(1).create();
  buscarBoletos();
}

function desinstalar() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'buscarBoletos')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function buscarBoletos() {
  const rotulo = GmailApp.getUserLabelByName(CONFIG.ROTULO) || GmailApp.createLabel(CONFIG.ROTULO);
  const conversas = GmailApp.search(CONFIG.BUSCA, 0, CONFIG.MAX_CONVERSAS);
  let novos = 0;
  conversas.forEach(conv => {
    let ok = true;
    conv.getMessages().forEach(m => {
      try { novos += processar(m); } catch (e) { ok = false; console.error(m.getSubject(), e); }
    });
    if (ok) conv.addLabel(rotulo); // se der erro, tenta de novo na próxima hora
  });
  console.log(`${conversas.length} conversas verificadas, ${novos} boletos novos enviados ao app.`);
}

function processar(m) {
  const corpo = (m.getPlainBody() || '').slice(0, 20000);
  const base = {
    gmail_id: m.getId(),
    remetente: m.getFrom(),
    assunto: m.getSubject(),
    recebido_em: m.getDate().toISOString(),
  };
  const pdfs = m.getAttachments({ includeInlineImages: false })
    .filter(a => /pdf/i.test(a.getContentType()) || /\.pdf$/i.test(a.getName()));
  const achados = [];
  const vistos = {};
  pdfs.forEach(a => {
    let txt = '', obs = null;
    try { txt = textoDoPdf(a); } catch (e) { obs = 'Não consegui ler o PDF (pode ter senha). Confira o anexo no e-mail.'; }
    const b = extrair(txt, corpo);
    if (b.linha_digitavel && vistos[b.linha_digitavel]) return;
    if (b.linha_digitavel) vistos[b.linha_digitavel] = 1;
    if (b.linha_digitavel || (obs && /boleto/i.test(base.assunto + ' ' + corpo))) {
      achados.push(Object.assign({}, b, { anexo: a.getName(), observacao: obs }));
    }
  });
  if (!achados.length) {
    const b = extrair('', corpo);
    if (b.linha_digitavel) achados.push(b);
  }
  let novos = 0;
  achados.forEach(b => { if (enviar(Object.assign({}, base, b)) === 'novo') novos++; });
  return novos;
}

// Converte o PDF em Google Docs só para ler o texto, e apaga a cópia em seguida.
function textoDoPdf(anexo) {
  const arq = Drive.Files.create(
    { name: 'gestor-boleto-temp', mimeType: 'application/vnd.google-apps.document' },
    anexo.copyBlob(),
    { ocrLanguage: 'pt' }
  );
  try { return DocumentApp.openById(arq.id).getBody().getText(); }
  finally { try { Drive.Files.remove(arq.id); } catch (e) { DriveApp.getFileById(arq.id).setTrashed(true); } }
}

// ---------- leitura do boleto ----------
function extrair(txtPdf, corpo) {
  const texto = (txtPdf || '') + '\n' + (corpo || '');
  const r = { linha_digitavel: null, valor: null, vencimento: null, beneficiario: null, documento_beneficiario: null };
  const linha = acharLinha(texto);
  if (linha) {
    r.linha_digitavel = linha;
    Object.assign(r, decodificar(linha));
  }
  if (!r.vencimento) {
    const v = texto.match(/vencimento[^0-9]{0,40}(\d{2})\/(\d{2})\/(\d{4})/i);
    if (v) r.vencimento = `${v[3]}-${v[2]}-${v[1]}`;
  }
  if (!r.valor) {
    const v = texto.match(/valor\s*(?:do documento|cobrado|a pagar|total|\(R\$\))?[^0-9]{0,25}([\d.]{1,12},\d{2})/i);
    if (v) r.valor = Number(v[1].replace(/\./g, '').replace(',', '.'));
  }
  const ben = (txtPdf || texto).match(/(?:benefici[aá]rio|cedente)\s*(?:final)?\s*[:\-]?\s*\n?\s*([^\n]{3,120})/i);
  if (ben) r.beneficiario = ben[1].replace(/\s*(CNPJ|CPF).*$/i, '').replace(/[\t ]+/g, ' ').trim().slice(0, 200) || null;
  const doc = (txtPdf || texto).match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  if (doc) r.documento_beneficiario = doc[1].replace(/\D/g, '');
  return r;
}

function acharLinha(texto) {
  const t = texto.replace(/ /g, ' ');
  // Boleto bancário: 47 dígitos (5.5 5.6 5.6 1 14)
  const reBanco = /(\d{5})[.\s]?(\d{5})\s*(\d{5})[.\s]?(\d{6})\s*(\d{5})[.\s]?(\d{6})\s*(\d)\s*(\d{14})/g;
  let m;
  while ((m = reBanco.exec(t))) {
    const d = m.slice(1).join('');
    if (mod10(d.slice(0, 9)) === +d[9] && mod10(d.slice(10, 20)) === +d[20] && mod10(d.slice(21, 31)) === +d[31]) return d;
  }
  // Contas de consumo e tributos: 48 dígitos começando com 8 (4 blocos de 11 + dígito)
  const reConsumo = /(8\d{10})[\s-]*(\d)\s*(\d{11})[\s-]*(\d)\s*(\d{11})[\s-]*(\d)\s*(\d{11})[\s-]*(\d)/g;
  while ((m = reConsumo.exec(t))) {
    const d = m.slice(1).join('');
    if (d.length === 48) return d;
  }
  return null;
}

function decodificar(d) {
  if (d.length === 47) {
    const fator = +d.slice(33, 37), valor = +d.slice(37, 47) / 100;
    return { valor: valor || null, vencimento: fator ? dataDoFator(fator) : null };
  }
  // consumo: código de barras = 11 primeiros dígitos de cada bloco de 12
  const cb = [0, 12, 24, 36].map(i => d.slice(i, i + 11)).join('');
  const valorReal = cb[2] === '6' || cb[2] === '8';
  return { valor: valorReal ? (+cb.slice(4, 15) / 100) || null : null, vencimento: null };
}

// Fator de vencimento: base 07/10/1997; a partir de 22/02/2025 o fator recomeça em 1000.
function dataDoFator(f) {
  const dia = 86400000, hoje = Date.now();
  const antiga = Date.UTC(1997, 9, 7) + f * dia;
  const nova = Date.UTC(2025, 1, 22) + (f - 1000) * dia;
  const esc = Math.abs(nova - hoje) < Math.abs(antiga - hoje) ? nova : antiga;
  return new Date(esc).toISOString().slice(0, 10);
}

function mod10(s) {
  let soma = 0, peso = 2;
  for (let i = s.length - 1; i >= 0; i--) {
    let n = +s[i] * peso;
    soma += n > 9 ? Math.floor(n / 10) + (n % 10) : n;
    peso = peso === 2 ? 1 : 2;
  }
  const r = (10 - (soma % 10)) % 10;
  return r;
}

function enviar(dados) {
  const resp = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/rpc/receber_boleto_email', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: CONFIG.SUPABASE_KEY, Authorization: 'Bearer ' + CONFIG.SUPABASE_KEY },
    payload: JSON.stringify({ p_token: CONFIG.TOKEN, p_dados: dados }),
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() >= 300) throw new Error('App respondeu ' + resp.getResponseCode() + ': ' + resp.getContentText());
  return JSON.parse(resp.getContentText());
}

// Para testar a leitura sem enviar nada: execute "testar" e veja o registro.
function testar() {
  GmailApp.search(CONFIG.BUSCA.replace(/-label:\S+/, ''), 0, 5).forEach(c => c.getMessages().forEach(m => {
    const pdfs = m.getAttachments({ includeInlineImages: false }).filter(a => /pdf/i.test(a.getContentType()));
    let txt = '';
    pdfs.forEach(a => { try { txt += textoDoPdf(a) + '\n'; } catch (e) { console.log('PDF não lido:', a.getName()); } });
    console.log(m.getSubject(), JSON.stringify(extrair(txt, m.getPlainBody())));
  }));
}
