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
})();
