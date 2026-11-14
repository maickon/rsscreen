// Resultados de loterias.
//
// Fontes (nesta ordem, mudável com a variável LOTERIAS_FONTE = "apiloterias"):
//   1. API pública da Caixa (grátis, sem chave)
//   2. apiloterias.com (paga, chave no secret APILOTERIAS_KEY, limite mensal)
//
// Os resultados são buscados pelo Cron (depois dos sorteios) e guardados no Durable Object.
// As telas leem só a cópia guardada: o número de telas não consome a cota da apiloterias.

export const JOGOS = [
  { id: 'megasena', nome: 'Mega-Sena', cor: '#209869' },
  { id: 'lotofacil', nome: 'Lotofácil', cor: '#930089' },
  { id: 'quina', nome: 'Quina', cor: '#260085' },
  { id: 'maismilionaria', nome: '+Milionária', cor: '#2E3078' },
  { id: 'lotomania', nome: 'Lotomania', cor: '#F78100' },
  { id: 'duplasena', nome: 'Dupla Sena', cor: '#A61324' },
  { id: 'timemania', nome: 'Timemania', cor: '#00A650' },
  { id: 'diadesorte', nome: 'Dia de Sorte', cor: '#CB852B' },
  { id: 'supersete', nome: 'Super Sete', cor: '#A8CF45' },
  { id: 'federal', nome: 'Federal', cor: '#103099' },
  { id: 'loteca', nome: 'Loteca', cor: '#FB1F00' }
];
const BY_ID = Object.fromEntries(JOGOS.map(j => [j.id, j]));
const UA = 'Mozilla/5.0 (compatible; RSScreenBot/1.0)';

/* ---------------- datas no fuso de Brasília ---------------- */
function brNow() { return new Date(Date.now() - 3 * 3600 * 1000); }
function brToday() { return brNow().toISOString().slice(0, 10); }
function brHour() { return brNow().getUTCHours(); }
function isoFromBr(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : (/^\d{4}-\d{2}-\d{2}/.test(String(s || '')) ? String(s).slice(0, 10) : '');
}
const num = v => (v == null || v === '' ? 0 : Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) || 0);
const str = v => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim();

/* ---------------- normalização ---------------- */
function fromCaixa(jogo, d) {
  if (!d || !d.numero) throw new Error('Resposta sem concurso');
  return {
    jogo, nome: BY_ID[jogo].nome, cor: BY_ID[jogo].cor,
    concurso: Number(d.numero),
    data: isoFromBr(d.dataApuracao),
    dezenas: (d.listaDezenas || d.dezenasSorteadasOrdemSorteio || []).map(str),
    dezenas2: (d.listaDezenasSegundoSorteio || []).map(str),
    trevos: (d.trevosSorteados || []).map(str),
    extra: jogo === 'timemania' || jogo === 'diadesorte' ? str(d.nomeTimeCoracaoMesSorte).replace(/\s+/g, ' ') : '',
    acumulou: !!d.acumulado,
    premios: (d.listaRateioPremio || []).map(p => ({ faixa: str(p.descricaoFaixa), ganhadores: Number(p.numeroDeGanhadores) || 0, valor: Number(p.valorPremio) || 0 })),
    locais: (d.listaMunicipioUFGanhadores || []).map(g => ({ cidade: str(g.municipio), uf: str(g.uf), n: Number(g.ganhadores) || 1 })),
    jogos: (d.listaResultadoEquipeEsportiva || []).map(e => ({ casa: str(e.nomeEquipeUm), fora: str(e.nomeEquipeDois), g1: e.nuGolEquipeUm, g2: e.nuGolEquipeDois })),
    proximo: { concurso: Number(d.numeroConcursoProximo) || 0, data: isoFromBr(d.dataProximoConcurso), estimativa: Number(d.valorEstimadoProximoConcurso) || 0 },
    local: str(d.nomeMunicipioUFSorteio),
    fonte: 'caixa'
  };
}

function fromApiLoterias(jogo, d) {
  if (!d || !(d.numero_concurso || d.concurso)) throw new Error((d && (d.erro || d.message)) || 'Resposta sem concurso');
  const premios = (d.premiacao || d.premiacoes || []).map(p => ({
    faixa: str(p.faixa || p.nome || (p.quantidade_de_acertos ? p.quantidade_de_acertos + ' acertos' : '')),
    ganhadores: Number(p.numero_de_ganhadores || p.ganhadores) || 0,
    valor: num(p.valor_do_premio || p.valor)
  }));
  const locais = (Array.isArray(d.ganhadores) ? d.ganhadores : []).map(g => typeof g === 'string'
    ? { cidade: g.split(/[\/-]/)[0].trim(), uf: (g.split(/[\/-]/)[1] || '').trim(), n: 1 }
    : { cidade: str(g.cidade || g.municipio), uf: str(g.uf || g.estado), n: Number(g.quantidade || g.ganhadores) || 1 });
  return {
    jogo, nome: BY_ID[jogo].nome, cor: BY_ID[jogo].cor,
    concurso: Number(d.numero_concurso || d.concurso),
    data: isoFromBr(d.data_concurso || d.data),
    dezenas: jogo === 'supersete' ? (d.dezenas || []).map(str) : (d.dezenas || []).map(str).sort((a, b) => Number(a) - Number(b)),
    dezenas2: (d.dezenas_2 || d.dezenas_segundo_sorteio || []).map(str),
    trevos: (d.trevos || []).map(str),
    extra: str(d.mes_sorte || d.time_coracao || d.timeCoracao || ''),
    acumulou: d.acumulou === 1 || d.acumulou === true || d.acumulou === '1',
    premios, locais, jogos: [],
    proximo: { concurso: Number(d.numero_concurso || d.concurso) + 1, data: isoFromBr(d.data_proximo_concurso), estimativa: num(d.valor_estimado_proximo_concurso) },
    local: str(d.local_realizacao),
    fonte: 'apiloterias'
  };
}

/* ---------------- busca ---------------- */
async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: ctrl.signal });
    const txt = await r.text();
    let d = null;
    try { d = JSON.parse(txt); } catch (_) {}
    if (!r.ok) throw new Error('HTTP ' + r.status + (d && d.erro ? ' · ' + d.erro : ''));
    if (!d) throw new Error('Resposta inválida');
    return d;
  } finally { clearTimeout(t); }
}

async function fromSource(env, stub, fonte, jogo) {
  if (fonte === 'caixa') {
    return fromCaixa(jogo, await getJson('https://servicebus2.caixa.gov.br/portaldeloterias/api/' + jogo));
  }
  const key = env.APILOTERIAS_KEY;
  if (!key) throw new Error('apiloterias sem chave');
  const limite = Number(env.APILOTERIAS_LIMITE) || 450;
  const usados = await stub.lotUsage(brToday().slice(0, 7), 0);
  if (usados >= limite) throw new Error('Cota mensal da apiloterias reservada atingida (' + usados + ')');
  await stub.lotUsage(brToday().slice(0, 7), 1);
  return fromApiLoterias(jogo, await getJson('https://apiloterias.com/v1/' + jogo + '/' + encodeURIComponent(key)));
}

// Precisa buscar? Só quando o próximo sorteio já aconteceu (ou é hoje depois das 21h)
function isDue(cur) {
  if (!cur || !cur.concurso) return true;
  const hoje = brToday();
  const prox = cur.proximo && cur.proximo.data;
  if (!prox) return Date.now() - (cur.obtido || 0) > 6 * 3600 * 1000;
  if (prox > hoje) return false;
  if (prox === hoje) return brHour() >= 21;
  return true;
}

export async function updateJogo(env, stub, jogo, force) {
  const cur = await stub.lotGetOne(jogo);
  if (!force && !isDue(cur)) return { jogo, status: 'em dia' };
  const order = env.LOTERIAS_FONTE === 'apiloterias' ? ['apiloterias', 'caixa'] : ['caixa', 'apiloterias'];
  const erros = [];
  for (const fonte of order) {
    try {
      const novo = await fromSource(env, stub, fonte, jogo);
      if (cur && cur.concurso > novo.concurso) { erros.push(fonte + ': concurso antigo'); continue; }
      novo.obtido = Date.now();
      novo.erro = '';
      await stub.lotPut(jogo, novo);
      // a Caixa respondeu mas ainda não publicou o novo concurso: não gasta cota da apiloterias
      return { jogo, status: cur && cur.concurso === novo.concurso ? 'sem novidade' : 'novo', fonte };
    } catch (e) {
      erros.push(fonte + ': ' + (e && e.message ? e.message : e));
    }
  }
  if (cur) { cur.erro = erros.join(' | '); cur.erroEm = Date.now(); await stub.lotPut(jogo, cur); }
  return { jogo, status: 'falha', erro: erros.join(' | ') };
}

export async function updateAll(env, stub, force) {
  const out = [];
  for (const j of JOGOS) out.push(await updateJogo(env, stub, j.id, force));
  return out;
}


/* ---------------- estatísticas (apiloterias) ---------------- */
// Números quentes, frios, atrasados e pares/ímpares mudam pouco: atualiza 1 vez por semana
// (4 consultas por jogo). Sem chave, as telas usam modules/loterias/estatisticas.json.
export const STATS_JOGOS = ['megasena', 'lotofacil', 'quina', 'maismilionaria', 'lotomania', 'duplasena', 'timemania', 'diadesorte'];
const pad2 = v => String(v).padStart(2, '0');

async function fetchStats(env, stub, jogo) {
  const key = env.APILOTERIAS_KEY;
  const b = 'https://apiloterias.com/v1/' + jogo + '/' + encodeURIComponent(key);
  const mes = brToday().slice(0, 7);
  await stub.lotUsage(mes, 4);
  const [q, f, a, p] = await Promise.all([
    getJson(b + '/frequencia/quente/15'), getJson(b + '/frequencia/frio/15'),
    getJson(b + '/frequencia/mais-atrasados/15'), getJson(b + '/pares-impares')
  ]);
  if (!q.numeros_mais_frequentes) throw new Error('Resposta sem estatísticas');
  return {
    quentes: q.numeros_mais_frequentes.map(x => ({ n: pad2(x.numero), f: x.frequencia })),
    frios: (f.numeros_menos_frequentes || []).map(x => ({ n: pad2(x.numero), f: x.frequencia })),
    atrasados: (a.numeros_mais_atrasados || []).map(x => ({ n: pad2(x.numero), a: x.atraso })),
    paresImpares: (p.distribuicoes || []).slice(0, 6).map(x => ({ p: x.pares, i: x.impares, pct: Math.round(x.percentual * 10) / 10 })),
    sorteios: p.total_sorteios || 0,
    obtido: Date.now()
  };
}

export async function updateStats(env, stub, force) {
  if (!env.APILOTERIAS_KEY) return [{ status: 'sem chave' }];
  const limite = Number(env.APILOTERIAS_LIMITE) || 450;
  const out = [];
  for (const jogo of STATS_JOGOS) {
    const cur = await stub.lotGetOne('stats:' + jogo);
    if (!force && cur && Date.now() - cur.obtido < 7 * 86400 * 1000) { out.push({ jogo, status: 'em dia' }); continue; }
    // guarda uma folga de 60 consultas para os resultados
    if ((await stub.lotUsage(brToday().slice(0, 7), 0)) + 4 > limite - 60) { out.push({ jogo, status: 'cota reservada' }); continue; }
    try { await stub.lotPut('stats:' + jogo, await fetchStats(env, stub, jogo)); out.push({ jogo, status: 'novo' }); }
    catch (e) { out.push({ jogo, status: 'falha', erro: e.message }); }
  }
  return out;
}

async function readStats(env, request, rows) {
  const out = {};
  STATS_JOGOS.forEach(j => { if (rows['stats:' + j]) out[j] = rows['stats:' + j]; });
  if (Object.keys(out).length < STATS_JOGOS.length && env.ASSETS && request) {
    try {
      const seed = await (await env.ASSETS.fetch(new URL('/modules/loterias/estatisticas.json', request.url))).json();
      STATS_JOGOS.forEach(j => { if (!out[j] && seed.jogos && seed.jogos[j]) out[j] = seed.jogos[j]; });
    } catch (_) {}
  }
  return out;
}

/* ---------------- leitura para as telas ---------------- */
const lastKick = {};

// Sem Durable Object (site publicado como Cloudflare Pages): guarda na memória do servidor.
// Os resultados vêm da Caixa na hora e ficam guardados enquanto a instância estiver viva.
const mem = new Map();
export const memoryStub = {
  semArmazenamento: true,
  async lotGetOne(k) { return mem.get(k) || null; },
  async lotGetAll() { const o = {}; mem.forEach((v, k) => { if (!k.startsWith('uso:')) o[k] = v; }); return o; },
  async lotPut(k, v) { mem.set(k, v); },
  async lotUsage(mes, inc) { const k = 'uso:' + mes; const n = (mem.get(k) || 0) + (inc || 0); mem.set(k, n); return n; }
};

export async function loteriasResponse(env, stub, waitUntil, request) {
  const cache = caches.default;
  const key = new Request('https://loterias-cache.rsscreen/v2');
  const hit = await cache.match(key);
  if (hit) return hit;
  if (stub.semArmazenamento) {
    // sem armazenamento fixo: busca agora (em paralelo) os jogos que ainda não estão na memória
    const atual = await stub.lotGetAll();
    const faltam = JOGOS.filter(j => !atual[j.id] || (isDue(atual[j.id]) && Date.now() - (lastKick[j.id] || 0) > 10 * 60 * 1000));
    faltam.forEach(j => { lastKick[j.id] = Date.now(); });
    await Promise.all(faltam.map(j => updateJogo(env, stub, j.id, false).catch(() => {})));
  }
  const rows = await stub.lotGetAll();
  const jogos = {};
  const estatisticas = await readStats(env, request, rows);
  JOGOS.forEach(j => { if (rows[j.id]) { const r = Object.assign({}, rows[j.id]); delete r.erro; delete r.erroEm; jogos[j.id] = r; } });
  // primeiro acesso ou resultado atrasado: busca em segundo plano (no máximo a cada 10 min por jogo)
  JOGOS.forEach(j => {
    const cur = rows[j.id];
    if ((!cur || isDue(cur)) && Date.now() - (lastKick[j.id] || 0) > 10 * 60 * 1000) {
      lastKick[j.id] = Date.now();
      waitUntil(updateJogo(env, stub, j.id, false).catch(() => {}));
    }
  });
  const res = new Response(JSON.stringify({ jogos, estatisticas, ordem: JOGOS.map(j => j.id), gerado: Date.now() }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=120' }
  });
  if (Object.keys(jogos).length) waitUntil(cache.put(key, res.clone()));
  return res;
}
