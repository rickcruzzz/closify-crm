# PRD: Velo Funil

> Iniciativa de conversão Free→Pro (copy da landing, limites, checkout) tem
> PRD próprio: [prd-conversao-pro.md](prd-conversao-pro.md).
>
> **Estrutura conferida contra o catálogo em 08/09/2026**: **20 tabelas**,
> **34 RPCs do projeto**, **32 foreign keys**, **15 triggers**, **8 enums**.
> A 32ª chave é `deals.orcamento_tarefa_id → tasks` (0076), a primeira deste
> schema a fechar um ciclo — o porquê está em [schema.md](schema.md).
>
> <!-- contagem: migrations.arquivos=77 migrations.maior=0078 -->
> **77 arquivos de migration, e a maior é `0078`.** Os dois juntos, sempre: o
> número de arquivos sozinho convida a inferir `0071`, e o `0049` não existe —
> foi provado desnecessário e removido em 22/08. `node scripts/ci/contagens.mjs`
> imprime o invariante que reconcilia os dois.
>
> **As cinco contagens de estrutura acima expiram quando uma migration nova
> entra.** Não é prazo em dias: é a sentinela do repositório. Migration nova
> pode não mexer em tabela nenhuma — a 0069 acrescentou só uma coluna —, e a
> resposta certa costuma ser "conferi, não mudou". O que não pode é ninguém
> perguntar.
>
> **Testes não entram nesta lista.** O número exige rodar o vitest (8s), e
> contá-los estaticamente erra 15% por causa dos `.each`. Rode `npm test`.
>
> **`34 RPCs` precisa de ressalva, e ela é nova.** O catálogo devolve **65**
> funções, e 31 delas são da extensão `pg_trgm` (`gin_*`, `gtrgm_*`,
> `similarity*`, `word_similarity*`, `set_limit`, `show_trgm`) — instaladas
> junto do índice de busca por nome de contato, não escritas aqui. Contar as
> 65 infla o número em 91% e mede a extensão, não o produto. O comando abaixo
> exclui o prefixo delas.
>
> **Reconferido em 03/09.** Migrations e testes mudaram; tabela, RPC, FK,
> trigger e enum **não** — a 0069 acrescenta uma COLUNA
> (`workspaces.utm_content`, qual peça de anúncio trouxe o cliente) e não cria
> função nem tabela. É o quarto caso da mesma classe já registrada aqui: a
> estrutura fica parada enquanto a regra de negócio anda, e quem monitorasse
> só a contagem de RPCs não teria visto nada.
>
> **O que a estrutura ganhou na rodada anterior:** `notificacoes` (0066, o sino de
> avisos dentro do produto), `purge_old_rate_limit_attempts` (0067, a purga
> que faltava na tabela mais escrita do sistema) e `purge_old_feedback`
> reescrita (0068) — ela **nunca havia funcionado**: apagava anexo direto de
> `storage.objects`, o Supabase proíbe isso por trigger, e a exceção abortava
> a transação inteira, então nenhum relato era apagado desde a 0060.
>
> **Antes disso, em 02/09 de madrugada:** `vigia_ultimo_aviso` (0062),
> `excluir_empresa` (0064), `vigiar_o_vigia` (0063, que roda em `pg_cron` e
> não aparece como RPC do PostgREST) e a coluna
> `workspaces.consentimento_analitico` (0065), que fechou o envio de dado
> pessoal à Meta sem consentimento.
>
> **Este cabeçalho já esteve errado, e é por isso que os comandos estão
> escritos aqui.** Entre 29 e 31/08 ele afirmava 687 testes e 17 tabelas
> enquanto o real era 774 e 18. Nenhum número deste documento deve ser
> atualizado de memória:
>
> ```
> testes        npm test
> migrations    ls supabase/migrations/*.sql
> tabelas       select count(*) from pg_tables where schemaname = 'public'
> RPCs          select count(*) from pg_proc p
>                 join pg_namespace n on n.oid = p.pronamespace
>                where n.nspname = 'public' and p.prokind = 'f'
>                  and pg_get_function_result(p.oid) <> 'trigger'
>                  and p.proname !~ '^(gin_|gtrgm_|similarity|word_similarity|
>                                       strict_word_similarity|set_limit|
>                                       show_limit|show_trgm)'
> foreign keys  select count(*) from pg_constraint c
>                 join pg_namespace n on n.oid = c.connamespace
>                where n.nspname = 'public' and c.contype = 'f'
> triggers      select count(*) from pg_trigger t
>                 join pg_class c on c.oid = t.tgrelid
>                 join pg_namespace n on n.oid = c.relnamespace
>                where n.nspname = 'public' and not t.tgisinternal
> ```
>
> **Duas armadilhas de contagem, as duas já pagas aqui.**
>
> A primeira: `pg_constraint` e o OpenAPI dão números diferentes de propósito,
> e usar um achando que é o outro foi o erro do cabeçalho de 01/09 — ele dizia
> 17 foreign keys quando eram 29.
>
> A segunda, achada em 02/09: contar RPC sem filtrar `pg_trgm` devolve 65 em
> vez de 34. As funções da extensão são reais e estão no schema `public`, mas
> não são deste produto — nenhuma delas aparece em `lib/**`, e o número serve
> para medir o que foi escrito, não o que foi instalado.
>
> O estado operacional do dia a dia (o que quebrou, o que foi medido, o que
> está pendente) mora em [estado-atual.md](estado-atual.md); o diagrama de
> classes, em [schema.md](schema.md).

## 1. Contexto e Problema

Pequenas empresas de serviço no Brasil, agências, consultorias, clínicas, imobiliárias pequenas e
software houses, perdem negócios porque gerenciam vendas em planilhas, WhatsApp pessoal ou anotações
soltas. 62% das PMEs B2B ainda controlam o funil de vendas em planilha ou papel, e apenas 21% usam um
CRM SaaS dedicado. Quando a equipe cresce, os dados ficam espalhados sem controle de acesso, e leads
esfriam por falta de follow-up organizado.

## 2. Solução Proposta

O Velo Funil é um SaaS multi-empresa de gestão de vendas com pipeline visual Kanban, feito para
substituir a planilha em um dia. Cadastro de leads, pipeline Kanban com drag-and-drop, timeline de
atividades, dashboard de métricas e billing via Asaas, posicionado como "o CRM simples que cabe no
bolso de quem está começando".

## 3. Requisitos Funcionais

Estado real, conferido contra produção — não é planejamento. O que está
marcado está no ar em <https://www.velofunil.com.br> e foi exercitado com
dado real; o que não está tem o motivo escrito ao lado.

- [x] Login e Autenticação — e-mail/senha, Google OAuth, recuperação por Resend
- [x] Kanban (Funil) — drag-and-drop, filtro de parados, próxima ação no card
- [x] Dashboards (Resultados) — métricas reais, gráfico de funil, 8 presets de período
- [x] Multi usuário — convite por e-mail, papéis admin/membro
- [x] Multi empresa — workspace isolado por RLS, provado 14/14 com sessão real
- [x] Permissões por usuário — checadas em RLS **e** na UI
- [x] Parte premium (paga) — Asaas, checkout de Pix/boleto dentro do produto,
      webhook + reconciliação diária. **O reverse trial de 7 dias acabou em
      29/08 (migration 0057)**: empresa nova nasce no Free
- [x] Integrações (API) — Google Calendar e Gmail, com verificação OAuth do
      Google aprovada
- [x] Conversas — caixa de entrada do WhatsApp dentro do produto, ordenada por
      quem espera há mais tempo. **A tela está pronta; o transporte, não** (ver
      o item abaixo)
- [ ] WhatsApp conectável — sinalizado **"Em breve"** no produto, nos dois
      planos. A conexão pela VPS (Evolution) foi construída e está desligada; o
      destino é a **Cloud API oficial**, que exige CNPJ ativo antes de tudo
- [x] Busca e Filtros — nome, e-mail, empresa, status, responsável, data
- [x] Landing Page — dor do WhatsApp (não planilha), Free até 50 contatos
      (o trial de 7 dias saiu da página em 29/08, junto com a 0057), seção de
      confiança, prints reais legíveis no zoom e no mobile, sem prova social
      inventada
- [x] Onboarding do Usuário — assistente de 4 passos + checklist derivado do
      estado. "Pular" só a partir do 2º passo: pular no 1º deixava a conta sem
      empresa e trancava a pessoa num laço (corrigido 24/08)
- [x] Captura de erro — `error_logs` grava falha de tela e de webhook, e foi
      ela que permitiu achar em uma hora a causa da tela preta reportada em
      24/08. Desde a 0058 separa erro de conta interna do de cliente: 52 dos
      73 registros vinham de `localhost`, e um alerta que diz "73 erros"
      quando 4 são de gente real ensina a ignorar o alerta
- [x] Canal de suporte do cliente — diálogo dentro do produto, sem sair da
      tela, com anexo; e a Central `/dono/suporte` para acompanhar (0060, 0061)
- [x] Calendário — Mês, Semana e Agenda sobre as tarefas existentes
- [x] Filtro de Período — 8 presets + intervalo customizado com range picker
- [x] Exportação de Relatórios — PDF do painel de Resultados
- [x] **Importação de planilha** (`.xlsx` e `.csv`) — entregue em 11/08 e
      **ausente deste documento até 02/09**, apesar de ser o caminho que a
      promessa "substitui a planilha em um dia" depende. Colunas reconhecidas
      sozinhas por dicionário de sinônimos, prévia com as 3 primeiras linhas
      interpretadas, e cada linha vira contato **e** negócio no funil
- [x] Exportar para Excel/CSV — **entregue em 03/09**, na tela de Contatos ao
      lado de Importar: as duas setas juntas são o argumento. Tira a objeção
      "vou ficar preso no sistema" na hora da venda.
      `lib/leads/exportar-csv.ts` (esta linha dizia "próximo da fila" até 08/09,
      cinco dias depois de a exportação estar no ar)
- [x] Orçamento com prazo — **entregue em 08/09**, ver a seção própria abaixo
- [ ] Dashboard de receita — ganho no mês e ticket médio saem do que já existe;
      tempo médio de fechamento não, exige histórico de MUDANÇA de etapa
<!-- contagem: deal_stage.arquivos_de_codigo=10 -->
- [ ] Campos e etapas customizáveis — `deal_stage` é enum do Postgres, citado em
      10 arquivos de código; virar tabela é projeto próprio. Só com cliente
      pagante pedindo. (Dizia 22 até 04/09, e `capacidades.md` dizia 19: não
      eram três erros de contagem, eram três definições — com documentos, com o
      `.svg` do diagrama, e só código. A métrica agora carrega a definição no
      nome.)

      **Foi de 9 para 10 em 08/09 sem o acoplamento crescer**, e a distinção
      importa: o décimo é a **0076**, que cita `deal_stage` em COMENTÁRIO ao
      explicar que `proposta_enviada` era só o nome de uma etapa e que nenhuma
      função gerava uma proposta. Nenhum código novo lê ou escreve o enum.
      Trocar o número e deixar a frase intacta deixaria o texto numericamente
      certo e semanticamente falso — que é pior do que estar velho, porque
      parece conferido.

### Funcionalidades Principais

**Login e Autenticação**
Login com Supabase Auth, incluindo recuperação de senha via Resend e Google OAuth.
Magic link foi descartado: com Google OAuth e recuperação de senha funcionando, ele
seria um terceiro caminho de entrada sem cobrir nenhum caso que os outros dois deixam
de fora.

Trocar senha, dentro do produto, exige confirmar a senha atual (checado pelo
estado real da sessão, não por um valor vindo do cliente). Só quem está
criando a primeira senha, chegando por login social, fica isento, ali não há
o que confirmar. Sem essa exigência, sessão sequestrada bastaria pra trocar a
senha e trancar o dono de fora da própria conta.

**Kanban**
Pipeline visual com drag-and-drop entre etapas, persistência no banco e cards com dados essenciais do negócio.

**Dashboards**
Painel com métricas principais, gráficos de funil e visão rápida dos negócios em aberto.

**Multi usuário**
Convite de colaboradores por e-mail e trabalho colaborativo no mesmo sistema.

**Multi empresa**
Cada empresa ou cliente possui um workspace separado e isolado por permissões.

**Permissões por usuário**
Papéis como Admin e Membro para controlar acesso e edição.

**Parte premium (paga via Asaas)**
Plano Free com limites e plano Pro com uso ilimitado, ativado por assinatura recorrente no Asaas.

Quem tenta usar um recurso Pro sem ser Pro vê mensagem diferente conforme o
caso: nunca assinou vê "Faça upgrade para conectar"; já foi Pro e a
assinatura venceu vê "Reative o plano". A distinção vem de
`integration_connections` ter alguma linha (só existe se o workspace esteve
Pro alguma vez), já que `subscriptions` guarda só o estado atual, sem
histórico.

**Integrações (API)**
Integração com serviços externos via API, incluindo Asaas, Resend e futuras automações.

**Verificação do Google APROVADA em 24/08**, para `calendar.events.owned` e
`gmail.send`. Some da tela de consentimento o aviso "O Google não verificou
este app", que obrigava a clicar em "Avançado" e afastava qualquer pessoa que
não fosse desenvolvedor. O que destravou foi trocar `calendar.events` (eventos
em TODOS os calendários, inclusive os compartilhados por terceiros) pelo escopo
restrito, que é o que o produto de fato usa.

Duas consequências que o próprio e-mail de aprovação avisa, e que precisam ser
respeitadas: **mudar a tela de consentimento** (nome, logo, domínio, política)
ou **acrescentar escopo** derruba a verificação e exige submeter tudo de novo,
com vídeo novo; e a verificação **não é herdada** por um projeto novo do Google
Cloud, mesmo na mesma conta.

Google Calendar e Gmail são conectáveis em **Configurações → Integrações**,
OAuth próprio (`/api/integrations/google/*`), separado do OAuth de login, que
não persiste refresh token utilizável em background. Um escopo por conexão
(`calendar.events` ou `gmail.send`, nunca os dois), token cifrado
(AES-256-GCM) e renovação automática perto de expirar. Botão "Adicionar ao
Google Calendar" na próxima ação do negócio, "Enviar e-mail" no painel do
lead, os dois registram atividade na timeline.

WhatsApp tem **dois mecanismos independentes**, e só um deles funciona hoje:
o link `wa.me` (ver **WhatsApp por link**, abaixo), que nunca dependeu de token
nenhum e continua ativo; e a conexão do número da empresa, construída sobre
Evolution GO numa VPS própria e **desligada desde 26/08** (ver **WhatsApp: o
que existe, e por que está desligado**, abaixo).

A **Cloud API oficial** já foi implementada uma vez e removida em 13/08, quando
a decisão foi não usá-la — nunca teve conexão real em produção. Ela voltou a
ser o destino em 26/08, por motivo diferente do de então: não é mais "vale a
pena?", é o que a fase 1 estruturalmente não entrega (fila com dono, relatório
por atendente) somado ao risco de a Meta restringir um número não oficial. O
que trava não é código, é o CNPJ.

**Busca e Filtros**
Busca por nome, e-mail, empresa, status, responsável e data.

O campo "Lead vinculado" do formulário de negócio usa combobox com busca em
vez de lista solta, workspace com muitos leads exigia rolar a lista inteira
procurando pelo nome.

**Landing Page**
Página pública, e a única superfície que o tráfego pago vai encontrar. Oito
seções, nesta ordem: hero, números, como funciona, funcionalidades,
**confiança**, preço, FAQ e chamada final.

*O inimigo da página mudou em 24/08, com número atrás.* Até então ela atacava
a planilha ("Da planilha ao funil em três passos"). Medido na 12ª Pesquisa
Pulso do Sebrae (2026): **82% dos pequenos negócios brasileiros têm o WhatsApp
como principal canal de venda**, 76% vendem por lá — quem não tem planilha lia
"exporte seu .csv" e concluía que o produto era para outra pessoa. A headline
virou **"O WhatsApp guarda a conversa. Não guarda o cliente."**: não compete
com o WhatsApp, o complementa, porque "mas eu já uso WhatsApp" é a objeção nº 1
do público. "Como funciona" segue a mesma troca: passo 1 deixou de exigir
planilha ("Traga sua planilha" → "Traga quem já é seu cliente").

*A promessa do hero é a vantagem que nenhum concorrente tem:* **R$ 49 por mês
pela empresa inteira, não por vendedor.** A comparação de preço, na seção de
planos, torna isso concreto: Agendor cobra a partir de R$ 53 **por usuário**,
cinco pessoas dão R$ 265/mês contra os R$ 49 daqui — preço de tabela pública
deles, não prova social inventada. Até 22/08 o hero prometia "contatos
ilimitados" no plano grátis — falso, prometer no topo o que a página nega
embaixo é o primeiro dado que o visitante descobre que não bate.

*O hero agora vende o que o produto de fato entrega.* Desde a migration 0051
toda empresa nasce com **7 dias de Pro completo**, sem cartão — e até 24/08 a
landing seguia anunciando o freemium antigo ("grátis pra sempre, sem prazo pra
decidir"), vendendo menos do que o sistema dá. Corrigido no hero, na faixa de
números, no cabeçalho de planos e na primeira pergunta da FAQ.

*Seção de confiança, nova em 24/08, substitui a prova social que o produto não
tem.* Auditadas seis landings de referência (Agendor, Pipedrive, Attio,
Basecamp, Tally, Page AI): todas sustentam a página em "N mil empresas" ou
depoimento com nome — com zero cliente externo pagante, copiar isso deixaria
buraco onde mais dói. Em vez disso, quatro garantias conferíveis (isolamento
por RLS, dados em `sa-east-1`, cartão que nunca passa pelo nosso servidor,
cancelamento sem multa).

*O CNPJ saiu da vitrine em 25/08 e voltou em 31/08, com outro número.* A
seção exibia a inscrição como prova conferível — e a consulta à Receita
desmentia a página: `64.543.748/0001-13` estava **baixado desde 08/08/2026**.
Numa seção que abre dizendo "em vez de pedir confiança, mostramos onde ela pode
ser conferida", exibir número morto é pior que não exibir nenhum. Desde 31/08 a
vitrine exibe **`68.877.105/0001-67`**, uma LTDA ativa desde 28/08 — e o
mecanismo que permitiu viver vinte dias sem inscrição é o mesmo que reacendeu
as seis superfícies de uma vez, sem editar nenhuma delas.
`CONTROLADOR.cnpj` virou `string | null`, e duas funções puras decidem o texto
(`lib/legal.ts`): `identificacaoDoControlador` para as páginas legais e avisos
de fatura, `assinaturaPublica` para rodapé, confiança e e-mails. Sem inscrição,
some o número e **fica o nome** — a LGPD (Art. 9º, I) exige controlador
identificado, e string vazia deixaria a Política de Privacidade sem ninguém
respondendo pelo dado. Preencher os dois campos reacende os seis lugares de uma
vez.

*As funcionalidades são nomeadas pelo problema, não pelo recurso.* "Painel de
resultados" virou "Quanto você tem para fechar este mês"; "Controle por
colaborador" virou "Cada um vê o que precisa ver". Descrever o recurso produz
uma página que qualquer CRM do mundo poderia assinar. São 9 cards. O oitavo é
o **WhatsApp**, que não aparecia em lugar nenhum da landing apesar de ser o
canal onde a PME brasileira de fato vende.

*O nono card entrou por aritmética, não por conteúdo faltando (29/08).* Com 8
cards numa grade de 3 colunas, `8 % 3 = 2` fazia o código esticar o último para
tapar a célula vazia — ele saía com **682px contra 341px** dos outros, e o
texto travado em `max-w-md` deixava 186px de vazio dentro. Nove fecham 3×3
exato, sem nada esticado. O card novo é o **Calendário**, funcionalidade
entregue em 18/08 que a página nunca mostrou.

*Imagem: híbrido, por causa do LCP.* O funil do hero é HTML puro, sem JS e sem
imagem — é o maior elemento acima da dobra e uma imagem ali atrasaria a métrica
que mais importa em tráfego pago. Os prints reais do produto (`public/produto/`,
3 telas × 2 temas, 1440×900 em `deviceScaleFactor: 2`) entram **abaixo** da
dobra: Kanban em "Como funciona", tela "Hoje" fechando a mesma seção, e
Resultados no fim de "Funcionalidades". A troca claro/escuro é por CSS
(`dark:hidden`), nunca por JS — decidir no cliente causaria descasamento de
hidratação.

No telefone, o print encolhia para 21% do tamanho original (a tela é
desenhada em 1440px, a moldura mede ~307px) — texto de 14px virava mancha
cinza ilegível. Corrigido em 24/08 com recorte: abaixo de `sm` a imagem
renderiza a 300% da largura do container, deslocada para mostrar o canto que
importa (título, busca, primeiras colunas), com `overflow-hidden` cortando o
resto. No desktop, o `sizes` pedia exatamente a largura da moldura (1160px) —
zoom acima de 105% já borrava; agora pede 2048px, com folga de 1,5x.

*Sem prova social inventada, e isso é decisão travada.* Nenhum depoimento, logo
de cliente ou contador de empresas. A `StatsSection` já teve métrica copiada de
concorrente e ela foi removida de propósito; com zero cliente externo pagante,
qualquer número desses seria invenção. A seção de confiança (acima) é o que
substitui isso com transparência verificável em vez de número forjado. Entra
depoimento real quando houver cliente disposto a dar um.

*Sem travessão no texto que o cliente lê.* Removido de 48 lugares em 24/08 —
landing, telas de erro, e-mails transacionais, páginas legais — por ser um dos
sinais mais reconhecíveis de texto gerado por máquina; cada ocorrência foi
reescrita pela pontuação que o caso pedia (ponto final, dois-pontos, vírgula),
não trocada por hífen.

*Nome civil do titular e telefone cru, fora da LINHA DE MARCA.* Razão social
(era `64.543.748 ORLANDO...`, o padrão do MEI: número seguido do nome civil) e
o número do WhatsApp por extenso saíram da seção de confiança e da assinatura
do rodapé em 24/08: reforço visual não precisa de nome de pessoa física, e o
link `wa.me` já abre a conversa sem o número escrito do lado.

**Isso mudou de escopo em 31/08, não de decisão.** A verificação de negócio da
Meta lê o site procurando razão social, endereço e telefone iguais aos do CNPJ,
e sem os três na página ela reprova — com a reprovação ficando no histórico do
Business Manager. Eles entraram num bloco cadastral próprio no rodapé, em corpo
menor e separado da assinatura de marca, que continua usando só o nome
fantasia. O telefone publicado ali é o **cadastral**, da contabilidade que
abriu a empresa, e está rotulado: quem procura suporte continua caindo no
WhatsApp, não num escritório de contabilidade. Continuam onde são exigência, não escolha de marca: nas
páginas legais (LGPD, Art. 9º, I, exige identificar o controlador) e nos
avisos de fatura (o nome aparece no extrato do cartão de qualquer jeito,
avisar antes evita contestação).

*Sem seletor de tema no cabeçalho, desde 24/08, e a medição decidiu.* Ele
ocupava 48px — 13% da largura útil do cabeçalho em 390px — e em 320px o
resultado era pior: o "Começar grátis" **desaparecia** e o botão de tema
**ficava**, ou seja, a página priorizava escolha de aparência sobre o único
clique que gera receita. Ninguém decide comprar um CRM pelo tema, e quem tem
preferência já é atendido pelo `prefers-color-scheme` (o `ThemeProvider` roda
com `enableSystem`). Nenhuma das seis landings de referência auditadas tem
esse botão. Ele **continua no produto**, onde a pessoa passa horas e a escolha
é dela. Ganho medido: o CTA do cabeçalho voltou a aparecer a partir de 340px,
contra 360 antes.

*Banner de consentimento (LGPD).* O Meta Pixel grava cookie de terceiro e só
dispara depois do "Aceitar" — "Recusar" tem o mesmo tamanho e o mesmo peso
visual, como a ANPD recomenda. Ele mora no rodapé da viewport e foi compactado
para 122px no telefone (16% da tela): a primeira versão ocupava 206px e cobria
exatamente o botão "Começar grátis", que é o destino de todo clique de anúncio.

**Onboarding do Usuário**
Fluxo guiado para ajudar o usuário a criar workspace, cadastrar lead e começar
a usar o sistema rápido.

*"Pular por enquanto" não aparece mais no primeiro passo (24/08), e isso
corrige um defeito que trancava a conta.* A empresa só é criada no FIM do
assistente; pular antes disso marcava `skipped` sem empresa nenhuma, e a
pessoa entrava num laço eterno — `/dashboard` não achava empresa e mandava
para `/onboarding`, que via `skipped` e mandava de volta. Quatro contas em
produção ficaram assim, sem conseguir usar o sistema e sem erro em lugar
nenhum. A trava real está no servidor (`pularOnboarding` recusa pular sem
empresa); esconder o botão é só para ninguém bater numa porta fechada.

*O card "Primeiros passos", primeira tela de quem entra, foi corrigido em três
pontos no mesmo dia:* dizia "Ir para Leads" (jargão que a renomeação de 19/08
tirou de 38 lugares e este escapou — o menu chama a tela de "Contatos");
prometia "três passos para sair da planilha", contradizendo o
reposicionamento da landing para o WhatsApp; e o terceiro passo era "Convide
seu time", tarefa que o cliente típico — PME de serviço com uma ou duas
pessoas — não tem. Virou **"Traga seus contatos de uma vez"**, que é o que
transforma conta vazia em funil com conteúdo.

**Navegação (sidebar)**
Menu lateral em seções: grupo principal sem título (Hoje, **Conversas**, Funil,
Contatos, Resultados, Calendário) e "CONFIGURAÇÕES" (Perfil, Equipe, Integrações,
Preferências). Perfil já existia como rota, só não tinha entrada própria no
menu, vivia escondido no menu do rodapé. "Preferências" é o antigo item
"Configurações", renomeado pra descrever melhor a aba de dados da empresa,
distinta de Perfil (dados da pessoa).

**Gestão de Leads e Contatos**
Cadastro completo de leads e contatos, com listagem, busca, filtros e página de detalhe com timeline.

**Pipeline Kanban de Vendas**
Etapas: Novo Lead, Contato Realizado, Proposta Enviada, Negociação, Fechado Ganho, Fechado Perdido.
Cards com valor, lead vinculado, responsável e prazo. Drag-and-drop via `@dnd-kit`.

**Registro de Atividades**
Tipos: Ligação, E-mail, Reunião, Nota.
Timeline cronológica vinculada a cada lead.

**Tarefas e Próxima Ação**
Tarefa com prazo, responsável e conclusão, presa a um lead ou a um negócio.
Tela **Hoje**, primeira do menu, agrupa em Atrasadas, Hoje, Próximos 7 dias e
Depois, com filtro entre "minhas" e "da equipe".

*Concluir tem uma janela de 4 segundos para desfazer.* A tarefa fica riscada no
próprio lugar, com "Desfazer" ao lado, e só depois some. Não pede confirmação:
concluir é o gesto mais repetido do produto, e um "tem certeza?" a cada clique
viraria imposto diário — o que se ganha é **ver** o erro, não evitá-lo com
atrito. A janela existia no código desde sempre e **nunca chegou ao usuário**:
a revalidação do servidor apagava a linha em milissegundos, e depois de
corrigido isso a cópia riscada ainda perdia para a versão antiga do servidor
por 1,5 segundo. Corrigido em 26/08.

*O filtro "minhas / da equipe" é lembrado.* Ele vivia só na URL, e o item
"Hoje" da barra lateral aponta para `/hoje` fixo: escolher "Da equipe",
trabalhar um pouco e voltar pelo menu devolvia "Minhas", sem ninguém ter
clicado em nada. A escolha virou cookie lido pelo **servidor**
(`lib/tasks/escopo.ts`); "minhas" continua sendo o piso de quem nunca escolheu,
porque a tela responde "o que EU faço agora".

No card do Kanban a próxima ação ocupa o lugar do prazo do negócio: prazo é
previsão de fechamento, próxima ação é o que dá para cumprir hoje, e duas datas
no mesmo card fazem a pessoa não saber qual obedecer. Sem tarefa aberta o card
diz **"Sem próxima ação"**, negócio sem próximo passo é o que morre calado no
funil, e é a informação mais valiosa que o card pode dar.

Concluir uma tarefa grava a atividade correspondente na timeline do lead. Sem
isso o histórico teria buraco justamente no que foi feito por follow-up.

Tarefa não entra no limite do plano: travar follow-up empurraria a pessoa de
volta para o WhatsApp e mataria o hábito diário que faz ela pagar depois. Há um
teto de 5.000 abertas por empresa, que é defesa contra abuso pelo PostgREST, não
regra de negócio.

**Onboarding e ativação**
Quem cria conta passa por boas-vindas, responde 4 perguntas curtas (empresa,
segmento, modelo de venda, tamanho da equipe) e cai em Resultados com checklist
de ativação. O assistente **retoma de onde parou**, o estado vive em
`onboarding_state`, uma linha por pessoa, não por empresa.

Pular é oferta de verdade: não bloqueia nada, guarda o que já foi respondido e
não volta a aparecer a cada login. Quem entra por convite não vê o assistente,
a empresa dele já está montada.

O checklist tem 5 itens e é **derivado** do estado real do workspace, não
gravado: apagar o único lead reabre o item. Um booleano salvo continuaria
dizendo "feito" e o produto mentiria sobre si mesmo.

O segmento é guardado e personaliza texto. **As 6 etapas do funil continuam
fixas**, elas são um enum do Postgres usado por `deals` e `leads` em 22
arquivos, e torná-las editáveis é um projeto próprio.

**Dados da empresa**
Identificação (logo, nome, nome fantasia, CNPJ, segmento, descrição), contato
comercial (e-mail, WhatsApp, telefone, site) e endereço completo. Só o nome é
obrigatório; CNPJ é opcional, validado pelos dois dígitos verificadores quando
preenchido.

A logo vive num bucket **privado** do Supabase Storage, isolado por empresa, e
é exibida por URL assinada. O tipo do arquivo é conferido pelos bytes iniciais,
não pela extensão nem pelo `Content-Type`, os dois são escolhidos por quem
envia.

**Negócio parado**
`deals` guarda quando a ETAPA mudou pela última vez, separado de qualquer outra
alteração. Um negócio cujo valor foi corrigido ontem mas que está na mesma
etapa há três semanas conta como parado; usar a data de edição esconderia
exatamente esse caso.

Aparece como filtro "Parados" no Funil, com contagem, e só quando existe
algum, num funil saudável o botão fica escondido. O card não mostra:
lá já mora a próxima ação, e duas datas competindo fazem a pessoa não saber
qual obedecer.

Catorze dias é o limite. É escolha, não medição, quando houver histórico de
mudança de etapa, vira média por etapa.

**WhatsApp por link**
Lead com telefone válido ganha "Chamar no WhatsApp", abrindo `wa.me`. A Cloud
API oficial exige Meta Business verificado, que exige CNPJ ativo, mais aprovação
de template e custo por mensagem, o link resolve o que a pessoa quer, que é
abrir a conversa, sem nenhuma dessas dependências.

**WhatsApp: o que existe, e por que está desligado**
A conexão do número da empresa por QR Code, sobre **Evolution GO** numa VPS
própria, foi construída e provada ponta a ponta em 21-24/08: mensagem recebida
virava atividade no histórico do contato e, sem tarefa aberta, uma tarefa
"Responder no WhatsApp" com prazo de 2h; número desconhecido criava contato
novo, colocando quem chega pelo WhatsApp dentro do funil sozinho.

**Desde 26/08 ela está desligada, e o produto diz isso.**
`lib/integrations/whatsapp-estado.ts` tem uma única fonte de verdade
(`FASE_DO_WHATSAPP = 'migrando'`), e dela saem o selo "Em breve" e o aviso na
tela de Integrações — **nos dois planos**, Free e Pro. Vender como pronto o que
não conecta seria a mesma classe do "contatos ilimitados" removido do hero em
22/08.

*Por que sair da VPS, e não ajustá-la.* Não é API oficial, e a Meta pode
restringir o número sem aviso; desde janeiro/2026 a detecção olha fingerprint
de comportamento, não só volume, então número antigo e volume baixo não
protegem mais. As camadas construídas (limite por idade da conexão, nenhuma
função que aceite lista de destinatários, assinatura só dos dois eventos
necessários) reduzem muito, e **não zeram**. Some a isso o que a fase 1 nunca
resolveu e é recurso da oficial: uma instância é uma sessão de WhatsApp Web,
então todos veem a **mesma** caixa de entrada, sem fila com dono definido nem
relatório por atendente.

*A restrição que decide o prazo, e não é de código.* A **Cloud API oficial**
exige, nesta ordem: CNPJ ativo na Receita → site exibindo razão social,
endereço e telefone iguais aos da Receita → verificação do negócio no Business
Manager → App Review de `whatsapp_business_messaging`.

**Os dois primeiros degraus caíram, e o terceiro está em análise (01/09).**
O CNPJ `68.877.105/0001-67` está ATIVA desde 28/08, o site publica os três
dados cadastrais desde 31/08, e a verificação do negócio foi **submetida**.
Medido na Graph API em 01/09:

```
name                  VELO FUNIL LTDA
verification_status   pending        <- estava pending_submission em 25/08
two_factor_type       all_required
```

**`pending` e `pending_submission` parecem iguais na tela e não são:** o
primeiro é "enviado, na fila do analista", o segundo é "nunca enviou". Este
documento já afirmou "Meta Business verificado" enquanto o estado real era
`pending_submission`, e é por isso que os dois valores estão escritos aqui.

A tentativa anterior reprovaria com certeza: a Meta bate o número contra a
Receita, e o CNPJ de então estava baixado. Agora os requisitos estão em ordem
— o que **não** é o mesmo que aprovado. Enquanto não virar `verified`, nada
que dependa dela está liberado. O detalhe e o estado dessa fila estão em
[estado-atual.md](estado-atual.md).

*O que fica pronto enquanto isso.* A tela **Conversas** (abaixo) e o objeto
`Remetente`, que isola o transporte — a migração vira escrever uma segunda
implementação, não reescrever a tela. E a arquitetura foi provada: 85 de 85
requisições sem falha a 15 simultâneas, com 16× de folga sobre o pico projetado
de 100 clientes; Vercel e Supabase não são o gargalo.

*Duas coisas medidas que vale carregar adiante, uma linha cada.* A estabilidade
da sessão oscilou entre 0% e 100% de tempo logado em janelas de minutos — é a
**série** que separa oscilação de queda, nunca uma leitura isolada. E o campo
`LoggedIn` só existe em `/instance/status` **com o token da instância**; em
`/instance/all` ele vira `null`, e uma sessão saudável passa por morta.

*Fraqueza de arquitetura registrada, não escondida:* o segredo do webhook é
**único**, não por conexão. Quem o conhecer consegue injetar mensagem falsa no
funil de qualquer empresa sabendo o UUID dela. Não dá para ler nada (a rota só
escreve), e o segredo só existe no `.env` e no servidor. Segredo por conexão é
o caminho certo com muitos clientes, e está na fila.

**Conversas**
Caixa de entrada do WhatsApp dentro do produto, em três colunas: a lista de
conversas, a conversa aberta e o painel do negócio ligado àquele contato. O
ponto da tela não é ler mensagem — é **não deixar ninguém esperando**.

*A ordenação é a regra de negócio da tela.* Quem está esperando resposta vem
primeiro, e **o mais antigo no topo**, não o mais recente
(`lib/conversas/ordenar.ts`). Caixa de entrada ordenada por "última mensagem"
premia quem escreveu agora e enterra quem escreveu há duas horas — que é
exatamente a pessoa prestes a desistir. O relógio ao lado de cada conversa
muda de tom aos 5 e aos 10 minutos.

*Responder marca a conversa como respondida e fecha a tarefa junto.* Sem isso a
tarefa "Responder no WhatsApp" continuaria cobrando algo já feito, e o produto
passaria a mentir sobre o próprio trabalho.

*O transporte é trocável de propósito.* `lib/conversas/remetente.ts` define um
objeto `Remetente` com `enviarTexto`, `tetoPorHora` e `explicacaoDoTeto`. Hoje
existe uma implementação (Evolution) e ela está desligada; trocar para a Cloud
API oficial é escrever um segundo objeto, sem tocar na tela. **É a peça que
torna a migração de WhatsApp uma troca, e não uma reescrita.**

**Canal de suporte do cliente**
Até 30/08 quem estava dentro do produto precisava **sair dele** e ir à landing
para achar o e-mail de suporte. A única menção interna vivia no diálogo de
pagamento — visível só para quem tentou pagar e viu dar errado.

"Ajuda e sugestões" fica no rodapé da barra lateral e abre um diálogo **sobre a
tela atual**: a URL não muda. Isso não é preferência de navegação — é o que
preserva o valor do relato, porque a rota é gravada automaticamente e ela só é
a tela certa porque a pessoa não saiu dela para escrever.

Até 3 anexos, 10 MB cada, PNG/JPEG/WEBP/PDF. **O tipo é decidido pelos bytes
iniciais, nunca pela extensão nem pelo `Content-Type`** — os dois são
escolhidos por quem envia. Provado: `.exe` renomeado para `.png` é recusado no
servidor mesmo passando pelo `accept` do input, pelo tamanho e pelo
`allowed_mime_types` do bucket, que compara com o que o cliente declara.

*E-mail sai só para "problema".* Sugestão espera dias sem custo; problema é
cliente travado e pagando. E-mail para tudo vira ruído, e ruído treina a
ignorar a caixa — a lição de 20/08, com 8 de 11 alertas falsos.

*Defeito achado pela própria prova, e ele vale mais que o recurso:* o SDK do
Resend **não lança** em falha de envio, devolve `{ error }`. Com só
`try/catch`, um 401 ou domínio não verificado passaria em silêncio absoluto —
o relato ficaria na tabela e o dono nunca saberia. Mesma classe do
`activities.insert` sem checagem que fez o webhook do WhatsApp perder mensagem
em 24/08.

*A fila mostra tudo, e isso foi decidido duas vezes.* O padrão original
escondia relato de conta interna, herdando a doutrina dos alertas. Em 30 e
31/08 o dono mandou relatos pelo produto para conferir o canal, logado numa
conta que está em `contas-internas.ts`, e a tela respondeu "Nenhum relato
aberto" — três vezes. Ele concluiu, com razão, que estava quebrado.

Alertas é gerado pelo **sistema**, em fluxo contínuo, e ruído afoga sinal.
Suporte só ganha linha quando **alguém escreve** — são 9 desde que existe.
Fila dessa densidade não afoga nada, e o custo de esconder é maior que o de
mostrar. O selo `conta interna` em cada linha distingue sem sumir, e o filtro
`?apenas=cliente` continua a um clique.

**Resultados (métricas)**
Quatro cards (Contatos, Negócios abertos, Valor no funil, Viraram venda),
gráfico de funil em Recharts e a tabela de negócios mais próximos do prazo.

*Cada painel abre o que descreve, desde 26/08.* Até então a tela era quase toda
beco sem saída: dos quatro cards só dois tinham link, e era um texto de 12px no
rodapé; as barras do funil não clicavam; nenhuma linha da tabela abria o
negócio. O alvo passou a ser o **card inteiro**, a barra do funil leva à etapa
dela (`/kanban?etapa=`) e a linha da tabela abre o painel do negócio
(`/kanban?negocio=`) — clicar na coluna "Prazo" abre o mesmo negócio que clicar
no nome. Isso exigiu o Funil passar a aceitar parâmetro, que antes não aceitava
nenhum.

*O percentual não aparece mais sem a base.* "Viraram venda" mostrava **100%**
com um único negócio fechado, e **0%** quando nada tinha fechado — o primeiro
lê como desempenho excepcional, o segundo como fracasso, e os dois são leitura
errada do mesmo dado. `textoDaConversao` (`lib/dashboard/conversao.ts`) devolve
valor e base juntos, e o tipo não permite um sem o outro: `100% · 1 de 1
negócio fechado`, ou um travessão quando não há o que calcular.

*O painel de prazos distingue "sem negócio" de "sem prazo".* Ele dizia "Nenhum
negócio em aberto" nos dois casos — inclusive com quatro negócios abertos no
card ao lado, mandando criar o que já existia. Agora conta os abertos sem prazo
e oferece o passo que falta.

*O número mora na barra, não no hover.* O gráfico entra no PDF do "Exportar
relatório", e **no PDF não existe hover**: até 26/08 o relatório que o cliente
recebia saía com barras sem valor legível.

*Sem variação inventada, e é decisão travada.* Nada de "+18% vs mês anterior":
não existe tabela de snapshot mensal, e número forjado ao lado de dado real é
pior que a ausência dele. A base do percentual entrou porque é dado que já
existia no banco e estava sendo descartado.

**Exportação de Relatórios**
Botão "Exportar relatório" em Resultados captura a área de métricas em PDF
(`html2canvas-pro` + `jspdf`), já com o nome do workspace e o rótulo do
período aplicado, pra dono levar o funil pra uma reunião sem precisar
printar tela.

**Filtro de Período**
Oito presets (Hoje, Ontem, 7 dias, 30 dias, Mês, Mês passado, Trimestre, Ano)
mais intervalo customizado, com um range picker visual: grade de mês
navegável, hover mostra o intervalo em preview antes do segundo clique, dois
meses lado a lado no desktop e um mês dentro de um painel deslizante no
mobile. Substituiu dois campos de data soltos e desconectados. Sem
biblioteca de calendário de terceiro, `@base-ui/react` (base de toda a UI do
produto) não tem primitivo de data, e a grade de 42 células é a mesma
reusada pelo Calendário completo, abaixo.

**Calendário**
Tela **Calendário**, no menu entre Resultados e Configurações, com três
modos sobre as tarefas que já existem, sem tabela nova: **Mês** (grade com
até 3 tarefas por dia e "+N"), **Semana** (7 colunas, mais espaço por dia,
pensada pra ver conflito de horário) e **Agenda** (lista cronológica
agrupada por dia, é a mesma tela **Hoje** sem o filtro de "só minhas
abertas"). Cor por urgência e ícone por tipo, mesmos que Kanban e Hoje usam,
os três lugares não podem discordar sobre o que é urgente. Diferente da
tela Hoje, o Calendário mostra tarefa concluída também, é "o que aconteceu
e vai acontecer neste período", não "o que falta fazer". Semana busca dados
do servidor quando a pessoa navega pra fora dos 42 dias que a página
carregou de início.

Ficaram de fora deliberadamente, medido contra produção (12 tarefas em 21
workspaces, 1 integração conectada): página de histórico/auditoria dedicada
e rastreabilidade de sincronização/permissão. Mesmo volume que já reprovou
IA/lead scoring e a Cloud API do WhatsApp neste projeto; a timeline por lead
já cobre auditoria nesse volume.

### Orçamento com prazo (08/09)

**O objeto que o nosso ICP manipula o dia inteiro não existia no produto.** Até
08/09 este PRD não continha a palavra "orçamento" uma única vez, e `proposta`
existia só como NOME DE ETAPA: `deal_stage` tem `proposta_enviada`, e nenhuma
função gerava uma.

Duas medições independentes apontam para o mesmo objeto, e nenhuma delas foi
feita procurando por ele:

```
36 de 61 concorrentes (59%)   anunciam proposta / orcamento
a regua que escolheu os        criterio principal ORCAMENTO >= 2 — dedetizacao,
cinco nichos da prospeccao     marcenaria, comunicacao visual, locacao e
                               eventos entraram porque VENDEM POR ORCAMENTO
```

E a mensagem de abordagem que sai para esses cinco nichos diz, com estas
palavras: *"quando você manda um orçamento e o cliente não responde, quem lembra
de cobrar de volta?"*. **O produto cobrava por um recurso que não tinha.**

#### O recorte: é um relógio, não um gerador de documento

Dentro dos 56 domínios que anunciam proposta, o que cada um entrega:

```
43%  PDF
27%  aprovacao online do cliente
23%  itens / catalogo de produtos
 4%  VALIDADE / vencimento
 0%  AVISO de que o prazo esta acabando
```

Os dois últimos são quase inexistentes no mercado **e são exatamente o motor que
já existe aqui**: tarefa, prazo e a tela `/hoje`. O h1 da landing diz isso desde
sempre — *"A planilha organiza. Ela não avisa quem está esperando."*

Por isso o recurso é **"o orçamento tem prazo, e o sistema cobra o retorno"**.
Ao salvar uma validade, nasce a tarefa de cobrar retorno **dois dias antes** de
vencer, atribuída ao dono do negócio, e ela aparece em `/hoje` sozinha.

**Ressalva de método:** os 56 domínios não são todos ferramentas de proposta —
há artigo e página institucional na amostra. Os 4% e os 0% são indício forte de
ausência, não censo.

#### O que fica registrado como decisão

- **Não move a etapa do negócio.** Empurrar para `proposta_enviada` ao registrar
  o orçamento zeraria `stage_changed_at` (0033) para quem já está em
  `negociacao` — e é ele que alimenta o filtro "Parados". Um negócio em
  negociação ativa passaria a parecer recém-proposto.
- **Orçamento sem preço não é orçamento.** `deals_orcamento_tem_valor` recusa
  validade com `value = 0`. Sem ela, o PDF sairia para o cliente do cliente
  dizendo "R$ 0,00", e o erro só apareceria depois de enviado.
- **A cobrança nunca nasce atrasada.** Se `validade - 2 dias` já passou, ela cai
  no FIM do dia de hoje em vez de anteontem. Tarefa que nasce atrasada ensina a
  pessoa a ignorar o aviso de atraso, que é o único sinal que o produto tem.

#### O PDF é a linha do Pro, e foi ela que mudou

Até 08/09 o Pro era **"tirar três limites + Google Calendar e Gmail"**, e o
problema medido não era faltar recurso: era **ninguém nunca experimentar o Pro**.
Os dois únicos gatilhos de upgrade eram bater em 50 contatos — meses de uso — ou
querer as integrações Google, que **nenhum dos cinco nichos prospectados usa**:
eles vendem por WhatsApp e orçamento.

O orçamento com prazo é **do Free e ilimitado**, de propósito: quem nunca sentiu
o produto cobrar o retorno de um orçamento não tem razão para pagar por ele. O
PDF é a parede, e ela é atravessada na primeira semana.

O portão é `pro_vigente()` no SERVIDOR, em
`app/api/negocios/[dealId]/orcamento/route.ts`, antes de qualquer byte sair.
Gerar no navegador — como faz o "Exportar relatório" do Dashboard, que fotografa
a tela — deixaria o portão de ser portão, e ainda entregaria uma imagem onde o
cliente do cliente precisa de texto selecionável.

### Importação de planilha

O caminho que sustenta "substitui a planilha em um dia". O arquivo é lido **no
navegador** (`read-excel-file` para `.xlsx`, parser próprio para `.csv`), e o
servidor recebe a matriz já parseada — mas **reinterpreta do zero**: o cliente
não é confiado.

**A decodificação tenta UTF-8 com `fatal: true` e cai para Windows-1252**,
nessa ordem, porque o Excel em português salva CSV em Windows-1252 e "José
Antônio" entrava no banco como `Jos� Ant�nio`, calado. A ordem importa:
Windows-1252 aceita qualquer byte e nunca falharia.

**Três defeitos corrigidos em 02/09**, os três achados em auditoria e nenhum
visível na leitura casual:

**A tela prometia o que o servidor recusava.** A prévia truncava em 1000 linhas
e avisava; o envio mandava a matriz inteira; o Zod recusava tudo. Uma planilha
de 1500 mostrava "1000 linhas prontas", a pessoa clicava Importar e **nada
entrava**. O corte passou para a origem, e o aviso deixou de descrever o
passado ("foram lidas") para prometer o que acontece ("vamos importar as
primeiras 1000").

**Um telefone repetido derrubava o lote inteiro.** A chave de dedupe prioriza
e-mail — correto dentro da planilha, buraco contra o banco: um lead gravado com
e-mail *e* telefone entrava no mapa só pela chave de e-mail. Linha nova com
e-mail inédito e telefone existente passava, batia no índice único, e `23505`
derruba o lote — uma linha custava as outras 999. Agora as duas chaves são
indexadas, e o conflito deixa de existir em vez de virar mensagem melhor.

**O `update` de negócio não checava erro.** Falha de RLS ou rede movia zero
negócios e a tela dizia que deu certo — mesma classe do `activities.insert` de
24/08.

**Nenhum limite de importação por plano, e isso é decisão.** O teto de 50
contatos já é o limite real: uma planilha de 300 linhas importa 50 e para. O
que faltava não era trava — era a tela dizer **antes** o que vai acontecer, em
vez de mostrar 288 ignorados no relatório final. A prévia agora avisa quantas
vagas restam, com botão que abre o pagamento na hora (`?pagar=1`) e mostra o
preço.

**O gargalo que fica registrado:** o caminho `atualizar` custa ~2010
requisições para 1000 linhas — um `UPDATE` HTTP por lead, porque o PostgREST
não atualiza N linhas com N valores diferentes numa requisição só. A saída é
uma RPC com `update ... from (values ...)`, e ela merece rodada própria. O
caminho `ignorar`, que é o padrão, custa ~10.

### Multi-empresa e Colaboração

Workspaces separados por empresa ou cliente. Convite de colaboradores por e-mail via Resend. Papéis: Admin e Membro. Isolamento total de dados via RLS no Supabase.

**Trocar de empresa pede confirmação (02/09), contra o que o mercado faz.**
Slack, Notion e Linear trocam de espaço sem perguntar, e o argumento deles é
bom: a troca se desfaz com outro clique. Aqui a decisão foi outra, e ela vem do
próprio produto — neste CRM as empresas não são espaços de trabalho
intercambiáveis, são **carteiras de cliente separadas**. Escrever um contato ou
mover um negócio na empresa errada não se desfaz voltando: o dado ficou no
lugar errado, e só se descobre depois.

**Excluir empresa existe no produto desde 02/09** (RPC `excluir_empresa`,
0064), e as quatro travas moram no banco, não na Server Action:

```
so o CRIADOR          admin convidado administra o dia a dia; apagar a
                      empresa com o historico de todo mundo e do dono
nunca a ULTIMA        sem empresa o middleware manda ao onboarding, e a
                      pessoa recomeca do zero achando que perdeu tudo
sem assinatura viva   apagar sem cancelar deixa a cobranca correndo no Asaas
o nome CONFERIDO      no servidor, nao so no dialogo
```

`workspaces` tem RLS **sem policy de DELETE**: um `delete` pela sessão do
usuário seria negado em silêncio, com o PostgREST devolvendo sucesso e zero
linhas — a tela diria "excluída" com a empresa intacta.

**Quem tinha mais de uma empresa no Free mantém todas.** O limite chegou
depois, e cortar o que alguém já usava seria quebrar contrato — a mesma decisão
da 0057, que preservou o prazo das empresas em avaliação quando o trial acabou.
O seletor explica isso em vez de se contradizer listando três empresas `Free`
enquanto diz que empresa nova exige Pro.

### Segurança de borda (Cloudflare)

DNS migrado pro Cloudflare (19/08), proxy ativo na frente da Vercel.
Cloudflare Managed Ruleset (WAF) protege contra exploit conhecido (SQLi,
code injection, RCE), ativo por padrão no plano Free. Bot Fight Mode
desafia bot automatizado. Rate limiting bloqueia por IP em `/login` (30
requisições/10s), único slot disponível no Free — RLS continua sendo a
defesa real de isolamento de dado, isso aqui é filtro de volume/tipo de
tráfego antes de chegar no servidor.

**A CSP virou bloqueio em 27/08, e derrubou a logo do cliente por três dias.**
`img-src` listava `'self' data: blob: https://www.facebook.com` e mais nada —
mas **arquivo do Storage é servido pelo domínio do projeto Supabase**, não pelo
nosso. Toda URL de `createSignedUrl` era recusada.

O que quebrou: a **logo da empresa** em Configurações (o upload dava certo e a
imagem não aparecia) e os anexos de suporte. Os dois usam `<img>` com URL
assinada de propósito — `next/image` não serve para endereço que expira em uma
hora.

**A CSP recusa em silêncio:** sem erro na tela, sem linha em `error_logs`. O
único registro fica no console de quem estivesse com ele aberto. Mesma classe
do pixel com quebra de linha de 24/08 — defeito que só o navegador vê, e que
nenhum dos quatro portões alcança. O host agora sai de
`NEXT_PUBLIC_SUPABASE_URL`, a mesma variável que `connect-src` já lia; escrito
à mão voltaria a quebrar na próxima troca de projeto, o que já aconteceu na
migração para São Paulo em 12/08.

Provado com os dois controles: logo real (900×1600) carrega sem violação, e
host de fora (unsplash) continua bloqueado. O controle negativo é o que separa
"corrigiu" de "abriu demais".

### Monetização (Asaas)

**Dois planos pagos desde 04/09: R$ 49/mês e R$ 490/ano.** O anual nasceu para a
venda presencial — uma visita custa cerca de uma hora entre deslocamento,
demonstração e retorno e fecha em 10% a 20%, então cinco a dez horas por
cliente. A R$ 49 isso não se paga; a R$ 490 à vista, sim. E trava 12 meses de
retenção, número que este produto nunca teve porque nunca teve cliente externo.

O preço é **derivado da oferta**, em `lib/plans.ts`:
`PRO_ANUAL_PRICE = PRO_PLAN_PRICE * PRO_ANUAL_MESES_COBRADOS` — paga 10, leva
12. Escrever `490` literal deixaria os dois livres para divergir, e a frase
"dois meses grátis" continuaria na tela depois de deixar de ser verdade.

**O ciclo é decidido pelo nosso servidor e gravado em `subscriptions.ciclo`
(migration 0070), nunca pelo webhook.** A RPC `apply_asaas_subscription_status`
lia `interval '30 days'` literal: um pagamento de R$ 490 liberaria trinta dias.
Ela passou a ler `intervalo_do_ciclo(subscriptions.ciclo)`. `aplicarEventoAsaas`
e o webhook não mudaram uma linha — que é a prova de que a regra da 0027 foi
respeitada: *"payload de webhook é entrada externa, e derivar a validade do
acesso a partir dele deixaria alguém com o token estender o próprio plano."*

**O anual só aparece dentro do produto**, em Configurações → Cobrança. A landing
continua com um preço só, o mensal: um seletor lá tornaria a seção um componente
de cliente e custaria o LCP da página que recebe tráfego pago.

**O reverse trial acabou em 29/08 (migration 0057), por decisão do dono.**
Empresa nova **nasce no Free**. Entre 24/08 e 29/08 ela nascia com 7 dias de
Pro completo (migration 0051) — multi-empresa, colaboradores e contatos
ilimitados, sem cartão —, e a aposta era a conversão historicamente maior do
reverse trial (18-32% contra 2-8% do freemium puro). O dono cortou para
priorizar receita direta.

**As 10 empresas que já estavam em avaliação mantêm o prazo delas**, medido
contra produção no dia da migration: `trial_ate` intacto, nenhuma linha
alterada. Cortar o trial de quem já tinha lido a promessa na tela de cadastro
seria quebrar contrato, e por isso a 0057 mexe **só no `insert`** — a coluna,
a função `em_trial()` e toda a lógica de vencimento continuam de pé, porque
ainda existe gente vivendo dentro delas.

**A ordem importou, e é a lição a não repetir:** a landing ainda dizia "7 dias
de Pro grátis" em três lugares, incluindo a `<meta description>` e a imagem de
compartilhamento — que é o que aparece no Google e no WhatsApp **antes de
qualquer clique**. Aplicar a migration primeiro faria a página prometer um
trial que já não existia. Promoção da landing primeiro, migration depois.

`pro_vigente(workspace_id)` (RPC, `security definer`) passou a considerar
duas fontes, não uma: assinatura paga vigente **ou** `workspaces.trial_ate >
now()`. É a única função que qualquer trigger de limite pode consultar — nunca
a coluna `workspaces.plan`, doutrina travada desde a 0027, porque o trial
também teria uma "data que ninguém sabe que passou".

**O trial dava funcionalidade, não estoque, e isso levou uma correção
(migration 0053).** Vale para as empresas ainda em avaliação. Achado próprio:
durante os 7 dias dava para criar 5
empresas, ou convidar 10 colaboradores, e ficar com esse estoque depois do
trial acabar — porque a trigger de limite só olhava `pro_vigente()`, que
inclui o trial. A nova função `em_trial(workspace_id)` isola só o caso do
trial, e as triggers de limite de membro e criação de workspace passaram a
exigir `pro_vigente() and not em_trial()` — Pro pago libera estoque
permanente, trial libera só o uso temporário das funcionalidades.

**O Free é apertado desde o primeiro minuto (migration 0052):** 1 empresa,
até `FREE_MEMBER_LIMIT` = **2** colaboradores e `FREE_LEAD_LIMIT` = **50**
contatos (`lib/plans.ts`). Até 29/08 esse teto só passava a valer depois do
trial; agora ele vale desde a criação da conta, e isso foi provado com empresa
descartável — o 51º contato toma `42501` no primeiro instante de vida. O número passou por 300 numa correção
anterior e voltou a 50 nesta rodada — a landing vende "grátis pra sempre" como
chamariz de baixo atrito, não como plano generoso; quem precisa de mais sente
o teto rápido e assina.

Multi-empresa é recurso do Pro (e do trial que ainda corre), sem esse limite o teto de
colaboradores não segura nada — bastava criar uma empresa nova para cada
dupla. Plano Pro: colaboradores e leads ilimitados por R$49/mês, pela empresa
inteira, não por vendedor.

Cliente e assinatura criados via API do Asaas, com cobrança recorrente e
webhook para ativação automática.

**Checkout dentro do produto desde 24/08.** "Assinar Pro" abria a página do
Asaas em outra aba — a pessoa saía do produto no momento de maior intenção de
compra, e a tela do Asaas mostra o nome civil do titular (para MEI, sem opção
de nome fantasia desde 15/11/2023, dado da Receita). Pix e boleto passaram a
renderizar dentro de um diálogo do próprio produto (`pagar-dialog.tsx`): QR
Code real, código copia-e-cola, linha digitável formatada no padrão FEBRABAN,
com polling que confere a confirmação a cada 5s e para quando a aba está em
segundo plano. Cartão continua no Asaas de propósito — processar número de
cartão pelo nosso servidor colocaria o projeto no escopo de PCI-DSS, o que não
compensa para um SaaS deste porte.

## 4. Personas de Usuário

**Dono do Negócio / Empreendedor (Admin)**
Pequeno empresário de serviços que hoje controla vendas em planilha, WhatsApp ou caderno. Ele cria o workspace, convida a equipe, acompanha o funil e paga a assinatura quando percebe valor. É o decisor principal e o foco de monetização do produto.

**Gestor Comercial / Coordenador de Vendas**
Responsável por organizar o time, acompanhar metas e garantir que o funil não fique parado. Tem dor forte com previsibilidade, produtividade e controle de pipeline, então tende a valorizar dashboards e automações.

**Vendedor / Colaborador (Membro)**
Usuário diário do CRM, responsável por cadastrar leads, mover negócios no Kanban e registrar atividades. Sua experiência impacta diretamente a adoção do produto e o churn.

**Freelancer / Consultor (Admin Solo)**
Profissional independente que atende vários clientes e precisa separar dados por workspace. Usa o sistema para organizar sua operação e aumentar produtividade, com alta chance de começar no Free e subir para Pro.

**Agência / Parceiro de Revenda**
Perfil secundário que pode recomendar ou revender o produto para clientes. É importante para aquisição orgânica, indicações e escala comercial sem depender só de tráfego pago.

**Dono de Pequena Empresa em Crescimento**
Empresário que já vende bem, mas sente que perdeu controle da operação comercial. Busca uma solução simples, bonita e profissional que ajude a organizar equipe, rotina e previsibilidade de receita.

## 5. Stack Técnica

- Next.js
- React
- Tailwind CSS
- shadcn/ui
- Supabase
- Asaas
- Vercel
- Claude Code
- Node.js
- PostgreSQL
- TypeScript
- Resend (e-mails)

- Frontend: Next.js 14 (App Router), React 18, Tailwind CSS, shadcn/ui, TypeScript 5, @dnd-kit, Recharts.
- Backend/API: Next.js API Routes + Server Actions, Node.js runtime.
- Banco de Dados + Auth: Supabase (PostgreSQL + RLS + Auth + Storage).
- E-mail: Resend para recuperação de senha, convites, onboarding e notificações; SMTP customizado no Supabase Auth.
- Pagamento: Asaas (clientes, assinaturas, webhooks, Pix/boleto/cartão).
- Deploy: Vercel.
- Dev / IA: Cursor + Claude Code.
- Analytics: Vercel Analytics. PostHog não está instalado, não existe nada
  medindo ativação hoje.
- WhatsApp: Evolution GO em VPS própria, **desligado desde 26/08**; o destino
  é a WhatsApp Business Cloud API oficial, bloqueada por CNPJ. O link `wa.me`
  segue ativo e não depende de nenhum dos dois.
- Automação futura: n8n, Notion API, Linear API.

Selecione/adicione no formulário: Next.js, React, Tailwind CSS, shadcn/ui, Supabase, Vercel, Claude Code, Node.js, PostgreSQL, TypeScript, Resend (e-mails).

**Observação:** Stripe não entra no projeto final; use Asaas para pagamentos.

## 6. Linguagem de Design

**HubSpot CRM**
Referência para credibilidade, organização de dados e onboarding bem guiado. O valor aqui é passar sensação de sistema completo e confiável, sem copiar a complexidade excessiva do produto.

**Pipedrive**
Referência principal de experiência de pipeline. Use como benchmark para Kanban de vendas, drag-and-drop fluido, leitura rápida dos cards e foco total em fechamento de negócios.

**Linear**
Referência de acabamento premium. Minimalismo, tipografia forte, espaçamento preciso, estados bem resolvidos e sensação de software rápido, caro e moderno.

**Calendly**
Referência para estratégia de freemium e conversão. O produto entrega valor no plano grátis, mas cria limites claros que fazem o upgrade parecer natural quando o uso cresce.

**DataCrazy**
Referência brasileira para posicionamento local, linguagem simples e produto adaptado à realidade de PMEs. Ajuda a manter o CRM próximo do mercado nacional e do jeito que o usuário brasileiro entende.

### Direção visual desejada

Um CRM com aparência premium, limpa e confiante. Interface escura como padrão, contraste alto, poucos elementos por tela, cards bem definidos, movimentos sutis e foco absoluto em clareza, velocidade e decisão. Deixar opção de modo claro e modo escuro.

### Frase de posicionamento visual

"Simples como planilha, premium como software líder."

## 7. Processo

- Dividir a construção do app em milestones lógicos (etapas).
- Cada milestone deve ser um incremento entregável.
- Priorizar funcionalidade core primeiro, depois iterar.
- Testar cada milestone antes de avançar para o próximo.

### Ferramenta interna: Central do Dono (não faz parte do produto vendido)

A rota `/dono` **não é uma tela do Velo Funil**. É o painel de quem opera o
negócio: lista todas as empresas cadastradas, o dinheiro real no Asaas, os
e-mails transacionais, o anúncio, e permite corrigir assinatura, liberar Pro
de cortesia, rebaixar plano e apagar empresa.

Três consequências que decorrem disso, e que qualquer mudança nela precisa
respeitar:

1. **Só existe em localhost.** Ela lê com a service role, que ignora RLS —
   enxerga dado pessoal de todos os clientes. Fora de `NODE_ENV=development`
   **e** host local, a rota devolve 404 (`lib/dono/somente-local.ts`).
   Publicá-la seria vazamento de dado de terceiro sob a LGPD, não bug de UI.
2. **Não entra na navegação do produto** nem herda o layout do dashboard.
   Nenhum cliente deve descobrir que ela existe, e nenhum item de menu deve
   apontar para uma rota que só dá 404 em produção.
3. **Não é onde regra de negócio nasce.** Ela reusa os caminhos que já
   existem (`lib/asaas/aplicar-evento.ts` para status de assinatura, a RPC
   `pro_vigente` para saber quem paga). Reimplementar uma regra ali criaria
   uma segunda verdade que diverge da do produto na primeira mudança.

**A Central declarava R$ 490/mês quando o real era R$ 0,00 (corrigido 30/08).**
Ela calculava `(empresas com pro_vigente()) × R$ 49` — e `pro_vigente()`
responde **"pode usar o Pro?"**, que é `assinatura viva OU trial válido`. Está
correta no que faz; usá-la para medir DINHEIRO funde três coisas: quem paga,
quem está em trial e quem ganhou cortesia. A própria Central tem botão de
liberar Pro de brinde, então o brinde virava R$ 49/mês — o sistema cobrando de
si mesmo.

`lib/dono/receita.ts` separa os estados (`pagante`, `assinou_sem_pagar`,
`trial`, `cortesia`, `interna`, `sem_pro`), e `assinou_sem_pagar` é estado
próprio porque a diferença muda o que fazer: cortesia é decisão do dono,
aquilo é venda travada que dá para recuperar.

**A correção é de arquitetura, não de cálculo.** `EmpresaComEstado` é tipo
SEPARADO de `EmpresaNaCentral` — uma função que só leu o banco não consegue
mais afirmar quem paga. O tipo passou a impedir o defeito, não só a
documentá-lo. E com o Asaas fora do ar a receita fica `null` e a tela mostra
"—", nunca R$ 0,00: "não sei quem paga" é diferente de "ninguém paga".

### O sistema avisa sozinho, e alguém de fora vigia o vigia (02/09)

A Central responde tudo — e só abre em `localhost`. Isso deixava um buraco que
nenhuma tela resolve: **para saber se algo quebrou, alguém precisava lembrar de
abrir o painel.**

`/api/cron/vigia` inverte isso. Varre de hora em hora e manda e-mail quando há
algo: erro novo em produção, avaliação vencendo, relato de suporte parado,
credencial externa fora do ar, assinatura ativa sem Pro liberado, cobrança
vencida.

**Silêncio é resposta, e essa é a regra que sustenta as outras.** Quando não há
nada, não sai e-mail. Um "tudo certo" diário treina a pessoa a arquivar sem
ler, e no dia em que o assunto for grave o reflexo já está formado — é a lição
de 20/08, quando 8 dos 11 alertas da fila eram ruído.

Mas o e-mail **sai** quando uma leitura falha, mesmo sem alerta: um vigia que
não conseguiu ler o Asaas e cala passa a mensagem de que conferiu e estava tudo
bem. `null` significa **não sei**, nunca "está zerado" — a mesma distinção que
fez a Central declarar R$ 490/mês de receita com R$ 0,00 real.

**A memória (0062) é o que torna a frequência viável.** De hora em hora sem
ela, um erro que aparece de manhã geraria 24 e-mails idênticos. Vigilância
contínua não quer dizer aviso contínuo:

```
nunca avisado        MANDA   e novidade
igual ao ultimo      cala    ela ja sabe, e ja esta resolvendo
PIOROU (2 -> 30)     MANDA   mudou de tamanho, e isso e fato novo
```

**E quem vigia o vigia roda no Postgres, não na Vercel** (`vigiar_o_vigia`,
0063, agendada por `pg_cron`). Quatro falhas diferentes — o cron não disparar,
a rota lançar, o Resend recusar, um deploy quebrar a rota — produziam o mesmo
silêncio, e do lado de fora "nenhum problema" e "o vigia parou" eram
indistinguíveis.

Um segundo cron na mesma plataforma cairia junto. **Vigiar o vigia só funciona
de fora**, e o Postgres é a única infraestrutura deste projeto que já está de
pé e não depende da Vercel. Três horas de tolerância, não uma: uma falha
isolada se resolve na próxima passagem, e alertar na primeira ausência geraria
alarme falso todo deploy que caísse na hora cheia.

Isso torna falsa, a partir de 02/09, a afirmação que quatro migrations (0014,
0015, 0027, 0051) repetem: `pg_cron` **está** habilitado. As decisões daquelas
quatro continuam valendo — nenhuma migra para lá.

### O que a Meta recebia sem consentimento (02/09)

O pixel do navegador sempre respeitou o banner, com duas cercas independentes.
**A Conversions API nunca consultou nada**: a decisão vive em `localStorage`, e
o servidor não lê `localStorage`.

Quem clicava **"Recusar" e se cadastrava** tinha e-mail, telefone, nome,
cidade, estado, CEP e `external_id` enviados à Meta — hasheados, mas enviados.
Seis eventos. Sob a LGPD é tratamento sem base legal declarada, e a Política de
Privacidade descrevia outra coisa.

A correção tem duas metades porque o `Purchase` é diferente dos outros cinco:

```
cookie espelho    os cinco eventos que nascem numa requisicao do visitante
coluna 0065       o Purchase, que nasce no webhook do Asaas — onde quem faz
                  a requisicao e o gateway, e nao ha cookie nem visitante
```

`null` conta como recusa nos dois caminhos: **ausência de decisão nunca é
consentimento**, que é a regra que o pixel já aplicava.

Junto, três correções de qualidade de sinal: o `Purchase` passou a levar
`fn/ln/ct/st/zp` como os outros cinco já levavam (era o evento mais valioso
para o algoritmo e o de pior identificação), e `CompleteRegistration` ganhou
`event_id` determinístico.

## 8. Auditoria de qualidade e correção de bugs

Para garantir que o Velo Funil esteja pronto para produção, use este prompt de auditoria e correção como guia:

- Leia `CLAUDE.md`, `docs/prd.md` e `docs/plan.md`.
- Use o código atual como fonte de verdade.
- Corrija todos os bugs e inconsistências restantes no produto.

### Áreas de foco

- **Pagamentos e billing**
  - Audite `lib/asaas/*`, `app/api/webhooks/asaas/route.ts` e componentes de cobrança.
  - Verifique o uso correto de `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN` e `ASAAS_API_URL`.
  - Garanta que o webhook ative o plano Pro e mantenha o estado do Supabase consistente.
  - Remova qualquer vestígio de exemplos ou instruções incompatíveis.

- **Autenticação**
  - Complete o fluxo de recuperação de senha em `app/(auth)/esqueci-senha` e `app/(auth)/redefinir-senha`.
  - Revise a necessidade de magic link e remova referências enganosas se não estiver pronto.
  - Configure Resend como SMTP customizado para Supabase Auth e verifique convites/resets.

- **Dados e produto**
  - Verifique persistência real de Kanban, leads, deals e atividades.
  - Garanta que o dashboard de métricas use queries reais e não dados mockados.
  - Valide filtros de período, contagem de pipeline e métricas de funil.
  - Verifique workspace, membros, convites, papéis e permissões.

- **Segurança e infraestrutura**
  - Execute build local e corrija erros de compilação.
  - Confirme que as migrations do Supabase estão completas e aplicáveis em produção.
  - Garanta que rotas protegidas, RLS e políticas de permissão estejam consistentes.
  - Atualize a documentação e as variáveis de ambiente de deploy para refletir Asaas.

- **Qualidade**
  - Alinhe textos e copy ao produto real.
  - Remova comentários e links que não se aplicam.
  - Sugira testes automatizados para fluxos críticos: auth, billing, webhook, kanban, leads e dashboard.

### Entregáveis esperados

1. Lista de correções realizadas.
2. Arquivos alterados.
3. Checklist final de deploy e validação para produção.

### Checklist de deploy/validação final

Cada item marcado tem prova, não impressão — o método está em
`docs/estado-atual.md` ("Como verificar as coisas aqui"). Atualizado 02/09/2026.

- [x] **Build local concluído sem erros.** `npx tsc --noEmit`, `npm run lint`,
      `npm test` (**944 testes**) e `npm run build:check`, os quatro limpos,
      rodados antes de cada commit. É `build:check` e não `build`: os dois
      escrevem em `.next` por padrão, e o build sobrescreve o mapa de chunks
      que o `npm run dev` está usando — a rota morre com `MODULE_NOT_FOUND` e
      o erro aponta para o arquivo recém-editado, parecendo defeito dele.
- [x] **Migrations aplicadas no Supabase de produção.** 67 arquivos de
      migration (a maior é `0068`) no projeto `tmyeunithjqkbwvezyyn`
      (`sa-east-1`). Conferido contra o catálogo real em 02/09: **20 tabelas**,
      **34 RPCs do projeto** (65 no catálogo, 31 são da extensão `pg_trgm`),
      **31 foreign keys**, **15 triggers** e **8 enums**, ver
      [schema.md](schema.md).

      A tabela nova desta rodada é `notificacoes` (0066), o sino de avisos
      dentro do produto. E a 0068 corrigiu uma função que **nunca havia
      funcionado**: `purge_old_feedback` apagava anexo direto de
      `storage.objects`, o Supabase proíbe isso por trigger, e a exceção
      abortava a transação inteira — nenhum relato foi apagado desde a 0060.
      Achado exercitando a rota de cron contra produção, que devolvia
      `{"ok": false}` todo dia num corpo de resposta que ninguém abre.

      A tabela `feedback` (0060) é o canal de suporte; as outras três da 0058 à
      0061 mexeram em
      coluna e política, não em estrutura.

      **Reescrever função por dentro não aparece em lista de catálogo**, e este
      projeto já pagou isso três vezes: a 0055 reescreveu `pro_vigente()`, a
      0056 criou uma `returns trigger` que o PostgREST não expõe, e a 0057
      mudou `create_workspace_with_admin` sem mover um número sequer. Quem
      monitorasse só a contagem não teria visto nenhuma das três.
- [x] **Webhook Asaas configurado em produção e validado.** Recebe, deduplica
      e aplica. Ganhou rede de segurança depois que um Pix real ficou preso
      por webhook não entregue: `/api/cron/reconciliar-assinaturas` roda 1×/dia
      e corrige divergência sozinho.
- [x] **Plano Pro ativado corretamente após evento de pagamento.** Pix real de
      R$49 confirmado (workspace "Orne", 13/08). Fluxo auditado ponta a ponta:
      pagamento libera, retry deduplica, cancelamento rebaixa, requisição sem
      token toma 401.
- [x] **Fluxo de auth completo.** Login, cadastro, reset de senha, convites e
      Google OAuth. Convite entra na empresa de quem convidou — bug de 22/08,
      corrigido e provado.
- [x] **Dashboard de métricas com dados reais e filtros.** Queries reais, zero
      mock. 8 presets de período mais intervalo customizado.
- [x] **Permissões e workspaces validados.** RLS provada 14/14 contra produção
      com sessão autenticada real (não `service_role`): isolamento entre
      empresas segura mesmo com a interface burlada. Limite de empresas do Free
      travado no banco desde a 0018, reprovado com a RPC real.
- [x] **Documentação interna alinhada com Asaas.** Sem vestígio de Stripe nos
      caminhos de cobrança. Em 30/08 o agente `payment-integration` (genérico
      de Stripe/PayPal/Square, zero menção a Asaas) foi removido do repo, e
      confirmou-se que a skill `stripe-integration` que o `CLAUDE.md` citava
      **nunca existiu** — a menção era falsa desde que foi escrita. As citações
      a Stripe que restam são de duas naturezas legítimas: referência de
      *design* (Attio, Stripe e Linear como padrão de tipografia em
      `hero-section.tsx` e `public-navbar.tsx`) e registro histórico de por que
      a formação original pedia Stripe e foi traduzida para Asaas
      (`docs/plan.md`).
- [x] **Texto e copy do produto consistentes com a solução real.** Jargão
      banido pelo `prd-copy-sem-jargao.md` eliminado das telas (Pipeline→Funil,
      Leads→Contatos, Dashboard→Resultados), incluindo o que a renomeação de
      19/08 tinha deixado passar.
- [x] **Testes automatizados para os fluxos críticos.** 944 testes cobrindo
      lógica pura em `lib/**`; cada caso documenta o defeito que o motivou.
      Ressalva honesta: `tests/e2e/funil-completo.spec.ts` **nunca foi
      executado** (exige `.env.local` e roda contra o Asaas). Ele não falha em
      `npm test` — falha no gate de deploy.

### Auditoria de usabilidade: o produto ensina a navegar e não a ativar (01/09)

[auditoria-usabilidade.md](auditoria-usabilidade.md) percorre o produto contra
produção, com conta descartável, e mede onde a pessoa fica sem saber o que
fazer. O número que orienta o documento inteiro:

```
42 empresas   17 com contato (40%)   13 com negocio   11 com tarefa
contatos por empresa   0: 25 empresas · 1-4: 11 · 5-19: 6 · 20+: nenhuma
onboarding             43 de 49 concluem   88%
```

**25 das 42 empresas nunca criaram um contato, e 88% concluem o assistente.**
O vão não está no onboarding — está depois dele.

*Ressalva que muda a leitura e não pode ser omitida:* a maior parte dessas
contas é teste do próprio dono. Isto **não mede cliente**, porque cliente
externo não existe. Mede o caminho que o produto oferece a quem chega.

**Três correções entraram, e as três removem obstáculo entre a pessoa e o
primeiro contato salvo:**

*A primeira tela era um relatório de um negócio que ainda não começou.* O
login cai em `/dashboard`, que abria com "Exportar relatório" e dez botões de
período — os dois calculados sobre zero linha. Medido no DOM: em 375px o botão
"Adicionar primeiro contato" ficava a **984px** do topo, e a tela do telefone
tem **812px**. A única ação que importa nascia abaixo da dobra. Os dois agora
dependem de haver o que relatar, por condição **derivada** de
`lerSinaisDeAtivacao` — voltam sozinhos no primeiro contato, e não há
preferência gravada para dessincronizar.

*Fechar o checklist de ativação era definitivo.* `ocultarChecklist` aceita
`true` e `false` desde que existe, e **a única chamada era com `true`**. Nove
das 49 contas já haviam fechado o card que é o único lugar do produto que diz
o que fazer em seguida, sem ter como reabrir. É a terceira aparição da classe
aqui: `/dono/alertas` teve "silenciar" sem "reexibir", e `/dono/suporte` teve
fila de relatos internos sem porta.

*A mesma ação tinha dois nomes.* `/hoje` — primeiro item do menu — chamava de
**cliente** o que Contatos, Funil e Resultados chamam de **contato**. A
renomeação de 19/08 padronizou o produto inteiro justamente para isso não
acontecer, e essa tela escapou dela.

**O achado de marketing, não implementado por ser decisão de copy:** a dor que
a landing vende desaparece assim que a pessoa entra. As descrições de tela
explicam o que a tela **é** ("Busque, filtre e acompanhe seus contatos"), não
o que ela resolve. A promessa do WhatsApp não é renegada — ela para de ser
dita, exatamente quando a pessoa decide se vale alimentar mais uma ferramenta.
O único texto que acerta é o estado vazio de `/hoje`.

### Três defeitos que estavam no ar, achados e corrigidos em 24/08

Registrados aqui porque os três compartilham a mesma característica: **nenhum
gerava erro visível**, e todos custavam cliente em silêncio.

1. **Tela preta no site inteiro.** Uma quebra de linha no valor de
   `NEXT_PUBLIC_META_PIXEL_ID`, colado na Vercel, transformava o script inline
   do pixel em JavaScript inválido. `next/script` injeta com `appendChild`
   durante o commit do React, então a exceção subia até `app/global-error.tsx`,
   de fundo `#0a0a0a`. Atingia **quem aceitasse os cookies**, em qualquer
   lugar. Efeito colateral: o pixel nunca mediu nada. Corrigido em dois níveis
   — `lib/analytics/pixel-id.ts` higieniza e recusa o que não for dígito, e
   `isolar-analytics.tsx` põe cada rastreador atrás de uma cerca, para
   **medição quebrada custar o dado, nunca a visita**.
2. **Loop infinito no onboarding**, descrito acima. Quatro contas presas.
3. **Perda silenciosa de mensagem no WhatsApp**, descrita acima.

O que permitiu achar os três rápido foi `error_logs` estar gravando e o banco
poder ser consultado pela condição exata do defeito — não leitura de código.

**Pendências que não são de código** (dependem de painel de terceiro, ver
`docs/estado-atual.md` → "Pendente do dono"):

- [x] ~~`CRON_SECRET` nas variáveis da Vercel~~ — **esta pendência era falsa.**
      Medido na API da Vercel em 25/08: a variável existe em `production` e
      `preview`, marcada `sensitive`. Ficou aqui por meses afirmando que o cron
      tomava 401 todo dia. Pendência falsa desvia atenção das reais, e por isso
      a linha fica registrada em vez de apagada.
- [x] **CNPJ novo — SAIU.** `68.877.105/0001-67`, Sociedade Empresária
      Limitada, ATIVA desde 28/08, Simples Nacional deferido a partir de 31/08.
      **O CNAE principal é 6311-9/00** (tratamento de dados e provedor de
      aplicação), não o 6202-3/00 que esta linha previa — o que a Receita
      registrou é mais preciso para SaaS do que o que aqui se supunha.
      Preencher `cnpj`, `endereco` e `razaoSocial` em `lib/legal.ts` reacendeu
      as seis superfícies de uma vez, sem editar nenhuma delas, exatamente
      como estava previsto que aconteceria.
- [ ] **Verificação do negócio na Meta — `pending` desde 01/09**, em análise
      humana (~2 dias úteis). É o degrau que resta antes do App Review do
      WhatsApp. Nenhuma linha de código a acelera.
- [ ] CSP em modo bloqueio — hoje está em `Report-Only`; falta decidir entre
      aceitar `'unsafe-eval'` ou isolar a dependência que o exige.
- [x] **Verificação OAuth do Google — APROVADA em 24/08** para
      `calendar.events.owned` e `gmail.send`. Conferido que os escopos batem
      com `lib/integrations/google.ts` e que o `client_id` é o do projeto
      aprovado.
- [ ] Conta de anúncio: rodar campanha na conta que enxerga o pixel do site
      (`Rickdaskin Ads`), ou compartilhar o pixel com a outra.
- [ ] Sandbox do Asaas nos testes de checkout — hoje o checkout é exercitado
      contra produção, e foi isso que deixou 2 cobranças em aberto no nome de
      uma usuária real.
- [ ] Segredo do webhook do Evolution **por conexão**, em vez de um único para
      todas as empresas. Não é buraco explorável hoje (só o dono tem acesso ao
      servidor), mas limita o estrago quando houver muitos clientes.
- [ ] Proxy residencial para o WhatsApp (~R$ 18/mês). Decisão do dono em 24/08:
      fica para depois, com a sessão medida em 100%. Se a oscilação voltar, é a
      primeira coisa a tentar — e aí deixa de ser opcional.
