// Entrada do Cloudflare Worker: arquivos estáticos + API.
//
//   /api/rss          proxy de feeds e de fotos (functions/api/rss.js)
//   /api/hit          sinal das telas (imagem 1x1) para o monitoramento
//   /api/stats        relatório do painel          (exige a senha do administrador)
//   /api/stats/check  testa feeds agora             (exige a senha do administrador)
//   /api/stats/reset  zera as estatísticas          (exige a senha do administrador)
//
// (functions/api/rss.js também funciona sozinho se o projeto for criado como Pages, sem o monitoramento.)
import { onRequestGet } from '../functions/api/rss.js';
import { Stats, trackRequest, trackFeed, trackOg, trackHit, maybeFlush, statsStub } from './stats.js';

export { Stats };

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-Admin-Senha, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS)
  });
}

/* ---------- senha do administrador (mesmo cálculo do painel) ---------- */
let cfgCache = null, cfgAt = 0;
const okPasswords = new Map();

async function adminHash(env, request) {
  if (!cfgCache || Date.now() - cfgAt > 5 * 60 * 1000) {
    try {
      const txt = await (await env.ASSETS.fetch(new URL('/config/clientes.js', request.url))).text();
      cfgCache = ((txt.match(/senhaHash\s*:\s*['"]([0-9a-f]{64})['"]/i) || [])[1] || '').toLowerCase();
      cfgAt = Date.now();
    } catch (_) { cfgCache = ''; }
  }
  return cfgCache;
}

async function pbkdf2(senha) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('rsscreen|admin'), iterations: 10000, hash: 'SHA-256' }, key, 256);
  return Array.from(new Uint8Array(bits)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
}

async function isAdmin(request, env) {
  const senha = request.headers.get('X-Admin-Senha') || '';
  if (!senha) return false;
  const expected = await adminHash(env, request);
  if (!expected) return false;
  const memo = okPasswords.get(senha);
  if (memo) return memo === expected;
  const h = await pbkdf2(senha);
  if (okPasswords.size > 20) okPasswords.clear();
  okPasswords.set(senha, h);
  return h === expected;
}

/* ---------- teste dos feeds sob demanda ---------- */
async function feedList(env, request) {
  const res = await env.ASSETS.fetch(new URL('/modules/rss/manifest.json', request.url));
  const m = await res.json();
  const seen = new Map();
  (m.assuntos || []).forEach(a => (a.fontes || []).forEach(f => {
    const cur = seen.get(f.url) || { url: f.url, nome: f.nome, site: f.site || f.id, assuntos: [] };
    cur.assuntos.push(a.nome);
    seen.set(f.url, cur);
  }));
  return Array.from(seen.values());
}

async function checkOne(url) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 12000);
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSScreenBot/1.0)', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' }, signal: ctrl.signal });
    const txt = await r.text();
    clearTimeout(to);
    const items = (txt.match(/<(item|entry)[\s>]/gi) || []).length;
    const ok = r.ok && items > 0;
    const msg = !r.ok ? 'HTTP ' + r.status + (r.status === 403 || r.status === 429 ? ' · bloqueio' : '') : items ? items + ' notícias' : 'sem notícias (verificação anti-robô?)';
    return { url, ok, status: r.status, ms: Date.now() - t0, msg };
  } catch (e) {
    return { url, ok: false, status: 0, ms: Date.now() - t0, msg: 'sem resposta' };
  }
}

/* ---------- rotas ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const waitUntil = p => ctx.waitUntil(p);

    if (path === '/api/rss') {
      if (request.method !== 'GET') return new Response('Método não permitido', { status: 405 });
      trackRequest(request, url.searchParams.get('og') ? 'og' : 'rss');
      const res = await onRequestGet({ request, env, waitUntil, trackFeed, trackOg });
      maybeFlush(env, waitUntil);
      return res;
    }

    if (path === '/api/hit') {
      trackRequest(request, 'hit');
      trackHit(request, url.searchParams);
      maybeFlush(env, waitUntil);
      return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
    }

    if (path.startsWith('/api/stats')) {
      if (!(await isAdmin(request, env))) return json({ erro: 'Senha inválida' }, 401);
      const stub = statsStub(env);
      if (!stub) return json({ erro: 'Monitoramento indisponível: publique como Worker (wrangler.jsonc com Durable Object STATS).' }, 503);
      maybeFlush(env, waitUntil, true);

      if (path === '/api/stats') {
        const [report, feeds] = await Promise.all([stub.report(url.searchParams.get('dias')), feedList(env, request)]);
        report.cadastro = feeds;
        return json(report);
      }
      if (path === '/api/stats/check') {
        // até 25 feeds por chamada (limite de subrequisições do plano gratuito); o painel chama em partes
        const all = await feedList(env, request);
        const from = Math.max(0, Number(url.searchParams.get('inicio')) || 0);
        const part = all.slice(from, from + 25);
        // o Worker abre no máximo 6 conexões ao mesmo tempo: testa em 6 filas
        const results = [];
        let next = 0;
        await Promise.all([0, 1, 2, 3, 4, 5].map(async () => {
          while (next < part.length) { const i = next++; results[i] = await checkOne(part[i].url); }
        }));
        await stub.saveCheck(results);
        return json({ total: all.length, proximo: from + part.length < all.length ? from + part.length : null, resultados: results });
      }
      if (path === '/api/stats/reset' && request.method === 'POST') {
        await stub.reset();
        return json({ ok: true });
      }
      return json({ erro: 'Rota desconhecida' }, 404);
    }

    return new Response('Não encontrado', { status: 404 });
  }
};
