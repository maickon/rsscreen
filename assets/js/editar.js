/* rsscreen — edição das tabelas de preços e cardápios pelo cliente (/editar/?c=<chave>&t=<token>) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = RS.esc;
  const P = new URLSearchParams(location.search);
  const C = (P.get('c') || '').toLowerCase(), T = P.get('t') || '';
  const API = RS.ROOT_URL + 'api/editar?c=' + encodeURIComponent(C) + '&t=' + encodeURIComponent(T);
  const TEMAS = [['acougue', 'Açougue'], ['hortifruti', 'Hortifrúti'], ['padaria', 'Padaria'], ['mercado', 'Mercado'], ['bebidas', 'Bebidas'],
    ['lanchonete', 'Lanchonete (quadro-negro)'], ['pizzaria', 'Pizzaria (quadro-negro)'], ['acai', 'Açaí'], ['cafeteria', 'Cafeteria'], ['geral', 'Neutro']];
  const temaNome = id => (TEMAS.find(t => t[0] === id) || [id, id])[1];

  let cliente = null, listas = [], limites = { listas: 10, itens: 200 }, segs = [], catalogo = {};
  let atual = null, sujo = false, pvTimer;

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
  function telaUrl(id, orient, layout) {
    return RS.buildScreenUrl({ cliente: C, modulo: 'lista', assunto: id, layout: layout || 'lista', orientacao: orient });
  }

  /* ---------- catálogo ---------- */
  async function carregarCatalogo() {
    try {
      segs = (await RS.fetchJson(RS.ROOT_URL + 'modules/catalogo/index.json')).segmentos || [];
      await Promise.all(segs.map(async s => { catalogo[s.id] = await RS.fetchJson(RS.ROOT_URL + 'modules/catalogo/' + s.id + '.json'); }));
    } catch (_) {}
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
      return '<div class="ed-card ed-item-lista"><div><b>' + esc(l.nome) + '</b><small>' + (l.tipo === 'cardapio' ? 'Cardápio' : 'Tabela de preços') + ' · ' + esc(temaNome(l.tema)) + ' · ' + n + (n === 1 ? ' item' : ' itens') + '</small></div>' +
        '<div class="ed-acts"><button class="btn btn-primary btn-sm" data-ed="' + l.id + '">Editar</button>' +
        '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(telaUrl(l.id, 'horizontal')) + '">' + ICON('eye') + ' Ver na TV</a></div></div>';
    }).join('') : '<div class="ed-empty">Você ainda não tem nenhuma tabela ou cardápio. Toque em <b>Nova</b> para começar.</div>';
    $('edNova').disabled = listas.length >= limites.listas;
  }

  function abrir(id) {
    const l = listas.find(x => x.id === id);
    if (!l) return;
    atual = JSON.parse(JSON.stringify(l));
    atual.dados = atual.dados || {};
    atual.dados.itens = atual.dados.itens || [];
    $('edTitulo').textContent = atual.nome;
    $('edResumo').textContent = (atual.tipo === 'cardapio' ? 'Cardápio' : 'Tabela de preços') + ' · toque num produto do catálogo para adicionar e digite o preço.';
    $('edTit').value = atual.dados.titulo || '';
    $('edSub').value = atual.dados.subtitulo || '';
    $('edRod').value = atual.dados.rodape || '';
    $('edEsg').value = atual.dados.esgotado || 'riscar';
    $('edTema').value = atual.tema || 'geral';
    $('edLayout').value = atual.tipo === 'cardapio' ? 'cardapio' : 'lista';
    sujo = false;
    renderItens();
    estado();
    mostrar('vEditor');
    preparaPrevia();
  }

  function renderItens() {
    const its = atual.dados.itens, card = atual.tipo === 'cardapio';
    $('edConta').textContent = its.length + ' de ' + limites.itens;
    const cats = Array.from(new Set(its.map(i => i.c).filter(Boolean)));
    $('edCats').innerHTML = cats.map(c => '<option value="' + esc(c) + '">').join('');
    $('edItens').innerHTML = its.length ? its.map((it, k) =>
      '<div class="ed-it' + (it.o ? ' o' : '') + (it.x ? ' x' : '') + '" data-k="' + k + '">' +
        '<div class="ed-it-l1"><input class="input" data-f="n" value="' + esc(it.n) + '" maxlength="60" aria-label="Produto">' +
          '<div class="ed-preco"><span>R$</span><input class="input" data-f="p" value="' + esc(it.p || '') + '" inputmode="decimal" placeholder="0,00" aria-label="Preço"></div></div>' +
        '<div class="ed-it-l2">' +
          '<input class="input input-sm" data-f="u" value="' + esc(it.u || '') + '" list="edUnidades" placeholder="unidade" aria-label="Unidade">' +
          '<input class="input input-sm" data-f="c" value="' + esc(it.c || '') + '" list="edCats" placeholder="categoria" aria-label="Categoria">' +
          (it.o ? '<input class="input input-sm" data-f="de" value="' + esc(it.de || '') + '" inputmode="decimal" placeholder="preço antigo" aria-label="Preço antigo">' : '') +
        '</div>' +
        (card ? '<input class="input input-sm ed-desc" data-f="d" value="' + esc(it.d || '') + '" maxlength="90" placeholder="descrição (ingredientes)" aria-label="Descrição">' : '') +
        '<div class="ed-it-acts">' +
          '<button type="button" class="ed-tg' + (it.o ? ' on' : '') + '" data-tg="o">★ Oferta</button>' +
          '<button type="button" class="ed-tg x' + (it.x ? ' on' : '') + '" data-tg="x">Acabou</button>' +
          '<span></span>' +
          '<button type="button" class="ed-ic" data-mv="-1" aria-label="Subir"' + (k === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="ed-ic" data-mv="1" aria-label="Descer"' + (k === its.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" class="ed-ic" data-rm aria-label="Remover">✕</button>' +
        '</div></div>').join('') : '<div class="ed-empty">Busque um produto acima ou adicione um item próprio.</div>';
  }

  function estado() {
    $('edEstado').textContent = sujo ? 'Alterações não salvas' : 'Tudo salvo';
    $('edSaveBar').classList.toggle('sujo', sujo);
    $('edLink').textContent = telaUrl(atual.id, 'horizontal', $('edLayout').value);
  }
  function mudou() { sujo = true; estado(); agendaPrevia(); }

  function lerCampos() {
    atual.dados.titulo = $('edTit').value.trim();
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
    const op = Array.from($('edSeg').options).find(o => o.dataset.tipo === tipo);
    if (op) $('edSeg').value = op.value;
  }));
  $('edNovaForm').addEventListener('submit', async e => {
    e.preventDefault();
    const tipo = document.querySelector('input[name=tipo]:checked').value;
    const seg = $('edSeg').value;
    const nome = $('edNome').value.trim() || (tipo === 'cardapio' ? 'Cardápio' : 'Tabela de preços');
    try {
      const r = await api('POST', '', { tipo, tema: seg, nome, dados: { titulo: cliente.nome, subtitulo: tipo === 'cardapio' ? 'Cardápio' : 'Preços de hoje', itens: [] } });
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
    if (r.d && atual.tipo === 'cardapio') it.d = r.d;
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
  ['edTit', 'edSub', 'edRod'].forEach(id => $(id).addEventListener('input', mudou));
  ['edEsg', 'edTema'].forEach(id => $(id).addEventListener('change', mudou));
  $('edLayout').addEventListener('change', () => { estado(); preparaPrevia(); });

  $('edSalvar').addEventListener('click', async () => {
    lerCampos();
    const vazios = atual.dados.itens.filter(i => !String(i.n || '').trim()).length;
    atual.dados.itens = atual.dados.itens.filter(i => String(i.n || '').trim());
    $('edSalvar').disabled = true;
    try {
      await api('POST', '', { id: atual.id, tipo: atual.tipo, tema: atual.tema, nome: atual.nome, dados: atual.dados });
      const i = listas.findIndex(x => x.id === atual.id);
      if (i >= 0) listas[i] = JSON.parse(JSON.stringify(atual));
      sujo = false; estado(); renderItens();
      toast('Salvo! A TV atualiza em até 10 minutos.' + (vazios ? ' (itens sem nome foram removidos)' : ''));
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
    document.title = 'Tabelas e cardápios · ' + cliente.nome;
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
