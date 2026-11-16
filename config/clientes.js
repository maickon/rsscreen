/* =====================================================================
   RSSCREEN — ARQUIVO DE CONFIGURAÇÃO
   ---------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar no dia a dia.

   ➜ Clientes: cadastre, edite e suspenda pelo Painel > Clientes.
     Eles ficam no banco de dados da Cloudflare, fora deste arquivo
     (que é público). A chave e o link de cada cliente nunca mudam.

   ➜ Para trocar a senha do painel: no Painel > Clientes use "Trocar
     senha", copie a linha gerada e cole no lugar de senhaHash abaixo.

   ⚠ Se você trocar o "segredo", TODAS as chaves dos clientes mudam.
     Faça isso só se precisar invalidar todos os links.
   ===================================================================== */

window.RSSCREEN_CONFIG = {

  // Administrador do sistema. A senha NÃO fica escrita aqui: só uma
  // impressão digital dela (hash), que não permite descobrir a senha.
  admin: {
    nome: 'Maickon',
    senhaHash: '916696717847da87ca7354636f7ec9e4edcd2097d80aed9fc8ce4c4dab1fdcbc'
  },

  // Segredo usado para gerar as chaves dos clientes.
  segredo: 'rsscreen-2026-cabo-frio',

  // WhatsApp comercial (landing page e mensagens). Só números, com DDI.
  whatsapp: '5522981877899',

  // Mensagem padrão enviada ao cliente junto com os links.
  // Variáveis: {cliente} {links} {quantidade}
  mensagemPadrao:
    'Olá, {cliente}! 👋\n\n' +
    'Seus conteúdos de mídia indoor já estão prontos. ' +
    'Basta abrir o link na TV, player ou no seu sistema de mídia indoor:\n\n' +
    '{links}\n\n' +
    'As telas se atualizam sozinhas, 24h por dia. ' +
    'Qualquer dúvida é só chamar por aqui. 🚀',

  // ------------------------------------------------------------------
  // PLANOS — aparecem no cadastro de clientes, na página /planos/ e no Guia do painel.
  // Preço por faixa de telas (pacote mensal, mude à vontade):
  //   faixas: [{ ate: <telas>, valor: <R$ por mês> }]  → o cliente paga a faixa em que cabe
  //   extra:  R$ por tela acima da última faixa (sem extra = "sob consulta")
  //   porTela: preço por tela (planos que não usam faixa)
  // modulos: conteúdos incluídos ('todos' ou a lista de ids). A tela de um conteúdo fora do
  // plano mostra "não incluso no plano". Os ids antigos ficam em 'antigo: true' (só para quem já tem).
  // ------------------------------------------------------------------
  planos: [
    { id: 'noticias', nome: 'Notícias', modulos: ['rss', 'clima', 'cotacoes', 'agro', 'relogio', 'datas', 'frases'],
      faixas: [{ ate: 10, valor: 49 }, { ate: 50, valor: 129 }, { ate: 200, valor: 199 }], extra: 0.9,
      descricao: 'Conteúdo automático: notícias de todos os assuntos, previsão do tempo, cotações, agro, relógio, datas comemorativas e frases.' },
    { id: 'completo', nome: 'Completo', modulos: 'todos',
      faixas: [{ ate: 10, valor: 79 }, { ate: 50, valor: 179 }, { ate: 200, valor: 249 }], extra: 1.2,
      descricao: 'Tudo do Notícias + anúncios dos seus anunciantes, tabelas de preço e cardápios, boas-vindas com Wi-Fi, futebol, loterias, horóscopo e relatórios.' },
    { id: 'gerenciado', nome: 'Tela gerenciada', modulos: 'todos', porTela: 79.90,
      descricao: 'Você monta e cuida da programação do estabelecimento (configuração do player incluída, equipamento à parte).' },
    { id: 'cortesia', nome: 'Cortesia / teste', modulos: 'todos', porTela: 0,
      descricao: 'Sem cobrança: período de teste, permuta ou demonstração.' },
    // planos antigos: continuam valendo para quem já tem, mas não aparecem para clientes novos
    { id: 'essencial', nome: 'Essencial (antigo)', antigo: true, modulos: 'todos', porTela: 19.90, descricao: 'Plano antigo.' },
    { id: 'rede', nome: 'Rede (antigo)', antigo: true, modulos: 'todos', porTela: 14.90, descricao: 'Plano antigo.' }
  ],

  // ------------------------------------------------------------------
  // CLIENTES — ficam no banco de dados (Painel > Clientes), não aqui.
  // Este arquivo é público: NÃO coloque nomes nem telefones de clientes.
  // Só a "Demonstração" fica aqui, porque a página inicial usa as telas dela.
  // ------------------------------------------------------------------
  clientes: [
    { nome: 'Demonstração', demo: true }           // usado na landing page (exibe selo "demonstração")
  ]
};
