/* rsscreen — páginas do Guia e Ferramentas: ícones, menu, WhatsApp e ano */
(function () {
  'use strict';
  if (window.hydrateIcons) hydrateIcons();
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  window.wireWhatsApp = function (root) {
    (root || document).querySelectorAll('.js-wa').forEach(a => {
      a.href = RS.whatsappLink(RS.CFG.whatsapp, a.getAttribute('data-msg') || 'Olá! Vim pelo guia do rsscreen.');
      a.target = '_blank';
      a.rel = 'noopener';
    });
  };
  wireWhatsApp();

  const nav = document.getElementById('nav');
  const t = document.getElementById('navToggle');
  if (nav && t) t.addEventListener('click', () => nav.classList.toggle('open'));

  // formatação de dinheiro usada pelas ferramentas
  window.brl = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  window.brl0 = v => 'R$ ' + Math.round(Number(v || 0)).toLocaleString('pt-BR');
})();
