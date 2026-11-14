/* Módulo Tabela de Preços e Cardápio — lê /api/lista (listas que o cliente edita pelo link /editar/).
   Layouts: lista (linhas com pontilhado), cardapio (cartões), ofertas (um item em oferta por vez).
   Sem lista (assunto "exemplo"), mostra um exemplo de açougue, usado na página inicial e nos modelos. */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  const EXEMPLO = {
    id: 'exemplo', tipo: 'precos', tema: 'acougue', nome: 'Exemplo',
    dados: {
      titulo: 'Açougue do Bairro', subtitulo: 'Preços de hoje', rodape: 'Encomendas pelo WhatsApp (22) 99999-0000',
      itens: [
        { n: 'Picanha', p: '69,90', de: '79,90', u: 'kg', c: 'Bovinos', o: 1 }, { n: 'Alcatra', p: '44,90', u: 'kg', c: 'Bovinos' },
        { n: 'Contrafilé', p: '42,90', u: 'kg', c: 'Bovinos' }, { n: 'Fraldinha', p: '39,90', u: 'kg', c: 'Bovinos' },
        { n: 'Costela bovina', p: '24,90', u: 'kg', c: 'Bovinos' }, { n: 'Carne moída de primeira', p: '34,90', u: 'kg', c: 'Bovinos' },
        { n: 'Cupim', p: '36,90', u: 'kg', c: 'Bovinos', x: 1 }, { n: 'Pernil suíno', p: '19,90', u: 'kg', c: 'Suínos' },
        { n: 'Costelinha suína', p: '24,90', u: 'kg', c: 'Suínos' }, { n: 'Coxa e sobrecoxa', p: '12,90', u: 'kg', c: 'Aves', o: 1 },
        { n: 'Peito de frango', p: '17,90', u: 'kg', c: 'Aves' }, { n: 'Linguiça toscana', p: '21,90', u: 'kg', c: 'Linguiças' },
        { n: 'Kit churrasco', p: '89,90', u: 'un', c: 'Para o churrasco', d: 'Picanha, linguiça, frango e pão de alho' }
      ]
    }
  };

  // prévia no painel / no link de edição: recebe a lista em edição por postMessage
  let previa = null, previaWait = null;
  if (S.previa) {
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.rs !== 'lista-previa') return;
      previa = d.lista;
      if (previaWait) { previaWait(); previaWait = null; } else S.reload();
    });
    try { window.parent.postMessage({ rs: 'lista-pronta' }, '*'); } catch (_) {}
  }

  async function load(ctx) {
    let l;
    if (S.previa) {
      if (!previa) await new Promise(r => { previaWait = r; });
      l = previa;
    } else if (!ctx.assunto || ctx.assunto.id === 'exemplo') {
      l = EXEMPLO;
    } else {
      const r = await S.fetchJson(RS.ROOT_URL + 'api/lista?id=' + encodeURIComponent(ctx.assunto.id) + '&cliente=' + encodeURIComponent(ctx.state.cliente));
      l = r && r.lista;
      if (!l) throw new Error('Lista não encontrada');
    }
    const d = l.dados || {};
    let itens = (d.itens || []).filter(it => it.n);
    if (d.esgotado === 'esconder') itens = itens.filter(it => !it.x);
    return [{ tema: l.tema || 'geral', tipo: l.tipo, titulo: d.titulo || l.nome || '', subtitulo: d.subtitulo || '', rodape: d.rodape || '', itens }];
  }

  // "69,90" → R$ 69,90 com centavos menores
  function preco(p, cls) {
    if (!p) return '';
    const [r, c] = String(p).split(',');
    return '<span class="' + (cls || 'li-p') + '"><small>R$</small>' + esc(r) + '<sup>,' + esc((c || '00').slice(0, 2)) + '</sup></span>';
  }
  const unid = u => u ? '<small class="li-u">/' + esc(u) + '</small>' : '';

  function topo(L) {
    return '<div class="li-bg"></div><div class="li-top"><div><div class="li-title">' + esc(L.titulo) + '</div>' +
      (L.subtitulo ? '<div class="li-sub">' + esc(L.subtitulo) + '</div>' : '') + '</div><div class="li-clock">' + S.clockHtml() + '</div></div>';
  }
  const rodape = (L, pag) => '<div class="li-foot"><span>' + esc(L.rodape) + '</span>' + (pag ? '<span class="li-pag">' + pag + '</span>' : '') + '</div>';

  // quebra em páginas mantendo o nome da categoria no topo de cada coluna
  function paginas(itens, porPagina) {
    const out = [];
    for (let i = 0; i < itens.length; i += porPagina) out.push(itens.slice(i, i + porPagina));
    return out.length ? out : [[]];
  }

  function linha(it) {
    return '<div class="li-row' + (it.x ? ' x' : '') + (it.o ? ' o' : '') + '">' +
      '<span class="li-n">' + esc(it.n) + (it.o ? ' <i class="li-tag">oferta</i>' : '') + (it.x ? ' <i class="li-tag x">acabou</i>' : '') + '</span>' +
      '<span class="li-dots"></span>' + (it.p ? preco(it.p) + unid(it.u) : '') + '</div>';
  }

  function colunas(itens, ncol) {
    const porCol = Math.ceil(itens.length / ncol) || 1;
    let html = '';
    for (let c = 0; c < ncol; c++) {
      const parte = itens.slice(c * porCol, (c + 1) * porCol);
      if (!parte.length) continue;
      let cat = null, col = '';
      parte.forEach(it => {
        if (it.c && it.c !== cat) { cat = it.c; col += '<div class="li-cat">' + esc(cat) + '</div>'; }
        col += linha(it);
      });
      html += '<div class="li-col">' + col + '</div>';
    }
    return html;
  }

  const R = {
    lista(s, L, ctx) {
      const ncol = ctx.orient === 'v' ? 1 : (s.itens.length > 7 ? 2 : 1);
      return topo(L) + '<div class="li-cols n' + ncol + ' q' + Math.min(9, Math.ceil(s.itens.length / ncol)) + '">' + colunas(s.itens, ncol) + '</div>' + rodape(L, s.pag);
    },
    cardapio(s, L) {
      return topo(L) + '<div class="li-cards n' + s.itens.length + '">' + s.itens.map((it, k) =>
        '<div class="li-card rise d' + Math.min(3, Math.floor(k / 2)) + (it.x ? ' x' : '') + (it.o ? ' o' : '') + '">' +
          (it.c ? '<div class="li-card-cat">' + esc(it.c) + '</div>' : '') +
          '<div class="li-card-n">' + esc(it.n) + '</div>' +
          (it.d ? '<div class="li-card-d">' + esc(it.d) + '</div>' : '') +
          '<div class="li-card-p">' + (it.x ? '<i class="li-tag x">acabou</i>' : preco(it.p) + unid(it.u)) + '</div>' +
        '</div>').join('') + '</div>' + rodape(L, s.pag);
    },
    oferta(s, L) {
      const it = s.item;
      return topo(L) + '<div class="li-hero">' +
        '<div class="li-hero-tag rise">Oferta do dia</div>' +
        '<div class="li-hero-n rise d1">' + esc(it.n) + '</div>' +
        (it.d ? '<div class="li-hero-d rise d1">' + esc(it.d) + '</div>' : '') +
        (it.de ? '<div class="li-hero-de rise d2">de R$ ' + esc(it.de) + ' por</div>' : '') +
        '<div class="li-hero-p rise d2">' + preco(it.p, 'li-hp') + unid(it.u) + '</div>' +
      '</div>' + rodape(L, s.pag);
    },
    vazio(s, L) {
      return topo(L) + '<div class="li-hero"><div class="li-hero-n">Lista em preparação</div><div class="li-hero-d">Os produtos aparecem aqui assim que forem cadastrados.</div></div>' + rodape(L);
    }
  };

  S.register('lista', {
    refreshMinutes: 10,
    rerenderOnRefresh: true,
    load,
    slides(data, ctx) {
      const L = data[0], v = ctx.orient === 'v';
      if (!L.itens.length) return [{ k: 'vazio', L }];
      if (ctx.layout === 'ofertas') {
        const of = L.itens.filter(it => it.o && !it.x && it.p);
        if (of.length) return of.map((item, i) => ({ k: 'oferta', L, item, pag: of.length > 1 ? (i + 1) + '/' + of.length : '' }));
      }
      const card = ctx.layout === 'cardapio';
      const pp = card ? 6 : (v ? 14 : 18);
      const pags = paginas(L.itens, pp);
      return pags.map((itens, i) => ({ k: card ? 'cardapio' : 'lista', L, itens, pag: pags.length > 1 ? (i + 1) + '/' + pags.length : '' }));
    },
    duration(s, ctx) { return s.k === 'lista' || s.k === 'cardapio' ? Math.max(ctx.tempo, 15) : 0; },
    render(s, i, all, ctx) {
      return '<div class="li-wrap" data-tm="' + esc(s.L.tema) + '">' + R[s.k](s, s.L, ctx) + '</div>';
    }
  });
})();
