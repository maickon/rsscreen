# Ideias para a próxima etapa: pacotes por segmento e novos tipos de tela

Documento de planejamento, sem nada implementado ainda. Os pacotes atuais estão em `modules/pacotes.json`
(padaria, clínica, academia, salão, agro, supermercado, escritório, hotel, auto, escola, restaurante,
religiosa). Este documento lista o que vale criar depois, em ordem de prioridade.

---

## 1. Novos tipos de tela (módulos)

Cada item vira uma pasta em `modules/<id>/`, igual a `clima` e `cotacoes`. A coluna **Fonte** indica de
onde vêm os dados. Prioridade: as fontes gratuitas, sem chave e que funcionam direto no navegador.

| Prioridade | Módulo | O que mostra | Fonte dos dados | Por que vende |
|---|---|---|---|---|
| ★★★ | **Hora certa / relógio grande** | Relógio, data, contagem regressiva (Natal, Black Friday, inauguração) | Relógio do aparelho | Serve em qualquer tela e funciona sem internet |
| ★★★ | **Datas comemorativas** | "Hoje é Dia do Pizzaiolo", feriados, aniversário da cidade | Lista fixa no manifesto (BrasilAPI para feriados) | Gera assunto diário e ganchos de promoção |
| ★★★ | **Frases e dicas** | Frase motivacional, dica de saúde, curiosidade do dia | Lista própria em JSON (curada por segmento) | Conteúdo "leve" entre anúncios; não depende de feed |
| ★★★ | **Avisos do estabelecimento** | Texto e imagem do próprio cliente (horário, Wi-Fi, promoções) | Parâmetros na URL ou JSON por cliente em `config/` | É o mais pedido; transforma a tela em canal do cliente |
| ★★☆ | **Futebol: jogos e tabela** | Próximos jogos, resultados e classificação do Brasileirão | API-Football ou football-data.org (exigem chave), ou o RSS do ge | Bares, barbearias e academias pedem muito |
| ★★☆ | **Trânsito e estradas** | Condição das rodovias e alertas | RSS da PRF / concessionárias | Postos, hotéis e transportadoras |
| ★★☆ | **Horóscopo do dia** | 12 signos rotativos | Lista própria ou RSS de portais | Salões, clínicas de estética, lojas femininas |
| ★★☆ | **Agenda / fila / senha** | "Próximo atendimento", agenda do dia | JSON editável pelo painel (ou Google Sheets publicado) | Clínicas, cartórios, assistências |
| ★★☆ | **Qualidade do ar e UV** | Índice UV, qualidade do ar, alerta de calor | Open-Meteo (já usado no clima, sem chave) | Farmácias, clínicas e academias ao ar livre |
| ★☆☆ | **Marés e surf** | Tábua de marés, ondas e vento | Open-Meteo Marine (sem chave) | Litoral: quiosques, pousadas, lojas de surf (Cabo Frio!) |
| ★☆☆ | **Combustíveis** | Preço médio de gasolina, etanol e diesel | ANP (dados abertos, atualização semanal) | Postos, oficinas, autopeças |
| ★☆☆ | **Instagram / vitrine** | Últimos posts do próprio cliente | API do Instagram (exige app e token) | Reaproveita conteúdo que o cliente já produz |
| ★☆☆ | **Cardápio digital** | Pratos, preços e destaques do dia | JSON por cliente | Restaurantes, lanchonetes e padarias |

Os módulos já previstos como "em breve" no `registry.json` (loterias, açougue, ofertas) entram na mesma
fila: **ofertas** e **açougue** são variações do módulo "Avisos do estabelecimento" com layout próprio.

---

## 2. Novos pacotes por segmento

Combinação = vários links prontos (módulo + assunto + modelo) que o painel gera de uma vez.

| Segmento | Combinação sugerida |
|---|---|
| **Farmácia e drogaria** | Saúde (RSS) · Clima com UV · Frases de saúde · Avisos (horário de plantão) |
| **Pet shop e veterinária** | Curiosidades · Avisos (banho e tosa) · Clima · *(RSS de pets quando houver fonte ativa)* |
| **Bar e choperia** | Esportes (faixa) · Futebol: jogos e tabela · Entretenimento · Hora certa com contagem para o jogo |
| **Barbearia** | Esportes · Games · Música · Futebol · Avisos (agenda do dia) |
| **Imobiliária** | Economia · Cotações (dólar, juros) · Casa e Decoração · Avisos (imóveis em destaque) |
| **Concessionária e autopeças** | Veículos · Combustíveis · Trânsito · Cotações |
| **Pousada e turismo de praia** | Turismo · Clima da semana · Marés e surf · Gastronomia |
| **Loja de roupas e calçados** | Estilo de Vida · Música · Datas comemorativas (Dia das Mães etc.) · Ofertas |
| **Coworking e escritório de contabilidade** | Negócios · Economia · Cotações · Tecnologia |
| **Escola de idiomas e cursos** | Educação · Mundo · Curiosidades · Frases |
| **Igreja e comunidade** | Fé · Avisos (programação) · Datas religiosas · Clima |
| **Condomínio (elevador e portaria)** | Últimas notícias · Clima · Avisos do síndico · Hora certa |
| **Clínica de estética** | Estilo de Vida · Horóscopo · Fitness · Avisos (promoções) |
| **Loja de games e informática** | Games · Tecnologia · Música |

---

## 3. Ideias de produto ao redor dos pacotes

- **Playlist por link:** um único link que alterna módulos (2 min de notícias, 30 s de clima, 30 s de
  avisos). O cliente cadastra uma URL só no player dele, e é o que mais facilita a venda.
- **Faixa inferior (ticker) sobreposta:** uma versão "transparente" das telas para usar por cima do vídeo
  do cliente nos sistemas que aceitam camadas.
- **Marca do cliente na tela:** logo e cor do cliente no canto (sem a marca rsscreen), cobrado como adicional.
- **Relatório mensal automático:** usar o Monitoramento para gerar um PDF de "sua tela ficou ligada X horas
  e exibiu Y notícias", um argumento de renovação.
- **Planos por quantidade de telas:** o Monitoramento já conta os aparelhos por cliente, base para cobrar
  por tela ativa.

---

## 4. Ordem sugerida de execução

1. Avisos do estabelecimento + Hora certa + Datas comemorativas (sem dependências externas).
2. Playlist por link (multiplica o valor de tudo que já existe).
3. Pacotes novos da seção 2 que só usam módulos existentes.
4. Futebol, Marés, UV e Combustíveis.
5. Marca do cliente e relatório mensal.
