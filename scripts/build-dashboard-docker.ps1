$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$backendImage = "cicdforliquibasemigration-backend:latest"
$frontendImage = "cicdforliquibasemigration-frontend:latest"

docker build -t $backendImage ./backend
docker build -t $frontendImage --build-arg REACT_APP_API_BASE=http://localhost:4000/api ./frontend

Write-Host "Built $backendImage and $frontendImage"
