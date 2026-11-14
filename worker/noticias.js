// /api/noticias?assunto=<id>[&fonte=<id>]: todos os feeds de um assunto num pedido só.
//
// Antes, cada tela de notícias pedia /api/rss uma vez por fonte (até 4 por atualização). Com muitas
// TVs isso estourava o limite diário de requisições do plano gratuito. Agora a tela faz 1 pedido;
// o servidor busca os feeds (com o mesmo cache de /api/rss), corta cada um nas notícias mais novas
// e devolve tudo junto. O resultado também fica na memória do servidor por alguns minutos, então
// centenas de TVs no mesmo assunto quase não geram busca nos sites.
import { handleFeed, handleOg, getAllowed } from '../functions/api/rss.js';

const MAX_FONTES = 4;
const MAX_ITENS = 15;
const MEM_MS = 4 * 60 * 1000;
const mem = new Map();
let manifest = null, manifestAt = 0;

async function getManifest(env, request) {
  if (manifest && Date.now() - manifestAt < 10 * 60 * 1000) return manifest;
  const res = await env.ASSETS.fetch(new URL('/modules/rss/manifest.json', request.url));
  manifest = await res.json();
  manifestAt = Date.now();
  return manifest;
}

// mantém só as primeiras N notícias do feed (o XML continua válido para o leitor da tela)
function cortar(xml, n) {
  const re = /<(item|entry)[\s>]/gi;
  let m, k = 0, corte = -1;
  while ((m = re.exec(xml))) { if (++k > n) { corte = m.index; break; } }
  if (corte < 0) return xml;
  return xml.slice(0, corte) + (/<feed[\s>]/i.test(xml) ? '</feed>' : '</channel></rss>');
}

async function buscar(fontes, ctx) {
  const out = await Promise.all(fontes.map(async f => {
    try {
      const res = await handleFeed(ctx, new URL(f.url));
      if (!res.ok) return null;
      return { id: f.id, xml: cortar(await res.text(), MAX_ITENS) };
    } catch (_) { return null; }
  }));
  return out.filter(Boolean);
}

// Notícias sem foto no feed: o servidor procura a imagem da página (og:image) e manda junto,
// assim as TVs não precisam pedir foto por foto (cada pedido conta no limite diário).
const SEM_FOTO = /<media:(content|thumbnail)|<enclosure[^>]+image|<img[\s>]|&lt;img/i;
function linkDoItem(bloco) {
  const href = (bloco.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1];
  if (href) return href;
  const txt = (bloco.match(/<link>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i) || [])[1];
  return txt || '';
}
async function fotosQueFaltam(feeds, ctx) {
  const links = [];
  feeds.forEach(f => {
    f.xml.split(/<(?:item|entry)[\s>]/i).slice(1, 9).forEach(bloco => {
      if (SEM_FOTO.test(bloco)) return;
      const l = linkDoItem(bloco).trim();
      if (/^https?:\/\//i.test(l) && links.indexOf(l) < 0) links.push(l);
    });
  });
  const out = {};
  if (!links.length) return out;
  const { bases } = await getAllowed(ctx);
  const alvo = links.slice(0, 12);
  let i = 0;
  await Promise.all([0, 1, 2, 3, 4].map(async () => {
    while (i < alvo.length) {
      const l = alvo[i++];
      try {
        const u = new URL(l);
        const p = u.hostname.toLowerCase().split('.');
        if (!bases.has(p.slice(-2).join('.')) && !bases.has(p.slice(-3).join('.'))) continue;
        const r = await handleOg(ctx, u);
        const d = await r.json();
        out[l] = (d && d.image) || '';
      } catch (_) {}
    }
  }));
  return out;
}

export async function noticiasResponse(request, env, ctx, cors) {
  const url = new URL(request.url);
  const assuntoId = (url.searchParams.get('assunto') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const fonteId = (url.searchParams.get('fonte') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors);
  const m = await getManifest(env, request);
  const assunto = (m.assuntos || []).find(a => a.id === assuntoId);
  if (!assunto || !(assunto.fontes || []).length) return new Response(JSON.stringify({ erro: 'Assunto desconhecido' }), { status: 404, headers });

  const chave = assuntoId + '|' + fonteId;
  const guardado = mem.get(chave);
  if (guardado && Date.now() - guardado.t < MEM_MS) {
    return new Response(guardado.body, { headers: Object.assign({ 'Cache-Control': 'public, max-age=300', 'X-RS-Mem': '1' }, headers) });
  }

  const todas = assunto.fontes;
  const escolhida = fonteId ? todas.find(f => f.id === fonteId || f.site === fonteId) : null;
  let feeds = [];
  // site escolhido; se ele falhar, usa os outros sites do assunto (igual à tela)
  if (escolhida) feeds = await buscar([escolhida], ctx);
  if (!feeds.length) feeds = await buscar(todas.filter(f => f !== escolhida).slice(0, MAX_FONTES), ctx);
  if (!feeds.length) return new Response(JSON.stringify({ erro: 'Nenhuma fonte respondeu' }), { status: 502, headers: Object.assign({ 'Cache-Control': 'no-store' }, headers) });

  const imagens = await fotosQueFaltam(feeds, ctx);
  const body = JSON.stringify({ assunto: assuntoId, feeds, imagens, t: Date.now() });
  mem.set(chave, { t: Date.now(), body });
  if (mem.size > 200) mem.delete(mem.keys().next().value);
  return new Response(body, { headers: Object.assign({ 'Cache-Control': 'public, max-age=300' }, headers) });
}
