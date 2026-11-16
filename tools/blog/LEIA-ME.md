# Fila de posts do blog

Cada post é um arquivo `.html` nesta pasta, com o cabeçalho abaixo e o texto do artigo em HTML.

```html
<!--
slug: blog/como-conseguir-o-primeiro-anunciante
titulo: Como conseguir o primeiro anunciante de mídia indoor
descricao: Resumo de até ~155 caracteres que aparece no Google.
h1: Como conseguir o primeiro anunciante
lead: Frase de abertura do artigo.
cartao: Texto curto do cartão nos índices.
icone: users
categoria: precos
-->
<h2>...</h2>
<p>...</p>
```

- **categoria**: `comecar`, `precos`, `pontos`, `equipamentos` ou `conteudo` (ver `CATEGORIAS` em `tools/gerar-site.py`).
- **Sem `publicar:`** o post entra na fila: o gerador escolhe a próxima vaga (2 por semana, terça e quinta) e grava a data no arquivo.
- **Com `publicar: AAAA-MM-DD`** o post sai exatamente nessa data.
- Post com data futura não aparece no site, no blog, no sitemap nem no llms.txt.
- A automação `.github/workflows/publicar.yml` roda o gerador todo dia às 8h e publica o que chegou na data.
- Todo artigo recebe automaticamente, no final, a chamada "Como o rsscreen ajuda" de acordo com a categoria.
