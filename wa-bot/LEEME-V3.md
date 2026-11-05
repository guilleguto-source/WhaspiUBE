# WhaspiUBE v3 — Menús interactivos + Matriz de valores oficial + Blindaje de cédulas

Fecha: 04-nov-2026 · Base: repo `main` @ `04b6858` (catálogo modular 2 pasos + parches P0-P1)

## ¿Qué trae la v3?

### 1. Saludo de primer contacto (determinista)
- Al primer mensaje de un lead nuevo con saludo genérico ("hola", "buenas", "información"),
  Diana **saluda, se presenta, pide el nombre y ofrece GRADO y MAESTRÍAS desde el inicio**
  con un menú interactivo (lista de WhatsApp): Grado · Maestrías · Validación · Hablar con asesor.
- Si el aspirante abre consultando un **programa específico** (ej. "cuánto vale enfermería"),
  Diana responde directo sin menú (regla: "a menos que escriban por 1 de las 2 en específico").
- Implementado en `menu-service.js` (`saludoPrimerContacto`, `esSaludoGenerico`) + rama v3-B en `server.js`.

### 2. Botones y listas de WhatsApp (por fin)
- `wa-client.js` suma **`sendButtons`** (≤3 opciones) y **`sendList`** (hasta 10 filas) para Evolution API,
  probando 2 formatos de payload y **degradando a texto numerado** si la instancia no soporta interactivos:
  la conversación nunca se cae.
- El webhook ahora **entiende las respuestas** de botones/lista (`buttonsResponseMessage`,
  `listResponseMessage`, `interactiveResponseMessage`) y las normaliza a `boton: <id>`.
- Rutas deterministas: `menu_grado`, `menu_maestrias` (5 áreas como lista), `area:<Área>`
  (listado con fechas de inicio), `menu_validacion`, `menu_asesor` (horarios como botones),
  `llamada:<horario>` (agenda la cita y avisa al asesor por WhatsApp).
- El simulador web recibe `buttons`/`list` en la respuesta de `/api/chat` para renderizarlos.

### 3. Matriz de valores oficial (`data/precios.json`)
- Generada desde **INSCRIPCIONES UBE (3).xlsx** (hojas `MAESTRÍAS 2`, `PRECIOS MAESTRIAS (2)`,
  `PRECIOS - GRADO Y PROGRAMAS (2)`, `GRADO Y PROGRAMAS ESPECIALE (2)` e `INGLÉS`).
- Contiene: 57 maestrías (50 con precio fusionado con el calendario vigente 2026-11 → 2027-03),
  20 carreras de grado, 18 programas de validación, reglas comerciales (inscripción, PRE,
  matrícula por semestre, inglés $110/módulo, descuentos 5%/10%) y **17 incidencias** documentadas.
- La hoja `PARALELOS 2023` se descartó (fechas obsoletas).
- El bloque de precio exacto del programa activo se **inyecta al prompt** de Diana
  (`[BLOQUE DE PRECIO OFICIAL]`), y la regla 6.0 del prompt **prohíbe inventar cifras**.
- Fechas ya pasadas se publican como "por confirmar" (el calendario se actualiza cada mes).

### 4. Blindaje de cédulas (simulacros encontraron y corrigieron esto)
- Ya no se rechaza una cédula 09… por palabras sueltas ("Me **llam**a la atención" — bug real).
- Se aceptan cédulas con separadores: `090234567-7`.
- Cédulas con **dígito de más/menos** (9, 11 o 12 dígitos) o módulo 10 inválido →
  evento `cedula_rechazada` + nota `[CÉDULA NO VÁLIDA]` al prompt + **guardia determinista**
  en server.js que reescribe cualquier respuesta del modelo que diga "cédula registrada".

### 5. Correcciones al prompt (prompt-engine.js)
- Turno 1: saludo + nombre + oferta GRADO/MAESTRÍAS en el primer mensaje.
- Regla para mensajes que llegan de botón/menú.
- Sección 6.0 "Regla de oro de valores" + tabla de grado **actualizada con la matriz**
  (la vieja tenía 8 de 16 valores desactualizados) + PE con valores reales (SSO $192,
  Eléctrica $160, Biomedicina $200, Enfermería $300, etc.).
- Turno 4: sin cifras de ejemplo citables, sin pronto pago inventado para presenciales
  y maestrías.

### 6. CRM/extractor (crm-extractor.js)
- Nombre sin coma: "Maritza Galarza de Guayaquil…" y "carmen yanez desde ambato…" se capturan.
- "área de Educación" en flujo maestrías ya no pisa la carrera con la licenciatura de grado.
- Fix `mba` sin fronteras (capturaba "a**MBA**to"), verbos prohibidos ("vivo en…").

## Instalación (3 pasos)
1. Respaldar `wa-bot/` (sobre todo `data/` y `certs/`).
2. Copiar sobre `wa-bot/`: `server.js`, `prompt-engine.js`, `crm-extractor.js`, `wa-client.js`,
   `menu-service.js`, `test-v3.js`, `simulacro-llm.mjs` y la carpeta `data/` (incluye `precios.json`).
3. Verificar y arrancar:
   ```bash
   node test-embudo.js   # 53 checks (base)
   node test-v3.js       # 37 checks (saludo/botones/precios)
   node server.js        # producción
   ```

## Mantenimiento mensual (importante)
El Excel de SharePoint **se actualiza cada mes**. Al recibir la nueva versión:
```bash
python3 scripts/generar_precios_json.py   # regenerar data/precios.json
node test-v3.js                            # re-verificar cifras
```
(El script lee `/home/z/my-project/upload/INSCRIPCIONES UBE (n).xlsx`; ajustar la ruta del
archivo si cambia el nombre.) Revisar el CSV `Incidencias_Valores_UBE.csv` con finanzas.

## Simulacros
- Deterministas: `node test-embudo.js` (53) + `node test-v3.js` (37).
- Conversacionales (LLM real): `node simulacro-llm.mjs` — 12 personajes de la batería
  (jerga, typos, cédulas malformadas, inconsistencias, inyección de prompt, monosílabos).
  Última corrida: **12/12 sin hallazgos** · reporte en `simulacro_llm_reporte.json`.
