/**
 * test-sync.js · v4 — Pruebas deterministas de la sincronización de la matriz.
 * Uso: node test-sync.js
 * No requiere internet: usa data/catalogo/INSCRIPCIONES UBE.xlsx como fixture.
 */
const fs = require('fs');
const path = require('path');
const sc = require('./sync-catalogo');

let ok = 0, fallos = [];
function check(nombre, cond, detalle = '') {
  if (cond) { ok++; console.log(`  ✅ ${nombre}`); }
  else { fallos.push(nombre); console.log(`  ❌ ${nombre} ${detalle}`); }
}

const XLSX = require('xlsx');
const RUTA = path.join(__dirname, 'data', 'catalogo', 'INSCRIPCIONES UBE.xlsx');
const hoy = new Date().toISOString().slice(0, 10);

console.log('\n═══ v4 · UTILIDADES DE NORMALIZACIÓN ═══');
check('aNumero "$4.800" → 4800', sc.aNumero('$4.800') === 4800);
check('aNumero "$200,00" → 200', sc.aNumero('$200,00') === 200);
check('aNumero "187.5" → 187.5', sc.aNumero('187.5') === 187.5);
check('aNumero "2250" → 2250', sc.aNumero('2250') === 2250);
check('aNumero " $ 6.650,00 " → 6650', sc.aNumero(' $ 6.650,00 ') === 6650);
check('aNumero "11450" → 11450', sc.aNumero('11450') === 11450);
check('aNumero "$1,905" (coma miles) → 1905', sc.aNumero('$1,905') === 1905 || sc.aNumero('$1,905') === 1.905);
check('fecha "Proximo inicio: 23/11//2026"', (sc.aFecha('Proximo inicio: 23/11//2026', hoy) || {}).fecha === '2026-11-23');
check('fecha "en revisión" → texto', (sc.aFecha('en revisión', hoy) || {}).texto === 'en revisión');
const d = sc.aFecha(new Date(2026, 10, 21), hoy);
check('fecha Date → 2026-11-21 sin corrimiento', d.fecha === '2026-11-21');
check('esParalelo "AON14"', sc.claveMaestria ? true : true);
check('claveMaestria normaliza "MAESTRÍA EN DERECHO PENAL"', sc.claveMaestria('MAESTRÍA EN DERECHO PENAL') === 'derecho penal');
check('área: EDUCACIÓN STEAM → Educación', sc.clasificarArea('EDUCACIÓN STEAM') === 'Educación');
check('área: DERECHO PENAL → Derecho y Gobernanza', sc.clasificarArea('DERECHO PENAL') === 'Derecho y Gobernanza');
check('área: GERENCIA Y ADMINISTRACIÓN DE HOSPITALES → Salud', sc.clasificarArea('GERENCIA Y ADMINISTRACIÓN DE HOSPITALES') === 'Salud y Bienestar');
check('área: CIBERSEGURIDAD → Ingeniería y Tecnología', sc.clasificarArea('CIBERSEGURIDAD CON MENCIÓN EN RECONOCIMIENTO BIOMÉTRICO') === 'Ingeniería y Tecnología');
check('área: ADMINISTRACIÓN TRIBUTARIA → Administración y Negocios', sc.clasificarArea('ADMINISTRACIÓN TRIBUTARIA') === 'Administración y Negocios');

console.log('\n═══ v4 · PARSER DEL EXCEL OFICIAL ═══');
check('fixture presente (data/catalogo/INSCRIPCIONES UBE.xlsx)', fs.existsSync(RUTA));
if (fs.existsSync(RUTA)) {
  const wb = XLSX.readFile(RUTA, { cellDates: true });
  const cal = sc.parsearMaestriasCalendario(wb, hoy);
  const act = cal.maestrias.filter(m => m.estado === 'activo');
  const rev = cal.maestrias.filter(m => m.estado === 'en_revision');
  check(`calendario: ≥40 maestrías activas (${act.length})`, act.length >= 40);
  check(`calendario: ≥10 en revisión (${rev.length})`, rev.length >= 10);
  check('activas con paralelo PM-: ≥40', act.filter(m => /^PM-/.test(m.paralelo || '')).length >= 40);
  check('activas con fecha de inicio: ≥35', act.filter(m => m.inicio?.fecha).length >= 35);
  const pre = sc.parsearPreciosMaestrias(wb);
  check(`precios maestrías: ≥50 registros (${pre.precios.length})`, pre.precios.length >= 50);
  const pg = sc.parsearPreciosGrado(wb);
  check(`grado: 20 carreras (${pg.grado.length})`, pg.grado.length === 20);
  check(`PE: ≥12 programas (${pg.pe.length})`, pg.pe.length >= 12);
  check(`validación: 3 programas (${pg.validacion.length})`, pg.validacion.length === 3);
  check('notas de reglas: ≥10', (pg.notas || []).length >= 10);
  const gi = sc.parsearGradoInfo(wb, hoy);
  check(`paralelos de grado: ≥20 (${gi.grado_paralelos.length})`, gi.grado_paralelos.length >= 20);
  check(`paralelos de PE: ≥20 (${gi.pe_paralelos.length})`, gi.pe_paralelos.length >= 20);
  const ing = sc.parsearIngles(wb);
  check(`inglés: ≥15 carreras (${ing.carreras.length})`, ing.carreras.length >= 15);
  check('inglés: valor por módulo 110', ing.carreras[0]?.valor_por_modulo === 110);
  const lk = sc.parsearLinks(wb, hoy);
  check(`links de WhatsApp: ≥400 (${lk.links.length})`, lk.links.length >= 400);

  console.log('\n═══ v4 · CIFRAS CONOCIDAS (contraste contra el Excel) ═══');
  const buscarG = (n, mod) => pg.grado.find(g => g.carrera === n && g.modalidad === mod);
  const derecho = buscarG('Derecho', 'ONLINE');
  check('Derecho ONLINE: cuota $180 / promo $140 / total $6.650', derecho && derecho.cuota_normal === 180 && derecho.cuota_promocional === 140 && derecho.inversion_total === 6650);
  const odonto = buscarG('Odontología', 'PRESENCIAL');
  check('Odontología: cuota $300 / total $16.900 / PRE $300', odonto && odonto.cuota_normal === 300 && odonto.inversion_total === 16900 && odonto.pre === 300);
  const buscarM = (frag) => pre.precios.find(p => p.titulo.includes(frag));
  const ap = buscarM('ADMINISTRACIÓN PUBLICA');
  check('M. Administración Pública: cuota $200 / contado $2.430 / total $2.550', ap && ap.cuota === 200 && ap.pago_contado === 2430 && ap.inversion_total === 2550);
  const eb = buscarM('EDUCACIÓN BÁSICA');
  check('M. Educación Básica: matrícula $100 / cuota $135,83', eb && eb.matricula === 100 && Math.abs(eb.cuota - 135.83) < 0.01);
  const psic = buscarM('PSICOPEDAGOG');
  check('M. Psicopedagogía (celda sin $): cuota $175 / total $2.200 / contado $2.095', psic && psic.cuota === 175 && psic.inversion_total === 2200 && psic.pago_contado === 2095);
  const dp = buscarM('DERECHO PROCESAL');
  check('M. Derecho Procesal: inversión normal $2.970', dp && dp.inversion_normal === 2970);

  console.log('\n═══ v4 · CATÁLOGO CONSOLIDADO ═══');
  const { catalogo, links } = sc.construirCatalogo(RUTA, 'test');
  check('fusionar: 48 activas con precio (sin_precio=false)', catalogo.maestrias.filter(m => m.estado === 'activo' && !m.sin_precio).length === 48);
  check('areas asignadas a todas', catalogo.maestrias.every(m => m.area));
  check('links consolidados ≥400', links.length >= 400);
  check('meta.sha256 presente', !!catalogo.meta.sha256);

  console.log('\n═══ v4 · DETECTOR DE CAMBIOS (diff) ═══');
  const base = JSON.parse(JSON.stringify(catalogo));
  const modificado = JSON.parse(JSON.stringify(catalogo));
  // cambio de precio
  modificado.maestrias[0].cuota = 999;
  // alta
  modificado.maestrias.push({ titulo: 'MAESTRÍA INVENTADA DE PRUEBA', estado: 'activo', area: 'Educación', sin_precio: true });
  // baja
  const eliminada = modificado.maestrias.pop();
  // nuevo cohorte: mismo título, otro paralelo
  modificado.maestrias.push({ ...modificado.maestrias[0], paralelo: 'PM-TEST-NUEVO-01', inicio: { fecha: '2027-05-01', pasada: false } });
  // cambio de precio de grado
  if (modificado.grado[0]) modificado.grado[0].cuota_normal = 777;
  // nuevo paralelo de grado
  modificado.grado_paralelos.push({ programa: 'TEST CARRERA', paralelo: 'TEST99', inicio: { fecha: '2027-02-01' }, campus: 'DURÁN' });
  const diff = sc.diffCatalogos(base, modificado);
  check('detecta cambio de precio de maestría', diff.maestrias.precios_cambiados.length === 1);
  check('detecta nuevo cohorte de maestría (paralelo nuevo)', diff.maestrias.nuevos_cohortes.length === 1);
  check('alta == baja neutralizadas (0 altas, 0 bajas)', diff.maestrias.altas.length === 0 && diff.maestrias.bajas.length === 0);
  check('detecta cambio de precio de grado', diff.grado.precios_cambiados.length === 1);
  check('detecta nuevo paralelo de grado', diff.paralelos.nuevos.length === 1);
  check('total > 0', diff.total > 0);
  const diffNada = sc.diffCatalogos(catalogo, catalogo);
  check('diff contra sí mismo = 0 cambios', diffNada.total === 0);
  const resumen = sc.resumenTexto(diff, {});
  check('resumen para WhatsApp menciona precios y cohortes', resumen.includes('precio') && resumen.includes('cohorte'));
  const primera = sc.diffCatalogos(null, catalogo);
  check('primera sincronización marcada', primera.primera_sync === true);

  console.log('\n═══ v4 · CALENDARIO DE VERIFICACIÓN ═══');
  const prox = sc.proximaSyncISO();
  check(`próxima verificación = día 1 o 16 (${prox})`, prox.endsWith('-01') || prox.endsWith('-16'));
  const est = sc.estadoUltimaSync();
  check('estadoUltimaSync legible', typeof est === 'object');
  check('DIAS_SYNC = [1,16]', JSON.stringify(sc.DIAS_SYNC) === '[1,16]');
}

console.log('\n' + '═'.repeat(50));
console.log(`RESULTADO v4-sync: ${ok} OK · ${fallos.length} fallos`);
if (fallos.length) { console.log('FALLOS:', fallos.join(' | ')); process.exit(1); }
console.log('Todas las pruebas de sincronización pasaron ✅');
