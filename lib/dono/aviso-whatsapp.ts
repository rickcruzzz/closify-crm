import type { Alerta } from '@/lib/dono/vigia'

/**
 * O aviso do vigia no WhatsApp do dono, além do e-mail.
 *
 * ## Por que o e-mail não bastava, e isso foi MEDIDO
 *
 * Em 06/09 o vigia funcionou perfeitamente: detectou o webhook do Asaas
 * parado, gravou a memória, mandou o e-mail às 00h. O que falhou foi o degrau
 * seguinte, e ele é humano — **ninguém abriu**. O webhook ficou parado por
 * mais dois dias, e a mesma coisa aconteceu de novo em 08/09 e em 12/09.
 *
 * Quatro paradas em nove dias, todas detectadas, nenhuma lida a tempo. O
 * problema deixou de ser deteção há muito tempo; é entrega.
 *
 * O dono lê WhatsApp e não lê a caixa de `notificacaosistemavelofunil@`. A
 * mensagem vai para onde ele está.
 *
 * ## O e-mail NÃO sai de cena, e isso é decisão
 *
 * Os dois respondem perguntas diferentes. O WhatsApp responde *"preciso olhar
 * agora?"* e cabe em duas linhas; o e-mail responde *"o que exatamente
 * aconteceu?"* e carrega o detalhe de cada alerta com link.
 *
 * E há a razão de robustez: se a Evolution cair, o e-mail continua saindo. Um
 * canal só transformaria a queda do canal no mesmo silêncio que o vigia existe
 * para quebrar — que é literalmente o defeito de 02/09, quando o vigia não
 * tinha quem o vigiasse.
 *
 * ## A falha aqui NUNCA derruba o vigia
 *
 * Se o WhatsApp falhar, a função devolve o erro e o chamador segue para o
 * e-mail e para a gravação da memória. O contrário — deixar a exceção subir —
 * faria uma indisponibilidade da VPS apagar o aviso inteiro, inclusive o
 * e-mail que teria funcionado.
 *
 * É a mesma regra que `lib/notificacoes/registrar.ts` já aplica: perder o
 * aviso num canal é recuperável, derrubar o alerta todo não é.
 */

/**
 * O texto do aviso, separado do envio para poder ser testado sem rede.
 *
 * ## Duas linhas, não o relatório inteiro
 *
 * O e-mail já carrega o detalhe. Aqui o trabalho é outro: fazer o dono decidir
 * em três segundos se larga o que está fazendo. Uma lista de oito alertas no
 * WhatsApp vira um bloco que se rola sem ler — que é o mesmo fim do e-mail que
 * ninguém abriu.
 *
 * O que decide a urgência vem primeiro: **dinheiro**. `montarAlertas` já
 * ordena por gravidade, e a primeira linha é a que a pessoa lê antes de
 * desbloquear a tela.
 */
export function textoDoAviso(
  alertas: Alerta[],
  naoConferido: string[],
  dia: string,
): string {
  const partes: string[] = []

  if (alertas.length > 0) {
    partes.push(`*Velo Funil, ${alertas.length} alerta(s)* · ${dia}`)
    partes.push('')
    // Teto de cinco: acima disso o WhatsApp corta com "Ler mais", e o que fica
    // escondido é justamente o fim da lista.
    for (const a of alertas.slice(0, 5)) {
      partes.push(`• ${a.titulo}`)
    }
    if (alertas.length > 5) {
      partes.push(`• …e mais ${alertas.length - 5}`)
    }
  }

  if (naoConferido.length > 0) {
    if (partes.length > 0) partes.push('')
    // "Não consegui conferir" é diferente de "está tudo certo", e a distinção é
    // a mesma que fez a Central declarar R$ 490 de receita com R$ 0 real em
    // 30/08: `null` significa NÃO SEI, nunca zero.
    partes.push(`_Não consegui conferir: ${naoConferido.join(', ')}._`)
  }

  partes.push('')
  partes.push('O e-mail tem o detalhe de cada um.')
  return partes.join('\n')
}
