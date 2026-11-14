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

function newBuf() { return { counts: {}, feeds: {}, devices: {}, errors: [] }; }

export function day(t) { return new Date(t || Date.now()).toISOString().slice(0, 10); }

function inc(dim, key, n) {
  if (key == null || key === '') return;
  const k = dim + '\u0001' + String(key).slice(0, 200);
  buf.counts[k] = (buf.counts[k] || 0) + (n || 1);
}

// Uma requisição qualquer da API (rss, og, hit)
export function trackRequest(request, kind) {
  inc('total', 'all');
  inc('api', kind);
  inc('ip', request.headers.get('CF-Connecting-IP') || '?');
  const cf = request.cf || {};
  if (cf.country) inc('pais', cf.country + (cf.city ? ' · ' + cf.city : ''));
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
  if (!Object.keys(b.counts).length && !Object.keys(b.feeds).length && !Object.keys(b.devices).length) return;
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
      erros: sql.exec('SELECT * FROM errors ORDER BY t DESC LIMIT 60').toArray()
    };
  }

  reset() {
    this.sql.exec('DELETE FROM counts; DELETE FROM feeds; DELETE FROM devices; DELETE FROM errors;');
    return true;
  }
}
