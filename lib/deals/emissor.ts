/**
 * O mínimo que um orçamento precisa dizer sobre QUEM está cobrando.
 *
 * ## O defeito que isto fecha, e ele saía para o cliente do cliente
 *
 * Medido em produção em 16/09/2026: **49 dos 51 workspaces não têm nenhum dado
 * de empresa**, e NOVE deles estão em Pro, ou seja podem gerar PDF hoje.
 *
 * Para esses nove o cabeçalho do PDF saía só com o nome do workspace, e as
 * duas linhas de contato nem renderizavam — `montarPdfDoOrcamento` pula os
 * blocos quando tudo é nulo, de propósito. Na prática o cliente do cliente
 * recebia um orçamento de milhares de reais assinado por "Dnfjd" ou "rththn",
 * sem CNPJ, sem telefone, sem e-mail e sem cidade: um documento sem nenhuma
 * forma de responder.
 *
 * A rota já barrava por dado faltando — o 409 da validade. O que faltava era a
 * guarda para o lado que IDENTIFICA quem cobra, que é mais grave: prazo
 * ausente é documento incompleto, emissor ausente é documento anônimo.
 *
 * ## CNPJ NÃO é exigido, e isso é decisão
 *
 * Autônomo sem CNPJ emite orçamento todo dia, e é parte legítima do público
 * deste produto — a régua de nichos de 07/09 mediu marcenaria, dedetizadora e
 * comunicação visual, onde o MEI e o informal são a norma. Exigir CNPJ
 * fecharia o recurso para eles.
 *
 * O que se exige é nome mais UMA forma de contato, qualquer uma. O documento
 * precisa ser respondível, não precisa ser fiscal.
 */

/** Só o que decide a emissão. A rota lê mais colunas para montar o PDF. */
export type EmissorDoOrcamento = {
  name?: string | null
  nome_fantasia?: string | null
  cnpj?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email_comercial?: string | null
  site?: string | null
}

/**
 * O nome que vai no cabeçalho, ou string vazia quando não há nenhum.
 *
 * `nome_fantasia` primeiro: é o nome que o cliente do cliente reconhece.
 * `workspaces.name` é como a pessoa chamou a empresa DENTRO do produto e pode
 * ser um apelido ("Minha empresa").
 */
export function nomeDoEmissor(empresa: EmissorDoOrcamento | null | undefined): string {
  return empresa?.nome_fantasia?.trim() || empresa?.name?.trim() || ''
}

/** Existe pelo menos uma forma de o cliente responder? */
export function temComoResponder(
  empresa: EmissorDoOrcamento | null | undefined,
): boolean {
  if (!empresa) return false
  return Boolean(
    empresa.telefone?.trim() ||
    empresa.whatsapp?.trim() ||
    empresa.email_comercial?.trim() ||
    empresa.site?.trim() ||
    empresa.cnpj?.trim(),
  )
}

/**
 * O documento pode sair?
 *
 * Devolve o motivo em vez de um booleano solto: quem chama precisa da frase, e
 * duplicar a frase na rota é como duas mensagens divergem.
 */
export function podeEmitirOrcamento(
  empresa: EmissorDoOrcamento | null | undefined,
): { pode: true; nome: string } | { pode: false; motivo: string } {
  const nome = nomeDoEmissor(empresa)

  if (!nome || !temComoResponder(empresa)) {
    return {
      pode: false,
      motivo:
        'Complete os dados da sua empresa antes de gerar o PDF. O orçamento vai para o seu cliente e precisa dizer quem está cobrando e como responder.',
    }
  }

  return { pode: true, nome }
}
