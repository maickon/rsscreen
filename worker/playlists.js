// Playlists (programação da TV em um link só), guardadas no D1.
// Cada playlist é uma lista de conteúdos (módulo + assunto + modelo + tempo na tela).
// O link fica  /tela/?cliente=<chave>&playlist=<id>  e não muda quando a playlist é editada.

let schemaOk = false;
const MAX_ITENS = 40;
const slug = v => String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
const newId = () => Math.random().toString(36).slice(2, 6) + Date.now().toString(36).slice(-4);

export async function ensurePlaylistSchema(env) {
  if (!env.DB) return false;
  if (schemaOk) return true;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY, cliente TEXT NOT NULL, nome TEXT DEFAULT '',
      itens TEXT DEFAULT '[]', opcoes TEXT DEFAULT '{}', criado INTEGER, atualizado INTEGER)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS playlists_cliente ON playlists (cliente, criado)')
  ]);
  schemaOk = true;
  return true;
}

function cleanItens(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_ITENS).map(it => {
    const o = { modulo: slug(it && it.modulo) || 'rss' };
    ['assunto', 'fonte', 'layout'].forEach(k => { const v = slug(it && it[k]); if (v) o[k] = v; });
    o.duracao = Math.max(5, Math.min(900, parseInt(it && it.duracao, 10) || 30));
    const t = parseInt(it && it.tempo, 10);
    if (t >= 4 && t <= 120) o.tempo = t;
    return o;
  });
}

function cleanOpcoes(o) {
  o = o || {};
  const out = {};
  const tema = slug(o.tema);
  if (tema) out.tema = tema;
  const n = parseInt(o.intercalar, 10);
  if (n >= 5 && n <= 120) out.intercalar = n;
  const lay = slug(o.layoutAnuncios);
  if (lay) out.layoutAnuncios = lay;
  return out;
}

function rowOut(r) {
  let itens = [], opcoes = {};
  try { itens = JSON.parse(r.itens || '[]'); } catch (_) {}
  try { opcoes = JSON.parse(r.opcoes || '{}'); } catch (_) {}
  return { id: r.id, cliente: r.cliente, nome: r.nome, itens, opcoes, atualizado: r.atualizado };
}

export async function listPlaylists(env, cliente) {
  await ensurePlaylistSchema(env);
  const r = await env.DB.prepare('SELECT * FROM playlists WHERE cliente = ? ORDER BY criado').bind(slug(cliente)).all();
  return (r.results || []).map(rowOut);
}

export async function getPlaylist(env, id, cliente) {
  await ensurePlaylistSchema(env);
  const r = await env.DB.prepare('SELECT * FROM playlists WHERE id = ? AND cliente = ?').bind(slug(id), slug(cliente)).first();
  return r ? rowOut(r) : null;
}

export async function savePlaylist(env, b) {
  await ensurePlaylistSchema(env);
  const cliente = slug(b.cliente);
  if (!cliente) throw new Error('Cliente obrigatório');
  const itens = cleanItens(b.itens);
  if (!itens.length) throw new Error('Adicione pelo menos um conteúdo');
  const nome = String(b.nome || '').trim().slice(0, 80) || 'Playlist';
  const now = Date.now();
  const vals = [nome, JSON.stringify(itens), JSON.stringify(cleanOpcoes(b.opcoes)), now];
  if (b.id) {
    const id = slug(b.id);
    const old = await env.DB.prepare('SELECT 1 FROM playlists WHERE id = ? AND cliente = ?').bind(id, cliente).first();
    if (!old) throw new Error('Playlist não encontrada');
    await env.DB.prepare('UPDATE playlists SET nome = ?, itens = ?, opcoes = ?, atualizado = ? WHERE id = ?').bind(...vals, id).run();
    return { id };
  }
  const id = newId();
  await env.DB.prepare('INSERT INTO playlists (nome, itens, opcoes, atualizado, id, cliente, criado) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(...vals, id, cliente, now).run();
  return { id };
}

export async function deletePlaylist(env, id, cliente) {
  await ensurePlaylistSchema(env);
  await env.DB.prepare('DELETE FROM playlists WHERE id = ? AND cliente = ?').bind(slug(id), slug(cliente)).run();
}

export const playlistCacheKey = id => new Request('https://playlist-cache.rsscreen/' + slug(id));
