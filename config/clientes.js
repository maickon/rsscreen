/* =====================================================================
   RSSCREEN — ARQUIVO DE CONFIGURAÇÃO
   ---------------------------------------------------------------------
   Este é o ÚNICO arquivo que você precisa editar no dia a dia.

   ➜ Para cadastrar um cliente novo: adicione uma linha em "clientes"
     com o nome dele, salve e suba no Git. O Cloudflare Pages publica
     sozinho e a chave única do cliente é gerada automaticamente a
     partir do nome (veja a chave no Painel > Clientes).

   ➜ Para bloquear um cliente: coloque  ativo: false  na linha dele.
     Todas as telas dele param na hora (após o deploy).

   ⚠ Se você trocar o "segredo", TODAS as chaves (inclusive a sua de
     administrador) mudam. Faça isso só se precisar invalidar tudo.
   ===================================================================== */

window.RSSCREEN_CONFIG = {

  // Administrador do sistema. A chave de acesso ao painel é gerada a
  // partir deste nome (nome codificado + segredo).
  admin: {
    nome: 'Maickon'
  },

  // Segredo usado para codificar as chaves. Mude para algo só seu.
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
  // CLIENTES — só o nome é obrigatório.
  // Campos opcionais: whatsapp (para enviar os links direto), ativo
  // ------------------------------------------------------------------
  clientes: [
    { nome: 'Demonstração', demo: true },          // usado na landing page (exibe selo "demonstração")
    { nome: 'Padaria Pão Dourado', whatsapp: '' },
    { nome: 'Academia Força Total', whatsapp: '' },
    { nome: 'Clínica Sorriso Lagos', whatsapp: '' }
  ]
};
