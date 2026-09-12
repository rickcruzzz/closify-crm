# O disparo de prospecção rodando na VPS, para não depender da máquina do dono.
#
# ## Por que `next dev` e NÃO `next build` + `next start`
#
# Parece erro e não é. A fila de prospecção vive em `/dono/prospeccao/fila`, que
# passa por `exigirAmbienteLocal()` — e esse gate exige **`NODE_ENV ===
# 'development'`**. Em produção a Central inteira devolve 404, por desenho.
#
# O gate existe porque `lib/dono/**` lê com `createAdminClient()`, que ignora
# RLS: nome, e-mail, telefone e valor de negócio de TODOS os clientes. Isso não
# é bug de UI, é vazamento sob a LGPD.
#
# ## Os DOIS processos no MESMO container, e isso é a trava de segurança
#
# O gate tem duas fechaduras: `NODE_ENV` e o cabeçalho `Host` ser loopback.
# Separar em dois serviços faria o disparo chamar `http://velo-fila:3000`, cujo
# `Host` **não é loopback** — e o gate devolveria 404, corretamente.
#
# Dentro de um container, `localhost` é verdade de verdade. Não é contornar o
# gate: é satisfazê-lo honestamente.
#
# ## E a fechadura do `Host` é FORJÁVEL — por isso o `-H 127.0.0.1`
#
# `Host:` é cabeçalho que o cliente escolhe. `curl -H "Host: localhost:3000"
# http://<ip-da-vps>:3000/dono` passaria pelo gate e devolveria a base inteira.
# Ele protege contra o navegador de alguém na mesma rede (o navegador preenche
# o `Host` pela URL), não contra quem quer entrar.
#
# A defesa real está no `scripts/vps/subir.sh`: o servidor escuta **só em
# 127.0.0.1**. Mesmo que a porta seja publicada por engano, não há o que
# alcançar. E no EasyPanel o serviço não recebe domínio.
#
# ## O estado precisa de VOLUME, e sem ele o estrago é imediato
#
# `.dono-prospeccao.json` não está no Git — é o registro do que já saiu. Num
# container novo ele nasce vazio, e a fila veria as 837 como "novas",
# **incluindo as que já receberam**. Segunda abordagem depois de um contato é o
# primeiro item da lista do que derruba um número.
#
#     EasyPanel -> Serviço -> Volumes
#     /app/.dono-prospeccao.json   ->  volume proprio
#
# Copie o arquivo da máquina do dono para lá ANTES do primeiro `--confirmar`.

FROM node:20-slim

# `curl` é usado pelo entrypoint para esperar o servidor subir. `git` porque o
# `next dev` consulta o repositório em alguns caminhos de build.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# As dependências numa camada própria: elas mudam bem menos que o código, e
# assim um commit de texto não reinstala 900 pacotes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x scripts/vps/subir.sh

# Declarado aqui, e não só no painel: o gate lê `process.env.NODE_ENV`, e
# depender de alguém lembrar de marcar uma caixa no EasyPanel faria o container
# subir com a Central em 404 e o disparo sem fila — falhando por configuração,
# com aparência de defeito.
ENV NODE_ENV=development

# Documental: o EasyPanel não precisa disso para o Traefik, e o servidor escuta
# só em 127.0.0.1 de qualquer forma.
EXPOSE 3000

CMD ["./scripts/vps/subir.sh"]
