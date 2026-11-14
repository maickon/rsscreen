/* Módulo Mural — boas-vindas com QR Code do Wi-Fi, aniversariantes do mês e avisos.
   Lê /api/lista (listas do tipo "boasvindas" ou "mural", editadas pelo cliente em /editar/).
   QR Code: biblioteca qrcode-generator do cdnjs; sem ela, a tela mostra só o nome e a senha da rede. */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  const EXEMPLOS = [
    { tipo: 'boasvindas', tema: 'clinica', dados: {
      titulo: 'Clínica Sorriso', mensagem: 'Seja bem-vindo! Fique à vontade, logo chamaremos você.',
      horario: 'Segunda a sexta: 8h às 19h\nSábado: 8h às 12h', wifiNome: 'Clinica-Clientes', wifiSenha: 'sorriso2026', wifiTipo: 'WPA',
      instagram: '@clinicasorriso' } },
    { tipo: 'mural', tema: 'festa', dados: {
      titulo: 'Academia Força Total',
      aniversarios: [{ n: 'Ana Paula', d: '' }, { n: 'Carlos Eduardo', d: '' }, { n: 'Juliana', d: '' }, { n: 'Marcos', d: '' }, { n: 'Fernanda', d: '' }],
      avisos: [{ t: 'Novo horário aos sábados', x: 'A partir deste mês, abrimos aos sábados das 8h às 14h.' }] } }
  ];

  let qrLib = null, qrPedido = false;
  function carregaQr() {
    if (qrPedido || window.qrcode) { qrLib = window.qrcode || qrLib; return; }
    qrPedido = true;
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    s.onload = () => { qrLib = window.qrcode; S.reload(); };
    document.head.appendChild(s);
  }
  const esc1 = v => String(v || '').replace(/([\\;,:"])/g, '\\$1');
  function qrWifi(d) {
    qrLib = qrLib || window.qrcode || null;
    if (!d.wifiNome) return '';
    if (!qrLib) { carregaQr(); return ''; }   // desenha de novo quando a biblioteca chegar
    const t = d.wifiTipo || 'WPA';
    const txt = 'WIFI:T:' + t + ';S:' + esc1(d.wifiNome) + ';' + (t !== 'nopass' ? 'P:' + esc1(d.wifiSenha) + ';' : '') + ';';
    try {
      const q = qrLib(0, 'M');
      q.addData(unescape(encodeURIComponent(txt)));
      q.make();
      return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    } catch (_) { return ''; }
  }

  // prévia ao vivo no editor do cliente
  let previa = null, previaWait = null;
  if (S.previa) {
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.rs !== 'lista-previa') return;
      previa = d.lista;
      if (previaWait) { previaWait(); previaWait = null; } else S.reload();
    });
    try { window.parent.postMessage({ rs: 'lista-pronta' }, '*'); } catch (_) {}
  }

  const hojeDM = () => { const d = new Date(); return S.pad(d.getDate()) + '/' + S.pad(d.getMonth() + 1); };
  const hojeISO = () => { const d = new Date(); return d.getFullYear() + '-' + S.pad(d.getMonth() + 1) + '-' + S.pad(d.getDate()); };

  async function load(ctx) {
    let listas;
    if (S.previa) {
      if (!previa) await new Promise(r => { previaWait = r; });
      listas = [previa];
    } else if (!ctx.assunto || ctx.assunto.id === 'exemplo') {
      // exemplo: aniversários espalhados pelo mês atual
      const m = S.pad(new Date().getMonth() + 1), d0 = new Date().getDate();
      listas = JSON.parse(JSON.stringify(EXEMPLOS));
      listas[1].dados.aniversarios.forEach((a, i) => { a.d = S.pad(Math.min(28, Math.max(1, i === 1 ? d0 : (i * 6 + 2)))) + '/' + m; });
    } else {
      const r = await S.fetchJson(RS.ROOT_URL + 'api/lista?id=' + encodeURIComponent(ctx.assunto.id) + '&cliente=' + encodeURIComponent(ctx.state.cliente));
      if (!r || !r.lista) throw new Error('Mural não encontrado');
      listas = [r.lista];
    }
    if (listas.some(l => l.tipo === 'boasvindas' && l.dados && l.dados.wifiNome)) carregaQr();
    const slides = [];
    listas.forEach(l => {
      const d = l.dados || {}, tema = l.tema || 'geral';
      if (l.tipo === 'boasvindas') { slides.push({ k: 'boas', tema, d }); return; }
      const mes = S.pad(new Date().getMonth() + 1);
      const doMes = (d.aniversarios || []).filter(a => a.d && a.d.slice(3) === mes).sort((a, b) => a.d.localeCompare(b.d));
      doMes.filter(a => a.d === hojeDM()).forEach(a => slides.push({ k: 'parabens', tema, d, a }));
      if (doMes.length) for (let i = 0; i < doMes.length; i += 12) slides.push({ k: 'aniver', tema, d, lista: doMes.slice(i, i + 12) });
      (d.avisos || []).filter(a => !a.ate || a.ate >= hojeISO()).forEach(a => slides.push({ k: 'aviso', tema, d, a }));
      if (!slides.length) slides.push({ k: 'vazio', tema, d });
    });
    return slides;
  }

  const topo = (d, sub) => '<div class="li-bg"></div><div class="li-top"><div><div class="li-title">' + esc(d.titulo || '') + '</div>' +
    (sub ? '<div class="li-sub">' + esc(sub) + '</div>' : '') + '</div><div class="li-clock">' + S.clockHtml() + '</div></div>';
  const linhas = t => esc(t || '').replace(/\n/g, '<br>');

  const R = {
    boas(s) {
      const d = s.d, qr = qrWifi(d);
      return '<div class="li-bg"></div><div class="mu-boas">' +
        '<div class="mu-boas-txt">' +
          '<div class="mu-ola rise">Seja bem-vindo!</div>' +
          '<div class="mu-nome rise d1">' + esc(d.titulo || '') + '</div>' +
          (d.mensagem ? '<div class="mu-msg rise d2">' + linhas(d.mensagem) + '</div>' : '') +
          (d.horario ? '<div class="mu-hora rise d3"><b>Horário de funcionamento</b>' + linhas(d.horario) + '</div>' : '') +
          ((d.instagram || d.whatsapp) ? '<div class="mu-redes rise d3">' + (d.instagram ? '<span>' + esc(d.instagram) + '</span>' : '') + (d.whatsapp ? '<span>WhatsApp ' + esc(d.whatsapp) + '</span>' : '') + '</div>' : '') +
        '</div>' +
        (d.wifiNome ? '<div class="mu-wifi rise d1"><div class="mu-wifi-t">Wi-Fi grátis</div>' +
          (qr ? '<div class="mu-qr">' + qr + '</div><div class="mu-wifi-h">Aponte a câmera do celular para conectar</div>' : '') +
          '<div class="mu-wifi-d"><span>Rede</span><b>' + esc(d.wifiNome) + '</b>' + (d.wifiTipo !== 'nopass' && d.wifiSenha ? '<span>Senha</span><b>' + esc(d.wifiSenha) + '</b>' : '') + '</div></div>' : '') +
        '<div class="mu-clock">' + S.clockHtml() + '</div></div>';
    },
    aniver(s) {
      const hoje = hojeDM();
      return topo(s.d, 'Aniversariantes de ' + S.MONTHS[new Date().getMonth()]) +
        '<div class="mu-aniv n' + s.lista.length + '">' + s.lista.map((a, k) =>
          '<div class="mu-a rise d' + Math.min(3, Math.floor(k / 3)) + (a.d === hoje ? ' hoje' : '') + '"><b>' + esc(a.d.slice(0, 2)) + '</b><span>' + esc(a.n) +
          (a.x ? '<small>' + esc(a.x) + '</small>' : '') + '</span>' + (a.d === hoje ? '<i>hoje!</i>' : '') + '</div>').join('') + '</div>' +
        '<div class="li-foot"><span>Parabéns a todos os aniversariantes do mês!</span></div>';
    },
    parabens(s) {
      return '<div class="li-bg"></div><div class="mu-hero"><div class="mu-hero-k rise">Hoje é dia de festa!</div>' +
        '<div class="mu-hero-t rise d1">Feliz aniversário,</div><div class="mu-hero-n rise d1">' + esc(s.a.n) + '!</div>' +
        '<div class="mu-hero-x rise d2">Toda a equipe ' + esc(s.d.titulo ? 'da ' + s.d.titulo : '') + ' deseja muitas felicidades.</div></div>';
    },
    aviso(s) {
      return topo(s.d, 'Aviso') + '<div class="mu-hero"><div class="mu-aviso-t rise">' + esc(s.a.t) + '</div>' +
        (s.a.x ? '<div class="mu-aviso-x rise d1">' + linhas(s.a.x) + '</div>' : '') + '</div>';
    },
    vazio(s) {
      return topo(s.d, 'Mural') + '<div class="mu-hero"><div class="mu-aviso-t">Nenhum aviso no momento</div></div>';
    }
  };

  S.register('mural', {
    refreshMinutes: 15,
    rerenderOnRefresh: true,
    load,
    slides(data) { return data; },
    duration(s, ctx) { return s.k === 'boas' ? Math.max(ctx.tempo, 20) : s.k === 'aniver' ? Math.max(ctx.tempo, 15) : 0; },
    render(s) { return '<div class="li-wrap" data-tm="' + esc(s.tema) + '">' + R[s.k](s) + '</div>'; }
  });
})();
