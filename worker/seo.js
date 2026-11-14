// robots.txt e sitemap.xml com o endereço real do site (usado pelo Worker e pelo Pages).
export async function seo(path, url, env, request) {
  const origin = url.origin;
  if (path === '/robots.txt') {
    const txt = ['User-agent: *', 'Allow: /', 'Disallow: /painel/', 'Disallow: /tela/', 'Disallow: /editar/', 'Disallow: /api/', 'Disallow: /admin', '', 'Sitemap: ' + origin + '/sitemap.xml', ''].join('\n');
    return new Response(txt,
      { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }
  let pages = [];
  try { pages = await (await env.ASSETS.fetch(new URL('/guia/paginas.json', request.url))).json(); } catch (_) {}
  const urls = [{ url: '/', atualizado: '' }].concat(pages);
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    .concat(urls.map(p => '  <url><loc>' + origin + p.url + '</loc>' + (p.atualizado ? '<lastmod>' + p.atualizado + '</lastmod>' : '') + '</url>'))
    .concat(['</urlset>', '']).join('\n');
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}

