/**
 * sync-catalogo.js · v4 — Sincronización AUTOMÁTICA de la Matriz de Valores UBE
 * =============================================================================
 * La matriz oficial (Excel "INSCRIPCIONES UBE.xlsx" en SharePoint) se actualiza
 * cada mes. Este módulo:
 *   1. DESCARGA el archivo anónimamente del enlace compartido (sin login),
 *      usando curl con cookie-jar (probado) y fallback a fetch con cookies.
 *   2. PARSEA las 4 hojas visibles importantes + INGLÉS + LINKS DE WHATSAPP,
 *      detectando columnas por patrones/encabezados (tolerante a reorden).
 *   3. GENERA data/precios.json + data/links-whatsapp.json (con backup previo).
 *   4. COMPARA contra la versión anterior y produce un reporte de cambios:
 *      precios cambiados, nuevos cohortes (paralelo/fecha nueva), programas
 *      agregados o retirados, cambios en inglés y reglas.
 *   5. NOTIFICA al administrador por WhatsApp (ADMIN_WHATSAPP) si hay cambios.
 *   6. EXPORTA un CSV legible del catálogo consolidado para revisión humana.
 *
 * Uso:
 *   node sync-catalogo.js                  # descarga + parse + diff + notifica
 *   node sync-catalogo.js --sin-descargar  # reparte el xlsx ya descargado
 *   node sync-catalogo.js --forzar         # ignora guardas de calendario
 *   node sync-catalogo.js --estado         # muestra el estado de la última sync
 *
 * Calendario: el servidor llama a ejecutarSiTocaSync() cada 30 min y corre la
 * sincronización los días 1 y 16 de cada mes (más catch-up si llevaba >7 días).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');

// ---------------------------------------------------------------
// Rutas y configuración
// ---------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
const CATALOGO_DIR = path.join(DATA_DIR, 'catalogo');
const CAMBIOS_DIR = path.join(CATALOGO_DIR, 'cambios');
const RUTA_PRECIOS = path.join(DATA_DIR, 'precios.json');
const RUTA_LINKS = path.join(DATA_DIR, 'links-whatsapp.json');
const RUTA_ULTIMA_SYNC = path.join(CATALOGO_DIR, 'ultima-sync.json');

const SHAREPOINT_URL = process.env.CATALOGO_URL
  || 'https://istb-my.sharepoint.com/:x:/g/personal/njsuarezv_ube_edu_ec/IQCkeSBymyrhS7l_nZ1HlOfSAcEGWfmfKq2NuKATC6JwBI0';
const UA_CURL = process.env.CATALOGO_UA
  || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const DIAS_SYNC = [1, 16];          // días del mes en que se verifica la matriz
const MAX_DIAS_SIN_SYNC = 7;        // catch-up si quedó desatendida

// Hojas IMPORTANTES (las visibles del archivo; NO usar las ocultas antiguas)
const HOJAS = {
  GRADO_INFO: 'GRADO Y PROGRAMAS ESPECIALE (2)',
  PRECIOS_GRADO: 'PRECIOS - GRADO Y PROGRAMAS (2)',
  MAESTRIAS: 'MAESTRÍAS 2 ',
  PRECIOS_MAESTRIAS: 'PRECIOS MAESTRIAS',   // visible; la "…(2)" está oculta y desactualizada
  INGLES: 'INGLÉS',
  LINKS: 'LINKS DE WHATSAPP'
};

function asegurarDirs() {
  fs.mkdirSync(CATALOGO_DIR, { recursive: true });
  fs.mkdirSync(CAMBIOS_DIR, { recursive: true });
}

// ---------------------------------------------------------------
// Utilidades de normalización / fechas / dinero
// ---------------------------------------------------------------
function sinAcentos(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function norm(t) {
  return sinAcentos(String(t || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
/** Clave de fusión de maestrías: quita "MAESTRÍA EN/DE", colapsa espacios. */
function claveMaestria(t) {
  let k = norm(t).replace(/\bmaestria en\b/g, '').replace(/\bmaestria de\b/g, '');
  return k.replace(/\s+/g, ' ').trim();
}
/** Convierte celdas de dinero del Excel a número. Acepta $4.800 / $200,00 / 187.5 / 6370 / " $ 6.650,00 ". */
function aNumero(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && isFinite(v)) return v;
  let s = String(v).replace(/\$/g, ' ').replace(/\s+/g, '').replace(/[^0-9.,-]/g, '');
  if (!s) return null;
  const tieneComa = s.includes(','), tienePunto = s.includes('.');
  if (tieneComa && tienePunto) s = s.replace(/\./g, '').replace(',', '.');
  else if (tieneComa) {
    // "200,00" decimal | "1,500" miles (3 dígitos tras coma)
    if (/,\d{3}$/.test(s) && !/,\d{2}[^\d]*$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  } else if (tienePunto) {
    const m = s.match(/^(\d{1,3})\.(\d{3})$/);
    if (m) s = m[1] + m[2];
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
/** Extrae primera cifra de un texto ("160// 150 graduados de ITB" → 160). */
function primerNumero(v) {
  const m = String(v || '').replace(/\$/g, '').replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  return m ? aNumero(m[1]) : null;
}
/** Fecha → ISO local (yyyy-mm-dd) SIN corrimiento de zona. */
function dateAISO(d) {
  if (!(d instanceof Date) || isNaN(d)) return null;
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
/** Celda de fecha del Excel → {fecha: ISO|, pasada: bool} o {texto} o null. */
function aFecha(v, hoyISO) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) {
    const iso = dateAISO(v);
    return iso ? { fecha: iso, pasada: hoyISO ? iso < hoyISO : false } : null;
  }
  const s = String(v).trim();
  if (!s) return null;
  if (/revisi/i.test(s)) return { texto: 'en revisión' };
  // "Proximo inicio: 23/11//2026" o "23/11/2026" o "23-11-2026"
  const m = s.replace(/([\/\-.])[\/\-.]+/g, '$1').match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
  if (m) {
    let y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    if (iso >= '2020-01-01' && iso <= '2040-12-31') return { fecha: iso, pasada: hoyISO ? iso < hoyISO : false };
  }
  return { texto: s };
}
function hoyISO() { return dateAISO(new Date()); }
function fechaCorta(iso) { return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null; }
/** ¿La celda parece un código de paralelo? (AON14, DPD01-Q, PE12-EDUON39, PM-EB-SMB26-01P1-93) */
function esParalelo(v) {
  const s = String(v || '').trim();
  if (!s || /\s/.test(s)) return false;
  return /^[A-Z0-9][A-Z0-9-]*\d/i.test(s) && /\d/.test(s) && s.length >= 4;
}
function esModalidad(v) {
  return /^(ONLINE|PRESENCIAL|HIBRIDA|HÍBRIDA|SEMIPRESENCIAL|A DISTANCIA)/i.test(String(v || '').trim());
}
function modNorm(v) {
  const s = sinAcentos(String(v || '')).toUpperCase().trim();
  if (s.startsWith('HIBR')) return 'HIBRIDA';
  if (s.startsWith('ONLINE')) return 'ONLINE';
  if (s.startsWith('PRES')) return 'PRESENCIAL';
  if (s.startsWith('SEMI')) return 'SEMIPRESENCIAL';
  return s || null;
}

// ---------------------------------------------------------------
// Áreas de maestrías (nombres CORTOS, para botones/listas)
// ---------------------------------------------------------------
const AREAS = {
  EDUCACION: 'Educación',
  ADMIN: 'Administración y Negocios',
  DERECHO: 'Derecho y Gobernanza',
  TECNO: 'Ingeniería y Tecnología',
  SALUD: 'Salud y Bienestar'
};
function clasificarArea(titulo) {
  const t = norm(titulo);
  const has = (re) => re.test(t);
  if (has(/educacion|pedagog|psicopedagog|linguistica|idioma|steam|gestion educativa|internacionalizacion de la educacion/)) return AREAS.EDUCACION;
  if (has(/hospital|enfermer|fisioter|biomedic|telemedicin|salud y bienestar/) ||
      (has(/psicologia/) && !has(/juridic/))) return AREAS.SALUD;
  if (has(/derecho|constitucionalismo|criminolog|investigacion criminal|psicologia juridica|gobernanza local|geopolitic|seguridad global|emergencias y desastres|genero|discapacidad|propiedad intelectual|sociedad digital/)) return AREAS.DERECHO;
  if (has(/ingenieria|electricidad|electricidad con|ciberseguridad|inteligencia artificial y|sistemas|ciencias de datos|maquinas de aprendizaje|tecnologia blockchain|gestion de sistemas|tecnologias de la informacion|analitica de datos|bim|automotriz/)) return AREAS.TECNO;
  return AREAS.ADMIN; // administración, tributaria, contabilidad, compras, logística, talento humano, ventas, economía…
}

// ---------------------------------------------------------------
// 1) DESCARGA ANÓNIMA del Excel compartido (sin iniciar sesión)
// ---------------------------------------------------------------
function descargarConCurl(destino, jar) {
  return new Promise((resolve, reject) => {
    const args = [
      '-sL', '--max-time', '120',
      '--cookie-jar', jar, '--cookie', jar,
      '-A', UA_CURL,
      `${SHAREPOINT_URL}?download=1`,
      '-o', destino
    ];
    execFile('curl', args, { timeout: 150000 }, (err, _so, se) => {
      if (err) return reject(new Error(`curl: ${err.message} ${se || ''}`));
      const buf = fs.existsSync(destino) ? fs.readFileSync(destino) : Buffer.alloc(0);
      // Un xlsx es un ZIP: arranca con "PK"
      if (buf.length < 4000 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
        return reject(new Error(`curl: la respuesta no es un archivo Excel válido (${buf.length} bytes)`));
      }
      resolve(buf.length);
    });
  });
}
async function descargarConFetch(destino) {
  let url = `${SHAREPOINT_URL}?download=1`;
  let cookies = {};
  for (let salto = 0; salto < 8; salto++) {
    const resp = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': UA_CURL, ...(Object.keys(cookies).length ? { Cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ') } : {}) }
    });
    for (const sc of resp.headers.getSetCookie ? resp.headers.getSetCookie() : []) {
      const par = sc.split(';')[0];
      const i = par.indexOf('=');
      if (i > 0) cookies[par.slice(0, i).trim()] = par.slice(i + 1).trim();
    }
    if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) {
      url = new URL(resp.headers.get('location'), url).href;
      continue;
    }
    if (!resp.ok) throw new Error(`fetch: HTTP ${resp.status}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 4000 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error(`fetch: respuesta no es Excel (${buf.length} bytes)`);
    fs.writeFileSync(destino, buf);
    return buf.length;
  }
  throw new Error('fetch: demasiados redireccionamientos');
}
async function descargarArchivo(destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const jar = path.join(CATALOGO_DIR, '.sp-cookies.txt');
  try {
    const n = await descargarConCurl(destino, jar);
    return { ok: true, via: 'curl', bytes: n };
  } catch (eCurl) {
    try {
      const n = await descargarConFetch(destino);
      return { ok: true, via: 'fetch', bytes: n };
    } catch (eFetch) {
      return { ok: false, error: `curl: ${eCurl.message} | fetch: ${eFetch.message}` };
    }
  }
}

// ---------------------------------------------------------------
// 2) PARSER de hojas (SheetJS, detección por patrones)
// ---------------------------------------------------------------
function cargarWorkbook(rutaXlsx) {
  let XLSX;
  try { XLSX = require('xlsx'); }
  catch (e) {
    throw new Error('Falta la librería "xlsx". Instálala con: npm install xlsx@0.18.5');
  }
  return XLSX.readFile(rutaXlsx, { cellDates: true });
}
/** Matriz de filas (arrays de celdas) de una hoja, recortando celdas vacías finales. */
function filasDe(wb, nombreHoja) {
  const hoja = wb.Sheets[nombreHoja];
  if (!hoja) return null;
  const XLSX = require('xlsx');
  const raw = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null });
  return raw.map(f => {
    const copia = [...f];
    while (copia.length && (copia[copia.length - 1] === null || copia[copia.length - 1] === '')) copia.pop();
    return copia;
  }).filter(f => f.length);
}
function textoCelda(v) { return v === null || v === undefined ? '' : String(v).replace(/\r/g, '').trim(); }

/** Parser hoja MAESTRÍAS 2 (calendario de maestrías activas + en revisión).
 *  Estructura: col1=MAESTRÍAS EN (título), col2=MODALIDAD, col3=PERIODOS,
 *  col4=DURACIÓN, col5=PARALELOS, col6=HORARIOS, col7=FECHA (varía: tolerante). */
function parsearMaestriasCalendario(wb, hoy) {
  const filas = filasDe(wb, HOJAS.MAESTRIAS);
  if (!filas) return { maestrias: [], linksPdf: null, error: `hoja "${HOJAS.MAESTRIAS}" no encontrada` };
  const out = [];
  let estado = 'activo';
  let tituloActual = '';
  let linksPdf = null;
  for (const f of filas) {
    const fila = f.map(textoCelda);
    const c1 = textoCelda(f[1]);
    if (!linksPdf && /https:\/\/istb-my\.sharepoint\.com\/:f:\//i.test(c1)) linksPdf = c1;
    if (/M?ESTR[IÍ]AS EN REVISI/i.test(c1)) { estado = 'en_revision'; continue; }
    if (/MAESTR[IÍ]AS EN\b/i.test(c1) && !esModalidad(textoCelda(f[2]))) continue; // encabezado de tabla
    if (!c1 && !fila.slice(2).some(v => v)) continue; // fila vacía
    // Título suelto (p. ej. "MESTRÍAS EN REVISIÓN" ya cubierto; otros títulos de sección)
    const celdas = fila;
    const paralelo = celdas.find(v => /^PM-/.test(v)) || celdas.find(esParalelo) || null;
    const modalidad = esModalidad(textoCelda(f[2])) ? modNorm(f[2]) : (celdas.find(esModalidad) ? modNorm(celdas.find(esModalidad)) : null);
    const duracionM = (celdas.find(v => /\d+\s*MESES/i.test(v)) || '').match(/\d+\s*MESES/i);
    const periodos = celdas.find((v, i) => i >= 3 && /^\d{1,2}$/.test(v)) || null;
    let horario = null, inicio = null, notaCalendario = null;
    for (const v of celdas) {
      if (!v || v === modalidad || v === (paralelo || '') || v === c1) continue;
      if (/h0|s[áa]bado|lunes|martes|mi[eé]rcoles|jueves|viernes|domingo|mar y jue/i.test(v) && !horario) horario = v;
      else if (/revisi/i.test(v)) inicio = { texto: 'en revisión' };
      else if (/redise[ñn]o/i.test(v)) notaCalendario = v;
    }
    if (!inicio) {
      for (const v of f) if (v instanceof Date) { inicio = aFecha(v, hoy); break; }
    }
    // ¿Es fila de datos? tiene modalidad o paralelo
    if (!modalidad && !paralelo) {
      if (/MAESTR[IÍ]/i.test(c1) && c1.length > 6) { tituloActual = c1; }
      continue;
    }
    if (c1) tituloActual = c1;
    if (!tituloActual) continue;
    out.push({
      titulo: tituloActual,
      estado,
      modalidad,
      duracion: duracionM ? duracionM[0].toUpperCase() : null,
      periodos: periodos || null,
      paralelo: paralelo || null,
      horario,
      inicio: inicio || null,
      nota_calendario: notaCalendario,
      area: clasificarArea(tituloActual)
    });
  }
  return { maestrias: out, linksPdf };
}

/** Parser hoja PRECIOS MAESTRIAS (visible). */
function parsearPreciosMaestrias(wb) {
  const filas = filasDe(wb, HOJAS.PRECIOS_MAESTRIAS);
  if (!filas) return { precios: [], error: `hoja "${HOJAS.PRECIOS_MAESTRIAS}" no encontrada` };
  const out = [];
  for (const f of filas) {
    const titulo = textoCelda(f[2]);
    if (!titulo || /MAESTR[IÍ]AS EN/i.test(titulo) || !/\$|\d/.test(f.slice(3).map(textoCelda).join(''))) continue;
    const inversion_normal = aNumero(f[3]);
    const matricula = aNumero(f[4]);
    const total_cuotas = aNumero(f[5]);
    const cuota12 = aNumero(f[6]);
    const cuota18 = aNumero(f[7]);
    const inversion_total = aNumero(f[8]);
    const pago_contado = aNumero(f[9]);
    if (inversion_normal === null && matricula === null && total_cuotas === null) continue;
    const num_cuotas = cuota12 && total_cuotas ? Math.round(total_cuotas / cuota12) : 12;
    out.push({
      titulo, inversion_normal, matricula, total_cuotas,
      cuota: cuota12, num_cuotas: num_cuotas || 12, cuota_18: cuota18,
      inversion_total, pago_contado
    });
  }
  return { precios: out };
}

/** Parser hoja PRECIOS - GRADO Y PROGRAMAS (2): 3 tablas + notas.
 *  Índices 0-based (SheetJS, datos de la tabla GRADO):
 *    0=Nº, 1=CARRERA, 2=MODALIDAD, 3=PERIODOS, 4=INSCRIPCIÓN, 6=PRE,
 *    7=MATRICULA, 8=CUOTA NORMAL, 9=PRONTO PAGO, 10=CUOTA PROMOCIONAL,
 *    11=INVERSIÓN TOTAL, 12=INVERSIÓN TOTAL CON DESCUENTO
 *  Tabla PE/VALIDACIÓN: 1=CARRERA, 2=DIRIGIDO A, 3=MODALIDAD, 4=DURACIÓN,
 *    5=ESPECIE HOMOLOGACIÓN, 6=HOMOLOGACIÓN ($), 7=INSCRIPCIÓN, 8=MATRÍCULA,
 *    10=CUOTAS (texto), 11=# CUOTAS, 12=TOTAL ARANCEL, 13=INV. ITB, 14=INV. EXTERNOS
 */
function parsearPreciosGrado(wb) {
  const filas = filasDe(wb, HOJAS.PRECIOS_GRADO);
  if (!filas) return { grado: [], pe: [], validacion: [], notas: [], error: `hoja "${HOJAS.PRECIOS_GRADO}" no encontrada` };
  const grado = [], pe = [], validacion = [], notas = [];
  let seccion = null, ultimoTitulo = '';
  for (const f of filas) {
    const t1 = textoCelda(f[1]);   // títulos de sección, carrera o nota
    const c2 = textoCelda(f[2]);   // modalidad (grado) / dirigido a (PE)
    if (/^CARRERAS DE GRADO$/i.test(t1)) { seccion = 'grado'; ultimoTitulo = ''; continue; }
    if (/^PROGRAMAS ESPECIALES$/i.test(t1)) { seccion = 'pe'; ultimoTitulo = ''; continue; }
    if (/^PROGRAMA DE VALIDACION/i.test(sinAcentos(t1).toUpperCase())) { seccion = 'validacion'; ultimoTitulo = ''; continue; }
    if (!seccion) continue;
    if (/^CARRERAS$/i.test(t1) || /^DIRIGIDO A/i.test(c2)) continue; // encabezados
    // Notas de reglas comerciales (frases sueltas sin modalidad ni precios)
    const esNota = (t1.startsWith('*') || /DESCUENTO|se cancela|nivelaci|graduados de ITB|pronto pago|cupo extraordinario|ingles/i.test(t1))
      && !esModalidad(c2) && aNumero(f[4]) === null && aNumero(f[6]) === null && aNumero(f[11]) === null;
    if (esNota && t1) {
      notas.push(t1.replace(/\s+/g, ' ').trim());
      continue;
    }
    const titulo = t1 || ultimoTitulo;
    if (t1) ultimoTitulo = t1;
    if (!titulo) continue;
    if (seccion === 'grado') {
      const modalidad = esModalidad(c2) ? modNorm(c2) : (f.map(textoCelda).find(esModalidad) ? modNorm(f.map(textoCelda).find(esModalidad)) : null);
      if (!modalidad) continue;
      const g = {
        carrera: titulo.replace(/\s*-\s*Quito\s*$/i, '').trim(),
        campus_titulo: /-Quito/i.test(titulo) ? 'Quito' : null,
        modalidad, periodos: textoCelda(f[3]) || null,
        inscripcion: aNumero(f[4]), pre: aNumero(f[6]), matricula: aNumero(f[7]),
        cuota_normal: aNumero(f[8]), pronto_pago: aNumero(f[9]), cuota_promocional: aNumero(f[10]),
        inversion_total: aNumero(f[11]), inversion_total_desc: aNumero(f[12])
      };
      grado.push(g);
    } else {
      const modalidad = esModalidad(textoCelda(f[3])) ? modNorm(f[3]) : (f.map(textoCelda).find(esModalidad) ? modNorm(f.map(textoCelda).find(esModalidad)) : null);
      const cuotasRaw = textoCelda(f[10]);
      const pe_ = {
        carrera: titulo, dirigido_a: c2 || null,
        modalidad, duracion: textoCelda(f[4]) || null,
        inscripcion: aNumero(f[7]), matricula: aNumero(f[8]),
        cuota: primerNumero(cuotasRaw), cuotas_texto: cuotasRaw || null,
        num_cuotas: aNumero(f[11]), total_arancel: aNumero(f[12]),
        inversion_graduados_itb: seccion === 'pe' ? aNumero(f[13]) : null,
        inversion_externos: seccion === 'pe' ? aNumero(f[14]) : null,
        nota_ingles: seccion === 'validacion' ? (textoCelda(f[13]) || null) : null
      };
      if (pe_.modalidad || pe_.duracion) (seccion === 'pe' ? pe : validacion).push(pe_);
    }
  }
  return { grado, pe, validacion, notas };
}

/** Parser hoja GRADO Y PROGRAMAS ESPECIALE (2): paralelos con fechas de inicio. */
function parsearGradoInfo(wb, hoy) {
  const filas = filasDe(wb, HOJAS.GRADO_INFO);
  if (!filas) return { grado_paralelos: [], pe_paralelos: [], linksPdf: null, duracionPre: null, error: `hoja "${HOJAS.GRADO_INFO}" no encontrada` };
  const grado_paralelos = [], pe_paralelos = [];
  let seccion = null, ultimoTitulo = '', linksPdf = null, duracionPre = null;
  for (const f of filas) {
    const c1 = textoCelda(f[1]);
    const fila = f.map(textoCelda);
    if (!linksPdf && /https:\/\/istb-my\.sharepoint\.com\/:(w|f):\//i.test(c1)) linksPdf = c1;
    if (/DURACI[OÓ]N DEL PRE/i.test(c1)) { duracionPre = c1; seccion = null; continue; }
    if (/^CARRERAS DE GRADO$/i.test(c1)) { seccion = 'grado'; ultimoTitulo = ''; continue; }
    if (/PROGRAMAS ESPECIALES Y VALIDACI/i.test(c1)) { seccion = 'pe'; ultimoTitulo = ''; continue; }
    if (/^CARRERA$/i.test(c1)) continue; // encabezados
    if (!seccion) continue;
    if (c1) ultimoTitulo = c1;
    const titulo = ultimoTitulo;
    if (!titulo) continue;
    const modalidad = fila.find(esModalidad);
    const paralelo = fila.find(esParalelo);
    const jornada = fila.find(v => /NOCTURNO|MATUTINO|FINES DE SEMANA|S[ÁA]BADO|VIE,SAB|LUNES,/i.test(v) && !esModalidad(v)) || null;
    const campus = fila.find(v => /^(QUITO|DUR[ÁA]N|GUAYAQUIL)$/i.test(v)) || null;
    let inicio = null;
    for (const v of f) if (v instanceof Date) { inicio = aFecha(v, hoy); break; }
    if (!inicio) {
      const t = fila.find(v => /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|proximo inicio|agendamiento/i.test(v));
      if (t) inicio = aFecha(t, hoy);
    }
    const observacion = fila.find(v => v.length > 40 && /dirigido a|tecn[óo]log|experiencia|bachiller|normalista/i.test(v)) || null;
    const periodoTxt = fila.find(v => /^\d{1,2}( \+ INTERNADO)?$|^\d{1,2} MESES$/i.test(v)) || null;
    const destino = seccion === 'grado' ? grado_paralelos : pe_paralelos;
    const p = {
      programa: titulo, modalidad: modalidad ? modNorm(modalidad) : null,
      jornada, periodos: periodoTxt, paralelo: paralelo && esParalelo(paralelo) ? paralelo : null,
      campus, inicio, observacion
    };
    // La fila informativa sin paralelo real ("ENTREVISTAS - DERECHO") se guarda solo si aporta inicio/observación
    if (p.paralelo || p.inicio || p.observacion) destino.push(p);
  }
  return { grado_paralelos, pe_paralelos, linksPdf, duracionPre };
}

/** Parser hoja INGLÉS.
 *  Carreras: 1=CARRERA, 2=MODALIDAD, 3=TOTAL MÓDULOS, 4=OBSERVACIÓN, 7=VALOR POR MÓDULO
 *  Programas: 1=PROGRAMA, 2=MODALIDAD, 3=MÓDULOS, 4=VALOR, 5=CERTIFICACIÓN, 6=HOMOLOGACIÓN, 7=MÓDULOS GRADUADOS, 8=NOTA */
function parsearIngles(wb) {
  const filas = filasDe(wb, HOJAS.INGLES);
  if (!filas) return { carreras: [], programas: [], error: `hoja "${HOJAS.INGLES}" no encontrada` };
  const carreras = [], programas = [];
  let seccion = 'carreras';
  for (const f of filas) {
    const t1 = textoCelda(f[1]);
    if (/PROGRAMAS ESPECIALES/i.test(t1)) { seccion = 'programas'; continue; }
    if (/CARRERAS REGULARES/i.test(t1)) { seccion = 'carreras'; continue; }
    const fila = f.map(textoCelda);
    if (seccion === 'carreras') {
      if (!t1 || /^CARRERAS?$/.test(t1) || /MODALIDAD/i.test(t1)) continue;
      const modulos = aNumero(f[3]);
      const valor = aNumero(f[7]);
      if (modulos === null && valor === null) continue;
      carreras.push({
        carrera: t1, modalidad: esModalidad(f[2]) ? modNorm(f[2]) : (textoCelda(f[2]) || null),
        modulos, observacion: textoCelda(f[4]) || null, valor_por_modulo: valor
      });
    } else {
      if (!t1 || /^PROGRAMA EN/i.test(t1)) continue;
      const modulos = aNumero(f[3]), valor = aNumero(f[4]);
      if (modulos === null && valor === null) continue;
      programas.push({
        programa: t1, modalidad: textoCelda(f[2]) || null, modulos, valor_por_modulo: valor,
        certificacion: textoCelda(f[5]) || null, homologacion: textoCelda(f[6]) || null,
        modulos_graduados: aNumero(f[7]), nota: textoCelda(f[8]) || null
      });
    }
  }
  return { carreras, programas };
}

/** Parser hoja LINKS DE WHATSAPP. */
function parsearLinks(wb, hoy) {
  const filas = filasDe(wb, HOJAS.LINKS);
  if (!filas) return { links: [], error: `hoja "${HOJAS.LINKS}" no encontrada` };
  const links = [];
  let ultimoTipo = '', ultimoPrograma = '';
  for (const f of filas) {
    const fila = f.map(textoCelda);
    const tipoRaw = textoCelda(f[2]), programa = textoCelda(f[3]);
    const link = fila.find(v => /https:\/\/chat\.whatsapp\.com\//i.test(v));
    if (!link) continue;
    if (tipoRaw) ultimoTipo = tipoRaw;
    if (programa) ultimoPrograma = programa;
    let inicio = null;
    for (const v of f) if (v instanceof Date) { inicio = aFecha(v, hoy); break; }
    if (!inicio) {
      const t = fila.find(v => /\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}/.test(v) && !/09\d{7}/.test(v));
      if (t) inicio = aFecha(t, hoy);
    }
    const tipo = norm(ultimoTipo).toUpperCase()
      .replace(/MAESTRIAS|MAESTR[iÍ]AS/, 'MAESTRIA')
      .replace(/CARRERAS DE GRADO|CARRERAS/, 'GRADO')
      .replace(/PROGRAMA ESPECIAL/, 'PROGRAMA_ESPECIAL')
      .replace(/VALIDACION/, 'VALIDACION')
      .replace(/PROFUNDIZACION/, 'PROFUNDIZACION');
    links.push({
      tipo: tipo || 'OTRO',
      programa: ultimoPrograma || programa,
      paralelo: textoCelda(f[4]) || null,
      inicio,
      tutor: textoCelda(f[6]) || null,
      celular_tutor: textoCelda(f[7]) || null,
      link: link.trim()
    });
  }
  return { links };
}

// ---------------------------------------------------------------
// 3) FUSIÓN calendario + precios de maestrías
// ---------------------------------------------------------------
function fusionarMaestrias(cal, precios) {
  const indicePrecios = new Map();
  for (const p of precios) {
    const k = claveMaestria(p.titulo);
    if (!indicePrecios.has(k)) indicePrecios.set(k, []);
    indicePrecios.get(k).push(p);
  }
  const usados = new Set();
  const salida = [];
  for (const m of cal) {
    const k = claveMaestria(m.titulo);
    let precio = null, claveUsada = k;
    if (indicePrecios.has(k)) { precio = indicePrecios.get(k)[0]; }
    else {
      // fuzzy: coincidencia por contención o tokens ≥60%
      for (const [kp, lista] of indicePrecios.entries()) {
        if (kp.length >= 6 && (kp.includes(k) || k.includes(kp))) { precio = lista[0]; claveUsada = kp; break; }
        const tk = k.split(' ').filter(w => w.length > 3);
        const tp = new Set(kp.split(' '));
        const hits = tk.filter(w => tp.has(w)).length;
        if (tk.length && hits / tk.length >= 0.6) { precio = lista[0]; claveUsada = kp; break; }
      }
    }
    if (precio) usados.add(claveUsada);
    salida.push({
      titulo: m.titulo,
      estado: m.estado || 'activo',
      modalidad: m.modalidad,
      duracion: m.duracion,
      periodos: m.periodos || null,
      paralelo: m.paralelo,
      horario: m.horario,
      inicio: m.inicio,
      nota_calendario: m.nota_calendario || null,
      area: m.area,
      sin_precio: !precio,
      inversion_normal: precio?.inversion_normal ?? null,
      matricula: precio?.matricula ?? null,
      cuota: precio?.cuota ?? null,
      num_cuotas: precio?.num_cuotas ?? null,
      total_cuotas: precio?.total_cuotas ?? null,
      inversion_total: precio?.inversion_total ?? null,
      pago_contado: precio?.pago_contado ?? null,
      cuota_18: precio?.cuota_18 ?? null
    });
  }
  // Maestrías con precio pero SIN calendario (posibles altas solo en precios)
  for (const [kp, lista] of indicePrecios.entries()) {
    if (usados.has(kp)) continue;
    for (const p of lista) {
      salida.push({
        titulo: p.titulo, estado: 'sin_cronograma', modalidad: null, duracion: null,
        periodos: null, paralelo: null, horario: null, inicio: null, nota_calendario: null,
        area: clasificarArea(p.titulo), sin_precio: false,
        inversion_normal: p.inversion_normal, matricula: p.matricula, cuota: p.cuota,
        num_cuotas: p.num_cuotas, total_cuotas: p.total_cuotas, inversion_total: p.inversion_total,
        pago_contado: p.pago_contado, cuota_18: p.cuota_18
      });
    }
  }
  return salida;
}

// ---------------------------------------------------------------
// 4) CONSTRUCCIÓN del catálogo completo
// ---------------------------------------------------------------
function construirCatalogo(rutaXlsx, fuenteEtiqueta) {
  const hoy = hoyISO();
  const wb = cargarWorkbook(rutaXlsx);
  const cal = parsearMaestriasCalendario(wb, hoy);
  const pre = parsearPreciosMaestrias(wb);
  const pg = parsearPreciosGrado(wb);
  const gi = parsearGradoInfo(wb, hoy);
  const ing = parsearIngles(wb);
  const lk = parsearLinks(wb, hoy);
  const maestrias = fusionarMaestrias(cal.maestrias || [], pre.precios || []);

  const catalogo = {
    meta: {
      fuente: fuenteEtiqueta,
      url_sharepoint: SHAREPOINT_URL,
      generado: new Date().toISOString(),
      hoy,
      hojas_usadas: Object.values(HOJAS),
      nota_hojas: 'Las 4 hojas visibles del archivo son la fuente principal. La hoja "PRECIOS MAESTRIAS (2)" está oculta y desactualizada; NO se usa. "PARALELOS 2023" obsoleta.',
      sha256: null, tamano_bytes: null,
      conteo: {
        maestrias: maestrias.length,
        maestrias_activas: maestrias.filter(m => m.estado === 'activo').length,
        maestrias_en_revision: maestrias.filter(m => m.estado === 'en_revision').length,
        grado: (pg.grado || []).length,
        programas_especiales: (pg.pe || []).length,
        validacion: (pg.validacion || []).length,
        grado_paralelos: (gi.grado_paralelos || []).length,
        pe_paralelos: (gi.pe_paralelos || []).length,
        links_whatsapp: (lk.links || []).length
      }
    },
    reglas_comerciales: {
      inscripcion_grado: pg.grado?.[0]?.inscripcion ?? 100,
      pre_grado: { valor: pg.grado?.[0]?.pre ?? 150, duracion: gi.duracionPre || '6 semanas' },
      descuentos: {
        pago_anticipado_nivel: '5%',
        pago_anticipado_carrera_completa: '10%',
        contado_maestrias: 'Pago al contado = inversión total con descuento (ver columna PAGO AL CONTADO de la matriz)'
      },
      notas_matriz: pg.notas || []
    },
    ingles: {
      modulos_por_carrera: ing.carreras?.[0]?.modulos ?? 7,
      valor_por_modulo: ing.carreras?.[0]?.valor_por_modulo ?? 110,
      carreras: ing.carreras || [],
      programas_especiales: ing.programas || []
    },
    maestrias,
    grado: pg.grado || [],
    grado_paralelos: gi.grado_paralelos || [],
    programas_especiales: pg.pe || [],
    pe_paralelos: gi.pe_paralelos || [],
    validacion: pg.validacion || []
  };
  try {
    const buf = fs.readFileSync(rutaXlsx);
    catalogo.meta.sha256 = crypto.createHash('sha256').update(buf).digest('hex');
    catalogo.meta.tamano_bytes = buf.length;
  } catch (e) { /* opcional */ }
  if (gi.linksPdf || cal.linksPdf) catalogo.meta.links_pdf = { grado: gi.linksPdf || null, maestrias: cal.linksPdf || null };
  return { catalogo, links: lk.links || [] };
}

// ---------------------------------------------------------------
// 5) DIFF entre catálogos (precios / cohortes / altas / bajas)
// ---------------------------------------------------------------
function camposCambiados(a, b, campos, etiquetaCampos = {}) {
  const cambios = [];
  for (const c of campos) {
    const va = a?.[c] ?? null, vb = b?.[c] ?? null;
    const na = va === null ? null : Number(va), nb = vb === null ? null : Number(vb);
    const distinto = (na !== null && nb !== null) ? Math.abs(na - nb) > 0.005 : String(va) !== String(vb);
    if (distinto) cambios.push({ campo: etiquetaCampos[c] || c, antes: va, despues: vb });
  }
  return cambios;
}
const CAMPOS_PRECIO_M = { inversion_normal: 'inversión normal', matricula: 'matrícula', cuota: 'cuota mensual', num_cuotas: '# de cuotas', total_cuotas: 'arancel total', inversion_total: 'inversión total', pago_contado: 'pago al contado', cuota_18: 'cuota 18 meses' };
const CAMPOS_PRECIO_G = { inscripcion: 'inscripción', pre: 'PRE', matricula: 'matrícula', cuota_normal: 'cuota mensual', pronto_pago: 'pronto pago', cuota_promocional: 'cuota promocional', inversion_total: 'inversión total', inversion_total_desc: 'inversión con descuento' };

function diffCatalogos(viejo, nuevo) {
  const r = {
    maestrias: { precios_cambiados: [], calendario_cambiado: [], nuevos_cohortes: [], altas: [], bajas: [], a_revision: [] },
    grado: { precios_cambiados: [], altas: [], bajas: [] },
    paralelos: { nuevos: [], inicio_cambiado: [], retirados: [] },
    ingles: { cambios: [] },
    total: 0
  };
  if (!viejo) { r.primera_sync = true; r.total = -1; return r; }

  // --- Maestrías por clave ---
  const mapViejo = new Map((viejo.maestrias || []).map(m => [claveMaestria(m.titulo) + '|' + (m.paralelo || ''), m]));
  const mapNuevo = new Map((nuevo.maestrias || []).map(m => [claveMaestria(m.titulo) + '|' + (m.paralelo || ''), m]));
  for (const [k, mN] of mapNuevo.entries()) {
    const mV = mapViejo.get(k);
    if (!mV) {
      if ((viejo.maestrias || []).some(x => claveMaestria(x.titulo) === claveMaestria(mN.titulo))) {
        r.maestrias.nuevos_cohortes.push({ titulo: mN.titulo, paralelo: mN.paralelo, inicio: mN.inicio?.fecha || mN.inicio?.texto || null, horario: mN.horario });
      } else {
        r.maestrias.altas.push({ titulo: mN.titulo, area: mN.area, estado: mN.estado, inversion_total: mN.inversion_total });
      }
      continue;
    }
    if ((mV.estado || 'activo') !== (mN.estado || 'activo')) {
      r.maestrias.a_revision.push({ titulo: mN.titulo, antes: mV.estado || 'activo', ahora: mN.estado });
    }
    const cp = camposCambiados(mV, mN, Object.keys(CAMPOS_PRECIO_M), CAMPOS_PRECIO_M);
    if (cp.length) r.maestrias.precios_cambiados.push({ titulo: mN.titulo, paralelo: mN.paralelo, cambios: cp });
    const inicioV = mV.inicio?.fecha || null, inicioN = mN.inicio?.fecha || null;
    if ((inicioV || '') !== (inicioN || '') || (mV.paralelo || '') !== (mN.paralelo || '')) {
      r.maestrias.calendario_cambiado.push({
        titulo: mN.titulo, paralelo: mN.paralelo,
        inicio_antes: inicioV, inicio_ahora: inicioN,
        horario_antes: mV.horario, horario_ahora: mN.horario
      });
    }
  }
  for (const [k, mV] of mapViejo.entries()) {
    if (!mapNuevo.has(k)) r.maestrias.bajas.push({ titulo: mV.titulo, paralelo: mV.paralelo });
  }

  // --- Grado (precios) por carrera+modalidad ---
  const claveG = g => `${norm(g.carrera)}|${g.modalidad || ''}`;
  const mapGV = new Map((viejo.grado || []).map(g => [claveG(g), g]));
  const mapGN = new Map((nuevo.grado || []).map(g => [claveG(g), g]));
  for (const [k, gN] of mapGN.entries()) {
    const gV = mapGV.get(k);
    if (!gV) { r.grado.altas.push({ carrera: gN.carrera, modalidad: gN.modalidad }); continue; }
    const cp = camposCambiados(gV, gN, Object.keys(CAMPOS_PRECIO_G), CAMPOS_PRECIO_G);
    if (cp.length) r.grado.precios_cambiados.push({ carrera: gN.carrera, modalidad: gN.modalidad, cambios: cp });
  }
  for (const [k, gV] of mapGV.entries()) if (!mapGN.has(k)) r.grado.bajas.push({ carrera: gV.carrera, modalidad: gV.modalidad });

  // --- Paralelos (nuevos cohortes de grado/PE) ---
  const mapPV = new Map((viejo.grado_paralelos || []).concat(viejo.pe_paralelos || []).filter(p => p.paralelo).map(p => [p.paralelo, p]));
  const mapPN = new Map((nuevo.grado_paralelos || []).concat(nuevo.pe_paralelos || []).filter(p => p.paralelo).map(p => [p.paralelo, p]));
  for (const [k, pN] of mapPN.entries()) {
    const pV = mapPV.get(k);
    if (!pV) { r.paralelos.nuevos.push({ programa: pN.programa, paralelo: pN.paralelo, inicio: pN.inicio?.fecha || null, campus: pN.campus, jornada: pN.jornada }); continue; }
    const iv = pV.inicio?.fecha || null, in_ = pN.inicio?.fecha || null;
    if (iv !== in_) r.paralelos.inicio_cambiado.push({ programa: pN.programa, paralelo: pN.paralelo, antes: iv, ahora: in_ });
  }
  for (const [k, pV] of mapPV.entries()) if (!mapPN.has(k)) r.paralelos.retirados.push({ programa: pV.programa, paralelo: pV.paralelo });

  // --- Inglés ---
  const valV = viejo.ingles?.valor_por_modulo, valN = nuevo.ingles?.valor_por_modulo;
  if (valV !== valN) r.ingles.cambios.push({ campo: 'valor por módulo', antes: valV, despues: valN });
  if ((viejo.ingles?.carreras?.length || 0) !== (nuevo.ingles?.carreras?.length || 0)) r.ingles.cambios.push({ campo: 'nº de carreras con módulos de inglés', antes: viejo.ingles?.carreras?.length, despues: nuevo.ingles?.carreras?.length });

  r.total = r.maestrias.precios_cambiados.length + r.maestrias.calendario_cambiado.length + r.maestrias.nuevos_cohortes.length
    + r.maestrias.altas.length + r.maestrias.bajas.length + r.maestrias.a_revision.length
    + r.grado.precios_cambiados.length + r.grado.altas.length + r.grado.bajas.length
    + r.paralelos.nuevos.length + r.paralelos.inicio_cambiado.length + r.paralelos.retirados.length
    + r.ingles.cambios.length;
  return r;
}

/** Resumen textual corto para WhatsApp del admin. */
function resumenTexto(diff, meta) {
  const L = [];
  const f = fechaCorta(hoyISO());
  L.push(`🔄 *MATRIZ UBE VERIFICADA* (${f})`);
  L.push(`📥 Fuente: INSCRIPCIONES UBE.xlsx (SharePoint)`);
  if (diff.primera_sync) { L.push('✅ Primera sincronización: catálogo base registrado (no hay versión previa que comparar).'); return L.join('\n'); }
  const M = diff.maestrias, G = diff.grado, P = diff.paralelos;
  if (M.precios_cambiados.length) {
    L.push(`💰 ${M.precios_cambiados.length} precio(s) de maestrías cambiaron:`);
    for (const x of M.precios_cambiados.slice(0, 5)) L.push(` • ${x.titulo.slice(0, 55)}: ${x.cambios.map(c => `${c.campo} ${c.antes ?? '—'}→${c.despues ?? '—'}`).join('; ')}`);
    if (M.precios_cambiados.length > 5) L.push(` …y ${M.precios_cambiados.length - 5} más (ver reporte).`);
  }
  if (M.nuevos_cohortes.length || P.nuevos.length) {
    L.push(`📅 Nuevos cohortes detectados: ${M.nuevos_cohortes.length + P.nuevos.length}`);
    for (const x of M.nuevos_cohortes.slice(0, 5)) L.push(` • ${x.titulo.slice(0, 55)} — ${x.paralelo}${x.inicio ? `, inicio ${fechaCorta(x.inicio)}` : ''}`);
    for (const x of P.nuevos.slice(0, 4)) L.push(` • [Grado/PE] ${x.programa.slice(0, 45)} — ${x.paralelo}${x.inicio ? `, inicio ${fechaCorta(x.inicio)}` : ''}`);
  }
  if (M.calendario_cambiado.length) L.push(`🗓 ${M.calendario_cambiado.length} fecha(s) de inicio u horario cambiaron en maestrías.`);
  if (M.altas.length) L.push(`🆕 Programas agregados: ${M.altas.map(x => x.titulo.slice(0, 45)).join(' | ')}`);
  if (M.bajas.length) L.push(`❌ Programas retirados: ${M.bajas.map(x => x.titulo.slice(0, 45)).join(' | ')}`);
  if (M.a_revision.length) L.push(`🔎 Pasaron a "en revisión": ${M.a_revision.map(x => x.titulo.slice(0, 40)).join(' | ')}`);
  if (G.precios_cambiados.length) L.push(`🎓 ${G.precios_cambiados.length} precio(s) de grado cambiaron: ${G.precios_cambiados.slice(0, 4).map(x => x.carrera).join(', ')}`);
  if (G.altas.length) L.push(`🆕 Carreras de grado agregadas: ${G.altas.map(x => `${x.carrera} (${x.modalidad})`).join(', ')}`);
  if (G.bajas.length) L.push(`❌ Carreras de grado retiradas: ${G.bajas.map(x => x.carrera).join(', ')}`);
  if (P.inicio_cambiado.length) L.push(`⏰ ${P.inicio_cambiado.length} inicio(s) de paralelos de grado/PE cambiaron.`);
  if (!diff.total) L.push('✅ Sin cambios de precios, cohortes ni programas desde la última verificación.');
  L.push(`🤖 Diana ya usa la matriz actualizada. Reporte completo: data/catalogo/cambios/`);
  return L.join('\n');
}

// ---------------------------------------------------------------
// 6) EXPORT CSV del catálogo consolidado
// ---------------------------------------------------------------
function exportarCSV(catalogo, destino) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""').replace(/\s+/g, ' ').trim()}"`;
  const lineas = ['tipo;nombre;area;estado;modalidad;duracion;horario;paralelo;inicio;matricula;cuota;num_cuotas;arancel_total;inversion_total;pago_contado'];
  for (const m of catalogo.maestrias || []) {
    lineas.push(['MAESTRIA', m.titulo, m.area || '', m.estado || '', m.modalidad || '', m.duracion || '', m.horario || '', m.paralelo || '', m.inicio?.fecha ? fechaCorta(m.inicio.fecha) : (m.inicio?.texto || ''), m.matricula, m.cuota, m.num_cuotas, m.total_cuotas, m.inversion_total, m.pago_contado].map(esc).join(';'));
  }
  for (const g of catalogo.grado || []) {
    lineas.push(['GRADO', `${g.carrera}${g.campus_titulo ? ' - ' + g.campus_titulo : ''}`, '', '', g.modalidad || '', `${g.periodos || ''} periodos`, '', '', '', g.matricula, g.cuota_normal, '', '', g.inversion_total, ''].map(esc).join(';'));
  }
  for (const pe of (catalogo.programas_especiales || []).concat(catalogo.validacion || [])) {
    lineas.push(['PROGRAMA_ESPECIAL', pe.carrera, '', '', pe.modalidad || '', pe.duracion || '', '', '', '', pe.matricula, pe.cuota, pe.num_cuotas, pe.total_arancel, '', ''].map(esc).join(';'));
  }
  fs.writeFileSync(destino, '\uFEFF' + lineas.join('\n'), 'utf-8');
  return destino;
}

// ---------------------------------------------------------------
// 7) ORQUESTADOR
// ---------------------------------------------------------------
function leerPreciosActuales() {
  try { return JSON.parse(fs.readFileSync(RUTA_PRECIOS, 'utf-8')); } catch (e) { return null; }
}
function estadoUltimaSync() {
  try { return JSON.parse(fs.readFileSync(RUTA_ULTIMA_SYNC, 'utf-8')); } catch (e) {
    return { ultima_exitosa: null, ultimo_intento: null, ultima_descarga_ok: null, ultimo_reporte: null, total_cambios: null };
  }
}
function diaDelMes() { return new Date().getDate(); }
function esDiaSync() { return DIAS_SYNC.includes(diaDelMes()); }
function diasDesde(fechaISO) {
  if (!fechaISO) return Infinity;
  return Math.floor((Date.now() - new Date(`${fechaISO}T12:00:00`)) / 86400000);
}
function proximaSyncISO() {
  const d = new Date();
  const dia = d.getDate();
  const mes = d.getMonth(), anio = d.getFullYear();
  let objetivo = dia < 1 ? 1 : (dia < 16 ? 16 : null);
  let fecha;
  if (objetivo) fecha = new Date(anio, mes, objetivo);
  else fecha = new Date(anio, mes + 1, 1);
  return dateAISO(fecha);
}

/**
 * Ejecuta la sincronización completa. Opciones:
 *   sinDescargar (bool): usa el último xlsx descargado
 *   forzar (bool): no valida guardas
 * Devuelve { ok, huboCambios, resumen, reportePath, detalle }
 */
async function sincronizar(opts = {}) {
  const sinDescargar = !!opts.sinDescargar;
  asegurarDirs();
  const estado = estadoUltimaSync();
  const resultado = { ok: false, huboCambios: false, resumen: '', pasos: [] };

  // 1) Descarga
  const nombreArchivo = 'INSCRIPCIONES UBE.xlsx';
  const destinoXlsx = path.join(CATALOGO_DIR, nombreArchivo);
  let fuenteEtiqueta = nombreArchivo + ' (SharePoint)';
  let descargaOk = false;
  if (!sinDescargar) {
    const d = await descargarArchivo(destinoXlsx);
    resultado.pasos.push({ paso: 'descarga', ...d });
    if (d.ok) { descargaOk = true; } else { resultado.errorDescarga = d.error; }
  } else {
    descargaOk = fs.existsSync(destinoXlsx);
    resultado.pasos.push({ paso: 'descarga', ok: descargaOk, via: 'archivo-local' });
  }
  if (!descargaOk) {
    resultado.error = 'No se pudo obtener el archivo de la matriz. Se MANTIENE el catálogo vigente.';
    estado.ultimo_intento = new Date().toISOString();
    estado.ultima_descarga_ok = false;
    estado.ultimo_error = resultado.error;
    fs.writeFileSync(RUTA_ULTIMA_SYNC, JSON.stringify(estado, null, 2));
    resultado.resumen = `⚠️ Verificación de matriz falló (${new Date().toLocaleString('es-EC')}): ${resultado.error}`;
    return resultado;
  }

  // 2) Parsear y construir
  let construccion;
  try {
    construccion = construirCatalogo(destinoXlsx, fuenteEtiqueta);
  } catch (e) {
    estado.ultimo_intento = new Date().toISOString();
    estado.ultima_descarga_ok = true;
    estado.ultimo_error = `parse: ${e.message}`;
    fs.writeFileSync(RUTA_ULTIMA_SYNC, JSON.stringify(estado, null, 2));
    resultado.error = `Error parseando el Excel: ${e.message}. Se MANTIENE el catálogo vigente.`;
    resultado.resumen = `⚠️ Verificación de matriz falló: ${resultado.error}`;
    return resultado;
  }
  const { catalogo, links } = construccion;
  resultado.pasos.push({ paso: 'parse', ok: true, conteo: catalogo.meta.conteo });

  // 3) Diff contra versión vigente
  const anterior = leerPreciosActuales();
  const diff = diffCatalogos(anterior, catalogo);
  resultado.pasos.push({ paso: 'diff', ok: true, total_cambios: diff.total === -1 ? 'primera_sync' : diff.total });

  // 4) Backup del anterior + guardar nuevos
  const stamp = hoyISO();
  if (anterior) {
    fs.writeFileSync(path.join(CATALOGO_DIR, `precios-backup-${stamp}.json`), JSON.stringify(anterior, null, 2));
  }
  catalogo.meta.ultima_verificacion = new Date().toISOString();
  catalogo.meta.proxima_verificacion = proximaSyncISO();
  catalogo.meta.calendario_sync = `Automático los días ${DIAS_SYNC.join(' y ')} de cada mes (más catch-up si >${MAX_DIAS_SIN_SYNC} días)`;
  fs.writeFileSync(RUTA_PRECIOS, JSON.stringify(catalogo, null, 1));
  fs.writeFileSync(RUTA_LINKS, JSON.stringify({
    meta: { fuente: fuenteEtiqueta, generado: new Date().toISOString(), total: links.length },
    links
  }, null, 1));

  // 5) Reporte de cambios + CSV
  const archivoCambios = path.join(CAMBIOS_DIR, `cambios-${stamp}-${new Date().toTimeString().slice(0, 5).replace(':', '')}.json`);
  fs.writeFileSync(archivoCambios, JSON.stringify({ cuando: new Date().toISOString(), fuente: fuenteEtiqueta, total_cambios: diff.total === -1 ? 'primera_sync' : diff.total, detalle: diff }, null, 1));
  const csvPath = exportarCSV(catalogo, path.join(CATALOGO_DIR, `catalogo-${stamp}.csv`));
  const resumen = resumenTexto(diff, catalogo.meta);
  fs.writeFileSync(path.join(CATALOGO_DIR, 'ultimo-resumen.txt'), resumen);

  // 6) Estado
  estado.ultima_exitosa = stamp;
  estado.ultimo_intento = new Date().toISOString();
  estado.ultima_descarga_ok = true;
  estado.ultimo_reporte = archivoCambios;
  estado.total_cambios = diff.total === -1 ? 'primera_sync' : diff.total;
  estado.ultimo_error = null;
  estado.proxima = proximaSyncISO();
  fs.writeFileSync(RUTA_ULTIMA_SYNC, JSON.stringify(estado, null, 2));

  resultado.ok = true;
  resultado.huboCambios = diff.total > 0;
  resultado.resumen = resumen;
  resultado.reportePath = archivoCambios;
  resultado.csvPath = csvPath;
  resultado.detalle = diff;
  resultado.conteo = catalogo.meta.conteo;
  return resultado;
}

/** ¿Toca sincronizar? (días 1/16, catch-up >7 días, o primera vez) */
function tocaSync() {
  const estado = estadoUltimaSync();
  if (!estado.ultima_exitosa) return { si: true, motivo: 'primera_sync' };
  if (esDiaSync() && estado.ultima_exitosa !== hoyISO()) return { si: true, motivo: `dia_${diaDelMes()}` };
  if (diasDesde(estado.ultima_exitosa) > MAX_DIAS_SIN_SYNC) return { si: true, motivo: 'catch_up_7_dias' };
  return { si: false, motivo: 'al_dia' };
}

/** Para el scheduler del server: corre la sync solo si toca (o si forzado). */
async function ejecutarSiTocaSync(motivo = 'periodico') {
  const t = tocaSync();
  if (!t.si) return { corrido: false, motivo: t.motivo };
  console.log(`[sync-catalogo] Iniciando verificación de matriz (${t.motivo} / ${motivo})…`);
  const r = await sincronizar({});
  console.log(`[sync-catalogo] ${r.ok ? 'Terminada' : 'Con error'}: ${(r.resumen || r.error || '').split('\n')[0]}`);
  return { corrido: true, ...r };
}

// CLI
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    if (args.includes('--estado')) {
      console.log(JSON.stringify(estadoUltimaSync(), null, 2));
      return;
    }
    const r = await sincronizar({ sinDescargar: args.includes('--sin-descargar'), forzar: args.includes('--forzar') });
    console.log('='.repeat(60));
    console.log(r.resumen || r.error || '(sin salida)');
    if (r.conteo) console.log('Conteo:', JSON.stringify(r.conteo));
    console.log('='.repeat(60));
    process.exit(r.ok ? 0 : 1);
  })().catch(e => { console.error('[sync-catalogo] Error fatal:', e); process.exit(1); });
}

module.exports = {
  SHAREPOINT_URL, HOJAS, DIAS_SYNC, MAX_DIAS_SIN_SYNC,
  descargarArchivo, construirCatalogo, diffCatalogos, resumenTexto, exportarCSV,
  sincronizar, tocaSync, ejecutarSiTocaSync, estadoUltimaSync, proximaSyncISO,
  clasificarArea, AREAS, aNumero, aFecha, claveMaestria,
  // parsers internos (para pruebas)
  parsearMaestriasCalendario, parsearPreciosMaestrias, parsearPreciosGrado, parsearGradoInfo, parsearIngles, parsearLinks, filasDe
};
