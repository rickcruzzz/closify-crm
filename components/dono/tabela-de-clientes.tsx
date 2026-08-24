'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatarData, formatarTempoRelativo } from '@/lib/dono/formato'
import type { EmpresaNaCentral } from '@/lib/dono/tipos'
import { cn } from '@/lib/utils'

import { AcoesDaEmpresa } from './acoes-da-empresa'

type Coluna = 'nome' | 'criadoEm' | 'ultimoAcesso' | 'contatos' | 'negocios'

/**
 * A lista de todo mundo que se cadastrou.
 *
 * ## Por que busca e ordenação rodam no navegador
 *
 * A base inteira tem 26 empresas. Mandar cada tecla digitada para o servidor,
 * com debounce, estado na URL e `useTransition` — como faz a tela de contatos,
 * onde faz sentido porque um cliente pode ter milhares de linhas — aqui seria
 * pagar latência de rede para filtrar um array que já está na memória.
 *
 * Se um dia isso passar de alguns milhares de empresas, o problema muda e a
 * solução muda junto (paginação de servidor, como em `/leads`). Otimizar para
 * esse futuro agora tornaria a tela mais lenta hoje.
 *
 * ## Por que existe ordenação aqui e em nenhuma outra tela do projeto
 *
 * Porque a pergunta é diferente. Nas telas do produto a pessoa procura um
 * registro que ela sabe que existe; aqui ela procura os extremos — quem usa
 * mais, quem sumiu faz mais tempo, quem entrou por último. Isso é ordenação,
 * não busca.
 */
export function TabelaDeClientes({ empresas }: { empresas: EmpresaNaCentral[] }) {
  const [busca, setBusca] = React.useState('')
  const [coluna, setColuna] = React.useState<Coluna>('criadoEm')
  const [crescente, setCrescente] = React.useState(false)

  const visiveis = React.useMemo(() => {
    const termo = busca.trim().toLowerCase()

    const filtradas = termo
      ? empresas.filter((e) =>
          [e.nome, e.dono, e.email].some((campo) => campo?.toLowerCase().includes(termo)),
        )
      : empresas

    const valorDe = (empresa: EmpresaNaCentral): string | number => {
      switch (coluna) {
        case 'nome':
          return empresa.nome.toLowerCase()
        case 'criadoEm':
          return new Date(empresa.criadoEm).getTime()
        case 'ultimoAcesso':
          // Quem nunca acessou vai para o fundo em ordem decrescente, em vez
          // de virar `NaN` e embaralhar a lista inteira em silêncio.
          return empresa.ultimoAcesso ? new Date(empresa.ultimoAcesso).getTime() : 0
        case 'contatos':
          return empresa.quantidadeDeContatos
        case 'negocios':
          return empresa.quantidadeDeNegocios
      }
    }

    return [...filtradas].sort((a, b) => {
      const va = valorDe(a)
      const vb = valorDe(b)
      if (va === vb) return 0
      const ordem = va > vb ? 1 : -1
      return crescente ? ordem : -ordem
    })
  }, [empresas, busca, coluna, crescente])

  function ordenarPor(nova: Coluna) {
    if (nova === coluna) {
      setCrescente((antes) => !antes)
    } else {
      setColuna(nova)
      // Toda coluna nova começa decrescente porque a pergunta padrão é sempre
      // "quem tem mais" ou "quem é mais recente", nunca o contrário.
      setCrescente(false)
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">
          Todo mundo que se cadastrou{' '}
          <span className="text-muted-foreground font-normal">({empresas.length})</span>
        </h2>

        <div className="relative sm:w-72">
          <Search
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por empresa, nome ou e-mail"
            className="pl-9"
            aria-label="Buscar"
          />
        </div>
      </div>

      {visiveis.length === 0 ? (
        <p className="text-muted-foreground ring-foreground/10 rounded-xl p-8 text-center text-sm ring-1">
          Nenhuma empresa bate com &quot;{busca}&quot;.
        </p>
      ) : (
        <>
          {/* Celular: cartões. Uma tabela de 9 colunas em 390px ou rola de
              lado (e some informação) ou espreme a ponto de não se ler. */}
          <ul className="ring-foreground/10 flex flex-col divide-y divide-white/5 overflow-hidden rounded-xl ring-1 lg:hidden">
            {visiveis.map((empresa) => (
              <li key={empresa.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{empresa.nome}</span>
                    <SeloDePlano empresa={empresa} />
                  </div>
                  <span className="text-muted-foreground truncate text-sm">
                    {empresa.dono ?? 'sem nome'}
                  </span>
                  {empresa.email && (
                    <a
                      href={`mailto:${empresa.email}`}
                      className="text-muted-foreground truncate text-sm underline underline-offset-4"
                    >
                      {empresa.email}
                    </a>
                  )}
                  <span className="text-muted-foreground text-xs">
                    {empresa.quantidadeDeContatos} contato(s) ·{' '}
                    {empresa.quantidadeDeNegocios} negócio(s) · entrou{' '}
                    {formatarTempoRelativo(empresa.criadoEm)}
                  </span>
                </div>
                <AcoesDaEmpresa empresa={empresa} />
              </li>
            ))}
          </ul>

          <div className="ring-foreground/10 hidden overflow-hidden rounded-xl ring-1 lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <CabecalhoOrdenavel
                    rotulo="Empresa"
                    coluna="nome"
                    atual={coluna}
                    crescente={crescente}
                    aoClicar={ordenarPor}
                  />
                  <TableHead>Dono</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Plano</TableHead>
                  <CabecalhoOrdenavel
                    rotulo="Entrou"
                    coluna="criadoEm"
                    atual={coluna}
                    crescente={crescente}
                    aoClicar={ordenarPor}
                  />
                  <CabecalhoOrdenavel
                    rotulo="Último acesso"
                    coluna="ultimoAcesso"
                    atual={coluna}
                    crescente={crescente}
                    aoClicar={ordenarPor}
                  />
                  <CabecalhoOrdenavel
                    rotulo="Contatos"
                    coluna="contatos"
                    atual={coluna}
                    crescente={crescente}
                    aoClicar={ordenarPor}
                    alinharADireita
                  />
                  <CabecalhoOrdenavel
                    rotulo="Negócios"
                    coluna="negocios"
                    atual={coluna}
                    crescente={crescente}
                    aoClicar={ordenarPor}
                    alinharADireita
                  />
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((empresa) => (
                  <TableRow key={empresa.id}>
                    <TableCell className="font-medium">{empresa.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {empresa.dono ?? '-'}
                    </TableCell>
                    <TableCell>
                      {empresa.email ? (
                        <a
                          href={`mailto:${empresa.email}`}
                          className="text-muted-foreground underline underline-offset-4"
                        >
                          {empresa.email}
                        </a>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <SeloDePlano empresa={empresa} />
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      title={formatarData(empresa.criadoEm)}
                    >
                      {formatarTempoRelativo(empresa.criadoEm)}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground"
                      title={formatarData(empresa.ultimoAcesso)}
                    >
                      {formatarTempoRelativo(empresa.ultimoAcesso)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {empresa.quantidadeDeContatos}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {empresa.quantidadeDeNegocios}
                    </TableCell>
                    <TableCell>
                      <AcoesDaEmpresa empresa={empresa} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * O plano em uma palavra.
 *
 * Note que "Pagando" sai de `pagando`, que vem da RPC `pro_vigente`, e não de
 * `statusAssinatura`. Os dois podem discordar — e quando discordam, a verdade
 * é a função: a coluna é o último valor gravado e não sabe que o tempo passou.
 */
function SeloDePlano({ empresa }: { empresa: EmpresaNaCentral }) {
  if (empresa.pagando) {
    return (
      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">Pagando</Badge>
    )
  }

  if (empresa.statusAssinatura === 'past_due') {
    return <Badge className="border-red-500/30 bg-red-500/10 text-red-500">Atrasado</Badge>
  }

  return <Badge variant="outline">Grátis</Badge>
}

function CabecalhoOrdenavel({
  rotulo,
  coluna,
  atual,
  crescente,
  aoClicar,
  alinharADireita,
}: {
  rotulo: string
  coluna: Coluna
  atual: Coluna
  crescente: boolean
  aoClicar: (coluna: Coluna) => void
  alinharADireita?: boolean
}) {
  const ativa = coluna === atual
  const Seta = crescente ? ArrowUp : ArrowDown

  return (
    <TableHead className={cn(alinharADireita && 'text-right')}>
      <button
        type="button"
        onClick={() => aoClicar(coluna)}
        className={cn(
          'hover:text-foreground inline-flex cursor-pointer items-center gap-1 transition-colors',
          ativa && 'text-foreground font-medium',
          alinharADireita && 'flex-row-reverse',
        )}
      >
        {rotulo}
        {/* A seta só aparece na coluna ativa: uma seta em cada cabeçalho vira
            ruído e não diz mais nada sobre qual ordenação está valendo. */}
        {ativa && <Seta aria-hidden className="size-3" />}
      </button>
    </TableHead>
  )
}
