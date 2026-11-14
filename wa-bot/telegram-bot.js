/**
 * telegram-bot.js — Bot de Telegram oficial para Diana / UBE
 * 
 * Permite a los usuarios y directivos:
 * 1. Consultar información completa y profunda de carreras y maestrías (costos, fechas, materias, perfil, campo laboral).
 * 2. Solicitar trípticos oficiales y recibirlos directamente como archivo PDF adjunto en Telegram.
 * 3. Interactuar tanto en chat privado (1 a 1) como en grupos de Telegram con la personalidad y conocimiento de Diana.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const { buscarTriptico } = require('./pdf-service');
const menuService = require('./menu-service');
const dianaRouter = require('./diana-router');
const memoria = require('./memoria');
const HybridAIProvider = require('./ai-provider');

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
if (!TELEGRAM_TOKEN) {
  console.error('[Telegram] ERROR: TELEGRAM_BOT_TOKEN no configurado en .env');
}
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const aiProvider = new HybridAIProvider();

// Cargar catálogo enriquecido con perfiles y campos ocupacionales
let catalogoWeb = [];
try {
  const rutaCat = path.join(__dirname, 'data', 'ube_catalogo_web_con_perfiles.json');
  if (fs.existsSync(rutaCat)) {
    catalogoWeb = JSON.parse(fs.readFileSync(rutaCat, 'utf8'));
  }
} catch (e) {
  console.warn('[Telegram] Error cargando ube_catalogo_web_con_perfiles.json:', e.message);
}

let botUsername = 'assistantUBE_bot';
let offset = 0;
let isPolling = false;

// Memoria de conversación por chat (para retener carrera consultada en turnos siguientes)
const estadosChat = new Map();

function obtenerEstadoChat(chatId) {
  if (!estadosChat.has(chatId)) {
    estadosChat.set(chatId, {
      programa: null,
      tripticoPdf: null,
      fichaWeb: null,
      nombreDetectado: '',
      historial: [],
      ultimoReporteTs: null
    });
  }
  return estadosChat.get(chatId);
}

function guardarEstadoChat(chatId, parche = {}) {
  const actual = obtenerEstadoChat(chatId);
  Object.assign(actual, parche);
  estadosChat.set(chatId, actual);
}

// Buscar ficha en el catálogo web
function buscarFichaWeb(nombre) {
  if (!nombre || !catalogoWeb.length) return null;
  const q = menuService.normalizar(nombre);
  // Coincidencia exacta
  let hit = catalogoWeb.find(c => menuService.normalizar(c.titulo || c.carrera || '') === q);
  if (hit) return hit;
  // Substring
  hit = catalogoWeb.find(c => {
    const norm = menuService.normalizar(c.titulo || c.carrera || '');
    return norm.includes(q) || q.includes(norm);
  });
  if (hit) return hit;
  // Por palabras clave
  const tokensQ = q.split(' ').filter(w => w.length > 2);
  let best = null, maxH = 0;
  for (const c of catalogoWeb) {
    const norm = menuService.normalizar(c.titulo || c.carrera || '');
    let h = 0;
    for (const tk of tokensQ) if (norm.includes(tk)) h++;
    if (h > maxH && h >= 2) {
      maxH = h;
      best = c;
    }
  }
  return best;
}

// Enviar mensaje de texto
async function sendTextMessage(chatId, text, replyToId = null) {
  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    };
    if (replyToId) payload.reply_to_message_id = replyToId;

    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) {
      // Fallback sin Markdown si Telegram rechaza caracteres especiales
      payload.parse_mode = undefined;
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    return data;
  } catch (err) {
    console.error(`[Telegram] Error enviando mensaje a ${chatId}:`, err.message);
  }
}

// Enviar indicador "Escribiendo..." o "Enviando documento..."
async function sendChatAction(chatId, action = 'typing') {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action })
    });
  } catch (_) {}
}

// Enviar documento (PDF, CSV, JSON) directo al chat
async function sendPdfDocument(chatId, filePath, caption = '', replyToId = null) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Telegram] Archivo no existe: ${filePath}`);
      return false;
    }

    sendChatAction(chatId, 'upload_document').catch(() => {});

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === '.pdf') mimeType = 'application/pdf';
    else if (ext === '.csv') mimeType = 'text/csv';
    else if (ext === '.json' || ext === '.jsonl') mimeType = 'application/json';

    const blob = new Blob([fileBuffer], { type: mimeType });

    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', blob, fileName);
    if (caption) form.append('caption', caption);
    if (replyToId) form.append('reply_to_message_id', replyToId);

    console.log(`[Telegram] Enviando documento '${fileName}' a chat ${chatId}...`);
    const res = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    if (data.ok) {
      console.log(`[Telegram] ✅ Documento '${fileName}' entregado exitosamente a ${chatId}`);
      return true;
    } else {
      console.error(`[Telegram] ❌ Error en sendDocument:`, data);
      return false;
    }
  } catch (err) {
    console.error(`[Telegram] Error enviando documento a ${chatId}:`, err.message);
    return false;
  }
}

// Generación y exportación de reportes automáticos CSV para asesores y directivos
const crypto = require('crypto');
const PANEL_PIN = String(process.env.PANEL_PIN || '052020');
const TOKEN_PANEL = crypto.createHmac('sha256', PANEL_PIN).update('whaspiube-panel-v52').digest('hex');

async function obtenerReporteLeadsCSV(filtros = {}) {
  try {
    const q = new URLSearchParams();
    if (typeof filtros === 'number') {
      q.set('dias', filtros);
    } else if (typeof filtros === 'object' && filtros !== null) {
      if (filtros.dias) q.set('dias', filtros.dias);
      if (filtros.desdeTs) q.set('desdeTs', filtros.desdeTs);
      if (filtros.carrera) q.set('carrera', filtros.carrera);
      if (filtros.etapa) q.set('etapa', filtros.etapa);
      if (filtros.origen) q.set('origen', filtros.origen);
    }
    q.set('token', TOKEN_PANEL);

    const res = await fetch(`http://127.0.0.1:3000/api/export.csv?${q.toString()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const totalRowsHeader = res.headers.get('x-total-rows');
    const totalRegistros = totalRowsHeader !== null ? parseInt(totalRowsHeader, 10) : 0;

    const csvData = await res.text();
    const tempDir = path.join(__dirname, 'data', 'reportes');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const fechaTag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const prefijo = filtros.carrera ? `prospectos_${filtros.carrera.replace(/[^a-zA-Z0-9]/g, '_')}` : (filtros.desdeTs ? 'prospectos_nuevos' : `prospectos_${filtros.dias || 7}dias`);
    const fileName = `${prefijo}_${fechaTag}.csv`;
    const filePath = path.join(tempDir, fileName);
    fs.writeFileSync(filePath, csvData, 'utf8');

    return { filePath, totalRegistros, fileName };
  } catch (err) {
    console.error('[Telegram] Error obteniendo reporte CSV:', err.message);
    return null;
  }
}

function analizarSolicitudReporte(cleanText, ultimoTs = null) {
  const norm = cleanText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Detección de intención de reporte / prospectos
  const esComandoReporte = /^\/reporte\b/i.test(norm);
  const pideProspectos = /(?:prospecto|cliente|aspirante|lead|base\s+de\s+datos|quienes\s+(?:escribieron|entraron|contactaron)|los\s+que\s+(?:desean|quieren|entraron|escribieron|solicitaron))/i.test(norm);
  const pideReporteExpl = /(?:p[aá]same|dame|enviame|descargar|generar|sacar|exportar)\s+(?:el\s+)?reporte/i.test(norm);

  if (!esComandoReporte && !pideProspectos && !pideReporteExpl) {
    return null;
  }

  let incremental = false;
  let desdeTs = null;
  let dias = null;
  let carrera = null;

  // 1. ¿Incremental? (luego de la última solicitud / desde la última vez / nuevos)
  if (/(?:luego|despues|desde)\s+(?:de\s+)?(?:la\s+)?(?:[uú]ltima|reciente)\s+(?:solicitud|vez|consulta|peticion|entrega|reporte)|nuevos?\s+desde/i.test(norm)) {
    incremental = true;
    desdeTs = ultimoTs; // Puede ser null si es la primera vez
  }

  // 2. Días específicos
  const matchDias = norm.match(/(?:[uú]ltimos?|hace)?\s*(\d+)\s*d[ií]as?/i);
  if (matchDias) {
    dias = parseInt(matchDias[1], 10);
  } else if (/\bhoy\b/i.test(norm) || /\b24\s*h(?:oras)?\b/i.test(norm)) {
    dias = 1;
  } else if (/\bayer\b/i.test(norm) || /\b48\s*h(?:oras)?\b/i.test(norm)) {
    dias = 2;
  } else if (/\bsemana\b/i.test(norm) || /\b7\s*d\b/i.test(norm)) {
    dias = 7;
  } else if (/\bmes\b/i.test(norm) || /\b30\s*d\b/i.test(norm)) {
    dias = 30;
  }

  // 3. Carrera o área disciplinar
  const matchCarrera = norm.match(/(?:estudiar|carreras?\s+(?:de\s+)?|area\s+de\s+|interesados?\s+en\s+)\s*([a-z0-9\s]+?)(?:\s+(?:de\s+los?|en\s+los?|desde|luego|$)|$)/i)
    || norm.match(/(?:para|de|en)\s+(educacion|derecho|psicologia|enfermeria|salud|sistemas|medicina|odontologia|administracion|contabilidad|criminologia|comunicacion|arquitectura|turismo|software|bim)/i);

  if (matchCarrera) {
    let c = matchCarrera[1].trim();
    c = c.replace(/^(las?\s+|los?\s+|el\s+)/, '');
    c = c.replace(/\b(carrera|carreras|maestria|maestrias|programa|programas)\b/g, '').trim();
    if (c.length >= 3 && !/^(hoy|ayer|dias|semana|mes|todos|nuevos|ultimos)$/i.test(c)) {
      carrera = c;
    }
  }

  if (!dias && !incremental) {
    dias = carrera ? 60 : 1;
  }

  return { incremental, dias, desdeTs, carrera };
}

function obtenerReporteSimulacionesCSV() {
  const rutaSim = path.join(__dirname, 'data', 'auditoria', 'historial_simulaciones_completo.csv');
  if (fs.existsSync(rutaSim)) return rutaSim;
  const rutaAlt = path.join(__dirname, 'data', 'auditoria', 'historial_simulaciones.csv');
  if (fs.existsSync(rutaAlt)) return rutaAlt;
  return null;
}

function obtenerReporteSimulacionesJSONL() {
  const rutaSim = path.join(__dirname, 'data', 'auditoria', 'historial_simulaciones_completo.jsonl');
  if (fs.existsSync(rutaSim)) return rutaSim;
  const rutaAlt = path.join(__dirname, 'data', 'auditoria', 'simulaciones_archivadas.jsonl');
  if (fs.existsSync(rutaAlt)) return rutaAlt;
  return null;
}

// Generar respuesta rica y bien redactada con Diana AI siguiendo el esquema oficial de WhatsApp para asesores
async function generarRespuestaDiana(userQuery, programa, fichaWeb, historialPrevio = []) {
  const bloquePrecio = menuService.bloquePrecioPrompt(programa);
  const nombreProg = menuService.nombrePrograma(programa);

  const perfilProf = fichaWeb?.perfil_profesional || fichaWeb?.perfil_egreso || '';
  const campoOcup = fichaWeb?.ocupaciones_profesionales || fichaWeb?.campo_ocupacional || '';
  const reqAdm = fichaWeb?.requisitos_admision || '';
  const malla = fichaWeb?.malla_curricular || [];

  const systemPrompt = `Eres Diana, asesora oficial de admisiones de la Universidad Bolivariana del Ecuador (UBE) 🎓.
Estás respondiendo a un asesor de admisiones en Telegram que solicita información ampliada sobre: "${nombreProg}".
Este mensaje será enviado directamente por el asesor a un prospecto interesado por WhatsApp, por lo que debe ser completo, explicativo, motivador y con formato nativo de WhatsApp.

ESTRUCTURA OBLIGATORIA (DEBES SEGUIR EXACTAMENTE ESTAS SECCIONES Y FORMATO WHATSAPP):
- Usa negritas con un solo asterisco: *texto en negrita* (formato oficial WhatsApp).
- Usa guiones para viñetas: - 
- Usa emojis estratégicos en títulos y áreas de desempeño.
- NO USES TABLAS ni formato Markdown ** (doble asterisco).
- Los datos económicos y académicos deben provenir RIGUROSAMENTE de la MATRIZ OFICIAL UBE y los datos institucionales provistos. Prohibido inventar cifras, duraciones irreales o becas no sustentadas.

ESQUEMA CANÓNICO A GENERAR:

¡Hola! 😊

Soy *Diana*, asesora de admisiones de la *Universidad Bolivariana del Ecuador (UBE)*.

¡Me alegra mucho saber que estás interesado/a en estudiar *${nombreProg}*! [Emoji de la disciplina] A continuación, te comparto información sobre el programa, su formación académica, inversión y oportunidades profesionales.

🎓 *${nombreProg.toUpperCase()} – UBE*

📚 *Información del programa*
- *Modalidad:* [Modalidad oficial: Online / Presencial / Híbrida].
- *Duración:* [Duración oficial: ej. 12 meses (1 año) en maestrías / 4 años (8 a 10 períodos) en grado].
- *Formación:* [Explicación clara del enfoque formativo y qué ofrece el programa].

📖 *¿QUÉ APRENDERÁS?*

Durante tu formación académica desarrollarás conocimientos y habilidades en diferentes áreas clave:
- *[Área/Eje 1]:* [Descripción concreta de conocimientos o asignaturas clave].
- *[Área/Eje 2]:* [Descripción concreta].
- *[Área/Eje 3]:* [Descripción concreta].
- *[Área/Eje 4]:* [Descripción concreta].
- *[Área/Eje 5]:* [Descripción concreta].

💰 *INVERSIÓN Y COSTOS*
[Desglosar EXACTAMENTE los valores oficiales de la MATRIZ DE PRECIOS oficial adjunta. Si es grado: inscripción, matrícula semestral, mensualidad regular, mensualidad pronto pago y total. Si es maestría: matrícula, cuotas de arancel, total y pago de contado.]:
${bloquePrecio}

🎁 *BENEFICIOS Y FORMAS DE PAGO*
- *Beneficio institucional:* Descuento por pronto pago y arancel congelado durante toda tu formación académica.
- *Financiamiento directo:* Crédito educativo directo con la UBE sin intereses bancarios.
- *Facilidades de pago:* Pagos diferidos de 3 a 24 meses sin intereses con las principales tarjetas del país o descuento por pago al contado.

📅 *INICIO DE CLASES*
La próxima convocatoria contempla como fecha de referencia: *[Fecha oficial de inicio o cohorte mensual]*.
- *Horario de clases:* [Horario oficial nocturno / fines de semana / flexible online].
Te recomendamos confirmar la fecha definitiva con nuestro equipo de admisiones.

🚀 *CAMPO LABORAL*
Al culminar tu formación y cumplir los requisitos legales para el ejercicio profesional, podrás desarrollar tu carrera en diferentes ámbitos:
- [Emoji área 1] *[Área/Sector 1]:* [Puestos específicos o empresas].
- [Emoji área 2] *[Área/Sector 2]:* [Puestos específicos o empresas].
- 🎓 *Docencia e investigación:* Formación académica y proyectos de investigación científica.
- 🚀 *Consultoría y libre ejercicio:* Asesoría especializada y práctica profesional independiente.

📄 *¿DESEAS CONOCER MÁS SOBRE LA CARRERA?*
Podemos compartir contigo el *tríptico informativo de ${nombreProg}*, que contiene información más detallada sobre el programa académico, plan de estudios, requisitos y proceso de admisión.

También podemos orientarte personalmente sobre los costos, beneficios y pasos para iniciar tu proceso de inscripción.

*¿Te gustaría que te compartamos el tríptico informativo en PDF?* 😊

¡Será un gusto acompañarte en el camino hacia tu formación profesional!

*Diana*
Asesora de Admisiones
Universidad Bolivariana del Ecuador (UBE)

DATOS INSTITUCIONALES OFICIALES DE APOYO:
• Perfil Profesional: ${perfilProf || 'Formación de competencias profesionales de vanguardia y visión integral.'}
• Campo Ocupacional y Puestos: ${campoOcup || 'Sector público y privado, ejercicio independiente, asesoría y docencia.'}
• Requisitos: ${reqAdm || 'Cédula, papeleta de votación y título registrado correspondiente.'}
• Malla curricular: ${Array.isArray(malla) && malla.length ? malla.slice(0, 10).join(', ') : 'Asignaturas de especialización profesional'}`;

  const mensajesPrompt = [
    ...historialPrevio.slice(-4),
    { role: 'user', content: userQuery }
  ];

  try {
    const resAi = await aiProvider.generarRespuesta(systemPrompt, mensajesPrompt);
    let texto = typeof resAi === 'string' ? resAi : (resAi?.texto || '');
    if (texto && texto.length > 250 && (texto.includes('Información del programa') || texto.includes('INVERSIÓN'))) {
      // Normalizar posibles negritas dobles ** a negrita WhatsApp simple *
      texto = texto.replace(/\*\*([^*]+)\*\*/g, '*$1*');
      return texto;
    }
  } catch (err) {
    console.warn('[Telegram] AI Provider falló, usando generador estructurado:', err.message);
  }

  // Generador de respaldo determinista de alta fidelidad si la IA fallara
  return generarRespaldoEstructurado(programa, fichaWeb);
}

// Plantilla de respaldo limpia y determinista con el esquema estándar de WhatsApp
function generarRespaldoEstructurado(programa, fichaWeb) {
  const m = programa.ref;
  const esMaestria = programa.tipo === 'maestria';
  const nombre = menuService.nombrePrograma(programa);
  const nombreMayus = nombre.toUpperCase();

  // Emojis según área disciplinar
  let emojiArea = '🎓';
  const normNom = menuService.normalizar(nombre);
  if (/salud|enferm|medic|odont|terapia|psicol|biomed/i.test(normNom)) emojiArea = '🩺';
  else if (/derecho|ley|jurid|crimin|penal/i.test(normNom)) emojiArea = '⚖️';
  else if (/educ|pedag|docen/i.test(normNom)) emojiArea = '📚';
  else if (/sistem|soft|bim|ingeni|tecnol|inteligen/i.test(normNom)) emojiArea = '💻';
  else if (/admin|gestion|finan|negoc|contab|market/i.test(normNom)) emojiArea = '💼';

  const modalidad = m.modalidad || fichaWeb?.modalidad || (esMaestria ? 'Online' : 'Online / Presencial');
  const duracion = m.duracion || (esMaestria ? '12 meses (1 año)' : (m.periodos ? `${m.periodos} períodos académicos (4 años)` : '8 a 10 períodos semestrales (4 años)'));

  // Enfoque formativo
  let formacion = fichaWeb?.perfil_profesional || fichaWeb?.perfil_egreso || '';
  if (formacion.length > 250) {
    formacion = formacion.slice(0, 247).trim() + '...';
  }
  if (!formacion) {
    formacion = `Preparación integral en ${nombre}, combinando sólidas bases científicas, herramientas tecnológicas de vanguardia y un enfoque orientado a la excelencia profesional y resolución de problemas reales.`;
  }

  // ¿Qué aprenderás?
  let ejesAprenderas = [];
  if (fichaWeb?.malla_curricular && Array.isArray(fichaWeb.malla_curricular) && fichaWeb.malla_curricular.length > 0) {
    ejesAprenderas = fichaWeb.malla_curricular.slice(0, 5).map(asig => `- *${asig.trim()}:* Formación especializada y aplicación práctica.`);
  } else if (fichaWeb?.perfil_profesional) {
    const oraciones = fichaWeb.perfil_profesional.split(/[.;]\s+/).filter(s => s.length > 20 && s.length < 120);
    if (oraciones.length >= 3) {
      ejesAprenderas = oraciones.slice(0, 5).map((o, i) => `- *Área formativa ${i + 1}:* ${o.trim()}.`);
    }
  }
  if (ejesAprenderas.length < 3) {
    if (esMaestria) {
      ejesAprenderas = [
        `- *Fundamentos avanzados:* Profundización conceptual y metodológica en ${nombre}.`,
        `- *Gestión estratégica:* Planificación, toma de decisiones y liderazgo en proyectos de alto nivel.`,
        `- *Herramientas e innovación:* Aplicación de tecnologías actuales y mejores prácticas del sector.`,
        `- *Investigación aplicada:* Metodología y desarrollo del proyecto de titulación en escenarios reales.`
      ];
    } else {
      ejesAprenderas = [
        `- *Ciencias y fundamentos básicos:* Conocimientos teóricos esenciales y bases científicas de la disciplina.`,
        `- *Habilidades prácticas y técnicas:* Manejo de herramientas, métodos y procedimientos del área.`,
        `- *Especialización profesional:* Diagnóstico, diseño y ejecución de soluciones especializadas.`,
        `- *Ética y responsabilidad social:* Deontología profesional y compromiso con la comunidad.`,
        `- *Prácticas preprofesionales:* Formación práctica supervisada en escenarios laborales reales.`
      ];
    }
  }

  // Desglose de Inversión oficial
  let costosTexto = '';
  if (esMaestria) {
    if (m.matricula) costosTexto += `- *Matrícula:* $${m.matricula} (pago único de matrícula).\n`;
    if (m.cuota) costosTexto += `- *Arancel:* ${m.num_cuotas || 12} cuotas de $${m.cuota} (Total arancel: $${m.total_cuotas || (m.cuota * (m.num_cuotas || 12))}).\n`;
    if (m.inversion_total) costosTexto += `- *Inversión total del programa:* $${m.inversion_total.toLocaleString('es-EC')}.\n`;
    if (m.pago_contado) costosTexto += `- *Pago al contado:* $${m.pago_contado.toLocaleString('es-EC')} (5% de descuento adicional por pago íntegro).\n`;
    if (m.cuota_18) costosTexto += `- *Alternativa financiada flexible:* 18 cuotas de ~$${Math.round(m.cuota_18)}.\n`;
  } else {
    if (m.inscripcion) costosTexto += `- *Inscripción:* $${m.inscripcion} (pago único para reservar tu cupo).\n`;
    if (m.matricula) costosTexto += `- *Matrícula:* $${m.matricula} por período académico.\n`;
    if (m.cuota_normal) costosTexto += `- *Mensualidad regular:* $${m.cuota_normal}.\n`;
    if (m.cuota_promocional || m.pronto_pago) {
      costosTexto += `- *Mensualidad con beneficio pronto pago:* $${m.cuota_promocional || m.pronto_pago} (arancel congelado durante toda tu carrera).\n`;
    }
    if (m.inversion_total) costosTexto += `- *Inversión total estimada:* $${m.inversion_total.toLocaleString('es-EC')}.\n`;
  }
  if (!costosTexto) {
    costosTexto = `- *Inversión oficial:* Valores vigentes sujetos a la cohorte actual. Solicita tu cotización personalizada con admisiones.\n`;
  }

  // Inicio y horario
  let inicioTexto = 'Próxima cohorte oficial';
  if (m.inicio && m.inicio.fecha && !m.inicio.pasada) {
    inicioTexto = m.inicio.fecha;
  }
  const horarioTexto = m.horario || (modalidad.toUpperCase().includes('ONLINE') ? '100% online flexible (con tutorías en vivo)' : 'Horario nocturno / fines de semana');

  // Campo laboral
  let campoLaboralTexto = '';
  if (fichaWeb?.ocupaciones_profesionales || fichaWeb?.campo_ocupacional) {
    const rawCampo = fichaWeb.ocupaciones_profesionales || fichaWeb.campo_ocupacional;
    const items = rawCampo.split(/[.;\n•]+/).map(s => s.trim()).filter(s => s.length > 10 && s.length < 100);
    if (items.length >= 2) {
      const iconos = ['🏢', '💼', '🔬', '🎓', '🏥', '🚀'];
      campoLaboralTexto = items.slice(0, 5).map((it, idx) => `- ${iconos[idx % iconos.length]} *${it}*`).join('\n');
    }
  }
  if (!campoLaboralTexto) {
    campoLaboralTexto = 
      `- 🏢 *Sector empresarial e institucional:* Organizaciones públicas y privadas en áreas afines a ${nombre}.\n` +
      `- 💼 *Cargos de dirección y coordinación:* Gestión de proyectos, departamentos y equipos de trabajo.\n` +
      `- 🎓 *Docencia e investigación:* Formación académica y proyectos de desarrollo científico.\n` +
      `- 🚀 *Consultoría y libre ejercicio:* Asesoría especializada y práctica profesional independiente.`;
  }

  return (
`¡Hola! 😊

Soy *Diana*, asesora de admisiones de la *Universidad Bolivariana del Ecuador (UBE)*.

¡Me alegra mucho saber que estás interesado/a en estudiar *${nombre}*! ${emojiArea} A continuación, te comparto información sobre el programa, su formación académica, inversión y oportunidades profesionales.

🎓 *${nombreMayus} – UBE*

📚 *Información del programa*
- *Modalidad:* ${modalidad}.
- *Duración:* ${duracion}.
- *Formación:* ${formacion}

📖 *¿QUÉ APRENDERÁS?*

Durante tu formación académica desarrollarás conocimientos y habilidades en diferentes áreas clave:

${ejesAprenderas.join('\n')}

💰 *INVERSIÓN Y COSTOS*

${costosTexto.trim()}

🎁 *BENEFICIOS Y FORMAS DE PAGO*

- *Beneficio institucional:* Descuento por pronto pago y arancel congelado durante toda tu formación.
- *Financiamiento directo:* Crédito educativo directo con la UBE sin intereses bancarios.
- *Facilidades de pago:* Pagos diferidos con tarjeta de crédito de 3 a 24 meses sin intereses o descuento al contado.

📅 *INICIO DE CLASES*

La próxima convocatoria contempla como fecha de referencia: *${inicioTexto}*.
- *Horario de clases:* ${horarioTexto}.
Te recomendamos confirmar la fecha definitiva con nuestro equipo de admisiones.

🚀 *CAMPO LABORAL*

Al culminar tu formación y cumplir los requisitos legales para el ejercicio profesional, podrás desarrollar tu carrera en diferentes ámbitos:

${campoLaboralTexto}

📄 *¿DESEAS CONOCER MÁS SOBRE LA CARRERA?*

Podemos compartir contigo el *tríptico informativo de ${nombre}*, que contiene información más detallada sobre el programa académico, plan de estudios, requisitos y proceso de admisión.

También podemos orientarte personalmente sobre los costos, beneficios y pasos para iniciar tu proceso de inscripción.

*¿Te gustaría que te compartamos el tríptico informativo en PDF?* 😊

¡Será un gusto acompañarte en el camino hacia tu formación profesional!

*Diana*
Asesora de Admisiones
Universidad Bolivariana del Ecuador (UBE)`
  );
}

// Procesar un mensaje entrante de Telegram
async function procesarMensajeTelegram(msg) {
  const chatId = msg.chat?.id;
  const msgId = msg.message_id;
  const userText = (msg.text || msg.caption || '').trim();
  const fromUser = msg.from?.first_name || 'Aspirante';
  const isGroup = msg.chat?.type === 'group' || msg.chat?.type === 'supergroup';

  if (!userText || !chatId) return;

  // En grupos, solo responder si mencionan al bot, es respuesta al bot, o es comando
  if (isGroup) {
    const botMention = `@${botUsername}`.toLowerCase();
    const esComando = userText.startsWith('/');
    const esMencion = userText.toLowerCase().includes(botMention);
    const esRespuesta = msg.reply_to_message?.from?.username?.toLowerCase() === botUsername.toLowerCase();

    if (!esComando && !esMencion && !esRespuesta) {
      return;
    }
  }

  // Limpiar mención del bot en el texto
  const cleanText = userText.replace(new RegExp(`@${botUsername}`, 'gi'), '').trim();

  console.log(`[Telegram] Mensaje de ${fromUser} (${chatId}, grupo=${isGroup}): "${cleanText}"`);

  // 1. Comando /reset o /reiniciar
  if (/^\/(reset|reiniciar)/i.test(cleanText) || /^reiniciar$/i.test(cleanText)) {
    estadosChat.delete(chatId);
    try { memoria.borrarFicha(String(chatId)); } catch (_) {}
    const msgReset = `🔄 *¡Conversación reiniciada!* Hemos limpiado el historial.\n\n` +
      `¡Hola, ${fromUser}! 👋 Soy *Diana*, tu asesora académica oficial de la *UBE* 🎓\n\n` +
      `¿En qué carrera o maestría te gustaría recibir información hoy? 😊`;
    return sendTextMessage(chatId, msgReset, msgId);
  }

  // 2. Comando /start o /help
  if (/^\/(start|help|ayuda|info)/i.test(cleanText) || /^hola$/i.test(cleanText)) {
    const bienvenida = `¡Hola, ${fromUser}! 👋 Soy *Diana*, tu asesora académica oficial de la *Universidad Bolivariana del Ecuador (UBE)* 🎓\n\n` +
      `Estoy aquí para entregarte información detallada, costos oficiales y enviarte los trípticos oficiales en PDF directo a tu celular.\n\n` +
      `📌 *¿Qué puedes consultarme?*\n` +
      `• *Información completa:* "Dame información de la maestría en proyectos BIM" o "Cuéntame sobre Odontología"\n` +
      `• *Costos y fechas:* "¿Cuánto cuesta la maestría en Educación Básica y cuándo inicia?"\n` +
      `• *Tríptico en PDF:* "Pásame el tríptico de Seguridad y Salud Ocupacional" o "Pásame el tríptico de BIM"\n` +
      `• *Reportes y CRM:* "/reporte hoy", "/reporte semana" o "/simulaciones" para descargar el CSV para Excel con clientes y conversaciones.\n\n` +
      `💡 *En grupos:* Puedes agregarme a cualquier grupo y hacerme consultas mencionando @${botUsername}.\n\n` +
      `¿En qué carrera o maestría te gustaría recibir información hoy? 😊`;
    return sendTextMessage(chatId, bienvenida, msgId);
  }

  const estadoPrevio = obtenerEstadoChat(chatId);

  // 3. Comandos de Reportes Administrativos y Simulaciones
  const pideJson = /\bjsonl?\b/i.test(cleanText);
  const esComandoSimulaciones = /^\/simulacion(?:es)?\b/i.test(cleanText) || 
    /(?:p[aá]same|dame|enviame|descargar)\s+(?:las\s+)?simulacion(?:es)?/i.test(cleanText) || 
    /historial\s+(?:de\s+)?simulacion(?:es)?/i.test(cleanText) ||
    (pideJson && /(?:simulaci|tienes|lo\s+tienes|en\s+json|archivo)/i.test(cleanText));

  if (esComandoSimulaciones) {
    sendChatAction(chatId, 'upload_document').catch(() => {});
    if (pideJson) {
      const archivoJson = obtenerReporteSimulacionesJSONL();
      if (archivoJson && fs.existsSync(archivoJson)) {
        await sendTextMessage(chatId, `🗂️ *Historial en Formato JSON (JSONL)*\n¡Sí! Aquí tienes el archivo completo con las 51 sesiones en formato JSON Lines (JSONL), con todos los metadatos y turnos completos:`, msgId);
        await sendPdfDocument(chatId, archivoJson, `🗂️ Historial Simulaciones UBE (JSONL crudo)`, msgId);
        return;
      }
    }
    const archivoSim = obtenerReporteSimulacionesCSV();
    if (archivoSim && fs.existsSync(archivoSim)) {
      await sendTextMessage(chatId, `📊 *Historial Consolidado de Simulaciones*\nAquí tienes el archivo con las 51 sesiones de aspirantes simulados de los últimos días (interactivas y pruebas de arquetipos), listo para abrir directamente en Excel:`, msgId);
      await sendPdfDocument(chatId, archivoSim, `📊 Historial Simulaciones UBE (Excel / CSV)`, msgId);
    } else {
      await sendTextMessage(chatId, `⚠️ No se encontró el archivo de historial de simulaciones en este momento.`, msgId);
    }
    return;
  }

  // 4. Reporte inteligente de prospectos / CRM con filtros flexibles (días, carrera, delta/incremental)
  const solReporte = analizarSolicitudReporte(cleanText, estadoPrevio.ultimoReporteTs);
  if (solReporte) {
    sendChatAction(chatId, 'upload_document').catch(() => {});

    const esPrimeraVezIncremental = solReporte.incremental && !estadoPrevio.ultimoReporteTs;
    if (esPrimeraVezIncremental) {
      solReporte.dias = 1;
      solReporte.desdeTs = undefined;
    }

    const resultado = await obtenerReporteLeadsCSV({
      dias: solReporte.dias,
      desdeTs: solReporte.desdeTs,
      carrera: solReporte.carrera
    });

    if (!resultado || !fs.existsSync(resultado.filePath)) {
      await sendTextMessage(chatId, `⚠️ No se pudo generar el reporte en este momento. Verifica que el servidor de WhatsApp esté activo.`, msgId);
      return;
    }

    const { filePath, totalRegistros } = resultado;
    const ahora = Date.now();
    const horaActualEc = new Date(ahora).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' });

    // Si fue incremental y no hubo prospectos nuevos:
    if (solReporte.incremental && !esPrimeraVezIncremental && totalRegistros === 0) {
      const horaAnterior = new Date(estadoPrevio.ultimoReporteTs).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' });
      await sendTextMessage(chatId, `🔔 *Sin nuevos prospectos*\nNo han ingresado nuevos prospectos desde tu última solicitud a las *${horaAnterior}*. ¡Te avisaré en cuanto escriba alguien nuevo!`, msgId);
      return;
    }

    // Armar título descriptivo y detalle según los filtros aplicados
    let titulo = '📈 *Reporte de Prospectos UBE*';
    let detalle = '';

    if (solReporte.carrera && solReporte.dias && solReporte.dias !== 60) {
      titulo = `🎓 *Prospectos — Área / Carrera: ${solReporte.carrera.toUpperCase()}*`;
      detalle = `Se encontraron *${totalRegistros} prospectos* interesados en *${solReporte.carrera}* (últimos ${solReporte.dias} días).`;
    } else if (solReporte.carrera) {
      titulo = `🎓 *Prospectos — Área / Carrera: ${solReporte.carrera.toUpperCase()}*`;
      detalle = `Se encontraron *${totalRegistros} prospectos* interesados en *${solReporte.carrera}*.`;
    } else if (solReporte.incremental && !esPrimeraVezIncremental) {
      const horaAnterior = new Date(estadoPrevio.ultimoReporteTs).toLocaleTimeString('es-EC', { timeZone: 'America/Guayaquil', hour: '2-digit', minute: '2-digit' });
      titulo = `⚡ *Nuevos Prospectos (Desde las ${horaAnterior})*`;
      detalle = `Ingresaron *${totalRegistros} nuevos prospectos* desde tu última consulta de las *${horaAnterior}*.`;
    } else if (esPrimeraVezIncremental) {
      titulo = `⚡ *Nuevos Prospectos (Primera Solicitud)*`;
      detalle = `Como es tu primera solicitud en esta sesión, te comparto los *${totalRegistros} prospectos* de las últimas 24 horas. Guardé las *${horaActualEc}* como marca de tiempo para tu próxima consulta incremental.`;
    } else if (solReporte.dias === 1) {
      titulo = `📈 *Reporte de Prospectos de Hoy (24h)*`;
      detalle = `Se encontraron *${totalRegistros} prospectos* registrados en las últimas 24 horas.`;
    } else {
      titulo = `📈 *Reporte de Prospectos (Últimos ${solReporte.dias} días)*`;
      detalle = `Se encontraron *${totalRegistros} prospectos* registrados en los últimos *${solReporte.dias} días*.`;
    }

    // Actualizar timestamp de última solicitud en el estado del chat
    estadoPrevio.ultimoReporteTs = ahora;

    const mensajeTexto = `${titulo}\n\n${detalle}\n\n📄 Aquí tienes el archivo CSV consolidado con datos de contacto, etapa y extracto de conversación, listo para abrir en Excel:`;
    await sendTextMessage(chatId, mensajeTexto, msgId);
    await sendPdfDocument(chatId, filePath, `${titulo.replace(/[*_]/g, '')}`, msgId);
    return;
  }

  sendChatAction(chatId, 'typing').catch(() => {});

  // 2. Consulta de catálogo general o por área temática
  const areaDetectada = dianaRouter.detectarAreaEnTexto(cleanText);
  const esConsultaPluralOArea = /(?:qu[eé]\s+)?(?:carreras|maestr[ií]as|programas|opciones|cu[aá]les)\b|[aá]rea\s+(?:de|en)\b/i.test(cleanText);
  const esCatalogoGeneral = /^\/catalogo\b/i.test(cleanText) || /(todas las opciones|el cat[aá]logo|ver cat[aá]logo|qu[eé] maestr[ií]as tienen|qu[eé] carreras tienen|lista completa|opciones de maestr[ií]as|todas las maestr[ií]as)/i.test(cleanText);

  if (esCatalogoGeneral) {
    const respCat = menuService.respuestaAreas();
    if (respCat && respCat.texto) {
      await sendTextMessage(chatId, respCat.texto, msgId);
      estadoPrevio.historial.push({ role: 'user', content: cleanText });
      estadoPrevio.historial.push({ role: 'assistant', content: respCat.texto });
      if (estadoPrevio.historial.length > 8) estadoPrevio.historial = estadoPrevio.historial.slice(-8);
      return;
    }
  }

  if (areaDetectada && esConsultaPluralOArea) {
    const respArea = menuService.respuestaAreaElegida(areaDetectada);
    if (respArea && respArea.texto) {
      await sendTextMessage(chatId, respArea.texto, msgId);
      estadoPrevio.historial.push({ role: 'user', content: cleanText });
      estadoPrevio.historial.push({ role: 'assistant', content: respArea.texto });
      if (estadoPrevio.historial.length > 8) estadoPrevio.historial = estadoPrevio.historial.slice(-8);
      return;
    }
  }

  // 3. Detectar programa en el texto
  let programa = menuService.detectarProgramaEnTexto(cleanText) || menuService.buscarPrograma(cleanText);
  let nombreDetectado = programa ? menuService.nombrePrograma(programa) : '';
  let tripticoPdf = buscarTriptico(cleanText) || (programa ? buscarTriptico(nombreDetectado) : null);

  // Si encontró PDF pero no programa directamente, intentar resolver el programa desde el nombre del PDF
  if (tripticoPdf && !programa) {
    const nombrePdf = tripticoPdf.fileName.replace(/^Triptico_/i, '').replace(/\.pdf$/i, '').replace(/_/g, ' ');
    programa = menuService.detectarProgramaEnTexto(nombrePdf) || menuService.buscarPrograma(nombrePdf);
    if (programa) nombreDetectado = menuService.nombrePrograma(programa);
  }

  // 4. Si es un mensaje de seguimiento ("dame la información completa", "cuánto cuesta", etc.)
  // y no nombró una nueva carrera, recuperar el programa previamente consultado
  const esNuevaConsulta = /(?:otra|otra carrera|carreras?|maestr[ií]as?|programas?|qu[eé] opciones|qu[eé] tienen|cu[aá]les|área|area)/i.test(cleanText);
  const esSeguimiento = !esNuevaConsulta && !programa && estadoPrevio.programa && /(informacion|completa|detalles|costo|cuanto|precio|malla|triptico|pdf|horario|materias|perfil|requisitos)/i.test(cleanText);
  if (esSeguimiento) {
    programa = estadoPrevio.programa;
    nombreDetectado = estadoPrevio.nombreDetectado;
    tripticoPdf = tripticoPdf || estadoPrevio.tripticoPdf;
    console.log(`[Telegram] Contexto recuperado para ${chatId}: ${nombreDetectado}`);
  }

  const fichaWeb = nombreDetectado ? buscarFichaWeb(nombreDetectado) : (estadoPrevio.fichaWeb || null);

  // Guardar estado actualizado en la sesión del chat
  if (programa) {
    guardarEstadoChat(chatId, {
      programa,
      nombreDetectado,
      tripticoPdf,
      fichaWeb
    });
  }

  const soloPideTriptico = /^\s*(p[aá]same|env[ií]ame|dame|manda|quiero|descargar)?\s*(el|la)?\s*(tr[ií]ptico|pdf|malla|documento)\s*(de)?/i.test(cleanText) && !/costo|cuanto|precio|perfil|campo|completa/i.test(cleanText);

  // CASO A: Solo pidió el archivo/tríptico
  if (soloPideTriptico && tripticoPdf && fs.existsSync(tripticoPdf.fullPath)) {
    await sendTextMessage(chatId, `¡Con gusto, ${fromUser}! 📄 Aquí tienes el tríptico oficial con la malla curricular y requisitos de admisión:`, msgId);
    await sendPdfDocument(chatId, tripticoPdf.fullPath, `📄 Tríptico Oficial UBE — ${tripticoPdf.fileName.replace('.pdf', '')}`, msgId);
    return;
  }

  // CASO B: Solicitud de información de un programa específico
  if (programa) {
    const respuestaDiana = await generarRespuestaDiana(cleanText, programa, fichaWeb, estadoPrevio.historial);
    await sendTextMessage(chatId, respuestaDiana, msgId);

    // Actualizar historial conversacional
    estadoPrevio.historial.push({ role: 'user', content: cleanText });
    estadoPrevio.historial.push({ role: 'assistant', content: respuestaDiana });
    if (estadoPrevio.historial.length > 8) estadoPrevio.historial = estadoPrevio.historial.slice(-8);

    // Enviar el PDF adjunto si existe
    if (tripticoPdf && fs.existsSync(tripticoPdf.fullPath)) {
      await sendPdfDocument(chatId, tripticoPdf.fullPath, `📄 Tríptico Oficial UBE — ${nombreDetectado}`, msgId);
    }
    return;
  }

  // CASO C: Encontró tríptico por coincidencia de texto cuando el usuario pide documento explícitamente
  const pideDocExplicitamente = /(triptico|tr[ií]ptico|pdf|malla|pensum|folleto|brochure|adjunto|documento)/i.test(cleanText);
  if (tripticoPdf && fs.existsSync(tripticoPdf.fullPath) && pideDocExplicitamente) {
    await sendTextMessage(chatId, `¡Con gusto! 📄 Aquí tienes el documento oficial correspondiente:`, msgId);
    await sendPdfDocument(chatId, tripticoPdf.fullPath, `📄 Tríptico Oficial UBE — ${tripticoPdf.fileName.replace('.pdf', '')}`, msgId);
    return;
  }

  // CASO D: Consulta general o conversacional
  try {
    const prompt = `Eres Diana, asesora de admisiones oficial de la Universidad Bolivariana del Ecuador (UBE).
El usuario te escribe por Telegram: "${cleanText}".
Responde con calidez, entusiasmo y profesionalismo.
Menciona que contamos con 49 maestrías online oficiales y carreras de grado presenciales, híbridas y online, e invítalo a mencionarte la carrera o maestría que le interesa para darle los valores exactos, campo laboral y su tríptico en PDF.`;

    const resAi = await aiProvider.generarRespuesta(prompt, [
      ...estadoPrevio.historial.slice(-4),
      { role: 'user', content: cleanText }
    ]);
    const replyAi = typeof resAi === 'string' ? resAi : (resAi?.texto || '¡Hola! Con gusto te ayudo con información de la UBE. ¿Qué carrera o maestría te interesa?');
    await sendTextMessage(chatId, replyAi, msgId);

    estadoPrevio.historial.push({ role: 'user', content: cleanText });
    estadoPrevio.historial.push({ role: 'assistant', content: replyAi });
    if (estadoPrevio.historial.length > 8) estadoPrevio.historial = estadoPrevio.historial.slice(-8);
  } catch (err) {
    await sendTextMessage(chatId, `¡Hola! Con gusto te asesoro. Escríbeme el nombre de la carrera o maestría que te interesa (por ejemplo: "Ciencias de la Educación", "Sistemas Inteligentes" o "Proyectos BIM") y te enviaré de inmediato la información detallada con su tríptico oficial en PDF 🙌`, msgId);
  }
}

// Registrar comandos oficiales y activar botón de menú en la barra inferior de Telegram
async function registrarComandosYMenu() {
  try {
    const comandos = [
      { command: 'reporte', description: '📈 Descargar prospectos CRM (hoy, días o carrera)' },
      { command: 'simulaciones', description: '📊 Descargar historial de simulaciones' },
      { command: 'catalogo', description: '🎓 Ver áreas y carreras disponibles' },
      { command: 'ayuda', description: 'ℹ️ Guía y cómo pedir trípticos en PDF' },
      { command: 'reiniciar', description: '🔄 Reiniciar conversación y limpiar memoria' }
    ];

    await fetch(`${TELEGRAM_API}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: comandos })
    });

    await fetch(`${TELEGRAM_API}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_button: { type: 'commands' } })
    });

    console.log('[Telegram] ✅ Botón de menú y comandos registrados en Telegram API.');
  } catch (err) {
    console.warn('[Telegram] No se pudieron registrar los comandos de Telegram:', err.message);
  }
}

// Bucle de Long Polling para recibir mensajes de Telegram
async function pollUpdates() {
  if (isPolling) return;
  isPolling = true;

  try {
    const res = await fetch(`${TELEGRAM_API}/getMe`);
    const data = await res.json();
    if (data.ok) {
      botUsername = data.result.username || botUsername;
      console.log(`[Telegram] Conectado exitosamente como @${botUsername} (${data.result.first_name})`);
      await registrarComandosYMenu();
    } else {
      console.error(`[Telegram] Token inválido:`, data);
      isPolling = false;
      return;
    }
  } catch (e) {
    console.error(`[Telegram] Error al conectar con Telegram API:`, e.message);
    isPolling = false;
    setTimeout(pollUpdates, 10000);
    return;
  }

  console.log(`[Telegram] Escuchando mensajes (Long Polling activo)...`);

  while (isPolling) {
    try {
      const url = `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=20&allowed_updates=["message"]`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          if (update.message) {
            procesarMensajeTelegram(update.message).catch(err => {
              console.error('[Telegram] Error procesando mensaje:', err);
            });
          }
        }
      } else if (!data.ok) {
        console.warn(`[Telegram] Error en getUpdates:`, data.description);
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`[Telegram] Error de red en polling:`, err.message);
      }
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  pollUpdates();
}

module.exports = {
  pollUpdates,
  sendTextMessage,
  sendPdfDocument,
  procesarMensajeTelegram
};
