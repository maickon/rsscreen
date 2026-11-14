// Monitoramento do rsscreen: contadores de uso e saúde dos feeds RSS.
//
// Os eventos são somados na memória do Worker e enviados em lote (a cada ~20 s) para um
// Durable Object com SQLite — sem banco externo, sem configuração no painel da Cloudflare.
// Os números são aproximados (um lote pode se perder se o Worker for reciclado), o que é
// suficiente para acompanhar o uso das telas.

import { DurableObject } from 'cloudflare:workers';

const FLUSH_MS = 20000;
const KEEP_DAYS = 35;

/* ======================= lado do Worker (buffer) ======================= */
let buf = newBuf();
let lastFlush = 0;

function newBuf() { return { counts: {}, feeds: {}, devices: {}, devReq: {}, errors: [] }; }

export function day(t) { return new Date(t || Date.now()).toISOString().slice(0, 10); }

function inc(dim, key, n) {
  if (key == null || key === '') return;
  const k = dim + '\u0001' + String(key).slice(0, 200);
  buf.counts[k] = (buf.counts[k] || 0) + (n || 1);
}

const limpa = v => String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);

// Uma requisição qualquer da API. As telas mandam rc (cliente) e rd (aparelho) em todo pedido,
// para o painel mostrar o consumo de cada cliente e de cada aparelho.
export function trackRequest(request, kind) {
  inc('total', 'all');
  inc('api', kind);
  const ip = request.headers.get('CF-Connecting-IP') || '?';
  inc('ip', ip);
  const cf = request.cf || {};
  if (cf.country) inc('pais', cf.country + (cf.city ? ' · ' + cf.city : ''));
  let p;
  try { p = new URL(request.url).searchParams; } catch (_) { return; }
  const cli = limpa(p.get('rc') || p.get('cliente') || p.get('chave'));
  inc('cli-req', cli || '(sem identificação)');
  if (cli) inc('cli-api', cli + '|' + kind);
  const dev = String(p.get('rd') || p.get('d') || '').slice(0, 120);
  if (dev) {
    const ua = request.headers.get('User-Agent') || '';
    const v = buf.devReq[dev] || (buf.devReq[dev] = { n: 0 });
    v.n++;
    v.cliente = cli || v.cliente || '';
    v.ip = ip; v.ua = ua.slice(0, 250); v.player = player(ua);
    v.local = [cf.city, cf.region, cf.country].filter(Boolean).join(', ');
    v.t = Date.now();
  }
}

// Resultado de um feed RSS: cache | ok | falha | antigo (falhou, mas serviu a última cópia boa)
export function trackFeed(url, result, info) {
  const f = buf.feeds[url] || (buf.feeds[url] = { req: 0, cache: 0, ok: 0, fail: 0, stale: 0, ms: 0, status: 0, err: '', tOk: 0, tFail: 0 });
  f.req++;
  if (result === 'cache') f.cache++;
  if (result === 'ok') { f.ok++; f.tOk = Date.now(); f.status = info.status || 200; f.ms = info.ms || 0; }
  if (result === 'falha' || result === 'antigo') {
    f.fail++;
    if (result === 'antigo') f.stale++;
    f.tFail = Date.now(); f.status = info.status || 0; f.err = String(info.err || '').slice(0, 200);
    if (buf.errors.length < 50) buf.errors.push({ t: Date.now(), url, status: f.status, msg: f.err });
  }
}

// Busca de foto na página da notícia (por domínio)
export function trackOg(host, found) { inc(found ? 'og-ok' : 'og-vazio', host); }

// Sinal enviado pela tela a cada 5 minutos
export function trackHit(request, p) {
  const cf = request.cf || {};
  const cliente = p.get('cliente') || '(sem cliente)';
  const tela = ['modulo', 'assunto', 'fonte', 'layout', 'orientacao'].map(k => p.get(k) || '-').join('/');
  const ua = request.headers.get('User-Agent') || '';
  inc('cliente', cliente);
  inc('tela', cliente + ' · ' + tela);
  inc('modulo', p.get('modulo') || 'rss');
  inc('player', player(ua));
  if (p.get('novo')) inc('aberturas', cliente);
  const ip = request.headers.get('CF-Connecting-IP') || '?';
  const id = (p.get('d') || ip + '|' + ua).slice(0, 120);
  buf.devices[id] = {
    cliente, tela, ip, ua: ua.slice(0, 250), player: player(ua),
    local: [cf.city, cf.region, cf.country].filter(Boolean).join(', '),
    ok: p.get('ok') === '1' ? 1 : 0, t: Date.now(),
    beats: ((buf.devices[id] && buf.devices[id].beats) || 0) + 1
  };
}

export function player(ua) {
  const u = ua.toLowerCase();
  if (/tizen/.test(u)) return 'Samsung Tizen';
  if (/web0s|webos/.test(u)) return 'LG webOS';
  if (/brightsign/.test(u)) return 'BrightSign';
  if (/aft|fire tv/.test(u)) return 'Fire TV';
  if (/android/.test(u) && /; wv\)|version\/\d/.test(u)) return 'Android (app/WebView)';
  if (/android/.test(u) && /tv|box|bravia|mibox|smart/.test(u)) return 'Android TV';
  if (/android/.test(u)) return 'Android (Chrome)';
  if (/raspbian|armv7|aarch64.*linux|cros/.test(u)) return 'Raspberry / Linux ARM';
  if (/iphone|ipad/.test(u)) return 'iPhone / iPad';
  if (/windows/.test(u)) return 'Windows';
  if (/mac os/.test(u)) return 'Mac';
  if (/linux/.test(u)) return 'Linux';
  return 'Outro';
}

export function maybeFlush(env, waitUntil, force) {
  if (!env.STATS) return;
  const now = Date.now();
  if (!force && now - lastFlush < FLUSH_MS) return;
  const b = buf;
  if (!Object.keys(b.counts).length && !Object.keys(b.feeds).length && !Object.keys(b.devices).length && !Object.keys(b.devReq).length) return;
  buf = newBuf();
  lastFlush = now;
  const stub = env.STATS.get(env.STATS.idFromName('global'));
  waitUntil(stub.ingest(day(now), b).catch(() => {}));
}

export function statsStub(env) {
  return env.STATS ? env.STATS.get(env.STATS.idFromName('global')) : null;
}

/* ======================= Durable Object (SQLite) ======================= */
export class Stats extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS counts (day TEXT, dim TEXT, key TEXT, n INTEGER, PRIMARY KEY (day, dim, key));
      CREATE TABLE IF NOT EXISTS feeds (url TEXT PRIMARY KEY, req INTEGER, cache INTEGER, ok INTEGER, fail INTEGER, stale INTEGER,
        status INTEGER, err TEXT, ms INTEGER, t_ok INTEGER, t_fail INTEGER, t_check INTEGER, check_ok INTEGER, check_msg TEXT);
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, cliente TEXT, tela TEXT, ip TEXT, ua TEXT, player TEXT, local TEXT,
        ok INTEGER, first INTEGER, last INTEGER, beats INTEGER);
      CREATE TABLE IF NOT EXISTS errors (t INTEGER, url TEXT, status INTEGER, msg TEXT);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS loterias (jogo TEXT PRIMARY KEY, dados TEXT, atualizado INTEGER);
    `);
    // pedidos de cada aparelho (coluna nova; tabelas antigas ganham a coluna aqui)
    try { this.sql.exec('ALTER TABLE devices ADD COLUMN reqs INTEGER DEFAULT 0'); } catch (_) {}
  }

  /* ---------- resultados de loterias (worker/loterias.js) ---------- */
  lotGetOne(jogo) {
    const r = this.sql.exec('SELECT dados FROM loterias WHERE jogo = ?', jogo).toArray()[0];
    return r ? JSON.parse(r.dados) : null;
  }

  lotGetAll() {
    const out = {};
    this.sql.exec('SELECT jogo, dados FROM loterias').toArray().forEach(r => { out[r.jogo] = JSON.parse(r.dados); });
    return out;
  }

  lotPut(jogo, dados) {
    this.sql.exec('INSERT INTO loterias (jogo, dados, atualizado) VALUES (?, ?, ?) ON CONFLICT (jogo) DO UPDATE SET dados = excluded.dados, atualizado = excluded.atualizado',
      jogo, JSON.stringify(dados), Date.now());
    return true;
  }

  // Requisições à apiloterias no mês (inc = 0 só consulta)
  lotUsage(mes, inc) {
    const k = 'apiloterias-' + mes;
    if (inc) this.sql.exec("INSERT INTO meta (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = CAST(v AS INTEGER) + ?", k, String(inc), inc);
    const r = this.sql.exec('SELECT v FROM meta WHERE k = ?', k).toArray()[0];
    return r ? Number(r.v) : 0;
  }

  ingest(d, b) {
    const sql = this.sql;
    for (const k in b.counts) {
      const [dim, key] = k.split('\u0001');
      sql.exec('INSERT INTO counts (day, dim, key, n) VALUES (?, ?, ?, ?) ON CONFLICT (day, dim, key) DO UPDATE SET n = n + excluded.n', d, dim, key, b.counts[k]);
    }
    for (const url in b.feeds) {
      const f = b.feeds[url];
      sql.exec(`INSERT INTO feeds (url, req, cache, ok, fail, stale, status, err, ms, t_ok, t_fail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (url) DO UPDATE SET req = req + excluded.req, cache = cache + excluded.cache, ok = ok + excluded.ok,
        fail = fail + excluded.fail, stale = stale + excluded.stale,
        status = CASE WHEN excluded.t_ok > 0 OR excluded.t_fail > 0 THEN excluded.status ELSE status END,
        err = CASE WHEN excluded.t_fail > 0 THEN excluded.err ELSE err END,
        ms = CASE WHEN excluded.t_ok > 0 THEN excluded.ms ELSE ms END,
        t_ok = MAX(IFNULL(t_ok, 0), excluded.t_ok), t_fail = MAX(IFNULL(t_fail, 0), excluded.t_fail)`,
        url, f.req, f.cache, f.ok, f.fail, f.stale, f.status, f.err, f.ms, f.tOk, f.tFail);
    }
    for (const id in b.devices) {
      const v = b.devices[id];
      sql.exec(`INSERT INTO devices (id, cliente, tela, ip, ua, player, local, ok, first, last, beats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET cliente = excluded.cliente, tela = excluded.tela, ip = excluded.ip, ua = excluded.ua,
        player = excluded.player, local = excluded.local, ok = excluded.ok, last = excluded.last, beats = beats + excluded.beats`,
        id, v.cliente, v.tela, v.ip, v.ua, v.player, v.local, v.ok, v.t, v.t, v.beats);
    }
    for (const id in (b.devReq || {})) {
      const v = b.devReq[id];
      sql.exec(`INSERT INTO devices (id, cliente, tela, ip, ua, player, local, ok, first, last, beats, reqs) VALUES (?, ?, '', ?, ?, ?, ?, 1, ?, ?, 0, ?)
        ON CONFLICT (id) DO UPDATE SET reqs = IFNULL(reqs, 0) + excluded.reqs, last = MAX(last, excluded.last), ip = excluded.ip,
        ua = excluded.ua, player = excluded.player, local = excluded.local,
        cliente = CASE WHEN excluded.cliente <> '' THEN excluded.cliente ELSE cliente END`,
        id, v.cliente, v.ip, v.ua, v.player, v.local, v.t, v.t, v.n);
    }
    for (const e of b.errors) sql.exec('INSERT INTO errors (t, url, status, msg) VALUES (?, ?, ?, ?)', e.t, e.url, e.status, e.msg);
    this.cleanup();
  }

  // Resultado do botão "Testar todos os feeds"
  saveCheck(results) {
    const now = Date.now();
    for (const r of results) {
      this.sql.exec(`INSERT INTO feeds (url, req, cache, ok, fail, stale, status, err, ms, t_ok, t_fail, t_check, check_ok, check_msg)
        VALUES (?, 0, 0, 0, 0, 0, ?, '', ?, 0, 0, ?, ?, ?)
        ON CONFLICT (url) DO UPDATE SET t_check = excluded.t_check, check_ok = excluded.check_ok, check_msg = excluded.check_msg`,
        r.url, r.status, r.ms, now, r.ok ? 1 : 0, r.msg);
    }
  }

  cleanup() {
    const row = this.sql.exec("SELECT v FROM meta WHERE k = 'cleanup'").toArray()[0];
    const last = row ? Number(row.v) : 0;
    if (Date.now() - last < 6 * 3600 * 1000) return;
    const limit = day(Date.now() - KEEP_DAYS * 86400000);
    this.sql.exec('DELETE FROM counts WHERE day < ?', limit);
    this.sql.exec('DELETE FROM devices WHERE last < ?', Date.now() - KEEP_DAYS * 86400000);
    this.sql.exec('DELETE FROM errors WHERE rowid NOT IN (SELECT rowid FROM errors ORDER BY t DESC LIMIT 300)');
    this.sql.exec("INSERT INTO meta (k, v) VALUES ('cleanup', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v", String(Date.now()));
  }

  report(days) {
    const sql = this.sql;
    const n = Math.max(1, Math.min(KEEP_DAYS, Number(days) || 7));
    const from = day(Date.now() - (n - 1) * 86400000);
    const top = (dim, limit) => sql.exec('SELECT key, SUM(n) AS n FROM counts WHERE dim = ? AND day >= ? GROUP BY key ORDER BY n DESC LIMIT ?', dim, from, limit || 15).toArray();
    const perDay = sql.exec("SELECT day, dim, key, n FROM counts WHERE day >= ? AND dim IN ('total', 'api') ORDER BY day", from).toArray();
    const daysMap = {};
    perDay.forEach(r => {
      const d = daysMap[r.day] || (daysMap[r.day] = { day: r.day, total: 0, rss: 0, og: 0, hit: 0, stats: 0 });
      if (r.dim === 'total') d.total += r.n; else d[r.key] = (d[r.key] || 0) + r.n;
    });
    const now = Date.now();
    return {
      gerado: now,
      dias: n,
      porDia: Object.values(daysMap),
      telas: top('tela', 30),
      clientes: top('cliente', 30),
      aberturas: top('aberturas', 30),
      ips: top('ip', 20),
      paises: top('pais', 15),
      players: top('player', 12),
      modulos: top('modulo', 10),
      ogOk: top('og-ok', 40),
      ogVazio: top('og-vazio', 40),
      feeds: sql.exec('SELECT * FROM feeds').toArray(),
      dispositivos: sql.exec('SELECT * FROM devices WHERE last >= ? ORDER BY last DESC LIMIT 300', now - n * 86400000).toArray(),
      ativosAgora: sql.exec('SELECT COUNT(*) AS c FROM devices WHERE last >= ?', now - 40 * 60000).toArray()[0].c,
      erros: sql.exec('SELECT * FROM errors ORDER BY t DESC LIMIT 60').toArray(),
      porCliente: this.porCliente(n)
    };
  }

  // Resumo de consumo de cada cliente no período
  porCliente(n) {
    const sql = this.sql, now = Date.now();
    const from = day(now - (n - 1) * 86400000);
    const out = {};
    const get = c => out[c] || (out[c] = { cliente: c, aparelhos: 0, ligados: 0, cidades: 0, ips: 0, reqs: 0, tipos: {}, dias: {} });
    sql.exec(`SELECT cliente, COUNT(*) AS aparelhos, SUM(CASE WHEN last >= ? THEN 1 ELSE 0 END) AS ligados,
      COUNT(DISTINCT local) AS cidades, COUNT(DISTINCT ip) AS ips FROM devices WHERE last >= ? AND cliente <> '' GROUP BY cliente`,
      now - 40 * 60000, now - n * 86400000).toArray().forEach(r => Object.assign(get(r.cliente), { aparelhos: r.aparelhos, ligados: r.ligados, cidades: r.cidades, ips: r.ips }));
    sql.exec("SELECT day, key, n FROM counts WHERE dim = 'cli-req' AND day >= ?", from).toArray().forEach(r => {
      const c = get(r.key); c.reqs += r.n; c.dias[r.day] = (c.dias[r.day] || 0) + r.n;
    });
    sql.exec("SELECT key, SUM(n) AS n FROM counts WHERE dim = 'cli-api' AND day >= ? GROUP BY key", from).toArray().forEach(r => {
      const i = r.key.lastIndexOf('|');
      get(r.key.slice(0, i)).tipos[r.key.slice(i + 1)] = r.n;
    });
    return Object.values(out).sort((a, b) => b.reqs - a.reqs || b.aparelhos - a.aparelhos);
  }

  // Tudo sobre um cliente: aparelhos, cidades, telas (links), players e pedidos por dia
  cliente(c, days) {
    const sql = this.sql, now = Date.now();
    const n = Math.max(1, Math.min(KEEP_DAYS, Number(days) || 7));
    const desde = now - n * 86400000, from = day(now - (n - 1) * 86400000), on = now - 40 * 60000;
    const devices = sql.exec('SELECT * FROM devices WHERE cliente = ? AND last >= ? ORDER BY last DESC LIMIT 3000', c, desde).toArray();
    const cidades = sql.exec(`SELECT local, COUNT(*) AS aparelhos, SUM(CASE WHEN last >= ? THEN 1 ELSE 0 END) AS ligados, SUM(IFNULL(reqs, 0)) AS reqs
      FROM devices WHERE cliente = ? AND last >= ? GROUP BY local ORDER BY aparelhos DESC`, on, c, desde).toArray();
    const players = sql.exec('SELECT player, COUNT(*) AS aparelhos FROM devices WHERE cliente = ? AND last >= ? GROUP BY player ORDER BY aparelhos DESC', c, desde).toArray();
    const telas = sql.exec("SELECT key, SUM(n) AS n FROM counts WHERE dim = 'tela' AND day >= ? AND key LIKE ? GROUP BY key ORDER BY n DESC LIMIT 50", from, c + ' · %').toArray()
      .map(r => ({ tela: r.key.slice(c.length + 3), sinais: r.n, aparelhos: devices.filter(d => d.tela === r.key.slice(c.length + 3)).length }));
    const dias = sql.exec("SELECT day, SUM(n) AS n FROM counts WHERE dim = 'cli-req' AND key = ? AND day >= ? GROUP BY day ORDER BY day", c, from).toArray();
    const tipos = sql.exec("SELECT key, SUM(n) AS n FROM counts WHERE dim = 'cli-api' AND key LIKE ? AND day >= ? GROUP BY key ORDER BY n DESC", c + '|%', from).toArray()
      .map(r => ({ tipo: r.key.slice(c.length + 1), n: r.n }));
    const aberturas = (sql.exec("SELECT SUM(n) AS n FROM counts WHERE dim = 'aberturas' AND key = ? AND day >= ?", c, from).toArray()[0] || {}).n || 0;
    return { cliente: c, dias: n, gerado: now, devices, cidades, players, telas, porDia: dias, tipos, aberturas,
      ligados: devices.filter(d => d.last >= on).length };
  }

  reset() {
    this.sql.exec('DELETE FROM counts; DELETE FROM feeds; DELETE FROM devices; DELETE FROM errors;');
    return true;
  }
}
