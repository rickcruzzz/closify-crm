# Onde cada fato vive, e como conferir

Cada entrada tem o comando ou endpoint que produz a verdade. Nenhuma diz "veja
no painel" sem dizer o que procurar lá.

---

## 1. Registro público — CNPJ e situação na Receita

**Onde é afirmado:** rodapé da landing, seção de confiança, páginas legais,
rodapé de todo e-mail transacional, avisos de fatura. Seis lugares, todos
derivados de `CONTROLADOR` em `lib/legal.ts`.

**Como conferir — duas fontes independentes, sempre:**

```
https://brasilapi.com.br/api/cnpj/v1/<cnpj>
https://minhareceita.org/<cnpj>
```

As duas espelham a Receita. Uma só pode estar com cache velho; duas
concordando é evidência.

**O que olhar na resposta:**

```
descricao_situacao_cadastral    ATIVA | BAIXADA | SUSPENSA | INAPTA
data_situacao_cadastral         desde quando
motivo_situacao_cadastral       o porque da baixa
```

**O que já aconteceu aqui:** `64.543.748/0001-13` está **BAIXADO desde
08/08/2026**, motivo "EXTINÇÃO POR ENCERRAMENTO, LIQUIDAÇÃO VOLUNTÁRIA". Ficou
exibido na landing por 17 dias — numa seção cujo texto de abertura diz *"em vez
de pedir confiança, mostramos onde ela pode ser conferida"*. A página convidava
a conferir, e a consulta desmentia a página.

**Como está protegido hoje:** `CONTROLADOR.cnpj` é `string | null`, e duas
funções puras decidem o texto. Sem inscrição, some o número e fica o nome — a
LGPD (Art. 9º, I) exige controlador identificado. Um teste trava que a palavra
"CNPJ" nunca apareça sem número ao lado.

---

## 2. Oferta publicada — bio, landing, anúncio, e-mail

**A fonte é sempre `lib/`, nunca outro texto:**

```
lib/plans.ts       FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, PRO_PLAN_PRICE
lib/legal.ts       CONTROLADOR
```

**Onde a oferta é afirmada:**

| lugar | arquivo ou fonte |
|---|---|
| landing | `components/landing/*.tsx` |
| bio do Instagram | `lib/dono/perfil-instagram.ts` **e** o perfil real |
| e-mail transacional | `lib/emails/*` |
| páginas legais | `app/(legal)/*` |
| criativo publicado | `marketing/**` e o que já foi ao ar |

**A armadilha desta classe, e ela é sutil:** derivar de constante protege
contra mudança de **valor**, não de **oferta**.

Se `FREE_LEAD_LIMIT` mudasse de 50 para 80, a bio se corrigiria sozinha. Mas
quando a migration 0057 removeu o reverse trial **inteiro**, a interpolação
`${DIAS_DE_TRIAL} dias` continuou compilando e virou mentira em silêncio. A
landing foi corrigida no mesmo dia; a bio, dois dias depois.

**Conferir o publicado, não só o código.** O HTML público do Instagram traz
nome e contagem sem login:

```
curl -s -A "Mozilla/5.0" https://www.instagram.com/<perfil>/ \
  | grep -o 'og:description" content="[^"]*"'
```

Ele **não** traz a bio nem se a conta é profissional — esses só no app.

---

## 3. Credencial — os tokens

**O parente próximo:** `scripts/verificar-ambiente.mjs` já confere 9 conexões.
Rode-o primeiro; esta seção cobre o que ele não alcança.

| variável | como testar | o que significa falhar |
|---|---|---|
| `META_INSTAGRAM_TOKEN` | `GET /v23.0/me` | publicação e leitura param |
| `META_ADS_TOKEN` | `GET /me/adaccounts` | `/dono/anuncio` fica cega |
| `META_CONVERSIONS_API_TOKEN` | evento de teste | conversão para de medir |
| `ASAAS_API_KEY` | `GET /v3/customers?limit=1` | checkout quebra |
| `RESEND_API_KEY` | `GET /domains` | e-mail para de sair |

**Prazo de validade, medido:**

```
token de usuario do Explorer    1 a 2 HORAS
token de longa duracao          60 dias   (npm run renovar:token-meta)
token de usuario do sistema     nao expira — exige verificacao do negocio
```

**O sintoma engana, e é o que torna esta classe perigosa.** Token expirado não
responde "expirou". A Graph API devolve:

```
"API access blocked"                      OAuthException, code 200
"Session has expired on <data>"           code 190, subcode 463
```

O primeiro parece bloqueio de conta; o segundo só aparece se alguém ler a
mensagem inteira. Em 29/08 o `META_ADS_TOKEN` ficou **dois dias morto** e a
leitura foi "a conta da Meta foi bloqueada" — errada. A conta estava ativa; o
token é que tinha vencido.

**Conferir prazo — e há dois prazos, não um:**

```
GET /v23.0/debug_token?input_token=<token>&access_token=<token>
```

```
expires_at               0 = NAO EXPIRA. Qualquer outro valor e a data.
data_access_expires_at   quando o acesso a DADOS vence (politica de 90
                         dias da Meta), mesmo com o token vivo
is_valid                 se responde agora
```

**`expires_at: 0` é a armadilha desta leitura.** Zero parece "expirou em
1969" se convertido ingenuamente para data — e foi exatamente o que aconteceu
em 31/08, quando a verificação imprimiu `31/12/1969` e concluiu "renovar já".
O token estava perfeito e sem prazo.

**E os dois prazos discordam de propósito.** A troca por token longo respondeu
`expires_in: 60 dias`, mas o `debug_token` do resultado diz `expires_at: 0`
com `data_access_expires_at` três meses à frente. Não são contraditórios:
o token não vence, o *acesso a dados* vence se ficar 90 dias sem uso.

Trate `expires_at: 0` como "sem prazo" e vigie `data_access_expires_at`.

---

## 4. Número citado em documento

**Regra única: o número vem do comando, nunca de outro documento.**

```
testes         npm test
migrations     ls supabase/migrations/*.sql
tabelas / RPC  OpenAPI do PostgREST de producao
empresas       contagem no banco, filtrando com ehContaDeTeste
seguidores     og:description do perfil publico
gasto de ads   /act_<id>?fields=amount_spent
```

**Tabelas e RPCs:**

```js
const s = await (await fetch(`${SUPABASE_URL}/rest/v1/?apikey=${KEY}`,
  { headers: { Accept: 'application/openapi+json' } })).json()

Object.keys(s.definitions).length                              // tabelas
Object.keys(s.paths).filter(p => p.startsWith('/rpc/')).length  // RPCs
```

**O que essa contagem NÃO pega, e já custou três vezes:** função reescrita por
dentro não move nenhum número. A 0055 reescreveu `pro_vigente()`, a 0056 criou
uma `returns trigger` que o PostgREST não expõe, e a 0057 mudou
`create_workspace_with_admin` — nas três, o catálogo ficou idêntico enquanto a
regra de negócio mudava.

Para essa classe, compare o **corpo** das funções entre versões, não a lista.

**Contar empresa ou cliente:** use `ehContaDeTeste` de
`lib/dono/contas-internas.ts`. Nunca escreva o filtro na hora — ver
[armadilhas.md](armadilhas.md).

---

## 5. Plataforma — o que só o painel responde

Fatos que nenhuma API entrega, e por isso precisam de alguém olhando:

```
conta do Instagram e profissional?    Configuracoes > Tipo de conta
Pagina do Facebook vinculada?         Instagram > Editar perfil > Pagina
categoria da Pagina                   Configuracoes da Pagina
verificacao do negocio                Business Manager
```

**Parcialmente conferível por API**, quando há token com `business_management`:

```
GET /me/businesses?fields=name,verification_status
    not_verified | pending_submission | verified

GET /me/accounts?fields=name,category,instagram_business_account{username}
    lista vazia = nenhuma Pagina com Instagram vinculado
```

Uma lista vazia aqui é ambígua de propósito: pode ser falta de vínculo, falta
de permissão no token, ou a Página estar noutro portfólio. **Distinga antes de
concluir** — em 31/08 uma consulta ao business errado devolveu vazio e a
conclusão foi "não existe Página", quando ela existia noutro portfólio.