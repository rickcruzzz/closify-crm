/**
 * A identidade descartável da rodada: e-mail, senha, nome da empresa e CPF.
 *
 * Tudo carrega o mesmo carimbo de tempo para que, se a limpeza falhar, dê para
 * achar e apagar o que sobrou procurando por `velofunil-teste` no banco, no
 * Asaas e no Resend.
 */

/**
 * O e-mail vai para o Gmail real do dono usando o sufixo `+`: o Gmail entrega
 * `fulano+algo@gmail.com` na caixa de `fulano@gmail.com`. É o que permite
 * provar a entrega de verdade (o dono vê chegar) sem inventar uma caixa
 * descartável que ninguém abre.
 */
const GMAIL_DO_DONO = 'pedroescobar90sb@gmail.com'

export type IdentidadeDeTeste = {
  email: string
  senha: string
  nome: string
  empresa: string
  cpf: string
  carimbo: string
}

export function criarIdentidade(): IdentidadeDeTeste {
  const carimbo = Date.now().toString()
  const [usuario, dominio] = GMAIL_DO_DONO.split('@')

  return {
    email: `${usuario}+velofunil-teste-${carimbo}@${dominio}`,
    // Precisa passar no medidor de força do cadastro: maiúscula, minúscula,
    // número e símbolo.
    senha: `Teste!${carimbo.slice(-6)}Aa1`,
    nome: 'Conta de Teste E2E',
    empresa: `Teste E2E ${carimbo.slice(-6)}`,
    cpf: gerarCpfValido(),
    carimbo,
  }
}

/**
 * CPF sintético com dígito verificador correto.
 *
 * Precisa ser válido de verdade porque `checkoutSchema`
 * (lib/validations/billing.ts) confere o dígito antes de qualquer chamada de
 * rede, e o Asaas confere de novo do lado dele. Gerar pelo algoritmo é o
 * único caminho honesto: usar o CPF de uma pessoa real em teste automatizado
 * criaria cobrança no nome dela, que é exatamente o defeito que
 * `docs/estado-atual.md` registra no caso das duas cobranças órfãs.
 *
 * O algoritmo é o mesmo de `validarCpf`, só que resolvido ao contrário.
 */
export function gerarCpfValido(): string {
  const base: number[] = []
  for (let i = 0; i < 9; i++) {
    base.push(Math.floor(Math.random() * 10))
  }
  // Nove dígitos iguais reprovam em `digitosIguais`, refaz nesse caso.
  if (base.every((d) => d === base[0])) return gerarCpfValido()

  const calcular = (digitos: number[], ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) {
      soma += digitos[i] * (ate + 1 - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  base.push(calcular(base, 9))
  base.push(calcular(base, 10))
  return base.join('')
}
