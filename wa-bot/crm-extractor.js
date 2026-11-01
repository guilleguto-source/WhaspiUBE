/**
 * Extractor determinista de datos de CRM para el mercado ecuatoriano (UBE) · v2
 * ---------------------------------------------------------------------------
 * Novedades v2 (embudo 4 turnos del manual Diana):
 *  - Validación real de cédula ecuatoriana (provincia 01-24 + dígito verificador
 *    módulo 10). Elimina falsos positivos con celulares 09xxxxxxxx.
 *  - Descarte de celulares por contexto ("mi número es...", "llámame al...").
 *  - Fix de clasificación: "salí del colegio hace 2 años" ya NO se clasifica
 *    como docente con experiencia; el orden bachiller/docente se corrigió.
 *  - Captura de "nombre desnudo" (respuesta a "¿Con quién tengo el gusto?").
 *  - Extracción de RUTA del embudo: grado | validacion | maestria.
 *  - Detección de objeciones (precio / cédula) para analítica de guiones.
 *  - Detección de confirmación T4 (ficha_completa) y siguiente paso por ruta.
 *  - Beneficio automático por ruta al capturar la cédula.
 *  - Catálogo de ciudades ampliado.
 */

const CIUDADES_ECUADOR = [
  'guayaquil', 'daule', 'duran', 'samborondon', 'milagro', 'babahoyo',
  'quevedo', 'machala', 'quito', 'cuenca', 'manta', 'portoviejo',
  'loja', 'ambato', 'santo domingo', 'esmeraldas', 'ibarra', 'riobamba',
  'latacunga', 'salinas', 'la libertad', 'santa elena', 'chone', 'pasaje',
  'santa rosa', 'huaquillas', 'naranjal', 'el triunfo', 'balzar', 'pedro carbo',
  // v2: ampliación de cobertura territorial
  'vinces', 'el empalme', 'velasco ibarra', 'playas', 'baba', 'yaguachi',
  'azogues', 'tulcan', 'puyo', 'tena', 'macas', 'zamora', 'archidona',
  'canar', 'montecristi', 'jipijapa', 'bahia de caraquez', 'cayambe',
  'otavalo', 'la mana', 'el carmen', 'alamor', 'catamayo', 'naranjito',
  'buena fe', 'valle de la virgen'
];

// Palabras que NUNCA deben capturarse como nombre de pila (respuesta desnuda)
const NOMBRES_PROHIBIDOS = new Set([
  'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'info',
  'informacion', 'información', 'si', 'sí', 'no', 'ok', 'okay', 'okey', 'vale',
  'gracias', 'listo', 'perfecto', 'de acuerdo', 'como', 'cual', 'cuanto',
  'donde', 'cuando', 'quien', 'porque', 'bachiller', 'docente', 'profesor',
  'profesora', 'maestro', 'maestra', 'estudiante', 'maestria', 'posgrado',
  'derecho', 'psicologia', 'enfermeria', 'odontologia', 'educacion',
  'administracion', 'auditoria', 'ciberseguridad', 'economia', 'si gracias',
  'sip', 'claro', 'listo gracias', 'saludos', 'estimada', 'estimado', 'amigo',
  'amiga', 'diana', 'nada', 'nose', 'no se', 'soy', 'soy docente', 'soy bachiller',
  'soy profesor', 'soy profesora', 'soy estudiante'
]);

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function capitalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Validación oficial de cédula ecuatoriana (Registro Civil):
 *  - 10 dígitos, provincia 01-24, tercer dígito 0-5 (persona natural)
 *  - dígito verificador con coeficientes 2,1,2,1,2,1,2,1,2 (módulo 10)
 */
function esCedulaValida(num) {
  if (!/^\d{10}$/.test(num)) return false;
  const prov = parseInt(num.substring(0, 2), 10);
  if (prov < 1 || prov > 24) return false;           // 01-24 provincias
  if (parseInt(num.charAt(2), 10) > 5) return false; // persona natural
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let p = parseInt(num.charAt(i), 10) * coef[i];
    if (p >= 10) p -= 9; // equivalente a sumar dígitos del producto
    suma += p;
  }
  const verificador = (10 - (suma % 10)) % 10;
  return verificador === parseInt(num.charAt(9), 10);
}

/**
 * Contexto opcional que inyecta server.js:
 *  - preguntaNombre: true si el último mensaje de Diana preguntó el nombre
 *  - telefonoRemitente: número WhatsApp del remitente (para descartar que
 *    pegue su propio número de contacto como si fuera cédula)
 */
function extraerDatosLead(textoUsuario, leadActual = {}, contexto = {}) {
  const texto = String(textoUsuario || '').trim();
  const textoNorm = normalizar(texto).toLowerCase();
  const parches = {};

  // ============================================================
  // 1. CÉDULA — solo si pasa la validación del Registro Civil
  // ============================================================
  if (!leadActual.cedula) {
    const candidatos = texto.match(/\b\d{10}\b/g) || [];
    const mencionaCelular = /(celular|telefono|llam|contacto|whatsapp|mi numero)/.test(textoNorm);
    const remitente = String(contexto.telefonoRemitente || '').replace(/\D/g, '');

    for (const cand of candidatos) {
      if (remitente && cand === remitente) continue;             // pegó su propio contacto
      if (mencionaCelular && cand.startsWith('09')) continue;    // contexto de celular
      if (!esCedulaValida(cand)) continue;                       // dígito verificador
      parches.cedula = cand;
      // NOTA v2: la ETAPA no se escribe aquí; avanzarEtapa() en SessionStore
      // es la única fuente de verdad de las transiciones del embudo.
      // Beneficio por defecto según ruta (manual · Sección 05)
      if (!leadActual.beneficio && !parches.beneficio) {
        const ruta = parches.ruta || leadActual.ruta;
        if (ruta === 'maestria') parches.beneficio = 'verificacion_senescyt';
        else if (ruta === 'validacion') parches.beneficio = 'revision_experiencia';
        else parches.beneficio = 'exoneracion_matricula_72h';
      }
      break;
    }
  }

  // ============================================================
  // 2. CIUDAD
  // ============================================================
  if (!leadActual.ciudad) {
    for (const ciudad of CIUDADES_ECUADOR) {
      const regex = new RegExp(`\\b${ciudad}\\b`, 'i');
      if (regex.test(textoNorm)) {
        parches.ciudad = capitalizar(ciudad);
        break;
      }
    }
  }

  // ============================================================
  // 3. NOMBRE
  // ============================================================
  if (!leadActual.nombre && !parches.nombre) {
    // Patrón A: "María Pérez, de Daule..." o "Caro Lion, Guayaquil"
    const matchNombreComa = texto.match(/^([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20})?)\s*,\s*(?:de\s+)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)/i);
    if (matchNombreComa) {
      const posible = matchNombreComa[1].trim();
      const posibleNorm = normalizar(posible).toLowerCase();
      const palabras = posibleNorm.split(/\s+/);
      const contieneProhibida = palabras.some(p => NOMBRES_PROHIBIDOS.has(p));
      if (!NOMBRES_PROHIBIDOS.has(posibleNorm) && !contieneProhibida && !posibleNorm.startsWith('soy ') && !posibleNorm.startsWith('de ')) {
        parches.nombre = capitalizar(posible);
      }
    }

    // Patrón B: "me llamo X", "mi nombre es X", "soy X"
    if (!parches.nombre) {
      const matchPresentacion = texto.match(/\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20})?)(?:\s*,|\s*\.|\s+de\b|\s+y\s+soy|\s+soy|$)/i);
      if (matchPresentacion) {
        const posible = matchPresentacion[1].trim();
        if (!NOMBRES_PROHIBIDOS.has(posible.toLowerCase())) {
          parches.nombre = capitalizar(posible);
        }
      }
    }

    // Patrón C (v2): respuesta desnuda al "¿Con quién tengo el gusto?" → "María"
    if (!parches.nombre && contexto.preguntaNombre) {
      const limpio = texto.replace(/[.!,;]+$/g, '').trim();
      const sinCiudad = limpio.replace(/\s+(?:de|desde|en)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/i, '').trim();
      const palabras = sinCiudad.split(/\s+/);
      const patronNombre = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,2}$/;
      if (
        palabras.length >= 1 &&
        palabras.length <= 3 &&
        patronNombre.test(sinCiudad) &&
        !/[?¿0-9]/.test(sinCiudad) &&
        !NOMBRES_PROHIBIDOS.has(normalizar(sinCiudad).toLowerCase()) &&
        !CIUDADES_ECUADOR.includes(normalizar(sinCiudad).toLowerCase())
      ) {
        parches.nombre = capitalizar(sinCiudad);
        // Si vino "María de Guayaquil", capturamos también la ciudad
        if (!parches.ciudad && !leadActual.ciudad) {
          const matchCiudad = limpio.match(/\s(?:de|desde|en)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+)$/i);
          if (matchCiudad) {
            const cand = normalizar(matchCiudad[1]).toLowerCase().trim();
            if (CIUDADES_ECUADOR.includes(cand)) parches.ciudad = capitalizar(cand);
          }
        }
      }
    }
  }

  // ============================================================
  // 4. PERFIL ACADÉMICO — orden corregido v2
  // ============================================================
  if (!leadActual.perfil) {
    const esNormalista = textoNorm.includes('normalista') ||
      (textoNorm.includes('titulo') && textoNorm.includes('pedagog'));

    // Señales EXPLÍCITAS de docente (ya no basta con mencionar "colegio")
    const senalDocente = /\b(docente|profesor|profesora|maestro|maestra|doy clases|doy clase|enseno)\b/.test(textoNorm) ||
      (/(trabajo|laboro|estoy en)\b/.test(textoNorm) && /\b(escuela|colegio|institucion)\b/.test(textoNorm));
    const negacionExp = /(sin|no tengo|carezco de|nunca he tenido|todavia no|cero)\s+(de\s+)?experiencia/i.test(textoNorm);
    const senalExperiencia = /(experiencia|\b\d{1,2}\s*anos?\b|trabajando|laborando|trabajo hace)/.test(textoNorm);
    const senalBachiller = /(bachiller|sali del colegio|vengo del colegio|vengo directo|termine el colegio|acabe el colegio|recien graduad|sin experiencia|aun no trabajo|no tengo experiencia|no se que estudiar)/.test(textoNorm);
    const senalTitulo = /(tercer nivel|titulo universitario|ya me titule|ya estoy titulado|soy licenciado|soy ingenier|tengo mi titulo|estoy titulad)/.test(textoNorm);

    if (esNormalista) {
      parches.perfil = 'normalista';            // PE-12
    } else if (senalDocente && senalExperiencia && !negacionExp) {
      parches.perfil = 'docente_4anos';          // PE-15
    } else if (senalDocente) {
      parches.perfil = negacionExp ? 'docente_sin_exp' : 'docente'; // si niega experiencia o falta confirmar años
    } else if (senalTitulo) {
      parches.perfil = 'tercer_nivel';           // Maestría
    } else if (senalBachiller) {
      parches.perfil = 'bachiller';              // Grado regular
    }
    // FIX v2: "salí del colegio hace 2 años" ya no cae en docente:
    // la señal de bachiller se evalúa aunque el texto contenga "colegio"/"años".
  }

  // ============================================================
  // 5. CARRERA DE INTERÉS
  // ============================================================
  if (!leadActual.carrera && !parches.carrera) {
    const mapaCarreras = [
      // Posgrados / Maestrías primero (para no ser tapadas por grado)
      [/(mba|maestria en administracion)/, 'MBA (Administración de Empresas)'],
      [/(maestria en educacion basica)/, 'Maestría en Educación Básica'],
      [/(maestria en educacion inicial|neurodesarrollo)/, 'Maestría en Educación Inicial y Neurodesarrollo'],
      [/(derecho procesal)/, 'Maestría en Derecho Procesal'],
      [/(pedagogia digital)/, 'Maestría en Pedagogía Digital e IA'],
      [/(seguridad y salud|seguridad ocupacional|\bsst\b)/, 'Validación en Seguridad y Salud Ocupacional'],
      // Grados regulares
      [/(educacion inicial|inicial)/, 'Licenciatura en Educación Inicial'],
      [/(educaci|profesor|pedagog|docente de escuela)/, 'Licenciatura en Ciencias de la Educación'],
      [/(derecho|leyes|abogac)/, 'Derecho'],
      [/(enfermer)/, 'Licenciatura en Enfermería'],
      [/(psicolog)/, 'Licenciatura en Psicología'],
      [/(auditor)/, 'Licenciatura en Auditoría y Control de Gestión'],
      [/(administra)/, 'Licenciatura en Administración de Empresas'],
      [/(ciberseguridad|inteligencia artificial|\bia\b|sistemas|software|computac)/, 'Ingeniería en IA y Ciberseguridad'],
      [/(odontolog)/, 'Licenciatura en Odontología'],
      [/(fisioterap)/, 'Licenciatura en Fisioterapia'],
      [/(economia)/, 'Licenciatura en Economía']
    ];
    for (const [regex, carrera] of mapaCarreras) {
      if (regex.test(textoNorm)) {
        parches.carrera = carrera;
        break;
      }
    }
  }

  // ============================================================
  // 6. RUTA DEL EMBUDO (grado | validacion | maestria) — v2
  // ============================================================
  if (!leadActual.ruta && !parches.ruta) {
    const carreraActiva = parches.carrera || leadActual.carrera;
    if (/(maestri|posgrado|especializacion|mba|doctorado)/.test(textoNorm)) {
      parches.ruta = 'maestria';
    } else if (/(titular|titulacion|validar|validacion|pe-?12|pe-?15|experiencia laboral|me quiero titular)/.test(textoNorm)) {
      parches.ruta = 'validacion';
    } else if (/(carrera|empezar a estudiar|quiero estudiar|seguir una carrera|universidad)/.test(textoNorm)) {
      parches.ruta = 'grado';
    } else if (parches.perfil === 'tercer_nivel') {
      parches.ruta = 'maestria';
    } else if (parches.perfil === 'normalista' || parches.perfil === 'docente_4anos') {
      parches.ruta = 'validacion';
    } else if (parches.perfil === 'bachiller') {
      parches.ruta = 'grado';
    } else if (carreraActiva) {
      // Inferencia por la carrera capturada: el nombre del programa
      // determina la ruta cuando no hubo palabras clave explícitas.
      if (/^maestr/i.test(carreraActiva) || /^mba/i.test(carreraActiva)) {
        parches.ruta = 'maestria';
      } else if (/^validaci/i.test(carreraActiva)) {
        parches.ruta = 'validacion';
      } else {
        parches.ruta = 'grado';
      }
    }
  }

  // ============================================================
  // 7. OBJECIONES (analítica de guiones · manual Sección 11) — v2
  // ============================================================
  if (/(muy caro|esta caro|esta cara|carisimo|costoso|no me alcanza|mucho dinero|una rebaja|descuento|mas barato|mas barata|la cuota esta muy)/.test(textoNorm)) {
    parches._objecion = 'precio';
  }
  if (/(para que|por que|porque|para q|pa que)[^.;!?]{0,30}c[eé]dula|c[eé]dula para qu[eé]|no doy mi c[eé]dula|no puedo dar mi c[eé]dula|no voy a dar (mi )?c[eé]dula|desconf|estafa|son reales|seguros que son|me da desconfianza/.test(texto)) {
    parches._objecion = parches._objecion || 'cedula';
  }

  // ============================================================
  // 8. CONFIRMACIÓN T4 → ficha_completa — v2
  // ============================================================
  if ((leadActual.cedula || parches.cedula) && !leadActual.confirmado) {
    const positivo = /\b(si|sí|correcto|de acuerdo|dale|listo|perfecto|ok|okey|aparta|aparte|reserva|reservo|inscrib|enlace|link|confirma|quiero mi cupo|me interesa)\b/i.test(texto);
    const negativo = /\b(no|aun no|todavia no|luego|despues|pensarlo|pensandolo|mas tarde|no gracias|dejame pensarlo)\b/i.test(texto);
    if (positivo && !negativo) {
      parches.confirmado = 1;
    }
  }

  return parches;
}

module.exports = {
  extraerDatosLead,
  esCedulaValida,
  validarCedulaEcuador: esCedulaValida,
  CIUDADES_ECUADOR,
  NOMBRES_PROHIBIDOS
};
