/**
 * menu-service.js · v3 — Menús interactivos, detección de programa y PRECIOS OFICIALES UBE.
 * Fuente de valores: data/precios.json (generado desde la matriz INSCRIPCIONES UBE,
 * hojas MAESTRÍAS 2 / PRECIOS MAESTRIAS (2) / PRECIOS - GRADO Y PROGRAMAS (2) / INGLÉS).
 * El archivo SharePoint se actualiza cada mes → regenerar precios.json en cada actualización.
 */
const fs = require('fs');
const path = require('path');

// =======================================================
// Carga y normalización
// =======================================================
let _cachePrecios = { mtime: 0, data: null };

function cargarPrecios() {
  const ruta = path.join(__dirname, 'data', 'precios.json');
  try {
    const st = fs.statSync(ruta);
    if (_cachePrecios.data && st.mtimeMs === _cachePrecios.mtime) return _cachePrecios.data;
    const data = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    _cachePrecios = { mtime: st.mtimeMs, data };
    return data;
  } catch (err) {
    return { maestrias: [], grado: [], programas_especiales: [], reglas_comerciales: {}, ingles: {}, meta: {} };
  }
}

function sinAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizar(t) {
  return sinAcentos(String(t || '').toLowerCase())
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// =======================================================
// Formato de dinero (estilo ecuatoriano: $1.648,50)
// =======================================================
function money(v) {
  if (v === null || v === undefined || isNaN(v)) return null;
  const n = Number(v);
  const entero = Math.floor(n);
  const dec = Math.round((n - entero) * 100);
  const miles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return dec > 0 ? `$${miles},${String(dec).padStart(2, '0')}` : `$${miles}`;
}

function fechaCorta(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// =======================================================
// Detección de programa en texto libre
// =======================================================
const STOPWORDS = new Set(['maestria', 'maestrias', 'en', 'de', 'la', 'el', 'los', 'las', 'del', 'un', 'una', 'quiero', 'sobre', 'info', 'informacion', 'costo', 'costos', 'precio', 'valor', 'cuota', 'cuanto', 'carrera', 'carreras', 'grado', 'con', 'mencion', 'programa', 'y', 'e', 'para']);

function titulosIndexados() {
  const p = cargarPrecios();
  const idx = [];
  for (const m of (p.maestrias || [])) idx.push({ tipo: 'maestria', ref: m, clave: normalizar(m.titulo) });
  for (const g of (p.grado || [])) idx.push({ tipo: 'grado', ref: g, clave: normalizar(g.carrera) });
  for (const pe of (p.programas_especiales || [])) idx.push({ tipo: 'pe', ref: pe, clave: normalizar(`${pe.carrera} ${pe.duracion || ''}`) });
  // v4: la tabla de VALIDACIÓN de educación ahora vive aparte; también se indexa
  for (const pv of (p.validacion || [])) idx.push({ tipo: 'pe', ref: pv, clave: normalizar(`${pv.carrera} ${pv.duracion || ''}`) });
  return idx;
}

/**
 * Busca el mejor programa mencionado en el texto.
 * Devuelve { tipo, ref, clave } o null.
 */
function detectarProgramaEnTexto(texto) {
  const t = normalizar(texto);
  if (!t || t.length < 4) return null;
  const idx = titulosIndexados();

  // 1) coincidencia exacta de la clave completa dentro del texto
  for (const it of idx) {
    if (it.clave.length >= 8 && t.includes(it.clave)) return it;
  }
  // 2) por tokens significativos (mín. 2 tokens del título presentes)
  const tokensTexto = new Set(t.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w)));
  let mejor = null, mejorScore = 0;
  for (const it of idx) {
    const tokens = it.clave.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
    if (!tokens.length) continue;
    let hits = 0;
    for (const tk of tokens) if (tokensTexto.has(tk)) hits++;
    const score = hits / tokens.length;
    if (hits >= 2 && score >= 0.55 && score > mejorScore) { mejor = it; mejorScore = score; }
  }
  if (mejor) return mejor;
  // 3) token distintivo único (psicología, criminología, odontología…)
  //    con palabras ambiguas excluidas (educación, gestión, seguridad…: Diana pregunta)
  const AMBIGUOS = new Set(['educacion', 'gestion', 'tecnologia', 'ciencias', 'salud', 'seguridad', 'ingenieria', 'licenciatura', 'maestria', 'programa', 'validacion', 'estudios']);
  const candidatos = [];
  for (const it of idx) {
    const tokens = it.clave.split(' ').filter(w => w.length >= 6 && !STOPWORDS.has(w) && !AMBIGUOS.has(w));
    if (!tokens.length) continue;
    let hits = 0;
    for (const tk of tokens) if (tokensTexto.has(tk)) hits++;
    if (hits === 0) continue;
    const score = hits / tokens.length;
    if (score >= 0.25) candidatos.push({ it, score });
  }
  if (candidatos.length) {
    candidatos.sort((a, b) => (b.score - a.score)
      || (a.it.tipo === 'grado' ? -1 : 1) - (b.it.tipo === 'grado' ? -1 : 1)
      || (a.it.clave.length - b.it.clave.length));
    return candidatos[0].it;
  }
  return null;
}

/**
 * Busca por nombre aproximado (para lead.carrera guardado en CRM).
 */
function buscarPrograma(nombre) {
  if (!nombre) return null;
  const q = normalizar(nombre);
  const idx = titulosIndexados();
  for (const it of idx) if (it.clave === q) return it;
  for (const it of idx) if (it.clave.length >= 6 && (it.clave.includes(q) || q.includes(it.clave))) return it;
  let mejor = null, mejorScore = 0;
  const tokensQ = q.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
  for (const it of idx) {
    const tokens = it.clave.split(' ').filter(w => w.length > 2 && !STOPWORDS.has(w));
    let hits = 0;
    for (const tk of tokens) if (tokensQ.includes(tk)) hits++;
    const score = tokens.length ? hits / tokens.length : 0;
    if (score > mejorScore) { mejor = it; mejorScore = score; }
  }
  return mejorScore >= 0.5 ? mejor : null;
}

// =======================================================
// Bloque de precio oficial para inyectar al prompt de Diana
// =======================================================
function nombrePrograma(it) {
  if (!it) return '';
  if (it.tipo === 'maestria') return it.ref.titulo;
  if (it.tipo === 'grado') return it.ref.carrera;
  return it.ref.carrera;
}

function inicioTexto(inicio) {
  if (!inicio) return null;
  if (inicio.fecha) return inicio.pasada ? null : fechaCorta(inicio.fecha);
  if (inicio.texto && !/revis/i.test(inicio.texto)) return inicio.texto;
  return null;
}

function bloquePrecioPrompt(it) {
  if (!it) return '';
  const p = cargarPrecios();
  const nombre = nombrePrograma(it);
  const lineas = [`[BLOQUE DE PRECIO OFICIAL — MATRIZ DE VALORES UBE VIGENTE. Usa EXACTAMENTE estas cifras; PROHIBIDO inventar o aproximar valores para este programa.]`];

  if (it.tipo === 'maestria') {
    const m = it.ref;
    if (m.estado === 'en_revision') {
      lineas.push(`Programa: ${nombre}. ESTADO EN LA MATRIZ: malla EN REVISIÓN por la universidad (próximamente). NO des fechas ni inversiones; preséntalo como "está por abrir, la universidad está terminando de publicar su malla" y ofrece avisarle apenas se confirme.`);
      return lineas.join('\n');
    }
    if (m.sin_precio || !m.cuota) {
      lineas.push(`Programa: ${nombre}. La matriz vigente NO registra inversión publicada: presenta el programa, habla de facilidades de pago y ofrece que el equipo comercial confirme la inversión exacta hoy mismo. NO inventes cifras.`);
      return lineas.join('\n');
    }
    lineas.push(`Programa: ${nombre} (${m.modalidad || 'ONLINE'}, ${m.duracion || '12 meses'}).`);
    lineas.push(`Matrícula: ${money(m.matricula)} · Arancel: ${m.num_cuotas || 12} cuotas de ${money(m.cuota)} (total arancel ${money(m.total_cuotas)}) · Inversión total: ${money(m.inversion_total)} (matrícula + arancel).`);
    if (m.pago_contado) lineas.push(`Pago al contado: ${money(m.pago_contado)} (incluye 5% de descuento sobre el arancel).`);
    if (m.cuota_18) lineas.push(`Alternativa de financiamiento: 18 cuotas de ~${money(m.cuota_18)} (misma inversión total).`);
    const ini = inicioTexto(m.inicio);
    lineas.push(ini
      ? `Próximo inicio confirmado: ${ini}${m.horario ? ' · Horario: ' + m.horario : ''}${m.paralelo ? ' · Paralelo ' + m.paralelo : ''}.`
      : `Fecha de inicio: por confirmar (el calendario se actualiza cada mes; no inventes fecha).`);
    if (m.convenio && /promoc/i.test(m.convenio)) lineas.push(`Promoción aplicable: ${m.convenio}.`);
  } else if (it.tipo === 'grado') {
    const g = it.ref;
    const reglas = p.reglas_comerciales || {};
    lineas.push(`Programa: ${nombre} (${g.modalidad || ''}, ${g.periodos || 8} periodos).`);
    const cuota = g.cuota_normal, promo = g.cuota_promocional || g.pronto_pago;
    if (cuota) lineas.push(`Cuota mensual: ${money(cuota)}${promo ? ` · Cuota con pronto pago/promocional: ${money(promo)}` : ''}.`);
    if (g.matricula) lineas.push(`Matrícula: ${money(g.matricula)} (se cancela por cada semestre, hasta 72 h antes del inicio).`);
    if (g.pre) lineas.push(`Nivelación PRE: ${money(g.pre)} (6 semanas; se cancela hasta el primer día de clases).`);
    if (g.inversion_total) lineas.push(`Inversión total estimada de la carrera: ${money(g.inversion_total)}.`);
    lineas.push(`Inscripción para separar cupo: ${money(g.inscripcion || reglas.inscripcion_grado || 100)}.`);
    if (g.inversion_total_desc) lineas.push(`Inversión total con descuento por pago anticipado (10% carrera completa): ${money(g.inversion_total_desc)}.`);
    lineas.push(`Nota: los módulos de inglés de carreras regulares tienen valor de ${money((p.ingles && p.ingles.valor_por_modulo) || 110)} por módulo (${(p.ingles && p.ingles.modulos_por_carrera) || 7} módulos). Menciona este valor solo si preguntan por inglés.`);
  } else {
    const pe = it.ref;
    lineas.push(`Programa especial de validación: ${nombre} (${pe.modalidad || 'ONLINE'}, ${pe.duracion || ''}).`);
    if (pe.dirigido_a) lineas.push(`Dirigido a: ${pe.dirigido_a}.`);
    if (pe.cuota) lineas.push(`Arancel: ${money(pe.num_cuotas)} cuotas de ${money(pe.cuota)} (total ${money(pe.total_arancel)}).`);
    if (pe.matricula) lineas.push(`Matrícula: ${money(pe.matricula)}.`);
    if (pe.inversion_graduados) lineas.push(`Graduados UBE/ITB tienen inversión diferenciada (${money(pe.inversion_graduados)}${pe.inversion_graduados_itb ? ' / ITB ' + money(pe.inversion_graduados_itb) : ''}).`);
  }
  return lineas.join('\n');
}

// =======================================================
// Menús interactivos (botones / listas)
// =======================================================
// v4: áreas CORTAS y reales del catálogo (para botones/listas)
const AREAS_MAESTRIAS = ['Educación', 'Administración y Negocios', 'Derecho y Gobernanza', 'Ingeniería y Tecnología', 'Salud y Bienestar'];

function areasConConteo() {
  const p = cargarPrecios();
  const conteo = {};
  for (const m of (p.maestrias || [])) {
    if (m.estado === 'en_revision') continue; // no se ofrecen hasta que la universidad las publique
    const a = m.area || 'Administración y Negocios';
    conteo[a] = (conteo[a] || 0) + 1;
  }
  return AREAS_MAESTRIAS.map(a => ({ area: a, total: conteo[a] || 0 })).filter(x => x.total > 0);
}

function totalMaestrias() {
  const p = cargarPrecios();
  return (p.maestrias || []).filter(m => m.estado !== 'en_revision').length;
}

/**
 * v4: ¿El aspirante pide maestrías SIN especificar área ni programa?
 * Ej.: "quiero una maestría", "qué maestrías tienen", "info de posgrado".
 * → Diana envía los BOTONES/LISTA de áreas (Educación, Administración…)
 * Si ya mencionó un programa concreto o un área, responde el flujo normal.
 */
function pideMaestriasSinArea(texto) {
  const t = normalizar(texto);
  if (!t || !/maestrias?\b|posgrado/.test(t)) return false;
  if (detectarProgramaEnTexto(texto)) return false;               // ya nombró un programa
  if (AREAS_MAESTRIAS.some(a => t.includes(normalizar(a)))) return false; // ya nombró un área
  return true;
}

/**
 * v5 (auditoría): TEXTO ÚNICO del paso 1 del catálogo (áreas).
 * Antes server.js tenía DOS bloques casi idénticos (catalogo-paso1 y
 * areas-flujo-libre) con textos ligeramente distintos → respuestas
 * inconsistentes. Ahora un solo texto canónico para ambos flujos.
 */
function respuestaAreas(origen = 'peticion') {
  const areas = areasConConteo();
  const texto = `¡Con gusto! 📚 Nuestras maestrías oficiales SENESCYT son ${totalMaestrias()}, 100% online (12 meses, 5 h/semana), agrupadas en ${areas.length} áreas:

${areas.map(a => `• ${a.area} (${a.total})`).join('\n')}

¿Cuál área te gustaría explorar para pasarte las opciones exactas? 😊`;
  return {
    texto,
    modeloUsado: 'catalogo-paso1',
    proveedor: 'menu-local',
    lista: { titulo: 'Explorar área', filas: areas.map(a => ({ id: `area:${a.area}`, titulo: a.area, desc: `${a.total} programas disponibles` })) }
  };
}

/**
 * v5 (auditoría): desglose de UN área elegida en texto libre o por botón.
 * Reutiliza resolverBoton('area:X') (dedup de paralelos + "…y N más"),
 * evitando la copia desincronizada que había en server.js.
 */
function respuestaAreaElegida(area) {
  return resolverBoton(`area:${String(area || '').trim()}`);
}

/** ¿El texto pide ver el catálogo/desglose de una área ya registrada? */
function pideDesgloseDeArea(texto) {
  const t = normalizar(texto);
  if (!t) return false;
  if (detectarProgramaEnTexto(texto)) return false; // ya nombró programa concreto
  return AREAS_MAESTRIAS.some(a => t.includes(normalizar(a)));
}

/** Primer contacto: saludo + pedir nombre + ofrecer GRADO y MAESTRÍAS desde el inicio. */
function saludoPrimerContacto(pushName = '') {
  const nombre = (pushName || '').trim();
  const saludo = nombre
    ? `¡Hola, ${nombre.split(' ')[0]}! 👋 Qué gusto saludarte. Soy Diana, asesora de admisiones de la UBE 🎓`
    : `¡Hola! 👋 Qué gusto saludarte. Soy Diana, asesora de admisiones de la UBE 🎓`;
  const texto = `${saludo}\n\n¿Con quién tengo el gusto? Pásame tu nombre 😊\n\nY cuéntame qué buscas: tengo carreras de GRADO y MAESTRÍAS online oficiales (además de programas de validación para quienes trabajan). Elige una opción o escríbeme directo lo que te interesa 🙌`;
  return {
    texto,
    lista: {
      titulo: '¿Qué te interesa?',
      filas: [
        { id: 'menu_grado', titulo: '🎓 Carreras de Grado', desc: '4 años · online nocturno, presencial e híbrida' },
        { id: 'menu_maestrias', titulo: '📚 Maestrías Online', desc: '12 meses · 5 h/semana · SENESCYT' },
        { id: 'menu_validacion', titulo: '📋 Programas de Validación', desc: 'Título con tu experiencia laboral' },
        { id: 'menu_asesor', titulo: '👨‍💼 Hablar con un asesor', desc: 'Te llamamos en un horario que elijas' }
      ]
    },
    modeloUsado: 'saludo-primer-contacto'
  };
}

function resolverBoton(id, opciones = {}) {
  const limpio = String(id || '').trim();
  const slots = opciones.slots || ['Mañana 09:30 am', 'Mañana 11:15 am', 'Mañana 02:30 pm'];

  if (limpio === 'menu_grado') {
    return {
      texto: '¡Excelente! 👨‍🎓 Nuestras carreras de GRADO (título oficial, 8 periodos):\n\n• Online nocturno: Derecho, Psicología, Administración, Economía, Contabilidad y Finanzas, Comunicación, Educación, Sistemas Inteligentes, IA y Ciberseguridad y más\n• Presenciales (Durán/Quito): Odontología, Enfermería, Fisioterapia, Biomedicina, Derecho, Automotriz\n• Híbrida: Ingeniería Eléctrica\n\n¿Cuál te llama la atención? Y para darte la cuota exacta de tu ciclo: ¿con quién tengo el gusto y desde qué ciudad me escribes? 📍',
      modeloUsado: 'menu-grado'
    };
  }

  if (limpio === 'menu_maestrias') {
    const n = totalMaestrias();
    const areas = areasConConteo();
    const resumen = areas.map(a => `• ${a.area} (${a.total})`).join('\n');
    return {
      texto: `¡Qué bien! 📚 Tenemos ${n} maestrías oficiales SENESCYT, 100% online (12 meses, 5 h/semana), en ${areas.length} áreas:\n\n${resumen}\n\n¿Cuál área exploramos primero? 😊`,
      lista: {
        titulo: 'Áreas de maestrías',
        filas: areas.map(a => ({ id: `area:${a.area}`, titulo: a.area, desc: `${a.total} programas disponibles` }))
      },
      modeloUsado: 'menu-maestrias-areas'
    };
  }

  if (limpio === 'menu_validacion') {
    return {
      texto: '¡Con gusto! 📋 Si tienes experiencia laboral comprobable (mínimo 4 años) puedes titulararte con nuestros programas de validación: Licenciatura en Educación (12-15 meses), Educación Inicial, Pedagogía de los Idiomas, Seguridad y Salud Ocupacional, Ingeniería en Tráfico, Eléctrica, Biomedicina, Administración, Contabilidad, Enfermería y Fisioterapia.\n\nCuéntame: ¿cuál es tu profesión o a qué te dedicas? Así te digo exactamente cuál programa te aplica 😊',
      modeloUsado: 'menu-validacion'
    };
  }

  if (limpio === 'menu_asesor') {
    return {
      texto: `¡Claro que sí! 📅 Para coordinar tu llamada con un asesor de admisiones, elige el horario que te quede mejor (todos con hora exacta):`,
      botones: slots.slice(0, 3).map(s => ({ id: `llamada:${s}`, label: s })),
      modeloUsado: 'menu-asesor-slots'
    };
  }

  if (limpio.startsWith('llamada:')) {
    const horario = limpio.replace(/^llamada:/, '').trim();
    return {
      texto: `¡Excelente! 🙌 Queda agendada tu llamada con un asesor de admisiones para las **${horario}**. Te marcarán puntualmente a este número.\n\n¿Con quién tengo el gusto? Así dejo tu llamada a nombre tuyo 😊`,
      accion: 'agendar_llamada',
      horario,
      modeloUsado: 'menu-llamada-confirmada'
    };
  }

  if (limpio.startsWith('area:')) {
    const area = limpio.replace(/^area:/, '').trim();
    const p = cargarPrecios();
    const deArea = (p.maestrias || []).filter(m => (m.area || '').toLowerCase() === area.toLowerCase() && m.estado !== 'en_revision');
    if (!deArea.length) {
      // v4: si el área solo tiene programas en revisión, no romper la conversación
      const enRev = (p.maestrias || []).filter(m => (m.area || '').toLowerCase() === area.toLowerCase() && m.estado === 'en_revision');
      if (!enRev.length) return null;
      return {
        texto: `En **${area}** tenemos ${enRev.length} programa(s) nuevos que la universidad está terminando de publicar (malla en revisión) 📋. ¿Quieres que te avise apenas se abran las inscripciones? Mientras tanto, ¿te muestro otra área?`,
        modeloUsado: 'menu-area-en-revision'
      };
    }
    // v4: deduplicar programas con varios paralelos (misma maestría) → mostrar 1 con la fecha más próxima
    const unicos = [];
    const vistos = new Set();
    for (const m of deArea) {
      const k = normalizar(m.titulo);
      if (vistos.has(k)) {
        const prev = unicos.find(u => normalizar(u.titulo) === k);
        if (prev && m.inicio?.fecha && (!prev.inicio?.fecha || m.inicio.fecha < prev.inicio.fecha)) {
          unicos.splice(unicos.indexOf(prev), 1, m);
        }
        continue;
      }
      vistos.add(k);
      unicos.push(m);
    }
    // WhatsApp permite máx. 10 filas por lista: recortar con "+N más"
    const visibles = unicos.slice(0, 10);
    const restantes = unicos.length - visibles.length;
    const nombres = visibles
      .map(m => `• ${capitalizarNombre(m.titulo.replace(/^Maestría (en|de) /i, ''))}${unicos.length <= 8 && m.inicio && m.inicio.fecha && !m.inicio.pasada ? ` (inicio ${fechaCorta(m.inicio.fecha)})` : ''}`)
      .join('\n');
    const extra = restantes > 0 ? `\n…y ${restantes} más del área 😊` : '';
    return {
      texto: `¡Excelente elección! En el área de **${area}** contamos con ${unicos.length} maestrías oficiales SENESCYT (12 meses, 100% online):\n\n${nombres}${extra}\n\n¿Cuál llama más tu atención para darte la inversión y la cuota exacta? 🎓`,
      modeloUsado: 'menu-area-listado'
    };
  }

  return null;
}

/** Texto neutro para el extractor CRM cuando el usuario responde con un botón. */
function textoExtractorDeBoton(id) {
  const limpio = String(id || '').trim();
  if (limpio === 'menu_grado') return 'El aspirante eligió la opción: carreras de grado';
  if (limpio === 'menu_maestrias') return 'El aspirante eligió la opción: maestrías online';
  if (limpio === 'menu_validacion') return 'El aspirante eligió la opción: programas de validación por experiencia laboral';
  if (limpio === 'menu_asesor') return 'El aspirante eligió la opción: hablar con un asesor por llamada';
  if (limpio.startsWith('area:')) return `El aspirante eligió el área de maestrías: ${limpio.replace(/^area:/, '').trim()}`;
  if (limpio.startsWith('llamada:')) return `El aspirante eligió el horario de llamada: ${limpio.replace(/^llamada:/, '').trim()}`;
  return 'El aspirante respondió con un botón del menú';
}

/**
 * Parseo de respuestas de botones/listas en webhooks Evolution API.
 * Devuelve texto "boton: <id>" o el texto elegido, o null si no es botón.
 */
function textoDeMensajeEvolution(message = {}) {
  const btn = message.buttonsResponseMessage;
  if (btn) {
    const id = btn.selectedButtonId || '';
    const texto = btn.selectedDisplayText || '';
    return id ? `boton: ${id}` : (texto ? `boton: texto:${texto}` : null);
  }
  const list = message.listResponseMessage;
  if (list) {
    const id = list.singleSelectReply?.selectedRowId || '';
    const texto = list.title || '';
    return id ? `boton: ${id}` : (texto ? `boton: texto:${texto}` : null);
  }
  // Compatibilidad: template / interactive por texto plano
  const inter = message.interactiveResponseMessage;
  if (inter?.nativeFlowResponseMessage) {
    try {
      const params = JSON.parse(inter.nativeFlowResponseMessage.paramsJson || '{}');
      if (params.flow_token || params.selected) return `boton: ${params.selected || params.flow_token}`;
    } catch (e) { /* ignorar */ }
  }
  return null;
}

/** ¿El primer mensaje es un saludo genérico (sin programa específico)? */
function esSaludoGenerico(texto) {
  const t = normalizar(texto);
  if (!t) return true;
  if (detectarProgramaEnTexto(texto)) return false;
  // mención suelta de una palabra distintiva de programa (psicología, derecho, odontología…)
  // → no es saludo genérico: Diana responde directo
  if (detectarPalabraPrograma(texto)) return false;
  return t.length <= 42 || /^(hola|holi|holaa+|buenas|buenos dias|buenas tardes|buenas noches|buen dia|hey|hello|hi|que tal|saludos|informacion|info|quisiera informacion|buenas informacion)\b/.test(t);
}

/** Detecta una palabra distintiva de alguna carrera/maestría (1 solo token basta). */
function detectarPalabraPrograma(texto) {
  const tokensTexto = new Set(normalizar(texto).split(' '));
  if (!tokensTexto.size) return false;
  const idx = titulosIndexados();
  for (const it of idx) {
    for (const tk of it.clave.split(' ')) {
      if (tk.length >= 5 && !STOPWORDS.has(tk) && tokensTexto.has(tk)) return true;
    }
  }
  return false;
}

/** Capitalización amable para listados ("EDUCACIÓN BÁSICA" → "Educación Básica"). */
function capitalizarNombre(t) {
  const MIN = new Set(['en', 'de', 'la', 'el', 'y', 'del', 'con', 'para', 'los', 'las']);
  return String(t || '').toLowerCase().split(/\s+/).map((w, i) => {
    if (i > 0 && MIN.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

module.exports = {
  cargarPrecios,
  normalizar,
  money,
  fechaCorta,
  detectarProgramaEnTexto,
  buscarPrograma,
  nombrePrograma,
  bloquePrecioPrompt,
  areasConConteo,
  totalMaestrias,
  pideMaestriasSinArea,
  respuestaAreas,
  respuestaAreaElegida,
  pideDesgloseDeArea,
  saludoPrimerContacto,
  resolverBoton,
  textoExtractorDeBoton,
  textoDeMensajeEvolution,
  esSaludoGenerico,
  detectarPalabraPrograma,
  capitalizarNombre,
  AREAS_MAESTRIAS
};
