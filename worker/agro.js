// Cotações do agro: indicadores diários do CEPEA (ESALQ/USP), pelo widget público e gratuito deles.
// Uso permitido citando a fonte ("Fonte: Cepea"), o que as telas fazem no rodapé.
// O resultado fica guardado (Durable Object) por 1 hora; o valor anterior de cada produto também,
// para mostrar se subiu ou caiu.

export const AGRO = [
  { id: 2, nome: 'Boi gordo', match: 'boi gordo' },
  { id: 8, nome: 'Bezerro (MS)', match: 'bezerro - ms' },
  { id: 3, nome: 'Bezerro (SP)', match: 'bezerro - sp' },
  { id: 124, nome: 'Suíno (carcaça)', match: 'suino' },
  { id: 181, nome: 'Frango congelado', match: 'frango congelado' },
  { id: 130, nome: 'Frango resfriado', match: 'frango resfriado' },
  { id: 12, nome: 'Soja (Paraná)', match: 'soja - pr' },
  { id: 92, nome: 'Soja (Paranaguá)', match: 'soja paranagua' },
  { id: 77, nome: 'Milho', match: 'milho' },
  { id: 178, nome: 'Trigo (Paraná)', match: 'trigo - pr' },
  { id: 179, nome: 'Trigo (RS)', match: 'trigo - rs' },
  { id: 91, nome: 'Arroz em casca (RS)', match: 'arroz em casca' },
  { id: 72, nome: 'Mandioca', match: 'mandioca' },
  { id: 23, nome: 'Café arábica', match: 'cafe arabica' },
  { id: 24, nome: 'Café robusta', match: 'cafe robusta' },
  { id: 53, nome: 'Açúcar (SP)', match: 'acucar - sp' },
  { id: 103, nome: 'Etanol hidratado (SP)', match: 'etanol hidratado - sp' },
  { id: 104, nome: 'Etanol anidro (SP)', match: 'etanol anidro - sp' },
  { id: 162, nome: 'Laranja (indústria)', match: 'citros' }
];

const UNIDADES = { '@': 'arroba', 't': 'tonelada', 'kg': 'kg', 'litro': 'litro', 'cabeça': 'cabeça' };
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const num = s => Number(String(s).replace(/\./g, '').replace(',', '.'));
const unidade = u => {
  u = String(u || '').trim();
  const m = u.match(/^(sc|cx) de ([\d,]+)\s*kg$/i);
  if (m) return (m[1].toLowerCase() === 'sc' ? 'saca de ' : 'caixa de ') + m[2] + ' kg';
  return UNIDADES[u] || u;
};

async function buscar() {
  const q = AGRO.map(a => 'id_indicador%5B%5D=' + a.id).join('&');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch('https://www.cepea.org.br/br/widgetproduto.js.php?' + q, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSScreen/1.0)' }, signal: ctrl.signal, redirect: 'follow'
    });
    if (!r.ok) throw new Error('CEPEA HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    let txt;
    try { txt = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { txt = new TextDecoder('windows-1252').decode(buf); }
    const itens = {};
    txt.split(/<tr>/i).forEach(tr => {
      const data = (tr.match(/<td>\s*(\d{2}\/\d{2}\/\d{4})\s*<\/td>/) || [])[1];
      const nome = (tr.match(/<span class="maior">([^<]+)<\/span>\s*<br/) || [])[1];
      const un = (tr.match(/<span class="unidade">([^<]+)<\/span>/) || [])[1];
      const valor = (tr.match(/R\$\s*<span class="maior">([\d.,]+)<\/span>/) || [])[1];
      if (!data || !nome || !valor || /¢/.test(tr)) return;
      const a = AGRO.find(x => norm(nome).indexOf(x.match) === 0);
      if (!a || itens[a.id]) return;
      const [d, m, y] = data.split('/');
      itens[a.id] = { id: a.id, nome: a.nome, unidade: unidade(un), valor: num(valor), data: y + '-' + m + '-' + d };
    });
    if (!Object.keys(itens).length) throw new Error('CEPEA sem dados');
    return itens;
  } finally { clearTimeout(t); }
}

export async function agroResponse(stub, cors) {
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=600' }, cors);
  let guardado = null;
  try { guardado = await stub.lotGetOne('agro'); } catch (_) {}
  if (guardado && Date.now() - guardado.t < 60 * 60 * 1000) return new Response(JSON.stringify(guardado), { headers });
  try {
    const novos = await buscar();
    const antes = (guardado && guardado.itens) || {};
    Object.keys(novos).forEach(id => {
      const n = novos[id], a = antes[id];
      if (a && a.data && a.data !== n.data) { n.ant = a.valor; n.antData = a.data; }
      else if (a && a.ant != null) { n.ant = a.ant; n.antData = a.antData; }
    });
    const res = { itens: novos, fonte: 'Cepea (ESALQ/USP)', t: Date.now() };
    try { await stub.lotPut('agro', res); } catch (_) {}
    return new Response(JSON.stringify(res), { headers });
  } catch (e) {
    if (guardado) return new Response(JSON.stringify(Object.assign({}, guardado, { velho: true })), { headers });
    return new Response(JSON.stringify({ erro: 'Cotações do agro indisponíveis no momento' }), { status: 503, headers: Object.assign({}, headers, { 'Cache-Control': 'no-store' }) });
  }
}
