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
  // PLANOS — aparecem no cadastro de clientes e no Guia do painel.
  // valor = preço sugerido POR TELA por mês (mude à vontade).
  // ------------------------------------------------------------------
  planos: [
    { id: 'essencial',  nome: 'Essencial',      valor: 19.90, descricao: 'Notícias de todos os assuntos, clima, cotações, relógio, datas comemorativas e frases, em todos os modelos de tela.' },
    { id: 'completo',   nome: 'Completo',       valor: 29.90, descricao: 'Tudo do Essencial + futebol, loterias, horóscopo, tela de anúncios e playlist + os módulos novos assim que lançados, com trocas à vontade.' },
    { id: 'rede',       nome: 'Rede (10+ telas)', valor: 14.90, descricao: 'Plano Completo com preço por tela para operadores com 10 telas ou mais.' },
    { id: 'gerenciado', nome: 'Tela gerenciada', valor: 79.90, descricao: 'Você monta e cuida da programação do estabelecimento (configuração do player incluída, equipamento à parte).' },
    { id: 'cortesia',   nome: 'Cortesia / teste', valor: 0, descricao: 'Sem cobrança: período de teste, permuta ou demonstração.' }
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
