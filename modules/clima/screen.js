/* Módulo Clima — Open-Meteo (gratuito, sem chave). Layouts: agora, semana, horas */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;
  const WD_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function wmo(code) {
    if (code === 0) return { t: 'Céu limpo', i: 'sun' };
    if (code === 1) return { t: 'Predomínio de sol', i: 'partly' };
    if (code === 2) return { t: 'Parcialmente nublado', i: 'partly' };
    if (code === 3) return { t: 'Nublado', i: 'cloud' };
    if (code === 45 || code === 48) return { t: 'Nevoeiro', i: 'fog' };
    if (code >= 51 && code <= 57) return { t: 'Garoa', i: 'drizzle' };
    if (code === 61 || code === 66) return { t: 'Chuva fraca', i: 'rain' };
    if (code === 63) return { t: 'Chuva', i: 'rain' };
    if (code === 65 || code === 67) return { t: 'Chuva forte', i: 'rain' };
    if (code >= 71 && code <= 77) return { t: 'Neve', i: 'snow' };
    if (code >= 80 && code <= 82) return { t: 'Pancadas de chuva', i: 'rain' };
    if (code >= 95) return { t: 'Tempestade', i: 'storm' };
    return { t: '—', i: 'cloud' };
  }

  const CLOUD = '<path d="M19 48h28a11 11 0 0 0 1-22 15 15 0 0 0-29-3 12.5 12.5 0 0 0 0 25z" fill="var(--cloud)"/>';
  const SUN_RAYS = '<g stroke="#facc15" stroke-width="3.5" stroke-linecap="round">' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => '<line x1="32" y1="6" x2="32" y2="12" transform="rotate(' + a + ' 32 32)"/>').join('') + '</g>';

  function icon(name, isDay) {
    let body = '';
    if (name === 'sun') {
      body = isDay === 0
        ? '<path d="M40 10a22 22 0 1 0 14 38A20 20 0 0 1 40 10z" fill="#fde68a"/>'
        : SUN_RAYS + '<circle cx="32" cy="32" r="13" fill="#facc15"/>';
    } else if (name === 'partly') {
      body = (isDay === 0
        ? '<path d="M28 6a15 15 0 1 0 10 26A13 13 0 0 1 28 6z" fill="#fde68a"/>'
        : '<g transform="translate(-8 -8) scale(.8)">' + SUN_RAYS + '<circle cx="32" cy="32" r="13" fill="#facc15"/></g>') +
        '<g transform="translate(4 6)">' + CLOUD + '</g>';
    } else if (name === 'cloud') {
      body = '<g transform="translate(0 2)">' + CLOUD + '</g>';
    } else if (name === 'fog') {
      body = '<g transform="translate(0 -6)">' + CLOUD + '</g><g stroke="var(--cloud)" stroke-width="3.5" stroke-linecap="round"><line x1="12" y1="52" x2="52" y2="52"/><line x1="18" y1="59" x2="46" y2="59"/></g>';
    } else if (name === 'drizzle' || name === 'rain') {
      const n = name === 'rain' ? 3 : 2;
      let drops = '';
      for (let k = 0; k < n; k++) drops += '<line x1="' + (22 + k * 10) + '" y1="50" x2="' + (19 + k * 10) + '" y2="59"/>';
      body = '<g transform="translate(0 -6)">' + CLOUD + '</g><g stroke="#60a5fa" stroke-width="3.5" stroke-linecap="round">' + drops + '</g>';
    } else if (name === 'storm') {
      body = '<g transform="translate(0 -6)">' + CLOUD + '</g><path d="M33 44l-7 11h7l-3 9 10-13h-7l4-7z" fill="#facc15"/>';
    } else if (name === 'snow') {
      body = '<g transform="translate(0 -6)">' + CLOUD + '</g><g fill="#e0f2fe"><circle cx="22" cy="54" r="2.6"/><circle cx="32" cy="58" r="2.6"/><circle cx="42" cy="54" r="2.6"/></g>';
    }
    return '<svg class="w-ico" viewBox="0 0 64 64" aria-hidden="true">' + body + '</svg>';
  }

  async function load(ctx) {
    const c = ctx.assunto;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + c.lat + '&longitude=' + c.lon +
      '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,is_day' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset' +
      '&timezone=auto&forecast_days=7';
    const d = await S.fetchJson(url);
    if (!d || !d.current) throw new Error('Clima indisponível');
    return [d];
  }

  const r = n => Math.round(n);
  function dayLabel(dateStr, k) {
    if (k === 0) return 'Hoje';
    if (k === 1) return 'Amanhã';
    const dt = new Date(dateStr + 'T12:00:00');
    return WD_SHORT[dt.getDay()];
  }
  function dayNum(dateStr) {
    const p = dateStr.split('-');
    return p[2] + '/' + p[1];
  }

  function header(ctx, d) {
    return '<div class="w-head">' +
      '<div><div class="w-city">' + esc(ctx.assunto.nome) + '</div><div class="w-date">' + S.clockHtml('date') + '</div></div>' +
      '<div class="w-clock">' + S.clockHtml() + '</div>' +
    '</div>';
  }

  function currentBlock(d) {
    const cur = d.current;
    const w = wmo(cur.weather_code);
    const uv = d.daily.uv_index_max ? r(d.daily.uv_index_max[0]) : null;
    return '<div class="w-now rise">' +
        '<div class="w-now-main">' + icon(w.i, cur.is_day) +
          '<div class="w-temp">' + r(cur.temperature_2m) + '<sup>°C</sup></div>' +
        '</div>' +
        '<div class="w-cond">' + esc(w.t) + '</div>' +
        '<div class="w-range">Máx <b>' + r(d.daily.temperature_2m_max[0]) + '°</b> · Mín <b>' + r(d.daily.temperature_2m_min[0]) + '°</b></div>' +
        '<div class="w-details">' +
          '<div><small>Sensação</small><b>' + r(cur.apparent_temperature) + '°</b></div>' +
          '<div><small>Umidade</small><b>' + r(cur.relative_humidity_2m) + '%</b></div>' +
          '<div><small>Vento</small><b>' + r(cur.wind_speed_10m) + ' km/h</b></div>' +
          (uv !== null ? '<div><small>Índice UV</small><b>' + uv + '</b></div>' : '') +
        '</div>' +
      '</div>';
  }

  function dayCard(d, k, cls) {
    const dl = d.daily;
    const w = wmo(dl.weather_code[k]);
    return '<div class="' + cls + ' rise d' + Math.min(3, k) + '">' +
      '<div class="w-dname">' + dayLabel(dl.time[k], k) + '<small>' + dayNum(dl.time[k]) + '</small></div>' +
      icon(w.i, 1) +
      '<div class="w-dcond">' + esc(w.t) + '</div>' +
      '<div class="w-dtemps"><b>' + r(dl.temperature_2m_max[k]) + '°</b><span>' + r(dl.temperature_2m_min[k]) + '°</span></div>' +
      '<div class="w-rain"><svg class="w-drop" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z" fill="#60a5fa"/></svg>' + (dl.precipitation_probability_max[k] || 0) + '%</div>' +
    '</div>';
  }

  const L = {};

  L.agora = (d, ctx) => {
    let days = '';
    for (let k = 1; k <= 5 && k < d.daily.time.length; k++) days += dayCard(d, k, 'w-day');
    return '<div class="w-bg"></div>' + header(ctx, d) +
      '<div class="w-agora">' + currentBlock(d) + '<div class="w-days">' + days + '</div></div>';
  };

  L.semana = (d, ctx) => {
    let days = '';
    for (let k = 0; k < d.daily.time.length; k++) days += dayCard(d, k, 'w-col');
    return '<div class="w-bg"></div>' + header(ctx, d) +
      '<div class="w-title">Previsão para os próximos 7 dias</div>' +
      '<div class="w-week">' + days + '</div>';
  };

  L.horas = (d, ctx) => {
    const h = d.hourly;
    const nowIso = d.current.time.slice(0, 13);
    let start = h.time.findIndex(t => t.slice(0, 13) >= nowIso);
    if (start < 0) start = 0;
    const idxs = [];
    for (let k = start; k < Math.min(start + 12, h.time.length); k++) idxs.push(k);
    const temps = idxs.map(k => h.temperature_2m[k]);
    const min = Math.min.apply(null, temps), max = Math.max.apply(null, temps);
    const span = Math.max(1, max - min);
    const cols = idxs.map((k, n) => {
      const w = wmo(h.weather_code[k]);
      const pct = 25 + ((h.temperature_2m[k] - min) / span) * 75;
      return '<div class="w-hour rise d' + Math.min(3, Math.floor(n / 4)) + '">' +
        '<div class="w-hh">' + (n === 0 ? 'Agora' : h.time[k].slice(11, 16)) + '</div>' +
        icon(w.i, h.is_day[k]) +
        '<div class="w-ht">' + r(h.temperature_2m[k]) + '°</div>' +
        '<div class="w-bar"><i style="--p:' + pct.toFixed(0) + '%"></i></div>' +
        '<div class="w-hp">' + (h.precipitation_probability[k] || 0) + '%</div>' +
      '</div>';
    }).join('');
    const cur = d.current, w = wmo(cur.weather_code);
    return '<div class="w-bg"></div>' + header(ctx, d) +
      '<div class="w-title">Agora: <b>' + r(cur.temperature_2m) + '°C</b> · ' + esc(w.t) + ' &nbsp;—&nbsp; próximas 12 horas</div>' +
      '<div class="w-hours">' + cols + '</div>';
  };

  S.register('clima', {
    refreshMinutes: 15,
    rerenderOnRefresh: true,
    load,
    render(d, i, all, ctx) {
      return (L[ctx.layout] || L.agora)(d, ctx);
    }
  });
})();
