-- # O Max ganha um segundo provedor, e a costura já estava cortada
--
-- ## O que muda, e é só isto
--
-- `whatsapp_instances.provider` nasceu na 0090 com `check (provider = 'zapi')`,
-- e o comentário de `lib/conversas/remetente.ts` explica por que ela nasceu
-- assim em vez de não existir:
--
--     "Quando ela entrar, a escolha passa a sair de
--      whatsapp_instances.provider desta empresa, e é por isso que a coluna
--      nasceu com check (provider in ('zapi'))"
--
-- Este é o dia. O `check` abre para `'evolution'`, e nada mais na tabela muda:
-- `instance_id` guarda o `instanceName`, `token_cifrado` guarda o `hash` que o
-- `POST /instance/create` devolve, e `segredo_do_webhook` continua sendo o
-- segredo por instância.
--
-- ## Por que a Evolution entra AGORA, e por que só para o Max
--
-- A Z-API cobra R$ 99,99 por instância e exige dez contratadas para o Partner
-- (R$ 899,90/mês fixos, medido em 17/09). A Evolution roda numa VPS que já
-- existe e já está paga, e a auditoria de 18/09 mediu que **cinco clientes
-- cabem no KVM 1 de hoje sem trocar nada**.
--
-- O gate continua sendo `max_vigente()`, pela trigger que a 0090 criou. Este
-- arquivo não afrouxa nada de plano: ele acrescenta um transporte.
--
-- ## O que este arquivo NÃO resolve, e está escrito para não ser esquecido
--
-- A VPS fica em **Boston**, e a landing promete em
-- `components/landing/confianca-section.tsx`: *"Nada de cliente seu atravessa
-- fronteira para ser processado"*. A auditoria de 18/09 registra isso como um
-- dos dois bloqueios que a capacidade não resolve.
--
-- Enquanto essa frase estiver no ar, instância na Evolution só deve ser ligada
-- para empresa do PRÓPRIO dono. Não há como o banco impedir isso, então fica
-- como decisão registrada aqui e no código que cria a conexão.

alter table public.whatsapp_instances
  drop constraint if exists whatsapp_instances_provider_check;

alter table public.whatsapp_instances
  add constraint whatsapp_instances_provider_check
  check (provider in ('zapi', 'evolution'));

comment on column public.whatsapp_instances.provider is
  'Qual transporte serve esta empresa. `zapi` cobra por instancia e provisiona por API; `evolution` roda na VPS propria. Lido por escolherRemetente para decidir o Remetente, e a coluna existe desde a 0090 exatamente para este dia.';

-- ## `instance_id` passa a ser UNICO por provedor, e não globalmente
--
-- Na 0090 ele era único e ponto. Com dois provedores isso passa a estar errado
-- pelo motivo oposto ao óbvio: o `instanceName` da Evolution é escolhido por
-- nós e o `instanceId` da Z-API é gerado por ela, então uma colisão entre os
-- dois é improvável mas possível, e o índice único atual a trataria como erro
-- de duplicidade quando são dois objetos de mundos diferentes.
--
-- O que de fato precisa ser único é o par.

alter table public.whatsapp_instances
  drop constraint if exists whatsapp_instances_instance_id_key;

create unique index if not exists whatsapp_instances_provider_instancia_idx
  on public.whatsapp_instances (provider, instance_id);

-- `workspace_id` continua único: uma empresa tem UMA conexão, seja qual for o
-- transporte. Ligar duas seria duas caixas de entrada para a mesma empresa, que
-- é o defeito que a auditoria de 16/09 recusou construir.
