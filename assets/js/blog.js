/* rsscreen — busca do blog: filtra os artigos da página enquanto a pessoa digita */
(function () {
  'use strict';
  const inp = document.getElementById('blogBusca');
  if (!inp) return;
  const cards = Array.prototype.slice.call(document.querySelectorAll('#postGrid .post-card'));
  const vazio = document.getElementById('blogVazio');
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function filtra() {
    const termos = norm(inp.value).split(/\s+/).filter(Boolean);
    let n = 0;
    cards.forEach(c => {
      const t = norm(c.dataset.busca);
      const ok = termos.every(x => t.indexOf(x) >= 0);
      c.hidden = !ok; if (ok) n++;
    });
    if (vazio) vazio.hidden = n > 0;
  }
  inp.addEventListener('input', filtra);
  const q = new URLSearchParams(location.search).get('q');
  if (q) { inp.value = q; filtra(); }
})();
