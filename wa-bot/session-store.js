/**
 * SessionStore · v2 — CRM persistente con máquina de etapas, eventos y KPIs
 * ---------------------------------------------------------------------------
 * Novedades v2 (embudo 4 turnos del manual Diana):
 *
 *  FIX CRÍTICO — Persistencia: antes, un lead sin actividad por >24h era
 *  BORRADO de crm_leads (getHistory → clearSession borraba ambas tablas).
 *  Eso mataba el protocolo anti-visto (que necesita 5-7 días de vida) y
 *  rompía la regla de Cero Amnesia cuando el prospecto volvía al día
 *  siguiente. Ahora: el historial conversacional expira a las 24h (contexto
 *  LLM) pero la FICHA CRM sobrevive 180 días configurable.
 *
 *  - Máquina de etapas del embudo: lead_nuevo → lead_calificado →
 *    cedula_capturada → ficha_completa (+ sin_respuesta / objecion_cedula).
 *  - Tabla crm_eventos: bitácora de cada evento del embudo (turno, pdf,
 *    toque, objeción, recuperación) → alimenta los 8 KPIs del manual.
 *  - calcularKPIs(): métricas de la Sección 12 con metas y alertas.
 *  - listarLeads() + exportarCSV(): panel administrativo y ritual del lunes.
 *  - leadsParaToque(): consulta del programador anti-visto.
 *  - Contadores operativos: mensajes_usuario, mensajes_diana, tfpr_ms
 *    (tiempo de primera respuesta), toques_enviados, confirmado, origen.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const memoria = require('./memoria');
const fs = require('fs');

// Retención y ventanas (en ms)
const HISTORIAL_TTL_MS = 24 * 60 * 60 * 1000;          // contexto LLM: 24h
const LEAD_RETENCION_MS = 180 * 24 * 60 * 60 * 1000;   // ficha CRM: 180 días

// Etapas válidas del embudo (orden de avance)
const ETAPAS = ['lead_nuevo', 'lead_calificado', 'cedula_capturada', 'ficha_completa'];

// Columnas añadidas en v2 (migración automática sobre bases existentes)
const COLUMNAS_V2 = [
  ['ruta', 'TEXT'],
  ['push_name', 'TEXT'],
  ['origen', "TEXT DEFAULT 'web'"],
  ['mensajes_usuario', 'INTEGER DEFAULT 0'],
  ['mensajes_diana', 'INTEGER DEFAULT 0'],
  ['primer_msg_ts', 'INTEGER'],
  ['ultimo_msg_usuario_ts', 'INTEGER'],
  ['ultimo_msg_diana_ts', 'INTEGER'],
  ['tfpr_ms', 'INTEGER'],
  ['toques_enviados', 'INTEGER DEFAULT 0'],
  ['ultimo_toque_ts', 'INTEGER'],
  ['confirmado', 'INTEGER DEFAULT 0'],
  ['recordatorio_enviado', 'INTEGER DEFAULT 0'],
  ['llamada_agendada_horario', 'TEXT'],
  ['llamada_agendada_ts', 'INTEGER'],
  ['llamada_estado', "TEXT DEFAULT 'ninguna'"]
];

class SessionStore {
  constructor(dbPath = null) {
    const defaultPath = path.join(__dirname, 'data', 'sessions.db');
    this.dbFilePath = dbPath || process.env.DB_PATH || defaultPath;

    const dir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new DatabaseSync(this.dbFilePath);
    this.init();
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        phone TEXT PRIMARY KEY,
        history TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions (updated_at);

      CREATE TABLE IF NOT EXISTS crm_leads (
        phone TEXT PRIMARY KEY,
        nombre TEXT,
        ciudad TEXT,
        perfil TEXT,
        carrera TEXT,
        cedula TEXT,
        triptico_enviado INTEGER DEFAULT 0,
        beneficio TEXT,
        etapa TEXT DEFAULT 'lead_nuevo',
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_crm_leads_updated_at ON crm_leads (updated_at);

      CREATE TABLE IF NOT EXISTS crm_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        ts INTEGER NOT NULL,
        tipo TEXT NOT NULL,
        meta TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_eventos_phone_ts ON crm_eventos (phone, ts);
      CREATE INDEX IF NOT EXISTS idx_eventos_tipo_ts ON crm_eventos (tipo, ts);
    `);

    // Migración v2: añadir columnas nuevas sin romper bases existentes
    for (const [col, tipo] of COLUMNAS_V2) {
      try {
        this.db.exec(`ALTER TABLE crm_leads ADD COLUMN ${col} ${tipo}`);
      } catch (e) {
        if (!/duplicate column/i.test(String(e.message))) throw e;
      }
    }
  }

  // ============================================================
  // HISTORIAL CONVERSACIONAL (contexto del LLM)
  // ============================================================

  getHistory(phone, maxAgeMs = HISTORIAL_TTL_MS) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare('SELECT history, updated_at FROM sessions WHERE phone = ?');
    const row = stmt.get(cleanPhone);

    if (!row) return [];

    const now = Date.now();
    if (now - row.updated_at > maxAgeMs) {
      // FIX v2: expira SOLO el historial; la ficha CRM sobrevive
      this.borrarHistorial(cleanPhone);
      return [];
    }

    try {
      return JSON.parse(row.history);
    } catch (err) {
      console.error(`[SessionStore] Error parseando historial para ${cleanPhone}:`, err);
      return [];
    }
  }

  appendMessage(phone, role, content) {
    const cleanPhone = String(phone).trim();
    const history = this.getHistory(cleanPhone);
    history.push({ role, content });

    // Limitar historial a los últimos 20 turnos y presupuesto seguro de 8.000 caracteres (M9)
    let trimmedHistory = history.slice(-20);
    let totalChars = trimmedHistory.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
    while (trimmedHistory.length > 2 && totalChars > 8000) {
      const removed = trimmedHistory.shift();
      totalChars -= (removed.content ? removed.content.length : 0);
    }
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO sessions (phone, history, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        history = excluded.history,
        updated_at = excluded.updated_at
    `);
    stmt.run(cleanPhone, JSON.stringify(trimmedHistory), now);
  }

  borrarHistorial(phone) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare('DELETE FROM sessions WHERE phone = ?');
    stmt.run(cleanPhone);
  }

  // ============================================================
  // FICHA CRM DEL LEAD
  // ============================================================

  getLead(phone) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare('SELECT * FROM crm_leads WHERE phone = ?');
    const row = stmt.get(cleanPhone);
    if (!row) return null;
    return {
      phone: row.phone,
      nombre: row.nombre || null,
      ciudad: row.ciudad || null,
      perfil: row.perfil || null,
      carrera: row.carrera || null,
      cedula: row.cedula || null,
      triptico_enviado: Boolean(row.triptico_enviado),
      beneficio: row.beneficio || null,
      etapa: row.etapa || 'lead_nuevo',
      ruta: row.ruta || null,
      push_name: row.push_name || null,
      origen: row.origen || 'web',
      mensajes_usuario: row.mensajes_usuario || 0,
      mensajes_diana: row.mensajes_diana || 0,
      primer_msg_ts: row.primer_msg_ts || null,
      ultimo_msg_usuario_ts: row.ultimo_msg_usuario_ts || null,
      ultimo_msg_diana_ts: row.ultimo_msg_diana_ts || null,
      tfpr_ms: row.tfpr_ms || null,
      toques_enviados: row.toques_enviados || 0,
      ultimo_toque_ts: row.ultimo_toque_ts || null,
      confirmado: Boolean(row.confirmado),
      recordatorio_enviado: Boolean(row.recordatorio_enviado),
      llamada_agendada_horario: row.llamada_agendada_horario || null,
      llamada_agendada_ts: row.llamada_agendada_ts || null,
      llamada_estado: row.llamada_estado || 'ninguna',
      updated_at: row.updated_at
    };
  }

  obtenerOCrearLead(phone, extra = {}) {
    const cleanPhone = String(phone).trim();
    let lead = this.getLead(cleanPhone);
    if (!lead) {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO crm_leads (phone, etapa, origen, updated_at)
        VALUES (?, 'lead_nuevo', ?, ?)
      `);
      stmt.run(cleanPhone, extra.origen || 'web', now);
      lead = this.getLead(cleanPhone);
      this.registrarEvento(cleanPhone, 'chat_abierto', { origen: extra.origen || 'web' });
    }
    return lead;
  }

  actualizarLead(phone, patch = {}) {
    const cleanPhone = String(phone).trim();
    const current = this.obtenerOCrearLead(cleanPhone);

    // El extractor puede mandar claves internas (_objecion); no persistirlas
    const limpia = { ...patch };
    delete limpia._objecion;

    const updated = { ...current, ...limpia, updated_at: Date.now() };

    const stmt = this.db.prepare(`
      UPDATE crm_leads
      SET nombre = ?, ciudad = ?, perfil = ?, carrera = ?, cedula = ?,
          triptico_enviado = ?, beneficio = ?, etapa = ?, updated_at = ?,
          ruta = ?, push_name = ?, origen = ?,
          mensajes_usuario = ?, mensajes_diana = ?,
          primer_msg_ts = ?, ultimo_msg_usuario_ts = ?, ultimo_msg_diana_ts = ?,
          tfpr_ms = ?, toques_enviados = ?, ultimo_toque_ts = ?,
          confirmado = ?, recordatorio_enviado = ?,
          llamada_agendada_horario = ?, llamada_agendada_ts = ?, llamada_estado = ?
      WHERE phone = ?
    `);

    stmt.run(
      updated.nombre, updated.ciudad, updated.perfil, updated.carrera, updated.cedula,
      updated.triptico_enviado ? 1 : 0, updated.beneficio, updated.etapa, updated.updated_at,
      updated.ruta, updated.push_name, updated.origen,
      updated.mensajes_usuario, updated.mensajes_diana,
      updated.primer_msg_ts, updated.ultimo_msg_usuario_ts, updated.ultimo_msg_diana_ts,
      updated.tfpr_ms, updated.toques_enviados, updated.ultimo_toque_ts,
      updated.confirmado ? 1 : 0, updated.recordatorio_enviado ? 1 : 0,
      updated.llamada_agendada_horario || null, updated.llamada_agendada_ts || null, updated.llamada_estado || 'ninguna',
      cleanPhone
    );

    return updated;
  }

  /**
   * Avance automático de etapa según los slots capturados (manual · Sección 02).
   * Se invoca después de cada actualización; nunca hace retroceder una etapa
   * avanzada salvo transiciones explícitas (sin_respuesta, objecion_cedula).
   */
  avanzarEtapa(phone) {
    const lead = this.getLead(phone);
    if (!lead) return null;

    const etapaActual = lead.etapa;
    let nuevaEtapa = etapaActual;

    if (lead.confirmado && lead.cedula) {
      nuevaEtapa = 'ficha_completa';
    } else if (lead.cedula) {
      nuevaEtapa = 'cedula_capturada';
    } else if (lead.nombre && lead.ciudad && lead.perfil) {
      nuevaEtapa = 'lead_calificado';
    } else {
      nuevaEtapa = 'lead_nuevo';
    }

    // Estados laterales:
    //  - 'en_espera_humano' es pegajoso: solo el equipo humano lo libera
    //    (POST /api/lead/:phone) para que no lo pise el avance automático.
    //  - 'sin_respuesta' SÍ se revierte si el prospecto vuelve a escribir.
    if (etapaActual === 'en_espera_humano') {
      return etapaActual;
    }

    const idx = (e) => ETAPAS.indexOf(e);
    if (nuevaEtapa !== etapaActual && (idx(nuevaEtapa) > idx(etapaActual) || !ETAPAS.includes(etapaActual))) {
      this.actualizarLead(phone, { etapa: nuevaEtapa });
      this.registrarEvento(phone, 'etapa', { de: etapaActual, a: nuevaEtapa });
      return nuevaEtapa;
    }
    return etapaActual;
  }

  // ============================================================
  // EVENTOS DEL EMBUDO (bitácora para KPIs · manual Sección 12)
  // ============================================================

  registrarEvento(phone, tipo, meta = {}) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare(
      'INSERT INTO crm_eventos (phone, ts, tipo, meta) VALUES (?, ?, ?, ?)'
    );
    stmt.run(cleanPhone, Date.now(), tipo, JSON.stringify(meta || {}));
  }

  listarEventos(phone, desdeTs = 0) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare(
      'SELECT * FROM crm_eventos WHERE phone = ? AND ts >= ? ORDER BY ts ASC'
    );
    return stmt.all(cleanPhone, desdeTs).map(r => ({
      ...r,
      meta: (() => { try { return JSON.parse(r.meta || '{}'); } catch { return {}; } })()
    }));
  }

  // ============================================================
  // KPIs DEL EMBUDO (manual · Sección 12)
  // ============================================================

  calcularKPIs(dias = 7) {
    const hasta = Date.now();
    const desde = hasta - dias * 24 * 60 * 60 * 1000;

    const leads = this.db.prepare(
      'SELECT * FROM crm_leads WHERE COALESCE(primer_msg_ts, updated_at) >= ? AND COALESCE(primer_msg_ts, updated_at) <= ?'
    ).all(desde, hasta);

    const contarEventos = (tipo, metaFiltro = null) => {
      const rows = this.db.prepare(
        'SELECT phone, meta FROM crm_eventos WHERE tipo = ? AND ts >= ? AND ts <= ?'
      ).all(tipo, desde, hasta);
      if (!metaFiltro) return rows;
      return rows.filter(r => {
        try {
          const m = JSON.parse(r.meta || '{}');
          return Object.entries(metaFiltro).every(([k, v]) => m[k] === v);
        } catch { return false; }
      });
    };

    const chatsAbiertos = leads.filter(l => l.mensajes_usuario >= 1);
    const respondieronFiltro = leads.filter(l => l.mensajes_usuario >= 2); // T1→T2
    const conIdentidad = leads.filter(l => l.nombre && l.ciudad);
    const conPerfil = leads.filter(l => l.perfil);
    const conCedula = leads.filter(l => l.cedula);
    const fichas = leads.filter(l => l.confirmado);

    const toques1 = contarEventos('toque', { n: 1 });
    const recuperados = contarEventos('recuperado');
    const tagsPdf = contarEventos('pdf_tag');
    const pdfsOk = contarEventos('pdf_enviado', { ok: true });
    const conRuta = leads.filter(l => l.ruta);

    // Tiempo de primera respuesta (solo llegadas en franja 08h00–20h00)
    const tfprs = leads
      .filter(l => l.tfpr_ms && l.primer_msg_ts)
      .filter(l => {
        const h = new Date(l.primer_msg_ts).getHours();
        return h >= 8 && h < 20;
      })
      .map(l => l.tfpr_ms / 60000);
    const tfprProm = tfprs.length ? (tfprs.reduce((a, b) => a + b, 0) / tfprs.length) : null;

    const pct = (num, den) => (den > 0 ? num / den : null);
    const estado = (valor, meta, alerta) => {
      if (valor === null) return 'sin_datos';
      if (valor >= meta) return 'ok';
      if (valor >= alerta) return 'vigilar';
      return 'alerta';
    };

    const kpis = [
      {
        id: 't1_t2', nombre: 'Respuesta T1→T2 (filtro de 3 rutas)',
        valor: pct(respondieronFiltro.length, chatsAbiertos.length),
        meta: 0.70, alerta: 0.55,
        detalle: `${respondieronFiltro.length}/${chatsAbiertos.length} leads respondieron el filtro`
      },
      {
        id: 'identidad', nombre: 'Identidad en ≤3 intercambios (nombre + ciudad)',
        valor: pct(conIdentidad.length, respondieronFiltro.length),
        meta: 0.60, alerta: 0.45,
        detalle: `${conIdentidad.length}/${respondieronFiltro.length} leads con identidad`
      },
      {
        id: 'cedula', nombre: 'Cédula en ≤4 turnos (con beneficio)',
        valor: pct(conCedula.length, conPerfil.length),
        meta: 0.45, alerta: 0.30,
        detalle: `${conCedula.length}/${conPerfil.length} leads calificados entregaron cédula`
      },
      {
        id: 'ficha', nombre: 'Ficha de admisión completa (T4)',
        valor: pct(fichas.length, chatsAbiertos.length),
        meta: 0.30, alerta: 0.18,
        detalle: `${fichas.length}/${chatsAbiertos.length} fichas confirmadas`
      },
      {
        id: 'tfpr', nombre: 'Tiempo de primera respuesta (08h–20h)',
        valor: tfprProm, meta: 5, alerta: 15, invertido: true, unidad: 'min',
        detalle: tfprProm === null ? 'sin datos' : `promedio ${tfprProm.toFixed(1)} min`
      },
      {
        id: 'recuperacion', nombre: 'Recuperación de "en visto" (toques 24h)',
        valor: pct(recuperados.length, toques1.length),
        meta: 0.25, alerta: 0.15,
        detalle: `${recuperados.length}/${toques1.length} toques recuperaron el chat`
      },
      {
        id: 'pdf', nombre: 'Precisión de etiquetas [PDF:]',
        valor: pct(pdfsOk.length, tagsPdf.length),
        meta: 0.98, alerta: 0.95,
        detalle: `${pdfsOk.length}/${tagsPdf.length} tags despacharon tríptico`
      },
      {
        id: 'etiquetado', nombre: 'Etiquetado CRM (ruta asignada)',
        valor: pct(conRuta.length, chatsAbiertos.length),
        meta: 1.00, alerta: 0.90,
        detalle: `${conRuta.length}/${chatsAbiertos.length} leads con ruta`
      }
    ].map(k => ({
      ...k,
      valor: k.valor === null ? null : Number(k.valor.toFixed(4)),
      estado: k.invertido
        ? (k.valor === null ? 'sin_datos' : (k.valor <= k.meta ? 'ok' : (k.valor <= k.alerta ? 'vigilar' : 'alerta')))
        : estado(k.valor, k.meta, k.alerta)
    }));

    return {
      periodo: { dias, desde: new Date(desde).toISOString(), hasta: new Date(hasta).toISOString() },
      volumetria: {
        chatsAbiertos: chatsAbiertos.length,
        respondieronFiltro: respondieronFiltro.length,
        conIdentidad: conIdentidad.length,
        conPerfil: conPerfil.length,
        conCedula: conCedula.length,
        fichasCompletas: fichas.length,
        toquesEnviados: contarEventos('toque').length,
        objeciones: contarEventos('objecion').length
      },
      embudo: {
        t1_respondieron: respondieronFiltro.length,
        t2_identidad: conIdentidad.length,
        t3_cedula: conCedula.length,
        t4_ficha: fichas.length
      },
      kpis
    };
  }

  // ============================================================
  // PANEL ADMINISTRATIVO / EXPORTACIÓN
  // ============================================================

  listarLeads(filtros = {}) {
    const { etapa = null, ruta = null, conCedula = false, limit = 200, offset = 0 } = filtros;
    let sql = 'SELECT * FROM crm_leads WHERE 1=1';
    const args = [];
    if (etapa) { sql += ' AND etapa = ?'; args.push(etapa); }
    if (ruta) { sql += ' AND ruta = ?'; args.push(ruta); }
    if (conCedula) { sql += ' AND cedula IS NOT NULL'; }
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);
    return this.db.prepare(sql).all(...args).map(r => ({
      ...r,
      triptico_enviado: Boolean(r.triptico_enviado),
      confirmado: Boolean(r.confirmado)
    }));
  }

  exportarCSV(dias = 7) {
    const desde = Date.now() - dias * 24 * 60 * 60 * 1000;
    const rows = this.db.prepare(
      'SELECT * FROM crm_leads WHERE COALESCE(primer_msg_ts, updated_at) >= ? ORDER BY updated_at DESC'
    ).all(desde);

    const cols = ['phone', 'nombre', 'ciudad', 'perfil', 'ruta', 'carrera', 'cedula',
      'etapa', 'beneficio', 'confirmado', 'triptico_enviado', 'toques_enviados',
      'mensajes_usuario', 'push_name', 'origen', 'primer_msg_ts', 'updated_at'];

    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const lineas = [cols.join(';')];
    for (const r of rows) {
      lineas.push(cols.map(c => esc(r[c])).join(';'));
    }
    return lineas.join('\n');
  }

  // ============================================================
  // CONSULTA PARA EL PROGRAMADOR ANTI-VISTO (followup-scheduler)
  // ============================================================

  /**
   * Candidatos a toque anti-visto (manual · protocolo de 3 toques):
   *  - solo leads de WhatsApp (origen real, no simulador)
   *  - con al menos 1 mensaje del aspirante
   *  - sin confirmar la ficha y sin cédula capturada que ya esté en T4
   *  - que NO hayan escrito de nuevo desde su último mensaje
   * El scheduler decide si ya corresponde el toque N según las ventanas.
   */
  leadsParaToque(ahoraTs = Date.now()) {
    return this.db.prepare(`
      SELECT * FROM crm_leads
      WHERE origen = 'whatsapp'
        AND phone NOT LIKE 'simulador%'
        AND ultimo_msg_usuario_ts IS NOT NULL
        AND toques_enviados < 3
        AND etapa NOT IN ('sin_respuesta', 'ficha_completa', 'en_espera_humano')
        AND (
          (ultimo_toque_ts IS NULL AND ultimo_msg_usuario_ts <= ?)
          OR (ultimo_toque_ts IS NOT NULL AND ultimo_toque_ts <= ?)
        )
    `).all(
      ahoraTs - (24 * 60 * 60 * 1000),
      ahoraTs - (24 * 60 * 60 * 1000)
    );
  }

  /**
   * Fichas confirmadas pendientes de recordatorio de 48h del siguiente paso
   * (inscripción / documentos / reserva) — manual · Sección 06.
   */
  leadsParaRecordatorio(ahoraTs = Date.now()) {
    return this.db.prepare(`
      SELECT * FROM crm_leads
      WHERE origen = 'whatsapp'
        AND etapa = 'ficha_completa'
        AND confirmado = 1
        AND recordatorio_enviado = 0
        AND (
          COALESCE(ultimo_msg_usuario_ts, 0) <= ?
          AND COALESCE(ultimo_msg_usuario_ts, 0) >= ?
        )
    `).all(
      ahoraTs - (48 * 60 * 60 * 1000),
      ahoraTs - (14 * 24 * 60 * 60 * 1000) // no revivir fichas de hace más de 2 semanas
    );
  }

  // ============================================================
  // FICHA CRM PARA EL PROMPT (inyección inmutable · Cero Amnesia)
  // ============================================================

  formatearFichaParaPrompt(lead) {
    if (!lead) return '';
    const n = lead.nombre
      ? `${lead.nombre} [REGISTRADO - PROHIBIDO VOLVER A PREGUNTAR]`
      : '[PENDIENTE]';
    const c = lead.ciudad
      ? `${lead.ciudad} [REGISTRADA - PROHIBIDO VOLVER A PREGUNTAR]`
      : '[PENDIENTE]';
    const etiquetasPerfil = {
      bachiller: 'Bachiller sin experiencia (Grado regular)',
      normalista: 'Docente normalista/pedagógico (Califica PE-12)',
      docente: 'Docente (confirmar años de experiencia)',
      docente_4anos: 'Docente/worker con 4+ años de experiencia (Califica PE-15)',
      tercer_nivel: 'Profesional con título de tercer nivel (Maestría)'
    };
    const p = lead.perfil
      ? `${lead.perfil} — ${etiquetasPerfil[lead.perfil] || lead.perfil} [REGISTRADO - PROHIBIDO VOLVER A PREGUNTAR]`
      : '[PENDIENTE]';
    const cr = lead.carrera === 'Ingenierías'
      ? 'Ingenierías [ÁREA/FACULTAD - NO ES UNA CARRERA INDIVIDUAL: DEBES PRESENTAR LAS OPCIONES DE INGENIERÍA Y PREGUNTAR CUÁL PREFIERE]'
      : lead.carrera
      ? `${lead.carrera} [CARRERA ACTIVA - ENFÓCATE EN ESTA]`
      : '[NO DEFINIDA]';
    const cd = lead.cedula
      ? `${lead.cedula} [REGISTRADA - BENEFICIO: ${lead.beneficio || 'activo'} - PROHIBIDO PEDIR FOTO O VOLVER A PREGUNTAR]`
      : '[PENDIENTE]';
    const tr = lead.triptico_enviado ? 'SÍ (Entregado)' : 'PENDIENTE DE ENVÍO';
    const rt = lead.ruta ? lead.ruta.toUpperCase() : 'SIN DEFINIR';

    // Siguiente paso según etapa (manual · Secciones 02-06)
    let objetivo;
    if (lead.confirmado && lead.cedula) {
      objetivo = 'POST-CIERRE: la ficha YA fue confirmada. NO vuelvas a vender ni a re-confirmar. ';
      if (lead.ruta === 'grado') {
        objetivo += `Ofrece el enlace de inscripción ($100) y la nivelación PRE ($150, 6 semanas). ${process.env.LINK_INSCRIPCION_GRADO ? `Si lo pide, envía este enlace oficial: ${process.env.LINK_INSCRIPCION_GRADO}` : ''}`;
      } else if (lead.ruta === 'validacion') {
        objetivo += `Ofrece la checklist documental (certificado laboral con membrete + declaración juramentada notariada; en Educación sirve mecanizado IESS). ${process.env.LINK_CHECKLIST_VALIDACION ? `Checklist oficial: ${process.env.LINK_CHECKLIST_VALIDACION}` : ''}`;
      } else if (lead.ruta === 'maestria') {
        objetivo += `Confirma la reserva de cupo del próximo ciclo: empieza con la primera cuota mensual, sin inscripción. ${process.env.LINK_RESERVA_MAESTRIA ? `Enlace de reserva: ${process.env.LINK_RESERVA_MAESTRIA}` : ''}`;
      } else {
        objetivo += 'Concreta el siguiente paso (inscripción, checklist o reserva según su programa).';
      }
    } else if (lead.cedula) {
      objetivo = 'TURNO 4: Cédula capturada. Confirma que tiene activo el BENEFICIO DE PRONTO PAGO real (indicando su cuota con pronto pago vs cuota regular). Pide confirmación para apartar el cupo: "¿Te aparto el cupo del ciclo? 🙌". PROHIBIDO pedir fotos de cédula o mencionar exoneración de matrícula.';
    } else if (lead.nombre && lead.ciudad && lead.perfil) {
      objetivo = 'TURNO 3: Entrega valor primero (programa encajado + cuota oficial), adjunta [PDF: Programa] y pide la cédula para revisar si aplica a beneficios institucionales y apartar cupo por 72h.';
    } else {
      objetivo = 'TURNO 1-2: Capta ruta de interés (carrera / titular experiencia / maestría), nombre, ciudad y perfil (colegio / experiencia / título). Pide UN dato a la vez, el que falte.';
    }

    return `=======================================================
FICHA CRM ACTIVA DEL CLIENTE (CONSULTA OBLIGATORIA):
=======================================================
• Etapa del embudo: ${lead.etapa || 'lead_nuevo'}
• Ruta: ${rt}
• Nombre: ${n}
• Ciudad: ${c}
• Perfil de Estudios: ${p}
• Carrera de Interés: ${cr}
• Cédula: ${cd}
• Tríptico Oficial: ${tr}
• Llamada Asesor Agendada: ${lead.llamada_agendada_horario ? `${lead.llamada_agendada_horario} (${lead.llamada_estado || 'pendiente'})` : 'NO SOLICITADA'}
• Toques anti-visto ya enviados por el sistema: ${lead.toques_enviados || 0} (NO los repitas manualmente)
• Siguiente Paso: ${objetivo}
=======================================================
REGLAS INMUTABLES:
1. Todo dato marcado como [REGISTRADO] NUNCA debe volver a pedirse.
2. PROHIBICIÓN ESTRICTA: JAMÁS pidas fotos de la cédula ni fotos de documentos por WhatsApp. Con el número de 10 dígitos es suficiente.
3. Si el aspirante expresa objeción de precio o desconfianza por la cédula, aplica las fórmulas del manual (validar → reencuadrar → cerrar con pregunta) y NO insistas dos veces seguidas.`;
  }

  // ============================================================
  // LIMPIEZA Y CICLO DE VIDA
  // ============================================================

  clearSession(phone) {
    // FIX v2: compatible con el uso original del simulador (borra todo),
    // pero el borrado de la FICHA CRM ahora es explícito y separado.
    const cleanPhone = String(phone).trim();
    this.borrarHistorial(cleanPhone);
  }

  borrarLead(phone) {
    const cleanPhone = String(phone).trim();
    this.borrarHistorial(cleanPhone);
    const stmt = this.db.prepare('DELETE FROM crm_leads WHERE phone = ?');
    stmt.run(cleanPhone);
    const stmtE = this.db.prepare('DELETE FROM crm_eventos WHERE phone = ?');
    stmtE.run(cleanPhone);
    memoria.borrarFicha(cleanPhone);
  }

  cleanStaleSessions(maxAgeMs = HISTORIAL_TTL_MS) {
    // FIX v2: solo purga historial conversacional caducado.
    // La ficha CRM ya NO se toca aquí (antes se borraba: bug del embudo).
    const cutoff = Date.now() - maxAgeMs;
    const stmt = this.db.prepare('DELETE FROM sessions WHERE updated_at < ?');
    const result = stmt.run(cutoff);
    return result.changes;
  }

  purgarLeadsAntiguos(maxAgeMs = LEAD_RETENCION_MS) {
    // Purga programada (semanal) de fichas inactivas: retención 180 días.
    const cutoff = Date.now() - maxAgeMs;
    const stmt = this.db.prepare('DELETE FROM crm_leads WHERE updated_at < ? AND confirmado = 0');
    const stmtE = this.db.prepare('DELETE FROM crm_eventos WHERE ts < ?');
    const result = stmt.run(cutoff);
    stmtE.run(cutoff);
    return result.changes;
  }

  listarLlamadasAgendadas() {
    try {
      const stmt = this.db.prepare(`
        SELECT phone, nombre, ciudad, carrera, ruta, llamada_agendada_horario, llamada_agendada_ts, llamada_estado, updated_at
        FROM crm_leads
        WHERE llamada_agendada_horario IS NOT NULL AND llamada_estado != 'cancelada'
        ORDER BY updated_at DESC
      `);
      return stmt.all();
    } catch (e) {
      return [];
    }
  }

  close() {
    this.db.close();
  }
}

module.exports = SessionStore;
