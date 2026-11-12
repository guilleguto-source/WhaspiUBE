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
      historial: []
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

// Enviar documento PDF directo al chat
async function sendPdfDocument(chatId, filePath, caption = '', replyToId = null) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Telegram] Archivo no existe: ${filePath}`);
      return false;
    }

    sendChatAction(chatId, 'upload_document').catch(() => {});

    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });

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
      console.log(`[Telegram] ✅ PDF '${fileName}' entregado exitosamente a ${chatId}`);
      return true;
    } else {
      console.error(`[Telegram] ❌ Error en sendDocument:`, data);
      return false;
    }
  } catch (err) {
    console.error(`[Telegram] Error enviando PDF a ${chatId}:`, err.message);
    return false;
  }
}

// Generar respuesta rica y bien redactada con Diana AI
async function generarRespuestaDiana(userQuery, programa, fichaWeb, historialPrevio = []) {
  const bloquePrecio = menuService.bloquePrecioPrompt(programa);
  const nombreProg = menuService.nombrePrograma(programa);

  const perfilProf = fichaWeb?.perfil_profesional || '';
  const campoOcup = fichaWeb?.ocupaciones_profesionales || fichaWeb?.campo_ocupacional || '';
  const reqAdm = fichaWeb?.requisitos_admision || '';

  const systemPrompt = `Eres Diana, asesora oficial de admisiones de la Universidad Bolivariana del Ecuador (UBE) 🎓.
Estás respondiendo a un aspirante en Telegram sobre el programa: "${nombreProg}".

DATOS OFICIALES Y FINANCIEROS (MATRIZ DE VALORES UBE - OBLIGATORIO RESPETAR):
${bloquePrecio}

INFORMACIÓN INSTITUCIONAL DE PERFIL Y CAMPO LABORAL:
• Perfil Profesional: ${perfilProf || 'Formación de competencias profesionales de vanguardia y visión integral.'}
• Campo Ocupacional y Puestos: ${campoOcup || 'Sector público y privado, ejercicio independiente, asesoría y docencia.'}
• Requisitos: ${reqAdm || 'Cédula, papeleta de votación y título registrado correspondiente.'}

INSTRUCCIONES CLAVE DE FORMATO Y ESTILO:
1. Responde con calidez humana, elocuencia, profesionalismo y entusiasmo institucional (tono Diana).
2. Si el usuario solicita información completa, asegúrate de detallar:
   - 🎓 *Sobre el Programa:* Modalidad (Online / Presencial), duración real (${programa.tipo === 'grado' ? '4 años / 8 a 10 períodos' : '1 año / 12 meses'}) y enfoque.
   - 💰 *Inversión Oficial:* Detalla matrícula, cuota mensual regular, cuota pronto pago (si aplica), inversión total y beneficios de contado. Respeta exactamente los valores oficiales del bloque de precios.
   - 📅 *Inicio de Clases:* Fecha confirmada o próxima cohorte oficial, y horarios.
   - 🚀 *Perfil del Egresado y Campo Laboral:* Explica en qué empresas, puestos o áreas trabajará.
   - 📚 *Áreas Clave de Formación:* Menciona los ejes temáticos reales de la carrera (sin siglas burocráticas de acreditación).
3. Menciona que a continuación le adjuntas el tríptico oficial en PDF con la malla completa.
4. Usa formato Markdown limpio (*negritas*, viñetas •).`;

  const mensajesPrompt = [
    ...historialPrevio.slice(-4),
    { role: 'user', content: userQuery }
  ];

  try {
    const resAi = await aiProvider.generarRespuesta(systemPrompt, mensajesPrompt);
    const texto = typeof resAi === 'string' ? resAi : (resAi?.texto || '');
    if (texto && texto.length > 100) return texto;
  } catch (err) {
    console.warn('[Telegram] AI Provider falló, usando generador estructurado:', err.message);
  }

  // Generador de respaldo de alta calidad si la IA fallara
  return generarRespaldoEstructurado(programa, fichaWeb);
}

// Plantilla de respaldo limpia (sin siglas de tablas de PDF)
function generarRespaldoEstructurado(programa, fichaWeb) {
  const m = programa.ref;
  const esMaestria = programa.tipo === 'maestria';
  const nombre = menuService.nombrePrograma(programa);

  let out = `🎓 *${nombre}*\n`;
  out += `━━━━━━━━━━━━━━━━━━━━━\n`;
  out += `📍 *Modalidad:* ${m.modalidad || 'Online'}\n`;
  out += `⏱️ *Duración:* ${m.duracion || (esMaestria ? '12 meses' : '8 a 10 períodos semestrales')}\n\n`;

  out += `💰 *INVERSIÓN OFICIAL (Matriz UBE):*\n`;
  if (esMaestria) {
    if (m.matricula) out += `• *Matrícula promocional:* $${m.matricula}\n`;
    if (m.cuota) out += `• *Arancel:* ${m.num_cuotas || 12} cuotas de $${m.cuota} (Total arancel: $${m.total_cuotas || m.cuota * 12})\n`;
    if (m.inversion_total) out += `• *Inversión total del programa:* $${m.inversion_total}\n`;
    if (m.pago_contado) out += `• *Pago al contado:* $${m.pago_contado} (5% descuento)\n`;
    if (m.cuota_18) out += `• *Alternativa flexible:* 18 cuotas de ~$${m.cuota_18}\n`;
  } else {
    if (m.inscripcion) out += `• *Inscripción:* $${m.inscripcion}\n`;
    if (m.matricula) out += `• *Matrícula:* $${m.matricula} por semestre\n`;
    if (m.cuota_normal) out += `• *Cuota regular:* $${m.cuota_normal}\n`;
    if (m.cuota_promocional || m.pronto_pago) out += `• *Cuota pronto pago:* $${m.cuota_promocional || m.pronto_pago}\n`;
    if (m.inversion_total) out += `• *Inversión total estimada:* $${m.inversion_total}\n`;
  }

  out += `\n📅 *PRÓXIMO INICIO Y HORARIO:*\n`;
  if (m.inicio && m.inicio.fecha && !m.inicio.pasada) {
    out += `• *Fecha de inicio:* ${m.inicio.fecha}\n`;
  } else {
    out += `• *Fecha de inicio:* Próxima cohorte oficial (confirmada mensualmente)\n`;
  }
  if (m.horario) out += `• *Horario de clases:* ${m.horario}\n`;

  out += `\n🚀 *PERFIL PROFESIONAL Y CAMPO OCUPACIONAL:*\n`;
  if (fichaWeb?.perfil_profesional) {
    out += `${fichaWeb.perfil_profesional.slice(0, 320)}...\n\n`;
  }
  if (fichaWeb?.ocupaciones_profesionales) {
    out += `*Puestos de desempeño:* ${fichaWeb.ocupaciones_profesionales.slice(0, 250)}...\n`;
  }

  out += `\n📄 _A continuación te adjunto el tríptico oficial en PDF con la malla curricular completa._`;
  return out;
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

  // 1. Comando /start o /help
  if (/^\/(start|help|ayuda|info)/i.test(cleanText) || /^hola$/i.test(cleanText)) {
    const bienvenida = `¡Hola, ${fromUser}! 👋 Soy *Diana*, tu asesora académica oficial de la *Universidad Bolivariana del Ecuador (UBE)* 🎓\n\n` +
      `Estoy aquí para entregarte información detallada, costos oficiales y enviarte los trípticos oficiales en PDF directo a tu celular.\n\n` +
      `📌 *¿Qué puedes consultarme?*\n` +
      `• *Información completa:* "Dame información de la maestría en proyectos BIM" o "Cuéntame sobre Odontología"\n` +
      `• *Costos y fechas:* "¿Cuánto cuesta la maestría en Educación Básica y cuándo inicia?"\n` +
      `• *Tríptico en PDF:* "Pásame el tríptico de Seguridad y Salud Ocupacional" o "Pásame el tríptico de BIM"\n\n` +
      `💡 *En grupos:* Puedes agregarme a cualquier grupo y hacerme consultas mencionando @${botUsername}.\n\n` +
      `¿En qué carrera o maestría te gustaría recibir información hoy? 😊`;
    return sendTextMessage(chatId, bienvenida, msgId);
  }

  sendChatAction(chatId, 'typing').catch(() => {});

  const estadoPrevio = obtenerEstadoChat(chatId);

  // 2. Detectar programa en el texto
  let programa = menuService.detectarProgramaEnTexto(cleanText) || menuService.buscarPrograma(cleanText);
  let nombreDetectado = programa ? menuService.nombrePrograma(programa) : '';
  let tripticoPdf = buscarTriptico(cleanText) || (programa ? buscarTriptico(nombreDetectado) : null);

  // Si encontró PDF pero no programa directamente, intentar resolver el programa desde el nombre del PDF
  if (tripticoPdf && !programa) {
    const nombrePdf = tripticoPdf.fileName.replace(/^Triptico_/i, '').replace(/\.pdf$/i, '').replace(/_/g, ' ');
    programa = menuService.detectarProgramaEnTexto(nombrePdf) || menuService.buscarPrograma(nombrePdf);
    if (programa) nombreDetectado = menuService.nombrePrograma(programa);
  }

  // 3. Si es un mensaje de seguimiento ("dame la información completa", "cuánto cuesta", etc.)
  // y no nombró una nueva carrera, recuperar el programa previamente consultado
  const esSeguimiento = !programa && estadoPrevio.programa && /(informacion|completa|detalles|costo|cuanto|precio|malla|triptico|pdf|horario|materias|perfil|requisitos)/i.test(cleanText);
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

  // CASO C: Encontró tríptico por coincidencia de texto aunque no esté en la matriz de precios
  if (tripticoPdf && fs.existsSync(tripticoPdf.fullPath)) {
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
