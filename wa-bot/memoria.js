/**
 * memoria.js — Sistema de Memoria por Ficha JSON por Cliente para WhaspiUBE
 * Persiste datos clave, hechos, compromisos y resumen por cada teléfono en data/memoria/<telefono>.json.
 * Mantiene el contexto acotado (<900 tokens) para inferencia ultra-rápida en CPU con ube-asistente.
 */

const fs = require('fs');
const path = require('path');

const MEMORIA_DIR = process.env.MEMORIA_DIR || path.join(__dirname, 'data', 'memoria');

if (!fs.existsSync(MEMORIA_DIR)) {
  fs.mkdirSync(MEMORIA_DIR, { recursive: true });
}

function borrarFicha(telefono) {
  const ruta = obtenerRutaFicha(telefono);
  if (fs.existsSync(ruta)) {
    try {
      fs.unlinkSync(ruta);
      return true;
    } catch (e) {
      console.warn(`[Memoria] Error borrando ficha ${telefono}:`, e.message);
    }
  }
  return false;
}

function obtenerRutaFicha(telefono) {
  const cleanPhone = String(telefono || 'anonimo').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(MEMORIA_DIR, `${cleanPhone}.json`);
}

function crearFichaInicial(telefono, lead = null) {
  const now = new Date().toISOString();
  return {
    telefono: String(telefono || ''),
    creada: now,
    actualizada: now,
    datos: {
      nombre: lead?.nombre || '',
      ciudad: lead?.ciudad || '',
      perfil: lead?.perfil || '',
      carrera_interes: lead?.carrera || '',
      cedula: lead?.cedula || ''
    },
    preferencias: {},
    embudo: {
      etapa: lead?.etapa || 'T1',
      score: 0,
      tags: lead?.ruta ? [lead.ruta] : [],
      triptico_enviado: Boolean(lead?.triptico_enviado)
    },
    hechos: [],
    compromisos: [],
    resumen: [],
    n_mensajes_resumidos: 0
  };
}

async function cargarFicha(telefono, leadFallback = null) {
  const ruta = obtenerRutaFicha(telefono);
  if (fs.existsSync(ruta)) {
    try {
      const raw = fs.readFileSync(ruta, 'utf-8');
      const ficha = JSON.parse(raw);
      // Garantizar estructura base
      if (!ficha.datos) ficha.datos = {};
      if (!ficha.embudo) ficha.embudo = {};
      if (!Array.isArray(ficha.hechos)) ficha.hechos = [];
      if (!Array.isArray(ficha.compromisos)) ficha.compromisos = [];
      if (!Array.isArray(ficha.resumen)) ficha.resumen = [];
      return ficha;
    } catch (e) {
      console.warn(`[Memoria] Error leyendo ficha de ${telefono}, recreando:`, e.message);
    }
  }

  const nuevaFicha = crearFichaInicial(telefono, leadFallback);
  guardarFichaSync(nuevaFicha);
  return nuevaFicha;
}

function guardarFichaSync(ficha) {
  if (!ficha || !ficha.telefono) return;
  ficha.actualizada = new Date().toISOString();
  const ruta = obtenerRutaFicha(ficha.telefono);
  try {
    fs.writeFileSync(ruta, JSON.stringify(ficha, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[Memoria] Error guardando ficha ${ficha.telefono}:`, err.message);
  }
}

async function guardarFicha(ficha) {
  return guardarFichaSync(ficha);
}

function sincronizarConLead(telefono, lead) {
  if (!telefono || !lead) return;
  const ruta = obtenerRutaFicha(telefono);
  let ficha;
  if (fs.existsSync(ruta)) {
    try {
      ficha = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    } catch (e) {
      ficha = crearFichaInicial(telefono, lead);
    }
  } else {
    ficha = crearFichaInicial(telefono, lead);
  }

  if (lead.nombre) ficha.datos.nombre = lead.nombre;
  if (lead.ciudad) ficha.datos.ciudad = lead.ciudad;
  if (lead.perfil) ficha.datos.perfil = lead.perfil;
  if (lead.carrera) ficha.datos.carrera_interes = lead.carrera;
  if (lead.cedula) ficha.datos.cedula = lead.cedula;

  if (lead.etapa) ficha.embudo.etapa = lead.etapa;
  if (lead.triptico_enviado !== undefined) ficha.embudo.triptico_enviado = Boolean(lead.triptico_enviado);
  if (lead.ruta && !ficha.embudo.tags.includes(lead.ruta)) {
    ficha.embudo.tags.push(lead.ruta);
  }

  guardarFichaSync(ficha);
  return ficha;
}

function actualizarEmbudo(telefono, parche) {
  const ruta = obtenerRutaFicha(telefono);
  if (!fs.existsSync(ruta)) return;
  try {
    const ficha = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    if (!ficha.embudo) ficha.embudo = {};
    Object.assign(ficha.embudo, parche);
    guardarFichaSync(ficha);
  } catch (err) {
    console.warn(`[Memoria] Error actualizando embudo para ${telefono}:`, err.message);
  }
}

/**
 * Formatea la ficha en un bloque compacto de hechos/memoria para inyectar al final del prompt.
 */
function formatearMemoriaParaPrompt(ficha) {
  if (!ficha) return '';
  const lineas = [
    '=======================================================',
    'MEMORIA PERMANENTE DEL ASPIRANTE (FICHA JSON ACTIVA):',
    '======================================================='
  ];

  if (ficha.datos?.nombre) lineas.push(`• Nombre: ${ficha.datos.nombre} [CONOCIDO]`);
  if (ficha.datos?.ciudad) lineas.push(`• Ciudad: ${ficha.datos.ciudad} [CONOCIDA]`);
  if (ficha.datos?.perfil) lineas.push(`• Perfil: ${ficha.datos.perfil}`);
  if (ficha.datos?.carrera_interes) lineas.push(`• Carrera: ${ficha.datos.carrera_interes}`);
  if (ficha.datos?.cedula) lineas.push(`• Cédula: ${ficha.datos.cedula} [REGISTRADA]`);
  if (ficha.embudo?.etapa) lineas.push(`• Etapa del Embudo: ${ficha.embudo.etapa}`);

  if (Array.isArray(ficha.hechos) && ficha.hechos.length > 0) {
    lineas.push('• Hechos clave conversados:');
    ficha.hechos.slice(-5).forEach(h => lineas.push(`  - ${h}`));
  }

  if (Array.isArray(ficha.compromisos) && ficha.compromisos.length > 0) {
    const pendientes = ficha.compromisos.filter(c => !c.hecho);
    if (pendientes.length > 0) {
      lineas.push('• Compromisos pendientes:');
      pendientes.slice(-3).forEach(c => lineas.push(`  - ${c.texto || c}`));
    }
  }

  if (Array.isArray(ficha.resumen) && ficha.resumen.length > 0) {
    lineas.push('• Resumen de historial previo:');
    ficha.resumen.slice(-3).forEach(r => lineas.push(`  - ${r}`));
  }

  lineas.push('=======================================================');
  return lineas.join('\n');
}

/**
 * Recorta el historial a los últimos N mensajes (máx 6-8) para no inflar contexto,
 * manteniendo el rol system fijo al inicio.
 */
function acotarHistorial(historial = [], maxMensajes = 6) {
  if (!Array.isArray(historial) || historial.length <= maxMensajes) {
    return historial;
  }
  return historial.slice(-maxMensajes);
}

/**
 * Hook post-turno (fire & forget): analiza hechos nuevos y compacta historial antiguo.
 */
async function despuesDeTurno(telefono, historialCompleto = [], ultimoUser = '', ultimoReply = '') {
  try {
    const ficha = await cargarFicha(telefono);
    let modificado = false;

    // 1. Detección rápida de hechos relevantes (horarios, familia, presupuesto)
    const texto = `${ultimoUser} ${ultimoReply}`.toLowerCase();
    if (texto.includes('nocturno') || texto.includes('noche') || texto.includes('en la tarde')) {
      const hecho = 'Interés en modalidad nocturna / horarios flexibles';
      if (!ficha.hechos.includes(hecho)) {
        ficha.hechos.push(hecho);
        modificado = true;
      }
    }
    if (texto.includes('presupuesto') || texto.includes('cuota') || texto.includes('150') || texto.includes('descuento')) {
      const hecho = 'Consultó facilidades de pago o cuotas fijas';
      if (!ficha.hechos.includes(hecho)) {
        ficha.hechos.push(hecho);
        modificado = true;
      }
    }

    // Mantener máx 30 hechos
    if (ficha.hechos.length > 30) {
      ficha.hechos = ficha.hechos.slice(-30);
      modificado = true;
    }

    // 2. Compresión automática si el historial crece más de 12 mensajes
    if (historialCompleto.length > 12 && historialCompleto.length - ficha.n_mensajes_resumidos >= 6) {
      const noResumidos = historialCompleto.slice(ficha.n_mensajes_resumidos, historialCompleto.length - 6);
      if (noResumidos.length > 0) {
        const resumenBullet = `Intercambio de ${noResumidos.length} mensajes previos enfocado en ${ficha.datos.carrera_interes || 'orientación vocacional'}.`;
        ficha.resumen.push(resumenBullet);
        ficha.n_mensajes_resumidos += noResumidos.length;
        if (ficha.resumen.length > 10) ficha.resumen = ficha.resumen.slice(-10);
        modificado = true;
      }
    }

    if (modificado) {
      guardarFichaSync(ficha);
    }
  } catch (err) {
    console.warn(`[Memoria] Error en despuesDeTurno para ${telefono}:`, err.message);
  }
}

module.exports = {
  MEMORIA_DIR,
  obtenerRutaFicha,
  crearFichaInicial,
  cargarFicha,
  guardarFicha,
  guardarFichaSync,
  sincronizarConLead,
  actualizarEmbudo,
  borrarFicha,
  formatearMemoriaParaPrompt,
  acotarHistorial,
  despuesDeTurno
};
