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
