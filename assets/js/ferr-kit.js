/* rsscreen — gerador de mídia kit do ponto (tudo no navegador; fotos ficam só no aparelho) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = RS.esc;
  // "da Padaria", "do Açougue": escolhe pela primeira palavra do nome do ponto
  function daDo(nome) {
    const p = String(nome || '').trim().split(/\s+/)[0].toLowerCase();
    const fem = /(a|ã|ade|agem|ção|são)$/.test(p) && !/^(dia|clima|sistema|problema|programa|mapa)$/.test(p);
    return (fem ? 'da ' : 'do ') + nome;
  }
  const fmt = n => Math.round(n).toLocaleString('pt-BR');
  const PUBLICO = ['Mulheres', 'Homens', 'Famílias', 'Jovens', 'Adultos', 'Terceira idade', 'Moradores do bairro', 'Trabalhadores da região', 'Turistas'];
  const PORQUE = {
    padaria: ['O cliente volta todos os dias, às vezes duas vezes: o anúncio é visto de novo e de novo.', 'Fila no balcão e no caixa: tempo parado olhando para a TV.', 'Público do bairro, que compra perto de casa.'],
    clinica: ['Sala de espera: o público fica sentado vários minutos, com tempo para ler.', 'Pessoas preocupadas com saúde e bem-estar, dispostas a investir em si.', 'Ambiente de confiança, que passa credibilidade ao anunciante.'],
    salao: ['A cliente fica de 30 minutos a horas no local, olhando para a frente.', 'Público que investe em aparência, moda e bem-estar.', 'Conversa puxa conversa: o anúncio vira assunto.'],
    academia: ['O aluno vem várias vezes por semana: o anúncio é visto sempre.', 'Público ativo, que consome saúde, suplementos e roupas esportivas.', 'TV na recepção e entre os aparelhos, no intervalo dos exercícios.'],
    mercado: ['Grande movimento todos os dias, de todas as idades.', 'A TV fica perto do caixa, no momento da compra.', 'Ideal para ofertas, serviços do bairro e lançamentos.'],
    restaurante: ['O cliente fica sentado, sem pressa, durante a refeição.', 'Futebol e notícias na TV prendem a atenção da mesa toda.', 'Público com dinheiro no bolso, no momento de lazer.'],
    loterica: ['Fila diária, com tempo de espera.', 'Público de todas as classes, que volta toda semana.', 'Resultados e futebol na TV fazem todo mundo olhar.'],
    escola: ['Pais e alunos passam todos os dias, no mesmo horário.', 'Público familiar, que decide compras da casa.', 'Ambiente de confiança para marcas locais.'],
    loja: ['Cliente com intenção de compra, circulando pela loja.', 'A TV reforça marcas e serviços complementares.', 'Público da região, que compra no comércio local.'],
    outro: ['Público parado por alguns minutos, olhando para a TV.', 'Movimento diário de clientes da região.', 'Conteúdo vivo na tela faz as pessoas olharem, e o anúncio aparece.']
  };
  let publico = ['Famílias', 'Adultos', 'Moradores do bairro'];
  let fotos = [];

  /* ---------- guarda os campos no aparelho ---------- */
  const campos = Array.from(document.querySelectorAll('#kit input, #kit select')).filter(e => e.id && e.type !== 'file');
  try {
    const s = JSON.parse(localStorage.getItem('rs_kit_v1') || '{}');
    campos.forEach(e => { if (s[e.id] != null && s[e.id] !== '') e.value = s[e.id]; });
    if (Array.isArray(s._publico)) publico = s._publico;
    if (Array.isArray(s._fotos)) fotos = s._fotos;
  } catch (_) {}
  function salvar() {
    const o = { _publico: publico, _fotos: fotos };
    campos.forEach(e => { o[e.id] = e.value; });
    try { localStorage.setItem('rs_kit_v1', JSON.stringify(o)); }
    catch (_) { delete o._fotos; try { localStorage.setItem('rs_kit_v1', JSON.stringify(o)); } catch (__) {} }
  }

  function chips() {
    $('kPublico').innerHTML = PUBLICO.map(p => '<button type="button" class="chip' + (publico.indexOf(p) >= 0 ? ' on' : '') + '" data-p="' + esc(p) + '">' + esc(p) + '</button>').join('');
  }

  const v = id => ($(id).value || '').trim();
  const n = id => Math.max(0, Number($(id).value) || 0);
  let texto = '';

  function render() {
    const ponto = v('kPonto') || 'o ponto', tipo = $('kTipo').value;
    const pessoasMes = n('kPessoas') * Math.max(1, n('kDias'));
    const ciclo = Math.max(1, n('kAnun')) * (Math.max(5, n('kSeg')) + 30);   // anúncio + 30 s de conteúdo depois dele
    const exibDia = n('kHoras') * 3600 / ciclo;
    const vezesPessoa = n('kTempo') * 60 / ciclo;
    const vezesTxt = vezesPessoa >= 2 ? Math.floor(vezesPessoa) + ' vezes' : vezesPessoa >= 1 ? 'pelo menos 1 vez' : 'a cada ' + Math.ceil(1 / Math.max(vezesPessoa, 0.01)) + ' visitas';
    const tv = n('kTvs') + (n('kTvs') > 1 ? ' TVs' : ' TV') + (n('kPol') ? ' de ' + n('kPol') + '"' : '');

    $('kDoc').innerHTML =
      '<div class="kit-hero"><small>Mídia kit · ' + esc(v('kLocal')) + '</small><h2>Anuncie na TV ' + esc(daDo(ponto)) + '</h2>' +
        '<p>' + esc(tv) + ' com notícias, clima e entretenimento que prendem a atenção, e o seu anúncio no meio.</p></div>' +
      '<div class="kit-nums">' +
        '<div><b>' + fmt(n('kPessoas')) + '</b><span>pessoas por dia</span></div>' +
        '<div><b>' + fmt(pessoasMes) + '</b><span>pessoas por mês</span></div>' +
        '<div><b>' + fmt(exibDia) + '</b><span>exibições do seu anúncio por dia</span></div>' +
        '<div><b>' + n('kTempo') + ' min</b><span>tempo médio no local</span></div>' +
      '</div>' +
      (fotos.length ? '<div class="kit-fotos n' + fotos.length + '">' + fotos.map(f => '<img src="' + f + '" alt="">').join('') + '</div>' : '') +
      '<h3>Por que anunciar aqui</h3><ul>' + PORQUE[tipo].map(t => '<li>' + esc(t) + '</li>').join('') +
        '<li>Cada cliente vê o seu anúncio ' + esc(vezesTxt) + ' durante a visita.</li></ul>' +
      (publico.length ? '<h3>Quem frequenta</h3><p class="kit-tags">' + publico.map(p => '<span>' + esc(p) + '</span>').join('') + '</p>' : '') +
      '<h3>A tela</h3><p>' + esc(tv) + (v('kOnde') ? ': ' + esc(v('kOnde')) : '') + '. Até ' + n('kAnun') + ' anunciantes em rodízio, anúncios de ' + n('kSeg') + ' segundos, aberto ' + n('kHoras') + ' horas por dia.</p>' +
      (n('kValor') ? '<h3>Investimento</h3><p class="kit-preco"><b>R$ ' + n('kValor').toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '</b> por mês' + (v('kCond') ? ' · ' + esc(v('kCond')) : '') + '</p>' : '') +
      '<div class="kit-foot"><b>' + esc(v('kEmpresa') || 'Sua empresa') + '</b>' + (v('kWhats') ? ' · WhatsApp ' + esc(v('kWhats')) : '') + '</div>';

    texto = '*Anuncie na TV ' + daDo(ponto) + '* (' + v('kLocal') + ')\n\n' +
      '👥 ' + fmt(n('kPessoas')) + ' pessoas por dia (' + fmt(pessoasMes) + ' por mês)\n' +
      '📺 ' + tv + (v('kOnde') ? ', ' + v('kOnde').toLowerCase() : '') + '\n' +
      '🔁 Seu anúncio aparece cerca de ' + fmt(exibDia) + ' vezes por dia\n' +
      '⏱️ Cada cliente fica ' + n('kTempo') + ' min no local\n\n' +
      PORQUE[tipo].map(t => '• ' + t).join('\n') +
      (n('kValor') ? '\n\nInvestimento: R$ ' + n('kValor').toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + '/mês' + (v('kCond') ? ' (' + v('kCond') + ')' : '') : '') +
      '\n\n' + (v('kEmpresa') || '') + (v('kWhats') ? ' · ' + v('kWhats') : '');
    $('kFotosDel').hidden = !fotos.length;
  }

  // reduz a foto para caber no aparelho (máx. 900 px, JPEG)
  function reduzir(file) {
    return new Promise(res => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => res(null);
      img.src = url;
    });
  }

  let timer;
  const agendar = () => { clearTimeout(timer); timer = setTimeout(() => { salvar(); render(); }, 120); };
  $('kit').addEventListener('input', agendar);
  $('kit').addEventListener('change', agendar);
  $('kPublico').addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    const p = b.dataset.p, i = publico.indexOf(p);
    if (i >= 0) publico.splice(i, 1); else publico.push(p);
    chips(); agendar();
  });
  $('kFotos').addEventListener('change', async e => {
    const files = Array.from(e.target.files || []).slice(0, 3);
    e.target.value = '';
    const novas = (await Promise.all(files.map(reduzir))).filter(Boolean);
    fotos = novas.concat(fotos).slice(0, 3);
    salvar(); render();
  });
  $('kFotosDel').addEventListener('click', () => { fotos = []; salvar(); render(); });
  $('kPrint').addEventListener('click', () => window.print());
  $('kCopy').addEventListener('click', async () => {
    const ok = await RS.copyText(texto);
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = ok ? 'Resumo copiado: cole no WhatsApp' : 'Não foi possível copiar';
    t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200);
  });

  chips();
  render();
})();
