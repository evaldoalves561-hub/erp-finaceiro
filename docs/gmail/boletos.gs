/**
 * Gevans Gestor · Boletos do Gmail (versão 3)
 *
 * Roda na sua conta Google (script.google.com), procura e-mails com boleto,
 * lê a linha digitável (no PDF, na imagem, no texto do e-mail ou no código de barras)
 * e manda para o app, que mostra cada boleto em "Boletos do e-mail" para você lançar como conta a pagar.
 *
 * Como instalar (uma vez):
 *  1. Em script.google.com crie um projeto novo e cole este arquivo inteiro.
 *  2. Escolha a função "instalar" e clique em Executar. Autorize o acesso pedido.
 * Pronto: ele verifica o e-mail a cada 30 minutos. Para parar, execute "desinstalar".
 *
 * Botão "Buscar boletos agora" no app (opcional):
 *  3. Implantar > Nova implantação > tipo "App da Web", executar como "Eu",
 *     acesso "Qualquer pessoa". Depois execute "instalar" de novo.
 *
 * Os ajustes da busca (quantos dias olhar, palavras extras, remetentes a ignorar ou a sempre ler)
 * são feitos no próprio app, em Boletos do e-mail > Configurar Gmail. Não precisa mexer aqui.
 */
const CONFIG = {
  SUPABASE_URL: '__SUPABASE_URL__',
  SUPABASE_KEY: '__SUPABASE_KEY__',
  TOKEN: '__TOKEN__',
  VERSAO: 3,
  ROTULO: 'gestor-boleto-lido',
  TERMOS: ['boleto', 'boletos', 'filename:boleto', '"linha digitável"', '"linha digitavel"', '"código de barras"', '"codigo de barras"',
           'fatura', 'faturas', 'cobrança', 'cobranca', '"segunda via"', '"2ª via"', '"2a via"', 'mensalidade', 'vencimento'],
  DIAS_PADRAO: 60,
  MAX_CONVERSAS: 300,      // por execução; o que sobrar fica para a próxima
  TEMPO_MAX_MS: 270000,    // o Google corta em 6 min; paramos antes
};

function instalar() {
  desinstalar();
  ScriptApp.newTrigger('buscarBoletos').timeBased().everyMinutes(30).create();
  registrarBotao();
  const r = buscarBoletos();
  console.log('Instalado. Primeira leitura: ' + JSON.stringify(r));
}

// Se o script estiver publicado como app da web, avisa o app do endereço para o botão "Buscar agora".
function registrarBotao() {
  const url = ScriptApp.getService().getUrl();
  if (!url || !/\/exec$/.test(url)) { console.log('Ainda não publicado como app da web: o botão "Buscar agora" fica desligado.'); return; }
  chamarApp('registrar_busca_boletos', { p_token: CONFIG.TOKEN, p_url: url });
  console.log('Botão "Buscar agora" ligado no app.');
}

// Chamado pelo botão "Buscar agora" do app. Só roda com o código certo.
function doPost(e) {
  let corpo = {};
  try { corpo = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  if (corpo.token !== CONFIG.TOKEN) return resposta({ ok: false, erro: 'código inválido' });
  return resposta(Object.assign({ ok: true }, buscarBoletos(!!corpo.releitura)));
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function desinstalar() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'buscarBoletos')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// Lê de novo todos os e-mails do período (útil depois de mudar os ajustes no app).
function lerTudoDeNovo() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).filter(k => /^lidos/.test(k)).forEach(k => props.deleteProperty(k));
  const rotulo = GmailApp.getUserLabelByName(CONFIG.ROTULO);
  if (rotulo) rotulo.getThreads(0, 500).forEach(t => t.removeLabel(rotulo));
  console.log(JSON.stringify(buscarBoletos()));
}

function buscarBoletos(releitura) {
  if (releitura === true) {
    const props = PropertiesService.getScriptProperties();
    Object.keys(props.getProperties()).filter(k => /^lidos/.test(k)).forEach(k => props.deleteProperty(k));
  }
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) return { conversas: 0, novos: 0, ocupado: true };
  const r = { versao: CONFIG.VERSAO, conversas: 0, mensagens: 0, novos: 0, repetidos: 0, ignorados: 0,
              pdfs: 0, pdfs_sem_texto: 0, sem_linha: 0, links: 0, erros: [], pendente: false, inicio: new Date().toISOString() };
  const t0 = Date.now();
  try {
    let cfg = {};
    try { cfg = chamarApp('registrar_leitura_boletos', { p_token: CONFIG.TOKEN, p_resumo: null }) || {}; }
    catch (e) { if (/inválido|invalido/i.test(String(e))) throw e; } // app ainda sem a atualização: segue com o padrão
    buscar(cfg, r, t0);
  } catch (e) {
    r.erros.push(String(e && e.message || e).slice(0, 200));
    console.error(e);
  } finally {
    r.duracao_s = Math.round((Date.now() - t0) / 1000);
    r.erros = r.erros.slice(-5);
    try { chamarApp('registrar_leitura_boletos', { p_token: CONFIG.TOKEN, p_resumo: r }); } catch (e) {}
    trava.releaseLock();
  }
  console.log(`${r.conversas} conversas, ${r.mensagens} e-mails lidos, ${r.novos} boletos novos, ${r.repetidos} já conhecidos, ` +
              `${r.sem_linha} sem linha digitável, ${r.links} em link, ${r.erros.length} erros.`);
  return r;
}

// ---------- lista de mensagens já lidas (guardada em pedaços: cada propriedade aceita só 9 KB)
function lerLidos(props) {
  const out = [];
  for (let i = 0; i < 20; i++) {
    const v = props.getProperty('lidos_' + i);
    if (!v) break;
    try { out.push.apply(out, JSON.parse(v)); } catch (e) {}
  }
  const antigo = props.getProperty('lidos'); // versão 2 guardava tudo junto
  if (antigo) { try { out.push.apply(out, JSON.parse(antigo)); } catch (e) {} props.deleteProperty('lidos'); }
  return out;
}
function gravarLidos(props, lidos) {
  const ult = lidos.slice(-4000);
  let i = 0;
  for (; i * 350 < ult.length; i++) props.setProperty('lidos_' + i, JSON.stringify(ult.slice(i * 350, (i + 1) * 350)));
  for (; i < 20; i++) props.deleteProperty('lidos_' + i);
}

function lista(v) { return (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(x => x.length > 1).slice(0, 40); }
const aspas = t => /[\s@]/.test(t) && !/^".*"$/.test(t) ? '"' + t.replace(/"/g, '') + '"' : t;

function consultas(cfg) {
  const dias = Math.min(Math.max(+cfg.dias || CONFIG.DIAS_PADRAO, 7), 365);
  const termos = CONFIG.TERMOS.concat(lista(cfg.termos_extras).map(aspas));
  const fora = cfg.incluir_promocoes ? '' : ' -category:promotions -category:social';
  const sempre = lista(cfg.sempre_remetentes);
  const q = [
    `(${termos.join(' OR ')}) newer_than:${dias}d -in:chats -in:spam -in:trash -label:${CONFIG.ROTULO}${fora}`,
    // e-mails novos em conversas que já foram lidas
    `label:${CONFIG.ROTULO} newer_than:3d -in:spam -in:trash`,
  ];
  if (sempre.length) q.push(`from:(${sempre.map(aspas).join(' OR ')}) newer_than:${dias}d -label:${CONFIG.ROTULO}`);
  return q;
}

function buscar(cfg, r, t0) {
  const rotulo = GmailApp.getUserLabelByName(CONFIG.ROTULO) || GmailApp.createLabel(CONFIG.ROTULO);
  const props = PropertiesService.getScriptProperties();
  const lidos = lerLidos(props);
  const jaLido = new Set(lidos);
  const ignorar = lista(cfg.ignorar_remetentes).map(x => x.toLowerCase());
  const vistas = new Set();
  try {
    for (const q of consultas(cfg)) {
      for (let ini = 0; ini < CONFIG.MAX_CONVERSAS; ini += 100) {
        const conversas = GmailApp.search(q, ini, 100);
        for (const conv of conversas) {
          if (Date.now() - t0 > CONFIG.TEMPO_MAX_MS) { r.pendente = true; return; }
          if (vistas.has(conv.getId())) continue;
          vistas.add(conv.getId());
          r.conversas++;
          let ok = true;
          for (const m of conv.getMessages()) {
            if (jaLido.has(m.getId())) continue;
            const de = (m.getFrom() || '').toLowerCase();
            if (!ignorar.some(x => de.indexOf(x) >= 0)) {
              r.mensagens++;
              try { processar(m, r); }
              catch (e) { ok = false; r.erros.push(m.getSubject() + ': ' + String(e && e.message || e).slice(0, 150)); console.error(m.getSubject(), e); continue; }
            }
            jaLido.add(m.getId()); lidos.push(m.getId());
          }
          if (ok) conv.addLabel(rotulo);
        }
        if (conversas.length < 100) break;
      }
    }
  } finally {
    gravarLidos(props, lidos);
  }
}

// ---------- leitura de uma mensagem
function textoHtml(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|td|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+/g, ' ');
}

function linkDeBoleto(html) {
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html || ''))) {
    const url = m[1].replace(/&amp;/g, '&'), txt = textoHtml(m[2]);
    if (!/^https?:\/\//i.test(url) || /unsubscribe|descadastr|privacidade|facebook|instagram|linkedin|twitter|youtube|whatsapp/i.test(url)) continue;
    if (/boleto|2[ªa]?\s*via|segunda via|fatura|pagar agora|visualizar.*(conta|cobran)/i.test(txt + ' ' + url)) return url.slice(0, 600);
  }
  return null;
}

function processar(m, r) {
  const html = m.getBody() || '';
  const corpo = ((m.getPlainBody() || '') + '\n' + textoHtml(html)).slice(0, 40000);
  const base = { gmail_id: m.getId(), remetente: m.getFrom(), assunto: m.getSubject(), recebido_em: m.getDate().toISOString() };
  const anexos = m.getAttachments({ includeInlineImages: false }).filter(a => {
    const tipo = a.getContentType() || '', nome = a.getName() || '';
    if (/pdf/i.test(tipo) || /\.pdf$/i.test(nome)) return true;
    return /^image\//i.test(tipo) && a.getSize() > 15000 && /boleto|fatura|cobran|2.?via|conta/i.test(nome);
  });
  const achados = [], vistos = {};
  anexos.forEach(a => {
    let txt = '', obs = null;
    r.pdfs++;
    try { txt = textoDoArquivo(a); }
    catch (e) {
      r.pdfs_sem_texto++;
      obs = /encrypt|password|senha|protect/i.test(String(e)) ? 'PDF protegido por senha (geralmente os primeiros dígitos do CPF/CNPJ). Abra o anexo no e-mail.'
        : 'Não consegui ler o anexo. Confira no e-mail.';
    }
    const b = extrair(txt, corpo, base.remetente);
    if (b.linha_digitavel && vistos[b.linha_digitavel]) return;
    if (b.linha_digitavel) vistos[b.linha_digitavel] = 1;
    const pareceBoleto = /boleto|fatura|cobran|vencimento|2.?via/i.test(base.assunto + ' ' + a.getName() + ' ' + txt.slice(0, 3000));
    if (b.linha_digitavel || (pareceBoleto && (obs || /boleto/i.test(base.assunto + ' ' + a.getName())))) {
      if (!b.linha_digitavel) { r.sem_linha++; obs = obs || 'Achei o boleto mas não a linha digitável. Confira o anexo no e-mail.'; }
      achados.push(Object.assign({}, b, { anexo: a.getName(), observacao: obs }));
    }
  });
  if (!achados.length) {
    const b = extrair('', corpo, base.remetente);
    if (b.linha_digitavel) achados.push(b);
    else {
      const link = linkDeBoleto(html);
      if (link && /boleto|fatura|cobran|2.?via/i.test(base.assunto + ' ' + corpo.slice(0, 4000))) {
        r.links++;
        achados.push(Object.assign({}, b, { link: link, observacao: 'O boleto veio em link. Abra o link para pegar a linha digitável.' }));
      }
    }
  }
  achados.forEach(b => {
    const st = enviar(Object.assign({}, base, b));
    if (st === 'novo') r.novos++; else if (st === 'ignorado') r.ignorados++; else r.repetidos++;
  });
}

// Converte o PDF (ou a imagem) em Google Docs com OCR só para ler o texto, e apaga a cópia em seguida.
function textoDoArquivo(anexo) {
  const limite = 'gestor' + Date.now();
  const meta = { name: 'gestor-boleto-temp', mimeType: 'application/vnd.google-apps.document' };
  const tipo = /^image\//i.test(anexo.getContentType() || '') ? anexo.getContentType() : 'application/pdf';
  const corpo = Utilities.newBlob('--' + limite + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) +
      '\r\n--' + limite + '\r\nContent-Type: ' + tipo + '\r\n\r\n').getBytes()
    .concat(anexo.copyBlob().getBytes())
    .concat(Utilities.newBlob('\r\n--' + limite + '--').getBytes());
  const auth = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
  const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&ocrLanguage=pt', {
    method: 'post', contentType: 'multipart/related; boundary=' + limite, payload: corpo, headers: auth, muteHttpExceptions: true,
  });
  if (r.getResponseCode() >= 300) throw new Error('Drive ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  const id = JSON.parse(r.getContentText()).id;
  try { return DocumentApp.openById(id).getBody().getText(); }
  finally {
    const d = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + id, { method: 'delete', headers: auth, muteHttpExceptions: true });
    if (d.getResponseCode() >= 300) DriveApp.getFileById(id).setTrashed(true);
  }
}

// ---------- leitura do boleto
function extrair(txtArq, corpo, remetente) {
  const texto = (txtArq || '') + '\n' + (corpo || '');
  const r = { linha_digitavel: null, valor: null, vencimento: null, beneficiario: null, documento_beneficiario: null };
  const linha = acharLinha(txtArq || '') || acharLinha(corpo || '');
  if (linha) { r.linha_digitavel = linha; Object.assign(r, decodificar(linha)); }
  if (!r.vencimento) {
    const v = texto.match(/(?:vencimento|vence em|data de venc\w*|pag[áa]vel at[ée])[^0-9]{0,40}(\d{2})[\/.](\d{2})[\/.](\d{2,4})/i);
    if (v) r.vencimento = `${v[3].length === 2 ? '20' + v[3] : v[3]}-${v[2]}-${v[1]}`;
  }
  if (!r.valor) {
    const v = texto.match(/(?:valor\s*(?:do documento|cobrado|a pagar|total|da fatura|\(R\$\))?|total a pagar|total da fatura)[^0-9]{0,30}([\d.]{1,12},\d{2})/i);
    if (v) r.valor = Number(v[1].replace(/\./g, '').replace(',', '.'));
  }
  const fonte = txtArq || texto;
  const ben = fonte.match(/(?:benefici[aá]rio|cedente)\s*(?:final)?\s*[:\-]?\s*\n?\s*([^\n]{3,140})/i);
  if (ben) {
    const nome = ben[1].replace(/\s*(CNPJ|CPF|Ag[êe]ncia|C[óo]digo).*$/i, '').replace(/[\t ]+/g, ' ').trim();
    if (nome.length > 2 && !/^(ag[êe]ncia|c[óo]digo|nosso n)/i.test(nome)) r.beneficiario = nome.slice(0, 200);
  }
  if (!r.beneficiario && remetente) {
    const n = String(remetente).replace(/<.*>/, '').replace(/"/g, '').trim();
    if (n && !/@/.test(n)) r.beneficiario = n.slice(0, 200);
  }
  const perto = ben ? fonte.slice(Math.max(0, ben.index - 50), ben.index + 400) : '';
  const doc = perto.match(/\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\b/) || fonte.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
  if (doc) r.documento_beneficiario = doc[1].replace(/\D/g, '');
  return r;
}

// Procura sequências de dígitos (com pontos e espaços no meio, como sai do OCR) e valida pelos dígitos verificadores.
function acharLinha(texto) {
  const t = String(texto || '').replace(/ /g, ' ');
  const re = /\d[\d.\s\-]{42,90}\d/g;
  let m;
  const consumo = [];
  while ((m = re.exec(t))) {
    const d = m[0].replace(/\D/g, '');
    if (d.length < 44) continue;
    for (let i = 0; i + 47 <= d.length; i++) {
      const s = d.slice(i, i + 47);
      if (s[0] !== '8' && linhaBancariaOk(s)) return s;
    }
    for (let i = 0; i + 48 <= d.length; i++) {
      const s = d.slice(i, i + 48);
      if (s[0] === '8' && linhaConsumoOk(s)) consumo.push(s);
    }
    // código de barras (44 dígitos) só tem um verificador: aceita apenas a sequência exata, sem deslizar
    if (d.length === 44) {
      if (d[0] !== '8' && barrasBancarioOk(d)) return barrasParaLinha(d);
      if (d[0] === '8' && barrasConsumoOk(d)) consumo.push(barrasConsumoParaLinha(d));
    }
  }
  return consumo[0] || null;
}

function linhaBancariaOk(d) {
  if (mod10(d.slice(0, 9)) !== +d[9] || mod10(d.slice(10, 20)) !== +d[20] || mod10(d.slice(21, 31)) !== +d[31]) return false;
  return barrasBancarioOk(d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31));
}
function barrasBancarioOk(b) {
  if (b.length !== 44) return false;
  let soma = 0, peso = 2;
  const s = b.slice(0, 4) + b.slice(5);
  for (let i = s.length - 1; i >= 0; i--) { soma += +s[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  let dv = 11 - (soma % 11);
  if (dv === 0 || dv === 10 || dv === 11) dv = 1;
  return dv === +b[4];
}
function barrasParaLinha(b) {
  const c1 = b.slice(0, 4) + b.slice(19, 24), c2 = b.slice(24, 34), c3 = b.slice(34, 44);
  return c1 + mod10(c1) + c2 + mod10(c2) + c3 + mod10(c3) + b[4] + b.slice(5, 19);
}
function dvConsumo(b, s) { return (b[2] === '6' || b[2] === '7') ? mod10(s) : mod11Consumo(s); }
function linhaConsumoOk(d) {
  for (let i = 0; i < 4; i++) { const bl = d.slice(i * 12, i * 12 + 11); if (dvConsumo(d, bl) !== +d[i * 12 + 11]) return false; }
  return true;
}
function barrasConsumoOk(b) { return b.length === 44 && dvConsumo(b, b.slice(0, 3) + b.slice(4)) === +b[3]; }
function barrasConsumoParaLinha(b) { return [0, 11, 22, 33].map(i => { const bl = b.slice(i, i + 11); return bl + dvConsumo(b, bl); }).join(''); }
function mod11Consumo(s) {
  let soma = 0, peso = 2;
  for (let i = s.length - 1; i >= 0; i--) { soma += +s[i] * peso; peso = peso === 9 ? 2 : peso + 1; }
  const r = soma % 11;
  return (r === 0 || r === 1) ? 0 : (r === 10 ? 1 : 11 - r);
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
    const n = +s[i] * peso;
    soma += n > 9 ? Math.floor(n / 10) + (n % 10) : n;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

function enviar(dados) {
  return chamarApp('receber_boleto_email', { p_token: CONFIG.TOKEN, p_dados: dados });
}

function chamarApp(funcao, args) {
  const resp = UrlFetchApp.fetch(CONFIG.SUPABASE_URL + '/rest/v1/rpc/' + funcao, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: CONFIG.SUPABASE_KEY, Authorization: 'Bearer ' + CONFIG.SUPABASE_KEY },
    payload: JSON.stringify(args),
    muteHttpExceptions: true,
  });
  if (resp.getResponseCode() >= 300) throw new Error('App respondeu ' + resp.getResponseCode() + ': ' + resp.getContentText());
  const txt = resp.getContentText();
  return txt ? JSON.parse(txt) : null;
}

// Para testar a leitura sem enviar nada: execute "testar" e veja o registro.
function testar() {
  let cfg = {};
  try { cfg = chamarApp('registrar_leitura_boletos', { p_token: CONFIG.TOKEN, p_resumo: null }) || {}; } catch (e) {}
  consultas(cfg).forEach(q => console.log('Busca:', q, '→', GmailApp.search(q, 0, 100).length, 'conversas (até 100)'));
  GmailApp.search(consultas(cfg)[0], 0, 5).forEach(c => c.getMessages().forEach(m => {
    let txt = '';
    m.getAttachments({ includeInlineImages: false }).filter(a => /pdf/i.test(a.getContentType())).forEach(a => {
      try { txt += textoDoArquivo(a) + '\n'; } catch (e) { console.log('PDF não lido:', a.getName(), String(e).slice(0, 120)); }
    });
    console.log(m.getSubject(), JSON.stringify(extrair(txt, m.getPlainBody() + '\n' + textoHtml(m.getBody()), m.getFrom())));
  }));
}
