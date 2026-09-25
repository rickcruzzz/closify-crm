/**
 * Quais empresas podem receber uma instância na Evolution.
 *
 * ## Isto não é gate de plano, e é por isso que é um módulo separado
 *
 * O gate de plano é `direitoAoWhatsapp` mais a trigger da 0090, e ele continua
 * valendo inteiro. Esta lista responde outra pergunta: **esta empresa pode ser
 * atendida por um servidor fora do Brasil?**
 *
 * `components/landing/confianca-section.tsx` promete, em texto, na página que
 * recebe tráfego pago:
 *
 * > Nada de cliente seu atravessa fronteira para ser processado
 *
 * E a VPS da Evolution fica em **Boston**. A auditoria de infraestrutura de
 * 18/09 registra que a capacidade cabe (cinco clientes no KVM 1 de hoje) e que
 * o datacenter é um dos dois bloqueios que capacidade não resolve.
 *
 * Enquanto aquela frase estiver no ar, a Evolution só serve empresa do PRÓPRIO
 * dono. A Z-API continua sendo o caminho de todo cliente pagante, e é ela que a
 * tela oferece.
 *
 * ## Por que uma lista explícita e não uma heurística
 *
 * "É do dono" não é derivável: `ehContaDeTeste` existe e o próprio comentário
 * dela avisa que a lista é mantida à mão, porque conta de `gmail.com` do dono
 * nenhum filtro de domínio pega. Derivar aqui seria a mesma armadilha, só que
 * o erro custaria dado de cliente saindo do país em vez de um número torto num
 * painel.
 *
 * ## Vazia significa NINGUÉM, e é decisão
 *
 * Variável ausente fecha a porta. O contrário deixaria a Evolution aberta para
 * qualquer empresa com Max enquanto alguém "ainda não configurou", que é
 * exatamente o desenho que a rota de prospecção recusou em 12/09 com
 * `503 webhook não configurado`.
 */

/** Um UUID, em minúscula. O que `workspace_id` é. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Lê a lista da variável, tolerando espaço, vírgula e caixa.
 *
 * Puro de propósito: recebe o valor em vez de ler `process.env`, e é o que
 * permite ao teste exercitar a lista vazia e o id torto sem mexer no ambiente
 * do processo.
 */
export function empresasPermitidas(bruto: string | undefined): Set<string> {
  if (!bruto) return new Set()
  return new Set(
    bruto
      .split(/[,\s]+/)
      .map((p) => p.trim().toLowerCase())
      // Id torto é DESCARTADO em vez de aceito. Um valor com espaço colado ou
      // aspas sobrando nunca casaria com um `workspace_id` real, então deixá-lo
      // entrar só encheria a lista de coisa que não autoriza nada.
      .filter((p) => UUID.test(p)),
  )
}

export function podeUsarEvolution(
  workspaceId: string,
  bruto: string | undefined = process.env.EVOLUTION_WORKSPACES_PERMITIDOS,
): boolean {
  return empresasPermitidas(bruto).has(workspaceId.toLowerCase())
}
