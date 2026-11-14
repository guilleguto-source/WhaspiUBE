#!/usr/bin/env node
/**
 * Runner Interno de la Batería de 64 Personajes Ecuatorianos
 * Simula interacciones reales de WhatsApp contra el chatbot Diana en localhost:3000
 * Graba los resultados y telemetría en wa-bot/data/conversaciones_simuladas.jsonl
 * y puebla el CRM y el Calendario de llamadas en vivo.
 */

const fs = require('fs');
const path = require('path');

const RUTA_BATERIA = path.join(__dirname, 'data', 'bateria_personajes_72.json');
const RUTA_LOG = path.join(__dirname, 'data', 'conversaciones_simuladas.jsonl');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

const args = process.argv.slice(2);
function getArg(name, def = null) {
  const match = args.find(a => a.startsWith(`--${name}=`));
  if (match) return match.split('=')[1];
  return def;
}

const limite = parseInt(getArg('limit', '64'), 10);
const filtroTipo = getArg('tipo', 'all'); // 'all', 'agendamiento_llamada', 'maestria_2pasos', 'grado_regular', 'validacion_pe', 'disruptivo'
const delayTurnoMs = parseInt(getArg('delay', '1200'), 10);
const proveedorArg = getArg('provider', null); // 'groq', 'ollama', o null (hybrid)

if (!fs.existsSync(RUTA_BATERIA)) {
  console.error(`❌ No se encontró el archivo de personajes en: ${RUTA_BATERIA}`);
  process.exit(1);
}

const personajes = JSON.parse(fs.readFileSync(RUTA_BATERIA, 'utf-8'));

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let panelToken = '';

async function obtenerTokenPin() {
  try {
    const pin = process.env.PANEL_PIN || '052020';
    const res = await fetch(`${BASE_URL}/api/pin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();
    if (data.ok && data.token) panelToken = data.token;
  } catch (_) {}
}

async function enviarMensaje(phone, message) {
  const t0 = Date.now();
  const headers = { 'Content-Type': 'application/json' };
  if (panelToken) headers['x-panel-token'] = panelToken;

  const resp = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      phone,
      message,
      provider: proveedorArg,
      fast: true
    })
  });
  const tTotal = Date.now() - t0;
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} al enviar mensaje para ${phone}`);
  }
  const data = await resp.json();
  data.tClienteMs = tTotal;
  return data;
}

async function obtenerLead(phone) {
  const headers = {};
  if (panelToken) headers['x-panel-token'] = panelToken;
  const resp = await fetch(`${BASE_URL}/api/lead/${encodeURIComponent(phone)}`, { headers });
  if (!resp.ok) return null;
  const json = await resp.json();
  return json.lead || null;
}

async function run() {
  await obtenerTokenPin();
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  BANCO DE PRUEBAS INTERNO · 64 PERSONAJES ECUATORIANOS (WHASPIUBE) ');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`• Servidor objetivo: ${BASE_URL}`);
  console.log(`• Límite configurado: ${limite} personajes`);
  console.log(`• Filtro de tipo: ${filtroTipo}`);
  console.log(`• Archivo de salida: ${RUTA_LOG}\n`);

  let seleccionados = personajes;
  if (filtroTipo !== 'all') {
    seleccionados = seleccionados.filter(p => p.tipo === filtroTipo);
  }
  seleccionados = seleccionados.slice(0, limite);

  console.log(`Iniciando simulación de ${seleccionados.length} diálogos...\n`);

  // Limpiar archivo de log para la corrida actual
  fs.writeFileSync(RUTA_LOG, '', 'utf-8');

  let totalPasadas = 0;
  let totalFallidas = 0;
  const tiemposInferencia = [];
  const llamadasAgendadas = [];

  for (let i = 0; i < seleccionados.length; i++) {
    const p = seleccionados[i];
    const tagProgreso = `[${String(i + 1).padStart(2, '0')}/${seleccionados.length}] ${p.id} · ${p.nombre} (${p.ciudad})`;
    process.stdout.write(`${tagProgreso} ... `);

    const registroConversacion = {
      test_id: p.id,
      nombre: p.nombre,
      ciudad: p.ciudad,
      phone: p.phone,
      arquetipo: p.arquetipo,
      tipo: p.tipo,
      sigueGuion: p.sigueGuion,
      ts_inicio: Date.now(),
      turnos: [],
      leadFinal: null,
      exito: true,
      fallas: []
    };

    let errorEnTurnos = null;

    // Reset de sesión previa para asegurar prueba atómica y limpia
    await fetch(`${BASE_URL}/api/lead/${encodeURIComponent(p.phone)}/reset`, { method: 'POST' }).catch(() => {});

    for (let t = 0; t < p.mensajes.length; t++) {
      const userMsg = p.mensajes[t];
      try {
        const resDiana = await enviarMensaje(p.phone, userMsg);
        tiemposInferencia.push(resDiana.metricas?.inferenciaMs || resDiana.tClienteMs || 500);

        registroConversacion.turnos.push({
          turno: t + 1,
          usuario: userMsg,
          diana: resDiana.reply || '',
          pdfEnviado: resDiana.pdf || null,
          tokens: resDiana.tokens || null,
          metricas: resDiana.metricas || {},
          proveedor: resDiana.proveedor || resDiana.provider || 'cloud-groq',
          modelo: resDiana.modeloUsado || 'qwen/qwen3.8-27b'
        });

        if (delayTurnoMs > 0 && t < p.mensajes.length - 1) {
          await sleep(delayTurnoMs);
        }
      } catch (err) {
        errorEnTurnos = err.message;
        registroConversacion.exito = false;
        registroConversacion.fallas.push(`Error en turno ${t + 1}: ${err.message}`);
        break;
      }
    }

    // Obtener estado final de la ficha CRM
    const leadFinal = await obtenerLead(p.phone);
    registroConversacion.leadFinal = leadFinal;
    registroConversacion.ts_fin = Date.now();
    registroConversacion.duracionMs = registroConversacion.ts_fin - registroConversacion.ts_inicio;

    // Evaluar aserciones si las hubo
    if (p.aserciones && leadFinal) {
      if (p.aserciones.nombre) {
        if (!leadFinal.nombre) {
          registroConversacion.exito = false;
          registroConversacion.fallas.push(`Nombre no extraído (esperaba '${p.aserciones.nombre}')`);
        } else {
          const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          if (norm(leadFinal.nombre) !== norm(p.aserciones.nombre)) {
            registroConversacion.exito = false;
            registroConversacion.fallas.push(`Nombre esperado '${p.aserciones.nombre}', obtuvo '${leadFinal.nombre}'`);
          }
        }
      }
      if (p.aserciones.llamada_estado && leadFinal.llamada_estado !== p.aserciones.llamada_estado) {
        registroConversacion.exito = false;
        registroConversacion.fallas.push(`Llamada estado esperado '${p.aserciones.llamada_estado}', obtuvo '${leadFinal.llamada_estado}'`);
      }
      if (p.aserciones.llamada_agendada_horario && leadFinal.llamada_agendada_horario !== p.aserciones.llamada_agendada_horario) {
        // Tolerancia a capitalización, diacríticos y ceros a la izquierda (ej: 04:30 vs 4:30)
        const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b0(\d)/g, '$1').replace(/\s+/g, ' ').trim();
        if (norm(leadFinal.llamada_agendada_horario) !== norm(p.aserciones.llamada_agendada_horario)) {
          registroConversacion.exito = false;
          registroConversacion.fallas.push(`Horario esperado '${p.aserciones.llamada_agendada_horario}', obtuvo '${leadFinal.llamada_agendada_horario}'`);
        }
      }
      if (p.aserciones.ruta && leadFinal.ruta !== p.aserciones.ruta) {
        registroConversacion.exito = false;
        registroConversacion.fallas.push(`Ruta esperada '${p.aserciones.ruta}', obtuvo '${leadFinal.ruta}'`);
      }
      if (p.aserciones.confirmado && !leadFinal.confirmado) {
        registroConversacion.exito = false;
        registroConversacion.fallas.push(`Esperaba lead confirmado`);
      }
    }

    if (leadFinal?.llamada_agendada_horario && leadFinal?.llamada_estado === 'pendiente') {
      llamadasAgendadas.push({
        nombre: leadFinal.nombre || p.nombre,
        phone: p.phone,
        horario: leadFinal.llamada_agendada_horario
      });
    }

    // Guardar en JSON Lines
    fs.appendFileSync(RUTA_LOG, JSON.stringify(registroConversacion) + '\n', 'utf-8');

    if (registroConversacion.exito) {
      totalPasadas++;
      const ultTurno = registroConversacion.turnos[registroConversacion.turnos.length - 1];
      const tInf = ultTurno?.metricas?.inferenciaSec ? `${ultTurno.metricas.inferenciaSec}s` : 'OK';
      const extraInfo = leadFinal?.llamada_agendada_horario ? `📅 Cita: ${leadFinal.llamada_agendada_horario}` : `Etapa: ${leadFinal?.etapa || 'ok'}`;
      console.log(`✅ PASS (${tInf}) [${extraInfo}]`);
    } else {
      totalFallidas++;
      console.log(`❌ FAIL (${registroConversacion.fallas.join('; ')})`);
    }

    if (i < seleccionados.length - 1) {
      await sleep(1500);
    }
  }

  // Resumen final y estadísticas
  const tPromedioMs = tiemposInferencia.length > 0
    ? Math.round(tiemposInferencia.reduce((a, b) => a + b, 0) / tiemposInferencia.length)
    : 0;

  // Estadísticas de tokens
  let totalTokensPrompt = 0;
  let totalTokensRespuesta = 0;
  let totalTokensGlobal = 0;
  let turnosConTokens = 0;

  // Leer RUTA_LOG para computar tokens
  if (fs.existsSync(RUTA_LOG)) {
    const lineasLog = fs.readFileSync(RUTA_LOG, 'utf-8').trim().split('\n').filter(Boolean);
    lineasLog.forEach(l => {
      try {
        const item = JSON.parse(l);
        (item.turnos || []).forEach(t => {
          if (t.tokens) {
            totalTokensPrompt += (t.tokens.prompt || 0);
            totalTokensRespuesta += (t.tokens.respuesta || 0);
            totalTokensGlobal += (t.tokens.total || 0);
            turnosConTokens++;
          }
        });
      } catch (_) {}
    });
  }

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  RESUMEN DE LA BATERÍA DE PRUEBAS');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`• Total simulaciones:       ${seleccionados.length}`);
  console.log(`• Exitosas:                 ${totalPasadas} (${Math.round((totalPasadas / seleccionados.length) * 100)}%)`);
  console.log(`• Con fallas o desvíos:     ${totalFallidas}`);
  console.log(`• Tiempo promedio IA:       ${(tPromedioMs / 1000).toFixed(2)}s`);
  console.log(`• Tokens totales consumidos: ${totalTokensGlobal.toLocaleString()} (Prompt: ${totalTokensPrompt.toLocaleString()} | Resp: ${totalTokensRespuesta.toLocaleString()})`);
  console.log(`• Tokens prom. por turno:   ${turnosConTokens > 0 ? Math.round(totalTokensGlobal / turnosConTokens) : 0}`);
  console.log(`• Citas agendadas en CRM:   ${llamadasAgendadas.length}`);
  console.log(`• Archivo de bitácora:      ${RUTA_LOG}`);
  console.log('════════════════════════════════════════════════════════════════════\n');

  if (llamadasAgendadas.length > 0) {
    console.log('📅 CITAS AGENDADAS EN EL CALENDARIO:');
    llamadasAgendadas.forEach((c, idx) => {
      console.log(`  ${idx + 1}. ${c.nombre} (${c.phone}) ➔ Horario pactado: ${c.horario}`);
    });
    console.log('\n(Puedes ver estas citas en vivo en el panel del Calendario: http://localhost:3000)\n');
  }
}

run().catch(err => {
  console.error('Error fatal ejecutando batería:', err);
  process.exit(1);
});
