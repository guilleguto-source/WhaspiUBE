/**
 * v5.2 · date-utils.js — RESTAURADO (regresión detectada en auditoría v5.1)
 * ============================================================================
 * Utilidades de fecha/hora para las CITAS de llamada con aspirantes:
 *   1. parseHorario():      "Mañana 09:30 am" / "Hoy 02:30 pm" / "04:30 pm" → ms UTC
 *   2. googleCalendarUrl(): link de 1 clic (action=TEMPLATE) para Google Calendar
 *   3. buildIcsFeed():      feed RFC 5545 (VCALENDAR/VEVENT) para /api/calendario/feed.ics
 *
 * Zona horaria: Ecuador = UTC-5 (configurable con APP_UTC_OFFSET / CAMPANA_UTC_OFFSET).
 * No tiene dependencias: todo con Date + Date.UTC (sin librerías externas).
 */

const DURACION_CITA_MIN = parseInt(process.env.CITA_DURACION_MIN, 10) || 30;

function offsetMs() {
  const h = parseInt(process.env.APP_UTC_OFFSET || process.env.CAMPANA_UTC_OFFSET || '-5', 10);
  return (Number.isNaN(h) ? -5 : h) * 3600000;
}

/**
 * Convierte un horario textual de Diana a ms UTC del INICIO de la cita.
 * Acepta: "Mañana 09:30 am", "Hoy 02:30 pm", "11:15 am", "04:30 pm", "14:15".
 * Reglas:
 *   - "mañana" → +1 día; sin palabra y la hora ya pasó hoy → +1 día.
 *   - am/pm → conversión 12h→24h. Sin am/pm y hora entre 8 y 19 → se toma tal cual.
 * Devuelve null si no se puede interpretar (el caller decide fallback).
 */
function parseHorario(horario, ahora = new Date()) {
  if (!horario) return null;
  const s = String(horario).toLowerCase().trim();

  const m = s.match(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(am|pm|a\.m\.?|p\.m\.?)?/)
        || s.match(/(\d{1,2})\s*(am|pm|a\.m\.?|p\.m\.?)/);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const mi = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || mi > 59) return null;

  const ampm = (s.match(/(a\.m\.?|p\.m\.?|am|pm)/) || [])[1] || '';
  const esPm = /^p/i.test(ampm);
  const esAm = /^a/i.test(ampm);
  if (esPm && h < 12) h += 12;
  if (esAm && h === 12) h = 0;
  if (!ampm && (h < 8 || h >= 20)) return null;   // sin am/pm y fuera de horario laboral → ambiguo

  const esManana = /ma[nñ]ana/.test(s);
  const hoyEc = new Date(ahora.getTime() + offsetMs());   // "ahora" en pared ecuatoriana

  // Pared ecuatoriana → UTC: utc = Date.UTC(partes) - offsetMs  (offset -5h → +5h)
  const inicio = Date.UTC(hoyEc.getUTCFullYear(), hoyEc.getUTCMonth(), hoyEc.getUTCDate(), h, mi, 0)
               - offsetMs();

  if (esManana) return inicio + 86400000;
  if (inicio <= ahora.getTime()) return inicio + 86400000;   // la hora ya pasó hoy → mañana
  return inicio;
}

function finDeCita(inicioMs) {
  return inicioMs + DURACION_CITA_MIN * 60000;
}

/** ms → "20261106T143000Z" (formato UTC de RFC 5545) */
function icsStamp(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/** Escapado RFC 5545 de textos dentro del .ics */
function icsEscape(texto) {
  return String(texto || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Pliegue de líneas RFC 5545 (máx 75 octetos: continuación con espacio) */
function foldLine(line) {
  const out = [];
  let resto = String(line);
  while (Buffer.byteLength(resto, 'utf8') > 73) {
    let corte = 73;
    while (corte > 1 && (Buffer.byteLength(resto.slice(0, corte), 'utf8') > 73)) corte--;
    out.push(resto.slice(0, corte));
    resto = ' ' + resto.slice(corte);
  }
  out.push(resto);
  return out.join('\r\n');
}

/**
 * Link de 1 clic "Añadir a Google Calendar" (formato canónico TEMPLATE):
 * https://calendar.google.com/calendar/render?action=TEMPLATE&text=..&dates=../..
 * Las fechas van SIN codificar (colons y slash literales, forma estándar de
 * Google); los textos libres sí van con encodeURIComponent.
 */
function googleCalendarUrl({ titulo, inicioMs, duracionMin = DURACION_CITA_MIN, detalles = '', ubicacion = '' }) {
  const inicio = typeof inicioMs === 'number' ? inicioMs : (parseHorario(inicioMs) || Date.now() + 3600000);
  const fin = inicio + duracionMin * 60000;
  let url = `https://calendar.google.com/calendar/render?action=TEMPLATE`
          + `&text=${encodeURIComponent(titulo || 'Cita UBE')}`
          + `&dates=${icsStamp(inicio)}/${icsStamp(fin)}`;
  if (detalles) url += `&details=${encodeURIComponent(detalles)}`;
  if (ubicacion) url += `&location=${encodeURIComponent(ubicacion)}`;
  return url;
}

/**
 * Feed .ics completo (RFC 5545) con las llamadas agendadas.
 * llamadas: filas de listarLlamadasAgendadas() (+google_url opcional, ignorado aquí).
 */
function buildIcsFeed(llamadas, ahora = Date.now()) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UBE//Diana Admisiones v5.2//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:' + icsEscape('UBE · Llamadas de admisión')),
    foldLine('X-WR-TIMEZONE:' + icsEscape('America/Guayaquil'))
  ];

  for (const l of (llamadas || [])) {
    const inicio = l.llamada_agendada_ts || parseHorario(l.llamada_agendada_horario, new Date(ahora));
    if (!inicio) continue;                       // horario ilegible → fuera del feed
    const estado = l.llamada_estado || 'pendiente';
    const det = [
      `Aspirante: ${l.nombre || 's/d'}`,
      `Teléfono: ${l.phone}`,
      `Programa: ${l.carrera || l.ruta || 's/d'}`,
      `Ciudad: ${l.ciudad || 's/d'}`,
      l.llamada_agendada_horario ? `Horario acordado: ${l.llamada_agendada_horario}` : ''
    ].filter(Boolean).join('\n');

    lineas.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${icsEscape(`${l.phone}-${inicio}`)}@ube-diana`),
      foldLine(`DTSTAMP:${icsStamp(ahora)}`),
      foldLine(`DTSTART:${icsStamp(inicio)}`),
      foldLine(`DTEND:${icsStamp(finDeCita(inicio))}`),
      foldLine(`SUMMARY:${icsEscape(`📞 Llamada UBE — ${l.nombre || l.phone}`)}`),
      foldLine(`DESCRIPTION:${icsEscape(det)}`),
      'STATUS:' + (estado === 'cancelada' ? 'CANCELLED' : 'CONFIRMED'),
      estado === 'cancelada' ? 'TRANSP:TRANSPARENT' : 'TRANSP:OPAQUE',
      'END:VEVENT'
    );
  }

  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n') + '\r\n';
}

module.exports = {
  parseHorario,
  finDeCita,
  icsStamp,
  icsEscape,
  foldLine,
  googleCalendarUrl,
  buildIcsFeed,
  DURACION_CITA_MIN
};
