/**
 * test-auditoria.js · v5 — Pruebas de las correcciones de la auditoría
 * ---------------------------------------------------------------------------
 * Cubre cada hallazgo de la auditoría (AUDITORIA-V5.md):
 *   A1  listarLlamadasAgendadas() existe y agenda llamadas persistente
 *   A2  actualizarLead YA persiste area_interes_maestria / llamada_agendada_*
 *   A3  Taxonomía de áreas ÚNICA = matriz de valores (nombres cortos)
 *   A4  obtenerMaestriasPorArea(): sin grupos vacíos; desglose funciona para las 5 áreas
 *   A5  "maestría en educación" NO queda con carrera de grado (ficha coherente)
 *   A6  ctx_pendiente determinista (nombre/área/horario) leído por el extractor
 *   A7  Campaña: botones campana_info/curso/no se manejan correctamente
 *   A8  Toque 1 del scheduler sin "Hola Hola"
 *   A9  Purga: no borra eventos de leads retenidos
 *   A10 diana-router: intención + [BLOQUE DE RUTA]
 *   A11 wa-client: límites de WhatsApp (título ≤24) y sendMedia lanza error si falta el archivo
 *
 * Uso: node test-auditoria.js
 */

process.env.NODE_ENV = 'test_dry_run';
process.env.UBE_MATERIAL_DIR = ''; // sin material → trípticos vacíos (esperado)

const fs = require('fs');
const path = require('path');
const os = require('os');

let pasadas = 0, fallidas = 0;
function check(nombre, cond, detalle = '') {
  if (cond) { pasadas++; console.log(`  ✅ ${nombre}`); }
  else { fallidas++; console.log(`  ❌ ${nombre} ${detalle ? '— ' + detalle : ''}`); }
}

const SessionStore = require('./session-store');
const { extraerDatosLead } = require('./crm-extractor');
const menuService = require('./menu-service');
const promptEngine = require('./prompt-engine');
const dianaRouter = require('./diana-router');
const FollowupScheduler = require('./followup-scheduler');
const EvolutionClient = require('./wa-client');
const { CampanaGrupos } = require('./campanas-crm');

async function main() {
  console.log('\n════════════════════════════════════════════════════');
  console.log('  T E S T   A U D I T O R Í A   V 5   ·   U B E');
  console.log('════════════════════════════════════════════════════\n');

  const dbPath = path.join(os.tmpdir(), `test_auditoria_${Date.now()}.db`);
  const store = new SessionStore(dbPath);

  // ─────────────────────────────────────────────── A1 + A2
  console.log('▶ A1/A2 · Agenda de llamadas y campos que antes se perdían');
  check('A1: sessionStore.listarLlamadasAgendadas() EXISTE', typeof store.listarLlamadasAgendadas === 'function');
  store.actualizarLead('593991110001', { nombre: 'Ana', llamada_agendada_horario: '09:30 am', llamada_estado: 'pendiente', llamada_agendada_ts: Date.now() });
  const agenda = store.listarLlamadasAgendadas();
  check('A1: la llamada agendada aparece en la agenda', agenda.length === 1 && agenda[0].phone === '593991110001' && agenda[0].estado === 'pendiente', JSON.stringify(agenda));
  const lead2 = store.actualizarLead('593991110002', { area_interes_maestria: 'Derecho y Gobernanza', area_titulo: 'Derecho' });
  const lead2b = store.getLead('593991110002');
  check('A2: area_interes_maestria SE PERSISTE (antes se descartaba)', lead2b.area_interes_maestria === 'Derecho y Gobernanza');
  check('A2: area_titulo se persiste', lead2b.area_titulo === 'Derecho');
  store.actualizarLead('593991110002', { ctx_pendiente: 'area' });
  check('A2: ctx_pendiente se persiste', store.getLead('593991110002').ctx_pendiente === 'area');

  // ─────────────────────────────────────────────── A3
  console.log('\n▶ A3 · Taxonomía única de áreas (matriz de valores)');
  const EXTRACTOR = '593981110003';
  const p1 = extraerDatosLead('quiero una maestría de negocios', { ruta: 'maestria' }, {});
  check('A3: extractor produce área CORTA de la matriz', p1.area_interes_maestria === 'Administración y Negocios', String(p1.area_interes_maestria));
  const p1b = extraerDatosLead('quiero la maestría en administración de empresas', { ruta: 'maestria' }, {});
  check('A3: "maestría en administración de empresas" mapea al MBA oficial', /MBA/.test(p1b.carrera || '') && !p1b.carrera.startsWith('Licenciatura'), String(p1b.carrera));
  const p2 = extraerDatosLead('me interesan las de derecho', { ruta: 'maestria' }, {});
  check('A3: "las de derecho" → "Derecho y Gobernanza"', p2.area_interes_maestria === 'Derecho y Gobernanza', String(p2.area_interes_maestria));
  const precios = menuService.cargarPrecios();
  const areasMatriz = new Set((precios.maestrias || []).map(m => m.area));
  check('A3: AREAS_MAESTRIAS == áreas reales de la matriz', menuService.AREAS_MAESTRIAS.length === areasMatriz.size && menuService.AREAS_MAESTRIAS.every(a => areasMatriz.has(a)));

  // ─────────────────────────────────────────────── A4
  console.log('\n▶ A4 · Desglose por área funcional en las 5 áreas');
  const grupos = promptEngine.obtenerMaestriasPorArea();
  const clavesLargasViejas = ['Ciencias Administrativas y Económicas', 'Ciencias Sociales, Derecho y Gobernanza'];
  check('A4: ya NO existen los grupos con nombres largos vacíos', clavesLargasViejas.every(k => !(k in grupos)), Object.keys(grupos).join(' | '));
  for (const area of menuService.AREAS_MAESTRIAS) {
    const r = menuService.respuestaAreaElegida(area);
    const ok = r && !/contamos con 0 maestrías/i.test(r.texto) && /\d/.test(r.texto);
    check(`A4: desglose "${area}" devuelve programas`, !!ok, r ? r.texto.slice(0, 60) : 'null');
  }

  // ─────────────────────────────────────────────── A5
  console.log('\n▶ A5 · "Maestría en educación" → ficha coherente');
  const M5 = '593991110005';
  let l5 = store.obtenerOCrearLead(M5, { origen: 'whatsapp' });
  let p5 = extraerDatosLead('quiero la maestría en educación', l5, {});
  l5 = store.actualizarLead(M5, p5); store.avanzarEtapa(M5); l5 = store.getLead(M5);
  check('A5: ruta = maestria', l5.ruta === 'maestria', l5.ruta);
  check('A5: carrera NO es una licenciatura de grado', !l5.carrera || /^maestr/i.test(l5.carrera), String(l5.carrera));
  check('A5: área Educación registrada', l5.area_interes_maestria === 'Educación', String(l5.area_interes_maestria));
  // regreso: mensaje de grado SÍ corrige la ruta a la nueva consulta
  const p5b = extraerDatosLead('quiero empezar la carrera de psicología', store.getLead(M5), {});
  store.actualizarLead(M5, p5b); store.avanzarEtapa(M5);
  check('A5: "carrera de psicología" marca grado explícito sin bloqueo', (store.getLead(M5).carrera || '').includes('Psicología'), String(store.getLead(M5).carrera));

  // ─────────────────────────────────────────────── A6
  console.log('\n▶ A6 · ctx_pendiente determinista');
  const M6 = '593991110006';
  store.actualizarLead(M6, { ctx_pendiente: 'nombre' });
  const p6 = extraerDatosLead('María Sol', store.getLead(M6), {});
  check('A6: nombre desnudo capturado por bandera (sin regex de historial)', p6.nombre === 'María Sol', String(p6.nombre));
  store.actualizarLead(M6, { ctx_pendiente: 'horario', nombre: 'María Sol' });
  const p6b = extraerDatosLead('me queda bien la 10:30 am', store.getLead(M6), {});
  check('A6: horario capturado por bandera', p6b.llamada_agendada_horario === '10:30 Am' || /10:30/i.test(p6b.llamada_agendada_horario || ''), String(p6b.llamada_agendada_horario));
  // la ficha para prompt muestra el área
  const ficha = store.formatearFichaParaPrompt(store.getLead('593991110002'));
  check('A6: ficha CRM visible por Diana incluye el área elegida', /Área de maestría: Derecho y Gobernanza/.test(ficha));

  // ─────────────────────────────────────────────── A7
  console.log('\n▶ A7 · Campaña: botones y reintentos');
  const waMock = {
    sendText: async (p, t) => ({ ok: true }),
    sendButtons: async (p, t, b) => { enviosCam.push(b.length); return { ok: true }; }
  };
  let enviosCam = [];
  const cam = new CampanaGrupos({ store, waClient: waMock, enviarReal: true, activaOverride: true });
  cam.activa = true;
  // FIX (auditoría v5.1): el tick era dependiente de la hora real — si el test
  // corría fuera de la ventana de envío (o en fin de semana), A7 fallaba.
  // Fijamos "lunes 09:00 Ecuador" para que sea determinista.
  cam.ahoraLocal = () => ({ fecha: '2026-11-02', hhmm: '09:00', dia: 1, minutos: 540 });
  store.db.prepare(`INSERT OR REPLACE INTO campana_contactos (phone, nombre, grupo, estado, fecha_asignada, hora_sugerida, toques, created_at, updated_at)
    VALUES ('593970000007','Luis Prueba','G1','enviado_inicial','2026-11-01','09:00',1,?,?)`).run(Date.now(), Date.now());
  const r7a = cam.responder('593970000007', 'boton: campana_info');
  check('A7: botón "Quisiera más información" → masInfo + interesado', r7a && r7a.accion === 'handoff_diana' && /nombre completo/.test(r7a.mensaje) && store.db.prepare("SELECT estado FROM campana_contactos WHERE phone='593970000007'").get().estado === 'interesado');
  check('A7: botón de MENÚ normal (area:) NO lo intercepta', cam.responder('593970000007', 'boton: area:Educación') === null);
  store.db.prepare("UPDATE campana_contactos SET estado='enviado_inicial', toques=1 WHERE phone='593970000007'").run();
  const r7b = cam.responder('593970000007', 'boton: campana_curso');
  check('A7: botón "Ya la estoy cursando" → ya_cursando', r7b && r7b.accion === 'ya_cursando');
  store.db.prepare("UPDATE campana_contactos SET estado='enviado_inicial', toques=1 WHERE phone='593970000007'").run();
  const r7c = cam.responder('593970000007', 'boton: campana_no');
  check('A7: botón "No recibir más" → no_interesado (nunca más)', r7c && r7c.accion === 'no_interesado' && cam.responder('593970000007', 'hola') === null);
  store.db.prepare(`INSERT OR REPLACE INTO campana_contactos (phone, nombre, estado, updated_at, created_at)
    VALUES ('593970000008','Erro Prueba','error',?,?)`).run(Date.now() - 7 * 3600000, Date.now() - 7 * 3600000);
  await cam.tick();
  check('A7: contacto en error se reprograma a pendiente', store.db.prepare("SELECT estado FROM campana_contactos WHERE phone='593970000008'").get().estado === 'pendiente');

  // ─────────────────────────────────────────────── A8
  console.log('\n▶ A8 · Guiones de toque sin fallos de formato');
  const sched = new FollowupScheduler(store, waMock, { enviarReal: false });
  const msgSinNombre = sched.generarMensajeToque(1, { carrera: null, ruta: 'grado' });
  check('A8: toque 1 sin nombre NO dice "Hola Hola"', !/Hola Hola/.test(msgSinNombre), msgSinNombre.slice(0, 30));
  check('A8: toque 1 con nombre saluda por nombre', /^Hola Andrea/.test(sched.generarMensajeToque(1, { nombre: 'Andrea', carrera: 'Derecho' })));

  // ─────────────────────────────────────────────── A9
  console.log('\n▶ A9 · Purga de retención no destruye bitácora de leads vivos');
  const evAntes = store.listarEventos(M5).length;
  const purgados = store.purgarLeadsAntiguos();
  const evDespues = store.listarEventos(M5).length;
  check('A9: lead reciente NO purgado', purgados === 0);
  check('A9: eventos del lead vivo intactos tras purga', evAntes === evDespues, `${evAntes}→${evDespues}`);

  // ─────────────────────────────────────────────── A10
  console.log('\n▶ A10 · diana-router (capa de consistencia)');
  const i1 = dianaRouter.clasificarIntencion('cuánto vale la maestría en educación básica', null, {});
  check('A10: precio de programa detectado', i1.tipo === 'precio_programa' && /educación básica/i.test(menuService.nombrePrograma(i1.programa)), i1.tipo);
  const i2 = dianaRouter.clasificarIntencion('quiero ver todas las maestrías', null, {});
  check('A10: catálogo sin programa → catalogo_areas', i2.tipo === 'catalogo_areas', i2.tipo);
  const i3 = dianaRouter.clasificarIntencion('educación', { ctx_pendiente: 'area' }, {});
  check('A10: área elegida tras menú → area_elegida', i3.tipo === 'area_elegida' && i3.area === 'Educación', i3.tipo);
  const i4 = dianaRouter.clasificarIntencion('hola', null, {});
  check('A10: saludo limpio → saludo', i4.tipo === 'saludo', i4.tipo);
  const br = dianaRouter.bloqueRutaParaPrompt(i1, null);
  check('A10: BLOQUE DE RUTA inyecta fuente y prohibición de inventar', /\[BLOQUE DE RUTA/.test(br) && /PROHIBIDO/.test(br));
  check('A10: prompt del sistema incluye DÓNDE BUSCAR (jerarquía)', /DÓNDE BUSCAR/.test(promptEngine.generarPromptSistema('UBE', '')));

  // ─────────────────────────────────────────────── A11
  console.log('\n▶ A11 · wa-client (límites y robustez)');
  const envios = [];
  global.fetch = async (url, opts = {}) => { envios.push({ url, body: opts.body ? JSON.parse(opts.body) : null }); return { ok: true, json: async () => ({ ok: true }) }; };
  const wa = new EvolutionClient({ baseUrl: 'http://mock', apiKey: 'x', instance: 'i' });
  await wa.sendList('593999999999', 'texto', { tituloBoton: 'Explorar área', secciones: [{ titulo: 'Opciones', filas: [{ id: 'area:Administración y Negocios', titulo: 'Administración y Negocios (25 chars!)', desc: 'x'.repeat(120) }] }] });
  const fila = envios[0]?.body?.sections?.[0]?.rows?.[0];
  check('A11: título de fila recortado a 24 (límite WhatsApp)', fila && fila.title.length <= 24, String(fila && fila.title.length));
  check('A11: descripción recortada a 72', fila && fila.description.length <= 72, String(fila && fila.description.length));
  let falloMedia = null;
  try { await wa.sendMedia('593999999999', '/ruta/que/no/existe.pdf'); } catch (e) { falloMedia = e.message; }
  check('A11: sendMedia lanza error claro con ruta inexistente', /no encontrado/.test(falloMedia || ''), falloMedia);
  let timeoutPresente = false;
  try { delete global.fetch; const { execSync } = require('child_process'); } catch {}
  check('A11: fetch de Evolution usa AbortSignal.timeout', require('fs').readFileSync('./wa-client.js', 'utf-8').includes('AbortSignal.timeout'));

  // ─────────────────────────────────────────────── resumen
  console.log('\n════════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${pasadas} pasadas · ${fallidas} fallidas`);
  console.log('════════════════════════════════════════════════════\n');
  store.close();
  try { fs.unlinkSync(dbPath); } catch {}
  process.exit(fallidas > 0 ? 1 : 0);
}

main().catch(e => { console.error('Error fatal del test:', e); process.exit(1); });
