-- Mensagem de WhatsApp deixa de se disfarçar de anotação.
--
-- ## O que estava errado
--
-- O webhook gravava a conversa como `type = 'nota'`, com o texto prefixado por
-- "WhatsApp: ". Na timeline do contato ela aparecia com ícone de bloco de
-- notas, idêntica a um lembrete que alguém digitou à mão.
--
-- A informação de origem EXISTIA — `activities.integration_provider` guarda
-- `'whatsapp'` desde a migration 0034 — e nenhuma tela lia. O prefixo no texto
-- era a gambiarra que compensava isso, e ela mente de um jeito específico:
-- quem exporta, busca ou lê por API vê "WhatsApp: " como parte do que o
-- cliente escreveu.
--
-- ## Por que um valor no enum, e não só ler `integration_provider`
--
-- Ler o provedor resolveria o ícone, mas não o resto. `type` é o que ordena,
-- filtra e conta em todo o produto: o gráfico de atividades, o filtro da
-- timeline e qualquer relatório futuro agrupam por ele. Com a conversa
-- escondida dentro de 'nota', "quantas conversas de WhatsApp este cliente
-- teve?" é uma pergunta sem resposta.
--
-- E `integration_provider` continua servindo ao que ele serve: dizer que a
-- linha nasceu de integração, não de digitação. Um dia pode haver mensagem de
-- WhatsApp registrada à mão, e aí os dois campos discordam de propósito.
--
-- ## Sobre rodar isto
--
-- `alter type ... add value` não pode acontecer dentro de um bloco de
-- transação em Postgres anterior ao 12. Aqui é 15, onde é permitido — mas o
-- valor novo não pode ser USADO na mesma transação que o criou. Por isso esta
-- migration só acrescenta; quem grava é o código da aplicação, depois.
--
-- `if not exists` porque migration precisa poder rodar duas vezes sem
-- estourar: em ambiente novo ela roda uma vez, e em ambiente que já recebeu
-- uma aplicação parcial ela não pode ser o motivo de a esteira travar.

alter type public.activity_type add value if not exists 'whatsapp';

comment on type public.activity_type is
  'Tipo de atividade na timeline do contato. `whatsapp` entrou na 0054: antes '
  'a conversa era gravada como `nota` com o texto prefixado por "WhatsApp: ", '
  'o que fazia o prefixo virar parte do que o cliente escreveu em toda '
  'exportação e busca.';
