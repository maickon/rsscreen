// Entrada do Cloudflare Worker: serve os arquivos estáticos e o endpoint /api/rss.
// (O mesmo código de functions/api/rss.js também funciona se o projeto for criado como Pages.)
import { onRequestGet } from '../functions/api/rss.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/rss') {
      if (request.method !== 'GET') return new Response('Método não permitido', { status: 405 });
      return onRequestGet({ request, env, waitUntil: p => ctx.waitUntil(p) });
    }
    return env.ASSETS.fetch(request);
  }
};
