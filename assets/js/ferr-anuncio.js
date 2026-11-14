/* rsscreen — gerador de anúncio para TV (desenhado em canvas, tudo no navegador).
   QR Code: biblioteca qrcode-generator carregada do cdnjs. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const cv = $('aCanvas'), ctx = cv.getContext('2d');
  const CORES = ['#E11D48', '#F97316', '#EAB308', '#16A34A', '#0EA5E9', '#2563EB', '#7C3AED', '#DB2777', '#111827'];
  const FMT = { h: [1920, 1080], v: [1080, 1920], q: [1080, 1080] };
  let cor = CORES[0], foto = null, qrLib = null;
  const FONT = '"Inter", system-ui, "Segoe UI", Roboto, Arial, sans-serif';

  /* ---------- campos guardados no aparelho ---------- */
  const campos = Array.from(document.querySelectorAll('#gad input, #gad select, #gad textarea')).filter(e => e.id && e.type !== 'file');
  try {
    const s = JSON.parse(localStorage.getItem('rs_gad_v1') || '{}');
    campos.forEach(e => { if (s[e.id] != null) { if (e.type === 'checkbox') e.checked = s[e.id]; else e.value = s[e.id]; } });
    if (s._cor) cor = s._cor;
  } catch (_) {}
  function salvar() {
    const o = { _cor: cor };
    campos.forEach(e => { o[e.id] = e.type === 'checkbox' ? e.checked : e.value; });
    try { localStorage.setItem('rs_gad_v1', JSON.stringify(o)); } catch (_) {}
  }

  $('aCores').innerHTML = CORES.map(c => '<button type="button" class="ad-color" data-c="' + c + '" style="background:' + c + '" title="' + c + '"></button>').join('');
  function marcarCor() { document.querySelectorAll('#aCores .ad-color').forEach(b => b.classList.toggle('on', b.dataset.c === cor)); }

  /* ---------- utilidades de desenho ---------- */
  const v = id => ($(id).value || '').trim();
  function font(peso, px) { ctx.font = peso + ' ' + Math.round(px) + 'px ' + FONT; }
  function linhas(texto, maxW, max) {
    const palavras = String(texto).split(/\s+/).filter(Boolean), out = [];
    let cur = '';
    palavras.forEach(p => {
      const t = cur ? cur + ' ' + p : p;
      if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = p; } else cur = t;
    });
    if (cur) out.push(cur);
    if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + '…'; }
    return out;
  }
  // escreve texto quebrando linhas e diminuindo a letra até caber
  function bloco(texto, x, y, maxW, px, peso, corTxt, maxLinhas, minPx, alinha) {
    if (!texto) return y;
    let tam = px, ls;
    for (;;) { font(peso, tam); ls = linhas(texto, maxW, 99); if (ls.length <= maxLinhas || tam <= minPx) break; tam *= 0.92; }
    ls = linhas(texto, maxW, maxLinhas);
    ctx.fillStyle = corTxt; ctx.textAlign = alinha || 'left'; ctx.textBaseline = 'top';
    ls.forEach((l, i) => ctx.fillText(l, x, y + i * tam * 1.12));
    ctx.textAlign = 'left';
    return y + ls.length * tam * 1.12;
  }
  function round(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cobrir(img, x, y, w, h) {
    const k = Math.max(w / img.width, h / img.height), iw = img.width * k, ih = img.height * k;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
  }
  function mix(hex, a) { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  function qrLink() {
    const modo = $('aQr').value;
    if (modo === 'nao') return '';
    if (modo === 'link') return /^https?:\/\//i.test(v('aLink')) ? v('aLink') : '';
    let n = v('aWhats').replace(/\D/g, '');
    if (!n) return '';
    if (n.length <= 11) n = '55' + n;
    return 'https://wa.me/' + n;
  }
  function qr(link, x, y, tam) {
    if (!link || !qrLib) return false;
    const q = qrLib(0, 'M'); q.addData(link); q.make();
    const n = q.getModuleCount(), pad = tam * 0.07, cel = (tam - pad * 2) / n;
    ctx.fillStyle = '#fff'; round(x, y, tam, tam, tam * 0.06); ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + pad + c * cel, y + pad + r * cel, Math.ceil(cel), Math.ceil(cel));
    return true;
  }

  /* ---------- a arte ---------- */
  function desenhar() {
    const f = $('aFormato').value, modelo = $('aModelo').value;
    const [W, H] = FMT[f];
    cv.width = W; cv.height = H;
    const u = Math.min(W, H) / 1080;            // unidade relativa
    const pad = 70 * u;

    // fundo
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0b0b0f'); g.addColorStop(1, '#17171f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rg = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, Math.max(W, H) * 0.7);
    rg.addColorStop(0, mix(cor, 0.45)); rg.addColorStop(1, mix(cor, 0));
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

    // área da foto
    let cx = pad, cy = pad, cw = W - pad * 2;
    if (foto) {
      if (f === 'h') { cobrir(foto, 0, 0, W * 0.46, H); const sh = ctx.createLinearGradient(W * 0.34, 0, W * 0.46, 0); sh.addColorStop(0, 'rgba(11,11,15,0)'); sh.addColorStop(1, 'rgba(11,11,15,1)'); ctx.fillStyle = sh; ctx.fillRect(W * 0.34, 0, W * 0.12 + 1, H); cx = W * 0.5; cw = W * 0.5 - pad; }
      else { const fh = f === 'v' ? H * 0.42 : H * 0.36; cobrir(foto, 0, 0, W, fh); const sh = ctx.createLinearGradient(0, fh - 160 * u, 0, fh); sh.addColorStop(0, 'rgba(11,11,15,0)'); sh.addColorStop(1, 'rgba(11,11,15,1)'); ctx.fillStyle = sh; ctx.fillRect(0, fh - 160 * u, W, 160 * u + 1); cy = fh + 10 * u; }
    } else if (f === 'h') { cx = pad * 1.4; cw = W - pad * 2.8; }

    const link = qrLink();
    const qrTam = (f === 'h' ? 250 : 230) * u;
    const rodape = 150 * u;
    const corpoW = f === 'h' && !foto ? cw * 0.72 : cw;
    // o bloco de texto é desenhado duas vezes: a 1ª (invisível) mede a altura, a 2ª centraliza no espaço livre
    const conteudo = y => {

        // selo
      if (v('aSelo') && modelo !== 'servico') {
        font(800, 34 * u);
        const tw = ctx.measureText(v('aSelo').toUpperCase()).width + 48 * u;
        ctx.fillStyle = cor; round(cx, y, tw, 64 * u, 32 * u); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(v('aSelo').toUpperCase(), cx + 24 * u, y + 33 * u);
        y += 96 * u;
      }
      // título e descrição
      const tamTitulo = (modelo === 'aviso' ? 96 : 110) * u;
      y = bloco(v('aTitulo'), cx, y, corpoW, tamTitulo, 900, '#ffffff', modelo === 'aviso' ? 3 : 2, 54 * u);
      y += 18 * u;
      if (modelo !== 'servico') y = bloco(v('aSub'), cx, y, corpoW, 44 * u, 500, 'rgba(255,255,255,.78)', 2, 30 * u);
      else y = bloco(v('aSub'), cx, y, corpoW, 46 * u, 600, cor, 2, 30 * u);
      y += 36 * u;

      if (modelo === 'oferta' && v('aPreco')) {
        if (v('aDe')) { font(600, 44 * u); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textBaseline = 'top'; const t = 'de R$ ' + v('aDe') + ' por'; ctx.fillText(t, cx, y); const tw = ctx.measureText('de R$ ' + v('aDe')).width; ctx.fillRect(cx + ctx.measureText('de ').width, y + 26 * u, tw - ctx.measureText('de ').width, 4 * u); y += 62 * u; }
        const partes = v('aPreco').split(',');
        font(900, 70 * u); const rs = 'R$ '; const rsW = ctx.measureText(rs).width;
        font(900, 190 * u); const intW = ctx.measureText(partes[0]).width;
        const boxW = Math.min(corpoW, rsW + intW + 200 * u), boxH = 230 * u;
        ctx.fillStyle = cor; round(cx, y, boxW, boxH, 28 * u); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
        font(800, 70 * u); ctx.fillText(rs, cx + 36 * u, y + 170 * u);
        font(900, 190 * u); ctx.fillText(partes[0], cx + 36 * u + rsW, y + 190 * u);
        font(900, 80 * u); ctx.fillText(',' + (partes[1] || '00'), cx + 36 * u + rsW + intW, y + 115 * u);
        if (v('aUn')) { font(700, 44 * u); ctx.fillText('/' + v('aUn'), cx + 40 * u + rsW + intW, y + 185 * u); }
        y += boxH + 36 * u;
      }
      if (modelo === 'servico') {
        v('aItens').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 4).forEach(it => {
          ctx.fillStyle = cor; ctx.beginPath(); ctx.arc(cx + 14 * u, y + 30 * u, 12 * u, 0, Math.PI * 2); ctx.fill();
          y = bloco(it, cx + 46 * u, y, corpoW - 46 * u, 50 * u, 700, '#fff', 1, 34 * u) + 18 * u;
        });
        y += 10 * u;
      }
      if (v('aCta')) y = bloco(v('aCta'), cx, y, corpoW, 52 * u, 800, cor, 1, 34 * u) + 10 * u;

      return y;
    };
    ctx.globalAlpha = 0;
    const fim = conteudo(cy);
    ctx.globalAlpha = 1;
    const livre = (H - pad - rodape - 20 * u) - cy;
    conteudo(cy + Math.max(0, (livre - (fim - cy)) / 2));

    // rodapé: anunciante, WhatsApp, Instagram e QR
    const temQr = !!link && !!qrLib;
    const qx = W - pad - qrTam, qy = H - pad - qrTam;
    if (temQr) {
      qr(link, qx, qy, qrTam);
      font(700, 26 * u); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText($('aQr').value === 'wa' ? 'Chame no WhatsApp' : 'Aponte a câmera', qx + qrTam / 2, qy - 12 * u);
      ctx.textAlign = 'left';
    }
    const fy = H - pad - rodape + 30 * u, fx = foto && f === 'h' ? cx : pad * (f === 'h' && !foto ? 1.4 : 1);
    const fw = (temQr ? qx - 30 * u : W - pad) - fx;
    let ly = fy;
    if (v('aNome')) ly = bloco(v('aNome'), fx, ly, fw, 46 * u, 900, '#fff', 1, 30 * u) + 8 * u;
    const contato = [v('aWhats') ? 'WhatsApp ' + v('aWhats') : '', v('aInsta')].filter(Boolean).join('   ·   ');
    if (contato) bloco(contato, fx, ly, fw, 34 * u, 600, 'rgba(255,255,255,.8)', 1, 24 * u);

    if ($('aMarca').checked) {
      font(600, 20 * u); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.textBaseline = 'top'; ctx.textAlign = 'right';
      ctx.fillText('feito com rsscreen', W - pad, 26 * u); ctx.textAlign = 'left';
    }

    $('aBox').className = 'ga-preview f-' + f;
    $('aItensWrap').hidden = modelo !== 'servico';
    $('aPrecos').hidden = modelo !== 'oferta';
    $('aLinkWrap').hidden = $('aQr').value !== 'link';
    $('aTituloLbl').textContent = modelo === 'oferta' ? 'Produto' : modelo === 'servico' ? 'Nome da empresa' : 'Título do aviso';
    $('aFotoDel').hidden = !foto;
  }

  let timer;
  function agendar() { clearTimeout(timer); timer = setTimeout(() => { salvar(); desenhar(); }, 120); }

  /* ---------- eventos ---------- */
  $('gad').addEventListener('input', agendar);
  $('gad').addEventListener('change', agendar);
  $('aCores').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; cor = b.dataset.c; marcarCor(); agendar(); });
  $('aFoto').addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { foto = img; desenhar(); };
    img.src = url;
  });
  $('aFotoDel').addEventListener('click', () => { foto = null; $('aFoto').value = ''; desenhar(); });
  $('aBaixar').addEventListener('click', () => {
    desenhar();
    const nome = 'anuncio-' + (RS.slugify(v('aNome') || 'rsscreen')) + '-' + $('aFormato').value + '.png';
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });

  marcarCor();
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  s.onload = () => { qrLib = window.qrcode; desenhar(); };
  document.head.appendChild(s);
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(desenhar);
  desenhar();
})();
