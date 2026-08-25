#!/usr/bin/env bash
#
# Reinicia o Evolution quando o laço de eventos dele morre.
#
# ## O que isto detecta, e por que nada mais detecta
#
# O processo do Evolution GO vira zumbi: a camada HTTP responde, `/send/text`
# funciona, `/instance/status` devolve `connected` — e a goroutine que recebe
# mensagem está morta. Aconteceu duas vezes em 25/08. Na segunda, três horas
# se passaram antes de alguém reparar.
#
# Nenhum sinal comum pega isso:
#
#   `restart: unless-stopped`  o container NÃO morre, só a goroutine
#   `/instance/status`         lê do Postgres do Evolution, não sonda o cliente
#   `/instance/logs`           buffer de 100 linhas que congela junto
#   healthcheck HTTP           responde 200 mesmo zumbi
#
# A única evidência que o zumbi não consegue falsificar é o RELÓGIO DO LOG.
# Um processo vivo escreve; um morto não. Comparar a última linha do log com a
# hora atual separa os dois estados sem depender de nada que o Evolution diga
# sobre si mesmo.
#
# ## Por que no host, e não como healthcheck do container
#
# A imagem é mínima: só tem `wget`, sem `date` nem `stat`. E `LOGTYPE: console`
# manda o log para stdout, então não há arquivo dentro do container para
# inspecionar. Do host, `docker logs --timestamps` resolve os dois problemas.
#
# ## Instalação
#
#   scp scripts/vps/vigiar-evolution.sh root@VPS:/usr/local/bin/
#   chmod +x /usr/local/bin/vigiar-evolution.sh
#   (unidade e timer do systemd em scripts/vps/vigiar-evolution.timer)

set -uo pipefail

CONTAINER="${CONTAINER:-evolution-go-jinn-api-1}"

# Quinze minutos. O Evolution escreve log a cada poucos minutos em operação
# normal — conexão, ping, mensagem. Um valor menor reiniciaria durante uma
# pausa legítima de madrugada; um maior deixaria a queda durar mais que o
# necessário. O vigia de fluxo do produto (limiar de 2h) é a segunda rede,
# para o caso de esta falhar.
SILENCIO_MAXIMO_S="${SILENCIO_MAXIMO_S:-900}"

registrar() {
  echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') vigiar-evolution: $*"
}

# `--timestamps` faz o Docker prefixar cada linha com a hora em que ELE a
# recebeu, em UTC e RFC3339. É diferente do relógio que o Evolution imprime no
# corpo da linha, e melhor: não depende do fuso nem do formato do aplicativo.
ultima_linha=$(docker logs --timestamps --tail 1 "$CONTAINER" 2>&1 | tail -1)

if [ -z "$ultima_linha" ]; then
  registrar "sem log nenhum; container pode estar subindo agora, não vou mexer"
  exit 0
fi

carimbo=$(printf '%s' "$ultima_linha" | awk '{print $1}')
ultimo_s=$(date -u -d "$carimbo" +%s 2>/dev/null)

if [ -z "${ultimo_s:-}" ]; then
  # Carimbo ilegível é problema de instrumentação, não do Evolution. Reiniciar
  # por não conseguir ler o relógio trocaria uma falha silenciosa por outra.
  registrar "não consegui ler o carimbo de tempo ($carimbo); nada feito"
  exit 0
fi

agora_s=$(date -u +%s)
silencio=$((agora_s - ultimo_s))

if [ "$silencio" -lt "$SILENCIO_MAXIMO_S" ]; then
  exit 0
fi

registrar "log parado há ${silencio}s (limite ${SILENCIO_MAXIMO_S}s) — reiniciando"

if docker restart "$CONTAINER" >/dev/null 2>&1; then
  # A sessão volta sozinha: o `jid` fica no Postgres do Evolution e ele
  # reautentica no boot (`Already logged in with JID`). Ninguém precisa
  # escanear QR de novo — conferido nas duas quedas de 25/08.
  registrar "reiniciado"
else
  registrar "FALHA ao reiniciar"
  exit 1
fi
