#!/bin/sh
# O entrypoint do container de prospeccao na VPS.
#
# Dois processos, nesta ordem, e a ordem importa: o disparo le a fila do
# servidor local, entao ele precisa esperar o servidor existir. Sem a espera,
# o script aborta no primeiro segundo com "nao consegui ler a fila" e o
# container reinicia em laco.
#
# O porque de tudo isto estar num container so, e nao em dois servicos, esta no
# cabecalho do `Dockerfile`.

set -e

PORTA="${PORT:-3000}"

# ## `-H 127.0.0.1` e a linha mais importante deste arquivo
#
# `next dev` escuta em TODAS as interfaces por padrao. Na maquina do dono isso
# ja e ruim (qualquer um no mesmo Wi-Fi abre a Central); numa VPS com IP
# publico e vazamento direto.
#
# O gate de `exigirAmbienteLocal()` confere o cabecalho `Host`, e `Host` e
# escolhido por quem chama: `curl -H "Host: localhost:3000"` passaria por ele.
# A unica defesa que nao depende de boa-fe do cliente e o servidor NAO ESCUTAR
# na interface externa. E isto.
echo "subindo o servidor local em 127.0.0.1:${PORTA}"
npx next dev -H 127.0.0.1 -p "${PORTA}" &
SERVIDOR=$!

# Se o servidor morrer, o container inteiro cai — e o EasyPanel reinicia. O
# contrario (disparo vivo com servidor morto) daria uma rodada que falha em
# toda mensagem e queima o contador de erro.
trap 'kill "${SERVIDOR}" 2>/dev/null' EXIT INT TERM

# A primeira compilacao do `next dev` leva minutos. 180 tentativas x 5s = 15
# min de teto: acima disso o problema e outro, e falhar rapido expoe isso em
# vez de esconder.
echo "esperando a fila responder..."
i=0
until curl -sf "http://localhost:${PORTA}/dono/prospeccao/fila" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 180 ]; then
    echo "a fila nao respondeu em 15 min. Conferir NODE_ENV=development e as variaveis do Supabase."
    exit 1
  fi
  sleep 5
done
echo "fila respondendo."

# ## O disparo, e o ENSAIO e o padrao
#
# Sem `PROSPECCAO_CONFIRMAR=1` nada e enviado: o script roda, imprime a fila e
# sai. E o padrao porque disparar para centenas nao pode ser efeito colateral
# de um deploy.
#
# O primeiro deploy DEVE rodar assim, e o log tem que dizer "ja com marca 100+".
# Se disser "ja com marca 0", o volume do `.dono-prospeccao.json` nao pegou — e
# ligar o envio nesse estado reenviaria para quem ja recebeu.
CONFIRMAR=""
if [ "${PROSPECCAO_CONFIRMAR}" = "1" ]; then
  CONFIRMAR="--confirmar"
  echo "MODO ENVIO: as mensagens VAO SAIR."
else
  echo "MODO ENSAIO: nada sera enviado. Para enviar, PROSPECCAO_CONFIRMAR=1."
fi

exec node scripts/inteligencia/enviar-evolution.mjs \
  ${CONFIRMAR} \
  --ignorar-horario \
  --max="${PROSPECCAO_MAX:-200}" \
  --so-aprovados \
  --bloco="${PROSPECCAO_BLOCO:-25}"
