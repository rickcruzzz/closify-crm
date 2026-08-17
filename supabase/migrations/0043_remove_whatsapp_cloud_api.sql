-- Remove a integração Cloud API do WhatsApp (OAuth Embedded Signup + webhook
-- de mensagem recebida). Decisão de produto: não vamos usar. O link simples
-- `wa.me` (sem token, sem OAuth) continua existindo em outro lugar do
-- código, esta migration não mexe nele.
--
-- Confirmado em produção antes de remover: zero linha em
-- `integration_connections` com provider = 'whatsapp', zero linha em
-- `whatsapp_webhook_events`, ninguém nunca conectou de fato.
--
-- O valor 'whatsapp' do enum `integration_provider` fica como está de
-- propósito: Postgres não tem `ALTER TYPE ... DROP VALUE`, recriar o enum
-- exigiria migrar as colunas `integration_connections.provider` e
-- `activities.integration_provider` pra um tipo novo, complexidade real
-- pra remover um valor que, sem nenhum código inserindo nele, é inofensivo.

drop table if exists public.whatsapp_webhook_events;
