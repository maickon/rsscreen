/* rsscreen — edição das tabelas de preços e cardápios pelo cliente (/editar/?c=<chave>&t=<token>) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = RS.esc;
  const P = new URLSearchParams(location.search);
  const C = (P.get('c') || '').toLowerCase(), T = P.get('t') || '';
  const API = RS.ROOT_URL + 'api/editar?c=' + encodeURIComponent(C) + '&t=' + encodeURIComponent(T);
  const TEMAS = [['acougue', 'Açougue'], ['hortifruti', 'Hortifrúti'], ['padaria', 'Padaria'], ['mercado', 'Mercado'], ['bebidas', 'Bebidas'],
    ['lanchonete', 'Lanchonete (quadro-negro)'], ['pizzaria', 'Pizzaria (quadro-negro)'], ['acai', 'Açaí'], ['cafeteria', 'Cafeteria'],
    ['clinica', 'Clínica (claro e azul)'], ['festa', 'Festa (colorido)'], ['elegante', 'Elegante (preto e dourado)'], ['geral', 'Neutro']];
  const NOME_TIPO = { precos: 'Tabela de preços', cardapio: 'Cardápio', boasvindas: 'Boas-vindas e Wi-Fi', mural: 'Aniversariantes e avisos' };
  const ehLista = tipo => tipo === 'precos' || tipo === 'cardapio';
  const temaNome = id => (TEMAS.find(t => t[0] === id) || [id, id])[1];

  let cliente = null, listas = [], limites = { listas: 10, itens: 200 }, segs = [], catalogo = {}, fundos = {};
  let atual = null, sujo = false, pvTimer, salvouAgora = false;

  hydrateIcons();
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400);
  }
  async function api(method, extra, body) {
    const r = await fetch(API + (extra || ''), { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    let d = null; try { d = await r.json(); } catch (_) {}
    if (!r.ok) throw new Error((d && d.erro) || 'Erro ' + r.status);
    return d;
  }
  function telaUrl(id, orient, layout, tipo) {
    tipo = tipo || (atual && atual.tipo) || 'precos';
    if (!ehLista(tipo)) return RS.buildScreenUrl({ cliente: C, modulo: 'mural', assunto: id, layout: 'padrao', orientacao: orient });
    return RS.buildScreenUrl({ cliente: C, modulo: 'lista', assunto: id, layout: layout || 'lista', orientacao: orient });
  }

  const abrirUrl = (orient) => telaUrl(atual.id, orient, $('edLayout').value) + '&atualizar=1';
  const fotoUrl = (id, w) => 'https://images.pexels.com/photos/' + id + '/pexels-photo-' + id + '.jpeg?auto=compress&cs=tinysrgb&w=' + w;

  // preço com máscara de real: digita só números, os centavos entram sozinhos (6990 → 69,90; 129990 → 1.299,90)
  function mascara(v) {
    let d = String(v || '').replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    if (!d) return '';
    d = d.padStart(3, '0');
    return d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d.slice(-2);
  }

  /* ---------- catálogo ---------- */
  async function carregarCatalogo() {
    try {
      segs = (await RS.fetchJson(RS.ROOT_URL + 'modules/catalogo/index.json')).segmentos || [];
      await Promise.all(segs.map(async s => { catalogo[s.id] = await RS.fetchJson(RS.ROOT_URL + 'modules/catalogo/' + s.id + '.json'); }));
      fundos = (await RS.fetchJson(RS.ROOT_URL + 'modules/catalogo/fundos.json')).temas || {};
    } catch (_) {}
    $('edFundoSeg').innerHTML = Object.keys(fundos).map(t => '<option value="' + t + '">Fotos de ' + esc(temaNome(t)) + '</option>').join('');
    $('edModSeg').innerHTML = segs.map(s => '<option value="' + s.id + '">' + esc(s.nome) + '</option>').join('');
    $('edSeg').innerHTML = segs.map(s => '<option value="' + s.id + '" data-tipo="' + s.tipo + '">' + esc(s.nome) + '</option>').join('') + '<option value="geral">Outro</option>';
    $('edTema').innerHTML = TEMAS.map(t => '<option value="' + t[0] + '">' + esc(t[1]) + '</option>').join('');
  }
  function busca(q) {
    q = RS.normalize(q);
    if (q.length < 2) return [];
    const out = [], ordem = [atual.tema].concat(segs.map(s => s.id).filter(id => id !== atual.tema));
    ordem.forEach(id => {
      const cat = catalogo[id];
      if (!cat) return;
      cat.categorias.forEach(c => c.itens.forEach(it => {
        if (out.length < 30 && RS.normalize(it[0]).indexOf(q) >= 0 && !out.some(o => o.n === it[0])) out.push({ n: it[0], u: it[1], d: it[2] || '', c: c.nome, seg: cat.nome });
      }));
    });
    return out;
  }

  /* ---------- telas ---------- */
  function mostrar(v) { ['vListas', 'vEditor'].forEach(id => { $(id).hidden = id !== v; }); $('edMsg').hidden = true; window.scrollTo(0, 0); }

  function renderListas() {
    $('edLista').innerHTML = listas.length ? listas.map(l => {
      const n = ((l.dados && l.dados.itens) || []).length;
      const d = l.dados || {};
      const info = ehLista(l.tipo) ? n + (n === 1 ? ' item' : ' itens') : l.tipo === 'mural' ? ((d.aniversarios || []).length + ' aniversariantes · ' + (d.avisos || []).length + ' avisos') : (d.wifiNome ? 'com Wi-Fi' : 'sem Wi-Fi');
      return '<div class="ed-card ed-item-lista"><div><b>' + esc(l.nome) + '</b><small>' + esc(NOME_TIPO[l.tipo] || l.tipo) + ' · ' + esc(temaNome(l.tema)) + ' · ' + info + '</small></div>' +
        '<div class="ed-acts"><button class="btn btn-primary btn-sm" data-ed="' + l.id + '">Editar</button>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(telaUrl(l.id, 'horizontal', '', l.tipo) + '&atualizar=1') + '">' + ICON('external') + ' Abrir na TV</a></div></div>';
    }).join('') : '<div class="ed-empty">Você ainda não criou nenhum conteúdo. Toque em <b>Nova</b> para começar.</div>';
    $('edNova').disabled = listas.length >= limites.listas;
  }

  function abrir(id) {
    const l = listas.find(x => x.id === id);
    if (!l) return;
    atual = JSON.parse(JSON.stringify(l));
    atual.dados = atual.dados || {};
    atual.dados.itens = atual.dados.itens || [];
    $('edTitulo').textContent = atual.nome;
    const lst = ehLista(atual.tipo);
    $('edResumo').textContent = NOME_TIPO[atual.tipo] + (lst ? ' · toque num produto do catálogo para adicionar e digite o preço.' : ' · as mudanças aparecem na prévia ao lado.');
    $('edCardProdutos').hidden = !lst;
    $('edCardBoas').hidden = atual.tipo !== 'boasvindas';
    $('edCardMural').hidden = atual.tipo !== 'mural';
    $('edLayoutWrap').hidden = !lst;
    document.querySelectorAll('[data-so=lista]').forEach(el => { el.hidden = !lst; });
    $('edTitLbl').textContent = lst ? 'Título na TV' : 'Nome do estabelecimento';
    $('bvMsg').value = atual.dados.mensagem || '';
    $('bvHora').value = atual.dados.horario || '';
    $('bvRede').value = atual.dados.wifiNome || '';
    $('bvSenha').value = atual.dados.wifiSenha || '';
    $('bvTipo').value = atual.dados.wifiTipo || 'WPA';
    $('bvInsta').value = atual.dados.instagram || '';
    $('bvWhats').value = atual.dados.whatsapp || '';
    atual.dados.aniversarios = atual.dados.aniversarios || [];
    atual.dados.avisos = atual.dados.avisos || [];
    renderMural();
    $('edTit').value = atual.dados.titulo || '';
    $('edMarca').value = atual.dados.marca || '';
    $('edIcone').checked = !atual.dados.semIcone;
    $('edFundoSeg').value = fundos[atual.tema] ? atual.tema : (Object.keys(fundos).find(t => (fundos[t] || []).indexOf(Number(atual.dados.fundo)) >= 0) || Object.keys(fundos)[0] || '');
    renderFundos();
    $('edModPainel').hidden = true;
    if (catalogo[atual.tema]) $('edModSeg').value = atual.tema;
    else { const s0 = segs.find(s => s.tipo === atual.tipo); if (s0) $('edModSeg').value = s0.id; }
    $('edSub').value = atual.dados.subtitulo || '';
    $('edRod').value = atual.dados.rodape || '';
    $('edEsg').value = atual.dados.esgotado || 'riscar';
    $('edTema').value = atual.tema || 'geral';
    $('edLayout').value = atual.tipo === 'cardapio' ? 'cardapio' : 'lista';
    sujo = false; salvouAgora = false;
    renderItens();
    estado();
    mostrar('vEditor');
    preparaPrevia();
  }

  function renderItens() {
    const its = atual.dados.itens;
    $('edConta').textContent = its.length + ' de ' + limites.itens;
    const cats = Array.from(new Set(its.map(i => i.c).filter(Boolean)));
    $('edCats').innerHTML = cats.map(c => '<option value="' + esc(c) + '">').join('');
    $('edItens').innerHTML = its.length ? its.map((it, k) =>
      '<div class="ed-it' + (it.o ? ' o' : '') + (it.x ? ' x' : '') + '" data-k="' + k + '">' +
        '<div class="ed-it-l1"><input class="input" data-f="n" value="' + esc(it.n) + '" maxlength="60" aria-label="Produto">' +
          '<div class="ed-preco"><span>R$</span><input class="input" data-f="p" value="' + esc(it.p || '') + '" inputmode="numeric" placeholder="0,00" aria-label="Preço"></div></div>' +
        '<div class="ed-it-l2">' +
          '<input class="input input-sm" data-f="u" value="' + esc(it.u || '') + '" list="edUnidades" placeholder="unidade" aria-label="Unidade">' +
          '<input class="input input-sm" data-f="c" value="' + esc(it.c || '') + '" list="edCats" placeholder="categoria" aria-label="Categoria">' +
          (it.o ? '<input class="input input-sm" data-f="de" value="' + esc(it.de || '') + '" inputmode="numeric" placeholder="de R$ (antigo)" aria-label="Preço antigo">' : '') +
        '</div>' +
        '<input class="input input-sm ed-desc" data-f="d" value="' + esc(it.d || '') + '" maxlength="90" placeholder="descrição (opcional)" aria-label="Descrição">' +
        '<div class="ed-it-acts">' +
          '<button type="button" class="ed-tg' + (it.o ? ' on' : '') + '" data-tg="o">★ Oferta</button>' +
          '<button type="button" class="ed-tg x' + (it.x ? ' on' : '') + '" data-tg="x">Acabou</button>' +
          '<span></span>' +
          '<button type="button" class="ed-ic" data-mv="-1" aria-label="Subir"' + (k === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="ed-ic" data-mv="1" aria-label="Descer"' + (k === its.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="ed-ic" data-rm aria-label="Remover">✕</button>' +
        '</div></div>').join('') : '<div class="ed-empty">Lista vazia. Comece por um <b>modelo pronto</b> (só digita os preços) ou busque os produtos acima.</div>';
    if (!its.length && $('edModPainel').hidden) abrirModelos();
  }

  /* ---------- modelos prontos ---------- */
  function abrirModelos() { $('edModPainel').hidden = false; renderModelos(); }
  function renderModelos() {
    const cat = catalogo[$('edModSeg').value];
    $('edModTrocaWrap').hidden = !atual.dados.itens.length;
    $('edModLista').innerHTML = cat && cat.modelos ? cat.modelos.map(m =>
      '<button type="button" class="ed-mod" data-mod="' + esc(m.id) + '"><b>' + esc(m.nome) + '</b><small>' + m.itens.length + ' produtos · ' +
        esc(m.itens.slice(0, 4).join(', ')) + '…</small></button>').join('') : '<div class="ed-res-vazio">Sem modelos para este segmento.</div>';
  }
  function importarModelo(segId, mid) {
    const cat = catalogo[segId], m = cat && (cat.modelos || []).find(x => x.id === mid);
    if (!m) return;
    const idx = {};
    cat.categorias.forEach(c => c.itens.forEach(it => { if (!idx[it[0]]) idx[it[0]] = { n: it[0], u: it[1], d: it[2] || '', c: c.nome }; }));
    const vazia = !atual.dados.itens.length, troca = $('edModTroca').checked;
    if (troca && !vazia && !confirm('Apagar os ' + atual.dados.itens.length + ' itens atuais e importar "' + m.nome + '"?')) return;
    if (troca) atual.dados.itens = [];
    const tem = new Set(atual.dados.itens.map(i => RS.normalize(i.n)));
    let n = 0;
    m.itens.forEach(nome => {
      const r = idx[nome];
      if (!r || tem.has(RS.normalize(r.n)) || atual.dados.itens.length >= limites.itens) return;
      const it = { n: r.n, u: r.u, c: r.c };
      if (r.d) it.d = r.d;
      atual.dados.itens.push(it); n++;
    });
    if (vazia || troca) { $('edTit').value = m.titulo || $('edTit').value; $('edSub').value = m.subtitulo || $('edSub').value; }
    $('edModPainel').hidden = true; $('edModTroca').checked = false;
    renderItens(); mudou();
    toast(n + ' produtos importados. Agora é só digitar os preços.');
    const vaz = document.querySelector('.ed-it [data-f=p]');
    if (vaz) { vaz.closest('.ed-it').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => vaz.focus(), 350); }
  }
  $('edModelos').addEventListener('click', () => { if ($('edModPainel').hidden) abrirModelos(); else $('edModPainel').hidden = true; });
  $('edModSeg').addEventListener('change', renderModelos);
  $('edModLista').addEventListener('click', e => { const b = e.target.closest('[data-mod]'); if (b) importarModelo($('edModSeg').value, b.dataset.mod); });

  /* ---------- foto de fundo ---------- */
  function renderFundos() {
    const sel = String(atual.dados.fundo || ''), ids = fundos[$('edFundoSeg').value] || [];
    $('edFundos').innerHTML = '<button type="button" class="ed-fd ed-fd-0' + (!sel ? ' on' : '') + '" data-fd="">Sem foto<small>fundo do visual</small></button>' +
      ids.map(id => '<button type="button" class="ed-fd' + (String(id) === sel ? ' on' : '') + '" data-fd="' + id + '" aria-label="Foto ' + id + '"><img loading="lazy" alt="" src="' + fotoUrl(id, 320) + '"></button>').join('');
  }
  $('edFundoSeg').addEventListener('change', renderFundos);
  $('edFundos').addEventListener('click', e => {
    const b = e.target.closest('[data-fd]');
    if (!b) return;
    if (b.dataset.fd) atual.dados.fundo = b.dataset.fd; else delete atual.dados.fundo;
    renderFundos(); mudou();
  });

  function estado() {
    $('edEstado').textContent = sujo ? 'Alterações não salvas' : salvouAgora ? 'Salvo! A TV atualiza sozinha em até 10 min.' : 'Tudo salvo';
    $('edAgora').hidden = sujo || !salvouAgora;
    $('edAgora').href = abrirUrl('horizontal');
    $('edSaveBar').classList.toggle('sujo', sujo);
    $('edLink').textContent = telaUrl(atual.id, 'horizontal', $('edLayout').value);
    $('edAbrirH').href = abrirUrl('horizontal');
    $('edAbrirV').href = abrirUrl('vertical');
  }
  function mudou() { sujo = true; salvouAgora = false; estado(); agendaPrevia(); }

  /* ---------- aniversariantes e avisos ---------- */
  function renderMural() {
    const an = atual.dados.aniversarios || [], av = atual.dados.avisos || [];
    $('muConta').textContent = an.length + ' de 150';
    $('muAniv').innerHTML = an.length ? an.map((a, k) =>
      '<div class="ed-it" data-an="' + k + '"><div class="ed-it-l1 mu-l1"><input class="input" data-fa="n" value="' + esc(a.n) + '" maxlength="50" placeholder="Nome" aria-label="Nome">' +
        '<input class="input" data-fa="d" value="' + esc(a.d) + '" maxlength="5" placeholder="dd/mm" inputmode="numeric" aria-label="Dia e mês"></div>' +
        '<div class="ed-it-acts"><input class="input input-sm" data-fa="x" value="' + esc(a.x || '') + '" maxlength="40" placeholder="Turma, setor… (opcional)" style="flex:1">' +
        '<button type="button" class="ed-ic" data-rman aria-label="Remover">✕</button></div></div>').join('') : '<div class="ed-empty">Nenhum aniversariante ainda.</div>';
    $('muAvisos').innerHTML = av.length ? av.map((a, k) =>
      '<div class="ed-it" data-av="' + k + '"><input class="input" data-fv="t" value="' + esc(a.t || '') + '" maxlength="60" placeholder="Título do aviso" aria-label="Título">' +
        '<textarea class="input" data-fv="x" rows="2" maxlength="300" placeholder="Texto do aviso" aria-label="Texto">' + esc(a.x || '') + '</textarea>' +
        '<div class="ed-it-acts"><label class="ed-ate">Sai do ar depois de <input class="input input-sm" type="date" data-fv="ate" value="' + esc(a.ate || '') + '"></label><span></span>' +
        '<button type="button" class="ed-ic" data-rmav aria-label="Remover">✕</button></div></div>').join('') : '<div class="ed-empty">Nenhum aviso ainda.</div>';
  }
  $('muAddAniv').addEventListener('click', () => {
    if (atual.dados.aniversarios.length >= 150) return toast('Limite de 150 aniversariantes');
    atual.dados.aniversarios.push({ n: '', d: '' }); renderMural(); mudou();
    const l = document.querySelectorAll('[data-an]'); l[l.length - 1].querySelector('[data-fa=n]').focus();
  });
  $('muAddAviso').addEventListener('click', () => {
    if (atual.dados.avisos.length >= 20) return toast('Limite de 20 avisos');
    atual.dados.avisos.push({ t: '', x: '' }); renderMural(); mudou();
    const l = document.querySelectorAll('[data-av]'); l[l.length - 1].querySelector('[data-fv=t]').focus();
  });
  $('edCardMural').addEventListener('input', e => {
    const an = e.target.closest('[data-an]'), av = e.target.closest('[data-av]');
    if (an && e.target.dataset.fa) {
      let v = e.target.value;
      if (e.target.dataset.fa === 'd') { v = v.replace(/[^\d]/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; }
      atual.dados.aniversarios[Number(an.dataset.an)][e.target.dataset.fa] = v;
    }
    if (av && e.target.dataset.fv) atual.dados.avisos[Number(av.dataset.av)][e.target.dataset.fv] = e.target.value;
    mudou();
  });
  $('edCardMural').addEventListener('click', e => {
    const an = e.target.closest('[data-rman]') && e.target.closest('[data-an]');
    const av = e.target.closest('[data-rmav]') && e.target.closest('[data-av]');
    if (an) atual.dados.aniversarios.splice(Number(an.dataset.an), 1);
    else if (av) atual.dados.avisos.splice(Number(av.dataset.av), 1);
    else return;
    renderMural(); mudou();
  });

  function lerCampos() {
    atual.dados.titulo = $('edTit').value.trim();
    atual.dados.marca = $('edMarca').value.trim();
    if ($('edIcone').checked) delete atual.dados.semIcone; else atual.dados.semIcone = 1;
    if (atual.tipo === 'boasvindas') {
      atual.dados.mensagem = $('bvMsg').value.trim();
      atual.dados.horario = $('bvHora').value.trim();
      atual.dados.wifiNome = $('bvRede').value.trim();
      atual.dados.wifiSenha = $('bvSenha').value;
      atual.dados.wifiTipo = $('bvTipo').value;
      atual.dados.instagram = $('bvInsta').value.trim();
      atual.dados.whatsapp = $('bvWhats').value.trim();
    }
    atual.dados.subtitulo = $('edSub').value.trim();
    atual.dados.rodape = $('edRod').value.trim();
    atual.dados.esgotado = $('edEsg').value;
    atual.tema = $('edTema').value;
  }

  /* ---------- prévia ---------- */
  function preparaPrevia() {
    const f = $('edPv');
    f.src = telaUrl('previa', 'horizontal', $('edLayout').value) + '&previa=1&modo=';
  }
  function enviaPrevia() {
    lerCampos();
    try { $('edPv').contentWindow.postMessage({ rs: 'lista-previa', lista: atual }, location.origin); } catch (_) {}
  }
  function agendaPrevia() { clearTimeout(pvTimer); pvTimer = setTimeout(enviaPrevia, 350); }
  window.addEventListener('message', e => { if (e.origin === location.origin && e.data && e.data.rs === 'lista-pronta') enviaPrevia(); });

  /* ---------- eventos ---------- */
  $('edNova').addEventListener('click', () => { $('edNovaForm').hidden = false; $('edNome').focus(); });
  $('edNovaCancel').addEventListener('click', () => { $('edNovaForm').hidden = true; });
  document.querySelectorAll('input[name=tipo]').forEach(r => r.addEventListener('change', () => {
    const tipo = document.querySelector('input[name=tipo]:checked').value;
    $('edSegWrap').querySelector('span').textContent = ehLista(tipo) ? 'Tipo de comércio (define o visual e o catálogo)' : 'Visual na TV';
    if (ehLista(tipo)) {
      $('edSeg').innerHTML = segs.map(s => '<option value="' + s.id + '" data-tipo="' + s.tipo + '">' + esc(s.nome) + '</option>').join('') + '<option value="geral">Outro</option>';
      const op = Array.from($('edSeg').options).find(o => o.dataset.tipo === tipo);
      if (op) $('edSeg').value = op.value;
    } else {
      $('edSeg').innerHTML = TEMAS.map(t => '<option value="' + t[0] + '">' + esc(t[1]) + '</option>').join('');
      $('edSeg').value = tipo === 'mural' ? 'festa' : 'clinica';
    }
  }));
  $('edNovaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const tipo = document.querySelector('input[name=tipo]:checked').value;
    const seg = $('edSeg').value;
    const nome = $('edNome').value.trim() || NOME_TIPO[tipo];
    try {
      const r = await api('POST', '', { tipo, tema: seg, nome, dados: ehLista(tipo) ? { marca: cliente.nome, titulo: tipo === 'cardapio' ? 'Cardápio' : 'Preços de hoje', itens: [] } : { titulo: cliente.nome } });
      await recarregar();
      $('edNovaForm').hidden = true; $('edNome').value = '';
      abrir(r.id);
    } catch (err) { toast(err.message); }
  });
  $('edLista').addEventListener('click', e => { const b = e.target.closest('[data-ed]'); if (b) abrir(b.dataset.ed); });
  $('edVoltar').addEventListener('click', () => {
    if (sujo && !confirm('Sair sem salvar as alterações?')) return;
    renderListas(); mostrar('vListas');
  });

  $('edBusca').addEventListener('input', () => {
    const res = busca($('edBusca').value);
    $('edRes').hidden = !$('edBusca').value.trim();
    $('edRes').innerHTML = res.length ? res.map((r, i) => '<button type="button" data-add="' + i + '"><b>' + esc(r.n) + '</b><small>' + esc(r.c) + (r.u ? ' · ' + esc(r.u) : '') + (r.seg && catalogo[atual.tema] && catalogo[atual.tema].nome !== r.seg ? ' · ' + esc(r.seg) : '') + '</small></button>').join('') :
      '<div class="ed-res-vazio">Nada no catálogo. Use "Item que não está no catálogo".</div>';
    $('edRes')._res = res;
  });
  $('edRes').addEventListener('click', e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    if (atual.dados.itens.length >= limites.itens) return toast('Limite de ' + limites.itens + ' itens nesta lista');
    const r = $('edRes')._res[Number(b.dataset.add)];
    const it = { n: r.n, u: r.u, c: r.c };
    if (r.d) it.d = r.d;
    atual.dados.itens.push(it);
    $('edBusca').value = ''; $('edRes').hidden = true;
    renderItens(); mudou();
    const linhas = document.querySelectorAll('.ed-it');
    const ult = linhas[linhas.length - 1];
    if (ult) { ult.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => ult.querySelector('[data-f=p]').focus(), 300); }
  });
  $('edProprio').addEventListener('click', () => {
    if (atual.dados.itens.length >= limites.itens) return toast('Limite de ' + limites.itens + ' itens nesta lista');
    atual.dados.itens.push({ n: '', u: atual.tipo === 'cardapio' ? 'un' : 'kg' });
    renderItens(); mudou();
    const linhas = document.querySelectorAll('.ed-it');
    linhas[linhas.length - 1].querySelector('[data-f=n]').focus();
  });
  $('edItens').addEventListener('input', e => {
    const row = e.target.closest('[data-k]'), f = e.target.dataset.f;
    if (!row || !f) return;
    if (f === 'p' || f === 'de') e.target.value = mascara(e.target.value);
    atual.dados.itens[Number(row.dataset.k)][f] = e.target.value;
    mudou();
  });
  $('edItens').addEventListener('click', e => {
    const row = e.target.closest('[data-k]');
    if (!row) return;
    const k = Number(row.dataset.k), its = atual.dados.itens;
    const tg = e.target.closest('[data-tg]'), mv = e.target.closest('[data-mv]');
    if (tg) { const f = tg.dataset.tg; its[k][f] = its[k][f] ? 0 : 1; if (f === 'x' && its[k].x) its[k].o = 0; }
    else if (mv) { const j = k + Number(mv.dataset.mv); [its[k], its[j]] = [its[j], its[k]]; }
    else if (e.target.closest('[data-rm]')) { if (!confirm('Remover "' + (its[k].n || 'item') + '"?')) return; its.splice(k, 1); }
    else return;
    renderItens(); mudou();
  });
  ['edTit', 'edMarca', 'edSub', 'edRod', 'bvMsg', 'bvHora', 'bvRede', 'bvSenha', 'bvInsta', 'bvWhats'].forEach(id => $(id).addEventListener('input', mudou));
  ['edEsg', 'edTema', 'bvTipo', 'edIcone'].forEach(id => $(id).addEventListener('change', mudou));
  $('edTema').addEventListener('change', () => { if (fundos[$('edTema').value]) { $('edFundoSeg').value = $('edTema').value; renderFundos(); } });
  $('edLayout').addEventListener('change', () => { estado(); preparaPrevia(); });

  $('edSalvar').addEventListener('click', async () => {
    lerCampos();
    const vazios = atual.dados.itens.filter(i => !String(i.n || '').trim()).length;
    atual.dados.itens = atual.dados.itens.filter(i => String(i.n || '').trim());
    if (atual.tipo === 'mural') {
      const ruins = atual.dados.aniversarios.filter(a => a.n && !/^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])$/.test(a.d || ''));
      if (ruins.length) return toast('Confira a data de "' + ruins[0].n + '": use dia/mês, ex.: 05/03');
      atual.dados.aniversarios = atual.dados.aniversarios.filter(a => a.n);
      atual.dados.avisos = atual.dados.avisos.filter(a => a.t || a.x);
    }
    $('edSalvar').disabled = true;
    try {
      await api('POST', '', { id: atual.id, tipo: atual.tipo, tema: atual.tema, nome: atual.nome, dados: atual.dados });
      const i = listas.findIndex(x => x.id === atual.id);
      if (i >= 0) listas[i] = JSON.parse(JSON.stringify(atual));
      sujo = false; salvouAgora = true; estado(); renderItens();
      toast('Salvo! A TV atualiza sozinha em até 10 minutos.' + (vazios ? ' (itens sem nome foram removidos)' : ''));
    } catch (err) { toast(err.message); }
    $('edSalvar').disabled = false;
  });
  $('edExcluir').addEventListener('click', async () => {
    if (!confirm('Excluir "' + atual.nome + '"? A TV que usa esta lista vai parar de mostrar os preços.')) return;
    try { await api('DELETE', '&id=' + encodeURIComponent(atual.id)); await recarregar(); sujo = false; renderListas(); mostrar('vListas'); toast('Lista excluída'); }
    catch (err) { toast(err.message); }
  });
  document.querySelectorAll('[data-cp]').forEach(b => b.addEventListener('click', async () => {
    toast((await RS.copyText(telaUrl(atual.id, b.dataset.cp, $('edLayout').value))) ? 'Link copiado' : 'Não foi possível copiar');
  }));
  window.addEventListener('beforeunload', e => { if (sujo) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- início ---------- */
  async function recarregar() {
    const d = await api('GET');
    cliente = d.cliente; listas = d.listas || []; limites = d.limites || limites;
    $('edCli').textContent = cliente.nome;
    document.title = 'Conteúdo da TV · ' + cliente.nome;
  }
  (async () => {
    if (!C || !T) { $('edMsg').innerHTML = '<b>Link incompleto.</b><br>Peça o link de edição ao seu fornecedor.'; return; }
    try {
      await Promise.all([recarregar(), carregarCatalogo()]);
      renderListas(); mostrar('vListas');
      if (listas.length === 1) abrir(listas[0].id);
    } catch (err) { $('edMsg').innerHTML = '<b>Não foi possível abrir.</b><br>' + esc(err.message); }
  })();
})();
