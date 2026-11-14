/* rsscreen — motor de exibição das telas
   URL: /tela/?cliente=<chave>&modulo=rss&assunto=esportes&fonte=ge&layout=destaque&orientacao=vertical&tema=noite&tempo=12&girar=90&modo=teste
   Todos os parâmetros (exceto cliente) são opcionais e têm padrão no manifesto do módulo.
   Com &playlist=<id> a tela vira uma playlist (assets/js/playlist.js), que mostra cada conteúdo
   num quadro interno com &embed=1. */
(function () {
  'use strict';

  const P = new URLSearchParams(location.search);
  const get = k => RS.slugify(P.get(k) || '');

  const state = {
    cliente: get('cliente'),
    modulo: get('modulo') || 'rss',
    assunto: get('assunto'),
    fonte: get('fonte'),
    layout: get('layout'),
    orientacao: get('orientacao'),
    tema: get('tema'),
    tempo: Number(P.get('tempo')) || 0,
    girar: get('girar'),
    teste: get('modo') === 'teste',
    playlist: get('playlist')
  };
  // embed = esta tela está dentro de uma playlist: começa pausada, não envia sinal de uso
  // e continua a sequência de onde parou na última vez
  const embed = P.get('embed') === '1' && window.parent !== window;

  const stage = document.getElementById('stage');
  const modules = {};
  const ctx = { state, orient: 'h' };

  let manifest = null, mod = null;
  let data = [], slides = [], idx = 0, elapsed = 0, paused = embed;
  let lastUpdate = null, offline = false, lastError = '';
  let progressEl = null, offlineEl = null, failures = 0;

  /* =================== API para os módulos =================== */
  const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }

  function timeAgo(ts) {
    if (!ts) return '';
    const diff = (Date.now() - ts) / 1000;
    if (diff < 0 || isNaN(diff)) return '';
    if (diff < 90) return 'agora';
    if (diff < 3600) return 'há ' + Math.round(diff / 60) + ' min';
    if (diff < 86400) return 'há ' + Math.round(diff / 3600) + ' h';
    const d = Math.round(diff / 86400);
    if (d < 8) return 'há ' + d + (d === 1 ? ' dia' : ' dias');
    const dt = new Date(ts);
    return pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1);
  }

  // pedidos ao próprio servidor levam o cliente (rc) e o aparelho (rd): o painel mostra o consumo de cada um
  function identificar(url) {
    if (typeof url !== 'string' || url.indexOf(RS.ROOT_URL + 'api/') !== 0 || /[?&]rc=/.test(url)) return url;
    const c = (ctx.client && ctx.client.chave) || state.cliente;
    if (!c) return url;
    return url + (url.indexOf('?') < 0 ? '?' : '&') + 'rc=' + encodeURIComponent(c) + '&rd=' + encodeURIComponent(deviceId());
  }

  function fetchWithTimeout(url, ms) {
    url = identificar(url);
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctrl && ctrl.abort(), ms || 15000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(
      r => { clearTimeout(t); return r; },
      e => { clearTimeout(t); throw e; });
  }

  // Busca XML/HTML de terceiros via proxy próprio (Cloudflare Pages Function) com fallback público
  async function fetchText(url) {
    const tries = [];
    if (location.protocol !== 'file:') tries.push(RS.ROOT_URL + 'api/rss?url=' + encodeURIComponent(url));
    tries.push('https://api.allorigins.win/raw?url=' + encodeURIComponent(url));
    let lastErr;
    for (let i = 0; i < tries.length; i++) {
      try {
        const res = await fetchWithTimeout(tries[i], i === 0 ? 15000 : 8000);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (text && text.indexOf('<') !== -1) return text;
        throw new Error('Resposta vazia');
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Falha ao buscar');
  }

  async function fetchJson(url) {
    const res = await fetchWithTimeout(url, 15000);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // Promise.allSettled não existe em players antigos (Chrome < 76)
  function settle(promises) {
    return Promise.all(promises.map(p => Promise.resolve(p).then(
      value => ({ status: 'fulfilled', value }),
      reason => ({ status: 'rejected', reason }))));
  }

  function placeholder(label) {
    return '<div class="ph"><span>' + RS.esc(label || '') + '</span></div>';
  }

  // Imagem com Ken Burns e troca automática por placeholder se falhar
  function media(src, label, kb) {
    if (!src) return '<div class="media">' + placeholder(label) + '</div>';
    return '<div class="media"><img class="' + (kb === false ? '' : 'kb') + '" src="' + RS.esc(src) +
      '" alt="" referrerpolicy="no-referrer" data-label="' + RS.esc(label || '') + '" onerror="RSScreen.imgFail(this)"></div>';
  }

  function imgFail(img) {
    const wrap = img.parentNode;
    if (wrap) wrap.innerHTML = placeholder(img.getAttribute('data-label'));
  }

  function clockHtml(kind) {
    if (kind === 'date') return '<span data-date="long"></span>';
    if (kind === 'weekday') return '<span data-date="weekday"></span>';
    if (kind === 'short') return '<span data-date="short"></span>';
    return '<span class="clock-time" data-clock></span>';
  }

  function updateClocks() {
    const now = new Date();
    const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
    stage.querySelectorAll('[data-clock]').forEach(el => { if (el.textContent !== hm) el.textContent = hm; });
    const long = WEEKDAYS[now.getDay()] + ', ' + now.getDate() + ' de ' + MONTHS[now.getMonth()];
    const short = now.getDate() + ' de ' + MONTHS[now.getMonth()];
    stage.querySelectorAll('[data-date]').forEach(el => {
      const k = el.getAttribute('data-date');
      const v = k === 'weekday' ? WEEKDAYS[now.getDay()] : k === 'short' ? short : long;
      if (el.textContent !== v) el.textContent = v;
    });
  }

  window.RSScreen = {
    register(id, def) { modules[id] = def; },
    esc: RS.esc,
    fetchText, fetchJson, timeAgo, settle,
    reload() { if (mod) refresh(true); },
    previa: P.get('previa') === '1', media, placeholder, imgFail, clockHtml, pad,
    WEEKDAYS, MONTHS
  };

  /* =================== layout / tamanho =================== */
  function hexToRgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function applyTheme() {
    const t = RS.theme(state.tema);
    ctx.theme = t;
    const s = stage.style;
    s.setProperty('--bg', t.bg);
    s.setProperty('--surface', t.surface);
    s.setProperty('--text', t.text);
    s.setProperty('--muted', t.muted);
    s.setProperty('--accent', t.accent);
    s.setProperty('--accent-text', t.accentText);
    s.setProperty('--accent-a55', hexToRgba(t.accent, .55));
    s.setProperty('--accent-a35', hexToRgba(t.accent, .35));
    s.setProperty('--accent-a15', hexToRgba(t.accent, .15));
    s.setProperty('--text-a12', hexToRgba(t.text, .12));
    s.setProperty('--surface-a90', hexToRgba(t.surface, .92));
    stage.dataset.tema = t.id;
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = t.bg;
  }

  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const rot = state.girar === '90' || state.girar === '270';
    const aw = rot ? vh : vw, ah = rot ? vw : vh;
    const boxIsV = ah > aw;
    const wantV = state.orientacao === 'vertical' ? true : state.orientacao === 'horizontal' ? false : boxIsV;
    let w = aw, h = ah;
    if (wantV && !boxIsV) { h = ah; w = Math.round(ah * 9 / 16); }
    else if (!wantV && boxIsV) { w = aw; h = Math.round(aw * 9 / 16); }
    stage.style.width = w + 'px';
    stage.style.height = h + 'px';
    stage.style.transform = rot ? 'rotate(' + state.girar + 'deg)' : '';
    const long = Math.max(w, h), short = Math.min(w, h);
    const unit = Math.min(long / 100, short * 16 / 9 / 100);
    document.documentElement.style.fontSize = unit.toFixed(3) + 'px';
    const prev = ctx.orient;
    ctx.orient = wantV ? 'v' : 'h';
    stage.classList.toggle('o-v', wantV);
    stage.classList.toggle('o-h', !wantV);
    return prev !== ctx.orient;
  }

  /* =================== telas de status =================== */
  // avisa a playlist se este conteúdo abriu (ok) ou falhou (ela pula para o próximo)
  let notified = null;
  function notifyParent(ok) {
    if (!embed || notified === ok) return;
    notified = ok;
    try { window.parent.postMessage({ rs: 'pl-estado', ok: ok }, '*'); } catch (_) {}
  }

  function statusScreen(title, desc, loading) {
    if (!loading) notifyParent(false);
    progressEl = null;
    offlineEl = null;
    stage.innerHTML = '<div class="status-screen">' +
      (loading ? '<div class="spinner"></div>' : '<div class="ico">!</div>') +
      '<h1>' + RS.esc(title) + '</h1>' + (desc ? '<p>' + RS.esc(desc) + '</p>' : '') + '</div>';
  }

  /* =================== renderização =================== */
  function ensureChrome() {
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.className = 'progress';
      progressEl.innerHTML = '<i></i>';
      stage.appendChild(progressEl);
    }
    if (ctx.client && ctx.client.demo && !stage.querySelector('.demo-badge')) {
      const b = document.createElement('div');
      b.className = 'demo-badge';
      b.textContent = 'DEMONSTRAÇÃO';
      stage.appendChild(b);
    }
    if (!offlineEl) {
      offlineEl = document.createElement('div');
      offlineEl.className = 'offline-badge';
      offlineEl.hidden = true;
      stage.appendChild(offlineEl);
    }
    offlineEl.hidden = !offline;
    offlineEl.textContent = offline ? 'Modo offline · ' + (lastUpdate ? 'dados de ' + timeAgo(lastUpdate) : 'sem dados') : '';
    progressEl.style.display = slides.length > 1 ? '' : 'none';
  }

  function slideDuration() {
    const s = slides[idx];
    if (mod && mod.duration) {
      const d = mod.duration(s, ctx);
      if (d) return d;
    }
    return ctx.tempo;
  }

  function renderSlide() {
    if (!slides.length || !mod) return;
    if (stage.querySelector('.status-screen')) stage.innerHTML = '';
    ensureChrome();
    let html = '';
    try {
      html = mod.render(slides[idx], idx, slides, ctx);
    } catch (e) {
      console.error(e);
      html = '<div class="status-screen"><h1>Erro no layout</h1></div>';
    }
    const el = document.createElement('div');
    el.className = 'slide l-' + ctx.layout + ' m-' + state.modulo;
    el.innerHTML = html;
    stage.insertBefore(el, progressEl);
    updateClocks();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    const olds = Array.from(stage.querySelectorAll('.slide')).filter(s => s !== el);
    setTimeout(() => olds.forEach(o => o.remove()), 1000);
    elapsed = 0;
    if (embed) { savePos(); notifyParent(true); }
    // pré-carrega a imagem do próximo slide
    const next = slides[(idx + 1) % slides.length];
    if (next && next.imagem) { const im = new Image(); im.referrerPolicy = 'no-referrer'; im.src = next.imagem; }
    updateTestInfo();
  }

  function rebuild() {
    slides = mod.slides ? mod.slides(data, ctx) : data.slice();
    if (idx >= slides.length) idx = 0;
    renderSlide();
  }

  function go(delta) {
    if (!slides.length) return;
    idx = (idx + delta + slides.length) % slides.length;
    renderSlide();
  }

  /* =================== dados e cache offline =================== */
  function cacheKey() {
    return 'rs_cache_v1_' + [state.modulo, ctx.assunto && ctx.assunto.id, ctx.fonte && ctx.fonte.id].join('_');
  }

  // Na playlist cada aparição continua do slide seguinte ao da última vez
  function posKey() { return 'rs_pos_' + cacheKey() + '_' + ctx.layout; }
  function savePos() { try { localStorage.setItem(posKey(), String(idx)); } catch (_) {} }
  function startIdx(n) {
    if (!embed || !n) return 0;
    let last = -1;
    try { last = parseInt(localStorage.getItem(posKey()), 10); } catch (_) {}
    return isNaN(last) || last < 0 ? 0 : (last + 1) % n;
  }

  function loadCache() {
    try {
      const raw = localStorage.getItem(cacheKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  function saveCache() {
    try { localStorage.setItem(cacheKey(), JSON.stringify({ t: lastUpdate, data })); } catch (_) {}
  }

  async function refresh(first) {
    try {
      const fresh = await mod.load(ctx);
      if (!fresh || !fresh.length) throw new Error('Nenhum conteúdo retornado');
      data = fresh;
      failures = 0;
      offline = false;
      if (embed) notifyParent(true);
      lastError = '';
      lastUpdate = Date.now();
      saveCache();
      if (first || slides.length <= 1 || mod.rerenderOnRefresh) {
        const keep = idx;
        slides = mod.slides ? mod.slides(data, ctx) : data.slice();
        idx = first ? startIdx(slides.length) : Math.min(keep, slides.length - 1);
        renderSlide();
      } else {
        // troca os dados sem interromper o slide atual
        slides = mod.slides ? mod.slides(data, ctx) : data.slice();
        if (idx >= slides.length) idx = 0;
        ensureChrome();
      }
    } catch (e) {
      console.warn('[rsscreen] falha ao atualizar:', e);
      lastError = e.message || String(e);
      offline = true;
      if (!data.length) {
        notifyParent(false);
        failures++;
        statusScreen('Conectando…', 'Não foi possível carregar o conteúdo agora. Nova tentativa em instantes.', true);
        setTimeout(() => refresh(true), failures < 3 ? 10000 : 30000);
      } else {
        ensureChrome();
      }
    }
    updateTestInfo();
  }

  /* =================== loop =================== */
  function startLoop() {
    const step = 200;
    setInterval(() => {
      if (paused || slides.length <= 1) return;
      elapsed += step / 1000;
      const dur = slideDuration();
      if (progressEl) progressEl.firstChild.style.width = Math.min(100, (elapsed / dur) * 100) + '%';
      if (elapsed >= dur) go(1);
    }, step);
    setInterval(updateClocks, 1000);
  }

  /* =================== carregamento de módulo =================== */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  function loadStyle(href) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    document.head.appendChild(l);
  }

  function resolveSelections() {
    const pad_ = manifest.padrao || {};
    const assuntos = manifest.assuntos || [];
    ctx.assunto = assuntos.find(a => a.id === state.assunto) || assuntos.find(a => a.id === pad_.assunto) || assuntos[0] || null;
    state.assunto = ctx.assunto ? ctx.assunto.id : '';
    const fontes = (ctx.assunto && ctx.assunto.fontes) || [];
    ctx.fonte = fontes.find(f => f.id === state.fonte) || fontes.find(f => state.fonte && f.site === state.fonte) || null;
    if (!ctx.fonte && ctx.assunto && ctx.assunto.fonteObrigatoria && fontes.length) ctx.fonte = fontes[0];
    state.fonte = ctx.fonte ? ctx.fonte.id : '';
    const layouts = manifest.layouts || [];
    const lay = layouts.find(l => l.id === state.layout) || layouts.find(l => l.id === pad_.layout) || layouts[0];
    ctx.layout = lay ? lay.id : 'padrao';
    state.layout = ctx.layout;
    if (!RS.THEMES.some(t => t.id === state.tema)) state.tema = pad_.tema || 'noite';
    ctx.tempo = state.tempo >= 4 ? state.tempo : (pad_.tempo || 12);
  }

  // Cliente: banco D1 (via /api/cliente) → cópia salva no aparelho → config/clientes.js
  async function resolveClient(chave) {
    // dentro da playlist o cliente já foi conferido pela página principal
    if (embed) { try { const pc = window.parent.__rsCliente; if (pc && pc.chave === chave) return pc; } catch (_) {} }
    const local = RS.findClient(chave);
    if (!chave || location.protocol === 'file:') return local;
    const memKey = 'rs_cli_' + chave;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(memKey) || 'null'); } catch (_) {}
    // conferido há menos de 30 min: não pergunta de novo ao servidor
    if (saved && saved.c && saved.t && Date.now() - saved.t < 30 * 60 * 1000) return saved.c;
    try {
      const res = await fetchWithTimeout(RS.ROOT_URL + 'api/cliente?chave=' + encodeURIComponent(chave), 6000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const r = await res.json();
      if (r && r.banco) {
        const c = r.cliente ? { nome: r.cliente.nome, chave: r.cliente.chave, ativo: r.cliente.ativo, demo: r.cliente.demo } : null;
        try { if (c) localStorage.setItem(memKey, JSON.stringify({ c, t: Date.now() })); else localStorage.removeItem(memKey); } catch (_) {}
        return c;
      }
      return local;
    } catch (_) {
      // sem internet ou servidor fora: usa o que já sabia
      if (saved) return saved.c || saved;
      return local;
    }
  }

  async function init() {
    fit();
    applyTheme();
    statusScreen('Carregando…', '', true);

    const client = await resolveClient(state.cliente);
    if (!client) {
      ping(true);
      statusScreen('Tela não autorizada', 'O código desta tela não foi encontrado. Fale com o seu fornecedor de conteúdo para receber o link correto.');
      return;
    }
    if (!client.ativo) {
      statusScreen('Tela suspensa', 'Este conteúdo está temporariamente indisponível. Fale com o seu fornecedor de conteúdo.');
      return;
    }
    ctx.client = client;
    document.title = client.nome;

    try {
      manifest = await RS.loadManifest(state.modulo);
    } catch (e) {
      statusScreen('Conteúdo indisponível', 'O módulo "' + state.modulo + '" não existe.');
      return;
    }
    if (manifest.status !== 'ativo' || !manifest.script) {
      statusScreen('Em breve', 'O conteúdo "' + manifest.nome + '" ainda não está disponível.');
      return;
    }
    ctx.manifest = manifest;
    resolveSelections();
    applyTheme();

    try {
      if (manifest.estilo) loadStyle(RS.ROOT_URL + 'modules/' + manifest.id + '/' + manifest.estilo);
      await loadScript(RS.ROOT_URL + 'modules/' + manifest.id + '/' + manifest.script);
    } catch (e) {
      statusScreen('Erro ao carregar', e.message);
      return;
    }
    mod = modules[manifest.id];
    if (!mod) { statusScreen('Erro ao carregar', 'Módulo sem registro.'); return; }

    if (state.teste) buildTestbar();

    // Mostra o cache imediatamente (tela nunca fica preta), depois busca dados novos
    const cached = loadCache();
    if (cached && cached.data && cached.data.length) {
      data = cached.data;
      lastUpdate = cached.t;
      slides = mod.slides ? mod.slides(data, ctx) : data.slice();
      idx = startIdx(slides.length);
      rebuild();
    }
    // Dados ainda recentes não são buscados de novo ao abrir. Muitos players recarregam o link
    // toda vez que ele volta na programação; sem isso, cada TV gastaria dezenas de pedidos por dia.
    const per = (mod.refreshMinutes || 10) * 60 * 1000;
    const idade = cached && cached.t ? Date.now() - cached.t : Infinity;
    if (idade >= per) await refresh(!cached);
    startPing();
    startLoop();
    setTimeout(() => { refresh(false); setInterval(() => refresh(false), per); }, idade >= per ? per : per - idade);
  }

  /* =================== registro de uso (painel > Monitoramento) =================== */
  // Imagem 1x1: funciona em qualquer player, não bloqueia nada e não exige CORS.
  function deviceId() {
    try {
      let id = localStorage.getItem('rs_device');
      if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('rs_device', id); }
      return id;
    } catch (_) { return ''; }
  }
  function ping(first) {
    if (location.protocol === 'file:' || state.teste || embed || P.get('previa') === '1') return;
    const q = ['cliente', 'modulo', 'assunto', 'fonte', 'layout', 'orientacao']
      .map(k => k + '=' + encodeURIComponent(state[k] || '')).join('&');
    const img = new Image();
    img.src = RS.ROOT_URL + 'api/hit?' + q + '&d=' + encodeURIComponent(deviceId()) +
      '&ok=' + (engine.ok ? (engine.ok() ? 1 : 0) : (data.length && !offline ? 1 : 0)) + (first ? '&novo=1' : '') + '&_=' + Date.now();
  }
  // sinal a cada 30 min; ao abrir, só avisa se o último sinal desta tela foi há mais de 25 min
  // (players que recarregam o link a cada volta na programação não multiplicam os pedidos)
  const PING_MS = 30 * 60 * 1000;
  function startPing() {
    const k = 'rs_ping_' + [state.cliente, state.modulo, state.assunto].join('_');
    let last = 0;
    try { last = Number(localStorage.getItem(k)) || 0; } catch (_) {}
    const marca = () => { try { localStorage.setItem(k, String(Date.now())); } catch (_) {} };
    if (Date.now() - last > 25 * 60 * 1000) { ping(true); marca(); }
    setInterval(() => { ping(false); marca(); }, PING_MS);
  }

  /* =================== modo teste =================== */
  let modulesList = null;

  function opt(value, label, sel) {
    return '<option value="' + RS.esc(value) + '"' + (value === sel ? ' selected' : '') + '>' + RS.esc(label) + '</option>';
  }

  function currentUrl(withTest) {
    return RS.buildScreenUrl({
      cliente: ctx.client.chave, modulo: state.modulo, assunto: state.assunto, fonte: state.fonte,
      layout: state.layout, orientacao: state.orientacao, tema: state.tema,
      tempo: state.tempo || '', girar: state.girar, modo: withTest ? 'teste' : ''
    });
  }

  async function buildTestbar() {
    const bar = document.getElementById('testbar');
    bar.hidden = false;
    try { modulesList = (await RS.loadModules()).filter(m => m.status === 'ativo'); } catch (_) { modulesList = [manifest]; }
    const fontes = (ctx.assunto && ctx.assunto.fontes) || [];

    bar.innerHTML =
      '<div class="tb-row">' +
        '<span class="tb-badge">Modo teste</span>' +
        '<span class="tb-client">' + RS.esc(ctx.client.nome) + '</span>' +
        '<span class="tb-info" id="tb-info"></span>' +
      '</div>' +
      '<div class="tb-row">' +
        '<label>Módulo<select id="tb-modulo">' + modulesList.map(m => opt(m.id, m.nome, state.modulo)).join('') + '</select></label>' +
        '<label>' + RS.esc(manifest.rotuloAssunto || 'Assunto') + '<select id="tb-assunto">' + (manifest.assuntos || []).map(a => opt(a.id, a.nome, state.assunto)).join('') + '</select></label>' +
        (fontes.length ? '<label>' + RS.esc(manifest.rotuloFonte || 'Fonte') + '<select id="tb-fonte">' +
          (ctx.assunto.fonteObrigatoria ? '' : opt('', 'Todas as fontes', state.fonte)) +
          fontes.map(f => opt(f.id, f.nome, state.fonte)).join('') + '</select></label>' : '') +
        '<label>Layout<select id="tb-layout">' + manifest.layouts.map(l => opt(l.id, l.nome, state.layout)).join('') + '</select></label>' +
        '<label>Orientação<select id="tb-orientacao">' + opt('', 'Automática', state.orientacao) + RS.ORIENTACOES.map(o => opt(o.id, o.nome, state.orientacao)).join('') + '</select></label>' +
        '<label>Tema<select id="tb-tema">' + RS.THEMES.map(t => opt(t.id, t.nome, state.tema)).join('') + '</select></label>' +
        '<label>Tempo (s)<input id="tb-tempo" type="number" min="4" max="120" value="' + ctx.tempo + '"></label>' +
        '<label>Girar<select id="tb-girar">' + opt('', 'Não', state.girar) + opt('90', '90°', state.girar) + opt('270', '270°', state.girar) + '</select></label>' +
        '<div class="tb-ctrls">' +
          '<button id="tb-prev" title="Anterior (←)">◀</button>' +
          '<button id="tb-pause" title="Pausar (espaço)">❚❚</button>' +
          '<button id="tb-next" title="Próximo (→)">▶</button>' +
          '<button id="tb-copy" class="primary" title="Copia o link sem o modo teste">Copiar link de produção</button>' +
          '<button id="tb-hide" title="Esconder barra (H)">✕</button>' +
        '</div>' +
      '</div>';

    const openBtn = document.createElement('button');
    openBtn.id = 'tb-open';
    openBtn.textContent = 'Modo teste';
    openBtn.hidden = true;
    document.body.appendChild(openBtn);

    const $ = id => document.getElementById(id);
    const navigate = () => { location.href = currentUrl(true); };

    $('tb-modulo').onchange = e => {
      state.modulo = e.target.value; state.assunto = ''; state.fonte = ''; state.layout = ''; state.tema = '';
      navigate();
    };
    $('tb-assunto').onchange = e => { state.assunto = e.target.value; state.fonte = ''; navigate(); };
    if ($('tb-fonte')) $('tb-fonte').onchange = e => { state.fonte = e.target.value; navigate(); };
    $('tb-layout').onchange = e => { state.layout = ctx.layout = e.target.value; syncUrl(); rebuild(); };
    $('tb-orientacao').onchange = e => { state.orientacao = e.target.value; fit(); syncUrl(); rebuild(); };
    $('tb-tema').onchange = e => { state.tema = e.target.value; applyTheme(); syncUrl(); };
    $('tb-tempo').onchange = e => {
      const v = Math.max(4, Math.min(120, Number(e.target.value) || 12));
      state.tempo = v; ctx.tempo = v; e.target.value = v; syncUrl();
    };
    $('tb-girar').onchange = e => { state.girar = e.target.value; fit(); syncUrl(); rebuild(); };
    $('tb-prev').onclick = () => go(-1);
    $('tb-next').onclick = () => go(1);
    $('tb-pause').onclick = e => { paused = !paused; e.target.textContent = paused ? '▶︎ Retomar' : '❚❚'; };
    $('tb-copy').onclick = async e => {
      const ok = await RS.copyText(currentUrl(false));
      e.target.textContent = ok ? 'Copiado!' : 'Falhou';
      setTimeout(() => { e.target.textContent = 'Copiar link de produção'; }, 1600);
    };
    const toggle = () => {
      const c = bar.classList.toggle('collapsed');
      openBtn.hidden = !c;
    };
    $('tb-hide').onclick = toggle;
    openBtn.onclick = toggle;

    document.addEventListener('keydown', e => {
      if (/input|select/i.test(e.target.tagName)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ') { e.preventDefault(); $('tb-pause').click(); }
      else if (e.key.toLowerCase() === 'h') toggle();
    });
    updateTestInfo();
  }

  function syncUrl() {
    try { history.replaceState(null, '', currentUrl(true)); } catch (_) {}
  }

  function updateTestInfo() {
    const el = document.getElementById('tb-info');
    if (!el) return;
    const parts = [];
    parts.push(slides.length ? (idx + 1) + '/' + slides.length + ' slides' : 'sem slides');
    if (lastUpdate) {
      const d = new Date(lastUpdate);
      parts.push('atualizado às ' + pad(d.getHours()) + ':' + pad(d.getMinutes()));
    }
    parts.push(ctx.orient === 'v' ? 'vertical' : 'horizontal');
    if (offline) parts.push('⚠ ' + (lastError || 'offline'));
    el.textContent = parts.join(' · ');
  }

  /* =================== robustez para players 24h =================== */
  window.addEventListener('resize', () => { if (fit() && slides.length) rebuild(); });

  if (!state.teste) {
    let cursorTimer;
    const hide = () => document.body.classList.add('hide-cursor');
    document.addEventListener('mousemove', () => {
      document.body.classList.remove('hide-cursor');
      clearTimeout(cursorTimer);
      cursorTimer = setTimeout(hide, 2500);
    });
    hide();
  }

  // Mantém a tela acordada (tablets, notebooks e mini PCs)
  async function wakeLock() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen'); } catch (_) {}
  }
  if (!embed) {
    document.addEventListener('visibilitychange', wakeLock);
    wakeLock();

    // Recarrega a cada 6h para receber atualizações do sistema (só se houver internet)
    setTimeout(function reloadLater() {
      if (navigator.onLine !== false) location.reload();
      else setTimeout(reloadLater, 10 * 60 * 1000);
    }, 6 * 60 * 60 * 1000);

    RS.registerSW();
  } else {
    // a playlist manda começar quando este conteúdo aparece na tela
    window.addEventListener('message', e => {
      if (e.source !== window.parent || !e.data || e.data.rs !== 'play') return;
      paused = false;
      elapsed = 0;
      if (progressEl) progressEl.firstChild.style.width = '0%';
    });
  }

  // peças do motor usadas pela playlist (assets/js/playlist.js)
  const engine = {
    state, ctx, stage, embed, fit, applyTheme, statusScreen, resolveClient, fetchWithTimeout, loadScript, startPing,
    ok: null
  };
  RSScreen.engine = engine;

  if (state.playlist && !embed) {
    loadScript(RS.ROOT_URL + 'assets/js/playlist.js').catch(() => statusScreen('Erro ao carregar', 'Não foi possível abrir a playlist.'));
  } else {
    init();
  }
})();
