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
import html, json, os, re, sys, unicodedata, datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import programaticas   # páginas geradas dos dados do sistema (modelos, tabelas, calendário)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'paginas')
HOJE = datetime.date.today().isoformat()
e = html.escape
SITE = 'https://rsscreen.com.br'          # endereço oficial (canonical, Open Graph, dados estruturados)
OG_IMG = SITE + '/assets/img/og.png'      # imagem de compartilhamento 1200x630
ORG = {'@type': 'Organization', '@id': SITE + '/#org', 'name': 'rsscreen', 'url': SITE + '/',
       'logo': SITE + '/assets/img/icon-512.png', 'areaServed': 'BR',
       'description': 'Sistema brasileiro de conteúdo automático para mídia indoor e TVs comerciais.'}


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

    if tipo == 'colecao':
        trilha = [('Início', up), (p['pai'][0], up + p['pai'][1] + '/')]
    elif tipo == 'hub':
        trilha = [('Início', up)]
    else:
        trilha = [('Início', up)] + ([] if tipo == 'legal' else [('Guia', up + 'guia/')])
    if tipo != 'indice':
        trilha.append((p['h1'] if len(p['h1']) < 48 else p['h1'][:45].rsplit(' ', 1)[0] + '…', ''))
    crumbs = ' <span aria-hidden="true">›</span> '.join(
        ('<a href="%s">%s</a>' % (u, e(t)) if u else '<span>%s</span>' % e(t)) for t, u in trilha)

    url = SITE + '/' + p['slug'] + '/'
    abs_ = lambda u: SITE + '/' + (u[len(up):] if u.startswith(up) else u) if u else url
    ld = [{
        '@context': 'https://schema.org', '@type': 'BreadcrumbList',
        'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': t, 'item': abs_(u)} for i, (t, u) in enumerate(trilha)]
    }]
    if tipo in ('artigo', 'colecao'):
        ld.append({'@context': 'https://schema.org', '@type': 'Article', 'headline': p['h1'], 'description': p['descricao'],
                   'inLanguage': 'pt-BR', 'datePublished': p.get('publicado', HOJE), 'dateModified': HOJE,
                   'mainEntityOfPage': url, 'image': OG_IMG, 'author': ORG, 'publisher': ORG})
    elif tipo == 'ferramenta':
        ld.append({'@context': 'https://schema.org', '@type': 'WebApplication', 'name': p['h1'], 'description': p['descricao'],
                   'applicationCategory': 'BusinessApplication', 'operatingSystem': 'Qualquer navegador', 'inLanguage': 'pt-BR',
                   'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'BRL'}})
    fq = faqs(p['corpo'])
    if fq:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': fq})
    ld_html = ''.join('<script type="application/ld+json">%s</script>\n' % json.dumps(x, ensure_ascii=False) for x in ld)

    if tipo in ('artigo', 'colecao') and toc:
        lateral = ('<aside class="toc"><b>Nesta página</b>' + ''.join('<a href="#%s">%s</a>' % (i, e(t)) for i, t in toc) +
                   '<a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Li o guia do rsscreen e quero conhecer o conteúdo para as minhas telas." href="#">'
                   '<i data-icon="whatsapp"></i> Tirar dúvidas</a></aside>')
        miolo = '<div class="page-grid"><article class="prose">%s</article>%s</div>' % (corpo, lateral)
    elif tipo == 'legal':
        miolo = '<article class="prose">%s</article>' % corpo
    else:
        miolo = corpo

    meta = '<div class="page-meta"><span><i data-icon="clock"></i> Última atualização: %s</span></div>' % datetime.date.today().strftime('%d/%m/%Y') if tipo == 'legal' else '' if tipo in ('indice', 'hub') else (
        '<div class="page-meta"><span><i data-icon="clock"></i> Atualizado em %s</span><span><i data-icon="check"></i> Grátis, sem cadastro</span></div>'
        % datetime.date.today().strftime('%d/%m/%Y'))

    if tipo == 'colecao':
        # páginas irmãs (mesmo índice), começando pelas seguintes
        irmas = [x for x in todas if x.get('pai') == p['pai'] and x['slug'] != p['slug']]
        irmas.sort(key=lambda x: (x['ordem'] < p['ordem'], x['ordem']))
        rel = irmas[:3]
    else:
        rel = [x for x in todas if x['slug'] != p['slug'] and x.get('tipo') in ('artigo', 'ferramenta')]
        rel.sort(key=lambda x: (x.get('tipo') == p.get('tipo'), x['ordem']))
        rel = rel[:3] if tipo in ('artigo', 'ferramenta') else []
    relacionados = '' if not rel else (
        '<section class="related"><div class="wrap"><h2>%s</h2><div class="cards">' % ('Veja também' if tipo == 'colecao' else 'Continue lendo') +
        ''.join(card(x, up) for x in rel) + '</div></div></section>')

    script = ('<script src="%s"></script>\n' % p['script'].replace('{raiz}', up)) if p.get('script') else ''
    if 'tv-live' in corpo:
        script += '<script src="%sassets/js/vitrine.js"></script>\n' % up

    return TEMPLATE.format(
        titulo=e(p['titulo']), descricao=e(p['descricao']), up=up, ld=ld_html, crumbs=crumbs, url=url, og_img=OG_IMG,
        h1=e(p['h1']), lead=('<p class="lead">%s</p>' % p['lead']) if p.get('lead') else '', meta=meta,
        miolo=miolo, relacionados=relacionados, script=script)


def card(x, up):
    return ('<a class="card-link" href="%s%s/"><i data-icon="%s"></i><b>%s</b><span>%s</span><em>%s <i data-icon="arrow"></i></em></a>'
            % (up, x['slug'], x.get('icone', 'sparkles'), html.escape(x['h1']), html.escape(x.get('cartao', '')),
               'Abrir ferramenta' if x.get('tipo') == 'ferramenta' else 'Ver' if x.get('tipo') in ('colecao', 'hub') else 'Ler o guia'))


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
  <!-- Página gerada por tools/gerar-site.py: edite o texto em tools/paginas/ e rode o gerador de novo. -->
  <header class="nav" id="nav">
    <div class="wrap nav-inner">
      <a href="{up}" class="logo"><i data-logo></i><span><b>rss</b>creen</span></a>
      <nav class="nav-links" id="navLinks">
        <a href="{up}guia/">Guia</a>
        <a href="{up}ferramentas/calculadora-midia-indoor/">Calculadora</a>
        <a href="{up}solucoes/">Soluções</a>
        <a href="{up}modelos/">Modelos</a>
        <a href="{up}calendario-comercial/">Calendário</a>
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
      <p><a href="{up}guia/">Guia da mídia indoor</a> · <a href="{up}ferramentas/calculadora-midia-indoor/">Calculadora</a> · <a href="{up}ferramentas/proposta-comercial/">Modelo de proposta</a> · <a href="{up}ferramentas/tabela-de-precos/">Tabela de preços</a> · <a href="{up}solucoes/">Soluções</a> · <a href="{up}modelos/">Modelos prontos</a> · <a href="{up}calendario-comercial/">Calendário comercial</a> · <a href="{up}termos-de-uso/">Termos de uso</a> · <a href="{up}privacidade/">Privacidade</a> · © <span id="year"></span> rsscreen</p>
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
    todas += programaticas.todas()
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
    open(os.path.join(ROOT, 'llms.txt'), 'w', encoding='utf-8', newline='\n').write(llms(todas))
    print('ok  llms.txt')
    modulos_na_home()


# ---------------------------------------------------------------- llms.txt
# Resumo em texto do site para ferramentas de IA (padrão llms.txt). Gerado a cada execução,
# sempre com as páginas que existem. Só informação verificável no próprio site.
LLMS_TOPO = '''# rsscreen

> rsscreen é um sistema brasileiro de conteúdo automático para mídia indoor e TVs comerciais. Gera links de tela (notícias, previsão do tempo, cotações, futebol, loterias, anúncios, tabelas de preços e cardápios) que abrem em qualquer TV com navegador, TV Box ou sistema de mídia indoor e se atualizam sozinhos, 24 horas por dia.

## Para quem é
- Operadores de mídia indoor que vendem anúncios em TVs instaladas em comércios.
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
    sec = [('Guia da mídia indoor (artigos)', 'artigo'), ('Ferramentas grátis', 'ferramenta')]
    out = [LLMS_TOPO]
    for nome, tipo in sec:
        ps = [x for x in todas if x.get('tipo') == tipo]
        if ps:
            out.append('## %s\n' % nome + ''.join('- [%s](%s/%s/): %s\n' % (x['h1'], SITE, x['slug'], x['descricao']) for x in ps))
    hubs = [x for x in todas if x.get('tipo') == 'hub']
    for h in hubs:
        filhas = [x for x in todas if x.get('pai') and x['pai'][1] == h['slug']]
        out.append('## %s\n- [%s](%s/%s/): %s\n' % (h['h1'], h['h1'], SITE, h['slug'], h['descricao']) +
                   ''.join('- [%s](%s/%s/)\n' % (x['h1'], SITE, x['slug']) for x in filhas))
    out.append('## Contato\n- Site: %s/\n- WhatsApp: pelo botão em qualquer página do site.\n' % SITE)
    return '\n'.join(out)


# ---------------------------------------------------------------- módulos na página inicial
# A lista de conteúdos da página inicial é montada por JavaScript; para buscadores e IAs que não
# rodam JavaScript, o gerador escreve a mesma lista em HTML entre os marcadores do index.html.
def modulos_na_home():
    path = os.path.join(ROOT, 'index.html')
    s = open(path, encoding='utf-8').read()
    ini, fim = '<!--modulos:inicio-->', '<!--modulos:fim-->'
    if ini not in s:
        return
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
    a, b = s.index(ini) + len(ini), s.index(fim)
    s = s[:a] + ''.join(cards) + s[b:]
    open(path, 'w', encoding='utf-8', newline='\n').write(s)
    print('ok  index.html (módulos em HTML)')


if __name__ == '__main__':
    main()
