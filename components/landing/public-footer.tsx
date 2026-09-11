import Link from 'next/link'
import { MessageCircle } from 'lucide-react'

import { Logo } from '@/components/branding/logo'
import { SelosDeSeguranca } from '@/components/landing/selos-de-seguranca'
import { SuporteEmailMenu } from '@/components/landing/suporte-email-menu'
import { assinaturaPublica, CONTROLADOR } from '@/lib/legal'

// O rodapé repetia os links do menu do topo (Funcionalidades, Planos, Entrar,
// Começar grátis), que já estão visíveis na navbar fixa. Espaço de rodapé
// rende mais com o que não cabe em outro lugar: os documentos legais, que a
// LGPD exige serem de acesso fácil e permanente (Art. 9º), e o canal de
// suporte.
const legalLinks = [
  { label: 'Privacidade', href: '/privacidade' },
  { label: 'Termos de uso', href: '/termos' },
]

export function PublicFooter() {
  return (
    <footer className="border-border/50 border-t px-4 py-10 md:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6">
        <div className="flex w-full flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo />
          {/* `min-h-11` em vez de só texto: um link de 20px de altura é um alvo
              de toque ruim no polegar, e abaixo do mínimo de 24px da WCAG 2.2.
              O `-my-2` mantém o espaçamento visual original. */}
          <nav
            aria-label="Links legais"
            className="-my-2 flex flex-wrap items-center justify-center gap-x-6"
          >
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground flex min-h-11 items-center text-sm transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {/* `wa.me` abre a conversa direto, no app instalado ou no web,
                melhor do que exibir o número solto, que obrigaria a pessoa a
                copiar e colar. `rel=noopener` porque abre em outra aba. */}
            <a
              href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-1.5 text-sm transition-colors"
            >
              <MessageCircle aria-hidden className="size-4" />
              Suporte
            </a>
          </nav>
          {/* O CNPJ entra na linha de copyright, não numa linha própria.
              No Brasil ele é o primeiro sinal que uma PME procura antes de
              confiar num site que nunca ouviu falar — e o rodapé é onde ela vai
              procurar, porque é onde todo site sério o coloca. Estava só nas
              páginas legais, a dois cliques de distância de quem estava
              decidindo. Vem de `lib/legal.ts`, a mesma fonte que a Política de
              Privacidade e os Termos citam, então não há como divergirem.

              Sem `razaoSocial` NESTA LINHA, de propósito: nome civil do
              titular numa linha de reforço visual não ajuda confiança, só
              expõe. A decisão de 24/08 continua valendo aqui e é por isso que
              `assinaturaPublica()` usa o nome fantasia.

              **Ela passou a existir no rodapé em 31/08, num bloco próprio mais
              abaixo**, porque a verificação da Meta lê o site procurando os
              dados do CNPJ. As duas coisas convivem: esta linha é assinatura
              de marca, aquela é identificação cadastral — separadas de
              propósito, com pesos e tamanhos diferentes. */}
          {/* `assinaturaPublica()` some com a parte do CNPJ enquanto não houver
              inscrição ativa (25/08). Sem isso o rodapé exibiria `CNPJ null`,
              ou pior, um número baixado que qualquer consulta desmente. */}
          <span className="text-muted-foreground text-sm text-balance">
            © {new Date().getFullYear()} {assinaturaPublica()}
          </span>
        </div>

        {/* Número por extenso removido (24/08), a pedido do dono: página
            profissional não expõe o telefone cru, o link já abre o WhatsApp
            direto. `-my-3 inline-block py-3` continua nos dois links: são
            texto de 12px que mediam 14px de altura, contra os 44 mínimos de
            alvo de toque, e quem está no celular tentando falar com o
            suporte é justamente quem não pode errar o clique. O padding
            cresce a área tocável e a margem negativa cancela o efeito no
            layout, então a linha continua com a mesma aparência. Mesmo
            padrão já usado no link da FAQ. */}
        <p className="text-muted-foreground text-center text-xs">
          Central de suporte:{' '}
          <a
            href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground -my-3.5 inline-block py-3.5 underline underline-offset-4 transition-colors"
          >
            WhatsApp
          </a>{' '}
          ·{' '}
          {/* Menu em vez de `mailto:` puro: o endereço é encaminhado (Cloudflare
              Email Routing) para outra caixa, não uma conta própria, e um
              `mailto:` abre o app de e-mail PADRÃO DO SISTEMA — em máquina com
              Outlook desktop instalado, o clique tentava abrir ele e batia em
              erro de cache de contato, sem relação com a configuração de DNS.
              O menu deixa escolher onde abrir em vez de depender disso. */}
          <SuporteEmailMenu
            email={CONTROLADOR.email}
            className="hover:text-foreground -my-3.5 inline-block cursor-pointer py-3.5 underline underline-offset-4 transition-colors"
          />
          {/* Sinaliza o redirecionamento sem expor a mecânica interna do
              domínio — resposta ao relato de confusão de quem clicou esperando
              abrir a própria caixa e caiu direto no Outlook. */}
          {/* ## Sem `/70`, e o motivo e medido

              Estas duas linhas eram `text-muted-foreground/70` em 11px, e sao
              as UNICAS duas falhas de contraste da landing — 169 elementos
              avaliados nos dois temas, 2 reprovam, sempre estas.

                             hoje /70   sem /70   minimo
                  claro        3,00      5,58      4,5
                  escuro       4,14      7,38      4,5

              A opacidade servia para recuar informacao secundaria, e o tamanho
              ja faz esse trabalho: 11px contra os 14px da linha acima. Empilhar
              os dois recuos e o que derruba abaixo do minimo — e o preco e
              justamente o dado cadastral, que existe para ser CONFERIDO. */}
          <span className="text-muted-foreground block text-[11px]">
            (você escolhe onde abrir; encaminha para nossa caixa de suporte)
          </span>
        </p>

        {/* ## Os dados cadastrais completos, e por que eles moram AQUI
            
            A verificação de negócio da Meta abre o site e procura razão
            social, endereço e telefone iguais aos do CNPJ. Sem os três na
            página, ela reprova — e reprovação fica no histórico do Business
            Manager.

            Ficam no rodapé, não na seção de confiança, e isso preserva a
            decisão de 24/08 em vez de desfazê-la. Aquela seção é peça de
            marketing: ali a razão social não ajudava confiança, só expunha o
            nome civil do titular. Rodapé é onde dado cadastral pertence por
            convenção — quem procura, acha; quem não procura, não tropeça.

            O telefone é o CADASTRAL, da contabilidade que abriu a empresa, e
            está rotulado como tal. O canal de suporte continua sendo o link
            do WhatsApp acima. Trocar os dois de lugar quebraria as duas
            coisas: a Meta deixaria de bater, e quem precisa de ajuda cairia
            num escritório de contabilidade.

            **O CNPJ não se repete aqui**, e isso foi decidido olhando o
            rodapé renderizado nas duas larguras: com o número na assinatura
            logo acima, repeti-lo quatro linhas abaixo lia como descuido, não
            como intenção. Ele continua no mesmo rodapé, na mesma coluna
            centralizada — perto o bastante para quem procura os dados
            cadastrais encontrar os quatro juntos.

            O bloco inteiro é condicionado ao CNPJ porque os três campos
            chegam e partem juntos: sem inscrição, `endereco` e
            `telefoneCadastral` também são nulos, e o que sobraria é uma linha
            solta — e o CNPJ é o que dá sentido ao endereço estar publicado.

            ## Nome fantasia aqui, razão social nas páginas legais

            A razão social é `ORLANDO HENRIQUE BASTOS DA CRUZ LTDA` — a LTDA
            leva o nome civil do dono, e esta linha é a única superfície de
            marca que ainda o exibia. Passou a usar `nomeFantasia`, que também
            é o que a Receita registra (MEI não podia ter nome fantasia; a
            LTDA tem, desde 31/08).

            **Isso não tira a razão social do site**, e é o que torna a troca
            barata: `/privacidade` e `/termos` a publicam por
            `identificacaoDoControlador()`, junto do CNPJ — conferido no HTML
            servido. É onde ela pertence por lei, porque o art. 9º, I pede
            identificação clara de quem responde pelo dado, e é lá que alguém
            procurando o controlador vai olhar.

            **O resíduo, para quem for submeter a verificação da Meta:** ela
            procura razão social, endereço e telefone no site, e os três agora
            moram em DUAS páginas em vez de uma — endereço e telefone aqui,
            razão social e CNPJ nas legais, que este mesmo rodapé linka. É
            arranjo comum e não deve reprovar, mas é diferente do que a decisão
            de 31/08 montou. Se a verificação reprovar por dado não encontrado,
            este é o primeiro lugar a olhar. */}
        {/* Acima do CNPJ, e não abaixo: a linha de CNPJ é a assinatura que
            fecha o rodapé, e nada deve vir depois dela. */}
        <SelosDeSeguranca />

        {CONTROLADOR.cnpj ? (
          <p className="text-muted-foreground text-center text-[11px] text-balance">
            {CONTROLADOR.nomeFantasia}
            {CONTROLADOR.endereco ? ` · ${CONTROLADOR.endereco}` : ''}
            {CONTROLADOR.telefoneCadastral
              ? ` · Telefone cadastral: ${CONTROLADOR.telefoneCadastral}`
              : ''}
          </p>
        ) : null}
      </div>
    </footer>
  )
}
