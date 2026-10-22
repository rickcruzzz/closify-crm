import { describe, expect, it } from 'vitest'
import { enderecoPublico } from '@/lib/enterprise/imagem'

describe('endereços para baixar imagens de empresas', () => {
  it('recusa loopback, redes privadas e endereços de metadados', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.1.1', '192.168.0.1', '169.254.169.254', '100.64.1.2', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) expect(enderecoPublico(ip)).toBe(false)
  })
  it('aceita endereços públicos IPv4 e IPv6', () => {
    expect(enderecoPublico('1.1.1.1')).toBe(true)
    expect(enderecoPublico('2606:4700:4700::1111')).toBe(true)
  })
})
