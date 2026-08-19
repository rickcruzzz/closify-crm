import { cn } from '@/lib/utils'
import { CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthStatusIcon } from '@/components/auth/auth-status-icon'

type Tom = 'marca' | 'erro' | 'neutro'

/**
 * O cabeçalho das telas de autenticação, nas duas formas que o fluxo usa.
 *
 * **`variante="pagina"`**, para login e cadastro: sem cartão, título na
 * tipografia da landing. É o que costura marketing e produto — quem vem do
 * hero encontra a mesma escala e o mesmo `tracking` na primeira tela logada.
 *
 * **`variante="cartao"`**, para as seis telas de estado curto: dentro do
 * `CardHeader`, com ícone opcional. Continua usando `CardTitle`/
 * `CardDescription` em vez de `h1`/`p` crus porque o `CardHeader` é um grid
 * que reage a `has-data-[slot=card-description]`: trocar por elementos sem o
 * `data-slot` mudaria o número de linhas do grid e o espaçamento junto.
 *
 * **O `h1` não é opcional.** Cinco das oito telas não tinham nenhum antes —
 * página sem `h1` é falha de acessibilidade e o leitor de tela perde o ponto
 * de entrada. Agora todas têm exatamente um, e ele vem daqui.
 *
 * O passo do stagger vem embutido: título no passo 2, descrição no passo 3.
 * Deixar isso a cargo de cada tela é como oito ritmos diferentes nascem.
 */
export function AuthCabecalho({
  titulo,
  descricao,
  icone,
  tom = 'marca',
  variante,
  className,
}: {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  /** Ícone já dimensionado em `size-5`. Só na variante de cartão. */
  icone?: React.ReactNode
  tom?: Tom
  variante: 'pagina' | 'cartao'
  className?: string
}) {
  if (variante === 'pagina') {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <h1 className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-3xl font-semibold tracking-[-0.02em] text-balance md:text-4xl">
          {titulo}
        </h1>
        {descricao && (
          <p className="text-muted-foreground animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-3 text-balance">
            {descricao}
          </p>
        )}
      </div>
    )
  }

  return (
    // `justify-items-center`, não só `items-center`: o `CardHeader` é um
    // GRID, e ali `items-*` alinha no eixo vertical. O que centraliza na
    // horizontal é `justify-items`. Sem ele o texto centraliza (por herança de
    // `text-center`) mas o ícone não, porque tem largura fixa de 40px e um
    // item de largura fixa em `justify-items: stretch` encosta no início da
    // coluna. Efeito: título centrado com o ícone encostado à esquerda.
    <CardHeader
      className={cn(icone && 'items-center justify-items-center text-center', className)}
    >
      {icone && (
        <AuthStatusIcon
          tom={tom}
          className="animate-in fade-in zoom-in-95 fill-mode-both ease-entrada duration-estado delay-passo-2 mb-1"
        >
          {icone}
        </AuthStatusIcon>
      )}
      <CardTitle className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-2 text-xl">
        <h1>{titulo}</h1>
      </CardTitle>
      {descricao && (
        <CardDescription className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-entrada duration-entrada delay-passo-3">
          {descricao}
        </CardDescription>
      )}
    </CardHeader>
  )
}
