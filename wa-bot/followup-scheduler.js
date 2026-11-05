/**
 * FollowupScheduler · NUEVO v2 — Protocolo anti "en visto" (manual Diana)
 * ---------------------------------------------------------------------------
 * Implementa el protocolo de 3 toques del manual (Sección 01) y el
 * recordatorio de 48h del siguiente paso tras confirmar la ficha (Sección 06):
 *
 *   Toque 1 (24 h)   → retomar con calidez y reciclar la pregunta original.
 *   Toque 2 (72 h)   → valor + reserva de cupo ("se cierra el ciclo").
 *   Toque 3 (5–7 días) → liberar sin cerrar la puerta + tríptico → sin_respuesta.
 *
 *   Recordatorio (48 h tras ficha confirmada) → siguiente paso por ruta:
 *     grado → enlace de inscripción · validación → checklist · maestría → reserva.
 *
 * Reglas de seguridad:
 *   - Máximo 3 toques, NUNCA más (regla de oro del manual).
 *   - Solo en horario laboral (08h00–20h00, configurable).
 *   - Solo leads con origen 'whatsapp' (nunca el simulador).
 *   - Si el prospecto responde, el ciclo se reinicia solito: el mensaje
 *     nuevo actualiza ultimo_msg_usuario_ts y toques vuelve a computarse
 *     desde cero en la siguiente ronda (toques_enviados se resetea en server).
 *   - Nunca tocar leads en etapa ficha_completa (salvo recordatorio único).
 */

const MS_MIN = 60 * 1000;
const MS_HORA = 60 * MS_MIN;
const MS_DIA = 24 * MS_HORA;

// v5 (auditoría): el toque 3 promete "Te dejo el tríptico 📎" pero nunca lo
// adjuntaba. Ahora se busca y se envía el PDF real del programa (si existe).
let _pdfService = null;
function buscarTripticoLazy() {
  if (_pdfService) return _pdfService.buscarTriptico;
  try {
    _pdfService = require('./pdf-service');
    return _pdfService.buscarTriptico;
  } catch (e) {
    return null;
  }
}

class FollowupScheduler {
  constructor(sessionStore, waClient, opciones = {}) {
    this.store = sessionStore;
    this.waClient = waClient;
    this.intervaloMs = opciones.intervaloMs || 15 * MS_MIN;
    this.horario = opciones.horario || { inicio: 8, fin: 20 };
    this.ventanas = opciones.ventanas || {
      1: 24 * MS_HORA,   // toque 1 a las 24 h
      2: 72 * MS_HORA,   // toque 2 a las 72 h
      3: 5 * MS_DIA      // toque 3 entre 5 y 7 días
    };
    this.activo = opciones.activo !== undefined
      ? opciones.activo
      : (process.env.TOQUES_ACTIVOS || 'true') === 'true';
    this.timer = null;
    this.enviarReal = opciones.enviarReal !== undefined
      ? opciones.enviarReal
      : process.env.NODE_ENV !== 'test_dry_run';
  }

  iniciar() {
    if (!this.activo) {
      console.log('[Scheduler] Toques anti-visto DESACTIVADOS (TOQUES_ACTIVOS=false)');
      return;
    }
    if (this.timer) return;
    console.log(`[Scheduler] Protocolo anti-visto activo · revisión cada ${Math.round(this.intervaloMs / MS_MIN)} min · horario ${String(this.horario.inicio).padStart(2, '0')}h-${this.horario.fin}h`);
    this.timer = setInterval(() => {
      this.evaluar().catch(err => {
        console.error('[Scheduler] Error en ciclo de evaluación:', err.message);
      });
    }, this.intervaloMs);
  }

  detener() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dentroDeHorario(ts = Date.now()) {
    const hora = new Date(ts).getHours();
    return hora >= this.horario.inicio && hora < this.horario.fin;
  }

  async evaluar(ahoraTs = Date.now()) {
    if (!this.dentroDeHorario(ahoraTs)) return { toques: 0, recordatorios: 0 };

    let toques = 0;
    let recordatorios = 0;

    // ---------- 1. PROTOCOLO ANTI-VISTO ----------
    const candidatos = this.store.leadsParaToque(ahoraTs);
    for (const lead of candidatos) {
      const proximoToque = (lead.toques_enviados || 0) + 1;
      if (proximoToque > 3) continue;

      const ventanaMs = this.ventanas[proximoToque];
      const referencia = lead.ultimo_msg_usuario_ts; // se mide desde el silencio del prospecto
      if (!referencia || ahoraTs - referencia < ventanaMs) continue;

      // Seguridad extra: no duplicar si el último toque fue hace menos de 20 h
      if (lead.ultimo_toque_ts && ahoraTs - lead.ultimo_toque_ts < 20 * MS_HORA) continue;

      const mensaje = this.generarMensajeToque(proximoToque, lead);
      try {
        if (this.enviarReal) {
          await this.waClient.sendText(lead.phone, mensaje);
          // v5: el toque 3 SIEMPRE prometió el tríptico → ahora se adjunta de verdad
          if (proximoToque === 3) {
            const buscar = buscarTripticoLazy();
            if (buscar && typeof this.waClient.sendMedia === 'function') {
              try {
                const pdf = buscar(lead.carrera || 'UBE');
                if (pdf && pdf.fullPath) {
                  await this.waClient.sendMedia(lead.phone, pdf.fullPath, {
                    mediaType: 'document',
                    fileName: pdf.fileName,
                    caption: `📄 Tríptico Oficial UBE - ${pdf.fileName}`
                  });
                  this.store.registrarEvento(lead.phone, 'pdf_enviado', { ok: true, fileName: pdf.fileName, via: 'toque3' });
                }
              } catch (ePdf) {
                console.warn(`[Scheduler] No se pudo adjuntar tríptico del toque 3 a ${lead.phone}:`, ePdf.message);
              }
            }
          }
        }
        const esUltimo = proximoToque >= 3;
        this.store.actualizarLead(lead.phone, {
          toques_enviados: proximoToque,
          ultimo_toque_ts: ahoraTs,
          etapa: esUltimo ? 'sin_respuesta' : lead.etapa
        });
        this.store.registrarEvento(lead.phone, 'toque', { n: proximoToque, mensaje });
        if (esUltimo) {
          this.store.registrarEvento(lead.phone, 'etapa', { de: lead.etapa, a: 'sin_respuesta' });
        }
        toques++;
        console.log(`[Scheduler] Toque ${proximoToque} enviado a ${lead.phone}${esUltimo ? ' → liberado (sin_respuesta)' : ''}`);
      } catch (err) {
        console.error(`[Scheduler] Falló toque ${proximoToque} a ${lead.phone}:`, err.message);
      }
    }

    // ---------- 2. RECORDATORIO DE SIGUIENTE PASO (48 h post-ficha) ----------
    const fichas = this.store.leadsParaRecordatorio(ahoraTs);
    for (const lead of fichas) {
      const mensaje = this.generarRecordatorio(lead);
      try {
        if (this.enviarReal) {
          await this.waClient.sendText(lead.phone, mensaje);
        }
        this.store.actualizarLead(lead.phone, { recordatorio_enviado: 1 });
        this.store.registrarEvento(lead.phone, 'recordatorio_48h', { ruta: lead.ruta, mensaje });
        recordatorios++;
        console.log(`[Scheduler] Recordatorio 48h enviado a ${lead.phone} (ruta ${lead.ruta || 'n/d'})`);
      } catch (err) {
        console.error(`[Scheduler] Falló recordatorio a ${lead.phone}:`, err.message);
      }
    }

    // ---------- 3. Purga semanal de fichas antiguas (retención 180 días) ----------
    this.ultimoPurga = this.ultimoPurga || 0;
    if (ahoraTs - this.ultimoPurga > 7 * MS_DIA) {
      const purgados = this.store.purgarLeadsAntiguos();
      if (purgados > 0) console.log(`[Scheduler] Purga semanal: ${purgados} fichas inactivas eliminadas`);
      this.ultimoPurga = ahoraTs;
    }

    return { toques, recordatorios };
  }

  // ============================================================
  // GUIONES DE TOQUE (textuales del manual · Sección 01)
  // ============================================================

  _temaLead(lead) {
    if (lead.carrera) return lead.carrera;
    if (lead.ruta === 'maestria') return 'las maestrías oficiales';
    if (lead.ruta === 'validacion') return 'la titulación por experiencia laboral';
    return 'las carreras online nocturnas';
  }

  _nombreLead(lead) {
    return lead.nombre || lead.push_name || '';
  }

  generarMensajeToque(n, lead) {
    const nombre = this._nombreLead(lead);
    const tema = this._temaLead(lead);
    // FIX v5 (auditoría): sin nombre salía "Hola Hola 😊"; ahora un solo saludo.
    const saludo = nombre ? `Hola ${nombre}` : 'Hola';

    if (n === 1) {
      // Toque 1 (24 h): calidez + reciclar la pregunta original
      return `${saludo} 😊 Quedó pendiente tu consulta sobre ${tema}. ¿Sigues interesado en la modalidad online nocturna?`;
    }
    if (n === 2) {
      // Toque 2 (72 h): valor + reserva de cupo
      return `${saludo}, se cierra el proceso de cupos del ciclo para ${tema} y quería apartarte uno antes de cerrar. ¿Te reservo el espacio? Solo necesito tu confirmación 🙌`;
    }
    // Toque 3 (5–7 días): liberar sin cerrar la puerta
    return `Te dejo el tríptico 📎 Si retomas tus estudios más adelante, retomamos exactamente donde quedamos. ¿Quieres que te avise cuando abramos el próximo ciclo?`;
  }

  generarRecordatorio(lead) {
    const nombre = this._nombreLead(lead);
    const saludo = nombre ? `${nombre}` : 'Hola';

    if (lead.ruta === 'grado') {
      return `${saludo} 😊 Tu arancel congelado vence hoy. Para no perder el beneficio, tu inscripción es de $100 y la nivelación PRE de $150 (6 semanas). ¿Te envío el enlace de inscripción para completarla hoy? 💳`;
    }
    if (lead.ruta === 'validacion') {
      return `${saludo} 😊 ¿Pudiste reunir tu certificado laboral? Con ese documento damos inicio a tu expediente de titulación por experiencia esta misma semana. Cualquier duda con el formato, me escribes y te guío 📋`;
    }
    if (lead.ruta === 'maestria') {
      return `${saludo} 😊 Tu cupo para el próximo ciclo de maestría sigue apartado. Empiezas con tu primera cuota mensual, sin inscripción. ¿Confirmamos tu matrícula esta semana? 🎓`;
    }
    return `${saludo} 😊 Quedó pendiente concretar tu inscripción. ¿Te ayudo ahora con el paso a paso?`;
  }
}

module.exports = FollowupScheduler;
