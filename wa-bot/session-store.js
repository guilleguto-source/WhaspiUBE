const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

class SessionStore {
  constructor(dbPath = null) {
    const defaultPath = path.join(__dirname, 'data', 'sessions.db');
    this.dbFilePath = dbPath || process.env.DB_PATH || defaultPath;
    
    // Asegurar directorio padre
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
    `);
  }

  getHistory(phone, maxAgeMs = 24 * 60 * 60 * 1000) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare('SELECT history, updated_at FROM sessions WHERE phone = ?');
    const row = stmt.get(cleanPhone);

    if (!row) {
      return [];
    }

    const now = Date.now();
    if (now - row.updated_at > maxAgeMs) {
      this.clearSession(cleanPhone);
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

    // Limitar historial a los ultimos 20 turnos para optimizar contexto
    const trimmedHistory = history.slice(-20);
    const now = Date.now();
    const payload = JSON.stringify(trimmedHistory);

    const stmt = this.db.prepare(`
      INSERT INTO sessions (phone, history, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET
        history = excluded.history,
        updated_at = excluded.updated_at
    `);
    stmt.run(cleanPhone, payload, now);
  }

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
      updated_at: row.updated_at
    };
  }

  obtenerOCrearLead(phone) {
    const cleanPhone = String(phone).trim();
    let lead = this.getLead(cleanPhone);
    if (!lead) {
      const now = Date.now();
      const insertStmt = this.db.prepare(`
        INSERT INTO crm_leads (phone, etapa, updated_at)
        VALUES (?, 'lead_nuevo', ?)
      `);
      insertStmt.run(cleanPhone, now);
      lead = {
        phone: cleanPhone,
        nombre: null,
        ciudad: null,
        perfil: null,
        carrera: null,
        cedula: null,
        triptico_enviado: false,
        beneficio: null,
        etapa: 'lead_nuevo',
        updated_at: now
      };
    }
    return lead;
  }

  actualizarLead(phone, patch = {}) {
    const cleanPhone = String(phone).trim();
    const current = this.obtenerOCrearLead(cleanPhone);
    const updated = { ...current, ...patch, updated_at: Date.now() };

    const stmt = this.db.prepare(`
      UPDATE crm_leads
      SET nombre = ?, ciudad = ?, perfil = ?, carrera = ?, cedula = ?,
          triptico_enviado = ?, beneficio = ?, etapa = ?, updated_at = ?
      WHERE phone = ?
    `);

    stmt.run(
      updated.nombre,
      updated.ciudad,
      updated.perfil,
      updated.carrera,
      updated.cedula,
      updated.triptico_enviado ? 1 : 0,
      updated.beneficio,
      updated.etapa,
      updated.updated_at,
      cleanPhone
    );

    return updated;
  }

  formatearFichaParaPrompt(lead) {
    if (!lead) return '';
    const n = lead.nombre ? `${lead.nombre} [REGISTRADO - PROHIBIDO VOLVER A PREGUNTAR]` : '[PENDIENTE]';
    const c = lead.ciudad ? `${lead.ciudad} [REGISTRADA - PROHIBIDO VOLVER A PREGUNTAR]` : '[PENDIENTE]';
    const p = lead.perfil ? `${lead.perfil} [REGISTRADO - PROHIBIDO VOLVER A PREGUNTAR]` : '[PENDIENTE]';
    const cr = lead.carrera ? `${lead.carrera} [CARRERA ACTIVA - ENFÓCATE EN ESTA]` : '[NO DEFINIDA]';
    const cd = lead.cedula ? `${lead.cedula} [REGISTRADA - BENEFICIO ACTIVADO - PROHIBIDO PEDIR FOTO O VOLVER A PREGUNTAR]` : '[PENDIENTE]';
    const tr = lead.triptico_enviado ? 'SÍ (Entregado)' : 'PENDIENTE DE ENVÍO';

    let objetivo = 'TURNO 1 o 2: Diagnosticar carrera, perfil (bachiller/experiencia), nombre y ciudad.';
    if (lead.carrera && lead.nombre && lead.ciudad && !lead.cedula) {
      objetivo = 'TURNO 3: Entregar plan ($140/mes pronto pago), adjuntar [PDF: Carrera] y pedir cédula para congelar arancel por 72h.';
    } else if (lead.cedula) {
      objetivo = 'TURNO 4: Cédula capturada y arancel congelado por 72h. Confirma la ficha y pregunta: "¿Todo en orden? ¿Te aparto el cupo del ciclo? 🙌". PROHIBIDO pedir fotos de cédula, fotos de título o documentos.';
    }

    return `=======================================================
FICHA CRM ACTIVA DEL CLIENTE (CONSULTA OBLIGATORIA):
=======================================================
• Nombre: ${n}
• Ciudad: ${c}
• Perfil de Estudios: ${p}
• Carrera de Interés: ${cr}
• Cédula: ${cd}
• Tríptico Oficial: ${tr}
• Siguiente Paso: ${objetivo}
=======================================================
REGLAS INMUTABLES:
1. Todo dato marcado como [REGISTRADO] NUNCA debe volver a pedirse.
2. PROHIBICIÓN ESTRICTA: JAMÁS pidas fotos de la cédula ni fotos de documentos por WhatsApp. Con el número de 10 dígitos es suficiente.`;
  }

  clearSession(phone) {
    const cleanPhone = String(phone).trim();
    const stmt = this.db.prepare('DELETE FROM sessions WHERE phone = ?');
    stmt.run(cleanPhone);
    const stmtCrm = this.db.prepare('DELETE FROM crm_leads WHERE phone = ?');
    stmtCrm.run(cleanPhone);
  }

  cleanStaleSessions(maxAgeMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs;
    const stmt = this.db.prepare('DELETE FROM sessions WHERE updated_at < ?');
    const result = stmt.run(cutoff);
    const stmtCrm = this.db.prepare('DELETE FROM crm_leads WHERE updated_at < ?');
    stmtCrm.run(cutoff);
    return result.changes;
  }

  close() {
    this.db.close();
  }
}

module.exports = SessionStore;
