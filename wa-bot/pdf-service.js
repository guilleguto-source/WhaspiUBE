const fs = require('fs');
const path = require('path');

// v5 (auditoría): portabilidad. Antes solo existía la ruta de Windows; en un
// servidor Linux listarTodosLosPdfs() devolvía SIEMPRE vacío y los trípticos
// jamás salían (ni se registraban) sin avisar. Orden de búsqueda:
//   1) UBE_MATERIAL_DIR (.env)
//   2) ./material  (junto al bot)
//   3) C:\Users\Guill\Documents\UBE_Material  (equipo original, compatibilidad)
const RUTA_ENV = process.env.UBE_MATERIAL_DIR || null;
const RUTA_LOCAL = path.join(__dirname, 'material');
const RUTA_WINDOWS = 'C:\\Users\\Guill\\Documents\\UBE_Material';
let DIR_MATERIAL_CACHE = null;
function directorioMaterial() {
  if (DIR_MATERIAL_CACHE) return DIR_MATERIAL_CACHE;
  const candidatos = [RUTA_ENV, RUTA_LOCAL, RUTA_WINDOWS].filter(Boolean);
  DIR_MATERIAL_CACHE = candidatos.find(d => fs.existsSync(d)) || RUTA_LOCAL;
  return DIR_MATERIAL_CACHE;
}

const STOP_WORDS = new Set([
  'con', 'por', 'para', 'del', 'las', 'los', 'una', 'uno', 'unos', 'unas',
  'este', 'esta', 'ese', 'esa', 'que', 'como', 'sobre', 'todo', 'triptico',
  'malla', 'pensum', 'carrera', 'ayudame', 'cedula', 'ceduka', 'porfa',
  'favor', 'quiero', 'dame', 'pasa', 'pasame', 'info', 'informacion',
  'mas', 'pdf', 'licenciatura', 'ingenieria', 'online', 'buenas', 'tardes',
  'dias', 'noches', 'amigo', 'amiga', 'universidad', 'bolivariana', 'ecuador',
  'ano', 'anos', 'anio', 'anios', 'completa', 'completo', 'darme', 'caddera',
  'periodo', 'periodos', 'semestre', 'semestres', 'duracion', 'tiempo'
]);

function levenshtein(a, b) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (!la) return lb;
  if (!lb) return la;
  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    const curr = [i];
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[lb];
}

function matchTokenFuzzy(token, tokenSet) {
  if (tokenSet.has(token)) return true;
  if (token.length < 5) return false;
  for (const t of tokenSet) {
    if (Math.abs(t.length - token.length) <= 2) {
      if (levenshtein(token, t) <= 1) return true;
      if (token.length >= 7 && levenshtein(token, t) <= 2) return true;
    }
  }
  return false;
}

function normalizarTexto(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
}

function listarTodosLosPdfs(directorio = directorioMaterial()) {
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
  const esGrado = /grado|carrera|licenciatura|ingenieria|pregrado|4 anos|4anos|caddera/i.test(queryNorm);

  for (const item of todos) {
    const fileNorm = normalizarTexto(item.fileName);
    const fileTokens = new Set(fileNorm.split(/\s+/));
    let puntos = 0;
    let palabrasCoincidentes = 0;

    for (const t of tokens) {
      if (fileTokens.has(t) || matchTokenFuzzy(t, fileTokens)) {
        puntos += 5;
        palabrasCoincidentes++;
      }
    }

    // Siglas y términos de máxima especificidad institucional
    if (fileTokens.has('bim') && (tokens.includes('bim') || queryNorm.includes('bim'))) {
      puntos += 20;
      palabrasCoincidentes++;
    }

    // Si ninguna palabra de la consulta coincide con el nombre de la carrera, descartar
    if (palabrasCoincidentes === 0) {
      continue;
    }

    // Coincidencia de tipo (Grado vs Maestría)
    const fileEsMaestria = fileNorm.includes('maestria');
    if (esGrado && !fileEsMaestria) {
      puntos += 5;
    } else if (esGrado && fileEsMaestria) {
      puntos -= 8; // Fuerte penalización si pidió carrera de grado y el archivo es maestría
    } else if (esMaestria && fileEsMaestria) {
      puntos += 5;
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
  directorioMaterial
};
