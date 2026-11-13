/* Módulo RSS — lê feeds, normaliza notícias e renderiza 7 layouts (horizontal e vertical) */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
  const MRSS = 'http://search.yahoo.com/mrss/';

  /* ---------- leitura do feed ---------- */
  function htmlToText(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
    return (doc.body.textContent || '')
      .replace(/\s+/g, ' ')
      .replace(/(The post|O post) .{0,200}(appeared first on|apareceu primeiro em) .*$/i, '')
      .replace(/(Leia mais|Continue lendo|Saiba mais)\s*[:.»›]?\s*$/i, '')
      .replace(/\[(…|\.\.\.)\]\s*$/, '…')
      .trim();
  }

  function firstText(node, names) {
    for (const n of names) {
      const el = node.getElementsByTagName(n)[0];
      if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  // ignora logos, pixels de rastreio e ícones que alguns feeds colocam no lugar da foto
  const BAD_IMG = /logo|\.svg(\?|$)|ebc\.(png|gif)|pixel|tracking|feedburner|gravatar|emoji|spacer|1x1|blank\.(gif|png)/i;

  function imgFromHtml(html) {
    if (!html) return '';
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html))) {
      const src = m[1].replace(/&amp;/g, '&');
      if (!BAD_IMG.test(src)) return src;
    }
    return '';
  }

  function pickImage(node, rawHtml) {
    // media:content / media:thumbnail (escolhe a maior)
    let best = '', bestW = -1;
    const medias = [].concat(
      Array.from(node.getElementsByTagName('media:content')),
      Array.from(node.getElementsByTagNameNS ? node.getElementsByTagNameNS(MRSS, 'content') : []),
      Array.from(node.getElementsByTagName('media:thumbnail')),
      Array.from(node.getElementsByTagNameNS ? node.getElementsByTagNameNS(MRSS, 'thumbnail') : [])
    );
    medias.forEach(m => {
      const url = m.getAttribute('url');
      const type = m.getAttribute('type') || m.getAttribute('medium') || 'image';
      if (!url || BAD_IMG.test(url) || !/image|jpe?g|png|webp/i.test(type + url)) return;
      const w = Number(m.getAttribute('width')) || 0;
      if (w > bestW) { best = url; bestW = w; }
    });
    if (best) return best;
    const enc = node.getElementsByTagName('enclosure')[0];
    if (enc && enc.getAttribute('url') && /image|jpe?g|png|webp/i.test((enc.getAttribute('type') || '') + enc.getAttribute('url'))) {
      return enc.getAttribute('url');
    }
    return imgFromHtml(rawHtml);
  }

  // Aceita datas RFC 822 em inglês ou português ("Qui, 12 Nov 2026 ...") e ISO
  const PT_MONTHS = { fev: 'Feb', abr: 'Apr', mai: 'May', ago: 'Aug', set: 'Sep', out: 'Oct', dez: 'Dec' };
  function parseDate(str) {
    if (!str) return 0;
    let t = Date.parse(str);
    if (!isNaN(t)) return t;
    const clean = str.replace(/^[^,\d]+,\s*/, '').replace(/(fev|abr|mai|ago|set|out|dez)[a-zç]*/i, m => PT_MONTHS[m.slice(0, 3).toLowerCase()] || m);
    t = Date.parse(clean);
    return isNaN(t) ? 0 : t;
  }

  function parseFeed(xml, fonte) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const nodes = Array.from(doc.querySelectorAll('item, entry'));
    const items = [];
    nodes.forEach(node => {
      const titulo = htmlToText(firstText(node, ['title']));
      if (!titulo || titulo.length < 12) return;
      const encoded = firstText(node, ['content:encoded']);
      const desc = firstText(node, ['description', 'summary', 'content']);
      const rawHtml = encoded || desc;
      let resumo = htmlToText(desc || encoded);
      if (resumo.toLowerCase().indexOf(titulo.toLowerCase().slice(0, 40)) === 0) resumo = resumo.slice(titulo.length).trim();
      if (resumo.length > 240) resumo = resumo.slice(0, 236).replace(/\s+\S*$/, '') + '…';
      let imagem = pickImage(node, rawHtml);
      if (imagem && imagem.indexOf('//') === 0) imagem = 'https:' + imagem;
      if (imagem && imagem.indexOf('http://') === 0) imagem = 'https://' + imagem.slice(7);
      const dateStr = firstText(node, ['pubDate', 'published', 'updated', 'dc:date']);
      const ts = parseDate(dateStr);
      items.push({ titulo, resumo, imagem, fonte: fonte.nome, data: ts });
    });
    items.sort((a, b) => b.data - a.data);
    return items.slice(0, 10);
  }

  async function load(ctx) {
    const fontes = ctx.fonte ? [ctx.fonte] : (ctx.assunto.fontes || []).slice(0, 4);
    const results = await Promise.allSettled(fontes.map(f => S.fetchText(f.url).then(x => parseFeed(x, f))));
    const lists = results.filter(r => r.status === 'fulfilled' && r.value.length).map(r => r.value);
    if (!lists.length) throw new Error('Nenhuma fonte respondeu');
    // intercala as fontes e remove manchetes repetidas
    const out = [], seen = new Set();
    const max = Math.max.apply(null, lists.map(l => l.length));
    for (let i = 0; i < max; i++) {
      lists.forEach(l => {
        const it = l[i];
        if (!it) return;
        const k = RS.normalize(it.titulo).slice(0, 60);
        if (seen.has(k)) return;
        seen.add(k);
        out.push(it);
      });
    }
    // prioriza notícias dos últimos 4 dias quando houver volume suficiente
    const limit = Date.now() - 4 * 86400000;
    const fresh = out.filter(it => !it.data || it.data >= limit);
    return (fresh.length >= 6 ? fresh : out).slice(0, 20);
  }

  /* ---------- peças ---------- */
  function meta(it) {
    const ago = S.timeAgo(it.data);
    return '<div class="meta"><span>' + esc(it.fonte) + '</span>' + (ago ? '<i class="dot"></i><span>' + esc(ago) + '</span>' : '') + '</div>';
  }
  const chip = ctx => '<span class="chip">' + esc(ctx.assunto.nome) + '</span>';

  /* ---------- layouts ---------- */
  const L = {};

  L.destaque = (it, i, all, ctx) =>
    S.media(it.imagem, ctx.assunto.nome) +
    '<div class="r-shade"></div>' +
    '<div class="r-top">' + chip(ctx) + '<div class="r-clock">' + S.clockHtml() + '</div></div>' +
    '<div class="r-bottom">' +
      '<h1 class="r-title clamp-3 rise">' + esc(it.titulo) + '</h1>' +
      (it.resumo ? '<p class="r-sum clamp-3 rise d1">' + esc(it.resumo) + '</p>' : '') +
      '<div class="rise d2">' + meta(it) + '</div>' +
    '</div>';

  L.revista = (it, i, all, ctx) => {
    const next = all[(i + 1) % all.length];
    return '<div class="r-photo">' + S.media(it.imagem, ctx.assunto.nome) + '</div>' +
      '<div class="r-panel">' +
        '<div class="r-head">' + chip(ctx) + '<span class="r-clock">' + S.clockHtml() + '</span></div>' +
        '<div class="r-body">' +
          '<h1 class="r-title clamp-4 rise">' + esc(it.titulo) + '</h1>' +
          (it.resumo ? '<p class="r-sum clamp-4 rise d1">' + esc(it.resumo) + '</p>' : '') +
          '<div class="rise d2">' + meta(it) + '</div>' +
        '</div>' +
        (all.length > 1 ? '<div class="r-next"><small>A seguir</small><p class="clamp-2">' + esc(next.titulo) + '</p></div>' : '') +
      '</div>';
  };

  L.cartao = (it, i, all, ctx) =>
    '<div class="r-blur">' + (it.imagem ? '<img src="' + esc(it.imagem) + '" alt="" referrerpolicy="no-referrer" onerror="this.remove()">' : '') + '</div>' +
    '<div class="r-tint"></div>' +
    '<div class="r-corner">' + S.clockHtml() + '<span>' + S.clockHtml('date') + '</span></div>' +
    '<div class="r-card rise">' +
      '<div class="r-card-media">' + S.media(it.imagem, ctx.assunto.nome) + '</div>' +
      '<div class="r-card-body">' +
        chip(ctx) +
        '<h1 class="r-title clamp-4">' + esc(it.titulo) + '</h1>' +
        (it.resumo ? '<p class="r-sum clamp-3">' + esc(it.resumo) + '</p>' : '') +
        meta(it) +
      '</div>' +
    '</div>';

  L.manchetes = (it, i, all, ctx) => {
    const list = [];
    for (let k = 1; k <= Math.min(4, all.length - 1); k++) list.push(all[(i + k) % all.length]);
    return '<div class="r-feat">' + S.media(it.imagem, ctx.assunto.nome) +
        '<div class="r-shade"></div>' +
        '<div class="r-feat-txt">' + chip(ctx) +
          '<h1 class="r-title clamp-3 rise">' + esc(it.titulo) + '</h1>' +
          '<div class="rise d1">' + meta(it) + '</div>' +
        '</div>' +
      '</div>' +
      '<aside class="r-list">' +
        '<div class="r-list-head"><span>Principais manchetes</span><span class="r-clock">' + S.clockHtml() + '</span></div>' +
        list.map((n, k) =>
          '<div class="r-li rise d' + Math.min(3, k + 1) + '">' +
            '<b>' + (k + 2) + '</b>' +
            '<div><p class="clamp-2">' + esc(n.titulo) + '</p>' + meta(n) + '</div>' +
          '</div>').join('') +
      '</aside>';
  };

  L.faixa = (it, i, all, ctx) => {
    const text = all.map(n => esc(n.titulo)).join('<i class="sep"></i>');
    const dur = Math.max(30, Math.round(all.reduce((s, n) => s + n.titulo.length, 0) * 0.16));
    const delay = -((Date.now() / 1000) % dur);
    return S.media(it.imagem, ctx.assunto.nome) +
      '<div class="r-shade"></div>' +
      '<div class="r-band">' +
        '<div class="r-band-txt">' + chip(ctx) +
          '<h1 class="r-title clamp-2 rise">' + esc(it.titulo) + '</h1>' +
          '<div class="rise d1">' + meta(it) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="r-ticker">' +
        '<div class="r-ticker-clock">' + S.clockHtml() + '</div>' +
        '<div class="r-ticker-win"><div class="r-ticker-track" style="animation-duration:' + dur + 's;animation-delay:' + delay.toFixed(1) + 's">' +
          '<span>' + text + '<i class="sep"></i></span><span>' + text + '<i class="sep"></i></span>' +
        '</div></div>' +
      '</div>';
  };

  L.lateral = (it, i, all, ctx) =>
    '<aside class="r-side">' +
      '<div class="r-side-clock"><span class="r-wd">' + S.clockHtml('weekday') + '</span>' + S.clockHtml() + '<span class="r-dt">' + S.clockHtml('short') + '</span></div>' +
      '<div class="r-side-news">' + chip(ctx) +
        '<h1 class="r-title clamp-5 rise">' + esc(it.titulo) + '</h1>' +
        '<div class="rise d1">' + meta(it) + '</div>' +
      '</div>' +
    '</aside>' +
    '<div class="r-photo">' + S.media(it.imagem, ctx.assunto.nome) + '</div>';

  L.texto = (it, i, all, ctx) =>
    '<div class="r-glow"></div>' +
    '<div class="r-num">' + S.pad(i + 1) + '</div>' +
    '<div class="r-top">' + chip(ctx) + '<div class="r-clock">' + S.clockHtml() + '</div></div>' +
    '<div class="r-center">' +
      '<h1 class="r-title clamp-4 rise">' + esc(it.titulo) + '</h1>' +
      (it.resumo ? '<p class="r-sum clamp-3 rise d1">' + esc(it.resumo) + '</p>' : '') +
    '</div>' +
    '<div class="r-foot">' + meta(it) +
      '<div class="r-dots">' + all.slice(0, 12).map((_, k) => '<i' + (k === i % 12 ? ' class="on"' : '') + '></i>').join('') + '</div>' +
    '</div>';

  S.register('rss', {
    refreshMinutes: 10,
    load,
    render(it, i, all, ctx) {
      return (L[ctx.layout] || L.destaque)(it, i, all, ctx);
    },
    duration(it, ctx) {
      // manchetes muito longas ganham um pouco mais de tempo
      return ctx.tempo + (it && it.titulo.length > 110 ? 2 : 0);
    }
  });
})();
