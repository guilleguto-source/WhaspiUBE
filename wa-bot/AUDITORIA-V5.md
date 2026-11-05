# AUDITORÍA COMPLETA DE CÓDIGO · WhaspiUBE v5 (noviembre 2026)

Alcance: los 12 módulos del bot (~5.800 líneas JS): `server.js`, `session-store.js`,
`crm-extractor.js`, `menu-service.js`, `prompt-engine.js`, `sync-catalogo.js`,
`followup-scheduler.js`, `wa-client.js`, `campanas-crm.js`, `importar-campana.js`,
`ai-provider.js`, `memoria.js` + base de datos SQLite y endpoints.

Método: lectura completa del código, ejecución del bot real, replicación de cada
sospecha con pruebas, batería de 207 checks (53 embudo + 37 menús + 22 campaña +
54 sync + 41 auditoría). Todo hallazgo quedó corregido y cubierto por un test.

---

## 1. Hallazgos CRÍTICOS (rompían funcionalidad) — 6

| # | Bug | Efecto real | Corrección v5 |
|---|-----|-------------|----------------|
| C1 | El middleware de seguridad `webhookAutenticado` se usaba como middleware Express pero devolvía `true/false` sin llamar `next()` | **Cualquier endpoint protegido se colgaba para siempre**: `/api/catalogo/estado`, `/api/sync-catalogo` (y ahora `/api/campana`). Reproducido en vivo | Nuevo `middlewareWebhookAuth(req,res,next)` que responde 401 y continúa; comparación timing-safe además |
| C2 | `server.js` llamaba `sessionStore.listarLlamadasAgendadas()`, método que **no existía** en session-store | `/api/calendario` devolvía **500 siempre** → el asesor humano no tenía agenda | Método implementado (orden por fecha, estado pendiente/completada/cancelada) |
| C3 | `actualizarLead`/`getLead` **descartaban en silencio** campos que el resto del sistema sí usaba: `area_interes_maestria`, `area_titulo`, `llamada_agendada_horario`, `llamada_agendada_ts`, `llamada_estado` | El área elegida por el aspirante **se perdía en el turno siguiente** (Diana volvía a preguntar); las citas agendadas por botón no quedaban registradas | Columnas nuevas con migración automática + persistencia + lectura; el área ahora además aparece en la ficha que Diana ve |
| C4 | **Doble taxonomía de áreas**: extractor y prompt-engine usaban nombres largos («Ciencias Administrativas y Económicas») que NO existen en la matriz real («Administración y Negocios») | El paso 2 del catálogo caía en **«contamos con 0 maestrías»** para 2 de las 5 áreas (Administración y Derecho) | Una sola fuente: `AREAS_MAESTRIAS` (menu-service) = la de `data/precios.json`; extractor y prompt-engine importan de ahí; verificado contra la matriz en test |
| C5 | «quiero la maestría en educación» generaba ficha **contradictoria**: `ruta=maestria` + `carrera=Licenciatura en Ciencias de la Educación` | Diana vendía una licenciatura a un profesional que pidió maestría | Guardia en el extractor: si menciona maestría/posgrado, una carrera de grado jamás se registra; se infiere el área y el catálogo resuelve |
| C6 | El ZIP v4 **no era autosuficiente**: `server.js` requería 6 módulos que no venían en el paquete (`ai-provider`, `audio-processor`, `vision-handler`, `pdf-service`, `tts-service`, `memoria`) ni `public/` | El paquete entregado **no arrancaba** en una carpeta limpia (MODULE_NOT_FOUND) | v5 se empaqueta completo: los 12 módulos + `public/` + `package.json` real + `.env.example` |

## 2. Hallazgos IMPORTANTES — 7

| # | Bug | Efecto real | Corrección v5 |
|---|-----|-------------|----------------|
| I1 | La campaña no estaba integrada en `server.js` (pedía edición manual) y sus **botones no se reconocían**: el patrón `\binfo\b` nunca coincide con `campaña_info` (el `_` es carácter de palabra); IDs con «ñ» | Los clics de «Quisiera más información»/«Ya la estoy cursando» **se perdían** y Diana respondía fuera del guion de campaña | Integración nativa + manejo explícito de `boton: campana_*` (IDs ahora ASCII) antes del flujo de Diana + endpoint `/api/campana` |
| I2 | El contexto «¿qué le preguntó Diana?» se adivinaba con **regex sobre el historial** que no cubrían los textos reales de los menús («¿Cuál área exploramos primero?») | Diana repetía el menú de áreas o volvía a pedir el nombre → el famoso «se marea» | Bandera determinista `ctx_pendiente` ('nombre'/'area'/'horario') que el código graba al preguntar y el extractor consume; las regex quedan como respaldo |
| I3 | JIDs **@lid** (migración WhatsApp): se creaban leads con el LID como teléfono; además la línea `parchesOperativos.origen = 'whatsapp'` pisaba cualquier etiqueta | Leads basura inaccesibles; campañas/toques apuntando a un id que no es un número | Si Evolution manda `senderPn` se usa el número real; si no, sesión `lid:<id>` con origen `whatsapp_lid` (excluida de toques y campaña automáticamente) |
| I4 | `presence.update` tomaba `data.id` (JID de la **propia instancia**) para detectar el «escribiendo…» | El debounce de escritura podía activarse del número equivocado | Se recorre `data.presences` (claves reales) con respaldo a `remoteJid` |
| I5 | Toque 3 del anti-visto prometía «Te dejo el tríptico 📎» y **nunca adjuntaba nada**; toque 1 sin nombre generaba «Hola Hola 😊» | Promesa incumplida ante el lead más frío; mal sabor en el guion | El toque 3 busca y envía el PDF real del programa (evento `pdf_enviado`); saludo arreglado |
| I6 | `purgarLeadsAntiguos()` borraba **eventos globales** antiguos aunque el lead fuera confirmado y retenido | Se perdía la bitácora de los leads que más valen (los cerrados) | La purga borra eventos solo de los leads eliminados |
| I7 | `pdf-service` con ruta por defecto de Windows (`C:\Users\Guill\...`) | En un servidor Linux `listarTodosLosPdfs()` devolvía **vacío siempre** y los trípticos jamás salían, sin ningún aviso | Orden de búsqueda: `UBE_MATERIAL_DIR` (.env) → `./material` → ruta Windows; documentado |

## 3. Código fantasma / muerto y duplicaciones — eliminado

- **2 bloques casi idénticos** del «paso 1 del catálogo» en `server.js` (pideCatalogo vs
  pideMaestriasSinArea) con textos que divergían → unificados en `menuService.respuestaAreas()`
  (un solo texto canónico). Eliminadas ~45 líneas duplicadas.
- **Paso 2 duplicado**: `server.js` reimplementaba el desglose por área que `resolverBoton('area:X')`
  ya hacía (dedup de paralelos, recorte a 10) → ahora `menuService.respuestaAreaElegida()` reutiliza
  una sola implementación.
- Regex de `pideCatalogo` duplicada (server + menu-service) con listas distintas → delegada al
  `diana-router`.
- `webhookAutenticado` como middleware roto (C1) — era el mayor «fantasma»: el código parecía
  proteger los endpoints y en la práctica los congelaba.
- Chequeo muerto `resAI?.proveedor === 'groq'` (el proveedor real es `cloud-groq`) → simplificado.
- Export inexistente en `pdf-service` (`BASE_MATERIAL_DIR` ya no existe → export `directorioMaterial`).
- Versión fantasma en `/health` («2.0.0-embudo» con el banner anunciando v4) → `5.0.0-optimizado`.

## 4. Funciones que NO se estaban aprovechando (y ahora sí)

| Función existente | Antes | Ahora |
|---|---|---|
| `sendMedia` de wa-client | Solo trípticos en turno vivo; el toque 3 prometía PDF sin usarla | Toque 3 adjunta el tríptico real |
| `listarTodosLosPdfs` | En Linux devolvía vacío (ruta Windows) → todo el motor de trípticos dormido | Portado (`./material` + .env) y verificado |
| Botones/listas de WhatsApp | La campaña los enviaba pero **no sabía leer las respuestas** | `responder()` interpreta `boton: campana_*` y degradación numerada |
| `ctx_pendiente` (nuevo) | — | El extractor deja de adivinar: la conversación lleva una bandera de «qué se preguntó» |
| `ejecutarSiTocaSync` (sync-catalogo) | Exportado y sin usar; `server.js` reimplementaba el scheduler | Se respeta la versión del server (integra aviso al admin); la del módulo queda para CLI |
| Estados de la campaña | `error` congelaba contactos para siempre | Reintento automático (a las 6 h pasa a `pendiente`) |

## 5. Capa de CONSISTENCIA (respuesta a «que el bot sepa siempre dónde buscar»)

1. **`diana-router.js` (nuevo)** — clasifica cada mensaje a UNA intención de forma
   determinista (precio_programa · programa_interes · area_elegida · catalogo_areas ·
   triptico · llamada · respuesta_nombre · saludo · conversacion) e inyecta un
   `[BLOQUE DE RUTA]` al prompt: Diana recibe indicación explícita de qué fuente usar
   y qué prohibición aplica en ese turno (máx. 4 líneas, sin gastar tokens).
2. **Prompt sección #0 «DÓNDE BUSCAR»** — jerarquía de fuentes numerada: Ficha CRM →
   Bloque de precio oficial → Catálogo por áreas → Tabla de grado → trípticos (solo
   malla/duración). «Si el dato no está en ninguna fuente: el equipo comercial lo
   confirma hoy. JAMÁS aproximes cifras ni fechas.»
3. **Taxonomía única** — extractor, prompt y menús hablan los mismos 5 nombres de área
   que la matriz de valores; verificado por test contra `precios.json`.
4. **Bandera `ctx_pendiente`** — el turno anterior deja escrito qué pregunta quedó
   pendiente; el extractor la consume. Adiós al «se mareó y repitió el menú».
5. **Área visible en la ficha CRM** — si el aspirante eligió área, Diana la ve marcada
   como «ÁREA ELEGIDA - NO vuelvas a preguntarla».
6. **LID + origen limpio** — nada de fichas duplicadas por la migración de WhatsApp.

## 6. Optimizaciones operativas

- **Timeouts** en las 6 llamadas HTTP a Evolution API (`AbortSignal.timeout`, 20 s,
  configurable `EVOLUTION_TIMEOUT_MS`): un cuelgue de la API ya no congela el pipeline.
- **Límites duros de WhatsApp** en listas: título de fila ≤ 24, descripción ≤ 72
  (antes Evolution podía rechazar el envío completo por un título largo).
- `sendMedia` falla con error claro si el archivo no existe (antes enviaba la ruta como
  «media», basura al cliente).
- Comparación de token **timing-safe** (crypto.timingSafeEqual).
- Campaña: reintentos de `error`, ids ASCII, integración sin edición manual.
- Paquete completo y portable: `package.json` real (express, dotenv, xlsx; Node ≥ 22.5),
  `.env.example` documentado y `public/` incluido.

## 7. Resultado de la batería de pruebas (207 checks, 0 fallos)

| Suite | Checks | Cubre |
|---|---|---|
| test-embudo.js | 53 | Embudo 4 turnos, cédulas, toques, KPIs (regresión v2) |
| test-v3.js | 37 | Menús, botones/listas, degradación, prompt (regresión v3/v4) |
| test-campana.js | 22 | Campaña: importación, tope diario, toque 2, cierres |
| test-sync.js | 54 | Descarga SharePoint, parsers, diff de matriz, calendario 1/16 |
| **test-auditoria.js (nuevo)** | **41** | **Cada hallazgo de esta auditoría (A1–A11)** |

Prueba de humo en vivo (`scripts/smoke-test-v5.js`): arranque real del server →
`/health` v5.0.0 · `/api/calendario` OK (antes 500) · `/api/campana` OK con 401 sin token ·
webhook acepta/rechaza token · «hola» crea lead con `ctx_pendiente=nombre` · mensaje @lid
queda aislado (`whatsapp_lid`) · LID con `senderPn` mapea al número real y detecta
«Maestría en Educación Básica» · botón `campana_info` dentro del webhook pasa la campaña
a `interesado` sin tocar el LLM.

---

## Anexo v5.1 · Hallazgo adicional corregido (post-entrega)

| # | Bug | Efecto real | Corrección v5.1 |
|---|-----|-------------|------------------|
| A-1 | El test A7 de `test-auditoria.js` ejecutaba `cam.tick()` con la **hora real del servidor**. Si corrías los tests fuera de la ventana de envío (después de las 11:50 o 17:25 de Ecuador, o en fin de semana), el tick salía temprano y el check «contacto en error se reprograma» fallaba de forma intermitente | Tests que fallan «a veces» sin ningún cambio de código (falsos positivos de regresión) | El test ahora fija un reloj simulado (lunes 09:00 Ecuador). Verificado: 207 checks × 3 rondas consecutivas, 0 fallos. Los otros 4 suites ya eran deterministas |

**Estado final v5.1:** 207 checks · 0 fallos (53 embudo + 37 menús + 54 sync + 41 auditoría + 22 campaña).

---

## Anexo v5.2 · Restauración de las 4 regresiones (verificadas en vivo)

Reportadas por el equipo al comparar v5.1 con su operación anterior. Todas
corregidas, con tests y verificación en navegador real.

| # | Regresión de v5.1 | Corrección v5.2 |
|---|-------------------|------------------|
| R1 | **TTS saliente** volvió (import de `tts-service` Kokoro + `/api/audio` + botón «🎙️ Voz» en panel) | `tts-service.js` eliminado; Diana 100% texto cálido. La transcripción de notas de voz ENTRANTES se mantiene |
| R2 | **Google Calendar eliminado**: sin `date-utils.js`, sin feed .ics, sin link 1-clic | `date-utils.js` nuevo (horarios Ecuador UTC-5), `/api/calendario/feed.ics?token=` suscribible, link TEMPLATE con fecha/hora reales que Diana envía al cliente en el mismo mensaje de la cita, y al aviso de asesores/grupo |
| R3 | **Alertas a un solo número** | `alertas.js`: leads y citas → 593960946956 + 593998600136 + grupo «UBE - Better Together»; sync (días 1/16) y errores → solo grupo (con fallback a asesores). `wa-client` ya no destruye JIDs `@g.us` |
| R4 | **PIN Gate 052020 eliminado** del panel | Overlay restaurado + protección server-side de TODA la `/api` (timing-safe). Webhook y `/health` siguen abiertos. `PANEL_PIN` configurable |

Extras: badge «undefined» en citas del panel corregido; dedupe anti-tormenta de
avisos (10 min); `/health` reporta v5.2.0.

**Estado final v5.2:** 257 checks · 0 fallos (53 embudo + 37 menús + 54 sync +
41 auditoría + 22 campaña + 50 v5.2). Verificación visual: PIN Gate, panel de
citas con feed .ics y botón Google Calendar probados en navegador real.
