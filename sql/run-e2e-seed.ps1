param(
    [string]$Server = "localhost",
    [string]$Database = "MarketDayDB",
    [string]$EnvFile = (
        Join-Path $PSScriptRoot "..\.env.e2e.local"
    ),
    [string]$BackendConfig = (
        Join-Path $PSScriptRoot "..\..\Market_day_api\run-local.cmd"
    )
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "E2E environment file not found: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) {
            continue
        }
        $separator = $trimmed.IndexOf("=")
        if ($separator -le 0) {
            continue
        }
        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        if (
            ($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'"))
        ) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$name] = $value
    }
    return $values
}

function Read-CmdEnvironment {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Backend local configuration file not found: $Path"
    }

    $values = @{}
    foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
        if ($line -match '^\s*set\s+"?([^="]+)=([^"]*)"?\s*$') {
            $values[$matches[1].Trim()] = $matches[2]
        }
    }
    return $values
}

$envValues = Read-DotEnv -Path $EnvFile
$backendValues = Read-CmdEnvironment -Path $BackendConfig
$required = @(
    "E2E_VENDOR_EMAIL",
    "E2E_VENDOR_PASSWORD",
    "E2E_ORGANIZER_EMAIL",
    "E2E_ORGANIZER_PASSWORD",
    "E2E_ADMIN_EMAIL",
    "E2E_ADMIN_PASSWORD"
)
foreach ($name in $required) {
    if (-not $envValues.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envValues[$name])) {
        throw "Missing required value in .env.e2e.local: $name"
    }
}

foreach ($name in @("DB_USERNAME", "DB_PASSWORD")) {
    if (
        -not $backendValues.ContainsKey($name) -or
        [string]::IsNullOrWhiteSpace($backendValues[$name])
    ) {
        throw "Missing required value in backend run-local.cmd: $name"
    }
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
    "marketday-e2e-seed-" + [guid]::NewGuid().ToString("N")
)
New-Item -ItemType Directory -Path $tempRoot | Out-Null

try {
    $bcryptSource = Join-Path $PSScriptRoot "..\..\Market_day_api\src\main\java\com\example\demo\Service\BCrypt.java"
    $hashSource = Join-Path $PSScriptRoot "HashE2EPasswords.java"
    & javac -encoding UTF-8 -d $tempRoot $bcryptSource $hashSource
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compile the local BCrypt password helper."
    }

    $hashes = @(
        & java -cp $tempRoot HashE2EPasswords `
            $envValues["E2E_VENDOR_PASSWORD"] `
            $envValues["E2E_ORGANIZER_PASSWORD"] `
            $envValues["E2E_ADMIN_PASSWORD"]
    )
    if ($LASTEXITCODE -ne 0 -or $hashes.Count -ne 3) {
        throw "Failed to generate E2E password hashes."
    }

    $seedFile = Join-Path $PSScriptRoot "user-market-brand-e2e-test-data.sql"
    $previousSqlCmdPassword = $env:SQLCMDPASSWORD
    try {
        # SQLCMDPASSWORD keeps the database password out of the process command line.
        $env:SQLCMDPASSWORD = $backendValues["DB_PASSWORD"]
        & sqlcmd `
            -S $Server `
            -d $Database `
            -U $backendValues["DB_USERNAME"] `
            -b `
            -V 11 `
            -r 1 `
            -f 65001 `
            -i $seedFile `
            -v `
            "E2E_VENDOR_EMAIL=$($envValues['E2E_VENDOR_EMAIL'])" `
            "E2E_VENDOR_PASSWORD_HASH=$($hashes[0])" `
            "E2E_ORGANIZER_EMAIL=$($envValues['E2E_ORGANIZER_EMAIL'])" `
            "E2E_ORGANIZER_PASSWORD_HASH=$($hashes[1])" `
            "E2E_ADMIN_EMAIL=$($envValues['E2E_ADMIN_EMAIL'])" `
            "E2E_ADMIN_PASSWORD_HASH=$($hashes[2])"
        if ($LASTEXITCODE -ne 0) {
            throw "SQL seed failed with exit code $LASTEXITCODE. No success was reported."
        }

        $verificationQuery = @'
SET NOCOUNT ON;
DECLARE @expected TABLE (email varchar(255));
INSERT INTO @expected VALUES
('$(E2E_VENDOR_EMAIL)'),
('$(E2E_ORGANIZER_EMAIL)'),
('$(E2E_ADMIN_EMAIL)');
IF (SELECT COUNT(*) FROM dbo.users u JOIN @expected e ON e.email = u.email) <> 3
    THROW 51020, 'E2E seed verification failed: expected accounts are missing.', 1;
IF (
    SELECT COUNT(*)
    FROM dbo.market_events me
    INNER JOIN dbo.users u ON u.id = me.user_id
    WHERE u.email = 'island.days.organizer@marketday.local'
) < 3
    THROW 51021, 'E2E seed verification failed: canonical markets are missing.', 1;
SELECT
    (SELECT COUNT(*) FROM dbo.users u JOIN @expected e ON e.email = u.email)
        AS verified_accounts,
    (
        SELECT COUNT(*)
        FROM dbo.market_events me
        INNER JOIN dbo.users u ON u.id = me.user_id
        WHERE u.email = 'island.days.organizer@marketday.local'
    )
        AS verified_markets;
'@
        & sqlcmd `
            -S $Server `
            -d $Database `
            -U $backendValues["DB_USERNAME"] `
            -b `
            -V 11 `
            -r 1 `
            -f 65001 `
            -Q $verificationQuery `
            -v `
            "E2E_VENDOR_EMAIL=$($envValues['E2E_VENDOR_EMAIL'])" `
            "E2E_ORGANIZER_EMAIL=$($envValues['E2E_ORGANIZER_EMAIL'])" `
            "E2E_ADMIN_EMAIL=$($envValues['E2E_ADMIN_EMAIL'])"
        if ($LASTEXITCODE -ne 0) {
            throw "SQL seed post-verification failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        $env:SQLCMDPASSWORD = $previousSqlCmdPassword
    }

    Write-Host "Market Day E2E seed completed and verified in $Server/$Database."
}
finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
