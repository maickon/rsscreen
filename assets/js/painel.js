/* rsscreen — painel do administrador */
(function () {
  'use strict';
  const esc = RS.esc;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const LINKS_KEY = 'rs_links_v1';
  const MAX_COMBOS = 80;

  hydrateIcons();

  /* =================== utilidades =================== */
  let toastTimer;
  function toast(msg, icon) {
    const t = $('#toast');
    t.innerHTML = ICON(icon || 'check') + '<span>' + esc(msg) + '</span>';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copy(text, msg) {
    const ok = await RS.copyText(text);
    toast(ok ? (msg || 'Copiado!') : 'Não foi possível copiar', ok ? 'check' : 'x');
  }

  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (_) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { toast('Armazenamento do navegador indisponível', 'x'); } }
  };

  let clients = RS.clients();
  let activeClients = clients.filter(c => c.ativo);
  let dbMode = false;          // true = clientes vêm do banco D1
  const PLANOS = (RS.CFG.planos || []);
  const planoById = id => PLANOS.find(p => p.id === id);
  const money = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function setClients(list) {
    clients = list;
    activeClients = clients.filter(c => c.ativo);
  }
  let modules = [];          // todos os manifestos
  let active = [];           // apenas ativos
  let pacotes = [];
  const modById = id => modules.find(m => m.id === id);

  function clientOptions(sel, includeAll) {
    return (includeAll ? '<option value="">Todos os clientes</option>' : '') +
      activeClients.map(c => '<option value="' + c.chave + '"' + (c.chave === sel ? ' selected' : '') + '>' + esc(c.nome) + (c.demo ? ' (demonstração)' : '') + '</option>').join('');
  }

  const ORIENT_NAME = { horizontal: 'Horizontal', vertical: 'Vertical' };
  const MOD_ICON = m => (m && m.icone) || 'sparkles';

  /* =================== autenticação =================== */
  // A senha fica só neste aparelho (para consultar as estatísticas); o arquivo público guarda apenas o hash.
  const AUTH = 'rs_admin_v2';
  const senhaHashCfg = String((RS.CFG.admin && RS.CFG.admin.senhaHash) || '').toLowerCase();
  try { localStorage.removeItem('rs_admin_v1'); } catch (_) {}

  function session() { return store.get(AUTH, null); }
  function adminSenha() { const s = session(); return (s && s.senha) || ''; }
  function isLogged() { const s = session(); return !!(s && senhaHashCfg && s.hash === senhaHashCfg); }

  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    setTimeout(() => $('#loginKey').focus(), 50);
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const senha = $('#loginKey').value;
    let h = '';
    try { h = await RS.passwordHash(senha); } catch (_) {
      $('#loginError').textContent = 'Este navegador não permite o login (abra o painel pelo endereço https).';
      $('#loginError').hidden = false;
      return;
    }
    if (senha && h === senhaHashCfg) {
      store.set(AUTH, { hash: h, senha });
      $('#loginError').hidden = true;
      $('#loginKey').value = '';
      start();
    } else {
      $('#loginError').textContent = 'Senha incorreta. Confira e tente novamente.';
      $('#loginError').hidden = false;
      $('#loginKey').select();
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    try { localStorage.removeItem(AUTH); } catch (_) {}
    location.hash = '';
    showLogin();
  });

  /* =================== navegação =================== */
  const VIEWS = ['gerar', 'anuncios', 'pacotes', 'links', 'clientes', 'modelos', 'modulos', 'monitor', 'guia'];

  function route() {
    const v = (location.hash || '#gerar').slice(1);
    const view = VIEWS.indexOf(v) >= 0 ? v : 'gerar';
    VIEWS.forEach(n => { $('#view-' + n).hidden = n !== view; });
    $$('#sideNav a').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    $('#app').classList.remove('menu-open');
    if (view === 'links') renderLinks();
    if (view === 'modelos') renderModels();
    if (view === 'monitor') loadMonitor();
    if (view === 'guia') renderGuia();
    if (view === 'anuncios') initAds();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  $('#menuBtn').addEventListener('click', () => $('#app').classList.add('menu-open'));
  $('#sideClose').addEventListener('click', () => $('#app').classList.remove('menu-open'));
  $('#sideBackdrop').addEventListener('click', () => $('#app').classList.remove('menu-open'));

  /* =================== links salvos =================== */
  function getLinks() { return store.get(LINKS_KEY, []); }
  function saveLinks(list) { store.set(LINKS_KEY, list); updateLinksCount(); }
  function updateLinksCount() { const n = getLinks().length; $('#navLinksCount').textContent = n ? String(n) : ''; }

  function makeRecord(o) {
    const m = modById(o.modulo);
    const a = (m.assuntos || []).find(x => x.id === o.assunto);
    const f = a && a.fontes ? a.fontes.find(x => x.id === o.fonte) : null;
    const l = m.layouts.find(x => x.id === o.layout);
    const t = RS.theme(o.tema);
    const c = clients.find(x => x.chave === o.cliente);
    return {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      cliente: o.cliente, clienteNome: c ? c.nome : o.cliente,
      modulo: m.id, moduloNome: m.nome,
      assunto: o.assunto, assuntoNome: a ? a.nome : o.assunto,
      fonte: o.fonte || '', fonteNome: f ? f.nome : '',
      layout: o.layout, layoutNome: l ? l.nome : o.layout,
      orientacao: o.orientacao, tema: t.id, temaNome: t.nome,
      tempo: o.tempo || '', girar: o.girar || '',
      url: RS.buildScreenUrl(o),
      criado: Date.now()
    };
  }

  function recordTitle(r) {
    return r.assuntoNome + (r.fonteNome ? ' (' + r.fonteNome + ')' : '');
  }

  function linkRow(r, opts) {
    const testUrl = r.url + '&modo=teste';
    return '<div class="link-row" data-id="' + r.id + '">' +
      '<div class="link-ico' + (r.orientacao === 'vertical' ? ' v' : '') + '">' + ICON(r.orientacao === 'vertical' ? 'phone' : 'monitor') + '</div>' +
      '<div class="link-main">' +
        '<div class="link-title">' + esc(recordTitle(r)) +
          '<span class="tag">' + esc(r.layoutNome) + '</span>' +
          '<span class="tag">' + esc(ORIENT_NAME[r.orientacao] || 'Auto') + '</span>' +
          '<span class="tag">' + esc(r.temaNome) + '</span>' +
          (r.girar ? '<span class="tag">Girada ' + esc(r.girar) + '°</span>' : '') +
          (opts && opts.showModule ? '<span class="tag">' + esc(r.moduloNome) + '</span>' : '') +
        '</div>' +
        '<div class="link-url" title="' + esc(r.url) + '">' + esc(r.url) + '</div>' +
      '</div>' +
      '<div class="link-actions">' +
        '<button class="btn btn-ghost btn-sm" data-act="copy" title="Copiar link">' + ICON('copy') + '</button>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(r.url) + '" target="_blank" rel="noopener" title="Abrir tela">' + ICON('external') + '</a>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(testUrl) + '" target="_blank" rel="noopener" title="Abrir em modo teste">' + ICON('eye') + '</a>' +
        (opts && opts.removable ? '<button class="btn btn-ghost btn-sm" data-act="del" title="Remover do histórico">' + ICON('trash') + '</button>' : '') +
      '</div>' +
    '</div>';
  }

  function whatsappMessage(records) {
    const nome = records[0] ? records[0].clienteNome : '';
    const lines = records.map(r => '📺 ' + recordTitle(r) + ' — ' + r.layoutNome + ' (' + (ORIENT_NAME[r.orientacao] || 'auto').toLowerCase() + ')\n' + r.url);
    return (RS.CFG.mensagemPadrao || '{links}')
      .replace(/\{cliente\}/g, nome)
      .replace(/\{quantidade\}/g, String(records.length))
      .replace(/\{links\}/g, lines.join('\n\n'));
  }

  function whatsappHref(records) {
    const c = clients.find(x => records[0] && x.chave === records[0].cliente);
    let phone = c && c.whatsapp ? c.whatsapp : '';
    if (phone && phone.length <= 11) phone = '55' + phone;
    const text = whatsappMessage(records);
    return phone ? RS.whatsappLink(phone, text) : 'https://wa.me/?text=' + encodeURIComponent(text);
  }

  /* =================== GERAR LINKS =================== */
  const G = { cliente: '', modulo: 'rss', site: '', assuntos: [], fonte: '', layouts: [], orient: ['horizontal'], tema: '', tempo: '', girar: '', busca: '' };
  let results = [];

  function gModule() { return modById(G.modulo) || active[0]; }

  function resetForModule() {
    const m = gModule();
    const p = m.padrao || {};
    G.assuntos = p.assunto ? [p.assunto] : (m.assuntos[0] ? [m.assuntos[0].id] : []);
    G.layouts = p.layout ? [p.layout] : [m.layouts[0].id];
    G.tema = p.tema || 'noite';
    G.fonte = '';
    G.site = '';
    G.busca = '';
    $('#gAssuntoBusca').value = '';
  }

  // fontes de um assunto, respeitando o site escolhido
  function fontesOf(a) {
    const list = (a && a.fontes) || [];
    return G.site ? list.filter(f => f.site === G.site) : list;
  }

  function assuntosVisiveis() {
    const m = gModule();
    if (!m) return [];
    return G.site ? m.assuntos.filter(a => fontesOf(a).length) : m.assuntos;
  }

  function fonteFor(assuntoId) {
    const m = gModule();
    const a = m.assuntos.find(x => x.id === assuntoId);
    if (!a || !a.fontes) return '';
    const fs = fontesOf(a);
    if (G.assuntos.length === 1 && G.fonte && fs.some(f => f.id === G.fonte)) return G.fonte;
    if (G.site) return fs[0] ? fs[0].id : '';
    return a.fonteObrigatoria ? a.fontes[0].id : '';
  }

  function combos() {
    const out = [];
    G.assuntos.forEach(a => G.layouts.forEach(l => G.orient.forEach(o => {
      out.push({ cliente: G.cliente, modulo: G.modulo, assunto: a, fonte: fonteFor(a), layout: l, orientacao: o, tema: G.tema, tempo: G.tempo, girar: G.girar });
    })));
    return out;
  }

  function renderGen() {
    const m = gModule();
    $('#gCliente').innerHTML = clientOptions(G.cliente);
    const c = clients.find(x => x.chave === G.cliente);
    $('#gClienteInfo').innerHTML = c ? 'Chave do cliente: <code>' + esc(c.chave) + '</code>' + (c.whatsapp ? ' · WhatsApp: ' + esc(c.whatsapp) : ' · sem WhatsApp cadastrado') : '';

    $('#gModulo').innerHTML = active.map(x => '<button data-v="' + x.id + '" class="' + (x.id === m.id ? 'on' : '') + '">' + ICON(MOD_ICON(x)) + esc(x.nome) + '</button>').join('');

    $('#gAssuntoLabel').textContent = (m.rotuloAssunto || 'Assunto') + 's';
    if (m.sites && m.sites.length) {
      $('#gSiteWrap').hidden = false;
      $('#gSite').innerHTML = '<option value="">Todos os sites (mistura as fontes do assunto)</option>' +
        m.sites.map(x => '<option value="' + x.id + '"' + (x.id === G.site ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('');
    } else {
      $('#gSiteWrap').hidden = true;
    }
    const visiveis = assuntosVisiveis();
    $('#gAssuntoBusca').hidden = visiveis.length < 12;
    const q = RS.normalize(G.busca);
    $('#gAssuntos').innerHTML = visiveis
      .filter(a => !q || RS.normalize(a.nome).indexOf(q) >= 0 || G.assuntos.indexOf(a.id) >= 0)
      .map(a => '<button class="chip' + (G.assuntos.indexOf(a.id) >= 0 ? ' on' : '') + '" data-v="' + a.id + '">' + esc(a.nome) + '</button>').join('');
    $('#gAssuntoCount').textContent = G.assuntos.length + ' de ' + visiveis.length;

    // fonte: só quando exatamente um assunto com fontes está selecionado
    const one = G.assuntos.length === 1 ? m.assuntos.find(x => x.id === G.assuntos[0]) : null;
    const oneFontes = fontesOf(one);
    if (one && oneFontes.length > 1) {
      const obrig = one.fonteObrigatoria || !!G.site;
      $('#gFonteWrap').hidden = false;
      $('#gFonteLabel').textContent = (m.rotuloFonte || 'Fonte') + (obrig ? '' : ' (opcional)');
      if (obrig && !oneFontes.some(f => f.id === G.fonte)) G.fonte = oneFontes[0].id;
      $('#gFonte').innerHTML = (obrig ? '' : '<option value="">Todas as fontes (intercaladas)</option>') +
        oneFontes.map(f => '<option value="' + f.id + '"' + (f.id === G.fonte ? ' selected' : '') + '>' + esc(f.nome) + '</option>').join('');
    } else {
      $('#gFonteWrap').hidden = true;
      G.fonte = '';
    }

    $('#gLayouts').innerHTML = m.layouts.map(l => '<button class="chip' + (G.layouts.indexOf(l.id) >= 0 ? ' on' : '') + '" data-v="' + l.id + '" title="' + esc(l.descricao || '') + '">' + esc(l.nome) + '</button>').join('');
    $('#gLayoutCount').textContent = G.layouts.length + ' de ' + m.layouts.length;

    $$('#gOrient .chip').forEach(b => b.classList.toggle('on', G.orient.indexOf(b.dataset.v) >= 0));
    $('#gTema').innerHTML = RS.THEMES.map(t =>
      '<button class="theme-opt' + (t.id === G.tema ? ' on' : '') + '" data-v="' + t.id + '"><i style="background:' + t.bg + '"><b style="background:' + t.accent + '"></b></i>' + esc(t.nome) + '</button>').join('');

    const n = combos().length;
    $('#gSummary').innerHTML = n ? 'Serão gerados <b>' + n + ' link' + (n > 1 ? 's' : '') + '</b> para <b>' + esc(c ? c.nome : '—') + '</b>' + (n > MAX_COMBOS ? ' <span class="warn">(máximo ' + MAX_COMBOS + ' por vez)</span>' : '') : 'Selecione ao menos um item em cada etapa.';
    $('#gGenerate').disabled = !n || n > MAX_COMBOS || !G.cliente;
    $('#gGenerate span').textContent = n > 1 ? 'Gerar ' + n + ' links' : 'Gerar link';
    schedulePreview();
  }

  function toggleIn(arr, v, keepOne) {
    const i = arr.indexOf(v);
    if (i >= 0) { if (!(keepOne && arr.length === 1)) arr.splice(i, 1); }
    else arr.push(v);
  }

  $('#gCliente').addEventListener('change', e => { G.cliente = e.target.value; renderGen(); });
  $('#gModulo').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b || b.dataset.v === G.modulo) return;
    G.modulo = b.dataset.v; resetForModule(); renderGen();
  });
  $('#gSite').addEventListener('change', e => {
    G.site = e.target.value;
    G.fonte = '';
    const ok = assuntosVisiveis().map(a => a.id);
    G.assuntos = G.assuntos.filter(id => ok.indexOf(id) >= 0);
    if (!G.assuntos.length && ok.length) G.assuntos = [ok[0]];
    renderGen();
  });
  $('#gAssuntoBusca').addEventListener('input', e => { G.busca = e.target.value; renderGen(); });
  $('#gAssuntos').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    toggleIn(G.assuntos, b.dataset.v, false); G.fonte = ''; renderGen();
  });
  $('#gFonte').addEventListener('change', e => { G.fonte = e.target.value; renderGen(); });
  $('#gLayouts').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    toggleIn(G.layouts, b.dataset.v, false); renderGen();
  });
  $('#gOrient').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    toggleIn(G.orient, b.dataset.v, true); renderGen();
  });
  $('#gTema').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    G.tema = b.dataset.v; renderGen();
  });
  $('#gTempo').addEventListener('change', e => {
    const v = Number(e.target.value);
    G.tempo = v >= 4 ? Math.min(120, Math.round(v)) : '';
    e.target.value = G.tempo; renderGen();
  });
  $('#gGirar').addEventListener('change', e => { G.girar = e.target.value; renderGen(); });

  $('#gGenerate').addEventListener('click', () => {
    const list = combos();
    if (!list.length || list.length > MAX_COMBOS) return;
    showResults(list.map(makeRecord));
  });

  function showResults(records) {
    results = records;
    const all = getLinks();
    saveLinks(records.concat(all));
    const nome = records[0].clienteNome;
    $('#results').hidden = false;
    $('#resTitle').textContent = records.length + ' link' + (records.length > 1 ? 's' : '') + ' gerado' + (records.length > 1 ? 's' : '') + ' para ' + nome;
    $('#resSub').textContent = 'Já salvos em "Meus links". Envie ao cliente com a mensagem padrão.';
    $('#resList').innerHTML = records.map(r => linkRow(r, { showModule: records.some(x => x.modulo !== records[0].modulo) })).join('');
    $('#resWhats').href = whatsappHref(records);
    toast(records.length + ' link' + (records.length > 1 ? 's' : '') + ' gerado' + (records.length > 1 ? 's' : ''));
    setTimeout(() => $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  $('#resList').addEventListener('click', e => {
    const b = e.target.closest('[data-act="copy"]'); if (!b) return;
    const r = results.find(x => x.id === b.closest('.link-row').dataset.id);
    if (r) copy(r.url, 'Link copiado');
  });
  $('#resCopyAll').addEventListener('click', () => copy(results.map(r => r.url).join('\n'), results.length + ' links copiados'));
  $('#resCopyMsg').addEventListener('click', () => copy(whatsappMessage(results), 'Mensagem copiada'));

  /* ---------- pré-visualização ---------- */
  let pvTimer;
  function schedulePreview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(updatePreview, 350);
  }
  function updatePreview() {
    const first = combos()[0];
    const frame = $('#pvFrame');
    if (!first || !first.cliente) { frame.removeAttribute('src'); $('#pvLabel').textContent = 'Selecione as opções para ver a tela.'; return; }
    const rec = makeRecord(first);
    const url = rec.url;
    $('#pvDevice').className = first.orientacao === 'vertical' ? 'device-totem' : 'device-tv';
    $('#pvLabel').textContent = recordTitle(rec) + ' · ' + rec.layoutNome + ' · ' + ORIENT_NAME[first.orientacao] + ' · ' + rec.temaNome + (combos().length > 1 ? ' (1ª combinação)' : '');
    $('#pvOpen').href = url + '&modo=teste';
    if (frame.dataset.url !== url) { frame.dataset.url = url; frame.src = url; }
  }

  /* =================== PACOTES =================== */
  const PK = { cliente: '', cidade: '', orient: ['horizontal'] };

  function renderPacks() {
    $('#pCliente').innerHTML = clientOptions(PK.cliente);
    const clima = modById('clima');
    if (clima && clima.status === 'ativo') {
      $('#pCidade').innerHTML = '<option value="">Padrão de cada pacote</option>' + clima.assuntos.map(a => '<option value="' + a.id + '"' + (a.id === PK.cidade ? ' selected' : '') + '>' + esc(a.nome) + '</option>').join('');
    } else {
      $('#pCidade').closest('.field').hidden = true;
    }
    $$('#pOrient .chip').forEach(b => b.classList.toggle('on', PK.orient.indexOf(b.dataset.v) >= 0));
    $('#packGrid').innerHTML = pacotes.map(p => {
      const telas = p.telas.filter(t => { const m = modById(t.modulo); return m && m.status === 'ativo'; });
      const n = telas.length * PK.orient.length;
      return '<article class="card pack">' +
        '<h3>' + esc(p.nome) + '</h3>' +
        '<p>' + esc(p.porque) + '</p>' +
        '<ul>' + telas.map(t => {
          const m = modById(t.modulo);
          const a = m.assuntos.find(x => x.id === (t.modulo === 'clima' && PK.cidade ? PK.cidade : t.assunto));
          const l = m.layouts.find(x => x.id === t.layout);
          return '<li>' + ICON(MOD_ICON(m)) + esc(a ? a.nome : t.assunto) + '<small>' + esc(l ? l.nome : t.layout) + '</small></li>';
        }).join('') + '</ul>' +
        '<button class="btn btn-dark" data-pack="' + p.id + '">' + ICON('sparkles') + 'Gerar ' + n + ' links</button>' +
      '</article>';
    }).join('');
  }

  $('#pCliente').addEventListener('change', e => { PK.cliente = e.target.value; });
  $('#pCidade').addEventListener('change', e => { PK.cidade = e.target.value; renderPacks(); });
  $('#pOrient').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    toggleIn(PK.orient, b.dataset.v, true); renderPacks();
  });
  $('#packGrid').addEventListener('click', e => {
    const b = e.target.closest('button[data-pack]'); if (!b) return;
    const p = pacotes.find(x => x.id === b.dataset.pack);
    if (!p || !PK.cliente) return;
    const recs = [];
    p.telas.forEach(t => {
      const m = modById(t.modulo);
      if (!m || m.status !== 'ativo') return;
      const assunto = t.modulo === 'clima' && PK.cidade ? PK.cidade : t.assunto;
      const a = m.assuntos.find(x => x.id === assunto);
      const fonte = a && a.fonteObrigatoria && a.fontes ? a.fontes[0].id : '';
      PK.orient.forEach(o => recs.push(makeRecord({ cliente: PK.cliente, modulo: m.id, assunto, fonte, layout: t.layout, orientacao: o, tema: p.tema || (m.padrao && m.padrao.tema) })));
    });
    if (!recs.length) return;
    location.hash = '#gerar';
    setTimeout(() => showResults(recs), 30);
  });

  /* =================== MEUS LINKS =================== */
  const LF = { cliente: '', busca: '' };

  function renderLinks() {
    $('#lCliente').innerHTML = '<option value="">Todos os clientes</option>' +
      clients.map(c => '<option value="' + c.chave + '"' + (c.chave === LF.cliente ? ' selected' : '') + '>' + esc(c.nome) + '</option>').join('');
    const q = RS.normalize(LF.busca);
    const list = getLinks().filter(r =>
      (!LF.cliente || r.cliente === LF.cliente) &&
      (!q || RS.normalize([r.clienteNome, r.moduloNome, r.assuntoNome, r.fonteNome, r.layoutNome, r.temaNome, r.orientacao].join(' ')).indexOf(q) >= 0));
    if (!list.length) {
      $('#lGroups').innerHTML = '<div class="empty">' + ICON('layers') + '<p>Nenhum link por aqui ainda.<br>Gere links na aba <a href="#gerar"><b>Gerar links</b></a> ou use um <a href="#pacotes"><b>pacote pronto</b></a>.</p></div>';
      return;
    }
    const groups = {};
    list.forEach(r => { (groups[r.cliente] = groups[r.cliente] || []).push(r); });
    $('#lGroups').innerHTML = Object.keys(groups).map(k => {
      const g = groups[k];
      const known = clients.find(c => c.chave === k);
      return '<div class="card group" data-client="' + esc(k) + '">' +
        '<div class="group-head">' +
          '<h3>' + esc(g[0].clienteNome) + ' <span>' + g.length + ' link' + (g.length > 1 ? 's' : '') + '</span>' + (known ? '' : ' <span class="badge">removido da config</span>') + '</h3>' +
          '<div class="results-actions">' +
            '<button class="btn btn-ghost btn-sm" data-gact="copy">' + ICON('copy') + 'Copiar links</button>' +
            '<button class="btn btn-ghost btn-sm" data-gact="msg">' + ICON('copy') + 'Copiar mensagem</button>' +
            '<a class="btn btn-primary btn-sm" target="_blank" rel="noopener" href="' + esc(whatsappHref(g)) + '">' + ICON('whatsapp') + 'WhatsApp</a>' +
          '</div>' +
        '</div>' +
        '<div class="link-list">' + g.map(r => linkRow(r, { removable: true, showModule: true })).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  $('#lCliente').addEventListener('change', e => { LF.cliente = e.target.value; renderLinks(); });
  $('#lBusca').addEventListener('input', e => { LF.busca = e.target.value; renderLinks(); });
  $('#lGroups').addEventListener('click', e => {
    const all = getLinks();
    const act = e.target.closest('[data-act]');
    if (act) {
      const id = act.closest('.link-row').dataset.id;
      const r = all.find(x => x.id === id);
      if (!r) return;
      if (act.dataset.act === 'copy') copy(r.url, 'Link copiado');
      if (act.dataset.act === 'del' && confirm('Remover este link do histórico?\n(A tela continua funcionando normalmente.)')) {
        saveLinks(all.filter(x => x.id !== id)); renderLinks(); toast('Removido do histórico');
      }
      return;
    }
    const gact = e.target.closest('[data-gact]');
    if (gact) {
      const k = gact.closest('.group').dataset.client;
      const q = RS.normalize(LF.busca);
      const g = all.filter(r => r.cliente === k && (!q || RS.normalize([r.moduloNome, r.assuntoNome, r.fonteNome, r.layoutNome, r.temaNome, r.orientacao].join(' ')).indexOf(q) >= 0));
      if (gact.dataset.gact === 'copy') copy(g.map(r => r.url).join('\n'), g.length + ' links copiados');
      if (gact.dataset.gact === 'msg') copy(whatsappMessage(g), 'Mensagem copiada');
    }
  });

  $('#lExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(getLinks(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rsscreen-links-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $('#lImport').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data)) throw new Error('formato');
      const cur = getLinks();
      const ids = new Set(cur.map(r => r.id));
      const add = data.filter(r => r && r.id && r.url && !ids.has(r.id));
      saveLinks(cur.concat(add).sort((a, b) => b.criado - a.criado));
      renderLinks();
      toast(add.length + ' links importados');
    } catch (_) { toast('Arquivo inválido', 'x'); }
    e.target.value = '';
  });

  /* =================== CLIENTES =================== */
  const fromDb = r => ({
    nome: r.nome, chave: r.chave, whatsapp: r.whatsapp || '', ativo: !!r.ativo, demo: !!r.demo,
    plano: r.plano || '', valor: Number(r.valor) || 0, telas: Number(r.telas) || 0, vencimento: Number(r.vencimento) || 0, obs: r.obs || ''
  });

  // Tenta o banco D1; sem ele (ou fora da Cloudflare) continua com o config/clientes.js
  async function loadClientsDb() {
    try {
      const r = await api('api/admin/clientes');
      dbMode = !!r.banco;
      if (dbMode) {
        const list = (r.clientes || []).map(fromDb);
        const fileList = RS.clients();
        if (!list.length && fileList.length) {
          showBanner('import', fileList.length);
          setClients(fileList);
        } else {
          setClients(list);
          const faltam = fileList.filter(f => !list.some(c => c.chave === f.chave));
          if (faltam.length) showBanner('faltam', faltam.length); else $('#dbBanner').hidden = true;
        }
      }
    } catch (e) {
      dbMode = false;
      showBanner('arquivo', e.message);
    }
    applyClientMode();
  }

  function showBanner(kind, info) {
    const b = $('#dbBanner');
    b.hidden = false;
    b.className = 'db-banner' + (kind === 'arquivo' ? ' muted' : '');
    if (kind === 'import') {
      b.innerHTML = '<div><b>Banco de dados pronto.</b> Importe os ' + info + ' clientes do arquivo <code>config/clientes.js</code> para cadastrar pelo painel. As chaves continuam as mesmas: nenhum link para.</div>' +
        '<button class="btn btn-primary btn-sm" data-import>' + ICON('upload') + ' Importar clientes</button>';
    } else if (kind === 'faltam') {
      b.innerHTML = '<div>' + info + ' cliente(s) do arquivo <code>config/clientes.js</code> ainda não estão no banco.</div>' +
        '<button class="btn btn-dark btn-sm" data-import>' + ICON('upload') + ' Importar os que faltam</button>';
    } else {
      b.innerHTML = '<div><b>Modo arquivo:</b> o banco de dados não respondeu (' + esc(info) + '). O cadastro continua pelo <code>config/clientes.js</code>. No site publicado na Cloudflare o banco é criado sozinho no deploy.</div>';
    }
  }

  $('#dbBanner').addEventListener('click', async e => {
    if (!e.target.closest('[data-import]')) return;
    try {
      const list = RS.clients().map(c => {
        const pl = c.demo ? 'cortesia' : ((PLANOS[0] && PLANOS[0].id) || '');
        return { chave: c.chave, nome: c.nome, whatsapp: c.whatsapp, ativo: c.ativo, demo: c.demo, plano: pl, telas: 1, valor: c.demo ? 0 : ((planoById(pl) || {}).valor || 0) };
      });
      const r = await api('api/admin/clientes/importar', { method: 'POST', headers: { 'X-Admin-Senha': adminSenha(), 'Content-Type': 'application/json' }, body: JSON.stringify({ clientes: list }) });
      toast(r.importados + ' clientes importados');
      await loadClientsDb();
      refreshClientViews();
    } catch (err) { toast(err.message, 'x'); }
  });

  function applyClientMode() {
    $('#dbForm').hidden = !dbMode;
    $('#fileClientCard').hidden = dbMode;
    $('#cIntro').innerHTML = dbMode
      ? 'Clientes salvos no banco de dados da Cloudflare (D1). Cadastrar, editar ou suspender vale em até 1 minuto, sem commit.'
      : 'Clientes cadastrados em <code>config/clientes.js</code>. A chave de cada um é gerada automaticamente a partir do nome.';
  }

  function refreshClientViews() {
    if (!clients.some(c => c.chave === G.cliente && c.ativo)) {
      const first = activeClients.find(c => !c.demo) || activeClients[0];
      G.cliente = first ? first.chave : '';
    }
    renderClients();
    renderGen();
    renderPacks();
  }

  function renderClients() {
    const counts = {};
    getLinks().forEach(r => { counts[r.cliente] = (counts[r.cliente] || 0) + 1; });
    $('#cCount').textContent = clients.length + ' cliente' + (clients.length !== 1 ? 's' : '') + ' · ' + activeClients.length + ' ativo' + (activeClients.length !== 1 ? 's' : '');
    if (dbMode) {
      const pagantes = activeClients.filter(c => !c.demo);
      const mrr = pagantes.reduce((t, c) => t + c.valor, 0);
      const telas = pagantes.reduce((t, c) => t + c.telas, 0);
      $('#cKpis').hidden = false;
      $('#cKpis').innerHTML =
        '<div class="card kpi"><span>Clientes ativos</span><b>' + pagantes.length + '</b><small>' + (clients.length - activeClients.length) + ' suspenso(s)</small></div>' +
        '<div class="card kpi"><span>Telas contratadas</span><b>' + telas + '</b><small>soma dos clientes ativos</small></div>' +
        '<div class="card kpi"><span>Faturamento mensal</span><b>' + money(mrr) + '</b><small>previsto pelos valores cadastrados</small></div>' +
        '<div class="card kpi"><span>Ticket médio</span><b>' + money(pagantes.length ? mrr / pagantes.length : 0) + '</b><small>por cliente</small></div>';
    } else {
      $('#cKpis').hidden = true;
    }
    $('#cTable').innerHTML = '<thead><tr><th>Cliente</th><th>Chave</th>' + (dbMode ? '<th>Plano</th><th>Mensal</th>' : '') + '<th>Status</th><th>Links</th><th></th></tr></thead><tbody>' +
      clients.map(c => '<tr>' +
        '<td><b>' + esc(c.nome) + '</b>' + (c.whatsapp ? '<br><small style="color:var(--muted)">' + esc(c.whatsapp) + '</small>' : '') + '</td>' +
        '<td><span class="mono">' + esc(c.chave) + '</span></td>' +
        (dbMode
          ? '<td><small>' + esc((planoById(c.plano) || {}).nome || c.plano || '—') + (c.telas ? ' · ' + c.telas + ' tela' + (c.telas > 1 ? 's' : '') : '') + '</small></td>' +
            '<td><small>' + (c.valor ? money(c.valor) : '—') + (c.vencimento ? '<br>dia ' + c.vencimento : '') + '</small></td>'
          : '') +
        '<td>' + (!c.ativo ? '<span class="badge">Suspenso</span>' : c.demo ? '<span class="badge badge-brand">Demonstração</span>' : '<span class="badge badge-ok">Ativo</span>') + '</td>' +
        '<td>' + (counts[c.chave] || 0) + '</td>' +
        '<td><div class="acts">' +
          (dbMode ? '<button class="btn btn-ghost btn-sm" data-edit="' + esc(c.chave) + '">Editar</button>' : '') +
          '<button class="btn btn-ghost btn-sm btn-icon" data-copy="' + esc(c.chave) + '" title="Copiar chave">' + ICON('copy') + '</button>' +
          (c.ativo ? '<button class="btn btn-dark btn-sm" data-gen="' + esc(c.chave) + '">' + ICON('link') + 'Gerar</button>' : '') +
        '</div></td>' +
      '</tr>').join('') + '</tbody>';
  }

  $('#cTable').addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) return copy(cp.dataset.copy, 'Chave copiada');
    const g = e.target.closest('[data-gen]');
    if (g) { G.cliente = g.dataset.gen; renderGen(); location.hash = '#gerar'; return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) editClient(ed.dataset.edit);
  });

  /* ----- formulário do banco ----- */
  let editing = null;   // chave em edição (null = cliente novo)

  function fillPlanos(sel) {
    $('#dbPlano').innerHTML = PLANOS.map(p => '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc(p.nome) + (p.valor ? ' · ' + money(p.valor) + '/tela' : '') + '</option>').join('') +
      (sel && !planoById(sel) ? '<option value="' + esc(sel) + '" selected>' + esc(sel) + '</option>' : '');
  }

  function planoHint() {
    const p = planoById($('#dbPlano').value);
    const n = Number($('#dbTelas').value) || 0;
    $('#dbPlanoInfo').textContent = p ? p.descricao + (p.valor ? ' Sugestão: ' + money(p.valor) + ' × ' + n + ' tela(s) = ' + money(p.valor * n) + '/mês.' : '') : '';
  }

  function suggestValor() {
    const p = planoById($('#dbPlano').value);
    if (p) $('#dbValor').value = (p.valor * (Number($('#dbTelas').value) || 0)).toFixed(2);
    planoHint();
  }

  function resetForm() {
    editing = null;
    $('#dbForm').reset();
    fillPlanos((PLANOS[0] || {}).id);
    $('#dbTelas').value = 1;
    $('#dbAtivo').checked = true;
    suggestValor();
    $('#dbKey').textContent = '—';
    $('#dbFormTitle').textContent = 'Cadastrar cliente';
    $('#dbFormSub').textContent = 'Salvo no banco de dados: vale na hora, sem commit.';
    $('#dbDelete').hidden = true;
    $('#dbNew').hidden = true;
  }

  function editClient(chave) {
    const c = clients.find(x => x.chave === chave);
    if (!c) return;
    editing = chave;
    $('#dbNome').value = c.nome;
    $('#dbWhats').value = c.whatsapp;
    fillPlanos(c.plano);
    $('#dbTelas').value = c.telas;
    $('#dbValor').value = c.valor ? c.valor.toFixed(2) : '';
    $('#dbVenc').value = c.vencimento || '';
    $('#dbObs').value = c.obs;
    $('#dbAtivo').checked = c.ativo;
    $('#dbKey').textContent = c.chave;
    $('#dbFormTitle').textContent = 'Editar cliente';
    $('#dbFormSub').textContent = 'A chave não muda ao trocar o nome: os links continuam valendo.';
    $('#dbDelete').hidden = !!c.demo;
    $('#dbNew').hidden = false;
    planoHint();
    $('#dbForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('#dbNome').addEventListener('input', () => {
    if (editing) return;
    const n = $('#dbNome').value.trim();
    const k = n ? RS.clientKey(n) : '';
    $('#dbKey').textContent = k ? k + (clients.some(c => c.chave === k) ? '  ⚠ já cadastrado' : '') : '—';
  });
  $('#dbPlano').addEventListener('change', suggestValor);
  $('#dbTelas').addEventListener('input', suggestValor);
  $('#dbNew').addEventListener('click', resetForm);

  $('#dbForm').addEventListener('submit', async e => {
    e.preventDefault();
    const nome = $('#dbNome').value.trim();
    if (!nome) return;
    const cur = editing ? clients.find(x => x.chave === editing) : null;
    const body = {
      novo: !editing,
      chave: editing || RS.clientKey(nome),
      nome,
      whatsapp: $('#dbWhats').value,
      plano: $('#dbPlano').value,
      telas: $('#dbTelas').value,
      valor: $('#dbValor').value,
      vencimento: $('#dbVenc').value,
      obs: $('#dbObs').value,
      ativo: $('#dbAtivo').checked,
      demo: cur ? cur.demo : false
    };
    $('#dbSave').disabled = true;
    try {
      await api('api/admin/clientes', { method: 'POST', headers: { 'X-Admin-Senha': adminSenha(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast(editing ? 'Cliente atualizado' : 'Cliente cadastrado: ' + body.chave);
      await loadClientsDb();
      refreshClientViews();
      resetForm();
    } catch (err) { toast(err.message, 'x'); }
    $('#dbSave').disabled = false;
  });

  $('#dbDelete').addEventListener('click', async () => {
    if (!editing) return;
    const c = clients.find(x => x.chave === editing);
    if (!confirm('Excluir "' + (c ? c.nome : editing) + '"? As telas dele param de abrir. Para pausar sem perder o cadastro, desmarque "Cliente ativo".')) return;
    try {
      await api('api/admin/clientes?chave=' + encodeURIComponent(editing), { method: 'DELETE' });
      toast('Cliente excluído');
      await loadClientsDb();
      refreshClientViews();
      resetForm();
    } catch (err) { toast(err.message, 'x'); }
  });

  function updateNewClient() {
    const nome = $('#ncNome').value.trim();
    const whats = $('#ncWhats').value.replace(/\D/g, '');
    if (!nome) { $('#ncOut').hidden = true; return; }
    const key = RS.clientKey(nome);
    const dup = clients.some(c => c.chave === key);
    $('#ncOut').hidden = false;
    $('#ncKey').textContent = key + (dup ? '  ⚠ já cadastrado' : '');
    $('#ncLine').textContent = "{ nome: '" + nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "', whatsapp: '" + whats + "' },";
  }
  $('#ncNome').addEventListener('input', updateNewClient);
  $('#ncWhats').addEventListener('input', updateNewClient);
  $('#ncCopy').addEventListener('click', () => copy($('#ncLine').textContent, 'Linha copiada — cole em config/clientes.js'));

  $('#pwNova').addEventListener('input', async () => {
    const v = $('#pwNova').value;
    if (v.length < 8) { $('#pwOut').hidden = true; return; }
    try {
      const h = await RS.passwordHash(v);
      if ($('#pwNova').value !== v) return;
      $('#pwLine').textContent = "senhaHash: '" + h + "'";
      $('#pwOut').hidden = false;
    } catch (_) { $('#pwOut').hidden = true; }
  });
  $('#pwCopy').addEventListener('click', () => copy($('#pwLine').textContent, 'Linha copiada — cole em config/clientes.js'));

  /* =================== MODELOS =================== */
  const MD = { modulo: 'rss', orient: 'horizontal', tema: '' };

  function renderModels() {
    const m = modById(MD.modulo) || active[0];
    if (!MD.tema) MD.tema = (m.padrao && m.padrao.tema) || 'noite';
    $('#mModulo').innerHTML = active.map(x => '<button data-v="' + x.id + '" class="' + (x.id === m.id ? 'on' : '') + '">' + ICON(MOD_ICON(x)) + esc(x.nome) + '</button>').join('');
    $$('#mOrient .chip').forEach(b => b.classList.toggle('on', b.dataset.v === MD.orient));
    $('#mTema').innerHTML = RS.THEMES.map(t => '<option value="' + t.id + '"' + (t.id === MD.tema ? ' selected' : '') + '>' + esc(t.nome) + '</option>').join('');
    const cli = RS.demoClient() || activeClients[0];
    const grid = $('#modelGrid');
    grid.classList.toggle('vert', MD.orient === 'vertical');
    if (!cli) { grid.innerHTML = '<div class="empty">Cadastre um cliente para ver os modelos.</div>'; return; }
    const p = m.padrao || {};
    grid.innerHTML = m.layouts.map(l => {
      const url = RS.buildScreenUrl({ cliente: cli.chave, modulo: m.id, assunto: p.assunto, layout: l.id, orientacao: MD.orient, tema: MD.tema, tempo: 8 });
      return '<div class="card model">' +
        '<div class="' + (MD.orient === 'vertical' ? 'device-totem' : 'device-tv') + '"><div class="screen"><iframe loading="lazy" src="' + esc(url) + '" title="' + esc(l.nome) + '"></iframe></div></div>' +
        '<div class="model-foot"><div><h3>' + esc(l.nome) + '</h3><p>' + esc(l.descricao || '') + '</p></div>' +
        '<button class="btn btn-dark btn-sm" data-use="' + l.id + '">Usar</button></div>' +
      '</div>';
    }).join('');
  }

  $('#mModulo').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    MD.modulo = b.dataset.v; MD.tema = ''; renderModels();
  });
  $('#mOrient').addEventListener('click', e => {
    const b = e.target.closest('button[data-v]'); if (!b) return;
    MD.orient = b.dataset.v; renderModels();
  });
  $('#mTema').addEventListener('change', e => { MD.tema = e.target.value; renderModels(); });
  $('#modelGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-use]'); if (!b) return;
    if (G.modulo !== MD.modulo) { G.modulo = MD.modulo; resetForModule(); }
    G.layouts = [b.dataset.use];
    G.orient = [MD.orient];
    G.tema = MD.tema;
    renderGen();
    location.hash = '#gerar';
  });

  /* =================== MÓDULOS =================== */
  function renderModulesView() {
    $('#modGrid').innerHTML = modules.map(m => {
      const soon = m.status !== 'ativo';
      return '<div class="card mod' + (soon ? ' soon' : '') + '">' +
        '<div class="mod-top"><div class="mod-ico">' + ICON(MOD_ICON(m)) + '</div>' + (soon ? '<span class="badge">Em breve</span>' : '<span class="badge badge-ok">Ativo</span>') + '</div>' +
        '<h3>' + esc(m.nome) + '</h3>' +
        '<p>' + esc(m.chamada || '') + '</p>' +
        '<div class="mod-meta">' +
          (m.assuntos ? '<span>' + m.assuntos.length + ' ' + esc((m.rotuloAssunto || 'assunto').toLowerCase()) + 's</span>' : '') +
          (m.layouts ? '<span>' + m.layouts.length + ' modelos</span>' : '') +
          '<code>modules/' + esc(m.id) + '/</code>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* =================== PWA: instalar =================== */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvt = e;
    $('#installBtn').hidden = false;
  });
  $('#installBtn').addEventListener('click', async () => {
    if (!installEvt) return;
    installEvt.prompt();
    await installEvt.userChoice;
    installEvt = null;
    $('#installBtn').hidden = true;
  });

  /* =================== ANÚNCIOS =================== */
  const AD_MODELOS = [
    { id: 'oferta', nome: 'Oferta / produto', icon: 'tag', foto: true },
    { id: 'servico', nome: 'Empresa / serviço', icon: 'sparkles', foto: true },
    { id: 'aviso', nome: 'Aviso / chamada', icon: 'zap', foto: false },
    { id: 'evento', nome: 'Evento / data', icon: 'clock', foto: true },
    { id: 'imagem', nome: 'Arte pronta', icon: 'eye', foto: true },
    { id: 'video', nome: 'Vídeo (link)', icon: 'play', foto: false }
  ];
  const F = {
    titulo: ['Título', 'text'], subtitulo: ['Descrição curta', 'text'], texto: ['Texto', 'textarea'],
    preco: ['Preço (por)', 'text', 'Ex.: 39,90'], precoDe: ['Preço antigo (de), opcional', 'text', 'Ex.: 49,90'],
    selo: ['Selo / etiqueta', 'text', 'Ex.: OFERTA'], cta: ['Chamada', 'text', 'Ex.: Só esta semana!'],
    itens: ['Itens (um por linha)', 'textarea', 'Ex.:\nCorte masculino\nBarba\nSobrancelha'],
    whatsapp: ['WhatsApp', 'text', 'Ex.: (22) 99999-0000'], instagram: ['Instagram', 'text', '@perfil'], endereco: ['Endereço', 'text', 'Ex.: Rua das Flores, 120'],
    data: ['Data', 'date'], hora: ['Horário', 'text', 'Ex.: 20h'], local: ['Local', 'text'],
    video: ['Link do vídeo MP4 (https)', 'text', 'https://…/video.mp4']
  };
  const AD_CAMPOS = {
    oferta: [['titulo', 'Produto', 'Ex.: Picanha Bovina kg'], 'subtitulo', 'preco', 'precoDe', 'selo', 'cta', ['texto', 'Observação pequena', 'Ex.: Enquanto durar o estoque'], 'whatsapp', 'instagram', 'endereco'],
    servico: [['titulo', 'Nome da empresa', 'Ex.: Barbearia Estilo'], ['subtitulo', 'Slogan'], 'itens', 'cta', 'selo', 'whatsapp', 'instagram', 'endereco'],
    aviso: [['selo', 'Etiqueta', 'Ex.: AVISO'], ['titulo', 'Título', 'Ex.: Novo horário de funcionamento'], 'texto', 'cta', 'whatsapp', 'instagram', 'endereco'],
    evento: [['titulo', 'Nome do evento'], 'data', 'hora', 'local', ['texto', 'Descrição'], 'selo', 'cta', 'whatsapp', 'instagram'],
    imagem: [],
    video: ['video']
  };
  const AD_CORES = ['#E11D48', '#F97316', '#EAB308', '#16A34A', '#0EA5E9', '#2563EB', '#7C3AED', '#DB2777', '#111827'];
  const AD = { cliente: '', list: [], editing: null, modelo: 'oferta', cor: '', midia: '', img: null, imgUrl: '', orient: 'horizontal', ready: false };
  let adTimer;

  const adModelo = id => AD_MODELOS.find(m => m.id === id) || AD_MODELOS[0];
  const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  function adStatus(a) {
    const h = hojeBR();
    if (!a.ativo) return ['Pausado', ''];
    if (a.inicio && a.inicio > h) return ['Agendado', 'badge-brand'];
    if (a.fim && a.fim < h) return ['Encerrado', ''];
    return ['No ar', 'badge-ok'];
  }

  function adScreenUrl(orient) {
    return RS.buildScreenUrl({ cliente: AD.cliente, modulo: 'anuncios', assunto: 'todos', layout: 'padrao', orientacao: orient });
  }

  async function initAds() {
    $('#adNoDb').hidden = dbMode;
    $('#adsGrid').hidden = !dbMode;
    if (!dbMode) return;
    if (!AD.cliente || !activeClients.some(c => c.chave === AD.cliente)) {
      const first = activeClients.find(c => !c.demo) || activeClients[0];
      AD.cliente = first ? first.chave : '';
    }
    $('#adCliente').innerHTML = clientOptions(AD.cliente);
    $('#adModelos').innerHTML = AD_MODELOS.map(m => '<button type="button" class="ad-model" data-m="' + m.id + '">' + ICON(m.icon) + '<span>' + esc(m.nome) + '</span></button>').join('');
    $('#adCores').innerHTML = '<button type="button" class="ad-color auto" data-c="" title="Automática (cor do tema)">A</button>' +
      AD_CORES.map(c => '<button type="button" class="ad-color" data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>').join('');
    if (!AD.ready) { adReset(); AD.ready = true; }
    await loadAds();
    setPreviewSrc();
  }

  async function loadAds() {
    if (!AD.cliente) { AD.list = []; renderAdList(); return; }
    try { AD.list = (await api('api/admin/anuncios?cliente=' + encodeURIComponent(AD.cliente))).anuncios || []; }
    catch (e) { AD.list = []; toast(e.message, 'x'); }
    renderAdList();
  }

  function renderAdList() {
    const n = AD.list.length, noAr = AD.list.filter(a => adStatus(a)[0] === 'No ar').length;
    $('#adCount').textContent = n ? n + ' anúncio' + (n > 1 ? 's' : '') + ' · ' + noAr + ' no ar' : 'Nenhum anúncio ainda';
    $('#adList').innerHTML = n ? AD.list.map((a, k) => {
      const st = adStatus(a);
      const m = adModelo(a.modelo);
      const title = (a.dados && a.dados.titulo) || a.anunciante || m.nome;
      return '<div class="ad-item' + (AD.editing === a.id ? ' on' : '') + '">' +
        '<div class="ad-item-thumb">' + (a.midia ? '<img src="' + RS.ROOT_URL + 'api/midia/' + esc(a.midia) + '" alt="">' : ICON(m.icon)) + '</div>' +
        '<div class="ad-item-txt"><b>' + esc(title) + '</b><small>' + esc(m.nome) + (a.anunciante && a.anunciante !== title ? ' · ' + esc(a.anunciante) : '') + ' · ' + a.duracao + 's' +
          (a.fim ? ' · até ' + esc(a.fim.split('-').reverse().slice(0, 2).join('/')) : '') + '</small></div>' +
        '<span class="badge ' + st[1] + '">' + st[0] + '</span>' +
        '<div class="acts">' +
          '<button class="btn btn-ghost btn-sm btn-icon" data-up="' + k + '" title="Subir"' + (k === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn btn-ghost btn-sm btn-icon" data-down="' + k + '" title="Descer"' + (k === n - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn btn-ghost btn-sm" data-ed="' + esc(a.id) + '">Editar</button>' +
          '<button class="btn btn-ghost btn-sm" data-dup="' + esc(a.id) + '" title="Duplicar">' + ICON('copy') + '</button>' +
        '</div></div>';
    }).join('') : '<div class="empty">Crie o primeiro anúncio deste cliente no formulário ao lado.</div>';
    const c = clients.find(x => x.chave === AD.cliente);
    $('#adLink').innerHTML = AD.cliente ?
      '<div class="lbl">Link da tela de anúncios deste cliente</div>' +
      '<div class="ad-link-row"><code>' + esc(adScreenUrl('horizontal')) + '</code></div>' +
      '<div class="acts"><button class="btn btn-dark btn-sm" data-cplink="horizontal">' + ICON('copy') + ' Copiar horizontal</button>' +
      '<button class="btn btn-ghost btn-sm" data-cplink="vertical">' + ICON('copy') + ' Copiar vertical</button>' +
      (c && c.whatsapp ? '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="' + esc(RS.whatsappLink(c.whatsapp, 'Olá, ' + c.nome + '! Este é o link da tela de anúncios:\n\nHorizontal: ' + adScreenUrl('horizontal') + '\nVertical: ' + adScreenUrl('vertical'))) + '">' + ICON('whatsapp') + ' Enviar</a>' : '') +
      '</div>' : '';
  }

  function renderAdForm() {
    const m = adModelo(AD.modelo);
    $$('#adModelos .ad-model').forEach(b => b.classList.toggle('on', b.dataset.m === m.id));
    const cur = adDados;
    $('#adFields').innerHTML = (AD_CAMPOS[m.id] || []).map(spec => {
      const key = Array.isArray(spec) ? spec[0] : spec;
      const f = F[key];
      const label = Array.isArray(spec) && spec[1] ? spec[1] : f[0];
      const ph = Array.isArray(spec) && spec[2] ? spec[2] : (f[2] || '');
      const v = cur[key] || '';
      if (f[1] === 'textarea') return '<label class="field"><span>' + esc(label) + '</span><textarea class="input" rows="3" data-f="' + key + '" placeholder="' + esc(ph) + '">' + esc(v) + '</textarea></label>';
      return '<label class="field"><span>' + esc(label) + '</span><input class="input" type="' + (f[1] === 'date' ? 'date' : 'text') + '" data-f="' + key + '" value="' + esc(v) + '" placeholder="' + esc(ph) + '" /></label>';
    }).join('');
    $('#adFotoWrap').hidden = !m.foto;
    $('#adFotoLabel').textContent = m.id === 'imagem' ? 'Arte (imagem pronta, ex.: feita no Canva)' : m.id === 'evento' ? 'Foto de fundo' : 'Foto';
    $('#adFotoHint').textContent = m.id === 'imagem' ? 'Ideal: 1920×1080 (horizontal) ou 1080×1920 (vertical). A imagem é otimizada automaticamente.' : 'JPG, PNG ou WebP. A imagem é reduzida e otimizada automaticamente.';
    $('#adAjusteWrap').hidden = !(m.id === 'imagem' || m.id === 'video');
    $('#adCorWrap').hidden = m.id === 'imagem' || m.id === 'video';
    $$('#adCores .ad-color').forEach(b => b.classList.toggle('on', b.dataset.c === AD.cor));
    renderThumb();
  }

  // valores digitados (mantidos ao trocar de modelo)
  let adDados = {};
  function adCurrentDados() {
    $$('#adFields [data-f]').forEach(el => { adDados[el.dataset.f] = el.value; });
    return adDados;
  }

  function renderThumb() {
    const u = AD.imgUrl || (AD.midia ? RS.ROOT_URL + 'api/midia/' + AD.midia : '');
    $('#adThumb').innerHTML = u ? '<img src="' + esc(u) + '" alt="">' : ICON('upload');
    $('#adFotoDel').hidden = !u;
  }

  function adPayload(forPreview) {
    const dados = {};
    const keys = AD_CAMPOS[AD.modelo] || [];
    const cur = adCurrentDados();
    keys.forEach(spec => { const k = Array.isArray(spec) ? spec[0] : spec; if (cur[k]) dados[k] = cur[k]; });
    if (AD.cor) dados.cor = AD.cor;
    if (AD.modelo === 'imagem' || AD.modelo === 'video') dados.ajuste = $('#adAjuste').value;
    if (forPreview && AD.imgUrl) dados.imagemUrl = AD.imgUrl;
    return {
      id: AD.editing || undefined, cliente: AD.cliente, modelo: AD.modelo, anunciante: $('#adAnunciante').value.trim(),
      dados, midia: adModelo(AD.modelo).foto ? AD.midia : '', duracao: Number($('#adDuracao').value) || 10,
      inicio: $('#adInicio').value, fim: $('#adFim').value, ativo: $('#adAtivo').checked
    };
  }

  function adReset() {
    AD.editing = null; AD.modelo = 'oferta'; AD.cor = ''; AD.midia = ''; AD.img = null;
    if (AD.imgUrl) URL.revokeObjectURL(AD.imgUrl);
    AD.imgUrl = ''; adDados = {};
    $('#adForm').reset();
    $('#adDuracao').value = 10;
    $('#adAtivo').checked = true;
    $('#adFormTitle').textContent = 'Novo anúncio';
    $('#adDelete').hidden = true;
    renderAdForm();
    schedulePreviewAd();
  }

  function adEdit(id, dup) {
    const a = AD.list.find(x => x.id === id);
    if (!a) return;
    AD.editing = dup ? null : a.id;
    AD.modelo = a.modelo; AD.cor = (a.dados && a.dados.cor) || ''; AD.midia = a.midia || '';
    AD.img = null; if (AD.imgUrl) URL.revokeObjectURL(AD.imgUrl); AD.imgUrl = '';
    adDados = Object.assign({}, a.dados || {});
    $('#adAnunciante').value = a.anunciante || '';
    $('#adDuracao').value = a.duracao || 10;
    $('#adInicio').value = dup ? '' : (a.inicio || '');
    $('#adFim').value = dup ? '' : (a.fim || '');
    $('#adAtivo').checked = dup ? true : a.ativo;
    $('#adAjuste').value = (a.dados && a.dados.ajuste) || 'cobrir';
    $('#adFormTitle').textContent = dup ? 'Novo anúncio (cópia)' : 'Editar anúncio';
    $('#adDelete').hidden = !!dup;
    renderAdForm();
    renderAdList();
    schedulePreviewAd();
    if (window.innerWidth < 1000) $('#adForm').scrollIntoView({ behavior: 'smooth' });
  }

  // reduz a imagem no navegador (máx. 1920 px, WebP ou JPEG) antes de enviar
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const max = 1920;
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const tryType = (type, q) => new Promise(r => cv.toBlob(b => r(b), type, q));
        (async () => {
          let b = await tryType('image/webp', 0.82);
          if (!b || b.type !== 'image/webp') b = await tryType('image/jpeg', 0.84);
          if (b && b.size > 1400000) b = await tryType('image/jpeg', 0.68);
          if (!b) return reject(new Error('Não foi possível processar a imagem'));
          resolve(b);
        })();
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem inválido')); };
      img.src = url;
    });
  }

  /* ----- prévia ----- */
  function setPreviewSrc() {
    const fr = $('#adPreview');
    $('#adDevice').className = AD.orient === 'vertical' ? 'device-totem' : 'device-tv';
    if (!AD.cliente) { fr.removeAttribute('src'); return; }
    const url = adScreenUrl(AD.orient) + '&previa=1';
    if (fr.dataset.url !== url) { fr.dataset.url = url; fr.src = url; }
  }
  function sendPreview() {
    const fr = $('#adPreview');
    if (!fr.contentWindow) return;
    try { fr.contentWindow.postMessage({ rs: 'previa', anuncios: [adPayload(true)] }, location.origin); } catch (_) {}
  }
  function schedulePreviewAd() { clearTimeout(adTimer); adTimer = setTimeout(sendPreview, 250); }
  window.addEventListener('message', e => {
    if (e.origin === location.origin && e.data && e.data.rs === 'previa-pronta') sendPreview();
  });

  /* ----- eventos ----- */
  $('#adCliente').addEventListener('change', async e => { AD.cliente = e.target.value; adReset(); await loadAds(); setPreviewSrc(); });
  $('#adNew').addEventListener('click', () => { adReset(); renderAdList(); });
  $('#adCancel').addEventListener('click', () => { adReset(); renderAdList(); });
  $('#adModelos').addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    adCurrentDados();
    AD.modelo = b.dataset.m;
    renderAdForm();
    schedulePreviewAd();
  });
  $('#adCores').addEventListener('click', e => {
    const b = e.target.closest('[data-c]');
    if (!b) return;
    AD.cor = b.dataset.c;
    $$('#adCores .ad-color').forEach(x => x.classList.toggle('on', x === b));
    schedulePreviewAd();
  });
  $('#adForm').addEventListener('input', schedulePreviewAd);
  $('#adForm').addEventListener('change', schedulePreviewAd);
  $('#adOrient').addEventListener('click', e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    AD.orient = b.dataset.v;
    $$('#adOrient .chip').forEach(x => x.classList.toggle('on', x === b));
    setPreviewSrc();
  });
  $('#adFoto').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const blob = await shrinkImage(file);
      AD.img = blob;
      if (AD.imgUrl) URL.revokeObjectURL(AD.imgUrl);
      AD.imgUrl = URL.createObjectURL(blob);
      renderThumb();
      schedulePreviewAd();
      toast('Imagem pronta (' + Math.round(blob.size / 1024) + ' KB)');
    } catch (err) { toast(err.message, 'x'); }
  });
  $('#adFotoDel').addEventListener('click', () => {
    AD.img = null; AD.midia = '';
    if (AD.imgUrl) URL.revokeObjectURL(AD.imgUrl);
    AD.imgUrl = '';
    renderThumb();
    schedulePreviewAd();
  });

  $('#adForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!AD.cliente) return toast('Escolha um cliente', 'x');
    const m = adModelo(AD.modelo);
    if (m.id === 'imagem' && !AD.img && !AD.midia) return toast('Escolha a imagem da arte', 'x');
    if (m.id === 'video' && !/^https:\/\//i.test(adCurrentDados().video || '')) return toast('Informe o link https do vídeo MP4', 'x');
    if (m.id !== 'imagem' && m.id !== 'video' && !(adCurrentDados().titulo || '').trim()) return toast('Preencha o título do anúncio', 'x');
    $('#adSave').disabled = true;
    try {
      if (m.foto && AD.img) {
        const res = await fetch(RS.ROOT_URL + 'api/admin/midia?cliente=' + encodeURIComponent(AD.cliente), {
          method: 'POST', headers: { 'X-Admin-Senha': adminSenha(), 'Content-Type': AD.img.type }, body: AD.img
        });
        const r = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(r.erro || 'Falha ao enviar a imagem');
        AD.midia = r.id; AD.img = null;
        if (AD.imgUrl) URL.revokeObjectURL(AD.imgUrl);
        AD.imgUrl = '';
      }
      const body = adPayload(false);
      const r = await api('api/admin/anuncios', { method: 'POST', headers: { 'X-Admin-Senha': adminSenha(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      toast(AD.editing ? 'Anúncio atualizado' : 'Anúncio criado');
      AD.editing = r.id;
      await loadAds();
      adEdit(r.id);
    } catch (err) { toast(err.message, 'x'); }
    $('#adSave').disabled = false;
  });

  $('#adDelete').addEventListener('click', async () => {
    if (!AD.editing || !confirm('Excluir este anúncio?')) return;
    try {
      await api('api/admin/anuncios?id=' + encodeURIComponent(AD.editing) + '&cliente=' + encodeURIComponent(AD.cliente), { method: 'DELETE' });
      toast('Anúncio excluído');
      adReset();
      await loadAds();
    } catch (err) { toast(err.message, 'x'); }
  });

  $('#adList').addEventListener('click', async e => {
    const ed = e.target.closest('[data-ed]'); if (ed) return adEdit(ed.dataset.ed);
    const dp = e.target.closest('[data-dup]'); if (dp) return adEdit(dp.dataset.dup, true);
    const up = e.target.closest('[data-up]'), dn = e.target.closest('[data-down]');
    if (up || dn) {
      const k = Number((up || dn).dataset[up ? 'up' : 'down']);
      const j = up ? k - 1 : k + 1;
      const l = AD.list.slice();
      [l[k], l[j]] = [l[j], l[k]];
      AD.list = l;
      renderAdList();
      try { await api('api/admin/anuncios/ordem', { method: 'POST', headers: { 'X-Admin-Senha': adminSenha(), 'Content-Type': 'application/json' }, body: JSON.stringify({ cliente: AD.cliente, ids: l.map(a => a.id) }) }); }
      catch (err) { toast(err.message, 'x'); }
    }
  });
  $('#adLink').addEventListener('click', e => {
    const b = e.target.closest('[data-cplink]');
    if (b) copy(adScreenUrl(b.dataset.cplink), 'Link copiado');
  });

  /* =================== GUIA DE VENDAS =================== */
  const PLANO_INCLUI = {
    essencial: ['Notícias: 25 assuntos e mais de 90 sites', 'Previsão do tempo', 'Cotações (dólar, euro, cripto)', 'Todos os modelos, horizontal e vertical', 'Até 3 links por tela'],
    completo: ['Tudo do Essencial', 'Resultados e estatísticas de loterias', 'Tela de anúncios dos anunciantes', 'Módulos novos sem custo extra', 'Links e trocas ilimitadas', 'Suporte prioritário no WhatsApp'],
    rede: ['Tudo do Completo', 'Preço por tela a partir de 10 telas', 'Pacotes prontos por segmento', 'Ideal para operadores de mídia indoor'],
    gerenciado: ['Tudo do Completo', 'Você cria os anúncios do estabelecimento', 'Você configura o player do cliente', 'Você monta a programação da TV', 'Ajustes mensais inclusos'],
    cortesia: ['Acesso completo temporário', 'Para teste de 7 dias, permuta ou demonstração']
  };
  const DESTAQUE = 'completo';

  function renderGuia() {
    $('#guiaPlanos').innerHTML = PLANOS.map(p =>
      '<div class="card plan' + (p.id === DESTAQUE ? ' plan-top' : '') + '">' +
        (p.id === DESTAQUE ? '<span class="badge badge-dark">Mais vendido</span>' : '') +
        '<h4>' + esc(p.nome) + '</h4>' +
        '<div class="plan-price">' + (p.valor ? money(p.valor) + '<small>/tela/mês</small>' : 'Grátis') + '</div>' +
        '<p>' + esc(p.descricao || '') + '</p>' +
        '<ul>' + (PLANO_INCLUI[p.id] || []).map(x => '<li>' + ICON('check') + esc(x) + '</li>').join('') + '</ul>' +
      '</div>').join('');
    const pagos = PLANOS.filter(p => p.valor > 0);
    $('#guiaExemplos').innerHTML = '<thead><tr><th>Plano</th><th>1 tela</th><th>3 telas</th><th>10 telas</th><th>Anual (1 tela)</th></tr></thead><tbody>' +
      pagos.map(p => '<tr><td><b>' + esc(p.nome) + '</b></td><td>' + money(p.valor) + '</td><td>' + money(p.valor * 3) + '</td><td>' + money(p.valor * 10) + '</td><td>' + money(p.valor * 10) + '</td></tr>').join('') + '</tbody>';
    $('#calcPlano').innerHTML = pagos.map(p => '<option value="' + esc(p.id) + '"' + (p.id === DESTAQUE ? ' selected' : '') + '>' + esc(p.nome) + ' · ' + money(p.valor) + '</option>').join('');
    calc();
    hydrateIcons($('#view-guia'));
  }

  function calc() {
    const telas = Math.max(1, Number($('#calcTelas').value) || 1);
    const anunc = Math.max(0, Number($('#calcAnunc').value) || 0);
    const preco = Math.max(0, Number($('#calcPreco').value) || 0);
    const p = planoById($('#calcPlano').value) || { valor: 0 };
    // o mesmo anunciante costuma aparecer em todas as telas da rede: receita = anunciantes × preço
    const receita = anunc * preco;
    const custo = p.valor * telas;
    $('#calcOut').innerHTML =
      '<div><span>Receita com anúncios</span><b>' + money(receita) + '</b></div>' +
      '<div><span>Conteúdo rsscreen (' + telas + ' tela' + (telas > 1 ? 's' : '') + ')</span><b>− ' + money(custo) + '</b></div>' +
      '<div class="calc-total"><span>Sobra para o cliente</span><b>' + money(receita - custo) + '/mês</b></div>' +
      '<div><span>O conteúdo custa</span><b>' + (receita ? (custo / receita * 100).toFixed(1).replace('.', ',') + '% da receita' : '—') + '</b></div>';
  }
  ['#calcTelas', '#calcAnunc', '#calcPreco', '#calcPlano'].forEach(s => $(s).addEventListener('input', calc));
  $('#view-guia').addEventListener('click', e => {
    const b = e.target.closest('[data-copymsg]');
    if (b) copy(b.parentNode.querySelector('p').textContent, 'Mensagem copiada');
  });

  /* =================== MONITORAMENTO =================== */
  let monData = null, monLoading = false;

  async function api(path, opts) {
    const res = await fetch(RS.ROOT_URL + path, Object.assign({ cache: 'no-store', headers: { 'X-Admin-Senha': adminSenha() } }, opts || {}));
    let body = null;
    try { body = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((body && body.erro) || ('Erro ' + res.status));
    return body;
  }

  const fmtN = n => Number(n || 0).toLocaleString('pt-BR');
  function ago(t) {
    if (!t) return '—';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'há ' + Math.round(s / 3600) + ' h';
    return 'há ' + Math.round(s / 86400) + ' d';
  }

  // estado do feed: considera o último uso real e o último teste manual
  function feedState(f) {
    const lastBad = Math.max(f.t_fail || 0, f.check_ok === 0 ? f.t_check || 0 : 0);
    const lastGood = Math.max(f.t_ok || 0, f.check_ok === 1 ? f.t_check || 0 : 0);
    if (!lastBad && !lastGood) return { k: 'idle', label: 'Sem uso', icon: 'clock' };
    if (lastGood >= lastBad) return { k: 'ok', label: 'Ativo', icon: 'check' };
    if (f.stale && lastGood) return { k: 'warn', label: 'Instável', icon: 'offline' };
    return { k: 'bad', label: 'Recusado', icon: 'x' };
  }

  function topList(title, rows, empty, fmtKey) {
    const max = rows.length ? rows[0].n : 1;
    return '<div class="card mon-top"><div class="card-head"><div><h3>' + esc(title) + '</h3></div></div>' +
      (rows.length ? '<ol>' + rows.map(r =>
        '<li><div class="mt-row"><span class="mt-key">' + (fmtKey ? fmtKey(r.key) : esc(r.key)) + '</span><b>' + fmtN(r.n) + '</b></div>' +
        '<i style="width:' + Math.max(2, Math.round(r.n / max * 100)) + '%"></i></li>').join('') + '</ol>'
      : '<p class="mon-empty">' + esc(empty || 'Sem dados no período.') + '</p>') + '</div>';
  }

  function clientName(key) {
    const c = clients.find(x => x.chave === key);
    return c ? esc(c.nome) + ' <small class="mono">' + esc(key) + '</small>' : esc(key) + ' <small class="mt-warn">chave desconhecida</small>';
  }
  function telaName(key) {
    const i = key.indexOf(' · ');
    if (i < 0) return esc(key);
    const parts = key.slice(i + 3).split('/');
    const c = clients.find(x => x.chave === key.slice(0, i));
    return '<b>' + esc(c ? c.nome : key.slice(0, i)) + '</b> <small>' + esc(parts.filter(p => p && p !== '-').join(' · ')) + '</small>';
  }

  function renderMonitor() {
    const d = monData;
    const body = $('#monBody');
    if (!d) return;
    const feeds = (d.cadastro || []).map(c => {
      const st = (d.feeds || []).find(f => f.url === c.url) || {};
      return Object.assign({}, c, st, { url: c.url, state: feedState(st) });
    });
    const order = { bad: 0, warn: 1, ok: 2, idle: 3 };
    feeds.sort((a, b) => order[a.state.k] - order[b.state.k] || (b.req || 0) - (a.req || 0));
    const bad = feeds.filter(f => f.state.k === 'bad').length;
    const warn = feeds.filter(f => f.state.k === 'warn').length;
    const okN = feeds.filter(f => f.state.k === 'ok').length;
    const tot = (d.porDia || []).reduce((s, x) => s + x.total, 0);
    const devs = d.dispositivos || [];

    // gráfico de barras: requisições por dia
    const days = [];
    for (let i = d.dias - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push((d.porDia || []).find(x => x.day === key) || { day: key, total: 0, rss: 0, og: 0, hit: 0 });
    }
    const maxDay = Math.max.apply(null, days.map(x => x.total).concat([1]));
    const chart = '<div class="mon-chart" role="img" aria-label="Requisições por dia">' + days.map(x =>
      '<div class="mc-col" tabindex="0"><div class="mc-tip"><b>' + x.day.split('-').reverse().slice(0, 2).join('/') + '</b>' + fmtN(x.total) + ' requisições<br>' +
        fmtN(x.hit) + ' sinais de tela · ' + fmtN(x.rss) + ' feeds · ' + fmtN(x.og) + ' fotos</div>' +
        '<div class="mc-bar" style="height:' + (x.total ? Math.max(3, x.total / maxDay * 100) : 0) + '%"></div>' +
        '<span>' + (d.dias <= 7 ? ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(x.day + 'T12:00:00').getDay()] : x.day.slice(8)) + '</span></div>').join('') + '</div>';

    body.innerHTML =
      '<div class="mon-kpis">' +
        '<div class="card kpi"><span>Telas ligadas agora</span><b>' + fmtN(d.ativosAgora) + '</b><small>sinal nos últimos 12 min</small></div>' +
        '<div class="card kpi"><span>Telas no período</span><b>' + fmtN(devs.length) + '</b><small>aparelhos diferentes</small></div>' +
        '<div class="card kpi"><span>Requisições</span><b>' + fmtN(tot) + '</b><small>' + (d.dias === 1 ? 'hoje' : 'últimos ' + d.dias + ' dias') + '</small></div>' +
        '<div class="card kpi' + (bad ? ' kpi-bad' : '') + '"><span>Feeds com problema</span><b>' + fmtN(bad + warn) + '</b><small>' + okN + ' ativos · ' + feeds.length + ' cadastrados</small></div>' +
      '</div>' +
      '<div id="monLot"></div>' +
      '<div class="card"><div class="card-head"><div><h3>Requisições por dia</h3><p>Sinais das telas (a cada 5 min), leituras de feed e buscas de foto.</p></div></div>' + chart + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Feeds RSS</h3><p>“Recusado” = o site bloqueou ou não respondeu na última tentativa. As telas usam a última cópia boa (até 7 dias) e, sem ela, os outros sites do assunto.</p></div>' +
        '<div class="mon-filter" id="monFeedFilter"><button class="chip on" data-f="">Todos</button><button class="chip" data-f="bad">Com problema</button><button class="chip" data-f="ok">Ativos</button><button class="chip" data-f="idle">Sem uso</button></div></div>' +
        '<div class="table-wrap mon-scroll"><table class="table mon-feeds"><thead><tr><th>Status</th><th>Site / feed</th><th>Assuntos</th><th>Último resultado</th><th>Leituras</th><th>Falhas</th><th>Último sucesso</th></tr></thead><tbody>' +
        feeds.map(f => '<tr data-st="' + f.state.k + '">' +
          '<td><span class="st st-' + f.state.k + '">' + ICON(f.state.icon) + f.state.label + '</span></td>' +
          '<td><b>' + esc(f.nome) + '</b><br><small class="mono mt-url">' + esc(f.url.replace(/^https?:\/\//, '')) + '</small></td>' +
          '<td><small>' + esc(f.assuntos.join(', ')) + '</small></td>' +
          '<td><small>' + (f.t_check && f.t_check >= (f.t_fail || 0) && f.t_check >= (f.t_ok || 0) ? 'Teste ' + ago(f.t_check) + ': ' + esc(f.check_msg || '') :
            f.t_fail && f.t_fail > (f.t_ok || 0) ? esc(f.err || 'falha') + ' · ' + ago(f.t_fail) :
            f.t_ok ? 'OK · ' + (f.ms ? f.ms + ' ms' : '') + ' · ' + ago(f.t_ok) : '—') + '</small></td>' +
          '<td>' + fmtN(f.req) + '</td><td>' + (f.fail ? '<b class="mt-warn">' + fmtN(f.fail) + '</b>' : '0') + '</td>' +
          '<td><small>' + ago(f.t_ok) + '</small></td></tr>').join('') +
        '</tbody></table></div></div>' +

      '<div class="mon-grid">' +
        topList('Telas mais usadas', d.telas || [], 'Nenhuma tela enviou sinal ainda.', telaName) +
        topList('Clientes', d.clientes || [], '', clientName) +
        topList('IPs que mais acessam', d.ips || [], '') +
        topList('Localização', d.paises || [], '') +
        topList('Tipo de player', d.players || [], '') +
        topList('Fotos não encontradas (por site)', d.ogVazio || [], 'Todas as fotos foram encontradas.') +
      '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Aparelhos</h3><p>Cada TV, player ou navegador que abriu um link no período. “Ligada” = enviou sinal nos últimos 12 minutos.</p></div></div>' +
        (devs.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Status</th><th>Cliente / tela</th><th>Local</th><th>Player</th><th>IP</th><th>Último sinal</th><th>Sinais</th></tr></thead><tbody>' +
        devs.map(v => {
          const on = Date.now() - v.last < 12 * 60000;
          return '<tr><td><span class="st ' + (on ? (v.ok ? 'st-ok' : 'st-warn') : 'st-idle') + '">' + ICON(on ? (v.ok ? 'check' : 'offline') : 'clock') + (on ? (v.ok ? 'Ligada' : 'Sem conteúdo') : 'Desligada') + '</span></td>' +
            '<td>' + telaName(v.cliente + ' · ' + v.tela) + '</td><td><small>' + esc(v.local || '—') + '</small></td>' +
            '<td><small title="' + esc(v.ua) + '">' + esc(v.player) + '</small></td><td><small class="mono">' + esc(v.ip) + '</small></td>' +
            '<td><small>' + ago(v.last) + '</small></td><td>' + fmtN(v.beats) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="mon-empty">Nenhuma tela abriu um link no período.</p>') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Erros recentes</h3><p>Últimas recusas de feeds registradas pelo servidor.</p></div>' +
        '<button class="btn btn-ghost btn-sm" id="monReset"><i data-icon="trash"></i> Zerar estatísticas</button></div>' +
        ((d.erros || []).length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Quando</th><th>Feed</th><th>Erro</th></tr></thead><tbody>' +
          d.erros.map(e => '<tr><td><small>' + ago(e.t) + '</small></td><td><small class="mono mt-url">' + esc(e.url.replace(/^https?:\/\//, '')) + '</small></td><td><small>' + esc(e.msg) + '</small></td></tr>').join('') +
          '</tbody></table></div>' : '<p class="mon-empty">Nenhum erro registrado.</p>') + '</div>' +
      '<p class="mon-foot">Atualizado ' + new Date(d.gerado).toLocaleTimeString('pt-BR') + '. Os IPs e aparelhos ficam guardados por 35 dias.</p>';
    hydrateIcons(body);
    renderLot();
  }

  /* ----- loterias: status e atualização manual ----- */
  let lotData = null;
  function renderLot() {
    const box = $('#monLot');
    if (!box) return;
    if (!lotData) { box.innerHTML = ''; return; }
    const d = lotData;
    box.innerHTML = '<div class="card"><div class="card-head"><div><h3>Loterias</h3><p>Fonte principal: <b>' + (d.fonte === 'apiloterias' ? 'apiloterias.com' : 'API da Caixa (grátis)') + '</b>' +
      (d.chave ? ' · reserva apiloterias: ' + d.usoMes + ' de ' + d.limite + ' consultas usadas este mês' : ' · apiloterias sem chave (opcional)') +
      '. Busca automática às 21:30, 22:30, 23:30, 00:30 e 08:00.</p></div>' +
      '<button class="btn btn-dark btn-sm" id="lotUpdate">' + ICON('refresh') + ' Atualizar agora</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Loteria</th><th>Concurso</th><th>Sorteio</th><th>Próximo</th><th>Fonte</th><th>Atualizado</th></tr></thead><tbody>' +
      d.jogos.map(j => '<tr><td><b>' + esc(j.nome) + '</b>' + (j.erro ? '<br><small class="mt-warn" title="' + esc(j.erro) + '">última tentativa falhou ' + ago(j.erroEm) + '</small>' : '') + '</td>' +
        '<td>' + (j.concurso || '<span class="mt-warn">sem dados</span>') + '</td><td><small>' + esc(j.data.split('-').reverse().join('/')) + '</small></td>' +
        '<td><small>' + (j.proximo && j.proximo.data ? esc(j.proximo.data.split('-').reverse().join('/')) : '—') + '</small></td>' +
        '<td><small>' + esc(j.fonte || '—') + '</small></td><td><small>' + ago(j.obtido) + '</small></td></tr>').join('') +
      '</tbody></table></div></div>';
  }
  async function loadLot() {
    try { lotData = await api('api/admin/loterias'); } catch (_) { lotData = null; }
    renderLot();
  }

  async function loadMonitor() {
    if (monLoading) return;
    monLoading = true;
    if (!monData) $('#monBody').innerHTML = '<div class="empty">Carregando…</div>';
    try {
      monData = await api('api/stats?dias=' + $('#monDias').value);
      renderMonitor();
      loadLot();
    } catch (e) {
      $('#monBody').innerHTML = '<div class="empty"><b>Não foi possível carregar o monitoramento.</b><br>' + esc(e.message) +
        (/senha/i.test(e.message) ? '<br>Saia e entre de novo com a senha atual.' : '<br>O monitoramento só funciona no site publicado na Cloudflare.') + '</div>';
    }
    monLoading = false;
  }

  $('#monDias').addEventListener('change', () => { monData = null; loadMonitor(); });
  $('#monRefresh').addEventListener('click', loadMonitor);
  $('#monBody').addEventListener('click', async e => {
    const chip = e.target.closest('#monFeedFilter .chip');
    if (chip) {
      $$('#monFeedFilter .chip').forEach(c => c.classList.toggle('on', c === chip));
      const f = chip.dataset.f;
      $$('.mon-feeds tbody tr').forEach(tr => { tr.hidden = f && !(f === 'bad' ? /bad|warn/.test(tr.dataset.st) : tr.dataset.st === f); });
      return;
    }
    if (e.target.closest('#lotUpdate')) {
      const btn = $('#lotUpdate');
      btn.disabled = true; btn.textContent = 'Buscando resultados…';
      try {
        lotData = await api('api/admin/loterias', { method: 'POST' });
        const novos = (lotData.resultado || []).filter(r => r.status === 'novo').length;
        const falhas = (lotData.resultado || []).filter(r => r.status === 'falha').length;
        toast(novos + ' resultado(s) novo(s)' + (falhas ? ' · ' + falhas + ' falha(s)' : ''), falhas ? 'x' : 'check');
      } catch (err) { toast(err.message, 'x'); }
      renderLot();
      return;
    }
    if (e.target.closest('#monReset')) {
      if (!confirm('Zerar todas as estatísticas? Isso não afeta as telas.')) return;
      try { await api('api/stats/reset', { method: 'POST' }); toast('Estatísticas zeradas'); monData = null; loadMonitor(); }
      catch (err) { toast(err.message, 'x'); }
    }
  });
  $('#monCheck').addEventListener('click', async () => {
    const btn = $('#monCheck');
    btn.disabled = true;
    let from = 0, bad = 0, done = 0;
    try {
      while (from !== null) {
        btn.innerHTML = ICON('refresh') + ' Testando… ' + done;
        const r = await api('api/stats/check?inicio=' + from);
        done += r.resultados.length;
        bad += r.resultados.filter(x => !x.ok).length;
        from = r.proximo;
      }
      toast(done + ' feeds testados · ' + bad + ' com problema', bad ? 'x' : 'check');
      await loadMonitor();
    } catch (e) { toast(e.message, 'x'); }
    btn.disabled = false;
    btn.innerHTML = ICON('zap') + ' Testar todos os feeds';
  });

  /* =================== início =================== */
  let started = false;
  async function start() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    if (started) { route(); return; }
    started = true;
    try {
      modules = await RS.loadModules();
      active = modules.filter(m => m.status === 'ativo' && m.layouts && m.assuntos);
      const pk = await RS.fetchJson(RS.ROOT_URL + 'modules/pacotes.json').catch(() => ({ pacotes: [] }));
      pacotes = pk.pacotes || [];
    } catch (e) {
      console.error(e);
      toast('Erro ao carregar os módulos', 'x');
      return;
    }
    await loadClientsDb();
    if (dbMode) resetForm();
    const firstReal = activeClients.find(c => !c.demo) || activeClients[0];
    G.cliente = PK.cliente = firstReal ? firstReal.chave : '';
    G.modulo = active[0] ? active[0].id : 'rss';
    resetForModule();
    renderGen();
    renderPacks();
    renderClients();
    renderModulesView();
    updateLinksCount();
    route();
  }

  RS.registerSW();
  if (isLogged()) start(); else showLogin();
})();
