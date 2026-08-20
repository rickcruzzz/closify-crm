import { describe, expect, it } from 'vitest'

import { analisar, posicionamentosPara, proporcaoDe, type Candidato } from './posicionamentos'

function video(sobrescrever: Partial<Candidato> = {}): Candidato {
  return {
    tipo: 'video',
    largura: 1080,
    altura: 1920,
    peso: 20 * 1024 * 1024,
    duracao: 30,
    mime: 'video/mp4',
    ...sobrescrever,
  }
}

function imagem(sobrescrever: Partial<Candidato> = {}): Candidato {
  return {
    tipo: 'imagem',
    largura: 1080,
    altura: 1080,
    peso: 800 * 1024,
    mime: 'image/png',
    ...sobrescrever,
  }
}

describe('proporcaoDe', () => {
  it('reconhece as três proporções do Meta', () => {
    expect(proporcaoDe(1080, 1080)).toBe('1:1')
    expect(proporcaoDe(1080, 1350)).toBe('4:5')
    expect(proporcaoDe(1080, 1920)).toBe('9:16')
  })

  // O Meta redimensiona; o que ele não conserta é proporção. Recusar o dobro
  // do tamanho seria pedir retrabalho por nada.
  it('reconhece a proporção em qualquer escala', () => {
    expect(proporcaoDe(2160, 2160)).toBe('1:1')
    expect(proporcaoDe(2160, 3840)).toBe('9:16')
  })

  // Editor de vídeo arredonda: 1079×1920 é 9:16 na prática.
  it('tolera o arredondamento de editor de vídeo', () => {
    expect(proporcaoDe(1079, 1920)).toBe('9:16')
  })

  it('recusa proporção que o Meta não tem', () => {
    expect(proporcaoDe(1920, 1080)).toBeNull() // paisagem 16:9
    expect(proporcaoDe(1080, 1440)).toBeNull() // 3:4
    expect(proporcaoDe(0, 0)).toBeNull()
  })
})

describe('posicionamentosPara', () => {
  it('vertical serve Stories, Reels e Audience Network', () => {
    const nomes = posicionamentosPara('9:16').map((p) => p.nome)
    expect(nomes).toContain('Reels do Instagram')
    expect(nomes).toContain('Stories do Facebook')
    expect(nomes).toContain('Audience Network')
  })

  it('4:5 serve os dois feeds', () => {
    expect(posicionamentosPara('4:5').map((p) => p.nome)).toEqual([
      'Feed do Facebook',
      'Feed do Instagram',
    ])
  })

  it('sem proporção, nenhum posicionamento', () => {
    expect(posicionamentosPara(null)).toEqual([])
  })
})

describe('analisar', () => {
  describe('aprova o que está bom', () => {
    it('vídeo vertical de 30s em MP4', () => {
      const r = analisar(video())
      expect(r.aprovado).toBe(true)
      expect(r.reprovacoes).toEqual([])
      expect(r.proporcao).toBe('9:16')
      expect(r.posicionamentos.length).toBeGreaterThan(0)
    })

    it('imagem quadrada 1080', () => {
      const r = analisar(imagem())
      expect(r.aprovado).toBe(true)
      expect(r.posicionamentos.map((p) => p.nome)).toContain('Marketplace')
    })
  })

  describe('reprova o que quebra', () => {
    it('proporção que não existe no Meta', () => {
      const r = analisar(video({ largura: 1920, altura: 1080 }))
      expect(r.aprovado).toBe(false)
      expect(r.reprovacoes.some((x) => x.campo === 'proporção')).toBe(true)
    })

    // Abaixo de 1080 a peça aparece esticada no celular, que é quase todo o
    // inventário do Meta.
    it('resolução abaixo de 1080px de largura', () => {
      const r = analisar(imagem({ largura: 720, altura: 720 }))
      expect(r.aprovado).toBe(false)
      const falha = r.reprovacoes.find((x) => x.campo === 'resolução')
      expect(falha?.comoResolver).toContain('1080px')
    })

    it('formato que o Meta recusa', () => {
      expect(analisar(video({ mime: 'video/x-msvideo' })).aprovado).toBe(false)
      expect(analisar(imagem({ mime: 'image/gif' })).aprovado).toBe(false)
    })

    it('vídeo vertical maior que os 90s dos Reels', () => {
      const r = analisar(video({ duracao: 120 }))
      expect(r.aprovado).toBe(false)
      expect(r.reprovacoes.some((x) => x.campo === 'duração')).toBe(true)
    })

    // O mesmo vídeo longo em formato de feed passa: o limite de 90s é do
    // vertical, não de todo lugar.
    it('mas aceita o mesmo tempo em formato de feed', () => {
      expect(analisar(video({ largura: 1080, altura: 1350, duracao: 120 })).aprovado).toBe(true)
    })

    it('arquivo acima do teto de 4 GB', () => {
      const r = analisar(video({ peso: 5 * 1024 * 1024 * 1024 }))
      expect(r.aprovado).toBe(false)
      expect(r.reprovacoes.some((x) => x.campo === 'tamanho')).toBe(true)
    })

    it('toda reprovação explica o que fazer', () => {
      const r = analisar(video({ largura: 640, altura: 480, mime: 'video/avi', duracao: 0.5 }))
      expect(r.reprovacoes.length).toBeGreaterThan(1)
      for (const rep of r.reprovacoes) {
        expect(rep.motivo.length).toBeGreaterThan(10)
        expect(rep.comoResolver.length).toBeGreaterThan(10)
      }
    })
  })

  describe('ressalva o que só custa desempenho', () => {
    // Bloquear o que apenas rende menos seria decidir pelo dono.
    it('vídeo longo passa, mas avisa', () => {
      const r = analisar(video({ largura: 1080, altura: 1350, duracao: 180 }))
      expect(r.aprovado).toBe(true)
      expect(r.ressalvas.some((x) => x.includes('15 a 60'))).toBe(true)
    })

    it('vídeo curto demais passa, mas avisa', () => {
      const r = analisar(video({ duracao: 3 }))
      expect(r.aprovado).toBe(true)
      expect(r.ressalvas.some((x) => x.includes('curto demais'))).toBe(true)
    })

    it('arquivo pesado passa, mas avisa', () => {
      const r = analisar(video({ peso: 2 * 1024 * 1024 * 1024 }))
      expect(r.aprovado).toBe(true)
      expect(r.ressalvas.some((x) => x.includes('1 GB'))).toBe(true)
    })

    // A zona segura vertical: onde a interface do Meta cobre o vídeo.
    it('vertical lembra da zona segura', () => {
      expect(analisar(video()).ressalvas.some((x) => x.includes('14%'))).toBe(true)
    })

    it('vídeo quadrado sugere o vertical', () => {
      const r = analisar(video({ largura: 1080, altura: 1080 }))
      expect(r.aprovado).toBe(true)
      expect(r.ressalvas.some((x) => x.includes('vertical'))).toBe(true)
    })
  })
})
