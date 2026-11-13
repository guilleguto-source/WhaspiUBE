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

/**
 * v5 · FUENTE ÚNICA DE ÁREAS (auditoría): los nombres de área deben ser
 * EXACTAMENTE los de la matriz de valores (data/precios.json, generada por
 * sync-catalogo.js con sus AREAS). Antes el extractor usaba nombres largos
 * que NO existían en la matriz ("Ciencias Administrativas y Económicas")
 * → el desglose del catálogo por área se rompía para 2 de 5 áreas y Diana
 * "se mareaba" repitiendo el menú.
 * Se importan del catálogo oficial (única fuente de verdad).
 */
const { AREAS_MAESTRIAS } = require('./menu-service');

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
  'soy profesor', 'soy profesora', 'soy estudiante', 'soy ingeniero', 'soy ingeniera',
  'soy abogado', 'soy abogada', 'soy doctor', 'soy doctora', 'soy enfermero', 'soy enfermera',
  'ingeniero', 'ingeniera', 'abogado', 'abogada', 'doctor', 'doctora', 'medico', 'medica',
  'enfermero', 'enfermera', 'licenciado', 'licenciada', 'arquitecto', 'arquitecta',
  'contador', 'contadora', 'psicologo', 'psicologa', 'tecnologo', 'tecnologa',
  'civil', 'industrial', 'comercial', 'sistemas', 'agronomo', 'agronoma', 'ambiental',
  'tecnico', 'tecnica', 'postulante', 'aspirante', 'interesado', 'interesada',
  'docentes', 'profesores', 'ingenieros', 'licenciados', 'abogados', 'doctores',
  'quisiera', 'quieiera', 'quiero', 'deseo', 'busco', 'carrera', 'carreras',
  'vivo', 'resido', 'trabajo', 'estoy', 'tengo', 'vengo', 'necesito', 'favor',
  'por favor', 'de una', 'dale', 'sepame', 'separeme', 'ando', 'soy de',
  'ingenieria', 'ingeniería', 'ingenierias', 'ingenierías', 'licenciatura',
  'estudiar', 'saber', 'conocer', 'ayuda', 'ayudar', 'precio', 'precios',
  'costo', 'costos', 'requisitos', 'malla', 'pensum', 'me gustaria', 'gustaria',
  'buscando', 'averiguando', 'consultando', 'preguntando', 'viendo', 'revisando', 'pensando', 'estudiando'
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
  //    v3: candidatos con separadores (091234567-8), detección de
  //    cédulas malformadas (9 u 11 dígitos) y filtro anti-celular
  //    por CONTEXTO LOCAL ("mi número es 09…"), no por palabra suelta
  //    ("llama la atención" ya NO descarta la cédula).
  // ============================================================
  if (!leadActual.cedula) {
    const mencionaCedula = /c[eé]dula|ced\.?|documento de identidad|dni/i.test(texto);
    // candidatos: grupos de 9 a 12 dígitos (admite - o espacio como separador visual)
    const grupos = texto.match(/\b\d(?:[\s.-]?\d){8,11}\b/g) || [];
    const remitente = String(contexto.telefonoRemitente || '').replace(/\D/g, '');
    let rechazadas = [];

    for (const crudo of grupos) {
      const cand = crudo.replace(/[\s.-]/g, '');
      const pos = texto.indexOf(crudo);
      const prefijo = texto.slice(Math.max(0, pos - 45), pos).toLowerCase();
      const sufijo = texto.slice(pos + crudo.length, pos + crudo.length + 25).toLowerCase();
      // contexto LOCAL de teléfono: el número está pegado a la palabra celular/número/llámame
      const contextoCelular = /(?:mi\s+)?(?:n[uú]mero|celular|tel[eé]fono|contacto|whats(?:app)?|wpp)\s*(?:es|de contacto|personal|:?|es mi)?\s*(?:de\s+contacto\s*)?$/.test(prefijo.trim())
        || /^(?:es mi (?:celular|n[uú]mero)|para (?:llamarme|contactarme))/.test(sufijo.trim());
      if (contextoCelular) continue;
      if (remitente && cand === remitente) continue;             // pegó su propio contacto
      if (cand.length === 10) {
        if (esCedulaValida(cand)) {
          parches.cedula = cand;
          // Beneficio por defecto según ruta (manual · Sección 05)
          if (!leadActual.beneficio && !parches.beneficio) {
            const ruta = parches.ruta || leadActual.ruta;
            if (ruta === 'maestria') parches.beneficio = 'verificacion_senescyt';
            else if (ruta === 'validacion') parches.beneficio = 'revision_experiencia';
            else parches.beneficio = 'descuento_pronto_pago_72h';
          }
          break;
        }
        rechazadas.push({ numero: cand, motivo: 'no pasa el dígito verificador (módulo 10)' });
      } else if (cand.length === 9 || cand.length === 11) {
        // dígito de menos o de más — solo lo marcamos si el contexto habla de cédula
        if (mencionaCedula || /c[eé]dula/.test(prefijo)) {
          rechazadas.push({ numero: cand, motivo: `tiene ${cand.length} dígitos y la cédula ecuatoriana tiene 10` });
        }
      } else if (cand.length === 12 && mencionaCedula) {
        rechazadas.push({ numero: cand, motivo: 'tiene 12 dígitos; revisa si sobran dígitos o pegaste el celular' });
      }
    }
    if (!parches.cedula && rechazadas.length) {
      // v3: aviso para que Diana NO diga "cédula registrada" con un número inválido
      parches._cedula_rechazada = rechazadas[0];
      parches._cedula_rechazada_todas = rechazadas;
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
      const matchPresentacion = texto.match(/\b(?:me llamo|mi nombre es|soy)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20})?)(?:\s*,|\s*\.|\s+de\b|\s+desde\b|\s+en\b|\s+vivo en\b|\s+y\s+soy|\s+soy|$)/i);
      if (matchPresentacion) {
        const posible = matchPresentacion[1].trim();
        const posibleNorm = normalizar(posible).toLowerCase();
        const palabras = posibleNorm.split(/\s+/);
        const contieneProhibida = palabras.some(p => NOMBRES_PROHIBIDOS.has(p));
        if (!NOMBRES_PROHIBIDOS.has(posibleNorm) && !contieneProhibida && !posibleNorm.startsWith('soy ') && !posibleNorm.startsWith('de ')) {
          parches.nombre = capitalizar(posible);
        }
      }
    }

    // Patrón B' (v3): apertura "Nombre Apellido de Ciudad..." o "Nombre desde Ciudad" sin coma
    // ej. "Maritza Galarza de Guayaquil... ya soy licenciada" / "carmen yanez desde ambato..."
    // El saludo inicial es opcional; la ciudad SIEMPRE debe estar en la lista oficial.
    if (!parches.nombre) {
      const matchApertura = texto.match(/^(?:(?:hola|buenas|buenos dias|buenas tardes|buenas noches|que tal|q tal|hey|estimad[ao]s?|licen(?:ciada|do)?|diana|buen dia)[,!.\s]*)?([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20}(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{3,20}){0,2})\s+(?:de|desde|en)\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{4,20})\b/i);
      if (matchApertura) {
        const posible = matchApertura[1].trim();
        const posibleNorm = normalizar(posible).toLowerCase();
        const palabras = posibleNorm.split(/\s+/);
        const contieneProhibida = palabras.some(p => NOMBRES_PROHIBIDOS.has(p));
        const ciudadCandidata = normalizar(matchApertura[2]).toLowerCase();
        if (!contieneProhibida && !NOMBRES_PROHIBIDOS.has(posibleNorm) && CIUDADES_ECUADOR.includes(ciudadCandidata)) {
          parches.nombre = capitalizar(posible);
          if (!parches.ciudad && !leadActual.ciudad) parches.ciudad = capitalizar(ciudadCandidata);
        }
      }
    }

    // Patrón C (v2): respuesta desnuda al "¿Con quién tengo el gusto?" → "María"
    // v5: además de la regex sobre el historial, la bandera determinista
    // ctx_pendiente='nombre' (grabada por el código al enviar la pregunta) garantiza
    // que la respuesta desnuda SIEMPRE se capture.
    if (!parches.nombre && (contexto.preguntaNombre || leadActual.ctx_pendiente === 'nombre')) {
      const limpio = texto.replace(/[.!,;]+$/g, '').trim();
      const sinCiudad = limpio.replace(/\s+(?:de|desde|en)\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/i, '').trim();
      const palabras = sinCiudad.split(/\s+/);
      const contieneProhibida = palabras.some(p => NOMBRES_PROHIBIDOS.has(normalizar(p).toLowerCase()));
      const patronNombre = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){0,2}$/;
      if (
        palabras.length >= 1 &&
        palabras.length <= 3 &&
        patronNombre.test(sinCiudad) &&
        !/[?¿0-9]/.test(sinCiudad) &&
        !NOMBRES_PROHIBIDOS.has(normalizar(sinCiudad).toLowerCase()) &&
        !contieneProhibida &&
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
  // 5. CARRERA DE INTERÉS (detección inicial y cambio de intención)
  // ============================================================
  const mapaCarreras = [
    // Posgrados / Maestrías primero (para no ser tapadas por grado)
    [/(\bmba\b|maestria en administracion)/, 'MBA (Administración de Empresas)'],
    [/(maestria en educacion basica)/, 'Maestría en Educación Básica'],
    [/(maestria en educacion inicial|neurodesarrollo)/, 'Maestría en Educación Inicial y Neurodesarrollo'],
    [/(derecho procesal)/, 'Maestría en Derecho Procesal'],
    [/(pedagogia digital)/, 'Maestría en Pedagogía Digital e IA'],
    [/(maestria en ciberseguridad)/, 'Maestría en Ciberseguridad'],
    [/(maestria en sistemas|gestion de sistemas)/, 'Maestría en Gestión de Sistemas y Tecnologías de la Información'],
    [/(seguridad y salud|seguridad ocupacional|\bsst\b)/, 'Validación en Seguridad y Salud Ocupacional'],
    // Grados regulares / Ingenierías
    [/(ingenieria en sistemas|sistemas inteligentes)/, 'Ingeniería en Sistemas Inteligentes'],
    [/(inteligencia artificial y ciberseguridad|ciberseguridad)/, 'Ingeniería en IA y Ciberseguridad'],
    [/(sistemas|software|programacion|computac)/, 'Ingeniería en Sistemas Inteligentes'],
    [/(ingenieria electrica|electrica|electricidad)/, 'Ingeniería Eléctrica'],
    [/(biomedic|ingenieria biomedica)/, 'Ingeniería en Biomedicina'],
    [/(transito|trafico|ingenieria en trafico)/, 'Validación en Ingeniería en Tráfico'],
    [/(ingenieria|ingenierias)/, 'Ingenierías'],
    [/(educacion inicial|inicial)/, 'Licenciatura en Educación Inicial'],
    [/(educaci|profesor|pedagog|docente de escuela)/, 'Licenciatura en Ciencias de la Educación'],
    [/(derecho|leyes|abogac)/, 'Derecho'],
    [/(enfermer)/, 'Licenciatura en Enfermería'],
    [/(psicolog)/, 'Licenciatura en Psicología'],
    [/(auditor)/, 'Licenciatura en Auditoría y Control de Gestión'],
    [/(administra)/, 'Licenciatura en Administración de Empresas'],
    [/(odontolog)/, 'Licenciatura en Odontología'],
    [/(fisioterap)/, 'Licenciatura en Fisioterapia'],
    [/(economia)/, 'Licenciatura en Economía'],
    [/(contabilidad|finanzas)/, 'Licenciatura en Contabilidad y Finanzas']
  ];

  let carreraDetectada = null;
  for (const [regex, carrera] of mapaCarreras) {
    if (regex.test(textoNorm)) {
      carreraDetectada = carrera;
      break;
    }
  }

  // P0-1 (v3): contexto de flujo maestría (ruta activa, catálogo por áreas o área ya registrada)
  const mencionaMaestria = /(maestri|posgrado|especializacion|\bmba\b|doctorado)/.test(textoNorm);
  const enFlujoMaestria = (leadActual.ruta === 'maestria') || parches.ruta === 'maestria' || mencionaMaestria;
  // v5: además de la regex del historial, la bandera DETERMINISTA ctx_pendiente
  // (que el propio código graba cuando envía el menú de áreas) elimina los fallos
  // de detección que hacían que Diana volviera a preguntar el área.
  const preguntaArea = Boolean(contexto.preguntaAreaMaestria) || leadActual.ctx_pendiente === 'area';
  const enFlujoCatalogoMaestria = enFlujoMaestria || preguntaArea
    || Boolean(leadActual.area_interes_maestria);
  const marcaGradoExplicita = /(licenciatura|grado|carrera de|empezar una carrera|quiero estudiar)/.test(textoNorm);

  // Detección de selección de área de maestría para catálogo modular
  // v5: nombres EXACTOS de la matriz (AREAS_MAESTRIAS importada arriba)
  const matchAreaEstudio = textoNorm.match(/\b(educacion|docencia|pedagogia|administrativ|economi|empresa|negocio|negocios|derecho|gobernanza|leyes|social|juridic|ingenieri|tecnolog|sistema|software|salud|bienestar|medicin)\b/i);
  if (matchAreaEstudio && (enFlujoMaestria || preguntaArea)) {
    const pal = matchAreaEstudio[1].toLowerCase();
    if (/educacion|docencia|pedagogia/.test(pal)) {
      parches.area_interes_maestria = AREAS_MAESTRIAS[0];           // Educación
    } else if (/administrativ|economi|empresa|negocio/.test(pal)) {
      parches.area_interes_maestria = AREAS_MAESTRIAS[1];           // Administración y Negocios
    } else if (/derecho|gobernanza|leyes|social|juridic/.test(pal)) {
      parches.area_interes_maestria = AREAS_MAESTRIAS[2];           // Derecho y Gobernanza
    } else if (/ingenieri|tecnolog|sistema|software/.test(pal)) {
      parches.area_interes_maestria = AREAS_MAESTRIAS[3];           // Ingeniería y Tecnología
    } else if (/salud|bienestar|medicin/.test(pal)) {
      parches.area_interes_maestria = AREAS_MAESTRIAS[4];           // Salud y Bienestar
    }
  }

  // v3: si venimos del catálogo de maestrías y solo mencionó un área (sin marca
  // explícita de grado), registrar el área SIN pisar la carrera con una licenciatura
  const esRespuestaDeArea = enFlujoCatalogoMaestria && carreraDetectada &&
    !/^(maestr|mba|validaci)/i.test(carreraDetectada) && !marcaGradoExplicita &&
    (texto.trim().split(/\s+/).length <= 5 || Boolean(parches.area_interes_maestria) || Boolean(leadActual.area_interes_maestria));

  // v5 (auditoría): si el texto menciona MAESTRÍA/POSGRADO, la carrera detectada
  // NUNCA puede ser una licenciatura de grado (antes: "quiero la maestría en
  // educación" quedaba con ruta=maestria + carrera="Licenciatura en Ciencias de
  // la Educación" → ficha contradictoria y Diana respondiendo de grado).
  const carreraEsDeGrado = /^(licenciatura|ingenier[ií]|derecho|odontolog)/i.test(carreraDetectada || '');
  const carreraAnuladaPorMaestria = mencionaMaestria && carreraDetectada && carreraEsDeGrado;

  if (esRespuestaDeArea) {
    // El mencionó un área dentro del flujo de maestrías: guardamos el título de
    // interés pero NO pisamos la carrera con la licenciatura detectada.
    parches.area_titulo = carreraDetectada.replace(/^Licenciatura en (Ciencias de la )?/, '');
  } else if (carreraAnuladaPorMaestria) {
    // Menciona maestría pero el extractor solo encontró una carrera de grado:
    // inferimos el área cuando es posible y NO registramos licenciatura alguna.
    if (!parches.area_interes_maestria && !leadActual.area_interes_maestria) {
      const areaInferida =
        /educacion|pedagog|docente/.test(textoNorm) ? AREAS_MAESTRIAS[0] :
        /derecho|gobernanza|leyes|criminolog|juridic/.test(textoNorm) ? AREAS_MAESTRIAS[2] :
        /ingenieri|sistema|software|tecnolog|ciberseguridad|datos|ia\b/.test(textoNorm) ? AREAS_MAESTRIAS[3] :
        /salud|enfermer|fisioter|biomedic|odontolog|medicin/.test(textoNorm) ? AREAS_MAESTRIAS[4] :
        /administr|tributari|contabil|finanz|auditor|mercadeo|ventas|logistic|talento/.test(textoNorm) ? AREAS_MAESTRIAS[1] :
        null;
      if (areaInferida) parches.area_interes_maestria = areaInferida;
    }
  } else if (carreraDetectada) {
    if (!leadActual.carrera) {
      parches.carrera = carreraDetectada;
    } else if (leadActual.carrera !== carreraDetectada && !leadActual.confirmado) {
      // Detección de cambio de carrera o consulta exploratoria
      const esCambioOInteres = /(quiero|informacion|info|tienen|tienes|cuanto|como es|pensum|malla|cambi|mejor|ahora|otra|y de|y en|\?)/.test(textoNorm) ||
        textoNorm.split(/\s+/).length <= 6;
      if (esCambioOInteres) {
        parches.carrera = carreraDetectada;
      }
    }
  }

  // ============================================================
  // 6. RUTA DEL EMBUDO (grado | validacion | maestria) — v2
  // ============================================================
  if (!leadActual.ruta && !parches.ruta) {
    const carreraActiva = parches.carrera || leadActual.carrera;
    if (/(maestri|posgrado|especializacion|\bmba\b|doctorado)/.test(textoNorm)) {
      parches.ruta = 'maestria';
    } else if (/(titular|titulacion|validar|validacion|pe-?12|pe-?15|experiencia laboral|me quiero titular)/.test(textoNorm)) {
      parches.ruta = 'validacion';
    } else if (enFlujoCatalogoMaestria && !marcaGradoExplicita && (parches.area_interes_maestria || leadActual.area_interes_maestria)) {
      // v3: venimos del catálogo de maestrías y eligió un área → ruta maestría
      parches.ruta = 'maestria';
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
  // 8. CONFIRMACIÓN T4 → ficha_completa — v2 (evaluado sobre textoNorm para acentos)
  // ============================================================
  if ((leadActual.cedula || parches.cedula) && !leadActual.confirmado) {
    const positivo = /\b(si|correcto|de acuerdo|dale|listo|perfecto|ok|okey|aparta|aparte|reserva|reservo|inscrib|enlace|link|confirma|quiero mi cupo|me interesa)\b/i.test(textoNorm);
    const negativo = /\b(no|aun no|todavia no|luego|despues|pensarlo|pensandolo|mas tarde|no gracias|dejame pensarlo)\b/i.test(textoNorm);
    if (positivo && !negativo) {
      parches.confirmado = 1;
    }
  }

  // ============================================================
  // 9. AGENDAMIENTO DE LLAMADA CON ASESOR HUMANO (P1-2 blindado)
  // ============================================================
  // Requiere indicador temporal explícito: "a las 10", "4:30 pm", "11 am", "la primera"
  // Se evitan números sueltos de contexto (ej. "tengo 2 hijos", "en 5 minutos")
  const regexHoraEstricta = /\b(?:(?:a las?|a la|para las?)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|(\d{1,2}:\d{2}\s*(?:am|pm)?)|(\d{1,2}\s*(?:am|pm))|(manana\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)|(la primera|la segunda|la tercera|el primero))\b/i;
  const matchHora = textoNorm.match(regexHoraEstricta);
  const pideLlamada = /(llam(?:ame|ada)|contact(?:e|en|ar)|asesor|hablar por telefono|que me llamen|agendar|agendemos|pueden llamar)/.test(textoNorm);

  if ((pideLlamada || contexto.preguntaLlamada || leadActual.ctx_pendiente === 'horario') && matchHora) {
    const valorHora = matchHora[1] || matchHora[2] || matchHora[3] || matchHora[4] || matchHora[5];
    if (valorHora) {
      parches.llamada_agendada_horario = capitalizar(valorHora.trim());
      parches.llamada_estado = 'pendiente';
      parches.llamada_agendada_ts = Date.now();
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
