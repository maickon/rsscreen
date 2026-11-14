/* rsscreen — playlist: vários conteúdos em sequência num link só
   URL: /tela/?cliente=<chave>&playlist=<id>[&orientacao=vertical][&tema=noite][&girar=90]
   Cada conteúdo abre num quadro interno (/tela/?...&embed=1). O próximo é preparado escondido
   alguns segundos antes e entra com uma transição suave; se ele falhar, a playlist pula para o seguinte.
   A playlist fica guardada no aparelho e continua rodando sem internet. */
(function () {
  'use strict';

  const E = window.RSScreen.engine;
  const P = new URLSearchParams(location.search);
  const previa = P.get('previa') === '1';
  const stage = E.stage;
  const memKey = 'rs_pl_' + E.state.playlist;
  const urlTema = E.state.tema;
  const tema = () => urlTema || (pl && pl.opcoes && pl.opcoes.tema) || '';

  let pl = null, seq = [], pos = -1, cur = null, nxt = null, timer = null, prepTimer = null, fails = 0;

  const DUR_PADRAO = { rss: 40, anuncios: 30, clima: 20, cotacoes: 20, loterias: 25 };

  function buildSeq(p) {
    const out = [];
    const ads = p.opcoes && p.opcoes.intercalar;
    (p.itens || []).forEach(it => {
      out.push(it);
      if (ads && it.modulo !== 'anuncios') out.push({ modulo: 'anuncios', assunto: 'todos', layout: p.opcoes.layoutAnuncios || 'padrao', duracao: ads, extra: true });
    });
    return out;
  }

  function itemUrl(it) {
    const o = E.ctx.orient === 'v' ? 'vertical' : 'horizontal';
    return RS.buildScreenUrl({
      cliente: E.ctx.client.chave, modulo: it.modulo, assunto: it.assunto, fonte: it.fonte, layout: it.layout,
      orientacao: o, tema: tema(), tempo: it.tempo || ''
    }) + '&embed=1';
  }

  function duration(it) { return Math.max(5, Number(it.duracao) || DUR_PADRAO[it.modulo] || 30); }

  /* ---------- quadros ---------- */
  function makeFrame(k) {
    const it = seq[k];
    const fr = document.createElement('iframe');
    fr.className = 'pl-frame';
    fr.setAttribute('scrolling', 'no');
    fr.setAttribute('frameborder', '0');
    fr.setAttribute('allow', 'autoplay');
    const f = { el: fr, k: k, ok: null, it: it };
    fr.src = itemUrl(it);
    stage.appendChild(fr);
    return f;
  }

  function drop(f) {
    if (!f) return;
    try { f.el.src = 'about:blank'; } catch (_) {}
    setTimeout(() => { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); }, 50);
  }

  function play(f) {
    const old = cur;
    cur = f;
    pos = f.k;
    f.el.classList.add('on');
    try { f.el.contentWindow.postMessage({ rs: 'play' }, '*'); } catch (_) {}
    if (old && old !== f) setTimeout(() => drop(old), 900);
    const st = stage.querySelector('.status-screen');
    if (st) st.parentNode.removeChild(st);
    tellPanel();
    schedule();
  }

  // agenda a preparação do próximo e a troca
  function schedule() {
    clearTimeout(timer);
    clearTimeout(prepTimer);
    if (seq.length <= 1) return;
    const d = duration(cur.it) * 1000;
    const lead = Math.min(8000, d / 2);
    prepTimer = setTimeout(prepare, d - lead);
    timer = setTimeout(swap, d);
  }

  function nextIndex(from) { return (from + 1) % seq.length; }

  function prepare(k) {
    if (nxt) drop(nxt);
    k = k == null ? nextIndex(pos) : k;
    if (seq.length <= 1) { nxt = null; return; }
    nxt = makeFrame(k);
  }

  // o próximo não abriu: prepara o seguinte (sem tirar o atual da tela)
  function skipNext() {
    fails++;
    const k = nextIndex(nxt.k);
    drop(nxt);
    nxt = null;
    if (fails < seq.length && k !== pos) nxt = makeFrame(k);
  }

  let waited = 0;
  function swap() {
    clearTimeout(timer);
    if (!nxt) { fails = 0; schedule(); return; }   // nenhum outro abriu: o atual fica mais uma rodada
    if (nxt.ok === true) { waited = 0; fails = 0; play(nxt); nxt = null; return; }
    if (nxt.ok === null && waited < 12) { waited++; timer = setTimeout(swap, 1000); return; }
    waited = 0;
    skipNext();
    if (nxt) timer = setTimeout(swap, 4000); else { fails = 0; schedule(); }
  }

  window.addEventListener('message', e => {
    const d = e.data;
    if (!d) return;
    if (d.rs === 'pl-estado') {
      const f = [cur, nxt, first].find(x => x && x.el.contentWindow === e.source);
      if (!f || f.ok !== null) return;
      f.ok = !!d.ok;
      if (f === first) startFirst(f);
      else if (f === nxt && !f.ok) skipNext();
      return;
    }
    if (!previa || e.source !== window.parent) return;
    if (d.rs === 'pl-previa' && d.playlist) { pl = d.playlist; restart(); }
    else if (d.rs === 'pl-proximo' && seq.length > 1) { clearTimeout(prepTimer); if (!nxt) prepare(); swap(); }
  });

  // primeiro conteúdo: espera abrir; se falhar, tenta o seguinte
  let first = null, firstTries = 0, firstTimer = null;
  function startFirst(f) {
    clearTimeout(firstTimer);
    first = null;
    if (f.ok) { play(f); return; }
    drop(f);
    firstTries++;
    if (firstTries >= seq.length) {
      firstTries = 0;
      E.statusScreen('Conectando…', 'Não foi possível abrir os conteúdos agora. Nova tentativa em instantes.', true);
      setTimeout(() => begin(0), 30000);
      return;
    }
    begin((f.k + 1) % seq.length);
  }

  function begin(k) {
    first = makeFrame(k);
    const f = first;
    firstTimer = setTimeout(() => { if (first === f && f.ok === null) { f.ok = false; startFirst(f); } }, 25000);
  }

  function restart() {
    clearTimeout(timer); clearTimeout(prepTimer); clearTimeout(firstTimer);
    [cur, nxt, first].forEach(drop);
    cur = nxt = first = null;
    pos = -1; fails = 0; firstTries = 0; waited = 0;
    seq = buildSeq(pl);
    if (!seq.length) { E.statusScreen('Playlist vazia', 'Adicione conteúdos a esta playlist no painel.'); return; }
    if (E.state.tema !== tema()) { E.state.tema = tema(); E.applyTheme(); }
    begin(0);
  }

  function tellPanel() {
    if (!previa) return;
    try { window.parent.postMessage({ rs: 'pl-item', i: pos, total: seq.length, item: cur && cur.it }, '*'); } catch (_) {}
  }

  /* ---------- carregar a playlist ---------- */
  async function fetchPlaylist() {
    const res = await E.fetchWithTimeout(RS.ROOT_URL + 'api/playlist?id=' + encodeURIComponent(E.state.playlist) +
      '&cliente=' + encodeURIComponent(E.ctx.client.chave), 8000);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const r = await res.json();
    return r.playlist || null;
  }

  function saved() { try { return JSON.parse(localStorage.getItem(memKey) || 'null'); } catch (_) { return null; } }

  // confere se a playlist mudou no painel; a mudança entra no próximo conteúdo
  async function check() {
    try {
      const p = await fetchPlaylist();
      if (!p) return;
      const before = JSON.stringify(pl);
      if (JSON.stringify(p) === before) return;
      try { localStorage.setItem(memKey, JSON.stringify(p)); } catch (_) {}
      const themeChanged = (p.opcoes && p.opcoes.tema) !== (pl.opcoes && pl.opcoes.tema);
      pl = p;
      if (themeChanged && !urlTema) { restart(); return; }
      const curIt = cur && cur.it;
      seq = buildSeq(pl);
      // continua do item equivalente na nova sequência
      const same = seq.findIndex(x => curIt && x.modulo === curIt.modulo && x.assunto === curIt.assunto && x.layout === curIt.layout);
      pos = same >= 0 ? same : -1;
      if (cur) cur.k = pos;
      if (nxt) { drop(nxt); nxt = null; }
      if (cur) schedule(); else restart();
    } catch (_) { /* sem internet: segue com a que já tem */ }
  }

  async function init() {
    E.fit();
    lastOrient = E.ctx.orient;
    E.applyTheme();
    E.statusScreen('Carregando…', '', true);
    const client = await E.resolveClient(E.state.cliente);
    if (!client) { E.statusScreen('Tela não autorizada', 'O código desta tela não foi encontrado. Fale com o seu fornecedor de conteúdo para receber o link correto.'); return; }
    if (!client.ativo) { E.statusScreen('Tela suspensa', 'Este conteúdo está temporariamente indisponível. Fale com o seu fornecedor de conteúdo.'); return; }
    E.ctx.client = client;
    window.__rsCliente = client;
    document.title = client.nome;
    stage.classList.add('pl-stage');

    if (previa) {
      // painel > Playlists: recebe a playlist em edição (sem salvar)
      try { window.parent.postMessage({ rs: 'pl-previa-pronta' }, '*'); } catch (_) {}
      return;
    }

    try {
      pl = await fetchPlaylist();
      if (pl) { try { localStorage.setItem(memKey, JSON.stringify(pl)); } catch (_) {} }
      else { try { localStorage.removeItem(memKey); } catch (_) {} }
    } catch (_) {
      pl = saved();
    }
    if (!pl) {
      E.statusScreen('Playlist não encontrada', 'Esta playlist não existe mais. Fale com o seu fornecedor de conteúdo para receber o link correto.');
      return;
    }
    E.ok = () => !!cur;
    E.state.modulo = 'playlist';
    E.state.assunto = E.state.playlist;
    E.startPing();
    restart();
    setInterval(check, 10 * 60 * 1000);
  }

  // mudou de horizontal para vertical (ou o contrário): reabre com o formato certo
  let lastOrient = null;
  window.addEventListener('resize', () => {
    E.fit();
    if (lastOrient && E.ctx.orient !== lastOrient && pl) restart();
    lastOrient = E.ctx.orient;
  });

  init();
})();
