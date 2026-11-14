/* Módulo Datas Comemorativas — calendário próprio, calculado no aparelho (funciona sem internet).
   Layouts: hoje, contagem, proximas.  Categorias: c = comércio/feriado, s = saúde */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  // [mês, dia, nome, mensagem, categoria, feriado nacional]
  const FIXAS = [
    [1, 1, 'Confraternização Universal', 'Feliz Ano Novo! Que este ano seja de muitas conquistas.', 'c', true],
    [3, 8, 'Dia Internacional da Mulher', 'Homenagem a todas as mulheres que fazem a diferença todos os dias.', 'c'],
    [3, 15, 'Dia do Consumidor', 'Dia de ofertas especiais e de celebrar quem escolhe a gente.', 'c'],
    [3, 20, 'Dia Mundial da Saúde Bucal', 'Escove os dentes, use fio dental e visite o dentista regularmente.', 's'],
    [4, 6, 'Dia Mundial da Atividade Física', 'Movimente-se! 30 minutos por dia já fazem diferença.', 's'],
    [4, 7, 'Dia Mundial da Saúde', 'Cuidar da saúde é um presente para você e para quem você ama.', 's'],
    [4, 21, 'Tiradentes', 'Feriado nacional em memória de Tiradentes.', 'c', true],
    [5, 1, 'Dia do Trabalhador', 'Uma homenagem a quem constrói o Brasil todos os dias.', 'c', true],
    [5, 12, 'Dia da Enfermagem', 'Obrigado aos profissionais de enfermagem pelo cuidado de todos os dias.', 's'],
    [5, 31, 'Dia Mundial sem Tabaco', 'Parar de fumar é possível. Procure ajuda no posto de saúde.', 's'],
    [6, 12, 'Dia dos Namorados', 'Celebre o amor! Uma lembrança faz toda a diferença.', 'c'],
    [6, 14, 'Dia Mundial do Doador de Sangue', 'Doe sangue: um gesto simples que salva vidas.', 's'],
    [6, 24, 'Dia de São João', 'Arraiá, quentão e muita festa junina!', 'c'],
    [7, 26, 'Dia dos Avós', 'Um abraço especial para os avós, guardiões das nossas histórias.', 'c'],
    [8, 11, 'Dia do Estudante', 'Estudar abre portas. Parabéns a todos os estudantes!', 'c'],
    [9, 7, 'Independência do Brasil', 'Feriado nacional: Dia da Independência.', 'c', true],
    [9, 10, 'Dia Mundial de Prevenção do Suicídio', 'Falar é a melhor solução. CVV: ligue 188, de graça, 24 horas.', 's'],
    [9, 15, 'Dia do Cliente', 'Obrigado por fazer parte da nossa história!', 'c'],
    [9, 29, 'Dia Mundial do Coração', 'Alimentação equilibrada e exercícios protegem o seu coração.', 's'],
    [10, 12, 'Dia das Crianças', 'Feliz Dia das Crianças! Brincar é coisa séria.', 'c', true],
    [10, 15, 'Dia do Professor', 'Obrigado, professores, por ensinarem o caminho.', 'c'],
    [10, 18, 'Dia do Médico', 'Nossa homenagem aos médicos que cuidam da nossa vida.', 's'],
    [10, 25, 'Dia do Dentista', 'Parabéns aos dentistas, responsáveis pelos nossos sorrisos.', 's'],
    [10, 31, 'Halloween', 'Doces ou travessuras? Dia das Bruxas chegou!', 'c'],
    [11, 2, 'Finados', 'Dia de lembrar com carinho de quem amamos.', 'c', true],
    [11, 14, 'Dia Mundial do Diabetes', 'Faça o exame de glicemia. Prevenir é o melhor cuidado.', 's'],
    [11, 15, 'Proclamação da República', 'Feriado nacional: Proclamação da República.', 'c', true],
    [11, 20, 'Dia da Consciência Negra', 'Feriado nacional: dia de reflexão, respeito e igualdade.', 'c', true],
    [12, 1, 'Dia Mundial de Luta contra a Aids', 'Faça o teste. O diagnóstico cedo garante tratamento e qualidade de vida.', 's'],
    [12, 25, 'Natal', 'Feliz Natal! Paz, saúde e união para todas as famílias.', 'c', true],
    [12, 31, 'Véspera de Ano Novo', 'Que venha um novo ano cheio de alegrias!', 'c']
  ];

  // Campanhas de saúde do mês (índice = mês - 1)
  const CAMPANHAS = [
    ['Janeiro Branco', 'Mês de cuidar da saúde mental e emocional.', '#e5e7eb'],
    ['Fevereiro Roxo e Laranja', 'Conscientização sobre lúpus, Alzheimer, fibromialgia e leucemia.', '#a855f7'],
    ['Março Lilás', 'Prevenção do câncer do colo do útero: faça o preventivo.', '#c084fc'],
    ['Abril Azul', 'Conscientização sobre o autismo: informação e inclusão.', '#3b82f6'],
    ['Maio Amarelo', 'Atenção pela vida no trânsito.', '#facc15'],
    ['Junho Vermelho', 'Doe sangue. Os estoques precisam de você.', '#ef4444'],
    ['Julho Amarelo', 'Prevenção das hepatites virais: vacine-se e faça o teste.', '#facc15'],
    ['Agosto Dourado', 'Incentivo ao aleitamento materno.', '#eab308'],
    ['Setembro Amarelo', 'Prevenção do suicídio. Precisa conversar? Ligue 188 (CVV).', '#facc15'],
    ['Outubro Rosa', 'Prevenção do câncer de mama: faça seus exames.', '#ec4899'],
    ['Novembro Azul', 'Saúde do homem e prevenção do câncer de próstata.', '#3b82f6'],
    ['Dezembro Vermelho', 'Prevenção do HIV/aids e outras infecções sexualmente transmissíveis.', '#ef4444']
  ];

  // Páscoa (algoritmo de Meeus/Butcher)
  function pascoa(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mes - 1, dia);
  }
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  function nthWeekday(y, mes, wd, n) {   // n-ésimo dia da semana do mês (wd: 0 = domingo)
    const first = new Date(y, mes - 1, 1);
    return new Date(y, mes - 1, 1 + ((wd - first.getDay() + 7) % 7) + (n - 1) * 7);
  }

  function datasDoAno(y) {
    const out = FIXAS.map(f => ({ data: new Date(y, f[0] - 1, f[1]), nome: f[2], texto: f[3], cat: f[4], feriado: !!f[5] }));
    const p = pascoa(y);
    out.push({ data: addDays(p, -47), nome: 'Carnaval', texto: 'Alegria, fantasia e muita folia. Bom Carnaval!', cat: 'c' });
    out.push({ data: addDays(p, -2), nome: 'Sexta-feira Santa', texto: 'Feriado nacional: Paixão de Cristo.', cat: 'c', feriado: true });
    out.push({ data: p, nome: 'Páscoa', texto: 'Feliz Páscoa! Renovação, esperança e muito chocolate.', cat: 'c' });
    out.push({ data: addDays(p, 60), nome: 'Corpus Christi', texto: 'Ponto facultativo de Corpus Christi.', cat: 'c' });
    out.push({ data: nthWeekday(y, 5, 0, 2), nome: 'Dia das Mães', texto: 'Para quem ama sem medida: feliz Dia das Mães!', cat: 'c' });
    out.push({ data: nthWeekday(y, 8, 0, 2), nome: 'Dia dos Pais', texto: 'Feliz Dia dos Pais! Obrigado por tudo.', cat: 'c' });
    out.push({ data: addDays(nthWeekday(y, 11, 4, 4), 1), nome: 'Black Friday', texto: 'As maiores ofertas do ano. Fique de olho!', cat: 'c' });
    return out;
  }

  const DIA = 86400000;
  function hoje() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

  async function load(ctx) {
    const t = hoje(), y = t.getFullYear();
    const cat = ctx.assunto && ctx.assunto.id;
    const all = datasDoAno(y).concat(datasDoAno(y + 1))
      .filter(d => cat === 'comercio' ? d.cat === 'c' : cat === 'saude' ? d.cat === 's' : true)
      .map(d => Object.assign(d, { faltam: Math.round((d.data - t) / DIA), dataTxt: d.data.getDate() + ' de ' + S.MONTHS[d.data.getMonth()], semana: S.WEEKDAYS[d.data.getDay()] }))
      .filter(d => d.faltam >= 0)
      .sort((a, b) => a.faltam - b.faltam);
    const camp = CAMPANHAS[t.getMonth()];
    return [{ dia: t.getTime(), datas: all.slice(0, 12), campanha: cat === 'comercio' ? null : { nome: camp[0], texto: camp[1], cor: camp[2] } }];
  }

  function faltamTxt(n) { return n === 0 ? 'É hoje!' : n === 1 ? 'É amanhã!' : 'Faltam ' + n + ' dias'; }

  function head(ctx, title) {
    return '<div class="dt-bg"></div><div class="dt-head"><div class="dt-kicker">' + esc(title) + '</div><div class="dt-clock">' + S.clockHtml() + '</div></div>';
  }

  const R = {
    data(d, ctx) {
      const hojeD = d.faltam === 0;
      return head(ctx, hojeD ? 'Hoje é dia de' : 'Próxima data') +
        '<div class="dt-main">' +
          '<div class="dt-when rise">' + esc(hojeD ? S.WEEKDAYS[new Date().getDay()] + ', ' + d.dataTxt : d.dataTxt + ' · ' + d.semana) + (d.feriado ? ' <span class="dt-tag">Feriado</span>' : '') + '</div>' +
          '<div class="dt-name rise d1">' + esc(d.nome) + '</div>' +
          '<div class="dt-text rise d2">' + esc(d.texto) + '</div>' +
          (hojeD ? '' : '<div class="dt-count rise d3">' + faltamTxt(d.faltam) + '</div>') +
        '</div>';
    },
    campanha(c, ctx) {
      return head(ctx, 'Campanha do mês') +
        '<div class="dt-main camp" style="--camp:' + esc(c.cor) + '">' +
          '<div class="dt-ribbon rise"></div>' +
          '<div class="dt-name rise d1">' + esc(c.nome) + '</div>' +
          '<div class="dt-text rise d2">' + esc(c.texto) + '</div>' +
        '</div>';
    },
    contagem(d, ctx) {
      return head(ctx, 'Contagem regressiva') +
        '<div class="dt-cd">' +
          (d.faltam === 0 ? '<div class="dt-cd-today rise">É hoje!</div>' :
            '<div class="dt-cd-num rise">' + d.faltam + '</div><div class="dt-cd-lbl rise d1">' + (d.faltam === 1 ? 'dia para' : 'dias para') + '</div>') +
          '<div class="dt-name rise d2">' + esc(d.nome) + '</div>' +
          '<div class="dt-when rise d3">' + esc(d.dataTxt + ' · ' + d.semana) + '</div>' +
        '</div>';
    },
    proximas(list, ctx) {
      return head(ctx, 'Próximas datas') +
        '<div class="dt-list">' + list.slice(0, 6).map((d, k) =>
          '<div class="dt-row rise d' + Math.min(3, k) + '">' +
            '<div class="dt-day"><b>' + d.data.getDate() + '</b><small>' + esc(S.MONTHS[d.data.getMonth()].slice(0, 3)) + '</small></div>' +
            '<div class="dt-row-txt"><b>' + esc(d.nome) + '</b><small>' + esc(d.semana) + (d.feriado ? ' · feriado' : '') + '</small></div>' +
            '<div class="dt-row-n">' + (d.faltam === 0 ? 'hoje' : d.faltam === 1 ? 'amanhã' : d.faltam + ' dias') + '</div>' +
          '</div>').join('') + '</div>';
    }
  };

  // dados vindos do cache do aparelho chegam com a data como texto
  function fix(item) { (item.datas || []).forEach(d => { if (!(d.data instanceof Date)) d.data = new Date(d.data); }); return item; }

  S.register('datas', {
    refreshMinutes: 30,
    load,
    slides(data, ctx) {
      const it = fix(data[0]);
      if (ctx.layout === 'proximas') return [{ k: 'proximas', v: it.datas }];
      if (ctx.layout === 'contagem') return it.datas.slice(0, 4).map(d => ({ k: 'contagem', v: d }));
      const out = it.datas.filter(d => d.faltam === 0).map(d => ({ k: 'data', v: d }));
      if (!out.length && it.datas[0]) out.push({ k: 'data', v: it.datas[0] });
      if (it.campanha) out.push({ k: 'campanha', v: it.campanha });
      const next = it.datas.find(d => d.faltam > 0 && out.every(o => o.v !== d));
      if (next) out.push({ k: 'data', v: next });
      return out;
    },
    render(s, i, all, ctx) { return R[s.k](s.v, ctx); }
  });
})();
