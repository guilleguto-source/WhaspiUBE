/**
 * test-campana.js — Pruebas sin WhatsApp del módulo campanas-crm.js
 * Uso: node test-campana.js [ruta_csv]
 */

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { CampanaGrupos, MENSAJES } = require('./campanas-crm');

let ok = 0, fallos = 0;
function check(nombre, cond) {
  if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ FALLO: ${nombre}`); }
}

// --- Store falso con las tablas que el módulo necesita
const db = new DatabaseSync(':memory:');
db.exec(`
  CREATE TABLE crm_eventos (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, ts INTEGER, tipo TEXT, meta TEXT);
  CREATE TABLE crm_leads (phone TEXT PRIMARY KEY, nombre TEXT, etapa TEXT);
`);
const store = { db };

const rutaCsv = process.argv[2] ||
  path.resolve(__dirname, 'contactos_educacion_import.csv');
const campana = new CampanaGrupos({ store, waClient: null, enviarReal: false });

console.log('\n1) Importación del CSV');
const totalLineas = fs.readFileSync(rutaCsv, 'utf-8').split(/\r?\n/).filter(l => l.trim()).length - 1;
campana.importarDesdeCSV(rutaCsv);
const n = store.db.prepare('SELECT COUNT(*) c FROM campana_contactos').get().c;
check(`importados ${n} de ${totalLineas} líneas`, n === totalLineas);
check('todos con estado pendiente',
  store.db.prepare("SELECT COUNT(*) c FROM campana_contactos WHERE estado='pendiente'").get().c === n);
check('todos con fecha asignada',
  store.db.prepare("SELECT COUNT(*) c FROM campana_contactos WHERE fecha_asignada IS NULL").get().c === 0);

console.log('\n2) Ventanas horarias y límites');
campana.cfg.ventana1 = ['08:45', '11:50'];
campana.cfg.ventana2 = ['14:35', '17:25'];
const fake = (hhmm, dia) => ({ fecha: '2026-11-09', hhmm, dia,
  minutos: campana.minutosDe(hhmm) });
const originalAhora = campana.ahoraLocal.bind(campana);
campana.ahoraLocal = () => fake('09:00', 1);
check('dentro de ventana 09:00 lunes', campana.dentroDeVentana() === true);
campana.ahoraLocal = () => fake('13:00', 1);
check('fuera de ventana 13:00', campana.dentroDeVentana() === false);
campana.ahoraLocal = () => fake('09:00', 0);
check('domingo cerrado', campana.dentroDeVentana() === false);
campana.ahoraLocal = originalAhora;

console.log('\n3) Límite diario por fase');
campana._inicio = '2026-11-09';                     // semana 1
check('fase 1 → 6/día', campana.limiteHoy() === 6);
campana._inicio = '2026-10-19';                     // 3 semanas atrás
check('fase 2 → 9/día', campana.limiteHoy() === 9);

console.log('\n3b) El tope diario cuenta TODOS los mensajes (M1 + seguimientos)');
const telM2 = store.db.prepare('SELECT phone FROM campana_contactos LIMIT 1').get();
store.db.prepare("UPDATE campana_contactos SET toques=2, estado='enviado_inicial', enviado_en=? WHERE phone=?")
  .run(Date.now(), telM2.phone);
check('un seguimiento enviado hoy entra al conteo', campana.enviadosHoy() === 1);

console.log('\n4) Respuestas del contacto');
const tel = store.db.prepare('SELECT phone FROM campana_contactos LIMIT 1').get().phone;
// marcar como contactado para simular que ya recibió M1
store.db.prepare("UPDATE campana_contactos SET toques=1, estado='enviado_inicial' WHERE phone=?").run(tel);
campana.enviarReal = false;
let r = campana.responder(tel, 'Salir por favor');
check('SALIR → no_interesado', r && r.accion === 'no_interesado');
r = campana.responder(tel, 'hola');
check('no_interesado ya no responde', r === null);

const tel2 = store.db.prepare(
  "SELECT phone FROM campana_contactos WHERE estado='pendiente' LIMIT 1").get().phone;
store.db.prepare("UPDATE campana_contactos SET toques=1, estado='enviado_inicial' WHERE phone=?").run(tel2);
r = campana.responder(tel2, '2');
check('botón 2 → ya_cursando', r && r.accion === 'ya_cursando' && r.mensaje.includes('familia UBE'));

const tel3 = store.db.prepare(
  "SELECT phone FROM campana_contactos WHERE estado='pendiente' LIMIT 1").get().phone;
store.db.prepare("UPDATE campana_contactos SET toques=1, estado='enviado_inicial' WHERE phone=?").run(tel3);
r = campana.responder(tel3, '1');
check('botón 1 → handoff a Diana', r && r.accion === 'handoff_diana' &&
  r.mensaje.includes('nombre completo'));
const ev = store.db.prepare("SELECT COUNT(*) c FROM crm_eventos WHERE tipo='campana_interesado'").get().c;
check('evento campana_interesado registrado', ev >= 1);
r = campana.responder(tel3, '1 otra vez');
check('estado interesado: Diana sigue al mando (sin mensaje fijo)', r === null);

const tel4 = store.db.prepare(
  "SELECT phone FROM campana_contactos WHERE estado='enviado_inicial' LIMIT 1").get();
if (tel4) {
  store.db.prepare("UPDATE campana_contactos SET toques=1, estado='enviado_inicial' WHERE phone=?").run(tel4.phone);
  r = campana.responder(tel4.phone, 'Buenas tardes, soy María');
  check('respuesta libre → handoff a Diana', r && r.accion === 'handoff_diana' && r.mensaje === null);
}

console.log('\n5) Envío simulado del primer mensaje (tick)');
campana.activa = true;
campana._inicio = null;                              // recalcular con la fecha del CSV
campana.ahoraLocal = () => ({ fecha: '2026-11-09', hhmm: '09:30', dia: 1, minutos: 570 });
const tel5 = store.db.prepare(
  "SELECT phone FROM campana_contactos WHERE estado='pendiente' AND fecha_asignada<='2026-11-09' LIMIT 1").get();
if (tel5) {
  store.db.prepare("UPDATE campana_contactos SET hora_sugerida='09:00' WHERE phone=?").run(tel5.phone);
}
const envios = [];
campana.waClient = { sendText: async (p, t) => envios.push({ p, t }),
  sendButtons: async (p, t, b) => envios.push({ p, t, botones: b.length }) };
campana.enviarReal = true;
campana.tick().then(() => {
  check('envió 1 mensaje con botones', envios.length === 1 && envios[0].botones === 3);
  check('el mensaje presenta a Diana', envios.length && envios[0].t.includes('Diana León'));
  const est = store.db.prepare("SELECT estado, toques FROM campana_contactos WHERE phone=?")
    .get(tel5.phone);
  check('estado enviado_inicial con 1 toque', est && est.estado === 'enviado_inicial' && est.toques === 1);
  check('crm_eventos registró el envío',
    store.db.prepare("SELECT COUNT(*) c FROM crm_eventos WHERE tipo='campana_envio'").get().c >= 1);

  console.log('\n6) Toque 2 y cierre automático');
  campana.cfg.toque2Horas = 72;
  store.db.prepare("UPDATE campana_contactos SET enviado_en=? WHERE phone=?")
    .run(Date.now() - 73 * 3600000, tel5.phone);
  envios.length = 0;
  return campana.tick().then(() => {
    check('toque 2 enviado tras 72 h', envios.length === 1 &&
      envios[0].t.includes('Hola de nuevo'));
    store.db.prepare("UPDATE campana_contactos SET toques=2, enviado_en=? WHERE phone=?")
      .run(Date.now() - 8 * 86400000, tel5.phone);
    envios.length = 0;
    return campana.tick().then(() => {
      check('sin envío extra (ya cerró por inactividad)',
        envios.length === 0 || envios[0].p !== tel5.phone);
      const fin = store.db.prepare("SELECT estado FROM campana_contactos WHERE phone=?")
        .get(tel5.phone);
      check('estado sin_respuesta tras 7 días', fin && fin.estado === 'sin_respuesta');

      console.log('\n7) Resumen final de estados');
      for (const fila of campana.resumen()) console.log(`   ${fila.estado.padEnd(16)} ${fila.c}`);
      console.log(`\nRESULTADO: ${ok} OK / ${fallos} fallos`);
      process.exit(fallos ? 1 : 0);
    });
  });
}).catch((e) => { console.error(e); process.exit(1); });
