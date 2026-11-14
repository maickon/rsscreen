// Pages: depois de publicar o rsscreen como Worker, crie no projeto Pages a variável
// WORKER_URL (ex.: https://rsscreen.SEU-USUARIO.workers.dev). A partir daí, todo acesso ao
// endereço antigo (rsscreen.pages.dev) é levado para o Worker, com o mesmo caminho e parâmetros,
// então os links que os clientes já usam continuam funcionando. Sem a variável, nada muda.
export async function onRequest(context) {
  const alvo = String((context.env && context.env.WORKER_URL) || '').trim().replace(/\/+$/, '');
  if (!/^https:\/\//i.test(alvo)) return context.next();
  const url = new URL(context.request.url);
  if (new URL(alvo).host === url.host) return context.next();
  return Response.redirect(alvo + url.pathname + url.search, 302);
}
