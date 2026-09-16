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
| **Ler a conta do Google Ads por API** | `lib/dono/google-ads-queries.ts` | 08/09 |
| O nucleo puro: micros, CTR, conversao offline | `lib/dono/google-ads.ts` | 08/09 |
| O Google Ads na Central, com palavra a palavra | `components/dono/painel-do-google.tsx` | 08/09 |
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
| **Orçamento com prazo** no negócio (valor, validade, o que foi proposto) | `lib/deals/orcamento.ts` | 08/09 |
| A validade vira tarefa de cobrar retorno, 2 dias antes | `registrarOrcamento` em `lib/deals/actions.ts` | 08/09 |
| **PDF do orçamento** — gerado no servidor, gateado por `pro_vigente()` | `app/api/negocios/[dealId]/orcamento/route.ts` | 08/09 |

## Dinheiro

| capacidade | onde | desde |
|---|---|---|
| Aplicar evento do Asaas (webhook e cron) | `lib/asaas/aplicar-evento.ts` | 13/08 |
| Webhook do gateway | `app/api/webhooks/asaas/route.ts` | 13/08 |
| Reconciliar assinatura, diária | `app/api/cron/reconciliar-assinaturas/route.ts` | 13/08 |
| Classificar acesso: pagante, trial, cortesia | `lib/dono/receita.ts` | 30/08 |
| Preços e limites de plano, num lugar só | `lib/plans.ts` | 07/08 |
| Plano **anual** (R$ 490, ciclo na assinatura) | `supabase/migrations/0070_ciclo_da_assinatura.sql` | 04/09 |
| Plano **Max** (R$ 250, coluna `plano` e `max_vigente`) — ESCRITA, NÃO APLICADA | `supabase/migrations/0089_plano_max.sql` | 16/09 |
| Direito ao WhatsApp, a árvore de 4 bloqueios | `lib/plans/max.ts` | 16/09 |
| Auditoria de arquitetura do Max e da Z-API | [docs/auditoria-whatsapp-max-2026-09-16.md](auditoria-whatsapp-max-2026-09-16.md) | 16/09 |

## WhatsApp no produto (plano Max, 16/09)

| capacidade | onde | desde |
|---|---|---|
| Conexão por empresa (tabela, RLS, trigger de plano) — ESCRITA, NÃO APLICADA | `supabase/migrations/0090_whatsapp_da_empresa.sql` | 16/09 |
| Cliente HTTP da Z-API, o único que fala com ela | `lib/whatsapp/zapi.ts` | 16/09 |
| Provider que implementa `Remetente`, com aquecimento | `lib/conversas/remetente-zapi.ts` | 16/09 |
| Normalizar o payload da Z-API (recebida, status, desconexão) | `lib/whatsapp/payload.ts` | 16/09 |
| Escada de entrega, que só anda para frente | `lib/whatsapp/entrega.ts` | 16/09 |
| Gravar a mensagem na empresa dona da instância | `lib/whatsapp/receber.ts` | 16/09 |
| Ler e escrever a instância, com o token cifrado | `lib/whatsapp/instancia.ts` | 16/09 |
| Conectar, QR, desconectar e remover | `lib/whatsapp/actions.ts` | 16/09 |
| Webhook de mensagem recebida | `app/api/webhooks/zapi/receive/[segredo]/route.ts` | 16/09 |
| Webhook de status de entrega | `app/api/webhooks/zapi/status/[segredo]/route.ts` | 16/09 |
| Webhook de desconexão | `app/api/webhooks/zapi/disconnected/[segredo]/route.ts` | 16/09 |
| A tela de conexão, com polling controlado | `components/settings/whatsapp-conexao.tsx` | 16/09 |

## Integrações

| capacidade | onde | desde |
|---|---|---|
| Google Calendar e Gmail (OAuth aprovado) | `lib/integrations/google.ts` | 12/08 |
| Token cifrado em repouso | `lib/integrations/crypto.ts` | 12/08 |
| Fase do WhatsApp (hoje: `zapi`) | `lib/integrations/whatsapp-estado.ts` | 28/08 |

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
| Favicon por empresa, com cache local (CSP intacta) | `app/(dono)/dono/prospeccao/icone/route.ts` | 08/09 |
| **Ver o que vai sair, agrupado por modelo** | `app/(dono)/dono/mensagens/page.tsx` | 08/09 |
| Agrupar mensagem pelo que repete (10 modelos) | `lib/dono/mensagens.ts` | 08/09 |
| **A RESPOSTA do prospect entra no sistema** | `app/api/webhooks/evolution/route.ts` | 12/09 |
| Ler o payload da Evolution nos 3 formatos | `lib/prospeccao/mensagem-recebida.ts` | 12/09 |
| Reconhecer "não quero" numa resposta | `lib/prospeccao/opt-out.ts` | 12/09 |
| Opt-out por telefone, domínio ou e-mail | `lib/prospeccao/opt-out-queries.ts` | 12/09 |
| O prospect abordado, e o que houve depois | `supabase/migrations/0084_prospect_da_prospeccao.sql` | 12/09 |
| Registrar o envio no banco (rota local) | `app/(dono)/dono/prospeccao/enviado/route.ts` | 12/09 |
| Onde a prospecção grava e de onde ela lê | `lib/prospeccao/empresas.ts` | 12/09 |
| **O que a resposta QUER dizer (20 intenções, 12 objeções)** | `lib/prospeccao/classificacao.ts` | 12/09 |
| A leitura pela IA, com a blindagem do SDR reusada | `lib/prospeccao/classificar.ts` | 12/09 |
| O cron que lê o que chegou, aos :15 | `app/api/cron/classificar-respostas/route.ts` | 12/09 |
| **O painel: funil, objeções, nichos, ganchos, score** | `app/(dono)/dono/inteligencia/page.tsx` | 12/09 |
| A agregação que se RECUSA a mostrar taxa sem amostra | `lib/dono/inteligencia.ts` | 12/09 |

**A FASE 2 saiu em 12/09, na mesma madrugada.** A resposta deixou de ser texto
e virou categoria comparável: 20 intenções e 12 objeções fechadas, temperatura
com teto por intenção, e o painel que lê tudo isso. **A IA continua sem
responder ninguém** — ela lê e rotula.

**A regra que governa o painel:** contagem sempre, taxa só a partir de 100
abordagens no segmento. Cold outreach responde de 3,8% a 7,2%; com trinta
abordagens o esperado é UMA resposta, e a diferença entre uma e duas dobraria a
"taxa" por acaso. Onde a amostra não chegou, a tela diz **quantas faltam** em
vez de mostrar zero.

**A captura é FASE 1, e o que ela não faz é decisão.** Ela grava a resposta,
identifica o prospect pelo telefone, honra o opt-out e avisa o dono no
WhatsApp. Não classifica intenção, não trata objeção e **não responde
ninguém** — o agente SDR existe em `app/api/sdr/responder` e continua
desligado. Ligar a IA antes de existir amostra de respostas seria dar
inteligência a um sistema que ainda não enxerga nada.

**E o opt-out era pior do que a auditoria de 12/09 escreveu.** Ela registrou
que o disparo não lia `descadastro_de_prospeccao`; o problema era que os dois
lados não tinham campo em comum — a tabela guardava `email_hash` e a fila casa
por domínio e telefone. Mandá-la ler filtraria zero linhas para sempre. A 0083
deu à tabela uma chave única que carrega o canal no valor.

**REMOVIDO em 08/09, e o motivo importa mais que a remoção:** a pesquisa de
mercado do lado do CLIENTE saiu inteira na `0075` — o card em `/leads`, a
Server Action, o cron, as duas tabelas da 0072 e o tipo do sino da 0073.

Não foi custo. Em 08/09 as duas tabelas tinham **zero linhas desde que nasceram
em 06/09**: o recurso existia, o gate de Pro existia, o cron rodava a cada 15
minutos, e ninguém nunca pediu uma pesquisa. O que pesou foi carregar o Exa
como **suboperador fora do Brasil** na Política de Privacidade — transferência
internacional de dado de titular — por um caminho que ninguém percorreu.

A prospecção do dono não usava nada disso e continua inteira. Conferido por
importação antes de apagar: os quatro arquivos do lado do dono não importam
nada do lado do cliente, e o `prospectar.mjs` tem o próprio `fetch` ao Exa.

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
WhatsApp por API no PRODUTO                      a ponte saiu em 28/08 (c52a718) e
                                                 FASE_DO_WHATSAPP segue 'migrando'. O
                                                 webhook de 12/09 e da PROSPECCAO do
                                                 dono, resolve a empresa pelo NOME no
                                                 servidor, e nao devolve WhatsApp a
                                                 nenhum cliente. A Fase 2 do Max
                                                 (16/09) construiu o caminho inteiro
                                                 pela Z-API — provider, webhooks, QR
                                                 e envio —, e ele so vale para quem
                                                 tem `max_vigente()`. FASE_DO_WHATSAPP
                                                 passou a `zapi` no mesmo commit
envio de MIDIA pelo CRM                          so texto sai. A caixa RECEBE audio,
                                                 imagem, video, documento e figurinha
                                                 e guarda a referencia; mandar de
                                                 volta e Fase 3
resposta sugerida por IA na conversa             Fase 3. O SDR existe e segue desligado
conexao provada ponta a ponta                    0089 e 0090 NAO foram aplicadas, e
                                                 nenhum numero foi pareado. Todo o
                                                 caminho da Z-API esta escrito e NAO
                                                 exercitado contra o provedor real
IA respondendo o prospect sozinha                o SDR existe e esta DESLIGADO. Nem a
                                                 captura nem a classificacao o ligam
ligacao prospect -> cliente pagante              NAO existe. O painel PARA em
                                                 "interessados" de proposito: mostrar
                                                 "0 pagaram" leria como "ninguem chega
                                                 la", e a verdade e "nao ha como saber"
resposta sugerida para o dono aprovar            Fase 3, nao escrita
ranking por RECEITA                              depende da ligacao acima
campos e etapas customizaveis                    deal_stage e enum, em 10 arquivos de codigo
aprovacao online do orcamento pelo cliente       27% do mercado tem; o nosso e um
                                                 RELOGIO (validade + cobranca), nao um
                                                 fluxo de aprovacao — ver prd.md
itens / catalogo de produtos no orcamento        23% do mercado; aqui e texto livre
assinatura eletronica                            13% do mercado; nada escrito
snapshot mensal de metricas                      nao ha tabela; por isso a landing
                                                 nao mostra "+18% vs mes anterior"
fila ou SLA de suporte                           nao existe; por isso "suporte
                                                 prioritario" foi removido 3x
```
