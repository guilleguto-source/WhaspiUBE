/**
 * Extractor determinista de datos de CRM para el mercado ecuatoriano (UBE)
 */

const CIUDADES_ECUADOR = [
  'guayaquil', 'daule', 'duran', 'samborondon', 'milagro', 'babahoyo',
  'quevedo', 'machala', 'quito', 'cuenca', 'manta', 'portoviejo',
  'loja', 'ambato', 'santo domingo', 'esmeraldas', 'ibarra', 'riobamba',
  'latacunga', 'salinas', 'la libertad', 'santa elena', 'chone', 'pasaje',
  'santa rosa', 'huaquillas', 'naranjal', 'el triunfo', 'balzar', 'pedro carbo'
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function extraerDatosLead(textoUsuario, leadActual = {}) {
  const texto = String(textoUsuario || '').trim();
  const textoNorm = normalizar(texto).toLowerCase();
  const parches = {};

  // 1. EXTRAER CÉDULA (10 dígitos en Ecuador)
  const matchCedula = texto.match(/\b(0\d{9}|1\d{9}|2\d{9})\b/);
  if (matchCedula) {
    parches.cedula = matchCedula[1];
    parches.etapa = 'cedula_capturada';
  }

  // 2. EXTRAER CIUDAD
  for (const ciudad of CIUDADES_ECUADOR) {
    const regex = new RegExp(`\\b${ciudad}\\b`, 'i');
    if (regex.test(textoNorm)) {
      // Capitalizar ciudad
      parches.ciudad = ciudad.charAt(0).toUpperCase() + ciudad.slice(1);
      break;
    }
  }

  // 3. EXTRAER NOMBRE
  // Patrón A: "caro lion, de Daule..." o "Maria Perez, Daule..."
  const matchNombreComa = texto.match(/^([A-Za-zÁ-ÿ]{3,20}(?:\s+[A-Za-zÁ-ÿ]{3,20})?)\s*,\s*(?:de\s+)?([A-Za-zÁ-ÿ]+)/i);
  if (matchNombreComa && !parches.nombre && !leadActual.nombre) {
    const posibleNombre = matchNombreComa[1].trim();
    if (!['hola', 'buenas', 'informacion', 'quiero', 'como'].includes(posibleNombre.toLowerCase())) {
      parches.nombre = posibleNombre.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // Patrón B: "me llamo [Nombre]", "mi nombre es [Nombre]", "soy [Nombre]"
  const matchPresentacion = texto.match(/\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁ-ÿ]{3,20}(?:\s+[A-Za-zÁ-ÿ]{3,20})?)(?:\s*,|\s*\.|\s+de|\s+y\s+soy|\s+soy|$)/i);
  if (matchPresentacion && !parches.nombre && !leadActual.nombre) {
    const posibleNombre = matchPresentacion[1].trim();
    if (!['bachiller', 'docente', 'profesor', 'estudiante', 'profesional'].includes(posibleNombre.toLowerCase())) {
      parches.nombre = posibleNombre.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 4. EXTRAER PERFIL ACADÉMICO / EXPERIENCIA
  if (textoNorm.includes('normalista')) {
    parches.perfil = 'Normalista pedagógico (Califica PE-12)';
  } else if (textoNorm.includes('docente') || textoNorm.includes('profesor') || textoNorm.includes('doy clases') || textoNorm.includes('escuela') || textoNorm.includes('colegio')) {
    if (textoNorm.includes('ano') || textoNorm.includes('ano') || textoNorm.includes('experiencia')) {
      parches.perfil = 'Docente con experiencia laboral (Califica PE-15)';
    }
  } else if (textoNorm.includes('bachiller') || textoNorm.includes('del colegio') || textoNorm.includes('sin experiencia') || textoNorm.includes('no tengo experiencia')) {
    parches.perfil = 'Bachiller sin experiencia laboral (Grado regular)';
  } else if (textoNorm.includes('titulo') || textoNorm.includes('licenciado') || textoNorm.includes('ingeniero') || textoNorm.includes('tercer nivel')) {
    parches.perfil = 'Profesional con título de tercer nivel (Maestría)';
  }

  // 5. EXTRAER CARRERA DE INTERÉS
  if (textoNorm.includes('educaci') || textoNorm.includes('profesor') || textoNorm.includes('pedagog')) {
    parches.carrera = 'Licenciatura en Ciencias de la Educación';
  } else if (textoNorm.includes('derecho') || textoNorm.includes('leyes') || textoNorm.includes('abogac')) {
    parches.carrera = 'Derecho';
  } else if (textoNorm.includes('enfermer')) {
    parches.carrera = 'Licenciatura en Enfermería';
  } else if (textoNorm.includes('psicolog')) {
    parches.carrera = 'Licenciatura en Psicología';
  } else if (textoNorm.includes('administra')) {
    parches.carrera = 'Licenciatura en Administración de Empresas';
  } else if (textoNorm.includes('auditor')) {
    parches.carrera = 'Licenciatura en Auditoría y Control de Gestión';
  } else if (textoNorm.includes('ciberseguridad') || textoNorm.includes('sistemas') || textoNorm.includes('software') || textoNorm.includes('computac')) {
    parches.carrera = 'Ingeniería en Inteligencia Artificial y Ciberseguridad';
  } else if (textoNorm.includes('odontolog')) {
    parches.carrera = 'Licenciatura en Odontología';
  } else if (textoNorm.includes('fisioterap')) {
    parches.carrera = 'Licenciatura en Fisioterapia';
  } else if (textoNorm.includes('mba') || textoNorm.includes('maestria en administracion')) {
    parches.carrera = 'MBA (Administración de Empresas)';
  }

  return parches;
}

module.exports = {
  extraerDatosLead,
  CIUDADES_ECUADOR
};
