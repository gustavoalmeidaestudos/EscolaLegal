# Baixa cadastros da planilha e gera CSV original + organizado.
# Uso: .\scripts\organizar-cadastros.ps1 -Secret "seu-token"

param(
  [Parameter(Mandatory = $true)]
  [string]$Secret,
  [string]$ApiUrl = 'https://escolalegal.vercel.app/api/ficha-vip',
  [string]$OutDir = 'contatos'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root $OutDir
New-Item -ItemType Directory -Force -Path $dest | Out-Null

function Format-Cnpj([string]$raw) {
  $d = ($raw -replace '\D', '')
  if ($d.Length -ne 14) { return $raw.Trim() -replace '[\[\]]', '' }
  return '{0}.{1}.{2}/{3}-{4}' -f $d.Substring(0,2), $d.Substring(2,3), $d.Substring(5,3), $d.Substring(8,4), $d.Substring(12,2)
}

function Format-Phone([string]$raw) {
  $d = ($raw -replace '\D', '')
  if ($d.StartsWith('55') -and $d.Length -ge 12) { $d = $d.Substring(2) }
  if ($d.Length -eq 11) { return '({0}) {1}-{2}' -f $d.Substring(0,2), $d.Substring(2,5), $d.Substring(7,4) }
  if ($d.Length -eq 10) { return '({0}) {1}-{2}' -f $d.Substring(0,2), $d.Substring(2,4), $d.Substring(6,4) }
  return $raw.Trim()
}

function Is-MostlyUpper([string]$s) {
  $letters = 0
  $upper = 0
  foreach ($ch in $s.ToCharArray()) {
    if ([char]::IsLetter($ch)) {
      $letters++
      if ([char]::IsUpper($ch)) { $upper++ }
    }
  }
  if ($letters -eq 0) { return $false }
  return ($upper / $letters) -gt 0.6
}

function Needs-TitleFix([string]$s) {
  return (Is-MostlyUpper $s) -or ($s -cmatch '^[a-z]')
}

function Format-TitleName([string]$raw) {
  $s = $raw.Trim() -replace '\s+', ' ' -replace '\.', ' '
  if (-not $s) { return $s }
  if (-not (Needs-TitleFix $s)) { return $s }
  $small = @('de','da','do','das','dos','e','em','na','no','aos','às','o','a')
  $parts = $s.ToLower().Split(' ')
  for ($i = 0; $i -lt $parts.Length; $i++) {
    if ($i -gt 0 -and $small -contains $parts[$i]) { continue }
    if ($parts[$i].Length -gt 0) {
      $parts[$i] = $parts[$i].Substring(0,1).ToUpper() + $parts[$i].Substring(1)
    }
  }
  return ($parts -join ' ')
}

function Format-PersonName([string]$raw) {
  if (-not $raw) { return $raw }
  return (($raw -split '\s+e\s+') | ForEach-Object { Format-TitleName $_ }) -join ' e '
}

function Fix-InstitutionName([string]$raw) {
  $s = Format-TitleName $raw
  $s = $s -replace 'Jundiiai','Jundiaí' -replace 'Tubarao','Tubarão' -replace 'Maua','Mauá'
  $s = $s -replace '^Colegio ','Colégio '
  if ($s -match '^Maplebear') { $s = $s -replace '^Maplebear','Maple Bear' }
  if ($s -match '^Cei ') { $s = $s -replace '^Cei ','CEI ' }
  return $s
}

function Format-Email([string]$raw) {
  return $raw.Trim().ToLower()
}

function Format-CidadeEstado([string]$raw) {
  $s = $raw.Trim() -replace '\s+', ' ' -replace ',', '/'
  if (-not $s) { return $s }
  if ($s -match '^(.+?)\s*[/\-|]\s*([A-Za-z]{2})$') {
    $cidade = Format-TitleName $Matches[1]
    $uf = $Matches[2].ToUpper()
    return "$cidade/$uf"
  }
  if ($s -match '^(.+?)\s+([A-Za-z]{2})$') {
    $cidade = Format-TitleName $Matches[1]
    $uf = $Matches[2].ToUpper()
    return "$cidade/$uf"
  }
  return (Format-TitleName $s)
}

function Is-TestRow($r) {
  $n = [string]$r.nomeInstituicao
  return $n -match '^(Teste|Teste Automatizado|Teste Final|Teste Diagnostico|Teste Pos)'
}

function Escape-Csv([string]$v) {
  $v = [string]$v
  if ($v -match '[;"\r\n]') { return '"' + ($v -replace '"', '""') + '"' }
  return $v
}

function Rows-ToCsv($rows, $headers) {
  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add(($headers -join ';'))
  foreach ($row in $rows) {
    $cells = foreach ($h in $headers) { Escape-Csv $row.$h }
    $lines.Add(($cells -join ';'))
  }
  return ($lines -join "`r`n") + "`r`n"
}

Write-Host "Baixando cadastros..."
$url = "$ApiUrl`?export=cadastros&key=$([uri]::EscapeDataString($Secret))"
$resp = Invoke-RestMethod -Uri $url -Method GET
if (-not $resp.ok) { throw "Falha ao exportar: $($resp | ConvertTo-Json -Compress)" }

$original = @()
foreach ($r in $resp.rows) {
  if (Is-TestRow $r) { continue }
  $original += [PSCustomObject]@{
    'Data/Hora' = $r.dataHora
    'Nome da Instituicao' = $r.nomeInstituicao
    'CNPJ' = $r.cnpj
    'Responsavel Legal' = $r.responsavel
    'Cargo/Funcao' = $r.cargo
    'Cidade/Estado' = $r.cidadeEstado
    'E-mail' = $r.email
    'WhatsApp' = $r.whatsapp
    'Interesse' = $r.interesse
    'Principal Demanda' = $r.demanda
  }
}

$headers = @('Data/Hora','Nome da Instituicao','CNPJ','Responsavel Legal','Cargo/Funcao','Cidade/Estado','E-mail','WhatsApp','Interesse','Principal Demanda')
$originalPath = Join-Path $dest 'cadastros-original.csv'
[System.IO.File]::WriteAllText($originalPath, (Rows-ToCsv $original $headers), [System.Text.UTF8Encoding]::new($true))

$organizado = foreach ($r in $original) {
  $tel = Format-Phone $r.'WhatsApp'
  $obs = @()
  $cnpjDigits = ($r.'CNPJ' -replace '\D','')
  if ($cnpjDigits.Length -ne 14) { $obs += 'CNPJ incompleto ou inválido' }
  if (($r.'WhatsApp' -replace '\D','').Length -lt 10) { $obs += 'WhatsApp incompleto' }
  if (-not $r.'E-mail') { $obs += 'Sem e-mail' }
  if ($r.'E-mail' -match 'hoail\.com|gmial\.com|gmail\.co[^m]') { $obs += 'E-mail com possível erro de digitação' }
  if ($r.'Cidade/Estado' -match ',') { $obs += 'Cidade/UF revisar (formato misto)' }

  [PSCustomObject]@{
    'Data/Hora' = $r.'Data/Hora'
    'Nome da Instituicao' = Fix-InstitutionName $r.'Nome da Instituicao'
    'CNPJ' = Format-Cnpj $r.'CNPJ'
    'Responsavel Legal' = Format-PersonName $r.'Responsavel Legal'
    'Cargo/Funcao' = Format-TitleName $r.'Cargo/Funcao'
    'Cidade/Estado' = Format-CidadeEstado $r.'Cidade/Estado'
    'E-mail' = Format-Email $r.'E-mail'
    'WhatsApp' = $tel
    'Interesse' = $r.'Interesse'
    'Principal Demanda' = $r.'Principal Demanda'
    'Observacoes' = ($obs -join '; ')
  }
}

$headersOrg = $headers + @('Observacoes')
$organizadoPath = Join-Path $dest 'cadastros-organizado.csv'
[System.IO.File]::WriteAllText($organizadoPath, (Rows-ToCsv $organizado $headersOrg), [System.Text.UTF8Encoding]::new($true))

Write-Host "Planilha: $($resp.spreadsheet) / aba $($resp.sheet)"
Write-Host "Registros: $($original.Count)"
Write-Host "Original : $originalPath"
Write-Host "Organizado: $organizadoPath"
