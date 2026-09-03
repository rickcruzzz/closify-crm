"""
Reduz as fontes ao alfabeto que este produto de fato desenha.

    python scripts/subconjunto-de-fontes.py

## Por que isto existe

A LCP da landing e o download da FONTE, medido em 03/09 contra producao:
bloqueando os dois arquivos, a LCP cai de 3.299ms para 2.217ms e passa a
IGUALAR a FCP. Texto so conta para a LCP quando pinta com a fonte final,
entao 111 KB de woff2 num 4G lento sao, literalmente, a metrica.

O Geist vem com o alfabeto inteiro que a fundicao desenhou. Este produto e
pt-BR e desenha nome de pessoa e de empresa — ou seja, precisa de latino
acentuado e de mais nada. Varrido o codigo inteiro: 141 caracteres distintos,
e apenas TRES fora de latin+latin-ext (BOM, caractere de substituicao e um
emoji, nenhum deles desenhado pelo Geist).

## O que este script NAO faz, de proposito

Nao instancia o eixo de peso. As fontes sao variaveis (100-900) e o produto
usa de `font-normal` a `font-semibold`; achatar em um peso so economizaria
mais e quebraria a tipografia.

Mantem todas as features de OpenType (`--layout-features=*`). Cortar kerning
para ganhar 2 KB e trocar acabamento por byte no lugar errado.

Mora em `scripts/` e nao em `scripts/marketing/` de proposito: o teste de arte
(`lib/marketing/oferta-nas-artes.test.ts`) varre todo `.py` daquela pasta supondo
que desenha peca, e este mexe na fonte do SITE.

Os `.woff` originais em `app/fonts/` NAO sao tocados: os geradores de
criativos em Python os carregam pelo Pillow, que nao le woff2.
"""
import subprocess, sys, shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
FONTES = RAIZ / "app" / "fonts"

# As faixas `latin` e `latin-ext` do Google Fonts, MAIS quatro blocos que a
# conferencia de cobertura mostrou faltando na primeira rodada.
#
# `U+0300-036F` (diacriticos combinantes) e o unico que importa de verdade, e
# nao estava na lista do Google: texto em NFD escreve "e" seguido de acento
# combinante em vez do caracter unico. Nome de cliente chega assim do macOS e de
# planilha exportada por certos sistemas — sem esses glifos, o acento cairia
# numa fonte de reserva e sairia deslocado, so para alguns nomes. Sao ~110
# glifos leves.
#
# Os outros tres (setas, operadores, moldura) so aparecem em COMENTARIO do
# codigo hoje. Entram porque a varredura os viu e porque custam quase nada:
# manter a lista alinhada com o que a conferencia cobra evita a proxima rodada
# gastar tempo decidindo de novo se cada um e falso positivo.
FAIXAS = ",".join([
    "U+0000-00FF", "U+0100-02AF", "U+0300-036F", "U+0329",
    "U+1E00-1E9F", "U+1EF2-1EFF", "U+2000-206F", "U+2074", "U+20A0-20AB",
    "U+20AC", "U+20AD-20C0", "U+2113", "U+2122", "U+2190-21FF",
    "U+2200-22FF", "U+2212", "U+2215", "U+2500-257F",
    "U+2C60-2C7F", "U+A720-A7FF", "U+FEFF", "U+FFFD",
])

def subconjunto(nome: str) -> None:
    origem = FONTES / nome
    guarda = FONTES / (nome + ".completa")
    if not guarda.exists():
        shutil.copy2(origem, guarda)   # o original fica, para poder refazer
    antes = guarda.stat().st_size
    saida = FONTES / (nome + ".novo")
    subprocess.run([
        sys.executable, "-m", "fontTools.subset", str(guarda),
        "--unicodes=" + FAIXAS,
        "--layout-features=*",
        "--flavor=woff2",
        "--output-file=" + str(saida),
    ], check=True)
    depois = saida.stat().st_size
    saida.replace(origem)
    print(f"  {nome:22} {antes:>7} -> {depois:>7} bytes  ({100 - depois * 100 // antes}% menor)")

print("subconjunto latin + latin-ext:")
for f in ["GeistVF.woff2", "GeistMonoVF.woff2"]:
    subconjunto(f)
