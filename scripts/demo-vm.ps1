# Demonstration de CiderScope et PADOC depuis un poste Windows.
#
# Equivalent de "demo-vm.sh --federation" : fait pointer padoc.ifpc.eu et
# ciderscope.ifpc.eu vers ce poste (fichier hosts), puis ouvre un tunnel SSH du
# port 80 local vers le proxy de la VM. OpenID Connect renvoie le navigateur
# vers ces adresses exactes : sans les deux, la connexion PADOC echoue.
#
# Usage : double-cliquer sur demo-vm.cmd (ou demo-ciderscope.cmd), accepter la
# demande d'administration, puis Ctrl+C pour terminer. Fermer la fenetre par la croix
# laisserait la ligne hosts : relancer puis Ctrl+C la retire.
# La ligne du fichier hosts est retiree a la fermeture : oubliee, elle
# detournerait ces noms une fois le site reellement en ligne.

$ErrorActionPreference = 'Stop'
$Vm = if ($env:VM_HOTE) { $env:VM_HOTE } else { 'vmadmin@138.102.157.119' }
$Hosts = "$env:SystemRoot\System32\drivers\etc\hosts"
$Ligne = '127.0.0.1  padoc.ifpc.eu ciderscope.ifpc.eu'

# Modifier le fichier hosts demande les droits d'administration.
$identite = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $identite.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
  exit
}

function Attendre { Read-Host "`nEntree pour fermer" | Out-Null }

function Retirer-Hosts {
  $lignes = Get-Content $Hosts | Where-Object { $_ -notmatch 'padoc\.ifpc\.eu' }
  Set-Content -Path $Hosts -Value $lignes -Encoding ASCII
  ipconfig /flushdns | Out-Null
}

$occupe = Get-NetTCPConnection -LocalPort 80 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($occupe) {
  $p = Get-Process -Id $occupe.OwningProcess -ErrorAction SilentlyContinue
  Write-Host "Le port 80 est deja pris sur ce poste par $($p.ProcessName) (PID $($occupe.OwningProcess))." -ForegroundColor Red
  if ($occupe.OwningProcess -eq 4) {
    Write-Host "PID 4 = service web de Windows (IIS). Pour l'arreter : net stop W3SVC"
  }
  Attendre
  exit 1
}

try {
  Retirer-Hosts
  Add-Content -Path $Hosts -Value "`r`n$Ligne" -Encoding ASCII
  ipconfig /flushdns | Out-Null

  Write-Host ""
  Write-Host "  Demonstration avec connexion PADOC" -ForegroundColor Green
  Write-Host "  CiderScope   http://ciderscope.ifpc.eu"
  Write-Host "  PADOC        http://padoc.ifpc.eu"
  Write-Host ""
  Write-Host "  Laisser cette fenetre ouverte. Terminer par Ctrl+C (pas par la croix)."
  Write-Host ""

  ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 80:localhost:80 $Vm
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Le tunnel s'est arrete (code $LASTEXITCODE). Verifier le reseau et l'acces SSH : ssh $Vm" -ForegroundColor Red
    Attendre
  }
}
finally {
  Retirer-Hosts
  Write-Host "Tunnel ferme, fichier hosts remis en etat."
}
