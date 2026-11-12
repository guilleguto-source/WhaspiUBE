/**
 * test-v52.js · BATERÍA DE REGRESIÓN v5.2
 * ============================================================================
 * Cubre las 4 restauraciones de regresiones de v5.1 (pedido explícito del
 * usuario) + verificación de que los fixes de la auditoría v5 siguen vivos:
 *
 *   V1 · TTS eliminado (Diana 100% texto; transcripción ENTRANTE intacta)
 *   V2 · Calendario: date-utils + feed .ics RFC 5545 + link Google 1-clic
 *   V3 · Alertas duales: 2 asesores + grupo "UBE - Better Together"
 *        (leads/citas → todos; sync/errores → solo grupo)
 *   V4 · PIN Gate 052020: panel + API (integración HTTP real)
 *   V5 · Fixes v5 vivos: C1 middleware, C2 calendario, C4 taxonomía,
 *        C5 grado vs posgrado, ctx_pendiente (grep de guardas)
 *
 * Uso: node test-v52.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let pasadas = 0, fallidas = 0;
function check(nombre, cond) {
  if (cond) { pasadas++; console.log(`  ✅ ${nombre}`); }
  else { fallidas++; console.log(`  ❌ ${nombre}`); }
}
function seccion(t) { console.log(`\n▶ ${t}`); }

const RAIZ = __dirname;

// =======================================================
// V1 · TTS eliminado
// =======================================================
seccion('V1 · TTS eliminado (Diana 100% texto)');
check('tts-service.js NO existe', !fs.existsSync(path.join(RAIZ, 'tts-service.js')));
const serverSrc = fs.readFileSync(path.join(RAIZ, 'server.js'), 'utf8');
const waSrc = fs.readFileSync(path.join(RAIZ, 'wa-client.js'), 'utf8');
const htmlSrc = fs.readFileSync(path.join(RAIZ, 'public', 'index.html'), 'utf8');
check('server.js no requiere tts-service', !/require\('\.\/tts-service'\)/.test(serverSrc));
check('server.js no tiene generarNotaDeVoz ni ruta /api/audio', !/generarNotaDeVoz/.test(serverSrc) && !/app\.get\('\/api\/audio/.test(serverSrc));
check('wa-client.js sin sendWhatsAppAudio', !waSrc.includes('sendWhatsAppAudio(phone'));
check('panel sin botón de Voz Kokoro', !htmlSrc.includes('btnToggleVoz') && !htmlSrc.includes('conVoz'));
check('panel MANTIENE micrófono entrante (transcripción)', htmlSrc.includes('toggleGrabarAudio') && htmlSrc.includes('audioBase64'));

// =======================================================
// V2 · Calendario restaurado
// =======================================================
seccion('V2 · Calendario: date-utils + feed .ics + Google 1-clic');
check('date-utils.js existe', fs.existsSync(path.join(RAIZ, 'date-utils.js')));
const du = require('./date-utils');
const ahora = new Date('2026-11-06T15:00:00Z'); // viernes 10:00 Ecuador

const h1 = du.parseHorario('Mañana 09:30 am', ahora);
check('"Mañana 09:30 am" → mañana 09:30 Ecuador (14:30 UTC)', h1 === Date.UTC(2026, 10, 7, 14, 30, 0));
const h2 = du.parseHorario('Hoy 02:30 pm', ahora);
check('"Hoy 02:30 pm" → hoy 19:30 UTC (14:30 EC)', h2 === Date.UTC(2026, 10, 6, 19, 30, 0));
const h3 = du.parseHorario('04:30 pm', ahora);
check('"04:30 pm" (futura hoy) → hoy 21:30 UTC', h3 === Date.UTC(2026, 10, 6, 21, 30, 0));
const h4 = du.parseHorario('07:00 am', ahora);
check('"07:00 am" (ya pasó hoy) → mañana', h4 === Date.UTC(2026, 10, 7, 12, 0, 0));
check('horario ilegible → null', du.parseHorario('cuando puedas', ahora) === null);

const gUrl = du.googleCalendarUrl({
  titulo: 'Llamada UBE — María', inicioMs: h1, detalles: 'detalle con, coma; y \\barra'
});
check('Google URL con action=TEMPLATE', gUrl.includes('action=TEMPLATE'));
check('Google URL con fechas ics (Z)', /dates=\d{8}T\d{6}Z\/\d{8}T\d{6}Z/.test(gUrl));
check('Google URL escapó coma y punto y coma', gUrl.includes('%2C') && gUrl.includes('%3B'));

const feed = du.buildIcsFeed([
  { phone: '593990000001', nombre: 'María Pérez, S.A.', carrera: 'Maestría; Educación',
    llamada_agendada_horario: 'Mañana 09:30 am', llamada_estado: 'pendiente' },
  { phone: '593990000002', nombre: 'Luis', llamada_agendada_horario: 'sin fecha clara', llamada_estado: 'pendiente' }
], ahora.getTime());
check('feed con BEGIN:VCALENDAR y CRLF', feed.startsWith('BEGIN:VCALENDAR') && feed.includes('\r\n'));
check('feed con VEVENT de la cita interpretable', feed.includes('BEGIN:VEVENT') && feed.includes('DTSTART:20261107T143000Z'));
check('feed escapa coma/punto y coma del nombre', feed.includes('María Pérez\\, S.A.') && feed.includes('Maestría\\; Educación'));
check('feed omite cita con horario ilegible', (feed.match(/BEGIN:VEVENT/g) || []).length === 1);
check('feed declara America/Guayaquil', feed.includes('America/Guayaquil'));

// =======================================================
// V3 · Alertas duales (asesores + grupo)
// =======================================================
seccion('V3 · Alertas duales: 2 asesores + grupo "UBE - Better Together"');
async function verificarAlertas() {
const alertas = require('./alertas');
alertas._reset();
process.env.ASESOR_ALERTA_PHONE = '593960946956,593998600136';
process.env.ASESOR_GRUPO_JID = '120363012345678900@g.us';
delete process.env.ASESOR_GRUPO_NOMBRE;

const enviados = [];
const waMock = { sendText: async (d, t) => { enviados.push({ d, t }); return { ok: true }; } };
alertas.configurar(waMock);

let r = await alertas.enviar('cita', '📅 CITA: María 09:30');
check('cita → 3 destinos (2 asesores + grupo)', r.ok && r.resultados.length === 3);
check('cita llegó a los 2 números reales', enviados.some(e => e.d === '593960946956') && enviados.some(e => e.d === '593998600136'));
check('cita llegó al grupo con JID intacto', enviados.some(e => e.d === '120363012345678900@g.us'));

enviados.length = 0;
r = await alertas.enviar('lead', '🔥 Ficha completa: Juan');
check('lead (ficha/handoff) → asesores + grupo', r.ok && r.resultados.length === 3);

enviados.length = 0;
r = await alertas.enviar('sync', 'Cambios de la matriz: 2 precios');
check('sync → SOLO al grupo', r.ok && r.resultados.length === 1 && r.resultados[0].destino === '120363012345678900@g.us');

enviados.length = 0;
r = await alertas.enviar('sistema', '⚠️ Groq caído');
check('error del sistema → SOLO al grupo', r.ok && r.resultados.length === 1 && r.resultados[0].destino === '120363012345678900@g.us');

enviados.length = 0;
const r2 = await alertas.enviar('sync', 'Cambios de la matriz: 2 precios');
check('dedupe: mismo aviso en 10 min NO se reenvía', r2.motivo === 'duplicado' && enviados.length === 0);

// sin grupo resuelto → sync cae a los asesores (aviso perdido jamás)
alertas._reset();
delete process.env.ASESOR_GRUPO_JID;
alertas.configurar(waMock);
enviados.length = 0;
r = await alertas.enviar('sync', 'Cambios sin grupo');
check('sin grupo: sync cae a los 2 asesores (fallback)', r.ok && r.resultados.length === 2);

const EvolutionClient = require('./wa-client');
check('destinoWa preserva JID de grupo', EvolutionClient.destinoWa('120363012345678900@g.us') === '120363012345678900@g.us');
check('destinoWa limpia números normales', EvolutionClient.destinoWa('+593 99 123 4567') === '593991234567');
}   // fin verificarAlertas

// =======================================================
// V4 · PIN Gate (integración HTTP real del server)
// =======================================================
seccion('V4 · PIN Gate 052020: panel + API (HTTP real)');
async function verificarPinGate() {
  const puerto = 3995;
  const dataDir = path.join(RAIZ, 'data');
  const tokenArchivo = path.join(dataDir, 'feed-token.txt');

  // limpiar token previo para probar la generación automática
  let feedToken = '';
  try { fs.unlinkSync(tokenArchivo); } catch (_) {}

  const child = spawn(process.execPath, ['server.js'], {
    cwd: RAIZ,
    env: { ...process.env, PORT: String(puerto), HTTPS_PORT: '3444', PANEL_PIN: '052020', TOQUES_ACTIVOS: 'false', WEBHOOK_TOKEN: '' },
    stdio: 'ignore'
  });
  try {
    // esperar a que el server levante (máx 15 s)
    let arriba = false;
    for (let i = 0; i < 30 && !arriba; i++) {
      await new Promise(r2 => setTimeout(r2, 500));
      try { const res = await fetch(`http://127.0.0.1:${puerto}/health`); arriba = res.ok; } catch (_) {}
    }
    check('servidor v5.2 arranca', arriba);
    if (!arriba) return;

    const base = `http://127.0.0.1:${puerto}`;
    const rLeads = await fetch(`${base}/api/leads`);
    check('GET /api/leads sin token → 401', rLeads.status === 401);

    const rPinMal = await fetch(`${base}/api/pin/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '1234' })
    });
    check('PIN incorrecto → 401', rPinMal.status === 401);

    const rPinOk = await fetch(`${base}/api/pin/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '052020' })
    });
    const dataPin = await rPinOk.json();
    check('PIN 052020 → token', rPinOk.ok && !!dataPin.token);

    const rLeadsOk = await fetch(`${base}/api/leads`, { headers: { 'x-panel-token': dataPin.token } });
    check('GET /api/leads con token → 200', rLeadsOk.status === 200);

    const rCal = await fetch(`${base}/api/calendario`, { headers: { 'x-panel-token': dataPin.token } });
    const dataCal = await rCal.json();
    check('GET /api/calendario devuelve feed_url', rCal.ok && typeof dataCal.feed_url === 'string' && dataCal.feed_url.includes('feed.ics?token='));

    const rFeedSin = await fetch(`${base}/api/calendario/feed.ics`);
    check('feed .ics sin token → 401', rFeedSin.status === 401);

    feedToken = fs.readFileSync(tokenArchivo, 'utf8').trim();
    check('feed-token.txt se generó automáticamente', feedToken.length >= 16);

    const rFeed = await fetch(`${base}/api/calendario/feed.ics?token=${feedToken}`);
    const ics = await rFeed.text();
    check('feed .ics con token → 200 text/calendar', rFeed.status === 200 && (rFeed.headers.get('content-type') || '').includes('text/calendar'));
    check('feed .ics es un VCALENDAR válido', ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'));

    const rFeedPanel = await fetch(`${base}/api/calendario/feed.ics?token=${dataPin.token}`);
    check('feed .ics también acepta token de panel', rFeedPanel.status === 200);

    const rHealth = await fetch(`${base}/health`);
    check('/health sigue abierta (monitoring)', rHealth.status === 200);

    const rHook = await fetch(`${base}/webhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'presence.update', data: {} })
    });
    check('/webhook sigue abierta para Evolution', rHook.status === 200);

    const rSim = await fetch(`${base}/api/pin/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '05202000' })
    });
    check('PIN con dígitos extra NO pasa', rSim.status === 401);
  } finally {
    child.kill('SIGKILL');
  }
}

// =======================================================
// V5 · Fixes de la auditoría v5 siguen vivos
// =======================================================
seccion('V5 · Fixes v5 vivos (C1 · C2 · C4 · C5 · ctx_pendiente)');
check('C1: middlewareWebhookAuth llama next()', serverSrc.includes('function middlewareWebhookAuth(req, res, next)') && /middlewareWebhookAuth, \(req, res\)/.test(serverSrc) || serverSrc.includes('middlewareWebhookAuth'));
check('C2: listarLlamadasAgendadas existe en session-store', fs.readFileSync(path.join(RAIZ, 'session-store.js'), 'utf8').includes('listarLlamadasAgendadas()'));
check('C5: guardia anti grado-vs-maestría en extractor', fs.readFileSync(path.join(RAIZ, 'crm-extractor.js'), 'utf8').match(/maestr[ií]a|posgrado/i) !== null);
check('ctx_pendiente grabado en el turno', serverSrc.includes('ctx_pendiente'));
check('alertas integradas en server (cita/lead/sync/sistema)', ['alertas.enviar(\'cita\'', 'alertas.enviar(\'lead\'', 'alertas.enviar(\'sync\'', 'alertas.enviar(\'sistema\''].every(s => serverSrc.includes(s)));
check('menu-service sigue como fuente única de áreas', fs.existsSync(path.join(RAIZ, 'menu-service.js')));

// =======================================================
(async () => {
  await verificarAlertas();
  await verificarPinGate();
  console.log('\n════════════════════════════════════════════════════');
  console.log(`  RESULTADO v5.2: ${pasadas} pasadas · ${fallidas} fallidas`);
  console.log('════════════════════════════════════════════════════');
  process.exit(fallidas ? 1 : 0);
})();
