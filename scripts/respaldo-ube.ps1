# WhaspiUBE · Respaldo diario del CRM con rotación (PowerShell)
# -----------------------------------------------------------------------------
# Programar UNA VEZ como Administrador:
#   schtasks /Create /TN "Respaldo WhaspiUBE" /SC DAILY /ST 21:00 ^
#     /TR "powershell -ExecutionPolicy Bypass -File C:\whaspiube\respaldo-ube.ps1"
#
# Qué respalda: data/sessions.db (fichas CRM con cédulas + bitácora de eventos)
# Rotación: 7 copias diarias + 4 semanales (los lunes).
# Destino: disco secundario o carpeta sincronizada con la nube de la UBE.
# -----------------------------------------------------------------------------
$origen  = "C:\whaspiube\wa-bot\data\sessions.db"
$destino = "D:\respaldos-ube"        # <-- ajustar al disco/carpeta real
$marca   = Get-Date -Format "yyyy-MM-dd"

# crear carpetas si no existen
New-Item -ItemType Directory -Force -Path "$destino\diario"  | Out-Null
New-Item -ItemType Directory -Force -Path "$destino\semanal" | Out-Null

# copia diaria (rota 7)
Copy-Item $origen "$destino\diario\sessions-$marca.db" -Force
Get-ChildItem "$destino\diario" -Filter "sessions-*.db" |
  Sort-Object Name -Descending | Select-Object -Skip 7 | Remove-Item -Force

# copia semanal solo los lunes (rota 4)
if ((Get-Date).DayOfWeek -eq "Monday") {
  Copy-Item $origen "$destino\semanal\sessions-$marca.db" -Force
  Get-ChildItem "$destino\semanal" -Filter "sessions-*.db" |
    Sort-Object Name -Descending | Select-Object -Skip 4 | Remove-Item -Force
}

# opcional: llevar también los trípticos (activar si cambian seguido)
# Copy-Item "C:\whaspiube\wa-bot\material" "$destino\material" -Recurse -Force

Write-Output "Respaldo WhaspiUBE completado: $marca"
