"""
Confere as pecas de anuncio contra o que o Meta exige de cada posicionamento.

    python scripts/marketing/conferir-criativos.py
    python scripts/marketing/conferir-criativos.py --pasta criativos/organico

## O que este script NAO faz, e e a parte mais importante

Ele nao diz que a peca esta boa. Ele diz que ela nao esta obviamente quebrada.

Tres defeitos desta familia foram achados em 02/09, e **os tres so apareceram
ao ABRIR o PNG e olhar**: o rotulo do eixo sobreposto a linha de fonte no 1:1,
os rotulos do Kanban por cima do claim no 9:16, e o dominio desenhado FORA da
tela na peca de ancora de preco — este ultimo em toda proporcao, desde sempre,
inclusive no 4:5 que ja tinha ido ao ar.

Nenhum deles seria pego aqui. Colisao de texto e de pixel, e reconhece-la exige
ler a arte. O que da para automatizar e o que esta abaixo: medida, proporcao e
zona coberta pela interface. E util porque e barato e roda em todo arquivo —
nao porque substitui o olho.

## A ordem certa

    1. gerar
    2. rodar isto            pega medida errada em um segundo
    3. ABRIR e olhar         pega o resto, que e a maior parte
"""

import argparse
import struct
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]

# As tres proporcoes que os posicionamentos do Meta pedem, com a mesma
# tolerancia de `lib/dono/formatos-do-meta.ts` (2%) — a Central do dono ja
# recusa upload fora disso, e duas tolerancias diferentes para a mesma regra
# divergem na primeira vez que uma for ajustada.
PROPORCOES = {
    "1:1": 1.0,
    "4:5": 0.8,
    "9:16": 1080 / 1920,
}
TOLERANCIA = 0.02

# O Meta manda no minimo 1080 de largura. Abaixo disso a peca sobe, e ele
# amplia — e ampliar borra a tipografia mono de 21px do rodape antes de
# qualquer outra coisa.
LARGURA_MINIMA = 1080

# ## A zona segura do 9:16 nao e escolha de gosto
#
# Stories e Reels desenham a interface POR CIMA da arte: foto de perfil e nome
# no topo, legenda e botao de acao no rodape. O Meta unificou as reservas em
# torno do Reels (o mais restritivo) em marco de 2026: 14% no topo e 20% na
# base. Texto ali nao e cortado — e COBERTO, o que e pior, porque a peca
# continua parecendo inteira para quem a gerou.
ZONA_SEGURA_9X16 = dict(topo=0.14, base=0.20)


def medir_png(caminho: Path) -> tuple[int, int]:
    """Largura e altura pelo cabecalho IHDR, sem depender de Pillow."""
    with open(caminho, "rb") as f:
        if f.read(8) != b"\x89PNG\r\n\x1a\n":
            raise ValueError(f"{caminho.name}: nao e PNG")
        f.read(8)                       # tamanho do chunk + "IHDR"
        return struct.unpack(">II", f.read(8))


def classificar(largura: int, altura: int) -> str | None:
    prop = largura / altura
    for nome, alvo in PROPORCOES.items():
        if abs(prop - alvo) <= TOLERANCIA:
            return nome
    return None


def conferir_zona_coberta(caminho: Path, altura: int) -> list[str]:
    """Acusa conteudo desenhado onde a interface do Story vai passar.

    Compara com a cor do canto superior esquerdo, que e sempre fundo puro em
    toda peca deste gerador (a marca comeca depois da margem lateral). Uma
    faixa que so tem essa cor esta vazia; qualquer outra coisa e conteudo.
    """
    try:
        from PIL import Image
    except ImportError:
        return ["Pillow ausente, zona segura nao conferida"]

    avisos = []
    with Image.open(caminho) as im:
        im = im.convert("RGB")
        fundo = im.getpixel((0, 0))
        faixas = {
            "topo": (0, int(altura * ZONA_SEGURA_9X16["topo"])),
            "base": (altura - int(altura * ZONA_SEGURA_9X16["base"]), altura),
        }
        for nome, (y0, y1) in faixas.items():
            faixa = im.crop((0, y0, im.width, y1))
            # `getcolors` com teto alto devolve None se houver mais cores que
            # o teto — o que ja e resposta suficiente: faixa vazia tem uma cor.
            cores = faixa.getcolors(maxcolors=8)
            if cores is None or any(cor != fundo for _, cor in cores):
                pintados = sum(n for n, cor in (cores or []) if cor != fundo)
                avisos.append(
                    f"zona coberta ({nome}, {y1 - y0}px) tem conteudo"
                    + (f": ~{pintados} pixels" if cores else ""))
    return avisos


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pasta", default="criativos/anuncio",
                    help="pasta com as pecas (padrao: criativos/anuncio)")
    args = ap.parse_args()

    raiz = RAIZ / args.pasta
    if not raiz.exists():
        print(f"pasta nao existe: {raiz}")
        return 1

    arquivos = sorted(raiz.rglob("*.png"))
    if not arquivos:
        print(f"nenhum PNG em {raiz}")
        return 1

    reprovados = 0
    for f in arquivos:
        largura, altura = medir_png(f)
        rel = f.relative_to(raiz)
        problemas = []

        prop = classificar(largura, altura)
        if prop is None:
            problemas.append(
                f"proporcao {largura / altura:.3f} nao e 1:1, 4:5 nem 9:16")
        if largura < LARGURA_MINIMA:
            problemas.append(f"largura {largura} < {LARGURA_MINIMA}")
        if prop == "9:16":
            problemas.extend(conferir_zona_coberta(f, altura))

        if problemas:
            reprovados += 1
            print(f"  X  {rel}  {largura}x{altura}")
            for p in problemas:
                print(f"        {p}")
        else:
            print(f"  ok {rel}  {largura}x{altura}  {prop}")

    print(f"\n{len(arquivos) - reprovados} de {len(arquivos)} passaram")
    if reprovados:
        print(f"{reprovados} com problema de MEDIDA.")
        return 1

    print("\nMedida ok. Isto NAO diz que a arte esta certa:")
    print("  colisao de texto e de pixel, e so o olho pega.")
    print("  abra os PNG antes de subir.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
