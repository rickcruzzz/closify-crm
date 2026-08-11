# Orquestra a suite k6 na ordem de prioridade do plano (docs/load-test/plano-de-teste.md):
# smoke em tudo primeiro (aborta se algo básico falhar), depois os cenários
# que perseguem os achados específicos da auditoria, só then a bateria geral
# de capacidade.
#
# Uso: pwsh scripts/load-test/k6/run-all.ps1 [-Perfil load|stress|spike|soak]
param(
    [string]$Perfil = "load"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$loadTestRoot = Split-Path -Parent $root

# --- carrega scripts/load-test/.env.staging pro ambiente do processo ---
$envFile = Join-Path $loadTestRoot ".env.staging"
if (-not (Test-Path $envFile)) {
    Write-Error ".env.staging não encontrado em $loadTestRoot. Siga o Passo 0 do README primeiro."
    exit 1
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$') {
        [System.Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
    }
}

# k6 lê __ENV do ambiente do processo — os scripts esperam SUPABASE_URL/
# SUPABASE_ANON_KEY, não os nomes NEXT_PUBLIC_* usados pelo Next.
$env:SUPABASE_URL = $env:NEXT_PUBLIC_SUPABASE_URL
$env:SUPABASE_ANON_KEY = $env:NEXT_PUBLIC_SUPABASE_ANON_KEY
if (-not $env:BASE_URL) { $env:BASE_URL = "http://localhost:3000" }
if (-not $env:ASAAS_STUB_URL) { $env:ASAAS_STUB_URL = "http://localhost:4040" }

if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY -or -not $env:SUPABASE_SERVICE_ROLE_KEY) {
    Write-Error "SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY ausentes depois de carregar .env.staging."
    exit 1
}

$rawDir = Join-Path $loadTestRoot "results\raw"
$summaryDir = Join-Path $loadTestRoot "results\summary"
New-Item -ItemType Directory -Force -Path $rawDir, $summaryDir | Out-Null

$scenariosDir = Join-Path $root "scenarios"

function Invoke-Cenario {
    param([string]$Nome, [string]$Arquivo, [string]$PerfilCenario)

    $env:PROFILE = $PerfilCenario
    $logPath = Join-Path $rawDir "$Nome`__$PerfilCenario.log"
    $summaryPath = Join-Path $summaryDir "$Nome`__$PerfilCenario.json"

    Write-Host "`n=== $Nome ($PerfilCenario) ===" -ForegroundColor Cyan
    k6 run --summary-export $summaryPath (Join-Path $scenariosDir $Arquivo) 2>&1 | Tee-Object -FilePath $logPath

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  $Nome ($PerfilCenario) saiu com código $LASTEXITCODE — thresholds falharam ou erro de execução. Log em $logPath." -ForegroundColor Yellow
    }
    return $LASTEXITCODE
}

$todos = @(
    @{ nome = "a1_landing_login_pages"; arquivo = "a1_landing_login_pages.js" },
    @{ nome = "b1_dashboard_page"; arquivo = "b1_dashboard_page.js" },
    @{ nome = "b2_kanban_page"; arquivo = "b2_kanban_page.js" },
    @{ nome = "b3_leads_page"; arquivo = "b3_leads_page.js" },
    @{ nome = "b4_login_flow"; arquivo = "b4_login_flow.js" },
    @{ nome = "c1_dashboard_metrics_rpc"; arquivo = "c1_dashboard_metrics_rpc.js" },
    @{ nome = "c2_funnel_counts_raw_vs_rpc"; arquivo = "c2_funnel_counts_raw_vs_rpc.js" },
    @{ nome = "c3_leads_list_cursor"; arquivo = "c3_leads_list_cursor.js" },
    @{ nome = "c4_leads_search_ilike"; arquivo = "c4_leads_search_ilike.js" },
    @{ nome = "c5_kanban_board_full_fetch"; arquivo = "c5_kanban_board_full_fetch.js" },
    @{ nome = "c6_create_lead_chain"; arquivo = "c6_create_lead_chain.js" }
)

# --- fase 1: smoke em tudo, aborta se algo básico estiver quebrado ---
Write-Host "`n########## FASE SMOKE — valida antes de gastar tempo com carga real ##########" -ForegroundColor Magenta
foreach ($c in $todos) {
    $codigo = Invoke-Cenario -Nome $c.nome -Arquivo $c.arquivo -PerfilCenario "smoke"
    if ($codigo -ne 0) {
        Write-Error "$($c.nome) falhou no smoke. Corrigir antes de escalar carga — abortando."
        exit 1
    }
}

# --- fase 2: achados priorizados (ver docs/load-test/plano-de-teste.md) ---
Write-Host "`n########## FASE ACHADOS — c2, c4, b1-b3, corridas, c5 ##########" -ForegroundColor Magenta
Invoke-Cenario -Nome "c2_funnel_counts_raw_vs_rpc" -Arquivo "c2_funnel_counts_raw_vs_rpc.js" -PerfilCenario $Perfil
Invoke-Cenario -Nome "c4_leads_search_ilike" -Arquivo "c4_leads_search_ilike.js" -PerfilCenario $Perfil
Invoke-Cenario -Nome "b1_dashboard_page" -Arquivo "b1_dashboard_page.js" -PerfilCenario $Perfil
Invoke-Cenario -Nome "b2_kanban_page" -Arquivo "b2_kanban_page.js" -PerfilCenario $Perfil
Invoke-Cenario -Nome "b3_leads_page" -Arquivo "b3_leads_page.js" -PerfilCenario $Perfil

foreach ($race in @("race1_update_deal_stage", "race2_accept_invite_member_cap", "race3_csv_import_lead_cap", "race4_lead_insert_trigger_cap", "race5_create_workspace_cap")) {
    $logPath = Join-Path $rawDir "$race.log"
    Write-Host "`n=== $race ===" -ForegroundColor Cyan
    k6 run (Join-Path $scenariosDir "$race.js") 2>&1 | Tee-Object -FilePath $logPath
}

Invoke-Cenario -Nome "c5_kanban_board_full_fetch" -Arquivo "c5_kanban_board_full_fetch.js" -PerfilCenario $Perfil

# --- fase 3: bateria geral de capacidade ---
Write-Host "`n########## FASE BATERIA GERAL — $Perfil ##########" -ForegroundColor Magenta
foreach ($c in @("a1_landing_login_pages", "b4_login_flow", "c1_dashboard_metrics_rpc", "c3_leads_list_cursor", "c6_create_lead_chain")) {
    $arquivo = ($todos | Where-Object { $_.nome -eq $c }).arquivo
    Invoke-Cenario -Nome $c -Arquivo $arquivo -PerfilCenario $Perfil
}

Write-Host "`n########## FASE WEBHOOK ##########" -ForegroundColor Magenta
if ($env:ASAAS_WEBHOOK_TOKEN) {
    Invoke-Cenario -Nome "c7_webhook_asaas_idempotent" -Arquivo "c7_webhook_asaas_idempotent.js" -PerfilCenario $Perfil
} else {
    Write-Host "  ASAAS_WEBHOOK_TOKEN não definido — pulando c7." -ForegroundColor Yellow
}

Write-Host "`nSuíte concluída. Rode verify/post-race-checks.mjs e depois report/build-report.mjs." -ForegroundColor Green
