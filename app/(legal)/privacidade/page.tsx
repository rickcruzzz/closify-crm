import type { Metadata } from 'next'
import Link from 'next/link'

import {
  ATUALIZADO_EM,
  CONTROLADOR,
  PRAZO_RESPOSTA_TITULAR_DIAS,
  SUBOPERADORES,
} from '@/lib/legal'
import {
  LegalBackLink,
  LegalList,
  LegalP,
  LegalSection,
  LegalTable,
  LegalTitle,
  LegalUpdatedAt,
} from '@/components/legal/legal-prose'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Como o Velo Funil trata dados pessoais, com quem compartilha e quais são os seus direitos como titular, conforme a LGPD (Lei 13.709/2018).',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <article>
      <LegalTitle>Política de Privacidade</LegalTitle>
      <LegalUpdatedAt>Última atualização: {ATUALIZADO_EM}</LegalUpdatedAt>

      <LegalSection titulo="1. Quem é o controlador">
        <LegalP>
          {CONTROLADOR.nomeFantasia}, inscrita no CNPJ sob o nº {CONTROLADOR.cnpj}, é a
          controladora dos dados pessoais tratados nesta plataforma, nos termos do
          art. 5º, VI da Lei nº 13.709/2018 (LGPD).
        </LegalP>
        <LegalP>
          Contato do encarregado pelo tratamento de dados (DPO):{' '}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>
          . Também atendemos pela central de suporte no WhatsApp{' '}
          <a
            href={`https://wa.me/${CONTROLADOR.whatsapp.numero}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.whatsapp.exibicao}
          </a>
          , mas pedidos formais de titular devem ser enviados por e-mail, para que
          fiquem registrados.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="2. Dois papéis diferentes nesta plataforma">
        <LegalP>
          Esta distinção determina quem responde por cada dado, e por isso vem antes de
          tudo:
        </LegalP>
        <LegalList>
          <li>
            <strong className="text-foreground">Seus dados de cadastro.</strong> Quando
            você cria uma conta, somos o <em>controlador</em>: decidimos como esses dados
            são tratados e respondemos diretamente a você.
          </li>
          <li>
            <strong className="text-foreground">
              Os dados dos leads que você cadastra.
            </strong>{' '}
            Aqui somos <em>operador</em> (art. 5º, VII): tratamos essas informações por
            sua conta e ordem. Quem decide o que coletar, por que e por quanto tempo é
            você — e é você quem responde perante essas pessoas.
          </li>
        </LegalList>
        <LegalP>
          Em outras palavras: ao cadastrar o contato de um cliente aqui, você precisa ter
          uma base legal própria para isso. Nós fornecemos a ferramenta e a segurança;
          não substituímos a sua obrigação como controlador dos dados dos seus clientes.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="3. Quais dados tratamos">
        <LegalP>
          <strong className="text-foreground">Dados que você fornece:</strong> nome e
          e-mail no cadastro; nome da empresa ao criar o workspace; e, ao contratar o
          plano pago, CPF ou CNPJ para emissão da cobrança.
        </LegalP>
        <LegalP>
          <strong className="text-foreground">Dados que você insere sobre terceiros:</strong>{' '}
          nome, e-mail, telefone, empresa, valor de negociação e o histórico de
          atividades que você registrar sobre seus leads.
        </LegalP>
        <LegalP>
          <strong className="text-foreground">Dados coletados automaticamente:</strong>{' '}
          endereço IP, tipo de navegador e páginas acessadas, para segurança e medição
          de desempenho. Não usamos cookies de publicidade, não fazemos perfilamento
          comportamental e não vendemos dados a ninguém.
        </LegalP>
        <LegalP>
          Sobre o CPF ou CNPJ: ele é transmitido diretamente ao processador de pagamentos
          e <strong className="text-foreground">não é armazenado em nosso banco de dados</strong>.
          Também não recebemos nem guardamos números de cartão de crédito.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="4. Com que finalidade e sob qual base legal">
        <LegalTable>
          <thead>
            <tr className="border-border border-b">
              <th className="px-4 py-2 font-medium">Finalidade</th>
              <th className="px-4 py-2 font-medium">Base legal (LGPD, art. 7º)</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-border/50 border-b">
              <td className="px-4 py-2">Criar e manter sua conta e workspace</td>
              <td className="px-4 py-2">Execução de contrato (inciso V)</td>
            </tr>
            <tr className="border-border/50 border-b">
              <td className="px-4 py-2">Processar pagamentos e emitir cobranças</td>
              <td className="px-4 py-2">
                Execução de contrato e obrigação legal (incisos V e II)
              </td>
            </tr>
            <tr className="border-border/50 border-b">
              <td className="px-4 py-2">Enviar convites de colaborador</td>
              <td className="px-4 py-2">Execução de contrato (inciso V)</td>
            </tr>
            <tr className="border-border/50 border-b">
              <td className="px-4 py-2">
                Prevenir fraude e abuso (limite de tentativas de login)
              </td>
              <td className="px-4 py-2">Legítimo interesse (inciso IX)</td>
            </tr>
            <tr>
              <td className="px-4 py-2">Guardar registros de acesso</td>
              <td className="px-4 py-2">
                Obrigação legal — Marco Civil da Internet, art. 15
              </td>
            </tr>
          </tbody>
        </LegalTable>
      </LegalSection>

      <LegalSection titulo="5. Com quem compartilhamos">
        <LegalP>
          Não vendemos nem cedemos dados pessoais. O compartilhamento se limita aos
          prestadores necessários para a plataforma funcionar, todos atuando como
          operadores e obrigados contratualmente a proteger os dados:
        </LegalP>
        <LegalTable>
          <thead>
            <tr className="border-border border-b">
              <th className="px-4 py-2 font-medium">Prestador</th>
              <th className="px-4 py-2 font-medium">Para quê</th>
              <th className="px-4 py-2 font-medium">Processamento</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {SUBOPERADORES.map((s) => (
              <tr key={s.nome} className="border-border/50 border-b last:border-0">
                <td className="text-foreground px-4 py-2 font-medium">{s.nome}</td>
                <td className="px-4 py-2">{s.finalidade}</td>
                <td className="px-4 py-2">{s.paisDeProcessamento}</td>
              </tr>
            ))}
          </tbody>
        </LegalTable>
        <LegalP>
          Parte desses prestadores processa dados fora do Brasil. Essa transferência
          internacional ocorre nos termos do art. 33 da LGPD, amparada em cláusulas
          contratuais de proteção firmadas com cada fornecedor. Também podemos divulgar
          dados mediante ordem judicial ou requisição de autoridade competente.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="6. Por quanto tempo guardamos">
        <LegalList>
          <li>
            Dados da conta e do workspace: enquanto a conta existir, e por até 30 dias
            após o encerramento.
          </li>
          <li>
            Registros de acesso: 6 meses, conforme exige o art. 15 do Marco Civil da
            Internet.
          </li>
          <li>
            Dados fiscais de cobrança: 5 anos, por obrigação da legislação tributária.
          </li>
          <li>
            Registros de tentativas de login: até 24 horas, apenas para conter ataques de
            força bruta.
          </li>
        </LegalList>
        <LegalP>
          Ao excluir um workspace, os leads, negócios e atividades vinculados a ele são
          eliminados junto, em definitivo.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="7. Seus direitos como titular">
        <LegalP>
          O art. 18 da LGPD garante a você confirmar a existência de tratamento, acessar
          seus dados, corrigir dados incompletos ou desatualizados, solicitar
          anonimização, bloqueio ou eliminação, pedir a portabilidade, revogar
          consentimento e ser informado sobre com quem compartilhamos seus dados.
        </LegalP>
        <LegalP>
          Escreva para{' '}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-foreground underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>{' '}
          e responderemos em até {PRAZO_RESPOSTA_TITULAR_DIAS} dias. Você também pode
          apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).
        </LegalP>
        <LegalP>
          <strong className="text-foreground">Exclusão da conta:</strong> você mesmo pode
          excluir sua conta a qualquer momento, em Configurações, sem precisar solicitar
          nem esperar. A remoção é imediata e definitiva: os workspaces em que você é o
          único membro são apagados junto, com os leads, negócios e atividades neles.
          Workspaces compartilhados com outras pessoas continuam existindo — apenas o seu
          vínculo é removido.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="8. Segurança">
        <LegalP>
          Adotamos medidas técnicas compatíveis com o art. 46 da LGPD: tráfego cifrado
          por HTTPS, senhas armazenadas apenas como hash, isolamento entre empresas
          aplicado no próprio banco de dados (cada workspace só enxerga os próprios
          registros), limite de tentativas de login e controle de acesso por papel de
          usuário.
        </LegalP>
        <LegalP>
          Nenhum sistema é imune a incidentes. Caso ocorra violação com risco relevante
          aos titulares, comunicaremos os afetados e a ANPD, conforme o art. 48.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="9. Menores de idade">
        <LegalP>
          A plataforma é destinada a uso profissional e não se dirige a menores de 18
          anos. Não coletamos intencionalmente dados de crianças ou adolescentes. Se
          identificarmos esse caso, os dados serão eliminados.
        </LegalP>
      </LegalSection>

      <LegalSection titulo="10. Mudanças nesta política">
        <LegalP>
          Ao alterarmos este documento, atualizamos a data no topo. Mudanças que reduzam
          seus direitos ou ampliem o uso dos dados serão comunicadas por e-mail com
          antecedência razoável.
        </LegalP>
        <LegalP>
          Veja também os{' '}
          <Link href="/termos" className="text-foreground underline underline-offset-4">
            Termos de Uso
          </Link>
          .
        </LegalP>
      </LegalSection>

      <LegalBackLink />
    </article>
  )
}
