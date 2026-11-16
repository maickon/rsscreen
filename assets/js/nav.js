/* rsscreen — menu do site: submenus abrem com clique (celular e teclado) e fecham ao clicar fora */
(function () {
  'use strict';
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.querySelectorAll('.nav-item > .nav-top').forEach(b => b.addEventListener('click', e => {
    const it = b.parentElement, abrir = !it.classList.contains('open');
    nav.querySelectorAll('.nav-item.open').forEach(x => { x.classList.remove('open'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
    if (abrir) { it.classList.add('open'); b.setAttribute('aria-expanded', 'true'); }
    e.stopPropagation();
  }));
  document.addEventListener('click', e => { if (!nav.contains(e.target)) nav.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open')); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') nav.querySelectorAll('.nav-item.open').forEach(x => x.classList.remove('open')); });
  nav.querySelectorAll('.nav-drop a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
})();
