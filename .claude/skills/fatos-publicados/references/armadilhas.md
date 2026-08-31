# Armadilhas já pagas

Cada caso é real, com data e consequência. Não são hipóteses — são erros que
este projeto cometeu, e o custo de cada um está escrito.

O que todos têm em comum: **nenhum gerou erro.**

---

## 1. O documento estava errado, e o código estava certo

**31/08.** O `estado-atual.md` descrevia uma conta como *"o único cliente
externo que chegou a tentar assinar"*. `lib/dono/contas-internas.ts` a tinha em
`EMAILS_DO_DONO` desde que a lista existe.

Li o documento, acreditei, e usei isso para decidir sobre dinheiro: preservei a
notificação paga dela no Asaas "por ser a única usuária real". Errado nos dois
sentidos — não era cliente, e a decisão custou R$ 0,99 por aviso.

**Por que passou:** o documento tinha herdado o resultado de outro erro (o
regex do item 2), e ninguém o reconferiu contra a função oficial.

**A regra:** quando documento e código discordam, o código ganha. Se o código
também for suspeito, vá à API, ao banco ou ao registro público.

---

## 2. O filtro escrito na hora, e o número plausível

**29/08.** `ehContaDeTeste` existia desde 25/08, era usada por duas telas da
Central, e o comentário dela avisa que a lista precisa ser mantida à mão —
porque conta de `gmail.com` do dono nenhum filtro de domínio pega.

Alguém escreveu uma expressão regular sobre o e-mail em vez de importá-la. Ela
classificou **23 empresas como externas quando são 6** — e mesmo essas 6 têm
zero contato.

**O que torna caro:** o número errado é **plausível**. "39%, 6 de 9" parece
medição. Não há sinal de erro até alguém conferir a classificação — e nesse
intervalo a conclusão se espalha. Esta virou a evidência nº 1 de
`dor-de-mercado.md` e a conclusão de dois documentos de capacidade. **Quatro
documentos** repetindo o mesmo número errado.

**A regra:** quando existir função no projeto para uma classificação, use-a,
mesmo que escrever uma na hora pareça mais rápido. Duas cópias divergem, e a
que diverge em silêncio é a que você escreveu.

---

## 3. O teste que protegia o passado

**31/08.** Este teste existia e passava:

```ts
it('anuncia o trial vigente, não a oferta antiga', () => {
  expect(BIO_DO_PERFIL).toContain(`${DIAS_DE_TRIAL} dias`)
})
```

Escrito quando o trial era verdade. A migration 0057 removeu o reverse trial em
29/08, e o teste continuou **exigindo** a oferta morta — verde, protegendo o
que já não existia.

**Por que passou:** um teste escrito para travar o estado vigente congela o
estado do dia em que foi escrito. Ele não sabe que o produto mudou; sabe apenas
que o texto continua igual ao que ele exigiu.

**A regra:** teste de fato publicado trava o que a **fonte** diz hoje, lendo a
mesma constante. E vale ter o irmão que proíbe a palavra da oferta antiga —
`expect(bio).not.toMatch(/trial|dias com tudo liberado/i)`.

---

## 4. Derivar de constante não cobre mudança de oferta

**31/08.** `lib/dono/perfil-instagram.ts` foi criado em 25/08 exatamente para
impedir bio desatualizada, derivando de `DIAS_DE_TRIAL` e `PRO_PLAN_PRICE`.
Falhou duas vezes, por caminhos diferentes.

```
bio publicada    "Gratis ate 300 contatos"   o Free e 50, ha meses
bio no codigo    "7 dias com tudo liberado"  removido pela 0057
```

**A distinção que importa:** derivar de constante protege contra mudança de
**valor** — 300 para 50 se corrigiria sozinho. Não protege contra mudança de
**oferta**: quando o conceito inteiro some, a interpolação continua compilando.

**A regra:** para conceito que pode deixar de existir, o teste proíbe a
palavra, não confere o número.

---

## 5. O número que triplicou sem ninguém ver

**31/08.** O `estado-atual.md` registrava **3.555 seguidores**, medido em
25/08. O HTML público dizia **10.357**.

Quase o triplo, em seis dias, e ninguém percebeu — porque nada neste projeto lê
o perfil. Junto com isso: **zero posts**. As artes de 29/08 foram geradas e
nunca subiram.

**A regra:** número de fonte externa envelhece por padrão. Se nenhum código lê
aquela fonte, o número no documento é uma fotografia com data — e deve ser
escrito com a data ao lado.

---

## 6. A CSP que recusa em silêncio

**27/08 a 31/08.** `img-src` não listava o domínio do Storage do Supabase. Toda
imagem de `createSignedUrl` era recusada: a **logo que o cliente sobe** em
Configurações e os anexos de suporte.

Três dias no ar. Sem erro na tela, sem linha em `error_logs`. O único registro
fica no console do navegador de quem estivesse com ele aberto.

**Por que a prova de 27/08 não pegou:** quando a CSP virou bloqueio, o teste
daquele dia exercitou rotas que não exibiam imagem do Storage.

**A regra:** ao ligar uma política restritiva, liste o que ela pode quebrar
**antes** e exercite cada item. Política que recusa em silêncio não avisa
quando você errou o escopo.

---

## 7. O token cujo erro mente sobre a causa

**29/08 e 31/08, duas vezes.** `META_ADS_TOKEN` devolvia:

```
"API access blocked."   OAuthException, code 200
```

A leitura foi "a conta da Meta foi bloqueada". Errado — a conta estava ativa
com método de pagamento. O token é que tinha vencido.

Ficou dois dias assim, com `/dono/anuncio` cega, e ninguém soube.

**A regra:** antes de concluir bloqueio de conta, teste a mesma conta por outro
caminho. Se um caminho responde e o outro não, o problema é a credencial, não a
conta.

---

## 8. Duas contas autenticadas ao mesmo tempo

**31/08.** Um intermediário (Windsor.ai) estava logado em duas identidades
diferentes: o MCP numa conta, a chave de API noutra.

```
MCP           "Instagram nao conectado"
chave de API  a conta, com 10.355 seguidores
```

**As duas respostas estavam certas.** A pergunta "está conectado?" deixou de
ter resposta única, e a investigação girou por quase uma hora.

**A regra:** ao verificar credencial, confirme **qual identidade** está
respondendo. Se a mesma pergunta tiver duas respostas, procure duas contas
antes de procurar defeito.

---

## 9. Números que só existem em imagem

**19/08 e 24/08.** Prints do produto na landing mostravam vocabulário que a
própria página tinha banido — capturados 53 minutos antes da renomeação.

Um commit chamado *"os prints mostravam o vocabulário que a landing baniu"*
verificou que o script rodou, **não que o arquivo ficou certo**. Dois dos seis
seguiram errados.

**A regra:** print é o único artefato que não acompanha refatoração. Nenhum
`tsc`, `lint` ou `test` olha dentro de imagem — a única prova é abrir o arquivo
e olhar.

---

## 10. Ler o campo errado e concluir com confiança

**31/08, duas vezes na mesma varredura, e as duas ao *testar* esta skill.**

**`cnpj` lido da declaração de tipo.** Um `grep` por `cnpj` em `lib/legal.ts`
casou primeiro com a linha 18 — `cnpj: string | null`, que é o **tipo** — e a
verificação concluiu que a landing exibia CNPJ. O valor real está na linha 60:
`cnpj: null`. A conclusão saiu invertida.

**`expires_at: 0` convertido para data.** A Graph API usa zero para "não
expira". Convertido ingenuamente, virou `31/12/1969`, e a verificação alertou
"renovar já" sobre um token perfeito.

**Por que ambos são a mesma falha:** o comando rodou, não deu erro, e imprimiu
uma frase confiante. Verificação que não erra alto é pior que verificação
nenhuma — ela dá a sensação de cobertura.

**A regra:** ao ler campo de arquivo ou de API, confira o que veio antes de
concluir. Valor sentinela (`0`, `-1`, `null`, string vazia) quase sempre
significa algo, e quase nunca significa o que a conversão direta sugere.
