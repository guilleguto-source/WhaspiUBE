/**
 * diana-router.js · v5 — CAPA DE CONSISTENCIA DE DIANA
 * ---------------------------------------------------------------
 * Responde a la pregunta del negocio: "¿cómo hacemos que las respuestas
 * sean más consistentes y que el bot siempre sepa dónde buscar?"
 *
 * 1) clasificarIntencion(): enrutamiento DETERMINISTA (sin LLM) de cada
 *    mensaje a UNA intención conocida. El código decide qué fuente usar
 *    ANTES de llamar al modelo: la matriz de valores, el catálogo por
 *    áreas, el tríptico, el guion del embudo o la conversación libre.
 *
 * 2) bloqueRutaParaPrompt(): inyecta un [BLOQUE DE RUTA] al prompt de
 *    Diana que le dice exactamente qué fuente usar (y qué NO hacer) en
 *    este turno. Con esto el LLM ya no "se marea": nunca improvisa la
 *    fuente, solo redacta con los datos de la fuente indicada.
 *
 * El módulo NO reemplaza a menu-service / prompt-engine: los reusa como
 * únicas fuentes de verdad (matriz de valores = data/precios.json).
 */

const menuService = require('./menu-service');

// ---------------------------------------------------------------
// Detección de intención (reglas deterministas, prioridad de arriba a abajo)
// ---------------------------------------------------------------

const RE = {
  saludo: /^(hola|holi|holaa+|buenas|buenos dias|buen dia|buenas tardes|buenas noches|hey|hello|hi|que tal|saludos|informacion|info)[\s!¡.,]*$/i,
  despedida: /(gracias|hasta luego|chao|adios|bye)/i,
  llamada: /(llam(?:ame|ada)|hablar con (?:un )?asesor|que me llamen|agendar|contactar por (?:llamada|telefono)|timbr(?:an|ar|ame)|cuadremos una llamada)/i,
  reserva: /\b(separ(?:e|ame|eme|ar)|reserv(?:e|ame|eme|ar)|apart(?:a|ame|ar)|guard(?:e|ame|ar)|inscrib(?:irme|ir)|matricul(?:arme|ar))\b.*\b(cupo|plaza|beneficio)?\b|\b(quiero mi cupo|mi cupo|separe el cupo|reserve el cupo|apartar el cupo|de una amiga reserve el cupo|separe mi cupo)\b/i,
  catalogo: /(todas las opciones|el catalogo|el catálogo|ver catalogo|ver catálogo|que maestrias tienen|que maestrías tienen|que carreras tienen|lista completa|opciones de maestrias|areas de maestrias|áreas de maestrías|todas las maestrias|todas las maestrías)/i,
  precio: /(cu[aá]nto (?:cuesta|vale)|precio|precios|cuota|valor|arancel|inversion|inversión|matricula|matrícula|costo|costos)/i,
  fecha: /(cuando (?:empieza|inicia|arranca)|fecha de inicio|inicio de clases|proximo ciclo|próximo ciclo|cohortes?)/i,
  malla: /(malla|pensum|curriculo|currículo|materias|asignaturas|modulos|módulos|que materias)/i,
  triptico: /(triptico|tríptico|folleto|pdf|brochure)/i,
  cedula: /c[eé]dula|documento de identidad|dni/i,
  humano: /(asesor humano|persona real|hablar con una persona|no eres humano|eres un bot|robot)/i
};

/**
 * @param {string} texto          mensaje del aspirante (ya unificado)
 * @param {object} lead           ficha CRM (puede ser null)
 * @param {object} ctx            { preguntaNombre, preguntaLlamada, preguntaAreaMaestria }
 * @returns {object} intent { tipo, programa, area, detalle }
 */
function clasificarIntencion(texto, lead = null, ctx = {}) {
  const t = String(texto || '').trim();
  const area = detectarAreaEnTexto(t);
  const esConsultaPluralOArea = /(?:qu[eé]\s+)?(?:carreras|maestr[ií]as|programas|opciones|cu[aá]les)\b|[aá]rea\s+(?:de|en)\b/i.test(t);
  let programa = esConsultaPluralOArea && area ? null : menuService.detectarProgramaEnTexto(t);
  const mencionaMaestria = /maestri|posgrado|especializacion|\bmba\b|doctorado/i.test(t);

  // Si no se detecta programa en este mensaje específico pero el aspirante ya tiene
  // un programa activo en su ficha CRM, heredar dicho programa
  if (!programa && lead && lead.carrera && !esConsultaPluralOArea) {
    programa = menuService.buscarPrograma(lead.carrera);
  }

  // 1) Llamada explícita (tiene máxima prioridad sobre programa heredado)
  if (RE.llamada.test(t)) {
    return { tipo: 'llamada', programa, detalle: 'coordinar llamada con asesor' };
  }

  // 2) Intención explícita de reserva / inscripción / separar cupo
  if (RE.reserva.test(t)) {
    return { tipo: 'reserva_cupo', programa, area, detalle: 'intención directa de separar cupo o preinscripción' };
  }

  // 3) Área elegida expresamente cuando Diana preguntó por área (paso 2 del catálogo)
  // O consulta explícita por las opciones/carreras de un área
  if (area && (ctx.preguntaAreaMaestria || (lead && lead.ctx_pendiente === 'area') || esConsultaPluralOArea || (!programa && !lead?.carrera))) {
    return { tipo: 'area_elegida', area, detalle: 'desglose del área elegida' };
  }

  // 4) Programa concreto mencionado o heredado de la ficha
  if (programa) {
    if (RE.precio.test(t)) {
      return { tipo: 'precio_programa', programa, area, detalle: 'consulta de inversión o costos' };
    }
    if (RE.fecha.test(t)) {
      return { tipo: 'fecha_programa', programa, area, detalle: 'consulta de inicio de clases o fechas' };
    }
    if (RE.malla.test(t) || RE.triptico.test(t)) {
      return { tipo: 'triptico', programa, area, detalle: 'malla / materias / tríptico' };
    }
    if (RE.cedula.test(t)) {
      return { tipo: 'datos_cedula', programa, area, detalle: 'cédula + programa' };
    }
    return { tipo: 'programa_interes', programa, area, detalle: 'consulta sobre un programa específico' };
  }

  // 5) Área elegida en texto libre (paso 2 del catálogo)
  if (area && (ctx.preguntaAreaMaestria || (lead && lead.ctx_pendiente === 'area') ||
      ((lead && lead.area_interes_maestria) || mencionaMaestria))) {
    return { tipo: 'area_elegida', area, detalle: 'desglose del área elegida' };
  }

  // 6) Catálogo completo / maestrías sin área (paso 1)
  if (RE.catalogo.test(t) || (mencionaMaestria && !area && menuService.pideMaestriasSinArea(t))) {
    return { tipo: 'catalogo_areas', detalle: 'paso 1: presentar áreas oficiales' };
  }

  // 7) Respuesta a una pregunta previa de Diana (bandera determinista)
  if (lead && lead.ctx_pendiente === 'nombre' && !RE.despedida.test(t)) {
    return { tipo: 'respuesta_nombre', detalle: 'respuesta a la pregunta de identidad' };
  }

  // 8) Saludo limpio
  if (RE.saludo.test(t) || (menuService.esSaludoGenerico(t) && !mencionaMaestria)) {
    return { tipo: 'saludo', detalle: 'primer contacto o saludo genérico' };
  }

  // 9) Todo lo demás: conversación guiada por el guion del embudo
  return { tipo: 'conversacion', detalle: 'embudo guiado por intenciones' };
}

/** Detecta un área oficial mencionada en el texto (nombres EXACTOS de la matriz). */
function detectarAreaEnTexto(texto) {
  const t = menuService.normalizar(texto);
  if (!t) return null;
  const MAPA = [
    [/educacion|docencia|pedagogia/, 0],
    [/administrativ|economi|empresa|negocio|gestion|administracion/, 1],
    [/derecho|gobernanza|leyes|juridic|criminolog/, 2],
    [/ingenieri|tecnolog|sistema|software|ciberseguridad|bim/, 3],
    [/salud|bienestar|enfermer|medicin|fisioter|biomedic/, 4]
  ];
  for (const [re, idx] of MAPA) {
    if (re.test(t)) return menuService.AREAS_MAESTRIAS[idx];
  }
  return null;
}

/**
 * Construye el [BLOQUE DE RUTA] para el prompt: le dice a Diana qué fuente
 * usar en ESTE turno y qué NO hacer. Máx. 4 líneas (presupuesto de tokens).
 */
function bloqueRutaParaPrompt(intent, lead = null) {
  if (!intent || !intent.tipo) return '';
  const L = [`[BLOQUE DE RUTA · turno determinado por el sistema — sigue ESTA fuente, no improvises]`];
  switch (intent.tipo) {
    case 'precio_programa':
      L.push(`Intención: precio/costos de "${menuService.nombrePrograma(intent.programa)}".`);
      L.push('Fuente: SOLO el [BLOQUE DE PRECIO OFICIAL] de este programa. Responde DIRECTAMENTE los valores exactos (matrícula, cuotas, inversión total y descuento de pronto pago/contado). NUNCA evadas la pregunta de costos ni pidas cédula antes de dar el precio.');
      break;
    case 'fecha_programa':
      L.push(`Intención: inicio de clases/fechas de "${menuService.nombrePrograma(intent.programa)}".`);
      L.push('Fuente: [BLOQUE DE PRECIO OFICIAL] (campo inicio/horario). Responde directamente la fecha de inicio y horario de clases del programa.');
      break;
    case 'reserva_cupo':
      L.push(`Intención: reserva/separación de cupo o preinscripción${intent.programa ? ' para "' + menuService.nombrePrograma(intent.programa) + '"' : ''}.`);
      L.push('Acción OBLIGATORIA: ¡Felicita al aspirante y confirma la reserva! Explica que su cupo queda pre-asignado con el beneficio institucional. Si ya tenemos su cédula o datos, confirma que el equipo de admisiones formaliza la inscripción hoy mismo. NO reinicies la conversación ni vuelvas a pedir datos que ya están en la FICHA CRM.');
      break;
    case 'programa_interes':
      L.push(`Intención: consulta sobre "${menuService.nombrePrograma(intent.programa)}".`);
      L.push('Fuente: datos del programa en el catálogo/matriz; responde directo la consulta y avanza el embudo (una pregunta de cierre). NO presentes el menú de áreas.');
      break;
    case 'area_elegida':
      L.push(`Intención: eligió el área "${intent.area}".`);
      L.push(`Fuente: SOLO las maestrías de esa área (catálogo sección 6C). NO repitas el menú de áreas ni menciones programas de otras áreas. Termina preguntando cuál programa le da la inversión exacta.`);
      break;
    case 'catalogo_areas':
      L.push('Intención: catálogo de maestrías SIN programa específico.');
      L.push('Fuente: SOLO las áreas oficiales con conteo (sección 6C). PROHIBIDO listar maestrías de golpe; ofrece explorar un área y pregunta cuál.');
      break;
    case 'triptico':
      L.push(`Intención: malla/tríptico${intent.programa ? ' de "' + menuService.nombrePrograma(intent.programa) + '"' : ''}.`);
      L.push(`Acción OBLIGATORIA: entrega de inmediato la información de alto valor (duración, modalidad, cuota) y añade [PDF: ${intent.programa ? menuService.nombrePrograma(intent.programa) : 'Programa'}] al final. NUNCA condiciones el envío del tríptico a pedir la cédula. Entrega el PDF primero y luego ofrece congelar el cupo con la cédula.`);
      break;
    case 'llamada':
      L.push('Intención: quiere llamada de un asesor.');
      L.push('Fuente: SOLO los horarios fijos de la sección 7 (mín. 20 min de margen). PROHIBIDO prometer llamadas "en 5 minutos".');
      break;
    case 'respuesta_nombre':
      L.push('Intención: acaba de dar su nombre (respuesta directa).');
      L.push('Acción: agradécelo, regístralo (ya está en la FICHA CRM) y pide SOLO el siguiente dato que falte (ciudad o perfil). Un dato a la vez.');
      break;
    case 'saludo':
      L.push('Intención: saludo de apertura.');
      L.push('Acción: presentación + pedir el nombre + ofrecer GRADO y MAESTRÍAS (ver Turno 1). Si ya tiene datos en la FICHA CRM, saluda por su nombre y retoma donde quedaron.');
      break;
    default:
      L.push('Intención: conversación general del embudo.');
      L.push('Fuente: FICHA CRM ACTIVA + guion de 4 turnos. Revisa la etapa y pide UN dato a la vez.');
  }
  if (lead && lead.area_interes_maestria && intent.tipo !== 'area_elegida') {
    L.push(`Nota: su área registrada es "${lead.area_interes_maestria}" — no la vuelvas a preguntar.`);
  }
  return L.join('\n');
}

module.exports = {
  clasificarIntencion,
  detectarAreaEnTexto,
  bloqueRutaParaPrompt
};
