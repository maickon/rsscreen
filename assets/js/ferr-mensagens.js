/* rsscreen — mensagens prontas para vender anúncio em TV (textos próprios, montados no navegador) */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  // "da Padaria", "do Açougue": escolhe pela primeira palavra do nome do ponto
  function daDo(nome) {
    const p = String(nome || '').trim().split(/\s+/)[0].toLowerCase();
    const fem = /(a|ã|ade|agem|ção|são)$/.test(p) && !/^(dia|clima|sistema|problema|programa|mapa)$/.test(p);
    return (fem ? 'da ' : 'do ') + nome;
  }
  const art = (nome, a, o) => (daDo(nome).startsWith('da ') ? a : o) + ' ' + nome;
  const esc = RS.esc;

  // [id, nome, "o seu ...", gancho (por que o público do ponto é cliente dele), exemplo de anúncio]
  const SEG = [
    ['acougue', 'Açougue', 'o seu açougue', 'quem compra pão de manhã também decide o churrasco do fim de semana', 'a oferta da picanha da semana com o WhatsApp para encomendas'],
    ['petshop', 'Pet shop', 'o seu pet shop', 'metade das famílias do bairro tem cachorro ou gato em casa', 'o banho e tosa com horário marcado pelo WhatsApp'],
    ['salao', 'Salão de beleza ou barbearia', 'o seu salão', 'as pessoas do bairro cortam o cabelo perto de casa e escolhem pelo que veem', 'o corte com barba e o WhatsApp para agendar'],
    ['academia', 'Academia ou estúdio', 'a sua academia', 'muita gente quer começar a treinar e só falta um empurrãozinho perto de casa', 'a aula experimental grátis da semana'],
    ['imobiliaria', 'Imobiliária ou corretor', 'a sua imobiliária', 'quem mora no bairro sempre conhece alguém querendo comprar, vender ou alugar', 'os imóveis em destaque do mês com QR Code para o WhatsApp'],
    ['autoescola', 'Auto escola', 'a sua auto escola', 'jovens e pais passam por ali todos os dias', 'a condição especial da primeira habilitação'],
    ['farmacia', 'Farmácia', 'a sua farmácia', 'quem passa por ali precisa de remédio, vacina ou aferir a pressão perto de casa', 'a entrega grátis no bairro e as ofertas da semana'],
    ['delivery', 'Restaurante, pizzaria ou delivery', 'o seu delivery', 'quem vê comida gostosa na TV pede no mesmo dia', 'o combo da noite com o WhatsApp de pedidos'],
    ['clinica', 'Dentista, clínica ou estética', 'a sua clínica', 'as pessoas escolhem dentista e estética por confiança e proximidade', 'a avaliação gratuita com agendamento pelo WhatsApp'],
    ['roupas', 'Loja de roupas ou calçados', 'a sua loja', 'quem passa por ali compra presente e roupa nova no comércio do bairro', 'a coleção nova e o Instagram da loja'],
    ['oficina', 'Oficina, autopeças ou lava-jato', 'a sua oficina', 'quase todo cliente que passa por ali tem carro ou moto', 'a revisão com preço fechado e o WhatsApp'],
    ['curso', 'Escola, curso ou idiomas', 'o seu curso', 'pais e jovens do bairro estão sempre buscando curso perto de casa', 'as matrículas abertas com desconto'],
    ['otica', 'Ótica', 'a sua ótica', 'muita gente precisa trocar os óculos e vai deixando para depois', 'o exame de vista e a armação com desconto'],
    ['construcao', 'Material de construção', 'a sua loja', 'sempre tem alguém do bairro reformando ou construindo', 'as ofertas de cimento, tinta e piso da semana'],
    ['outro', 'Outro comércio ou serviço', 'o seu negócio', 'o cliente do bairro compra de quem ele lembra primeiro', 'a sua melhor oferta com o WhatsApp']
  ];

  const ETAPAS = {
    primeiro: (d, s) => [
      'Oi, ' + d.cliente + '! Tudo bem? Aqui é ' + d.nome + '. Eu cuido da TV de anúncios ' + daDo(d.ponto) + ', aqui no ' + d.bairro + '.\n\n' +
      'Pensei em ' + s[2] + ' porque ' + s[3] + '. A TV passa notícias, clima e futebol, então o pessoal olha mesmo, e o anúncio aparece cerca de ' + d.exib + ' vezes por dia.\n\n' +
      'Posso te mostrar como ficaria ' + s[4] + '? Te mando uma prévia sem compromisso.',

      'Bom dia, ' + d.cliente + '! ' + d.nome + ' aqui. Tenho uma TV com anúncios ' + art(d.ponto, 'na', 'no') + ' e ainda tenho espaço para um(a) ' + s[1].toLowerCase() + '.\n\n' +
      'Funciona assim: seu anúncio fica passando o dia todo, no meio de notícias e previsão do tempo, por R$ ' + d.preco + ' por mês. Eu faço a arte.\n\n' +
      'Quer que eu monte um exemplo com ' + s[4] + ' para você ver?'
    ],
    visita: (d, s) => [
      'Oi, ' + d.cliente + '! Obrigado por me receber hoje. Como combinamos, segue o resumo:\n\n' +
      '📺 TV ' + art(d.ponto, 'na', 'no') + ' (' + d.bairro + ')\n🔁 Seu anúncio cerca de ' + d.exib + ' vezes por dia\n💰 R$ ' + d.preco + ' por mês, com a arte inclusa\n\n' +
      'Já deixo a prévia com ' + s[4] + '. Posso reservar o espaço para você começar na segunda?',

      d.cliente + ', foi ótimo conversar! Fiquei pensando: ' + s[3] + ', então a TV ' + daDo(d.ponto) + ' combina muito com ' + s[2] + '.\n\n' +
      'Te mando hoje a proposta com tudo por escrito. Alguma dúvida que eu possa responder antes?'
    ],
    cobrar: (d, s) => [
      'Oi, ' + d.cliente + '! Passando só para saber se conseguiu ver a proposta da TV ' + daDo(d.ponto) + '. Ficou alguma dúvida?\n\n' +
      'O espaço para ' + s[1].toLowerCase() + ' ainda está livre, e eu queria oferecer para você antes de procurar outro do mesmo ramo.',

      d.cliente + ', sei que a rotina é corrida! Para facilitar: posso colocar ' + s[4] + ' no ar por 15 dias para você sentir o retorno, e só depois você decide. Pode ser?'
    ],
    fechar: (d, s) => [
      'Fechado, ' + d.cliente + '! 🙌 Bem-vindo à TV ' + daDo(d.ponto) + '.\n\n' +
      'Para eu montar a arte, me manda:\n1. O logo (ou foto da fachada)\n2. O que você quer anunciar (ex.: ' + s[4] + ')\n3. O WhatsApp e o Instagram que vão aparecer\n\n' +
      'O valor é R$ ' + d.preco + ' por mês, por Pix. Te mando a prévia antes de entrar no ar.',

      'Tudo certo, ' + d.cliente + '! Seu anúncio entra no ar assim que você aprovar a arte. Depois te mando um vídeo da TV passando, para você ver funcionando. Obrigado pela confiança!'
    ],
    renovar: (d, s) => [
      'Oi, ' + d.cliente + '! Fechando o mês: seu anúncio passou cerca de ' + d.exibMes + ' vezes na TV ' + daDo(d.ponto) + '. Segue um vídeo dele no ar 📺\n\n' +
      'Quer renovar para o próximo mês? Se quiser, troco a arte e coloco uma oferta nova.',

      d.cliente + ', que tal fechar 3 meses? Fica R$ ' + d.preco3 + ' por mês (5% de desconto) e eu troco a arte todo mês, sem custo. Assim ' + s[2] + ' não sai da cabeça do pessoal do bairro.'
    ],
    indicacao: (d) => [
      'Oi, ' + d.cliente + '! Obrigado por anunciar com a gente. Uma pergunta rápida: você conhece algum comerciante amigo que também gostaria de aparecer na TV ' + daDo(d.ponto) + '?\n\n' +
      'Se ele fechar, você ganha um mês de anúncio com 50% de desconto. 😉',

      d.cliente + ', estou abrindo uma TV nova em outro ponto do ' + d.bairro + '. Conhece algum lugar com bastante movimento (padaria, clínica, salão) que eu possa visitar? Se der certo, seu anúncio vai para lá também, sem custo no primeiro mês.'
    ],
    ponto: (d) => [
      'Oi, ' + d.cliente + '! Aqui é ' + d.nome + '. Eu instalo TVs com conteúdo em comércios do ' + d.bairro + ': notícias, previsão do tempo, futebol e anúncios de empresas da região.\n\n' +
      'Para ' + art(d.ponto, 'a', 'o') + ' não tem custo nenhum: eu cuido da TV e de tudo que passa nela, e o seu próprio anúncio entra de graça. Seus clientes esperam se distraindo.\n\n' +
      'Posso passar aí amanhã para te mostrar funcionando?',

      d.cliente + ', ' + art(d.ponto, 'A', 'O') + ' tem um movimento ótimo. Que tal uma TV que mostra suas promoções, a hora certa e as notícias do dia, sem você pagar nada e sem mexer em nada?\n\n' +
      'Eu cuido da instalação e da programação. Te mostro um exemplo no celular em 2 minutos?'
    ]
  };

  $('mSeg').innerHTML = SEG.map(s => '<option value="' + s[0] + '">' + esc(s[1]) + '</option>').join('');

  const campos = ['mEtapa', 'mSeg', 'mNome', 'mCliente', 'mPonto', 'mBairro', 'mPreco', 'mExib'];
  try { const sv = JSON.parse(localStorage.getItem('rs_msg_v1') || '{}'); campos.forEach(id => { if (sv[id]) $(id).value = sv[id]; }); } catch (_) {}

  let atuais = [];
  function render() {
    const o = {}; campos.forEach(id => { o[id] = $(id).value; });
    try { localStorage.setItem('rs_msg_v1', JSON.stringify(o)); } catch (_) {}
    const etapa = $('mEtapa').value;
    $('mSegWrap').hidden = etapa === 'indicacao' || etapa === 'ponto';
    const preco = Number(String($('mPreco').value).replace(',', '.')) || 0;
    const brl = x => x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const exib = Number($('mExib').value) || 150;
    const d = {
      nome: $('mNome').value.trim() || '[seu nome]', cliente: $('mCliente').value.trim() || '[nome]',
      ponto: $('mPonto').value.trim() || '[ponto]', bairro: $('mBairro').value.trim() || '[bairro]',
      preco: brl(preco), preco3: brl(preco * 0.95),
      exib: exib.toLocaleString('pt-BR'), exibMes: (exib * 26).toLocaleString('pt-BR')
    };
    const s = SEG.find(x => x[0] === $('mSeg').value) || SEG[SEG.length - 1];
    atuais = ETAPAS[etapa](d, s);
    $('mLista').innerHTML = atuais.map((t, i) =>
      '<div class="msg-card"><div class="msg-head"><b>Opção ' + (i + 1) + '</b></div>' +
      '<div class="msg-bubble">' + esc(t).replace(/\n/g, '<br>') + '</div>' +
      '<div class="tool-actions"><button class="btn btn-dark btn-sm" type="button" data-copy="' + i + '">' + ICON('copy') + ' Copiar</button>' +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(t) + '">' + ICON('whatsapp') + ' Abrir no WhatsApp</a></div></div>').join('') +
      '<div class="box"><h3>Quer uma TV que já vende sozinha?</h3><p style="font-size:15px;color:var(--text-2)">Com o rsscreen, a TV do ponto passa notícias, clima, futebol e os anúncios dos seus clientes, e você manda o link da tela junto com a mensagem.</p>' +
      '<p style="margin-top:12px"><a class="btn btn-primary btn-sm js-wa" data-msg="Olá! Usei as mensagens de abordagem do rsscreen e quero conhecer o sistema." href="#">' + ICON('whatsapp') + ' Conhecer o rsscreen</a></p></div>';
    wireWhatsApp($('mLista'));
  }

  $('msg').addEventListener('input', render);
  $('msg').addEventListener('change', render);
  $('mLista').addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const ok = await RS.copyText(atuais[Number(b.dataset.copy)]);
    b.innerHTML = ICON(ok ? 'check' : 'x') + (ok ? ' Copiado!' : ' Falhou');
    setTimeout(() => { b.innerHTML = ICON('copy') + ' Copiar'; }, 1600);
  });
  render();
})();
