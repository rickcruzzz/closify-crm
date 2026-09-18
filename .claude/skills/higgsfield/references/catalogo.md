# Catalogo da Higgsfield: 38 modelos, com a allow-list de cada um

Extraido em 18/09/2026 executando `src/generation/catalog/index.ts` de
`github.com/wide-trace/open-higgsfield`, e nao transcrito de documentacao.
Se o repositorio de origem mudar, este arquivo envelhece em silencio: a
plataforma nao publica o catalogo.

    imagem   8
    video    30
    total    38

Os nomes abaixo sao os do CATALOGO, em camelCase. O corpo da requisicao usa
snake_case, e a tabela de traducao esta no SKILL.md. Dois deles nao sao
booleanos na requisicao: `sound` vira `"on"/"off"` e `keepOriginalSound`
vira `"yes"/"no"`.

## Imagem

### `soul-2`, Soul 2

    midia de entrada   nenhum (so texto)
    aspectRatio         enum(9:16|16:9|4:3|3:4|1:1|2:3|3:2) = 1:1
    resolution          enum(720p|1080p) = 720p
    batchSize           enum(1|4) = 1
    enhancePrompt       boolean = false

### `soul-cinema`, Soul Cinema

    midia de entrada   nenhum (so texto)
    aspectRatio         enum(9:16|16:9|4:3|3:4|1:1|2:3|3:2) = 1:1
    resolution          enum(720p|1080p) = 720p
    batchSize           enum(1|4) = 1
    enhancePrompt       boolean = false

### `flux-2`, Flux 2

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

### `grok-imagine-2`, Grok Imagine 2.0

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

### `ideogram-4`, Ideogram 4.0

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

### `recraft-4.1`, Recraft 4.1

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

### `qwen-image-3`, Qwen Image 3

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

### `z-image-turbo`, Z-Image Turbo

    midia de entrada   reference x8
    aspectRatio         enum(auto|1:1|4:3|3:4|16:9|9:16) = 1:1
    resolution          enum(1k|2k|4k) = 1k

## Video

### `seedance-2.5`, Seedance 2.5

    midia de entrada   start x1, end x1, reference x30, video x10, audio x10
    aspectRatio         enum(16:9|4:3|1:1|3:4|9:16|21:9) = 16:9
    duration            range(4..30) = 5
    resolution          enum(480p|720p) = 720p
    generateAudio       boolean = true
    outputFormat        enum(mp4|mov) = mp4

### `seedance-2.5-edit`, Seedance 2.5 Edit

    midia de entrada   video x1, reference x30, audio x10
    resolution          enum(480p|720p) = 720p
    generateAudio       boolean = true
    outputFormat        enum(mp4|mov) = mp4

### `seedance-2.5-extend`, Seedance 2.5 Extend

    midia de entrada   video x1, reference x30, audio x10
    duration            range(4..30) = 5
    resolution          enum(480p|720p) = 720p
    generateAudio       boolean = true
    outputFormat        enum(mp4|mov) = mp4

### `seedance-2`, Seedance 2.0

    midia de entrada   start x1, end x1, reference x9, video x3, audio x3
    aspectRatio         enum(16:9|4:3|1:1|3:4|9:16|21:9) = 16:9
    duration            range(4..15) = 5
    generateAudio       boolean = true
    resolution          enum(480p|720p|1080p|4k) = 720p

### `seedance-2-fast`, Seedance 2.0 Fast

    midia de entrada   start x1, end x1, reference x9, video x3, audio x3
    aspectRatio         enum(16:9|4:3|1:1|3:4|9:16|21:9) = 16:9
    duration            range(4..15) = 5
    generateAudio       boolean = true
    resolution          enum(480p|720p) = 720p

### `seedance-2-mini`, Seedance 2.0 Mini

    midia de entrada   start x1, end x1, reference x9, video x3, audio x3
    aspectRatio         enum(16:9|4:3|1:1|3:4|9:16|21:9) = 16:9
    duration            range(4..15) = 5
    generateAudio       boolean = true
    resolution          enum(480p|720p) = 720p

### `kling-3-turbo`, Kling 3.0 Turbo

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(3..15) = 5

### `kling-3-std`, Kling 3.0 Standard

    midia de entrada   start x1, end x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    duration            range(3..15) = 5
    sound               boolean = true
    cfgScale            range(0..1, step 0.01) = 0.5
    multiShots          boolean = false

### `kling-3-pro`, Kling 3.0 Pro

    midia de entrada   start x1, end x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    duration            range(3..15) = 5
    sound               boolean = true
    cfgScale            range(0..1, step 0.01) = 0.5
    multiShots          boolean = false

### `kling-3-4k`, Kling 3.0 4K

    midia de entrada   start x1, end x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    duration            range(3..15) = 5
    sound               boolean = true
    cfgScale            range(0..1, step 0.01) = 0.5
    multiShots          boolean = false

### `kling-3-motion-std`, Kling 3.0 Motion Control

    midia de entrada   start x1, video x1
    keepOriginalSound   boolean = true
    characterOrientationenum(video|image) = video

### `kling-3-motion-pro`, Kling 3.0 Motion Control Pro

    midia de entrada   start x1, video x1
    keepOriginalSound   boolean = true
    characterOrientationenum(video|image) = video

### `wan-3`, Wan 3.0

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `wan-3-prime`, Wan 3.0 Prime

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `wan-2.7`, Wan 2.7

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `wan-2.6`, Wan 2.6

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `flux-3`, Flux 3

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `minimax-h3`, MiniMax H3

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `minimax-hailuo-2.3`, MiniMax Hailuo 2.3

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `happy-horse-1`, Happy Horse 1.0

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `happy-horse-1.1`, Happy Horse 1.1

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `kling-2.6`, Kling 2.6

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `kling-2.5`, Kling 2.5

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `kling-o3`, Kling O3

    midia de entrada   start x1, end x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `kling-o1`, Kling O1 (Omni)

    midia de entrada   start x1, end x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `ltx-2.5-fast`, LTX 2.5 Fast

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `ltx-2.5-pro`, LTX 2.5 Pro

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `grok-imagine-video-1.5`, Grok Imagine Video 1.5

    midia de entrada   reference x8, video x3
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `pixverse-6`, PixVerse 6

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

### `dop`, DoP

    midia de entrada   start x1
    aspectRatio         enum(16:9|9:16|1:1) = 16:9
    resolution          enum(720p|1080p) = 720p
    duration            range(4..10) = 5

