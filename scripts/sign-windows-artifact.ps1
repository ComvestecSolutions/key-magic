[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ArtifactPath,

    [string]$CertificateBase64 = $env:WINDOWS_SIGNING_CERT_BASE64,

    [string]$CertificatePassword = $env:WINDOWS_SIGNING_CERT_PASSWORD,

    [string]$TimestampUrl = $(
        if ([string]::IsNullOrWhiteSpace($env:WINDOWS_SIGNING_TIMESTAMP_URL)) {
            'http://timestamp.digicert.com'
        }
        else {
            $env:WINDOWS_SIGNING_TIMESTAMP_URL
        }
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $ArtifactPath)) {
    throw "Artifact not found: $ArtifactPath"
}

if ([string]::IsNullOrWhiteSpace($CertificateBase64) -or [string]::IsNullOrWhiteSpace($CertificatePassword)) {
    Write-Host 'Skipping Authenticode signing because certificate secrets are not configured.'
    exit 0
}

$windowsKitsBin = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\bin'
$signTool = Get-ChildItem -Path $windowsKitsBin -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
    Sort-Object FullName -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if ([string]::IsNullOrWhiteSpace($signTool)) {
    throw 'signtool.exe was not found on the runner.'
}

$tempRoot = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) { [System.IO.Path]::GetTempPath() } else { $env:RUNNER_TEMP }
$certificatePath = Join-Path $tempRoot 'keymagic-signing-cert.pfx'

try {
    [System.IO.File]::WriteAllBytes($certificatePath, [System.Convert]::FromBase64String($CertificateBase64))

    $signArguments = @(
        'sign'
        '/fd'
        'SHA256'
        '/td'
        'SHA256'
        '/f'
        $certificatePath
        '/p'
        $CertificatePassword
        '/tr'
        $TimestampUrl
        $ArtifactPath
    )

    & $signTool @signArguments

    if ($LASTEXITCODE -ne 0) {
        throw "signtool.exe exited with code $LASTEXITCODE."
    }

    $signature = Get-AuthenticodeSignature -FilePath $ArtifactPath
    if ($signature.Status -ne 'Valid') {
        throw "Authenticode signing completed but the signature status is $($signature.Status)."
    }

    Write-Host "Signed Windows artifact: $ArtifactPath"
}
finally {
    if (Test-Path -LiteralPath $certificatePath) {
        Remove-Item -LiteralPath $certificatePath -Force
    }
}