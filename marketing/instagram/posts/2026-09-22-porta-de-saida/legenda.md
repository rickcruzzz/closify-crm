# Legenda, carrossel-4-porta-de-saida

Copie daqui para baixo, ate a linha de corte.

---

Todo CRM ensina a entrar. Pergunte como se sai.

A duvida que trava a assinatura quase nunca e o preco. E imaginar o dia em que
voce quer trocar de ferramenta e descobre que a sua base de clientes ficou la
dentro.

Aqui entrar e sair custam a mesma coisa: um clique de cada lado. Voce sobe a
planilha e o funil monta sozinho. Voce baixa tudo em CSV pela mesma tela, e o
arquivo abre no Excel em portugues, com acento e virgula decimal.

Sem fidelidade, sem multa e sem abrir chamado. Esta escrito nos nossos Termos,
nao numa legenda.

E um numero sobre a gente: auditamos a propria pagina em setembro e a porta de
entrada aparecia em seis lugares, cada um com frase propria. A saida aparecia
em um, sem frase nenhuma. Consertamos a nossa. Confira a do seu.

Gratis ate 50 contatos, sem cartao. Depois, R$ 97 por mes pela empresa
inteira, nao por vendedor.

Link na bio.

#crm #pequenaempresa #vendas #gestaodevendas #marcenaria #dedetizacao #lgpd

---

## Por que este tema

Os OITO posts ja publicados foram lidos pela Graph API em 22/09. O perfil ja
disse, no ar: orcamento que sumiu (09/09), WhatsApp guarda a conversa (02/09),
o pedagio de digitacao (01/09), negocio sem proximo passo, memoria nao guarda
cliente, 21x em cinco minutos, e o vendedor que sai levando a carteira (31/08).

**A porta de saida nunca foi publicada.** E e a objecao REAL, medida em 07/09:
*"a objecao real e 'e se eu quiser sair?', nao preco"*.

## Cada afirmacao, e onde ela se confere

    "sem fidelidade, sem multa"   app/(legal)/termos, secao 5, no ar
    "exporta em CSV"              app/api/leads/exportar/route.ts
    "os dois botoes lado a lado"  components/leads/leads-page-client.tsx:354
    "abre no Excel em portugues"  lib/leads/exportar-csv.ts, separador `;` + BOM
    "1 de 6"                      auditoria da landing, 07/09, em docs/estado-atual.md
    "R$ 97 pela empresa"           lib/plans.ts

## O que NAO copiar

**Os dois numeros sao derivados** de `FREE_LEAD_LIMIT` e `PRO_PLAN_PRICE`, em
`lib/plans.ts`. Se o preco mudar, esta legenda mente em silencio.

**Sem acento de proposito**, para sobreviver a colagem entre terminal, editor e
app. Ao publicar, acentue. **Sem travessao**, como toda copy daqui desde 31/08.

## Como publicar

```sh
node --env-file=.env.local scripts/marketing/publicar-instagram.mjs   marketing/instagram/posts/2026-09-22-porta-de-saida/carrossel-4-porta-de-saida --confirmar
```

Sem `--confirmar` ele roda em ensaio. **Os nomes dos arquivos nao podem mudar:**
o publicador recebe um PREFIXO e ordena por `-N.png`.
