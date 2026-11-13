// Cloudflare Pages Function: GET /api/rss?url=<feed>
// Busca o XML do feed no servidor (sem bloqueio de CORS) e guarda em cache por 5 minutos.
// Só aceita domínios cadastrados em modules/rss/manifest.json — não é um proxy aberto.

const CACHE_SECONDS = 300;
let allowedHosts = null;
let allowedAt = 0;

async function getAllowedHosts(context) {
  if (allowedHosts && Date.now() - allowedAt < 10 * 60 * 1000) return allowedHosts;
  const hosts = new Set();
  try {
    const res = await context.env.ASSETS.fetch(new URL('/modules/rss/manifest.json', context.request.url));
    const manifest = await res.json();
    (manifest.assuntos || []).forEach(a => (a.fontes || []).forEach(f => {
      try { hosts.add(new URL(f.url).hostname); } catch (_) {}
    }));
  } catch (_) {}
  allowedHosts = hosts;
  allowedAt = Date.now();
  return hosts;
}

function reply(body, status, extra) {
  return new Response(body, {
    status,
    headers: Object.assign({
      'Content-Type': 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    }, extra || {})
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const feedUrl = new URL(request.url).searchParams.get('url');
  if (!feedUrl) return reply('Parâmetro url obrigatório', 400);

  let target;
  try { target = new URL(feedUrl); } catch (_) { return reply('URL inválida', 400); }
  if (!/^https?:$/.test(target.protocol)) return reply('Protocolo não permitido', 400);

  const hosts = await getAllowedHosts(context);
  if (!hosts.has(target.hostname)) return reply('Fonte não cadastrada', 403);

  const cache = caches.default;
  const cacheKey = new Request('https://rss-cache.rsscreen/' + encodeURIComponent(target.toString()));
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSScreenBot/1.0)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
      },
      cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
    if (!upstream.ok) return reply('Fonte respondeu ' + upstream.status, 502);
    const xml = await upstream.text();
    const res = new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=' + CACHE_SECONDS
      }
    });
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;
  } catch (err) {
    return reply('Erro ao buscar feed: ' + err.message, 502);
  }
}
