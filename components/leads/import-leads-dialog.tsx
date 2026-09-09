'use client'

import * as React from 'react'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CSV_MAX_BYTES, CSV_MAX_LINHAS, decodificarPlanilha, lerCsv } from '@/lib/leads/csv'
import {
  CAMPOS,
  amostraDaColuna,
  interpretarPlanilha,
  sugerirMapeamento,
  temFormaDeEmail,
  temFormaDeTelefone,
  type CampoDestino,
  type Mapeamento,
} from '@/lib/leads/planilha'
import { importarPlanilha, type ResultadoImportacao } from '@/lib/leads/actions'
import { FREE_LEAD_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'

// Valor entre aspas de propósito: o separador do modelo é vírgula e o decimal
// brasileiro também, sem aspas, "2500,00" viraria duas colunas.
const MODELO =
  'Nome,Telefone,E-mail,Empresa,Valor,Etapa\n' +
  'Maria Silva,(11) 90000-0000,maria@empresa.com.br,Acme Serviços,"2500,00",Proposta enviada\n' +
  'João Souza,(21) 98888-7777,,Souza Consultoria,"800,00",Novo\n'

const NAO_IMPORTAR = '__nenhuma__'

type Passo = 'arquivo' | 'colunas' | 'resultado'

export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
  vagasNoPlano,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
  /**
   * Quantos contatos ainda cabem no plano. `null` = sem teto (Pro ou trial).
   *
   * Vem do servidor por `remainingLeadSlots`, a MESMA função que a Server
   * Action consulta antes de inserir — não uma segunda contagem, que
   * divergiria da primeira no dia em que uma mudasse.
   */
  vagasNoPlano: number | null
}) {
  const [passo, setPasso] = React.useState<Passo>('arquivo')
  const [nomeDoArquivo, setNomeDoArquivo] = React.useState('')
  const [matriz, setMatriz] = React.useState<string[][]>([])
  const [mapeamento, setMapeamento] = React.useState<Mapeamento>({})
  const [duplicados, setDuplicados] = React.useState<'ignorar' | 'atualizar'>('ignorar')
  const [lendo, setLendo] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [resultado, setResultado] = React.useState<ResultadoImportacao | null>(null)
  // Quantas linhas do topo do arquivo NÃO são dado nem cabeçalho, planilha
  // de ERP costuma ter linha de título, linha em branco, ou logo antes da
  // linha real de colunas. 0 é o caso comum (cabeçalho já na linha 1).
  const [pularLinhas, setPularLinhas] = React.useState(0)
  /**
   * A pessoa pediu para mexer nas colunas à mão.
   *
   * Fechado, o passo mostra só o que foi entendido, em texto. Aberto, mostra
   * os seletores e o ajuste de linha de cabeçalho. Quem tem planilha comum
   * nunca precisa abrir: `sugerirMapeamento` acerta os campos sozinho, e
   * seletor já preenchido parece decisão pendente quando na verdade é
   * trabalho pronto.
   */
  const [ajustando, setAjustando] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setPasso('arquivo')
      setNomeDoArquivo('')
      setMatriz([])
      setMapeamento({})
      setDuplicados('ignorar')
      setResultado(null)
      setPularLinhas(0)
      setAjustando(false)
    }
  }, [open])

  function baixarModelo() {
    // BOM na frente para o Excel abrir o arquivo já em UTF-8; sem ele, o
    // próprio modelo que entregamos apareceria com acento quebrado.
    const url = URL.createObjectURL(
      new Blob(['﻿' + MODELO], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'modelo-velo-funil.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function escolherArquivo(arquivo: File) {
    if (arquivo.size > CSV_MAX_BYTES) {
      toast.error('Arquivo grande demais. O limite é 512 KB por importação.')
      return
    }

    // ## O `.xls` antigo, e por que ele merece mensagem própria
    //
    // Excel 97-2003 é OLE2, um formato binário sem nenhuma relação com o
    // `.xlsx` (que é ZIP com XML dentro). `read-excel-file` não lê OLE2, e
    // acrescentar um parser dele seria uma dependência inteira por um formato
    // que a Microsoft aposentou em 2007.
    //
    // Ele JÁ era recusado — medido em 08/09: os bytes caem no caminho do CSV,
    // `lerCsv` devolve uma linha só de lixo binário, e o `lida.length < 2`
    // abaixo barra. **O problema era a mensagem**: a pessoa escolhia a planilha
    // certa e lia "a planilha não tem nenhuma linha além do cabeçalho", que
    // manda ela conferir o conteúdo em vez de salvar de novo no formato certo.
    //
    // `.xls` e não `.xlsx` no teste: o `$` do primeiro depois do `xlsx` já ter
    // sido descartado seria frágil, então a ordem importa — este `if` roda
    // antes, e só casa quando NÃO termina em `xlsx`.
    if (/\.xls$/i.test(arquivo.name)) {
      toast.error(
        'Este é um arquivo do Excel antigo (.xls). Abra no Excel e use "Salvar como" → "Pasta de Trabalho do Excel (.xlsx)".',
      )
      return
    }

    setLendo(true)
    try {
      const bytes = await arquivo.arrayBuffer()
      const ehExcel = /\.xlsx$/i.test(arquivo.name)

      let lida: string[][]
      if (ehExcel) {
        // Carregado sob demanda: `.xlsx` é um ZIP com XML dentro e a biblioteca
        // que lê isso pesa ~1 MB. Quem importa CSV, ou nem importa, não paga
        // por ela no bundle.
        //
        // `/browser` e não a raiz: o pacote não expõe export raiz, e a versão
        // de Node puxaria dependência de sistema de arquivos para dentro do
        // bundle do cliente.
        //
        // Escolhido em vez de `xlsx` (SheetJS) e `exceljs`: o primeiro está
        // parado em 0.18.5 no npm com duas falhas de segurança altas cuja
        // correção nunca foi publicada lá; o segundo está sem release há anos.
        const { readSheet } = await import('read-excel-file/browser')
        // `readSheet` e não o export padrão: na versão 9 o padrão devolve
        // TODAS as abas da pasta de trabalho. Importar sempre a primeira é
        // previsível, a pessoa sabe qual aba deixou na frente.
        const linhas = await readSheet(new Blob([bytes]), 1)
        lida = linhas.map((linha) =>
          linha.map((celula) => (celula === null || celula === undefined ? '' : String(celula))),
        )
      } else {
        lida = lerCsv(decodificarPlanilha(bytes))
      }

      if (lida.length < 2) {
        toast.error('A planilha não tem nenhuma linha além do cabeçalho.')
        return
      }

      setNomeDoArquivo(arquivo.name)
      setMatriz(lida)
      setPularLinhas(0)
      setMapeamento(sugerirMapeamento(lida[0] ?? []))
      setPasso('colunas')
    } catch (err) {
      console.error('falha ao ler a planilha', err)
      toast.error('Não foi possível ler o arquivo. Confira se é um .xlsx ou .csv válido.')
    } finally {
      setLendo(false)
    }
  }

  function trocarColuna(campo: CampoDestino, valor: string) {
    setMapeamento((atual) => {
      const proximo = { ...atual }
      if (valor === NAO_IMPORTAR) {
        delete proximo[campo]
        return proximo
      }
      const indice = Number(valor)
      // Uma coluna da planilha só pode alimentar um campo: sem isso, escolher
      // "Empresa" numa coluna já usada como "Nome" gravaria o mesmo texto nos
      // dois lugares, e a pessoa só descobriria depois de importar.
      for (const chave of Object.keys(proximo) as CampoDestino[]) {
        if (proximo[chave] === indice) delete proximo[chave]
      }
      proximo[campo] = indice
      return proximo
    })
  }

  // A matriz "de verdade" começa depois das linhas puladas, linha de
  // título, linha em branco, o que a planilha de ERP tiver antes do
  // cabeçalho real. Tudo daqui pra baixo (prévia, envio) usa ESTA matriz, não
  // a crua: é o que faz "pular N linhas" corrigir a importação inteira sem
  // o servidor precisar saber que isso existe.
  const matrizEfetiva = React.useMemo(
    // ## O corte em `CSV_MAX_LINHAS` acontece AQUI, e nao so na previa
    //
    // A previa truncava e avisava "so as primeiras 1000 foram lidas"; o envio
    // mandava a matriz inteira; e o Zod recusava TUDO com "A planilha passa de
    // 1000 linhas". Uma planilha de 1500 mostrava "1000 linhas prontas", a
    // pessoa clicava Importar e nada entrava.
    //
    // A tela e o servidor discordavam sobre a mesma regra, e quem pagava era
    // quem confiou na tela. Cortando na origem, as duas passam a ver a mesma
    // matriz — e o aviso deixa de ser uma promessa que o servidor desmente.
    //
    // `+ 1` porque a primeira linha e o cabecalho: o limite conta LINHAS DE
    // DADO, e sem isso uma planilha de exatamente 1000 registros perderia a
    // ultima.
    () => matriz.slice(pularLinhas, pularLinhas + CSV_MAX_LINHAS + 1),
    [matriz, pularLinhas],
  )

  // O aviso de truncamento nao mora aqui: `interpretarPlanilha` ja o produz
  // em `previa.erros`, com o numero real de linhas do arquivo, e a tela ja
  // renderiza essa lista. Uma segunda contagem aqui seria a mesma regra em
  // dois lugares, divergindo na primeira mudanca.
  const cabecalho = React.useMemo(() => matrizEfetiva[0] ?? [], [matrizEfetiva])
  const corpo = React.useMemo(() => matrizEfetiva.slice(1), [matrizEfetiva])

  // Recalculada sempre que a linha de cabeçalho muda, não é a `mapeamento`
  // que o usuário pode ter ajustado à mão, só serve pra saber se a linha
  // ATUAL tem cara de cabeçalho reconhecível. Se não tiver nenhum campo
  // aqui, é sinal forte de que a linha de cabeçalho real é outra.
  const nadaReconhecido = React.useMemo(
    () => matriz.length > 0 && Object.keys(sugerirMapeamento(cabecalho)).length === 0,
    [matriz, cabecalho],
  )

  /**
   * O reconhecimento automático deu conta sozinho?
   *
   * O mínimo que a importação exige é nome mais uma forma de falar com a
   * pessoa, a mesma regra que `interpretarPlanilha` aplica ao recusar linha
   * ("sem e-mail nem telefone, não há como contatar") e que a migration 0025
   * já tinha fixado no banco. Empresa, valor e etapa são desejáveis, não
   * obrigatórios: planilha que não traz nenhum dos três ainda importa bem.
   *
   * Quando isto é verdade, a tela confirma em texto em vez de pedir para
   * preencher seis seletores. Quando é falso, os seletores abrem sozinhos,
   * porque aí a decisão é de fato necessária.
   */
  const reconheceuOEssencial =
    mapeamento.name !== undefined &&
    (mapeamento.email !== undefined || mapeamento.phone !== undefined)

  const mostrarSeletores = ajustando || !reconheceuOEssencial

  /**
   * A planilha tem alguma coluna que PARECE contato?
   *
   * ## O caso que motivou (09/09)
   *
   * Um cliente importou uma tabela de preços de tinta — `Produto` e
   * `Preços / Observações`, 108 linhas — e o produto deixou. O reconhecimento
   * automático sugeriu `{"value": 1}`, os seletores abriram, e ele mapeou
   * Produto→Nome e Preços→E-mail à mão. As 108 tintas viraram contatos.
   *
   * As validações de formato (`temFormaDeEmail`, `temFormaDeTelefone`) agora
   * recusam linha a linha, e isso é a rede embaixo. **Esta checagem é a que
   * teria evitado o mapeamento errado**, porque acontece antes: uma planilha
   * sem nenhuma coluna com cara de e-mail ou telefone quase nunca é lista de
   * contatos.
   *
   * Olha o CONTEÚDO e não só o título. Cabeçalho pode estar em qualquer
   * idioma ou não existir; o que não muda é que e-mail tem arroba e telefone
   * tem DDD. Bastam duas células em dez para a coluna contar — planilha de
   * verdade tem buraco, e exigir a coluna inteira preenchida barraria arquivo
   * bom.
   */
  const semColunaDeContato = React.useMemo(() => {
    if (corpo.length === 0) return false
    const amostra = corpo.slice(0, 10)
    const temAlguma = cabecalho.some((_, coluna) => {
      const valores = amostra.map((linha) => (linha[coluna] ?? '').trim()).filter(Boolean)
      const bons = valores.filter((v) => temFormaDeEmail(v) || temFormaDeTelefone(v)).length
      return bons >= Math.min(2, valores.length) && bons > 0
    })
    return !temAlguma
  }, [corpo, cabecalho])

  function ajustarPularLinhas(novo: number) {
    const limitado = Math.max(0, Math.min(novo, Math.max(0, matriz.length - 2)))
    setPularLinhas(limitado)
    // A pessoa não deveria precisar remapear tudo de novo só porque a linha
    // de cabeçalho mudou, se a nova linha tiver título reconhecível, o
    // mapeamento automático já resolve.
    setMapeamento(sugerirMapeamento(matriz.slice(limitado)[0] ?? []))
  }

  /**
   * As colunas que a planilha tem e que NÃO vão entrar.
   *
   * ## Por que avisar em vez de construir o recurso
   *
   * O HubSpot exporta `First Name` e `Last Name` separados. O reconhecimento
   * pega o primeiro e descarta o segundo — "Maria Silva" entra como "Maria".
   * Juntar duas colunas num campo é meio dia de trabalho; **dizer que o
   * sobrenome vai ficar de fora custa uma linha e resolve o problema de quem
   * está importando**, que é não descobrir depois.
   *
   * Generalizado de propósito: em vez de tratar sobrenome como caso especial,
   * lista TODA coluna sem destino. Serve para `Lead Source`, `Última
   * interação`, `CNPJ` e qualquer outra que a pessoa esperava ver do lado de
   * cá — e não exige adivinhar quais delas doem.
   *
   * Só conta coluna com CONTEÚDO: cabeçalho vazio no fim da planilha é comum e
   * avisar sobre ele seria ruído.
   */
  const colunasIgnoradas = React.useMemo(() => {
    const usadas = new Set(Object.values(mapeamento))
    return cabecalho
      .map((titulo, i) => ({ titulo: titulo.trim(), i }))
      .filter(({ titulo, i }) => {
        if (!titulo || usadas.has(i)) return false
        return corpo.slice(0, 20).some((linha) => (linha[i] ?? '').trim() !== '')
      })
      .map(({ titulo }) => titulo)
  }, [cabecalho, corpo, mapeamento])

  // A mesma função que o servidor roda, só que aqui para mostrar a prévia. O
  // servidor NÃO confia nisto, ele reinterpreta a matriz do zero.
  const previa = React.useMemo(
    () => interpretarPlanilha(matrizEfetiva, mapeamento, CSV_MAX_LINHAS),
    [matrizEfetiva, mapeamento],
  )

  async function enviar() {
    setEnviando(true)
    try {
      const retorno = await importarPlanilha({ matriz: matrizEfetiva, mapeamento, duplicados })
      if ('error' in retorno) {
        toast.error(retorno.error)
        return
      }
      setResultado(retorno)
      setPasso('resultado')
      onImported()
    } catch {
      toast.error('Não foi possível importar. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {passo === 'arquivo' && 'Importar de planilha'}
            {passo === 'colunas' && 'Conferir as colunas'}
            {passo === 'resultado' && 'Importação concluída'}
          </DialogTitle>
          <DialogDescription>
            {/* Diz de antemão que as colunas são reconhecidas sozinhas, para a
                pessoa chegar no passo seguinte esperando CONFERIR, não
                preencher. Sem isso, encontrar uma tela cheia de campos depois
                de subir o arquivo parece que o trabalho só começou. */}
            {passo === 'arquivo' &&
              'Arquivo do Excel (.xlsx) ou .csv. As colunas são reconhecidas sozinhas, você só confere. Cada linha vira um contato e um negócio no funil.'}
            {passo === 'colunas' &&
              `${nomeDoArquivo} · ${matriz.length - 1} linha(s). Confira antes de importar.`}
            {passo === 'resultado' && 'O que entrou e o que precisa da sua atenção.'}
          </DialogDescription>
        </DialogHeader>

        {passo === 'arquivo' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="arquivo-planilha">Arquivo</Label>
              <Input
                id="arquivo-planilha"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={lendo}
                onChange={(e) => {
                  const arquivo = e.target.files?.[0]
                  if (arquivo) void escolherArquivo(arquivo)
                }}
              />
              <p className="text-muted-foreground text-xs">
                Até {CSV_MAX_LINHAS.toLocaleString('pt-BR')} linhas e 512 KB. Contatos repetidos ou
                já cadastrados são ignorados.
              </p>
            </div>

            {lendo && (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Lendo a planilha…
              </p>
            )}

            <DialogFooter className="sm:justify-start">
              <Button type="button" variant="ghost" onClick={baixarModelo}>
                <FileSpreadsheet className="size-4" />
                Baixar modelo
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* `min-w-0` no passo inteiro: o DialogContent é um `grid` de coluna
            `auto`, e coluna `auto` cresce até caber o filho mais largo, aqui a
            tabela de amostra do arquivo. O resultado, medido em 375px, é o
            diálogo ficar corretamente com 343px enquanto os filhos ocupam 483
            e vazam para fora dele, cortando os selects e o botão de importar.
            Defeito que já existia antes desta rodada. Com o mínimo em zero a
            coluna encolhe e o `overflow-x-auto` da tabela volta a fazer o que
            promete: rolar só ela, não a caixa inteira. */}
        {passo === 'colunas' && (
          <div className="flex min-w-0 flex-col gap-4">
            {/* A tabela de amostra e o ajuste da linha de cabeçalho só
                interessam a quem está corrigindo alguma coisa. Para quem tem
                planilha comum eram duas caixas de conteúdo técnico logo na
                abertura, antes de qualquer coisa útil. */}
            {mostrarSeletores && (
            <div className="border-border min-w-0 rounded-lg border p-3">
              <p className="mb-2 text-xs font-medium">Primeiras linhas do arquivo</p>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <tbody>
                    {/* Mostra ATÉ a linha escolhida, nunca menos que três: com
                        `slice(0, 3)` fixo, quem apontava a linha 4 como a dos
                        títulos escolhia às cegas, porque o destaque caía fora
                        da janela visível e a tabela parecia não reagir. */}
                    {matriz.slice(0, Math.max(3, pularLinhas + 2)).map((linha, i) => (
                      <tr key={i}>
                        <td
                          className={cn(
                            'text-muted-foreground pr-2 align-top tabular-nums',
                            i === pularLinhas && 'text-primary font-medium',
                          )}
                        >
                          {i + 1}
                        </td>
                        {linha.slice(0, 6).map((celula, j) => (
                          <td
                            key={j}
                            className={cn(
                              'text-muted-foreground max-w-28 truncate pr-3 align-top',
                              i === pularLinhas && 'text-foreground font-medium',
                            )}
                          >
                            {celula || '-'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* A frase antiga ("A linha em destaque é o cabeçalho? Se não,
                  pule N linha(s) antes dele") falava de "cabeçalho" e pedia um
                  número sem dizer para quê. Agora diz o que a linha destacada
                  significa e o que fazer se estiver errada.

                  O número continua sendo o da TABELA ao lado, não o do Excel:
                  `lerCsv` descarta linha totalmente vazia
                  (`lib/leads/csv.ts`), então uma planilha com linha em branco
                  no meio já tem numeração diferente da do Excel, e prometer
                  "número da linha do Excel" seria mentira em quem mais precisa
                  desse campo. Os botões evitam que a pessoa precise raciocinar
                  sobre índice. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Label htmlFor="pular-linhas" className="text-xs">
                  A linha destacada acima é a dos títulos das colunas. Se não for, mude
                  aqui:
                </Label>
                <Input
                  id="pular-linhas"
                  type="number"
                  min={1}
                  max={Math.max(1, matriz.length - 1)}
                  // Campo em base 1 para casar com a coluna de números da
                  // tabela ao lado; o estado por trás continua em base 0.
                  value={pularLinhas + 1}
                  className="h-8 w-16"
                  onChange={(e) => ajustarPularLinhas((Number(e.target.value) || 1) - 1)}
                />
              </div>

              {colunasIgnoradas.length > 0 && !semColunaDeContato && (
                <p className="text-muted-foreground mt-2 flex items-start gap-1.5 text-xs">
                  <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Estas colunas não vão ser importadas:{' '}
                    <strong>{colunasIgnoradas.join(', ')}</strong>. O Velo Funil guarda nome,
                    e-mail, telefone, empresa, valor e etapa. Se alguma delas era importante,
                    junte na coluna certa antes de importar.
                  </span>
                </p>
              )}
              {semColunaDeContato && (
                <p className="border-destructive/40 bg-destructive/10 text-destructive mt-2 flex items-start gap-1.5 rounded-md border p-2 text-xs">
                  <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    <strong>Não achei coluna de e-mail nem de telefone nesta planilha.</strong>{' '}
                    Sem uma das duas não há como falar com o contato, e a importação vai recusar as
                    linhas. Se este arquivo for uma tabela de produtos ou de preços, ele não é uma
                    lista de contatos — escolha outro.
                  </span>
                </p>
              )}
              {nadaReconhecido && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  Nenhum título conhecido (Nome, Telefone, E-mail…) foi encontrado na linha
                  destacada. Se a sua planilha tem título ou linha em branco no começo, mude o
                  número acima até a linha dos títulos ficar destacada.
                </p>
              )}
            </div>
            )}

            {/* O caso comum: o reconhecimento automático deu conta, então a
                tela CONFIRMA o que entendeu em vez de pedir que a pessoa
                preencha. Seletor já preenchido parece decisão pendente; uma
                lista curta com o exemplo de cada coluna parece trabalho
                pronto, que é o que ele é.

                O exemplo ao lado (`amostraDaColuna`, a mesma função que já
                alimentava a dica dos seletores) é o que transforma "confie em
                mim" em "confira você mesmo": se o Telefone tivesse casado com
                a coluna errada, o "(71) 99999-1001" não estaria ali. */}
            {!mostrarSeletores && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Entendemos sua planilha assim:</p>
                <ul className="flex flex-col gap-1.5">
                  {CAMPOS.filter(({ campo }) => mapeamento[campo] !== undefined).map(
                    ({ campo, rotulo }) => {
                      const indice = mapeamento[campo]!
                      const amostra = amostraDaColuna(corpo, indice)
                      return (
                        <li
                          key={campo}
                          className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 text-sm"
                        >
                          <span className="text-muted-foreground">{rotulo}</span>
                          <span className="min-w-0">
                            <span className="font-medium">
                              {cabecalho[indice] || `Coluna ${indice + 1}`}
                            </span>
                            {amostra && (
                              <span className="text-muted-foreground"> · ex: {amostra}</span>
                            )}
                          </span>
                        </li>
                      )
                    },
                  )}
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit px-0 hover:bg-transparent hover:underline"
                  onClick={() => setAjustando(true)}
                >
                  Está errado? Ajustar colunas
                </Button>
              </div>
            )}

            {/* Os SETE controles do diálogo (os seis mapeamentos e o de
                duplicados, logo abaixo) compartilham esta mesma grade, e é ela
                que faz todos começarem na mesma coordenada.

                Antes o de duplicados era `flex flex-col` dentro de uma caixa
                com borda: rótulo em cima e select colado na borda, enquanto os
                seis de cima tinham o select recuado. Dois desenhos para o mesmo
                tipo de controle, e o degrau entre eles era o que saltava aos
                olhos.

                `5.5rem` cabe "Telefone", o rótulo mais largo, sem o vão de
                ~50px que o `7rem` anterior deixava sobrando.

                `minmax(0,1fr)` e não `1fr`: `1fr` é atalho para
                `minmax(auto,1fr)`, e `auto` recusa encolher abaixo do
                conteúdo. Como o SelectTrigger herda `whitespace-nowrap`, a
                opção mais longa ("Atualizar com os dados da planilha") esticava
                a coluna e o diálogo inteiro vazava da tela no celular: medido,
                493px de select numa viewport de 375px, defeito que já existia
                antes desta mudança. Com o mínimo em zero a coluna encolhe e o
                texto trunca dentro dela. */}
            <div className="flex flex-col gap-3">
              {mostrarSeletores &&
                CAMPOS.map(({ campo, rotulo }) => {
                const indiceSelecionado = mapeamento[campo]
                const amostra =
                  indiceSelecionado !== undefined
                    ? amostraDaColuna(corpo, indiceSelecionado)
                    : null

                return (
                  <div
                    key={campo}
                    className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1"
                  >
                    {/* `items-center` na grade em vez de `pt-2` no rótulo: o
                        padding era número mágico para fingir alinhamento com o
                        select e errava por uns 2px. A dica "ex:" saiu da coluna
                        do select e virou uma segunda linha da grade, então ela
                        não empurra mais o rótulo para fora do centro. */}
                    <Label htmlFor={`col-${campo}`} className="text-sm">
                      {rotulo}
                    </Label>
                    <div className="flex min-w-0 flex-col gap-1">
                      <Select
                        value={String(mapeamento[campo] ?? NAO_IMPORTAR)}
                        onValueChange={(valor) => trocarColuna(campo, String(valor))}
                      >
                        <SelectTrigger id={`col-${campo}`} className="w-full">
                          <SelectValue>
                            {(valor) =>
                              valor === NAO_IMPORTAR
                                ? 'Não importar'
                                : (cabecalho[Number(valor)] || `Coluna ${Number(valor) + 1}`)
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NAO_IMPORTAR}>Não importar</SelectItem>
                          {cabecalho.map((titulo, indice) => (
                            <SelectItem key={indice} value={String(indice)}>
                              {titulo || `Coluna ${indice + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Amostra do dado real por trás da coluna escolhida, é o
                          que transforma "escolher por número e torcer" em
                          "escolher e confirmar visualmente" antes de importar. */}
                      {indiceSelecionado !== undefined && (
                        <span className="text-muted-foreground truncate text-xs">
                          {amostra ? `ex: ${amostra}` : 'coluna vazia nas linhas de dado'}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Mesma grade dos seis acima, e por isso alinhado com eles.
                  "Contatos que já estão no CRM" não cabe numa coluna de
                  5.5rem sem quebrar em quatro linhas, então o rótulo encurtou;
                  o texto de apoio embaixo do select continua explicando o que
                  a escolha faz. */}
              <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
                {/* Sem sigla: "CRM" é jargão que a landing removeu de
                    propósito (docs/prd-copy-sem-jargao.md), e aqui a pessoa
                    está justamente conhecendo o produto. "Repetidos" diz o
                    caso sem exigir que ela saiba o nome da categoria. */}
                <Label htmlFor="duplicados" className="text-sm leading-tight">
                  Repetidos
                </Label>
                <div className="flex min-w-0 flex-col gap-1">
                  <Select
                    value={duplicados}
                    onValueChange={(valor) => setDuplicados(valor as 'ignorar' | 'atualizar')}
                  >
                    <SelectTrigger id="duplicados" className="w-full">
                      <SelectValue>
                        {(valor) =>
                          valor === 'atualizar'
                            ? 'Atualizar com os dados da planilha'
                            : 'Deixar como estão'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ignorar">Deixar como estão</SelectItem>
                      <SelectItem value="atualizar">
                        Atualizar com os dados da planilha
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">
                    {duplicados === 'atualizar'
                      ? 'Quem já existe recebe os dados novos. Célula em branco não apaga nada.'
                      : 'Quem já existe é ignorado. Só entram os contatos novos.'}
                  </span>
                </div>
              </div>
            </div>

            {/* ## O aviso de vagas vem ANTES do botao, nao no relatorio
                Antes a pessoa importava 300 linhas e descobria no fim que 288
                foram ignoradas. Saber depois nao ajuda a decidir — e a mesma
                classe do painel de prazos que dizia "nenhum negocio em aberto"
                com 4 negocios ao lado.
                So aparece quando ha teto (Free) E ele de fato corta algo. Pro
                e trial tem `vagasNoPlano === null` e nao veem nada. */}
            {vagasNoPlano !== null && previa.linhas.length > vagasNoPlano && (
              <div className="bg-amber-500/5 ring-amber-500/25 flex flex-col gap-3 rounded-lg p-3 ring-1">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">
                    {vagasNoPlano === 0
                      ? `Você já usou os ${FREE_LEAD_LIMIT} contatos do plano Free.`
                      : `Você tem ${vagasNoPlano} vaga(s) no plano Free.`}
                  </p>
                  <p className="text-muted-foreground text-xs text-pretty">
                    {vagasNoPlano === 0
                      ? 'Nenhum contato desta planilha vai entrar sem o Pro.'
                      : `Vão entrar ${vagasNoPlano} dos ${previa.linhas.length} contatos.`}
                  </p>
                </div>
                <div>
                  <Button
                    type="button"
                    size="sm"
                    // Abre o diálogo de pagamento com o Pix na tela. Cair em
                    // `/settings/billing` seco deixava a pessoa procurando o
                    // botão depois de já ter decidido — corrigido em 25/08.
                    render={<a href="/settings/billing?pagar=1" />}
                  >
                    Assinar o Pro &mdash; R$ {PRO_PLAN_PRICE}/mês
                  </Button>
                </div>
              </div>
            )}

            {previa.linhas.length > 0 && (
              <div className="border-border rounded-lg border p-3">
                <p className="mb-2 text-xs font-medium">
                  Prévia, {previa.linhas.length} linha(s) prontas
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {previa.linhas.slice(0, 3).map((linha) => (
                    <li key={linha.linha} className="truncate">
                      {[linha.name, linha.phone, linha.email, linha.company]
                        .filter(Boolean)
                        .join(' · ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previa.erros.length > 0 && (
              <div className="border-border max-h-40 overflow-y-auto rounded-lg border p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
                  <AlertTriangle
                    aria-hidden
                    className="size-3.5 text-amber-500 dark:text-amber-400"
                  />
                  {previa.erros.length} aviso(s)
                </p>
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {previa.erros.slice(0, 20).map((erro) => (
                    <li key={erro}>{erro}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setPasso('arquivo')}>
                <ArrowLeft className="size-4" />
                Trocar arquivo
              </Button>
              <Button
                type="button"
                onClick={() => void enviar()}
                disabled={enviando || previa.linhas.length === 0}
              >
                {enviando ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Importar {previa.linhas.length || ''}
              </Button>
            </DialogFooter>
          </div>
        )}

        {passo === 'resultado' && resultado && (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle2 aria-hidden className="size-4 text-emerald-500 dark:text-emerald-400" />
              {resultado.importados === 0
                ? `${resultado.atualizados} contato(s) atualizados.`
                : resultado.importados === 1
                  ? '1 contato importado, com o negócio criado no funil.'
                  : `${resultado.importados} contatos importados, com os negócios criados no funil.`}
            </p>

            {(resultado.duplicados > 0 ||
              resultado.atualizados > 0 ||
              resultado.ignorados > 0 ||
              resultado.foraDoLimite > 0) && (
              <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
                {resultado.atualizados > 0 && resultado.importados > 0 && (
                  <li>{resultado.atualizados} já existiam e foram atualizados.</li>
                )}
                {resultado.duplicados > 0 && (
                  <li>{resultado.duplicados} já estavam cadastrados e foram ignorados.</li>
                )}
                {resultado.ignorados > 0 && (
                  <li>{resultado.ignorados} linha(s) com erro, veja a lista abaixo.</li>
                )}
                {resultado.foraDoLimite > 0 && (
                  <li className="text-foreground">
                    {resultado.foraDoLimite} não couberam no plano Free.
                  </li>
                )}
              </ul>
            )}

            {resultado.avisos.length > 0 && (
              <div className="border-border max-h-40 overflow-y-auto rounded-lg border p-3">
                <ul className="text-muted-foreground flex flex-col gap-1 text-xs">
                  {resultado.avisos.map((aviso) => (
                    <li key={aviso}>{aviso}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter className="sm:justify-between">
              {resultado.foraDoLimite > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  // `?pagar=1` abre o diálogo de pagamento com o Pix na tela.
                  // Existe desde 25/08, criado porque cair em
                  // `/settings/billing` seco deixava a pessoa procurando o
                  // botão depois de já ter decidido pagar.
                  render={<a href="/settings/billing?pagar=1" />}
                >
                  Assinar o Pro &mdash; R$ {PRO_PLAN_PRICE}/mês
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
