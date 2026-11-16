"""Páginas geradas a partir dos dados do próprio sistema (usadas por tools/gerar-site.py).

Só gera página quando há conteúdo útil de verdade para quem busca:
  - modelos/anuncio-para-<nicho>/      anúncios prontos do nicho, com a tela ao vivo e os textos
  - modelos/<tabela|cardapio>-<seg>/    lista completa de produtos com descrição + modelos ao vivo
  - calendario-comercial/<mes>/         datas do mês (próximos 12 meses) com ideia de promoção por data
  - modelos/ e calendario-comercial/    índices

Os dados vêm de modules/anuncios/modelos.json, modules/catalogo/*.json e do calendário abaixo.
Rodar de novo o gerador atualiza o calendário (sempre os próximos 12 meses).
"""
import datetime, html, json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
e = html.escape
MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
SEMANA = ['segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo']


def slugify(s):
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def jload(*p):
    return json.load(open(os.path.join(ROOT, *p), encoding='utf-8'))


def tv(q, titulo):
    return '<div class="tv-live" data-tela="%s" data-titulo="%s"></div>' % (e(q), e(titulo))


def cta(msg, txt):
    return '<p><a class="btn btn-primary js-wa" data-msg="%s" href="#"><i data-icon="whatsapp"></i> %s</a></p>' % (e(msg), e(txt))


# ---------------------------------------------------------------- anúncios por nicho
NICHO = {
    'Açougue': ('O cliente de açougue decide muito no balcão: um anúncio com o corte do dia e o preço grande na TV vende na hora, principalmente perto do fim de semana.',
                ['Oferta do corte da semana com preço de/por', 'Kit churrasco para sexta e sábado', 'Cortes sob encomenda e pedido pelo WhatsApp', 'Horário de funcionamento no feriado']),
    'Hortifrúti': ('Hortifrúti vende frescor. Mostre a fruta e o legume do dia com foto e preço por quilo, e troque toda manhã conforme a chegada da mercadoria.',
                   ['Oferta do dia com preço por quilo', 'Dia da feira (terça verde, quarta da fruta)', 'Cestas para empresas e entrega no bairro', 'Produtos da estação']),
    'Padaria': ('Na padaria a fila é a melhor audiência: o cliente olha a TV enquanto espera. Horário da fornada, combo de café da manhã e encomendas de festa são os anúncios que mais funcionam.',
                ['Horário das fornadas do pão francês', 'Combo de café da manhã até as 10h', 'Encomendas de bolos e salgados para festas', 'Sonho e salgado do dia']),
    'Mercado': ('Mercado de bairro compete com o atacarejo no preço. A TV ajuda a mostrar as ofertas da semana e o dia de promoção, que é o que traz o cliente de volta.',
                ['Ofertas da semana com preço de/por', 'Dia da economia (ex.: quarta-feira)', 'Itens da cesta básica', 'Formas de pagamento e entrega']),
    'Lanchonete': ('Lanchonete vende pelo olho. Um lanche bem fotografado com preço e um combo na TV aumentam o ticket, e o delivery ganha pedidos de quem passa pela porta.',
                   ['Lanche em destaque com foto', 'Combo lanche + batata + refri', 'Delivery pelo WhatsApp', 'Promoção de dia fraco (ex.: terça)']),
    'Pizzaria': ('Pizzaria vende pelo desejo: pizza com foto, o dia da promoção e o rodízio. Na TV do salão, o anúncio também puxa a sobremesa e a bebida.',
                 ['Dia da promoção da pizza grande', 'Rodízio às sextas e sábados', 'Pizza doce para fechar o pedido', 'Telefone e WhatsApp do delivery']),
    'Açaí': ('Açaí vende por impulso e por tamanho. Mostre o copo com os acompanhamentos e o preço por tamanho, e destaque a promoção nos dias quentes.',
             ['Copo em promoção com acompanhamentos', 'Açaí por quilo', 'Adicionais mais pedidos', 'Combo para dividir']),
    'Cafeteria': ('Na cafeteria o anúncio certo aumenta o ticket médio: café com acompanhamento, combo da tarde e a bebida da estação.',
                  ['Café + pão de queijo da tarde', 'Bebida gelada da estação', 'Bolo do dia', 'Programa de fidelidade']),
    'Adega e bebidas': ('Adega e conveniência vendem gelado e pronto para levar. Pack de cerveja, gelo e carvão no fim de semana são os anúncios que giram.',
                        ['Pack gelado com preço de/por', 'Kit festa: gelo, carvão e copos', 'Vinhos e destilados para presente', 'Entrega pelo WhatsApp']),
    'Restaurante': ('Restaurante usa a TV para o prato do dia, o almoço executivo e o cardápio de fim de semana, e para avisar reserva e delivery.',
                    ['Prato do dia com preço', 'Almoço executivo de segunda a sexta', 'Feijoada ou prato especial do sábado', 'Reserva para datas comemorativas']),
    'Farmácia': ('Na farmácia o cliente espera no balcão. Ofertas de higiene e beleza e os serviços (pressão, glicemia, injetáveis) são os anúncios mais úteis.',
                 ['Oferta de protetor solar e dermocosméticos', 'Serviços farmacêuticos sem agendamento', 'Entrega em domicílio', 'Campanhas de saúde do mês']),
    'Pet shop': ('Pet shop anuncia serviço e recorrência: banho e tosa com agenda, ração em oferta e táxi dog.',
                 ['Banho e tosa com horário marcado', 'Ração em oferta', 'Vacinação e consulta', 'Táxi dog e entrega']),
    'Barbearia e salão': ('Barbearia e salão têm cliente sentado esperando: ótimo momento para mostrar serviços, combos e a promoção do dia fraco.',
                          ['Tabela de serviços', 'Combo corte + barba', 'Promoção de terça e quarta', 'Agendamento pelo WhatsApp']),
    'Academia': ('Academia anuncia matrícula, modalidades e aulas experimentais. A TV da recepção também serve para avisos e horários.',
                 ['Matrícula grátis ou plano promocional', 'Modalidades e horários das aulas', 'Aula experimental', 'Indique um amigo']),
    'Clínica e odontologia': ('Clínica e consultório têm a sala de espera com 20 minutos de atenção. Serviços, campanhas de saúde e avaliação sem compromisso informam e geram retorno.',
                              ['Serviços e especialidades', 'Avaliação sem compromisso', 'Campanha de saúde do mês', 'Convênios aceitos']),
    'Oficina e autopeças': ('Oficina e autopeças anunciam serviço com garantia e revisões de época (viagem, férias).',
                            ['Troca de óleo com preço fechado', 'Revisão para viagem', 'Serviços e garantia', 'Orçamento pelo WhatsApp']),
    'Loja de roupas e calçados': ('Loja de roupa usa a TV para liquidação, coleção nova e datas como Dia das Mães, dos Pais e Natal.',
                                  ['Liquidação com percentual', 'Coleção nova', 'Parcelamento', 'Datas comemorativas']),
    'Ótica': ('Ótica anuncia óculos completo com preço fechado e exame de vista no local, que é o que tira a dúvida do cliente.',
              ['Óculos completo com lentes', 'Exame de vista no local', 'Óculos de sol da estação', 'Parcelamento']),
    'Material de construção': ('Material de construção vende por preço e entrega: cimento, tinta e itens da obra com entrega rápida.',
                               ['Oferta de cimento e argamassa', 'Entrega na obra', 'Orçamento rápido', 'Tintas e acabamento']),
    'Imobiliária': ('Imobiliária usa a TV da recepção e de pontos parceiros para mostrar imóveis em destaque com preço e chamada para visita.',
                    ['Imóvel em destaque com preço', 'Lançamentos', 'Avaliação gratuita do seu imóvel', 'Contato do corretor']),
    'Escola e cursos': ('Escolas e cursos anunciam matrícula e cursos com certificado, e usam a TV para avisos da secretaria.',
                        ['Matrículas abertas', 'Cursos com certificado', 'Bolsas e descontos', 'Avisos e calendário']),
    'Avisos gerais': ('Avisos que qualquer comércio precisa mostrar: horário de funcionamento, formas de pagamento e redes sociais.',
                      ['Horário de funcionamento e feriados', 'Formas de pagamento', 'Siga no Instagram', 'Avisos rápidos']),
    'Eventos': ('Eventos ganham público com antecedência: data grande, local, horário e uma chamada simples.',
                ['Festa e evento da comunidade', 'Show ou apresentação', 'Inauguração', 'Feira e bazar']),
}


def preco_txt(d):
    if not d.get('preco'):
        return ''
    return (' de R$ %s por <b>R$ %s</b>' % (e(d['precoDe']), e(d['preco']))) if d.get('precoDe') else ' por <b>R$ %s</b>' % e(d['preco'])


def paginas_anuncios():
    dados = jload('modules', 'anuncios', 'modelos.json')
    out = []
    for i, nicho in enumerate(dados['nichos']):
        mods = [m for m in dados['modelos'] if m['nicho'] == nicho]
        intro, ideias = NICHO.get(nicho, ('', []))
        nome_l = nicho[0].lower() + nicho[1:] if not nicho.isupper() else nicho
        corpo = ['<p>%s</p>' % e(intro)]
        corpo.append('<h2>Modelos prontos de anúncio para %s</h2>' % e(nome_l))
        corpo.append('<p>As telas abaixo estão funcionando de verdade, como aparecem na TV. Cada modelo já vem com texto, cores e foto: no rsscreen você escolhe o modelo, troca o nome, o preço e o contato e publica.</p>')
        for m in mods:
            d = m['dados']
            corpo.append('<h3>%s</h3>' % e(m['nome']))
            corpo.append(tv('modulo=anuncios&assunto=exemplo&anuncio=' + m['id'], m['nome']))
            linhas = []
            if d.get('selo'): linhas.append('<li><b>Etiqueta:</b> %s</li>' % e(d['selo']))
            linhas.append('<li><b>Título:</b> %s%s</li>' % (e(d.get('titulo', '')), preco_txt(d)))
            if d.get('subtitulo'): linhas.append('<li><b>Descrição:</b> %s</li>' % e(d['subtitulo']))
            if d.get('itens'): linhas.append('<li><b>Itens:</b> %s</li>' % e(', '.join(d['itens'].split('\n'))))
            if d.get('texto'): linhas.append('<li><b>Texto:</b> %s</li>' % e(d['texto']))
            if d.get('cta'): linhas.append('<li><b>Chamada:</b> %s</li>' % e(d['cta']))
            corpo.append('<ul class="anuncio-texto">%s</ul>' % ''.join(linhas))
        if ideias:
            corpo.append('<h2>Ideias de anúncio que funcionam para %s</h2>' % e(nome_l))
            corpo.append('<ul>%s</ul>' % ''.join('<li>%s</li>' % e(x) for x in ideias))
        corpo.append('<h2>Como deixar o anúncio fácil de ler na TV</h2>')
        corpo.append('<ul><li><b>Uma mensagem por anúncio:</b> um produto ou um serviço, não uma lista inteira.</li>'
                     '<li><b>Preço grande:</b> é a primeira coisa que o cliente procura.</li>'
                     '<li><b>De 8 a 15 segundos na tela:</b> tempo para ler sem cansar.</li>'
                     '<li><b>Chamada clara:</b> "só hoje", "peça pelo WhatsApp", "até domingo".</li>'
                     '<li><b>Troque toda semana:</b> anúncio parado vira paisagem.</li></ul>')
        corpo.append('<h2>Perguntas frequentes</h2>')
        corpo.append('<details><summary>Posso usar esses modelos de graça?<i data-icon="chevron"></i></summary><p>Sim. Os modelos estão no rsscreen: você escolhe, troca os textos e o preço e coloca na TV. A foto dos modelos é de banco de imagens de uso livre.</p></details>')
        corpo.append('<details><summary>Funciona na TV que eu já tenho?<i data-icon="chevron"></i></summary><p>Funciona em qualquer TV com navegador, TV Box ou sistema de mídia indoor: o anúncio é um link que abre em tela cheia e se atualiza sozinho.</p></details>')
        corpo.append(cta('Olá! Vi os modelos de anúncio para %s e quero usar nas minhas telas.' % nome_l, 'Quero usar estes modelos'))
        slug = 'modelos/anuncio-para-' + slugify(nicho)
        out.append({'slug': slug, 'tipo': 'colecao', 'pai': ('Modelos prontos', 'modelos'), 'ordem': 200 + i, 'icone': 'tag',
                    'titulo': ('Modelos de anúncio para %s na TV (grátis)' % nome_l)[:68],
                    'descricao': ('%d modelos prontos de anúncio para %s: veja funcionando, troque o texto e o preço e coloque na TV ou mídia indoor.' % (len(mods), nome_l))[:158],
                    'h1': 'Modelos de anúncio para %s' % nome_l,
                    'lead': 'Anúncios prontos para TV e mídia indoor: é só trocar o texto, o preço e o contato.',
                    'cartao': '%d modelo%s pronto%s' % (len(mods), 's' if len(mods) > 1 else '', 's' if len(mods) > 1 else ''),
                    'corpo': '\n'.join(corpo)})
    return out


# ---------------------------------------------------------------- tabelas e cardápios por segmento
SEG = {
    'acougue': ('Tabela de preços para açougue na TV', 'A tabela de preços na TV acaba com a plaquinha escrita à mão: o cliente vê todos os cortes de longe, com o preço do quilo e a oferta do dia em destaque.'),
    'hortifruti': ('Tabela de preços para hortifrúti na TV', 'No hortifrúti o preço muda todo dia. Com a tabela na TV, você atualiza pelo celular de manhã e a tela muda sozinha, sem reimprimir nada.'),
    'padaria': ('Tabela de preços para padaria na TV', 'Pães, salgados, doces e frios com preço na TV, separados por categoria, e o café da manhã em destaque para quem está na fila.'),
    'mercado': ('Tabela de preços para mercado na TV', 'As ofertas da semana e a cesta básica na TV, com preço de/por, ajudam o mercado de bairro a mostrar que tem preço.'),
    'bebidas': ('Tabela de preços para adega e bebidas na TV', 'Cervejas, refrigerantes, destilados e conveniência com preço na TV, com o gelado e o pack em destaque.'),
    'lanchonete': ('Cardápio para lanchonete na TV', 'Cardápio digital na TV com lanches, porções, combos e bebidas, com descrição dos ingredientes e o combo em destaque.'),
    'pizzaria': ('Cardápio para pizzaria na TV', 'Sabores, tamanhos e bebidas no cardápio da TV, com os ingredientes de cada pizza e a promoção do dia.'),
    'acai': ('Cardápio para açaí na TV', 'Tamanhos, acompanhamentos e sorvetes no cardápio da TV, fácil de ler na hora de montar o copo.'),
    'cafeteria': ('Cardápio para cafeteria na TV', 'Cafés, chás, salgados e doces no cardápio da TV, com descrição e o combo da manhã em destaque.'),
}


def paginas_tabelas():
    idx = jload('modules', 'catalogo', 'index.json')
    out = []
    for i, s in enumerate(idx['segmentos']):
        cat = jload('modules', 'catalogo', s['id'] + '.json')
        h1, intro = SEG.get(s['id'], (cat['nome'], ''))
        cardapio = cat['tipo'] == 'cardapio'
        total = sum(len(c['itens']) for c in cat['categorias'])
        corpo = ['<p>%s</p>' % e(intro)]
        corpo.append('<h2>Modelos prontos funcionando</h2>')
        corpo.append('<p>Telas reais com preços de exemplo. No rsscreen você importa um modelo pronto, digita os seus preços pelo celular e a TV atualiza sozinha.</p>')
        for m in cat.get('modelos', []):
            corpo.append('<h3>%s</h3>' % e(m['nome']))
            corpo.append(tv('modulo=lista&assunto=exemplo&layout=%s&seg=%s&modelo=%s' % ('cardapio' if cardapio else 'lista', s['id'], m['id']), m['nome']))
            corpo.append('<p class="modelo-itens">%d produtos: %s.</p>' % (len(m['itens']), e(', '.join(m['itens']))))
        corpo.append('<h2>Lista completa de produtos com descrição</h2>')
        corpo.append('<p>Os %d itens que já vêm no catálogo do rsscreen para %s, com unidade e descrição prontas. Use como referência para montar a sua %s.</p>'
                     % (total, e(cat['nome'].lower()), 'carta' if cardapio else 'tabela'))
        for c in cat['categorias']:
            corpo.append('<h3>%s</h3>' % e(c['nome']))
            corpo.append('<div class="table-wrap"><table class="table"><thead><tr><th>Produto</th><th>Unidade</th><th>Descrição</th></tr></thead><tbody>%s</tbody></table></div>'
                         % ''.join('<tr><td><b>%s</b></td><td>%s</td><td>%s</td></tr>' % (e(it[0]), e(it[1]), e(it[2] if len(it) > 2 else '')) for it in c['itens']))
        corpo.append('<h2>Dicas para a %s na TV</h2>' % ('carta' if cardapio else 'tabela'))
        corpo.append('<ul><li><b>Até 16 itens por tela:</b> mais que isso, divida em páginas que passam sozinhas.</li>'
                     '<li><b>Agrupe por categoria:</b> o cliente acha o que procura mais rápido.</li>'
                     '<li><b>Destaque a oferta:</b> preço de/por e uma etiqueta de oferta vendem mais.</li>'
                     '<li><b>Marque o que acabou:</b> riscado ou escondido, para não gerar reclamação no balcão.</li>'
                     '<li><b>Fundo com foto do produto:</b> fica profissional e combina com o seu comércio.</li></ul>')
        corpo.append('<h2>Perguntas frequentes</h2>')
        corpo.append('<details><summary>Como atualizo os preços?<i data-icon="chevron"></i></summary><p>Pelo celular, num link de edição só seu, sem login. Você digita o preço e a TV muda sozinha em poucos minutos.</p></details>')
        corpo.append('<details><summary>Preciso de um computador ligado na TV?<i data-icon="chevron"></i></summary><p>Não. Funciona em Smart TV com navegador, TV Box ou no sistema de mídia indoor que você já usa.</p></details>')
        corpo.append(cta('Olá! Quero a %s na TV do meu comércio.' % h1.lower(), 'Quero a minha %s na TV' % ('carta' if cardapio else 'tabela')))
        slug = 'modelos/' + slugify(h1.replace(' na TV', ''))
        out.append({'slug': slug, 'tipo': 'colecao', 'pai': ('Modelos prontos', 'modelos'), 'ordem': 100 + i, 'icone': 'monitor',
                    'titulo': (h1 + ': modelos prontos')[:68],
                    'descricao': ('Modelos prontos de %s com %d produtos e descrições. Veja na TV, digite os preços pelo celular e a tela atualiza sozinha.' % (h1.lower().replace(' na tv', ''), total))[:158],
                    'h1': h1, 'lead': '%d produtos com descrição prontos e modelos que funcionam em qualquer TV.' % total,
                    'cartao': '%s · %d produtos' % ('Cardápio' if cardapio else 'Tabela de preços', total), 'corpo': '\n'.join(corpo)})
    return out


# ---------------------------------------------------------------- calendário comercial
def pascoa(y):
    a, b, c = y % 19, y // 100, y % 100
    d, ee = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * ee + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    mes = (h + l - 7 * m + 114) // 31
    dia = (h + l - 7 * m + 114) % 31 + 1
    return datetime.date(y, mes, dia)


def nth(y, mes, wd, n):   # wd: 0 = segunda (Python)
    d = datetime.date(y, mes, 1)
    return d + datetime.timedelta(days=(wd - d.weekday()) % 7 + 7 * (n - 1))


# nome: (ideia de promoção, quem mais aproveita, mensagem para a TV)
IDEIAS = {
    'Confraternização Universal': ('Avise o horário de funcionamento no feriado e faça a última oferta do ano na véspera.', 'Todos', 'Feliz Ano Novo! Que este ano seja de muitas conquistas.'),
    'Carnaval': ('Kits para a folia, horário especial e ofertas de bebida e gelo antes do feriado.', 'Adegas, mercados, farmácias (protetor e hidratação)', 'Bom Carnaval! Aproveite com responsabilidade.'),
    'Dia Internacional da Mulher': ('Homenagem na TV e promoção de beleza e bem-estar; evite desconto em produtos de limpeza.', 'Salões, óticas, lojas, cafeterias', 'Homenagem a todas as mulheres que fazem a diferença.'),
    'Dia do Consumidor': ('Ofertas relâmpago de um dia, cupom para a próxima compra e brinde para os primeiros clientes.', 'Todos os comércios', 'Dia do Consumidor: ofertas especiais só hoje!'),
    'Sexta-feira Santa': ('Peixes e bacalhau em destaque na semana, e horário de funcionamento do feriado.', 'Açougues e peixarias, mercados, restaurantes', 'Feriado de Sexta-feira Santa: confira nosso horário.'),
    'Páscoa': ('Ovos e chocolates, cestas de café da manhã e encomendas com antecedência.', 'Padarias, cafeterias, mercados, lojas de doces', 'Feliz Páscoa! Encomende já o seu.'),
    'Tiradentes': ('Horário do feriado e kit churrasco para o feriadão.', 'Açougues, adegas, mercados', 'Feriado de Tiradentes: aproveite o descanso!'),
    'Dia do Trabalhador': ('Homenagem aos clientes e à equipe; horário do feriado; kit churrasco.', 'Todos', 'Uma homenagem a quem constrói o Brasil todos os dias.'),
    'Dia das Mães': ('A segunda maior data do comércio: presentes, cestas, almoço especial e reserva com antecedência.', 'Lojas, salões, floriculturas, restaurantes, padarias', 'Para quem ama sem medida: feliz Dia das Mães!'),
    'Corpus Christi': ('Horário do feriado prolongado e ofertas para o fim de semana.', 'Mercados, adegas, açougues', 'Ponto facultativo de Corpus Christi: confira nosso horário.'),
    'Dia dos Namorados': ('Jantar a dois, presentes, combos para casal e reserva com antecedência.', 'Restaurantes, pizzarias, lojas, salões, adegas (vinhos)', 'Celebre o amor! Uma lembrança faz toda a diferença.'),
    'Dia de São João': ('Festa junina: canjica, pamonha, quentão, decoração e kits para arraiá.', 'Padarias, mercados, hortifrútis (milho), adegas', 'Arraiá, quentão e muita festa junina!'),
    'Dia dos Avós': ('Homenagem na TV e almoço em família no fim de semana.', 'Restaurantes, padarias, farmácias', 'Um abraço especial para os avós!'),
    'Dia dos Pais': ('Presentes, kit churrasco, almoço especial e combos para o domingo.', 'Lojas, açougues, adegas, barbearias, restaurantes', 'Feliz Dia dos Pais! Obrigado por tudo.'),
    'Dia do Estudante': ('Desconto com carteirinha, combos para estudantes e material escolar.', 'Lanchonetes, açaí, papelarias, cursos', 'Parabéns a todos os estudantes!'),
    'Independência do Brasil': ('Horário do feriado e ofertas verde e amarelo para o feriadão.', 'Mercados, adegas, açougues', 'Feriado da Independência: confira nosso horário.'),
    'Dia do Cliente': ('Agradeça na TV, dê brinde ou desconto para clientes da casa e lance fidelidade.', 'Todos os comércios', 'Obrigado por fazer parte da nossa história!'),
    'Dia das Crianças': ('Brinquedos, doces, combos infantis e brindes; decore a loja.', 'Lojas, lanchonetes, açaí, sorveterias, padarias', 'Feliz Dia das Crianças!'),
    'Dia do Professor': ('Homenagem e desconto para professores.', 'Livrarias, cafeterias, restaurantes', 'Obrigado, professores!'),
    'Halloween': ('Decoração temática, doces e drinks especiais.', 'Lanchonetes, adegas, lojas de doces', 'Doces ou travessuras? O Dia das Bruxas chegou!'),
    'Finados': ('Horário do feriado; flores e velas.', 'Floriculturas, mercados', 'Dia de lembrar com carinho de quem amamos.'),
    'Proclamação da República': ('Horário do feriado e ofertas para o feriadão.', 'Mercados, adegas', 'Feriado da Proclamação da República: confira nosso horário.'),
    'Dia da Consciência Negra': ('Horário do feriado nacional.', 'Todos', 'Dia de reflexão, respeito e igualdade.'),
    'Black Friday': ('A maior data de ofertas do ano: preço de/por real, contagem regressiva na TV e ofertas por tempo limitado.', 'Todos os comércios', 'Black Friday: as maiores ofertas do ano!'),
    'Natal': ('Cestas, panetones, ceia, presentes e encomendas com antecedência; horário especial de fim de ano.', 'Todos os comércios', 'Feliz Natal! Paz, saúde e união para todas as famílias.'),
    'Véspera de Ano Novo': ('Ceia, bebidas, gelo e horário especial do dia 31.', 'Mercados, adegas, padarias, açougues', 'Que venha um novo ano cheio de alegrias!'),
}
SAUDE = ['Dia Mundial da Saúde Bucal', 'Dia Mundial da Atividade Física', 'Dia Mundial da Saúde', 'Dia da Enfermagem', 'Dia Mundial sem Tabaco',
         'Dia Mundial do Doador de Sangue', 'Dia Mundial de Prevenção do Suicídio', 'Dia Mundial do Coração', 'Dia do Médico', 'Dia do Dentista',
         'Dia Mundial do Diabetes', 'Dia Mundial de Luta contra a Aids']
FIXAS = [(1, 1, 'Confraternização Universal', True), (3, 8, 'Dia Internacional da Mulher', False), (3, 15, 'Dia do Consumidor', False),
         (3, 20, 'Dia Mundial da Saúde Bucal', False), (4, 6, 'Dia Mundial da Atividade Física', False), (4, 7, 'Dia Mundial da Saúde', False),
         (4, 21, 'Tiradentes', True), (5, 1, 'Dia do Trabalhador', True), (5, 12, 'Dia da Enfermagem', False), (5, 31, 'Dia Mundial sem Tabaco', False),
         (6, 12, 'Dia dos Namorados', False), (6, 14, 'Dia Mundial do Doador de Sangue', False), (6, 24, 'Dia de São João', False),
         (7, 26, 'Dia dos Avós', False), (8, 11, 'Dia do Estudante', False), (9, 7, 'Independência do Brasil', True),
         (9, 10, 'Dia Mundial de Prevenção do Suicídio', False), (9, 15, 'Dia do Cliente', False), (9, 29, 'Dia Mundial do Coração', False),
         (10, 12, 'Dia das Crianças', True), (10, 15, 'Dia do Professor', False), (10, 18, 'Dia do Médico', False), (10, 25, 'Dia do Dentista', False),
         (10, 31, 'Halloween', False), (11, 2, 'Finados', True), (11, 14, 'Dia Mundial do Diabetes', False), (11, 15, 'Proclamação da República', True),
         (11, 20, 'Dia da Consciência Negra', True), (12, 1, 'Dia Mundial de Luta contra a Aids', False), (12, 25, 'Natal', True), (12, 31, 'Véspera de Ano Novo', False)]
CAMPANHAS = ['Janeiro Branco: saúde mental e emocional', 'Fevereiro Roxo e Laranja: lúpus, Alzheimer, fibromialgia e leucemia', 'Março Lilás: prevenção do câncer do colo do útero',
             'Abril Azul: conscientização sobre o autismo', 'Maio Amarelo: segurança no trânsito', 'Junho Vermelho: doação de sangue',
             'Julho Amarelo: prevenção das hepatites virais', 'Agosto Dourado: aleitamento materno', 'Setembro Amarelo: prevenção do suicídio (CVV 188)',
             'Outubro Rosa: prevenção do câncer de mama', 'Novembro Azul: saúde do homem', 'Dezembro Vermelho: prevenção do HIV/aids']


def datas_do_ano(y):
    out = [(datetime.date(y, m, d), n, f) for m, d, n, f in FIXAS]
    p = pascoa(y)
    out += [(p - datetime.timedelta(days=47), 'Carnaval', False), (p - datetime.timedelta(days=2), 'Sexta-feira Santa', True), (p, 'Páscoa', False),
            (p + datetime.timedelta(days=60), 'Corpus Christi', False), (nth(y, 5, 6, 2), 'Dia das Mães', False), (nth(y, 8, 6, 2), 'Dia dos Pais', False),
            (nth(y, 11, 3, 4) + datetime.timedelta(days=1), 'Black Friday', False)]
    return sorted(out)


def paginas_calendario(hoje=None):
    hoje = hoje or datetime.date.today()
    todas = datas_do_ano(hoje.year) + datas_do_ano(hoje.year + 1)
    out = []
    for k in range(12):   # os próximos 12 meses, a partir do mês atual
        ano = hoje.year + (hoje.month - 1 + k) // 12
        mes = (hoje.month - 1 + k) % 12 + 1
        doMes = [x for x in todas if x[0].year == ano and x[0].month == mes]
        nome = MESES[mes - 1]
        corpo = ['<p>As datas de %s de %d que movimentam o comércio, com uma ideia de promoção para cada uma, quem mais aproveita e uma mensagem pronta para a TV ou a mídia indoor do seu estabelecimento.</p>' % (nome, ano)]
        corpo.append('<p><b>Campanha de saúde do mês:</b> %s. Ótimo tema para a TV de clínicas, farmácias e academias.</p>' % e(CAMPANHAS[mes - 1]))
        comerciais = [x for x in doMes if x[1] not in SAUDE]
        saude = [x for x in doMes if x[1] in SAUDE]
        if comerciais:
            corpo.append('<h2>Datas comerciais de %s</h2>' % nome)
            for d, n, feriado in comerciais:
                ideia, quem, msg = IDEIAS.get(n, ('', '', ''))
                corpo.append('<h3>%d de %s · %s%s</h3>' % (d.day, nome, e(n), ' (feriado nacional)' if feriado else ''))
                corpo.append('<ul><li><b>Dia da semana:</b> %s</li>%s%s%s</ul>' % (
                    SEMANA[d.weekday()], ('<li><b>Ideia de promoção:</b> %s</li>' % e(ideia)) if ideia else '',
                    ('<li><b>Quem mais aproveita:</b> %s</li>' % e(quem)) if quem else '',
                    ('<li><b>Mensagem para a TV:</b> “%s”</li>' % e(msg)) if msg else ''))
        if saude:
            corpo.append('<h2>Datas de saúde de %s</h2>' % nome)
            corpo.append('<ul>%s</ul>' % ''.join('<li><b>%d de %s:</b> %s</li>' % (d.day, nome, e(n)) for d, n, f in saude))
        if not doMes:
            corpo.append('<p>Não há datas nacionais fixas neste mês: aproveite para campanhas próprias (aniversário da loja, semana da oferta) e para a campanha de saúde do mês.</p>')
        corpo.append('<h2>Como usar o calendário na sua TV</h2>')
        corpo.append('<ul><li><b>Comece a anunciar 7 a 15 dias antes</b> das datas grandes (Mães, Pais, Namorados, Natal).</li>'
                     '<li><b>Avise o horário dos feriados</b> com uma semana de antecedência.</li>'
                     '<li><b>Use contagem regressiva</b> na semana da data: cria urgência.</li>'
                     '<li><b>Deixe a TV lembrar sozinha:</b> a tela de datas comemorativas do rsscreen mostra as próximas datas automaticamente.</li></ul>')
        corpo.append(tv('modulo=datas&assunto=comercio&layout=proximas', 'Datas comemorativas ao vivo'))
        corpo.append(cta('Olá! Vi o calendário comercial e quero as datas e os anúncios na TV do meu comércio.', 'Quero isso na minha TV'))
        out.append({'slug': 'calendario-comercial/' + slugify(nome), 'tipo': 'colecao', 'pai': ('Calendário comercial', 'calendario-comercial'), 'ordem': 300 + k,
                    'icone': 'clock', 'mes': (ano, mes),
                    'titulo': ('Datas comemorativas de %s de %d para o comércio' % (nome, ano))[:68],
                    'descricao': ('Calendário comercial de %s de %d: %s. Ideias de promoção e mensagens prontas para a TV.' % (
                        nome, ano, ', '.join(x[1] for x in comerciais[:4]) or 'campanhas do mês'))[:158],
                    'h1': 'Datas comemorativas de %s de %d' % (nome, ano),
                    'lead': 'Calendário comercial com ideias de promoção e mensagens prontas para a TV e a mídia indoor.',
                    'cartao': '%d datas comerciais' % len(comerciais) if comerciais else 'Campanha do mês',
                    'corpo': '\n'.join(corpo)})
    return out


# ---------------------------------------------------------------- índices
def card(x, up):
    return ('<a class="card-link" href="%s%s/"><i data-icon="%s"></i><b>%s</b><span>%s</span><em>Ver <i data-icon="arrow"></i></em></a>'
            % (up, x['slug'], x.get('icone', 'sparkles'), e(x['h1']), e(x.get('cartao', ''))))


def indices(anuncios, tabelas, calendario):
    up = '../'
    modelos = {'slug': 'modelos', 'tipo': 'hub', 'ordem': 90, 'icone': 'tag',
               'titulo': 'Modelos prontos para TV e mídia indoor (grátis)',
               'descricao': 'Modelos de anúncio por tipo de comércio e tabelas de preços e cardápios prontos para TV, funcionando ao vivo. Escolha, troque o texto e use.',
               'h1': 'Modelos prontos para TV e mídia indoor', 'lead': 'Anúncios, tabelas de preços e cardápios funcionando ao vivo. Escolha o seu tipo de comércio.',
               'cartao': 'Anúncios, tabelas e cardápios',
               'corpo': '<h2>Tabelas de preços e cardápios</h2><div class="cards">%s</div><h2>Modelos de anúncio por tipo de comércio</h2><div class="cards">%s</div>' % (
                   ''.join(card(x, up) for x in tabelas), ''.join(card(x, up) for x in anuncios))}
    cal = {'slug': 'calendario-comercial', 'tipo': 'hub', 'ordem': 91, 'icone': 'clock',
           'titulo': 'Calendário comercial: datas comemorativas mês a mês',
           'descricao': 'Datas comemorativas dos próximos 12 meses para o comércio, com ideias de promoção e mensagens prontas para a TV e a mídia indoor.',
           'h1': 'Calendário comercial mês a mês', 'lead': 'As datas que vendem nos próximos 12 meses, com ideia de promoção e mensagem para a TV.',
           'cartao': 'Próximos 12 meses',
           'corpo': '<div class="cards">%s</div>' % ''.join(card(x, up) for x in calendario)}
    return [modelos, cal]


# ---------------------------------------------------------------- soluções (uma por necessidade real)
# Cada página responde a uma pesquisa concreta ("como colocar X na TV"), com a tela funcionando,
# os dados reais do módulo (modelos, assuntos, fontes) e perguntas frequentes.
SOLUCOES = [
    {'slug': 'noticias-na-tv', 'mod': 'rss', 'plano': 'Notícias e Completo',
     'h1': 'Notícias na TV do comércio, atualizadas sozinhas',
     'titulo': 'Como colocar notícias na TV do comércio (atualiza sozinho)',
     'descricao': 'Notícias de mais de 90 sites brasileiros na TV do seu comércio ou mídia indoor, separadas por assunto e atualizadas a cada 15 minutos. Veja funcionando.',
     'intro': 'Notícia é o conteúdo que mais segura o olhar numa tela pública: muda o tempo todo, interessa a qualquer pessoa e faz o cliente olhar de novo. O rsscreen busca as manchetes nos sites de notícias, escolhe as mais recentes do assunto e monta a tela com foto, título, fonte e há quanto tempo foi publicada.',
     'como': ['Escolha o assunto (últimas, esportes, economia, saúde, entretenimento…) e o modelo de tela.', 'Copie o link gerado e abra no navegador da TV, na TV Box ou no sistema de mídia indoor que você já usa.', 'Pronto: a tela busca notícias novas sozinha a cada 15 minutos, 24 horas por dia.'],
     'faq': [('Preciso atualizar alguma coisa?', 'Não. As notícias são buscadas automaticamente nos sites de origem, a cada 15 minutos.'),
             ('De onde vêm as notícias?', 'De mais de 90 sites brasileiros de notícias, com o nome da fonte sempre na tela. Você pode deixar todas as fontes misturadas ou escolher um site específico.'),
             ('Posso mostrar só esportes ou só economia?', 'Sim. Cada link é de um assunto; dá para ter um link por assunto ou juntar vários num link único.'),
             ('E se a internet cair?', 'A tela continua mostrando as últimas notícias carregadas e volta a atualizar sozinha quando a internet volta.')]},
    {'slug': 'previsao-do-tempo-na-tv', 'mod': 'clima', 'plano': 'Notícias e Completo',
     'h1': 'Previsão do tempo na TV, de qualquer cidade do Brasil',
     'titulo': 'Previsão do tempo na TV do comércio: qualquer cidade do Brasil',
     'descricao': 'Temperatura agora, próximas horas e previsão da semana de qualquer cidade do Brasil na TV ou mídia indoor, atualizada a cada 15 minutos. Veja funcionando.',
     'intro': 'Previsão do tempo é útil para todo mundo e funciona em qualquer ponto: recepção, padaria, academia, hotel, loja de praia. A tela mostra a temperatura atual, a sensação térmica, umidade, vento e a previsão dos próximos dias, com ícones que se leem de longe.',
     'como': ['Escolha a cidade (qualquer cidade do Brasil, pela busca do painel) e o modelo.', 'Abra o link na TV, TV Box ou sistema de mídia indoor.', 'A previsão se atualiza sozinha a cada 15 minutos.'],
     'faq': [('Funciona para cidades pequenas?', 'Sim. A busca encontra qualquer município do Brasil; a previsão usa as coordenadas da cidade.'),
             ('De onde vêm os dados do tempo?', 'Do Open-Meteo, serviço aberto de previsão que reúne modelos meteorológicos nacionais e internacionais.'),
             ('Dá para mostrar a semana inteira?', 'Sim: há modelos de tela para agora + próximos dias, semana completa e próximas horas.')]},
    {'slug': 'resultados-de-loterias-na-tv', 'mod': 'loterias', 'plano': 'Completo',
     'h1': 'Resultados das loterias na TV, logo depois do sorteio',
     'titulo': 'Como exibir resultados da Mega-Sena e loterias na TV',
     'descricao': 'Resultados da Mega-Sena, Lotofácil, Quina e demais loterias da Caixa na TV, atualizados logo após o sorteio, com prêmio acumulado e ganhadores. Veja funcionando.',
     'intro': 'Em lotérica, bar, padaria e banca, o resultado da loteria é o conteúdo que o cliente procura. A tela mostra os números sorteados, o valor do próximo prêmio, se acumulou, a quantidade de ganhadores e estatísticas como números quentes e atrasados.',
     'como': ['Escolha as loterias (as principais ou uma específica, como a Mega-Sena) e o modelo.', 'Abra o link na TV ou no sistema de mídia indoor.', 'O resultado entra sozinho logo depois de cada sorteio.'],
     'faq': [('Quais loterias aparecem?', 'Mega-Sena, Lotofácil, Quina, +Milionária, Lotomania, Dupla Sena, Timemania, Dia de Sorte, Super Sete, Loteria Federal e Loteca.'),
             ('Quando o resultado atualiza?', 'O sistema confere os resultados nos horários de sorteio da Caixa e atualiza a tela assim que o resultado oficial sai.'),
             ('Mostra o prêmio acumulado?', 'Sim: há modelos com o resultado, o próximo prêmio estimado e a premiação com o número de ganhadores.')]},
    {'slug': 'cotacoes-na-tv', 'mod': 'cotacoes', 'extra': 'agro', 'plano': 'Notícias e Completo',
     'h1': 'Cotações na TV: dólar, euro, bitcoin e agronegócio',
     'titulo': 'Cotação do dólar e do agro na TV (atualiza sozinho)',
     'descricao': 'Dólar, euro, libra, bitcoin e cotações do agronegócio (boi, soja, milho, café) na TV ou mídia indoor, atualizadas automaticamente. Veja funcionando.',
     'intro': 'Cotações funcionam bem em casas de câmbio, agências, escritórios, cooperativas e comércios do interior. Há duas telas: moedas e criptomoedas, e o painel do agronegócio com os indicadores do CEPEA (boi gordo, bezerro, soja, milho, café, açúcar e outros).',
     'como': ['Escolha as moedas ou os produtos do agro e o modelo de tela.', 'Abra o link na TV ou no sistema de mídia indoor.', 'As cotações se atualizam sozinhas ao longo do dia.'],
     'faq': [('Quais moedas aparecem?', 'Dólar, euro, libra e outras moedas estrangeiras, além de bitcoin e outras criptomoedas.'),
             ('De onde vêm as cotações do agro?', 'Dos indicadores do CEPEA/Esalq-USP, referência de preços do agronegócio no Brasil.'),
             ('Serve para cooperativa e loja agropecuária?', 'Sim: o painel do agro mostra pecuária, grãos, café, açúcar, etanol e laranja.')]},
    {'slug': 'futebol-na-tv', 'mod': 'futebol', 'plano': 'Completo',
     'h1': 'Futebol na TV: placares, próximos jogos e tabela',
     'titulo': 'Placar e tabela do Brasileirão na TV do comércio',
     'descricao': 'Resultados ao vivo, próximos jogos e tabela do Brasileirão, Copa do Brasil, Libertadores e campeonatos europeus na TV ou mídia indoor. Veja funcionando.',
     'intro': 'Futebol é assunto garantido em bar, barbearia, lanchonete e academia. A tela mostra os jogos da rodada com placar, os próximos jogos com horário e a tabela de classificação do campeonato escolhido.',
     'como': ['Escolha o campeonato e o modelo (placar, agenda, tabela ou um jogo por vez).', 'Abra o link na TV ou no sistema de mídia indoor.', 'Placar, agenda e tabela se atualizam sozinhos.'],
     'faq': [('Quais campeonatos aparecem?', 'Brasileirão Série A e B, Copa do Brasil, Libertadores, Sul-Americana, Champions League, Premier League e La Liga.'),
             ('Mostra o jogo ao vivo?', 'Mostra o placar atualizado dos jogos em andamento; não transmite imagens do jogo.')]},
    {'slug': 'qr-code-wifi-na-tv', 'mod': 'mural', 'plano': 'Completo',
     'h1': 'QR Code do Wi-Fi na TV da recepção',
     'titulo': 'Como mostrar o QR Code do Wi-Fi na TV da recepção',
     'descricao': 'Tela de boas-vindas com QR Code do Wi-Fi: o cliente aponta a câmera e conecta sem digitar a senha. Com horário, redes sociais e mural de aniversariantes.',
     'intro': 'Em clínicas, salões, academias e escritórios, a pergunta mais repetida na recepção é a senha do Wi-Fi. A tela de boas-vindas mostra um QR Code: o cliente aponta a câmera do celular e conecta sem digitar nada. Junto vão a mensagem de boas-vindas, o horário de funcionamento e as redes sociais. Há também o mural de aniversariantes do mês e avisos.',
     'como': ['O próprio estabelecimento preenche o nome da rede e a senha pelo celular, num link de edição sem login.', 'Abra o link da tela na TV da recepção.', 'Mudou a senha? É só editar pelo celular; a TV atualiza sozinha.'],
     'faq': [('O QR Code funciona em qualquer celular?', 'Sim. Câmeras de Android e iPhone leem o QR Code de Wi-Fi e conectam direto.'),
             ('A senha fica exposta?', 'A senha aparece escrita abaixo do QR Code para quem preferir digitar; é a mesma que seria dita na recepção.')]},
]


def paginas_solucoes():
    out = []
    for i, s in enumerate(SOLUCOES):
        mods = [s['mod']] + ([s['extra']] if s.get('extra') else [])
        corpo = ['<p>%s</p>' % e(s['intro'])]
        corpo.append('<h2>Veja funcionando</h2><p>As telas abaixo estão rodando agora, com dados reais, do jeito que aparecem na TV.</p>')
        for mid in mods:
            m = jload('modules', mid, 'manifest.json')
            p = m.get('padrao', {})
            for l in m['layouts']:
                corpo.append('<h3>%s: %s</h3><p>%s</p>' % (e(m['nome']), e(l['nome']), e(l.get('descricao', ''))))
                corpo.append(tv('modulo=%s&assunto=%s&layout=%s&tema=%s' % (mid, p.get('assunto', ''), l['id'], p.get('tema', '')), m['nome'] + ' · ' + l['nome']))
            assuntos = [a['nome'] for a in m.get('assuntos', []) if a.get('id') != 'exemplo']
            if len(assuntos) > 1 and mid != 'clima':
                corpo.append('<h3>%s: o que dá para escolher</h3><ul>%s</ul>' % (e(m['nome']), ''.join('<li>%s</li>' % e(x) for x in assuntos)))
            if m.get('sites'):
                corpo.append('<p>As notícias vêm de <b>%d sites brasileiros</b>, entre eles %s.</p>' % (len(m['sites']), e(', '.join(x['nome'] for x in m['sites'][:12]))))
        corpo.append('<h2>Como colocar na sua TV</h2><ol>%s</ol>' % ''.join('<li>%s</li>' % e(x) for x in s['como']))
        corpo.append('<h2>O que você precisa</h2><ul><li><b>Uma TV com navegador, uma TV Box ou um sistema de mídia indoor</b> que abra páginas da internet (URL).</li>'
                     '<li><b>Internet no ponto:</b> o consumo é baixo; se cair, a tela continua com o último conteúdo.</li>'
                     '<li><b>Nada para instalar:</b> é um link que abre em tela cheia.</li></ul>')
        corpo.append('<p><b>Em qual plano:</b> %s. Também dá para juntar esta tela com outras (notícias, clima, anúncios) num <b>link único</b>.</p>' % e(s['plano']))
        corpo.append('<h2>Perguntas frequentes</h2>' + ''.join('<details><summary>%s<i data-icon="chevron"></i></summary><p>%s</p></details>' % (e(q), e(a)) for q, a in s['faq']))
        corpo.append(cta('Olá! Vi a página "%s" e quero isso nas minhas telas.' % s['h1'], 'Quero na minha TV'))
        out.append({'slug': 'solucoes/' + s['slug'], 'tipo': 'colecao', 'pai': ('Soluções', 'solucoes'), 'ordem': 50 + i, 'icone': 'monitor',
                    'titulo': s['titulo'][:68], 'descricao': s['descricao'][:158], 'h1': s['h1'],
                    'lead': 'Funciona em qualquer TV, TV Box ou sistema de mídia indoor. Atualiza sozinho, 24 horas por dia.',
                    'cartao': s['descricao'].split('.')[0][:80], 'corpo': '\n'.join(corpo)})
    return out


def todas():
    a, t, c = paginas_anuncios(), paginas_tabelas(), paginas_calendario()
    sol = paginas_solucoes()
    hub_sol = {'slug': 'solucoes', 'tipo': 'hub', 'ordem': 89, 'icone': 'monitor',
               'titulo': 'O que colocar na TV do comércio: soluções prontas',
               'descricao': 'Notícias, previsão do tempo, loterias, cotações, futebol e QR Code do Wi-Fi na TV do comércio ou mídia indoor, funcionando ao vivo e atualizando sozinhos.',
               'h1': 'Soluções prontas para a TV do comércio', 'lead': 'Escolha o que quer mostrar e veja a tela funcionando ao vivo.',
               'cartao': 'Notícias, clima, loterias, cotações, futebol',
               'corpo': '<div class="cards">%s</div><h2>Também prontos</h2><div class="cards">%s</div>' % (
                   ''.join(card(x, '../') for x in sol),
                   card({'slug': 'modelos', 'h1': 'Tabelas de preços, cardápios e anúncios', 'cartao': 'Modelos prontos por tipo de comércio', 'icone': 'tag'}, '../'))}
    return [hub_sol] + sol + indices(a, t, c) + t + a + c
