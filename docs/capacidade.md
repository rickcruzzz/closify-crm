# Capacidade do Velo Funil: o que aguenta, medido

Avaliação pedida em 30/08/2026: **o sistema suporta 1.000 clientes
simultâneos?** E qual o máximo atual sob uso recorrente?

Este documento separa três coisas de propósito, porque misturá-las é como se
inventa um número: **comprovado** (medido, com o comando registrado),
**estimado** (derivado de medição, com a conta à vista) e **não verificável**
com o que existe hoje.

---

## Resposta direta

**Não sei se suporta 1.000 simultâneos, e ninguém sabe** — a suíte que
responderia isso existe em `scripts/load-test/k6/` e **nunca foi executada**.
Há o gerador de relatório (`scripts/load-test/report/build-report.mjs`) e
nenhum relatório.

O que sei é o que segue, e o mais importante é a distância entre 1.000
*cadastrados* e 1.000 *simultâneos*: a segunda pergunta nunca foi feita a esta
base.

---

## Capacidade COMPROVADA

| medição | quando | resultado |
|---|---|---|
| 15 requisições simultâneas, fluxo de webhook completo | 23/08 | **28,4 req/s**, p95 550ms, **85 de 85 sem falha** |
| 5 simultâneas | 23/08 | 15,2 req/s, p95 378ms |
| sequencial | 23/08 | 3,1 req/s, p95 646ms |

Registrado em [estado-atual.md](estado-atual.md). O laço fechou inteiro: 86
mensagens viraram 86 contatos, 86 atividades e 86 tarefas.

**15 simultâneas é o maior número comprovado deste sistema.** Não porque 16
falhe — porque ninguém tentou 16.

---

## O que a medição de 30/08 acrescentou, e o que ela NÃO prova

Rodada contra produção, sessão autenticada real, RLS ligada, três consultas
por navegação (a mesma tríade que a tela do Funil dispara):

```
concorrencia   vazao      p50       p95      falhas   rede   http
    1          2,0/s     542ms     693ms       0       0      0
   10          0,5/s    7966ms   21304ms       4       4      0
   30          1,4/s   21330ms   21351ms      77     180      0
   60          2,8/s   21359ms   21441ms     170     446      0
  100          4,7/s   21362ms   21385ms     247     662      0
```

**A coluna que decide é a última: `http = 0` em todos os níveis.**

`rede` conta conexão TCP que nem abriu. `http` conta requisição que chegou ao
servidor e foi recusada. Em 662 falhas, **o servidor nunca recusou uma
requisição sequer**. O que saturou foi a máquina de onde o teste saiu.

Prova adicional: subir o pool do cliente de ~6 para 256 conexões **piorou** o
resultado (10 simultâneas passou de 0 para 4 falhas). Se o teto fosse do
servidor, mais conexões do cliente não mudariam nada; abrir mais soquetes numa
máquina que já não dá conta piora.

**Conclusão honesta: esta medição não mede o sistema.** Ela mede o que a
máquina de desenvolvimento consegue emitir. O plano de teste do projeto já
previa isso por escrito — *"CPU/rede local podem saturar antes da app"*.

O único dado aproveitável dela: **zero erro de servidor até 100 tentativas
simultâneas**.

---

## Gargalos, do mais duro para o mais frouxo

### 1. `max_connections = 60` no Postgres — medido

```sql
select current_setting('max_connections')  ->  60
em uso agora: 13   ativas: 1   shared_buffers: 224MB
```

**Não significa 60 clientes.** O app não abre conexão com o Postgres: ele fala
com o PostgREST por HTTPS, e o PostgREST mantém um pool próprio. Mil clientes
navegando compartilham as conexões daquele pool.

O que esse número limita de verdade é a soma de PostgREST + pooler + qualquer
script direto. É o teto mais duro que existe aqui, e é o primeiro a investigar
se algo estourar.

**Não verificável hoje:** quantas conexões o PostgREST de fato reserva. Não é
exposto na API de gerenciamento.

### 2. O teto de 1.000 linhas do PostgREST — documentado e já pago

Medido em 12/08 com 1.100 negócios: o app recebe 1.000 e **não recebe erro**.
Três funções foram corrigidas por causa disso (migrations 0032, 0033).

Não é gargalo de concorrência, é de **tamanho de cliente**: uma empresa com
mais de 1.000 negócios numa etapa quebra em silêncio. Qualquer consulta nova
sem `.limit()` explícito herda o defeito.

### 3. Vercel — não é gargalo no horizonte visível

```
regiao das funcoes   gru1 (Sao Paulo, junto do banco)
Fluid Compute        ligado
timeout padrao       300s
```

A migração para `gru1` em 22/08 derrubou `/dashboard` de 1221ms para 400ms —
antes as funções rodavam em Washington com o banco em São Paulo.

Serverless escala horizontalmente por natureza. O plano Pro não tem teto de
concorrência que 1.000 clientes de um CRM alcancem.

### 4. Armazenamento — resolvido hoje, e a conta importa

`error_logs` era a única tabela de sistema **sem purga**, e cresce por linha de
texto. A migration 0059 acrescentou (90 dias para erro de cliente, 14 para
interno), fechando a última.

A conta que sustenta: a 0047 nasceu com purga porque, projetada a 400 clientes,
a tabela de dedupe chegaria a **9,7 GB em 12 meses** e estouraria o plano do
Supabase em ~9 meses. `error_logs` tinha o mesmo desenho.

Banco hoje: **14 MB**, 39 empresas.

---

## Capacidade ESTIMADA, com a conta à vista

A estimativa parte da única medição de sistema que existe (23/08) e do perfil
de uso real deste produto — **não de um número escolhido**.

```
medido            15 simultaneas -> 28,4 req/s sustentadas

uso real          1 CRM de PME e usado em rajadas curtas, algumas vezes
                  ao dia. O banco mostra 255 escritas em agosto INTEIRO —
                  mas TODAS de contas de teste do dono. Nao ha uso de
                  cliente para observar (ver dor-de-mercado.md).

perfil suposto    1.000 clientes, 100 acoes/dia cada = 100.000 acoes/dia
                  media:  100.000 / 86.400s = 1,2 req/s
                  pico:   ~10x a media = 12 req/s

folga             28,4 / 12 = 2,4x
```

**Estimativa: 1.000 clientes com esse perfil cabem, com ~2,4x de folga sobre o
pico** — desde que "simultâneos" signifique *cadastrados e ativos no dia*.

**Se "1.000 simultâneos" significar 1.000 pessoas com requisição no ar no mesmo
segundo, a resposta é: não sei, e a folga acima não se aplica.** Esse número é
ordem de grandeza de rede social, não de CRM de PME, e exigiria a suíte k6.

O `100 ações/dia por cliente` é a suposição mais frágil desta conta, e não há
como calibrá-la: as 255 escritas de agosto são todas de contas de teste do
dono. **Não existe um único cliente externo com um contato cadastrado**, então
não há uso real de que derivar o perfil. O número veio de uso típico de CRM de
PME, não desta base.

---

## Limitações desta análise, ditas na cara

1. **A suíte de carga nunca rodou.** `scripts/load-test/k6/` tem perfil de
   1.000 VUs configurado (`lib/config.js`) e nenhum resultado gravado. É o
   único caminho para transformar a estimativa em comprovação.

2. **Não há ambiente de teste.** Rodar 1.000 VUs contra produção afetaria
   cliente real. O projeto não tem staging com dado próprio.

3. **A medição de 30/08 mediu minha máquina**, como demonstrado acima.

4. **Nenhuma medição cobre render de página.** Tudo o que foi medido é
   API/banco. O custo de renderização RSC na Vercel sob carga é desconhecido —
   e a auditoria de 19/08 já achou 8,4s numa aba de Configurações sem carga
   nenhuma.

5. **Sem observabilidade em produção.** Não há métrica contínua de latência,
   taxa de erro ou saturação. Cada número deste documento veio de uma medição
   pontual feita à mão.

---

## O que eu faria antes de precisar da resposta

```
1. rodar a suite k6 que ja existe, do perfil menor ao maior,
   contra um projeto Supabase descartavel (nao producao)
2. so entao afirmar um numero
```

Enquanto isso: a base tem **39 empresas**, das quais **33 são teste ou conta
interna** pela função oficial `ehContaDeTeste`, e as 6 restantes têm zero
contato cada uma.

O risco de capacidade é hipotético. E o de retenção **não é medido** — não há
cliente externo para medir. A versão anterior deste parágrafo afirmava "6 de 9
usaram por zero dia", número que veio de uma classificação errada minha e foi
retirado em 30/08 (ver `dor-de-mercado.md`).

Capacidade não é o que trava a venda hoje. O que falta é tráfego, que ainda
não rodou.

---

## Arquivos e comandos desta avaliação

```
scripts/load-test/k6/lib/config.js      perfis, ate 1.000 VUs — nunca executado
scripts/load-test/report/               gerador de relatorio, sem relatorio
docs/load-test/plano-de-teste.md        12 cenarios, criterios de saude
docs/estado-atual.md                    a medicao de 23/08

medicoes feitas em 30/08:
  select current_setting('max_connections')            -> 60
  pg_stat_activity                                     -> 13 em uso, 1 ativa
  pg_database_size                                     -> 14 MB
  GET /v9/projects/{id}                                -> gru1, Fluid ligado
  navegacao autenticada 1..100 simultaneas             -> http:0 em todos
```

Critério de saúde usado: o do próprio plano do projeto — p95 < 500ms saudável,
> 1000ms atenção, erro > 1% ruim.
