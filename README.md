# rsscreen

Conteúdo automático para telas de mídia indoor: notícias (RSS), previsão do tempo e cotações,
em layouts horizontais e verticais. Só HTML, CSS e JS, hospedado no Cloudflare Pages.

## Páginas

| Página | Endereço | Para quê |
|---|---|---|
| Landing page | `/` | Página de vendas. Lista os módulos a partir dos manifestos. Botões levam ao WhatsApp. |
| Painel | `/painel/` (ou `/admin`) | Gera, copia e envia links por WhatsApp. Instalável como app (PWA). |
| Tela | `/tela/?cliente=...` | O que roda na TV. Sem logo e sem as cores do rsscreen. |

## Publicar no Cloudflare Pages

1. Suba esta pasta para um repositório no GitHub.
2. Cloudflare → Workers & Pages → Create → Pages → conecte o repositório.
3. **Framework preset:** None · **Build command:** (vazio) · **Output directory:** `/`
4. Pronto. A pasta `functions/` vira automaticamente o endpoint `/api/rss` (leitor de feeds sem bloqueio de CORS).

Cada `git push` publica uma versão nova.

**Criou como Worker em vez de Pages?** Também funciona: o repositório tem `wrangler.jsonc` e
`worker/index.js`. No projeto Worker, o comando de deploy é `npx wrangler deploy` (padrão).
O nome em `wrangler.jsonc` (`rsscreen`) deve ser igual ao nome do Worker no Cloudflare.

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

`modules/pacotes.json` traz os pacotes prontos por segmento (padaria, clínica, academia…).

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
