# O que já existe

Índice de capacidades. **Uma pergunta só: "isso já está construído?"**

## Por que este arquivo existe

Em 03/09, dentro de uma conversa sobre medir o funil, eu propus construir um
rastreamento de ativação — o evento do primeiro contato criado. Ele já existia
desde 31/08, em `lib/analytics/ativacao.ts`, com o comentário explicando
exatamente o raciocínio que eu estava refazendo.

O fato estava gravado no `estado-atual.md`. Não estava perdido: estava entre
250 KB, e não foi encontrado na hora em que decidia alguma coisa.

Documento longo responde "por quê". Este responde **"onde"**, e é a primeira
parada antes de propor construir qualquer coisa. Junto do grafo do graphify,
que responde "quem chama o quê".

**Os caminhos abaixo são conferidos** por `scripts/ci/conferir-documentos.mjs`:
citar arquivo que não existe reprova o vigia. É o que impede este índice de
envelhecer em silêncio, que é o defeito de todo documento desse tipo.

---

## Medição e rastreamento

| capacidade | onde | desde |
|---|---|---|
| Ativação — evento do 1º contato criado | `lib/analytics/ativacao.ts` | 31/08 |
| Os 8 eventos da Meta (pixel + CAPI) | `lib/analytics/meta-conversions.ts` | 13/08 |
| Consentimento de cookie, e a recusa respeitada | `lib/analytics/consentimento.ts` | 23/08 |
| Captura de UTM na chegada (e do `gclid`) | `components/landing/utm-capture.tsx` | 20/08 |
| Tag do Google Ads, com as 4 cercas | `components/analytics/google-ads.tsx` | 04/09 |
| Conversão do Google: a decisão de disparar | `lib/analytics/conversao-google.ts` | 04/09 |
| Onde pode existir rastreador de anúncio | `lib/analytics/superficie-publica.ts` | 04/09 |
| Levar a origem adiante nos CTAs públicos | `components/landing/usar-destino-com-origem.ts` | 04/09 |
| Custo por cliente, por campanha **e por peça** | `lib/dono/atribuicao.ts` | 04/09 |
| Funil de ativação da base inteira | `lib/dono/ativacao.ts` | 31/08 |
| Erro de produção gravado no banco | `app/api/log-erro/route.ts` | 18/08 |

## Contatos, funil e rotina

| capacidade | onde | desde |
|---|---|---|
| Importar planilha `.xlsx` e `.csv` | `components/leads/import-leads-dialog.tsx` | 11/08 |
| Ler CSV, detectar separador e codificação | `lib/leads/csv.ts` | 09/08 |
| **Exportar** contatos para CSV | `lib/leads/exportar-csv.ts` | 03/09 |
| Tarefas agrupadas por dia, no fuso certo | `lib/tasks/buckets.ts` | 12/08 |
| Notificação dentro do produto | `lib/notificacoes/registrar.ts` | 02/09 |

## Dinheiro

| capacidade | onde | desde |
|---|---|---|
| Aplicar evento do Asaas (webhook e cron) | `lib/asaas/aplicar-evento.ts` | 13/08 |
| Webhook do gateway | `app/api/webhooks/asaas/route.ts` | 13/08 |
| Reconciliar assinatura, diária | `app/api/cron/reconciliar-assinaturas/route.ts` | 13/08 |
| Classificar acesso: pagante, trial, cortesia | `lib/dono/receita.ts` | 30/08 |
| Preços e limites de plano, num lugar só | `lib/plans.ts` | 07/08 |
| Plano **anual** (R$ 490, ciclo na assinatura) | `supabase/migrations/0070_ciclo_da_assinatura.sql` | 04/09 |

## Integrações

| capacidade | onde | desde |
|---|---|---|
| Google Calendar e Gmail (OAuth aprovado) | `lib/integrations/google.ts` | 12/08 |
| Token cifrado em repouso | `lib/integrations/crypto.ts` | 12/08 |
| Estado do WhatsApp (hoje: `migrando`) | `lib/integrations/whatsapp-estado.ts` | 28/08 |

## Suporte, legal e descoberta

| capacidade | onde | desde |
|---|---|---|
| Canal de suporte com anexo | `lib/feedback/actions.ts` | 30/08 |
| Dados do controlador, CNPJ, LGPD | `lib/legal.ts` | 09/08 |
| JSON-LD e dados estruturados | `lib/seo/dados-estruturados.ts` | 03/09 |
| Limite de requisição por IP/usuário | `lib/rate-limit.ts` | 08/08 |
| E-mail transacional, layout comum | `lib/emails/layout.ts` | 10/08 |

## Quem é conta de teste

| capacidade | onde | desde |
|---|---|---|
| **`ehContaDeTeste`** — use SEMPRE esta | `lib/dono/contas-internas.ts` | 20/08 |

Escrever o próprio filtro é a armadilha registrada em 29/08: uma expressão
regular escrita na hora classificou 23 empresas como externas quando eram 6, e
o número errado foi repetido em quatro documentos. **Erro que produz número
plausível é o mais caro que existe.**

## Vigias automáticos

| o que vigia | onde | desde |
|---|---|---|
| Documento que cita arquivo inexistente | `scripts/ci/conferir-documentos.mjs` | 03/09 |
| O site como o buscador lê, **e a CSP servida** | `scripts/marketing/auditar-descoberta.mjs` | 03/09 |
| A LCP com o perfil do PageSpeed | `scripts/diagnostico/medir-lcp.mjs` | 03/09 |
| Alerta por e-mail, de hora em hora | `app/api/cron/vigia/route.ts` | 01/09 |
| Fila do webhook do Asaas parada | `lib/dono/dinheiro-do-vigia.ts` | 04/09 |
| O vigia do vigia, por `pg_cron`, fora da Vercel | `supabase/migrations/0063_vigilante_do_vigia.sql` | 02/09 |

## Inteligência de mercado e prospecção (06 e 07/09)

Duas coisas diferentes com o mesmo motor, e confundi-las já custou uma rodada:
**enriquecimento** é recurso de produto, o cliente pede sobre um contato dele;
**prospecção** é ferramenta interna, roda por script e alimenta a carteira do
dono. A recusa de mostrar prospect minerado dentro do funil do cliente continua
valendo inteira.

| capacidade | onde | desde |
|---|---|---|
| Fila de enriquecimento + sinais (tabelas, RLS) | `supabase/migrations/0072_*.sql` | 06/09 |
| O núcleo puro: consulta, sinal, dor, orçamento | `lib/inteligencia-de-mercado/dominio/` | 06/09 |
| O único ponto que fala HTTP com o Exa | `lib/inteligencia-de-mercado/exa/cliente.ts` | 06/09 |
| A passagem da fila, a cada 15 min | `app/api/cron/enriquecer-leads/route.ts` | 06/09 |
| **Pedir pesquisa pela tela** (Server Action, gate Pro) | `lib/inteligencia-de-mercado/actions.ts` | 07/09 |
| O sinal na página do contato, com link da fonte | `components/leads/sinais-de-mercado.tsx` | 07/09 |
| `sinal_de_mercado` no sino | `supabase/migrations/0073_*.sql` | 07/09 |
| Motor de prospecção (5 nichos, praças, pontuação) | `scripts/inteligencia/prospectar.mjs` | 06/09 |
| Propensão a pagar, separada de alcançabilidade | `lib/inteligencia-de-mercado/dominio/prospeccao.ts` | 07/09 |
| A primeira mensagem, pronta para o WhatsApp | `lib/inteligencia-de-mercado/dominio/abordagem.ts` | 07/09 |
| Vocabulário do ICP e promessas do nicho | `lib/inteligencia-de-mercado/dominio/aprendizado.ts` | 07/09 |
| Quem pediu para não ser procurado | `scripts/inteligencia/nao-perturbe.txt` | 07/09 |
| Onde o bloqueio mora (WhatsApp, e-mail, LGPD) | [docs/mercado/limites-e-bloqueios.md](mercado/limites-e-bloqueios.md) | 07/09 |
| Praças e variantes de consulta (as 2 alavancas de volume) | `lib/inteligencia-de-mercado/dominio/prospeccao.ts` | 07/09 |
| Corpus de vocabulário que ACUMULA entre rodadas | `lib/inteligencia-de-mercado/dominio/aprendizado.ts` | 07/09 |
| Universo em CSV, separado da fila de contato | `scripts/inteligencia/prospectar.mjs` (`--universo`) | 07/09 |
| Rodada diária que rotaciona nicho e praça | `scripts/inteligencia/prospectar.mjs` (`--diario`) | 07/09 |
| Os 27 nichos medidos, e a regra que decidiu | [docs/mercado/nichos-medidos-2026-09-06.md](mercado/nichos-medidos-2026-09-06.md) | 06/09 |
| **A prateleira: as 882 empresas numa fila só** | `app/(dono)/dono/prospeccao/page.tsx` | 08/09 |
| O merge das 3 fontes (CSV + banco), puro | `lib/dono/prateleira.ts` | 08/09 |
| Em que prateleira cada empresa está (arquivo) | `lib/dono/prateleira-estado.ts` | 08/09 |
| Enviar num clique, e confirmar criando o contato | `lib/dono/prateleira-actions.ts` | 08/09 |

**O que foi construído, medido e RECUSADO — não reconstruir:**

```
decisor por LinkedIn      existe em dominio/decisor.ts e rende 0 de 6. O dado
                          nao existe: dono de PME nao mantem perfil com a
                          empresa no titulo. `--decisores` fica em 0
espiao de dor declarada   rodado, 31 chamadas. NAO produz lead contatavel em
                          pt-BR — a SERP e conteudo de concorrente. Vale como
                          copy. Ver docs/mercado/espiao-de-dor-2026-09-06.md
includeText do Exa        aceito pela API e nao muda o resultado (25 vs 25)
subpages do Exa           alvo semantico fraco: pedi "contato", veio
                          /lentes-de-contato-dental
```

## Conversão: o que responde a objeção, e onde

| capacidade | onde | desde |
|---|---|---|
| "A porta de saída fica aberta" (garantias) | `components/landing/confianca-section.tsx` | 24/08 |
| "Posso cancelar quando quiser?" no FAQPage | `components/landing/faq-section.tsx` | 23/08 |
| A saída na DOBRA, abaixo do preço | `components/landing/hero-section.tsx` | 07/09 |
| As 3 objeções abaixo do formulário de cadastro | `components/auth/signup-form.tsx` | 07/09 |
| "Traga e leve seus contatos, em CSV" | `components/landing/pricing-section.tsx` | 07/09 |
| Cancelamento no JSON-LD das páginas de conteúdo | `app/(conteudo)/*/page.tsx` | 07/09 |
| Comparação de preço com 6 concorrentes reais | `app/(conteudo)/alternativa-ao-crm-que-cobra-por-usuario/` | 07/09 |

**A assimetria que isso corrigiu, medida em 07/09:** "importar" aparecia em SEIS
superfícies com frase própria e "exportar" numa só, como item de lista sem
frase. E o raciocínio certo — *"'Traga e leve seus contatos' responde a objeção
de ficar preso antes de ela ser feita"* — estava escrito em COMENTÁRIO de código
desde que o cartão de preço nasceu, e a tela nunca disse.

## O que NÃO existe, e é perguntado com frequência

```
importar conversa exportada do WhatsApp (.txt)   proposto em docs/dor-de-mercado.md,
                                                 nenhuma linha escrita
WhatsApp por API                                 a ponte saiu em 28/08 (c52a718)
campos e etapas customizaveis                    deal_stage e enum, em 9 arquivos de codigo
snapshot mensal de metricas                      nao ha tabela; por isso a landing
                                                 nao mostra "+18% vs mes anterior"
fila ou SLA de suporte                           nao existe; por isso "suporte
                                                 prioritario" foi removido 3x
```
