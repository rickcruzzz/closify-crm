# Como o produto é encontrado, e o que estava impedindo

Auditado em 03/09/2026, a pedido do dono, antes de promover: *"verifique se
nosso SaaS já aparece no Google"*.

O resultado desmentiu duas suposições minhas em sequência, e a causa real
estava fora do repositório.

---

## O que eu supus errado, duas vezes

**Primeiro erro: "o site não aparece."** Busquei por `velofunil.com.br CRM
Velo Funil` numa ferramenta de busca e não achei. Conclusão precipitada — a
ferramenta não é o Google, e o dado da fonte diz o contrário.

O Search Console, em 3 meses:

```
cliques           38
impressoes       114
CTR              33,3%     (media de mercado: 3% a 5%)
posicao media     1,7      (primeiro lugar)
paginas indexadas   2
```

**Segundo erro: "falta o Search Console."** Ele já estava configurado, como
propriedade de Domínio (`sc-domain:velofunil.com.br`), com dados desde 13/08.

**A lição de método:** quando a fonte oficial existe, ela decide. Ferramenta
de busca de terceiro serve para explorar, nunca para concluir ausência.

---

## O diagnóstico correto: não é visibilidade, é demanda

Posição 1,7 com CTR de 33% significa que **quando alguém busca, acha e clica**.
O problema é o volume:

```
114 impressoes em 3 MESES  =  ~1,3 por dia
```

E posição 1 quase sem disputa indica busca **pelo nome próprio** — "velo
funil", de quem já ouviu falar. Ninguém disputa esse termo.

Ou seja: o SEO técnico está correto. O que falta é gente conhecendo o nome, e
conteúdo que ranqueie em termos que trazem quem ainda não conhece. Com **2
páginas indexadas** contra centenas dos concorrentes, não há superfície para
ranquear em "crm para pequena empresa".

---

## A causa real do que o dono relatou: a IA do Google não citava o site

O relato foi preciso e foi ele que resolveu o caso: *"aparece o site, mas a IA
do Google não fala do meu site"*.

O `robots.txt` servido em produção tinha **76 linhas** — mas `app/robots.ts`
gera 15. A diferença vinha do Cloudflare, que injetava:

```
User-agent: Google-Extended       Disallow: /
User-agent: GPTBot                Disallow: /
User-agent: ClaudeBot             Disallow: /
User-agent: meta-externalagent    Disallow: /
User-agent: CCBot                 Disallow: /
User-agent: Bytespider            Disallow: /
User-agent: Amazonbot             Disallow: /
User-agent: Applebot-Extended     Disallow: /

Content-Signal: search=yes, ai-train=no, use=reference
```

**`Google-Extended` é o bot que autoriza o Google a usar o conteúdo em AI
Overviews e no Gemini.** Bloqueado, o Google estava literalmente proibido de
citar o site nas respostas de IA. E `ai-input` — o sinal que autoriza uso em
RAG e resposta generativa — nem estava declarado.

### A distinção que decide, e que não é óbvia

```
Googlebot          rastreia e indexa       -> ranking na busca normal
Google-Extended    autoriza uso em IA      -> citacao em AI Overview
```

São bots diferentes com efeitos diferentes. Bloquear o segundo **não afeta o
ranking** — e os próprios dados do Cloudflare confirmam: 74 requisições do
Googlebot, todas permitidas, 70 com HTTP 200. A busca funcionava; a IA é que
estava barrada.

### A origem: `robots.txt gerenciado` do Cloudflare

Um toggle em **AI Crawl Control**, descrito como *"o Cloudflare cria ou
atualiza seu arquivo robots.txt para sinalizar que seu conteúdo não deve ser
usado para treinamento de IA"*.

Ele é sensato como padrão — protege quem publica conteúdo original de ser
treinado sem retorno. **É o oposto do que um SaaS querendo ser descoberto
precisa:** aqui a landing existe para ser citada.

Desligado pelo dono em 03/09. Provado nos dois sentidos:

```
antes   76 linhas, Google-Extended bloqueado
depois  15 linhas, identicas ao que `app/robots.ts` gera
```

---

## O que ficou faltando, e é conteúdo

Liberar o bot é **condição necessária, não suficiente**. A IA só cita quem tem
conteúdo que responde à pergunta, e 2 páginas não dão superfície para isso.

O que constrói descoberta, em ordem de retorno:

1. **Páginas que respondem dúvida real** — "quanto custa um CRM", "CRM cobra
   por usuário?", "como migrar da planilha para um CRM". São exatamente as
   perguntas que a IA lê para montar resposta, e onde este produto tem
   argumento próprio.
2. **Dados estruturados**, feitos em 03/09 (`lib/seo/dados-estruturados.ts`):
   `Organization`, `SoftwareApplication` com os dois planos, e `FAQPage` com
   as seis perguntas da landing. Melhoram a APRESENTAÇÃO do resultado — preço
   e perguntas expandidas —, não a posição.
3. **Backlinks.** Zero hoje. Continua sendo o sinal mais forte de relevância,
   e nenhum ajuste técnico substitui.

---

## O que nenhum portão deste projeto enxerga

`tsc`, `lint`, `test` e `build` não leem o `robots.txt` **servido** — leem o
código que o gera. Neste caso os dois discordavam, e por 61 linhas.

É a mesma classe do CNPJ baixado na landing, do pixel com quebra de linha na
Vercel e da CSP bloqueando a logo do Storage: **configuração fora do
repositório que muda o comportamento do produto, e que só aparece quando
alguém vai olhar.**

A verificação que pega isso é uma linha, e vale repetir depois de qualquer
mexida no Cloudflare:

```sh
curl -s https://www.velofunil.com.br/robots.txt | grep -i "google-extended" \
  && echo "BLOQUEADO — a IA do Google nao pode citar o site" \
  || echo "liberado"
```
