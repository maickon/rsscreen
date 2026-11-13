# rsscreen: mercado, posicionamento e plano de etapas

Novembro de 2026. Substitui a análise anterior baseada em `nova-especificacao.txt`. Aquela especificação
foi descartada por exagerar no escopo (Laravel, MySQL, SaaS completo).

**Foco:** a pessoa simples que abriu um MEI ou quer renda extra com mídia indoor. Ela coloca TVs em
padarias, salões, clínicas e academias e vende anúncios para o comércio do bairro.

> **Aviso sobre os números:** nenhuma fonte pública traz o volume de buscas por termo. As listas abaixo
> são a melhor leitura do mercado (sites dos concorrentes, conteúdos que eles promovem e linguagem do
> público). Antes de escrever as páginas, confirme os volumes no Google Keyword Planner (grátis com
> conta Google Ads) e no Google Trends, região Brasil.

---

## 1. O que esse público procura

### 1.1 A jornada do iniciante
1. **"Como ganhar dinheiro com mídia indoor?"** A pessoa ainda está decidindo.
2. **"Quanto custa? Que TV Box comprar? Precisa de MEI?"** Está planejando.
3. **"Qual sistema/player usar?"** Está escolhendo a ferramenta, e é aqui que ela paga mensalidade.
4. **"Que conteúdo passar na TV?"** Tela só com anúncio não prende atenção. Ela precisa de conteúdo
   que faça as pessoas olharem.
5. **"Como conseguir anunciantes e quanto cobrar?"** Daqui vem a renda dela.

O site que responder às 5 perguntas ganha a confiança. Quem resolve a 3 e a 4 recebe o dinheiro.

### 1.2 Termos de busca para mirar (validar volumes)

| Intenção | Termos |
|---|---|
| **Negócio / renda extra** (topo, maior volume) | como ganhar dinheiro com mídia indoor · mídia indoor renda extra · como montar uma empresa de mídia indoor · mídia indoor vale a pena · mídia indoor MEI · quanto ganha quem trabalha com mídia indoor · como vender anúncio em TV |
| **Player / sistema** (decisão de compra) | sistema de mídia indoor · software mídia indoor · aplicativo mídia indoor · player mídia indoor · mídia indoor grátis · programa para mídia indoor · TV corporativa · digital signage · como passar propaganda na TV do comércio · como controlar várias TVs pela internet |
| **Conteúdo** (o que o rsscreen já entrega) | conteúdo para mídia indoor · notícias para TV indoor · previsão do tempo para TV · conteúdo para TV corporativa · vídeos para mídia indoor · templates mídia indoor · artes para TV indoor |
| **Equipamento** | TV Box para mídia indoor · melhor TV Box para propaganda · mini PC mídia indoor · como colocar propaganda na TV com pen drive |
| **Por segmento** | TV para padaria · TV para salão de beleza · TV para consultório · TV na academia propaganda · mídia indoor farmácia |

### 1.3 Conteúdos que fazem a TV ser olhada
Esta lista é a experiência do mercado, e os concorrentes promovem as mesmas coisas.

| Prioridade | Conteúdo | Situação no rsscreen |
|---|---|---|
| ★★★ | Notícias (gerais, esportes, entretenimento, regionais) | ✅ feito (120 feeds) |
| ★★★ | Previsão do tempo | ✅ feito |
| ★★★ | Relógio e data | ✅ dentro dos layouts (falta tela própria) |
| ★★★ | **Anúncios dos anunciantes** (é a renda do operador) | ❌ falta: é a maior lacuna |
| ★★★ | Loterias | ❌ módulo "em breve" |
| ★★☆ | Futebol (jogos, resultados, tabela) | 🟡 só notícias |
| ★★☆ | Cotações (dólar, euro, bitcoin) | ✅ feito |
| ★★☆ | Datas comemorativas, curiosidades, frases | 🟡 curiosidades via RSS; faltam as outras |
| ★★☆ | Horóscopo | ❌ |
| ★★☆ | Receitas e dicas de saúde (padaria, farmácia, clínica) | 🟡 via RSS |
| ★☆☆ | Comunicados internos (TV corporativa em empresas) | ❌ fora do foco inicial |

---

## 2. Onde esse público gasta dinheiro

Preços públicos de concorrentes brasileiros em novembro de 2026:

| Gasto | Faixa de preço | Observação |
|---|---|---|
| **Software/player por tela** (gasto recorrente principal) | **R$ 15 a R$ 50 por tela/mês** (WayIndoor R$ 14,90; Attractive R$ 15; PlayTVi R$ 24,90–29,90; Musardos R$ 29,90–49,90). Planos de "telas ilimitadas" de R$ 75 a R$ 150/mês. Alguns cobram taxa de ativação (CriaTv R$ 299 por aparelho) | A maioria já inclui notícias e clima. Conteúdo dinâmico virou "obrigação", não diferencial |
| **TV Box** | R$ 200 a R$ 350 por aparelho (Android comum) | Gasto único. Mini PC custa 3x mais e é raro no iniciante |
| **TV** | R$ 800 a R$ 1.500 (32" a 43") | Gasto único. Às vezes é do próprio estabelecimento |
| **Artes dos anúncios** | Canva Pro, designer avulso ou faz sozinho | Dor real: o operador vende o anúncio, mas não sabe criar a arte |
| **Cursos e mentorias** "como ganhar com mídia indoor" | R$ 97 a R$ 997 | Mercado grande de infoprodutos; mostra o tamanho do público iniciante |
| **Materiais de venda** (mídia kit, tabela de preço, contrato) | Pacotes avulsos | Muitas vezes vêm junto dos cursos |

**Conclusão de posicionamento:**
- Os concorrentes vendem **software + conteúdo básico** por tela.
- O rsscreen pode se diferenciar em 4 pontos:
  1. **Funciona em qualquer player.** O link abre no sistema que o operador já usa (posição única:
     "conteúdo para o seu player"), ou no app rsscreen gratuito.
  2. **Conteúdo mais rico** que o dos concorrentes: 120 fontes, layouts bonitos, loterias, futebol.
  3. **Criador de anúncios** pronto para o comércio, que resolve a dor da arte.
  4. **Educação grátis** para quem está começando: guias, calculadora de renda, modelo de proposta.
     É isso que atrai pela busca.

---

## 3. App para Android e Windows a partir de JavaScript

O Player continua sendo a página web que já existe (`/tela/`). O app só "embrulha" essa página e
acrescenta o que o navegador não faz: abrir sozinho ao ligar a TV Box, tela cheia travada e arquivos
de vídeo guardados no aparelho.

| Tecnologia | Android | Windows | Peso do app | Veredito |
|---|---|---|---|---|
| **Capacitor** (Ionic) | ✅ muito maduro, muitos plugins | 🟡 só via comunidade | ~5 MB | **Escolha para Android** |
| **Tauri 2** | 🟡 funciona, mas tem menos uso real em produção | ✅ excelente | ~3–10 MB | **Escolha para Windows** |
| Electron | ❌ | ✅ | ~100 MB+ | Pesado demais para PCs fracos |
| React Native / Flutter | ✅ | 🟡 | — | Exigem reescrever as telas; não reaproveitam o JS atual |

**Recomendação (simples e sem reescrever nada):**
1. **Android com Capacitor:** primeiro e mais importante, porque a TV Box Android é o aparelho de quase
   todo iniciante.
2. **Windows:**
   - no começo, nem precisa de app: um **atalho de Chrome em modo quiosque** que abre o link ao ligar o
     PC (o painel gera o arquivo pronto);
   - se houver demanda, um app **Tauri** depois.
   - **Cuidado:** apps Windows sem certificado de assinatura (US$ 200–400/ano) mostram o alerta "app não
     reconhecido".
3. As TVs Samsung e LG usam o navegador da própria TV com o link. Não vale fazer app para elas.

---

## 4. O que fica ruim de fazer (evitar)

| Ideia | Por que evitar agora |
|---|---|
| Reescrever em Laravel + MySQL | A Cloudflare já faz tudo, sem servidor e de graça até crescer |
| SaaS completo com cobrança automática, planos e recuperação de senha | É um produto inteiro. Comece vendendo pelo WhatsApp, como hoje |
| Biblioteca de vídeos e animações "prontas" | É produção de conteúdo, não software. Use **templates gerados pelo sistema** |
| Apps nativos Samsung (Tizen) e LG (webOS) | Lojas fechadas, TVs para teste e pouco retorno |
| Converter vídeos no servidor | Serviço pago. Regra: "envie MP4 de até 100 MB" |
| Guardar imagens e vídeos no D1 | O D1 é para dados. Arquivos vão para o **R2** (10 GB grátis) |

---

## 5. Plano de etapas (cada uma libera um módulo, sem quebrar o que já roda)

**Regras gerais:**
- os links atuais sempre continuam abrindo;
- cada módulo novo entra como "em breve" até ser aprovado;
- cada etapa pode ser revertida sozinha.

| # | Etapa / módulo | Por que nesta ordem | Depende de | Tamanho |
|---|---|---|---|---|
| 1 ✅ | **Clientes no Cloudflare D1** (cadastrar, editar e suspender pelo painel) | Base para tudo que é "por cliente"; tira o commit do dia a dia | — | Médio |
| 2 ✅ | **Loterias** (apiloterias + reserva Caixa, 5 layouts) | Conteúdo muito pedido, rápido de entregar | — | Médio |
| 3 ✅ | **Anúncios / Criador de anúncios** (o operador cria a arte do anunciante a partir de templates ou envia imagem/vídeo para o R2) | A maior dor do público e o que gera a renda dele | 1 | Médio |
| 4 | **Playlist em um link** (intercala anúncios + notícias + clima + loterias, com tempo de cada um) | Transforma o rsscreen em "a programação inteira da TV" | 3 | Médio |
| 5 | **Conteúdo extra** (relógio grande, datas comemorativas, frases, horóscopo, futebol) | Completa a lista do que mais se procura | — | Pequeno a médio |
| 6 | **Site para a busca** (páginas dos termos da seção 1.2, guias, calculadora "quanto posso ganhar", modelo de proposta e tabela de preços) | Atrai o iniciante pelo Google | — (contínuo) | Contínuo |
| 7 | **App Android (Capacitor)** com início automático, tela cheia e vídeos guardados no aparelho | Fecha o "player grátis para quem não tem sistema" | 4 | Médio |
| 8 | **Pareamento por QR Code** (a TV mostra um código, o operador vincula pelo celular e troca a programação remotamente) | Facilita a vida de quem tem várias TVs | 1 e 7 | Médio |
| 9 | **Windows** (atalho quiosque agora, app Tauri se houver demanda) | Menos comum no iniciante | 4 | Pequeno → médio |

As etapas 1, 2, 5 e 6 são independentes entre si e podem andar em paralelo.

### Critérios de aceite resumidos
1. Links atuais abrem. Cliente suspenso no painel para em até 1 minuto. Com o D1 fora do ar, as telas
   continuam.
2. O resultado aparece em até 30 minutos depois do sorteio. O consumo fica abaixo de 350 requisições/mês.
   A chave da API nunca aparece na tela.
3. O operador cria um anúncio pelo celular em menos de 2 minutos e ele aparece na TV.
4. Uma playlist roda 24 h e continua sem internet com o último conteúdo.
5. Cada tela nova roda em horizontal e vertical em TV Box barata.
6. Cada página tem um termo principal, responde à dúvida e leva ao WhatsApp ou ao teste grátis.
7. O app roda 72 h numa TV Box barata e volta sozinho depois de queda de energia.
8. Parear uma TV leva menos de 1 minuto.
9. O PC liga e abre a programação sozinho.

---

## 6. Agentes especializados

Cada agente trabalha numa branch própria. Nada entra no `master` sem passar por Segurança e QA.

| Agente | Responsabilidade | Etapas |
|---|---|---|
| **Plataforma** | D1, R2, rotas da API, Cron, limites do plano gratuito, `wrangler.jsonc` | 1, 2, 3, 4, 8 |
| **Integrações** | apiloterias, API da Caixa, futebol, cache e consumo | 2, 5 |
| **Painel** | Telas do painel (celular primeiro): clientes, criador de anúncios, playlist | 1, 3, 4, 8 |
| **Telas e layouts** | Módulos de exibição leves, horizontal e vertical | 2, 3, 4, 5 |
| **Apps** | Capacitor (Android), atalho quiosque e Tauri (Windows) | 7, 9 |
| **SEO e conteúdo** | Páginas, guias, calculadora, textos de venda, materiais comerciais | 6 e textos de todas |
| **Segurança** | Senha, chaves de API, dados de clientes, LGPD | revisão de todas |
| **QA** | Testes automáticos, teste em TV Box real, links antigos | todas |

**Fluxo de cada etapa:**
1. Plataforma escreve o desenho técnico em meia página.
2. Você aprova.
3. Os agentes constroem em paralelo.
4. Segurança e QA revisam e testam.
5. Deploy.

---

## Fontes consultadas

**Preços dos concorrentes:**
- [Musardos](https://midiaindoor.musardos.com/)
- [PlayTVi](https://playtvi.com.br/)
- [WayIndoor](https://wayindoor.com.br/)
- [Attractive](https://www.attractivemidiaindoor.com.br/)
- [CriaTv](https://criatv.com/)
- [Tela Indoor](https://telaindoor.com.br/)
- [Display TV](https://display.tv.br/precos-planos/)
- [KX Mídia](https://kxmidia.com.br/)

**Conteúdo e mercado:**
- [SuaTV: tipos de conteúdo mais usados](https://www.suatv.com.br/?p=5916)
- [Indoor Channel: mídia kit](https://indoorchannel.com.br/wp-content/uploads/2024/04/Apresentacao-Midia-Kit-2024-Comprimido.pdf)
- [Meio & Mensagem: tendências OOH 2026](https://www.meioemensagem.com.br/midia/ooh-players-apontam-as-tendencias-de-2026)

**Apps:**
- [Tauri 2.0](https://v2.tauri.app/blog/tauri-2-0-0-release-candidate/)
- [Capacitor vs Tauri](https://toolradar.com/compare/capacitor-vs-tauri)
- [Electron vs Tauri para Capacitor](https://capawesome.io/docs/blog/electron-vs-tauri-for-capacitor-apps/)

**Loterias e Cloudflare:**
- [apiloterias](https://apiloterias.com/docs)
- [Limites do D1 gratuito](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
