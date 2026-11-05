# WhaspiUBE v4 — Matriz VIVA: precios que se actualizan solos + botones de áreas

Fecha: 05-nov-2026 · Base: v3 (menús interactivos + matriz de valores) · Fuente de valores: **INSCRIPCIONES UBE.xlsx** (SharePoint)

## ¿Qué problema resuelve la v4?

El Excel de la matriz de valores se actualiza cada mes, pero hasta la v3 actualizar
`precios.json` era un paso MANUAL. Con la v4, **el bot mismo descarga el archivo de
la web, lo revisa y detecta cambios** — sin iniciar sesión, sin descargar nada a mano:

> **¿Se puede hacer un script que revise/exporte el archivo? SÍ, y ya está instalado.**
> El enlace compartido ("quien tenga el link puede entrar") permite descarga anónima.
> Probado en producción: descarga 267 KB del Excel real, lo parsea y detecta cambios.

## 1. Rutina automática los días 1 y 16 (nuevo: `sync-catalogo.js`)

Cuando el bot arranca (o cada 30 min) verifica si toca revisión. Corre los
**días 1 y 16 de cada mes** (y de emergencia si quedó >7 días sin revisar):

1. **DESCARGA** el Excel del enlace SharePoint (anónimo, vía curl con cookies; fallback fetch).
   - El enlace se puede cambiar sin tocar código: variable `CATALOGO_URL` en `.env`.
2. **PARSEA las 4 hojas visibles importantes** + INGLÉS + LINKS DE WHATSAPP:
   - `GRADO Y PROGRAMAS ESPECIALE (2)` → paralelos de grado y programas especiales con fechas de inicio
   - `PRECIOS - GRADO Y PROGRAMAS (2)` → 20 carreras + programas especiales + validación + reglas
   - `MAESTRÍAS 2` → 48 maestrías activas (paralelo, horario, fecha tentativa) + 15 en revisión
   - `PRECIOS MAESTRIAS` (la VISIBLE; la "…(2)" oculta está desactualizada y NO se usa)
   - `INGLÉS` → módulos y valor por módulo ($110) por carrera
   - `LINKS DE WHATSAPP` → 639 grupos por paralelo (tutor, celular, enlace)
   - Detección por PATRONES (encabezados/tipos de celda), tolerante a columnas reordenadas.
3. **COMPARA** contra la matriz vigente y detecta:
   - 💰 Cambios de **precios** (matrícula, cuota, arancel, contado, inversión total…)
   - 📅 **Nuevos cohortes** (paralelo nuevo o fecha de inicio nueva/cambiada)
   - 🆕/❌ Carreras o maestrías **agregadas o retiradas**
   - 🔎 Programas que pasan a "en revisión" (no se ofrecen hasta que se publiquen)
4. **REGISTRA**: `data/catalogo/cambios/cambios-<fecha>-<hora>.json` + CSV legible
   `data/catalogo/catalogo-<fecha>.csv` + backup del catálogo anterior.
5. **NOTIFICA por WhatsApp** al administrador con un resumen (si configuras `ADMIN_WHATSAPP`).
6. Diana usa la matriz nueva **en el siguiente mensaje** (recarga automática por mtime).

Si la descarga falla (internet, enlace cambiado): **no toca nada**, mantiene el catálogo
vigente y avisa. La conversación nunca se cae por una revisión fallida.

## 2. Botones/listas para elegir área de maestría (mejorado)

- Nombres de áreas CORTOS y reales del catálogo: **Educación · Administración y Negocios ·
  Derecho y Gobernanza · Ingeniería y Tecnología · Salud y Bienestar**.
- Cuando alguien pide "quiero una maestría" **sin especificar área ni programa** (además de
  "ver catálogo"), Diana envía la LISTA de áreas → el aspirante toca y ve los programas del
  área con próximas fechas de inicio. Los programas con varios paralelos se muestran una sola vez.
- Las 15 maestrías "en revisión" NO se ofertan (si preguntan: "próximamente, malla en revisión").

## 3. Jerarquía de fuentes (regla nueva del prompt)

**La matriz manda sobre todo.** De los trípticos se puede usar malla curricular, perfil de
egreso, duración… pero NUNCA precios, fechas ni promociones que contradigan la matriz.
Si el cliente envía un afiche con otra cifra, Diana corrige con amabilidad usando la matriz.

## 4. Instalación (sobre `wa-bot/`)

1. Respaldar `wa-bot/` (sobre todo `data/` y `certs/`).
2. Instalar la única dependencia nueva:
   ```bash
   npm install xlsx@0.18.5
   ```
   (Si tu `package.json` ya existe, esto solo añade `xlsx`. Referencia: `package-v4-referencia.json`.)
3. Copiar sobre `wa-bot/`: `server.js`, `sync-catalogo.js`, `menu-service.js`, `prompt-engine.js`,
   `wa-client.js`, `crm-extractor.js`, `session-store.js`* , `followup-scheduler.js`*,
   `test-embudo.js`, `test-v3.js`, `test-sync.js` y la carpeta `data/` completa.
   \* Solo si tu instalación no los tiene o son de la versión v2 del paquete.
4. Añadir a `.env` (opcional pero recomendado):
   ```bash
   ADMIN_WHATSAPP=593999999999        # avisos de cambios de precios (sin +)
   CATALOGO_URL=https://istb-my.sharepoint.com/:x:/g/personal/njsuarezv_ube_edu_ec/IQCkeSBymyrhS7l_nZ1HlOfSAcEGWfmfKq2NuKATC6JwBI0
   ```
5. Verificar y arrancar:
   ```bash
   node test-embudo.js   # 53 checks (base)
   node test-v3.js       # 37 checks (saludo/botones/precios)
   node test-sync.js     # 54 checks (matriz viva) — no necesita internet
   node server.js        # producción
   ```
   Al arrancar verás: `[sync-catalogo] Programado: días 1 y 16 de cada mes…`

## 5. Uso manual (cuando quieras forzar una revisión)

```bash
node sync-catalogo.js                 # descarga del SharePoint + parse + diff + aviso
node sync-catalogo.js --sin-descargar # revisa el último archivo descargado
node sync-catalogo.js --estado        # ver última verificación, próxima y conteos
curl -X POST localhost:3000/api/sync-catalogo -H "x-webhook-token: TU_TOKEN"  # forzar vía API
curl localhost:3000/api/catalogo/estado -H "x-webhook-token: TU_TOKEN"        # estado del catálogo
```

## 6. Si el enlace compartido cambia

El Excel se regenera cada mes, normalmente en el MISMO enlace. Si algún mes cambia:
1. Copia el enlace nuevo y ponlo en `.env` como `CATALOGO_URL=...`.
2. Reinicia el bot o llama `POST /api/sync-catalogo`.
(El sistema no queda roto si no lo haces: mantiene la última matriz buena y avisa al admin.)

## 7. Qué hay en `data/`

| Archivo | Qué es |
| --- | --- |
| `data/precios.json` | **La matriz viva** (64 maestrías, 20 carreras, 18 PE/validación, reglas, incidencias) |
| `data/links-whatsapp.json` | 639 grupos de WhatsApp por paralelo (tutor + enlace) — material para invitar al grupo al inscribir |
| `data/catalogo/INSCRIPCIONES UBE.xlsx` | Último Excel descargado de la web (evidencia) |
| `data/catalogo/cambios/cambios-*.json` | Historial de cambios detectados en cada verificación |
| `data/catalogo/catalogo-<fecha>.csv` | Export legible del catálogo consolidado (para revisar con finanzas) |
| `data/catalogo/ultima-sync.json` | Estado: última verificación exitosa, próxima, total de cambios |

## 8. Simulacros (resumen de esta versión)

- `node test-embudo.js` → **53/53** ✅ (embudo, CRM, cédulas, toques)
- `node test-v3.js` → **37/37** ✅ (saludo inicial, botones, valores oficiales)
- `node test-sync.js` → **54/54** ✅ (parser de las 6 hojas, cifras exactas, diff, calendario)
- Descarga real del SharePoint verificada: **OK** (archivo idéntico al original, sin login)
