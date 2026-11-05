/**
 * v5.2 · alertas.js — RESTAURADO (regresión detectada en auditoría v5.1)
 * ============================================================================
 * Antes (v2–v4 local) los avisos salían a UN solo número y v5.1 heredó eso.
 * Ahora el equipo opera con un GRUPO de WhatsApp ("UBE - Better Together") con
 * los asesores dentro, más los números individuales de los 2 asesores.
 *
 * Canales según el TIPO de aviso (confirmado con el usuario):
 *   - 'lead'   (ficha completa / handoff)      → asesores + grupo
 *   - 'cita'   (llamada agendada)              → asesores + grupo
 *   - 'sync'   (reporte días 1 y 16)           → SOLO grupo
 *   - 'sistema'(caídas Groq/Evolution, webhook)→ SOLO grupo
 *
 * Configuración (.env):
 *   ASESOR_ALERTA_PHONE=593960946956,593998600136   # 1 o más números, separados por coma
 *   ASESOR_GRUPO_JID=120363xxxx@g.us                # opcional: JID directo del grupo
 *   ASESOR_GRUPO_NOMBRE=UBE - Better Together       # opcional: se resuelve por nombre
 * Si no hay grupo configurado/resuelto, 'sync'/'sistema' caen a los asesores
 * (mejor un aviso duplicado que un aviso perdido).
 *
 * Protección anti-tormenta: dedupe por (tipo+texto) cada 10 min configurable.
 */

let waClient = null;
const cacheGrupos = { ts: 0, lista: [] };
const ULTIMO_AVISO = {};

function configurar(client) {
  waClient = client;
}

/** Números individuales de los asesores (soporta varios separados por coma) */
function numerosAsesores() {
  return String(process.env.ASESOR_ALERTA_PHONE || '')
    .split(/[,;]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** JID directo del grupo si se configuró (@g.us) */
function grupoJidDirecto() {
  return String(process.env.ASESOR_GRUPO_JID || '').trim();
}

/** Resuelve el JID del grupo por nombre (cache 10 min; Evolution /group/fetchGroups) */
async function buscarGrupo({ forzar = false } = {}) {
  const jid = grupoJidDirecto();
  if (jid) return jid;
  const nombre = String(process.env.ASESOR_GRUPO_NOMBRE || '').trim();
  if (!nombre || !waClient || typeof waClient.listarGrupos !== 'function') return '';
  try {
    if (forzar || Date.now() - cacheGrupos.ts > 600000) {
      cacheGrupos.lista = await waClient.listarGrupos();
      cacheGrupos.ts = Date.now();
    }
    const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const g = cacheGrupos.lista.find(g => norm(g.subject || g.name).includes(norm(nombre)));
    return (g && (g.id || g.jid)) || '';
  } catch (e) {
    console.warn('[alertas] No se pudo resolver el grupo:', e.message);
    return '';
  }
}

function destinosPara(tipo, grupo) {
  const esCaliente = tipo === 'lead' || tipo === 'cita';
  const destinos = new Set(esCaliente ? numerosAsesores() : []);
  if (grupo) destinos.add(grupo);
  if (destinos.size === 0) numerosAsesores().forEach(d => destinos.add(d)); // fallback
  return [...destinos];
}

/**
 * Envía un aviso a los destinos que correspondan según el tipo.
 * Devuelve { ok, resultados:[{destino,ok,error?}] } para testear con mocks.
 */
async function enviar(tipo, texto, { dedupeMin = 10 } = {}) {
  if (!waClient || typeof waClient.sendText !== 'function') {
    return { ok: false, motivo: 'sin_cliente', resultados: [] };
  }
  const clave = `${tipo}:${texto}`;
  const ahora = Date.now();
  if (dedupeMin > 0 && ULTIMO_AVISO[clave] && (ahora - ULTIMO_AVISO[clave]) < dedupeMin * 60000) {
    return { ok: false, motivo: 'duplicado', resultados: [] };
  }
  ULTIMO_AVISO[clave] = ahora;

  const grupo = await buscarGrupo();
  const destinos = destinosPara(tipo, grupo);
  const resultados = [];
  for (const destino of destinos) {
    try {
      await waClient.sendText(destino, texto);
      resultados.push({ destino, ok: true });
    } catch (e) {
      resultados.push({ destino, ok: false, error: e.message });
    }
  }
  return { ok: resultados.some(r => r.ok), resultados };
}

/** Limpia estado interno (tests) */
function _reset() {
  waClient = null;
  cacheGrupos.ts = 0;
  cacheGrupos.lista = [];
  for (const k of Object.keys(ULTIMO_AVISO)) delete ULTIMO_AVISO[k];
}

module.exports = { configurar, enviar, numerosAsesores, buscarGrupo, destinosPara, _reset };
