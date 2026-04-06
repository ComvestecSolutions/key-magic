[CmdletBinding()]
param(
    [string]$PfxPath = 'C:\path\to\your\keymagic-signing-cert.pfx',

    [string]$PfxPassword = 'replace-with-your-pfx-password',

    [string]$Repo,

    [string]$TimestampUrl = 'http://timestamp.digicert.com',

    [switch]$PrintOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Fail {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    [Console]::Error.WriteLine($Message)
    exit 1
}

function Resolve-GitHubRepo {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        return $null
    }

    $remoteUrl = (& git remote get-url origin 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($remoteUrl)) {
        return $null
    }

    if ($remoteUrl -match 'github\.com[:/](?<owner>[^/]+)/(?<repo>[^/.]+?)(?:\.git)?$') {
        return "$($Matches.owner)/$($Matches.repo)"
    }

    return $null
}

function Get-SetupSnippet {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ResolvedRepo,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedPfxPath,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedPassword,

        [Parameter(Mandatory = $true)]
        [string]$ResolvedTimestampUrl
    )

    return (@'
$Repo = '{0}'
$PfxPath = '{1}'
$PfxPassword = '{2}'
$TimestampUrl = '{3}'

function Set-GitHubSecret {{
    param(
        [Parameter(Mandatory = $true)]
        [string]$SecretName,

        [Parameter(Mandatory = $true)]
        [string]$SecretValue,

        [Parameter(Mandatory = $true)]
        [string]$Repo
    )

    $SecretValue | gh secret set $SecretName --repo $Repo
    if ($LASTEXITCODE -ne 0) {{
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode -or $exitCode -eq 0) {{
            $exitCode = 1
        }}

        Write-Host "Failed to set GitHub secret '$SecretName' for $Repo (gh exit code: $exitCode)."
        exit $exitCode
    }}
}}

$CertificateBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($PfxPath))
Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_CERT_BASE64' -SecretValue $CertificateBase64 -Repo $Repo
Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_CERT_PASSWORD' -SecretValue $PfxPassword -Repo $Repo
Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_TIMESTAMP_URL' -SecretValue $TimestampUrl -Repo $Repo
'@ -f $ResolvedRepo, $ResolvedPfxPath, $ResolvedPassword, $ResolvedTimestampUrl)
}

function Set-GitHubSecret {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SecretName,

        [Parameter(Mandatory = $true)]
        [string]$SecretValue,

        [Parameter(Mandatory = $true)]
        [string]$Repo
    )

    $SecretValue | & gh secret set $SecretName --repo $Repo
    if ($LASTEXITCODE -ne 0) {
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode -or $exitCode -eq 0) {
            $exitCode = 1
        }

        Write-Host "Failed to set GitHub secret '$SecretName' for $Repo (gh exit code: $exitCode)."
        exit $exitCode
    }
}

$resolvedRepo = if ([string]::IsNullOrWhiteSpace($Repo)) { Resolve-GitHubRepo } else { $Repo }
if ([string]::IsNullOrWhiteSpace($resolvedRepo)) {
    if ($PrintOnly) {
        $resolvedRepo = 'OWNER/REPO'
    }
    else {
        Fail "GitHub repository could not be resolved automatically. Pass -Repo 'owner/name' or run the script from a cloned GitHub repository."
    }
}

if ($PrintOnly) {
    Write-Host 'Repository secret names:'
    Write-Host '- WINDOWS_SIGNING_CERT_BASE64 = single-line base64 text for the full .pfx file, for example MII...'
    Write-Host '- WINDOWS_SIGNING_CERT_PASSWORD = the password used to open/export the .pfx file'
    Write-Host '- WINDOWS_SIGNING_TIMESTAMP_URL = optional timestamp URL, default http://timestamp.digicert.com'
    Write-Host ''
    Write-Host 'Copy-paste PowerShell:'
    Write-Host ''
    Write-Host (Get-SetupSnippet -ResolvedRepo $resolvedRepo -ResolvedPfxPath $PfxPath -ResolvedPassword $PfxPassword -ResolvedTimestampUrl $TimestampUrl)
    exit 0
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fail 'GitHub CLI (gh) is required to set secrets automatically. Install it or use -PrintOnly.'
}

if (-not (Test-Path -LiteralPath $PfxPath)) {
    Fail (@'
PFX file not found: {0}

That path is expected to point to a real exported code-signing .pfx file.
The example path in the docs is only a placeholder.

Next options:
- Pass -PfxPath with the real location of your existing signing certificate.
- Generate a local test certificate with:
    .\scripts\new-test-code-signing-cert.ps1 -OutputPath 'C:\temp\keymagic-test-signing-cert.pfx' -Password 'replace-with-a-strong-test-password'
- Use -PrintOnly if you only want the GitHub secret command template without touching files.
'@ -f $PfxPath)
}

if ([string]::IsNullOrWhiteSpace($PfxPassword) -or $PfxPassword -eq 'replace-with-your-pfx-password') {
        Fail 'Provide the real PFX password with -PfxPassword or use -PrintOnly to generate the command template.'
}

$resolvedPfxPath = (Resolve-Path -LiteralPath $PfxPath).Path
$certificateBase64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($resolvedPfxPath))

Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_CERT_BASE64' -SecretValue $certificateBase64 -Repo $resolvedRepo
Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_CERT_PASSWORD' -SecretValue $PfxPassword -Repo $resolvedRepo

if (-not [string]::IsNullOrWhiteSpace($TimestampUrl)) {
    Set-GitHubSecret -SecretName 'WINDOWS_SIGNING_TIMESTAMP_URL' -SecretValue $TimestampUrl -Repo $resolvedRepo
}

Write-Host "Configured signing secrets for $resolvedRepo"
Write-Host '- WINDOWS_SIGNING_CERT_BASE64'
Write-Host '- WINDOWS_SIGNING_CERT_PASSWORD'
if (-not [string]::IsNullOrWhiteSpace($TimestampUrl)) {
    Write-Host '- WINDOWS_SIGNING_TIMESTAMP_URL'
}