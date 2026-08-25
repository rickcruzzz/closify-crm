import { DestaquesDoInstagram } from '@/components/dono/destaques-do-instagram'
import { KitDoPerfil } from '@/components/dono/kit-do-perfil'
import { listarDestaques } from '@/lib/dono/destaques-queries'
import { exigirAmbienteLocal } from '@/lib/dono/somente-local'

export const dynamic = 'force-dynamic'

export default async function PaginaDeDestaques() {
  await exigirAmbienteLocal()

  const destaques = await listarDestaques()
  const total = destaques.reduce((soma, destaque) => soma + destaque.telas.length, 0)

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Destaques do Instagram</h1>
        <p className="text-muted-foreground max-w-3xl text-sm text-pretty">
          {total} telas prontas, agrupadas pelo destaque em que entram. Baixe na ordem numerada e
          suba na mesma sequência: o Instagram exibe o destaque na ordem em que os Stories foram
          postados, e não dá para reordenar depois sem apagar e repostar.
        </p>
      </header>

      {/* O kit vem ANTES das telas de propósito. Story em destaque sem bio
          nem link correto é arte bonita levando a lugar nenhum — e a bio foi
          justamente o que ficou meses desatualizada enquanto os criativos
          eram refeitos. Primeiro o perfil funciona, depois ele é preenchido. */}
      <KitDoPerfil />

      <DestaquesDoInstagram destaques={destaques} />

      {/*
        O quinto destaque não está aqui porque não pode ser gerado. Dizer isso
        na tela evita a pergunta de "por que só quatro" toda vez que ela abrir
        — e evita que alguém tente preencher com material inventado, que é a
        prova social fabricada que este projeto recusa.
      */}
      <section className="border-border bg-card rounded-lg border p-4">
        <h2 className="text-sm font-medium">Bastidores — o quinto destaque</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm text-pretty">
          Não é gerado aqui, de propósito: depende de conteúdo seu — rotina, processo, decisão que
          você tomou. Isso não existe no código e não dá para inventar sem cair na prova social
          fabricada. Foto do dia a dia e vídeo curto de tela resolvem, e valem mais justamente por
          serem reais.
        </p>
      </section>
    </div>
  )
}
