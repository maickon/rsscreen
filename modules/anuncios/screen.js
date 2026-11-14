/* Módulo Anúncios: lê /api/anuncios?cliente=<chave>. Modelos: oferta, servico, aviso, evento, imagem, video.
   Com &previa=1 recebe o anúncio do painel por postMessage (prévia ao vivo, sem salvar). */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
  const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

  /* ---------- prévia vinda do painel ---------- */
  let previa = null, previaWait = null;
  if (S.previa) {
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.rs !== 'previa') return;
      previa = d.anuncios || [];
      if (previaWait) { previaWait(); previaWait = null; } else S.reload();
    });
    try { window.parent.postMessage({ rs: 'previa-pronta' }, '*'); } catch (_) {}
  }

  const VAZIO = [{ id: 'vazio', modelo: 'aviso', anunciante: '', duracao: 15, dados: { selo: 'Espaço disponível', titulo: 'Anuncie aqui', texto: 'Sua marca nesta tela, para todo mundo que passa por aqui. Fale com o responsável pelo estabelecimento.' } }];

  async function load(ctx) {
    if (S.previa) {
      if (!previa) await new Promise(r => { previaWait = r; });
      return previa.length ? previa : VAZIO;
    }
    const d = await S.fetchJson(RS.ROOT_URL + 'api/anuncios?cliente=' + encodeURIComponent(ctx.client.chave) + '&_=' + Math.floor(Date.now() / 60000));
    return d.anuncios && d.anuncios.length ? d.anuncios : VAZIO;
  }

  /* ---------- peças ---------- */
  function imgUrl(a) {
    if (a.dados && a.dados.imagemUrl) return a.dados.imagemUrl;
    return a.midia ? RS.ROOT_URL + 'api/midia/' + a.midia : '';
  }

  function photo(a, cls) {
    const u = imgUrl(a);
    if (!u) return '';
    return '<div class="ad-photo ' + (cls || '') + '"><img class="kb" src="' + esc(u) + '" alt="" onerror="this.remove()"></div>';
  }

  // "9,99" | "R$ 1.299,90" | "9.99" → [reais, centavos]
  function price(v) {
    const s = String(v || '').replace(/[^\d.,]/g, '');
    if (!s) return null;
    let n;
    if (/,\d{1,2}$/.test(s)) n = Number(s.replace(/\./g, '').replace(',', '.'));
    else if (/\.\d{1,2}$/.test(s)) n = Number(s.replace(/,/g, ''));
    else n = Number(s.replace(/[.,]/g, ''));
    if (!isFinite(n)) return null;
    const p = n.toFixed(2).split('.');
    return [Number(p[0]).toLocaleString('pt-BR'), p[1]];
  }

  function priceBlock(d) {
    const por = price(d.preco);
    if (!por) return '';
    const de = price(d.precoDe);
    return '<div class="ad-price">' +
      (de ? '<div class="ad-de">de <s>R$ ' + de[0] + ',' + de[1] + '</s> por</div>' : '') +
      '<div class="ad-por"><small>R$</small><b>' + por[0] + '</b><span>,' + por[1] + '</span></div>' +
      (d.cta ? '<div class="ad-cta-small">' + esc(d.cta) + '</div>' : '') +
    '</div>';
  }

  function contacts(a) {
    const d = a.dados || {};
    const parts = [];
    if (d.whatsapp) parts.push('<span><i class="ad-ico wa"></i>' + esc(d.whatsapp) + '</span>');
    if (d.instagram) parts.push('<span><i class="ad-ico ig"></i>' + esc(d.instagram.charAt(0) === '@' ? d.instagram : '@' + d.instagram) + '</span>');
    if (d.endereco) parts.push('<span><i class="ad-ico pin"></i>' + esc(d.endereco) + '</span>');
    if (!parts.length && !a.anunciante) return '';
    return '<div class="ad-foot">' + (a.anunciante ? '<b>' + esc(a.anunciante) + '</b>' : '') + parts.join('') + '</div>';
  }

  const lines = t => String(t || '').split(/\n|;/).map(x => x.trim()).filter(Boolean);

  /* ---------- modelos ---------- */
  const M = {};

  M.oferta = a => {
    const d = a.dados || {};
    const has = !!imgUrl(a);
    return '<div class="ad ad-oferta' + (has ? '' : ' no-photo') + '">' +
      (has ? photo(a) : '') +
      '<div class="ad-panel">' +
        (d.selo ? '<span class="ad-selo rise">' + esc(d.selo) + '</span>' : '') +
        '<h1 class="ad-title clamp-3 rise d1">' + esc(d.titulo || a.anunciante || '') + '</h1>' +
        (d.subtitulo ? '<p class="ad-sub clamp-3 rise d1">' + esc(d.subtitulo) + '</p>' : '') +
        '<div class="rise d2">' + priceBlock(d) + '</div>' +
        (d.texto ? '<p class="ad-note clamp-2">' + esc(d.texto) + '</p>' : '') +
        contacts(a) +
      '</div></div>';
  };

  M.servico = a => {
    const d = a.dados || {};
    const itens = lines(d.itens).slice(0, 5);
    const has = !!imgUrl(a);
    return '<div class="ad ad-servico' + (has ? '' : ' no-photo') + '">' +
      '<div class="ad-panel">' +
        (d.selo ? '<span class="ad-selo rise">' + esc(d.selo) + '</span>' : '') +
        '<h1 class="ad-brand clamp-2 rise d1">' + esc(d.titulo || a.anunciante || '') + '</h1>' +
        (d.subtitulo ? '<p class="ad-sub clamp-2 rise d1">' + esc(d.subtitulo) + '</p>' : '') +
        (itens.length ? '<ul class="ad-list rise d2">' + itens.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
        (d.cta ? '<div class="ad-cta rise d3">' + esc(d.cta) + '</div>' : '') +
        contacts(Object.assign({}, a, { anunciante: d.titulo ? a.anunciante : '' })) +
      '</div>' +
      (has ? photo(a) : '') +
    '</div>';
  };

  M.aviso = a => {
    const d = a.dados || {};
    return '<div class="ad ad-aviso">' +
      '<div class="ad-glow"></div>' +
      (d.selo ? '<span class="ad-selo rise">' + esc(d.selo) + '</span>' : '') +
      '<h1 class="ad-big clamp-3 rise d1">' + esc(d.titulo || '') + '</h1>' +
      (d.texto ? '<p class="ad-text clamp-4 rise d2">' + esc(d.texto) + '</p>' : '') +
      (d.cta ? '<div class="ad-cta rise d3">' + esc(d.cta) + '</div>' : '') +
      contacts(a) +
    '</div>';
  };

  M.evento = a => {
    const d = a.dados || {};
    let dd = '', mm = '';
    const m = String(d.data || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) { dd = m[3]; mm = MESES[Number(m[2]) - 1]; }
    return '<div class="ad ad-evento">' +
      photo(a, 'bg') + '<div class="ad-shade"></div>' +
      '<div class="ad-ev">' +
        (dd ? '<div class="ad-date rise"><b>' + dd + '</b><span>' + mm + '</span></div>' : '') +
        '<div class="ad-ev-txt">' +
          (d.selo ? '<span class="ad-selo rise">' + esc(d.selo) + '</span>' : '') +
          '<h1 class="ad-title clamp-3 rise d1">' + esc(d.titulo || '') + '</h1>' +
          '<div class="ad-when rise d2">' + [d.hora ? esc(d.hora) : '', d.local ? esc(d.local) : ''].filter(Boolean).join(' · ') + '</div>' +
          (d.texto ? '<p class="ad-sub clamp-2 rise d2">' + esc(d.texto) + '</p>' : '') +
          (d.cta ? '<div class="ad-cta rise d3">' + esc(d.cta) + '</div>' : '') +
        '</div>' +
      '</div>' + contacts(a) +
    '</div>';
  };

  M.imagem = a => {
    const u = imgUrl(a);
    const fit = (a.dados && a.dados.ajuste) === 'conter' ? 'contain' : 'cover';
    if (!u) return M.aviso(a);
    return '<div class="ad ad-imagem fit-' + fit + '">' +
      (fit === 'contain' ? '<img class="ad-blur" src="' + esc(u) + '" alt="">' : '') +
      '<img class="ad-full" src="' + esc(u) + '" alt="">' +
    '</div>';
  };

  M.video = a => {
    const v = a.dados && a.dados.video;
    if (!v) return M.aviso(a);
    const fit = (a.dados && a.dados.ajuste) === 'conter' ? 'contain' : 'cover';
    return '<div class="ad ad-video fit-' + fit + '"><video src="' + esc(v) + '" autoplay muted loop playsinline preload="auto"></video></div>';
  };

  S.register('anuncios', {
    refreshMinutes: 10,
    load,
    render(a, i, all, ctx) {
      const cor = (a.dados && a.dados.cor) || '';
      const html = (M[a.modelo] || M.oferta)(a);
      const moldura = ctx.layout === 'moldura'
        ? '<div class="ad-bar"><span>' + S.clockHtml('date') + '</span><b>' + S.clockHtml() + '</b></div>' : '';
      return '<div class="ad-wrap' + (moldura ? ' has-bar' : '') + '"' + (cor ? ' style="--lc:' + esc(cor) + '"' : '') + '>' + html + moldura + '</div>';
    },
    duration(a) {
      return a && a.duracao ? a.duracao : 0;
    }
  });
})();
