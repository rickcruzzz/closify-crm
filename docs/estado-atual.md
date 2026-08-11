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

## Pendente do dono (não é código)

- [ ] **Pagar um Pix real de R$ 49** pelo próprio checkout. É o último elo sem
      prova — o webhook foi testado com evento real, mas pagamento de verdade
      ninguém simulou.
- [ ] **Cancelar 2 assinaturas de teste no Asaas** (`pedro eee`,
      `Henrique System`), que seguem gerando fatura mensal.
- [ ] **Supabase → Authentication → Rate Limits**: subir "Rate limit for
      sending emails" de 30 para 100/hora.
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
