# LEEME v5.2 · Restauración de regresiones (TTS · Calendario · Alertas duales · PIN)

Esta versión corrige las **4 regresiones** detectadas al comparar v5.1 con la
operación real del equipo. Cada restauración está cubierta por tests
(`node test-v52.js`, 50 checks) y verificada en vivo (navegador real).

---

## 1 · Diana 100% TEXTO (TTS eliminado)

**Qué se quitó:**
- `tts-service.js` (Kokoro/Edge-TTS) — archivo eliminado del proyecto.
- Import y sintetización en `server.js` (ya no existe `conVoz` ni `audioData`).
- Endpoint `/api/audio/:fileName` (servía los MP3 del TTS).
- `sendWhatsAppAudio()` en `wa-client.js` (era su único llamador).
- Botón «🎙️ Voz: ON/OFF» del panel.

**Qué se MANTIENE:** la nota de voz que el aspirante le envía a Diana se sigue
transcribiendo (audio-processor + Whisper) y Diana responde en texto cálido.
El micrófono del simulador del panel sigue funcionando igual.

## 2 · Google Calendar restaurado (y mejorado)

- **`date-utils.js`** (nuevo): interpreta los horarios de Diana
  («Mañana 09:30 am», «Hoy 02:30 pm», «04:30 pm»…) en hora Ecuador (UTC-5),
  genera links de Google Calendar y el feed RFC 5545.
- **Link de 1 clic**: cuando se agenda una llamada (por menú o por chat), Diana
  añade al MISMO mensaje del cliente: *«🗓️ Guarda la fecha de nuestra llamada
  aquí: <link de Google Calendar con fecha y hora reales>»*. El link se guarda
  en el CRM (`llamada_calendario_url`) y reutilizan el panel y los avisos.
- **Feed suscribible**: `GET /api/calendario/feed.ics?token=<token>` — en
  Google Calendar: *Otros calendarios → Desde URL*. El token se genera solo en
  `data/feed-token.txt` y el panel lo muestra con botón «📋 Copiar».
- **Panel**: cada cita tiene su botón «📅 Google Cal» (ahora con fecha/hora
  reales, antes abría el evento sin hora).

## 3 · Alertas duales + grupo «UBE - Better Together»

Nueva capa `alertas.js` con canales por tipo (configurado en `.env`):

| Tipo | Destinos |
|------|----------|
| `lead` (ficha completa / handoff) | 📱 593960946956 + 📱 593998600136 + 👥 grupo |
| `cita` (llamada agendada, con link de calendario) | 📱 + 📱 + 👥 grupo |
| `sync` (reporte de la matriz, días 1 y 16) | 👥 **solo grupo** |
| `sistema` (errores críticos, con anti-tormenta 10 min) | 👥 **solo grupo** |

```env
ASESOR_ALERTA_PHONE=593960946956,593998600136
ASESOR_GRUPO_NOMBRE=UBE - Better Together
# o el JID directo: ASESOR_GRUPO_JID=120363xxxx@g.us
```

> ⚠️ **Requisito**: el número del BOT debe ser miembro del grupo. Si el grupo
> no se encuentra (nombre cambiado o bot fuera), `sync`/`sistema` caen a los
> números de asesores como respaldo — un aviso duplicado es mejor que uno
> perdido. `wa-client` ya preserva JIDs de grupo (`@g.us`) en TODOS los envíos.

## 4 · PIN Gate institucional restaurado (más fuerte que antes)

- **Overlay en el panel**: pide el PIN al abrir; correcto → token en
  `sessionStorage` (se cierra sesión al cerrar la pestaña). PIN mal → error.
- **También protege la API**: TODA `/api/*` exige el token (header
  `x-panel-token`). Sin PIN no se ven leads, catálogo, KPIs ni calendario.
- **Excepciones** (necesarias): `/health` (monitoring), `/webhook` (Evolution
  no puede enviar el PIN) y `/api/pin/verify`.
- Comparación **timing-safe** en PIN y tokens. PIN configurable:
  `PANEL_PIN=052020` en `.env` (por defecto 052020).

## Extras corregidos en el camino

- **Badge de citas «undefined»**: `listarLlamadasAgendadas()` borraba
  `llamada_estado` al renombrarlo → el panel mostraba «undefined». Ahora expone
  ambos campos.
- `/health` reporta `version: 5.2.0-restaurado`.

## Tests

```bash
npm test        # 6 baterías: 257 checks en total
#   53 embudo + 37 menús + 54 sync + 41 auditoría + 22 campaña + 50 v5.2
```

`test-v52.js` arranca el servidor REAL en un puerto de prueba y valida el PIN
Gate por HTTP (401 sin token, 401 PIN mal, token correcto, feed con token,
webhook abierto…), además de las unidades de `date-utils` y `alertas`.

## Migración desde v5.1

1. Reemplazar los archivos (o usar el ZIP completo en carpeta limpia).
2. Añadir a tu `.env`:
   ```env
   PANEL_PIN=052020
   ASESOR_ALERTA_PHONE=593960946956,593998600136
   ASESOR_GRUPO_NOMBRE=UBE - Better Together
   ```
3. Añadir el número del bot al grupo «UBE - Better Together» (si aún no está).
4. `npm install && npm start` — abrir el panel y desbloquear con el PIN.
