# Templates de e-mail do Supabase Auth

Os quatro arquivos `.html` desta pasta são para **copiar e colar no painel do
Supabase**. Nada aqui é aplicado por código: a API de configuração de Auth do
Supabase não expõe SMTP nem templates, então esta é uma etapa manual.

Todos foram gerados a partir de `lib/emails/layout.ts` — o mesmo layout usado
no e-mail de convite que sai pelo Resend. É o que garante que os e-mails de
autenticação e os do produto pareçam a mesma empresa.

## Configurar o envio (uma vez)

**Authentication → Emails → SMTP Settings**, ativar _Enable Custom SMTP_:

| Campo                           | Valor                                  |
| ------------------------------- | -------------------------------------- |
| Sender email                    | `suporte@velofunil.com.br`             |
| Sender name                     | `Velo Funil`                           |
| Host                            | `smtp.resend.com`                      |
| Port number                     | `465`                                  |
| Username                        | `resend`                               |
| Password                        | a API key do Resend (começa com `re_`) |
| Minimum interval between emails | **`1`** (o padrão é `60`)              |

> **O campo do intervalo é o que mais causa suporte.** O padrão de 60 segundos
> existe para proteger o SMTP compartilhado do Supabase. Com SMTP próprio ele
> vira um gargalo artificial: dois cadastros no mesmo minuto e o segundo recebe
> `email rate limit exceeded` e **nunca** recebe o e-mail. O sintoma chega como
> "não recebi a confirmação" e é intermitente, portanto difícil de reproduzir.

**Authentication → Rate Limits** → _Rate limit for sending emails_: subir para
`100`/hora. Com SMTP customizado o padrão é 30/hora; 100 é folgado para começar
e ainda freia abuso.

**Authentication → URL Configuration**: conferir que _Site URL_ é
`https://www.velofunil.com.br` e que _Redirect URLs_ cobre
`https://www.velofunil.com.br/**`. O `{{ .ConfirmationURL }}` dos templates é
construído a partir desses valores — template certo com Site URL errada gera
link quebrado.

### Recomendação: uma API key só para isto

Criar no Resend uma key dedicada, escopo _sending only_, nomeada
`supabase-smtp`, em vez de reusar a `RESEND_API_KEY` da Vercel. Duas razões:
se a key vazar, revoga-se apenas ela sem derrubar o convite de colaborador; e
uma rotação na Vercel deixa de parar os e-mails de autenticação em silêncio.

## Colar os templates

**Authentication → Emails → Templates.** Para cada aba, colar o conteúdo do
arquivo em _Message body (HTML)_ e ajustar o _Subject heading_. **Salvar uma
aba por vez** — o painel não salva todas de uma vez.

| Aba do painel  | Arquivo                     | Subject heading                     |
| -------------- | --------------------------- | ----------------------------------- |
| Confirm signup | `confirmacao-cadastro.html` | `Confirme seu e-mail no Velo Funil` |
| Reset password | `recuperacao-de-senha.html` | `Redefinição de senha — Velo Funil` |
| Magic Link     | `magic-link.html`           | `Seu link de acesso ao Velo Funil`  |
| Invite user    | `convite.html`              | `Convite para o Velo Funil`         |

### Sobre `convite.html`

É o template do `inviteUserByEmail` do Supabase Auth, que **o produto não
usa**: o convite de colaborador grava em `workspace_invites` e é enviado pelo
Resend em `lib/workspace/actions.ts`, com o layout de `lib/emails/convite.ts`.

Está preenchido mesmo assim porque o Supabase dispara esse template se alguém
convidar um usuário pelo painel — e um e-mail sem marca saindo de um domínio
verificado é pior do que nenhum.

## Quando regerar

Estes `.html` são cópias estáticas. Se `lib/emails/layout.ts` mudar, o snapshot
em `lib/emails/layout.test.ts` falha — é o alarme de que os arquivos daqui
ficaram para trás e precisam ser regerados e colados de novo no painel.

## Verificar depois de configurar

1. Disparar um "esqueci minha senha" real e conferir que o e-mail chega, que o
   remetente é `suporte@velofunil.com.br` e que o botão leva à página certa.
2. Conferir em <https://resend.com/emails> que os e-mails do **Auth** aparecem
   no log. É a prova de que o SMTP customizado foi de fato adotado — sem isso,
   o Supabase continua enviando pelo servidor dele e a configuração não pegou.
3. Abrir um dos e-mails no Gmail em **modo escuro**. O card deve continuar
   legível e o botão deve manter a cor da marca.
