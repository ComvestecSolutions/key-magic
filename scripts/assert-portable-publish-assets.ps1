param(
    [Parameter(Mandatory = $true)]
    [string]$ServicePublishDir
)

$ErrorActionPreference = 'Stop'

function Assert-SingleFileBundle {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BundleName,

        [Parameter(Mandatory = $true)]
        [string]$PublishDir,

        [Parameter(Mandatory = $true)]
        [string]$ExecutableName
    )

    if (-not (Test-Path -LiteralPath $PublishDir -PathType Container)) {
        throw "$BundleName publish directory was not created: $PublishDir"
    }

    $executablePath = Join-Path $PublishDir $ExecutableName
    if (-not (Test-Path -LiteralPath $executablePath -PathType Leaf)) {
        throw "$BundleName portable executable is missing: $executablePath"
    }

    $unexpectedEntries = Get-ChildItem -LiteralPath $PublishDir -Force |
        Where-Object { $_.Name -ne $ExecutableName }

    if ($unexpectedEntries) {
        $unexpectedNames = $unexpectedEntries | ForEach-Object { $_.Name }
        throw "$BundleName single-file publish output contains unexpected entries: $($unexpectedNames -join ', ')"
    }

    $resolvedExecutablePath = (Resolve-Path -LiteralPath $executablePath).Path
    Write-Host "Verified $BundleName single-file release asset: $resolvedExecutablePath"
}

Assert-SingleFileBundle -BundleName 'Service' -PublishDir $ServicePublishDir -ExecutableName 'KeyMagic.exe'