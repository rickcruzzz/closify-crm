import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import 'server-only'

import { lerManifesto, type Destaque } from './destaques'

/**
 * Lê o manifesto que `scripts/marketing/gerar-stories.py` grava.
 *
 * ## Por que o mapa vem de um arquivo, e não deste código
 *
 * O script escreve `destaques.json` na mesma passada em que desenha as telas,
 * porque é lá que a copy de fato vive. Redigitar título aqui criaria duas
 * versões da mesma frase — e a que alguém lê é sempre a errada.
 *
 * Arquivo ausente devolve lista vazia em vez de estourar: a tela explica como
 * gerar, o que é mais útil que um erro numa página que só existe para ajudar.
 */
export async function listarDestaques(): Promise<Destaque[]> {
  const manifesto = join(process.cwd(), 'marketing', 'instagram', 'destaques.json')

  try {
    return lerManifesto(await readFile(manifesto, 'utf-8'))
  } catch {
    return []
  }
}
