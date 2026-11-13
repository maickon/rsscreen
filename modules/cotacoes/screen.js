/* Módulo Cotações — AwesomeAPI (gratuita, sem chave). Layouts: painel, destaque */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  const NOMES = {
    USD: ['Dólar americano', 'US$'], EUR: ['Euro', '€'], GBP: ['Libra esterlina', '£'], ARS: ['Peso argentino', 'AR$'],
    CAD: ['Dólar canadense', 'C$'], JPY: ['Iene japonês', '¥'], CNY: ['Yuan chinês', '¥'],
    BTC: ['Bitcoin', '₿'], ETH: ['Ethereum', 'Ξ'], SOL: ['Solana', 'SOL'], XRP: ['XRP', 'XRP'], LTC: ['Litecoin', 'Ł'], DOGE: ['Dogecoin', 'Ð']
  };

  function money(v) {
    const n = Number(v);
    const dec = n >= 1000 ? 0 : n >= 1 ? 2 : n >= 0.1 ? 3 : 4;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }

  async function load(ctx) {
    const pares = ctx.assunto.pares || ['USD-BRL'];
    const d = await S.fetchJson('https://economia.awesomeapi.com.br/json/last/' + pares.join(','));
    const out = [];
    pares.forEach(p => {
      const q = d[p.replace('-', '')];
      if (!q) return;
      const nm = NOMES[q.code] || [q.name.split('/')[0], q.code];
      out.push({
        codigo: q.code, nome: nm[0], simbolo: nm[1],
        valor: Number(q.bid), alta: Number(q.high), baixa: Number(q.low),
        variacao: Number(q.pctChange), hora: q.create_date
      });
    });
    if (!out.length) throw new Error('Cotações indisponíveis');
    return out;
  }

  function arrow(v) {
    if (v > 0.005) return '<span class="q-var up">▲ ' + v.toFixed(2).replace('.', ',') + '%</span>';
    if (v < -0.005) return '<span class="q-var down">▼ ' + Math.abs(v).toFixed(2).replace('.', ',') + '%</span>';
    return '<span class="q-var flat">= 0,00%</span>';
  }

  function updated(q) {
    return q && q.hora ? 'Atualizado às ' + q.hora.slice(11, 16) : '';
  }

  function header(ctx, sub) {
    return '<div class="q-head"><div><div class="q-title">' + esc(ctx.assunto.nome.replace(/\s*\(.*\)$/, '')) + '</div>' +
      '<div class="q-sub">' + esc(sub) + '</div></div><div class="q-clock">' + S.clockHtml() + '</div></div>';
  }

  const L = {};

  L.painel = (all, ctx) => {
    const cards = all.map((q, k) =>
      '<div class="q-card rise d' + Math.min(3, k) + '">' +
        '<div class="q-top"><span class="q-sym">' + esc(q.simbolo) + '</span><span class="q-code">' + esc(q.codigo) + '</span></div>' +
        '<div class="q-name">' + esc(q.nome) + '</div>' +
        '<div class="q-val">' + money(q.valor) + '</div>' +
        '<div class="q-foot">' + arrow(q.variacao) + '<span>Máx ' + money(q.alta) + '</span></div>' +
      '</div>').join('');
    return '<div class="q-bg"></div>' + header(ctx, updated(all[0]) + ' · valores de compra em reais') +
      '<div class="q-grid n' + all.length + '">' + cards + '</div>';
  };

  L.destaque = (q, ctx, i, total) =>
    '<div class="q-bg"></div>' + header(ctx, updated(q)) +
    '<div class="q-hero">' +
      '<div class="q-hero-sym rise">' + esc(q.simbolo) + '</div>' +
      '<div class="q-hero-name rise d1">' + esc(q.nome) + ' <small>' + esc(q.codigo) + '/BRL</small></div>' +
      '<div class="q-hero-val rise d1">' + money(q.valor) + '</div>' +
      '<div class="rise d2">' + arrow(q.variacao) + ' <span class="q-today">hoje</span></div>' +
      '<div class="q-hero-range rise d3"><div><small>Máxima do dia</small><b>' + money(q.alta) + '</b></div><div><small>Mínima do dia</small><b>' + money(q.baixa) + '</b></div></div>' +
    '</div>' +
    '<div class="q-pager">' + Array.from({ length: total }, (_, k) => '<i' + (k === i ? ' class="on"' : '') + '></i>').join('') + '</div>';

  S.register('cotacoes', {
    refreshMinutes: 5,
    load,
    slides(data, ctx) {
      return ctx.layout === 'painel' ? [data] : data;
    },
    render(s, i, all, ctx) {
      if (ctx.layout === 'painel') return L.painel(s, ctx);
      return L.destaque(s, ctx, i, all.length);
    }
  });
})();
