// Futebol: jogos, resultados e tabela (dados públicos da ESPN, sem chave).
// A resposta fica em cache na Cloudflare: 1 minuto com jogo rolando, 10 minutos no resto do tempo.
// Se a ESPN falhar, devolve a última resposta boa (até 2 dias).

export const LIGAS = {
  'bra.1': { nome: 'Brasileirão Série A', tabela: true },
  'bra.2': { nome: 'Brasileirão Série B', tabela: true },
  'bra.copa_do_brazil': { nome: 'Copa do Brasil', tabela: false },
  'conmebol.libertadores': { nome: 'Libertadores', tabela: false },
  'conmebol.sudamericana': { nome: 'Sul-Americana', tabela: false },
  'uefa.champions': { nome: 'Champions League', tabela: false },
  'eng.1': { nome: 'Premier League', tabela: true },
  'esp.1': { nome: 'La Liga', tabela: true }
};

const BASE = 'https://site.api.espn.com/apis/';
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const p2 = n => (n < 10 ? '0' : '') + n;
const brt = iso => new Date(new Date(iso).getTime() - 3 * 3600 * 1000);   // Brasília (sem horário de verão)

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSScreen/1.0)' }, signal: ctrl.signal, cf: { cacheTtl: 60 } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function time(c) {
  const t = c.team || {};
  return {
    nome: t.shortDisplayName || t.displayName || '', sigla: t.abbreviation || '',
    escudo: t.logo || (t.logos && t.logos[0] && t.logos[0].href) || '',
    cor: /^[0-9a-f]{6}$/i.test(t.color || '') ? '#' + t.color : '',
    gols: c.score != null && c.score !== '' ? Number(c.score) : null
  };
}

function jogo(e) {
  const comp = (e.competitions || [])[0] || {};
  const cs = comp.competitors || [];
  const casa = cs.find(c => c.homeAway === 'home') || cs[0];
  const fora = cs.find(c => c.homeAway === 'away') || cs[1];
  if (!casa || !fora) return null;
  const st = (e.status && e.status.type) || {};
  const d = brt(e.date);
  let situacao = '';
  if (st.state === 'in') situacao = st.name === 'STATUS_HALFTIME' ? 'Intervalo' : (e.status.displayClock || 'Ao vivo');
  else if (st.state === 'post') situacao = /POSTPONED|CANCELED|SUSPENDED/.test(st.name || '') ? 'Adiado' : 'Encerrado';
  else situacao = /POSTPONED|CANCELED/.test(st.name || '') ? 'Adiado' : '';
  return {
    id: e.id, data: e.date, estado: st.state || 'pre', situacao,
    dia: DIAS[d.getUTCDay()] + ' ' + p2(d.getUTCDate()) + '/' + p2(d.getUTCMonth() + 1),
    hora: p2(d.getUTCHours()) + ':' + p2(d.getUTCMinutes()),
    estadio: (comp.venue && comp.venue.fullName) || '',
    casa: time(casa), fora: time(fora)
  };
}

function tabela(st) {
  const groups = st.children && st.children.length ? st.children : [st];
  const g = groups[0];
  const entries = (g && g.standings && g.standings.entries) || [];
  const val = (e, n) => { const s = (e.stats || []).find(x => x.name === n); return s ? Number(s.value) || 0 : 0; };
  return entries.map(e => ({
    pos: val(e, 'rank'), nome: e.team.shortDisplayName || e.team.displayName, sigla: e.team.abbreviation,
    escudo: (e.team.logos && e.team.logos[0] && e.team.logos[0].href) || '',
    pts: val(e, 'points'), j: val(e, 'gamesPlayed'), v: val(e, 'wins'), e: val(e, 'ties'), d: val(e, 'losses'), sg: val(e, 'pointDifferential')
  })).sort((a, b) => a.pos - b.pos);
}

async function montar(liga) {
  const info = LIGAS[liga];
  const now = brt(new Date().toISOString());
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const mes = k => { const d = new Date(Date.UTC(y, m + k, 1)); return d.getUTCFullYear() + p2(d.getUTCMonth() + 1); };
  const meses = [mes(0)];
  if (now.getUTCDate() <= 10) meses.unshift(mes(-1));
  if (now.getUTCDate() >= 18) meses.push(mes(1));
  const reqs = meses.map(x => getJson(BASE + 'site/v2/sports/soccer/' + liga + '/scoreboard?dates=' + x + '&limit=300'));
  if (info.tabela) reqs.push(getJson(BASE + 'v2/sports/soccer/' + liga + '/standings').catch(() => null));
  const res = await Promise.all(reqs);
  const seen = new Set();
  const jogos = [];
  const add = r => (r.events || []).forEach(e => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    const j = jogo(e);
    if (j) jogos.push(j);
  });
  res.slice(0, meses.length).forEach(add);
  // copas com poucos jogos no mês: busca também o mês anterior para ter resultados
  if (meses.indexOf(mes(-1)) < 0 && jogos.filter(j => j.estado === 'post').length < 4) {
    try { add(await getJson(BASE + 'site/v2/sports/soccer/' + liga + '/scoreboard?dates=' + mes(-1) + '&limit=300')); } catch (_) {}
  }
  jogos.sort((a, b) => a.data < b.data ? -1 : 1);
  const aoVivo = jogos.filter(j => j.estado === 'in');
  const ultimos = jogos.filter(j => j.estado === 'post' && j.situacao !== 'Adiado').slice(-10).reverse();
  const proximos = jogos.filter(j => j.estado === 'pre' && j.situacao !== 'Adiado').slice(0, 10);
  const tab = info.tabela && res[meses.length] ? tabela(res[meses.length]) : [];
  return { liga, nome: info.nome, aoVivo, ultimos, proximos, tabela: tab, gerado: Date.now() };
}

export async function futebolResponse(liga, waitUntil, cors) {
  const headers = Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, cors);
  if (!LIGAS[liga]) return new Response(JSON.stringify({ erro: 'Liga desconhecida' }), { status: 404, headers });
  const key = new Request('https://futebol-cache.rsscreen/v2/' + liga);
  const staleKey = new Request('https://futebol-cache.rsscreen/stale/' + liga);
  const hit = await caches.default.match(key);
  if (hit) return hit;
  try {
    const data = await montar(liga);
    const soon = data.proximos.some(j => new Date(j.data).getTime() - Date.now() < 30 * 60 * 1000);
    const ttl = data.aoVivo.length || soon ? 60 : 600;
    const body = JSON.stringify(data);
    const res = new Response(body, { headers: Object.assign({ 'Cache-Control': 'public, max-age=' + ttl }, headers) });
    waitUntil(caches.default.put(key, res.clone()));
    waitUntil(caches.default.put(staleKey, new Response(body, { headers: Object.assign({ 'Cache-Control': 'public, max-age=172800' }, headers) })));
    return res;
  } catch (e) {
    const old = await caches.default.match(staleKey);
    if (old) return new Response(old.body, { headers: Object.assign({ 'Cache-Control': 'public, max-age=60', 'X-Rsscreen-Stale': '1' }, headers) });
    return new Response(JSON.stringify({ erro: 'Futebol indisponível no momento' }), { status: 503, headers: Object.assign({ 'Cache-Control': 'no-store' }, headers) });
  }
}
