/* Módulo Relógio e Data — tudo calculado no aparelho (funciona sem internet). Layouts: digital, analogico, calendario */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc, pad = S.pad;

  function saudacao(h) {
    return h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  // atualiza segundos, ponteiros e saudação (o motor só atualiza HH:MM)
  function tick() {
    const now = new Date();
    document.querySelectorAll('.rl-sec').forEach(el => { el.textContent = pad(now.getSeconds()); });
    document.querySelectorAll('.rl-greet').forEach(el => { const g = saudacao(now.getHours()) + '!'; if (el.textContent !== g) el.textContent = g; });
    const s = now.getSeconds(), m = now.getMinutes() + s / 60, h = (now.getHours() % 12) + m / 60;
    document.querySelectorAll('.rl-hand-h').forEach(el => el.setAttribute('transform', 'rotate(' + (h * 30).toFixed(2) + ' 100 100)'));
    document.querySelectorAll('.rl-hand-m').forEach(el => el.setAttribute('transform', 'rotate(' + (m * 6).toFixed(2) + ' 100 100)'));
    document.querySelectorAll('.rl-hand-s').forEach(el => el.setAttribute('transform', 'rotate(' + (s * 6) + ' 100 100)'));
  }
  setInterval(tick, 500);

  function greet(ctx) {
    return ctx.assunto && ctx.assunto.id === 'simples' ? '' :
      '<div class="rl-greet rise">' + saudacao(new Date().getHours()) + '!</div>';
  }

  function dateBlock() {
    return '<div class="rl-week">' + S.clockHtml('weekday') + '</div><div class="rl-date">' + S.clockHtml('short') + ' de ' + new Date().getFullYear() + '</div>';
  }

  const L = {};

  L.digital = ctx =>
    '<div class="rl-bg"></div><div class="rl-center">' + greet(ctx) +
    '<div class="rl-time rise d1">' + S.clockHtml() + '<span class="rl-sec">' + pad(new Date().getSeconds()) + '</span></div>' +
    '<div class="rl-line rise d2"></div>' +
    '<div class="rl-dates rise d2">' + dateBlock() + '</div></div>';

  function analog() {
    let marks = '';
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      marks += '<line x1="100" y1="' + (big ? 12 : 14) + '" x2="100" y2="' + (big ? 26 : 19) + '" class="' + (big ? 'mk-b' : 'mk') + '" transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    return '<svg class="rl-svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="96" class="rl-face"/>' + marks +
      '<line x1="100" y1="108" x2="100" y2="52" class="rl-hand-h"/>' +
      '<line x1="100" y1="112" x2="100" y2="30" class="rl-hand-m"/>' +
      '<line x1="100" y1="118" x2="100" y2="24" class="rl-hand-s"/>' +
      '<circle cx="100" cy="100" r="5" class="rl-pin"/></svg>';
  }

  L.analogico = ctx =>
    '<div class="rl-bg"></div><div class="rl-split">' +
    '<div class="rl-clockwrap rise">' + analog() + '</div>' +
    '<div class="rl-side rise d1">' + greet(ctx) + '<div class="rl-time sm">' + S.clockHtml() + '</div>' + dateBlock() + '</div></div>';

  function calendar() {
    const now = new Date(), y = now.getFullYear(), mo = now.getMonth();
    const first = new Date(y, mo, 1).getDay(), days = new Date(y, mo + 1, 0).getDate();
    let cells = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => '<b>' + d + '</b>').join('');
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const wd = (first + d - 1) % 7;
      cells += '<span class="' + (d === now.getDate() ? 'today' : d < now.getDate() ? 'past' : '') + (wd === 0 ? ' sun' : '') + '">' + d + '</span>';
    }
    return '<div class="rl-cal"><div class="rl-cal-title">' + esc(S.MONTHS[mo]) + ' ' + y + '</div><div class="rl-cal-grid">' + cells + '</div></div>';
  }

  L.calendario = ctx =>
    '<div class="rl-bg"></div><div class="rl-split cal">' +
    '<div class="rl-side rise">' + greet(ctx) + '<div class="rl-time sm">' + S.clockHtml() + '</div>' + dateBlock() + '</div>' +
    '<div class="rise d1">' + calendar() + '</div></div>';

  S.register('relogio', {
    refreshMinutes: 60,
    rerenderOnRefresh: true,
    async load() { return [{ dia: new Date().toDateString() }]; },
    render(s, i, all, ctx) {
      setTimeout(tick, 0);
      return (L[ctx.layout] || L.digital)(ctx);
    }
  });
})();
