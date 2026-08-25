# Estado atual do Velo Funil

Documento de continuidade. É lido no começo de toda sessão (referenciado no
[CLAUDE.md](../CLAUDE.md)) para que uma conversa nova, ou outra conta, comece
sabendo o que já foi feito, o que foi decidido e onde estão as armadilhas.

**Atualizado em:** 25/08/2026, noite (diagnóstico do sistema inteiro, 15
achados que nenhum dos quatro portões enxerga; e a assinatura passou a avisar
4 dias antes, inclusive quem está em trial e nunca recebia e-mail nenhum)

**Antes disso, 25/08/2026, tarde** (o CNPJ que a landing exibia como prova
de confiança está BAIXADO desde 08/08; e o Business da Meta nunca foi
submetido, apesar de este documento afirmar as duas coisas ao contrário)

**Antes disso, 25/08/2026, madrugada** (a Central passou a mostrar quem
está decidindo AGORA; a API de anúncio da Meta ligada e a tela de Anúncio viva
pela primeira vez; e a bio do Instagram vendia a oferta que a 0051 aposentou,
para 3.555 seguidores)

**Antes disso, 25/08/2026, madrugada** (verificação OAuth do Google
APROVADA para `calendar.events.owned` e `gmail.send`; e o WhatsApp estava
ativo numa empresa Free — o gate de plano faltava no webhook e em duas Server
Actions)

**Antes disso, 24/08/2026, noite** (arquitetura do WhatsApp auditada ponta
a ponta: sessão medida em 100% de disponibilidade, envio e recebimento
provados, e quatro buracos de perda silenciosa de mensagem fechados)

**Antes disso, 24/08/2026, noite** (o site inteiro virava TELA PRETA para
quem aceitasse os cookies, por uma quebra de linha no valor do Pixel do Meta
colado na Vercel; corrigido no painel e no código, e o pixel passou a medir
pela primeira vez)

**Antes disso, 24/08/2026, tarde** (WhatsApp: loop infinito no diálogo de
pareamento corrigido, reconexão automática + e-mail de aviso quando uma sessão
JÁ conectada cai, e a estabilidade medida piorou — 0% de tempo logado em 13
minutos seguidos, contra 26% da medição anterior)

**Antes disso, 24/08/2026, manhã** (landing repositionada no inimigo certo: 82% da PME brasileira vende por WhatsApp, e a página atacava a planilha; seção de confiança nova; comparação de preço; e o print da tela "Hoje" AINDA tinha o jargão banido, apesar do commit de 23/08 dizer o contrário)

**Antes disso, 23/08/2026** (landing auditada: promessa falsa no hero, logo quebrado no telefone, banner de cookies cobrindo o CTA, e prints mostrando o jargão que a própria página baniu; PRD, schema e grafo realinhados)

**Antes disso, 22/08/2026** (funções rodavam em Washington DC com o banco em São Paulo, corrigido na config do projeto e medido: /dashboard 1221ms → 400ms; modo claro sem escada de superfícies, refeito; jargão remanescente e telas de erro; WhatsApp sem QR por Postgres esgotado na VPS; migration 0049 provada desnecessária e removida)

## Diagnóstico do sistema, e a assinatura que avisa antes (25/08, noite)

Duas frentes na mesma rodada. A primeira produziu a segunda.

### O diagnóstico: 15 achados, nenhum visível pelos quatro portões

[docs/diagnostico.md](diagnostico.md) varre sete classes de defeito que `tsc`,
`lint`, `test` e `build` **não conseguem ver**. Cada achado carrega a prova
medida; achado sem prova ou sem consequência descrita não entrou, pela lição de
`/dono/alertas`, onde 8 de 11 alertas eram ruído.

Os que ninguém esperava:

**`pro_vigente()` tinha uma regressão em produção.** A 0044 fez a graça
pós-vencimento depender da forma de pagamento (1 dia no cartão, 3 no resto). A
**0051, ao acrescentar o trial, reescreveu a função inteira** e voltou para a
constante de 3 dias que a própria 0044 marcou como obsoleta. `dias_de_graca()`
ficou órfã no banco, e **cinco arquivos TS descreviam em comentário um
comportamento que tinha deixado de existir**.

Medido antes de corrigir: `dias_de_graca('CREDIT_CARD')` = 1,
`dias_para_compensacao_bancaria()` = 3, e o cenário "cartão vencido há 2 dias"
devolvia `true` quando deveria devolver `false`.

**Reescrever uma função inteira para acrescentar uma cláusula não deixa rastro
de que a outra metade regrediu.** É a classe mais perigosa e a mais barata de
varrer: 16 funções deste banco foram redefinidas mais de uma vez.

**`iniciarOnboarding` é Server Action viva sem nenhum chamador**, e o comentário
dela diz "Chamado pelo botão Começar configuração". Não existe esse botão.
Guardada por sessão, então não é buraco — mas é endpoint HTTP que ninguém
exercita.

**O webhook do WhatsApp pode duplicar contato.** `route.ts:489` lê
`encontrar_lead_por_telefone` sem checar `error`; falhando, conclui "número
desconhecido" e cria ficha nova para quem já existe. Único lugar do sistema
onde leitura nula vira **escrita errada** em vez de negação. **Não corrigido
nesta rodada**, está na fila.

**Ressalva do método, dita na cara:** a comparação automática entre versões de
função pega chamada que sumiu e número que mudou. **Não pega cláusula `where`
removida nem condição invertida.** Classe 1 pode ter mais casos que o um achado.

### A assinatura passou a avisar antes, e a avisar quem está em trial

Quase tudo já existia. A mudança principal foi um número.

**A janela era de 2 dias e virou 4.** A cadência diária D-4, D-3, D-2, D-1 sai
sozinha: `avisadoHoje` compara **dia de calendário em São Paulo**, então impede
o segundo e-mail no mesmo dia, não no dia seguinte. Não precisou de código de
agendamento nenhum.

**Os quatro e-mails dizem coisas diferentes**, e isso não é enfeite: quatro
mensagens idênticas em quatro dias lêem como robô de cobrança, e quem marca
como spam perde junto o e-mail de pagamento confirmado, que sai do mesmo
remetente. A escada é informa, lembra, explica a consequência, avisa que é o
último dia. Testes travam que nenhum inventa urgência ("última chance", "não
perca") e que **o de véspera promete por escrito que nada é apagado**.

**Quem está em trial não recebia e-mail nenhum.** A varredura filtrava
`subscriptions` com `status = 'active'`, e **quem está em trial não tem linha
lá** — o trial nasce em `create_workspace_with_admin` gravando
`workspaces.trial_ate`. Ficava de fora exatamente o grupo que mais importa: 5
empresas em trial ao mesmo tempo, e conversão de trial para pagante que nunca
aconteceu com cliente externo. Segunda varredura no mesmo cron, e-mail próprio,
coluna `aviso_trial_enviado_em` porque não há assinatura onde marcar.

**A tela de cobrança não dizia quando o plano vence.** `getEstadoAssinatura`
fazia `.select('status, asaas_subscription_id')` e **nunca lia
`current_period_end`**. O que aparecia era o vencimento da FATURA, que responde
outra pergunta:

    fatura.vencimento    quando a cobrança precisa ser paga
    current_period_end   até quando o Pro funciona          <- ninguém via

**"Está acabando" tinha três números diferentes:** tarja do trial em 3 dias,
e-mail de Pro em 2 (escrito cru no meio de `2 * 24 * 60 * 60 * 1000`, onde busca
por nome não acha), e nada na tela. Agora é `AVISAR_A_PARTIR_DE`, um número só,
lido pelos três. O teste trava a fronteira com número literal de propósito:
escrever a constante faria o teste concordar com qualquer valor, inclusive um
errado.

**O e-mail passou a abrir o pagamento.** `?pagar=1` abre o diálogo com o Pix na
tela; antes caía em `/settings/billing` seco e a pessoa ainda precisava achar o
botão, no exato momento em que já tinha decidido pagar. O e-mail de trial usa
`?assinar=1`, que é outro caminho — quem está em trial não tem assinatura para
pagar.

**Histórico de assinatura, que nunca existiu.** `subscriptions` guarda uma linha
por empresa, só o estado atual. Tabela `assinatura_eventos` (0055), append-only,
escrita num lugar só: `lib/asaas/aplicar-evento.ts`, o caminho já compartilhado
entre webhook e cron. Estado repetido não vira linha, senão o cron diário
encheria de "active -> active".

### O que NÃO mudou, e é decisão

O pedido falava em "passou de 30 dias, cancela instantaneamente". **O sistema já
fazia isso e é mais rigoroso:** o ciclo é de 30 dias, e `pro_vigente()` é
consultada por trigger a cada escrita, então o corte acontece na primeira
tentativa de uso depois de vencer, sem rotina noturna. Esperar 30 dias **depois**
de vencer daria um mês de Pro grátis a quem não pagou.

Fica aberto: a assinatura vencida continua existindo no Asaas gerando cobrança
todo mês, enquanto o produto já a trata como Free. Cancelamento automático de
cobrança de terceiro merece rodada própria.

### Provado contra o banco de produção

Empresa descartável, apagada num `finally`, com o cron rodando local contra o
banco real (o código novo ainda não estava publicado). **8 de 8 passaram:**

    D-4 D-3 D-2 D-1         1 e-mail cada, assuntos diferentes
    2a rodada no mesmo dia   0 enviados, 1 pulado
    empresa em trial         avisada, marca gravada
    histórico                grava e é legível
    intruso lendo            0 linhas
    intruso escrevendo       HTTP 403
    sobrou                   0 empresa

Os cinco e-mails confirmados `delivered` no log do Resend, em
`delivered@resend.dev`. E `pro_vigente()` provado numa transação com
`rollback`: cartão vencido há 2 dias devolve `false` (devolvia `true`), Pix
continua `true` pelos 3 dias de graça.

**A correção da graça não muda nada para nenhum cliente hoje:** medido, as 14
assinaturas do banco têm `ultimo_billing_type` nulo ou `UNDEFINED`, e
`dias_de_graca` devolve 3 para os dois. O defeito era latente. Foi o momento
mais barato possível para consertar.

## O CNPJ da vitrine está baixado, e o Business nunca foi submetido (25/08)

Pedido: verificar o caminho de Tech Provider da Meta para conseguir análise.
A investigação parou antes disso, num degrau que ninguém tinha conferido.

### Os dois fatos, medidos

`GET /v23.0/{business-id}` com o `META_ADS_TOKEN`:

    Rickdaskin   verification_status: pending_submission

**`pending_submission` significa que a verificação nunca foi enviada.** Este
documento afirmava "Meta Business verificado" desde a entrada do MEI.

E o CNPJ, consultado em **duas fontes independentes** (BrasilAPI e
minhareceita.org, as duas espelhando a Receita):

    64.543.748/0001-13
    situação   BAIXADA desde 08/08/2026
    motivo     1 — EXTINÇÃO POR ENCERRAMENTO, LIQUIDAÇÃO VOLUNTÁRIA
    MEI        excluído em 08/08/2026

Baixa a pedido do titular, confirmada por ele. Aberto em 16/01, encerrado em
08/08: sete meses.

### Por que isso é mais grave que uma pendência de verificação

O CNPJ aparecia em **seis lugares**, e o pior deles é a seção
**"O que a gente garante por escrito"** da landing, cujo texto de abertura diz
*"em vez de pedir confiança, mostramos onde ela pode ser conferida"*. A página
convidava a conferir, e a consulta desmentia a página.

Estava também no rodapé da landing, no rodapé de todo e-mail transacional, nas
duas páginas legais e em dois avisos de fatura.

**Nenhum `tsc`, `lint` ou `test` consulta a Receita.** Mesma classe dos prints
que mostravam o jargão banido e da bio do Instagram vendendo a oferta
aposentada: dado externo que não acompanha mudança de estado, e ninguém
descobre porque nada olha.

### Por que nenhuma mudança de código resolve

A verificação de negócio da Meta bate o número contra a Receita. CNPJ baixado
reprova, e não existe caminho pelo site. Foi por isso que a tentativa anterior
do dono falhou.

Três coisas foram confirmadas antes de decidir:

1. **Baixa de MEI é irreversível.** Não reativa, não reabre com o mesmo número.
   Inscrição nova sai com CNPJ diferente, então `64.543.748/0001-13` está morto
   para sempre.
2. **Software não cabe em MEI.** O CNAE 6202-3/00 (desenvolvimento e
   licenciamento de programas customizáveis) está fora da lista permitida. O
   MEI antigo estava em "Reparação e manutenção de computadores", que é
   permitido e **não cobre vender assinatura de software** — foi por isso que
   passou.
3. **Débito do MEI encerrado migra para o CPF** e não some com a abertura nova.

**Decisão do dono: abrir ME na Contabilizei**, CNAE 6202-3/00, Simples
Nacional. MEI novo foi descartado com motivo: daria um número que reprovaria
pelo mesmo defeito mais adiante.

### O que mudou no código

`CONTROLADOR.cnpj` e `CONTROLADOR.endereco` viraram `string | null`, e duas
funções puras decidem o texto (`lib/legal.ts`, 9 testes):

| função | onde | sem inscrição |
|---|---|---|
| `identificacaoDoControlador` | páginas legais, avisos de fatura | só a razão social |
| `assinaturaPublica` | rodapé, seção de confiança, e-mails | só o nome fantasia |

**O responsável não some junto com a inscrição.** O art. 9º, I da LGPD pede
identificação clara de quem responde pelo dado; devolver string vazia deixaria
a Política de Privacidade sem controlador nomeado, que é pior que a ausência do
número. Some a inscrição, fica o nome.

Um teste trava especificamente que a palavra "CNPJ" nunca é escrita sem um
número ao lado — o defeito literal seria `CNPJ null` na tela — e outro trava
que o separador não vaza (`© 2026 Velo Funil ·` com o ponto solto no fim).

**Preencher os dois campos reacende tudo sozinho.** Rodapé, seção de confiança,
e-mails e as duas páginas legais voltam a citar o número sem ninguém precisar
reabrir cada componente. É a única edição necessária quando o CNPJ novo sair.

`CONTROLADOR.endereco` nasce junto e vazio porque a verificação da Meta compara
o endereço do formulário com o publicado no site, e endereço sem inscrição não
identifica ninguém — publicá-lo sozinho exporia a casa do titular sem entregar
nada. Um teste trava que os dois andam juntos.

O número segue em `lib/documento-br.test.ts` como exemplo de dígito verificador
válido. Isso continua verdadeiro: o algoritmo não sabe nem precisa saber se a
inscrição está ativa.

### A ordem que a Meta exige, para não tentar fora de hora

1. CNPJ ativo na Receita
2. Site exibindo **razão social, endereço e telefone** iguais aos da Receita
   (hoje o site tem o telefone e mais nada; o resto sai da mesma `lib/legal.ts`)
3. Verificação do negócio no Business Manager, 1 a 5 dias úteis
4. App do tipo Business com o produto WhatsApp, número dedicado numa WABA
5. App Review de `whatsapp_business_messaging` + `whatsapp_business_management`
6. Tech Provider, só se for atender WhatsApp de vários clientes

Os passos 1 a 5 valem mesmo para um número só. O 6 é o que vira SaaS, e cada
cliente faria a própria verificação de negócio — essa fricção é o motivo de a
maioria dos CRMs pequenos ficar no não oficial, e é o que sustenta a decisão de
24/08 de blindar o Evolution em vez de migrar.

### Fica em aberto, e não é código

A conta do Asaas foi cadastrada com o CNPJ baixado, e é por ela que o Pix de
R$ 49 entrou. Se o Asaas revalidar o cadastro, a cobrança para. Não foi medido
nesta rodada.

## A Central sabia medir e operar, não sabia vender (25/08)

Pedido: "quais funcionalidades adicionar no local host para deixar uma máquina
poderosa". Auditadas as seis telas existentes. Elas respondiam **o que quebrou**
(Alertas), **quanto entra** (Visão geral) e **se as pessoas ativam** (funil de
Ativação). Nenhuma respondia a pergunta que gera receita: *quem está decidindo
neste momento, e como falo com essa pessoa?*

Medido no banco antes de escrever qualquer linha: **5 empresas em trial ao
mesmo tempo**, invisíveis em toda a Central. O trial é uma janela de sete dias;
sem vê-la, ela passa por omissão.

### `/dono/trial` — "Decidindo agora"

Cada empresa dentro da janela, com prazo, o que já fez no produto, e-mail,
WhatsApp com mensagem pronta e uma frase dizendo o que fazer.

**A ordem põe "usou" acima de "está acabando".** Engajado com cinco dias vale
mais que quem nunca abriu o produto e vence amanhã — o segundo não tem o que
decidir, porque não viu nada para decidir. A urgência entra como desempate.

**"Já falei" é DATA, não interruptor.** Silenciar aqui perderia a venda: dentro
de sete dias, o segundo toque perto do fim é o que fecha. A empresa cai um
degrau por dois dias e volta a subir sozinha
(`lib/dono/contatos-do-trial.ts`, fora do Git, mesmo padrão de
`silenciados.ts`). Vai também para o diário.

**Defeito achado pelo próprio teste, e vale mais que a correção:** eu tinha
escrito que contato recente derruba abaixo de todo mundo. O teste reprovou, e
estava certo — um engajado que vence amanhã continua sendo a melhor conversa da
lista mesmo tendo sido procurado ontem. Corrigida a afirmação, não o número.

**Defeito achado pela medição real:** classifiquei por `last_sign_in_at`. Esse
campo **só muda em autenticação nova** — quem abre o CRM todo dia sem deslogar
o mantém parado. Apareceu na primeira leitura: empresa criada há um dia dizendo
"entrou há 4 dias", dois números impossíveis juntos. Trocado pela **última
escrita no produto** (contato, negócio ou atividade), que não mente sobre uso.

**O filtro de conta de teste saiu de dentro de Ativação** e virou
`ehContaDeTeste` em `contas-internas.ts`, com teste. Sem ele, a tela nova
mostraria quatro pessoas para contatar e **as quatro seriam teste nosso** — o
mesmo defeito dos Alertas com 8 de 11. Duas cópias da lista divergiriam na
primeira atualização, e as duas telas continuariam mostrando número plausível.

### Meta Ads ligada: a tela de Anúncio saiu do escuro

Token de **system user que não expira**, com `ads_read`, `ads_management`,
`business_management`, `pages_show_list`, `instagram_basic` e
`instagram_content_publish`.

**Fecha uma pendência antiga:** o token enxerga **uma única** conta,
`act_1316925630418162` "Rickdaskin Ads" — exatamente a fixada em
`lib/dono/meta-ads.ts`. O risco de subir campanha na conta errada, registrado
desde 20/08, deixou de existir: a conta errada não é alcançável.

`/dono/anuncio` passou de bloco desligado para **5 de 5 pontos prontos**, com
pixel certo, fuso, campanha (R$ 30/dia, pausada) e os botões de pausar, ligar e
mudar orçamento funcionando.

**Prova independente de que a correção da tela preta pegou:** a conta reporta
`PageView (103)` e `CompleteRegistration (5)`, e `last_fired_time` de ontem.
Até 24/08 o pixel **nunca havia disparado uma vez**.

**O token NÃO vai para a Vercel.** Só é lido em `lib/dono/`, e toda a Central
devolve 404 em produção. Colá-lo lá poria um token que gasta dinheiro no
ambiente de um código que nunca roda ali.

### A bio do Instagram vendia a oferta que a 0051 aposentou

O @velofunil tem **3.555 seguidores** — ativo que nenhuma linha deste projeto
sabia existir. E a bio dizia *"Grátis até 300 contatos, sem cartão"*, o
freemium anterior ao reverse trial, meses depois de a landing ter sido
corrigida. Também atacava a **planilha**, o inimigo que a repositionagem de
24/08 abandonou por medição (82% da PME brasileira vende pelo WhatsApp).

É a mesma classe dos prints que mostravam o jargão banido: **texto de marca
fora do repositório não acompanha mudança de produto**, e ninguém descobre,
porque nenhum `tsc`, `lint` ou `test` lê bio de rede social.

`lib/dono/perfil-instagram.ts` resolve a classe: nome, bio, link, categoria e
contatos derivam das MESMAS constantes da landing (`DIAS_DE_TRIAL`,
`PRO_PLAN_PRICE`, `CONTROLADOR`). Mudar o plano muda a bio junto. 10 testes,
incluindo um que reprova qualquer texto que volte a falar em "planilha" ou
"300 contatos". A tela (`/dono/destaques` → Kit do perfil) tem botão de copiar
por campo e contador de caracteres — o Instagram corta em silêncio no teto.

**O link da bio ganhou `www` e UTM.** Medido: sem `www` custa 980ms contra
255ms, por um redirecionamento. E as UTMs fazem a captura funcionar — provado
em produção com `POST → 200` na Server Action de atribuição. As 24 empresas do
banco têm `utm_source` vazio: `utm-capture.tsx` está construída desde sempre e
**nunca foi exercitada**. Este link é o primeiro uso real dela.

### Instagram: o que trava a publicação por API

Existem **duas** contas: `@velofunil` (3.555 seguidores, bio antiga, pessoal) e
`@velofunilbr` (0 seguidores, bio nova, indícios de já ser profissional).
Nenhuma das duas está no business `Rickdaskin` — `owned_pages`,
`owned_instagram_accounts` e `pending_owned_pages` todos vazios.

Para publicar Story pela Central faltam, nesta ordem: conta profissional →
Página do Facebook vinculada → Página adicionada ao business Rickdaskin →
ativo atribuído ao system user. A Página não é burocracia: o caminho da API é
`Página → instagram_business_account → publicar`, e anúncio com posicionamento
no Instagram também a exige.

**Duas contas iguais partem a audiência**, e isso ficou registrado como
ressalva, não como decisão: 3.555 numa e 0 na outra, com a busca do Instagram
mostrando as duas. O bloqueio que motivou a segunda (`is_professional_account:
false`) é resolvível na original.

### `suporte@velofunil.com.br` provado

Envio real, `delivered` em 7 segundos. MX do Cloudflare ativo, SPF e DMARC
presentes. Ressalva: `delivered` prova o primeiro salto — o Cloudflare aceitou
—, e o encaminhamento para a caixa real é um segundo salto que só a leitura
confirma. E o Email Routing **só recebe**: responder daquele endereço exige
configurar "enviar como" no Gmail.

## WhatsApp: auditoria da arquitetura inteira (24/08, noite)

Pedido: garantir que funcione para todos os usuários, sem cair. Auditado
ponta a ponta, medindo contra o servidor e o banco reais.

### A sessão está MUITO mais estável do que este documento dizia

| medição | logado |
|---|---|
| 23/08, 2 min | 63% |
| 23/08, 13 min | 26% |
| 24/08 tarde, 13 min | 0% |
| **24/08 noite, 6 min** | **100%, zero erro de rede** |

A instância da "Consultoria Aurora" está pareada com um número real
(`jid: 5571…`) desde 23/08 15:36 — mais de 24 horas de pé. **Envio testado e
funcionando**: HTTP 200 em 2s, mensagem entregue com ID.

O servidor responde em 70ms, e 197ms com 10 chamadas simultâneas.

**Armadilha de instrumentação que quase virou diagnóstico errado:** o campo
`LoggedIn` **só existe em `/instance/status` com o token da instância**. Em
`/instance/all` ele não existe, e a leitura vira `null` — uma sessão saudável
passa por morta. O script `vigiar-sessao-whatsapp.mjs` sempre usou a rota
certa; o aviso ficou gravado nele para ninguém "simplificar" a chamada depois.

**A conclusão de que "não se sustenta" era prematura.** A oscilação é real e
a recuperação também. O que decide não é uma leitura, é a série.

### Quatro buracos de perda silenciosa de mensagem, fechados

O dedupe é gravado ANTES do processamento — sem isso o reenvio duplicaria a
atividade. Mas isso abre uma janela em que a mensagem já é "vista" e ainda não
virou nada, e qualquer falha ali a apaga da existência: o Evolution não
reenvia o que já deduplicou.

O caminho do limite de plano já tratava disso (23/08). Os outros **não**:

1. `activities.insert` sem checar erro — o buraco mais caro. Falha de RLS,
   constraint ou rede descartava a mensagem sem deixar rastro.
2. `tasks.insert` sem checar erro.
3. `erroDedupe` por motivo diferente de duplicata: só `console.error`, que
   ninguém lê em produção.
4. **Lote grande estourando `maxDuration`**: o laço é série, ~330ms por
   mensagem (medido). Um lote de 40 levaria ~13s contra o teto de 15 — e a
   função morrendo no meio apagaria tudo que já tinha dedupe. Teto de 25 por
   chamada; o excedente nunca grava dedupe, então continua elegível para
   reenvio.

Agora toda falha passa por `registrarMensagemPerdida`, que guarda telefone E
texto em `error_logs` — um sem o outro não permite decidir se aquela venda
valia.

**Provado contra produção** com workspace descartável: segredo errado dá 404;
mensagem de número novo vira contato + atividade + tarefa em 719ms; reenvio do
mesmo evento não duplica; lote de 40 responde 200 em 8,3s sem estourar.

### O segredo do webhook é ÚNICO, não por empresa

O comentário do código dizia "um segredo por conexão" e **estava errado**: é
`EVOLUTION_WEBHOOK_SECRET`, o mesmo para todas as instâncias.

Consequência, dita sem suavizar: quem conhecer o segredo consegue **injetar**
mensagem falsa no funil de qualquer empresa, bastando saber o UUID dela. Não
dá para LER nada (a rota só escreve), e o segredo hoje só existe no `.env` e
na configuração das instâncias no servidor Evolution, ao qual apenas o dono
tem acesso.

É fraqueza de arquitetura, não buraco explorável hoje. O caminho correto com
muitos clientes é segredo por conexão, gerado ao conectar e guardado junto do
token — que também limita o estrago se um cliente for comprometido. **Não foi
feito nesta rodada** por exigir migration e retrabalho no fluxo de conexão.

### O que ainda decide se dá para vender

A capacidade da VPS (KVM 2 = ~33 clientes) e o risco de a Meta restringir o
número seguem como registrado.

**Decisão do dono, 24/08: o proxy residencial fica para depois.** Ele pagaria
os ~R$ 18/mês — o custo não é o impedimento —, mas não agora. A leitura é
defensável: com a sessão medida em 100% de disponibilidade e mais de 24h de
pé sem proxy, gastar antes de existir cliente usando é comprar seguro para um
risco que ainda não se materializou.

O que isso implica, para não virar surpresa depois: enquanto não houver proxy,
a conexão sai pelo IP de datacenter da Hostinger, que é o primeiro sinal que a
Meta procura. Se a oscilação voltar (a série 63% → 26% → 0% → 100% mostra que
ela é real), o proxy é a primeira coisa a tentar, não a última — e aí passa a
ser urgente, não opcional.

O que mudou é que a base agora está provada: conecta, sustenta, envia, recebe,
e não perde mensagem em silêncio.

## Tela preta no site inteiro, por um "
" no ID do pixel (24/08, tarde)

Reportado como problema regional — "meu primo em Aracaju vê tela preta". **Não
era regional, e não era rede.** Atingia qualquer pessoa, em qualquer lugar, que
**aceitasse os cookies**. Quem recusava ou ignorava o banner nunca viu nada, e
foi isso que fez o defeito passar despercebido.

O valor colado em `NEXT_PUBLIC_META_PIXEL_ID` na Vercel tinha uma quebra de
linha no fim. Como o ID é interpolado num script inline, o navegador recebia:

    fbq('init', '1566349361566072
    ');

String literal partida em duas linhas é `SyntaxError`. E o erro não ficava
contido: `next/script` injeta com `appendChild` **durante o commit do React**,
então a exceção subia até `app/global-error.tsx`, cujo fundo é `#0a0a0a`. Era
a tela preta, sem mensagem e sem pista.

**Achado de brinde, e caro:** o pixel **nunca mediu nada**. O script não
chegava a executar — qualquer número de conversão olhado até aqui estava vazio
por isso, não por falta de tráfego.

### Como foi encontrado, que é o que vale repetir

`error_logs` (migration 0046) tinha o registro: **React error #310 em
`/onboarding`, origem `global`**, do mesmo dia. Foi o ponto de partida — sem
essa tabela, a investigação começaria do zero.

A prova veio de ler o `textContent` do script **injetado no site real** e
rodar `new Function(txt)`: devolveu `Invalid or unexpected token`. Não foi
deduzido do código.

**Dois diagnósticos errados descartados no caminho**, os dois plausíveis: hook
condicional no assistente de onboarding (os hooks estão todos no topo, e o
fluxo completo foi percorrido em produção sem quebrar) e bloqueio de borda do
Cloudflare (o próprio `error_logs` prova que o JS carregou e o React executou).

### Duas defesas, porque uma não bastava

`lib/analytics/pixel-id.ts` limpa espaço, quebra de linha, aspas e espaço de
largura zero — este último é invisível até no campo do painel — e **recusa o
que não for só dígitos**: valor estranho dentro de script inline não é
configuração errada, é injeção de código. 7 testes.

Corrigir só na Vercel resolveria hoje e reabriria amanhã: variável de ambiente
é colada por gente.

`components/analytics/isolar-analytics.tsx` fecha a **classe** do defeito.
Pixel, Vercel Analytics e captura de UTM vivem no layout **raiz**, então erro
em qualquer um derruba a página inteira. Cada um ganhou uma cerca:
**medição quebrada custa o DADO, nunca a visita**. O erro segue indo para
`error_logs` — some para o visitante, não para a investigação.

### Correções de fato sobre a infraestrutura

**O "Ignored Build Step" NÃO foi removido**, ao contrário do que este documento
afirmava. Ele está ativo (`if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit
0; else exit 1; fi`) e é por isso que **todo** deployment com `target:
production` aparece `CANCELED` e só os `staging` ficam `READY`. Não é defeito:
é o gate funcionando — a Vercel não publica `main` sozinha, e a promoção é o
clique manual. Redeploy via API com `target: production` é cancelado pelo mesmo
motivo; o caminho que funciona é push (que builda staging) e promote.

**`decrypt=true` não devolve valor de variável marcada `sensitive`**, que é o
caso desde que "Enforce Sensitive Environment Variables" foi ligado em 20/08.
Dá para **escrever** por `PATCH /v9/projects/{id}/env/{envId}`, não para ler —
foi assim que o valor do pixel foi corrigido sem ninguém abrir o painel.

**Confirmado em produção depois do promote**, com navegador real e o banner
aceito: `fbq('init', '1566349361566072');` numa linha só, sintaxe válida,
`window.fbq` carregado, zero erro de console, `/` e `/cadastro` renderizando.

## WhatsApp: loop infinito corrigido, mas a instabilidade piorou (24/08, tarde)

O dono reportou o diálogo de conexão girando pra sempre, com a mensagem
"verifique sua conexão" reaparecendo. Investigado a fundo contra o servidor
real, dois defeitos de código e um achado de infraestrutura que nenhum dos
dois resolve sozinho.

### O loop era real, e tinha causa exata

`components/settings/evolution-connect-dialog.tsx` tinha quatro laços de
repetição. Só o primeiro (esperar o primeiro QR) tinha teto — 6 tentativas,
~30s, depois erro de verdade. **Os outros três rodavam pra sempre**: renovar
QR a cada 20s, recriar a sessão inteira a cada 110s, checar se conectou a
cada 3s, nenhum deles jamais setava `erro`. Se o pareamento nunca completasse
do lado do WhatsApp, a tela girava QR novo sem admitir que algo estava
errado — e "verifique sua conexão e tente mais tarde" já estava documentado
aqui como mensagem **do próprio WhatsApp**, não deste código (grep confirma:
a string só existe em comentário, nunca é gerada pela aplicação).

Ganharam um teto de 5 minutos (`TEMPO_MAXIMO_DE_TENTATIVA_MS`), depois do
qual a tela desiste e nomeia a causa mais provável (IP de datacenter) em vez
de girar pra sempre.

### O achado maior: sessão CONECTADA caindo em silêncio

Consultado o banco de produção: 2 conexões de WhatsApp existem, batendo
exatamente com as 2 instâncias reais no servidor Evolution (`/instance/all`,
a rota certa — `/instance/fetchInstances`, da Evolution API Node original,
dá 404 aqui, é Evolution GO). Uma estava genuinamente conectada
(`Connected:true, LoggedIn:true`, 161ms), a outra genuinamente desconectada
sem atividade desde 21/08.

O webhook (`app/api/webhooks/evolution/.../route.ts`) já tratava queda de
sessão conectada — `LoggedOut`/`Disconnected`/`StreamReplaced` marcavam
`status: 'error'` com `last_error`. Mas isso **nunca chegava a ninguém**: só
aparecia como texto passivo em Configurações → Integrações, sem e-mail, sem
alerta ativo, e nenhum cron ou reconexão automática existia — confirmado
lendo os dois crons reais (`reconciliar-assinaturas`,
`limpar-eventos`), nenhum toca WhatsApp.

Corrigido: o webhook agora distingue os dois motivos de queda. `LoggedOut` é
a pessoa desvinculando o aparelho pelo próprio celular — só pareamento novo
resolve, vai direto pro aviso. `Disconnected`/`StreamReplaced` tentam
reconectar sozinhos primeiro (`tentarReconectarAutomaticamente`, reusando o
token já gravado, o mesmo caminho que `conectarWhatsapp` usa quando um
humano clica "Conectar"), e só avisam por e-mail
(`lib/emails/whatsapp-desconectado.ts`, pro `created_by` do workspace,
mesmo padrão de destinatário que os e-mails de cobrança já usam) quando essa
tentativa falha. A checagem de `status === 'connected'` antes de agir garante
no máximo um e-mail por queda, não um por webhook repetido.

### A medição que veio depois, e piorou o diagnóstico

Rodado `scripts/diagnostico/vigiar-sessao-whatsapp.mjs` por 13 minutos contra
a instância que estava conectada. Resultado: **0% de tempo com `LoggedIn:true`
na janela inteira** — pior que a medição anterior (26% em 13 minutos, já
registrada aqui). `Connected` oscilava (62%), `LoggedIn` nunca voltou a `true`
uma vez sequer durante os 13 minutos.

Os logs do servidor (`/instance/logs/{id}`) não ajudaram a explicar: presos
em 23/08 03:12, mais de 24h atrás — o endpoint não reflete atividade recente,
o que também significa que `ultimoErroDaInstancia` (usado para mostrar erro
detalhado na tela) pode estar mostrando informação velha sem avisar que é
velha.

**Testado de novo, minutos depois do fim da medição: `LoggedIn:true`.** A
sessão se recuperou sozinha. Isso descarta a hipótese de processo travado
(zumbi) — é oscilação de verdade, o whatsmeow reconectando e caindo por
conta própria, consistente com a hipótese já registrada aqui: desde
janeiro/2026 a Meta detecta por fingerprint de comportamento, e IP de
datacenter (a VPS é Hostinger) é o sinal mais forte que ela procura.

**O que a correção de hoje resolve, e o que não resolve:** o e-mail garante
que uma queda sustentada vira aviso em vez de silêncio — antes disso não
existia rede de segurança nenhuma. Mas não elimina a oscilação em si: se o
whatsmeow se reconecta sozinho antes do próximo webhook de queda, o cliente
nunca é avisado (correto, seria alarme falso), mas a mensagem que chegou
durante a janela de "logado sozinho, mas de fato não estava recebendo" pode
se perder do mesmo jeito. A causa raiz continua sendo a mesma: proxy
residencial brasileiro (~R$18/mês) reduz a chance de a Meta marcar o IP como
automação; sem ele, a oscilação medida hoje é o comportamento esperado, não
um bug a mais para caçar.


## A landing vendia o produto errado, para o inimigo errado (24/08)

Auditadas seis landings de referência com navegador e leitura de CSS: Agendor,
Pipedrive BR, Attio, Basecamp, Tally e Page AI. **As seis sustentam a página em
prova social** — "mais de 10 mil empresas", "30.000+ customers", logos de Scania
e Railway, depoimento com nome e cargo. Tally é a menor da lista e ainda assim
abre com Notion e Rakuten.

Como temos zero clientes externos pagantes e inventar depoimento é decisão
travada aqui, copiar o esqueleto delas deixaria buraco onde mais dói. O que a
auditoria rendeu, então, não foi um layout para clonar — foram três achados.

### O inimigo estava errado, e isso encarece o clique

A página inteira atacava a planilha: "Da planilha ao funil em três passos",
"Traga sua planilha". Medido na **12ª Pesquisa Pulso do Sebrae (2026): 82% dos
pequenos negócios brasileiros têm o WhatsApp como principal canal de venda**, e
76% vendem por lá. Quem controla cliente pelo WhatsApp e pela memória não tem
planilha para trazer — lê "exporte seu .csv" e conclui que o produto é para
outra pessoa.

A headline anterior ("Pare de perder venda por esquecimento") era boa como
frase e apontada para a segunda dor. A nova — **"O WhatsApp guarda a conversa.
Não guarda o cliente."** — não compete com o WhatsApp, o complementa: "mas eu já
uso WhatsApp" é a objeção nº 1 do público, e mandar trocar de ferramenta perde a
discussão antes de começar.

**O que ela deliberadamente NÃO promete:** nada de integração automática. A
conexão via Evolution está construída e não ligada (26% de sessão viva na última
medição). Prometer o que não roda é a classe do "contatos ilimitados" removido
em 23/08.

A dor com número em cima, para quem for escrever anúncio: responder em 5 minutos
em vez de 30 dá **21x mais chance de qualificar** (InsideSales/MIT — o dado
costuma ser creditado errado à Harvard), e a auditoria da HBR em 2.241 empresas
achou tempo médio de primeira resposta de **42 horas**.

### A landing vendia menos do que o sistema entrega

Desde a 0051 toda empresa nasce com sete dias de Pro completo. **A landing não
dizia isso em lugar nenhum** — seguia vendendo "grátis pra sempre até 50
contatos, sem prazo pra decidir". Quem criava conta recebia mais do que a página
prometeu, sem saber, e depois perdia recurso que não sabia que tinha.

Corrigido no hero, na faixa de números, no cabeçalho de planos e na primeira
pergunta da FAQ. A microcopy abaixo do botão seguia o padrão do Pipedrive
("Teste grátis de 14 dias, não requer cartão de crédito"): oferta, prazo, e a
remoção da única fricção que trava cadastro. Ela abria pelo TETO antes disso —
copywriter não anuncia a limitação antes da promessa.

### O que entrou no lugar da prova social que não temos

Seção **"O que a gente garante por escrito"**, antes do preço e não depois: quem
avalia R$ 49 desconfiando do site acha caro. Quatro garantias conferíveis
(isolamento por RLS, dados em São Paulo, cartão que não passa pelo nosso
servidor, cancelamento sem multa) e o **CNPJ**, que também passou a aparecer no
rodapé. No Brasil o CNPJ é o primeiro sinal que uma PME procura antes de confiar
num site desconhecido, e ele estava só nas páginas legais, a dois cliques de
quem estava decidindo.

E a **comparação de preço**, logo abaixo dos cards: a maioria dos CRMs cobra por
vendedor, e cinco pessoas a R$ 53 dão R$ 265/mês. Preço de tabela pública deles,
não prova social inventada — por isso pode ser dito. Sem essa âncora o cérebro
compara R$ 49 com R$ 0 e qualquer preço perde. Nomes de concorrente ficam de
fora de propósito.

### O print mentiu de novo, e o commit que dizia tê-lo corrigido também

O print da tela "Hoje" na landing mostrava **Pipeline · Leads · Dashboard** —
exatamente o jargão que a página bane e que a renomeação de 19/08 removeu do
produto. O commit `fa31af8`, de 23/08, se chama "os prints mostravam o
vocabulário que a landing baniu" e tocou os seis arquivos.

Recapturado contra build atual, **só `hoje-dark` e `hoje-light` mudaram**: os
outros quatro saíram byte-idênticos, ou seja, já estavam certos. A tela "Hoje"
foi capturada antes do rebuild naquela sessão e passou.

**A lição, que é o que vale registrar:** o commit anterior verificou que rodou o
script, não que o arquivo ficou certo. Este foi conferido **abrindo o PNG e
lendo a sidebar** — que é a única prova possível, porque nenhum `tsc`, `lint` ou
`test` olha dentro de uma imagem.

### Acabamento: a escala tipográfica passou a carregar o tracking

Levantado do CSS servido pelo Attio: o espaçamento entre letras fica mais
negativo conforme o texto cresce (−0.02em em 4rem, −0.01em nos menores). É
compensação óptica, não gosto — espaço entre letras é percebido em proporção ao
tamanho da letra, e o mesmo `normal` que serve em 16px vira vão frouxo em 56px.

Virou token (`text-titulo-xl/lg/md/sm`), com tamanho, altura de linha, peso e
tracking casados. Antes só o h1 da landing tinha tracking, escolhido a olho, e
os h2 repetiam `tracking-[-0.02em]` copiado de seção em seção.

**Defeito achado por medição no telefone:** a frase nova tem 47 caracteres
contra 38 da anterior e, em 390px, ocupava **cinco linhas**, empurrando o botão
para debaixo do banner de consentimento — o mesmo defeito de 23/08 por outra
causa. Com um degrau a mais na escala, três linhas, e o CTA fecha em 548px num
viewport de 767.

Metadata, `og:description` e a imagem de compartilhamento foram junto: elas
ainda diziam a headline antiga, e são o que aparece no WhatsApp antes de
qualquer clique. O contrato do teste E2E também.


## Verificação OAuth do Google: APROVADA (24/08)

O Google aprovou a verificação do projeto `472861929986`
(`gen-lang-client-0317261117`) para os dois escopos pedidos:

    .../auth/calendar.events.owned
    .../auth/gmail.send

Conferido: são exatamente os que `lib/integrations/google.ts` usa, e o
`client_id` do `.env.local` é o do projeto aprovado. A tela de Branding do
Console confirma — "Your branding has been verified and is being shown to
users".

**O que destravou foi a troca de escopo.** A submissão de 20/08 foi reprovada
com "why narrower permissions cannot be used", e a objeção era procedente: o
app pedia `calendar.events`, que dá acesso a eventos em TODOS os calendários,
inclusive os que terceiros compartilharam. `criarEventoNoCalendar` escreve em
`calendars/primary/events` e nada mais.

### O que isso muda na prática

Some o aviso "O Google não verificou este app" da tela de consentimento —
aquele que obriga a clicar em "Avançado" e assusta qualquer pessoa que não seja
desenvolvedor. Google Calendar e Gmail passam a ser conectáveis por qualquer
cliente sem fricção nem medo.

### As duas armadilhas que o próprio e-mail avisa

**"You will need to submit a new verification request for access to new
scopes, or if you make any changes to your OAuth consent screen
configuration."** Ou seja: mexer no nome do app, no logo, no domínio, na
política de privacidade ou acrescentar escopo **derruba a verificação** e
exige submeter tudo de novo — com vídeo novo. Não é mudança barata.

**"This verification cannot be inherited."** Um projeto novo do Google Cloud
começa do zero, mesmo sendo da mesma conta. Se algum dia o projeto for
recriado, a verificação não vem junto.

## Verificação OAuth do Google: o escopo era largo demais (23/08)

A submissão foi reprovada em 20/08, e a objeção principal era procedente:

> *"The demo video you provided does not sufficiently demonstrate why the
> following scope(s) are necessary or **why narrower permissions cannot be
> used**."*

Podiam ser. O app pedia `calendar.events`, que dá acesso a eventos em **todos**
os calendários — inclusive os que terceiros compartilharam com a pessoa.
`criarEventoNoCalendar` escreve em `calendars/primary/events`, a agenda do
próprio usuário, e nada mais. Trocado por **`calendar.events.owned`**.

`calendar.app.created` é ainda mais restrito e foi **descartado com motivo**:
obriga a criar um calendário secundário do app, e o evento sairia da agenda
principal — que é onde ele precisa estar para a pessoa não perder a reunião.
Trocaria uma objeção de verificação por um defeito de produto.

**Custo medido antes de mexer:** uma única conexão de Calendar em produção.
Quem já conectou reconecta; com uma conexão, é o momento mais barato que essa
troca jamais teria.

### O que mais o revisor cobrou, e que não era escopo

**A tela de consentimento tem que aparecer com os escopos EXPANDIDOS.** O
Google exige clicar em *"See access details"* / *"Show all services"* antes de
continuar. No vídeo antigo, o Gmail estava expandido e o **Calendar não** — e
era exatamente esse o item reprovado. Não é detalhe de edição: sem expandir,
o revisor não consegue ler o que está sendo concedido.

**Os três lugares têm que dizer a mesma coisa:** o escopo que o app pede, o
escopo salvo no Console e o escopo que aparece no vídeo. Divergência entre
eles é motivo de reprovação por si só ("Scope Matching"), e é fácil de criar
sem perceber — basta gravar antes de promover.

### O vídeo, e o que ele custou

Três gravações até acertar. As duas primeiras se perderam por coisas que uma
verificação de 30 segundos teria evitado:

1. **O `Textarea` não repassava a ref** — descoberto no meio da gravação, com o
   formulário de e-mail recusando texto válido. Ver a seção própria acima.
2. **O contato de demonstração usava `google.review@velofunil.com.br`**, que é
   login mas não caixa postal: o e-mail voltou com `550 5.1.1` e o vídeo
   registrou "Endereço não encontrado" em tela cheia. Trocado por
   `suporte@velofunil.com.br`, que tem roteamento no Cloudflare — e **testado
   antes** da terceira gravação, não depois.

O corte final foi montado com ffmpeg a partir de duas gravações (o trecho novo
do Calendar + as partes de Gmail que já estavam boas), normalizando resolução
(1914×978 e 1920×1080) e removendo bounce, spam, VS Code e o painel da Vercel
que entraram sem querer. 5min42s viraram 2min52s.

**A conta de revisão** (`google.review@velofunil.com.br`, empresa "Google
Review Ltda") fica com as integrações **desconectadas** de propósito: é isso
que permite ao revisor rodar o consentimento inteiro com a conta dele. Ela é
Pro com assinatura até 2027 e tem um contato, um negócio e uma tarefa aberta,
para as duas funcionalidades serem testáveis em dois cliques.

## WhatsApp: conectou sem proxy, mas não se sustenta (23/08, noite)

**Pareou.** `LoggedIn=true` aos 118 segundos, sem proxy nenhum, pelo IP de
datacenter da Hostinger. O que travava as tentativas anteriores **não era o
IP** — era a corrida de 20 segundos entre o QR aparecer e alguém escaneá-lo. A
saída foi uma página local que rebusca o código a cada 3s
(`/instance/qr` responde em ~2,5s), o que elimina a janela apertada.

**Mas a sessão não se sustenta, e este é o número que decide a integração:**

| medição | sessão logada |
|---|---|
| primeiros 2 minutos | 63% (4 quedas) |
| primeiros 13 minutos (`vigiar-sessao-whatsapp.mjs`) | **26%**, com 5 min seguidos fora |

Está **degradando**, não estabilizando. E a causa não é nossa: o servidor
responde em 60ms, o webhook de produção devolve 200 em 375ms e recusa segredo
errado. Quem derruba é o WhatsApp.

`scripts/diagnostico/vigiar-sessao-whatsapp.mjs` existe para essa pergunta —
uma leitura isolada diria "conectado" ou "caído" e as duas seriam verdade; só a
série separa oscilação de sessão sendo derrubada.

### A arquitetura aguenta 100 clientes; o WhatsApp é que não

Simulado contra produção com workspace descartável, **85 de 85 requisições sem
uma falha**:

| concorrência | vazão | p95 |
|---|---|---|
| sequencial | 3,1 req/s | 646ms |
| 5 simultâneas | 15,2 req/s | 378ms |
| **15 simultâneas** | **28,4 req/s** | **550ms** |

100 clientes a ~100 mensagens/dia dão 0,12 req/s de média e ~1,7 req/s de pico:
**16× de folga**. O laço fechado funcionou inteiro — 86 mensagens viraram 86
contatos, 86 atividades e 86 tarefas. Vercel e Supabase não são o gargalo.

**A conta que isso destrava:** sem proxy, o WhatsApp deixa de custar R$ 18 por
cliente e vira custo fixo diluído — margem de **92%** com 100 clientes, contra
51% com um IP por número (100 × R$ 18 = R$ 1.800/mês). É a diferença entre um
adicional que precisa ser cobrado à parte e um recurso que cabe no plano. Só
que isso depende da sessão parar de cair.

## A mensagem sumia quando o plano batia no teto (23/08)

Achado pela própria simulação de carga, não por leitura de código: **86
mensagens de números desconhecidos criaram 86 contatos.** É o desenho certo,
mas expõe uma aritmética que ninguém tinha feito — três dias de WhatsApp
movimentado estouram sozinhos o teto de 300 do Free, sem a pessoa cadastrar
ninguém.

E a partir dali o webhook fazia `continue`. O dedupe já tinha sido gravado três
linhas antes, então o Evolution nunca reenvia: o cliente escrevia "quero
comprar", a trigger recusava o contato, e **a mensagem desaparecia** — sem
erro, sem tarefa, sem aviso. Num produto que promete não perder venda, perdê-la
pelo silêncio do próprio produto é a falha mais cara possível.

Agora a mensagem continua fora do funil (limite de plano é trigger, e não se
fura), mas não some: `error_logs` guarda **telefone e texto** — um sem o outro
não permite decidir se aquela venda valia — e `last_error` sobe para a tela
dizendo o que ainda funciona antes do que não funciona.

**Provado ponta a ponta** contra build de produção, com workspace Free em 300
contatos e limpo no fim: mensagem de número novo gravada em `error_logs` com o
código `42501`; aviso na tela; conexão seguindo `connected`; **contato já
existente continuando a entrar normalmente**; e, depois do upgrade, o contato
301 criado e o aviso apagado sozinho.

**Armadilha do próprio teste, que vale mais que a correção:** a primeira prova
do upgrade falhou porque eu mudei só `workspaces.plan`. A trigger vigente
(0040) lê **`pro_vigente()`**, que exige assinatura viva — exatamente a
doutrina travada na 0027. Testar plano trocando a coluna testa uma regra que
não existe.

## A landing dizia uma coisa e mostrava outra (23/08)

Auditoria da página pública em 390px e 1440px, com navegador e medição. Três
defeitos reais, nenhum deles visível na leitura do código.

**O hero prometia "contatos ilimitados" no plano grátis.** O Free comporta 300,
e a própria página dizia isso em outros três lugares. No lugar entrou a
vantagem que nenhum concorrente mapeado tem: **R$ 49 pela empresa inteira, não
por vendedor.**

**O logo quebrava em duas linhas no telefone** — 56px de altura onde uma linha
ocupa 28, espremido em 67px entre tema, CTA e menu.

**O banner de cookies cobria o CTA, e o banner era meu, de um dia antes.**
Medido: 206px, 27% da tela, começando no mesmo pixel do "Começar grátis".
Compactado para 122px. Quem chega de anúncio via o botão tapado por um aviso de
cookie.

**Os prints do produto mostravam o vocabulário que a landing baniu.** Este é o
achado que mais vale registrar como método: os seis PNGs foram capturados em
19/08 às **09:46**, e a renomeação que tirou "Pipeline/Leads/Dashboard" do
produto inteiro entrou às **10:39** do mesmo dia — 53 minutos depois. Nada
tocou `public/produto/` desde então. A página afirmava "Funil" e "Contatos" por
escrito e mostrava "Pipeline" e "Leads" em imagem, na mesma dobra.

Confirmado por três caminhos antes de recapturar: horário dos dois commits,
ausência de commit posterior na pasta, e leitura direta do PNG. **Print é o
único artefato deste projeto que não acompanha refatoração** — nenhum
`tsc`/`lint`/`test` olha dentro de uma imagem.

A recaptura expôs mais dois, os dois corrigidos no
`scripts/capturar-prints-do-produto.mjs`: o **banner de consentimento entrava
no print** (nasce no rodapé de qualquer rota enquanto ninguém responde), e o
rodapé exibia `captura-1787477116800@…` — o menu de usuário mostra o e-mail de
login, não um campo de perfil.

**Copy:** quatro funcionalidades eram nomeadas pelo que SÃO ("Painel de
resultados") e passaram a ser nomeadas pelo problema ("Quanto você tem para
fechar este mês"). **WhatsApp entrou como oitavo card** — não aparecia em lugar
nenhum da landing, apesar de ser o canal onde a PME brasileira vende. E o print
da tela "Hoje", 387 KB parados em `public/produto/` sem nenhum consumidor desde
a captura, virou o fecho de "Como funciona".

**Grafo de conhecimento e documentos alinhados na mesma rodada.** O PRD tinha
uma linha genérica para a landing; o `docs/schema.md` dizia 12 tabelas no
resumo e 14 no topo (são 14, reconferido pelo OpenAPI do PostgREST em produção:
14 definições, 29 RPCs, 12 FKs) e não registrava nenhuma das três **triggers**
que governam limite de plano — invisíveis para quem inspeciona colunas, que é
como aquele documento nasceu.

**Pendência honesta do grafo:** o limite de sessão dos subagentes interrompeu a
extração semântica no meio. Entraram o código (AST, determinístico) e o
diagrama; **12 arquivos ficaram re-enfileirados** para a próxima rodada (os 6
documentos e os 6 prints). O manifest foi salvo sem estampá-los de propósito,
então `/graphify . --update` os pega sozinho — não é preciso lembrar.

## Modo claro sem profundidade, e o jargão que sobrou (22/08)

Reportado com print: no claro "perde as forças, fica difícil de enxergar". Era
medível, não impressão. A escada de superfícies ia de **0.975 (página) a 0.988
(sidebar) a 1.0 (card)** — 2,5 pontos de luminosidade no total, uma chapa
branca. O escuro parecia melhor não por acaso: lá é 0.17 → 0.195 → 0.215, e
sobre base escura a mesma distância é enorme em termos relativos.

**A sidebar passou a ANCORAR em vez de flutuar** (0.957 < página 0.978 < card
1.0), que é como todo app de trabalho se comporta no claro: a navegação recua,
o conteúdo avança. Junto:

| token | antes | agora | por quê |
|---|---|---|---|
| `--border` | 0.922 | 0.893 | tem que desenhar contra o CARD BRANCO, não contra a página — era isso que apagava a grade do calendário |
| `--input` | 0.922 | 0.872 | campo é alvo de clique, some mais fácil que divisória |
| `--muted-foreground` | 0.556 | 0.50 | passava em AA por pouco (~4.6:1) e sumia sobre cinza; agora ~5.8:1 |
| `--sidebar-accent` | 0.97 | 0.925 | o hover era mais CLARO que a própria barra, não marcava nada |

Cartão ganhou sombra curta **só no claro** — sobre fundo claro o contorno
sozinho lê como desenho, não profundidade; no escuro a regra é anulada, porque
sombra preta sobre fundo escuro não aparece. Neutros com viés de matiz 205 para
acompanhar o primary teal.

Confirmado nos bytes servidos em produção (`--sidebar:oklch(95.7%...)`,
`--border:oklch(89.3%...)`), não só no build local.

**O jargão que a renomeação de 19/08 deixou passar.** A barra lateral dizia
"Resultados" e a página dizia "Dashboard"; os cartões diziam "Total de Leads"
enquanto o menu dizia "Contatos" — dois nomes para a mesma coisa na mesma tela.
E **"Pipeline pronto"** era o primeiro item que todo mundo lê ao criar a conta.

A descrição da tela virou resposta em vez de definição: "Métricas do seu funil
de vendas" (o que a tela É) → "Quanto entrou, quanto está em jogo e o que virou
venda" (o que ela RESPONDE).

**Telas de erro.** "Algo deu errado" + "Ocorreu um erro inesperado" dizia a
mesma coisa duas vezes sem responder a única pergunta que alguém faz ao ver
erro num sistema que guarda a carteira de clientes: *perdi o que era meu?*
Agora a resposta vem antes da instrução — "Seus dados estão salvos e seguros".

**Decidido não mexer:** a tarja de URL que o navegador mostra no rodapé ao
passar o mouse num link. É do navegador, não do site; escondê-la exige trocar
`<a href>` por `div onClick`, o que quebra abrir em nova aba, leitor de tela, e
**a barra de progresso deste projeto** (`navigation-progress.tsx` liga no
clique de `<a>` real, por delegação). Custaria três coisas que o cliente nota
para apagar uma que ele não nota.

## WhatsApp: por que o QR não conectava, e o caminho que funciona (23/08)

Três tentativas reais falharam com a mesma sequência: lê o QR, o WhatsApp pede
para ler de novo, e a segunda leitura devolve **"verifique sua conexão e tente
mais tarde"**. Essa mensagem **não existe neste código** — é do WhatsApp, e foi
o que mais atrasou o diagnóstico.

**O log da instância conta a história inteira:**

    19:26:59  QR code generated #1 (max: 30)
    19:27:14  Instance already running, settings updated WITHOUT RESTARTING
    19:27:31  Instance already running, settings updated WITHOUT RESTARTING
    19:29:19  QR code generated #6
    19:29:39  QR timeout — signaling kill channel
    19:29:39  Received kill signal

Duas coisas somadas: o Evolution **mata a sessão de pareamento após 6 QR
codes** (~160s), e a reconexão preventiva que a tela fazia **nunca reconectou
nada** — o servidor responde "already running" e ignora.

**As três saídas, testadas contra o servidor real:**

| tentativa | resultado |
|---|---|
| `/instance/connect` de novo | "already running", não reinicia |
| `/instance/disconnect` + connect | **também não** — `disconnect` só derruba número JÁ pareado |
| apagar + criar + conectar | sessão nova, contador de volta ao #1 |

**Erro registrado para não se repetir:** cheguei a implementar a segunda opção
e a descrever como solução, depois de um teste em que o QR mudou. O QR tinha
mudado por decurso de tempo, não pelo disconnect — correlação lida como causa.
Só apareceu ao medir de novo com o log na mão.

**A saída melhor, achada num print do painel do Evolution:** existe
`POST /instance/pair`, que devolve um **código de 8 letras**
(`{"data":{"PairingCode":"6VHM-7PC7"}}`) em vez de QR. Não tem janela de
câmera, a validade é folgada, e é o **único caminho para quem abre o CRM pelo
próprio celular** — ninguém escaneia a própria tela. Por isso o link para
trocar de modo fica visível sempre, não escondido atrás de uma falha.

**Outros números medidos, úteis para quem mexer nisso:**
`/instance/qr` custa ~3s por chamada e **fica para trás**: entregou 3 códigos
distintos enquanto o servidor gerava 4, com o primeiro parado na API por 65s.
E o QR só é servido depois que a sessão sobe — `/instance/connect` responde 200
ao ACEITAR o pedido, não ao terminar de parear.

**Se o código de pareamento também falhar**, a hipótese que sobra é o IP: a VPS
é Hostinger (datacenter, Campinas/SP), e o WhatsApp trata IP de datacenter como
sinal de automação. Aí a solução é externa ao código — proxy residencial
brasileiro (~R$ 18/mês), já registrado como risco na seção do Evolution.

## As funções rodavam nos Estados Unidos (22/08)

O piso de lentidão que três sessões tentaram derrubar estava no header que a
própria Vercel devolve, e ninguém tinha olhado:

    x-vercel-id: gru1::iad1::...
                  ↑     ↑
            borda SP   execução em Washington DC

O banco está em `sa-east-1` desde a migração de agosto. A função ficou em
`iad1`, o padrão da Vercel. Cada consulta atravessava o continente e voltava —
~110-160ms por ida, com 3 a 6 consultas por navegação.

**A decomposição que levou até lá**, medida em produção com sessão real:

| o quê | tempo |
|---|---|
| `/termos` (estática, CDN, sem função) | 85ms |
| `/api/log-erro` (função + 1 consulta) | 620ms |
| `/perfil` (rota logada mais simples) | 750ms |
| `/dashboard` (a pior) | 1221ms |

Os ~535ms entre a estática e a função apareciam **antes** de qualquer layout
ou consulta de página, e repetir a chamada não derrubava o número
(`615, 614, 649, 664`) — logo não era cold start, era a travessia.

**Armadilha que custou dois deploys quebrados:** `"regions": ["gru1"]` no
`vercel.json` **não comanda as funções de um projeto Next.js**. O deployment
passa a declarar `regions: ['gru1']` no metadata e continua executando em
`iad1`. Quem manda é `serverlessFunctionRegion`, configuração do PROJETO
(Settings → Functions), alterável por `PATCH /v9/projects/{id}`. Só vale para
deployments novos — mudar exige redeploy.

**E JSON não tem comentário.** A tentativa de explicar a escolha numa chave
`_comentario_regions` derrubou os dois deploys seguintes antes de qualquer
build: `should NOT have additional property`. O schema do `vercel.json` recusa
propriedade desconhecida.

## WhatsApp: o QR nunca vinha, e a causa é a VPS (22/08)

A tela mostrava o texto cru do servidor em vermelho
(`no QR code available. Please wait a moment and try again`). Medido: 20
tentativas em 134s, sempre 400, sempre ~5080ms (constante demais para ser
rede — é timeout interno), `Connected: false` o tempo todo.

`/instance/logs/{id}` diz a causa em texto claro, e ela não é do código:

    Failed to create container: failed to upgrade database:
    pq: sorry, too many clients already

O Postgres da VPS está sem conexão livre, o whatsmeow não cria o store da
instância, e sem store não há cliente nem QR. **Não é acúmulo de instância
órfã** — só existe 1 no servidor, conferido. Pendente do dono: reiniciar o
Evolution na VPS libera as conexões; se voltar, `max_connections` é baixo
demais para o pool que ele abre por instância.

Corrigido do lado do código: `conectarInstancia` pedia o QR no instante
seguinte ao `/instance/connect`, cujo 200 significa "pedido aceito", não
"sessão pronta". Agora espera dentro de um orçamento, com **teto de 5
tentativas** — sem teto, a correção teria trocado um erro diagnosticável por
um "Preparando…" eterno. Reconectar número já pareado também caía no mesmo
buraco e gravava `disconnected` por cima de conexão viva. E a Server Action
passou a registrar `ultimoErroDaInstancia`: foi o log do servidor que resolveu
o caso, e ele estava a uma chamada de distância o tempo todo.

## A migration que consertava um buraco inexistente (22/08)

A 0049 foi escrita afirmando que a policy de INSERT em `workspaces` deixava
qualquer autenticado criar empresas à vontade pelo PostgREST. **Falso**,
provado com sessão real: a PRIMEIRA linha já toma `42501`. Empresa não nasce
por insert aqui — nasce pela RPC `create_workspace_with_admin` (0007),
`security definer`, único caminho.

A trava existe desde a **0018**, dentro dessa RPC, e a ressalva de ler
`pro_vigente()` em vez da coluna `plan` já tinha sido corrigida pela **0038**
(FALHA 2). Medido com a RPC real: 1ª empresa criada, 2ª recusada. A 0049 foi
removida — aplicá-la criaria uma segunda cópia da regra de plano, divergindo
da primeira no dia em que uma mudasse.

Fica a lição, que é sobre método e não sobre esta migration: *"regra que só
vive na Server Action não é regra"* virou reflexo neste projeto, e o reflexo
disparou sem conferir se o banco já tinha a trava. Verificar primeiro.

## Envio de criativos com conferência de qualidade (20/08)

`/dono/criativos` deixou de ser só galeria: virou a porta de entrada das peças,
com **anúncio e orgânico em pastas separadas** (`criativos/anuncio` e
`criativos/organico`, as duas fora do Git). Arrasta foto ou vídeo, e o arquivo
é conferido **antes de subir**.

**Só entra o que serve, e a recusa ensina.** Cada reprovação diz três coisas: o
que está errado, por que importa e o que fazer. "Arquivo inválido" transfere
para a pessoa o trabalho de adivinhar, e o resultado é ela parar de testar
criativo — que é a alavanca mais barata do tráfego pago. Reprova o que
**quebra** (proporção fora das três do Meta, largura abaixo de 1080, formato
recusado, vertical acima de 90s); ressalva o que só **custa desempenho** (vídeo
de 3 minutos, arquivo acima de 1 GB, quadrado onde o vertical rende mais).
Bloquear o que apenas rende menos seria decidir pelo dono.

**Os dez posicionamentos se resolvem em três proporções** — 1:1, 4:5 e 9:16 —,
e é isso que a peça aprovada mostra: em quais dos dez ela entra. Números
conferidos na documentação do Meta em 20/08, não de memória: mínimo 1080p,
MP4/MOV, teto de 4 GB, Reels até 90s, 15-60s de melhor desempenho, e a zona
segura vertical (14% no topo, 20% no rodapé) que o Meta unificou em março de
2026 em torno do Reels, o mais restritivo.

**A medição acontece no navegador, e a autorização no servidor.** O navegador
mede antes de enviar porque isso recusa um vídeo de 200 MB em um segundo, sem
subir nada. Mas medição no cliente é informação, não permissão — e isso foi
provado durante a construção: **um arquivo de 720×720 declarado como 1080×1080
passou e entrou na biblioteca**. A rota passou a medir a imagem dos bytes reais
(`medirImagemNoServidor`, a mesma função que a galeria já usava) e a descartar
o número que o cliente manda. Para vídeo a medida do navegador é aceita, e a
limitação está escrita no código em vez de escondida: ler dimensão de MP4
exigiria ffmpeg, e o risco real aqui é peça ruim na biblioteca, não estranho
escrevendo no disco — a rota inteira está atrás do gate de ambiente local.

**Provado contra o servidor real:** 1080×1920 aceito com os 5 posicionamentos
listados; 1920×1080 recusado por proporção com as três medidas certas na
resposta; 720×720 recusado por resolução; `video/x-msvideo` recusado por
formato; orgânico gravado na pasta própria. Em build de produção,
`/dono/criativos`, `GET` e `POST` de `/api/dono/upload` e a rota que serve o
arquivo devolvem **404** — o `GET` levava 405, que confirmava a existência da
rota, e isso foi fechado. 402 testes (381 antes + 21 novos).

## WhatsApp pelo Evolution API: fase 1, o laço fechado (21/08)

Integração construída, **ainda não ligada** — falta a VPS. O que existe é o
código inteiro da fase 1, com a migration escrita e o gate limpo.

**A dor mudou de lugar durante a pesquisa, e isso mudou o produto.** A promessa
atual é "pare de perder venda por esquecimento". Verdadeira, mas é a *segunda*
dor. A primeira, achada em fontes de mercado: **o vendedor sai e leva a
carteira junto.** O histórico mora no celular dele; na demissão ou na saída
para o concorrente, a empresa perde contato, negociação em andamento e
histórico de uma vez — e ainda fica exposta na LGPD, porque continua
responsável pelo dado sem conseguir auditar. Esquecer uma venda dói uma vez;
perder a carteira não tem conserto.

Por isso a fase 1 é **o laço fechado**, não o chat: toda mensagem recebida vira
`activity` do lead e, se não houver tarefa aberta, uma tarefa "Responder no
WhatsApp" com prazo de 2h. Número desconhecido vira lead novo — cliente
chegando pelo WhatsApp entra no funil sozinho. A empresa passa a ser dona do
histórico, independentemente de quem atendeu.

**A restrição que define o escopo, e que precisa ser dita na venda:** no
Evolution, uma instância é uma sessão de WhatsApp Web. Todos veem a **mesma**
caixa de entrada — não há fila com dono definido nem relatório por atendente.
Isso é recurso da API oficial. A fase 1 resolve "a empresa é dona do
histórico"; não resolve "cinco vendedores dividindo a fila".

**Capacidade medida (Evolution Go, 50-150 MB/instância segundo a Hostinger),
com folga de 30%:** KVM 2 = 33 clientes (R$ 49/mês) · KVM 4 = 79 (R$ 71) ·
KVM 8 = 170 (R$ 143). Para 400: 5× KVM 4 = R$ 355/mês. O gargalo é RAM, não
CPU — mesmo 244 sessões reconectam em ~11s num KVM 8.

**O risco, registrado e não escondido.** Desde janeiro de 2026 a Meta detecta
por **fingerprint de comportamento** (cadência, tempo entre ações, IP), não
mais só por volume: número antigo e volume baixo não protegem mais. A
comunidade relata 40-60% de suspensão no primeiro trimestre. As camadas
construídas — limite por idade da conexão (10/h na 1ª semana → 20 → 30, nunca
acima de 30/h), **nenhuma função que aceite lista de destinatários**, e
assinatura só de `MESSAGES_UPSERT` e `CONNECTION_UPDATE` — reduzem muito.
**Não zeram.** A proteção mais eficaz é externa ao código: proxy residencial
brasileiro (~R$ 18/mês), sem o qual a conexão sai pelo IP do datacenter, que é
o primeiro sinal que o WhatsApp procura.

**Duas correções sobre o código antigo** (`1133f42`, da Cloud API):

- O casamento de telefone era **O(n) por mensagem** — buscava todos os leads do
  workspace e comparava os últimos 8 dígitos em JavaScript. Com 3.000 leads,
  cada "oi" varria 3.000 linhas. Virou índice funcional
  (`right(regexp_replace(phone,'\D','','g'), 8)`) + RPC `security definer`.
- A tabela de dedupe **nasce com purga de 7 dias**. Projetado a 240 mil
  eventos/dia (400 clientes), ela chegaria a 9,7 GB em 12 meses e estouraria o
  plano do Supabase em ~9 meses guardando dado sem valor. A
  `asaas_webhook_events` sobrevive sem limpeza só porque recebe poucas linhas
  por mês.

**Achado de brinde:** `purge_old_asaas_webhook_events()` existe desde a
migration 0014 e **nunca foi agendada** — o comentário de lá esperava
`pg_cron`. Não precisava: `/api/cron/limpar-eventos` agora roda as duas purgas
por Vercel Cron, ligando uma função que estava pronta e parada há semanas.

**Atualização (21/08, tarde): migration 0047 aplicada em produção** via MCP do
Supabase (projeto `tmyeunithjqkbwvezyyn`) — `whatsapp_webhook_events`, o
índice funcional de telefone e as duas RPCs (`encontrar_lead_por_telefone`,
`purge_old_whatsapp_webhook_events`) já existem no banco real. **Tela de
conexão com QR Code entregue** (`components/settings/evolution-connect-dialog.tsx`):
diálogo com aviso de risco antes do QR, renova o código a cada 18s (expira em
segundos), verifica conexão a cada 3s e fecha sozinho ao conectar. Ligada no
card de WhatsApp em `/settings` (`integrations-tab.tsx` ganhou `whatsapp` na
lista de providers, antes só tinha Google Calendar/Gmail).

**Pendente para ligar:** VPS comprada, falta colar as três variáveis
(`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET`) no
`.env.local` e na Vercel, e testar ponta a ponta com número descartável —
conectar pelo diálogo, mandar mensagem de fora, ver virar atividade + tarefa.

414 testes (sem novo teste nesta rodada — o diálogo é UI, coberto por leitura
do fluxo, não por unitário), tsc, lint e build limpos.

## Central do Dono, parte 2: alertas, anúncio e criativos (20/08)

A Central ganhou três páginas próprias (`/dono/alertas`, `/dono/anuncio`,
`/dono/criativos`), navegadas por link real — não aba com estado, para o botão
voltar funcionar e cada página carregar só o que precisa. O resumo dos alertas
continua no topo da Visão geral, com as três mais graves e um link.

**O ruído foi o achado.** Na primeira execução, **8 dos 11 alertas eram
e-mails de teste que eu mesmo gerei** em sessões anteriores. Medido: dos 7
e-mails com falha, **6 nem tinham conta no banco** — endereços inventados por
script. Uma fila com 70% de lixo ensina a ignorar a fila inteira, e junto com o
item chato vai embora o alerta de dinheiro.

A correção não é lista negra nem regex de "parece teste": `montarPendencias`
passou a receber o conjunto de e-mails que pertencem a contas reais e **ignora
falha para endereço que ninguém usou para se cadastrar**. Resultado medido:
**11 → 4 alertas**, e os 4 restantes são os problemas de verdade (3 de
dinheiro). Cada alerta ganhou "silenciar", com contador e volta — silenciar sem
poder desfazer é o mesmo que perder.

**Por que regex de "teste" foi descartado, com um caso concreto.** Ao preparar
a limpeza, o padrão pegou `testei122@gmaa2il.com` — que **não é teste**: é
pessoa real que digitou o e-mail errado (`gmaa2il` em vez de `gmail`), dona da
"Agência Nova Era" com 2 contatos e 2 negócios. Apagar por padrão automático
teria destruído dado de cliente. A limpeza foi por lista conferida uma a uma, e
o caso dela virou um **alerta novo**: `lib/dono/dominios.ts` compara o domínio
com os comuns por distância de edição e avisa que aquela pessoa nunca vai
receber confirmação de cadastro, recuperação de senha nem cobrança — oferecendo
o telefone que ela cadastrou. Outro alerta novo: cliente que usou e sumiu há
mais de 14 dias.

**Limpeza dos dados de teste, feita:** empresas `Workspace Teste E2E` e
`Teste Pro` (esta era a do `sub_teste_local` dando Pro de graça) e 4 contas
órfãs. **26 → 24 empresas**, cascata levou o conteúdo, e a "Agência Nova Era"
foi conferida intacta com seus 2 contatos depois.

**`/dono/anuncio` nasce nos dois estados.** Enquanto nenhuma campanha rodou —
que é hoje — a pergunta é "posso ligar?", e a tela é uma lista de conferência
verificada contra a API: pixel certo na conta, fuso, eventos chegando, campanhas
existentes, e se o token permite agir. Uma tabela de zeros seria inútil
justamente quando ele mais precisa de direção. Depois que gastar, a tela vira
**quanto custou cada cliente pagante** — gasto do Meta ÷ empresas que vieram da
campanha e viraram Pro, com o payback em meses de mensalidade. Esse número é
possível porque `workspaces` já guarda `utm_campaign`/`fbc` e
`utm-capture.tsx` já grava; a ponte estava construída e **nunca havia sido
exercitada** (0 de 24, porque nenhuma campanha rodou). `lib/dono/atribuicao.ts`
é o primeiro consumidor dela.

Ações no anúncio: **pausar, ligar e mudar orçamento** — as três reversíveis.
Criar campanha ficou de fora de propósito: são ~15 campos onde errar um queima
dinheiro em silêncio, e é decisão estratégica, não operação. Continua pelo chat.
Mudar orçamento mostra o valor atual ao lado do novo, porque é a única cujo erro
só aparece na fatura.

**`/dono/criativos` nasce pronta e vazia.** O gerador de imagem (Replicate) não
está ativo — confirmado, a chamada expirou em 300s. A galeria lista o que
estiver na pasta `criativos/` (fora de `public/` e fora do Git), mede a
dimensão lendo o cabeçalho do arquivo à mão — sem dependência nova no
`package.json` do produto por causa de uma tela local — e diz em que formato do
Meta a arte se encaixa. Provado com três artes: 1080×1080 aprovada exata,
1024×1024 aprovada com "pode aparecer borrada", 1920×1080 recusada com a
sugestão do formato mais próximo. A rota que serve a imagem
(`/api/dono/criativo/[arquivo]`) recusa travessia de diretório — testado com
`../.env.local` e variações codificadas, todas 404.

**Provado contra produção:** build de produção devolve **404** nas quatro rotas
e na rota de imagem, enquanto `/` e `/login` dão 200; em `dev` as quatro abrem
por `localhost` e dão 404 com `Host` do IP da máquina, do domínio real ou
`localhost.evil.com`. Silenciar levou a fila de 4 para 3 com o contador certo.
381 testes (319 antes + 62 novos).

## Central do Dono, só em localhost (20/08)

Rota `/dono`, fora do produto: uma tela que responde quem são todos os
clientes, quanto entra por mês, o que está quebrado — e comanda o que precisa
ser comandado. Existe porque o RLS deste projeto **não tem conceito de dono da
plataforma** (tudo gira em `is_workspace_member`/`is_workspace_admin`, relativo
a um workspace), então qualquer pergunta sobre o negócio inteiro exigia
escrever script Node na hora.

**Ela se pagou antes de existir.** A investigação que precedeu o código cruzou
as assinaturas do Asaas contra o banco e achou dinheiro parado, em produção:

| Assinatura | Asaas | Banco | O que era |
|---|---|---|---|
| `sub_epjbmoerbqoz7c76` | ATIVA | não existe | assinatura viva que o sistema nunca registrou |
| `sub_dbs8pblwj2irujc2` | ATIVA | `past_due`, vencimento nulo | pessoa com assinatura ativa **sem receber o Pro** |
| `sub_3qwh8ygjnpon66ae` | ATIVA | `past_due`, vencimento nulo | idem |
| `sub_teste_local_1786896365194` | não existe | `active` até 15/09 | **assinatura de teste dando Pro de graça** |

Das 4 assinaturas ativas no gateway, **3 não estavam entregando o plano**, e um
dos 2 "clientes Pro" do banco era lixo de teste. Nada disso gerava erro em
lugar nenhum — do ponto de vista do sistema, estava tudo funcionando. A causa
raiz provável é o `CRON_SECRET` que nunca foi colado na Vercel (pendência
aberta abaixo): o cron de reconciliação toma 401 todo dia em silêncio.

**O gate de ambiente, que é o que sustenta o resto.** A Central lê com
`createAdminClient()`, que ignora RLS por completo — vê nome, e-mail, telefone
e valor de negócio de todos os clientes. Publicar isso é vazamento de dado de
terceiro sob a LGPD. Este é o **primeiro gate de ambiente do projeto** (a
varredura anterior por `NODE_ENV`/`VERCEL_ENV` só achava flags de cookie
`secure`), e ele tem duas condições, não uma: `NODE_ENV === 'development'`
**e** host local. A segunda existe porque `next dev` escuta em todas as
interfaces de rede — sem ela, qualquer pessoa no mesmo Wi-Fi abriria
`http://<ip-da-máquina>:3000/dono`. A decisão mora numa função pura
(`lib/dono/ambiente.ts`, 12 testes) porque gate de segurança sem teste é gate
que ninguém sabe se funciona, e o `import 'server-only'` fica no irmão
(`somente-local.ts`), que é chamado no layout, na página e no topo de cada
query e cada ação.

Provado nos quatro sentidos: build de produção devolve **404** em `/dono`
enquanto `/` e `/login` dão 200; `npm run dev` abre por `localhost` e
`127.0.0.1`; e com o dev rodando, requisição com `Host:` do IP da máquina, do
domínio real, ou `localhost.evil.com` toma 404.

**Números conferidos contra medição independente**, não estimados: entra por
mês R$ 98 (2 × R$49, via `pro_vigente()`), saldo R$ 43,05, a receber R$ 245 (5
cobranças), vencido R$ 98 (2), 26 empresas, 15 novas em 7 dias. O card
"Assinaturas no Asaas" mostra 4 com a nota "mas só 2 com Pro aqui" — a
divergência fica impossível de não ver.

**Controle total**, cada ação atrás do mesmo gate: consertar assinatura
(reusa `lib/asaas/aplicar-evento.ts`, o caminho já compartilhado entre webhook
e cron, para não virar uma terceira cópia da regra do dinheiro), liberar Pro de
cortesia por 30 dias, voltar para Grátis, apagar empresa (exige digitar o nome
exato, conferido **no servidor**). Tudo gravado em `.dono-registro.jsonl`
(fora do Git): liberar Pro de brinde e esquecer quem ganhou é problema de
dinheiro, e terminal some quando a janela fecha. As três ações foram provadas
ponta a ponta com empresa descartável — `pro_vigente()` virando `true`,
voltando a `false`, e a exclusão levando a assinatura em cascata; base voltou
a 26 empresas no fim, nada deixado para trás.

**O bloco de anúncio nasce desligado, de propósito.** Falta um token com
`ads_read` (`META_ADS_TOKEN`); o que existe, `META_CONVERSIONS_API_TOKEN`, só
envia conversão — testado, a Graph API responde `(#200) Ad account owner has
NOT grant ads_management or ads_read permission`. Mostrar "R$ 0,00" ali seria
mentira perigosa: gasto zero por falta de token é indistinguível de gasto zero
de verdade, e essa diferença é o que decide se há campanha rodando.

**O Meta Pixel parou de sujar os próprios dados.** `meta-pixel.tsx` filtrava
por rota mas não por ambiente: disparava de `localhost` e de todo preview da
Vercel. Medido na API da Meta, **18.192 PageViews de `localhost` numa hora só**
(13/08). Isso entra no conjunto com que a Meta aprende quem é o público — ruído
de desenvolvimento vira anúncio otimizado para gente que não existe. Agora só
dispara em `www.velofunil.com.br`. Provado com navegador real, mesma sessão:
em localhost o script `meta-pixel` não existe no DOM; em produção existe, com
o id certo.

## Infraestrutura: Supabase Pro, Vercel Pro, Fluid Compute (20/08)

Os dois planos pagos no mesmo dia, com ganho **medido**, não estimado — padrão
de provar contra produção aplicado à própria infraestrutura, não só ao código.

**Supabase Free → Pro.** Duas medições independentes, mesmo projeto
(`sa-east-1`), mesmo dia, mesmas queries do código real
(`getWorkspaceSettingsData` e a RPC `sincronizar_plano_do_workspace`), antes e
depois do upgrade: 1.100ms → 150ms (86%) e 700ms → 167ms (76%). Ressalva
honesta registrada: parte do ganho pode ser o Supabase Free "dormindo" antes
da medição, não só compute — mas a melhora é real e grande de qualquer forma.

**Vercel Hobby → Pro + Fluid Compute.** Fluid Compute é grátis em qualquer
plano (`"fluid": true` em `vercel.json`), testado em par A/B isolado (branch
descartável, dois deployments de preview, nunca tocou `main` antes da
decisão): cold start 369ms → 150ms, quente 307ms → 141ms (54-59%). Aplicado
em produção depois da prova. Vercel Pro em si **não** deixa o site mais
rápido no volume atual (medido: 18 requisições/24h, longe de qualquer teto do
Hobby) — o motivo real de pagar foi outro: Hobby proíbe uso comercial nos
termos, e o produto já tem cliente pagante real. Importa pra quando o volume
crescer (teto de banda/requisições de borda, skew protection em deploy,
observabilidade que faltava pro mistério nunca resolvido do
`/esqueci-senha` de 108s).

**Gate de deploy, fechado de ponta a ponta.** As duas falhas que impediam o
workflow de completar desde a virada pra Vercel Pro:
- Parêntese não fechado num script bash embutido no YAML (`url=$(curl ...`
  nunca fechado depois de eu trocar o fim do passo) — corrigido extraindo a
  lógica pra `scripts/ci/publicar-saida-do-deploy.mjs`, testável isolado.
- `promote` via API é Pro/Enterprise (confirmado com `422` em 2 tentativas
  antes mesmo de saber a causa) — mesmo com Vercel Pro contratado depois, o
  workflow continua avisando o link em vez de promover sozinho, decisão
  registrada mais abaixo, não vale reautomatizar sem necessidade real.

**Segurança da conta Vercel.** Dois achados de alta prioridade do Security
Dashboard do time, resolvidos: `Enforce Sensitive Environment Variables`
(segredo vira só-escrita, ninguém reabre valor salvo) e
`Two-Factor Authentication Enforcement` (2FA obrigatório pra qualquer membro
do time). `Require Verified Commits` **ficou desligado de propósito**:
nenhum commit deste projeto é assinado hoje (conferido,
`commit.gpgsign`/`user.signingkey` vazios); ligar isso agora bloquearia todo
deploy futuro, inclusive os meus.

**E-mail de suporte, encaminhamento real.** `suporte@velofunil.com.br` não
tinha MX nenhum — quem escrevesse pra ele tomava bounce. Cloudflare Email
Routing configurado (grátis), encaminha pra caixa real do dono, mantendo o
domínio próprio autenticado no rodapé e nos e-mails transacionais (a
alternativa cogitada, trocar pra `velofunil@outlook.com`, foi descartada por
regressão de entregabilidade — domínio de terceiro não autentica).

**Abas de Configurações sem feedback, corrigido.** `components/settings/settings-tabs.tsx`
eram `<Link>` puros: clicar em Empresa/Equipe/Plano/Integrações não dava
nenhum sinal entre o clique e o conteúdo novo aparecer, então parecia travado
e a pessoa clicava de novo. Mesma classe de queixa já resolvida em
`workspace-switcher.tsx`/`user-menu.tsx`: `useTransition` + spinner na aba
clicada + todas desabilitadas durante a transição. Provado localmente (build
de produção real, conta de teste Pro): no tick imediatamente seguinte ao
clique, antes até da URL mudar, o spinner já está visível.

> Mantenha este arquivo curto. O detalhe de _por que_ cada coisa é assim mora
> nas mensagens de commit e nos comentários do código, que são a memória real
> do projeto. Aqui fica só o que não cabe em nenhum dos dois: o estado.

## O que os números de cliente realmente dizem (22/08)

Auditado no banco, separando por origem do e-mail de quem criou a conta. O
resultado corrige um número que este documento e o PRD vinham repetindo:

| grupo | empresas | ativaram | pagam |
|---|---|---|---|
| conta de teste (e-mail descartável: `neplis`, `beiwoh`, `joystill`…) | 15 | 5 | 1 |
| contas do próprio dono | 4 | 4 | 1 |
| **cliente real externo** | **8** | **5 (62,5%)** | **0** |

**As duas assinaturas "ativas" não são de cliente.** `Orne`
(`wixese9814@neplis.com`) é a conta em que o próprio dono pagou o Pix de R$ 49
para provar o checkout — o "primeiro Pix real" registrado abaixo é verdadeiro
como prova técnica e falso como receita. `Google Review Ltda`
(`google.review@velofunil.com.br`) é cortesia criada para o vídeo de
verificação do Google, válida até 2027.

O único cliente externo que chegou a tentar assinar, `Fani RRH Consultoria`,
está `past_due` desde 04/08 e nunca concluiu.

**Consequência prática, e é a que importa:** não existe conversão
cadastro→pagante medida, nem churn, nem LTV — não por falta de instrumentação,
mas porque a conversão nunca aconteceu com alguém de fora. Qualquer cálculo de
CAC feito sobre a base cheia (a conta de 7,7% que já circulou aqui) está medindo
as contas de teste do próprio dono.

O que É real e vale registrar: **5 de 8 pessoas externas que criaram conta
usaram o produto de verdade**. A ativação funciona; a monetização ainda não foi
provada uma vez sequer.

## Onde o produto está

Em produção em <https://www.velofunil.com.br>, funcional, com o **primeiro
Pix real confirmado** (workspace "Orne", R$49, 13/08). O fluxo de dinheiro foi
auditado ponta a ponta e funciona: pagamento confirmado libera o Pro, retry do
Asaas é deduplicado, cancelamento rebaixa, requisição sem token toma 401.

Esse mesmo pagamento expôs um buraco real: o webhook do Asaas não chegou a
tempo (o domínio estava fora do ar por causa da migração de DNS pro
Cloudflare, ver seção própria abaixo) e o Asaas **não reenvia webhook que
falhou por conta própria**, o pagamento ficaria preso pra sempre até alguém
notar. Corrigido em duas partes: (1) reenviei o webhook real pra produção,
aplicando o efeito completo (status, e-mail, evento Meta) exatamente como o
Asaas teria feito; (2) criei `GET /api/cron/reconciliar-assinaturas`
(`vercel.json`, roda 1x/dia via Vercel Cron, protegida por `CRON_SECRET`),
que varre assinaturas com status suspeito no banco, confere o status real via
API do Asaas e corrige sozinha, rede de segurança pra qualquer falha futura
de entrega de webhook, não só DNS. A lógica de aplicar o status (dedupe, RPC,
e-mail, Meta) foi extraída pra `lib/asaas/aplicar-evento.ts` e é reusada pelos
dois caminhos (webhook e cron), pra não divergir. Testado ponta a ponta com
assinatura descartável real no Asaas (`receiveInCash`, sem cobrança de
verdade): detectou divergência, corrigiu, gravou dedupe, e uma segunda
chamada não reprocessou.

Importação de planilha (`.xlsx` e `.csv`) entregue em 11/08, com mapeamento de
coluna, etapa lida do arquivo e criação de negócio junto do lead.

**Calendário e filtro de período entregues em 18/08.** Tela `/calendario`
(mês/semana/agenda) sobre as tarefas que já existem, sem tabela nova, e o
filtro de período do Dashboard ganhou 8 presets e um range picker visual (dois
meses no desktop, um no mobile), sem lib de calendário externa. Escopo
reduzido de propósito contra um pedido maior de 4 camadas (filtro + calendário
+ histórico dedicado + rastreabilidade de sincronização): medido contra
produção (12 tarefas em 21 workspaces, 1 integração conectada), o mesmo volume
que já reprovou IA/lead scoring e a Cloud API do WhatsApp neste projeto,
histórico dedicado e rastreabilidade ficaram de fora. Prova rodada contra o
banco de produção com workspace/conta/lead descartáveis (limpos no fim):
grade de 42 dias, tarefa concluída aparecendo no intervalo, e busca de
servidor da Semana ao navegar para fora do mês carregado, todos corretos.

**Verificação visual com Playwright, mesmo dia.** A sessão anterior tinha
registrado Playwright indisponível; nesta ficou disponível
(`playwright.config.ts` já existe no repo, do teste de auditoria de
segurança) e achou dois defeitos reais que a prova de dados não pegava:
`useMediaQuery` devolve `false` no primeiro render sempre (evita mismatch de
hidratação), e o `useState` do modo inicial do calendário lia esse falso
positivo de mobile só uma vez, travando todo desktop no modo Agenda em vez
de Mês. E `MonthGrid` já desenha cabeçalho de navegação próprio,
`month-view.tsx` não desligava (`mostrarNavegacao={false}`), duplicando
"Agosto de 2026" na tela por cima do cabeçalho que `calendario-client.tsx`
já desenha. Os dois corrigidos e reconferidos com screenshot real dos três
modos, drawer e mobile.

**Sidebar em seções e mensagem de Pro corrigida, 18/08.** Três achados
reportados com print do produto real. (1) `lib/nav-items.ts` era lista
plana; virou `navGroups`, grupo sem título (Hoje/Pipeline/Leads/Dashboard/
Calendário) e "CONFIGURAÇÕES" (Perfil — rota já existia, só não estava na
sidebar, vivia escondida no menu do rodapé; Equipe; Integrações;
Preferências, renomeado de "Configurações" pra descrever melhor a aba de
dados da empresa). (2) Mensagem "Seu Pro venceu, reative" aparecia pra quem
**nunca teve Pro**: `subscriptions` é 1 linha por workspace, sem histórico,
não dá pra checar isso na assinatura. Resolvido sem migration:
`integration_connections` só ganha linha quando o workspace está ou esteve
Pro (migration 0037 gateia o insert/update), então existir qualquer linha,
de qualquer provider, prova que o Pro já existiu algum dia. Zero linha vira
"Integrações são um recurso Pro. Faça upgrade para conectar."; alguma linha
mantém a mensagem de reativação. Extraído pra
`lib/integrations/mensagem-bloqueio-pro.ts`, reusado pelas duas Server
Actions que antes duplicavam a string. (3) Drawer de negócio
(`deal-detail-sheet.tsx`), bloco "Próxima ação": texto/badge de prazo
colavam nos botões "Google Calendar"/"Concluir" em mobile —
`flex items-center justify-between` virou `flex-col` até `sm:` (640px),
volta a ficar lado a lado a partir daí. Prova rodada com Playwright contra
produção: sidebar em desktop e mobile (screenshot), os dois casos de
mensagem de Pro com workspace descartável (com e sem
`integration_connections`), e o drawer em viewport 390px confirmando as
linhas separadas. Tudo limpo no fim.

**Deploy confirmado em produção, mesmo dia.** Os dois commits acima
(calendário/captura de erro e sidebar/mensagem de Pro/drawer) demoraram pra
aparecer no ar depois do `git push` — chegou a parecer gatilho Git→Vercel
quebrado (`/calendario` deu 404 por mais de 15 minutos após o push).
Confirmado depois que era só demora do deploy processar: `/calendario`
passou a responder `307` (redirect de sessão, esperado) e
`/api/log-erro` a validar payload (`400` em corpo vazio), os dois contra
`https://www.velofunil.com.br` direto, sem depender de painel.

Junto: Dashboard ganhou "Exportar relatório" em PDF (`html2canvas-pro` +
`jspdf`); formulário de negócio trocou o `Select` de lead por um combobox com
busca (workspace com muitos leads exigia rolar a lista toda); e trocar senha
dentro do produto passou a exigir confirmar a senha atual (sessão sequestrada
antes bastava para trancar o dono de fora da própria conta, mesma classe de
achado que a auditoria de segurança já tinha corrigido em `deleteAccount`).

**Auditoria completa (segurança + código + UI/UX), 18/08.** Três varreduras
em paralelo contra o estado atual do código (sem re-listar o que já estava em
"Armadilhas já pagas"). Resultado: 0 CRITICAL, 0 HIGH, 3 MEDIUM, 9 LOW — as 8
correções acionáveis já aplicadas:

- `app/error.tsx` (boundary de login/cadastro/landing) não chamava
  `reportarErro`, só `(dashboard)/error.tsx` e `global-error.tsx` chamavam.
  Erro em `/login` ficava invisível, a mesma lacuna que a 0046 existia pra
  fechar. Corrigido, com origem `'publico'` nova.
- `/api/log-erro` sem rate limit: rota pública, grava com service role, sem
  sessão exigida — podia ser martelada e encher `error_logs` de ruído.
  30/hora por IP, mesmo padrão de `lib/rate-limit.ts`.
- `getWorkspacesExclusivosDoUsuario` (`lib/workspace/queries.ts`) sem
  `.limit()` na contagem de membros — mesma classe de corte silencioso do
  PostgREST em 1.000 linhas já corrigida 3x no projeto, mas aqui o efeito é
  sério: workspace grande podia ter a contagem cortada, aparecer como
  "exclusivo" por engano, e `excluir_minha_conta` apagaria o workspace de
  outras pessoas junto com a conta de quem excluiu a própria. Trocado por
  `count: exact, head: true` por workspace (agregado no banco, não trazendo
  linha por linha). `getWorkspaceSettingsData` ganhou o mesmo `.limit()`
  preventivo, impacto menor hoje mas mesma classe de defeito.
- `assignee_id` de tarefa não conferia se o UUID era membro do workspace
  ativo — mesma classe que a 0038 já corrigiu pra `lead_id`/`deal_id` em
  `tasks`/`deals`, não estendida pra responsável. `conferirAlvo`
  (`lib/tasks/actions.ts`) ganhou a terceira checagem.
- Alvo de toque abaixo de 44px no Calendário: `TaskChip` (24px) e o botão
  "+N" do modo Mês, únicos dois lugares que não seguiam a regra de
  `min-h-11` já aplicada em `select.tsx`/`combobox.tsx`/`month-grid.tsx`.
  Corrigido só em mobile (`md:` volta ao tamanho compacto, onde o toque é
  por mouse).
- `mensagem-bloqueio-pro.ts` sem teste: a lógica de decisão foi extraída
  pra uma função pura (`mensagemPorContagemDeConexoes`), testável sem
  mockar Supabase, mesmo padrão do resto de `lib/**`. 4 testes novos,
  cada um documentando o caso (incluindo o defeito original que motivou a
  função: nunca-teve-Pro recebendo mensagem de reativação).
- `useEffect` de `deal-detail-sheet.tsx` dependia de uma arrow function
  inline (`onAgendamentoAberto`) recriada a cada render de `kanban-board.tsx`
  — sem bug hoje (protegido por guard), mas frágil. Virou `useCallback`.

Prova rodada contra produção real: rate limit testado com 31 requisições
seguidas (30 passam, a 31ª toma 429, limpo depois); checagem de
`assignee_id` testada com usuário real fora do workspace (corretamente não
encontrado como membro). `npx tsc --noEmit`, `npm run lint`, `npm test`
(319 testes, 315 + 4 novos), `npm run build`, os quatro limpos.

Achado à parte, não corrigido (não é meu código): `.env.example` tem uma
edição pendente, não commitada, trocando o remetente sugerido do SMTP de
`suporte@velofunil.com.br` pra `velofunil@outlook.com` — domínio de
terceiro no lugar do domínio próprio, se isso for aplicado no SMTP real do
Supabase é regressão de entregabilidade (mais chance de cair em spam,
exatamente o problema que o comentário do próprio arquivo já documenta).

O Pro passou a ter prazo (0027): pagou, vale 30 dias; venceu, o limite do Free
volta a valer. Sem `pg_cron` de propósito, a validade é uma função consultada
por quem aplica limite, então plano vencido para de valer no instante em que
alguém tenta usá-lo.

Fluxo de entrada refeito em 11/08: convite deixa de virar conta separada,
confirmação de e-mail termina numa tela com botão, `/verifique-email` reenvia,
e quem clica em "Assinar Pro" na landing chega ao checkout.

**Tarefas e próxima ação entregues em 12/08** (migration 0029). Tela `/hoje`,
próxima ação no card do Kanban no lugar do prazo, bloco de tarefas na página do
lead, agendar/concluir no painel do negócio, e botão de WhatsApp por link
`wa.me`. Zero credencial nova e zero dependência nova, nada disso depende de
serviço externo.

**Onboarding entregue em 12/08** (migrations 0030 e 0031). Boas-vindas para
quem chega, assistente de 4 perguntas que retoma de onde parou, dados da
empresa em 18 campos com logo no Storage, tour de 5 passos e checklist de
ativação derivado do estado real. Também sem credencial nova.

**Escala e negócio parado, 12/08** (0032 e 0033). O teto de 1.000 linhas do
PostgREST fazia o funil, o Kanban e o seletor de leads mentirem em silêncio,
corrigido com contagem no banco e teto por etapa. E `deals` ganhou
`stage_changed_at`, que só anda quando a ETAPA muda: é a base do filtro
"Parados" no board.

**Performance e banco em São Paulo, 12/08.** Investigação mostrou três causas
distintas para "às vezes precisa clicar duas vezes" e "algumas telas
demoram": `mobile-sidebar.tsx` era o único `Sheet` do projeto sem
`SheetTrigger` (o botão, fora do portal, brigava com o "clicar fora fecha" e
piscava); `workspace-switcher.tsx` parava o spinner antes do `router.refresh()`
aplicar os dados novos (agora usa `useTransition`); e o banco estava em Ohio
(`us-east-2`) enquanto a Vercel roda em São Paulo, **196ms por consulta**,
medido, vezes 8-10 consultas por navegação. Corrigido: consulta de onboarding
saiu do middleware (ida em série) e foi para o layout (`Promise.all`);
`sincronizar_plano_do_workspace` (que era ESCRITA a cada navegação) saiu do
caminho quente e roda só em `/settings`; layout e `resolverWorkspaceAtivo`
passaram a compartilhar UMA consulta a `workspace_members` em vez de duas.

**Migração para `sa-east-1` em andamento**, projeto novo criado
(`tmyeunithjqkbwvezyyn`), as 33 migrations reaplicadas (0002 e 0016 puladas de
propósito: seed de teste e limpeza que não fazem sentido em projeto limpo),
RLS conferida ligada nas 11 tabelas, e os dados copiados com contagem batendo
100% nos dois bancos (15 contas, 10 workspaces, 12 membros, 10 leads, 16
negócios, 5 atividades, 5 assinaturas, 4 convites, 4 tarefas, 15 onboarding).
Quatro provas de RLS/regra de negócio passaram (isolamento entre empresas,
autoupgrade de plano, onboarding de terceiro, autoconvite, todas bloqueadas).

**Uma coisa ficou pendente**, por bloqueio do classificador de segurança do
Claude Code ao tentar ler `auth.users` em lote (senha + token juntos, mesmo
linha a linha): os hashes de senha das 15 contas **não** foram copiados, as
contas existem no projeto novo com o mesmo `id`/e-mail, mas sem senha, então
todo mundo precisa de "esqueci minha senha" no domínio novo antes do cutover.
O arquivo real do bucket `logos` (a logo do workspace "HYJKYKKL") **foi**
copiado, baixado do projeto antigo e reenviado ao novo por `fetch` direto com
a `service_role key` de cada lado, conferido com o mesmo tamanho (258.596
bytes) nos dois. Ver `Pendente do dono` abaixo para o que falta para o corte
final.

**Integrações oficiais entregues em 12/08** (migration 0034): Google Calendar
e Gmail, conectáveis em **Configurações → Integrações**. Ver seção própria
abaixo, grande o suficiente para não caber neste resumo. (A mesma migration
também trouxe WhatsApp Business Cloud API, removida em 13/08, decisão de
produto de não usar; ver seção própria.)

Ambiente local: rode `node --env-file=.env.local scripts/verificar-ambiente.mjs`.
Ele confere as 9 conexões e diz o que falta.

**Lag de navegação investigado e corrigido em 12/08.** Sintoma relatado:
atraso entre clicar num item do menu (Leads, Configurações, Dashboard...) e a
tela mudar, às vezes exigindo dois cliques. Causa raiz, achada lendo código
(não suposta): `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding`, as
duas rodam em paralelo no `app/(dashboard)/layout.tsx` a cada navegação,
cada uma tinha sua PRÓPRIA chamada a `supabase.auth.getUser()`, cada uma no
seu `cache()` do React. `cache()` deduplica chamadas repetidas à MESMA
função, não duas funções diferentes fazendo a mesma coisa, então toda
navegação pagava 2 idas redundantes ao Supabase Auth, além da do middleware.
As duas passaram a compartilhar uma única função cacheada
(`lib/supabase/usuario-autenticado.ts`). Complementar: como o layout do
dashboard faz `await` de tudo isso ANTES de renderizar, sem `<Suspense>`,
nenhum `loading.tsx` de rota aparecia enquanto essa cadeia rodava, zero
sinal entre o clique e qualquer pixel novo, o que faz a pessoa clicar de novo
achando que não funcionou. `components/layout/navigation-progress.tsx`
resolve isso: liga no clique real (delegação de evento em `document`,
qualquer `<a>` interno), desliga quando a rota muda de verdade, não é
temporizador fingindo progresso.

## Escudo na frente do site: DNS migrado pro Cloudflare (19/08)

Pedido veio de slide próprio do dono ("WAF + Bot Fight Mode + Rate
Limiting"), junto com pedido de reprovar RLS. RLS provado 14/14 contra
produção real (sessão autenticada verdadeira, não `service_role`):
isolamento entre workspace segura mesmo com interface burlada. Mas
confirmado, com `nslookup -type=NS` e headers HTTP, que **não havia
nenhum filtro de borda**: domínio resolvia direto pro IP da Vercel, sem
proxy, sem WAF, sem rate limit fora do que já existe em
`lib/rate-limit.ts` (que só age depois que a requisição já chegou no
servidor).

Migração de nameserver guiada passo a passo (ação em painel de terceiro,
fora do meu alcance, só orientação + confirmação via `nslookup`/`curl`
depois de cada etapa do dono): domínio adicionado ao Cloudflare, os 8
registros de DNS (A, CNAME-Vercel, MX/TXT-Resend com SPF/DKIM/DMARC,
TXT-Google, TXT-Facebook) confirmados replicados **antes** da troca de
nameserver (ordem importa: só depois de confirmar isso é seguro trocar),
nameservers do registro.br trocados pra `alfred.ns.cloudflare.com` /
`marjory.ns.cloudflare.com`. Propagação em ~2h, confirmada depois via
`nslookup -type=NS` (nameserver mudou de verdade) e `curl -sI` (`Server:
cloudflare` e `cf-nel` nos headers de produção). Zero downtime, zero
registro perdido — Resend, Vercel e Google seguem funcionando sem
nenhuma mudança de configuração do lado deles.

Depois de propagado, 3 proteções confirmadas ativas em produção:

- **WAF (Cloudflare Managed Ruleset)**: já vem "Always active" por
  padrão no Free, cobre CVE conhecida (log4j/RCE, SQLi, code injection).
  Não precisou de ação manual, só confirmação no painel.
- **Bot Fight Mode**: confirmado ativo ("JS Detections: On"), desafia
  bot automatizado.
- **Rate limiting**: regra criada manual (Free só permite 1), em
  `/login`, 30 requisições/10s por IP, ação Block — a rota mais crítica
  pra força bruta de senha. `/api/webhooks/asaas` e `/api/log-erro`
  ficam sem regra dedicada de borda até upgrade de plano, mas já têm
  rate limit próprio da aplicação (`lib/rate-limit.ts`).

RLS continua sendo a defesa real de isolamento de dado (nada muda se o
Cloudflare falhar ou for contornado); o Escudo é filtro de volume/tipo de
tráfego ruim antes de chegar no servidor, reduzindo o que bate no código
em primeiro lugar. Sem custo (plano Free), sem mudança de código, sem
risco às integrações existentes.

## Redesign do fluxo de autenticação e da landing (19/08)

Commit `ad90527`. Pedido do dono: fluxo inteiro de criar conta até entrar no
produto com cara profissional e animação de verdade, mais a landing "menos
genérica e mais vendável". Referência trazida: o signup do monday CRM (tela
dividida) e um componente de exemplo com depoimentos e foto de banco de
imagem — **os depoimentos e a foto ficaram de fora de propósito**, a decisão
travada contra prova social inventada continua valendo.

**Três bugs silenciosos apareceram durante o trabalho**, todos corrigidos:

1. **`--ease-entrada` nunca chegou ao CSS compilado.** `globals.css` tinha um
   terminador de comentário no meio do texto; as linhas seguintes viravam CSS
   cru, o parser achava o `{` do `:root` abaixo e descartava a regra inteira.
   `grep -c entrada` no compilado dava **0**. Os 10 usos de `ease-entrada` e o
   `var(--ease-entrada)` do RevealOnScroll rodavam com o easing padrão do
   navegador desde sempre. **A landing mudou de sensação junto com a
   correção** — é a curva que o autor escreveu, rodando pela primeira vez.
   A variável vive num `@theme static`: `@theme` porque é o namespace
   `--ease-*` que gera a utility, `static` porque `inline` pararia de emitir a
   variável em `:root` e o RevealOnScroll a lê em `style` inline (var
   indefinida dentro de shorthand `transition` invalida a declaração inteira).
2. **`Separator` nunca desenhou.** O primitivo do Base UI emite
   `data-orientation="horizontal"`, mas a classe era `data-horizontal:h-px`,
   que gera o seletor `[data-horizontal]` — atributo inexistente. Altura 0. Os
   divisores "ou" de login/cadastro apareciam sem as linhas, e o separador do
   painel de negócio no Kanban não pintava. Exceção consciente à regra de não
   editar `components/ui` à mão: regenerar pelo CLI traria o defeito de volta.
3. **`CardHeader` é grid, e `items-center` ali alinha no eixo vertical.** Sem
   `justify-items-center` o ícone de estado (largura fixa) encostava à
   esquerda enquanto o texto centralizava.

**Estrutura:** `app/(auth)` virou dois route groups. `(entrada)` tem login e
cadastro em tela dividida — formulário à esquerda, `PipelinePreviewCard` à
direita (o mesmo funil do hero, HTML puro, zero JS, `aria-hidden`). O corte é
em `lg` por conta, não por gosto: as colunas fixas do card somam 304px, então
abaixo disso a barra do gráfico vira um traço. No mobile a arte some
(`hidden lg:flex`), nunca vira topo — empilhá-la empurraria o formulário para
baixo da dobra. `(transicao)` tem as 6 telas de estado, centradas, ainda com
Card. **URLs inalteradas**, então `middleware.ts` e todos os `redirect()`
seguem válidos.

**Movimento:** tokens de duração (`micro` 180ms, `estado` 320ms, `entrada`
600ms) e 5 passos de `animation-delay` no `@theme`. O stagger do hero era
falso — durações crescentes começando todas em t=0 não atrasam nada, só
deixam os últimos elementos mais lentos. `delay-*` neste projeto é
`animation-delay`, não `transition-delay`, porque o `tw-animate-css` redefine
o utility do core (conferido no source do pacote).

**Landing:** as features perderam a numeração `01`–`07` (numerar sugere que a
ordem carrega informação; sete recursos independentes não são sequência — em
"Como funciona" os números ficam, lá o processo é real); a legenda de preço
por empresa ganhou peso visual (era a informação comercialmente mais forte da
página escrita no menor tamanho e na cor mais apagada dela); e a imagem de
compartilhamento (`opengraph-image.tsx`) mais o `APP_DESCRIPTION` saíram da
headline e do vocabulário **anteriores** ao `prd-copy-sem-jargao.md` — era
literalmente o que aparecia no WhatsApp antes de qualquer clique, com os três
termos que o próprio PRD proíbe.

**A copy da landing não foi reescrita, de propósito**: ela já passou pelo PRD
de copy, tem substitutos definidos para cada jargão e um comentário-regra em
`stats-section.tsx` sobre métrica inventada. Mexer nela seria desfazer
trabalho documentado.

### O que falta desta frente

- [x] **Prints reais do produto na landing.** Feito. Híbrido, não
      substituição: o mock em HTML continua no hero (é o LCP da página, imagem
      grande ali atrasaria a métrica que mais importa em tráfego pago), e os
      prints entram abaixo da dobra — Kanban em "Como funciona" (no lugar do
      mock, que prometia "arraste até Fechado Ganho" sem mostrar a tela real) e
      Dashboard no fim de "Funcionalidades". `public/produto/` tem 6 arquivos:
      3 telas × 2 temas, 1440×900 capturado em `deviceScaleFactor: 2`. A troca
      de tema é por CSS (`dark:hidden`), nunca por JS — decidir no cliente
      causaria descasamento de hidratação.
      **Para recapturar quando a UI mudar** (é a única desvantagem real de usar
      print): `npm run build && npm run start -- -p 3970`, depois
      `node --env-file=.env.local scripts/capturar-prints-do-produto.mjs`. O
      script cria o cenário fictício, captura nos dois temas e **apaga tudo num
      `finally`**, inclusive se falhar no meio. Nunca aponte para conta de
      cliente: as telas mostram nome, empresa, telefone e valor de negócio, e
      publicar isso é tratamento de dado pessoal sem base legal.
- [ ] **`tests/e2e/funil-completo.spec.ts` não foi executado** (exige
      `.env.local` e roda contra o Asaas). O contrato de DOM foi conferido
      manualmente no navegador — `#name`, `#email`, `#password`,
      `#confirmPassword`, checkbox por role e os rótulos exatos "Criar conta"
      e "Entrar" seguem intactos —, mas o teste em si não rodou. **Ele não
      falha em `npm test`: falha no gate de deploy.**
- [x] **Breakpoints conferidos** (375, 768, 1024, 1280, 1440). Um achado que
      vale registrar: em viewport de **exatamente 1024px a arte não aparece**,
      e está certo — a barra de rolagem consome ~15px, o viewport efetivo cai
      para ~1009px e o `lg:` (min-width 1024) não dispara. Cai no layout de
      coluna única, que é melhor do que espremer o gráfico. Não perseguir isso
      como bug.
- [x] **`/onboarding`** recebeu o stagger, o `h1` que faltava e o
      `AuthAlerta` (era a 6ª cópia do mesmo bloco de erro). O `AuthCabecalho`
      **não** foi usado ali de propósito: o header do assistente carrega a
      barra de progresso antes do título, e espremer isso numa prop tornaria o
      componente pior para as outras sete telas.
- [x] **Hero da landing convertido** para duração constante + `delay-passo-*`.
      Os 650/750/800/850/900ms eram *durações* com todos os elementos começando
      em t=0 — não escalonavam nada, só deixavam os últimos mais lentos. Agora
      as duas metades do site têm o mesmo ritmo por construção, não por acaso.
- [x] **`kanban-preview.tsx` removido**, não corrigido. Ao trocar "Como
      funciona" pelo print real, o componente ficou sem nenhum consumidor —
      corrigir a borda colorida de um mock que ninguém renderiza seria manter
      dois caminhos para a mesma ilustração. O defeito (o `clsx` transformando
      as chaves de `stageAccent[stage]` em nomes de classe) fica registrado
      aqui como classe de erro a não repetir: objeto passado para `cn()` vira
      classe pelas chaves, silenciosamente.
- [x] **HTML de `/cadastro` passou a conter o formulário.** A página era
      `'use client'` inteira e lia a intenção por `useSearchParams`, o que
      obriga uma fronteira de Suspense — e como ela envolvia a página toda, o
      HTML servido tinha só o esqueleto do fallback. Com `canonical` pedindo
      indexação, o buscador recebia tela vazia; quem chega de anúncio com rede
      ruim, também. Virou Server Component lendo `searchParams` e passando
      `convite`/`plano`/`email` como props para `components/auth/signup-form.tsx`.
      Provado com `curl` no HTML cru: `#name`, `#email`, `#password` e
      `#confirmPassword` presentes. A rota passa de estática (`○`) para
      dinâmica (`ƒ`), que é o custo natural de `searchParams` — sem consulta a
      banco, só render. O `layout.tsx` que existia nesta pasta só para carregar
      a metadata (client component não pode exportá-la) foi removido junto.
      **O pré-preenchimento do e-mail de convite continua dependendo do
      cliente** (é como o `react-hook-form` funciona, com input não
      controlado); conferido em navegador real que o valor chega correto após
      a hidratação.

## Auditoria de performance de ponta a ponta (19/08)

Pedido do dono, dois relatos concretos: cadastro/login "às vezes não entra",
e Configurações "tem que clicar várias vezes pra carregar". Investigado com
prova real (Playwright contra produção, timing de rede real, não estimado),
não suposição — mesmo padrão do resto do projeto.

**Cadastro/login não estavam quebrados**, estavam sem sinal visual em um
ponto específico. Medido: `/auth/v1/signup` do Supabase custa ~2s de
verdade (GoTrue espera o SMTP do Resend confirmar antes de responder, não dá
pra tornar assíncrono do nosso lado), login ~0,9s, os dois já mostravam
spinner. O buraco real: depois de clicar no link do e-mail e cair em
"E-mail verificado", o botão **"Acessar o Velo Funil"** (`app/(auth)/
confirmar/page.tsx`) fazia 3 chamadas sequenciais (`destinoDoConvite`,
`getUser`, `workspace_members`) sem `disabled` nem spinner, e a navegação
seguinte é `router.replace()` programático — a barra de progresso do site
(`navigation-progress.tsx`) só escuta clique em `<a>` real, nunca essa.
Clique, tela parada, zero sinal. `/bem-vindo` tinha o mesmo padrão de 3
idas ao banco que já tinha motivado um `loading.tsx` em `/onboarding`, só
que ficou de fora daquela correção. Os dois ganharam o sinal que faltava.

**Configurações era o achado grave, confirmado com número real.** Clicar na
aba Equipe chegou a **8,4s** medido via `browser_network_request` (não
estimativa), contra ~1,25s da aba Empresa — bate exatamente com "precisa
clicar várias vezes". Causa raiz, duas partes:

- `sincronizar_plano_do_workspace` (`app/(dashboard)/settings/page.tsx`) é
  RPC de **escrita**, ~700ms medido isolado, e rodava em toda troca de aba,
  inclusive Empresa/Equipe/Integrações, que não mostram o rótulo do plano.
  A doutrina do projeto já diz que nenhuma regra de LIMITE depende dessa
  coluna (`pro_vigente()` é a fonte real, ver 0027) — só o rótulo cosmético
  depende. Agora só roda quando `aba === 'plano'`.
- `getWorkspacesExclusivosDoUsuario` populava a lista de workspaces que
  seriam apagados dentro do diálogo "Excluir conta" — **fechado por
  padrão**. Toda visita à aba Equipe pagava essa consulta mesmo que
  ninguém fosse excluir a conta. Virou Server Action
  (`listarWorkspacesQueSeraoApagados`, `lib/workspace/actions.ts`),
  chamada só quando o diálogo abre de fato.

Chain isolada (script descartável, sessão real do usuário de teste) somou
~1,1s pras mesmas queries; a diferença até os 2,5-8,4s observados não é
banco, é custo de renderização RSC da árvore da aba Equipe (MembersCard +
DeleteAccountCard), sem instrumentação de servidor não dá pra fatiar mais
fundo numa sessão só. As duas correções aplicadas removem a parte provada e
evitável (~850ms-1s); o resto seria trabalho de profiling em produção, não
entrou nesta rodada.

**Auditoria mais ampla, todo o resto do dashboard**: Dashboard, Kanban,
Leads, Leads/[id], Hoje, Calendário e o layout raiz já usam `Promise.all`
consistente, nenhum outro achado sequencial ali — a base já tinha passado
por essa disciplina numa sessão anterior (ver "Lag de navegação" abaixo).
Achados fora desses: `/perfil` fazia um `supabase.auth.getUser()` próprio
depois de `getCurrentUserAndWorkspace()` já ter resolvido o mesmo usuário
via `obterUsuarioAutenticado()` (cacheado por requisição) — segunda ida
redundante ao Supabase Auth, removida, usa `user.identities` que já vinha
no retorno. `/settings/billing` tinha 3 consultas independentes
(`getWorkspaceSettingsData`, contagem de leads, `getEstadoAssinatura`)
rodando uma atrás da outra sem depender do resultado umas das outras,
viraram `Promise.all`.

**Achado à parte, não é performance, é brecha de sessão**: `/hoje` e
`/calendario` não estavam no `matcher` do `middleware.ts` nem em
`isProtectedPath` (`lib/supabase/middleware.ts`) — as duas rotas existem,
estão na sidebar, mas o middleware nunca rodava nelas. Consequência real:
o teto de sessão (30 dias absoluto, 14 dias de inatividade) e a checagem
de e-mail confirmado não se aplicavam a quem só navegasse por essas duas
telas, mesma classe de brecha que o comentário do próprio arquivo já
credita a três incidentes pagos neste projeto (autoupgrade, limite de
leads, autoconvite). Adicionadas às duas listas.

`npx tsc --noEmit`, `npm run lint`, `npm test` (319 testes) e `npm run
build`, os quatro limpos. Medição de `/settings` feita com conta e
workspace descartáveis criados via `service_role` (e-mail pré-confirmado,
sessão real via `signInWithPassword`), limpos no fim.

## Integrações, Google Calendar, Gmail (12/08)

Pedido: reduzir o "esqueci de responder" ligando o funil a canais reais,
sem virar CRM inchado. Uma tabela pros provedores (`integration_connections`,
migration `0034`, desenhada pra três, Google Calendar, Gmail e WhatsApp,
mas hoje só dois em uso, ver abaixo), token cifrado (AES-256-GCM,
`lib/integrations/crypto.ts`), `state` do OAuth assinado por HMAC contra CSRF
(`lib/integrations/state.ts`).

**Encontrado e corrigido durante a auditoria**: `revoke select (coluna) ...
from authenticated` **sozinho não bloqueia nada**, testado contra o banco
real, o Supabase já concede `select` na tabela inteira por default privilege
(mesma armadilha que a 0013 documentou para `EXECUTE` de função). A correção
que funciona é revogar `select` da TABELA INTEIRA e conceder de volta só nas
colunas seguras, só assim `access_token_enc`/`refresh_token_enc` ficam
inacessíveis mesmo para o próprio admin da empresa lendo pela API pública.
Provado com sessão real: token não decifrável por `authenticated`, membro sem
admin vê status mas não desconecta, empresa B não enxerga linha de empresa A.

**Google Calendar e Gmail**: OAuth próprio (`/api/integrations/google/*`),
separado do OAuth de login, aquele não persiste refresh token utilizável em
background. Um escopo por conexão (`calendar.events` ou `gmail.send`, nunca
os dois), renovação automática de access_token perto de expirar. Workflow:
botão "Adicionar ao Google Calendar" na próxima ação do negócio (Kanban),
"Enviar e-mail" no painel do lead, os dois registram atividade na timeline.

**WhatsApp Cloud API removida em 13/08**, decisão de produto, não vamos
usar. Existia (Embedded Signup da Meta, webhook em `/api/webhooks/whatsapp`,
mensagem por modelo aprovado, tarefa automática "Responder no WhatsApp")
desde a 12/08, mas nunca teve nenhuma conexão real em produção (conferido
antes de remover: zero linha em `integration_connections` com
`provider = 'whatsapp'`). Removido código, rota de webhook, tabela de dedupe
(`whatsapp_webhook_events`, migration `0043`) e as variáveis `META_APP_ID`/
`META_APP_SECRET`/`META_WHATSAPP_CONFIG_ID`/`META_WEBHOOK_VERIFY_TOKEN`/
`NEXT_PUBLIC_META_APP_ID`/`NEXT_PUBLIC_META_WHATSAPP_CONFIG_ID`. O valor
`'whatsapp'` continua existindo no enum `integration_provider` do banco,
Postgres não tem `ALTER TYPE ... DROP VALUE`, e recriar o enum pra tirar um
valor que nenhum código mais insere não valia a complexidade.

O link `wa.me` **continua existindo**, é um mecanismo totalmente separado,
sem token/OAuth nenhum (`lib/leads/whatsapp.ts`, botão "Chamar no WhatsApp"
no painel do lead, link de suporte no rodapé). Não fazia parte da remoção.

**Pendências de configuração manual** (mesmo padrão do Asaas/Resend, eu não
tenho acesso a nenhum destes painéis):

1. **Google Cloud Console**: no projeto OAuth já usado para o login, adicionar
   o redirect URI `https://www.velofunil.com.br/api/integrations/google/callback`
   e ativar a Calendar API + Gmail API. Copiar Client ID/Secret para
   `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`.
2. Gerar `INTEGRATIONS_ENCRYPTION_KEY` (32 bytes hex, `openssl rand -hex 32`)
   e colar local + Vercel.

Sem essas variáveis, os cards de integração aparecem normalmente em
"Não conectado", nada quebra, só o botão "Conectar" falha ao tentar.

## Auditoria do produto logado, 19/08

Três varreduras contra o código do produto **por dentro** (o redesenho
anterior tinha coberto só login/cadastro e a landing). Achou bug real, não só
questão de gosto. Entregue em três commits.

**O calendário escondia a tarefa vencida e mostrava a concluída.** A célula do
modo Mês exibe 3 chips e resume o resto em "+N", mas cortava com
`tarefas.slice(0, 3)` sobre a ordem cronológica pura — e cronológico não sabe
o que já foi feito. Um dia com três tarefas concluídas de manhã e uma vencida
à tarde gastava os três espaços com as concluídas e escondia a vencida atrás
do "+1". Numa tela cuja promessa é lembrar do que falta, isso inverte o
produto. `lib/calendario/ordenar-por-relevancia.ts` (função pura, 6 testes)
ordena vencida > pendente > concluída antes de fatiar. Provado contra
produção com exatamente esse cenário.

**O "+N" levava ao lugar errado.** Prometia as tarefas daquele dia e trocava
para a Agenda, que lista o período carregado inteiro — clicar em "+1" no dia
20 devolvia agosto todo, e o `diaAncoraSemana` que o clique setava nem era
lido nesse modo. Passa a abrir a Semana, que usa a âncora de verdade.

**Três exclusões apagavam com um clique**: tarefa, remover colaborador e
cancelar convite — enquanto lead, negócio e atividade já confirmavam desde
sempre. O caso mais desconfortável: concluir tarefa oferecia "Desfazer" e
excluir, que é pior, não oferecia nada. `components/comum/confirmar-exclusao.tsx`
usa `AlertDialog` (prende foco, não fecha ao clicar fora), não o `Dialog`
genérico que metade das confirmações do projeto usava.

**Sair passou a confirmar**, por pedido do dono (computador compartilhado). O
texto diz o que acontece em vez de "tem certeza?". Junto, conserta um defeito
à parte: o clique não mostrava nada até o redirect, porque o `useTransition`
descartava o pending e a barra de progresso global só liga em clique de `<a>`,
nunca em item de menu.

**Configurações saiu de 5 idas em série para 2.** Era a rota mais lenta e a
que o dono reclamou. `urlDaLogo` era chamado DENTRO do JSX — a página já tinha
montado e ainda ia buscar mais uma coisa.

**38 lugares diziam jargão que o próprio PRD de copy baniu.** "Pipeline" virou
"Funil", "Leads" virou "Contatos", "Dashboard" virou "Resultados", "workspace"
virou "empresa", "Timeline" virou "Histórico", "Taxa de Conversão" virou
"Viraram venda". **As rotas não mudaram** (`/kanban`, `/leads`, `/dashboard`):
renomear quebraria link salvo para trocar uma palavra que ninguém digita.
Sobre "Leads" → "Contatos", que o PRD tinha adiado: o motivo dele se inverteu,
a landing já diz contatos, então a distância existe hoje e renomear fecha.

**A barra lateral ganhou o número de tarefas do dia.** Só aparece quando há o
que cobrar — contador em "0" vira ruído e treina a pessoa a ignorar o lugar.
O cuidado principal foi o custo: roda no layout, ou seja, em toda navegação.
Usa `count: exact, head: true` e entra no MESMO `Promise.all` que já busca
sessão, mesmo dependendo do `workspaceId` — `getCurrentUserAndWorkspace` é
`cache()`, então a segunda chamada devolve a promise da primeira. Encadear em
série custaria uma ida de rede por navegação.

**Prova rodada com Playwright contra o banco de produção**, workspace
descartável limpo no fim: 13 verificações, todas passando, incluindo o cenário
exato do bug do calendário e o "Cancelar" do diálogo de saída mantendo a
sessão.

## Pendente do dono (não é código)

- [x] **`CRON_SECRET` na Vercel.** Esta entrada dizia que faltava colar e que
      o cron tomava 401 todo dia em silêncio. **Falso**, medido na API da
      Vercel em 25/08: a variável existe em `production` e `preview`, marcada
      `sensitive`. Pendência falsa desvia atenção das reais, e é o achado 6.1
      do [diagnóstico](diagnostico.md).
- [x] **`NEXT_PUBLIC_META_PIXEL_ID` na Vercel — a variável existia desde
      20/08, mas com uma QUEBRA DE LINHA no valor, que derrubava o site
      inteiro em tela preta e impedia o pixel de medir. Corrigido em 24/08,
      ver seção própria.** O valor (`1566349361566072`) já está nas env vars da Vercel:
      medido na própria API da Meta, o pixel dispara de
      `www.velofunil.com.br` continuamente (milhares de PageView, ~21
      `CompleteRegistration` e 6 `Purchase` em 7 dias), e a Conversions API
      também. Confirmado à parte com navegador real: o script `meta-pixel`
      e o id aparecem no HTML de produção. **Risco de compliance continua
      em aberto**: é rastreamento de terceiro (cookie `_fbp`) sob a LGPD,
      mesma razão pela qual o GA4 foi descartado, e não existe banner de
      consentimento no site. Ligado por pedido explícito.
- [ ] **Auditoria de prontidão pra tráfego pago (13/08).** Verificado
      contra o banco de produção: 10 workspaces, zero em `plan = 'pro'`,
      nenhum pagamento (Pix, boleto ou cartão) jamais completou o ciclo
      inteiro até `active`. `Fani RRH Consultoria` está `past_due` desde
      04/08, nunca resolvido. **Recomendação: pagar um Pix real de R$49
      pelo checkout de produção ANTES de gastar em anúncio**, mandar
      tráfego pago pra um checkout nunca provado arrisca queimar o
      anúncio e a venda junto. E-mail de cobrança falhou (`past_due`) foi
      construído nesta sessão (`lib/emails/pagamento-atrasado.ts`),
      ajudará a recuperar cartão recusado no futuro, mas não resolve o
      caso da Fani, que já está parada há dias e pode merecer contato
      direto.
- [x] **Gate de segurança no deploy, funcional em 19/08.** Os três passos
      manuais que faltavam (arquivo no repositório, Secrets, desligar
      auto-deploy) foram concluídos. `git push` em `main` builda um preview
      via API REST da Vercel e roda `tests/e2e/security-audit.spec.ts` contra
      ele automaticamente.

      **A promoção final para produção NÃO é automática**, diferente do
      desenho original. `POST /v10/projects/.../promote` é recurso do plano
      Pro/Enterprise — confirmado tentando promover 2 deployments `READY`
      distintos, os dois voltaram `422` genérico da API (a doc oficial já
      documenta isso para `vercel rollback`, mesmo mecanismo por trás). O
      projeto está no Hobby. `promover-producao` virou
      `avisar-pronto-pra-promover`: publica no resumo do workflow o link
      exato do deployment testado e a instrução "clique em Promote to
      Production". Continua sendo um gate de verdade — nada chega em
      produção sem antes passar pela auditoria, só o último clique é seu.

      Achados que valem registro pra quem mexer nisso de novo:
      - `vercel pull`/`vercel build`/`vercel deploy`/`vercel promote` do CLI
        (`vercel@59.1.4`) devolvem `Error: User not found` mesmo com token
        válido — o MESMO token responde `200` em `GET /v9/projects/...` via
        `curl` direto. É bug de resolução de usuário do CLI, reproduzido com
        dois tokens gerados em escopos diferentes (time e conta pessoal). A
        correção foi trocar todo o workflow pra chamar a API REST direto,
        sem depender do CLI.
      - O comando de "Ignored Build Step" (`if [ "$VERCEL_GIT_COMMIT_REF" =
        "main" ]...`) usado pra impedir a Vercel de auto-deployar `main`
        também cancelava deployments criados via API com `ref: main` —
        incluindo os que o próprio workflow criava para testar. Removido
        (voltou pra "Automatic"); a defesa contra deploy duplo passou a ser
        só o fato de produção nunca trocar sem o clique manual de promote.
      - **Testado de novo em 23/08, já com Vercel Pro contratado: continua
        `422`.** Ou seja, não era limitação do plano Hobby, como se supôs na
        primeira tentativa. `POST /v10/projects/{id}/promote/{deploymentId}`
        devolve `unprocessable_entity` genérico para um deployment de target
        `staging`, que é como o gate deste projeto os cria. A promoção segue
        manual — não vale gastar outra sessão descobrindo o porquê, já que o
        clique custa segundos e é a única barreira antes de produção.
      Até isso ser feito, o workflow existe mas não está protegendo nada:
      a Vercel ainda promove sozinha a cada push.
- [ ] **CSP em Report-Only, nunca virou bloqueio.** Medido em 13/08 contra
      produção: 1 violação por página (um `eval` num chunk de dependência,
      zod/@base-ui/lucide, padrão de polyfill). Antes de trocar o header
      pra `Content-Security-Policy` (modo bloqueio de verdade, em
      `next.config.mjs`) falta decidir entre aceitar `'unsafe-eval'`
      (enfraquece bastante a diretiva) ou isolar qual dependência causa
      isso. Sem isso, um XSS futuro (nenhum encontrado até agora) não
      teria barreira nenhuma, e o cookie de sessão do Supabase é legível
      via `document.cookie` por design do próprio `@supabase/ssr`, então a
      CSP é a única defesa que falta pra fechar essa combinação.
- [x] **Cutover para o projeto São Paulo (`tmyeunithjqkbwvezyyn`).** Feito:
      env vars trocadas local + Vercel (confirmado pelo header CSP em
      produção apontando pro projeto novo), SMTP customizado corrigido
      (usuário `resend`, não `rezende`), Site URL/Redirect URLs corrigidos,
      reset de senha testado ponta a ponta com sucesso.
- [ ] **CNPJ novo (ME, CNAE 6202-3/00).** Esta entrada dizia "CNPJ ativo, Meta
      Business verificado". As duas afirmações estavam **erradas**, medido em
      25/08 e detalhado em seção própria: o `64.543.748/0001-13` está BAIXADO
      desde 08/08 e o business `Rickdaskin` está `pending_submission`. Baixa de
      MEI não tem volta, e software não cabe em MEI. Decisão do dono: abrir ME
      na Contabilizei. Enquanto não sair, o site não exibe CNPJ nenhum.
- [ ] **Cobrança da Fani Mayara** (`fanimayara67@gmail.com`): usuária real
      (logou em 11/08, 1 lead), plano `free`, começou o checkout e nunca pagou.
      Tem 2 cobranças de R$ 49 em aberto que vão virar aviso de vencimento.
- [x] **Pix real de R$ 49 recebido.** Workspace "Orne", 13/08, confirmado no
      Asaas, mas o webhook não chegou (site fora do ar por DNS, ver acima) e
      ficou preso até reconciliação manual. Motivou o job de reconciliação
      automática (ver "Onde o produto está").
- [ ] **Vercel Pro + Supabase Pro** no primeiro cliente pagante. Vercel por
      regra (Hobby proíbe uso comercial); Supabase por **backup**, o Free não
      faz nenhum, e perder dado de cliente pago é problema jurídico.
- [x] **Sujeira em `pedro eee` virou bug real, corrigido em 19/08.** O
      workspace tinha voltado para `free` desde então (o downgrade aplicou em
      algum momento), mas `subscriptions` continuava com `status: 'canceled'`
      apontando pro `asaas_subscription_id` morto (`deleted: true` no Asaas).
      Reportado pelo dono: tentou assinar o Pro de novo e tomou "Assinatura
      criada, mas não foi possível gerar o link de pagamento". Causa raiz:
      `createCheckout` (`lib/asaas/actions.ts`) só decidia criar assinatura
      nova checando `if (!subscriptionId)`, sem olhar se a assinatura
      REUSADA ainda estava viva no Asaas. Com `subscriptionId` preenchido
      (mesmo morto), pulava a criação, buscava fatura de uma assinatura sem
      pagamento nenhum (`payments.data: []`), e devolvia o erro genérico —
      ninguém com assinatura cancelada conseguia assinar de novo pela tela.
      Corrigido: `subscriptionId` só é reaproveitado quando
      `existingSubscription.status !== 'canceled'`; o `upsert` também para
      de gravar o `status` antigo por cima de uma assinatura recém-criada
      (senão gravaria `'canceled'` na assinatura nova). Provado ponta a
      ponta com Playwright contra o Asaas real (workspace descartável,
      reproduzindo o mesmo estado: assinatura criada e cancelada de
      verdade, depois "Assinar Pro" pela UI): `asaas_subscription_id`
      trocou pro novo, `status` gravou `trialing`, `?pago=1` na URL. Tudo
      limpo no fim. Não determinada a causa original do webhook não ter
      aplicado o cancelamento em `Henrique System`/`pedro eee` na época —
      só a consequência no checkout foi corrigida.
- [x] Rate limit de e-mail de 30 para 100/hora. Feito.
- [x] Colar os templates `confirmacao-cadastro.html` e
      `recuperacao-de-senha.html` no painel. Feito e verificado com envio real:
      o link sai como `.../redefinir-senha?token_hash=…`.
- [x] Cancelar as assinaturas de teste no Asaas. Feito, eram 3, não 2.
- [ ] **Conta de anúncio: a registrada aqui estava ERRADA (corrigido 20/08).**
      Esta entrada dizia que `27108979755418323` ("Orlando Henrique") era a
      conta do Velo Funil. Verificado contra a API da Meta: o pixel que o site
      de fato alimenta, `1566349361566072` ("h-systens", o valor de
      `NEXT_PUBLIC_META_PIXEL_ID`), pertence ao business **Rickdaskin**
      (`1717888109644664`) e está atribuído à outra conta,
      **`1316925630418162` ("Rickdaskin Ads")**. A conta "Orlando Henrique"
      tem um pixel diferente (`987545847222328`) com 11 PageViews no total,
      parado desde 13/08, além de uma campanha de cliente de terceiro
      ("Lizz Ante Nutri").

      **Consequência prática:** subir campanha na conta antes registrada
      otimizaria às cegas — ela não enxerga as conversões do site. **Ação do
      dono, antes de ligar qualquer campanha:** rodar na `Rickdaskin Ads`
      (recomendado, o pixel certo já está lá) ou compartilhar o pixel
      `1566349361566072` com a outra conta no Business Manager. A escolha
      está fixada em `lib/dono/meta-ads.ts` (`CONTA_DE_ANUNCIO`), com o
      porquê registrado no próprio arquivo.

      Nenhuma das 3 campanhas existentes jamais rodou (todas `PAUSED`, gasto
      zero) — daí `utm_source`/`fbc`/`fbp` estarem vazios nas 26 empresas: a
      captura (`components/landing/utm-capture.tsx`) está correta e só nunca
      foi exercitada, porque nunca houve clique de anúncio.

## Fila técnica, na ordem

1. **Exportar para Excel/CSV.** Tira a objeção "vou ficar preso no sistema" na
   hora da venda. É o próximo, e o mais barato dos que restam.
2. **Dashboard de receita.** Ganho no mês e ticket médio saem do que já existe.
   Tempo médio de fechamento ainda não: exige histórico de MUDANÇA de etapa, e
   a 0033 guarda só a última, saber que um negócio está em "Negociação" há 12
   dias não diz quanto ele levou em "Proposta".
3. **Sandbox do Asaas nos testes de checkout.** Hoje o checkout é exercitado
   contra produção, e foi isso que deixou 2 cobranças de R$ 49 em aberto no nome
   de uma usuária real. O resto do projeto continua provando contra produção, a
   exceção é só onde o teste **cria cobrança no nome de outra pessoa**.
4. **Campos e pipelines customizáveis.** `deal_stage` é enum do Postgres; virar
   tabela é mudança grande. Só com cliente pagante pedindo.

**Entregues em 12/08, saíram desta fila:** paginação do que não paginava
(0032), e negócio parado (0033).

**Entregue em 18/08:** captura real de erro (migration 0046, `error_logs`).
Erro no boundary `app/(dashboard)/error.tsx`/`app/global-error.tsx` grava em
`error_logs` (tabela de sistema, RLS ligada, zero policy — mesmo padrão de
`asaas_webhook_events`), via `app/api/log-erro/route.ts` +
`createAdminClient()`. Sem tela de leitura no produto: não existe conceito de
"dono da plataforma" no RLS deste projeto (tudo gira em `is_workspace_member`/
`is_workspace_admin`, relativo a workspace), então investigar um erro é
consulta direta por SQL/MCP quando precisar, mesmo fluxo já usado para o
resto do banco. Escopo cortado do pedido original de propósito: sem botão
flutuante de "reportar problema", sem print automático de tela — print
captura pixel, não estrutura, e pode incluir dado de cliente (nome, e-mail,
valor de negócio) sem RLS pronta pra isolar isso por workspace. Fica
registrado como próximo passo se a base provar valor.

## Decisões travadas, não refazer

| Decisão                                     | Motivo                                                                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Asaas, não Stripe**                       | Existe skill/agente de Stripe no repo; não se aplica ao billing                                                                                               |
| **Sem prova social inventada**              | A `StatsSection` já teve métrica falsa copiada de concorrente, removida de propósito. Só entra com cliente real                                               |
| **Login não revela se a conta existe**      | Distinguir "senha errada" de "conta inexistente" permite enumerar e-mails e alimenta phishing. O erro oferece "Criar conta" e "Recuperar acesso" em vez disso |
| **Logo do e-mail é tipografia, não imagem** | Gmail e Outlook bloqueiam imagem por padrão; cabeçalho com `<img>` aparece vazio                                                                              |
| **Google Sheets por API está fora**         | Exige `GOOGLE_CLIENT_ID`/`SECRET` e verificação do app pelo Google (semanas). A importação de planilha já cobre a dor                                          |
| **`read-excel-file`, não `xlsx` nem `exceljs`** | O `xlsx` do npm está parado em 0.18.5 com CVE-2023-30533 e CVE-2024-22363, sem correção publicada lá; o `exceljs` está sem release há anos                |
| **Lead precisa de e-mail OU telefone**      | A planilha do público-alvo é lista de WhatsApp. Com `email not null` ela importava zero linhas (migration 0025)                                               |
| **WhatsApp: só o link `wa.me`, sem Cloud API**| A Cloud API foi implementada em 12/08 e removida em 13/08 (decisão de produto, nunca teve conexão real em produção), o link `wa.me` nunca dependeu dela e continua existindo |
| **Meta Lead Ads ainda adiado**              | Puxar lead da página de um cliente exige OAuth dele + App Review (semanas) + verificação de negócio, degrau acima do que o CNPJ ativo resolve sozinho. Guardar o padrão certo: webhook **mais** job de reconciliação, porque o Meta só guarda 90 dias |
| **IA / lead scoring fora**                  | Com 50 leads é ruído caro. O funil já pontua sozinho: negócio sem próxima ação e tarefa vencida são o sinal |
| **GA4 fora**                                | Ferramenta de site, não de app logado, mediria pageview, não ativação, e traria banner de cookie por LGPD. A necessidade é real; a ferramenta é que estava errada |
| **Tarefa não entra no limite de plano**     | Travar follow-up empurra a pessoa de volta para o WhatsApp e mata o hábito diário que faz ela pagar. O teto de 5.000 abertas é defesa contra abuso, não regra de negócio |

## Armadilhas já pagas, não repetir

**`cache()` do React deduplica a MESMA função, não duas que fazem a mesma
coisa.** `getCurrentUserAndWorkspace` e `lerEstadoDoOnboarding` (chamadas em
paralelo no layout do dashboard a cada navegação) cada uma tinha seu próprio
`cache(async () => supabase.auth.getUser())`, o React não enxerga que as duas
pedem a mesma coisa, então cada navegação pagava a ida ao Supabase Auth duas
vezes em vez de uma. A correção não é "cachear mais forte": é ter UMA função
cacheada (`lib/supabase/usuario-autenticado.ts`) e todo mundo chamar ELA, para
o `cache()` ter algo de fato idêntico para deduplicar.

**Layout `async` sem `<Suspense>` esconde que a navegação está rodando.**
`app/(dashboard)/layout.tsx` faz `await Promise.all(...)` antes do `return`,
nenhum `loading.tsx` de rota aparece enquanto isso não resolve, porque não há
fronteira de Suspense delegando o fetch. Clique processa, navegação começa,
mas fica muda por toda a cadeia de rede; sem sinal nenhum, a pessoa clica de
novo achando que não funcionou. Não dá para envolver esse `await` em Suspense
sem enfraquecer o guard: os dois `redirect()` do layout (workspace vazio,
onboarding pendente) dependem do resultado dele para decidir SE a página
deve renderizar. A correção ficou no lado visual,
`components/layout/navigation-progress.tsx` liga no clique real e desliga na
troca real de rota, não em tentar apressar o guard.

**O PostgREST corta em 1.000 linhas, e quem não pagina mente em silêncio.**
Medido em 12/08 com 1.100 negócios: o app recebe 1.000 e não recebe erro
nenhum. Três funções são anteriores a isto e não paginam, `getFunnelCounts`
(gráfico com número errado), `getBoardDeals` (**cards somem do Kanban**, e como
ordena por data são os mais antigos) e `getWorkspaceLeadsForSelect` (leads
somem do seletor de novo negócio, ordenado por nome). O banco tem 14 negócios
hoje, então ninguém é afetado, mas qualquer consulta nova sem `.limit()`
explícito herda o mesmo defeito.

**PATCH que não casa com nenhuma linha devolve 204, e 204 é sucesso.** O
primeiro roteiro de prova da 0030 deu um `check constraint` como aprovado sem
nunca tê-lo exercitado: a conta de teste não tinha linha em `onboarding_state`,
o `PATCH` não casou com nada e o script leu o 204 como "passou". Prova de
constraint precisa garantir que a linha existe antes.

**`.select()` do supabase-js precisa ser string LITERAL.** Quebrar em
`'a, b' + 'c, d'` para caber na linha faz o tipo do retorno inteiro virar
`GenericStringError`, o supabase-js analisa essa string no nível de tipo.

**`storage.foldername(name)[1]::uuid` estoura em caminho fora do padrão**, e
quem escolhe o caminho é quem envia o arquivo. A 0031 usa
`workspace_do_caminho`, que devolve `null` nesse caso, e
`is_workspace_member(null)` é `false`, então caminho torto não pertence a
ninguém.

**No `update` de policy, `using` sem `with check` deixa renomear para fora.**
Só com os dois é que um admin fica impedido de mover o próprio arquivo para a
pasta de outra empresa: `using` avalia a linha ANTES da mudança e aprovaria.

**`revoke select (coluna) ... from authenticated` sozinho não bloqueia nada.**
Mesma família de defeito que a 0013 já pagou para `EXECUTE` de função: o
Supabase concede `select` na TABELA INTEIRA para `authenticated` por default
privilege, e revogar uma coluna não subtrai de um grant mais amplo já
concedido. Achado testando `integration_connections` (0034), um admin lia
`access_token_enc` cifrado direto pela API pública, apesar do `revoke`
explícito na migration. A correção que funciona: revogar `select` da tabela
inteira e conceder de volta só nas colunas seguras, para o grant específico
ser o único que existe.

**Quem aceita convite não tem empresa para configurar.** Sem marcar o
onboarding como concluído no aceite, nos DOIS caminhos, a página e a Server
Action,, o middleware manda a pessoa às boas-vindas e ela atravessa quatro
perguntas sobre uma empresa que não é dela.

**Abrir tour por parâmetro de URL exclui quem não passa pela URL.** A primeira
versão dependia de `?tour=1`, posto pela finalização do assistente; quem entra
por convite nunca passaria por lá. O gatilho é o estado no banco.

**O servidor da Vercel roda em UTC, e "hoje" do usuário não é o dele.** Às 21h
de São Paulo já é o dia seguinte em UTC, `toISOString().slice(0,10)` no
servidor mandaria toda tarefa marcada para hoje à noite para o grupo "Depois".
Por isso `diaEmSaoPaulo` usa `Intl.DateTimeFormat` com `timeZone`, e o relógio
das telas de tarefa nasce num `useEffect`, no cliente. Tem teste travando os
dois casos em `lib/tasks/buckets.test.ts`.

**Prefixar `55` em número de 11 dígitos transforma telefone dos EUA em
brasileiro.** `+1 415 555 2671` vira `14155552671`, mesmo tamanho de um celular
com DDD. O teste pegou. O que separa os dois é o dígito depois do DDD: celular
brasileiro é sempre `9`, fixo começa em 2–5. Sem isso o `wa.me` abriria tela de
erro do WhatsApp e pareceria defeito nosso.

**`select` largo em rota sem paginação dobra o custo dela.** O `/kanban`
carrega todos os negócios abertos de uma vez. Medido em produção com 100
negócios: a consulta da próxima ação com as 8 colunas de `TaskRow` custava
315 B por negócio contra 292 B da consulta de negócios, mais que dobrava a
rota. Com as 5 colunas que o card usa de fato, 198 B. Daí o tipo
`ProximaAcaoRow` separado.

**`Map` não sobrevive à travessia servidor→cliente.** Prop de Server Component
é serializada; `Map` chega vazio, sem erro. Vai como pares `[chave, valor]` e
vira `Map` num `useMemo` do lado do cliente.

**O overlay do arrasto duplica o card à mão.** `deal-card-overlay.tsx` repete a
marcação de `deal-card.tsx`. Mudar um sem o outro faz o card trocar de altura no
instante em que é pego, e o movimento parece defeito.

**Contar linha com `for update` nem sempre vale.** A 0026 precisou do lock
porque 50 leads é fronteira de monetização e o 51º é receita perdida. O teto de
tarefas da 0029 é 5.000, defesa contra abuso: sob corrida o estouro é do tamanho
da concorrência e para na leva seguinte. O lock ali seria na MESMA linha de
workspace que a trava de leads pega, e faria toda tarefa criada durante uma
importação de planilha esperar a importação inteira.

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
de qualquer commit e as duas passavam, 51 leads num plano de 50. Corrigido na
0026 com `select ... for update` na linha do workspace.

**Fragmento de URL (`#access_token`) nunca chega ao servidor.** Causou três
bugs: reset de senha morto, confirmação de cadastro que não logava, e a troca
de senha que não acontecia (o `PUT /user` sumia na travessia navegador↔Server
Action). Tudo que depende da sessão de recuperação roda no cliente.

**`File.text()` decodifica sempre em UTF-8.** O Excel em português salva CSV em
Windows-1252, então "José Antônio" entrava no banco como `Jos� Ant�nio`, calado.
Medido em 11/08. A leitura passa por `decodificarPlanilha`, que tenta UTF-8 com
`fatal: true` e cai para Windows-1252 quando falha, nessa ordem, porque
Windows-1252 aceita qualquer byte e nunca falharia.

**`.in()` do PostgREST vira query string.** A dedupe da importação mandava até
1000 e-mails num `select`, e o gateway recusa: medido, 500 valores já dão 400 e
2000 dão 414. Pior, o código não olhava o `error`, então o conjunto de
duplicados saía vazio e a planilha inteira era reimportada em silêncio. Trocado
por leitura paginada do workspace.

**Link de e-mail não carrega parâmetro.** O link de confirmação é montado pelo
template do Supabase e só sabe ir para o `emailRedirectTo` fixo, então tudo que
a pessoa escolheu antes de abrir a caixa de entrada morre ali. Dois defeitos
vieram disso: o convite virando conta separada (o token se perdia no caminho
para `/cadastro`, a pessoa caía em `/onboarding` e criava a própria empresa, com
o convite preso em `pending`) e a intenção de compra descartada ("Assinar Pro"
apontava para o mesmo destino do Free). A travessia agora é por cookie
`httpOnly` em `lib/auth/intencao.ts`, não querystring, que vazaria e-mail e
token no histórico e no `Referer`.

**Coluna de plano e validade de plano são coisas diferentes.** Depois da 0027,
qualquer regra que leia `workspaces.plan` pode discordar de `pro_vigente()`, a
coluna é o último valor gravado e não sabe que o tempo passou. Foi o caso do
aceite de convite (0028): um Pro vencido aceitava o terceiro membro e a trigger
de leads recusava o lead dele. **Regra de plano lê a função, nunca a coluna.**

**O `callback.successUrl` do Asaas não funciona.** Medido em 11/08:
`POST /subscriptions` aceita o campo com HTTP 200, não o devolve na leitura, não
propaga para a cobrança gerada, e `PUT /payments` com `callback` responde 500.
Por isso o retorno depois do pagamento é feito por conta própria, a fatura abre
em outra aba e o app fica na de trás.

**Erro do Postgres não chega à UI sozinho.** A mensagem de limite de plano da
trigger 0023 morria em `console.error` e virava "Não foi possível importar".
Quem trata `error.code === '42501'` é o TypeScript, e a mensagem boa precisa
existir dos dois lados.

**O editor de templates do painel do Supabase** engasga com linha de mais de
mil caracteres e rejeita comentário condicional aninhado, o botão "Save"
simplesmente não responde, sem erro. Por isso os arquivos em
`supabase/email-templates/` são gerados com `paraPainelDoSupabase: true`.

**`{{ .ConfirmationURL }}` verifica o token no próprio GET, antes do clique.**
Causou "link expirado" em confirmação de cadastro e recuperação de senha,
qualquer requisição que visite o link primeiro (scanner de e-mail, antivírus,
preview de webmail) consome o token de uso único antes da pessoa clicar. Os
dois templates usam `{{ .RedirectTo }}?token_hash=...`, que só carrega a
página; a verificação (`verifyOtp`) espera um clique explícito. Ver
`supabase/email-templates/README.md`.

**O nome do recebedor na fatura do Asaas não é editável, e para MEI não tem
mais saída por nome fantasia.** O campo `availableCompanyNames` da API traz só
a razão social vinda da Receita, para MEI, é o nome pessoal do empresário
individual, sem opção alternativa. **Correção 13/08/2026**: esta entrada dizia
antes que cadastrar nome fantasia no Portal do Empreendedor resolveria, errado,
o dono trouxe a fonte oficial (gov.br, resposta de 21/11/2023): nome fantasia
foi **descontinuado da base do CNPJ para MEI desde 15/11/2023**. Não é
limitação do Asaas nem trocaria com outro processador (Stripe incluído), é
dado da Receita Federal. Única saída real é formalizar como ME/LTDA (sair do
MEI), decisão de negócio fora do código. O que já mitiga: a descrição da
cobrança (commit `b8b9ec0`) mostra "Velo Funil" antes do nome do recebedor.

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
da máquina, não do login. **Já apareceu apontando para o projeto errado**
(`zjhgoaoctboxdtygdwjs`, vazio, de outra conta) numa sessão antiga, quando o
`.env.local` ainda usava `unydqzzjokhjwcqufehr`. **Confirmado certo em
19/08/2026**, sessão no VS Code: `list_projects` devolve só
`tmyeunithjqkbwvezyyn` (`velofunil-sao-paulo`, `sa-east-1`,
`ACTIVE_HEALTHY`), o mesmo projeto do `.env.local` pós-cutover. Ainda assim,
**confira o projeto antes de aplicar qualquer migration por ele** — já errou
uma vez. O MCP do Stripe pede autorização e **não é usado** (o projeto é
Asaas). Quando o Playwright cai, o caminho é `curl` + análise do HTML, ou
script Node contra a API.

**MCP do Supabase via conector do claude.ai (19/08), diferente do plugin
acima.** O dono confirmou no painel (`claude.ai/settings/connectors`) que o
conector Supabase está "Desvinculado"/conectado, mas nenhuma ferramenta
`mcp__*Supabase*` apareceu nesta sessão, nem depois de reiniciar (o mesmo
reinício resolveu o caso análogo do MCP da Vercel, ver "Vercel MCP" abaixo).
Ficou pendente sem causa confirmada — pode ser propagação lenta, pode ser
escopo de autorização insuficiente, pode ser troca de conta destravando.
Enquanto não resolver: banco é lido/escrito por script Node descartável com
`SUPABASE_SERVICE_ROLE_KEY` (`node --env-file=.env.local script.mjs`), mesmo
padrão que resolveu toda a investigação do checkout travado nesta sessão,
sem depender do MCP nenhuma vez.

**Vercel MCP (`mcp__claude_ai_Vercel__*`) funciona nesta sessão**, projeto
`closify-crm-dr3t` (`prj_1MkOuMTY5zGiRXEG8TWRKSs9n3hJ`), team
`ricks-projects-1e819723` (`team_7KBrcdMaIrg3kCRSZy3cNA34`). Serve pra
confirmar deploy sem depender do dono abrir o painel — `list_deployments`
com `since` no timestamp do push mostra `state: READY/BUILDING/ERROR` do
commit exato. Repositório GitHub é `rickcruzzz/closify-crm` (nome antigo do
projeto, mantido).

## Últimos commits relevantes

| Commit    | O quê                                                              |
| --------- | ------------------------------------------------------------------ |
| _(a fazer)_ | Tarefas com próxima ação, tela `/hoje` e WhatsApp por link (0029) |
| `312225b` | Seletor de empresa passa a trocar de empresa de verdade            |
| `3779d72` | Convite deixa de virar conta separada; confirmação de e-mail tem fim |
| `9fe5cd4` | Reimportar planilha atualiza quem já existe                        |
| `efcf2be` | Importação de planilha: Excel, mapeamento de coluna, negócio junto do lead |
| `b8b9ec0` | Descrição da cobrança que o cliente reconhece                      |
| `7b67e23` | Verificador de ambiente local                                      |
| `185f97c` | Link de confirmação deixa de morrer antes do clique                |
| `1a49eb6` | Troca de senha deixa de falhar em silêncio (movida para o cliente) |
| `faba2db` | Bloqueia autoconvite e convite para quem já é membro               |
| `c5ad888` | Impede upgrade sem pagamento; conserta a RPC do webhook            |

Para o resto: `git log` conta a história completa, com o porquê de cada
decisão.
