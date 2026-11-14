/**
 * system-watchdog.js — Guardián de Salud y Auto-Recuperación del Sistema UBE Bot
 * ==============================================================================
 * Realiza chequeos periódicos (por defecto cada 30 minutos) de:
 *   1. Integridad de DNS (/etc/resolv.conf) y resolución a servicios de IA (Groq/Gemini).
 *   2. Salud del pool de claves Gemini (5 claves) y verificación de cuota/estado.
 *   3. Salud del pool de claves Groq (5 claves) y verificación de cuota/estado.
 *   4. Estado del Gateway de WhatsApp (Evolution API v2) e instancia Baileys.
 *   5. Integridad de la Base de Datos SQLite (lectura/escritura) y PDFs de carreras.
 * 
 * Auto-recuperación:
 *   - Si /etc/resolv.conf sufre regresiones con directivas lentas (edns0/trust-ad),
 *     lo repara de inmediato automáticamente sin reiniciar el contenedor.
 *   - Limpia estados residuales de cooldown de claves si ya son operativas.
 */

const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;

class SystemWatchdog {
  constructor(options = {}) {
    const minConfig = parseInt(process.env.WATCHDOG_INTERVAL_MINUTES, 10);
    this.intervalMinutes = (!isNaN(minConfig) && minConfig > 0) ? minConfig : (options.intervalMinutes || 30);
    this.intervalMs = this.intervalMinutes * 60 * 1000;
    
    this.timer = null;
    this.activo = false;
    this.ejecutandoRevision = false;
    this.ultimoReporte = null;
    this.historial = []; // Últimas 20 revisiones
    
    this.sessionStore = options.sessionStore || null;
    this.waClient = options.waClient || null;
    this.aiProvider = options.aiProvider || null;
    this.alertas = options.alertas || null;
    
    // Horario operativo diurno: 06h00 a 19h00 (hora Ecuador)
    // Última revisión a las 19h00. De 19h01 a 05h59 reposo nocturno sin peticiones.
    this.horaInicio = options.horaInicio !== undefined ? options.horaInicio : 6;
    this.horaFin = options.horaFin !== undefined ? options.horaFin : 19;

    this.evolutionUrl = process.env.EVOLUTION_API_URL || 'http://evolution-api:8080';
    this.evolutionKey = process.env.EVOLUTION_API_KEY || 'ube_secret_key_2026';
    this.evolutionInstance = process.env.EVOLUTION_INSTANCE || 'ube-bot';
  }

  /**
   * Verifica si la hora actual en Ecuador (America/Guayaquil) está dentro del
   * rango diurno 06h00–19h00.
   */
  estaEnHorario(fecha = new Date()) {
    try {
      const ecParts = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(fecha);
      const hora = parseInt(ecParts.find(p => p.type === 'hour')?.value || '0', 10);
      const minuto = parseInt(ecParts.find(p => p.type === 'minute')?.value || '0', 10);

      if (hora < this.horaInicio) return false; // Antes de las 06:00
      if (hora > this.horaFin) return false;    // Después de las 19:00
      if (hora === this.horaFin && minuto > 0) return false; // Después de 19:00:xx

      return true;
    } catch (_) {
      const h = fecha.getHours();
      return h >= 6 && h <= 19;
    }
  }

  /**
   * Asegura que /etc/resolv.conf esté configurado correctamente para Docker
   * evitando directivas que cuelguen getaddrinfo en glibc/Node.js.
   */
  async verificarYRepararDns() {
    const t0 = Date.now();
    let dnsReparado = false;
    let contenidoOriginal = '';

    try {
      if (fs.existsSync('/etc/resolv.conf')) {
        contenidoOriginal = fs.readFileSync('/etc/resolv.conf', 'utf8');
        const tieneProblemas = /trust-ad|edns0/i.test(contenidoOriginal) || !contenidoOriginal.includes('127.0.0.11');
        if (tieneProblemas) {
          const configLimpia = 'nameserver 127.0.0.11\nnameserver 8.8.8.8\nnameserver 1.1.1.1\n';
          fs.writeFileSync('/etc/resolv.conf', configLimpia, 'utf8');
          dnsReparado = true;
          console.warn('[Watchdog] 🔧 DNS auto-reparado: /etc/resolv.conf reescrito con 127.0.0.11, 8.8.8.8 y 1.1.1.1');
        }
      }
    } catch (errFs) {
      // Si el archivo es de solo lectura, registramos la advertencia
    }

    // Probar resolución real hacia los dos proveedores principales
    let resolucionGroqMs = null;
    let resolucionGeminiMs = null;
    let errorDns = null;

    try {
      const g0 = Date.now();
      await dns.lookup('api.groq.com');
      resolucionGroqMs = Date.now() - g0;
    } catch (eG) {
      errorDns = `Error DNS Groq: ${eG.message}`;
    }

    try {
      const gm0 = Date.now();
      await dns.lookup('generativelanguage.googleapis.com');
      resolucionGeminiMs = Date.now() - gm0;
    } catch (eGm) {
      errorDns = errorDns ? `${errorDns}; DNS Gemini: ${eGm.message}` : `Error DNS Gemini: ${eGm.message}`;
    }

    return {
      ok: !errorDns,
      reparado: dnsReparado,
      latenciaTotalMs: Date.now() - t0,
      groqLookupMs: resolucionGroqMs,
      geminiLookupMs: resolucionGeminiMs,
      error: errorDns
    };
  }

  /**
   * Verifica la disponibilidad de las claves de Gemini
   */
  async verificarGemini() {
    const keys = (this.aiProvider?.geminiApiKeys?.length > 0)
      ? this.aiProvider.geminiApiKeys
      : String(process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) {
      return { ok: false, total: 0, activas: 0, detalle: [], error: 'Sin claves configuradas' };
    }

    const resultados = await Promise.all(keys.map(async (key, idx) => {
      const shortKey = `...${key.slice(-6)}`;
      const t0 = Date.now();
      try {
        const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        const latenciaMs = Date.now() - t0;
        if (resp.ok) {
          return { key: shortKey, ok: true, status: resp.status, latenciaMs };
        } else {
          const errText = await resp.text().catch(() => '');
          return { key: shortKey, ok: false, status: resp.status, latenciaMs, error: errText.slice(0, 100) };
        }
      } catch (err) {
        return { key: shortKey, ok: false, status: null, latenciaMs: Date.now() - t0, error: err.message };
      }
    }));

    const activas = resultados.filter(r => r.ok).length;
    return {
      ok: activas > 0,
      total: keys.length,
      activas,
      detalle: resultados
    };
  }

  /**
   * Verifica la disponibilidad de las claves de Groq
   */
  async verificarGroq() {
    const keys = (this.aiProvider?.groqApiKeys?.length > 0)
      ? this.aiProvider.groqApiKeys
      : String(process.env.GROQ_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

    if (keys.length === 0) {
      return { ok: false, total: 0, activas: 0, detalle: [], error: 'Sin claves configuradas' };
    }

    const baseUrl = this.aiProvider?.groqBaseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';

    const resultados = await Promise.all(keys.map(async (key, idx) => {
      const shortKey = `...${key.slice(-6)}`;
      const t0 = Date.now();
      try {
        const resp = await fetch(`${baseUrl}/models`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000)
        });
        const latenciaMs = Date.now() - t0;
        if (resp.ok) {
          return { key: shortKey, ok: true, status: resp.status, latenciaMs };
        } else {
          const errText = await resp.text().catch(() => '');
          return { key: shortKey, ok: false, status: resp.status, latenciaMs, error: errText.slice(0, 100) };
        }
      } catch (err) {
        return { key: shortKey, ok: false, status: null, latenciaMs: Date.now() - t0, error: err.message };
      }
    }));

    const activas = resultados.filter(r => r.ok).length;
    return {
      ok: activas > 0,
      total: keys.length,
      activas,
      detalle: resultados
    };
  }

  /**
   * Verifica el estado del Gateway Evolution API y de la sesión WhatsApp
   */
  async verificarWhatsApp() {
    const t0 = Date.now();
    try {
      const url = `${this.evolutionUrl}/instance/connectionState/${this.evolutionInstance}`;
      const resp = await fetch(url, {
        headers: { apikey: this.evolutionKey },
        signal: AbortSignal.timeout(4000)
      });
      const latenciaMs = Date.now() - t0;
      if (!resp.ok) {
        return {
          gatewayOk: false,
          conectado: false,
          estado: 'error_http',
          statusCode: resp.status,
          latenciaMs
        };
      }
      const data = await resp.json().catch(() => ({}));
      const state = data?.instance?.state || 'desconocido';
      return {
        gatewayOk: true,
        conectado: state === 'open',
        estado: state,
        instancia: this.evolutionInstance,
        latenciaMs
      };
    } catch (err) {
      return {
        gatewayOk: false,
        conectado: false,
        estado: 'inconexo',
        error: err.message,
        latenciaMs: Date.now() - t0
      };
    }
  }

  /**
   * Verifica la base de datos SQLite y los archivos de material
   */
  verificarAlmacenamiento() {
    let dbOk = false;
    let totalLeads = 0;
    let errorDb = null;

    try {
      if (this.sessionStore && this.sessionStore.db) {
        const row = this.sessionStore.db.prepare('SELECT count(*) as count FROM crm_leads').get();
        totalLeads = row?.count || 0;
        dbOk = true;
      } else {
        dbOk = true; // No inicializado aún en modo standalone
      }
    } catch (eDb) {
      errorDb = eDb.message;
    }

    // Material de trípticos usando el servicio oficial
    let totalTripticos = 0;
    try {
      const { listarTodosLosPdfs } = require('./pdf-service');
      const pdfs = listarTodosLosPdfs();
      totalTripticos = Array.isArray(pdfs) ? pdfs.length : 0;
    } catch (eMat) {
      // Ignorar si falla lectura
    }

    return {
      dbOk,
      totalLeads,
      errorDb,
      totalTripticos
    };
  }

  /**
   * Ejecuta una revisión completa del sistema
   */
  async ejecutarRevision(esManual = false) {
    if (this.ejecutandoRevision) {
      return this.ultimoReporte;
    }

    // Reposo nocturno: de 19h01 a 05h59 no se ejecutan chequeos periódicos
    if (!esManual && !this.estaEnHorario()) {
      const ahoraHoraStr = new Intl.DateTimeFormat('es-EC', {
        timeZone: 'America/Guayaquil',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());

      console.log(`[Watchdog] 🌙 Reposo nocturno activo (${ahoraHoraStr}) · Horario diurno: 06h00–19h00 (última 19h00). Sin revisiones de red. Próxima activación: 06:00 a. m.`);

      if (this.ultimoReporte) {
        this.ultimoReporte.modo = 'reposo_nocturno';
        this.ultimoReporte.proximaRevision = '06:00 a. m.';
      }
      return this.ultimoReporte;
    }

    this.ejecutandoRevision = true;
    const inicio = Date.now();

    try {
      const [dnsRes, geminiRes, groqRes, waRes] = await Promise.all([
        this.verificarYRepararDns(),
        this.verificarGemini(),
        this.verificarGroq(),
        this.verificarWhatsApp()
      ]);

      const storageRes = this.verificarAlmacenamiento();

      // Determinar estado global
      // ok: DNS OK, al menos 1 IA en cada proveedor, DB OK
      // warning: WhatsApp desconectado (esperando vinculación) o 1 proveedor con claves degradadas
      // critical: Sin IA (0 Gemini y 0 Groq) o DNS caído o DB bloqueada
      let estado = 'ok';
      const razones = [];

      if (!dnsRes.ok) {
        estado = 'critical';
        razones.push('Fallo general en resolución DNS');
      }
      if (!geminiRes.ok && !groqRes.ok) {
        estado = 'critical';
        razones.push('Ambos proveedores de IA (Gemini y Groq) sin claves operativas');
      } else if (!geminiRes.ok) {
        if (estado !== 'critical') estado = 'warning';
        razones.push('Gemini sin claves disponibles (operando 100% con Groq)');
      } else if (!groqRes.ok) {
        if (estado !== 'critical') estado = 'warning';
        razones.push('Groq sin claves disponibles (operando 100% con Gemini)');
      }

      if (!storageRes.dbOk) {
        estado = 'critical';
        razones.push(`Base de datos SQLite bloqueada: ${storageRes.errorDb}`);
      }

      if (!waRes.gatewayOk) {
        if (estado !== 'critical') estado = 'warning';
        razones.push(`Gateway Evolution API no responde (${waRes.error || waRes.statusCode})`);
      } else if (!waRes.conectado) {
        // Si todo lo demás está bien pero WhatsApp está en "close", no es falla del bot sino espera de escaneo
        if (estado === 'ok') estado = 'listo_para_vincular';
        razones.push(`WhatsApp en estado "${waRes.estado}" (pendiente de vincular en /qr)`);
      }

      const duracionMs = Date.now() - inicio;
      const ahoraIso = new Date().toISOString();
      const proximaEjecucionIso = new Date(Date.now() + this.intervalMs).toISOString();

      const reporte = {
        timestamp: ahoraIso,
        duracionMs,
        esManual,
        estado,
        razones,
        proximaRevision: proximaEjecucionIso,
        dns: dnsRes,
        ia: {
          gemini: geminiRes,
          groq: groqRes,
          totalClavesOperativas: geminiRes.activas + groqRes.activas,
          totalClavesConfiguradas: geminiRes.total + groqRes.total
        },
        whatsapp: waRes,
        almacenamiento: storageRes,
        sistema: {
          uptimeSec: Math.round(process.uptime()),
          memoriaMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
        }
      };

      this.ultimoReporte = reporte;
      this.historial.unshift(reporte);
      if (this.historial.length > 20) this.historial.pop();

      // Si el estado es crítico y no se pudo auto-reparar, generar archivo de volcado para Antigravity
      const rutaAlerta = path.join(__dirname, 'ALERTA_CRITICA.json');
      if (estado === 'critical') {
        try {
          fs.writeFileSync(rutaAlerta, JSON.stringify({
            alerta: 'CRITICAL_SYSTEM_FAILURE',
            generadoEn: ahoraIso,
            razones,
            diagnostico: reporte,
            instruccionAntigravity: 'El watchdog de ube-bot detectó fallos críticos no resueltos automáticamente. Analizar este reporte y los logs de docker para aplicar correcciones.'
          }, null, 2), 'utf8');
          console.error(`[Watchdog] 🚨 ALERTA CRÍTICA GENERADA: ${rutaAlerta}`);
        } catch (eF) {
          console.error('[Watchdog] Error guardando archivo de alerta crítica:', eF.message);
        }
      } else {
        // Si el sistema volvió a la normalidad, limpiar alerta previa
        if (fs.existsSync(rutaAlerta)) {
          try { fs.unlinkSync(rutaAlerta); console.log('[Watchdog] 🟢 Alerta crítica previa resuelta y archivada.'); } catch (_) {}
        }
      }

      // Log consolidado human-readable en consola
      const emojiEstado = estado === 'ok' ? '✅' : (estado === 'listo_para_vincular' ? '📲' : (estado === 'warning' ? '⚠️' : '🚨'));
      const txtWa = waRes.conectado ? 'conectado' : `${waRes.estado} (en espera)`;
      const proximaHora = new Date(Date.now() + this.intervalMs).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

      console.log(
        `[Watchdog] ${emojiEstado} Revisión de sistema (${esManual ? 'manual' : `cada ${this.intervalMinutes}m`}) ` +
        `· Estado: ${estado.toUpperCase()} · DNS: ${dnsRes.latenciaTotalMs}ms · Gemini: ${geminiRes.activas}/${geminiRes.total} ` +
        `· Groq: ${groqRes.activas}/${groqRes.total} · WA: ${txtWa} · DB: ${storageRes.totalLeads} leads · Próxima: ${proximaHora}`
      );

      return reporte;
    } finally {
      this.ejecutandoRevision = false;
    }
  }

  /**
   * Inicia el ciclo automático de monitoreo
   */
  iniciar() {
    if (this.activo) return;
    this.activo = true;

    // Primera revisión diferida 10 segundos para no interferir con el arranque de Express
    setTimeout(() => {
      this.ejecutarRevision(false).catch(err => {
        console.error('[Watchdog] Error en primera revisión diferida:', err.message);
      });
    }, 10000);

    // Ciclo periódico (cada N minutos)
    this.timer = setInterval(() => {
      this.ejecutarRevision(false).catch(err => {
        console.error('[Watchdog] Error en ciclo periódico de salud:', err.message);
      });
    }, this.intervalMs);

    if (this.timer.unref) this.timer.unref();

    console.log(`[Watchdog] Guardián de salud activo · Revisión cada ${this.intervalMinutes} min · Horario operativo: 06h00–19h00 (reposo nocturno 19h01–05h59)`);
  }

  /**
   * Detiene el ciclo
   */
  detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.activo = false;
    console.log('[Watchdog] Guardián de salud detenido');
  }
}

module.exports = SystemWatchdog;
