# rsscreen

Conteúdo automático para telas de mídia indoor: notícias (RSS), previsão do tempo e cotações,
em layouts horizontais e verticais. Só HTML, CSS e JS, hospedado no Cloudflare Pages.

## Páginas

| Página | Endereço | Para quê |
|---|---|---|
| Landing page | `/` | Página de vendas. Lista os módulos a partir dos manifestos. Botões levam ao WhatsApp. |
| Painel | `/painel/` (ou `/admin`) | Gera, copia e envia links por WhatsApp. Instalável como app (PWA). |
| Tela | `/tela/?cliente=...` | O que roda na TV. Sem logo e sem as cores do rsscreen. |

## Publicar na Cloudflare (como Worker)

O rsscreen precisa ser publicado como **Worker** (não como Pages). Só o Worker cria sozinho o banco
D1 (clientes, anúncios, playlists), o monitoramento e a busca automática das loterias.

1. Cloudflare → **Workers & Pages** → **Create** → aba **Workers** → **Import a repository**.
2. Escolha o repositório `rsscreen` no GitHub.
3. **Project name:** `rsscreen` (precisa ser igual ao `name` em `wrangler.jsonc`; se a Cloudflare
   não aceitar esse nome, use outro e troque o `name` em `wrangler.jsonc` para o mesmo).
   **Build command:** (vazio) · **Deploy command:** `npx wrangler deploy` (padrão).
4. Clique em **Deploy**. O banco D1 e o monitoramento são criados nesse primeiro deploy.
5. O endereço novo fica `https://rsscreen.<sua-conta>.workers.dev`.
6. (Opcional) Chave paga da apiloterias: Worker → **Settings → Variables and Secrets** →
   **Add** → tipo *Secret*, nome `APILOTERIAS_KEY`.

Cada `git push` publica uma versão nova.

### Os links antigos (rsscreen.pages.dev) continuam funcionando

Se o site já estava publicado como Pages, não apague o projeto Pages. Nele, vá em
**Settings → Variables and Secrets** → **Add** → nome `WORKER_URL`, valor
`https://rsscreen.<sua-conta>.workers.dev` → salve e clique em **Retry deployment** (ou faça
qualquer push). A partir daí, todo acesso ao endereço antigo é levado para o Worker com os mesmos
parâmetros (`functions/_middleware.js`), então as TVs dos clientes não precisam de link novo.

Enquanto isso não for feito, o Pages funciona em modo reduzido (`functions/api/[[path]].js`):
notícias, clima, cotações, futebol e loterias funcionam; anúncios aparecem como "Anuncie aqui";
clientes ficam no `config/clientes.js`; playlists e monitoramento ficam indisponíveis.

## Cadastrar cliente (banco D1)

Os clientes ficam no **Cloudflare D1**. O banco é criado sozinho no primeiro deploy (o
`wrangler.jsonc` declara o binding `DB` sem `database_id`) e a tabela é criada no primeiro uso.

1. Abra **Painel > Clientes**. Na primeira vez aparece o botão **Importar clientes**, que copia
   a lista do `config/clientes.js` para o banco **com as mesmas chaves** (nenhum link para).
2. Cadastre, edite, suspenda ou exclua pelo formulário: vale nas telas em até 1 minuto, sem commit.
3. Cada cliente tem plano, número de telas, valor mensal, dia de vencimento e observações.
   O painel soma o faturamento mensal previsto.

- A chave nunca muda ao editar o nome, então os links enviados continuam valendo.
- Suspender = desmarcar "Cliente ativo". As telas mostram "Tela suspensa".
- **Reserva:** se o banco estiver vazio ou fora do ar, as telas usam o `config/clientes.js`
  e a última resposta salva no aparelho. Depois de importar, o banco passa a ser a lista oficial.
- `demo: true` marca o cliente usado nas telas ao vivo da landing (aparece o selo "DEMONSTRAÇÃO").
- Trocar o `segredo` muda **todas** as chaves dos clientes (e os links já enviados param).
- Os planos e preços sugeridos ficam em `planos` no `config/clientes.js` (aparecem no cadastro
  e no **Guia de vendas** do painel).

## Loterias

Módulo `modules/loterias` com 11 loterias e 6 modelos: resultado, próximo prêmio, painel,
premiação e ganhadores, números quentes e frios, e atrasados com pares × ímpares.

- **Estatísticas** (quentes, frios, atrasados, pares/ímpares) vêm da apiloterias e são atualizadas
  1 vez por semana (4 consultas por jogo, cerca de 140 por mês para 8 jogos), sempre guardando 60
  consultas de folga para os resultados. Sem chave, as telas usam `modules/loterias/estatisticas.json`
  (gerado em 13/11/2026). O botão **Atualizar agora** do Monitoramento atualiza só os resultados.

- O Worker busca os resultados pelo **Cron** (21:30, 22:30, 23:30, 00:30 e 08:00, horário de
  Brasília) e guarda no Durable Object. As telas leem só essa cópia, então o número de telas
  não gasta consultas.
- Fonte principal: **API pública da Caixa** (grátis). Reserva opcional: **apiloterias.com**.
  Para ativar a reserva, assine um plano e cadastre a chave como secret:
  `npx wrangler secret put APILOTERIAS_KEY` (ou no painel da Cloudflare: Worker > Settings >
  Variables and Secrets). O limite de segurança é `APILOTERIAS_LIMITE` (450/mês). Para usar a
  apiloterias como principal, mude `LOTERIAS_FONTE` para `apiloterias` no `wrangler.jsonc`.
- **Painel > Monitoramento > Loterias** mostra o último concurso de cada jogo, a fonte, as falhas e
  o botão **Atualizar agora**.

## Anúncios

**Painel > Anúncios**: escolha o cliente, crie os anúncios dos anunciantes dele e copie o link da
tela de anúncios (`modulo=anuncios`). A tela mostra todos os anúncios ativos em sequência e se
atualiza a cada 2 minutos.

- 6 modelos: oferta (preço de/por), empresa/serviço, aviso, evento (com data), arte pronta
  (imagem inteira, ex.: feita no Canva) e vídeo (link MP4 https).
- Cada anúncio tem anunciante, cor de destaque, tempo na tela, período (começa/termina) e ordem.
- As fotos são reduzidas no navegador (máx. 1920 px, WebP/JPEG) e guardadas no próprio D1.
  Vídeos ficam hospedados fora (link); o envio de vídeo pelo painel exige ativar o R2.
- Prévia ao vivo no painel antes de salvar. Sem anúncios ativos, a tela mostra "Anuncie aqui".

## Guia e ferramentas (site para a busca do Google)

Páginas públicas para atrair quem está começando na mídia indoor:

- `/guia/`: índice, com 6 guias: como ganhar dinheiro, quanto cobrar por anúncio, sistema/player,
  conteúdo para a TV, TV Box e TV com propaganda por tipo de comércio.
- `/ferramentas/calculadora-midia-indoor/`, `/ferramentas/proposta-comercial/` e
  `/ferramentas/tabela-de-precos/`: funcionam no navegador, sem cadastro; os campos ficam só no aparelho.
- `/sitemap.xml` e `/robots.txt` são gerados pelo Worker com o endereço real do site (painel, telas e
  API ficam fora da busca).

**Para editar um texto:** mude o arquivo em `tools/paginas/` e rode `python tools/gerar-site.py`.
O gerador monta menu, sumário, dados estruturados do Google (artigo, trilha e perguntas frequentes)
e o "continue lendo". Depois de publicar, cadastre o site no Google Search Console e envie o
`/sitemap.xml`.

## Playlists

**Painel > Playlists**: monte a programação inteira da TV num link só
(`/tela/?cliente=<chave>&playlist=<id>`). Cada conteúdo (notícias, clima, loterias, cotações,
anúncios) tem o seu tempo na tela, e a sequência se repete o dia todo.

- **Anúncios entre os conteúdos**: entra 1 anúncio do cliente depois de cada conteúdo, um diferente a cada vez.
- **Começar de um pacote pronto** preenche os conteúdos do segmento (padaria, clínica…).
- Ao editar, a TV recebe a mudança em até 3 minutos, sem trocar o link. Prévia ao vivo no painel.
- Cada conteúdo abre num quadro interno (`&embed=1`): o próximo é preparado escondido e entra com
  transição suave; se falhar, a playlist pula para o seguinte. A playlist e os dados ficam
  guardados no aparelho e continuam rodando sem internet.
- Notícias e anúncios continuam de onde pararam em cada aparição, e dados ainda recentes não são
  buscados de novo (economiza requisições do plano gratuito).

## Senha do painel

O painel pede uma senha. Em `config/clientes.js` fica só o hash dela (`admin.senhaHash`),
nunca a senha. Para trocar: **Painel > Clientes > Trocar senha do painel**, copie a linha
gerada, cole no lugar de `senhaHash`, faça commit e push.

## Endereço da tela

```
/tela/?cliente=padaria-pao-dourado-btgaa&modulo=rss&assunto=esportes&layout=destaque&orientacao=vertical&tema=noite
```

| Parâmetro | Valores |
|---|---|
| `cliente` | chave do cliente (obrigatório) |
| `modulo` | `rss`, `clima`, `cotacoes` |
| `assunto` | id do assunto no manifesto (ex.: `esportes`, `cabo-frio-rj`, `moedas`) |
| `fonte` | opcional: uma fonte específica do assunto (ex.: `ge`) |
| `layout` | id do modelo no manifesto (ex.: `destaque`, `revista`, `manchetes`) |
| `orientacao` | `horizontal`, `vertical` (sem o parâmetro = automática) |
| `tema` | `noite`, `claro`, `grafite`, `oceano`, `floresta`, `vinho`, `royal`, `areia` |
| `tempo` | segundos por slide (padrão do módulo) |
| `girar` | `90` ou `270` para TV box que não gira a imagem |
| `modo` | `teste` mostra a barra com seletores (layout, assunto, tema, orientação…) |

Atalhos no modo teste: ← → navegam, espaço pausa, H esconde a barra.

## Módulos

Cada tipo de tela é um módulo em `modules/<id>/`:

- `manifest.json` — nome, textos de venda, benefícios, assuntos e layouts (lido pela landing e pelo painel)
- `screen.js` — busca os dados e desenha cada layout (só módulos ativos)
- `style.css` — estilos dos layouts

Para incluir um módulo, crie a pasta e adicione o id em `modules/registry.json`.
Módulos com `"status": "em-breve"` aparecem na landing como "Em breve".

`modules/pacotes.json` traz os pacotes prontos por segmento (padaria, clínica, academia, barbearia…).

Módulos ativos: notícias (`rss`), anúncios, clima, cotações, loterias, **futebol**, **relógio**,
**datas comemorativas**, **frases** e **horóscopo**.

- **Futebol** lê `/api/futebol?liga=bra.1` (Worker). Os dados são públicos da ESPN, sem chave, com
  cache de 1 minuto durante os jogos e 10 minutos no resto do tempo; se a ESPN falhar, a última
  resposta boa continua valendo por até 2 dias. Brasileirão A e B, Copa do Brasil, Libertadores,
  Sul-Americana, Champions, Premier League e La Liga.
- **Relógio, datas, frases e horóscopo** são calculados no aparelho e funcionam sem internet. As
  datas móveis (Carnaval, Páscoa, Dia das Mães/Pais, Black Friday) são calculadas todo ano. Os
  textos das frases e do horóscopo são próprios do rsscreen (nada copiado de outros sites) e mudam
  todo dia, iguais em todas as telas.

## Comportamento das telas

- O link da tela é público: abre em qualquer navegador, TV, TV box, player ou sistema de
  mídia indoor (por URL/página web), sem login.
- Se o site escolhido bloquear ou cair, a tela mostra a última cópia boa (até 7 dias) e,
  sem ela, notícias dos outros sites do mesmo assunto. Ela não fica parada no "Carregando".
- Notícias atualizam a cada 10 min, cotações a cada 5 min e clima a cada 15 min.
- O último conteúdo fica salvo no aparelho: se a internet cair, a tela continua rodando.
- A página recarrega a cada 6 h para receber atualizações do sistema.
- Tudo escala pelo tamanho da tela (720p, 1080p, 4K), nas duas orientações.

## Monitoramento

**Painel > Monitoramento** mostra telas ligadas agora, requisições por dia, telas e clientes
mais usados, IPs, localização, tipo de player, aparelhos e a saúde de cada feed RSS (ativo,
instável ou recusado). O botão **Testar todos os feeds** consulta todos na hora.

Os dados ficam num Durable Object com SQLite (`worker/stats.js`), criado automaticamente no
deploy pelo `wrangler.jsonc` e incluído no plano gratuito. Os números são aproximados e
ficam guardados por 35 dias. Funciona só no deploy como Worker (não em Pages).

## Segurança — leia

Este é um site estático: **tudo o que está no repositório fica público**, inclusive
`config/clientes.js`. Quem ler o código consegue descobrir as chaves dos clientes. O modelo
serve para organizar e identificar clientes, não para proteger um segredo de verdade. A senha
do painel não fica no arquivo (só o hash); as estatísticas só saem do servidor com a senha.
Não coloque e-mails ou dados sensíveis nesse arquivo. O histórico de "Meus links" fica salvo só
no navegador do painel; use **Exportar** para ter um backup.
