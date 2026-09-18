---
name: higgsfield
description: "When the user wants to generate image or video through the Higgsfield platform API specifically, or asks about the model catalog behind openhiggsfield.ai. Also use when the user mentions 'Higgsfield,' 'OpenHiggsfield,' 'Soul 2,' 'Soul Cinema,' 'Seedance 2.5,' 'Kling 3,' 'Kling Motion Control,' 'Wan 3 Prime,' 'Z-Image Turbo,' 'Happy Horse,' 'DoP,' 'platform key id:secret,' 'HF_API_BASE_URL,' 'text-to-video,' 'image-to-video,' 'reference-to-video,' or asks which settings a given Higgsfield model accepts. This skill is the API CONTRACT and the model allow-list, not creative strategy: for what image to make, see image; for what video to make, see video; for paid ad creative, see ad-creative. Do NOT reach for this skill just because someone says 'generate an image': it only applies when the Higgsfield platform is the chosen provider."
metadata:
  version: 1.0.0
---

# Higgsfield: o contrato da plataforma

Esta skill existe por um motivo estreito: as skills `image` e `video` sabem **o
que** gerar e não sabem **quais parâmetros cada modelo aceita**. Mandar
`resolution: "4k"` para um modelo que só aceita `720p` e `1080p` devolve erro da
plataforma depois de a pessoa ter escrito o prompt inteiro.

O catálogo completo, com a allow-list por modelo, está em
[references/catalogo.md](references/catalogo.md). Ele foi extraído executando o
catálogo real de `github.com/wide-trace/open-higgsfield` em 18/09/2026, não
transcrito de documentação.

## ANTES DE QUALQUER COISA: isto aqui não está ligado

    HF_API_BASE_URL         AUSENTE no .env.local
    HIGGSFIELD_API_KEY      AUSENTE no .env.local

A plataforma é **paga** e a chave tem a forma `id:secret`. Sem as duas
variáveis, nada nesta skill executa, e a resposta honesta para "gera uma imagem
com Soul 2" é dizer que a credencial não existe, não montar a requisição e
torcer.

**O projeto já tem alternativa configurada**: o MCP do Replicate, que responde
hoje e já gerou criativo aqui. Quando a pergunta for só "preciso de uma imagem",
o Replicate é o caminho; esta skill é para quando a Higgsfield for a escolha
declarada.

## As três travas do Velo Funil, e elas vêm antes do prompt

Modelo de vídeo que gera pessoa falando é exatamente a ferramenta que quebra as
decisões travadas deste projeto. Elas não são preferência de estilo:

**1. Nada de prova social inventada.** A `StatsSection` já teve métrica falsa
copiada de concorrente, removida de propósito. Um vídeo gerado com alguém
dizendo que usa o Velo Funil é a mesma coisa com outro meio, e com o CNPJ ativo
e o sócio nomeado no rodapé vira infração de CONAR direta. **Vídeo só entra como
DEMONSTRAÇÃO, na primeira pessoa da marca.**

**2. O padrão visual é um só.** Todo criativo do Velo Funil usa o mesmo modelo
de marca, nunca varia por peça. Se a saída da plataforma não passa pelos
geradores de `scripts/marketing/`, ela não é criativo do produto, é ilustração
solta.

**3. Preço não se digita na arte.** `oferta-nas-artes.test.ts` proíbe `R$
<numero>` no código de um gerador, porque arte com número digitado não avisa
quando passa a mentir. Isso vale para o prompt também: pedir "banner com R$ 97"
produz um pixel que ninguém vai atualizar quando o preço mudar.

## O contrato, medido no código e não suposto

```
POST   {HF_API_BASE_URL}/{caminho-do-modelo}
       Authorization: Key {id}:{secret}
       Content-Type: application/json
       -> { request_id, status, status_url, cancel_url }

GET    {HF_API_BASE_URL}/requests/{request_id}/status
       -> { status, images: [{url}], video: {url}, error }
```

É **assíncrono**: o POST enfileira e devolve `request_id`, e o resultado sai no
`GET /status`. Tratar o 200 do POST como "pronto" é o erro que este projeto já
pagou em 12/09, quando o `sendButtons` respondeu 201 quatro vezes e nada
renderizou. **Aceitar não é entregar.**

### Os três caminhos de vídeo

    /{prefixo}/text-to-video        só prompt
    /{prefixo}/image-to-video       prompt + image_url (e last_image_url)
    /{prefixo}/reference-to-video   prompt + image_urls[]

### O corpo usa snake_case, e o catálogo usa camelCase

Esta é a fonte de erro mais provável, porque os dois nomes convivem no mesmo
fluxo:

    catálogo (allow-list)     corpo da requisição
    aspectRatio               aspect_ratio
    batchSize                 batch_size
    enhancePrompt             enhance_prompt
    cfgScale                  cfg_scale
    multiShots                multi_shots
    keepOriginalSound         keep_original_sound  ("yes" / "no", não booleano)
    characterOrientation      character_orientation
    sound                     sound                ("on" / "off", não booleano)
    duration                  duration
    resolution                resolution

**`sound` e `keepOriginalSound` não são booleanos na requisição.** O catálogo os
declara como `boolean`, e o mapeador converte para `"on"/"off"` e `"yes"/"no"`.
Mandar `true` é um 400 que parece defeito de credencial.

## Como escolher o modelo

Leia [references/catalogo.md](references/catalogo.md) e case por **papel de
mídia**, não por nome bonito:

    só texto                     soul-2, soul-cinema
    texto + até 8 referências    flux-2, ideogram-4, recraft-4.1, qwen-image-3,
                                 grok-imagine-2, z-image-turbo
    primeiro quadro              a maioria dos vídeos, roles.start = 1
    primeiro E último quadro     kling-3-std/pro/4k, kling-o1, kling-o3,
                                 seedance-2*, seedance-2.5
    editar vídeo existente       seedance-2.5-edit, kling-3-motion-*
    estender vídeo               seedance-2.5-extend

Um modelo com `roles: {}` **não aceita imagem nenhuma**. Mandar `image_url` para
`soul-2` não é ignorado em silêncio: é 400.

## O que esta skill NÃO é

**Não é o app.** `open-higgsfield` é uma aplicação Next.js 16 / React 19
completa. O Velo Funil é Next 14.2.35 / React 18, e as duas não se fundem. Se a
interface visual for o que se quer, ela roda **separada**, em outra pasta e em
outra porta, e o CRM não é tocado.

**Não é estratégia de criativo.** Qual peça fazer, qual gancho, qual formato:
`ad-creative`, `image`, `video`, `social`. Esta aqui responde "este modelo aceita
9:16?" e mais nada.
