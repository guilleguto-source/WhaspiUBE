/**
 * importar-campana.js — Importa el CSV de contactos al CRM de la campaña.
 *
 * USO:
 *   node importar-campana.js contactos_educacion_import.csv
 *
 * Requiere que session-store.js esté en la misma carpeta (usa su base de datos
 * data/sessions.db). No necesita que el servidor esté apagado: la importación
 * es incremental y no toca contactos ya contactados.
 */

const path = require('path');
const SessionStore = require('./session-store');
const { CampanaGrupos } = require('./campanas-crm');

const rutaCsv = process.argv[2];
if (!rutaCsv) {
  console.error('Uso: node importar-campana.js <archivo.csv>');
  console.error('Ejemplo: node importar-campana.js contactos_educacion_import.csv');
  process.exit(1);
}

const store = new SessionStore();
const campana = new CampanaGrupos({ store, waClient: null });
const res = campana.importarDesdeCSV(path.resolve(rutaCsv));

console.log('\nResumen actual de la campaña:');
for (const fila of campana.resumen()) {
  console.log(`  ${fila.estado.padEnd(16)} ${fila.c}`);
}
console.log(`\nListo. Próximo paso: arrancar el servidor con CAMPANA_DRY_RUN=true para ver los envíos simulados.`);
