/**
 * test-embudo.js · v2 — Prueba determinista del embudo en 4 turnos (sin LLM)
 * ---------------------------------------------------------------------------
 * Valida el pipeline CRM completo del manual Diana:
 *   1. Máquina de etapas: lead_nuevo → lead_calificado → cedula_capturada → ficha_completa
 *   2. Extractor: cédula válida/inválida, perfil bachiller vs docente (fix),
 *      nombre desnudo, ruta, ciudades, objeciones, confirmación T4.
 *   3. Protocolo anti-visto: toques a 24h / 72h / 5 días + liberación.
 *   4. Recordatorio de 48h post-ficha.
 *   5. KPIs de la Sección 12 del manual.
 *
 * Uso:  node test-embudo.js
 * No requiere Ollama ni claves de API (el LLM queda fuera del alcance
 * determinista; su comportamiento se prueba con test-ube.js / simulador web).
 */

process.env.NODE_ENV = 'test_dry_run';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SessionStore = require('./session-store');
const FollowupScheduler = require('./followup-scheduler');
const { extraerDatosLead, esCedulaValida } = require('./crm-extractor');

// ---------------------------------------------------------------- utilidades
let pasadas = 0;
let fallidas = 0;

function check(nombre, condicion, detalle = '') {
  if (condicion) {
    pasadas++;
    console.log(`  ✅ ${nombre}`);
  } else {
    fallidas++;
    console.log(`  ❌ ${nombre} ${detalle ? '— ' + detalle : ''}`);
  }
}

const dbPath = path.join(os.tmpdir(), `test_embudo_${Date.now()}.db`);
const store = new SessionStore(dbPath);

// Simula el flujo de server.js: extraer → actualizar → avanzar etapa
function turno(phone, texto, ctx = {}, extra = {}) {
  const lead = store.obtenerOCrearLead(phone, { origen: 'whatsapp' });
  const parches = extraerDatosLead(texto, lead, ctx);
  const objecion = parches._objecion || null;

  const operativos = {
    ...parches,
    mensajes_usuario: (lead.mensajes_usuario || 0) + 1,
    ultimo_msg_usuario_ts: extra.ts || Date.now(),
    primer_msg_ts: lead.primer_msg_ts || extra.ts || Date.now(),
    toques_reinicio: undefined
  };
  if ((lead.toques_enviados || 0) > 0) {
    store.registrarEvento(phone, 'recuperado', { tras_toques: lead.toques_enviados });
    operativos.toques_enviados = 0;
    operativos.ultimo_toque_ts = null;
  }
  delete operativos.toques_reinicio;

  const actualizado = store.actualizarLead(phone, operativos);
  store.avanzarEtapa(phone);
  if (objecion) store.registrarEvento(phone, 'objecion', { tipo: objecion });
  store.appendMessage(phone, 'user', texto);
  const post = store.actualizarLead(phone, {
    mensajes_diana: (store.getLead(phone).mensajes_diana || 0) + 1,
    ultimo_msg_diana_ts: (extra.ts || Date.now()) + 3000
  });
  if (post && !post.tfpr_ms) {
    store.actualizarLead(phone, { tfpr_ms: 4000 + Math.floor(Math.random() * 3000) });
  }
  return store.getLead(phone);
}

// =====================================================================
async function main() {
console.log('\n════════════════════════════════════════════════════');
console.log('  T E S T   E M B U D O   D I A N A   ·   U B E   v2');
console.log('════════════════════════════════════════════════════\n');

// ---------------------------------------------------------------- 0. validador
console.log('▶ 0 · Validador de cédula ecuatoriana (módulo 10)');
check('Cédula válida 0912345675 (Guayas) aceptada', esCedulaValida('0912345675'));
check('Cédula válida 1712345675 (Pichincha) aceptada', esCedulaValida('1712345675'));
check('Celular 0987654321 rechazado por dígito verificador', !esCedulaValida('0987654321'));
check('Cédula provincia inválida 9912345675 rechazada', !esCedulaValida('9912345675'));
check('Cédula de 9 dígitos rechazada', !esCedulaValida('091234567'));

// ---------------------------------------------------------------- 1. caso María
console.log('\n▶ 1 · Caso MARÍA — validación PE-15 (ruta validacion)');
const MARIA = '593991234567';

let m = turno(MARIA, 'hola', { telefonoRemitente: MARIA });
check('T1: lead creado en lead_nuevo', m.etapa === 'lead_nuevo', `etapa=${m.etapa}`);

m = turno(MARIA, 'quiero titular mi experiencia laboral');
check('T1: ruta = validacion', m.ruta === 'validacion', `ruta=${m.ruta}`);

m = turno(MARIA, 'María', { preguntaNombre: true });
check('T2: nombre desnudo capturado tras "¿con quién tengo el gusto?"', m.nombre === 'María', `nombre=${m.nombre}`);

m = turno(MARIA, 'Guayaquil');
check('T2: ciudad capturada', m.ciudad === 'Guayaquil', `ciudad=${m.ciudad}`);

m = turno(MARIA, 'soy docente, tengo 10 años de experiencia');
check('T2: perfil = docente_4anos (PE-15)', m.perfil === 'docente_4anos', `perfil=${m.perfil}`);
check('T2: etapa avanza a lead_calificado', m.etapa === 'lead_calificado', `etapa=${m.etapa}`);

m = turno(MARIA, '0912345675');
check('T3: cédula válida capturada', m.cedula === '0912345675', `cedula=${m.cedula}`);
check('T3: etapa avanza a cedula_capturada', m.etapa === 'cedula_capturada', `etapa=${m.etapa}`);
check('T3: beneficio = revision_experiencia (por ruta)', m.beneficio === 'revision_experiencia', `beneficio=${m.beneficio}`);

m = turno(MARIA, 'sí, todo correcto, aparta mi cupo');
check('T4: confirmación detectada', m.confirmado === true, `confirmado=${m.confirmado}`);
check('T4: etapa final = ficha_completa', m.etapa === 'ficha_completa', `etapa=${m.etapa}`);

// ---------------------------------------------------------------- 2. caso Carlos
console.log('\n▶ 2 · Caso CARLOS — grado (regresiones del extractor)');
const CARLOS = '593987654321';

let c = turno(CARLOS, 'buenas, cuánto cuesta psicología');
check('T1: carrera = Licenciatura en Psicología', c.carrera === 'Licenciatura en Psicología', `carrera=${c.carrera}`);
check('T1: ruta inferida = grado (mencionó carrera)', c.ruta === 'grado', `ruta=${c.ruta}`);

c = turno(CARLOS, 'salí del colegio hace 2 años');
check('REGRESIÓN: "salí del colegio hace 2 años" → bachiller (NO docente)', c.perfil === 'bachiller', `perfil=${c.perfil}`);

c = turno(CARLOS, 'me llamo Carlos Mendoza');
check('T2: nombre capturado por presentación', c.nombre === 'Carlos Mendoza', `nombre=${c.nombre}`);

c = turno(CARLOS, 'vivo en Quito');
check('T2: ciudad capturada', c.ciudad === 'Quito', `ciudad=${c.ciudad}`);
check('T2: etapa = lead_calificado', c.etapa === 'lead_calificado', `etapa=${c.etapa}`);

c = turno(CARLOS, 'mi número es 0987654321 para cualquier cosa');
check('REGRESIÓN: celular con contexto NO capturado como cédula', !c.cedula, `cedula=${c.cedula}`);

c = turno(CARLOS, '1712345675');
check('T3: cédula válida de Pichincha capturada', c.cedula === '1712345675', `cedula=${c.cedula}`);

c = turno(CARLOS, 'no, todavía no, déjame pensarlo');
check('T4: negativa NO marca confirmación', !c.confirmado, `confirmado=${c.confirmado}`);

c = turno(CARLOS, 'listo, aparta el cupo');
check('T4: confirmación tardía detectada → ficha_completa', c.confirmado && c.etapa === 'ficha_completa', `confirmado=${c.confirmado} etapa=${c.etapa}`);

// ---------------------------------------------------------------- 3. objeciones
console.log('\n▶ 3 · Objeciones y estados laterales');
const PEDRO = '593960000111';
turno(PEDRO, 'soy Pedro Gómez, de Milagro');
turno(PEDRO, 'vengo directo del colegio');
turno(PEDRO, 'hola, cuánto cuesta derecho');
let p = turno(PEDRO, 'la cuota está muy alta para mí');
const evObj = store.listarEventos(PEDRO).filter(e => e.tipo === 'objecion');
check('Objeción de precio registrada como evento', evObj.length === 1 && evObj[0].meta.tipo === 'precio');

p = turno(PEDRO, '¿y para qué quieres mi cédula?');
const evObj2 = store.listarEventos(PEDRO).filter(e => e.tipo === 'objecion');
check('Objeción de cédula registrada como evento', evObj2.length === 2 && evObj2[1].meta.tipo === 'cedula');

// Handoff humano (plan B del manual)
store.obtenerOCrearLead(PEDRO, { origen: 'whatsapp' });
store.actualizarLead(PEDRO, { cedula: '0912345675' });
store.avanzarEtapa(PEDRO);
store.actualizarLead(PEDRO, { etapa: 'en_espera_humano' });
store.registrarEvento(PEDRO, 'handoff_humano', { motivo: 'objecion_cedula' });
p = store.getLead(PEDRO);
check('Handoff a asesor humano: etapa en_espera_humano', p.etapa === 'en_espera_humano', `etapa=${p.etapa}`);

// ---------------------------------------------------------------- 4. persistencia
console.log('\n▶ 4 · Persistencia de la ficha CRM (fix crítico de 24h)');
store.getHistory(MARIA); // no debe romper nada
const hace2Dias = Date.now() - 2 * 24 * 60 * 60 * 1000;
store.db.prepare('UPDATE sessions SET updated_at = ? WHERE phone = ?').run(hace2Dias, MARIA);
const histExpirada = store.getHistory(MARIA);
check('Historial conversacional expira a las 24h', histExpirada.length === 0);
const mariaViva = store.getLead(MARIA);
check('FIX CRÍTICO: la ficha CRM SOBREVIVE tras 24h de silencio', mariaViva && mariaViva.nombre === 'María' && mariaViva.etapa === 'ficha_completa');
const purgados = store.purgarLeadsAntiguos();
check('Purga solo elimina fichas de >180 días', purgados === 0, `purgados=${purgados}`);

// ---------------------------------------------------------------- 5. scheduler
console.log('\n▶ 5 · Protocolo anti-visto (3 toques) y recordatorio 48h');
const enviados = [];
const waMock = { sendText: async (phone, text) => { enviados.push({ phone, text }); return { ok: true }; } };
const scheduler = new FollowupScheduler(store, waMock, { intervaloMs: 60000, enviarReal: true });
check('Scheduler respeta horario 08h-20h', scheduler.dentroDeHorario(new Date().setHours(3, 0, 0, 0)) === false);

// Hora de evaluación fija dentro de la franja laboral (determinista)
const AHORA = new Date();
AHORA.setHours(10, 0, 0, 0);
const AHORA_TS = AHORA.getTime();
const H = 60 * 60 * 1000;

const SILENTE = '593970000222';
store.obtenerOCrearLead(SILENTE, { origen: 'whatsapp' });
store.actualizarLead(SILENTE, {
  nombre: 'Andrea', carrera: 'Licenciatura en Enfermería', ruta: 'grado',
  mensajes_usuario: 2, mensajes_diana: 2,
  ultimo_msg_usuario_ts: AHORA_TS - 25 * H, // hace 25 h
  primer_msg_ts: AHORA_TS - 25 * H,
  tfpr_ms: 12000, push_name: 'Andrea'
});

// Día 0 (10:00): silencio de 25 h → TOQUE 1 (recicla la pregunta original)
let r1 = await scheduler.evaluar(AHORA_TS);
let andrea = store.getLead(SILENTE);
check('Toque 1 enviado a las 24h', r1.toques >= 1 && andrea.toques_enviados === 1, `toques=${andrea.toques_enviados}`);
check('Toque 1 recicla la pregunta original', enviados.some(e => /quedó pendiente tu consulta/i.test(e.text)));
check('Etapa sigue viva tras toque 1 (no liberado)', andrea.etapa !== 'sin_respuesta');

// Día 2 (10:00): silencio acumulado de 73 h → TOQUE 2 (reserva de cupo)
const DIA = 24 * H;
await scheduler.evaluar(AHORA_TS + 2 * DIA);
andrea = store.getLead(SILENTE);
check('Toque 2 (reserva de cupo) enviado a las 72h', andrea.toques_enviados === 2, `toques=${andrea.toques_enviados}`);
check('Toque 2 usa el guión de reserva de cupo', enviados.some(e => /reservo el espacio|apartarte uno/i.test(e.text)));

// Día 5 (10:00): silencio de ~6 días → TOQUE 3 + liberación
await scheduler.evaluar(AHORA_TS + 5 * DIA);
andrea = store.getLead(SILENTE);
check('Toque 3 enviado tras 5-7 días', andrea.toques_enviados === 3, `toques=${andrea.toques_enviados}`);
check('Lead liberado con etapa sin_respuesta (puerta abierta)', andrea.etapa === 'sin_respuesta', `etapa=${andrea.etapa}`);
check('Toque 3 usa el guión de liberación', enviados.some(e => /retomamos exactamente donde quedamos/i.test(e.text)));

// Día 6: NUNCA más de 3 toques
const rFinal = await scheduler.evaluar(AHORA_TS + 6 * DIA);
check('NUNCA más de 3 toques', store.getLead(SILENTE).toques_enviados === 3 && rFinal.toques === 0);

// El prospecto responde tras la liberación → el lead revive y el ciclo se reinicia
turno(SILENTE, 'sí, aún me interesa');
andrea = store.getLead(SILENTE);
check('Respuesta del prospecto reinicia el ciclo de toques', andrea.toques_enviados === 0, `toques=${andrea.toques_enviados}`);
check('Lead revivido sale de sin_respuesta', andrea.etapa !== 'sin_respuesta', `etapa=${andrea.etapa}`);
check('Evento de recuperación registrado', store.listarEventos(SILENTE).some(e => e.tipo === 'recuperado'));

// Recordatorio de 48h para ficha confirmada
store.actualizarLead(MARIA, { ultimo_msg_usuario_ts: AHORA_TS - 49 * H });
const rRec = await scheduler.evaluar(AHORA_TS);
const mariaRec = store.getLead(MARIA);
check('Recordatorio 48h enviado tras ficha confirmada', mariaRec.recordatorio_enviado === true, `recordatorio=${mariaRec.recordatorio_enviado}`);
check('Recordatorio usa guión por ruta (validación → certificado laboral)', enviados.some(e => /certificado laboral/i.test(e.text)));
const rRec2 = await scheduler.evaluar(AHORA_TS);
check('Recordatorio 48h se envía UNA sola vez', rRec2.recordatorios === 0);

// ---------------------------------------------------------------- 6. KPIs
console.log('\n▶ 6 · KPIs del embudo (Sección 12 del manual)');
const kpis = store.calcularKPIs(7);
console.table(kpis.kpis.map(k => ({
  KPI: k.nombre,
  Valor: k.valor === null ? 's/d' : (k.unidad === 'min' ? `${k.valor} min` : `${(k.valor * 100).toFixed(0)}%`),
  Meta: k.unidad === 'min' ? `${k.meta} min` : `${(k.meta * 100).toFixed(0)}%`,
  Estado: k.estado
})));
check('KPIs calculados: 8 indicadores', kpis.kpis.length === 8);
check('Volumetría del período coherente', kpis.volumetria.chatsAbiertos >= 3 && kpis.volumetria.fichasCompletas >= 2);
check('Embudo decreciente T1≥T2≥T3≥T4', kpis.embudo.t1_respondieron >= kpis.embudo.t2_identidad && kpis.embudo.t2_identidad >= kpis.embudo.t3_cedula && kpis.embudo.t3_cedula >= kpis.embudo.t4_ficha);

// ---------------------------------------------------------------- 7. export
console.log('\n▶ 7 · Exportación CSV (ritual del lunes)');
const csv = store.exportarCSV(7);
check('CSV con encabezado y leads', csv.split('\n').length >= 4 && csv.includes('nombre') && csv.includes('ficha_completa'));

// Ficha para prompt (muestra)
console.log('\n▶ 8 · Ficha CRM inyectada al prompt (post-cierre de María):');
console.log('─'.repeat(64));
console.log(store.formatearFichaParaPrompt(store.getLead(MARIA)));
console.log('─'.repeat(64));
check('Ficha de prompt marca POST-CIERRE en ficha_completa', /POST-CIERRE/.test(store.formatearFichaParaPrompt(store.getLead(MARIA))));

// ---------------------------------------------------------------- resumen
console.log('\n══════════════════════════════════════════════════');
console.log(`  RESULTADO: ${pasadas} pasadas · ${fallidas} fallidas`);
console.log('══════════════════════════════════════════════════\n');

store.close();
try { fs.unlinkSync(dbPath); } catch {}
process.exit(fallidas > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Error fatal del test:', err);
  process.exit(1);
});
