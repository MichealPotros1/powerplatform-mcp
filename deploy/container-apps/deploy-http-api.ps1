param(
  [Parameter(Mandatory = $true)] [string]$SubscriptionId,
  [Parameter(Mandatory = $true)] [string]$ResourceGroup,
  [Parameter(Mandatory = $true)] [string]$Location,
  [Parameter(Mandatory = $true)] [string]$ContainerAppEnv,
  [Parameter(Mandatory = $true)] [string]$ContainerAppName,
  [Parameter(Mandatory = $true)] [string]$AcrName,
  [Parameter(Mandatory = $true)] [string]$ImageTag,
  [Parameter(Mandatory = $true)] [string]$ApiAuthTenantId,
  [Parameter(Mandatory = $true)] [string]$ApiAuthAudience
)

$ErrorActionPreference = 'Stop'

az account set --subscription $SubscriptionId

az group create --name $ResourceGroup --location $Location | Out-Null
az provider register --namespace Microsoft.App | Out-Null
az provider register --namespace Microsoft.OperationalInsights | Out-Null

az acr create --name $AcrName --resource-group $ResourceGroup --location $Location --sku Basic --admin-enabled true | Out-Null

$acrLoginServer = az acr show --name $AcrName --resource-group $ResourceGroup --query loginServer -o tsv
az acr build --registry $AcrName --image "powerplatform-http-api:$ImageTag" --file Dockerfile.api .

az containerapp env create --name $ContainerAppEnv --resource-group $ResourceGroup --location $Location | Out-Null

$createCmd = @"
az containerapp create --name "$ContainerAppName" --resource-group "$ResourceGroup" --environment "$ContainerAppEnv" --image "$acrLoginServer/powerplatform-http-api:$ImageTag" --target-port 8080 --ingress external --registry-server "$acrLoginServer" --env-vars API_AUTH_REQUIRED=true API_AUTH_TENANT_ID="$ApiAuthTenantId" API_AUTH_AUDIENCE="$ApiAuthAudience"
"@

Invoke-Expression $createCmd

Write-Host "Container app deployed."
Write-Host "Set POWERPLATFORM_* environment variables as Container App secrets and env vars before use."
