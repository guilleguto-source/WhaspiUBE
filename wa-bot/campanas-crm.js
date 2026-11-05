/**
 * campanas-crm.js — Campaña de outreach para graduados (WhatsApp + CRM WhaspiUBE)
 * ---------------------------------------------------------------------------
 * Envía el mensaje de presentación de Diana León (postgrados UBE) a una lista
 * de graduados cargada desde CSV, con límites diarios anti-baneo, botones de
 * WhatsApp y registro completo de estados en SQLite (mismo motor que el CRM).
 *
 * INTEGRACIÓN (server.js):
 *   const CampanaGrupos = require('./campanas-crm');
 *   const campana = new CampanaGrupos({ store: sessionStore, waClient });
 *   // 1) al recibir un mensaje, ANTES del flujo normal de Diana:
 *   const accionCampana = campana.responder(phone, texto);
 *   if (accionCampana) { /* responder con accionCampana.mensaje y no llamar al LLM *​/ }
 *   // 2) al arrancar el servidor:
 *   campana.iniciar();
 *
 * IMPORTAR CONTACTOS (una vez):
 *   node importar-campana.js contactos_educacion_import.csv
 *
 * VARIABLES DE ENTORNO (.env):
 *   CAMPANA_ACTIVOS=false        // true SOLO cuando el número esté caliente
 *   CAMPANA_DRY_RUN=true         // true = solo log, no envía (prueba segura)
 *   CAMPANA_FASE1_MAX=6          // mensajes/día EN TOTAL (M1 + seguimientos), semanas 1-2
 *   CAMPANA_FASE2_MAX=9          // mensajes/día EN TOTAL (M1 + seguimientos), desde la semana 3
 *   CAMPANA_HORA_INICIO1=08:45   CAMPANA_HORA_FIN1=11:50
 *   CAMPANA_HORA_INICIO2=14:35   CAMPANA_HORA_FIN2=17:25
 *   CAMPANA_INTER_MIN_MS=3000000 CAMPANA_INTER_MAX_MS=6600000  // 50-110 min
 *   CAMPANA_TOQUE2_HORAS=72      // segundo toque si no respondió
 *   CAMPANA_CIERRE_DIAS=7        // días para dar por terminado sin respuesta
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Mensajes de la campaña (tono Diana: cercano, formal, sin tecnicismos)
// ---------------------------------------------------------------------------
const MENSAJES = {
  inicial: (nombre) =>
    `Buen día ☀️ Le saluda *Diana León*, coordinadora de postgrados de la *Universidad Bolivariana del Ecuador*.\n\n` +
    (nombre ? `${nombre}, felicidades` : 'Felicidades') +
    ` por haber culminado su formación en *Educación* en enero 2026 🎓👏\n\n` +
    `Le escribo porque en la UBE tenemos abiertas las inscripciones a nuestras *maestrías del área educativa*, ` +
    `pensadas para quienes trabajan: horarios compatibles y condiciones preferentes para nuestros graduados.\n\n` +
    `¿Le gustaría recibir la información?`,
  fallbackOpciones:
    `\n\nResponde con el número de la opción:\n` +
    `1️⃣ Quisiera más información\n2️⃣ Ya la estoy cursando\n3️⃣ No recibir más mensajes`,
  masInfo:
    `¡Excelente decisión! 🙌 Le cuento en breve cómo funciona:\n\n` +
    `• Las maestrías del área educativa se cursan con horarios compatibles con el trabajo.\n` +
    `• Hay condiciones preferentes para graduados UBE.\n` +
    `• Le puedo enviar el tríptico con mallas, valores y fechas de inicio.\n\n` +
    `Para enviarle la información correcta, ¿me confirma su *nombre completo* y desde qué *ciudad* nos escribe? 😊`,
  yaCursando:
    `¡Qué alegría saber que ya es parte de nuestra familia UBE! 🎉🎓\n\n` +
    `Entonces no le tomaré más su tiempo. Si más adelante desea abrir *otra* maestría o necesita información del calendario académico, ` +
    `escríbame con confianza. ¡Muchos éxitos! 🙌`,
  noMas:
    `Entendido, muchas gracias por su respuesta 🙏\nNo le volveré a escribir.\nLe deseo un excelente día. ☀️`,
  toque2:
    `Hola de nuevo 😊 Le escribí hace unos días con información sobre las *maestrías de la UBE para graduados de Educación*.\n\n` +
    `¿Desea que le comparta los detalles (mallas, horarios y valores)?\n` +
    `Si no es de su interés, respóndame con la palabra *SALIR* y con gusto no le molesto más. 🙏`,
};

// v5 (auditoría): IDs de botón SIEMPRE ASCII (la ñ en el id puede causar
// problemas de codificación en algunos gateways); el texto visible queda igual.
const BOTONES = [
  { buttonId: 'campana_info', buttonText: { displayText: 'Quisiera más información' }, type: 1 },
  { buttonId: 'campana_curso', buttonText: { displayText: 'Ya la estoy cursando' }, type: 1 },
  { buttonId: 'campana_no', buttonText: { displayText: 'No recibir más mensajes' }, type: 1 },
];

const ESTADOS = ['pendiente', 'enviado_inicial', 'interesado', 'ya_cursando',
  'no_interesado', 'sin_respuesta', 'error'];

// Palabras que el contacto puede escribir para salirse
const PATRONES_SALIDA = /\b(salir|no molestar|no moleste|no me interesa|quiten|remover|baja|unsubscribe|no gracias)\b/i;
const PATRON_INFO = /\b(1|info|informacion|información|si|sí|quiero|mas|más|ok)\b/i;
const PATRON_CURSA = /\b(2|ya la estoy cursando|ya la curso|estoy cursando|ya curso)\b/i;

class CampanaGrupos {
  /**
   * @param {object} opciones
   *   store     — instancia de SessionStore (usa store.db, DatabaseSync de node:sqlite)
   *   waClient  — cliente de WhatsApp (mínimo sendText; opcional sendButtons)
   *   enviarReal— false para simulación completa (por defecto toma CAMPANA_DRY_RUN)
   */
  constructor(opciones = {}) {
    this.store = opciones.store;
    this.waClient = opciones.waClient || null;
    this.enviarReal = opciones.enviarReal !== undefined
      ? opciones.enviarReal
      : String(process.env.CAMPANA_DRY_RUN || 'true').toLowerCase() !== 'true';
    this.activa = String(process.env.CAMPANA_ACTIVOS || 'false').toLowerCase() === 'true';
    this.timer = null;

    this.cfg = {
      fase1Max: parseInt(process.env.CAMPANA_FASE1_MAX || '6', 10),
      fase2Max: parseInt(process.env.CAMPANA_FASE2_MAX || '9', 10),
      ventana1: [process.env.CAMPANA_HORA_INICIO1 || '08:45', process.env.CAMPANA_HORA_FIN1 || '11:50'],
      ventana2: [process.env.CAMPANA_HORA_INICIO2 || '14:35', process.env.CAMPANA_HORA_FIN2 || '17:25'],
      interMin: parseInt(process.env.CAMPANA_INTER_MIN_MS || '3000000', 10),  // 50 min
      interMax: parseInt(process.env.CAMPANA_INTER_MAX_MS || '6600000', 10),  // 110 min
      toque2Horas: parseInt(process.env.CAMPANA_TOQUE2_HORAS || '72', 10),
      cierreDias: parseInt(process.env.CAMPANA_CIERRE_DIAS || '7', 10),
      zonaHorariaOffset: parseInt(process.env.CAMPANA_UTC_OFFSET || '-5', 10), // Ecuador = UTC-5
    };
    this.initTabla();
  }

  // ------------------------------------------------------------------ tabla
  initTabla() {
    this.store.db.exec(`
      CREATE TABLE IF NOT EXISTS campana_contactos (
        phone TEXT PRIMARY KEY,
        nombre TEXT,
        grupo TEXT,
        promocion TEXT DEFAULT 'Graduados Educación — enero 2026',
        estado TEXT DEFAULT 'pendiente',
        fecha_asignada TEXT,
        hora_sugerida TEXT,
        toques INTEGER DEFAULT 0,
        enviado_en INTEGER,
        respondio_en INTEGER,
        ultimo_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_campana_estado ON campana_contactos (estado);
      CREATE INDEX IF NOT EXISTS idx_campana_fecha ON campana_contactos (fecha_asignada);
    `);
  }

  // ------------------------------------------------------------- importación
  importarDesdeCSV(rutaCsv) {
    const contenido = fs.readFileSync(rutaCsv, 'utf-8');
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim());
    const ahora = Date.now();
    let nuevos = 0, actualizados = 0;
    for (const linea of lineas.slice(1)) {           // salta cabecera
      const [phone, nombre, grupo, fecha, hora] = linea.split(',');
      if (!phone || !/^593\d{9}$/.test(phone.trim())) continue;
      const existe = this.store.db.prepare(
        'SELECT phone FROM campana_contactos WHERE phone = ?').get(phone.trim());
      if (existe) {
        this.store.db.prepare(`
          UPDATE campana_contactos SET nombre = COALESCE(NULLIF(?, ''), nombre),
            grupo = COALESCE(NULLIF(?, ''), grupo),
            fecha_asignada = COALESCE(NULLIF(?, ''), fecha_asignada),
            hora_sugerida = COALESCE(NULLIF(?, ''), hora_sugerida),
            updated_at = ? WHERE phone = ? AND estado = 'pendiente'`)
          .run(nombre || '', grupo || '', fecha || '', hora || '', ahora, phone.trim());
        actualizados++;
      } else {
        this.store.db.prepare(`
          INSERT INTO campana_contactos (phone, nombre, grupo, estado, fecha_asignada,
            hora_sugerida, created_at, updated_at)
          VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?)`)
          .run(phone.trim(), nombre || '', grupo || '', fecha || '', hora || '', ahora, ahora);
        nuevos++;
      }
    }
    console.log(`[Campaña] Importación: ${nuevos} nuevos, ${actualizados} actualizados.`);
    return { nuevos, actualizados };
  }

  // ------------------------------------------------------------- utilidades
  ahoraLocal() {
    const d = new Date(Date.now() + this.cfg.zonaHorariaOffset * 3600000);
    return { fecha: d.toISOString().slice(0, 10), hhmm: d.toISOString().slice(11, 16),
      dia: d.getUTCDay(), minutos: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }

  minutosDe(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  dentroDeVentana() {
    const { dia, minutos } = this.ahoraLocal();
    if (dia === 0 || dia === 6) return false;                   // fines de semana
    const [i1, f1] = this.cfg.ventana1.map(this.minutosDe);
    const [i2, f2] = this.cfg.ventana2.map(this.minutosDe);
    return (minutos >= i1 && minutos <= f1) || (minutos >= i2 && minutos <= f2);
  }

  limiteHoy() {
    const { fecha } = this.ahoraLocal();
    const inicio = new Date(this.fechaInicioCampana + 'T00:00:00Z').getTime();
    const diasTranscurridos = Math.floor((Date.now() - inicio) / 86400000);
    const semanas = Math.floor(diasTranscurridos / 7) + 1;
    return semanas <= 2 ? this.cfg.fase1Max : this.cfg.fase2Max;
  }

  get fechaInicioCampana() {
    if (this._inicio) return this._inicio;
    const primera = this.store.db.prepare(
      'SELECT MIN(fecha_asignada) AS f FROM campana_contactos').get();
    this._inicio = (primera && primera.f) || this.ahoraLocal().fecha;
    return this._inicio;
  }

  enviadosHoy() {
    const { fecha } = this.ahoraLocal();
    const desde = new Date(fecha + 'T00:00:00Z').getTime() - this.cfg.zonaHorariaOffset * 3600000;
    // Cuenta TODOS los mensajes de hoy (primeros contactos Y seguimientos):
    // el tope diario de 6–9 es TOTAL. Sin esto un día podían salir 9 M1 + 9 M2.
    const fila = this.store.db.prepare(
      'SELECT COUNT(*) AS c FROM campana_contactos WHERE enviado_en >= ?').get(desde);
    return fila.c;
  }

  normalizarPhone(phone) {
    return String(phone).replace(/[^0-9]/g, '').replace(/^0+/, '');
  }

  // ------------------------------------------------------------- envío día
  iniciar() {
    if (this.timer) return;
    console.log(`[Campaña] Scheduler activo. ACTIVA=${this.activa} DRY_RUN=${!this.enviarReal}`);
    this.timer = setInterval(() => this.tick().catch((e) =>
      console.error('[Campaña] Error en tick:', e.message)), 60000);
  }

  detener() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async tick() {
    if (!this.activa || !this.waClient) return;
    if (!this.dentroDeVentana()) return;
    if (this.enviadosHoy() >= this.limiteHoy()) return;
    const { hhmm } = this.ahoraLocal();
    const ahora = Date.now();

    // 0) FIX v5 (auditoría): contactos con estado 'error' (falló el envío: red,
    //    Evolution caída…) quedaban CONGELADOS para siempre. Se reprograman
    //    al día siguiente dentro de la ventana matutina.
    this.store.db.prepare(`
      UPDATE campana_contactos SET estado = 'pendiente', updated_at = ?
      WHERE estado = 'error' AND updated_at <= ?`)
      .run(ahora, ahora - 6 * 3600000);

    // 1) segundo toque pendiente (consume el tope diario total: nunca se pasa de 6–9)
    const paraToque2 = this.store.db.prepare(`
      SELECT * FROM campana_contactos
      WHERE estado = 'enviado_inicial' AND toques = 1 AND respondio_en IS NULL
        AND enviado_en <= ? LIMIT 1`)
      .get(ahora - this.cfg.toque2Horas * 3600000);
    if (paraToque2) {
      await this.enviar(paraToque2, MENSAJES.toque2, null, true);
      return;
    }

    // 2) cierres sin respuesta
    this.store.db.prepare(`
      UPDATE campana_contactos SET estado = 'sin_respuesta', updated_at = ?
      WHERE estado = 'enviado_inicial' AND toques >= 2 AND respondio_en IS NULL
        AND enviado_en <= ?`)
      .run(ahora, ahora - this.cfg.cierreDias * 86400000);

    // 3) siguiente contacto del día (por fecha y hora sugerida)
    const { fecha } = this.ahoraLocal();
    const proximo = this.store.db.prepare(`
      SELECT * FROM campana_contactos
      WHERE estado = 'pendiente' AND fecha_asignada <= ? AND hora_sugerida <= ?
      ORDER BY fecha_asignada, hora_sugerida LIMIT 1`)
      .get(fecha, hhmm);
    if (!proximo) return;

    const saludo = proximo.nombre && proximo.nombre.length < 28
      ? proximo.nombre.split(/\s+/).slice(0, 2).join(' ') : '';
    const texto = MENSAJES.inicial(saludo);
    await this.enviar(proximo, texto, BOTONES, false);
  }

  async enviar(contacto, texto, botones, esToque2) {
    const ahora = Date.now();
    try {
      if (this.enviarReal) {
        let enviadoConBotones = false;
        if (botones && typeof this.waClient.sendButtons === 'function') {
          await this.waClient.sendButtons(contacto.phone, texto, botones);
          enviadoConBotones = true;
        } else {
          const final = botones ? texto + MENSAJES.fallbackOpciones : texto;
          await this.waClient.sendText(contacto.phone, final);
        }
        console.log(`[Campaña] ${esToque2 ? 'Toque 2' : 'M1'} → ${contacto.phone}` +
          (enviadoConBotones ? ' (con botones)' : ' (texto)'));
      } else {
        console.log(`[Campaña][DRY-RUN] ${esToque2 ? 'Toque 2' : 'M1'} → ${contacto.phone}: ${texto.slice(0, 60)}…`);
      }
      this.store.db.prepare(`
        UPDATE campana_contactos SET estado = 'enviado_inicial', toques = toques + 1,
          enviado_en = ?, updated_at = ?, ultimo_error = NULL WHERE phone = ?`)
        .run(ahora, ahora, contacto.phone);
      this.registrarEvento(contacto.phone, esToque2 ? 'campana_toque2' : 'campana_envio');
      // espaciado: posterga la hora sugerida del siguiente contacto si va muy pegado
      this.espaciarSiguiente();
    } catch (e) {
      this.store.db.prepare(`
        UPDATE campana_contactos SET estado = 'error', ultimo_error = ?, updated_at = ?
        WHERE phone = ?`).run(e.message, ahora, contacto.phone);
      console.error(`[Campaña] Error enviando a ${contacto.phone}:`, e.message);
    }
  }

  espaciarSiguiente() {
    // aleatoriza la hora del siguiente 'pendiente' de hoy para no disparar en ráfaga
    const min = this.cfg.interMin, max = this.cfg.interMax;
    const delta = min + Math.floor(Math.random() * Math.max(1, max - min));
    const { fecha } = this.ahoraLocal();
    const proximo = this.store.db.prepare(`
      SELECT phone, hora_sugerida FROM campana_contactos
      WHERE estado = 'pendiente' AND fecha_asignada = ?
      ORDER BY hora_sugerida LIMIT 1`).get(fecha);
    if (!proximo) return;
    const [h, m] = proximo.hora_sugerida.split(':').map(Number);
    let minutos = h * 60 + m + Math.round(delta / 60000);
    minutos = Math.min(Math.max(minutos, 8 * 60 + 45), 17 * 60 + 25);  // clamp
    const nueva = `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
    this.store.db.prepare(
      'UPDATE campana_contactos SET hora_sugerida = ?, updated_at = ? WHERE phone = ?')
      .run(nueva, Date.now(), proximo.phone);
  }

  registrarEvento(phone, tipo, meta = null) {
    try {
      this.store.db.prepare(
        'INSERT INTO crm_eventos (phone, ts, tipo, meta) VALUES (?, ?, ?, ?)')
        .run(phone, Date.now(), tipo, meta);
    } catch (e) { /* crm_eventos aún no existe */ }
  }

  // --------------------------------------------------- respuestas del cliente
  /**
   * Llamarlo ANTES del pipeline normal de Diana.
   * @returns {object|null} {accion, mensaje} — si maneja el mensaje, responder
   *          con mensaje y NO pasar el texto al LLM. Si devuelve null, el
   *          flujo normal continúa (p. ej. interesado → Diana toma el control).
   */
  responder(phone, texto) {
    const p = this.normalizarPhone(phone);
    const contacto = this.store.db.prepare(
      'SELECT * FROM campana_contactos WHERE phone = ?').get(p);
    if (!contacto || ['no_interesado', 'ya_cursando', 'sin_respuesta'].includes(contacto.estado)) return null;
    const t = String(texto || '').trim();
    if (!t) return null;
    const ahora = Date.now();

    // FIX v5 (auditoría): las respuestas de BOTÓN llegan como "boton: campaña_info"
    // y NO matcheaban los patrones de palabras (\binfo\b no coincide con
    // "campaña_info") → el clic se perdía y Diana respondía fuera de guion.
    const matchBoton = t.match(/^boton:\s*(.+)$/i);
    if (matchBoton) {
      const id = matchBoton[1].trim().toLowerCase();
      // Solo interceptamos botones de la campaña (id campaña_* / campana_* o
      // la degradación numerada "texto:N"). Los demás botones (menús de
      // Diana: area:, menu_*, llamada:) siguen su flujo normal.
      const esBotonCampana = /^(campa[nñ]a_|texto:[123])/.test(id);
      if (!esBotonCampana) return null;
      if (id.includes('info') || id === 'texto:1') {
        if (contacto.estado === 'interesado') return null;
        this.store.db.prepare(`
          UPDATE campana_contactos SET estado = 'interesado', respondio_en = ?, updated_at = ?
          WHERE phone = ?`).run(ahora, ahora, p);
        this.registrarEvento(p, 'campana_interesado', { via: 'boton' });
        return { accion: 'handoff_diana', mensaje: MENSAJES.masInfo };
      }
      if (id.includes('curso') || id === 'texto:2') {
        return this.cerrar(p, 'ya_cursando', MENSAJES.yaCursando, ahora);
      }
      return this.cerrar(p, 'no_interesado', MENSAJES.noMas, ahora);
    }

    // Si ya está en el flujo de Diana (interesado), solo interceptamos SALIR:
    // el resto de la conversación la maneja Diana sin respuestas fijas de campaña
    // (evita que un "sí" repetido vuelva a disparar el mensaje de masInfo).
    if (contacto.estado === 'interesado') {
      if (PATRONES_SALIDA.test(t)) return this.cerrar(p, 'no_interesado', MENSAJES.noMas, ahora);
      return null;
    }
    if (PATRONES_SALIDA.test(t)) return this.cerrar(p, 'no_interesado', MENSAJES.noMas, ahora);
    if (PATRON_CURSA.test(t) && contacto.toques >= 1) {
      return this.cerrar(p, 'ya_cursando', MENSAJES.yaCursando, ahora);
    }
    if (PATRON_INFO.test(t) && contacto.toques >= 1) {
      this.store.db.prepare(`
        UPDATE campana_contactos SET estado = 'interesado', respondio_en = ?, updated_at = ?
        WHERE phone = ?`).run(ahora, ahora, p);
      this.registrarEvento(p, 'campana_interesado');
      // Handoff: Diana (flujo normal del bot) continúa la conversación.
      return { accion: 'handoff_diana', mensaje: MENSAJES.masInfo };
    }
    // Cualquier otra respuesta libre de un contacto ya contactado → Diana continúa.
    if (contacto.toques >= 1 && contacto.estado === 'enviado_inicial') {
      this.store.db.prepare(`
        UPDATE campana_contactos SET estado = 'interesado', respondio_en = ?, updated_at = ?
        WHERE phone = ?`).run(ahora, ahora, p);
      this.registrarEvento(p, 'campana_respuesta_libre');
      return { accion: 'handoff_diana', mensaje: null };
    }
    return null;
  }

  cerrar(phone, estado, mensaje, ahora) {
    this.store.db.prepare(`
      UPDATE campana_contactos SET estado = ?, respondio_en = ?, updated_at = ?
      WHERE phone = ?`).run(estado, ahora, ahora, phone);
    this.registrarEvento(phone, `campana_${estado}`);
    console.log(`[Campaña] ${phone} → ${estado}`);
    return { accion: estado, mensaje };
  }

  // ------------------------------------------------------------- métricas
  resumen() {
    return this.store.db.prepare(`
      SELECT estado, COUNT(*) AS c FROM campana_contactos GROUP BY estado ORDER BY estado`).all();
  }
}

module.exports = { CampanaGrupos, MENSAJES, BOTONES, ESTADOS };
