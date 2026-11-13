// Clientes no Cloudflare D1 (binding DB).
//
// A tabela é criada sozinha no primeiro uso. Enquanto o banco estiver vazio (ou indisponível),
// as telas continuam usando a lista de config/clientes.js — nada para durante a migração.

let schemaOk = false;

export async function ensureSchema(env) {
  if (!env.DB || schemaOk) return !!env.DB;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS clientes (
      chave TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT DEFAULT '',
      plano TEXT DEFAULT '',
      valor REAL DEFAULT 0,
      telas INTEGER DEFAULT 1,
      vencimento INTEGER DEFAULT 0,
      ativo INTEGER DEFAULT 1,
      demo INTEGER DEFAULT 0,
      obs TEXT DEFAULT '',
      criado INTEGER,
      atualizado INTEGER
    )`)
  ]);
  schemaOk = true;
  return true;
}

const FIELDS = ['chave', 'nome', 'whatsapp', 'plano', 'valor', 'telas', 'vencimento', 'ativo', 'demo', 'obs'];

function clean(c) {
  const out = {
    chave: String(c.chave || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60),
    nome: String(c.nome || '').trim().slice(0, 80),
    whatsapp: String(c.whatsapp || '').replace(/\D/g, '').slice(0, 15),
    plano: String(c.plano || '').slice(0, 40),
    valor: Math.max(0, Number(c.valor) || 0),
    telas: Math.max(0, Math.min(9999, parseInt(c.telas, 10) || 0)),
    vencimento: Math.max(0, Math.min(31, parseInt(c.vencimento, 10) || 0)),
    ativo: c.ativo === false || c.ativo === 0 || c.ativo === '0' ? 0 : 1,
    demo: c.demo ? 1 : 0,
    obs: String(c.obs || '').slice(0, 500)
  };
  return out;
}

export async function listClientes(env) {
  if (!(await ensureSchema(env))) return null;
  const r = await env.DB.prepare('SELECT * FROM clientes ORDER BY demo DESC, nome COLLATE NOCASE').all();
  return r.results || [];
}

export async function countClientes(env) {
  if (!(await ensureSchema(env))) return -1;
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM clientes').first();
  return r ? r.n : 0;
}

export async function getCliente(env, chave) {
  if (!(await ensureSchema(env))) return null;
  return env.DB.prepare('SELECT chave, nome, ativo, demo FROM clientes WHERE chave = ?').bind(chave).first();
}

// Cria ou atualiza (a chave nunca muda, para não quebrar links já enviados)
export async function saveCliente(env, data, isNew) {
  await ensureSchema(env);
  const c = clean(data);
  if (!c.chave || !c.nome) throw new Error('Nome e chave são obrigatórios');
  const now = Date.now();
  if (isNew) {
    const exists = await env.DB.prepare('SELECT 1 FROM clientes WHERE chave = ?').bind(c.chave).first();
    if (exists) throw new Error('Já existe um cliente com essa chave');
    await env.DB.prepare(`INSERT INTO clientes (${FIELDS.join(', ')}, criado, atualizado) VALUES (${FIELDS.map(() => '?').join(', ')}, ?, ?)`)
      .bind(...FIELDS.map(f => c[f]), now, now).run();
  } else {
    const r = await env.DB.prepare(`UPDATE clientes SET ${FIELDS.slice(1).map(f => f + ' = ?').join(', ')}, atualizado = ? WHERE chave = ?`)
      .bind(...FIELDS.slice(1).map(f => c[f]), now, c.chave).run();
    if (!r.meta || !r.meta.changes) throw new Error('Cliente não encontrado');
  }
  return c;
}

export async function deleteCliente(env, chave) {
  await ensureSchema(env);
  await env.DB.prepare('DELETE FROM clientes WHERE chave = ?').bind(chave).run();
}

// Importa a lista do config/clientes.js (ignora quem já existe)
export async function importClientes(env, list) {
  await ensureSchema(env);
  const now = Date.now();
  const stmts = (list || []).slice(0, 500).map(clean).filter(c => c.chave && c.nome).map(c =>
    env.DB.prepare(`INSERT OR IGNORE INTO clientes (${FIELDS.join(', ')}, criado, atualizado) VALUES (${FIELDS.map(() => '?').join(', ')}, ?, ?)`)
      .bind(...FIELDS.map(f => c[f]), now, now));
  if (stmts.length) await env.DB.batch(stmts);
  return stmts.length;
}
