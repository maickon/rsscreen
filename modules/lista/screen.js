/* Módulo Tabela de Preços e Cardápio — lê /api/lista (listas que o cliente edita pelo link /editar/).
   Layouts: lista (linhas com pontilhado), cardapio (cartões), ofertas (um item em oferta por vez).
   Cabeçalho com ícone do tema e nome do comércio; foto de fundo opcional do banco /modules/catalogo/fundos.json.
   Sem lista (assunto "exemplo"), mostra um exemplo de açougue, usado na página inicial e nos modelos. */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
  const NOVO = /[?&]atualizar=1/.test(location.search);

  const EXEMPLO = {
    id: 'exemplo', tipo: 'precos', tema: 'acougue', nome: 'Exemplo',
    dados: {
      marca: 'Açougue do Bairro', titulo: 'Ofertas da semana', subtitulo: 'Carnes selecionadas', fundo: '8444102',
      rodape: 'Encomendas pelo WhatsApp (22) 99999-0000',
      itens: [
        { n: 'Picanha', p: '69,90', de: '79,90', u: 'kg', c: 'Bovinos', o: 1, d: 'Corte nobre com capa de gordura, ideal para churrasco' },
        { n: 'Alcatra', p: '44,90', u: 'kg', c: 'Bovinos', d: 'Macia e suculenta, para bifes e churrasco' },
        { n: 'Contrafilé', p: '42,90', u: 'kg', c: 'Bovinos', d: 'Para bifes e churrasco, com gordura lateral' },
        { n: 'Fraldinha', p: '39,90', u: 'kg', c: 'Bovinos', d: 'Fibras longas e muito sabor na brasa' },
        { n: 'Costela bovina', p: '24,90', u: 'kg', c: 'Bovinos', d: 'Para assar devagar na brasa ou no forno' },
        { n: 'Carne moída de primeira', p: '34,90', u: 'kg', c: 'Bovinos', d: 'Moída na hora, magra e saborosa' },
        { n: 'Cupim', p: '36,90', u: 'kg', c: 'Bovinos', x: 1, d: 'Assado lento, macio e desfiando' },
        { n: 'Pernil suíno', p: '19,90', u: 'kg', c: 'Suínos', d: 'Para assar inteiro ou desfiar' },
        { n: 'Costelinha suína', p: '24,90', u: 'kg', c: 'Suínos', d: 'Na brasa, no forno ou com barbecue' },
        { n: 'Coxa e sobrecoxa', p: '12,90', de: '15,90', u: 'kg', c: 'Aves', o: 1, d: 'Suculentas, ótimas assadas' },
        { n: 'Peito de frango', p: '17,90', u: 'kg', c: 'Aves', d: 'Com osso, versátil e econômico' },
        { n: 'Linguiça toscana', p: '21,90', u: 'kg', c: 'Linguiças', d: 'Clássica do churrasco' },
        { n: 'Kit churrasco', p: '89,90', u: 'un', c: 'Para o churrasco', d: 'Picanha, linguiça, frango e pão de alho' }
      ]
    }
  };

  // ícones de traço (24×24) por tema
  const ICONES = {
    acougue: '<path d="M15.5 4C19.5 4 21 7 21 10c0 4-4 8-9 8-3 0-4 1-5 2.5-1 1.5-4 .5-3.5-2C4 16 6 15 6 12c0-5 4.5-8 9.5-8z"/><circle cx="15" cy="10" r="2"/>',
    hortifruti: '<path d="M12 7.5c-1.5-1-5-1.5-6.5 1.5S5 16 7 19s3.5 2.5 5 1.5c1.5 1 3 1.5 5-1.5s3-8 1.5-10.5S13.5 6.5 12 7.5z"/><path d="M12 7.5c0-2 1-4 3-4.5"/>',
    padaria: '<path d="M12 22V9"/><path d="M12 9c-2-1-3-3-3-5.5 2 1 3 3 3 5.5zm0 0c2-1 3-3 3-5.5-2 1-3 3-3 5.5z"/><path d="M12 14c-2.5 0-4.5-1.5-5-4 2.5 0 4.5 1.5 5 4zm0 0c2.5 0 4.5-1.5 5-4-2.5 0-4.5 1.5-5 4z"/><path d="M12 19c-2.5 0-4.5-1.5-5-4 2.5 0 4.5 1.5 5 4zm0 0c2.5 0 4.5-1.5 5-4-2.5 0-4.5 1.5-5 4z"/>',
    lanchonete: '<path d="M4 11c0-4 3.6-7 8-7s8 3 8 7z"/><path d="M3 14.5h18"/><path d="M4 17.5h16a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z"/><path d="M9 7.5h.01M13 6.5h.01M15 8.5h.01"/>',
    pizzaria: '<path d="M12 21 3.2 5.5C8.8 2.8 15.2 2.8 20.8 5.5z"/><path d="M5 8.6c4.6-2 9.4-2 14 0"/><circle cx="10" cy="11.5" r="1.1"/><circle cx="14" cy="14.5" r="1.1"/><circle cx="13" cy="10.5" r=".6"/>',
    acai: '<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M7 11.5a5 5 0 0 1 10 0"/><path d="M12 6.5V3"/><path d="M10 3h4"/>',
    cafeteria: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3c-.6 1 .6 2 0 3M12 3c-.6 1 .6 2 0 3"/><path d="M3 21.5h15"/>',
    bebidas: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10.5h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 8a3 3 0 0 1 3-3 3 3 0 0 1 5 0 2.5 2.5 0 0 1 2 3"/><path d="M8.5 12v5.5M11.5 12v5.5"/>',
    mercado: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.5h11.6L21.5 7H6.2"/>',
    clinica: '<path d="M12 20s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.5-8 11-8 11z"/><path d="M5 12h4l1.5-2.5 2 5 1.5-2.5H19"/>',
    festa: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    elegante: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M12 21 8 9l4-6 4 6z"/>',
    geral: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>'
  };
  const icone = t => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (ICONES[t] || ICONES.geral) + '</svg>';
  const fotoUrl = id => 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=1920';

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
      const r = await S.fetchJson(RS.ROOT_URL + 'api/lista?id=' + encodeURIComponent(ctx.assunto.id) + '&cliente=' + encodeURIComponent(ctx.state.cliente) + (NOVO ? '&novo=1' : ''));
      l = r && r.lista;
      if (!l) throw new Error('Lista não encontrada');
    }
    const d = l.dados || {};
    let itens = (d.itens || []).filter(it => it.n);
    if (d.esgotado === 'esconder') itens = itens.filter(it => !it.x);
    // junta os itens da mesma categoria (na ordem em que cada categoria aparece primeiro), sem repetir o título dela
    const ordem = [];
    itens.forEach(it => { if (ordem.indexOf(it.c || '') < 0) ordem.push(it.c || ''); });
    itens = ordem.reduce((acc, c) => acc.concat(itens.filter(it => (it.c || '') === c)), []);
    const fundo = /^\d+$/.test(String(d.fundo || '')) ? String(d.fundo) : '';
    if (fundo) { const im = new Image(); im.src = fotoUrl(fundo); } // já deixa a foto no cache antes do primeiro slide
    return [{ tema: l.tema || 'geral', tipo: l.tipo, marca: d.marca || '', titulo: d.titulo || l.nome || '', subtitulo: d.subtitulo || '',
      rodape: d.rodape || '', fundo, icone: !d.semIcone, itens }];
  }

  // "69,90" → R$ 69,90 com centavos menores
  function preco(p, cls) {
    if (!p) return '';
    const [r, c] = String(p).split(',');
    return '<span class="' + (cls || 'li-p') + '"><small>R$</small>' + esc(r) + '<sup>,' + esc((c || '00') + '0').slice(0, 2) + '</sup></span>';
  }
  const unid = u => u ? '<small class="li-u">/' + esc(u) + '</small>' : '';

  function fundo(L) {
    return '<div class="li-bg"></div>' + (L.fundo ? '<div class="li-foto" style="background-image:url(\'' + fotoUrl(L.fundo) + '\')"></div>' : '');
  }
  function topo(L) {
    return fundo(L) + '<div class="li-top">' +
      '<div class="li-brand">' + (L.icone ? '<span class="li-ico">' + icone(L.tema) + '</span>' : '') +
        '<div class="li-hd">' + (L.marca ? '<div class="li-marca">' + esc(L.marca) + '</div>' : '') +
          '<div class="li-title">' + esc(L.titulo) + '</div></div></div>' +
      '<div class="li-right">' + (L.subtitulo ? '<div class="li-sub">' + esc(L.subtitulo) + '</div>' : '') + '<div class="li-clock">' + S.clockHtml() + '</div></div>' +
    '</div>';
  }
  function rodape(L, s) {
    let pag = '';
    if (s && s.total > 1) { pag = '<span class="li-pag">'; for (let i = 0; i < s.total; i++) pag += '<i' + (i === s.pos ? ' class="on"' : '') + '></i>'; pag += '</span>'; }
    if (!L.rodape && !pag) return '';
    return '<div class="li-foot"><span>' + esc(L.rodape) + '</span>' + pag + '</div>';
  }

  function paginas(itens, porPagina) {
    const out = [];
    for (let i = 0; i < itens.length; i += porPagina) out.push(itens.slice(i, i + porPagina));
    return out.length ? out : [[]];
  }

  function linha(it, comD) {
    return '<div class="li-row' + (it.x ? ' x' : '') + (it.o ? ' o' : '') + '">' +
      '<span class="li-nm"><span class="li-n">' + esc(it.n) + (it.o && !it.x ? ' <i class="li-tag">oferta</i>' : '') + (it.x ? ' <i class="li-tag x">acabou</i>' : '') + '</span>' +
        (comD && it.d ? '<span class="li-d">' + esc(it.d) + '</span>' : '') + '</span>' +
      '<span class="li-dots"></span>' +
      '<span class="li-pr">' + (it.de && it.o && !it.x ? '<s>R$ ' + esc(it.de) + '</s>' : '') + (it.p ? preco(it.p) + unid(it.u) : '') + '</span></div>';
  }

  // quebra em colunas pelo "peso" visual (descrição, nome longo e título de categoria ocupam espaço),
  // mantendo o nome da categoria no topo de cada coluna
  function colunas(itens, ncol, comD) {
    const peso = (it, ini) => 1 + (comD && it.d ? .45 : 0) + (it.n.length > 22 ? .8 : 0) + (ini ? .7 : 0);
    const soma = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += peso(itens[i], i === a || itens[i].c !== itens[i - 1].c); return t; };
    let corte = itens.length;
    if (ncol > 1 && itens.length > 1) {
      let melhor = Infinity;
      for (let k = 1; k < itens.length; k++) {
        const m = Math.max(soma(0, k), soma(k, itens.length));
        if (m < melhor) { melhor = m; corte = k; }
      }
    }
    const partes = [itens.slice(0, corte), itens.slice(corte)].filter(p => p.length);
    return partes.map(parte => {
      let cat = null, col = '';
      parte.forEach(it => {
        if (it.c && it.c !== cat) { cat = it.c; col += '<div class="li-cat"><span>' + esc(cat) + '</span></div>'; }
        col += linha(it, comD);
      });
      return '<div class="li-col">' + col + '</div>';
    }).join('');
  }

  // se ainda assim não couber (nomes muito longos, TV em pé), tira as descrições e depois diminui a letra
  function ajusta() {
    document.querySelectorAll('.m-lista .li-cols').forEach(el => {
      for (let n = 1; n <= 3 && el.scrollHeight > el.clientHeight + 2; n++) {
        el.classList.remove('fit' + (n - 1)); el.classList.add('fit' + n);
      }
    });
  }

  const R = {
    lista(s, L, ctx) {
      const ncol = ctx.orient === 'v' ? 1 : (s.itens.length > 7 ? 2 : 1);
      const q = Math.ceil(s.itens.length / ncol);
      return topo(L) + '<div class="li-cols n' + ncol + ' q' + Math.min(9, q) + (q <= 6 ? ' com-d' : '') + '">' + colunas(s.itens, ncol, q <= 6) + '</div>' + rodape(L, s);
    },
    cardapio(s, L) {
      return topo(L) + '<div class="li-cards n' + s.itens.length + '">' + s.itens.map((it, k) =>
        '<div class="li-card rise d' + Math.min(3, Math.floor(k / 2)) + (it.x ? ' x' : '') + (it.o ? ' o' : '') + (it.n.length > 20 ? ' longo' : '') + '">' +
          (it.o && !it.x ? '<i class="li-fita">Oferta</i>' : '') +
          (it.c ? '<div class="li-card-cat">' + esc(it.c) + '</div>' : '') +
          '<div class="li-card-n">' + esc(it.n) + '</div>' +
          (it.d ? '<div class="li-card-d">' + esc(it.d) + '</div>' : '') +
          '<div class="li-card-p">' + (it.x ? '<i class="li-tag x">acabou</i>' :
            (it.de && it.o ? '<s>R$ ' + esc(it.de) + '</s>' : '') + preco(it.p) + unid(it.u)) + '</div>' +
        '</div>').join('') + '</div>' + rodape(L, s);
    },
    oferta(s, L) {
      const it = s.item;
      return topo(L) + '<div class="li-hero">' +
        '<div class="li-hero-txt">' +
          '<div class="li-hero-tag rise">Oferta' + (it.c ? ' · ' + esc(it.c) : '') + '</div>' +
          '<div class="li-hero-n rise d1">' + esc(it.n) + '</div>' +
          (it.d ? '<div class="li-hero-d rise d1">' + esc(it.d) + '</div>' : '') +
        '</div>' +
        '<div class="li-selo rise d2">' +
          (it.de ? '<div class="li-hero-de">de <s>R$ ' + esc(it.de) + '</s> por</div>' : '<div class="li-hero-de">por apenas</div>') +
          '<div class="li-hero-p">' + preco(it.p, 'li-hp') + '</div>' +
          (it.u ? '<div class="li-hero-u">' + ({ kg: 'o quilo', un: 'a unidade', maço: 'o maço', pct: 'o pacote', dz: 'a dúzia', l: 'o litro' }[it.u] || 'por ' + esc(it.u)) + '</div>' : '') +
        '</div>' +
      '</div>' + rodape(L, s);
    },
    vazio(s, L) {
      return topo(L) + '<div class="li-hero li-hero-vazio"><div class="li-hero-n">Lista em preparação</div><div class="li-hero-d">Os produtos aparecem aqui assim que forem cadastrados.</div></div>' + rodape(L);
    }
  };

  S.register('lista', {
    refreshMinutes: 5,
    rerenderOnRefresh: true,
    load,
    slides(data, ctx) {
      const L = data[0], v = ctx.orient === 'v';
      if (!L.itens.length) return [{ k: 'vazio', L }];
      const marca = (arr) => arr.map((s, i) => Object.assign(s, { pos: i, total: arr.length }));
      if (ctx.layout === 'ofertas') {
        const of = L.itens.filter(it => it.o && !it.x && it.p);
        if (of.length) return marca(of.map(item => ({ k: 'oferta', L, item })));
      }
      const card = ctx.layout === 'cardapio';
      const pp = card ? 6 : (v ? 14 : 16);
      return marca(paginas(L.itens, pp).map(itens => ({ k: card ? 'cardapio' : 'lista', L, itens })));
    },
    duration(s, ctx) { return s.k === 'lista' || s.k === 'cardapio' ? Math.max(ctx.tempo, 15) : 0; },
    render(s, i, all, ctx) {
      if (s.k === 'lista') setTimeout(ajusta, 60);
      return '<div class="li-wrap' + (s.L.fundo ? ' foto' : '') + '" data-tm="' + esc(s.L.tema) + '">' + R[s.k](s, s.L, ctx) + '</div>';
    }
  });
})();
