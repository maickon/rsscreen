/* rsscreen — ferramentas grátis: calculadora, proposta comercial e tabela de preços.
   Tudo roda no navegador; os campos ficam guardados só no aparelho (localStorage). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const num = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return isNaN(v) ? 0 : v; };
  const esc = RS.esc;
  const fmtN = n => Math.round(n).toLocaleString('pt-BR');

  function toast(msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // guarda e restaura os campos do formulário
  function persist(root, key) {
    const els = Array.from(root.querySelectorAll('input, select, textarea')).filter(e => e.id);
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      els.forEach(e => { if (saved[e.id] != null && saved[e.id] !== '') e.value = saved[e.id]; });
    } catch (_) {}
    return () => {
      const o = {};
      els.forEach(e => { o[e.id] = e.value; });
      try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) {}
    };
  }

  function wire(root, key, fn) {
    const save = persist(root, key);
    const run = () => { save(); fn(); };
    root.addEventListener('input', run);
    root.addEventListener('change', run);
    fn();
  }

  /* =================== CALCULADORA =================== */
  const calc = $('calc');
  if (calc) {
    let resumo = '';
    wire(calc, 'rs_calc_v1', () => {
      const telas = Math.max(1, num('cTelas')), anun = Math.max(0, num('cAnun')), preco = num('cPreco');
      const fat = telas * anun * preco;
      const repasse = fat * num('cRepasse') / 100;
      const imposto = fat * num('cImposto') / 100;
      const custo = telas * num('cSist') + repasse + imposto + num('cOutros');
      const lucro = fat - custo;
      const inv = telas * num('cEquip') + num('cTvs') * num('cTvPreco');
      const meses = lucro > 0 ? inv / lucro : Infinity;
      $('oFat').textContent = brl0(fat);
      $('oCusto').textContent = brl0(custo);
      $('oLucro').textContent = brl0(lucro);
      $('oInv').textContent = brl0(inv);
      $('oRet').textContent = !isFinite(meses) ? 'não se paga' : meses < 1 ? 'no 1º mês' : Math.ceil(meses) + (Math.ceil(meses) === 1 ? ' mês' : ' meses');
      $('oAno').textContent = brl0(lucro * 12 - inv);
      $('oLucro').parentNode.classList.toggle('neg', lucro < 0);

      const seg = Math.max(5, num('cSeg')), cont = Math.max(0, num('cCont')), horas = Math.max(1, num('cHoras'));
      const ciclo = Math.max(1, anun) * (seg + cont);
      const porHora = 3600 / ciclo, porDia = porHora * horas;
      $('oExib').innerHTML = anun ? 'Com ' + anun + ' anunciantes, a programação tem um ciclo de <b>' + Math.round(ciclo / 60 * 10) / 10 + ' min</b>. Cada anúncio aparece cerca de <b>' + fmtN(porHora) +
        ' vezes por hora</b>, <b>' + fmtN(porDia) + ' por dia</b> e <b>' + fmtN(porDia * 26) + ' por mês</b> em cada tela.' : 'Coloque quantos anunciantes cada tela vai ter.';

      let dica;
      if (lucro <= 0) dica = 'Com esses números a operação dá prejuízo. Aumente o número de anunciantes por tela ou reveja os custos antes de investir.';
      else if (porHora < 8) dica = 'O lucro é bom, mas com tantos anúncios cada um aparece poucas vezes por hora. Considere abrir mais um ponto em vez de lotar a mesma tela.';
      else if (meses > 12) dica = 'A operação dá lucro, mas o investimento demora mais de um ano para voltar. Comece pelos pontos que já têm TV para investir menos.';
      else dica = 'Números saudáveis: o investimento volta em ' + (meses < 1 ? 'menos de um mês' : Math.ceil(meses) + ' meses') + ' e cada anúncio aparece bastante. O desafio agora é vender: comece pelos comércios vizinhos dos pontos.';
      $('oDica').textContent = dica;

      resumo = 'Simulação de mídia indoor\n' + telas + ' telas · ' + anun + ' anunciantes por tela · ' + brl(preco) + ' por anúncio\n' +
        'Faturamento: ' + brl0(fat) + '/mês\nCustos: ' + brl0(custo) + '/mês\nLucro: ' + brl0(lucro) + '/mês\n' +
        'Investimento: ' + brl0(inv) + ' · Retorno: ' + $('oRet').textContent + '\nCada anúncio: ~' + fmtN(porDia) + ' exibições por dia por tela';
    });
    $('cCopiar').addEventListener('click', async () => toast((await RS.copyText(resumo)) ? 'Resumo copiado' : 'Não foi possível copiar'));
  }

  /* =================== PROPOSTA =================== */
  const prop = $('prop');
  if (prop) {
    const hoje = new Date();
    if (!$('pInicio').value) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);
      $('pInicio').value = d.toISOString().slice(0, 10);
    }
    let texto = '';
    const br = iso => iso ? iso.split('-').reverse().join('/') : '';
    wire(prop, 'rs_prop_v1', () => {
      const v = id => $(id).value.trim();
      const pontos = v('pPontos').split('\n').map(s => s.trim()).filter(Boolean);
      const n = Math.max(1, pontos.length);
      const valor = num('pValor'), meses = Math.max(1, num('pMeses')), desc = Math.min(90, num('pDesc'));
      const mensal = valor * (1 - desc / 100), total = mensal * meses;
      const exib = num('pExib'), seg = num('pSeg');
      const arte = { inclusa: 'Criação da arte inclusa.', cliente: 'O anunciante envia a arte pronta (imagem 1920×1080 ou 1080×1920).', cobrada: 'Criação da arte cobrada à parte, se necessária.' }[$('pArte').value];
      const validade = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + Math.max(1, num('pVal')));
      const empresa = v('pEmpresa') || 'Sua empresa';
      const cliente = v('pCliente') || 'Anunciante';

      $('pDoc').innerHTML =
        '<div class="doc-top"><div><h2>Proposta de anúncio</h2><small>Mídia indoor · TVs em pontos comerciais</small></div>' +
        '<div style="text-align:right"><b>' + esc(empresa) + '</b><br><small>' + esc(v('pWhats')) + '</small><br><small>' + hoje.toLocaleDateString('pt-BR') + '</small></div></div>' +
        '<p>Para: <b>' + esc(cliente) + '</b>' + (v('pContato') ? ' · A/C ' + esc(v('pContato')) : '') + '</p>' +
        '<h3>Onde o seu anúncio vai passar</h3>' +
        '<table><thead><tr><th>Ponto</th><th class="num">Exibições por dia</th><th class="num">Por mês (26 dias)</th></tr></thead><tbody>' +
        (pontos.length ? pontos : ['(informe os pontos)']).map(p => '<tr><td>' + esc(p) + '</td><td class="num">' + fmtN(exib) + '</td><td class="num">' + fmtN(exib * 26) + '</td></tr>').join('') +
        '<tr class="total"><td>Total</td><td class="num">' + fmtN(exib * n) + '</td><td class="num">' + fmtN(exib * n * 26) + '</td></tr></tbody></table>' +
        '<p style="margin-top:8px">Anúncio de <b>' + seg + ' segundos</b>, em rodízio com notícias, previsão do tempo e outros conteúdos que prendem a atenção do público.</p>' +
        '<h3>Investimento</h3>' +
        '<table><tbody>' +
          '<tr><td>Valor mensal</td><td class="num">' + brl(valor) + '</td></tr>' +
          (desc ? '<tr><td>Desconto de ' + desc + '% (contrato de ' + meses + (meses > 1 ? ' meses' : ' mês') + ')</td><td class="num">− ' + brl(valor - mensal) + '</td></tr>' : '') +
          '<tr class="total"><td>Você paga por mês</td><td class="num">' + brl(mensal) + '</td></tr>' +
          '<tr><td>Total do período (' + meses + (meses > 1 ? ' meses' : ' mês') + ')</td><td class="num">' + brl(total) + '</td></tr>' +
        '</tbody></table>' +
        '<h3>Condições</h3><ul>' +
          '<li>Início: ' + esc(br(v('pInicio')) || 'a combinar') + ', por ' + meses + (meses > 1 ? ' meses' : ' mês') + '.</li>' +
          '<li>Pagamento todo dia ' + Math.max(1, Math.min(28, num('pDia'))) + ', por Pix ou boleto.</li>' +
          '<li>' + arte + '</li>' +
          '<li>Troca da arte durante o contrato: 1 vez por mês sem custo.</li>' +
          (v('pObs') ? '<li>' + esc(v('pObs')) + '</li>' : '') +
          '<li>Proposta válida até ' + validade.toLocaleDateString('pt-BR') + '.</li>' +
        '</ul>' +
        '<div class="sign"><div>' + esc(empresa) + '</div><div>' + esc(cliente) + '</div></div>';

      texto = '*Proposta de anúncio: ' + cliente + '*\n\n' +
        'Seu anúncio de ' + seg + 's em ' + n + (n > 1 ? ' TVs' : ' TV') + ':\n' + pontos.map(p => '• ' + p).join('\n') + '\n\n' +
        'Cerca de *' + fmtN(exib * n * 26) + ' exibições por mês*.\n\n' +
        'Investimento: *' + brl(mensal) + '/mês*' + (desc ? ' (com ' + desc + '% de desconto)' : '') + ', por ' + meses + (meses > 1 ? ' meses' : ' mês') + '.\n' +
        arte + '\nPagamento todo dia ' + Math.max(1, Math.min(28, num('pDia'))) + '.\n\nProposta válida até ' + validade.toLocaleDateString('pt-BR') + '.\n' + empresa + (v('pWhats') ? ' · ' + v('pWhats') : '');
    });
    $('pPrint').addEventListener('click', () => window.print());
    $('pCopy').addEventListener('click', async () => toast((await RS.copyText(texto)) ? 'Texto copiado: cole no WhatsApp' : 'Não foi possível copiar'));
  }

  /* =================== TESTE DA TV =================== */
  if ($('testeUrl')) {
    const u = location.host + '/teste';
    $('testeUrl').textContent = u;
    $('copiarTeste').addEventListener('click', async () => toast((await RS.copyText('https://' + u)) ? 'Endereço copiado' : 'Não foi possível copiar'));
  }

  /* =================== TAMANHO DE TV =================== */
  const tv = $('tvsize');
  if (tv) {
    const TAMANHOS = [24, 32, 40, 43, 50, 55, 58, 65, 70, 75, 85, 98];
    const POL = 2.54;
    const DIAG = Math.sqrt(16 * 16 + 9 * 9);
    // altura da imagem (cm) de uma TV de "pol" polegadas, deitada ou em pé
    const altura = (pol, v) => pol * POL * (v ? 16 : 9) / DIAG;
    const largura = (pol, v) => pol * POL * (v ? 9 : 16) / DIAG;
    const diagonalPara = (alturaCm, v) => alturaCm / ((v ? 16 : 9) / DIAG) / POL;
    const padrao = pol => TAMANHOS.find(t => t >= pol - 0.5) || TAMANHOS[TAMANHOS.length - 1];
    const cm = v => v >= 10 ? Math.round(v) + ' cm' : (Math.round(v * 10) / 10).toString().replace('.', ',') + ' cm';
    $('zTabela').innerHTML = [32, 43, 50, 55, 65, 75].map(t =>
      '<tr><td>' + t + '"</td><td>' + Math.round(largura(t, false)) + ' × ' + Math.round(altura(t, false)) + ' cm</td><td>' +
      (Math.round(altura(t, false) * 6 / 100 * 10) / 10).toString().replace('.', ',') + ' m</td></tr>').join('');
    wire(tv, 'rs_tvsize_v1', () => {
      const dist = Math.max(0.5, num('zDist')) * 100, v = $('zOrient').value === 'v', k = Number($('zUso').value) || 6;
      const ideal = diagonalPara(dist / k, v), minimo = diagonalPara(dist / Math.min(10, k + 2), v);
      const rec = padrao(ideal), min = padrao(minimo);
      $('zTv').textContent = rec + ' pol.';
      $('zMin').textContent = min + ' pol.';
      const letra = dist / 120;
      $('zLetra').textContent = cm(letra);
      $('zTitulo').textContent = cm(letra * 2);
      const pct = Math.round(letra / altura(rec, v) * 1000) / 10;
      $('zDica').innerHTML = 'Para quem está a <b>' + (dist / 100).toString().replace('.', ',') + ' m</b>, uma TV de <b>' + rec + ' polegadas</b> ' + (v ? 'em pé' : 'deitada') +
        ' tem cerca de ' + Math.round(largura(rec, v)) + ' × ' + Math.round(altura(rec, v)) + ' cm de imagem. ' +
        'Nenhum texto do anúncio deve ter menos de <b>' + cm(letra) + '</b> de altura (cerca de ' + String(pct).replace('.', ',') + '% da altura da tela), e o preço ou título deve ter pelo menos <b>' + cm(letra * 2) + '</b>.' +
        (ideal > 98 ? ' A distância é grande demais para uma TV só: considere duas TVs ou um painel de LED.' : '');
    });
  }

  /* =================== TABELA DE PREÇOS =================== */
  const tab = $('tab');
  if (tab) {
    wire(tab, 'rs_tab_v1', () => {
      const base = num('tBase');
      const telas = [[1, 0], [2, num('tD2')], [3, num('tD3')], [5, num('tD3')]];
      const tempos = [[1, 0], [3, num('tM3')], [6, num('tM6')], [12, num('tM12')]];
      const empresa = $('tEmpresa').value.trim() || 'Sua empresa';
      $('tDoc').innerHTML =
        '<div class="doc-top"><div><h2>Tabela de anúncios</h2><small>Mídia indoor · anúncio de ' + num('tSeg') + ' segundos em rodízio com conteúdo</small></div>' +
        '<div style="text-align:right"><b>' + esc(empresa) + '</b><br><small>' + esc($('tWhats').value) + '</small></div></div>' +
        '<h3>Valor por mês</h3>' +
        '<table><thead><tr><th>Telas</th>' + tempos.map(t => '<th class="num">' + (t[0] === 1 ? 'Mensal' : t[0] + ' meses' + (t[1] ? ' (−' + t[1] + '%)' : '')) + '</th>').join('') + '</tr></thead><tbody>' +
        telas.map(t => '<tr><td>' + t[0] + (t[0] === 5 ? ' ou mais' : '') + (t[0] > 1 ? ' telas' : ' tela') + (t[1] ? ' <small style="color:#666">(−' + t[1] + '% por tela)</small>' : '') + '</td>' +
          tempos.map(m => '<td class="num">' + brl(base * t[0] * (1 - t[1] / 100) * (1 - m[1] / 100)) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table>' +
        '<p style="margin-top:6px;font-size:13px;color:#666">Para "5 ou mais telas", o valor mostrado é para 5 telas.</p>' +
        '<h3>Extras</h3><ul>' +
          (num('tArte') ? '<li>Criação da arte: ' + brl(num('tArte')) + ' (uma vez)</li>' : '<li>Criação da arte: grátis</li>') +
          (num('tVideo') ? '<li>Anúncio em vídeo de até 30 segundos: +' + num('tVideo') + '% no valor mensal</li>' : '') +
          (num('tExcl') ? '<li>Exclusividade no seu segmento: +' + num('tExcl') + '% no valor mensal</li>' : '') +
          '<li>Troca da arte: 1 vez por mês sem custo</li>' +
        '</ul>';
    });
    $('tPrint').addEventListener('click', () => window.print());
  }

  /* =================== CALCULADORA DE EXIBIÇÕES =================== */
  // Quantas vezes o anúncio aparece: volta = (anúncios na volta) × (duração + conteúdo entre eles).
  const ex = $('exib');
  if (ex) {
    const hm = v => { const m = String(v || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
    const dur = s => { s = Math.round(s); if (s < 60) return s + ' s'; const m = Math.floor(s / 60), r = s % 60; return m + ' min' + (r ? ' ' + r + ' s' : ''); };
    const hora = min => { const h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? String(m).padStart(2, '0') : ''); };
    let texto = '';
    wire(ex, 'rs_exib_v1', () => {
      const n = Math.max(1, Math.round(num('xAnun'))), d = Math.max(3, num('xDur')), c = Math.max(0, num('xConteudo'));
      const vezes = Math.max(1, Number($('xVezes').value) || 1), tvs = Math.max(1, Math.round(num('xTvs'))), dias = Math.min(7, Math.max(1, num('xDias')));
      let aberto = hm($('xFecha').value) - hm($('xAbre').value);
      if (aberto <= 0) aberto += 24 * 60;                       // fecha depois da meia-noite
      const slots = n + (vezes - 1);                            // anúncios numa volta (o vendido entra "vezes" vezes)
      const ciclo = slots * (d + c);
      const porDia = aberto * 60 / ciclo * vezes;
      const porMes = porDia * dias * 4.33;
      const intervalo = ciclo / vezes;
      $('xDia').textContent = fmtN(porDia * tvs);
      $('xCada').textContent = dur(intervalo);
      $('xMes').textContent = fmtN(porMes * tvs);
      $('xTela').textContent = dur(porDia * d);
      $('xCiclo').textContent = dur(ciclo);

      // barra de uma volta: o anúncio vendido espaçado, os outros anunciantes e o conteúdo entre eles
      const seus = new Set(Array.from({ length: vezes }, (_, i) => Math.round(i * slots / vezes)));
      const partes = [];
      for (let i = 0; i < slots && partes.length < 160; i++) {
        partes.push('<i class="' + (seus.has(i) ? 'c-seu' : 'c-anun') + '" style="flex:' + d + '"></i>');
        if (c) partes.push('<i class="c-cont" style="flex:' + c + '"></i>');
      }
      $('xBarra').innerHTML = partes.join('');
      const pctAnun = Math.round(slots * d / ciclo * 100);
      $('xResumo').innerHTML = 'Numa volta passam <b>' + slots + ' anúncio' + (slots > 1 ? 's' : '') + '</b> (' + pctAnun + '% do tempo) e <b>' + dur(slots * c) + '</b> de conteúdo. ' +
        'Com o ponto aberto das <b>' + hora(hm($('xAbre').value)) + '</b> às <b>' + hora(hm($('xFecha').value)) + '</b>, a programação dá cerca de <b>' + fmtN(aberto * 60 / ciclo) + ' voltas</b> por dia' +
        (tvs > 1 ? ', em cada uma das <b>' + tvs + ' TVs</b>' : '') + '.';

      // avisos de programação ruim
      const alertas = [];
      if (ciclo > 600) alertas.push('A volta passa de 10 minutos: quem fica pouco tempo no ponto pode sair sem ver o anúncio. Com esses tempos, cabem até ' + Math.max(1, Math.floor(300 / (d + c))) + ' anunciantes numa volta de 5 minutos; divida em duas programações ou coloque outra TV.');
      else if (ciclo > 300) alertas.push('A volta tem mais de 5 minutos. Funciona em lugares de espera longa (clínica, salão), mas em padaria ou lanchonete o ideal é até 5 minutos.');
      if (pctAnun > 50) alertas.push('Mais da metade do tempo é anúncio: a TV vira intervalo comercial e as pessoas param de olhar. Aumente o conteúdo entre os anúncios (notícias, clima, futebol).');
      if (d > 30) alertas.push('Anúncios acima de 30 segundos cansam na mídia indoor; 10 a 15 segundos costumam bastar.');
      $('xAlerta').hidden = !alertas.length;
      $('xAlertaTxt').innerHTML = alertas.join('<br><br>');

      const nome = $('xNome').value.trim();
      texto = (nome ? nome + ', seu' : 'Seu') + ' anúncio de ' + Math.round(d) + ' segundos aparece a cada ' + dur(intervalo) + ', das ' + hora(hm($('xAbre').value)) + ' às ' + hora(hm($('xFecha').value)) +
        ', o que dá cerca de ' + fmtN(porDia * tvs) + ' exibições por dia e ' + fmtN(porMes * tvs) + ' por mês' + (tvs > 1 ? ' nas ' + tvs + ' TVs' : '') +
        '. Entre os anúncios passam notícias e informações que fazem as pessoas olharem para a tela. ' +
        '(Estimativa pela programação, com a TV ligada durante o horário de funcionamento.)';
      $('xTexto').textContent = texto;
    });
    $('xCopiar').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => toast('Texto copiado'), () => toast('Selecione o texto e copie'));
    });
  }

  /* =================== GERADOR DE CONTRATO =================== */
  // Modelos informativos (revisão jurídica recomendada). Campo vazio vira uma linha para preencher à mão.
  const ctr = $('ctr');
  if (ctr) {
    const hoje = new Date();
    const em = n => { const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n); return d.toISOString().slice(0, 10); };
    if (!$('kInicio').value) $('kInicio').value = em(7);
    if (!$('kInst').value) $('kInst').value = em(7);
    const brd = iso => iso ? iso.split('-').reverse().join('/') : '____/____/______';
    const extenso = n => n === 1 ? '1 (um) mês' : n + ' meses';
    const NOMES = {
      estabelecimento: ['CONTRATO DE CESSÃO DE ESPAÇO PARA INSTALAÇÃO DE TELA DE MÍDIA INDOOR', 'ESTABELECIMENTO'],
      anunciante: ['CONTRATO DE VEICULAÇÃO DE PUBLICIDADE EM MÍDIA INDOOR', 'ANUNCIANTE'],
      autorizacao: ['AUTORIZAÇÃO PARA INSTALAÇÃO DE EQUIPAMENTO DE MÍDIA INDOOR', 'AUTORIZANTE'],
      parceria: ['TERMO DE PARCERIA COM DIVISÃO DE RECEITA DE MÍDIA INDOOR', 'ESTABELECIMENTO PARCEIRO']
    };
    let texto = '';
    wire(ctr, 'rs_ctr_v1', () => {
      const tipo = $('kTipo').value;
      ctr.querySelectorAll('[data-so]').forEach(el => { el.hidden = el.dataset.so.split(' ').indexOf(tipo) < 0; });
      $('kParteTit').textContent = tipo === 'anunciante' ? 'Anunciante' : 'Estabelecimento';
      const v = id => esc($(id).value.trim());
      const ou = (id, linha) => v(id) || '<span class="ctr-linha"></span>' + (linha ? ' <small class="ctr-dica">(' + linha + ')</small>' : '');
      const n = Math.max(1, Math.round(num('kMeses'))), aviso = Math.max(0, Math.round(num('kAviso')));
      const [titulo, papel] = NOMES[tipo];
      const op = '<b>' + ou('kOpNome') + '</b>, inscrito(a) no CPF/CNPJ sob o nº ' + ou('kOpDoc') + ', com endereço em ' + ou('kOpEnd') + ', doravante <b>OPERADOR</b>';
      const pt = '<b>' + ou('kPtNome') + '</b>, inscrito(a) no CPF/CNPJ sob o nº ' + ou('kPtDoc') + ', com endereço em ' + ou('kPtEnd') + ', neste ato representado(a) por ' + ou('kPtResp') + ', doravante <b>' + papel + '</b>';
      let c = [];   // cláusulas: [título, [parágrafos]]
      const prazo = ['O presente instrumento vigora por <b>' + extenso(n) + '</b>, a partir de <b>' + brd($('kInicio').value) + '</b>, renovando-se automaticamente por iguais períodos, salvo manifestação contrária de qualquer das partes.',
        'Qualquer das partes pode encerrar este instrumento a qualquer tempo, mediante aviso por escrito (inclusive por mensagem eletrônica) com <b>' + aviso + ' dias</b> de antecedência, sem multa, ressalvados os valores devidos até a data do encerramento.'];

      if (tipo === 'estabelecimento' || tipo === 'parceria') {
        const contra = tipo === 'parceria' ? 'pct' : $('kContra').value;
        const pct = tipo === 'parceria' ? num('kPct') : num('kPctEst');
        c.push(['Do objeto', ['O ESTABELECIMENTO cede ao OPERADOR, a título de ' + (contra === 'uso' ? 'parceria sem pagamento em dinheiro' : 'parceria remunerada') +
          ', espaço em suas dependências para a instalação e o funcionamento de tela de mídia indoor no seguinte local: <b>' + ou('kLocal', 'local da instalação') + '</b>.',
          'Os equipamentos instalados são: <b>' + ou('kEquip', 'descrição dos equipamentos') + '</b>.']]);
        c.push(['Da propriedade dos equipamentos', ['Os equipamentos são de propriedade exclusiva do OPERADOR e não integram o patrimônio do ESTABELECIMENTO, podendo ser retirados pelo OPERADOR a qualquer tempo e, obrigatoriamente, ao término deste instrumento.',
          'O ESTABELECIMENTO compromete-se a zelar pelos equipamentos e a comunicar ao OPERADOR, em até 48 horas, qualquer dano, defeito ou furto. Danos causados por mau uso ou negligência do ESTABELECIMENTO serão por ele ressarcidos.']]);
        c.push(['Das obrigações do estabelecimento', ['Manter a tela ligada durante o horário de funcionamento, com energia elétrica e acesso à internet (Wi-Fi) disponíveis, sem custo para o OPERADOR.',
          'Permitir o acesso do OPERADOR, em horário comercial, para instalação, manutenção e retirada dos equipamentos.',
          'Não alterar a programação, desconectar ou mudar os equipamentos de lugar sem autorização do OPERADOR.']]);
        c.push(['Das obrigações do operador', ['Instalar, configurar e manter os equipamentos em funcionamento, às suas expensas.',
          'Veicular apenas conteúdo lícito, informativo e publicitário, sem conteúdo ofensivo, político-partidário, adulto ou que viole a legislação.',
          'Não veicular anúncios de concorrentes diretos do ESTABELECIMENTO na tela instalada em suas dependências.']]);
        if (contra === 'uso') c.push(['Da contrapartida', ['Como contrapartida, o ESTABELECIMENTO terá direito a: <b>' + ou('kEspaco', 'espaço na programação') + '</b>, com conteúdo fornecido por ele e aprovado pelo OPERADOR. Não haverá pagamento em dinheiro entre as partes.']]);
        if (contra === 'fixo') c.push(['Da contrapartida', ['O OPERADOR pagará ao ESTABELECIMENTO o valor fixo de <b>' + brl(num('kFixo')) + ' por mês</b>, até o dia 10 do mês seguinte ao de referência, por Pix ou transferência.',
          'O ESTABELECIMENTO terá ainda direito a: <b>' + ou('kEspaco', 'espaço na programação') + '</b>.']]);
        if (contra === 'pct') c.push(['Da divisão da receita', ['O OPERADOR repassará ao ESTABELECIMENTO <b>' + pct + '% (' + pct + ' por cento)</b> da receita efetivamente recebida dos anúncios veiculados na tela instalada em suas dependências, descontados os tributos incidentes.',
          'O OPERADOR enviará ao ESTABELECIMENTO, até o dia <b>' + Math.max(1, Math.min(28, num('kContas') || 10)) + '</b> de cada mês, relatório com os anunciantes veiculados e os valores recebidos no mês anterior, efetuando o repasse no mesmo prazo.',
          'Meses sem receita de anúncios não geram repasse. A venda dos anúncios, os preços e os contratos com anunciantes são de responsabilidade exclusiva do OPERADOR.'].concat(tipo === 'estabelecimento' ? ['O ESTABELECIMENTO terá ainda direito a: <b>' + ou('kEspaco', 'espaço na programação') + '</b>.'] : [])]);
        c.push(['Do prazo e do encerramento', prazo.concat(['Encerrado o instrumento, o OPERADOR retirará os equipamentos em até 10 (dez) dias, e o ESTABELECIMENTO deverá disponibilizá-los no estado em que os recebeu, salvo o desgaste natural.'])]);
        c.push(['Da ausência de vínculo', ['Este instrumento não cria vínculo empregatício, societário ou de exclusividade entre as partes, que respondem cada uma por suas obrigações trabalhistas, fiscais e tributárias.']]);
      }

      if (tipo === 'anunciante') {
        const pontos = $('kPontos').value.split('\n').map(s => s.trim()).filter(Boolean);
        const arte = { inclusa: 'A criação da arte do anúncio está incluída no valor contratado. Alterações de conteúdo poderão ser solicitadas até 1 (uma) vez por mês, sem custo.',
          cliente: 'O ANUNCIANTE fornecerá a arte do anúncio pronta (imagem em 1920×1080 ou 1080×1920 pixels, ou vídeo em formato compatível), sendo responsável pelo seu conteúdo.',
          cobrada: 'A criação da arte, se solicitada ao OPERADOR, será cobrada à parte, conforme orçamento prévio aprovado pelo ANUNCIANTE.' }[$('kArte').value];
        c.push(['Do objeto', ['O OPERADOR veiculará o anúncio do ANUNCIANTE nas telas de mídia indoor instaladas nos seguintes pontos: ' +
          (pontos.length ? '<b>' + pontos.map(esc).join('; ') + '</b>' : '<span class="ctr-linha"></span> <small class="ctr-dica">(pontos)</small>') + '.',
          'O anúncio terá duração de <b>' + Math.round(num('kDur') || 15) + ' segundos</b> e será exibido <b>' + Math.max(1, Math.round(num('kInser') || 1)) + ' vez(es) a cada volta</b> da programação, em rodízio com outros anúncios e conteúdos informativos, durante o horário de funcionamento de cada ponto.',
          'O número de exibições informado em propostas é uma estimativa baseada na programação e no horário de funcionamento, podendo variar conforme o funcionamento dos pontos, quedas de energia ou de internet.']]);
        c.push(['Do conteúdo do anúncio', [arte, 'O ANUNCIANTE é responsável pela veracidade das informações, preços e ofertas anunciadas e pelo direito de uso de marcas e imagens fornecidas.',
          'O OPERADOR poderá recusar ou retirar anúncio com conteúdo ilegal, ofensivo, enganoso, adulto, político-partidário ou que concorra diretamente com o estabelecimento onde a tela está instalada, comunicando o ANUNCIANTE.']]);
        if ($('kExcl').value.trim()) c.push(['Da exclusividade', ['O OPERADOR garante ao ANUNCIANTE exclusividade nos seguintes termos: <b>' + v('kExcl') + '</b>, durante a vigência deste contrato.']]);
        c.push(['Do valor e do pagamento', ['O ANUNCIANTE pagará ao OPERADOR o valor de <b>' + brl(num('kValor')) + ' por mês</b>, com vencimento todo dia <b>' + Math.max(1, Math.min(28, Math.round(num('kDia') || 10))) + '</b>, por Pix, boleto ou transferência.',
          'O atraso no pagamento implicará multa de 2% (dois por cento) e juros de 1% (um por cento) ao mês. Após 10 (dez) dias de atraso, o OPERADOR poderá suspender a veiculação até a regularização, sem que isso suspenda a cobrança.',
          'O valor poderá ser reajustado anualmente, com aviso prévio de 30 (trinta) dias.']]);
        c.push(['Das falhas de exibição', ['Interrupções causadas por falta de energia, internet ou funcionamento dos pontos, ou por manutenção, não geram desconto quando somarem menos de 3 (três) dias no mês em determinado ponto. Acima disso, o OPERADOR concederá desconto proporcional ou compensará os dias em veiculação extra.']]);
        c.push(['Do prazo e do encerramento', prazo]);
      }

      if (tipo === 'autorizacao') {
        c.push(['Da autorização', ['O AUTORIZANTE, responsável pelo imóvel e pelo estabelecimento acima, autoriza o OPERADOR a instalar, no local <b>' + ou('kLocal', 'local da instalação') + '</b>, os seguintes equipamentos de mídia indoor: <b>' + ou('kEquip', 'descrição dos equipamentos') + '</b>.',
          'A instalação está prevista para <b>' + brd($('kInst').value) + '</b>, em horário combinado entre as partes, e inclui a fixação de suporte na parede ou no teto e a passagem de cabos, quando necessário.']]);
        c.push(['Das condições', ['Os equipamentos são de propriedade do OPERADOR, que se responsabiliza pela instalação, pela manutenção e por eventuais danos causados ao imóvel durante esses serviços.',
          'Ao retirar os equipamentos, o OPERADOR fará o acabamento dos furos de fixação, quando solicitado.',
          'As demais condições de funcionamento, contrapartidas e prazo serão definidas em contrato próprio entre as partes.']]);
      }

      if ($('kObs').value.trim()) c.push(['Disposições adicionais', [v('kObs').replace(/\n/g, '<br>')]]);
      c.push(['Do foro', ['As partes elegem o foro da comarca de <b>' + ou('kForo', 'cidade/UF') + '</b> para dirimir quaisquer dúvidas oriundas deste instrumento, com renúncia a qualquer outro.']]);

      const corpo = c.map((cl, i) => '<h3>Cláusula ' + (i + 1) + 'ª · ' + cl[0] + '</h3>' + cl[1].map((p, j) => '<p>' + (cl[1].length > 1 ? (i + 1) + '.' + (j + 1) + '. ' : '') + p + '</p>').join('')).join('');
      const local = (v('kForo') || '____________________') + ', ' + hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
      $('kDoc').innerHTML = '<h2 class="ctr-tit">' + titulo + '</h2>' +
        '<p>Pelo presente instrumento particular, de um lado ' + op + ', e de outro lado ' + pt + ', têm entre si justo e acordado o que segue:</p>' +
        corpo +
        '<p>E, por estarem de acordo, as partes assinam este instrumento em 2 (duas) vias de igual teor, na presença de 2 (duas) testemunhas.</p>' +
        '<p class="ctr-local">' + local + '</p>' +
        '<div class="sign"><div>OPERADOR<br>' + (v('kOpNome') || '') + '</div><div>' + papel + '<br>' + (v('kPtResp') || v('kPtNome') || '') + '</div></div>' +
        '<div class="sign"><div>Testemunha 1 · Nome e CPF</div><div>Testemunha 2 · Nome e CPF</div></div>' +
        '<p class="ctr-rodape">Modelo informativo gerado gratuitamente em rsscreen.com.br. Recomenda-se a revisão por advogado antes da assinatura.</p>';
      texto = $('kDoc').innerText;
    });
    $('kPrint').addEventListener('click', () => window.print());
    $('kCopy').addEventListener('click', () => {
      (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(() => toast('Texto copiado'), () => toast('Selecione o texto e copie'));
    });
  }
})();
