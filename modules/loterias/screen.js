/* Módulo Loterias: lê /api/loterias (resultados guardados pelo servidor). Layouts: resultado, premio, painel, ganhadores */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
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
    const out = ids.map(id => d.jogos && d.jogos[id]).filter(j => j && j.concurso);
    if (!out.length) throw new Error('Resultados ainda não disponíveis');
    return out;
  }

  function slides(data, ctx) {
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

  S.register('loterias', {
    refreshMinutes: 10,
    rerenderOnRefresh: false,
    load,
    slides,
    render(it, i, all, ctx) {
      const html = (L[ctx.layout] || L.resultado)(it, i, all, ctx);
      // a cor oficial de cada loteria vira a cor de destaque do slide
      const cor = it.cor || (it.grupo && it.grupo[0] && it.grupo[0].cor) || '';
      return '<div class="lt-wrap" style="--lc:' + esc(ctx.layout === 'painel' ? 'var(--accent)' : cor) + '">' + html + '</div>';
    },
    duration(it, ctx) {
      if (ctx.layout === 'painel' || ctx.layout === 'ganhadores') return ctx.tempo + 4;
      return ctx.tempo;
    }
  });
})();
