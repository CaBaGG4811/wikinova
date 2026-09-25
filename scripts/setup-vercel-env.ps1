# Настройка env-переменных проекта Vercel.
# Токены берутся из переменных окружения (секреты не хранятся в репозитории):
#   $env:VERCEL_TOKEN        - Vercel API token
#   $env:VERCEL_TEAM_ID      - team id (team_...)
#   $env:VERCEL_PROJECT_ID   - project id (prj_...)
#   $env:TURSO_DATABASE_URL  - libsql://...
#   $env:TURSO_AUTH_TOKEN    - auth token базы Turso
# Секреты NEXTAUTH_SECRET, ENCRYPTION_KEY и AI_* берутся из локального .env.
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\setup-vercel-env.ps1
$ErrorActionPreference = "Stop"

$token = $env:VERCEL_TOKEN
$teamId = $env:VERCEL_TEAM_ID
$projectId = $env:VERCEL_PROJECT_ID
$tursoUrl = $env:TURSO_DATABASE_URL
$tursoToken = $env:TURSO_AUTH_TOKEN

foreach ($name in @("VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PROJECT_ID", "TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN")) {
  if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) { throw "Не задана переменная окружения $name" }
}

$h = @{ Authorization = "Bearer $token" }

$local = @{}
Get-Content (Join-Path $PSScriptRoot "..\.env") | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
    $i = $line.IndexOf("=")
    $k = $line.Substring(0, $i)
    $v = $line.Substring($i + 1).Trim('"')
    $local[$k] = $v
  }
}

$vars = @(
  @{ key = "DATABASE_URL"; value = $tursoUrl },
  @{ key = "DB_AUTH_TOKEN"; value = $tursoToken },
  @{ key = "NEXTAUTH_SECRET"; value = $local["NEXTAUTH_SECRET"] },
  @{ key = "NEXTAUTH_URL"; value = "https://wikinova-virid.vercel.app" },
  @{ key = "ENCRYPTION_KEY"; value = $local["ENCRYPTION_KEY"] },
  @{ key = "AI_BASE_URL"; value = $local["AI_BASE_URL"] },
  @{ key = "AI_API_KEY"; value = $local["AI_API_KEY"] },
  @{ key = "AI_MODEL"; value = $local["AI_MODEL"] },
  @{ key = "AI_TEMPERATURE"; value = $local["AI_TEMPERATURE"] },
  @{ key = "AI_MAX_TOKENS"; value = $local["AI_MAX_TOKENS"] },
  @{ key = "AI_TIMEOUT_MS"; value = $local["AI_TIMEOUT_MS"] }
)

$existing = @{}
try {
  $list = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Headers $h -TimeoutSec 30
  foreach ($e in $list.envs) { if ($e.target -contains "production") { $existing[$e.key] = $e.id } }
} catch {
  "WARN: не удалось получить список переменных: $($_.Exception.Message)"
}

foreach ($v in $vars) {
  $body = @{ key = $v.key; value = $v.value; target = @("production", "preview", "development"); type = "plain" } | ConvertTo-Json -Compress
  try {
    if ($existing.ContainsKey($v.key)) {
      $null = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env/$($existing[$v.key])?teamId=$teamId" -Method Patch -Headers $h -ContentType "application/json" -Body (@{ value = $v.value } | ConvertTo-Json -Compress) -TimeoutSec 30
      "UPD $($v.key)"
    } else {
      $null = Invoke-RestMethod -Uri "https://api.vercel.com/v10/projects/$projectId/env?teamId=$teamId" -Method Post -Headers $h -ContentType "application/json" -Body $body -TimeoutSec 30
      "OK  $($v.key)"
    }
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg = ""
    try { $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream()); $msg = $sr.ReadToEnd() } catch {}
    "ERR $($v.key) => $code $msg"
  }
}
