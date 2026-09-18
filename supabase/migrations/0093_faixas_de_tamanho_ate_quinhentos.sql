-- As faixas de tamanho de empresa passam a ir ate 500 pessoas.
--
-- ## O pedido, e o que ele corrige
--
-- O assistente de onboarding pergunta "Quantas pessoas trabalham na sua empresa
-- hoje?" e a ultima opcao era `21 ou mais`. Para quem tem 300 funcionarios, a
-- resposta possivel e a mesma de quem tem 22: a pergunta trata como iguais duas
-- empresas que nao tem nada em comum, e quem responde percebe isso.
--
-- O dono pediu faixas acima de 21 "so pra dar um respaldo melhor", e o
-- argumento e de percepcao, nao de dado: um formulario que para em 21 anuncia
-- para quem esta chegando que o produto nao foi feito para empresas maiores.
--
-- ## Por que uma migration, quando o pedido dizia para evitar
--
-- `workspaces_tamanho_equipe_valido` e um `check` de banco com os quatro
-- valores escritos dentro. Acrescentar opcao so na tela faria o `insert` ser
-- recusado com `23514` no fim do assistente, ou seja a pessoa responderia a
-- ultima pergunta e a criacao da empresa falharia.
--
-- A alteracao e a minima que existe: um `check` trocado por outro com tres
-- valores a mais. Nenhuma coluna nasce, nenhuma linha e tocada, nenhum RLS
-- muda.
--
-- ## `21_mais` FICA, e isso nao e descuido
--
-- Medido no catalogo antes de escrever esta migration: **7 workspaces ja
-- respondem `21_mais`**. Remover o valor do `check` nao apaga essas linhas, o
-- `check` so vale para escrita nova, mas deixaria o banco com um valor que ele
-- proprio recusaria hoje, e o proximo `update` de qualquer coluna daquela linha
-- passaria a falhar.
--
-- Ele sai da TELA e continua valido no banco: valor legado, sem botao. Quem
-- responder de novo cai numa das faixas novas.
alter table public.workspaces
  drop constraint if exists workspaces_tamanho_equipe_valido;

alter table public.workspaces
  add constraint workspaces_tamanho_equipe_valido
    check (
      tamanho_equipe is null
      or tamanho_equipe in (
        'so_eu',
        '2_5',
        '6_20',
        -- Legado de antes de 17/09, quando esta era a ultima faixa. Sem botao
        -- na tela; existe para as 7 linhas que ja o carregam continuarem
        -- podendo ser atualizadas.
        '21_mais',
        '21_100',
        '101_500',
        '500_mais'
      )
    );

comment on constraint workspaces_tamanho_equipe_valido on public.workspaces is
  'Faixas do assistente de onboarding. 21_mais e legado de antes de 17/09: fora da tela, aceito no banco.';
