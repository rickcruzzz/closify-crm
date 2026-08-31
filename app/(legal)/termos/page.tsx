import type { Metadata } from 'next'
import Link from 'next/link'

import { ATUALIZADO_EM, CONTROLADOR, identificacaoDoControlador } from '@/lib/legal'
import { FREE_LEAD_LIMIT, FREE_MEMBER_LIMIT, PRO_PLAN_PRICE } from '@/lib/plans'
import {
  LegalBackLink,
  LegalList,
  LegalP,
  LegalSection,
  LegalTitle,
  LegalUpdatedAt,
} from '@/components/legal/legal-prose'

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description:
    'Condições de uso da plataforma Velo Funil: planos, pagamento, cancelamento, responsabilidades e propriedade dos dados.',
  alternates: { canonical: '/termos' },
}

export default function TermosPage() {
  return (
    <article>
      <LegalTitle>Termos de Uso</LegalTitle>
      <LegalUpdatedAt>Última atualização: {ATUALIZADO_EM}</LegalUpdatedAt>

      <LegalSection titulo="1. Aceite">
        <LegalP>
          Ao criar uma conta no {CONTROLADOR.nomeFantasia} você concorda com estes
          Termos. Se estiver contratando em nome de uma empresa, declara ter poderes para
          representá-la. Caso não concorde, não utilize a plataforma.
        </LegalP>
        <LegalP>
          Contratante: {identificacaoDoControlador()}, sob o nome fantasia{' '}
          {CONTROLADOR.nomeFantasia}
          {CONTROLADOR.endereco ? `, com sede em ${CONTROLADOR.endereco}` : ''}. Contato:{' '}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>{' '}
          ou WhatsApp{' '}
          <a
            href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.whatsapp.exibicao}
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection titulo="2. O que é o serviço">
        <LegalP>
          Um CRM em nuvem com pipeline de vendas em Kanban, cadastro de leads, registro
          de atividades e métricas. O acesso é por assinatura, sem instalação local.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="3. Conta e responsabilidade de acesso">
        <LegalP>
          Você é responsável por manter a confidencialidade da sua senha e por tudo que
          acontecer na sua conta. Avise imediatamente em caso de suspeita de acesso não
          autorizado. Cada pessoa da equipe deve ter a própria conta, o acesso é
          pessoal e intransferível.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="4. Planos e pagamento">
        <LegalList>
          <li>
            <strong className="text-foreground">Plano Free:</strong> gratuito, limitado a{' '}
            {FREE_LEAD_LIMIT} leads e {FREE_MEMBER_LIMIT} membros por workspace.
          </li>
          <li>
            <strong className="text-foreground">Plano Pro:</strong> R$ {PRO_PLAN_PRICE}
            {',00'} por mês, sem limite de leads ou membros.
          </li>
        </LegalList>
        <LegalP>
          A cobrança é mensal e recorrente, processada pelo Asaas, com aceite de Pix,
          boleto e cartão. Não recebemos nem armazenamos dados de cartão de crédito. O
          plano é ativado após a confirmação do pagamento e renovado automaticamente até
          que você cancele.
        </LegalP>
        <LegalP>
          Em caso de falha no pagamento, a assinatura pode ser suspensa e o workspace
          retorna às limitações do plano Free. Seus dados permanecem preservados durante
          esse período.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="5. Cancelamento e arrependimento">
        <LegalP>
          Você pode cancelar a assinatura quando quiser, e o acesso ao plano pago
          permanece até o fim do período já pago. Não há multa nem fidelidade.
        </LegalP>
        <LegalP>
          Nos termos do art. 49 do Código de Defesa do Consumidor, contratações feitas
          por pessoa física podem ser desfeitas em até 7 dias corridos, com devolução
          integral do valor pago.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="6. Seus dados continuam seus">
        <LegalP>
          Os leads, negócios e demais registros que você insere são de sua propriedade.
          Não os utilizamos para finalidade própria, não os vendemos e não os cedemos a
          terceiros. Nosso acesso se limita ao necessário para operar, manter e dar
          suporte à plataforma.
        </LegalP>
        <LegalP>
          Ao cadastrar dados de terceiros aqui, você declara ter base legal para tratá-los
          e assume a posição de controlador desses dados, conforme detalhado na{' '}
          <Link
            href="/privacidade"
            className="text-foreground underline underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalSection titulo="7. Uso proibido">
        <LegalList>
          <li>Violar lei aplicável ou direitos de terceiros;</li>
          <li>Enviar spam ou mensagens não solicitadas a partir dos dados da conta;</li>
          <li>
            Tentar acessar dados de outro workspace, burlar limites de plano ou explorar
            falhas de segurança;
          </li>
          <li>
            Fazer engenharia reversa, revender ou sublicenciar a plataforma sem
            autorização;
          </li>
          <li>Sobrecarregar a infraestrutura com automações abusivas.</li>
        </LegalList>
        <LegalP>
          A violação pode levar à suspensão ou encerramento da conta, com aviso prévio
          sempre que possível.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="8. Disponibilidade">
        <LegalP>
          Trabalhamos para manter o serviço disponível de forma contínua, mas não
          garantimos operação ininterrupta: manutenções, falhas de fornecedores externos
          e eventos fora do nosso controle podem causar indisponibilidade temporária.
          Sempre que possível, manutenções programadas serão comunicadas com
          antecedência.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="9. Limitação de responsabilidade">
        <LegalP>
          Na máxima extensão permitida pela lei, nossa responsabilidade por perdas
          relacionadas ao serviço fica limitada ao valor pago por você nos 12 meses
          anteriores ao evento. Não respondemos por lucros cessantes ou danos indiretos.
        </LegalP>
        <LegalP>
          Esta limitação não afasta os direitos assegurados ao consumidor pelo Código de
          Defesa do Consumidor, nem responsabilidade por dolo ou culpa grave.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="10. Encerramento da conta">
        <LegalP>
          Você pode encerrar sua conta a qualquer momento em Configurações, sem precisar
          solicitar nem esperar aprovação. Recomendamos salvar o que precisar antes: a
          remoção é imediata e definitiva, e leva junto os workspaces em que você é o
          único membro, com todos os leads e negócios neles.
        </LegalP>
        <LegalP>
          Se houver assinatura ativa, cancele-a antes: excluir a conta não interrompe a
          cobrança recorrente, que é processada pelo Asaas. Em caso de dúvida, escreva
          para{' '}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>
          .
        </LegalP>
      </LegalSection>

      <LegalSection titulo="11. Alterações destes Termos">
        <LegalP>
          Podemos atualizar estes Termos. Mudanças relevantes, especialmente de preço ou
          de escopo do serviço, serão comunicadas por e-mail com pelo menos 30 dias de
          antecedência. Continuar usando a plataforma após a vigência significa aceitar a
          nova versão.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="12. Lei aplicável e foro">
        <LegalP>
          Estes Termos são regidos pela lei brasileira. Fica eleito o foro do domicílio
          do usuário para dirimir controvérsias, conforme faculta o Código de Defesa do
          Consumidor.
        </LegalP>
      </LegalSection>

      <LegalBackLink />
    </article>
  )
}
