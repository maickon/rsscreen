/* rsscreen — núcleo compartilhado (landing, painel e tela)
   Sem dependências. Expõe window.RS */
(function () {
  'use strict';

  const CFG = window.RSSCREEN_CONFIG || { clientes: [], admin: { nome: 'admin' }, segredo: 'rsscreen' };

  // Raiz do site, descoberta pelo caminho deste próprio script (funciona em subpastas)
  const scriptSrc = (document.currentScript && document.currentScript.src) || '';
  const ROOT_URL = scriptSrc ? scriptSrc.replace(/assets\/js\/core\.js(\?.*)?$/, '') : (location.origin + '/');

  /* ---------- utilitários ---------- */
  function normalize(str) {
    return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function slugify(str) {
    return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // cyrb53: hash rápido e determinístico, saída em base36
  function hash(str, seed) {
    let h1 = 0xdeadbeef ^ (seed || 0), h2 = 0x41c6ce57 ^ (seed || 0);
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- chaves ---------- */
  // Chave do cliente = nome em formato de URL + código único derivado do nome
  function clientKey(nome) {
    const base = slugify(nome).slice(0, 28).replace(/-+$/, '') || 'cliente';
    const code = ('000000' + hash(normalize(nome) + '|' + CFG.segredo, 7)).slice(-5);
    return base + '-' + code;
  }

  // Senha do painel → hash PBKDF2 (o mesmo cálculo é feito no Worker para liberar as estatísticas)
  async function passwordHash(senha) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(String(senha || '')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode('rsscreen|admin'), iterations: 10000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  }

  function clients() {
    return (CFG.clientes || []).filter(c => c && c.nome).map(c => ({
      nome: c.nome,
      whatsapp: String(c.whatsapp || '').replace(/\D/g, ''),
      ativo: c.ativo !== false,
      demo: !!c.demo,
      chave: clientKey(c.nome)
    }));
  }

  function findClient(key) {
    const k = String(key || '').trim().toLowerCase();
    if (!k) return null;
    return clients().find(c => c.chave === k) || null;
  }

  function demoClient() {
    return clients().find(c => c.demo && c.ativo) || null;
  }

  /* ---------- temas de cor das telas (neutros, sem a identidade rsscreen) ---------- */
  const THEMES = [
    { id: 'noite',    nome: 'Noite',    bg: '#0b1220', surface: '#131d31', text: '#ffffff', muted: '#a9b6cc', accent: '#38bdf8', accentText: '#04131f' },
    { id: 'claro',    nome: 'Claro',    bg: '#eef2f7', surface: '#ffffff', text: '#0f172a', muted: '#475569', accent: '#2563eb', accentText: '#ffffff' },
    { id: 'grafite',  nome: 'Grafite',  bg: '#111111', surface: '#1d1d1d', text: '#ffffff', muted: '#b4b4b4', accent: '#e11d48', accentText: '#ffffff' },
    { id: 'oceano',   nome: 'Oceano',   bg: '#052a33', surface: '#0a3b47', text: '#ffffff', muted: '#a5cfd8', accent: '#2dd4bf', accentText: '#04211c' },
    { id: 'floresta', nome: 'Floresta', bg: '#0c2418', surface: '#143424', text: '#ffffff', muted: '#b6d4c1', accent: '#84cc16', accentText: '#132203' },
    { id: 'vinho',    nome: 'Vinho',    bg: '#2a0a16', surface: '#3d1223', text: '#ffffff', muted: '#e6bccb', accent: '#f472b6', accentText: '#2a0a16' },
    { id: 'royal',    nome: 'Royal',    bg: '#140f2e', surface: '#211a4a', text: '#ffffff', muted: '#c6bff0', accent: '#a78bfa', accentText: '#140f2e' },
    { id: 'areia',    nome: 'Areia',    bg: '#f6f1e7', surface: '#fffdf8', text: '#1c1917', muted: '#57534e', accent: '#0f766e', accentText: '#ffffff' }
  ];

  const ORIENTACOES = [
    { id: 'horizontal', nome: 'Horizontal (16:9)' },
    { id: 'vertical', nome: 'Vertical (9:16)' }
  ];

  function theme(id) {
    return THEMES.find(t => t.id === id) || THEMES[0];
  }

  /* ---------- módulos ---------- */
  const manifestCache = {};

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' em ' + url);
    return res.json();
  }

  async function loadManifest(id) {
    if (manifestCache[id]) return manifestCache[id];
    const m = await fetchJson(ROOT_URL + 'modules/' + id + '/manifest.json');
    m.id = m.id || id;
    manifestCache[id] = m;
    return m;
  }

  async function loadModules() {
    const reg = await fetchJson(ROOT_URL + 'modules/registry.json');
    const list = await Promise.all((reg.modulos || []).map(id => loadManifest(id).catch(err => {
      console.warn('Manifesto inválido:', id, err);
      return null;
    })));
    return list.filter(Boolean).sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
  }

  /* ---------- URLs das telas ---------- */
  // Parâmetros sempre legíveis: letras minúsculas, números e hífen.
  function buildScreenUrl(o) {
    const p = [];
    const add = (k, v) => { if (v !== undefined && v !== null && v !== '') p.push(k + '=' + slugify(v)); };
    add('cliente', o.cliente);
    add('modulo', o.modulo || 'rss');
    add('assunto', o.assunto);
    add('fonte', o.fonte);
    add('layout', o.layout);
    add('orientacao', o.orientacao);
    add('tema', o.tema);
    if (o.tempo && Number(o.tempo) !== 12) p.push('tempo=' + Math.round(Number(o.tempo)));
    if (o.girar && o.girar !== '0') add('girar', o.girar);
    if (o.modo) add('modo', o.modo);
    return ROOT_URL + 'tela/?' + p.join('&');
  }

  function whatsappLink(phone, text) {
    const num = String(phone || '').replace(/\D/g, '');
    return 'https://wa.me/' + num + (text ? '?text=' + encodeURIComponent(text) : '');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function registerSW() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register(ROOT_URL + 'sw.js').catch(() => {});
      });
    }
  }

  window.RS = {
    CFG, ROOT_URL, THEMES, ORIENTACOES,
    normalize, slugify, hash, esc,
    clientKey, passwordHash, clients, findClient, demoClient,
    theme, loadManifest, loadModules, fetchJson,
    buildScreenUrl, whatsappLink, copyText, registerSW
  };
})();
