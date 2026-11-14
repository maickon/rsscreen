"""Gera as páginas do Guia e das Ferramentas (site para a busca do Google).

Uso:  python tools/gerar-site.py

Cada arquivo em tools/paginas/*.html tem um cabeçalho e o conteúdo:

    <!--
    slug: guia/como-ganhar-dinheiro-com-midia-indoor
    titulo: texto da aba do navegador e do Google (até ~60 caracteres)
    descricao: resumo que aparece no Google (até ~155 caracteres)
    h1: título grande da página
    lead: frase de abertura
    cartao: texto curto do cartão no índice do guia
    icone: news | chart | monitor | tag | ...
    tipo: artigo | ferramenta | indice
    ordem: 1
    script: ../../assets/js/ferramentas.js   (opcional)
    -->
    <h2>...</h2> ...

O gerador cria <slug>/index.html com menu, trilha, sumário (a partir dos <h2>), dados
estruturados para o Google (artigo, trilha e perguntas frequentes), "continue lendo" e rodapé.
Também cria guia/paginas.json, usado pelo Worker para montar o /sitemap.xml.
"""
import html, json, os, re, unicodedata, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'paginas')
HOJE = datetime.date.today().isoformat()


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


def pagina(p, todas):
    depth = p['slug'].count('/') + 1
    up = '../' * depth
    corpo, toc = com_ids(p['corpo'])
    corpo = corpo.replace('{raiz}', up)
    tipo = p.get('tipo', 'artigo')
    e = html.escape

    trilha = [('Início', up)] + ([] if tipo == 'legal' else [('Guia', up + 'guia/')])
    if tipo != 'indice':
        trilha.append((p['h1'] if len(p['h1']) < 48 else p['h1'][:45].rsplit(' ', 1)[0] + '…', ''))
    crumbs = ' <span aria-hidden="true">›</span> '.join(
        ('<a href="%s">%s</a>' % (u, e(t)) if u else '<span>%s</span>' % e(t)) for t, u in trilha)

    ld = [{
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': t} for i, (t, u) in enumerate(trilha)]
    }]
    if tipo == 'artigo':
        ld.append({'@context': 'https://schema.org', '@type': 'Article', 'headline': p['h1'], 'description': p['descricao'],
                   'inLanguage': 'pt-BR', 'dateModified': HOJE, 'author': {'@type': 'Organization', 'name': 'rsscreen'},
                   'publisher': {'@type': 'Organization', 'name': 'rsscreen'}})
    elif tipo == 'ferramenta':
        ld.append({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': p['h1'], 'description': p['descricao'],
                   'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Qualquer navegador', 'inLanguage': 'pt-BR',
                   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'BRL'}})
    fq = faqs(p['corpo'])
    if fq:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': fq})
    ld_html = ''.join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False) for x in ld)

    if tipo == 'artigo' and toc:
        lateral = ('<aside class="toc"><b>Nesta página</b>' + ''.join('<a href="#%s">%s</a>' % (i, e(t)) for i, t in toc) +
                   '<a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Li o guia do rsscreen e quero conhecer o conteúdo para as minhas telas." href="#">'
                   '<i data-icon="whatsapp"></i> Tirar dúvidas</a></aside>')
        miolo = '<div class="page-grid"><article class="prose">%s</article>%s</div>' % (corpo, lateral)
    elif tipo == 'legal':
        miolo = '<article class="prose">%s</article>' % corpo
    else:
        miolo = corpo

    meta = '<div class="page-meta"><span><i data-icon="clock"></i> Última atualização: %s</span></div>' % datetime.date.today().strftime('%d/%m/%Y') if tipo == 'legal' else '' if tipo == 'indice' else (
        '<div class="page-meta"><span><i data-icon="clock"></i> Atualizado em %s</span><span><i data-icon="check"></i> Grátis, sem cadastro</span></div>'
        % datetime.date.today().strftime('%d/%m/%Y'))

    rel = [x for x in todas if x['slug'] != p['slug'] and x.get('tipo') in ('artigo', 'ferramenta')]
    rel.sort(key=lambda x: (x.get('tipo') == p.get('tipo'), x['ordem']))
    rel = rel[:3] if tipo in ('artigo', 'ferramenta') else []
    relacionados = '' if not rel else (
        '<section class="related"><div class="wrap"><h2>Continue lendo</h2><div class="cards">' +
        ''.join(card(x, up) for x in rel) + '</div></div></section>')

    script = ('<script src="%s"></script>\n' % p['script'].replace('{raiz}', up)) if p.get('script') else ''

    return TEMPLATE.format(
        titulo=e(p['titulo']), descricao=e(p['descricao']), up=up, ld=ld_html, crumbs=crumbs,
        h1=e(p['h1']), lead=('<p class="lead">%s</p>' % p['lead']) if p.get('lead') else '', meta=meta,
        miolo=miolo, relacionados=relacionados, script=script)


def card(x, up):
    return ('<a class="card-link" href="%s%s/"><i data-icon="%s"></i><b>%s</b><span>%s</span><em>%s <i data-icon="arrow"></i></em></a>'
            % (up, x['slug'], x.get('icone', 'sparkles'), html.escape(x['h1']), html.escape(x.get('cartao', '')),
               'Abrir ferramenta' if x.get('tipo') == 'ferramenta' else 'Ler o guia'))


TEMPLATE = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{titulo}</title>
  <meta name="description" content="{descricao}" />
  <meta name="theme-color" content="#0A0A0A" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="{titulo}" />
  <meta property="og:description" content="{descricao}" />
  <meta property="og:locale" content="pt_BR" />
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
  <!-- Página gerada por tools/gerar-site.py: edite o texto em tools/paginas/ e rode o gerador de novo. -->
  <header class="nav" id="nav">
    <div class="wrap nav-inner">
      <a href="{up}" class="logo"><i data-logo></i><span><b>rss</b>creen</span></a>
      <nav class="nav-links" id="navLinks">
        <a href="{up}guia/">Guia</a>
        <a href="{up}ferramentas/calculadora-midia-indoor/">Calculadora</a>
        <a href="{up}ferramentas/proposta-comercial/">Proposta</a>
        <a href="{up}#modulos">Conteúdos</a>
        <a href="{up}#modelos">Telas ao vivo</a>
      </nav>
      <div class="nav-cta">
        <a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Vim pelo guia do rsscreen e quero conhecer o conteúdo para minhas telas." href="#"><i data-icon="whatsapp"></i><span>WhatsApp</span></a>
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
        <a class="btn btn-primary btn-lg js-wa" data-msg="Olá! Vim pelo guia do rsscreen e quero uma demonstração para as minhas telas." href="#"><i data-icon="whatsapp"></i> Quero uma demonstração</a>
      </div>
    </section>
  </main>

  <footer class="footer">
    <div class="wrap footer-inner">
      <a href="{up}" class="logo"><i data-logo></i><span><b>rss</b>creen</span></a>
      <p><a href="{up}guia/">Guia da mídia indoor</a> · <a href="{up}ferramentas/calculadora-midia-indoor/">Calculadora</a> · <a href="{up}ferramentas/proposta-comercial/">Modelo de proposta</a> · <a href="{up}ferramentas/tabela-de-precos/">Tabela de preços</a> · <a href="{up}termos-de-uso/">Termos de uso</a> · <a href="{up}privacidade/">Privacidade</a> · © <span id="year"></span> rsscreen</p>
    </div>
  </footer>
  <a class="wa-float js-wa" data-msg="Olá! Vim pelo guia do rsscreen." href="#" aria-label="Falar no WhatsApp"><i data-icon="whatsapp"></i></a>

  <script src="{up}config/clientes.js"></script>
  <script src="{up}assets/js/core.js"></script>
  <script src="{up}assets/js/icons.js"></script>
  <script src="{up}assets/js/site.js"></script>
{script}</body>
</html>
'''


def main():
    todas = sorted((ler(os.path.join(SRC, f)) for f in os.listdir(SRC) if f.endswith('.html')), key=lambda x: x['ordem'])
    for p in todas:
        if p.get('tipo') == 'indice':
            arts = [x for x in todas if x.get('tipo') == 'artigo']
            tools = [x for x in todas if x.get('tipo') == 'ferramenta']
            p['corpo'] = (p['corpo']
                          .replace('{artigos}', '<div class="cards">' + ''.join(card(x, '../') for x in arts) + '</div>')
                          .replace('{ferramentas}', '<div class="cards">' + ''.join(card(x, '../') for x in tools) + '</div>'))
    for p in todas:
        out = os.path.join(ROOT, *p['slug'].split('/'), 'index.html')
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, 'w', encoding='utf-8', newline='\n').write(pagina(p, todas))
        print('ok ', p['slug'])
    lista = [{'url': '/' + p['slug'] + '/', 'atualizado': HOJE} for p in todas]
    open(os.path.join(ROOT, 'guia', 'paginas.json'), 'w', encoding='utf-8', newline='\n').write(json.dumps(lista, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
