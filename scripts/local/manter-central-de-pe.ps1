<#
.SYNOPSIS
    Mantem a Central do Dono de pe em localhost:3000, e a levanta de volta
    sozinha quando ela cai.

.DESCRIPTION
    ## Por que isto existe, e o que ele NAO substitui

    A Central (`/dono`) so roda em localhost, e por decisao de seguranca:
    `lib/dono/queries.ts` le com `createAdminClient()`, que ignora RLS por
    completo — nome, e-mail, telefone e valor de negocio de todos os clientes.
    Publicar isso e vazamento de dado de terceiro sob a LGPD, e o gate de duas
    condicoes (`lib/dono/ambiente.ts`) existe exatamente para impedir.

    Consequencia: ela depende desta maquina estar ligada. Este script nao muda
    isso — ele so garante que, ENQUANTO a maquina estiver ligada, o servidor
    esteja de pe.

    **O que de fato nao pode cair ja nao mora aqui.** `/api/cron/vigia` roda na
    Vercel de hora em hora e manda e-mail quando algo muda; `vigiar-o-vigia`
    roda por `pg_cron` no Postgres aos 30 de cada hora e avisa se o proprio
    vigia parar. Os dois sao independentes deste computador, e sao a rede de
    seguranca real. Este script e conforto, nao vigilancia.

    ## Por que checa HTTP e nao so a porta

    Um processo Node pode continuar com a porta aberta e parar de responder —
    e ai a porta diz "vivo" enquanto a tela nao abre. Este e justamente o caso
    que um gerenciador de processo comum (PM2) NAO pega, porque ele observa o
    processo, nao a resposta.

    A checagem faz uma requisicao de verdade e so aceita 2xx ou 3xx.

.PARAMETER Porta
    Porta do servidor de desenvolvimento. Padrao 3000.

.PARAMETER TempoLimiteSegundos
    Quanto esperar pela resposta antes de considerar travado. Padrao 25.
    Generoso de proposito: `next dev` compila a rota na primeira visita, e
    derrubar o servidor no meio de uma compilacao legitima seria pior que
    esperar.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\local\manter-central-de-pe.ps1

.NOTES
    Registrar para subir sozinho:
        scripts\local\registrar-tarefa.ps1
#>

[CmdletBinding()]
param(
    [int]$Porta = 3000,
    [int]$TempoLimiteSegundos = 25,
    # Fica vivo, conferindo para sempre. E assim que ele roda pela pasta
    # Inicializar; sem isto, faz uma passagem so e sai.
    [switch]$Continuo,
    # 45 segundos, e nao os 300 da primeira versao.
    #
    # Medido em 02/09: o servidor foi derrubado as 17:11 e a proxima conferencia
    # so cairia as 17:14:31 — tres minutos de tela fora do ar, e foi exatamente
    # nessa janela que o dono tentou abrir. Para uma ferramenta que se propoe a
    # estar "sempre ligada", tres minutos e uma eternidade.
    #
    # O custo de conferir mais vezes e uma requisicao HTTP em localhost por
    # passagem, que nao sai da maquina e nao acorda nada. Barato o bastante
    # para nao valer a pena economizar.
    [int]$IntervaloSegundos = 45
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$PastaDeLog = Join-Path $Raiz '.central-local'
$Log = Join-Path $PastaDeLog 'manter-de-pe.log'
$LogDoServidor = Join-Path $PastaDeLog 'servidor.log'

if (-not (Test-Path $PastaDeLog)) {
    New-Item -ItemType Directory -Path $PastaDeLog -Force | Out-Null
}

function Escrever-Log {
    param([string]$Mensagem)
    $carimbo = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $linha = "$carimbo  $Mensagem"
    Add-Content -Path $Log -Value $linha -Encoding utf8

    # O log so cresce, e este script roda a cada poucos minutos para sempre.
    # Corta pelas ULTIMAS linhas, nao pelas primeiras: o que interessa quando
    # algo deu errado e o que aconteceu por ultimo.
    $conteudo = Get-Content -Path $Log -ErrorAction SilentlyContinue
    if ($conteudo.Count -gt 2000) {
        $conteudo | Select-Object -Last 1000 | Set-Content -Path $Log -Encoding utf8
    }
}

function Testar-Resposta {
    <#
      Verdadeiro so quando o servidor RESPONDE. Porta aberta nao basta: um
      processo travado mantem a porta e nao serve nada, que e o caso mais
      chato de diagnosticar porque tudo "parece" certo.
    #>
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$Porta/dono" `
            -TimeoutSec $TempoLimiteSegundos -UseBasicParsing -MaximumRedirection 0 `
            -ErrorAction Stop
        return $r.StatusCode -ge 200 -and $r.StatusCode -lt 400
    } catch {
        # Redirecionamento conta como vivo: `/dono` pode desviar, e o que se
        # quer saber e se o Next esta servindo, nao qual foi a rota final.
        $resposta = $_.Exception.Response
        if ($resposta -and $resposta.StatusCode) {
            $codigo = [int]$resposta.StatusCode
            return $codigo -ge 200 -and $codigo -lt 400
        }
        return $false
    }
}

function Obter-ProcessoDaPorta {
    try {
        $conexao = Get-NetTCPConnection -LocalPort $Porta -State Listen -ErrorAction Stop |
            Select-Object -First 1
        if ($conexao) { return Get-Process -Id $conexao.OwningProcess -ErrorAction SilentlyContinue }
    } catch {
        return $null
    }
    return $null
}

function Derrubar-Travado {
    <#
      Mata pela PORTA, e nao por nome de imagem.

      `Stop-Process -Name node` derrubaria TODO Node da maquina — inclusive o
      que nao tem nada a ver com este projeto. E `TaskStop` do agente nao mata
      o filho: ja aconteceu neste projeto, o processo sobreviveu e continuou
      escrevendo em `.next`, reescrevendo o mapa de chunks depois de um build.
    #>
    $p = Obter-ProcessoDaPorta
    if ($p) {
        Escrever-Log "servidor travado na porta $Porta (PID $($p.Id)); derrubando"
        try {
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
            Start-Sleep -Seconds 3
        } catch {
            Escrever-Log "nao consegui derrubar o PID $($p.Id): $($_.Exception.Message)"
        }
    }
}

function Subir-Servidor {
    Escrever-Log "subindo o servidor de desenvolvimento na porta $Porta"

    # `-WindowStyle Hidden` para nao piscar console a cada verificacao, e
    # `cmd /c` porque `npm` no Windows e um `.cmd` — `Start-Process npm` sem
    # isso falha com "nao reconhecido como programa".
    $comando = "cd /d `"$Raiz`" && npm run dev -- -p $Porta >> `"$LogDoServidor`" 2>&1"
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $comando `
        -WindowStyle Hidden -WorkingDirectory $Raiz

    # O `next dev` leva alguns segundos para servir a primeira rota. Esperar
    # aqui evita que a proxima passagem ache que falhou e derrube um servidor
    # que estava so nascendo.
    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Seconds 5
        if (Testar-Resposta) {
            Escrever-Log "de pe em http://localhost:$Porta/dono"
            return $true
        }
    }
    Escrever-Log "nao respondeu em 60s; ver $LogDoServidor"
    return $false
}

# ---------------------------------------------------------------------------
# A passagem
# ---------------------------------------------------------------------------
#
# Tres estados possiveis, e cada um pede coisa diferente:
#
#     responde              nao faz nada. E o caso normal, e o log fica quieto
#     porta aberta, mudo    processo travado: derruba e sobe de novo
#     nada na porta         caiu ou nunca subiu: so sobe
#
# O silencio no caso normal e deliberado. Um log dizendo "tudo certo" a cada
# cinco minutos vira ruido que ninguem le, e no dia em que houver problema o
# reflexo de ignorar ja esta formado. E a mesma regra do vigia de 01/09.

function Passagem {
    if (Testar-Resposta) { return $true }

    $processo = Obter-ProcessoDaPorta
    if ($processo) { Derrubar-Travado }

    return Subir-Servidor
}

if (-not $Continuo) {
    if (Passagem) { exit 0 } else { exit 1 }
}

# ---------------------------------------------------------------------------
# Modo continuo
# ---------------------------------------------------------------------------
#
# ## Por que um laco, e nao a Tarefa Agendada
#
# `Register-ScheduledTask` exige privilegio de administrador nesta maquina
# ("Acesso negado", medido em 02/09), e elevar um processo que roda para
# sempre e le a base de clientes sem RLS e o oposto do que o gate da Central
# protege. A pasta Inicializar roda com a conta do usuario, sem elevacao, e da
# o mesmo efeito.
#
# O laco tambem confere o que a Tarefa nao conferia: ele SEGURA o proprio
# estado entre as passagens, entao consegue distinguir "caiu agora" de "esta
# caido ha uma hora" — e so escreve no log quando MUDA. E a mesma regra do
# vigia de 01/09: varrer sempre, avisar quando muda.

Escrever-Log "vigilancia continua ligada (a cada $IntervaloSegundos s, porta $Porta)"
$estavaDePe = $null

while ($true) {
    try {
        $agoraDePe = Passagem
        if ($estavaDePe -ne $null -and $estavaDePe -ne $agoraDePe) {
            Escrever-Log $(if ($agoraDePe) { "voltou ao ar" } else { "CAIU e nao consegui levantar" })
        }
        $estavaDePe = $agoraDePe
    } catch {
        Escrever-Log "erro na passagem: $($_.Exception.Message)"
        $estavaDePe = $false
    }
    Start-Sleep -Seconds $IntervaloSegundos
}
