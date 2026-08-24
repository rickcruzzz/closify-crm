# Instagram — Velo Funil

Pasta de trabalho pros criativos do Instagram (posts, stories, destaques).
Referência de marca extraída do código real do produto — não inventada —,
pra quem for desenhar (você, designer, IA de imagem) não precisar abrir o
código-fonte pra descobrir hex de cor ou nome de fonte.

## Referência de marca

- **Cor principal**: `#00bfc0` (cyan-teal) — equivalente ao `--primary` do
  tema escuro (`app/globals.css`), que é o padrão do produto.
- **Cor de texto sobre a principal**: `#031010` (quase-preto).
- **Fundo escuro do produto** (padrão): `#0a0a0a`.
- **Fonte**: Geist (`app/fonts/GeistVF.woff`), variável, pesos 100-900 —
  [geist.dev](https://geist-font.vercel.app/) pra quem for usar em
  ferramenta externa.
- **Logo**: ícone é a silhueta de um funil — três barras horizontais
  decrescentes de largura (18.8 → 10.2 → 2.2), mesmo desenho lê como a
  letra "V" de Velo. Wordmark "Velo" (semibold) + "Funil" (peso normal,
  cinza). Definido em `components/branding/logo.tsx`. Sem arquivo
  exportável (PNG/SVG solto) ainda — só existe como código React/SVG.
- **Screenshot real do produto**: `land-hero.png` (raiz do repositório).
- **Tom de voz**: sem jargão técnico (nada de "pipeline", "Kanban",
  "workspace" cru) — ver `docs/prd-copy-sem-jargao.md`. Headline de
  referência: **"Pare de perder venda por esquecimento."**
- **Identidade visual geral**: modo escuro como padrão, alto contraste,
  poucos elementos por tela (`CLAUDE.md`, seção Identidade Visual).

## Stories dos destaques (conteúdo de dentro)

Gerados por `scripts/marketing/gerar-stories.py`:

```sh
python scripts/marketing/gerar-stories.py
```

Cada tela sai em dois arquivos: a versão de publicação (**1080×1920**, que é
o padrão de Story e o que se sobe no Instagram) e uma `@4k` (2160×3840) para
reaproveitar em feed ou anúncio sem regerar.

**Renderiza a 2x e reduz no fim.** Desenhar direto em 1080×1920 desperdiçava
o print de origem (2880px entrando a 0,49x, metade dos pixels jogados fora) e
rasterizava texto e selo uma única vez, sem folga de amostragem — o que
serrilhava a borda do símbolo e embaçava o endereço, visível a olho nu em
qualquer zoom. Com supersampling cada pixel final vira média de 4 amostras.

**Não suba o `@4k` direto no Instagram.** O app recomprime para 1080 de
largura de qualquer jeito, às vezes com resultado pior que a redução
controlada por LANCZOS que o script já faz.

### Destaque 1 — Demo (Como funciona)

| # | arquivo | conteúdo |
| --- | --- | --- |
| 1 | `2026-08-24-demo-01-gancho.png` | A dor: "O cliente pediu orçamento e sumiu no WhatsApp. Aqui ele não some." |
| 2 | `2026-08-24-demo-02-passo1.png` | 01 · Traga quem já é seu cliente |
| 3 | `2026-08-24-demo-03-passo2.png` | 02 · Arraste pelas etapas |
| 4 | `2026-08-24-demo-04-passo3.png` | 03 · Veja onde está o dinheiro |
| 5 | `2026-08-24-demo-05-cta.png` | 7 dias com tudo liberado, sem cartão |

A copy dos três passos é **literal** de
`components/landing/how-it-works-section.tsx` — a mesma que já passou pelo PRD
de copy sem jargão. Reescrever aqui faria o Story divergir da página no
primeiro ajuste que alguém fizesse lá.

O formato segue o padrão "Bold Headline + Product UI", o que mais converte em
anúncio B2B SaaS: headline no terço superior, print real do produto embaixo em
perspectiva, e a headline descreve exatamente o que o print mostra. A regra
que isso respeita: **print real prova, ícone abstrato não**. A primeira
tentativa usava ilustração gerada por IA e foi descartada por isso.

Os três passos usam print **escuro**, sem exceção — quatro telas escuras com
uma clara no meio lê como erro de montagem, e o modo escuro é o padrão do
produto.

## Convenção de nome de arquivo

`AAAA-MM-DD-descricao-curta.png` — pra dar pra achar por data depois.

## Destaques (Highlights) do perfil

5 categorias decididas (não copia concorrente — ver rationale completo no
plano desta sessão). Nenhuma prova social inventada (depoimento, prêmio,
"clientes atendidos") até existir cliente pagante real — mesma regra do
produto (`CLAUDE.md`, Decisões travadas).

**Rótulo curto** (limite real do Instagram: ~10-12 caracteres antes de
cortar) — nome exibido embaixo do círculo é diferente do nome de conteúdo
usado nesta tabela:

| # | Rótulo no perfil | Conteúdo (nome interno) | Arquivo local | Design (Canva, editável) |
| --- | --- | --- | --- | --- |
| 1 | **Demo** | Como funciona | `2026-08-15-selo-01-como-funciona.png` | https://www.canva.com/d/y5yCTHPiWgfOujf |
| 2 | **Planos** | Planos | `2026-08-15-selo-02-planos.png` | https://www.canva.com/d/ikkWaVFFiply_9R |
| 3 | **Dicas** | Dicas de venda | `2026-08-15-selo-03-dicas-de-venda.png` | https://www.canva.com/d/-uoDGcqoAD5YxUI |
| 4 | **Bastidores** | Bastidores | `2026-08-15-selo-04-bastidores.png` | https://www.canva.com/d/W3-rbDiviPcGluo |
| 5 | **FAQ** | Perguntas | `2026-08-15-selo-05-perguntas.png` | https://www.canva.com/d/C76ZllXX8PIdlaq |

Sem emoji nos rótulos — tom premium B2B, mesmo padrão de perfis SaaS
sérios (o próprio Pipedrive, mostrado como referência, usa palavra única
sem ícone: "Events", "Swag", "Office").

Todos em `marketing/instagram/`, 1080×1920px PNG, exportados direto do
Canva (`export-design`, PNG lossless). Link do Canva fica pra quem quiser
editar depois (trocar cor, recortar pro círculo do destaque, etc.).

Os 5 ícones foram gerados via Canva MCP (`generate-design`, design_type
`your_story`), mesmo prompt-base pros 5 (fundo `#0A0A0A` sólido, 1 glifo
`#00BFC0` centralizado, sem texto, sem gradiente, sem sombra) — só troca o
ícone central. **Um candidato do selo "Bastidores" saiu com template
promocional errado** ("Unlock Amazing Deals", 20% off) — descartado antes
de aprovar, usado o 2º candidato do mesmo job, que bateu certinho. Todos
os 5 abaixo já foram conferidos visualmente (não só pelo título gerado)
antes de entrar nesta tabela.

Cada destaque só publica no perfil quando tiver pelo menos 1 Story real
dentro — destaque vazio parece pior que não ter destaque nenhum.
