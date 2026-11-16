/* rsscreen — telas ao vivo nas páginas de modelos do site.
   <div class="tv-live" data-tela="modulo=anuncios&assunto=exemplo&anuncio=m1"></div>
   vira um iframe com o cliente de demonstração, carregado só quando aparece na tela. */
(function () {
  'use strict';
  const demo = RS.demoClient && RS.demoClient();
  const els = Array.prototype.slice.call(document.querySelectorAll('.tv-live[data-tela]'));
  if (!demo || !els.length) { els.forEach(el => el.remove()); return; }
  function carrega(el) {
    if (el.dataset.ok) return;
    el.dataset.ok = '1';
    const q = new URLSearchParams(el.dataset.tela);
    const base = RS.buildScreenUrl({ cliente: demo.chave, modulo: q.get('modulo'), assunto: q.get('assunto'), layout: q.get('layout') || '', orientacao: q.get('orientacao') || 'horizontal', tema: q.get('tema') || '', tempo: q.get('tempo') || '' });
    const extra = ['anuncio', 'seg', 'modelo', 'foto'].filter(k => q.get(k)).map(k => '&' + k + '=' + encodeURIComponent(q.get(k))).join('');
    const f = document.createElement('iframe');
    f.src = base + extra; f.title = el.dataset.titulo || 'Tela ao vivo'; f.loading = 'lazy';
    el.innerHTML = '<div class="device-tv"><div class="screen"></div></div>';
    el.querySelector('.screen').appendChild(f);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { carrega(e.target); io.unobserve(e.target); } }), { rootMargin: '300px' });
    els.forEach(el => io.observe(el));
  } else els.forEach(carrega);
})();
