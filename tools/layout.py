"""Menu e rodapé do site, iguais em todas as páginas (usados por tools/gerar-site.py).

O gerador escreve o mesmo menu e rodapé no index.html (entre os marcadores <!--nav:...--> e
<!--rodape:...-->) e no modelo das páginas geradas. Para mudar um link, mude aqui e rode o gerador.
"""
import datetime

ANO = datetime.date.today().year

# (título, ícone, descrição curta, endereço relativo à raiz)
CONTEUDOS = [
    ('Notícias', 'news', 'Mais de 90 sites, por assunto', 'solucoes/noticias-na-tv/'),
    ('Previsão do tempo', 'sun', 'Qualquer cidade do Brasil', 'solucoes/previsao-do-tempo-na-tv/'),
    ('Futebol', 'zap', 'Placares, jogos e tabela', 'solucoes/futebol-na-tv/'),
    ('Loterias', 'ticket', 'Resultados logo após o sorteio', 'solucoes/resultados-de-loterias-na-tv/'),
    ('Cotações', 'chart', 'Dólar, bitcoin e agro', 'solucoes/cotacoes-na-tv/'),
    ('QR Code do Wi-Fi', 'phone', 'Boas-vindas na recepção', 'solucoes/qr-code-wifi-na-tv/'),
    ('Tabelas e cardápios', 'tag', 'O comércio edita pelo celular', 'modelos/#tabelas-de-precos-e-cardapios'),
    ('Anúncios prontos', 'sparkles', 'Modelos por tipo de comércio', 'modelos/#modelos-de-anuncio-por-tipo-de-comercio'),
]
APRENDA = [
    ('Comece aqui', 'arrow', 'O guia para quem está começando', 'guia/'),
    ('Blog', 'news', 'Todos os artigos, com busca', 'blog/'),
    ('Como ganhar dinheiro', 'chart', 'O negócio de mídia indoor', 'guia/como-ganhar-dinheiro-com-midia-indoor/'),
    ('Quanto cobrar', 'tag', 'Preço do anúncio em TV', 'guia/quanto-cobrar-por-anuncio-em-tv/'),
    ('Calendário comercial', 'clock', 'Datas que vendem, mês a mês', 'calendario-comercial/'),
]
FERRAMENTAS = [
    ('Calculadora de ganhos', 'chart', 'ferramentas/calculadora-midia-indoor/'),
    ('Exibições do anúncio', 'clock', 'ferramentas/calculadora-de-exibicoes/'),
    ('Proposta comercial', 'copy', 'ferramentas/proposta-comercial/'),
    ('Tabela de preços', 'tag', 'ferramentas/tabela-de-precos/'),
    ('Gerador de anúncio', 'sparkles', 'ferramentas/gerador-de-anuncio/'),
    ('Mídia kit', 'layers', 'ferramentas/midia-kit/'),
    ('Mensagens de abordagem', 'whatsapp', 'ferramentas/mensagens-de-abordagem/'),
    ('Tamanho de TV ideal', 'monitor', 'ferramentas/tamanho-de-tv-ideal/'),
    ('Teste da TV', 'check', 'ferramentas/teste-da-tv/'),
]


def _item(up, t, ico, desc, href):
    return ('<a href="%s%s"><i data-icon="%s"></i><span><b>%s</b>%s</span></a>'
            % (up, href, ico, t, ('<small>%s</small>' % desc) if desc else ''))


def _grupo(nome, corpo, cls=''):
    return ('<div class="nav-item"><button class="nav-top" type="button" aria-expanded="false" aria-haspopup="true">%s<i data-icon="chevron"></i></button>'
            '<div class="nav-drop %s">%s</div></div>' % (nome, cls, corpo))


def nav(up):
    conteudos = ''.join(_item(up, *x) for x in CONTEUDOS) + \
        '<a class="nav-drop-all" href="%s#modelos"><span><b>Ver as telas funcionando ao vivo</b></span><i data-icon="arrow"></i></a>' % up
    aprenda = ''.join(_item(up, *x) for x in APRENDA)
    ferramentas = ''.join(_item(up, t, ico, '', href) for t, ico, href in FERRAMENTAS) + \
        '<a class="nav-drop-all" href="%sblog/#ferramentas"><span><b>Todas as ferramentas grátis</b></span><i data-icon="arrow"></i></a>' % up
    return ('<nav class="nav-links" id="navLinks" aria-label="Menu principal">' +
            _grupo('Conteúdos', conteudos, 'nav-drop-2') + _grupo('Aprenda', aprenda) + _grupo('Ferramentas', ferramentas, 'nav-drop-2') +
            '<a class="nav-top" href="%smodelos/">Modelos</a>' % up +
            '</nav>')


def rodape(up):
    col = lambda titulo, links: '<div class="ft-col"><b>%s</b>%s</div>' % (titulo, ''.join('<a href="%s%s">%s</a>' % (up, h, t) for t, h in links))
    return ('<footer class="footer"><div class="wrap">'
            '<div class="ft-grid">'
            '<div class="ft-brand"><a href="%s" class="logo"><i data-logo></i><span><b>rss</b>creen</span></a>'
            '<p>Conteúdo automático para mídia indoor e TV comercial: notícias, clima, futebol, loterias, anúncios, tabelas de preço e cardápios em qualquer TV.</p></div>' % up +
            col('Conteúdos para TV', [(x[0], x[3]) for x in CONTEUDOS[:6]] + [('Modelos prontos', 'modelos/')]) +
            col('Aprenda', [(x[0], x[3]) for x in APRENDA]) +
            col('Ferramentas grátis', [(t, h) for t, _, h in FERRAMENTAS[:6]]) +
            '</div>'
            '<div class="ft-base"><p>© 2018–<span id="year">%d</span> · rsscreen é um sistema projetado e desenvolvido pela '
            '<a href="https://mksoft.com.br" target="_blank" rel="noopener">Mksoft</a> (mksoft.com.br).</p>'
            '<p><a href="%stermos-de-uso/">Termos de uso</a> · <a href="%sprivacidade/">Privacidade</a> · <a href="%spainel/" rel="nofollow">Área do administrador</a></p></div>'
            '</div></footer>' % (ANO, up, up, up))
