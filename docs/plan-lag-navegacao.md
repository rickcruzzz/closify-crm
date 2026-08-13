# Investigação e correção definitiva do lag na navegação

> Prompt colado pelo usuário em 13/08/2026, salvo aqui como registro antes de
> qualquer investigação começar. **Ainda não investigado, nem corrigido** —
> arquivo existe só para persistir o pedido. Aguardando autorização explícita
> para iniciar a Fase 1.
>
> O texto original corta no meio da Fase 7 (terminava em "Navegar", sem
> fechar a frase) — reproduzido abaixo exatamente como recebido, sem
> completar nem adivinhar o que viria depois.

## Objetivo principal

Investigue profundamente e corrija o problema de **lag na navegação** do
Velo Funil.

### Sintoma atual

Ao clicar em itens da navegação, como:

- Leads
- Configurações
- Dashboard
- Negócios
- Tarefas
- Outras páginas

existe um atraso perceptível.

Em alguns momentos, o primeiro clique aparentemente não funciona e é
necessário clicar duas vezes.

## Regra absoluta

**NÃO remova nenhuma funcionalidade existente.**

**NÃO simplifique funcionalidades para esconder o problema.**

**NÃO altere regras de negócio sem necessidade.**

**NÃO remova autenticação, autorização, RLS, multiempresa, permissões ou
validações de segurança.**

**NÃO faça alterações especulativas sem investigar primeiro.**

**NÃO use `setTimeout`, delays artificiais ou hacks para mascarar o
problema.**

**NÃO considere o problema resolvido apenas porque visualmente parece mais
rápido.**

O objetivo é encontrar e corrigir a **causa raiz**.

---

## Fase 1 — Auditoria antes de alterar código

Antes de modificar qualquer arquivo, analise a arquitetura atual.

Investigue:

- Framework utilizado
- Sistema de roteamento
- Estrutura de layouts
- Sidebar
- Header
- Providers
- Contextos
- Estado global
- Hooks
- Middleware
- Guards de autenticação
- Guards de autorização
- Supabase
- Queries
- RLS
- Carregamento da empresa atual
- Carregamento do usuário
- Carregamento das permissões
- Carregamento do plano
- Componentes compartilhados
- Imports
- Bundle
- Lazy loading
- Code splitting
- Prefetch
- Event handlers

Não faça alterações durante essa primeira investigação, salvo se for
absolutamente necessário para diagnóstico.

---

## Fase 2 — Identificar a causa exata do duplo clique

Investigue especificamente o primeiro clique.

Determine:

1. O evento `onClick` é executado no primeiro clique?
2. O elemento recebe o clique corretamente?
3. Existe algum elemento sobreposto?
4. Existe `preventDefault()`?
5. Existe `stopPropagation()`?
6. Existe alguma condição impedindo a navegação?
7. Existe estado `loading` bloqueando o clique?
8. Existe estado `disabled`?
9. Existe debounce?
10. Existe throttle?
11. Existe operação assíncrona antes da navegação?
12. Existe verificação de autenticação antes da navegação?
13. Existe carregamento da empresa antes da navegação?
14. Existe verificação de permissões antes da navegação?
15. Existe alguma race condition?
16. Existe algum redirect intermediário?
17. Existe algum erro silencioso?
18. A URL muda no primeiro clique?
19. A rota muda mas a tela demora para renderizar?
20. A navegação acontece, mas algum componente antigo permanece renderizado?

Diferencie claramente:

> **clique não processado**

de

> **clique processado, mas navegação lenta**

Esses são problemas diferentes e devem ser tratados de maneira diferente.

---

## Fase 3 — Medir o problema

Não faça otimização baseada em suposição.

Crie uma linha de base antes da correção.

Meça, quando tecnicamente possível:

- Tempo do clique até início da navegação
- Tempo do clique até mudança da URL
- Tempo até a nova página começar a renderizar
- Tempo até conteúdo principal aparecer
- Tempo até dados aparecerem
- Quantidade de renders
- Quantidade de requests
- Requests duplicados
- Requests lentos
- Componentes responsáveis pelo maior custo de renderização

Use ferramentas apropriadas do projeto para identificar gargalos.

Se necessário, utilize:

- React Profiler
- DevTools Performance
- Network
- Console
- Lighthouse
- Métricas de bundle
- Ferramentas do framework
- Logs temporários de diagnóstico

Remova qualquer instrumentação temporária após a investigação, caso não seja
necessária.

---

## Fase 4 — Investigação do React / frontend

Verifique se a navegação está causando:

- Re-render do layout inteiro
- Re-render da sidebar
- Remount desnecessário
- Remount de Providers
- Re-render de Context Providers
- Execução repetida de hooks
- Effects executados várias vezes
- Fetches duplicados
- Inicialização repetida de componentes pesados
- Renderização de gráficos desnecessária
- Renderização de tabelas desnecessária
- Cálculos pesados
- Atualizações globais de estado

Identifique componentes que estão renderizando sem necessidade.

Não aplique `memo`, `useMemo` ou `useCallback` indiscriminadamente.

Use otimização apenas onde houver evidência de que ela resolve o gargalo.

---

## Fase 5 — Investigação das rotas

Analise profundamente o sistema de navegação.

Verifique:

- Links
- `router.push`
- `router.replace`
- `navigate`
- Route guards
- Middleware
- Redirects
- Layouts
- Nested routes
- Dynamic routes
- Loading states
- Error boundaries
- Suspense
- Prefetch
- Lazy loading
- Code splitting

Descubra se alguma rota está sendo bloqueada por operações que poderiam
ocorrer depois que a navegação começar.

Quando apropriado, priorize:

> **navegação imediata + carregamento progressivo**

em vez de:

> **esperar todos os dados antes de navegar**

Mas não altere esse comportamento se houver uma dependência de segurança que
exija a verificação antes da navegação.

---

## Fase 6 — Investigação do Supabase

Analise todas as queries executadas durante a navegação.

Procure:

- Queries duplicadas
- Queries desnecessárias
- Queries executadas globalmente
- Queries executadas em todas as rotas
- Queries executadas antes da navegação
- Queries executadas novamente depois da navegação
- Dados excessivos sendo buscados
- Falta de paginação
- Falta de índices
- Ordenações caras
- Joins desnecessários
- RLS custosa
- Fetches sequenciais que poderiam ser paralelos
- Cache inexistente quando apropriado

Para cada query relevante, determine:

- Onde é chamada
- Quando é chamada
- Por que é chamada
- Quanto tempo leva
- Se é realmente necessária naquele momento
- Se pode ser reutilizada/cacheada
- Se está sendo executada mais de uma vez

### Importante

Não desative RLS.

Não enfraqueça políticas de segurança.

Não exponha dados de outras empresas.

Não remova filtros de `company_id`, tenant ou equivalentes.

---

## Fase 7 — Autenticação e permissões

Investigue:

- Sessão
- `onAuthStateChange`
- Usuário atual
- Empresa atual
- Roles
- Permissões
- Assinatura
- Plano
- Guards
- Middleware

Verifique se cada clique está provocando novamente uma cadeia como:

```text
Clique
↓
Verificar sessão
↓
Buscar usuário
↓
Buscar empresa
↓
Buscar permissões
↓
Buscar plano
↓
Navegar
```

> **[texto original cortado aqui pelo usuário — fim do que foi colado]**
