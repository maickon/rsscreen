/* rsscreen — painel do administrador */
(function () {
  'use strict';
  const esc = RS.esc;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const AUTH_KEY = 'rs_admin_v1';
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

  const clients = RS.clients();
  const activeClients = clients.filter(c => c.ativo);
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
  const adminHash = RS.hash('auth|' + RS.adminKey());

  function isLogged() { return store.get(AUTH_KEY, '') === adminHash; }

  function showLogin() {
    $('#app').hidden = true;
    $('#login').hidden = false;
    setTimeout(() => $('#loginKey').focus(), 50);
  }

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const v = RS.slugify($('#loginKey').value);
    if (v && v === RS.adminKey()) {
      store.set(AUTH_KEY, adminHash);
      $('#loginError').hidden = true;
      $('#loginKey').value = '';
      start();
    } else {
      $('#loginError').hidden = false;
      $('#loginKey').select();
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    localStorage.removeItem(AUTH_KEY);
    location.hash = '';
    showLogin();
  });

  /* =================== navegação =================== */
  const VIEWS = ['gerar', 'pacotes', 'links', 'clientes', 'modelos', 'modulos'];

  function route() {
    const v = (location.hash || '#gerar').slice(1);
    const view = VIEWS.indexOf(v) >= 0 ? v : 'gerar';
    VIEWS.forEach(n => { $('#view-' + n).hidden = n !== view; });
    $$('#sideNav a').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    $('#app').classList.remove('menu-open');
    if (view === 'links') renderLinks();
    if (view === 'modelos') renderModels();
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
  const G = { cliente: '', modulo: 'rss', assuntos: [], fonte: '', layouts: [], orient: ['horizontal'], tema: '', tempo: '', girar: '', busca: '' };
  let results = [];

  function gModule() { return modById(G.modulo) || active[0]; }

  function resetForModule() {
    const m = gModule();
    const p = m.padrao || {};
    G.assuntos = p.assunto ? [p.assunto] : (m.assuntos[0] ? [m.assuntos[0].id] : []);
    G.layouts = p.layout ? [p.layout] : [m.layouts[0].id];
    G.tema = p.tema || 'noite';
    G.fonte = '';
    G.busca = '';
    $('#gAssuntoBusca').value = '';
  }

  function fonteFor(assuntoId) {
    const m = gModule();
    const a = m.assuntos.find(x => x.id === assuntoId);
    if (!a || !a.fontes) return '';
    if (G.assuntos.length === 1 && G.fonte) return G.fonte;
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
    $('#gAssuntoBusca').hidden = m.assuntos.length < 12;
    const q = RS.normalize(G.busca);
    $('#gAssuntos').innerHTML = m.assuntos
      .filter(a => !q || RS.normalize(a.nome).indexOf(q) >= 0 || G.assuntos.indexOf(a.id) >= 0)
      .map(a => '<button class="chip' + (G.assuntos.indexOf(a.id) >= 0 ? ' on' : '') + '" data-v="' + a.id + '">' + esc(a.nome) + '</button>').join('');
    $('#gAssuntoCount').textContent = G.assuntos.length + ' de ' + m.assuntos.length;

    // fonte: só quando exatamente um assunto com fontes está selecionado
    const one = G.assuntos.length === 1 ? m.assuntos.find(x => x.id === G.assuntos[0]) : null;
    if (one && one.fontes && one.fontes.length > 1) {
      $('#gFonteWrap').hidden = false;
      $('#gFonteLabel').textContent = (m.rotuloFonte || 'Fonte') + (one.fonteObrigatoria ? '' : ' (opcional)');
      if (one.fonteObrigatoria && !G.fonte) G.fonte = one.fontes[0].id;
      $('#gFonte').innerHTML = (one.fonteObrigatoria ? '' : '<option value="">Todas as fontes (intercaladas)</option>') +
        one.fontes.map(f => '<option value="' + f.id + '"' + (f.id === G.fonte ? ' selected' : '') + '>' + esc(f.nome) + '</option>').join('');
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
  function renderClients() {
    const counts = {};
    getLinks().forEach(r => { counts[r.cliente] = (counts[r.cliente] || 0) + 1; });
    $('#cCount').textContent = clients.length + ' cliente' + (clients.length !== 1 ? 's' : '') + ' · ' + activeClients.length + ' ativo' + (activeClients.length !== 1 ? 's' : '');
    $('#cTable').innerHTML = '<thead><tr><th>Cliente</th><th>Chave</th><th>Status</th><th>Links</th><th></th></tr></thead><tbody>' +
      clients.map(c => '<tr>' +
        '<td><b>' + esc(c.nome) + '</b>' + (c.whatsapp ? '<br><small style="color:var(--muted)">' + esc(c.whatsapp) + '</small>' : '') + '</td>' +
        '<td><span class="mono">' + esc(c.chave) + '</span></td>' +
        '<td>' + (!c.ativo ? '<span class="badge">Suspenso</span>' : c.demo ? '<span class="badge badge-brand">Demonstração</span>' : '<span class="badge badge-ok">Ativo</span>') + '</td>' +
        '<td>' + (counts[c.chave] || 0) + '</td>' +
        '<td><div class="acts">' +
          '<button class="btn btn-ghost btn-sm btn-icon" data-copy="' + esc(c.chave) + '" title="Copiar chave">' + ICON('copy') + '</button>' +
          (c.ativo ? '<button class="btn btn-dark btn-sm" data-gen="' + esc(c.chave) + '">' + ICON('link') + 'Gerar</button>' : '') +
        '</div></td>' +
      '</tr>').join('') + '</tbody>';
  }

  $('#cTable').addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]');
    if (cp) return copy(cp.dataset.copy, 'Chave copiada');
    const g = e.target.closest('[data-gen]');
    if (g) { G.cliente = g.dataset.gen; renderGen(); location.hash = '#gerar'; }
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
