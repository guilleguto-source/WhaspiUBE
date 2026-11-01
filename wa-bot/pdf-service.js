const fs = require('fs');
const path = require('path');

const BASE_MATERIAL_DIR = process.env.UBE_MATERIAL_DIR || 'C:\\Users\\Guill\\Documents\\UBE_Material';

const STOP_WORDS = new Set([
  'con', 'por', 'para', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas',
  'este', 'esta', 'ese', 'esa', 'que', 'como', 'sobre', 'todo', 'triptico',
  'malla', 'pensum', 'carrera', 'ayudame', 'cedula', 'ceduka', 'porfa',
  'favor', 'quiero', 'dame', 'pasa', 'pasame', 'info', 'informacion',
  'mas', 'pdf', 'licenciatura', 'ingenieria', 'online', 'buenas', 'tardes',
  'dias', 'noches', 'amigo', 'amiga', 'universidad', 'bolivariana', 'ecuador'
]);

function normalizarTexto(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function listarTodosLosPdfs(directorio = BASE_MATERIAL_DIR) {
  const archivos = [];
  if (!fs.existsSync(directorio)) {
    return archivos;
  }

  function explorar(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rutaCompleta = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          explorar(rutaCompleta);
        } else if (entry.name.toLowerCase().endsWith('.pdf')) {
          archivos.push({
            fileName: entry.name,
            fullPath: rutaCompleta
          });
        }
      }
    } catch (err) {
      console.warn(`[PDF Service] Error explorando ${dir}:`, err.message);
    }
  }

  explorar(directorio);
  return archivos;
}

/**
 * Busca el tríptico PDF más relevante para una carrera o maestría
 * @param {string} nombreCarrera - Ej: "Derecho", "Educacion Basica", "Inteligencia Artificial"
 * @returns {{ fileName: string, fullPath: string, sizeMB: string } | null}
 */
function buscarTriptico(nombreCarrera) {
  const queryNorm = normalizarTexto(nombreCarrera);
  if (!queryNorm) return null;

  // Filtrar stop words y palabras muy cortas
  const tokens = queryNorm.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  if (tokens.length === 0) return null;

  const todos = listarTodosLosPdfs();
  let mejorCoincidencia = null;
  let maxPuntos = 0;

  const esMaestria = queryNorm.includes('maestria') || queryNorm.includes('posgrado');

  for (const item of todos) {
    const fileNorm = normalizarTexto(item.fileName);
    const fileTokens = new Set(fileNorm.split(/\s+/));
    let puntos = 0;
    let palabrasCoincidentes = 0;

    for (const t of tokens) {
      // Coincidencia exacta de token o substring en nombres compuestos
      if (fileTokens.has(t) || fileNorm.includes(t)) {
        puntos += 5;
        palabrasCoincidentes++;
      }
    }

    // Si ninguna palabra de la consulta coincide con el nombre de la carrera, descartar
    if (palabrasCoincidentes === 0) {
      continue;
    }

    // Coincidencia de tipo (Grado vs Maestría)
    const fileEsMaestria = fileNorm.includes('maestria');
    if (esMaestria === fileEsMaestria) {
      puntos += 2;
    }

    // Priorizar archivos que empiecen con "Triptico_"
    if (item.fileName.toLowerCase().startsWith('triptico')) {
      puntos += 1;
    }

    if (puntos > maxPuntos) {
      maxPuntos = puntos;
      mejorCoincidencia = item;
    }
  }

  if (mejorCoincidencia) {
    try {
      const stats = fs.statSync(mejorCoincidencia.fullPath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
      return {
        fileName: mejorCoincidencia.fileName,
        fullPath: mejorCoincidencia.fullPath,
        sizeMB
      };
    } catch (e) {
      console.warn(`[PDF Service] Error leyendo archivo de coincidencia (${mejorCoincidencia.fileName}):`, e.message);
      return null;
    }
  }

  return null;
}

module.exports = {
  buscarTriptico,
  listarTodosLosPdfs,
  normalizarTexto,
  BASE_MATERIAL_DIR
};
