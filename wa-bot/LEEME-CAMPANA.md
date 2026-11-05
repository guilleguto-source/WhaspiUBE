# Campaña Graduados Educación 2026 — Guía de instalación y operación

Sistema de outreach para escribir a los graduados de Educación (enero 2026) y
ofrecerles las maestrías UBE, con límites anti-baneo y registro completo en el
CRM (SQLite) que ya usa WhaspiUBE.

## Archivos del paquete

| Archivo | Para qué |
|---|---|
| `campanas-crm.js` | El módulo: tabla `campana_contactos`, scheduler, botones, respuestas |
| `importar-campana.js` | Importa el CSV de contactos al CRM (incremental) |
| `test-campana.js` | 20 pruebas sin WhatsApp: `node test-campana.js` |
| `contactos_educacion_import.csv` | Los 355 números extraídos y verificados de los 7 grupos |
| `Campana_Maestrias_Educacion_2026.xlsx` | (aparte) Contactos, plan diario, textos y checklist |

## 1. Instalación

1. Copiar `campanas-crm.js`, `importar-campana.js` y `test-campana.js` a la carpeta `wa-bot/`.
2. Copiar `contactos_educacion_import.csv` a `wa-bot/`.
3. Verificar el módulo: `node test-campana.js contactos_educacion_import.csv` → debe dar **20 OK / 0 fallos**.
4. Importar: `node importar-campana.js contactos_educacion_import.csv`.

## 2. Integración en `server.js` (3 líneas)

```js
// junto a los demás requires:
const { CampanaGrupos } = require('./campanas-crm');

// después de crear sessionStore y waClient:
const campana = new CampanaGrupos({ store: sessionStore, waClient });

// dentro del handler del /webhook, AL INICIO del procesamiento de cada mensaje:
const accionCampana = campana.responder(phone, texto);
if (accionCampana && accionCampana.mensaje) {
  await waClient.sendText(phone, accionCampana.mensaje);
  return res.json({ ok: true, campana: accionCampana.accion });   // no pasa al LLM
}
// si accionCampana === null o accionCampana.mensaje === null → el flujo normal de Diana continúa
```

Y para que la campaña envíe por su cuenta, al arrancar el servidor:

```js
campana.iniciar();
```

## 3. Variables de entorno (`.env`)

```ini
CAMPANA_ACTIVOS=false     # ← true SOLO cuando el número esté caliente
CAMPANA_DRY_RUN=true      # ← true = solo imprime en consola, no envía nada
CAMPANA_FASE1_MAX=6          # mensajes/día EN TOTAL (primeros + seguimientos)
CAMPANA_FASE2_MAX=9          # desde la semana 3, también en total
CAMPANA_HORA_INICIO1=08:45
CAMPANA_HORA_FIN1=11:50
CAMPANA_HORA_INICIO2=14:35
CAMPANA_HORA_FIN2=17:25
CAMPANA_INTER_MIN_MS=3000000    # 50 min entre envíos
CAMPANA_INTER_MAX_MS=6600000    # 110 min entre envíos
CAMPANA_TOQUE2_HORAS=72
CAMPANA_CIERRE_DIAS=7
```

**Modo seguro recomendado:** dejar `CAMPANA_ACTIVOS=true` con `CAMPANA_DRY_RUN=true`
durante 2–3 días: verás en consola a quién le escribiría y con qué mensaje, sin
tocar WhatsApp. Cuando confíes en el ritmo, `CAMPANA_DRY_RUN=false`.

## 4. Botones y respuestas

El primer mensaje intenta enviarse con **botones interactivos**:

- **Quisiera más información** → Diana continúa (pide nombre + ciudad, luego el
  embudo normal: perfil → ficha → triptico).
- **Ya la estoy cursando** → cierre amable, estado `ya_cursando`.
- **No recibir más mensajes** → cierre, estado `no_interesado`, no vuelve a escribir.

Si la versión de `wa-client` no tiene `sendButtons`, el módulo manda el mismo
mensaje con las 3 opciones numeradas (1️⃣ 2️⃣ 3️⃣) y acepta tanto el número como
las palabras clave. También detecta `salir`, `no molestar`, `no me interesa`.

## 5. Flujo de estados

```
pendiente → enviado_inicial → interesado (Diana continúa)
                            → ya_cursando (fin)
                            → no_interesado (fin)
                            → sin_respuesta (fin, tras toque 2 + 7 días)
```

- Máximo **2 toques** por contacto (M1 + toque 2 a las 72 h).
- Todo queda en `campana_contactos` y en `crm_eventos` (auditable).

## 6. Reglas anti-baneo (no negociables)

1. **Calentar el número 1–2 semanas** antes: conversaciones reales con conocidos,
   foto de perfil y descripción configurada (Diana León – UBE).
2. **Fase 1 (semanas 1–2): 6/día.** Subir a 9/día solo si no hubo señales de bloqueo.
   El tope diario cuenta TODOS los mensajes de ese día (primeros contactos Y
   seguimientos de 72 h): nunca salen más de 6–9 al día. El scheduler prioriza
   los seguimientos dentro del tope; si el día se llena, los primeros contactos
   pasan a mañana.
3. Envíos **espaciados 50–110 min** (el módulo lo hace solo), solo L–V en horario hábil.
4. Nunca un tercer toque. Respetar cada `no_interesado` para siempre.
5. Señales de alarma → pausar de inmediato: mensajes que no entregan (un solo
   check), respuestas hostiles, o aviso de restricción de WhatsApp.

## 7. Consultas útiles

```sql
-- Resumen de la campaña
SELECT estado, COUNT(*) FROM campana_contactos GROUP BY estado;
-- Enviados hoy
SELECT phone, nombre, hora_sugerida FROM campana_contactos
 WHERE estado='enviado_inicial' AND date(enviado_en/1000,'unixepoch')=date('now');
-- Quién pidió salir (nunca recontactar)
SELECT phone, nombre FROM campana_contactos WHERE estado='no_interesado';
```
