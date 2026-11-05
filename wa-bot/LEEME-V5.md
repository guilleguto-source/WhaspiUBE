# LEEME-V5 · WhaspiUBE Optimizado (auditoría completa + campaña integrada)

**Qué es esta versión**: el mismo bot Diana (Groq + Evolution API) tras una
auditoría completa del código: 6 bugs críticos, 7 importantes, código fantasma y
duplicaciones eliminados, más la **capa de consistencia** para que Diana siempre
sepa dónde buscar y deje de «marearse». La campaña de egresados ya viene
**integrada** (no hay que tocar `server.js` a mano).

📄 Detalle técnico completo de cada hallazgo: **`AUDITORIA-V5.md`**.

## 1. Instalación (carpeta limpia, 3 pasos)

```bash
# 1) copiar TODO el contenido de este paquete a una carpeta (p. ej. wa-bot/)
# 2) dependencias (Node ≥ 22.5 por node:sqlite):
npm install
# 3) configurar .env (copiar .env.example y llenar tus claves):
cp .env.example .env
# verificar que todo está sano:
node test-embudo.js && node test-v3.js && node test-sync.js && node test-campana.js contactos_educacion_import.csv && node test-auditoria.js
# arrancar:
node server.js
```

Requisitos: Node **22.5+** (usa `node:sqlite` nativo) · deps: `express`, `dotenv`,
`xlsx` (ya en package.json). Los trípticos van en la carpeta `material/`
(o configura `UBE_MATERIAL_DIR` en `.env`).

## 2. Qué cambió respecto a v4 (resumen ejecutivo)

| Antes (v4) | Ahora (v5) |
|---|---|
| `/api/calendario` y endpoints del catálogo se colgaban o daban 500 | Todos operativos (middleware corregido + agenda implementada) |
| El área elegida se perdía al siguiente mensaje | Persistida y visible en la ficha que Diana consulta |
| 2 de 5 áreas del catálogo respondían «0 maestrías» | Desglose correcto en las 5 (una sola taxonomía = la matriz) |
| «maestría en educación» quedaba como licenciatura | Guardia: maestría ≠ carrera de grado |
| Diana adivinaba el contexto con regex | Bandera `ctx_pendiente` + router determinista + `[BLOQUE DE RUTA]` |
| Campaña con integración manual y botones que no respondían | Integrada: webhook la atiende antes que Diana + `/api/campana` |
| Leads basura por JIDs @lid | `senderPn` o aislamiento `lid:` con origen `whatsapp_lid` |
| Toque 3 prometía tríptico y no lo enviaba | Adjunta el PDF real del programa |
| ZIP incompleto (faltaban 6 módulos) | Paquete autosuficiente |

## 3. La capa de consistencia (cómo funciona)

```
mensaje → webhook (token, dedup, LID, campaña) → cola debounce (typing real)
        → CRM: ficha + ctx_pendiente  → diana-router: intención + [BLOQUE DE RUTA]
        → ¿respuesta determinista? (menú/áreas/desglose/precio) → sí: responde
          no: Groq con FICHA CRM + BLOQUE DE PRECIO + BLOQUE DE RUTA + memoria
        → guards (cédula rechazada) → tríptico [PDF:] → enviar → ctx_pendiente nueva
```

- **DÓNDE BUSCAR** (sección #0 del prompt): Ficha CRM → Bloque de precio oficial →
  Catálogo por áreas → Tabla de grado → trípticos solo malla. Si no está: «el equipo
  comercial lo confirma hoy», jamás inventar.
- **ctx_pendiente**: cuando Diana pregunta nombre/área/horario, el código lo deja
  anotado; el extractor del turno siguiente lo lee. No más menús repetidos.

## 4. Campaña de egresados (ya integrada)

- Importar contactos: `node importar-campana.js contactos_educacion_import.csv`
- Controlar en `.env`: `CAMPANA_ACTIVOS=false` (activa) y `CAMPANA_DRY_RUN=true`
  (simulación). Modo seguro recomendado: `CAMPANA_ACTIVOS=true` + `CAMPANA_DRY_RUN=true`
  2-3 días mirando la consola, luego `CAMPANA_DRY_RUN=false`.
- Panel: `GET /api/campana` (con `x-webhook-token`) → estados, límite del día,
  envíos de hoy, contactos.
- Reglas anti-baneo intactas: 6-9 mensajes/día TOTAL, L-V en 2 ventanas,
  50-110 min entre envíos, máx. 2 toques, `no_interesado` respeta para siempre.

## 5. Endpoints útiles

| Endpoint | Para qué |
|---|---|
| `GET /health` | Estado + versión 5.0.0 |
| `GET /api/kpis?dias=7` | Los 8 KPIs del manual |
| `GET /api/leads` / `GET /api/lead/:phone` | Panel y ficha completa |
| `GET /api/calendario` | **Ya funciona**: llamadas agendadas con asesor |
| `POST /api/lead/:phone/handoff` | Escalar a humano |
| `GET /api/catalogo/estado` + `POST /api/sync-catalogo` | Matriz de valores (días 1 y 16) |
| `GET /api/campana` | Panel de la campaña de egresados |

## 6. Archivos del paquete

```
server.js            webhook + panel + campaña + sync programado
session-store.js     CRM SQLite (etapas, eventos, KPIs, agenda, ctx_pendiente)
crm-extractor.js     extracción determinista (cédula, perfil, área, ruta, objeciones)
menu-service.js      precios oficiales + menús/botones/listas + flujos de catálogo
prompt-engine.js     Manual Diana + DÓNDE BUSCAR + catálogo por áreas
diana-router.js      ★ capa de consistencia (intención → fuente + BLOQUE DE RUTA)
sync-catalogo.js     descarga SharePoint + diff + reporte (días 1 y 16)
followup-scheduler.js protocolo anti-visto (3 toques) + recordatorio 48h
campanas-crm.js      campaña de egresados (tope diario, botones, estados)
importar-campana.js  importa el CSV de contactos
wa-client.js         Evolution API (texto/media/botones/listas con timeouts)
ai-provider.js       Groq → Gemini → Ollama (failover)
memoria.js           memoria permanente por usuario
pdf-service.js       trípticos (material/ o UBE_MATERIAL_DIR)
tts-service.js / audio-processor.js / vision-handler.js   voz, Whisper, OCR
public/index.html    simulador web
data/                precios.json (matriz) + catálogo + links
test-*.js            5 suites: 207 checks
AUDITORIA-V5.md      informe completo de la auditoría
LEEME-V3.md / LEEME-V4.md   historial de versiones
```
