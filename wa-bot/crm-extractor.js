/**
 * Extractor determinista de datos de CRM para el mercado ecuatoriano (UBE)
 * Versión 2.0 - Endurecida contra falsos positivos, negaciones y celulares
 */

const CIUDADES_ECUADOR = [
  'guayaquil', 'daule', 'duran', 'samborondon', 'milagro', 'babahoyo',
  'quevedo', 'machala', 'quito', 'cuenca', 'manta', 'portoviejo',
  'loja', 'ambato', 'santo domingo', 'esmeraldas', 'ibarra', 'riobamba',
  'latacunga', 'salinas', 'la libertad', 'santa elena', 'chone', 'pasaje',
  'santa rosa', 'huaquillas', 'naranjal', 'el triunfo', 'balzar', 'pedro carbo'
];

const EXCLUIDOS_NOMBRE = new Set([
  'hola', 'buenas', 'informacion', 'quiero', 'como', 'ayuda', 'diana', 'asesor', 'asesora',
  'docente', 'profesor', 'profesora', 'bachiller', 'estudiante', 'licenciado', 'ingeniero',
  'soy docente', 'soy bachiller', 'soy profesor', 'soy profesora', 'soy estudiante',
  'de daule', 'de guayaquil', 'de quito', 'de duran'
]);

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Validador oficial de Cédula Ecuatoriana (Módulo 10)
 * Provincias 01 a 24, tercer dígito < 6 para personas naturales.
 */
function validarCedulaEcuador(c) {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = parseInt(c.slice(0, 2), 10);
  if (prov < 1 || prov > 24) return false;
  const tercerDigito = parseInt(c[2], 10);
  if (tercerDigito >= 6) return false;

  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = parseInt(c[i], 10) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    suma += d;
  }
  const digitoVerificador = (10 - (suma % 10)) % 10;
  return digitoVerificador === parseInt(c[9], 10);
}

function extraerDatosLead(textoUsuario, leadActual = {}) {
  const texto = String(textoUsuario || '').trim();
  const textoNorm = normalizar(texto).toLowerCase();
  const parches = {};

  // 1. EXTRAER CÉDULA (C2: Validador Módulo 10 y Filtro Contextual Anti-Teléfonos)
  const candidatosCedula = texto.match(/\b\d{10}\b/g) || [];
  for (const cand of candidatosCedula) {
    const idx = texto.indexOf(cand);
    const contextoPrevio = texto.slice(Math.max(0, idx - 25), idx).toLowerCase();
    const esTelefono = /(numero|celular|whatsapp|telf|telfs|telefono|llam|escribo|contacto)/i.test(contextoPrevio);
    if (!esTelefono && validarCedulaEcuador(cand)) {
      parches.cedula = cand;
      parches.etapa = 'cedula_capturada';
      break;
    }
  }

  // 2. EXTRAER CIUDAD
  for (const ciudad of CIUDADES_ECUADOR) {
    const regex = new RegExp(`\\b${ciudad}\\b`, 'i');
    if (regex.test(textoNorm)) {
      parches.ciudad = ciudad.charAt(0).toUpperCase() + ciudad.slice(1);
      break;
    }
  }

  // 3. EXTRAER NOMBRE (C5: Exclusiones de profesiones y fórmulas)
  // Patrón A: "caro lion, de Daule..." o "Maria Perez, Daule..."
  const matchNombreComa = texto.match(/^([A-Za-zÁ-ÿ]{3,20}(?:\s+[A-Za-zÁ-ÿ]{3,20})?)\s*,\s*(?:de\s+)?([A-Za-zÁ-ÿ]+)/i);
  if (matchNombreComa && !parches.nombre && !leadActual.nombre) {
    const posible = matchNombreComa[1].trim();
    const posibleNorm = posible.toLowerCase();
    const primeraPalabra = posibleNorm.split(/\s+/)[0];
    if (!EXCLUIDOS_NOMBRE.has(posibleNorm) && !EXCLUIDOS_NOMBRE.has(primeraPalabra)) {
      parches.nombre = posible.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // Patrón B: "me llamo [Nombre]", "mi nombre es [Nombre]", "soy [Nombre]"
  const matchPresentacion = texto.match(/\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁ-ÿ]{3,20}(?:\s+[A-Za-zÁ-ÿ]{3,20})?)(?:\s*,|\s*\.|\s+de|\s+y\s+soy|\s+soy|$)/i);
  if (matchPresentacion && !parches.nombre && !leadActual.nombre) {
    const posible = matchPresentacion[1].trim();
    const posibleNorm = posible.toLowerCase();
    const primeraPalabra = posibleNorm.split(/\s+/)[0];
    if (!EXCLUIDOS_NOMBRE.has(posibleNorm) && !EXCLUIDOS_NOMBRE.has(primeraPalabra)) {
      parches.nombre = posible.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
  }

  // 4. EXTRAER PERFIL ACADÉMICO / EXPERIENCIA (C4: Negaciones y límites de palabra)
  const SIN_EXPERIENCIA = /(sin|no tengo|carezco de|nunca he tenido|todavia no|cero)\s+(de\s+)?experiencia/i;

  if (textoNorm.includes('normalista')) {
    parches.perfil = 'Normalista pedagógico (Califica PE-12)';
  } else if (textoNorm.includes('titulo') || textoNorm.includes('licenciado') || textoNorm.includes('ingeniero') || textoNorm.includes('tercer nivel') || textoNorm.includes('graduado de la u')) {
    parches.perfil = 'Profesional con título de tercer nivel (Maestría)';
  } else if (SIN_EXPERIENCIA.test(textoNorm)) {
    if (textoNorm.includes('docente') || textoNorm.includes('profesor') || textoNorm.includes('doy clases')) {
      parches.perfil = 'Docente sin experiencia comprobable (Grado regular)';
    } else {
      parches.perfil = 'Bachiller sin experiencia laboral (Grado regular)';
    }
  } else if (textoNorm.includes('docente') || textoNorm.includes('profesor') || textoNorm.includes('doy clases')) {
    if (/\bexperiencia\b|\banos?\b|\baños?\b/.test(textoNorm)) {
      parches.perfil = 'Docente con experiencia laboral (Califica PE-15)';
    }
  } else if (textoNorm.includes('bachiller') || textoNorm.includes('del colegio') || textoNorm.includes('colegio') || textoNorm.includes('escuela') || textoNorm.includes('recien graduado')) {
    parches.perfil = 'Bachiller sin experiencia laboral (Grado regular)';
  }

  // 5. EXTRAER CARRERA DE INTERÉS (C3: Caso específico MBA antes de Grado genérico)
  if (textoNorm.includes('mba') || textoNorm.includes('maestria en administracion')) {
    parches.carrera = 'MBA (Administración de Empresas)';
  } else if (textoNorm.includes('maestria en educacion basica') || textoNorm.includes('educacion basica')) {
    parches.carrera = 'Maestría en Educación Básica';
  } else if (textoNorm.includes('maestria') || textoNorm.includes('posgrado')) {
    parches.carrera = 'Maestrías UBE';
  } else if (textoNorm.includes('educaci') || textoNorm.includes('profesor') || textoNorm.includes('pedagog')) {
    parches.carrera = 'Licenciatura en Ciencias de la Educación';
  } else if (textoNorm.includes('derecho') || textoNorm.includes('leyes') || textoNorm.includes('abogac')) {
    parches.carrera = 'Derecho';
  } else if (textoNorm.includes('enfermer')) {
    parches.carrera = 'Licenciatura en Enfermería';
  } else if (textoNorm.includes('psicolog')) {
    parches.carrera = 'Licenciatura en Psicología';
  } else if (textoNorm.includes('auditor')) {
    parches.carrera = 'Licenciatura en Auditoría y Control de Gestión';
  } else if (textoNorm.includes('administra')) {
    parches.carrera = 'Licenciatura en Administración de Empresas';
  } else if (textoNorm.includes('ciberseguridad') || textoNorm.includes('sistemas') || textoNorm.includes('software') || textoNorm.includes('computac')) {
    parches.carrera = 'Ingeniería en Inteligencia Artificial y Ciberseguridad';
  } else if (textoNorm.includes('odontolog')) {
    parches.carrera = 'Licenciatura en Odontología';
  } else if (textoNorm.includes('fisioterap')) {
    parches.carrera = 'Licenciatura en Fisioterapia';
  }

  return parches;
}

module.exports = {
  extraerDatosLead,
  validarCedulaEcuador,
  CIUDADES_ECUADOR
};
