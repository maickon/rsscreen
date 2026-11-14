// Tabelas de preços e cardápios dos clientes (D1).
// O cliente edita pelo celular com um link secreto (/editar/?c=<chave>&t=<token>), sem login.
// Limites por cliente (para caber com folga no plano gratuito): 10 listas e 200 itens por lista.

let schemaOk = false;
export const LIMITES = { listas: 10, itens: 200, bytes: 60000 };
const TIPOS = ['precos', 'cardapio'];
const TEMAS = ['acougue', 'hortifruti', 'padaria', 'lanchonete', 'pizzaria', 'acai', 'cafeteria', 'bebidas', 'mercado', 'geral'];
const slug = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
const novoId = () => Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-3);
const novoToken = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => ('0' + b.toString(16)).slice(-2)).join('');

export async function ensureListasSchema(env) {
  if (!env.DB) return false;
  if (schemaOk) return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS listas (
      id TEXT PRIMARY KEY, cliente TEXT NOT NULL, tipo TEXT NOT NULL, nome TEXT DEFAULT '', tema TEXT DEFAULT 'geral',
      dados TEXT DEFAULT '{}', criado INTEGER, atualizado INTEGER)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS listas_cliente ON listas (cliente, criado)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS edicao (cliente TEXT PRIMARY KEY, token TEXT NOT NULL, criado INTEGER)')
  ]);
  schemaOk = true;
  return true;
}

/* ---------- link de edição ---------- */
export async function gerarToken(env, cliente) {
  await ensureListasSchema(env);
  const token = novoToken();
  await env.DB.prepare('INSERT INTO edicao (cliente, token, criado) VALUES (?, ?, ?) ON CONFLICT (cliente) DO UPDATE SET token = excluded.token, criado = excluded.criado')
    .bind(slug(cliente), token, Date.now()).run();
  return token;
}
export async function lerToken(env, cliente) {
  await ensureListasSchema(env);
  const r = await env.DB.prepare('SELECT token FROM edicao WHERE cliente = ?').bind(slug(cliente)).first();
  return r ? r.token : '';
}
export async function tokenValido(env, cliente, token) {
  if (!cliente || !token || token.length < 20) return false;
  const t = await lerToken(env, cliente);
  if (!t || t.length !== token.length) return false;
  let dif = 0;
  for (let i = 0; i < t.length; i++) dif |= t.charCodeAt(i) ^ token.charCodeAt(i);
  return dif === 0;
}

/* ---------- listas ---------- */
const txt = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
function limparDados(d) {
  d = d || {};
  const itens = (Array.isArray(d.itens) ? d.itens : []).slice(0, LIMITES.itens).map(it => {
    const o = { n: txt(it.n, 60) };
    if (it.d) o.d = txt(it.d, 90);
    if (it.p) o.p = txt(it.p, 14).replace(/[^\d,.]/g, '');
    if (it.de) o.de = txt(it.de, 14).replace(/[^\d,.]/g, '');
    if (it.u) o.u = txt(it.u, 12);
    if (it.c) o.c = txt(it.c, 30);
    if (it.o) o.o = 1;
    if (it.x) o.x = 1;
    return o;
  }).filter(it => it.n);
  const out = { itens };
  ['titulo', 'subtitulo', 'rodape'].forEach(k => { if (d[k]) out[k] = txt(d[k], k === 'rodape' ? 120 : 60); });
  if (d.esgotado === 'riscar' || d.esgotado === 'esconder') out.esgotado = d.esgotado;
  return out;
}
function saida(r) {
  let dados = {};
  try { dados = JSON.parse(r.dados || '{}'); } catch (_) {}
  return { id: r.id, cliente: r.cliente, tipo: r.tipo, nome: r.nome, tema: r.tema, dados, atualizado: r.atualizado };
}

export async function listarListas(env, cliente) {
  await ensureListasSchema(env);
  const r = await env.DB.prepare('SELECT * FROM listas WHERE cliente = ? ORDER BY criado').bind(slug(cliente)).all();
  return (r.results || []).map(saida);
}

export async function lerLista(env, id, cliente) {
  await ensureListasSchema(env);
  const r = await env.DB.prepare('SELECT * FROM listas WHERE id = ? AND cliente = ?').bind(slug(id), slug(cliente)).first();
  return r ? saida(r) : null;
}

export async function salvarLista(env, cliente, b) {
  await ensureListasSchema(env);
  cliente = slug(cliente);
  if (!cliente) throw new Error('Cliente obrigatório');
  const tipo = TIPOS.indexOf(b.tipo) >= 0 ? b.tipo : 'precos';
  const tema = TEMAS.indexOf(b.tema) >= 0 ? b.tema : 'geral';
  const nome = txt(b.nome, 60) || (tipo === 'cardapio' ? 'Cardápio' : 'Tabela de preços');
  const dados = JSON.stringify(limparDados(b.dados));
  if (dados.length > LIMITES.bytes) throw new Error('Lista grande demais. Divida em duas listas.');
  const agora = Date.now();
  if (b.id) {
    const id = slug(b.id);
    const ex = await env.DB.prepare('SELECT 1 FROM listas WHERE id = ? AND cliente = ?').bind(id, cliente).first();
    if (!ex) throw new Error('Lista não encontrada');
    await env.DB.prepare('UPDATE listas SET tipo = ?, nome = ?, tema = ?, dados = ?, atualizado = ? WHERE id = ?').bind(tipo, nome, tema, dados, agora, id).run();
    return { id };
  }
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM listas WHERE cliente = ?').bind(cliente).first();
  if (n && n.n >= LIMITES.listas) throw new Error('Limite de ' + LIMITES.listas + ' listas por cliente. Exclua uma para criar outra.');
  const id = novoId();
  await env.DB.prepare('INSERT INTO listas (id, cliente, tipo, nome, tema, dados, criado, atualizado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, cliente, tipo, nome, tema, dados, agora, agora).run();
  return { id };
}

export async function excluirLista(env, id, cliente) {
  await ensureListasSchema(env);
  await env.DB.prepare('DELETE FROM listas WHERE id = ? AND cliente = ?').bind(slug(id), slug(cliente)).run();
}

// leitura pelas TVs: guardada na memória do servidor por 1 minuto
const mem = new Map();
export async function listaPublica(env, id, cliente) {
  const k = slug(cliente) + '/' + slug(id);
  const m = mem.get(k);
  if (m && Date.now() - m.t < 60000) return m.v;
  const v = await lerLista(env, id, cliente);
  mem.set(k, { t: Date.now(), v });
  if (mem.size > 500) mem.delete(mem.keys().next().value);
  return v;
}
export function esquecer(cliente, id) { mem.delete(slug(cliente) + '/' + slug(id)); }
