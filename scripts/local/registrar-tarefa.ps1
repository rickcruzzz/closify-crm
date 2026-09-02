<#
.SYNOPSIS
    Faz a Central subir sozinha quando voce liga o computador, e ficar de pe.

.DESCRIPTION
    Cria um atalho na pasta Inicializar do Windows apontando para
    `manter-central-de-pe.ps1 -Continuo`, que:

        sobe o servidor quando voce entra no Windows
        confere a cada 5 minutos e levanta de volta se cair ou travar
        roda escondido, sem console piscando

    ## Por que a pasta Inicializar, e nao o Agendador de Tarefas

    O Agendador foi a primeira escolha e foi RECUSADO pela propria maquina:
    `Register-ScheduledTask` devolveu "Acesso negado" (medido em 02/09), porque
    registrar tarefa exige privilegio de administrador.

    Dava para pedir elevacao. Nao se deve: este processo fica vivo para sempre
    e serve uma tela que le a base de clientes SEM RLS — nome, e-mail, telefone
    e valor de negocio de todo mundo. Roda-lo elevado daria a ele mais poder
    sobre a maquina do que ele precisa para servir uma pagina em localhost.

    A pasta Inicializar roda com a SUA conta, sem elevacao, e da o mesmo efeito.

    ## E por que isso e melhor que PM2

    Tentado primeiro; `npm i -g pm2` falhou por rede aqui. Mas a troca saiu
    melhor: o PM2 observa o PROCESSO, e este script observa a RESPOSTA. Um
    `next dev` travado mantem a porta aberta e para de servir — o PM2 veria
    "vivo", este script ve "mudo" e reinicia.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\local\registrar-tarefa.ps1

.EXAMPLE
    # Para desligar depois:
    Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\VeloFunil - Central local.lnk"
#>

[CmdletBinding()]
param(
    [int]$Porta = 3000,
    [int]$IntervaloSegundos = 300,
    # Nao inicia agora, so registra para o proximo logon.
    [switch]$NaoIniciarAgora
)

$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$Script = Join-Path $PSScriptRoot 'manter-central-de-pe.ps1'
$Nome = 'VeloFunil - Central local'

if (-not (Test-Path $Script)) { throw "nao achei $Script" }

# `GetFolderPath('Startup')` devolveu VAZIO nesta maquina (medido em 02/09).
# Acontece quando o OneDrive redireciona as pastas do perfil, que e o caso
# aqui — o proprio projeto mora em `OneDrive\Desktop`. O caminho por
# `APPDATA` nao passa pelo redirecionamento e sempre existe.
$Inicializar = [Environment]::GetFolderPath('Startup')
if ([string]::IsNullOrWhiteSpace($Inicializar)) {
    $Inicializar = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
}
if (-not (Test-Path $Inicializar)) {
    New-Item -ItemType Directory -Path $Inicializar -Force | Out-Null
}
$Atalho = Join-Path $Inicializar "$Nome.lnk"

$argumentos = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`" " +
              "-Porta $Porta -Continuo -IntervaloSegundos $IntervaloSegundos"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($Atalho)
$lnk.TargetPath = (Get-Command powershell.exe).Source
$lnk.Arguments = $argumentos
$lnk.WorkingDirectory = $Raiz
$lnk.WindowStyle = 7          # 7 = minimizado, para nao roubar o foco no logon
$lnk.Description = 'Mantem a Central do Dono (localhost) de pe'
$lnk.Save()

Write-Host ""
Write-Host "registrado: $Atalho"
Write-Host "  sobe quando voce entrar no Windows"
Write-Host "  confere a cada $([int]($IntervaloSegundos/60)) minutos e levanta de volta se cair"
Write-Host "  Central em http://localhost:$Porta/dono"
Write-Host "  log em .central-local\manter-de-pe.log"

if (-not $NaoIniciarAgora) {
    # Nao empilha: se ja houver um em modo continuo, deixa quieto.
    $jaRodando = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*manter-central-de-pe*-Continuo*' }

    if ($jaRodando) {
        Write-Host ""
        Write-Host "ja havia um vigilante rodando (PID $($jaRodando.ProcessId)); nao subi outro"
    } else {
        Start-Process -FilePath (Get-Command powershell.exe).Source `
            -ArgumentList $argumentos -WorkingDirectory $Raiz -WindowStyle Hidden
        Write-Host ""
        Write-Host "vigilante iniciado agora, sem esperar o proximo logon"
    }
}

Write-Host ""
Write-Host "para desligar:"
Write-Host "  Remove-Item `"$Atalho`""
Write-Host "  Get-CimInstance Win32_Process -Filter `"Name='powershell.exe'`" | Where-Object { `$_.CommandLine -like '*manter-central-de-pe*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force }"
