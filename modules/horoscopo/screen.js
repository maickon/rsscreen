/* Módulo Horóscopo do Dia — texto próprio do rsscreen (entretenimento), escolhido por data + signo:
   muda todo dia e é igual em todas as telas. Funciona sem internet. Layouts: signo, grade */
(function () {
  'use strict';
  const S = window.RSScreen;
  const esc = S.esc;

  const SIGNOS = [
    ['aries', 'Áries', '♈', '21/03 a 19/04', 'Fogo'], ['touro', 'Touro', '♉', '20/04 a 20/05', 'Terra'],
    ['gemeos', 'Gêmeos', '♊', '21/05 a 20/06', 'Ar'], ['cancer', 'Câncer', '♋', '21/06 a 22/07', 'Água'],
    ['leao', 'Leão', '♌', '23/07 a 22/08', 'Fogo'], ['virgem', 'Virgem', '♍', '23/08 a 22/09', 'Terra'],
    ['libra', 'Libra', '♎', '23/09 a 22/10', 'Ar'], ['escorpiao', 'Escorpião', '♏', '23/10 a 21/11', 'Água'],
    ['sagitario', 'Sagitário', '♐', '22/11 a 21/12', 'Fogo'], ['capricornio', 'Capricórnio', '♑', '22/12 a 19/01', 'Terra'],
    ['aquario', 'Aquário', '♒', '20/01 a 18/02', 'Ar'], ['peixes', 'Peixes', '♓', '19/02 a 20/03', 'Água']
  ];

  const T = {
    curta: [
      'Dia bom para tirar planos do papel.', 'Confie mais na sua intuição hoje.', 'Uma conversa franca resolve pendências.',
      'Boas notícias podem chegar à tarde.', 'Organize a rotina e ganhe tempo.', 'Momento de cuidar mais de você.',
      'Paciência traz bons resultados hoje.', 'Abra espaço para novas amizades.', 'Sua criatividade está em alta.',
      'Evite decisões apressadas com dinheiro.', 'Um gesto de carinho faz diferença.', 'Energia ótima para começar algo novo.',
      'Ouça mais do que fala hoje.', 'Dia favorável para estudos e cursos.', 'Reconheça suas pequenas vitórias.',
      'Bom momento para resolver pendências.', 'Deixe o passado onde ele está.', 'A gentileza abre portas hoje.',
      'Cuide do corpo e da mente.', 'Uma surpresa agradável no caminho.', 'Foco: termine o que começou.',
      'Valorize quem está ao seu lado.', 'Bom dia para negociar e conversar.', 'Descanso também é produtividade.'
    ],
    geral: [
      'O dia pede foco e calma. Ao organizar as prioridades logo cedo, você ganha tempo para o que realmente importa.',
      'A energia está favorável para recomeços. Aquele projeto parado pode ganhar força se você der o primeiro passo.',
      'Sua intuição está afiada. Preste atenção aos sinais e às conversas: uma boa ideia pode surgir de onde menos espera.',
      'É um bom momento para fortalecer laços. Uma mensagem simples pode reaproximar alguém querido.',
      'Evite se sobrecarregar. Dividir tarefas e pedir ajuda mostra maturidade e deixa o dia mais leve.',
      'Novas oportunidades aparecem para quem está atento. Mantenha a mente aberta e o bom humor.',
      'O dia favorece a comunicação. Expresse o que sente com clareza e gentileza.',
      'Momento de colher os frutos do esforço recente. Reconheça o quanto você já avançou.',
      'Pequenas mudanças na rotina trazem grande bem-estar. Experimente algo diferente hoje.',
      'A paciência será sua aliada. Nem tudo acontece no seu tempo, mas tudo acontece no tempo certo.',
      'Boa fase para aprender. Leituras, cursos e conversas inspiradoras ampliam seus horizontes.',
      'Confie na sua capacidade de resolver problemas. Você tem mais recursos do que imagina.',
      'O astral pede leveza. Reserve um tempo para algo que traga alegria e descanso.',
      'Dia de colocar a casa em ordem, por dentro e por fora. Organização traz clareza.',
      'Sua criatividade está em destaque. Use isso a seu favor no trabalho e nos relacionamentos.',
      'Generosidade volta em dobro. Um gesto de ajuda hoje pode abrir portas amanhã.'
    ],
    amor: [
      'Clima de carinho e cumplicidade. Demonstre o que sente sem medo.', 'Uma conversa sincera aproxima vocês.',
      'Quem está só pode se encantar com alguém de um círculo de amigos.', 'Evite cobranças: o momento pede leveza.',
      'Um programa simples a dois rende boas lembranças.', 'Ciúmes não ajudam. Aposte na confiança.',
      'Surpreenda com um gesto inesperado.', 'Bom dia para resolver mal-entendidos.',
      'O romance ganha força no fim do dia.', 'Valorize as pequenas atenções.',
      'Abra o coração, mas mantenha os pés no chão.', 'Momento de ouvir mais a pessoa amada.',
      'Novas conexões podem surgir em ambientes de trabalho ou estudo.', 'Carinho e paciência deixam a relação mais forte.'
    ],
    trabalho: [
      'Bom dia para apresentar ideias e propostas.', 'Organize a agenda e priorize o que é urgente.',
      'Parcerias estão favorecidas: some forças.', 'Atenção aos detalhes evita retrabalho.',
      'Seu esforço será notado. Continue firme.', 'Evite gastos por impulso; planeje antes de comprar.',
      'Momento favorável para negociar valores.', 'Uma tarefa difícil fica mais fácil em equipe.',
      'Boa fase para estudar e se atualizar.', 'Seja claro nas combinações para evitar ruídos.',
      'Novos contatos podem render oportunidades.', 'Termine pendências antes de começar algo novo.',
      'Confie no seu talento ao tomar decisões.', 'Disciplina hoje, recompensa amanhã.'
    ],
    saude: [
      'Beba bastante água e faça pausas ao longo do dia.', 'Uma caminhada leve renova as energias.',
      'Durma mais cedo: o corpo pede descanso.', 'Capriche nas frutas e verduras.',
      'Respire fundo nos momentos de tensão.', 'Alongue o corpo, especialmente as costas.',
      'Desconecte um pouco das telas à noite.', 'Boa hora para retomar os exercícios.',
      'Cuide da postura no trabalho.', 'Reserve um tempo só para você.',
      'Evite exageros na alimentação hoje.', 'Uma boa risada faz bem para a saúde.',
      'Mantenha a rotina de sono em dia.', 'Escute os sinais do corpo e descanse.'
    ],
    cor: ['Azul', 'Verde', 'Amarelo', 'Laranja', 'Vermelho', 'Rosa', 'Lilás', 'Branco', 'Dourado', 'Prata', 'Turquesa', 'Bege'],
    hex: ['#3b82f6', '#22c55e', '#facc15', '#fb923c', '#ef4444', '#f472b6', '#c084fc', '#f8fafc', '#eab308', '#cbd5e1', '#2dd4bf', '#d6c4a8']
  };

  function h(str) { let x = 2166136261; for (let i = 0; i < str.length; i++) { x ^= str.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }

  function previsao(sig, dia) {
    const pick = (k, list) => list[h(dia + '|' + sig[0] + '|' + k) % list.length];
    const ci = h(dia + '|' + sig[0] + '|cor') % T.cor.length;
    return {
      id: sig[0], nome: sig[1], simbolo: sig[2], periodo: sig[3], elemento: sig[4],
      curta: pick('curta', T.curta), geral: pick('geral', T.geral), amor: pick('amor', T.amor),
      trabalho: pick('trabalho', T.trabalho), saude: pick('saude', T.saude),
      cor: T.cor[ci], hex: T.hex[ci], numero: 1 + (h(dia + '|' + sig[0] + '|n') % 60)
    };
  }

  async function load(ctx) {
    const d = new Date();
    const dia = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    const id = ctx.assunto ? ctx.assunto.id : 'todos';
    const list = SIGNOS.filter(s => id === 'todos' || s[0] === id).map(s => previsao(s, dia));
    return list.length ? list : SIGNOS.map(s => previsao(s, dia));
  }

  function hoje() { const d = new Date(); return S.WEEKDAYS[d.getDay()] + ', ' + d.getDate() + ' de ' + S.MONTHS[d.getMonth()]; }

  const L = {
    signo(p) {
      return '<div class="hs-bg"></div>' +
        '<div class="hs-head"><div class="hs-kicker">Horóscopo do dia · ' + esc(hoje()) + '</div><div class="hs-clock">' + S.clockHtml() + '</div></div>' +
        '<div class="hs-main">' +
          '<div class="hs-sign rise"><div class="hs-glyph">' + p.simbolo + '︎</div><div class="hs-name">' + esc(p.nome) + '</div><div class="hs-per">' + esc(p.periodo) + ' · ' + esc(p.elemento) + '</div></div>' +
          '<div class="hs-body">' +
            '<p class="hs-geral rise d1">' + esc(p.geral) + '</p>' +
            '<div class="hs-areas rise d2">' +
              '<div><b>Amor</b><span>' + esc(p.amor) + '</span></div>' +
              '<div><b>Trabalho</b><span>' + esc(p.trabalho) + '</span></div>' +
              '<div><b>Saúde</b><span>' + esc(p.saude) + '</span></div>' +
            '</div>' +
            '<div class="hs-lucky rise d3"><span><i style="background:' + p.hex + '"></i>Cor: <b>' + esc(p.cor) + '</b></span><span>Número da sorte: <b>' + p.numero + '</b></span></div>' +
          '</div>' +
        '</div>';
    },
    grade(all) {
      return '<div class="hs-bg"></div>' +
        '<div class="hs-head"><div class="hs-kicker">Horóscopo do dia · ' + esc(hoje()) + '</div><div class="hs-clock">' + S.clockHtml() + '</div></div>' +
        '<div class="hs-grid">' + all.map((p, k) =>
          '<div class="hs-cell rise d' + Math.min(3, Math.floor(k / 4)) + '"><div class="hs-cg">' + p.simbolo + '︎</div><div><b>' + esc(p.nome) + '</b><span>' + esc(p.curta) + '</span></div></div>').join('') +
        '</div>';
    }
  };

  S.register('horoscopo', {
    refreshMinutes: 30,
    load,
    slides(data, ctx) { return ctx.layout === 'grade' && data.length > 1 ? [data] : data; },
    render(s, i, all, ctx) { return Array.isArray(s) ? L.grade(s) : L.signo(s); }
  });
})();
