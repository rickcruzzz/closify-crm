# Revisão de WhatsApp — 22/10/2026

Referência pública: ArnasDon/wacrm, commit `34bce1a8abf56281505d90bac165123b6ab7d51a`, licença MIT. É uma aplicação completa, não um pacote de skill: não contém SKILL.md. Nenhuma skill foi instalada a partir dela e nenhum código externo foi copiado.

Comparação read-only do agente de regras com nosso baseline `117498f`. Não é medição de latência nem certificação de ausência de bugs.

| Prioridade | Evidência local | Próxima ação delimitada |
| --- | --- | --- |
| P1 | `components/conversas/conversas-client.tsx`: relógio atualiza, mas não há assinatura realtime nem reconciliação ao recuperar foco. | Atualização por empresa autorizada, reconciliação ao reconectar e teste de mensagem recebida sem navegar. Referência: `src/components/inbox/message-thread.tsx`. |
| P1 | Mesmo componente: envio usa await sem try/finally; rejeição inesperada pode manter estado enviando. | Liberar o botão em finally e preservar texto em falha. |
| P1 | `lib/conversas/actions.ts`: updates de status enviada/falhou ignoram o erro retornado pelo banco. | Verificar persistência e reconciliar entrega externa sem reenvio cego/duplicado. Referências: `src/lib/whatsapp/message-status-sync.ts`, `src/lib/inbox/optimistic-messages.ts`. |
| P2 | Tela/composer de conversas: áudio não tem player e envio é somente texto. | Projeto separado de mídia autorizada por empresa, cópia durável e limites de upload. Referências: `message-media.tsx`, `message-composer.tsx`, `mirror-inbound-media.ts`. |
| P2 | Baseline `lib/whatsapp/foto-fila.ts`: somente fotos nunca verificadas eram elegíveis. | Correção nesta rodada de fotos: reconferência, retry justo e agendamento Netlify. Validar o resultado do provedor, sem prometer fotos restritas. |
| P3 | `lib/integrations/whatsapp-estado.ts`: integração atual Z-API; não há experiência de templates oficiais. | Migração Meta requer projeto próprio, credenciais, webhooks e regras da janela de atendimento. Referências: `src/lib/whatsapp/meta-api.ts`, `src/app/api/whatsapp/templates/`. |

Para medir demora: separar horário de recepção do webhook, persistência, atualização da tela e confirmação externa do envio. Não registrar conteúdo de conversas nem credenciais. Falta de realtime e round trips são hipóteses para demora percebida, não números medidos.
