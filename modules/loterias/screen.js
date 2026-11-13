/* Módulo Loterias: lê /api/loterias (resultados guardados pelo servidor). Layouts: resultado, premio, painel, ganhadores */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
  const NOMES = { megasena: 'Mega-Sena', lotofacil: 'Lotofácil', quina: 'Quina', maismilionaria: '+Milionária', lotomania: 'Lotomania', duplasena: 'Dupla Sena', timemania: 'Timemania', diadesorte: 'Dia de Sorte' };
  const CORES = { megasena: '#209869', lotofacil: '#930089', quina: '#260085', maismilionaria: '#2E3078', lotomania: '#F78100', duplasena: '#A61324', timemania: '#00A650', diadesorte: '#CB852B' };
  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

  /* ---------- formatação ---------- */
  function brl(v) {
    return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // R$ 27 milhões · R$ 1,5 milhão · R$ 850 mil
  function brlCurto(v) {
    v = Number(v || 0);
    if (v >= 1e6) {
      const m = v / 1e6;
      const t = (m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString('pt-BR');
      return 'R$ ' + t + (m < 2 ? ' milhão' : ' milhões');
    }
    if (v >= 1e4) return 'R$ ' + Math.round(v / 1e3).toLocaleString('pt-BR') + ' mil';
    return brl(v);
  }
  function dia(iso, comDia) {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return '';
    const dm = S.pad(d.getDate()) + '/' + S.pad(d.getMonth() + 1);
    return comDia === false ? dm : DIAS[d.getDay()] + ', ' + dm;
  }
  function quando(iso) {
    if (!iso) return '';
    const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
    const d = new Date(iso + 'T12:00:00');
    const diff = Math.round((d - hoje) / 86400000);
    if (diff === 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    return DIAS[d.getDay()] === 'sábado' || DIAS[d.getDay()] === 'domingo' ? 'no ' + DIAS[d.getDay()] : 'na ' + DIAS[d.getDay()];
  }

  function quandoTexto(iso) {
    if (!iso) return '';
    const q = quando(iso);
    if (q === 'hoje' || q === 'amanhã') return 'no sorteio de ' + q;
    return 'no sorteio ' + q + ', ' + dia(iso, false);
  }

  /* ---------- dados ---------- */
  async function load(ctx) {
    const d = await S.fetchJson(RS.ROOT_URL + 'api/loterias?_=' + Math.floor(Date.now() / 120000));
    const ids = ctx.assunto.jogos || [];
    const est = d.estatisticas || {};
    const out = ids.map(id => d.jogos && d.jogos[id]).filter(j => j && j.concurso);
    out.forEach(j => { j.stats = est[j.jogo] || null; });
    if (ctx.layout === 'quentes' || ctx.layout === 'atrasados') {
      // jogo sem estatística (ex.: Federal) não entra nesses modelos
      const comStats = ids.map(id => (d.jogos && d.jogos[id]) || (est[id] ? { jogo: id, nome: NOMES[id] || id, cor: CORES[id] || '', concurso: 0, data: '', stats: est[id] } : null)).filter(j => j && j.stats);
      comStats.forEach(j => { if (!j.stats) j.stats = est[j.jogo]; });
      if (comStats.length) return comStats;
    }
    if (!out.length) throw new Error('Resultados ainda não disponíveis');
    return out;
  }

  function slides(data, ctx) {
    if (ctx.layout === 'quentes' || ctx.layout === 'atrasados') {
      const com = data.filter(j => j.stats && j.stats.quentes);
      if (com.length) return com;
    }
    if (ctx.layout === 'painel') {
      const per = ctx.orient === 'v' ? 4 : 4;
      const pages = [];
      for (let i = 0; i < data.length; i += per) pages.push({ grupo: data.slice(i, i + per) });
      return pages;
    }
    if (ctx.layout === 'premio') {
      const com = data.filter(j => j.proximo && j.proximo.estimativa > 0);
      return (com.length ? com : data).slice().sort((a, b) => (b.proximo ? b.proximo.estimativa : 0) - (a.proximo ? a.proximo.estimativa : 0));
    }
    return data.slice();
  }

  /* ---------- peças ---------- */
  function balls(list, cls) {
    return '<div class="lt-balls ' + (cls || '') + ' n' + list.length + '">' +
      list.map((n, k) => '<span class="lt-ball" style="animation-delay:' + (0.08 * k).toFixed(2) + 's">' + esc(n) + '</span>').join('') + '</div>';
  }

  function head(j, ctx, sub) {
    return '<div class="lt-head"><div><div class="lt-name"><i class="lt-dot"></i>' + esc(j.nome) + '</div>' +
      '<div class="lt-sub">' + esc(sub || ('Concurso ' + j.concurso + ' · ' + dia(j.data))) + '</div></div>' +
      '<div class="lt-clock">' + S.clockHtml() + '</div></div>';
  }

  function principal(j) {
    return (j.premios || [])[0] || null;
  }

  function status(j) {
    const p = principal(j);
    if (j.jogo === 'federal') return p ? '<div class="lt-status win">1º prêmio: ' + brl(p.valor) + '</div>' : '';
    if (j.acumulou || (p && !p.ganhadores)) return '<div class="lt-status acc">ACUMULOU!</div>';
    if (p) return '<div class="lt-status win">' + p.ganhadores + (p.ganhadores > 1 ? ' ganhadores levaram ' : ' ganhador levou ') + brlCurto(p.valor) + (p.ganhadores > 1 ? ' cada' : '') + '</div>';
    return '';
  }

  function proximo(j) {
    const pr = j.proximo || {};
    if (!pr.data && !pr.estimativa) return '';
    return '<div class="lt-next"><span>Próximo concurso' + (pr.data ? ' · ' + esc(dia(pr.data)) : '') + '</span>' +
      (pr.estimativa ? '<b>' + esc(brlCurto(pr.estimativa)) + '</b>' : '') + '</div>';
  }

  // Dezenas de cada jogo, com os extras (2º sorteio, trevos, mês, time, bilhetes, jogos da Loteca)
  function numeros(j, compact) {
    if (j.jogo === 'federal') {
      return '<div class="lt-bilhetes">' + (j.dezenas || []).map((b, k) => {
        const p = (j.premios || [])[k];
        return '<div class="lt-bil"><small>' + (k + 1) + 'º</small><b>' + esc(b) + '</b>' + (p && !compact ? '<span>' + brl(p.valor) + '</span>' : '') + '</div>';
      }).join('') + '</div>';
    }
    if (j.jogo === 'loteca') {
      const jogos = (j.jogos || []).slice(0, compact ? 0 : 14);
      if (!jogos.length) return '<div class="lt-sub">14 jogos · confira a premiação</div>';
      return '<div class="lt-loteca">' + jogos.map((g, k) =>
        '<div class="lt-jogo"><i>' + (k + 1) + '</i><span>' + esc(g.casa) + '</span><b>' + esc(g.g1) + ' × ' + esc(g.g2) + '</b><span>' + esc(g.fora) + '</span></div>').join('') + '</div>';
    }
    let html = balls(j.dezenas || [], compact ? 'sm' : '');
    if (j.dezenas2 && j.dezenas2.length) html += (compact ? '' : '<div class="lt-lbl">2º sorteio</div>') + balls(j.dezenas2, compact ? 'sm' : 'b2');
    if (j.trevos && j.trevos.length) html += '<div class="lt-extra">Trevos <b>' + j.trevos.map(esc).join(' · ') + '</b></div>';
    if (j.extra) html += '<div class="lt-extra">' + (j.jogo === 'timemania' ? 'Time do Coração' : 'Mês da Sorte') + ' <b>' + esc(j.extra) + '</b></div>';
    return html;
  }

  /* ---------- layouts ---------- */
  const L = {};

  L.resultado = (j, i, all, ctx) =>
    '<div class="lt-bg"></div>' +
    head(j, ctx) +
    '<div class="lt-main rise">' + numeros(j, false) + '</div>' +
    '<div class="lt-bottom rise d1">' + status(j) + proximo(j) + '</div>';

  L.premio = (j, i, all, ctx) => {
    const pr = j.proximo || {};
    if (!pr.estimativa) return L.resultado(j, i, all, ctx);
    return '<div class="lt-bg big"></div>' +
      head(j, ctx, 'Concurso ' + (pr.concurso || '') + (pr.data ? ' · ' + dia(pr.data) : '')) +
      '<div class="lt-hero rise">' +
        (j.acumulou ? '<div class="lt-tag">ACUMULADA</div>' : '') +
        '<div class="lt-pode">pode pagar</div>' +
        '<div class="lt-valor">' + esc(brlCurto(pr.estimativa)) + '</div>' +
        '<div class="lt-quando">' + esc(quandoTexto(pr.data)) + '</div>' +
      '</div>' +
      '<div class="lt-bottom rise d1"><div class="lt-next"><span>Último resultado · concurso ' + j.concurso + '</span><b class="lt-mini">' + esc((j.dezenas || []).slice(0, 15).join(' ')) + '</b></div></div>';
  };

  L.ganhadores = (j, i, all, ctx) => {
    const faixas = (j.premios || []).slice(0, ctx.orient === 'v' ? 7 : 5);
    const locais = (j.locais || []).slice(0, 8);
    return '<div class="lt-bg"></div>' +
      head(j, ctx) +
      '<div class="lt-split">' +
        '<div class="lt-faixas rise"><div class="lt-lbl">Premiação</div>' +
          (faixas.length ? faixas.map(f =>
            '<div class="lt-faixa"><span>' + esc(f.faixa) + '</span><span>' + (f.ganhadores ? f.ganhadores.toLocaleString('pt-BR') + ' ganhador' + (f.ganhadores > 1 ? 'es' : '') : 'Não houve acertador') + '</span><b>' + (f.ganhadores ? brl(f.valor) : '—') + '</b></div>').join('')
            : '<p class="lt-sub">Premiação ainda não divulgada.</p>') +
        '</div>' +
        '<div class="lt-cidades rise d1"><div class="lt-lbl">' + (locais.length ? 'Ganhadores do prêmio principal' : 'Prêmio principal') + '</div>' +
          (locais.length ? locais.map(c => '<div class="lt-cidade"><b>' + esc(c.cidade) + '</b><span>' + esc(c.uf) + (c.n > 1 ? ' · ' + c.n + ' apostas' : '') + '</span></div>').join('')
            : status(j) + proximo(j)) +
        '</div>' +
      '</div>';
  };

  L.painel = (pg, i, all, ctx) =>
    '<div class="lt-bg"></div>' +
    '<div class="lt-head"><div><div class="lt-name">Resultados das loterias</div><div class="lt-sub">' + S.clockHtml('date') + '</div></div><div class="lt-clock">' + S.clockHtml() + '</div></div>' +
    '<div class="lt-grid n' + pg.grupo.length + '">' + pg.grupo.map((j, k) =>
      '<div class="lt-card rise d' + Math.min(3, k) + '" style="--lc:' + esc(j.cor) + '">' +
        '<div class="lt-card-head"><b>' + esc(j.nome) + '</b><small>' + j.concurso + ' · ' + esc(dia(j.data, false)) + '</small></div>' +
        numeros(j, true) +
        '<div class="lt-card-foot">' + (j.acumulou ? '<span class="acc">Acumulou</span>' : '<span></span>') +
          (j.proximo && j.proximo.estimativa ? '<b>' + esc(brlCurto(j.proximo.estimativa)) + '</b>' : '') + '</div>' +
      '</div>').join('') + '</div>';

  /* ---------- estatísticas ---------- */
  function statFoot(st) {
    return '<div class="lt-stat-foot">Base: ' + (st.sorteios ? st.sorteios.toLocaleString('pt-BR') + ' concursos' : 'todos os concursos') +
      (st.obtido ? ' · atualizado em ' + dia(new Date(st.obtido).toISOString().slice(0, 10), false) : '') + ' · estatística não garante prêmio</div>';
  }

  function statBalls(list, key, suf, max) {
    const top = list.slice(0, max);
    const big = top.length ? top[0][key] : 1;
    return '<div class="lt-stat-list">' + top.map((x, k) =>
      '<div class="lt-stat-row rise d' + Math.min(3, Math.floor(k / 3)) + '"><span class="lt-ball">' + esc(x.n) + '</span>' +
        '<div class="lt-stat-bar"><i style="width:' + Math.max(8, Math.round(x[key] / big * 100)) + '%"></i></div>' +
        '<b>' + Number(x[key]).toLocaleString('pt-BR') + suf + '</b></div>').join('') + '</div>';
  }

  L.quentes = (j, i, all, ctx) => {
    const st = j.stats;
    const max = ctx.orient === 'v' ? 6 : 6;
    return '<div class="lt-bg"></div>' +
      head(j, ctx, 'Números quentes e frios') +
      '<div class="lt-stats2">' +
        '<div class="lt-stat-col hot"><div class="lt-lbl">🔥 Mais sorteados</div>' + statBalls(st.quentes, 'f', 'x', max) + '</div>' +
        '<div class="lt-stat-col cold"><div class="lt-lbl">❄ Menos sorteados</div>' + statBalls(st.frios, 'f', 'x', max) + '</div>' +
      '</div>' + statFoot(st);
  };

  L.atrasados = (j, i, all, ctx) => {
    const st = j.stats;
    const pi = (st.paresImpares || []).slice(0, 4);
    const big = pi.length ? pi[0].pct : 1;
    return '<div class="lt-bg"></div>' +
      head(j, ctx, 'Números mais atrasados') +
      '<div class="lt-stats2">' +
        '<div class="lt-stat-col"><div class="lt-lbl">Sem sair há mais tempo</div>' +
          '<div class="lt-atraso">' + st.atrasados.slice(0, ctx.orient === 'v' ? 8 : 10).map((x, k) =>
            '<div class="lt-atr rise d' + Math.min(3, Math.floor(k / 3)) + '"><span class="lt-ball">' + esc(x.n) + '</span><small>' + x.a + ' concurso' + (x.a === 1 ? '' : 's') + '</small></div>').join('') +
          '</div></div>' +
        (pi.length ? '<div class="lt-stat-col"><div class="lt-lbl">Pares × ímpares mais comuns</div>' +
          pi.map(x => '<div class="lt-pi rise"><span>' + x.p + ' pares · ' + x.i + ' ímpares</span><div class="lt-stat-bar"><i style="width:' + Math.round(x.pct / big * 100) + '%"></i></div><b>' + String(x.pct).replace('.', ',') + '%</b></div>').join('') +
        '</div>' : '') +
      '</div>' + statFoot(st);
  };

  S.register('loterias', {
    refreshMinutes: 10,
    rerenderOnRefresh: false,
    load,
    slides,
    render(it, i, all, ctx) {
      const fn = (ctx.layout === 'quentes' || ctx.layout === 'atrasados') && !(it.stats && it.stats.quentes) ? L.resultado : (L[ctx.layout] || L.resultado);
      const html = fn(it, i, all, ctx);
      // a cor oficial de cada loteria vira a cor de destaque do slide
      const cor = it.cor || (it.grupo && it.grupo[0] && it.grupo[0].cor) || '';
      return '<div class="lt-wrap" style="--lc:' + esc(ctx.layout === 'painel' ? 'var(--accent)' : cor) + '">' + html + '</div>';
    },
    duration(it, ctx) {
      if (ctx.layout === 'painel' || ctx.layout === 'ganhadores' || ctx.layout === 'quentes' || ctx.layout === 'atrasados') return ctx.tempo + 4;
      return ctx.tempo;
    }
  });
})();
