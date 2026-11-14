// Entrada do Cloudflare Worker: arquivos estáticos + API.
//
//   /api/rss          proxy de feeds e de fotos (functions/api/rss.js)
//   /api/velocidade   teste da TV: devolve N KB para medir a internet do ponto
//   /api/hit          sinal das telas (imagem 1x1) para o monitoramento
//   /api/stats        relatório do painel          (exige a senha do administrador)
//   /api/stats/check  testa feeds agora             (exige a senha do administrador)
//   /api/stats/reset  zera as estatísticas          (exige a senha do administrador)
//   /api/cliente      a tela confere se a chave do cliente existe e está ativa (D1)
//   /api/admin/clientes[/importar]  cadastro de clientes no D1 (exige a senha)
//   /api/loterias     últimos resultados guardados (as telas leem daqui)
//   /api/anuncios     anúncios ativos do cliente; /api/midia/<id> fotos dos anúncios
//   /api/admin/anuncios[/ordem], /api/admin/midia  cadastro de anúncios (exige a senha)
//   /api/admin/loterias  status e "atualizar agora" (exige a senha)
//   /api/lista        tabela de preços ou cardápio para a TV (?id=&cliente=)
//   /api/editar       o cliente edita as listas dele pelo link secreto (?c=&t=)
//   /api/admin/listas link de edição e listas do cliente (exige a senha)
//   /api/noticias     todos os feeds de um assunto num pedido só (?assunto=&fonte=)
//   /api/agro         cotações do agro (CEPEA), guardadas por 1 hora
//   /api/futebol      jogos, resultados e tabela (?liga=bra.1), dados da ESPN com cache
//   /api/playlist     playlist do cliente (a tela com &playlist=<id> lê daqui)
//   /api/admin/playlists  cadastro de playlists (exige a senha)
//
// Cron (wrangler.jsonc → triggers): busca os resultados de loterias depois dos sorteios.
//
// (functions/api/rss.js também funciona sozinho se o projeto for criado como Pages, sem o monitoramento.)
import { onRequestGet } from '../functions/api/rss.js';
import { Stats, trackRequest, trackFeed, trackOg, trackHit, maybeFlush, statsStub } from './stats.js';
import { listClientes, countClientes, getCliente, saveCliente, deleteCliente, importClientes } from './clientes.js';
import { listAds, publicAds, saveAd, setAdsOrder, deleteAd, saveMedia, mediaResponse } from './anuncios.js';
import { listPlaylists, getPlaylist, savePlaylist, deletePlaylist, playlistCacheKey } from './playlists.js';
import { futebolResponse } from './futebol.js';
import { agroResponse } from './agro.js';
import { noticiasResponse } from './noticias.js';
import { listarListas, salvarLista, excluirLista, listaPublica, esquecer, gerarToken, lerToken, tokenValido, LIMITES } from './listas.js';
import { seo } from './seo.js';
import { loteriasResponse, updateAll, updateStats, JOGOS, STATS_JOGOS, memoryStub } from './loterias.js';

export { Stats };

const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-Admin-Senha, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
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

async function readJson(request) {
  try { return await request.json(); } catch (_) { return {}; }
}

/* ---------- rotas ---------- */
export default {
  // Cron: resultados de loterias (só busca os jogos cujo sorteio já aconteceu)
  async scheduled(event, env, ctx) {
    const stub = statsStub(env);
    if (stub) ctx.waitUntil(updateAll(env, stub, false).then(() => event.cron === '0 11 * * *' ? updateStats(env, stub, false) : null));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/robots.txt' || path === '/sitemap.xml') return seo(path, url, env, request);
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

    if (path === '/api/velocidade') {
      // teste da TV: devolve N KB de dados aleatórios (sem cache) para medir a internet do ponto
      const kb = Math.max(0, Math.min(2000, parseInt(url.searchParams.get('kb'), 10) || 0));
      const buf = new Uint8Array(kb * 1024);
      for (let i = 0; i < buf.length; i += 65536) crypto.getRandomValues(buf.subarray(i, Math.min(buf.length, i + 65536)));
      return new Response(buf, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
    }

    if (path === '/api/hit') {
      trackRequest(request, 'hit');
      trackHit(request, url.searchParams);
      maybeFlush(env, waitUntil);
      return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
    }

    if (path === '/api/anuncios') {
      // Anúncios ativos do cliente para as telas (cache de 1 minuto)
      const cliente = (url.searchParams.get('cliente') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, CORS);
      if (!env.DB || !cliente) return new Response(JSON.stringify({ anuncios: [], banco: !!env.DB }), { headers });
      trackRequest(request, 'anuncios');
      maybeFlush(env, waitUntil);
      const ck = new Request('https://anuncios-cache.rsscreen/' + cliente);
      const hit = await caches.default.match(ck);
      if (hit) return hit;
      try {
        const c = (await countClientes(env)) > 0 ? await getCliente(env, cliente) : { ativo: 1 };
        const anuncios = c && c.ativo ? await publicAds(env, cliente) : [];
        const res = new Response(JSON.stringify({ anuncios, banco: true }), { headers });
        waitUntil(caches.default.put(ck, res.clone()));
        return res;
      } catch (e) {
        return new Response(JSON.stringify({ anuncios: [], erro: 'indisponivel' }), { status: 503, headers });
      }
    }

    if (path === '/api/lista') {
      const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, CORS);
      if (!env.DB) return new Response(JSON.stringify({ lista: null, banco: false }), { status: 503, headers });
      trackRequest(request, 'lista');
      maybeFlush(env, waitUntil);
      try {
        const l = await listaPublica(env, url.searchParams.get('id') || '', url.searchParams.get('cliente') || '');
        return new Response(JSON.stringify({ lista: l }), { status: l ? 200 : 404, headers });
      } catch (e) {
        return new Response(JSON.stringify({ lista: null, erro: 'indisponivel' }), { status: 503, headers });
      }
    }

    if (path === '/api/editar') {
      // edição pelo cliente, protegida pelo link secreto
      if (!env.DB) return json({ erro: 'Banco indisponível' }, 503);
      const c = (url.searchParams.get('c') || '').toLowerCase(), t = url.searchParams.get('t') || '';
      if (!(await tokenValido(env, c, t))) return json({ erro: 'Link de edição inválido ou trocado. Peça um link novo ao seu fornecedor.' }, 403);
      const cli = await getCliente(env, c);
      if (!cli || !cli.ativo) return json({ erro: 'Cadastro suspenso. Fale com o seu fornecedor.' }, 403);
      try {
        if (request.method === 'GET') return json({ cliente: { chave: cli.chave, nome: cli.nome }, listas: await listarListas(env, c), limites: LIMITES });
        if (request.method === 'POST') { const b = await readJson(request); const r = await salvarLista(env, c, b); esquecer(c, r.id); return json({ ok: true, id: r.id }); }
        if (request.method === 'DELETE') { const id = url.searchParams.get('id') || ''; await excluirLista(env, id, c); esquecer(c, id); return json({ ok: true }); }
      } catch (e) { return json({ erro: e.message || String(e) }, 400); }
      return json({ erro: 'Método não permitido' }, 405);
    }

    if (path === '/api/noticias') {
      trackRequest(request, 'noticias');
      const res = await noticiasResponse(request, env, { request, env, waitUntil, trackFeed, trackOg }, CORS);
      maybeFlush(env, waitUntil);
      return res;
    }

    if (path === '/api/agro') {
      trackRequest(request, 'agro');
      maybeFlush(env, waitUntil);
      return agroResponse(statsStub(env) || memoryStub, CORS);
    }

    if (path === '/api/futebol') {
      trackRequest(request, 'futebol');
      maybeFlush(env, waitUntil);
      return futebolResponse((url.searchParams.get('liga') || 'bra.1').toLowerCase().replace(/[^a-z0-9._]/g, ''), waitUntil, CORS);
    }

    if (path === '/api/playlist') {
      // Playlist para a tela (cache de 1 minuto; editar no painel limpa o cache)
      const id = (url.searchParams.get('id') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const cliente = (url.searchParams.get('cliente') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
      const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, CORS);
      if (!env.DB || !id || !cliente) return new Response(JSON.stringify({ playlist: null, banco: !!env.DB }), { status: env.DB ? 404 : 503, headers });
      trackRequest(request, 'playlist');
      maybeFlush(env, waitUntil);
      const ck = playlistCacheKey(id);
      const hit = await caches.default.match(ck);
      if (hit) {
        const body = await hit.clone().json().catch(() => null);
        if (body && body.playlist && body.playlist.cliente === cliente) return hit;
      }
      try {
        const pl = await getPlaylist(env, id, cliente);
        if (!pl) return new Response(JSON.stringify({ playlist: null, banco: true }), { status: 404, headers });
        const res = new Response(JSON.stringify({ playlist: pl, banco: true }), { headers });
        waitUntil(caches.default.put(ck, res.clone()));
        return res;
      } catch (e) {
        return new Response(JSON.stringify({ playlist: null, erro: 'indisponivel' }), { status: 503, headers });
      }
    }

    if (path.startsWith('/api/midia/')) {
      const id = path.slice('/api/midia/'.length).replace(/[^a-z0-9]/g, '');
      if (!env.DB || !id) return new Response('Não encontrado', { status: 404 });
      const ck = new Request('https://midia-cache.rsscreen/' + id);
      const hit = await caches.default.match(ck);
      if (hit) return hit;
      const res = await mediaResponse(env, id);
      if (res.ok) waitUntil(caches.default.put(ck, res.clone()));
      return res;
    }

    if (path === '/api/cliente') {
      trackRequest(request, 'cliente');
      maybeFlush(env, waitUntil);
      // Resposta: { banco: true|false, cliente: {...}|null }. Sem banco (ou banco vazio) a tela usa o config/clientes.js
      const chave = (url.searchParams.get('chave') || '').toLowerCase().slice(0, 60);
      const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' }, CORS);
      try {
        const n = await countClientes(env);
        if (n <= 0) return new Response(JSON.stringify({ banco: false }), { headers });
        const c = chave ? await getCliente(env, chave) : null;
        return new Response(JSON.stringify({ banco: true, cliente: c ? { chave: c.chave, nome: c.nome, ativo: !!c.ativo, demo: !!c.demo } : null }), { headers });
      } catch (e) {
        return new Response(JSON.stringify({ banco: false, erro: 'indisponivel' }), { headers });
      }
    }

    if (path === '/api/loterias') {
      const stub = statsStub(env) || memoryStub;
      trackRequest(request, 'loterias');
      maybeFlush(env, waitUntil);
      return loteriasResponse(env, stub, waitUntil, request);
    }

    if (path.startsWith('/api/admin/')) {
      if (!(await isAdmin(request, env))) return json({ erro: 'Senha inválida' }, 401);
      try {
        if (path === '/api/admin/clientes') {
          if (!env.DB) return json({ erro: 'Banco D1 não configurado', banco: false }, 503);
          if (request.method === 'GET') return json({ banco: true, clientes: await listClientes(env) });
          if (request.method === 'POST') { const b = await readJson(request); return json({ ok: true, cliente: await saveCliente(env, b, !!b.novo) }); }
          if (request.method === 'DELETE') { await deleteCliente(env, url.searchParams.get('chave') || ''); return json({ ok: true }); }
        }
        if (path === '/api/admin/clientes/importar' && request.method === 'POST') {
          if (!env.DB) return json({ erro: 'Banco D1 não configurado' }, 503);
          const b = await readJson(request);
          return json({ ok: true, importados: await importClientes(env, b.clientes) });
        }
        if (path === '/api/admin/anuncios' || path === '/api/admin/anuncios/ordem' || path === '/api/admin/midia') {
          if (!env.DB) return json({ erro: 'Banco D1 não configurado' }, 503);
          const purge = c => caches.default.delete(new Request('https://anuncios-cache.rsscreen/' + c));
          if (path === '/api/admin/midia' && request.method === 'POST') {
            const cliente = (url.searchParams.get('cliente') || '').toLowerCase();
            return json(await saveMedia(env, cliente, (request.headers.get('Content-Type') || '').split(';')[0], await request.arrayBuffer()));
          }
          if (path === '/api/admin/anuncios/ordem' && request.method === 'POST') {
            const b = await readJson(request);
            await setAdsOrder(env, b.cliente, b.ids);
            await purge(b.cliente);
            return json({ ok: true });
          }
          if (request.method === 'GET') return json({ anuncios: await listAds(env, (url.searchParams.get('cliente') || '').toLowerCase()) });
          if (request.method === 'POST') {
            const b = await readJson(request);
            const r = await saveAd(env, b);
            await purge(String(b.cliente || '').toLowerCase());
            return json({ ok: true, id: r.id });
          }
          if (request.method === 'DELETE') {
            await deleteAd(env, url.searchParams.get('id') || '');
            await purge((url.searchParams.get('cliente') || '').toLowerCase());
            return json({ ok: true });
          }
        }
        if (path === '/api/admin/listas') {
          if (!env.DB) return json({ erro: 'Banco D1 não configurado' }, 503);
          const cliente = (url.searchParams.get('cliente') || '').toLowerCase();
          if (request.method === 'GET') return json({ listas: await listarListas(env, cliente), token: await lerToken(env, cliente), limites: LIMITES });
          if (request.method === 'POST' && url.searchParams.get('acao') === 'token') return json({ ok: true, token: await gerarToken(env, cliente) });
          if (request.method === 'POST') { const r = await salvarLista(env, cliente, await readJson(request)); esquecer(cliente, r.id); return json({ ok: true, id: r.id }); }
          if (request.method === 'DELETE') { const id = url.searchParams.get('id') || ''; await excluirLista(env, id, cliente); esquecer(cliente, id); return json({ ok: true }); }
        }
        if (path === '/api/admin/playlists') {
          if (!env.DB) return json({ erro: 'Banco D1 não configurado' }, 503);
          const cliente = (url.searchParams.get('cliente') || '').toLowerCase();
          if (request.method === 'GET') return json({ playlists: await listPlaylists(env, cliente) });
          if (request.method === 'POST') {
            const r = await savePlaylist(env, await readJson(request));
            await caches.default.delete(playlistCacheKey(r.id));
            return json({ ok: true, id: r.id });
          }
          if (request.method === 'DELETE') {
            const id = url.searchParams.get('id') || '';
            await deletePlaylist(env, id, cliente);
            await caches.default.delete(playlistCacheKey(id));
            return json({ ok: true });
          }
        }
        if (path === '/api/admin/loterias') {
          const stub = statsStub(env) || memoryStub;
          let resultado = null;
          if (request.method === 'POST') {
            resultado = await updateAll(env, stub, true);
            if (url.searchParams.get('estatisticas')) resultado = resultado.concat(await updateStats(env, stub, true));
            await caches.default.delete(new Request('https://loterias-cache.rsscreen/v2'));
          }
          const rows = await stub.lotGetAll();
          const mes = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 7);
          return json({
            resultado,
            chave: !!env.APILOTERIAS_KEY,
            fonte: env.LOTERIAS_FONTE === 'apiloterias' ? 'apiloterias' : 'caixa',
            usoMes: await stub.lotUsage(mes, 0),
            limite: Number(env.APILOTERIAS_LIMITE) || 450,
            estatisticas: STATS_JOGOS.map(j => { const r = rows['stats:' + j]; return { id: j, obtido: r ? r.obtido : 0, sorteios: r ? r.sorteios : 0 }; }),
            jogos: JOGOS.map(j => { const r = rows[j.id] || {}; return { id: j.id, nome: j.nome, concurso: r.concurso || 0, data: r.data || '', fonte: r.fonte || '', obtido: r.obtido || 0, proximo: r.proximo || null, erro: r.erro || '', erroEm: r.erroEm || 0 }; })
          });
        }
      } catch (e) {
        return json({ erro: e.message || String(e) }, 400);
      }
      return json({ erro: 'Rota desconhecida' }, 404);
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
      if (path === '/api/stats/cliente') {
        const c = (url.searchParams.get('c') || '').toLowerCase().replace(/[^a-z0-9-()çãéíóú ]/g, '').slice(0, 60);
        return json(await stub.cliente(c, url.searchParams.get('dias')));
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
