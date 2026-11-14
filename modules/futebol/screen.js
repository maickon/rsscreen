/* Módulo Futebol — lê /api/futebol (Worker, dados da ESPN com cache). Layouts: placar, agenda, tabela, destaque */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  // escudo reduzido pelo próprio CDN (bem mais leve para TV Box)
  function crest(url, size, cls) {
    if (!url) return '<span class="fb-crest ' + (cls || '') + ' none"></span>';
    const m = url.match(/^https:\/\/a\.espncdn\.com(\/i\/teamlogos\/[^?]+)/);
    const src = m ? 'https://a.espncdn.com/combiner/i?img=' + m[1] + '&w=' + size + '&h=' + size : url;
    return '<img class="fb-crest ' + (cls || '') + '" src="' + esc(src) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'">';
  }

  async function load(ctx) {
    const liga = (ctx.assunto && ctx.assunto.liga) || 'bra.1';
    const d = await S.fetchJson(RS.ROOT_URL + 'api/futebol?liga=' + encodeURIComponent(liga));
    if (!d || d.erro) throw new Error((d && d.erro) || 'Futebol indisponível');
    return [d];
  }

  const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

  function head(ctx, d, sub, page) {
    return '<div class="fb-bg"></div><div class="fb-head"><div><div class="fb-title">' + esc(d.nome) + '</div>' +
      '<div class="fb-sub">' + esc(sub) + (page ? ' · ' + page : '') + '</div></div><div class="fb-clock">' + S.clockHtml() + '</div></div>';
  }

  function score(j) {
    if (j.estado === 'pre') return '<div class="fb-vs"><b>' + esc(j.hora) + '</b><small>' + esc(j.dia) + '</small></div>';
    return '<div class="fb-score"><b>' + (j.casa.gols == null ? '-' : j.casa.gols) + '</b><i>×</i><b>' + (j.fora.gols == null ? '-' : j.fora.gols) + '</b></div>';
  }

  function status(j) {
    if (j.estado === 'in') return '<span class="fb-live"><i></i>' + esc(j.situacao) + '</span>';
    if (j.estado === 'post') return '<span class="fb-st">' + esc(j.situacao + ' · ' + j.dia) + '</span>';
    return '<span class="fb-st">' + esc(j.estadio || '') + '</span>';
  }

  function row(j, k) {
    return '<div class="fb-game rise d' + Math.min(3, Math.floor(k / 2)) + (j.estado === 'in' ? ' live' : '') + '">' +
      '<div class="fb-team h"><span>' + esc(j.casa.nome) + '</span>' + crest(j.casa.escudo, 96) + '</div>' +
      score(j) +
      '<div class="fb-team a">' + crest(j.fora.escudo, 96) + '<span>' + esc(j.fora.nome) + '</span></div>' +
      '<div class="fb-meta">' + status(j) + '</div></div>';
  }

  const R = {
    lista(s, ctx) {
      return head(ctx, s.d, s.titulo, s.page) + '<div class="fb-list n' + s.jogos.length + '">' + s.jogos.map(row).join('') + '</div>';
    },
    tabela(s, ctx) {
      const n = s.d.tabela.length;
      return head(ctx, s.d, 'Classificação', s.page) +
        '<div class="fb-table"><div class="fb-tr th"><span>#</span><span></span><span class="nm">Time</span><span>P</span><span>J</span><span>V</span><span>SG</span></div>' +
        s.linhas.map((t, k) => {
          const zona = n >= 16 ? (t.pos <= 4 ? ' top' : t.pos > n - 4 ? ' down' : '') : '';
          return '<div class="fb-tr rise d' + Math.min(3, Math.floor(k / 3)) + zona + '"><span class="pos">' + t.pos + '</span>' + crest(t.escudo, 64, 'sm') +
            '<span class="nm">' + esc(t.nome) + '</span><span class="pts">' + t.pts + '</span><span>' + t.j + '</span><span>' + t.v + '</span><span>' + (t.sg > 0 ? '+' : '') + t.sg + '</span></div>';
        }).join('') + '</div>';
    },
    destaque(s, ctx) {
      const j = s.jogo;
      const lbl = j.estado === 'in' ? 'Ao vivo' : j.estado === 'post' ? 'Resultado' : 'Próximo jogo';
      return head(ctx, s.d, lbl) +
        '<div class="fb-hero' + (j.estado === 'in' ? ' live' : '') + '">' +
          '<div class="fb-hteam rise">' + crest(j.casa.escudo, 300, 'xl') + '<b>' + esc(j.casa.nome) + '</b></div>' +
          '<div class="fb-hmid rise d1">' + (j.estado === 'pre' ?
            '<div class="fb-hhora">' + esc(j.hora) + '</div><div class="fb-hdia">' + esc(j.dia) + '</div>' :
            '<div class="fb-hscore">' + j.casa.gols + '<i>×</i>' + j.fora.gols + '</div>') +
            '<div class="fb-hst">' + status(j) + '</div></div>' +
          '<div class="fb-hteam rise d2">' + crest(j.fora.escudo, 300, 'xl') + '<b>' + esc(j.fora.nome) + '</b></div>' +
        '</div>' + (j.estadio ? '<div class="fb-venue rise d3">' + esc(j.estadio) + '</div>' : '');
    },
    vazio(s, ctx) {
      return head(ctx, s.d, 'Sem jogos') + '<div class="fb-empty"><b>Nenhum jogo nos próximos dias</b><span>Os jogos aparecem aqui assim que a próxima rodada for marcada.</span></div>';
    }
  };

  S.register('futebol', {
    refreshMinutes: 5,
    rerenderOnRefresh: false,
    load,
    slides(data, ctx) {
      const d = data[0];
      const v = ctx.orient === 'v';
      const per = 6;
      const out = [];
      const pages = (list, titulo) => {
        const ch = chunk(list, per);
        ch.forEach((jogos, k) => out.push({ k: 'lista', d, jogos, titulo, page: ch.length > 1 ? (k + 1) + '/' + ch.length : '' }));
      };
      if (ctx.layout === 'tabela' && d.tabela && d.tabela.length) {
        const ch = chunk(d.tabela, v ? 10 : 10);
        ch.forEach((linhas, k) => out.push({ k: 'tabela', d, linhas, page: ch.length > 1 ? (k + 1) + '/' + ch.length : '' }));
      } else if (ctx.layout === 'destaque') {
        d.aoVivo.concat(d.ultimos.slice(0, 4), d.proximos.slice(0, 4)).forEach(jogo => out.push({ k: 'destaque', d, jogo }));
      } else if (ctx.layout === 'agenda') {
        if (d.aoVivo.length) pages(d.aoVivo, 'Ao vivo agora');
        pages(d.proximos, 'Próximos jogos · horário de Brasília');
      } else {
        if (d.aoVivo.length) pages(d.aoVivo, 'Ao vivo agora');
        pages(d.ultimos, 'Últimos resultados');
        if (!d.aoVivo.length && !d.ultimos.length) pages(d.proximos, 'Próximos jogos · horário de Brasília');
      }
      if (!out.length) out.push({ k: 'vazio', d });
      return out;
    },
    duration(s, ctx) { return s.k === 'tabela' || s.k === 'lista' ? Math.max(ctx.tempo, 12) : 0; },
    render(s, i, all, ctx) { return R[s.k](s, ctx); }
  });
})();
