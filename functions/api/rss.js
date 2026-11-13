// Cloudflare Pages Function (também usada pelo Worker em worker/index.js)
//
//   GET /api/rss?url=<feed>          → XML do feed, sem bloqueio de CORS (cache 5 min)
//   GET /api/rss?og=1&url=<notícia>  → {"image": "..."} com a imagem principal da página (cache 1 dia)
//
// Só aceita sites cadastrados em modules/rss/manifest.json — não é um proxy aberto.

const FEED_TTL = 300;
const OG_TTL = 86400;
const UA = 'Mozilla/5.0 (compatible; RSScreenBot/1.0)';
let allowed = null;
let allowedAt = 0;

// "feeds.folha.uol.com.br" → "uol.com.br" (para aceitar links de subdomínios do mesmo site)
function baseDomain(host) {
  const p = host.toLowerCase().split('.');
  const n = /^(com|net|org|gov|edu|art|blog|jor|tv)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? 3 : 2;
  return p.slice(-n).join('.');
}

async function getAllowed(context) {
  if (allowed && Date.now() - allowedAt < 10 * 60 * 1000) return allowed;
  const hosts = new Set(), bases = new Set();
  try {
    const res = await context.env.ASSETS.fetch(new URL('/modules/rss/manifest.json', context.request.url));
    const manifest = await res.json();
    (manifest.assuntos || []).forEach(a => (a.fontes || []).forEach(f => {
      try {
        const h = new URL(f.url).hostname;
        hosts.add(h);
        bases.add(baseDomain(h));
      } catch (_) {}
    }));
  } catch (_) {}
  allowed = { hosts, bases };
  allowedAt = Date.now();
  return allowed;
}

function reply(body, status, extra) {
  return new Response(body, {
    status,
    headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }, extra || {})
  });
}

function json(obj, ttl) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=' + ttl
    }
  });
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&#0?38;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/gi, '/');
}

// Procura og:image / twitter:image / image_src no início do HTML
function findImage(html, pageUrl) {
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const wanted = ['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'];
  for (const key of wanted) {
    for (const m of metas) {
      const prop = (m.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (!prop || prop.toLowerCase() !== key) continue;
      const content = (m.match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [])[1];
      if (content) {
        try { return new URL(decode(content.trim()), pageUrl).toString(); } catch (_) {}
      }
    }
  }
  const link = html.match(/<link\b[^>]*rel=["']image_src["'][^>]*>/i);
  if (link) {
    const href = (link[0].match(/href=["']([^"']+)["']/i) || [])[1];
    if (href) { try { return new URL(decode(href), pageUrl).toString(); } catch (_) {} }
  }
  return '';
}

async function readStart(res, limit) {
  if (!res.body) return res.text();
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = '';
  while (out.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
    if (/<\/head>/i.test(out)) break;
  }
  try { reader.cancel(); } catch (_) {}
  return out;
}

async function handleOg(context, target) {
  const cache = caches.default;
  const key = new Request('https://og-cache.rsscreen/' + encodeURIComponent(target.toString()));
  const hit = await cache.match(key);
  if (hit) return hit;
  let image = '';
  try {
    const page = await fetch(target.toString(), { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' }, redirect: 'follow' });
    if (page.ok) image = findImage(await readStart(page, 700000), page.url || target.toString());
  } catch (_) {}
  const res = json({ image }, image ? OG_TTL : 3600);
  context.waitUntil(cache.put(key, res.clone()));
  return res;
}

// Converte feeds em ISO-8859-1/Windows-1252 (ex.: Folha) para UTF-8, sem quebrar acentos
async function decodeFeed(res) {
  const buf = await res.arrayBuffer();
  const head = new TextDecoder('ascii').decode(buf.slice(0, 300));
  const fromHeader = ((res.headers.get('content-type') || '').match(/charset=([\w-]+)/i) || [])[1];
  const fromXml = (head.match(/encoding=["']([\w-]+)["']/i) || [])[1];
  let charset = (fromXml || fromHeader || 'utf-8').toLowerCase();
  let text;
  try { text = new TextDecoder(charset).decode(buf); } catch (_) { charset = 'utf-8'; text = new TextDecoder('utf-8').decode(buf); }
  return charset === 'utf-8' ? text : text.replace(/(<\?xml[^>]*encoding=["'])[\w-]+(["'])/i, '$1UTF-8$2');
}

async function handleFeed(context, target) {
  const cache = caches.default;
  const key = new Request('https://rss-cache.rsscreen/' + encodeURIComponent(target.toString()));
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': UA, 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      cf: { cacheTtl: FEED_TTL, cacheEverything: true }
    });
    if (!upstream.ok) return reply('Fonte respondeu ' + upstream.status, 502);
    const res = new Response(await decodeFeed(upstream), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=' + FEED_TTL
      }
    });
    context.waitUntil(cache.put(key, res.clone()));
    return res;
  } catch (err) {
    return reply('Erro ao buscar feed: ' + err.message, 502);
  }
}

export async function onRequestGet(context) {
  const params = new URL(context.request.url).searchParams;
  const raw = params.get('url');
  if (!raw) return reply('Parâmetro url obrigatório', 400);

  let target;
  try { target = new URL(raw); } catch (_) { return reply('URL inválida', 400); }
  if (!/^https?:$/.test(target.protocol)) return reply('Protocolo não permitido', 400);

  const { hosts, bases } = await getAllowed(context);
  if (params.get('og')) {
    if (!bases.has(baseDomain(target.hostname))) return reply('Site não cadastrado', 403);
    return handleOg(context, target);
  }
  if (!hosts.has(target.hostname)) return reply('Fonte não cadastrada', 403);
  return handleFeed(context, target);
}
