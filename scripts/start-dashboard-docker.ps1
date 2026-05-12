$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$backendImage = "cicdforliquibasemigration-backend:latest"
$frontendImage = "cicdforliquibasemigration-frontend:latest"
$envFile = Join-Path $PWD "backend\.env"

if (-not (Test-Path $envFile)) {
    throw "Missing backend\.env. Copy backend\env.template and set your database URLs."
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
docker rm -f prism-dashboard-backend prism-dashboard-frontend *> $null
$ErrorActionPreference = $prevEap

docker run -d --name prism-dashboard-backend -p 4000:4000 `
    --env-file $envFile `
    -e LIQUIBASE_PATH=/opt/liquibase/liquibase `
    -e PORT=4000 `
    $backendImage | Out-Null

docker run -d --name prism-dashboard-frontend -p 3000:80 `
    $frontendImage | Out-Null

Start-Sleep -Seconds 5
docker ps --filter "name=prism-dashboard-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Write-Host "Backend:  http://localhost:4000/health"
Write-Host "Frontend: http://localhost:3000"
