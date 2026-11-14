/* Módulo Frases e Mensagens — textos próprios (ditados são de domínio público). Funciona sem internet.
   Layouts: citacao, cartao */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  const FRASES = {
    motivacao: [
      'Comece onde você está, com o que você tem.',
      'Pequenos passos todos os dias levam a grandes resultados.',
      'Disciplina é lembrar do que você quer.',
      'O progresso de hoje é a conquista de amanhã.',
      'Você não precisa ser perfeito para começar. Precisa começar.',
      'Cada dia é uma nova chance de fazer melhor.',
      'Foco no processo. O resultado vem.',
      'Quem persiste chega mais longe do que quem corre.',
      'Seu único concorrente é quem você foi ontem.',
      'Grandes conquistas começam com uma decisão.',
      'Acredite no seu esforço. Ele está construindo algo.',
      'Desistir não está no plano.',
      'Faça hoje o que o seu eu do futuro vai agradecer.',
      'O cansaço passa. O orgulho de ter feito fica.',
      'Constância vale mais do que intensidade.',
      'Sonhe grande e trabalhe todos os dias por isso.',
      'Não espere a motivação. Crie o hábito.',
      'Um treino de cada vez, um dia de cada vez.',
      'Você é mais forte do que imagina.',
      'Erros também ensinam o caminho.',
      'O começo é sempre a parte mais difícil. Você já passou por ela.',
      'Coragem é seguir em frente mesmo com medo.',
      'Transforme o "um dia" em "dia um".',
      'Quem planta esforço colhe resultado.',
      'Seja a energia que você quer atrair.',
      'Hoje é um ótimo dia para fazer acontecer.',
      'Celebre cada pequena vitória.',
      'O impossível é só o que ainda não foi tentado.',
      'Mais um passo. Sempre mais um passo.',
      'Sua dedicação de hoje é o seu resultado de amanhã.'
    ],
    reflexao: [
      'A gentileza é uma linguagem que todo mundo entende.',
      'Gratidão transforma o que temos em suficiente.',
      'Ouvir com atenção é uma forma de cuidar.',
      'Nem todo dia é bom, mas há algo de bom em todo dia.',
      'A paciência também é uma forma de força.',
      'Quem semeia respeito colhe amizade.',
      'O tempo é o presente mais valioso que podemos dar.',
      'Sorria: alguém pode estar precisando disso hoje.',
      'Uma palavra gentil pode mudar o dia de alguém.',
      'A simplicidade é o último grau da sofisticação.',
      'Cuide de quem cuida de você.',
      'Tudo tem o seu tempo. Respeite o seu.',
      'Faça o bem sem olhar a quem.',
      'Felicidade é feita de pequenos momentos.',
      'Um abraço sincero vale mais que mil palavras.',
      'Viva o presente: é nele que a vida acontece.',
      'Aprender é uma viagem que nunca termina.',
      'A calma também resolve.',
      'Seja leve. A vida já pesa o suficiente.',
      'Bons momentos são feitos com boas pessoas.',
      'Às vezes, recomeçar é o passo mais corajoso.',
      'Quem tem amigos tem um tesouro.',
      'O que vale é a intenção e a atitude.',
      'Ninguém é tão sábio que não tenha algo a aprender.',
      'A vida fica mais bonita quando a gente divide.',
      'Respire fundo. Vai dar tudo certo.',
      'Valorize quem está ao seu lado hoje.',
      'Uma boa conversa vale o dia.',
      'A educação abre portas que a força não abre.',
      'Plante flores no caminho de alguém.'
    ],
    proverbios: [
      'Água mole em pedra dura, tanto bate até que fura.',
      'Devagar se vai ao longe.',
      'Quem não arrisca não petisca.',
      'De grão em grão, a galinha enche o papo.',
      'A pressa é inimiga da perfeição.',
      'Mais vale um pássaro na mão do que dois voando.',
      'Quem semeia vento colhe tempestade.',
      'Deus ajuda quem cedo madruga.',
      'Uma andorinha só não faz verão.',
      'Em boca fechada não entra mosquito.',
      'Quem espera sempre alcança.',
      'Cada macaco no seu galho.',
      'A união faz a força.',
      'Pimenta nos olhos dos outros é refresco.',
      'O seguro morreu de velho.',
      'Não deixe para amanhã o que você pode fazer hoje.',
      'Quem tem boca vai a Roma.',
      'Gato escaldado tem medo de água fria.',
      'Antes tarde do que nunca.',
      'Quem ri por último ri melhor.',
      'Diga-me com quem andas e te direi quem és.',
      'Mais vale prevenir do que remediar.',
      'Cão que ladra não morde.',
      'Quem com ferro fere com ferro será ferido.',
      'Saco vazio não para em pé.',
      'Depois da tempestade vem a bonança.',
      'Há males que vêm para bem.',
      'A ocasião faz o ladrão.',
      'Quem conta um conto aumenta um ponto.',
      'O hábito não faz o monge.'
    ],
    saude: [
      'Beba água ao longo do dia, mesmo sem sentir sede.',
      'Caminhar 30 minutos por dia faz bem ao coração.',
      'Durma bem: o descanso também é parte da saúde.',
      'Coma frutas, verduras e legumes todos os dias.',
      'Lave bem as mãos com água e sabão.',
      'Use protetor solar, mesmo em dias nublados.',
      'Mantenha a carteira de vacinação em dia.',
      'Faça pausas e alongue o corpo a cada hora.',
      'Diminua o sal e o açúcar no dia a dia.',
      'Escove os dentes depois das refeições e use fio dental.',
      'Faça seus exames de rotina. Prevenir é cuidar.',
      'Desconecte das telas antes de dormir.',
      'Respire fundo por um minuto: ajuda a acalmar.',
      'Prefira escadas ao elevador sempre que puder.',
      'Converse sobre o que sente. Saúde mental importa.',
      'Mastigue devagar e aproveite a refeição.',
      'Evite a automedicação. Consulte um profissional.',
      'Sol da manhã com moderação ajuda na vitamina D.',
      'Postura correta evita dores nas costas.',
      'Rir faz bem: reduz o estresse e aproxima as pessoas.',
      'Troque o refrigerante por água ou suco natural.',
      'Doe sangue: é rápido, seguro e salva vidas.',
      'Hidrate a pele e beba água no calor.',
      'Atividade física é para todas as idades.',
      'Cuide da alimentação: o corpo agradece.',
      'Pausas curtas ao longo do dia aumentam a disposição.',
      'Mantenha os ambientes arejados e limpos.',
      'Evite ficar muito tempo sentado sem se mexer.',
      'Visite o dentista pelo menos uma vez por ano.',
      'Um dia de cada vez: o cuidado começa hoje.'
    ]
  };
  const ROTULO = { motivacao: 'Motivação', reflexao: 'Reflexão', proverbios: 'Ditado popular', saude: 'Dica de saúde' };

  // embaralha com uma semente do dia (a ordem muda todo dia, igual em todas as telas)
  function shuffle(list, seed) {
    const a = list.slice();
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  async function load(ctx) {
    const id = ctx.assunto ? ctx.assunto.id : 'motivacao';
    const tipos = id === 'todas' || !FRASES[id] ? Object.keys(FRASES) : [id];
    let list = [];
    tipos.forEach(t => FRASES[t].forEach(f => list.push({ texto: f, tipo: t })));
    const d = new Date();
    return shuffle(list, d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate());
  }

  const L = {
    citacao(f) {
      return '<div class="fr-bg"></div><div class="fr-center">' +
        '<div class="fr-kicker rise">' + esc(ROTULO[f.tipo] || '') + '</div>' +
        '<div class="fr-quote rise d1"><span class="fr-mark">“</span>' + esc(f.texto) + '</div>' +
        '<div class="fr-line rise d2"></div></div>';
    },
    cartao(f) {
      return '<div class="fr-bg"></div><div class="fr-top"><div><div class="fr-week">' + S.clockHtml('weekday') + '</div><div class="fr-date">' + S.clockHtml('short') + '</div></div>' +
        '<div class="fr-clock">' + S.clockHtml() + '</div></div>' +
        '<div class="fr-card rise d1"><div class="fr-kicker">' + esc(ROTULO[f.tipo] || '') + '</div><div class="fr-quote">' + esc(f.texto) + '</div></div>';
    }
  };

  S.register('frases', {
    refreshMinutes: 60,
    load,
    render(f, i, all, ctx) {
      const size = f.texto.length > 70 ? ' long' : f.texto.length < 38 ? ' short' : '';
      return (L[ctx.layout] || L.citacao)(f).replace('class="fr-quote', 'class="fr-quote' + size);
    }
  });
})();
