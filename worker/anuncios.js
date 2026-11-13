// Anúncios dos clientes (D1). As fotos ficam no próprio D1 (já comprimidas no navegador,
// até ~1,5 MB cada) e são servidas em /api/midia/<id> com cache longo na Cloudflare.

let schemaOk = false;
const MAX_IMG = 1500000;

export async function ensureAdsSchema(env) {
  if (!env.DB) return false;
  if (schemaOk) return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS anuncios (
      id TEXT PRIMARY KEY, cliente TEXT NOT NULL, anunciante TEXT DEFAULT '', modelo TEXT NOT NULL,
      dados TEXT DEFAULT '{}', midia TEXT DEFAULT '', duracao INTEGER DEFAULT 10,
      inicio TEXT DEFAULT '', fim TEXT DEFAULT '', ativo INTEGER DEFAULT 1, ordem INTEGER DEFAULT 0,
      criado INTEGER, atualizado INTEGER)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS anuncios_cliente ON anuncios (cliente, ordem)'),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS midias (
      id TEXT PRIMARY KEY, cliente TEXT NOT NULL, tipo TEXT NOT NULL, dados BLOB NOT NULL,
      tamanho INTEGER, criado INTEGER)`)
  ]);
  schemaOk = true;
  return true;
}

const MODELOS = ['oferta', 'aviso', 'servico', 'evento', 'imagem', 'video'];
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const brToday = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function cleanDados(d) {
  const out = {};
  const keys = ['titulo', 'subtitulo', 'texto', 'preco', 'precoDe', 'selo', 'itens', 'whatsapp', 'instagram', 'endereco', 'data', 'hora', 'local', 'cor', 'cta', 'video', 'ajuste'];
  keys.forEach(k => { if (d && d[k] != null && d[k] !== '') out[k] = String(d[k]).slice(0, k === 'texto' || k === 'itens' ? 600 : k === 'video' ? 500 : 160); });
  if (out.video && !/^https:\/\//i.test(out.video)) delete out.video;
  if (out.cor && !/^#[0-9a-f]{6}$/i.test(out.cor)) delete out.cor;
  return out;
}

function rowOut(r) {
  let dados = {};
  try { dados = JSON.parse(r.dados || '{}'); } catch (_) {}
  return { id: r.id, cliente: r.cliente, anunciante: r.anunciante, modelo: r.modelo, dados, midia: r.midia, duracao: r.duracao, inicio: r.inicio, fim: r.fim, ativo: !!r.ativo, ordem: r.ordem, atualizado: r.atualizado };
}

export async function listAds(env, cliente) {
  await ensureAdsSchema(env);
  const r = await env.DB.prepare('SELECT * FROM anuncios WHERE cliente = ? ORDER BY ordem, criado').bind(cliente).all();
  return (r.results || []).map(rowOut);
}

// Só os anúncios que devem aparecer hoje (ativos e dentro do período)
export async function publicAds(env, cliente) {
  await ensureAdsSchema(env);
  const hoje = brToday();
  const r = await env.DB.prepare(`SELECT * FROM anuncios WHERE cliente = ? AND ativo = 1
    AND (inicio = '' OR inicio <= ?) AND (fim = '' OR fim >= ?) ORDER BY ordem, criado`).bind(cliente, hoje, hoje).all();
  return (r.results || []).map(rowOut).map(a => ({ id: a.id, anunciante: a.anunciante, modelo: a.modelo, dados: a.dados, midia: a.midia, duracao: a.duracao }));
}

export async function saveAd(env, b) {
  await ensureAdsSchema(env);
  const cliente = String(b.cliente || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!cliente) throw new Error('Cliente obrigatório');
  const modelo = MODELOS.indexOf(b.modelo) >= 0 ? b.modelo : 'oferta';
  const now = Date.now();
  const v = {
    anunciante: String(b.anunciante || '').slice(0, 80),
    dados: JSON.stringify(cleanDados(b.dados || {})),
    midia: String(b.midia || '').replace(/[^a-z0-9]/g, '').slice(0, 30),
    duracao: Math.max(4, Math.min(120, parseInt(b.duracao, 10) || 10)),
    inicio: /^\d{4}-\d{2}-\d{2}$/.test(b.inicio || '') ? b.inicio : '',
    fim: /^\d{4}-\d{2}-\d{2}$/.test(b.fim || '') ? b.fim : '',
    ativo: b.ativo === false ? 0 : 1
  };
  if (b.id) {
    const old = await env.DB.prepare('SELECT midia FROM anuncios WHERE id = ? AND cliente = ?').bind(b.id, cliente).first();
    if (!old) throw new Error('Anúncio não encontrado');
    await env.DB.prepare('UPDATE anuncios SET anunciante = ?, modelo = ?, dados = ?, midia = ?, duracao = ?, inicio = ?, fim = ?, ativo = ?, atualizado = ? WHERE id = ?')
      .bind(v.anunciante, modelo, v.dados, v.midia, v.duracao, v.inicio, v.fim, v.ativo, now, b.id).run();
    if (old.midia && old.midia !== v.midia) await dropMediaIfUnused(env, old.midia);
    return { id: b.id };
  }
  const id = newId();
  const max = await env.DB.prepare('SELECT MAX(ordem) AS m FROM anuncios WHERE cliente = ?').bind(cliente).first();
  await env.DB.prepare('INSERT INTO anuncios (id, cliente, anunciante, modelo, dados, midia, duracao, inicio, fim, ativo, ordem, criado, atualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, cliente, v.anunciante, modelo, v.dados, v.midia, v.duracao, v.inicio, v.fim, v.ativo, ((max && max.m) || 0) + 1, now, now).run();
  return { id };
}

export async function setAdsOrder(env, cliente, ids) {
  await ensureAdsSchema(env);
  const stmts = (ids || []).slice(0, 300).map((id, k) => env.DB.prepare('UPDATE anuncios SET ordem = ? WHERE id = ? AND cliente = ?').bind(k + 1, String(id), cliente));
  if (stmts.length) await env.DB.batch(stmts);
}

export async function deleteAd(env, id) {
  await ensureAdsSchema(env);
  const old = await env.DB.prepare('SELECT midia FROM anuncios WHERE id = ?').bind(id).first();
  await env.DB.prepare('DELETE FROM anuncios WHERE id = ?').bind(id).run();
  if (old && old.midia) await dropMediaIfUnused(env, old.midia);
}

async function dropMediaIfUnused(env, midia) {
  const used = await env.DB.prepare('SELECT 1 FROM anuncios WHERE midia = ? LIMIT 1').bind(midia).first();
  if (!used) await env.DB.prepare('DELETE FROM midias WHERE id = ?').bind(midia).run();
}

export async function saveMedia(env, cliente, type, buf) {
  await ensureAdsSchema(env);
  if (!/^image\/(jpeg|png|webp)$/.test(type)) throw new Error('Envie uma imagem JPG, PNG ou WebP');
  if (!buf.byteLength) throw new Error('Arquivo vazio');
  if (buf.byteLength > MAX_IMG) throw new Error('Imagem grande demais (máx. 1,5 MB depois de comprimida)');
  const id = newId();
  await env.DB.prepare('INSERT INTO midias (id, cliente, tipo, dados, tamanho, criado) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, cliente, type, buf, buf.byteLength, Date.now()).run();
  return { id, tamanho: buf.byteLength };
}

export async function mediaResponse(env, id) {
  await ensureAdsSchema(env);
  const r = await env.DB.prepare('SELECT tipo, dados FROM midias WHERE id = ?').bind(id).first();
  if (!r) return new Response('Não encontrado', { status: 404 });
  const bytes = r.dados instanceof ArrayBuffer ? new Uint8Array(r.dados) : new Uint8Array(r.dados);
  return new Response(bytes, {
    headers: { 'Content-Type': r.tipo, 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' }
  });
}
