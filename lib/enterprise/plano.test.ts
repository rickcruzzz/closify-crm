import { describe, expect, it } from 'vitest'

import {
  ENTERPRISE_COLABORADORES,
  ENTERPRISE_MEMBER_LIMIT,
  ocupacaoDeColaboradoresEnterprise,
} from './plano'

const agora = new Date('2026-10-22T12:00:00Z')
const proprietario = { user_id: 'proprietario', role: 'admin' }
const colaboradores = Array.from({ length: 5 }, (_, index) => ({
  user_id: `colaborador-${index}`,
  role: index === 0 ? 'admin' : 'membro',
}))
const reserva = { expires_at: '2026-10-23T12:00:00Z' }

describe('vagas de colaboradores Enterprise', () => {
  it('inclui o proprietário além dos cinco colaboradores', () => {
    expect(ENTERPRISE_MEMBER_LIMIT).toBe(6)
    expect(
      ocupacaoDeColaboradoresEnterprise([proprietario], [], proprietario.user_id, agora),
    ).toBe(0)
  })

  it('permite reservar a quinta vaga e impede uma sexta', () => {
    const membros = [proprietario, ...colaboradores.slice(0, 4)]
    expect(
      ocupacaoDeColaboradoresEnterprise(membros, [], proprietario.user_id, agora),
    ).toBeLessThan(ENTERPRISE_COLABORADORES)
    expect(
      ocupacaoDeColaboradoresEnterprise(membros, [reserva], proprietario.user_id, agora),
    ).toBe(ENTERPRISE_COLABORADORES)
  })

  it('aceitar a quinta reserva mantém cinco vagas ocupadas, incluindo outros admins', () => {
    expect(
      ocupacaoDeColaboradoresEnterprise(
        [proprietario, ...colaboradores],
        [],
        proprietario.user_id,
        agora,
      ),
    ).toBe(ENTERPRISE_COLABORADORES)
  })

  it('convite vencido, cancelamento e remoção liberam a vaga', () => {
    const membros = [proprietario, ...colaboradores.slice(0, 4)]
    const vencidos = [
      { expires_at: '2026-10-21T12:00:00Z' },
      { expires_at: agora.toISOString() },
    ]
    expect(
      ocupacaoDeColaboradoresEnterprise(membros, vencidos, proprietario.user_id, agora),
    ).toBe(4)
    expect(
      ocupacaoDeColaboradoresEnterprise(membros, [], proprietario.user_id, agora),
    ).toBe(4)
  })

  it('não isenta outro administrador quando o proprietário está ausente', () => {
    expect(
      ocupacaoDeColaboradoresEnterprise(colaboradores, [], proprietario.user_id, agora),
    ).toBe(5)
    expect(ocupacaoDeColaboradoresEnterprise(colaboradores, [], null, agora)).toBe(5)
  })
})
