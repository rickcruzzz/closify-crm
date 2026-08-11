# Estado atual do Velo Funil

Documento de continuidade. É lido no começo de toda sessão (referenciado no
[CLAUDE.md](../CLAUDE.md)) para que uma conversa nova — ou outra conta — comece
sabendo o que já foi feito, o que foi decidido e onde estão as armadilhas.

**Atualizado em:** 11/08/2026

> Mantenha este arquivo curto. O detalhe de _por que_ cada coisa é assim mora
> nas mensagens de commit e nos comentários do código, que são a memória real
> do projeto. Aqui fica só o que não cabe em nenhum dos dois: o estado.

## Onde o produto está

Em produção em <https://www.velofunil.com.br>, funcional, **sem clientes
pagantes ainda**. O fluxo de dinheiro foi auditado ponta a ponta e funciona:
pagamento confirmado libera o Pro, retry do Asaas é deduplicado, cancelamento
rebaixa, requisição sem token toma 401.

## Ambiente local quebrado desde 11/08 02:26

O `.env.local` foi substituído por um modelo em branco. **Produção não foi
afetada** — as variáveis dela vivem na Vercel, e o webhook continua devolvendo
401 sem token, o que prova que a chave real está lá.

Rode `node --env-file=.env.local scripts/verificar-ambiente.mjs` para ver o
estado atual. Hoje ele acusa:

| Variável              | Problema                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ASAAS_API_KEY`       | vazia                                                                                                          |
| `ASAAS_WEBHOOK_TOKEN` | vazia                                                                                                          |
| `RESEND_API_KEY`      | trocada; a chave atual é válida mas de uma conta **sem o domínio velofunil.com.br**, então todo envio falharia |

As do Supabase estão intactas. `NEXT_PUBLIC_APP_URL` aponta para
`localhost:3000`, o que é correto para desenvolvimento.

Como recuperar, na ordem: **histórico de versões do OneDrive** (clique direito
no `.env.local` → _Histórico de versões_ → restaurar a versão anterior a
11/08 02:26); ou `vercel env pull` **da conta que hospeda o domínio** — a que
estava logada no CLI (`estefanyy929a-gif`) tem 0 domínios e não é essa; ou
regerar nos painéis do Asaas e do Resend.

## Pendente do dono (não é código)

- [ ] **Colar de novo no painel do Supabase** (Authentication → Emails →
      Templates) os arquivos `confirmacao-cadastro.html` e
      `recuperacao-de-senha.html` — mudaram de `{{ .ConfirmationURL }}` para
      `{{ .RedirectTo }}?token_hash=...` (corrige o "link expirado" no
      clique). O painel não lê do repositório; sem colar de novo, produção
      continua com o link antigo e o defeito continua.
- [ ] **Pagar um Pix real de R$ 49** pelo próprio checkout. É o último elo sem
      prova — o webhook foi testado com evento real, mas pagamento de verdade
      ninguém simulou.
- [ ] **Cancelar 2 assinaturas de teste no Asaas** (`pedro eee`,
      `Henrique System`), que seguem gerando fatura mensal.
- [x] **Supabase → Authentication → Rate Limits**: subir "Rate limit for
      sending emails" de 30 para 100/hora. Feito.
- [ ] **Supabase → Authentication → Policies**: senha mínima de 6 para 8 e
      ligar _Leaked password protection_. A tela já exige 8; a API atrás dela
      aceita 6.
- [ ] **Vercel Pro + Supabase Pro** no primeiro cliente pagante. Vercel por
      regra (Hobby proíbe uso comercial); Supabase por **backup** — o Free não
      faz nenhum, e perder dado de cliente pago é problema jurídico.

## Decisões travadas — não refazer

| Decisão                                     | Motivo                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asaas, não Stripe**                       | Existe skill/agente de Stripe no repo; não se aplica ao billing                                                                                               |
| **Sem prova social inventada**              | A `StatsSection` já teve métrica falsa copiada de concorrente, removida de propósito. Só entra com cliente real                                               |
| **Login não revela se a conta existe**      | Distinguir "senha errada" de "conta inexistente" permite enumerar e-mails e alimenta phishing. O erro oferece "Criar conta" e "Recuperar acesso" em vez disso |
| **Logo do e-mail é tipografia, não imagem** | Gmail e Outlook bloqueiam imagem por padrão; cabeçalho com `<img>` aparece vazio                                                                              |
| **Google Sheets por API está fora**         | Exige `GOOGLE_CLIENT_ID`/`SECRET` e verificação do app pelo Google (semanas). A dor imediata já é coberta pela importação de CSV                              |

## Armadilhas já pagas — não repetir

**Regra que só vive na Server Action não é regra.** Server Action é endpoint
HTTP; quem chama o PostgREST direto com a chave pública (que está no HTML por
design) pula a validação. Três defeitos vieram disso: autoupgrade para Pro sem
pagar (migrations 0019→0022), limite de leads contornável (0023) e autoconvite
(0024). Limite de plano e permissão precisam de trigger no banco.

**`SECURITY DEFINER` troca o dono da execução, não o papel da sessão.** A 0019
liberava por `role = 'service_role'` e bloqueou o próprio webhook.

**Variável de sessão é forjável.** A 0021 liberava por uma marca posta pela
RPC; `set_config` é chamável por qualquer um e o ataque voltou a passar. Só
credencial secreta (service role) distingue de verdade.

**Fragmento de URL (`#access_token`) nunca chega ao servidor.** Causou três
bugs: reset de senha morto, confirmação de cadastro que não logava, e a troca
de senha que não acontecia (o `PUT /user` sumia na travessia navegador↔Server
Action). Tudo que depende da sessão de recuperação roda no cliente.

**O editor de templates do painel do Supabase** engasga com linha de mais de
mil caracteres e rejeita comentário condicional aninhado — o botão "Save"
simplesmente não responde, sem erro. Por isso os arquivos em
`supabase/email-templates/` são gerados com `paraPainelDoSupabase: true`.

**`{{ .ConfirmationURL }}` verifica o token no próprio GET, antes do clique.**
Causou "link expirado" em confirmação de cadastro e recuperação de senha —
qualquer requisição que visite o link primeiro (scanner de e-mail, antivírus,
preview de webmail como temp-mail.org) consome o token de uso único antes da
pessoa clicar de verdade. `confirmacao-cadastro.html` e
`recuperacao-de-senha.html` agora usam `{{ .RedirectTo }}?token_hash=...`,
que só carrega a página; a verificação (`verifyOtp`) espera um clique
explícito. Ver `supabase/email-templates/README.md`.

## Como verificar as coisas aqui

O padrão do projeto é **provar contra produção, não supor**. Scripts
descartáveis em Node no diretório de scratchpad, lendo `.env.local` com
`node --env-file=.env.local`, sempre limpando o que criaram:

- **RLS**: simular sessão real com `set local role authenticated` +
  `set local request.jwt.claims` e tentar a escrita indevida.
- **Billing**: bater no webhook de produção com o token real e conferir o
  plano no banco.
- **E-mail**: disparar de verdade e ler o resultado no log do Resend.
- **Auth**: criar conta descartável, exercitar o fluxo, apagar no `finally`.

Nunca deixar dado de teste para trás.

## Ferramentas

MCP do Supabase e Playwright vêm de plugins e ficam em `~/.claude.json`, que é
da máquina — não do login. O MCP do Stripe pede autorização e **não é usado**
(o projeto é Asaas). O Playwright caiu várias vezes; quando isso acontece, o
caminho é `curl` + análise do HTML, ou script Node contra a API.

## Últimos commits relevantes

| Commit    | O quê                                                              |
| --------- | ------------------------------------------------------------------ |
| `1a49eb6` | Troca de senha deixa de falhar em silêncio (movida para o cliente) |
| `faba2db` | Bloqueia autoconvite e convite para quem já é membro               |
| `04d8a4f` | Templates que o painel do Supabase aceita salvar                   |
| `206847c` | Identidade visual única em todos os e-mails                        |
| `c5ad888` | Impede upgrade sem pagamento; conserta a RPC do webhook            |

Para o resto: `git log` conta a história completa, com o porquê de cada
decisão.
