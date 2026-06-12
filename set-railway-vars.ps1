# PowerShell script to set Railway environment variables

Write-Host "Setting Railway environment variables..." -ForegroundColor Green

$vars = @{
    "FLIPOPS_API_KEY" = "fo_live_10177805c8d743e1a6e1860515dc2b3f"
    "FO_API_KEY" = "fo_live_10177805c8d743e1a6e1860515dc2b3f"
    "FO_WEBHOOK_SECRET" = "7d82e2b8945c43959699bc3a3c1467bdd66954d25d6f41eb"
    "NEXT_PUBLIC_ENABLE_DATASOURCE_PANELS" = "1"
    "NODE_ENV" = "production"
    "PORT" = "3000"
}

# Build the command with all --set flags
$setFlags = @()
foreach ($key in $vars.Keys) {
    $setFlags += "--set"
    $setFlags += "$key=$($vars[$key])"
}

# Execute the command
$command = "railway variables " + ($setFlags -join " ") + " --service flipops-api --environment production"
Write-Host "Executing: $command" -ForegroundColor Yellow
Invoke-Expression $command

Write-Host "Environment variables set successfully!" -ForegroundColor Green