/**
 * CPF e CNPJ: formatação e validação de dígito verificador.
 *
 * Sem a validação local, um CPF digitado errado só falhava lá no Asaas, e a
 * pessoa recebia "Não foi possível iniciar a assinatura no Asaas", mensagem
 * que não diz o que corrigir e faz parecer problema do sistema, não do dado.
 *
 * O dígito verificador é matemática pura: dá para reprovar na hora, antes de
 * qualquer chamada de rede.
 */

export function formatarCpfCnpj(entrada: string): string {
  const d = entrada.replace(/\D/g, '').slice(0, 14)
  if (!d) return ''

  // Abaixo de 12 dígitos ainda pode virar CPF, então formata como CPF; a
  // partir daí só CNPJ é possível.
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

function digitosIguais(valor: string): boolean {
  // 111.111.111-11 passa na conta do dígito verificador, mas não é CPF de
  // ninguém, a Receita trata como inválido e o Asaas também recusa.
  return /^(\d)\1+$/.test(valor)
}

export function validarCpf(entrada: string): boolean {
  const cpf = entrada.replace(/\D/g, '')
  if (cpf.length !== 11 || digitosIguais(cpf)) return false

  const calcula = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * (ate + 1 - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return calcula(9) === Number(cpf[9]) && calcula(10) === Number(cpf[10])
}

export function validarCnpj(entrada: string): boolean {
  const cnpj = entrada.replace(/\D/g, '')
  if (cnpj.length !== 14 || digitosIguais(cnpj)) return false

  const calcula = (ate: number) => {
    // Os pesos vão de 2 a 9, ciclicamente, da direita para a esquerda.
    let soma = 0
    let peso = ate - 7
    for (let i = 0; i < ate; i++) {
      soma += Number(cnpj[i]) * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return calcula(12) === Number(cnpj[12]) && calcula(13) === Number(cnpj[13])
}

/** Aceita CPF ou CNPJ, decidindo pelo tamanho. */
export function validarCpfCnpj(entrada: string): boolean {
  const d = entrada.replace(/\D/g, '')
  if (d.length === 11) return validarCpf(d)
  if (d.length === 14) return validarCnpj(d)
  return false
}
