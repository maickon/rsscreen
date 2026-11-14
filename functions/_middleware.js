// Pages (rsscreen.pages.dev): o rsscreen roda como Worker. Todo acesso ao endereço antigo é levado
// para o Worker com o mesmo caminho e parâmetros, então os links que os clientes já usam continuam
// funcionando. A variável WORKER_URL do projeto Pages troca o destino; WORKER_URL=off desliga.
const PADRAO = 'https://rsscreen.maickon4developers.workers.dev';

export async function onRequest(context) {
  const cfg = String((context.env && context.env.WORKER_URL) || '').trim();
  if (cfg.toLowerCase() === 'off') return context.next();
  const alvo = (/^https:\/\//i.test(cfg) ? cfg : PADRAO).replace(/\/+$/, '');
  const url = new URL(context.request.url);
  if (new URL(alvo).host === url.host) return context.next();
  // painel: leva junto a lista "Meus links" guardada neste navegador (ela fica presa ao endereço antigo)
  if (url.pathname.startsWith('/painel')) {
    const html = '<!doctype html><meta charset="utf-8"><title>Mudando de endereço…</title>' +
      '<body style="font-family:system-ui;background:#0a0a0a;color:#fff;display:grid;place-items:center;height:100vh;margin:0">' +
      '<p>Levando o painel para o endereço novo…</p><script>' +
      'var d="";try{var l=localStorage.getItem("rs_links_v1");if(l&&l!=="[]")d="#importar-links="+encodeURIComponent(l);}catch(e){}' +
      'location.replace(' + JSON.stringify(alvo + '/painel/') + '+(d||location.hash));</script></body>';
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
  return Response.redirect(alvo + url.pathname + url.search, 302);
}
