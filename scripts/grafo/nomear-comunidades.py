# -*- coding: utf-8 -*-
"""
Devolve nome de DOMÍNIO às comunidades do grafo, sem LLM.

## O defeito que isto conserta

O hook de `post-commit` reextrai o código a cada commit. Sempre que o conjunto
de comunidades muda, o graphify renomeia cada uma pelo "hub" dela, que é o nó
mais central. O resultado, medido em 27/08/2026 logo depois do primeiro
rebuild automático:

    Central do Dono          ->  galeria-de-criativos.tsx
    Conversas do WhatsApp    ->  conversas-client.tsx
    Sistema de componentes   ->  cn
    Onboarding e ativação    ->  leads/actions.ts

Nome de arquivo não orienta ninguém. Quem abre o `graph.html` para se situar no
projeto quer ler "Cobrança pelo Asaas", não `utils.ts`. Ou seja: a automação
mantinha o grafo FRESCO e destruía a ORGANIZAÇÃO a cada commit.

`graphify label` resolve, e exige chave de LLM. Esta rotulagem não: ela é
**determinística**, derivada da pasta dominante de cada comunidade. Custo zero,
resultado igual toda vez, e por isso pode rodar dentro de um hook.

## Como usar

    python scripts/grafo/nomear-comunidades.py

Roda sozinho depois de cada commit, pendurado no `.git/hooks/post-commit`
depois do bloco do graphify. Rodar à mão é seguro e idempotente.

Precisa do interpretador que tem o graphify instalado; ele está gravado em
`graphify-out/.graphify_python` desde a primeira execução do skill.
"""

import json
import sys
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = RAIZ / 'graphify-out'

# Pasta -> o que ela significa no produto. Só as que carregam sentido; o resto
# cai no próprio caminho, que já é melhor que o nome do hub.
DOMINIOS = {
    'lib/dono': 'Central do Dono',
    'components/dono': 'Central do Dono (telas)',
    'lib/integrations': 'Integrações e webhooks',
    'lib/conversas': 'Conversas do WhatsApp',
    'components/conversas': 'Conversas (telas)',
    'lib/deals': 'Negócios e funil',
    'components/kanban': 'Kanban',
    'lib/leads': 'Contatos',
    'components/leads': 'Contatos (telas)',
    'lib/tasks': 'Tarefas e próxima ação',
    'components/tasks': 'Tarefas (telas)',
    'lib/dashboard': 'Resultados e métricas',
    'components/dashboard': 'Resultados (telas)',
    'lib/asaas': 'Cobrança pelo Asaas',
    'lib/emails': 'E-mails transacionais',
    'lib/supabase': 'Acesso a dados e sessão',
    'lib/workspace': 'Empresas e permissões',
    'lib/onboarding': 'Onboarding e ativação',
    'lib/plans': 'Planos e limites',
    'lib/validations': 'Validação de formulário',
    'lib/analytics': 'Medição e pixel',
    'lib/auth': 'Autenticação',
    'lib/calendario': 'Calendário (lógica)',
    'lib/activities': 'Atividades e histórico',
    'components/landing': 'Landing pública',
    'components/auth': 'Entrada e autenticação',
    'components/ui': 'Sistema de componentes',
    'components/layout': 'Navegação e layout',
    'components/settings': 'Configurações',
    'components/onboarding': 'Onboarding (telas)',
    'components/calendario': 'Calendário',
    'components/comum': 'Componentes comuns',
    'components/analytics': 'Medição e pixel (telas)',
    'app/(auth)': 'Entrada e autenticação',
    'app/(dashboard)': 'Produto logado',
    'app/api': 'Rotas de API e webhooks',
    'supabase/migrations': 'Migrations do banco',
    'supabase/email-templates': 'Modelos de e-mail',
    'scripts/load-test': 'Teste de carga',
    'scripts/diagnostico': 'Scripts de diagnóstico',
    'scripts/ci': 'Esteira de build',
    'scripts/marketing': 'Scripts de marketing',
    'scripts/grafo': 'Scripts do grafo',
    'public/produto': 'Prints do produto',
    'marketing/instagram': 'Peças de Instagram',
    'marketing/marca': 'Identidade visual',
    'tests/e2e': 'Testes de ponta a ponta',
    '.claude/skills': 'Skills do Claude Code',
    '.claude/agents': 'Agentes do Claude Code',
    '.github/workflows': 'Gate de deploy',
    '.github': 'Gate de deploy',
    'marketing': 'Marketing e marca',
    'docs': 'Documentação do projeto',
    'hooks': 'Hooks de React',
    'types': 'Tipos gerados',
    'app': 'Rotas do produto',
    'lib': 'Biblioteca do produto',
    'components': 'Componentes',
    'scripts': 'Scripts',
    'public': 'Arquivos públicos',
    'supabase': 'Banco de dados',
    'tests': 'Testes',
}


def pasta_de(no):
    """A pasta de dois níveis do nó, que é o que carrega o domínio.

    Quando o segundo nível já é um ARQUIVO (`marketing/land-hero.png`), ele não
    é pasta e não descreve domínio nenhum: fica só o primeiro nível.
    """
    sf = (no.get('source_file') or '').replace(chr(92), '/')
    if not sf:
        return None
    partes = sf.split('/')
    if len(partes) == 1:
        return partes[0]
    if len(partes) == 2 and '.' in partes[1]:
        return partes[0]
    return '/'.join(partes[:2])


def nome_do_dominio(chave):
    """Nome do domínio, caindo para o nível de cima quando o específico não existe.

    Sem esta queda, uma comunidade dominada pelo arquivo "docs/prd.md" ficava
    chamada "docs/prd.md": a chave de dois níveis não está no mapa, e o nome de
    arquivo voltava a aparecer — o mesmo defeito que este script existe para
    corrigir.
    """
    if not chave:
        return 'Velo Funil'
    if chave in DOMINIOS:
        return DOMINIOS[chave]
    topo = chave.split('/')[0]
    if topo in DOMINIOS:
        return DOMINIOS[topo]
    # Arquivo solto na raiz (package.json, tsconfig.json, next.config.mjs...):
    # todos descrevem a mesma coisa, e separá-los por nome não informa nada.
    if '/' not in chave and '.' in chave:
        return 'Configuração do projeto'
    return chave


def main():
    caminho = SAIDA / 'graph.json'
    if not caminho.exists():
        print('[nomear] graphify-out/graph.json não existe, nada a fazer.')
        return 0

    grafo = json.loads(caminho.read_text(encoding='utf-8'))
    nos = grafo.get('nodes', [])
    if not nos:
        print('[nomear] grafo vazio, nada a fazer.')
        return 0

    # Agrupa por comunidade a partir do que já está gravado em cada nó.
    por_comunidade = {}
    for no in nos:
        cid = no.get('community')
        if cid is None:
            continue
        por_comunidade.setdefault(cid, []).append(no)

    if not por_comunidade:
        print('[nomear] nenhum nó traz community, nada a fazer.')
        return 0

    rotulos, trocados = {}, 0
    for cid, membros in por_comunidade.items():
        dominante = Counter(p for p in (pasta_de(m) for m in membros) if p).most_common(1)
        chave = dominante[0][0] if dominante else ''
        nome = nome_do_dominio(chave)
        rotulos[cid] = nome
        for m in membros:
            if m.get('community_name') != nome:
                m['community_name'] = nome
                trocados += 1

    caminho.write_text(json.dumps(grafo, ensure_ascii=False), encoding='utf-8')
    (SAIDA / '.graphify_labels.json').write_text(
        json.dumps({str(k): v for k, v in rotulos.items()}, ensure_ascii=False),
        encoding='utf-8',
    )

    distintos = len(set(rotulos.values()))
    print('[nomear] %d comunidades, %d nomes distintos, %d nós renomeados'
          % (len(rotulos), distintos, trocados))
    return 0


if __name__ == '__main__':
    sys.exit(main())
