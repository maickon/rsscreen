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

## Cadastrar cliente

Edite **`config/clientes.js`** e adicione uma linha na lista `clientes`:

```js
{ nome: 'Mercado Bom Preço', whatsapp: '22999990000' },
```

A chave única do cliente é gerada a partir do nome (ex.: `mercado-bom-preco-xium8`).
O painel, na aba **Clientes**, mostra a chave e monta essa linha para você copiar.

- Bloquear um cliente: `ativo: false` na linha dele.
- `demo: true` marca o cliente usado nas telas ao vivo da landing (aparece o selo "DEMONSTRAÇÃO").
- Trocar o `segredo` muda **todas** as chaves dos clientes (e os links já enviados param).

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
