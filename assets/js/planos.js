/* rsscreen — página de planos (/planos/). Os preços vêm de config/clientes.js (planos). */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = RS.esc;
  const PLANOS = (RS.CFG.planos || []).filter(p => p.id !== 'cortesia' && p.valor > 0);
  const plano = id => PLANOS.find(p => p.id === id);
  const money = v => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const INCLUI = {
    essencial: ['Notícias: 25 assuntos e mais de 90 sites', 'Previsão do tempo e cotações', 'Relógio, datas comemorativas e frases', 'Todos os modelos, horizontal e vertical'],
    completo: ['Tudo do Essencial', 'Futebol ao vivo, agenda e tabela', 'Resultados e estatísticas de loterias', 'Horóscopo do dia', 'Criador de anúncios dos seus anunciantes', 'Tabela de preços e cardápio que o cliente edita pelo celular', 'Playlist: a programação inteira num link', 'Conteúdos novos sem custo extra'],
    rede: ['Tudo do plano Completo', 'Preço especial a partir de 10 telas', 'Pacotes prontos por segmento', 'Atendimento prioritário'],
    gerenciado: ['Tudo do plano Completo', 'Nós montamos a programação da TV', 'Criamos os anúncios do estabelecimento', 'Configuração do player incluída']
  };
  const CHAMADA = {
    essencial: 'Para começar com o básico bem feito.',
    completo: 'O mais escolhido: tudo para vender anúncio.',
    rede: 'Para quem já tem uma rede de telas.',
    gerenciado: 'Para o estabelecimento que não quer mexer em nada.'
  };

  /* ---------- telas ao vivo ---------- */
  const demo = RS.demoClient();
  if (demo) {
    const u = o => RS.buildScreenUrl(Object.assign({ cliente: demo.chave, orientacao: 'horizontal' }, o));
    $('plTv').src = u({ modulo: 'rss', assunto: 'ultimas', layout: 'destaque', tema: 'noite', tempo: 8 });
    $('plTv2').src = u({ modulo: 'futebol', assunto: 'brasileirao-a', layout: 'placar', tema: 'floresta' });
    $('plTv3').src = u({ modulo: 'loterias', assunto: 'principais', layout: 'resultado', tema: 'noite' });
  } else {
    document.querySelector('.pl-screens').style.display = 'none';
  }

  /* ---------- a conta ---------- */
  const num = id => Math.max(0, Number($(id).value) || 0);
  function conta() {
    const telas = Math.max(1, num('qTelas')), fat = telas * num('qAnun') * num('qPreco');
    const p = telas >= 10 && plano('rede') ? plano('rede') : plano('completo') || PLANOS[0];
    const custo = telas * (p ? p.valor : 0);
    $('qFat').textContent = 'R$ ' + money(fat);
    $('qCusto').textContent = 'R$ ' + money(custo);
    $('qSobra').textContent = 'R$ ' + money(fat - custo);
    const porAnun = num('qPreco') ? Math.ceil(custo / num('qPreco')) : 0;
    $('qNota').innerHTML = porAnun ? (porAnun <= 1 ? '<b>Um único anunciante</b> paga o rsscreen de todas as suas ' + telas + ' telas.' :
      'Bastam <b>' + porAnun + ' anunciantes</b> para pagar o rsscreen de todas as suas ' + telas + ' telas. O resto é lucro.') : '';
  }
  ['qTelas', 'qAnun', 'qPreco'].forEach(id => $(id).addEventListener('input', conta));

  /* ---------- planos ---------- */
  function cards() {
    const n = Math.max(1, Math.min(500, Number($('tQtd').value) || 1));
    const destaque = n >= 10 && plano('rede') ? 'rede' : 'completo';
    $('plCards').innerHTML = PLANOS.map(p => {
      const so10 = p.id === 'rede' && n < 10;
      const msg = 'Olá! Quero o plano ' + p.nome + ' do rsscreen para ' + n + (n > 1 ? ' telas' : ' tela') + '.';
      return '<article class="pl-card' + (p.id === destaque ? ' hot' : '') + (so10 ? ' off' : '') + '">' +
        (p.id === destaque ? '<span class="pl-flag">' + (p.id === 'rede' ? 'Melhor preço para você' : 'Mais escolhido') + '</span>' : '') +
        '<h3>' + esc(p.nome) + '</h3>' +
        '<p class="pl-call">' + esc(CHAMADA[p.id] || p.descricao || '') + '</p>' +
        '<div class="pl-price"><small>R$</small><b>' + money(p.valor) + '</b><span>por tela/mês</span></div>' +
        '<div class="pl-total">' + (so10 ? 'A partir de 10 telas' : n + (n > 1 ? ' telas' : ' tela') + ': <b>R$ ' + money(p.valor * n) + '/mês</b>') + '</div>' +
        '<ul>' + (INCLUI[p.id] || [p.descricao]).map(i => '<li>' + ICON('check') + '<span>' + esc(i) + '</span></li>').join('') + '</ul>' +
        '<a class="btn ' + (p.id === destaque ? 'btn-primary' : 'btn-dark') + ' js-wa" data-msg="' + esc(msg) + '" href="#">' + ICON('whatsapp') + ' Quero este plano</a>' +
      '</article>';
    }).join('');
    wireWhatsApp($('plCards'));
    const menor = Math.min.apply(null, PLANOS.map(p => p.valor));
    $('cmpPreco').textContent = 'a partir de R$ ' + money(menor);
    $('ctaFinal').setAttribute('data-msg', 'Olá! Quero testar o rsscreen grátis por 7 dias em ' + n + (n > 1 ? ' telas' : ' tela') + '.');
    wireWhatsApp(document.querySelector('.cta-final'));
  }
  $('tQtd').addEventListener('input', () => { cards(); });
  $('tMenos').addEventListener('click', () => { $('tQtd').value = Math.max(1, (Number($('tQtd').value) || 1) - 1); cards(); });
  $('tMais').addEventListener('click', () => { $('tQtd').value = Math.min(500, (Number($('tQtd').value) || 0) + 1); cards(); });

  /* ---------- conteúdos incluídos ---------- */
  RS.loadModules().then(mods => {
    $('plMods').innerHTML = mods.filter(m => m.status === 'ativo').map(m =>
      '<div class="pl-mod">' + ICON(m.icone || 'sparkles') + '<div><b>' + esc(m.nome) + '</b><span>' + esc(m.chamada || '') + '</span></div></div>').join('');
  }).catch(() => {});

  conta();
  cards();
})();
