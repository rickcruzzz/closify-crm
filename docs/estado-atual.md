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
pagantes ainda** — conferido na API do Asaas: zero cobranças recebidas, nunca.
O fluxo de dinheiro foi auditado ponta a ponta e funciona: pagamento
confirmado libera o Pro, retry do Asaas é deduplicado, cancelamento rebaixa,
requisição sem token toma 401. O que ninguém provou é um Pix real.

Importação de planilha (`.xlsx` e `.csv`) entregue em 11/08, com mapeamento de
coluna, etapa lida do arquivo e criação de negócio junto do lead.

Ambiente local: rode `node --env-file=.env.local scripts/verificar-ambiente.mjs`.
Ele confere as 9 conexões e diz o que falta.

## Pendente do dono (não é código)

- [ ] **MEI baixado.** Se o CNPJ estiver inativo, a conta Asaas está em risco —
      quando o Asaas revalidar na Receita pode **bloquear a conta com o saldo
      dentro**. Hoje o `commercialInfo` ainda responde `status: APPROVED`, ou
      seja, ele não percebeu. É o item mais urgente.
- [ ] **Cobrança da Fani Mayara** (`fanimayara67@gmail.com`): usuária real
      (logou em 11/08, 1 lead), plano `free`, começou o checkout e nunca pagou.
      Tem 2 cobranças de R$ 49 em aberto que vão virar aviso de vencimento.
- [ ] **Pagar um Pix real de R$ 49** pelo próprio checkout. Último elo sem
      prova.
- [ ] **Supabase → Authentication → Policies**: senha mínima de 6 para 8 e
      ligar _Leaked password protection_. A tela já exige 8; a API atrás dela
      aceita 6.
- [ ] **Vercel Pro + Supabase Pro** no primeiro cliente pagante. Vercel por
      regra (Hobby proíbe uso comercial); Supabase por **backup** — o Free não
      faz nenhum, e perder dado de cliente pago é problema jurídico.
- [ ] **Sujeira em aberto:** os workspaces `Henrique System` e `pedro eee`
      estão `pro` com a assinatura já cancelada no Asaas. Cancelei por API e o
      banco não acompanhou; o webhook registrou 5 `SUBSCRIPTION_DELETED` sem
      aplicar. Causa não determinada — investigar antes de confiar no
      cancelamento automático.
- [x] Rate limit de e-mail de 30 para 100/hora. Feito.
- [x] Colar os templates `confirmacao-cadastro.html` e
      `recuperacao-de-senha.html` no painel. Feito e verificado com envio real:
      o link sai como `.../redefinir-senha?token_hash=…`.
- [x] Cancelar as assinaturas de teste no Asaas. Feito — eram 3, não 2.

## Decisões travadas — não refazer

| Decisão                                     | Motivo                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asaas, não Stripe**                       | Existe skill/agente de Stripe no repo; não se aplica ao billing                                                                                               |
| **Sem prova social inventada**              | A `StatsSection` já teve métrica falsa copiada de concorrente, removida de propósito. Só entra com cliente real                                               |
| **Login não revela se a conta existe**      | Distinguir "senha errada" de "conta inexistente" permite enumerar e-mails e alimenta phishing. O erro oferece "Criar conta" e "Recuperar acesso" em vez disso |
| **Logo do e-mail é tipografia, não imagem** | Gmail e Outlook bloqueiam imagem por padrão; cabeçalho com `<img>` aparece vazio                                                                              |
| **Google Sheets por API está fora**         | Exige `GOOGLE_CLIENT_ID`/`SECRET` e verificação do app pelo Google (semanas). A importação de planilha já cobre a dor                                          |
| **`read-excel-file`, não `xlsx` nem `exceljs`** | O `xlsx` do npm está parado em 0.18.5 com CVE-2023-30533 e CVE-2024-22363, sem correção publicada lá; o `exceljs` está sem release há anos                |
| **Lead precisa de e-mail OU telefone**      | A planilha do público-alvo é lista de WhatsApp. Com `email not null` ela importava zero linhas (migration 0025)                                               |

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

**Trigger que conta linhas precisa de `for update`.** A 0023 recusava a partir
de 50 leads, mas sob READ COMMITTED duas transações liam a MESMA contagem antes
de qualquer commit e as duas passavam — 51 leads num plano de 50. Corrigido na
0026 com `select ... for update` na linha do workspace.

**Fragmento de URL (`#access_token`) nunca chega ao servidor.** Causou três
bugs: reset de senha morto, confirmação de cadastro que não logava, e a troca
de senha que não acontecia (o `PUT /user` sumia na travessia navegador↔Server
Action). Tudo que depende da sessão de recuperação roda no cliente.

**`File.text()` decodifica sempre em UTF-8.** O Excel em português salva CSV em
Windows-1252, então "José Antônio" entrava no banco como `Jos� Ant�nio`, calado.
Medido em 11/08. A leitura passa por `decodificarPlanilha`, que tenta UTF-8 com
`fatal: true` e cai para Windows-1252 quando falha — nessa ordem, porque
Windows-1252 aceita qualquer byte e nunca falharia.

**`.in()` do PostgREST vira query string.** A dedupe da importação mandava até
1000 e-mails num `select`, e o gateway recusa: medido, 500 valores já dão 400 e
2000 dão 414. Pior, o código não olhava o `error`, então o conjunto de
duplicados saía vazio e a planilha inteira era reimportada em silêncio. Trocado
por leitura paginada do workspace.

**Erro do Postgres não chega à UI sozinho.** A mensagem de limite de plano da
trigger 0023 morria em `console.error` e virava "Não foi possível importar".
Quem trata `error.code === '42501'` é o TypeScript, e a mensagem boa precisa
existir dos dois lados.

**O editor de templates do painel do Supabase** engasga com linha de mais de
mil caracteres e rejeita comentário condicional aninhado — o botão "Save"
simplesmente não responde, sem erro. Por isso os arquivos em
`supabase/email-templates/` são gerados com `paraPainelDoSupabase: true`.

**`{{ .ConfirmationURL }}` verifica o token no próprio GET, antes do clique.**
Causou "link expirado" em confirmação de cadastro e recuperação de senha —
qualquer requisição que visite o link primeiro (scanner de e-mail, antivírus,
preview de webmail) consome o token de uso único antes da pessoa clicar. Os
dois templates usam `{{ .RedirectTo }}?token_hash=...`, que só carrega a
página; a verificação (`verifyOtp`) espera um clique explícito. Ver
`supabase/email-templates/README.md`.

**O nome do recebedor na fatura do Asaas não é editável.** O campo
`availableCompanyNames` da API traz só a razão social vinda da Receita — para
MEI sem nome fantasia registrado, há uma opção só. Mudar exige cadastrar o nome
fantasia no Portal do Empreendedor, e isso exige CNPJ ativo.

## Como verificar as coisas aqui

O padrão do projeto é **provar contra produção, não supor**. Scripts
descartáveis em Node no diretório de scratchpad, lendo `.env.local` com
`node --env-file=.env.local`, sempre limpando o que criaram:

- **RLS**: simular sessão real com `set local role authenticated` +
  `set local request.jwt.claims` e tentar a escrita indevida.
- **Limite de plano**: encher até o teto pelo PostgREST e conferir que a linha
  seguinte toma `42501`. Foi assim que a 0025 e a 0026 foram aceitas.
- **Billing**: bater no webhook de produção com o token real e conferir o
  plano no banco.
- **E-mail**: disparar de verdade e ler o resultado no log do Resend.
- **Auth**: criar conta descartável, exercitar o fluxo, apagar no `finally`.

Nunca deixar dado de teste para trás.

## Ferramentas

MCP do Supabase e Playwright vêm de plugins e ficam em `~/.claude.json`, que é
da máquina — não do login. **O MCP do Supabase já apareceu apontando para o
projeto errado** (`zjhgoaoctboxdtygdwjs`, vazio, de outra conta) enquanto o
`.env.local` usa `unydqzzjokhjwcqufehr`. Confira o projeto antes de aplicar
qualquer migration por ele. O MCP do Stripe pede autorização e **não é usado**
(o projeto é Asaas). Quando o Playwright cai, o caminho é `curl` + análise do
HTML, ou script Node contra a API.

## Últimos commits relevantes

| Commit    | O quê                                                              |
| --------- | ------------------------------------------------------------------ |
| `efcf2be` | Importação de planilha: Excel, mapeamento de coluna, negócio junto do lead |
| `b8b9ec0` | Descrição da cobrança que o cliente reconhece                      |
| `7b67e23` | Verificador de ambiente local                                      |
| `185f97c` | Link de confirmação deixa de morrer antes do clique                |
| `1a49eb6` | Troca de senha deixa de falhar em silêncio (movida para o cliente) |
| `faba2db` | Bloqueia autoconvite e convite para quem já é membro               |
| `c5ad888` | Impede upgrade sem pagamento; conserta a RPC do webhook            |

Para o resto: `git log` conta a história completa, com o porquê de cada
decisão.
