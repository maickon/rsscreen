"""Gera o site para a busca do Google: guia, blog, ferramentas, soluções, modelos e calendário.

Uso:  python tools/gerar-site.py

Fontes:
  tools/paginas/*.html   guia (artigos), ferramentas, páginas legais e índices
  tools/blog/*.html      posts do blog, com fila de publicação (ver "Fila do blog" abaixo)
  tools/programaticas.py páginas geradas dos dados do sistema (soluções, modelos, calendário)
  tools/layout.py        menu e rodapé, iguais em todo o site

Cabeçalho de cada arquivo:

    <!--
    slug: guia/como-ganhar-dinheiro-com-midia-indoor
    titulo: texto da aba e do Google (até ~60 caracteres)
    descricao: resumo do Google (até ~155 caracteres)
    h1: título grande da página
    lead: frase de abertura
    cartao: texto curto do cartão nos índices
    icone: news | chart | monitor | tag | ...
    tipo: artigo | post | ferramenta | indice | legal
    categoria: comecar | precos | pontos | equipamentos | conteudo   (artigos e posts)
    publicado: 2026-11-13          (data da primeira publicação)
    publicar: 2026-11-20           (posts: só entra no site a partir desta data)
    ordem: 1
    script: {raiz}assets/js/ferramentas.js   (opcional)
    -->

Fila do blog: um post sem "publicar" recebe sozinho a próxima vaga livre (POSTS_POR_SEMANA, nos
DIAS_DE_PUBLICAR), e a data é gravada no próprio arquivo. Post com data futura não é gerado, não entra
no sitemap, no blog nem no llms.txt. A automação do GitHub (.github/workflows/publicar.yml) roda este
gerador todo dia: quando chega a data, o post vai para o ar sozinho.

Datas honestas: a data de atualização de cada página só muda quando o conteúdo muda (tools/datas.json).
"""
import datetime, hashlib, html, json, os, re, sys, unicodedata

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import programaticas   # páginas geradas dos dados do sistema
import layout          # menu e rodapé

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'paginas')
BLOG = os.path.join(ROOT, 'tools', 'blog')
DATAS = os.path.join(ROOT, 'tools', 'datas.json')
HOJE = datetime.date.today().isoformat()
e = html.escape
SITE = 'https://rsscreen.com.br'
OG_IMG = SITE + '/assets/img/og.png'
ORG = {'@type': 'Organization', '@id': SITE + '/#org', 'name': 'rsscreen', 'url': SITE + '/',
       'logo': SITE + '/assets/img/icon-512.png', 'areaServed': 'BR',
       'parentOrganization': {'@type': 'Organization', 'name': 'Mksoft', 'url': 'https://mksoft.com.br'},
       'description': 'Sistema brasileiro de conteúdo automático para mídia indoor e TVs comerciais.'}

# ---------------------------------------------------------------- fila do blog
POSTS_POR_SEMANA = 2          # quantos posts novos por semana, no máximo
DIAS_DE_PUBLICAR = (1, 3)     # 0 = segunda ... 6 = domingo  (terça e quinta)

# ---------------------------------------------------------------- categorias
# id: (nome, descrição, chamada do rsscreen no fim de cada artigo da categoria)
CATEGORIAS = {
    'comecar': ('Começar na mídia indoor', 'O que é, como funciona, quanto investir e o passo a passo do primeiro ponto.',
                'O rsscreen entrega o conteúdo pronto para a sua primeira TV: notícias, clima, futebol e os anúncios dos seus clientes, num link que abre em qualquer TV Box. Você foca em conseguir pontos e anunciantes.'),
    'precos': ('Preços e vendas', 'Quanto cobrar, como montar planos, abordar o comércio e fechar anunciantes.',
               'Com o rsscreen você cria os anúncios dos seus clientes em minutos, com modelos prontos por tipo de comércio, e mostra ao anunciante a tela funcionando antes de fechar.'),
    'pontos': ('Pontos e anunciantes', 'Onde instalar, que tipo de comércio escolher e o que passar em cada segmento.',
               'Cada tipo de ponto pede um conteúdo: futebol na barbearia, saúde na clínica, cardápio na lanchonete. No rsscreen há telas e modelos prontos para cada segmento.'),
    'equipamentos': ('Equipamentos e instalação', 'TV, TV Box, sistema e configuração para a tela não parar.',
                     'O rsscreen funciona em qualquer TV com navegador, TV Box ou sistema de mídia indoor que abra um link. Se a internet cair, a tela continua com o último conteúdo.'),
    'conteudo': ('Conteúdo para TV', 'O que passar na tela para prender a atenção e valorizar os anúncios.',
                 'O rsscreen mantém a sua TV com conteúdo vivo 24h: mais de 90 sites de notícias, previsão do tempo de qualquer cidade, futebol, loterias e cotações, sem você mexer em nada.'),
}


def slugify(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def ler(path):
    txt = open(path, encoding='utf-8').read()
    m = re.match(r'\s*<!--(.*?)-->(.*)', txt, re.S)
    meta = {}
    for line in m.group(1).strip().splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    meta['corpo'] = m.group(2).strip()
    meta['ordem'] = int(meta.get('ordem', 99))
    meta['_arquivo'] = path
    return meta


def com_ids(corpo):
    toc = []

    def rep(m):
        attrs, texto = m.group(1), m.group(2)
        limpo = re.sub(r'<[^>]+>', '', texto)
        hid = slugify(limpo)[:60]
        toc.append((hid, limpo))
        if 'id=' in attrs:
            return m.group(0)
        return '<h2 id="%s"%s>%s</h2>' % (hid, attrs, texto)

    return re.sub(r'<h2([^>]*)>(.*?)</h2>', rep, corpo), toc


def faqs(corpo):
    out = []
    for q, a in re.findall(r'<details><summary>(.*?)(?:<i[^>]*></i>)?</summary>(.*?)</details>', corpo, re.S):
        q = html.unescape(re.sub(r'<[^>]+>', '', q)).strip()
        a = html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', a))).strip()
        out.append({'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}})
    return out


def br(d):
    return datetime.date.fromisoformat(d).strftime('%d/%m/%Y')


def leitura(corpo):
    palavras = len(re.sub(r'<[^>]+>', ' ', corpo).split())
    return max(1, round(palavras / 200))


def eh_artigo(p):
    return p.get('tipo') in ('artigo', 'post')


# ---------------------------------------------------------------- página
def pagina(p, todas):
    depth = p['slug'].count('/') + 1
    up = '../' * depth
    corpo, toc = com_ids(p['corpo'])
    corpo = corpo.replace('{raiz}', up)
    tipo = p.get('tipo', 'artigo')
    cat = CATEGORIAS.get(p.get('categoria', ''))

    if tipo == 'colecao':
        trilha = [('Início', up), (p['pai'][0], up + p['pai'][1] + '/')]
    elif tipo in ('hub', 'blog'):
        trilha = [('Início', up)]
    elif tipo == 'categoria':
        trilha = [('Início', up), ('Blog', up + 'blog/')]
    elif eh_artigo(p):
        trilha = [('Início', up), ('Blog', up + 'blog/')] + ([(cat[0], up + 'blog/' + p['categoria'] + '/')] if cat else [])
    elif tipo == 'ferramenta':
        trilha = [('Início', up), ('Ferramentas', up + 'blog/#ferramentas')]
    else:
        trilha = [('Início', up)] + ([] if tipo == 'legal' else [('Guia', up + 'guia/')])
    if tipo != 'indice':
        trilha.append((p['h1'] if len(p['h1']) < 48 else p['h1'][:45].rsplit(' ', 1)[0] + '…', ''))
    crumbs = ' <span aria-hidden="true">›</span> '.join(
        ('<a href="%s">%s</a>' % (u, e(t)) if u else '<span>%s</span>' % e(t)) for t, u in trilha)

    url = SITE + '/' + p['slug'] + '/'
    abs_ = lambda u: SITE + '/' + (u[len(up):] if u.startswith(up) else u) if u else url
    ld = [{'@context': 'https://schema.org', '@type': 'BreadcrumbList',
           'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': t, 'item': abs_(u)} for i, (t, u) in enumerate(trilha)]}]
    if eh_artigo(p) or tipo == 'colecao':
        art = {'@context': 'https://schema.org', '@type': 'BlogPosting' if tipo == 'post' else 'Article', 'headline': p['h1'],
               'description': p['descricao'], 'inLanguage': 'pt-BR', 'datePublished': p['publicado'], 'dateModified': p['atualizado'],
               'mainEntityOfPage': url, 'image': OG_IMG, 'author': ORG, 'publisher': ORG}
        if cat:
            art['articleSection'] = cat[0]
        ld.append(art)
    elif tipo == 'ferramenta':
        ld.append({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': p['h1'], 'description': p['descricao'],
                   'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Qualquer navegador', 'inLanguage': 'pt-BR',
                   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'BRL'}})
    fq = faqs(p['corpo'])
    if fq:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': fq})
    ld_html = ''.join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False) for x in ld)

    if eh_artigo(p):
        # chamada do rsscreen no fim de todo artigo, de acordo com o assunto
        corpo += ('<aside class="rs-cta"><b>Como o rsscreen ajuda</b><p>%s</p><div class="rs-cta-acts">'
                  '<a class="btn btn-primary btn-sm" href="%s#modelos"><i data-icon="eye"></i> Ver as telas funcionando</a>'
                  '<a class="btn btn-ghost btn-sm js-wa" data-msg="Olá! Li o artigo &quot;%s&quot; e quero conhecer o rsscreen." href="#"><i data-icon="whatsapp"></i> Falar no WhatsApp</a>'
                  '</div></aside>' % (e(cat[2] if cat else CATEGORIAS['comecar'][2]), up, e(p['h1'])))
        corpo += '<p class="autor">Por <b>Equipe rsscreen</b>, da Mksoft. Conteúdo revisado com base na operação real de telas de mídia indoor.</p>'

    if (eh_artigo(p) or tipo == 'colecao') and toc:
        lateral = ('<aside class="toc"><b>Nesta página</b>' + ''.join('<a href="#%s">%s</a>' % (i, e(t)) for i, t in toc) +
                   '<a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Vim pelo site do rsscreen e quero conhecer o conteúdo para as minhas telas." href="#">'
                   '<i data-icon="whatsapp"></i> Tirar dúvidas</a></aside>')
        miolo = '<div class="page-grid"><article class="prose">%s</article>%s</div>' % (corpo, lateral)
    elif tipo == 'legal':
        miolo = '<article class="prose">%s</article>' % corpo
    else:
        miolo = corpo

    if tipo == 'legal':
        meta = '<div class="page-meta"><span><i data-icon="clock"></i> Última atualização: %s</span></div>' % br(p['atualizado'])
    elif tipo in ('indice', 'hub', 'blog', 'categoria'):
        meta = ''
    elif eh_artigo(p):
        meta = ('<div class="page-meta">%s<span><i data-icon="clock"></i> Publicado em %s%s</span><span><i data-icon="news"></i> %d min de leitura</span></div>'
                % (('<a class="tag-cat" href="%sblog/%s/">%s</a>' % (up, p['categoria'], e(cat[0]))) if cat else '', br(p['publicado']),
                   (' · atualizado em %s' % br(p['atualizado'])) if p['atualizado'] != p['publicado'] else '', leitura(p['corpo'])))
    else:
        meta = ('<div class="page-meta"><span><i data-icon="clock"></i> Atualizado em %s</span><span><i data-icon="check"></i> Grátis, sem cadastro</span></div>'
                % br(p['atualizado']))

    if tipo == 'colecao':
        irmas = [x for x in todas if x.get('pai') == p['pai'] and x['slug'] != p['slug']]
        irmas.sort(key=lambda x: (x['ordem'] < p['ordem'], x['ordem']))
        rel = irmas[:3]
    elif eh_artigo(p):
        outros = [x for x in todas if eh_artigo(x) and x['slug'] != p['slug']]
        outros.sort(key=lambda x: (x.get('categoria') != p.get('categoria'), x['publicado']), reverse=False)
        rel = outros[:3]
    elif tipo == 'ferramenta':
        rel = [x for x in todas if x['slug'] != p['slug'] and x.get('tipo') == 'ferramenta'][:3]
    else:
        rel = []
    relacionados = '' if not rel else (
        '<section class="related"><div class="wrap"><h2>%s</h2><div class="cards">' % ('Veja também' if tipo in ('colecao', 'ferramenta') else 'Continue lendo') +
        ''.join(card(x, up) for x in rel) + '</div></div></section>')

    script = ('<script src="%s"></script>\n' % p['script'].replace('{raiz}', up)) if p.get('script') else ''
    if 'tv-live' in corpo:
        script += '<script src="%sassets/js/vitrine.js"></script>\n' % up
    if tipo in ('blog', 'categoria'):
        script += '<script src="%sassets/js/blog.js"></script>\n' % up

    return TEMPLATE.format(
        titulo=e(p['titulo']), descricao=e(p['descricao']), up=up, ld=ld_html, crumbs=crumbs, url=url, og_img=OG_IMG,
        og_tipo='article' if (eh_artigo(p) or tipo == 'colecao') else 'website',
        h1=e(p['h1']), lead=('<p class="lead">%s</p>' % p['lead']) if p.get('lead') else '', meta=meta,
        miolo=miolo, relacionados=relacionados, script=script, nav=layout.nav(up), rodape=layout.rodape(up))


def card(x, up):
    rotulo = 'Abrir ferramenta' if x.get('tipo') == 'ferramenta' else 'Ver' if x.get('tipo') in ('colecao', 'hub') else 'Ler o artigo'
    return ('<a class="card-link" href="%s%s/"><i data-icon="%s"></i><b>%s</b><span>%s</span><em>%s <i data-icon="arrow"></i></em></a>'
            % (up, x['slug'], x.get('icone', 'sparkles'), e(x['h1']), e(x.get('cartao', '')), rotulo))


# ---------------------------------------------------------------- blog
def post_card(x, up):
    cat = CATEGORIAS.get(x.get('categoria', ''), ('', ''))
    busca = ' '.join([x['h1'], x.get('descricao', ''), cat[0]]).lower()
    return ('<article class="post-card" data-cat="%s" data-busca="%s"><a href="%s%s/">'
            '<span class="post-cat">%s</span><h3>%s</h3><p>%s</p>'
            '<span class="post-meta">%s · %d min de leitura</span></a></article>'
            % (x.get('categoria', ''), e(busca), up, x['slug'], e(cat[0]), e(x['h1']), e(x.get('descricao', '')), br(x['publicado']), leitura(x['corpo'])))


def pagina_blog(todas, cat_id=None):
    arts = sorted([x for x in todas if eh_artigo(x) and (not cat_id or x.get('categoria') == cat_id)], key=lambda x: x['publicado'], reverse=True)
    up = '../' if not cat_id else '../../'
    contagem = {k: len([x for x in todas if eh_artigo(x) and x.get('categoria') == k]) for k in CATEGORIAS}
    chips = ('<a class="chip-cat%s" href="%sblog/">Todos</a>' % ('' if cat_id else ' on', up) +
             ''.join('<a class="chip-cat%s" href="%sblog/%s/" data-chip="%s">%s <small>%d</small></a>' % (' on' if k == cat_id else '', up, k, k, e(v[0]), contagem[k])
                     for k, v in CATEGORIAS.items() if contagem[k]))
    corpo = ('<div class="blog-bar"><label class="blog-busca"><i data-icon="eye"></i><input type="search" id="blogBusca" placeholder="Pesquisar no blog: quanto cobrar, TV Box, padaria…" autocomplete="off"></label>'
             '<div class="blog-chips">%s</div></div>' % chips +
             '<div class="post-grid" id="postGrid">%s</div><p class="blog-vazio" id="blogVazio" hidden>Nada encontrado. Tente outra palavra ou fale com a gente no WhatsApp.</p>' % ''.join(post_card(x, up) for x in arts))
    if not cat_id:
        tools = [x for x in todas if x.get('tipo') == 'ferramenta']
        corpo += ('<h2 id="ferramentas">Ferramentas grátis para trabalhar</h2><div class="cards">%s</div>' % ''.join(card(x, up) for x in tools) +
                  '<h2>Conteúdo para as suas TVs</h2><div class="cards">%s%s</div>' % (
                      card({'slug': 'solucoes', 'h1': 'Soluções prontas', 'cartao': 'Notícias, clima, futebol, loterias, cotações', 'icone': 'monitor', 'tipo': 'hub'}, up),
                      card({'slug': 'modelos', 'h1': 'Modelos prontos', 'cartao': 'Tabelas, cardápios e anúncios', 'icone': 'tag', 'tipo': 'hub'}, up)))
        return {'slug': 'blog', 'tipo': 'blog', 'ordem': 1, 'icone': 'news', 'corpo': corpo,
                'titulo': 'Blog do rsscreen: mídia indoor na prática',
                'descricao': 'Artigos sobre mídia indoor para quem está começando: como ganhar dinheiro, quanto cobrar, onde instalar, equipamentos e o que passar na TV.',
                'h1': 'Blog: mídia indoor na prática', 'lead': 'Tudo para começar e crescer com TVs em comércios: dinheiro, preços, pontos, equipamentos e conteúdo.'}
    nome, desc, _ = CATEGORIAS[cat_id]
    return {'slug': 'blog/' + cat_id, 'tipo': 'categoria', 'ordem': 2, 'icone': 'news', 'corpo': corpo,
            'titulo': ('%s: artigos sobre mídia indoor' % nome)[:68], 'descricao': desc, 'h1': nome, 'lead': desc}


# ---------------------------------------------------------------- fila e datas
def agendar(posts):
    """Dá data aos posts da fila e devolve só os que já podem ir para o ar."""
    hoje = datetime.date.today()
    datas = sorted(datetime.date.fromisoformat(p['publicar']) for p in posts if p.get('publicar'))
    for p in sorted([p for p in posts if not p.get('publicar')], key=lambda x: os.path.basename(x['_arquivo'])):
        d = max([hoje] + [x + datetime.timedelta(days=1) for x in datas[-1:]])
        while True:
            semana = d - datetime.timedelta(days=d.weekday())
            na_semana = len([x for x in datas if semana <= x < semana + datetime.timedelta(days=7)])
            if d.weekday() in DIAS_DE_PUBLICAR and na_semana < POSTS_POR_SEMANA and d not in datas:
                break
            d += datetime.timedelta(days=1)
        p['publicar'] = d.isoformat()
        datas = sorted(datas + [d])
        txt = open(p['_arquivo'], encoding='utf-8').read()
        txt = txt.replace('-->', 'publicar: %s\n-->' % p['publicar'], 1)
        open(p['_arquivo'], 'w', encoding='utf-8', newline='\n').write(txt)
        print('fila', os.path.basename(p['_arquivo']), '->', p['publicar'])
    no_ar = []
    for p in posts:
        if p['publicar'] <= hoje.isoformat():
            p.setdefault('publicado', p['publicar'])
            no_ar.append(p)
        else:
            print('aguardando', p['publicar'], p['slug'])
    return no_ar


def datar(todas):
    """Data de atualização honesta: muda só quando o conteúdo da página muda."""
    try:
        reg = json.load(open(DATAS, encoding='utf-8'))
    except Exception:
        reg = {}
    for p in todas:
        h = hashlib.sha1((p.get('titulo', '') + p.get('descricao', '') + p.get('corpo', '')).encode('utf-8')).hexdigest()[:16]
        r = reg.get(p['slug'])
        if not r or r['hash'] != h:
            r = {'hash': h, 'atualizado': HOJE, 'publicado': (r or {}).get('publicado') or p.get('publicado') or HOJE}
            reg[p['slug']] = r
        p['atualizado'] = r['atualizado']
        p['publicado'] = p.get('publicado') or r['publicado']
        if p['atualizado'] < p['publicado']:
            p['atualizado'] = p['publicado']
    json.dump(reg, open(DATAS, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1, sort_keys=True)


TEMPLATE = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{titulo}</title>
  <meta name="description" content="{descricao}" />
  <meta name="theme-color" content="#0A0A0A" />
  <meta property="og:type" content="{og_tipo}" />
  <meta property="og:title" content="{titulo}" />
  <meta property="og:description" content="{descricao}" />
  <meta property="og:locale" content="pt_BR" />
  <meta property="og:url" content="{url}" />
  <meta property="og:site_name" content="rsscreen" />
  <meta property="og:image" content="{og_img}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="{url}" />
  <link rel="icon" href="{up}assets/img/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="{up}assets/img/icon-192.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="{up}assets/css/brand.css" />
  <link rel="stylesheet" href="{up}assets/css/landing.css" />
  <link rel="stylesheet" href="{up}assets/css/site.css" />
{ld}</head>
<body>
  <!-- Página gerada por tools/gerar-site.py: edite o texto em tools/paginas/ ou tools/blog/ e rode o gerador de novo. -->
  <header class="nav" id="nav">
    <div class="wrap nav-inner">
      <a href="{up}" class="logo"><i data-logo></i><span><b>rss</b>creen</span></a>
      {nav}
      <div class="nav-cta">
        <a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Vim pelo site do rsscreen e quero conhecer o conteúdo para minhas telas." href="#"><i data-icon="whatsapp"></i><span>Falar no WhatsApp</span></a>
        <button class="nav-toggle" id="navToggle" aria-label="Abrir menu"><i data-icon="menu"></i></button>
      </div>
    </div>
  </header>

  <main>
    <section class="page-hero">
      <div class="wrap">
        <nav class="crumbs" aria-label="Você está em">{crumbs}</nav>
        <h1>{h1}</h1>
        {lead}
        {meta}
      </div>
    </section>
    <section class="page-body"><div class="wrap">{miolo}</div></section>
    {relacionados}
    <section class="cta-final">
      <div class="wrap cta-inner">
        <div>
          <h2>Coloque conteúdo vivo nas suas telas hoje</h2>
          <p>Notícias, clima, futebol, loterias e os anúncios dos seus clientes num link que abre em qualquer TV ou player.</p>
        </div>
        <a class="btn btn-primary btn-lg js-wa" data-msg="Olá! Vim pelo site do rsscreen e quero uma demonstração para as minhas telas." href="#"><i data-icon="whatsapp"></i> Quero uma demonstração</a>
      </div>
    </section>
  </main>

  {rodape}
  <a class="wa-float js-wa" data-msg="Olá! Vim pelo site do rsscreen." href="#" aria-label="Falar no WhatsApp"><i data-icon="whatsapp"></i></a>

  <script src="{up}config/clientes.js"></script>
  <script src="{up}assets/js/core.js"></script>
  <script src="{up}assets/js/icons.js"></script>
  <script src="{up}assets/js/site.js"></script>
  <script src="{up}assets/js/nav.js"></script>
{script}</body>
</html>
'''


def main():
    todas = sorted((ler(os.path.join(SRC, f)) for f in os.listdir(SRC) if f.endswith('.html')), key=lambda x: x['ordem'])
    os.makedirs(BLOG, exist_ok=True)
    posts = [ler(os.path.join(BLOG, f)) for f in sorted(os.listdir(BLOG)) if f.endswith('.html')]
    for p in posts:
        p['tipo'] = 'post'
    todas += agendar(posts)
    todas += programaticas.todas()
    for p in todas:
        if p.get('tipo') == 'indice':
            arts = sorted([x for x in todas if eh_artigo(x)], key=lambda x: x['ordem'])
            tools = [x for x in todas if x.get('tipo') == 'ferramenta']
            p['corpo'] = (p['corpo']
                          .replace('{artigos}', '<div class="cards">' + ''.join(card(x, '../') for x in arts if x.get('tipo') == 'artigo') + '</div>')
                          .replace('{ferramentas}', '<div class="cards">' + ''.join(card(x, '../') for x in tools) + '</div>'))
    datar(todas)
    todas += [pagina_blog(todas)] + [pagina_blog(todas, k) for k in CATEGORIAS if any(eh_artigo(x) and x.get('categoria') == k for x in todas)]
    datar([x for x in todas if x.get('tipo') in ('blog', 'categoria')])
    for p in todas:
        out = os.path.join(ROOT, *p['slug'].split('/'), 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8', newline='\n').write(pagina(p, todas))
    print('ok ', len(todas), 'páginas')
    lista = [{'url': '/' + p['slug'] + '/', 'atualizado': p['atualizado']} for p in todas]
    open(os.path.join(ROOT, 'guia', 'paginas.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(lista, ensure_ascii=False, indent=1))
    open(os.path.join(ROOT, 'llms.txt'), 'w', encoding='utf-8', newline='\n').write(llms(todas))
    print('ok  llms.txt')
    pagina_inicial()


# ---------------------------------------------------------------- llms.txt
LLMS_TOPO = '''# rsscreen

> rsscreen é um sistema brasileiro de conteúdo automático para mídia indoor e TVs comerciais, desenvolvido pela Mksoft (mksoft.com.br) desde 2018. Gera links de tela (notícias, previsão do tempo, cotações, futebol, loterias, anúncios, tabelas de preços e cardápios) que abrem em qualquer TV com navegador, TV Box ou sistema de mídia indoor e se atualizam sozinhos, 24 horas por dia.

## Para quem é
- Operadores de mídia indoor que vendem anúncios em TVs instaladas em comércios, inclusive quem está começando com poucas TVs.
- Comércios (padarias, açougues, hortifrútis, lanchonetes, clínicas, academias, salões) que querem uma TV com conteúdo e ofertas.

## O que o sistema faz
- Notícias em tempo real de mais de 90 sites brasileiros, separadas por assunto (últimas, esportes, economia, entretenimento, saúde e outros).
- Previsão do tempo de qualquer cidade do Brasil, cotações (dólar, euro, bitcoin) e cotações do agronegócio (CEPEA).
- Resultados das loterias da Caixa, futebol (jogos, placares e tabela), horóscopo, datas comemorativas, frases e relógio.
- Anúncios dos anunciantes do operador, com mais de 40 modelos prontos por tipo de comércio.
- Tabela de preços e cardápio que o próprio comerciante edita pelo celular, com catálogo de mais de 450 produtos com descrição.
- Boas-vindas com QR Code do Wi-Fi e mural de aniversariantes e avisos.
- Link único: várias telas em sequência num só link, com tempo de cada uma e anúncios entre elas.
- Modelos de tela horizontais e verticais, sem marca do rsscreen na tela.
- Monitoramento de cada tela (aparelhos, cidades) com relatório em PDF.

## Como funciona
1. O operador gera os links no painel (ou recebe prontos).
2. Abre o link no navegador da TV, na TV Box ou cadastra no sistema de mídia indoor que já usa.
3. A tela se atualiza sozinha; se a internet cair, continua mostrando o último conteúdo.

## Planos
Planos mensais por faixa de telas (até 10, até 50 e até 200 telas): Notícias (conteúdo automático) e Completo (tudo, inclusive anúncios, tabelas e cardápios). Teste grátis de 7 dias. Contratação e valores pelo WhatsApp do site.
'''


def llms(todas):
    out = [LLMS_TOPO]
    arts = sorted([x for x in todas if eh_artigo(x)], key=lambda x: x['publicado'], reverse=True)
    if arts:
        out.append('## Artigos (blog e guia)\n' + ''.join('- [%s](%s/%s/): %s\n' % (x['h1'], SITE, x['slug'], x['descricao']) for x in arts))
    tools = [x for x in todas if x.get('tipo') == 'ferramenta']
    out.append('## Ferramentas grátis\n' + ''.join('- [%s](%s/%s/): %s\n' % (x['h1'], SITE, x['slug'], x['descricao']) for x in tools))
    for h in [x for x in todas if x.get('tipo') == 'hub']:
        filhas = [x for x in todas if x.get('pai') and x['pai'][1] == h['slug']]
        out.append('## %s\n- [%s](%s/%s/): %s\n' % (h['h1'], h['h1'], SITE, h['slug'], h['descricao']) +
                   ''.join('- [%s](%s/%s/)\n' % (x['h1'], SITE, x['slug']) for x in filhas))
    out.append('## Contato\n- Site: %s/\n- WhatsApp: pelo botão em qualquer página do site.\n- Empresa: Mksoft (https://mksoft.com.br)\n' % SITE)
    return '\n'.join(out)


# ---------------------------------------------------------------- página inicial
# Menu, rodapé e a lista de conteúdos (em HTML, para buscadores e IAs que não rodam JavaScript)
# são escritos no index.html entre os marcadores.
def trocar(s, nome, conteudo):
    ini, fim = '<!--%s:inicio-->' % nome, '<!--%s:fim-->' % nome
    if ini not in s:
        return s
    a, b = s.index(ini) + len(ini), s.index(fim)
    return s[:a] + conteudo + s[b:]


def pagina_inicial():
    path = os.path.join(ROOT, 'index.html')
    s = open(path, encoding='utf-8').read()
    reg = json.load(open(os.path.join(ROOT, 'modules', 'registry.json'), encoding='utf-8'))['modulos']
    cards = []
    for mid in reg:
        mp = os.path.join(ROOT, 'modules', mid, 'manifest.json')
        if not os.path.exists(mp):
            continue
        m = json.load(open(mp, encoding='utf-8'))
        if m.get('status') != 'ativo':
            continue
        cards.append('<article class="module"><h3>%s</h3><p>%s</p><ul>%s</ul></article>' % (
            e(m['nome']), e(m.get('chamada') or m.get('descricao', '')), ''.join('<li>%s</li>' % e(b) for b in m.get('beneficios', [])[:4])))
    s = trocar(s, 'modulos', ''.join(cards))
    s = trocar(s, 'nav', layout.nav(''))
    s = trocar(s, 'rodape', layout.rodape(''))
    open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('ok  index.html (menu, rodapé e módulos)')


if __name__ == '__main__':
    main()
