// Ponte para quando o site está publicado como Cloudflare Pages (rsscreen.pages.dev).
// O Pages não tem Durable Object nem Cron, e o banco D1 só existe se for ligado no painel.
// Aqui ficam as rotas que funcionam sem isso: futebol, loterias (direto da Caixa) e
// respostas "sem banco" para anúncios, cliente e playlist, para as telas abrirem normalmente.
// Publicado como Worker (recomendado), quem responde é worker/index.js, com tudo completo.
import { futebolResponse } from '../../worker/futebol.js';
import { loteriasResponse, memoryStub } from '../../worker/loterias.js';
import { agroResponse } from '../../worker/agro.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'X-Admin-Senha, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
};
const GIF = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));

function json(obj, status, maxAge) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? 'public, max-age=' + maxAge : 'no-store' }, CORS)
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const waitUntil = p => context.waitUntil(p);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (path === '/api/futebol') {
    return futebolResponse((url.searchParams.get('liga') || 'bra.1').toLowerCase().replace(/[^a-z0-9._]/g, ''), waitUntil, CORS);
  }
  if (path === '/api/loterias') return loteriasResponse(env, memoryStub, waitUntil, request);
  if (path === '/api/agro') return agroResponse(memoryStub, CORS);
  if (path === '/api/hit') {
    return new Response(GIF, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } });
  }
  // sem banco: as telas usam config/clientes.js e mostram "Anuncie aqui"
  if (path === '/api/cliente') return json({ banco: false }, 200, 60);
  if (path === '/api/anuncios') return json({ anuncios: [], banco: false }, 200, 60);
  if (path === '/api/playlist') return json({ playlist: null, banco: false, erro: 'Playlists precisam do site publicado como Worker' }, 503);
  if (path.startsWith('/api/admin/') || path.startsWith('/api/stats')) {
    return json({ erro: 'Este recurso precisa do site publicado como Cloudflare Worker (o Pages não tem banco nem monitoramento). Veja o README, seção "Publicar como Worker".', banco: false }, 503);
  }
  return json({ erro: 'Rota desconhecida' }, 404);
}
