# Trabalho autônomo — noite de 09→10/08/2026

Registro do que foi executado sem supervisão, para leitura na manhã seguinte.
Cada item traz o que mudou, por quê, e como foi verificado.

## Escopo aprovado

1. Caminho de upgrade em Configurações (receita)
2. Página `/perfil` separada de `/settings`
3. CRUD faltante: excluir negócio, editar/excluir atividade
4. Landing page profissional
5. Deploy e verificação em produção

## Não entregue — e por quê

**Integração com Google Planilhas (API).** Depende de credenciais que só o dono
da conta pode criar: projeto no Google Cloud Console, tela de consentimento
OAuth, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`, e verificação do app pelo
Google — o escopo de Sheets é sensível e a revisão leva semanas. Sem essas
credenciais, qualquer código escrito aqui ficaria morto no repositório.

A dor imediata ("trazer os contatos da planilha") já está resolvida pela
importação de CSV construída antes: no Google Sheets, `Arquivo → Baixar → CSV`
e importar na tela de Leads. A integração por API entrega *sincronização
contínua*, que é outro recurso — e com custo de manutenção próprio.

O que dá para fazer sem credencial, e foi feito: deixar o caminho do CSV
explícito na interface e na landing, já que ele existia mas não era anunciado
onde a pessoa procura.

## Execução

_(preenchido ao longo da noite)_
