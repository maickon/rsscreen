/* rsscreen — landing page */
(function () {
  'use strict';
  const esc = RS.esc;
  const $ = s => document.querySelector(s);
  const demo = RS.demoClient();

  hydrateIcons();
  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- WhatsApp ---------- */
  function wireWhatsApp(root) {
    (root || document).querySelectorAll('.js-wa').forEach(a => {
      a.href = RS.whatsappLink(RS.CFG.whatsapp, a.getAttribute('data-msg') || 'Olá! Quero conhecer o rsscreen.');
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }
  wireWhatsApp();

  /* ---------- menu mobile ---------- */
  const nav = $('#nav');
  $('#navToggle').addEventListener('click', () => nav.classList.toggle('open'));
  document.querySelectorAll('#navLinks a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  /* ---------- telas de demonstração ---------- */
  function demoUrl(o) {
    if (!demo) return 'about:blank';
    return RS.buildScreenUrl(Object.assign({ cliente: demo.chave }, o));
  }

  if (demo) {
    $('#heroTv').src = demoUrl({ modulo: 'rss', assunto: 'ultimas', layout: 'destaque', orientacao: 'horizontal', tema: 'noite', tempo: 8 });
    $('#heroTotem').src = demoUrl({ modulo: 'clima', assunto: 'cabo-frio-rj', layout: 'agora', orientacao: 'vertical', tema: 'oceano' });
  } else {
    $('.hero-visual').style.display = 'none';
  }

  /* ---------- módulos e vitrine ---------- */
  const show = { modulo: 'rss', layout: '', orientacao: 'horizontal', tema: '' };
  let active = [];

  function moduleCard(m) {
    const soon = m.status !== 'ativo';
    const msg = 'Olá! Tenho interesse no conteúdo "' + m.nome + '" do rsscreen.';
    return '<article class="module' + (soon ? ' soon' : '') + '">' +
      '<div class="module-top"><div class="module-ico">' + ICON(m.icone || 'sparkles') + '</div>' +
        (soon ? '<span class="badge">Em breve</span>' : (m.tag ? '<span class="badge badge-brand">' + esc(m.tag) + '</span>' : '<span class="badge badge-ok">Disponível</span>')) +
      '</div>' +
      '<h3>' + esc(m.nome) + '</h3>' +
      '<p class="hook">' + esc(m.chamada || '') + '</p>' +
      '<p class="desc">' + esc(m.descricao || '') + '</p>' +
      (m.beneficios ? '<ul>' + m.beneficios.map(b => '<li>' + ICON('check') + '<span>' + esc(b) + '</span></li>').join('') + '</ul>' : '') +
      (m.indicado ? '<div class="for">' + m.indicado.map(i => '<span>' + esc(i) + '</span>').join('') + '</div>' : '') +
      '<a class="btn ' + (soon ? 'btn-ghost' : 'btn-dark') + ' btn-sm js-wa" data-msg="' + esc(soon ? 'Olá! Quero ser avisado quando o conteúdo "' + m.nome + '" do rsscreen estiver disponível.' : msg) + '" href="#">' +
        ICON('whatsapp') + (soon ? 'Quero ser avisado' : 'Quero este conteúdo') + '</a>' +
    '</article>';
  }

  function renderShowcase() {
    const m = active.find(x => x.id === show.modulo) || active[0];
    if (!m) return;
    if (!m.layouts.some(l => l.id === show.layout)) show.layout = m.layouts[0].id;
    if (!show.tema) show.tema = (m.padrao && m.padrao.tema) || 'noite';

    $('#showModule').innerHTML = active.map(x =>
      '<button data-m="' + x.id + '" class="' + (x.id === m.id ? 'on' : '') + '">' + ICON(x.icone) + esc(x.nome) + '</button>').join('');
    $('#layoutList').innerHTML = m.layouts.map(l =>
      '<li><button data-l="' + l.id + '" class="' + (l.id === show.layout ? 'on' : '') + '"><b>' + esc(l.nome) + '</b><span>' + esc(l.descricao || '') + '</span></button></li>').join('');
    $('#themeRow').innerHTML = '<span>Cores:</span>' + RS.THEMES.map(t =>
      '<button class="theme-dot' + (t.id === show.tema ? ' on' : '') + '" data-t="' + t.id + '" title="' + esc(t.nome) + '" style="background:' + t.bg + '"><i style="background:' + t.accent + '"></i></button>').join('');

    const dev = $('#showDevice');
    dev.className = show.orientacao === 'vertical' ? 'device-totem' : 'device-tv';
    const pad_ = m.padrao || {};
    const url = demoUrl({ modulo: m.id, assunto: pad_.assunto, layout: show.layout, orientacao: show.orientacao, tema: show.tema, tempo: 8 });
    const frame = $('#showFrame');
    if (frame.dataset.wanted !== url) {
      frame.dataset.wanted = url;
      if (frame.dataset.visible === '1') frame.src = url;
    }
  }

  $('#showModule').addEventListener('click', e => {
    const b = e.target.closest('button[data-m]');
    if (!b) return;
    show.modulo = b.dataset.m; show.layout = ''; show.tema = '';
    renderShowcase();
  });
  $('#layoutList').addEventListener('click', e => {
    const b = e.target.closest('button[data-l]');
    if (!b) return;
    show.layout = b.dataset.l;
    renderShowcase();
  });
  $('#themeRow').addEventListener('click', e => {
    const b = e.target.closest('button[data-t]');
    if (!b) return;
    show.tema = b.dataset.t;
    renderShowcase();
  });
  $('#showOrient').addEventListener('click', e => {
    const b = e.target.closest('button[data-o]');
    if (!b) return;
    show.orientacao = b.dataset.o;
    document.querySelectorAll('#showOrient button').forEach(x => x.classList.toggle('on', x === b));
    renderShowcase();
  });

  // Só carrega a vitrine quando ela aparece na tela (economiza dados no celular)
  const frame = $('#showFrame');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries, obs) => {
      if (entries.some(en => en.isIntersecting)) {
        frame.dataset.visible = '1';
        if (frame.dataset.wanted) frame.src = frame.dataset.wanted;
        obs.disconnect();
      }
    }, { rootMargin: '200px' }).observe($('#modelos'));
  } else {
    frame.dataset.visible = '1';
  }
  if (!demo) $('#showStage').innerHTML = '<p style="color:var(--ink-muted)">Cadastre um cliente com <code>demo: true</code> em config/clientes.js para exibir as telas ao vivo.</p>';

  /* ---------- segmentos ---------- */
  function screenLabel(t) {
    const m = active.find(x => x.id === t.modulo);
    if (!m) return '';
    const a = (m.assuntos || []).find(x => x.id === t.assunto);
    const ico = m.id === 'clima' ? 'sun' : m.id === 'cotacoes' ? 'chart' : 'news';
    const name = m.id === 'rss' ? (a ? a.nome : t.assunto) : m.id === 'clima' ? 'Clima' : 'Cotações';
    return '<span>' + ICON(ico) + esc(name) + '</span>';
  }

  async function renderSegments() {
    try {
      const data = await RS.fetchJson(RS.ROOT_URL + 'modules/pacotes.json');
      $('#segmentsGrid').innerHTML = data.pacotes.map(p =>
        '<article class="segment">' +
          '<h3>' + esc(p.nome) + '</h3>' +
          '<p>' + esc(p.porque) + '</p>' +
          '<div class="screens">' + Array.from(new Set(p.telas.map(screenLabel))).join('') + '</div>' +
          '<a class="js-wa" data-msg="' + esc('Olá! Tenho interesse no pacote "' + p.nome + '" do rsscreen.') + '" href="#">Quero este pacote ' + ICON('arrow') + '</a>' +
        '</article>').join('');
      wireWhatsApp($('#segmentsGrid'));
    } catch (e) {
      $('#segmentos').style.display = 'none';
    }
  }

  (async function init() {
    try {
      const mods = await RS.loadModules();
      active = mods.filter(m => m.status === 'ativo');
      $('#modulesGrid').innerHTML = mods.map(moduleCard).join('');
      wireWhatsApp($('#modulesGrid'));
      const assuntos = active.reduce((s, m) => s + (m.id === 'rss' ? (m.assuntos || []).length : 0), 0);
      const layouts = active.reduce((s, m) => s + (m.layouts || []).length, 0);
      $('[data-stat="assuntos"]').textContent = assuntos + '+';
      $('[data-stat="layouts"]').textContent = layouts;
      renderShowcase();
    } catch (e) {
      console.error(e);
      $('#modulesGrid').innerHTML = '<p>Não foi possível carregar os módulos.</p>';
    }
    renderSegments();
  })();

  RS.registerSW();
})();
