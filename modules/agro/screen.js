/* Módulo Cotações do Agro — lê /api/agro (indicadores do CEPEA, ESALQ/USP). Layouts: painel, destaque, tabela */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  function money(v) {
    const n = Number(v), dec = n >= 1000 ? 2 : n < 10 ? (String(v).split('.')[1] || '').length > 2 ? 4 : 2 : 2;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  const dataBr = iso => iso ? iso.split('-').reverse().slice(0, 2).join('/') : '';

  async function load(ctx) {
    const d = await S.fetchJson(RS.ROOT_URL + 'api/agro');
    if (!d || !d.itens) throw new Error((d && d.erro) || 'Cotações do agro indisponíveis');
    const ids = (ctx.assunto && ctx.assunto.ids) || Object.keys(d.itens).map(Number);
    const out = ids.map(id => d.itens[id]).filter(Boolean).map(it => Object.assign({}, it, {
      variacao: it.ant ? (it.valor - it.ant) / it.ant * 100 : null
    }));
    if (!out.length) throw new Error('Sem cotações para este painel');
    return out;
  }

  function arrow(v) {
    if (v == null) return '';   // ainda sem valor anterior guardado
    if (v > 0.005) return '<span class="ag-var up">▲ ' + v.toFixed(2).replace('.', ',') + '%</span>';
    if (v < -0.005) return '<span class="ag-var down">▼ ' + Math.abs(v).toFixed(2).replace('.', ',') + '%</span>';
    return '<span class="ag-var flat">= 0,00%</span>';
  }

  function head(ctx, all) {
    const ultima = all.map(i => i.data).sort().pop();
    return '<div class="ag-bg"></div><div class="ag-head"><div><div class="ag-title">' + esc(ctx.assunto.nome.replace(/\s*\(.*\)$/, '')) + '</div>' +
      '<div class="ag-sub">Cotações do agro · ' + (ultima ? 'indicadores de ' + dataBr(ultima) : '') + '</div></div><div class="ag-clock">' + S.clockHtml() + '</div></div>';
  }
  const foot = '<div class="ag-foot">Fonte: Cepea (ESALQ/USP) · valores de referência, à vista, em reais</div>';

  const L = {
    painel(all, ctx) {
      return head(ctx, all) + '<div class="ag-grid n' + all.length + '">' + all.map((q, k) =>
        '<div class="ag-card rise d' + Math.min(3, k) + '">' +
          '<div class="ag-name">' + esc(q.nome) + '</div><div class="ag-un">por ' + esc(q.unidade) + '</div>' +
          '<div class="ag-val">' + money(q.valor) + '</div>' +
          '<div class="ag-row">' + arrow(q.variacao) + '<span>' + esc(dataBr(q.data)) + '</span></div>' +
        '</div>').join('') + '</div>' + foot;
    },
    destaque(q, ctx, i, total, all) {
      return head(ctx, all) +
        '<div class="ag-hero">' +
          '<div class="ag-hero-name rise">' + esc(q.nome) + '</div>' +
          '<div class="ag-hero-un rise d1">por ' + esc(q.unidade) + '</div>' +
          '<div class="ag-hero-val rise d1">' + money(q.valor) + '</div>' +
          '<div class="rise d2">' + arrow(q.variacao) + (q.ant ? ' <span class="ag-ant">antes ' + money(q.ant) + '</span>' : '') + '</div>' +
        '</div>' +
        '<div class="ag-pager">' + Array.from({ length: total }, (_, k) => '<i' + (k === i ? ' class="on"' : '') + '></i>').join('') + '</div>' + foot;
    },
    tabela(all, ctx) {
      return head(ctx, all) + '<div class="ag-table">' +
        '<div class="ag-tr th"><span>Produto</span><span>Unidade</span><span class="r">Preço</span><span class="r">Variação</span></div>' +
        all.map((q, k) => '<div class="ag-tr rise d' + Math.min(3, Math.floor(k / 2)) + '"><span class="nm">' + esc(q.nome) + '</span><span>' + esc(q.unidade) + '</span>' +
          '<span class="r val">' + money(q.valor) + '</span><span class="r">' + arrow(q.variacao) + '</span></div>').join('') +
        '</div>' + foot;
    }
  };

  S.register('agro', {
    refreshMinutes: 30,
    load,
    slides(data, ctx) {
      if (ctx.layout === 'destaque') return data.map(q => ({ q, all: data }));
      if (ctx.layout === 'tabela') { const out = []; for (let i = 0; i < data.length; i += 8) out.push(data.slice(i, i + 8)); return out; }
      const out = []; for (let i = 0; i < data.length; i += 6) out.push(data.slice(i, i + 6)); return out;
    },
    render(s, i, all, ctx) {
      if (ctx.layout === 'destaque') return L.destaque(s.q, ctx, i, all.length, s.all);
      return (ctx.layout === 'tabela' ? L.tabela : L.painel)(s, ctx);
    }
  });
})();
