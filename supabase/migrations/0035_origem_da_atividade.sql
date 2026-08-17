-- `type` de activities (email/reuniao/nota) também é escolha manual no
-- formulário de atividade (activity-form-dialog.tsx), contar só por `type`
-- misturaria "enviei pelo Gmail conectado" com "registrei que liguei fora do
-- sistema". Esta coluna marca só quando a linha nasceu de uma integração
-- automática; fica null pra tudo que a pessoa digitou à mão. Base pro monitor
-- de uso das integrações em Configurações → Integrações.
alter table public.activities
  add column integration_provider public.integration_provider;

comment on column public.activities.integration_provider is
  'Preenchido só quando a atividade foi criada por uma integração automática (Calendar/Gmail/WhatsApp), null para lançamento manual.';
