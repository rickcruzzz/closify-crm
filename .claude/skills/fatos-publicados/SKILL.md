---
name: fatos-publicados
description: "Confere se o que este projeto AFIRMA em público continua verdadeiro — CNPJ, oferta na bio e na landing, número citado em documento, credencial viva. Use quando o pedido for 'confira se está tudo certo', 'auditoria de marca', 'o que está desatualizado', 'isso ainda é verdade', 'antes de rodar tráfego', 'antes de publicar', 'revisar a bio', 'conferir CNPJ', 'os tokens estão vivos', 'o documento bate com o código'; e SEMPRE antes de investir em anúncio, submeter verificação a plataforma, ou publicar peça que cite preço, prazo ou limite de plano. Também use quando um número aparecer em dois lugares e você não souber qual está certo. Para escrever copy nova, veja copywriting; para melhorar texto existente, copy-editing; para instrumentar medição, analytics."
metadata:
  version: 1.0.0
---

# Fatos publicados

Este projeto não sangra por bug. Sangra por **afirmação que deixou de ser
verdade e ninguém viu.**

Os quatro portões — `tsc`, `lint`, `test`, `build` — não conseguem olhar para
nada disso. Eles leem o repositório. O que quebra vive fora dele: numa bio de
rede social, num registro da Receita, num token que expirou, num número
copiado de um documento que já estava errado.

## O que esta skill faz

Compara **o que está publicado** com **o que o código diz**, e nomeia a
divergência. Não escreve copy, não melhora texto, não sugere estratégia. Ela
responde uma pergunta só:

> Isto que estamos afirmando em público ainda é verdade?

## Quando rodar

Sempre antes destes quatro momentos, porque em todos eles uma afirmação falsa
custa dinheiro ou credibilidade:

```
investir em anuncio           mandar trafego para uma pagina que mente
submeter verificacao          a plataforma confere o dado contra a fonte
publicar peca com numero      preco, prazo ou limite errado vira reclamacao
sessao nova de trabalho       o documento que voce vai ler pode estar velho
```

E sempre que um número aparecer em dois lugares diferentes. Não escolha o mais
recente — vá à fonte.

## As quatro classes, e como conferir cada uma

Leia [references/fontes-externas.md](references/fontes-externas.md) para o
detalhe de cada fonte, os endpoints e o que cada resposta significa.

| classe | exemplo | fonte da verdade |
|---|---|---|
| **registro público** | CNPJ, situação na Receita | duas APIs independentes |
| **oferta publicada** | bio, landing, anúncio, e-mail | as constantes de `lib/` |
| **credencial** | tokens da Meta, Asaas, Resend | uma chamada real por chave |
| **número citado** | seguidores, empresas, testes | o comando que produz o número |

## O método, em quatro passos

**1. Liste o que está sendo afirmado.** Não o que você acha que está — leia a
bio, abra a landing, olhe o rodapé do e-mail. Afirmação que ninguém leu há
meses é onde o erro mora.

**2. Encontre a fonte de cada afirmação.** A fonte nunca é outro documento.
Para preço é `lib/plans.ts`; para CNPJ é a Receita; para "quantos testes" é
`npm test`.

**3. Compare, e registre a diferença com data.** Não basta corrigir: escreva
desde quando estava errado. É o que transforma um conserto em prevenção.

**4. Pergunte por que passou.** Toda divergência tem uma causa estrutural, e
ela costuma ser mais valiosa que o conserto. A bio ficou velha porque nada no
projeto lê bio. O token morreu em silêncio porque a API responde como se a
permissão tivesse sumido.

## As três regras

### Confira contra a FONTE, nunca contra o documento

Em 31/08 o `estado-atual.md` afirmava que uma conta era de cliente externo.
`lib/dono/contas-internas.ts` dizia o contrário, e estava certo — o e-mail
estava em `EMAILS_DO_DONO` desde que a lista existe.

Eu li o documento, acreditei, e propaguei o erro para uma decisão sobre
dinheiro. **O código estava certo o tempo todo.**

Documento é fotografia; código é o estado. Quando discordarem, o código ganha —
e se o código também for suspeito, vá à API, ao banco, ao registro público.

### Teste que trava o estado vigente vira mentira

Este teste existia e passava verde:

```ts
it('anuncia o trial vigente, não a oferta antiga', () => {
  expect(BIO_DO_PERFIL).toContain(`${DIAS_DE_TRIAL} dias`)
})
```

Ele foi escrito quando o trial existia. A migration 0057 removeu o trial em
29/08, e o teste continuou **exigindo** a oferta morta — protegendo o passado
em vez do presente.

Teste de fato publicado deve travar o que a fonte diz **hoje**, lendo a mesma
constante que a landing lê. E vale ter o irmão que proíbe a palavra da oferta
antiga, para o conceito não voltar por descuido.

### Divergência silenciosa é a regra

Nenhum dos achados registrados em
[references/armadilhas.md](references/armadilhas.md) gerou erro. Nem um.

Não espere que algo falhe. A varredura existe porque o silêncio é o
comportamento normal — CSP recusa imagem sem avisar, token expirado responde
como falta de permissão, bio velha simplesmente continua no ar.

## O que NÃO fazer

**Não escreva o próprio filtro para uma classificação que o projeto já tem.**
`ehContaDeTeste` (`lib/dono/contas-internas.ts`) existe desde 25/08. Em 29/08
alguém escreveu uma expressão regular na hora, e ela classificou **23 empresas
como externas quando são 6** — número plausível, sem nenhum sinal de estar
errado, repetido em quatro documentos antes de alguém conferir.

**Não corrija sem datar.** "Corrigido" sozinho não ensina nada. "Estava errado
desde 08/08, descoberto em 25/08, 17 dias" ensina que ninguém olha para isso.

**Não confie em número redondo.** Se um documento diz "3.555 seguidores" e a
fonte diz 10.357, o problema não é o número — é que nada no projeto lê o
perfil, e o próximo número também vai envelhecer.

## Saída esperada

Uma lista por classe, cada linha com: **o que está publicado**, **o que a fonte
diz**, **desde quando diverge** e **por que passou**. Sem essas quatro coisas o
achado não vale — vira lembrete que ninguém aciona.

Ao fim, uma pergunta explícita para cada divergência: isto é para corrigir
agora, ou é decisão do dono? CNPJ baixado não se conserta com código.