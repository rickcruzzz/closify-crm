# Histórico do Velo Funil — agosto de 2026

As rodadas de agosto, tiradas do `docs/estado-atual.md` em 04/09 e guardadas
aqui inteiras. **Nada foi resumido nem apagado.**

## Por que elas saíram de lá

`estado-atual.md` é importado com `@` no `CLAUDE.md`, então ele entra no
contexto em TODA sessão. Tinha chegado a 250 KB e 4.476 linhas, e o custo não
era o disco: era a recuperação. Numa mesma sessão de 03/09 eu propus construir
um rastreamento de ativação que já existia desde 02/09 e estava descrito lá
dentro — o fato estava gravado e não foi encontrado.

Documento que não cabe deixa de ser memória e vira arquivo morto com custo de
contexto. O corte devolve salência ao que é recente e ao que é perene.

## O que ficou no `estado-atual.md`, e por quê

As rodadas de **setembro** (as recentes) e as seções **perenes** — `Onde o
produto está`, `Pendente do dono`, `Fila técnica`, `Decisões travadas`,
`Armadilhas já pagas`, `Como verificar`, `Ferramentas`. As perenes são a lição
destilada de tudo que está aqui embaixo; estas são o detalhe de como cada uma
foi aprendida.

**Quando ler este arquivo:** quando o `estado-atual.md` citar uma decisão de
agosto e você precisar do porquê inteiro, e quando for mexer em algo que a
seção `Armadilhas já pagas` menciona sem contar a história.

---
## O CNPJ novo entrou, e um alarme meio atendido apareceu (31/08, noite)

O CNPJ saiu. Conferido contra a fonte antes de qualquer linha de codigo, pela
regra da skill `fatos-publicados` — nunca contra o documento:

    digito verificador   calculado 67, informado 67   CONFEREM
    ReceitaWS            HTTP 200, situacao ATIVA
    BrasilAPI            404   ainda nao propagou
    CNPJa                402   "recently founded offices"

Duas das quatro fontes ainda nao tem o registro, e **isso nao e problema do
CNPJ** — e atraso das bases espelho, coerente com inscricao de tres dias.

    razao social      ORLANDO HENRIQUE BASTOS DA CRUZ LTDA
    CNPJ              68.877.105/0001-67, ATIVA desde 28/08
    natureza          206-2  Sociedade Empresaria Limitada
    CNAE principal    6311-9/00  tratamento de dados e provedor de aplicacao
    CNAE secundario   6202-3/00  licenciamento de programas customizaveis
    endereco          Av Tancredo Neves 2539, sala 2609, Salvador/BA
    Simples Nacional  deferido, efeitos a partir de 31/08

**Tres coisas mudaram alem do numero**, e as tres afetam codigo:

1. **A razao social mudou de FORMA.** Era `64.543.748 ORLANDO HENRIQUE BASTOS
   DA CRUZ` — o padrao do MEI, que e o CNPJ seguido do nome civil. Agora tem
   sufixo societario de verdade.
2. **Existe nome fantasia na Receita: VELO FUNIL.** MEI nao podia ter, foi
   descontinuado da base do CNPJ em 15/11/2023 — e isso esta registrado aqui
   como a razao de a fatura do Asaas mostrar o nome civil. Agora pode.
3. **O CNAE principal e 6311-9/00**, nao o 6202-3/00 que o comentario de
   `lib/legal.ts` previa. Os dois estao no cadastro, e o principal e o de
   hospedagem e provedor de aplicacao, mais preciso para SaaS.

### Preencher dois campos reacendeu seis superficies

`lib/legal.ts` foi escrito em 25/08 exatamente para este momento, e a previsao
se confirmou: `cnpj`, `endereco` e `razaoSocial` preenchidos, e o rodape, a
secao de confianca, as duas paginas legais, o rodape dos e-mails e os avisos de
fatura voltaram a citar o numero **sem nenhuma delas ser editada**.

`ATUALIZADO_EM` foi de 09/08 para 31/08, e isso **nao e carimbo de revisao**: o
controlador mudou de pessoa juridica. Sob a LGPD (Art. 9o, I) o titular tem
direito de saber quem responde pelo dado dele, e a resposta mudou. Finalidades,
suboperadores, prazos de retencao e direitos continuam identicos — mudou quem
responde, nao o que e feito com o dado.

### Os cinco e-mails que sairam 23 dias com um CNPJ morto

Achado ao rodar `npm test`: o snapshot de `lib/emails/layout.test.ts` quebrou
mostrando o CNPJ novo entrando no rodape. Ao regerar os `.html` que ele
protege, os cinco estavam com **`64.543.748/0001-13`** — baixado em 08/08.

    confirmacao-cadastro.html    o primeiro e-mail que toda pessoa recebe
    recuperacao-de-senha.html
    convite.html
    magic-link.html
    reautenticacao.html

**Por que ficaram para tras.** A API de Auth do Supabase nao expoe template,
entao esses arquivos sao copias ESTATICAS coladas a mao no painel. Em 25/08,
quando `CONTROLADOR.cnpj` virou anulavel, o snapshot quebrou — como devia — e
**foi atualizado sem os `.html` serem regerados**. O alarme tocou e so metade
foi atendida.

O resultado e o pior tipo de divergencia: por 23 dias a landing nao exibia
numero nenhum (protegida) enquanto todo e-mail de autenticacao exibia um numero
que qualquer consulta a Receita desmentia. **Duas superficies do mesmo dado,
discordando**, e nenhuma delas errando alto.

E a mesma classe do commit de 23/08 que se chamava *"os prints mostravam o
vocabulario que a landing baniu"* e verificou que o script rodou, sem conferir
se a imagem ficou certa.

**A correcao nao e regerar; e travar.** O README ja pedia para regerar, e foi
ignorado — comentario nao roda em `npm test`. Agora dois testes leem os
arquivos de verdade:

    assina igual ao que o codigo gera hoje    toContain(assinaturaPublica())
    nao carrega o CNPJ baixado em 08/08       not.toContain('64.543.748')

**O segundo e o que de fato pegaria o defeito original**, e por isso existe: o
primeiro passaria mesmo com o numero velho ainda no arquivo, porque `toContain`
nao se importa com o que mais ha no HTML. Mesma razao pela qual a bio do
Instagram ganhou um teste que PROIBE a palavra da oferta aposentada em vez de
conferir o numero da vigente.

**Provado com controle negativo:** revertido um template ao estado de ontem,
2 testes reprovam; restaurado, 30 passam. Sem isso o verde nao provaria nada.

### Os dados cadastrais foram para o rodape, nao para a secao de confianca

A Meta le o site procurando razao social, endereco e telefone iguais aos do
CNPJ, e sem os tres a verificacao reprova — com a reprovacao ficando no
historico do Business Manager.

Eles entraram num bloco proprio no rodape, em corpo menor, separado da
assinatura de marca. Isso **preserva** a decisao de 24/08 em vez de desfazer:
aquela decisao tirou o nome civil do titular da linha de reforco visual, e essa
linha continua usando so o nome fantasia. Rodape e onde dado cadastral pertence
por convencao.

**O telefone publicado ali e o CADASTRAL** — `(41) 9788-0145`, da contabilidade
que abriu a empresa —, e esta rotulado como tal. O canal de suporte continua
sendo o WhatsApp `(71) 99330-9404`. Trocar os dois quebraria as duas coisas: a
Meta deixaria de bater, e quem precisa de ajuda cairia numa contabilidade.
`telefoneCadastral` vira `null` quando a alteracao cadastral for feita na
Receita, e o bloco some sozinho.

### O passo 1 da Meta fechou; o 3 ainda nao deve ser tentado

    1. CNPJ ativo na Receita              FEITO (28/08)
    2. site com razao social, endereco
       e telefone iguais aos da Receita   FEITO (esta rodada)
    3. verificacao do negocio no BM       ESPERAR propagacao
    4. App Business + numero em WABA
    5. App Review de whatsapp_business_*
    6. Tech Provider

**A ressalva que decide o momento de submeter:** a verificacao da Meta consulta
bases da Receita, e BrasilAPI e CNPJa ainda respondem 404/402. Submeter antes
da propagacao arrisca reprovacao por dado nao encontrado — e reprovacao entra
no historico do Business Manager. Esperar ate o numero aparecer em pelo menos
duas fontes independentes.

**Pendente do dono:** atualizar o cadastro comercial no Asaas com a razao
social nova (ate la a fatura sai com o nome antigo enquanto a tela mostra o
novo), e trocar o telefone na Receita, que e alteracao cadastral simples.

## Tres coisas que existiam e ninguem via (31/08)

Comecou com um relato do dono: *"nao chegou aqui, eu mandei por la no sistema e
nao apareceu"*. As tres achadas na mesma investigacao, e a do meio e a mais
cara — estava em producao havia tres dias.

### O relato chegou; a Central e que nao mostrava

As tres mensagens estao no banco, com anexo, rota e horario. A conta usada para
testar (`henriquestn24@gmail.com`, criadora da empresa "pedro eee") esta em
`contas-internas.ts`, e `lerFilaDeFeedback` tira interno da fila.

**A separacao esta certa e continua** — fila com teste dentro e fila que se
aprende a ignorar, a licao de 20/08 com 8 de 11 alertas. O defeito e **nao
haver porta**: o rodape dizia "4 relatos de conta interna, fora da fila" e era
texto morto. Nenhum caminho, em nenhuma tela, chegava neles.

Isso torna o canal impossivel de testar, porque testar e justamente mandar de
uma conta que e nossa. Mesmo defeito do "silenciar" sem "reexibir".

Agora o rodape e link para `?internos=1`, e cada linha ganha selo
`conta interna`. Na URL e nao em estado de componente: recarregar mantem, o
botao voltar funciona, o link e compartilhavel.

### A CSP bloqueava a logo da empresa, em producao, desde 27/08

Achado ao ver as miniaturas dos anexos quebradas. A politica listava:

    img-src 'self' data: blob: https://www.facebook.com

**Arquivo do Storage e servido pelo dominio do PROJETO Supabase**, nao pelo
nosso. Toda URL de `createSignedUrl` batia na politica e era recusada.

Enquanto a CSP viveu em Report-Only isso nao teve efeito. Em **27/08 ela virou
bloqueio**, e a prova daquele dia nao pegou porque nenhuma rota exercitada
exibia imagem do Storage.

    logo da empresa    Configuracoes -> Empresa. O upload dava certo e a
                       imagem nao aparecia.
    anexo de suporte   o print que o cliente manda junto do relato.

Os dois usam `<img>` com URL assinada de proposito: `next/image` nao serve para
endereco que expira em uma hora.

**E a CSP recusa em SILENCIO** — sem erro na tela, sem entrada em `error_logs`.
O unico registro fica no console do navegador de quem estivesse com ele aberto.
Mesma classe do pixel com quebra de linha de 24/08: defeito que so o navegador
ve, e que nenhum dos quatro portoes alcanca.

O host vem de `NEXT_PUBLIC_SUPABASE_URL`, a mesma variavel que `connect-src` ja
lia. Escrever a mao voltaria a quebrar na proxima troca de projeto — o que ja
aconteceu, na migracao para Sao Paulo em 12/08.

**Provado em producao, com os dois controles:**

    logo real (900x1600 jpg)   carrega, sem violacao de CSP
    host de fora (unsplash)    continua bloqueado

O controle negativo e o que separa "corrigiu" de "abriu demais".

### O Asaas cobrava para mandar o e-mail que ja mandamos

O gateway liga as **oito** notificacoes em todo cliente criado com e-mail.
Medido: 11 dos 12 clientes da conta com `PAYMENT_CREATED`, `PAYMENT_RECEIVED`,
`PAYMENT_OVERDUE`, `PAYMENT_DUEDATE_WARNING` (x2), `PAYMENT_UPDATED` e
`SEND_LINHA_DIGITAVEL` ativas. O unico desligado foi criado sem e-mail — ou
seja, e o padrao do gateway, nao escolha nossa.

Cada aviso tarifa mensageria (R$ 0,99 no extrato desta conta). E o produto **ja
manda cada um deles** pelo Resend: pagamento confirmado, pagamento atrasado, e
a escada D-4..D-1. Pagavamos para mandar duas vezes a mesma coisa, com dois
remetentes — que e como se treina alguem a marcar como spam, perdendo junto o
e-mail que importa.

**E a flag sozinha NAO resolve** — este e o achado que a correcao original
errou. Medido com cliente descartavel: criar com `notificationDisabled: true`
devolve o cliente com a flag `true` e **8 de 8 eventos ativos**. Sao dois
mecanismos independentes, e a documentacao nao diz qual vence.

Descobrir qual vence exigiria gerar cobranca real e esperar a fatura para ver
se a tarifa apareceu — caro e lento. Desligar os dois remove a pergunta:
`desligarNotificacoesDoCliente` roda uma vez, na criacao, em paralelo (8
chamadas independentes; em serie custariam ~8x a latencia num caminho que a
pessoa esta esperando).

**Falha ali nao derruba o checkout**, de proposito: isto e economia, nao
correcao de defeito. Se as chamadas falharem o cliente ainda assina e ainda
paga, so recebe aviso duplicado — derrubar o checkout trocaria R$ 0,99 por
R$ 49.

Provado ponta a ponta: nasce 8/8, termina 0/8, cliente apagado num `finally`.

**Os clientes que ja existiam foram desligados**, 10 dos 11, pelos dois
caminhos (79 notificacoes). O 11o, a **Fani RRH**, ficou de fora porque eu a
classifiquei como "unica usuaria real da lista" — **e ela e conta do dono**,
confirmado horas depois. O `contas-internas.ts` ja dizia isso; eu li o
`estado-atual.md`, que estava errado, em vez de conferir a funcao oficial.
Desligada na sequencia, fechando os 11.

### O checkout era a unica acao sensivel sem limite

`signin`, `invite`, `reset-password`, `log-erro` e `feedback` ja tinham
`excedeuLimite`. `createCheckout` nao — e e a unica que **gasta dinheiro por
chamada**: cria cliente e assinatura no Asaas, e cada cobranca gerada tarifa
mensageria mesmo sem ninguem pagar.

5 por hora, por usuario, depois do gate de admin e antes da primeira chamada ao
gateway. Por usuario e nao por IP pelo mesmo motivo do feedback: aqui sempre ha
alguem identificado, e limitar por IP puniria um escritorio inteiro.

## A Central declarava R$ 490/mes, e o real era R$ 0,00 (30/08)

Reportado com print: os numeros da Central se contradizem. Auditado contra o
banco E contra o Asaas — estava errado, e era dinheiro.

### Tres numeros da mesma tela discordando

    Entra por mes          R$ 490,00, "10 clientes pagando"
    Ja recebido            R$ 49,00, 1 pagamento
    Assinaturas no Asaas   7, "mas so 10 com Pro aqui"

O card do "ja recebido" dizia a verdade desde sempre. Ninguem confrontou os
dois.

### A causa: `pro_vigente()` responde "pode usar?", nao "pagou?"

`lib/dono/queries.ts` fazia `(empresas com pro_vigente()) * R$ 49`. A funcao e
`assinatura viva OU trial valido` — e esta correta nisso. Usa-la para medir
DINHEIRO funde tres coisas:

    quem paga              receita
    quem esta em trial     acesso gratis, receita ZERO
    quem ganhou cortesia   acesso de brinde, receita ZERO

**A propria Central tem botao de liberar Pro de cortesia** — e o brinde virava
R$ 49/mes. O sistema cobrando de si mesmo.

Medido: 12 empresas com `pro_vigente()`, **nenhuma pagante**. Duas internas,
cinco de dominio descartavel, quatro em trial, e uma com assinatura ACTIVE no
Asaas e zero pagamento confirmado.

### O unico pagamento, confirmado pelo dono

R$ 49 em 13/08, da empresa "Orne" (`wixese9814@neplis.com`). O dono confirmou
em 30/08: **foi ele mesmo, para testar o checkout.** A evidencia independente
bate — conta criada 23:04:08, empresa 52 segundos depois, pagou, e nunca
voltou: zero contato, zero negocio, zero atividade.

Isto ja estava registrado aqui desde 22/08 e continua valendo: o "primeiro Pix
real" e verdadeiro como prova tecnica e falso como receita.

### Quatro defeitos, e o quarto e o mais silencioso

1. **Trial contava como receita.**
2. **Cortesia contava como receita.**
3. **O filtro era `ehContaInterna`** (4 enderecos fixos) em vez de
   `ehContaDeTeste`. A MESMA armadilha registrada nesta mesma manha — e desta
   vez inflando dinheiro em vez de retencao.
4. **`teste-pro-1787589892727@velofunil.com.br` passava como cliente
   EXTERNO.** A lista de internos nomeia enderecos um a um e nunca acompanharia
   conta de teste nova, que nasce com carimbo de tempo. Agora o dominio do
   proprio produto e sempre interno: ninguem compra o produto pelo e-mail do
   produto.

### A correcao e de arquitetura, nao de calculo

`lib/dono/dinheiro.ts` ja registrava a doutrina — *"o banco sabe o que o
webhook conseguiu gravar; o Asaas sabe o que de fato aconteceu com o
dinheiro"*. `entraPorMes` vivia no arquivo do BANCO, contradizendo isso.

    lib/dono/receita.ts     NOVO. `classificarAcesso()` decide o estado:
                            pagante | assinou_sem_pagar | trial | cortesia |
                            interna | sem_pro
    dinheiro.ts             `assinaturasComPagamento()`, do gateway
    central.ts              o cruzamento, onde as duas fontes se encontram
    queries.ts              para de calcular receita

**`assinou_sem_pagar` e estado proprio, nao "cortesia":** cortesia e decisao do
dono, aquilo e venda travada que da para recuperar.

E `EmpresaComEstado` e tipo SEPARADO de `EmpresaNaCentral`: uma funcao que so
leu o banco nao consegue mais afirmar quem paga. O tipo passou a impedir o
defeito, nao so a documenta-lo.

### A tela agora

    Entra por mes      R$ 0,00   "ninguem paga ainda"
    Usando sem pagar   4         "3 em trial · 1 assinou e nao pagou"
    Assinaturas Asaas  7         "mas so 0 pagando de fato"

O trial saiu de DENTRO da receita e ganhou card proprio. Esconde-lo seria
trocar um numero inflado por um numero mudo — e ele e o que decide quanto PODE
virar dinheiro nos proximos dias.

Com o Asaas fora do ar a receita fica `null` e a tela mostra "—", nao R$ 0,00:
"nao sei quem paga" e diferente de "ninguem paga".

## O cliente ganhou canal de suporte, e a Central passou a acompanhar (30/08)

Ate hoje o cliente logado precisava **sair do produto** e ir a landing para
achar o e-mail de suporte. A unica mencao interna estava no dialogo de
pagamento, visivel so para quem tentou pagar e viu dar errado.

    barra lateral   "Ajuda e sugestoes" no rodape, acima da conta
    dialogo         problema ou sugestao, SEM sair da pagina (a URL nao muda)
    anexo           ate 3 arquivos, 10 MB, PNG/JPEG/WEBP/PDF
    contexto        tela, empresa, plano e navegador, capturados no servidor
    /dono/suporte   nome E e-mail de quem escreveu, filtros, busca, anexos,
                    e registro do que foi feito

**So "problema" manda e-mail.** Sugestao espera dias sem custo; problema e
cliente travado e pagando. E-mail para tudo vira ruido — a licao de 20/08.

**A validacao de anexo e pelos BYTES INICIAIS**, nunca pela extensao. Provado:
`.exe` renomeado para `.png` e recusado no servidor, mesmo passando pelo
`accept` do input, pelo tamanho e pelo `allowed_mime_types` do bucket (que
compara com o que o CLIENTE declara).

**Defeito achado pela propria prova:** o SDK do Resend **nao lanca** em falha
de envio — devolve `{ error }`. Com so `try/catch`, um 401 ou dominio nao
verificado passaria em silencio absoluto: o relato ficaria na tabela e o dono
nunca saberia. Mesma classe do `activities.insert` sem checagem de 24/08.

Provado ponta a ponta contra producao por `tests/e2e/suporte.spec.ts`, com o
e-mail SAINDO de verdade e a entrega conferida na API do Resend.

## O funil da Meta tinha três eventos e três vãos (30/08)

Auditoria de rastreamento pedida antes de investir em tráfego pago. Medido dos
dois lados — o código e o que a Meta de fato recebeu.

**Nada estava quebrado.** O pixel dispara (70 PageView no dia), a Conversions
API funciona (29 `CompleteRegistration` e 7 `Purchase` em 17 dias), e o Event
Match Quality é **6.2 de 10** com e-mail, IP, user agent e `external_id` em
100% de cobertura.

O problema era **cobertura de funil**:

    PageView               visitou                  existia, navegador
       ???                 comecou o cadastro       BURACO
    CompleteRegistration   terminou o onboarding    existia, servidor
       ???                 abriu o checkout         BURACO
       ???                 gerou o Pix              BURACO
    Purchase               pagou                    existia, servidor

**Por que isso custa dinheiro:** a Meta pede ~50 conversões por semana do
evento otimizado para sair da fase de aprendizado. Com 7 Purchase em 17 dias,
otimizar por Purchase é pagar o algoritmo para chutar.

### Os quatro eventos novos, e por que cada um mora onde mora

| evento | onde | origem |
|---|---|---|
| `Lead` | `signUp` deu certo | CAPI |
| `InitiateCheckout` | assinatura criada no Asaas | CAPI |
| `AddPaymentInfo` | Pix/boleto carregados | CAPI |
| `ViewContent` | seção de planos entra na tela | pixel |

**A divisão não é gosto, é arquitetura.** `meta-pixel.tsx` bloqueia o pixel em
toda área logada (decisão de 21/08, motivada por erro #418/#423 do React em
`/hoje` e `/calendario`), então os três eventos de compra **só podem ser
servidor**. `ViewContent` é o inverso: acontece na landing, onde o servidor não
sabe de nada.

### O achado que mais vale: recadastro tem TRÊS casos, não dois

A guarda do `signUp` assume que e-mail repetido volta com `identities: []`.
Medido contra o Supabase de produção:

    cadastro novo                    user=1c6691e4  identities=1
    repetido, e-mail NAO confirmado  user=1c6691e4  identities=1
    repetido, e-mail CONFIRMADO      user=78fe97c2  identities=0

**O caso do meio passa direto pela guarda.** Quem impede o Lead de dobrar ali é
o `event_id` determinístico (`lead:<id>`): o id do usuário é o MESMO, então a
Meta deduplica. E o de baixo mostra por que a guarda continua indispensável —
com e-mail confirmado o Supabase devolve um id DIFERENTE a cada tentativa
(anti-enumeration), e nada deduplicaria.

**As duas defesas cobrem buracos distintos**, e nenhuma das duas sozinha
resolve. Provado no navegador contra build de produção: 1 Lead, 1 Lead
deduplicado, 0 Leads.

### O `test_event_code` NÃO protege o dataset, e quatro eventos provaram isso

Este é o erro da rodada, e ele é do tipo que este documento existe para
registrar.

A implementação ganhou suporte a `META_TEST_EVENT_CODE` justamente para
exercitar o funil sem escrever no conjunto com que o algoritmo aprende — a
lição dos 18.192 PageViews de `localhost` de 13/08. **Com um código
inventado (`TEST00000`), a Meta responde `events_received: 1` e grava no
dataset de produção do mesmo jeito.** Sem erro, sem aviso.

Somado a isso, uma rodada de prova subiu o servidor sem os `export` de token
inválido. Resultado: **`Lead`, `InitiateCheckout`, `AddPaymentInfo` e
`Purchase`, um de cada, entraram no dataset real** e não há API para removê-los.

O método que de fato funciona, e que provou os eventos depois: rodar o servidor
com `META_CONVERSIONS_API_TOKEN` **inválido**. A Meta recusa, o `console.error`
prova que a linha foi alcançada, e nada é gravado. Sucesso seria silencioso e
não provaria nada.

### O controle negativo achou um defeito que o caminho feliz não acharia

O `ViewContent` disparava **sem consentimento**. A única cerca era
`typeof fbq === 'function'`, e a proteção real vinha de outro componente
(`meta-pixel.tsx` não injeta o script antes do aceite) — efeito colateral, não
regra deste caminho. Bastaria uma extensão de navegador definir `fbq` para o
consentimento deixar de valer, sem nada falhar.

Agora `podeRastrearEsteEvento` exige as duas coisas. Provado nos três casos:
sem rolar 0, rolando 1, sem aceite 0.

### Duas coisas do ambiente, achadas de passagem

**A CSP quebra a hidratação no `next dev`.** Ela virou bloqueio em 27/08 sem
`unsafe-eval`, e o webpack de desenvolvimento usa `eval` para os módulos:
`EvalError` no console, React nunca hidrata, e o formulário de cadastro submete
nativamente (`GET /cadastro?name=…&email=…`). Em produção não acontece — o
build não usa `eval`. Toda prova de navegador precisa rodar contra `next start`.

**`TaskStop` não mata o `next dev`.** O processo filho sobrevive, continua
escrevendo em `.next`, e reescreveu o mapa de chunks logo depois de um `npm run
build` — o `MODULE_NOT_FOUND` em `webpack-runtime.js` que o `CLAUDE.md`
documenta, na direção inversa da registrada. Matar pela porta
(`Get-NetTCPConnection -LocalPort N`) é o que funciona.

### Gestão de tráfego: o que nenhum código resolve

A única campanha da conta é **`OUTCOME_TRAFFIC`**, pausada, R$ 30/dia. Objetivo
de tráfego otimiza por clique, não usa o pixel para conversão. Para aquisição
de SaaS é `OUTCOME_SALES`, e a escada é:

    semana 1-2   otimizar por Lead                volume para aprender
    depois       subir para CompleteRegistration  quando passar de ~50/semana
    so entao     Purchase                         quando houver volume real

**A atribuição se resolve sozinha no primeiro dia de campanha.** Hoje 39
empresas têm 1 `fbc` e 0 `utm_campaign`, porque nenhuma campanha rodou — a
captura funciona e nunca foi exercitada. Com tráfego, o `fbclid` entra na URL,
`utm-capture.tsx` grava, e a CAPI passa a mandar o clique junto. O EMQ de 6.2
sobe a partir daí.

## O trial acabou, o token da Meta morreu, e o Instagram nunca esteve ligado (29/08)

Rodada longa, cinco frentes. O que as liga é a mesma classe que este documento
existe para combater: **coisa afirmada que deixou de ser verdade sem ninguém
perceber** — aqui em três lugares diferentes.

### O reverse trial acabou (migration 0057)

Decisão do dono: empresa nova **nasce no Free**. A 0057 tira `trial_ate` do
`insert` de `create_workspace_with_admin` e não toca em mais nada.

**As 10 empresas que já estavam em avaliação mantêm o prazo delas**, medido no
dia da migration: `trial_ate` intacto, nenhuma linha alterada. Cortar o trial
de quem leu a promessa na tela de cadastro seria quebrar contrato. Por isso a
coluna, `em_trial()` e as triggers continuam de pé — quando a última vencer, a
lógica fica adormecida, não removida.

**A ordem importou, e é o que vale registrar.** A landing ainda dizia "7 dias
de Pro grátis" em três lugares, incluindo a `<meta description>` e a imagem de
compartilhamento — que é o que aparece no Google e no WhatsApp **antes de
qualquer clique**. Aplicar a migration primeiro faria a página prometer um
trial que já não existia. Promoção da landing primeiro, migration depois.

Provado com empresa descartável, apagada num `finally`, **8 de 8**: nasce sem
`trial_ate`, `em_trial()` e `pro_vigente()` falsos, plano `free`, e o teto de
50 contatos valendo desde o primeiro instante (o 51º toma `42501`). As 10 em
avaliação, conferidas antes e depois, com prazo inalterado.

### A grade da landing fechou 3×3, e isso acordou dois defeitos que dormiam

Reportado com print: o card "Cada um vê o que precisa ver" com tamanho
diferente dos outros. Medido: **682px contra 341px**, o dobro exato, com
**186px de vazio** dentro dele (texto travado em `max-w-md`). Causa: eram 8
cards em 3 colunas, `8 % 3 = 2`, e o código esticava o último para não deixar
célula vazia.

Um 9º card (Calendário, entregue em 18/08 e nunca mostrado na página) fecha a
conta em vez de tratar a sobra.

**Os dois defeitos que a mudança de contagem revelou valem mais que a
correção**, porque nenhum veio do card novo — os dois estavam errados desde
sempre e eram inalcançáveis:

    sm:col-span-2 vazava para lg    utility de breakpoint vale dali PARA CIMA,
                                    e nao havia `lg:col-span-1` desfazendo.
                                    Com 8 cards, `8 % 2 = 0` nunca ligava o
                                    span de sm, entao o defeito nao tinha como
                                    aparecer. Com 9, apareceu na 1a medicao.

    a faixa horizontal era codigo   `viraFaixa` nunca havia sido verdadeiro.
    morto                           Ao renderizar pela primeira vez, saiu
                                    torta: `justify-center` empurrava icone e
                                    texto para o meio e quebrava o alinhamento
                                    da coluna esquerda com a grade inteira.

Provado em 9 larguras e nos dois temas: 1 largura distinta em `lg`, ícone em
`x=16 y=16` em todo card, sem rolagem horizontal em 375px. **E os PNG abertos e
olhados** — foi assim que a faixa torta apareceu, porque nenhum portão olha
dentro de imagem.

Detalhe de método que custou uma medição errada: o print precisa esperar o
stagger **terminar** (delay 260 + duração 600). Capturar antes mostra um
desalinhamento que é da animação, não do layout.

### Feed do Instagram: 5 artes, e o recorte que ninguém tinha registrado

`scripts/marketing/gerar-feed.py` produz **1080×1350 (4:5)**, reusando fundo,
tipografia, marca d'água e assinatura do gerador de Stories — importa o módulo
em vez de copiar, senão as duas famílias divergem no primeiro ajuste.

**A grade do perfil recorta em 3:4**, e isso não estava em lugar nenhum deste
projeto: a peça vai ao feed inteira, mas na grade o Instagram mostra
**1012×1350 centralizado**, 34px somem de cada lado. Quem desenhar encostado na
borda perde conteúdo justamente na tela onde alguém decide seguir o perfil.
`conferir_zona_segura()` derruba a geração se a margem perder a folga.

**A cápsula de categoria vai sem ícone dentro** — é `pill()` menos uma linha. O
espaço do ponto sai junto com o ponto: mantê-lo deixaria um vão à esquerda que
lê como imagem que não carregou, pior que o ícone removido.

As cinco carregam dado de pesquisa pública com a fonte impressa na arte, único
conteúdo que passa sem esbarrar na regra contra prova social inventada. Duas
linhas de fonte nasceram com nota de bastidor e foram reescritas — *"o dado
costuma ser creditado à Harvard, e não é"* cita Harvard na peça só para negá-la,
e quem lê no Instagram não tem contexto para isso.

**Nenhum sparkle foi encontrado.** O pedido citava ✦, ✧ e outros; varridos os
56 criativos, o gerador e todos os SVG, **eles não existem aqui**. O que existe
é o ponto na cápsula dos Stories e ícone genérico de banco nos 5 selos de
destaque (lâmpada, engrenagem, `?`, etiqueta) — **os dois seguem como estavam**,
porque a prioridade virou o feed.

### O `META_ADS_TOKEN` está morto

`API access blocked` (`OAuthException`, code 200) em **8 de 8** chamadas.
Funcionava em 25/08.

**A conta da Meta não está bloqueada**, e é isso que separa os dois problemas: o
MCP de anúncios lista as duas contas `ACTIVE`, com método de pagamento. Morreu
só o token do `.env.local`.

Consequência: **`/dono/anuncio` na Central não funciona** — a tela que 25/08
registrou como "5 de 5 pontos prontos" está cega.

### O Instagram nunca teve conexão por API

Foi informado que o sistema estava conectado a `@velofunil` por API. **Não
está**, e a evidência é de quatro lados:

    codigo que publica no IG    0 arquivos
    credencial de Instagram     nenhuma no .env.local
    META_ADS_TOKEN              morto (acima)
    contas de IG ligadas        0 na conta de anuncio

`lib/dono/perfil-instagram.ts` gera **texto** de bio e nome para copiar e colar
— não conecta a nada. As 5 artes sobem pelo celular.

**O business virou `VELO FUNIL LTDA`** — era "Rickdaskin". É sinal forte de que
o CNPJ novo saiu, e é o degrau que destrava a verificação de negócio da Meta.
**Não confirmado na Receita nesta rodada**, e `lib/legal.ts` segue com
`cnpj: null`.

### Dor de mercado, com evidência de TRÊS classes

> **Corrigido em 30/08.** Esta seção dizia "quatro classes" e a primeira era o
> banco de produção. Ela caiu: eu classifiquei "empresa externa" com um filtro
> escrito na hora em vez de `ehContaDeTeste` (`lib/dono/contas-internas.ts`),
> a função oficial do projeto. Refeito com ela: **33 das 39 empresas são teste
> ou conta interna**, e as 6 restantes têm **zero contato cada uma**.
>
> Não existe cliente externo que tenha usado este produto — logo não existe
> retenção ruim medida, ao contrário do que eu vinha afirmando aqui e em mais
> três documentos. O `estado-atual.md` já registrava isso desde 22/08 ("todos
> os cadastros até aqui foram teste do dono") e eu passei por cima.
>
> A dor selecionada continua de pé: as três evidências externas — pesquisa,
> reclamação pública e demanda — são independentes desta base.

[docs/dor-de-mercado.md](dor-de-mercado.md) analisa 5 candidatas e seleciona
uma: **todo CRM cobra um pedágio de digitação que quem vende pelo WhatsApp não
tem como pagar.**

    banco de producao   RETIRADA — 33 das 39 empresas sao teste, e as 6
                        restantes tem zero contato. Nao ha o que medir.
    publicada           3,4h/semana digitando; 55% das implantacoes falham,
                        e 60% disso e adocao, nao plataforma
    reclamacao          3 min por interacao x 30/dia = 90 min/dia
    demanda             82% da PME vende por WhatsApp (Sebrae, 8,2 mil
                        ouvidos); 10 CRMs brasileiros na mesma categoria

Solução proposta: aceitar a **conversa exportada do WhatsApp** como fonte de
contato — função nativa do aplicativo, gera `.txt`, não depende de API. O
caminho de importar arquivo já existe desde 11/08; muda o parser, não a
arquitetura.

**A ressalva que mais pesa, corrigida em 30/08:** o banco não mostra nem onde
as pessoas param — não há pessoa. A dor vem inteiramente de evidência externa,
é plausível e bem sustentada, e segue **sem uma única confirmação de alguém que
usou este produto**. O que produz esse dado é o tráfego pago, que ainda não
rodou.

**Dois achados do próprio método, e o segundo anula o primeiro.** A leitura
inicial deu "0% concluiu onboarding" porque eu media uma coluna
(`concluido_em`) que não existe — é `status`; o real era 96%. Em 30/08
descobriu-se que a base inteira daquela leitura estava errada: as "empresas
externas" eram teste. **Escrever o próprio filtro em vez de usar a função que
o projeto já tinha foi o erro que produziu os dois.**

### PRD, diagrama e grafo realinhados

O PRD e o `schema.md` estavam **28 commits atrás** e ainda vendiam o trial.
Reconferidos pelo OpenAPI do PostgREST, a mesma fonte de sempre:

    tabelas       17    igual a 26/08
    RPCs          30    igual
    foreign keys  17    igual
    migrations    56    o PRD dizia 55
    testes       687    o PRD dizia 715 (cairam com a saida do Evolution)

**A estrutura não mudou, e é esse o ponto.** A 0057 reescreveu uma RPC
existente por dentro, com a mesma assinatura — nada no catálogo se mexeu
enquanto a regra de negócio mudava. É o **terceiro caso da mesma classe**:
0055 reescreveu `pro_vigente()`, 0056 criou uma `returns trigger` que o
PostgREST não expõe, agora a 0057.

Grafo: 3455 → **3492 nós**, 284 comunidades, **0 nós fora do repositório**. Um
nó fantasma (`source_file: "next"`, o nome do pacote) podado e arquivado.
**60 imagens de `marketing/instagram/` ficaram fora de propósito** — cada uma
exige um subagente de visão, e elas não afetam o alinhamento entre PRD,
diagrama e código. Seguem sem estampa no manifesto, então a próxima rodada as
re-enfileira sozinha.

## O modo claro da landing, e a sombra que nunca existiu (26/08, tarde)

Pedido: auditar a landing em modo claro. Ela nunca tinha sido conferida nele —
o acabamento do claro, refeito em 22/08, só chegou ao produto logado.

### A causa é do sistema inteiro, não da landing

Medido no navegador, contra produção:

    .superficie-elevada  SEM ring   ->  elevacao aplica
    .superficie-elevada  COM ring   ->  --tw-shadow: 0 0 #0000, some
    [data-slot=card]     (tem ring) ->  --tw-shadow: 0 0 #0000, some

No Tailwind v4 a utility `ring-*` declara

    box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)

na **camada de utilities**, que vence `@layer base`. O `Card` deste projeto tem
`ring-1`. Portanto **a elevação do modo claro escrita em 22/08 nunca chegou a
nenhum cartão com anel — nem na landing, nem no produto.** Ela só funcionava
onde não havia `ring`, que é onde ninguém tinha olhado.

Corrigido alimentando `--tw-shadow` em vez de `box-shadow` direto: a elevação
**compõe** com o anel em vez de brigar com ele, que é como o Tailwind foi
desenhado. Medido depois, em produção: `/dashboard` no claro passou de 0 para
**6 de 6 cartões elevados**, e no escuro segue em 0.

### O que a landing tinha, além disso

**Branco sobre branco.** Página `rgb(246,248,249)` e cartão `rgb(255,255,255)`
dão **1,10:1** entre as superfícies. Sem elevação, o cartão não existia.

**As duas molduras de print sumiam:**

    border-border/50 sobre card branco    1,16:1
    shadow-2xl   0 25px 50px -12px rgba(0,0,0,0.25)

A meia opacidade desfazia a própria correção de 22/08, quando `--border` subiu
para 0.893 justamente para desenhar contra branco. E `shadow-2xl` contradizia o
comentário duas linhas acima da regra de elevação: sombra longa lê como cartão
de marketing, e ainda some no escuro.

**Cor que não significava nada.** Oito cards de funcionalidade, três passos,
quatro garantias e quatro métricas usavam oito matizes que não codificavam
informação: "Funil visual" não é a categoria azul. No escuro passavam como
acento neon; no claro liam como template. Ficou um acento só, o da marca. Os
pontinhos da barra de janela **continuam coloridos** (imitam o cromo do
sistema, ali a cor É o significado), e as barras do funil também (`stageAccent`,
a mesma do produto).

**A landing não usa `Card`.** Ela monta as superfícies à mão (`<li>`,
`<details>`) por razões de layout, então a elevação ganhou uma classe irmã,
`.superficie-elevada`, no MESMO seletor — não uma regra nova com os valores
copiados, que divergiria na primeira manutenção.

### Um comentário que registrava como fato algo falso

`public-navbar.tsx` justificava ter tirado o seletor de tema em 24/08 dizendo
que *"o `prefers-color-scheme` do aparelho vale sozinho"*.

**Não vale.** `layout.tsx` roda com `defaultTheme="dark"`, e no `next-themes` o
`enableSystem` só torna `"system"` um valor possível — quem decide sem nada
salvo é o `defaultTheme`. Navegador limpo em `prefers-color-scheme: light`
renderiza escuro. Escuro segue sendo o padrão por decisão de identidade
(`CLAUDE.md`); o que era falso era a justificativa de que o aparelho já
resolvia, e foi ela que sustentou a remoção do botão.

### O PRD e o diagrama voltaram a bater com o banco

Na mesma rodada. O PRD dizia "conferido em 24/08" e tinha 39 commits de
atraso; o `schema.md` afirmava 14 tabelas. Lido do OpenAPI do PostgREST de
produção:

    tabelas          14 -> 17   assinatura_eventos, conversas, mensagens
    foreign keys     12 -> 17
    RPCs             30 -> 30   NAO mudou
    testes          498 -> 715
    activity_type     4 -> 5 valores, ganhou whatsapp

**As tabelas mudaram e as RPCs não** — a 0055 reescreveu `pro_vigente()` por
dentro e a 0056 criou uma função `returns trigger`, e nenhuma das duas aparece
numa lista de RPCs. Quem monitorasse só RPC não teria visto nada.

Quatro afirmações do PRD que tinham deixado de ser verdade: WhatsApp constava
como integração entregue (está desligado, "Em breve" nos dois planos); a seção
de confiança "exibe o CNPJ" (não exibe, está baixado); `/conversas` não existia
no documento; e `CRON_SECRET` constava como pendência, sendo falsa desde 25/08.

### Provado

    landing, dois temas        4/4   elevacao no claro, nenhuma no escuro,
                                     nenhuma sombra >= 20px, so cor com sentido
    produto /dashboard         6/6   cartoes elevados no claro, 0 no escuro
    documentos vs catalogo    29/29  cada numero, cada tabela no Mermaid,
                                     cada enum, e nenhum link quebrado

E os PNGs foram **abertos e olhados**, nos dois temas — a única prova possível
para "está feio", e a lição de 23/08, quando um commit verificou que o script
rodou e não que a imagem ficou certa.

## O que a tela mostrava, e o que ela fazia (26/08)

Cinco commits, três telas. A ligação entre eles é a classe de defeito: **código
escrito, testado no papel, e que nunca chegou ao usuário.** Nenhum dos quatro
portões vê nada disso — só navegador contra produção vê.

### A janela de desfazer de `/hoje` nunca existiu

O dono clicou no checkbox e a tarefa sumiu na hora. A tela foi construída para
riscar a linha por 4 segundos com um "Desfazer" ao lado; nada disso acontecia.

`concluirTarefa` chama `revalidatePath('/hoje')`, e o efeito que sincroniza
props com estado substituía a lista inteira poucos milissegundos depois do
clique. A correção separou as duas coisas que um `useState` só tentava ser:
`tasks` espelha o servidor, `saindo` guarda quem está na janela, e a lista da
tela virou **derivada** — derivada não tem corrida.

**Corrigido isso, o defeito seguinte ficou visível, e ele é o que vale.** A
cópia local riscada era DESCARTADA enquanto o servidor ainda mandasse a tarefa
aberta, o que dura toda a viagem de revalidação. Medido meio segundo a meio
segundo:

    t(s)  linhas  riscadas  botao-Desfazer
    0.0      8       0            1        <- clicou, linha intacta
    1.0      8       0            1        <- um segundo depois, nada
    1.6      8       1            1        <- so agora risca
    5.1      7       0            0        <- sai sozinha

Um segundo e meio sem risco e sem checkbox marcado. O único elemento que reagia
era o botão "Desfazer" aparecendo ao lado de uma linha intacta — e o dono leu
exatamente assim: *"só sai quando aperta em Desfazer"*.

A cópia local passou a **substituir** a do servidor em vez de perder para ela.
E com `done_at` nulo na tela, `task-item.tsx` aceitava um segundo clique, que
montava um timer por cima do primeiro e deixava o primeiro órfão e vivo.

**O espelho do mesmo defeito, achado ao medir a correção:** ao desfazer, a linha
sumia por 1s e voltava (`6 -> 5 -> 6`). `reabrirTarefa` retorna ANTES de a lista
revalidada chegar, e nesse intervalo a tarefa não existia nem na janela nem no
servidor. A poda saiu de `desfazerConclusao` e foi para o efeito de sincronia: a
entrada só deixa a janela quando o servidor CONCORDA.

### O dashboard mostrava tudo e não abria nada

Um usuário tentou clicar num painel para ver o detalhe. Não foi azar de mira: a
tela era beco sem saída por três caminhos. Dos 4 cards só 2 tinham link, e era
um texto de 12px no rodapé; as barras do funil não clicavam; nenhuma linha de
"próximos do prazo" abria o negócio.

**A peça que faltava era de arquitetura:** `/kanban` não aceitava `searchParams`
NENHUM, então não existia endereço para o qual mandar quem clicasse. Agora
aceita `?etapa=` (coluna entra na tela, destacada) e `?negocio=` (painel abre de
cara). Fora dos 200 por etapa que o board carrega, a página busca o negócio
sozinho — uma consulta a mais só quando o parâmetro existe.

O alvo virou o **card inteiro**. Na tabela, `relative` na linha +
`after:inset-0` no link faz um `<a>` cobrir a linha toda: clicar em "Prazo" abre
o mesmo negócio que clicar no nome, e continua abrindo em nova aba e respondendo
ao Tab, o que `onClick` na linha não daria.

**Três defeitos achados junto, dois visíveis no print do dono:**

**O painel de prazos mentia.** Os 5 negócios da empresa não têm prazo,
`getUpcomingDeals` filtra `due_date not null`, e a tela dizia "Nenhum negócio em
aberto" — com 4 negócios abertos no card ao lado, mandando criar o que já
existe. Confundia *sem negócio* com *sem prazo*.

**"Viraram venda 100%"** era 1 ganho de 1 fechado, denominador 1 no card mais
visível. E com nada fechado mostrava `0%`, que afirma fracasso onde a verdade é
que nenhuma venda chegou ao fim. `get_dashboard_counts` **já devolvia**
`closed_deals`/`won_deals`, e `getDashboardMetrics` jogava os dois fora depois de
dividir. O tipo passou a carregar a base, e `textoDaConversao` não consegue
devolver percentual sem ela.

**O gráfico só tinha número no hover**, e ele entra no PDF do "Exportar
relatório". **No PDF não existe hover**: o relatório que o cliente recebia saía
com barras sem valor legível.

**Defeito achado pelo próprio roteiro de prova**, antes do commit:
`?negocio=<id-inexistente>` abria um painel VAZIO, porque o board só testava se
havia id selecionado, não se ele casava com algum negócio. Link velho ou negócio
apagado caíam no mesmo beco por outro caminho.

**Não entrou, e é decisão:** variação inventada ("+18% vs mês anterior"). Não
existe tabela de snapshot mensal. A BASE do percentual entrou porque é dado que
já existia.

### O filtro de `/hoje` se desfazia sozinho, por DUAS causas

Relato: *"seleciono, passa um tempo e sai"*. O escopo vivia só no `?escopo=` da
URL, e o item "Hoje" da barra lateral aponta para `/hoje` fixo: escolher "Da
equipe", ir ao Funil e voltar pelo menu devolvia "Minhas".

**Quatro cenários que NÃO reproduziram**, medidos antes de achar o certo, e
registrados para ninguém refazer: o seletor sozinho; a lista aberta parada por
76s (o relógio de 60s da tela não a fecha); empresa Free com zero tarefas, igual
à do print; e o seletor de empresa.

A escolha virou cookie lido pelo **servidor** (`lib/tasks/escopo.ts`) —
`localStorage` chegaria tarde e a tela piscaria com a lista errada.

**O cookie sozinho não bastou, e a segunda metade é a lição:**

    escolheu "Da equipe"   cookie=equipe   tela: Da equipe
    voltou pelo menu       cookie=equipe   tela: Minhas    <- cache
    recarregou de verdade  cookie=equipe   tela: Da equipe <- servidor certo

**O App Router GUARDA o RSC de cada URL e o replica ao voltar por `<Link>`, sem
perguntar ao servidor.** Com o escopo na URL havia duas chaves de cache
(`/hoje` e `/hoje?escopo=equipe`) e o menu aponta para a primeira. O escopo saiu
da URL e `push` virou `replace` + `refresh`: com uma chave só, o refresh invalida
ELA. Sem piscar, e **sem mexer em `staleTimes`**, que mudaria a navegação do
produto inteiro por causa de um filtro.

`?escopo=` continua aceito e VENCE o cookie: link compartilhado e botão "voltar"
precisam mostrar o que dizem.

### Provado no navegador, contra produção

    janela de desfazer   riscada em 0.0s, sai aos 4.6s, sem piscar ao desfazer
    dashboard            18/18, cliques dados na BORDA do card e na ultima celula
    filtro de escopo      9/9, incluindo link antigo e historico que nao empilha
    375px                sem rolagem horizontal, cards 136px, linha 72px

**O método que rendeu:** os cliques do roteiro são dados na borda do card e na
célula mais distante do título. É o que separa *"tem link"* de *"é clicável"*, e
foi assim que o painel vazio do id inexistente apareceu.

**Ressalva dita na cara:** `?negocio=` de um negócio **fora dos 200 por etapa**
não foi exercitado — exigiria 201 negócios numa coluna só. O caminho de falha do
mesmo código foi provado (id inexistente abre o funil normal, sem painel).

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

## A ponte do WhatsApp SAIU do produto em 28/08 — leia antes das seis seções abaixo

> **As seis seções de WhatsApp que seguem descrevem código que não existe
> mais.** Elas ficam porque explicam decisões que ainda governam o projeto — a
> capacidade da VPS, o risco de fingerprint da Meta, o dedupe antes do
> processamento — e apagá-las jogaria fora o porquê junto com o o quê.
>
> Mas quem procurar os arquivos citados nelas não vai achar. Removidos pelo
> commit `c52a718`, de 28/08:
>
> ```
> components/settings/evolution-connect-dialog.tsx
> lib/emails/whatsapp-desconectado.ts
> scripts/diagnostico/vigiar-sessao-whatsapp.mjs
> app/api/webhooks/evolution/.../route.ts
> ```
>
> **O motivo foi de segurança, não de produto.** O dono cancelou a VPS do
> Evolution para migrar à API oficial da Meta, e isso transformou um achado da
> auditoria em urgência: `podeConectarWhatsapp()` desligava a INTERFACE — o
> card dizia "Em breve" — mas era consultado em dois componentes de TELA e em
> nenhum lugar do servidor. Medido: a rota do webhook consultava a fase ZERO
> vezes e continuava aceitando e GRAVANDO, com service role, ignorando RLS por
> desenho.
>
> Enquanto a VPS existia isso era fraqueza de arquitetura. Com ela desligada,
> virava porta aberta para um serviço que ninguém mais operava.
>
> **Confirmado pelo dono em 03/09, e com dois motivos, não um:** a Evolution
> saiu porque **estava dando problema** — o que a série medida aqui já
> mostrava, 63% → 26% → 0% → 100% de sessão viva em quatro medições —, e a API
> oficial da Meta **ainda não foi aprovada**.
>
> Ou seja: não é uma migração em andamento com data. É um produto **sem
> WhatsApp** até a aprovação sair, e a escada da Meta registrada mais acima
> (CNPJ ativo → site com dados cadastrais → verificação do negócio → App
> Business + WABA → App Review → Tech Provider) continua parada no passo 3,
> agora também travada pela restrição de perfil de 06/07.
>
> **Isso governa o marketing.** É a razão de o WhatsApp ter saído da landing e
> das peças de anúncio em 02/09: prometer integração que não roda é a mesma
> classe do "contatos ilimitados" removido em 23/08.
>
> **Hoje:** `FASE_DO_WHATSAPP = 'migrando'` em
> `lib/integrations/whatsapp-estado.ts`. O que sobrou no código é o link
> `wa.me` (que nunca dependeu de nada disso) e o estado que mostra "Em breve"
> na tela de Integrações.
>
> **Esta nota existe porque a ausência dela é a classe de defeito que este
> documento combate.** Ele é lido no começo de toda sessão; sem o aviso, uma
> conversa nova leria a auditoria de 24/08 e concluiria que a ponte está de
> pé. Achado em 03/09, varrendo cada arquivo citado nos documentos contra o
> que existe no disco.

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
| ~~**cliente real externo**~~ **ERRADO, ver abaixo** | ~~8~~ **0** | ~~5~~ | 0 |

**As duas assinaturas "ativas" não são de cliente.** `Orne`
(`wixese9814@neplis.com`) é a conta em que o próprio dono pagou o Pix de R$ 49
para provar o checkout — o "primeiro Pix real" registrado abaixo é verdadeiro
como prova técnica e falso como receita. `Google Review Ltda`
(`google.review@velofunil.com.br`) é cortesia criada para o vídeo de
verificação do Google, válida até 2027.

> **Corrigido em 31/08.** Esta linha dizia que `Fani RRH Consultoria` era *"o
> único cliente externo que chegou a tentar assinar"*. **É conta do dono**,
> confirmado por ele: todos os cadastros desta base são teste dele. O e-mail
> `fanimayara67@gmail.com` está em `EMAILS_DO_DONO` (`contas-internas.ts`)
> desde que a lista existe — o código estava certo e este documento, errado.
>
> A tabela acima, portanto, **também está errada**: não há 8 clientes reais
> externos, há **zero**. O que ela mede é a mesma coisa que a auditoria de
> 30/08 já tinha corrigido para as empresas, e que passou batido aqui.

`Fani RRH Consultoria` está `past_due` desde 04/08 e nunca concluiu — teste de
checkout do dono que ficou pela metade, não venda perdida.

**Consequência prática, e é a que importa:** não existe conversão
cadastro→pagante medida, nem churn, nem LTV — não por falta de instrumentação,
mas porque a conversão nunca aconteceu com alguém de fora. Qualquer cálculo de
CAC feito sobre a base cheia (a conta de 7,7% que já circulou aqui) está medindo
as contas de teste do próprio dono.

O que É real e vale registrar: **5 de 8 pessoas externas que criaram conta
usaram o produto de verdade**. A ativação funciona; a monetização ainda não foi
provada uma vez sequer.

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
