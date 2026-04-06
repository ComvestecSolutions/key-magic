[CmdletBinding()]
param(
    [string]$Subject = 'CN=Key Magic Test Code Signing',

    [string]$OutputPath = 'C:\temp\keymagic-test-signing-cert.pfx',

    [string]$Password = 'replace-with-a-strong-test-password',

    [int]$ValidYears = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Password) -or $Password -eq 'replace-with-a-strong-test-password') {
    throw 'Provide a real export password with -Password.'
}

$outputDirectory = Split-Path -Path $OutputPath -Parent
if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

$notAfter = (Get-Date).AddYears($ValidYears)
$certificateParameters = @{
    Subject = $Subject
    Type = 'CodeSigningCert'
    CertStoreLocation = 'Cert:\CurrentUser\My'
    NotAfter = $notAfter
    HashAlgorithm = 'SHA256'
    KeyAlgorithm = 'RSA'
    KeyLength = 3072
}
$certificate = New-SelfSignedCertificate @certificateParameters

$securePassword = ConvertTo-SecureString -String $Password -AsPlainText -Force
$certificateStorePath = Join-Path 'Cert:\CurrentUser\My' $certificate.Thumbprint

try {
    Export-PfxCertificate -Cert $certificate -FilePath $OutputPath -Password $securePassword | Out-Null

    Write-Host "Created test code-signing certificate: $OutputPath"
    Write-Host 'This certificate is suitable for local workflow validation only; it is not a trusted public production signing certificate.'
    Write-Host ''
    Write-Host 'Next step:'
    Write-Host ".\\scripts\\set-github-signing-secrets.ps1 -Repo 'ComvestecSolutions/key-magic' -PfxPath '$OutputPath' -PfxPassword '<same password used to generate the test certificate>'"
}
finally {
    if (Test-Path -LiteralPath $certificateStorePath) {
        Remove-Item -LiteralPath $certificateStorePath -Force
    }
}