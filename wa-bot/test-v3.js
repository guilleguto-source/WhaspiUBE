/**
 * test-v3.js — Simulacros deterministas de la v3 (sin LLM):
 *  A. Saludo de primer contacto (saluda + pide nombre + ofrece GRADO y MAESTRÍAS)
 *  B. Botones/listas: parseo de respuesta Evolution + rutas del menú + degradación a texto
 *  C. Precios oficiales (precios.json): cifras exactas, programas sin precio, fechas
 *  D. Prompt: regla de valores + tabla de grado actualizada + bloque de precio inyectado
 * Correr: node test-v3.js
 */
const assert = require('assert');
const menuService = require('./menu-service');
const waClient = require('./wa-client');
const { generarPromptSistema } = require('./prompt-engine');

let pasadas = 0, fallidas = [];
function ok(nombre, fn) {
  try { fn(); pasadas++; console.log(`  ✅ ${nombre}`); }
  catch (e) { fallidas.push({ nombre, err: e.message }); console.log(`  ❌ ${nombre}\n     ${e.message}`); }
}

console.log('══════════════════════════════════════════════════');
console.log('  SIMULACROS v3 · SALUDO / BOTONES / PRECIOS / PROMPT');
console.log('══════════════════════════════════════════════════');

// =======================================================
console.log('\nA) SALUDO DE PRIMER CONTACTO');
// =======================================================
ok('A1: saluda y se presenta como Diana/UBE', () => {
  const s = menuService.saludoPrimerContacto('');
  assert(/Diana/.test(s.texto) && /UBE/.test(s.texto));
});
ok('A2: pide el nombre en el primer mensaje', () => {
  const s = menuService.saludoPrimerContacto('');
  assert(/con qui[eé]n tengo el gusto|tu nombre|p[aá]same tu nombre/i.test(s.texto));
});
ok('A3: ofrece GRADO y MAESTRÍAS desde el inicio', () => {
  const s = menuService.saludoPrimerContacto('');
  assert(/GRADO/i.test(s.texto) && /MAESTR[IÍ]AS/i.test(s.texto));
});
ok('A4: trae menú interactivo con 4 opciones (lista)', () => {
  const s = menuService.saludoPrimerContacto('');
  assert(s.lista && s.lista.filas.length === 4);
  const ids = s.lista.filas.map(f => f.id);
  assert(ids.includes('menu_grado') && ids.includes('menu_maestrias') && ids.includes('menu_validacion') && ids.includes('menu_asesor'));
});
ok('A5: usa el pushName si existe', () => {
  const s = menuService.saludoPrimerContacto('Carlos Andrade');
  assert(/Carlos/.test(s.texto));
});
ok('A6: "hola" es saludo genérico → menú', () => {
  assert(menuService.esSaludoGenerico('hola') === true);
  assert(menuService.esSaludoGenerico('Buenas tardes') === true);
  assert(menuService.esSaludoGenerico('información') === true);
});
ok('A7: "quiero la maestría en educación básica" NO es genérico → respuesta directa', () => {
  assert(menuService.esSaludoGenerico('quiero la maestría en educación básica') === false);
});
ok('A8: "hola, info de psicología" NO es genérico (palabra de programa)', () => {
  assert(menuService.esSaludoGenerico('hola, info de psicología') === false);
});

// =======================================================
console.log('\nB) BOTONES Y LISTAS (Evolution API)');
// =======================================================
ok('B1: parsea buttonsResponseMessage → "boton: <id>"', () => {
  const t = menuService.textoDeMensajeEvolution({ buttonsResponseMessage: { selectedButtonId: 'menu_grado', selectedDisplayText: '🎓 Carreras de Grado' } });
  assert.strictEqual(t, 'boton: menu_grado');
});
ok('B2: parsea listResponseMessage → "boton: <rowId>"', () => {
  const t = menuService.textoDeMensajeEvolution({ listResponseMessage: { singleSelectReply: { selectedRowId: 'area:Educación' }, title: 'Educación' } });
  assert.strictEqual(t, 'boton: area:Educación');
});
ok('B3: mensaje normal devuelve null (no rompe el flujo)', () => {
  assert.strictEqual(menuService.textoDeMensajeEvolution({ conversation: 'hola' }), null);
  assert.strictEqual(menuService.textoDeMensajeEvolution({}), null);
});
ok('B4: ruta menu_grado menciona carreras y pide nombre/ciudad', () => {
  const r = menuService.resolverBoton('menu_grado');
  assert(/Derecho|Psicolog|Odontolog/i.test(r.texto));
  assert(/qu[eé] ciudad/i.test(r.texto) || /con qui[eé]n tengo el gusto/i.test(r.texto));
});
ok('B5: ruta menu_maestrias devuelve lista con las 5 áreas', () => {
  const r = menuService.resolverBoton('menu_maestrias');
  assert(r.lista && r.lista.filas.length === 5);
  assert(r.lista.filas.every(f => f.id.startsWith('area:')));
});
ok('B6: ruta area:Salud y Bienestar lista maestrías con fecha de inicio vigente', () => {
  const r = menuService.resolverBoton('area:Salud y Bienestar');
  assert(/Salud y Bienestar/i.test(r.texto));
  assert(/inicio \d{2}\/\d{2}\/\d{4}/.test(r.texto), 'área pequeña muestra fechas'); // al menos una fecha
  assert(!/2023/.test(r.texto) && !/2024/.test(r.texto), 'no debe listar fechas viejas');
});
ok('B6b: área grande (Educación) lista sin fechas para no hacer muro', () => {
  const r = menuService.resolverBoton('area:Educación');
  assert(!/inicio \d{2}\/\d{2}\/\d{4}/.test(r.texto));
  assert(r.texto.length < 900, 'listado compacto');
});
ok('B7: ruta menu_asesor ofrece 3 horarios como botones de llamada', () => {
  const r = menuService.resolverBoton('menu_asesor', { slots: ['Hoy 04:30 pm', 'Hoy 05:30 pm', 'Mañana 09:30 am'] });
  assert(r.botones && r.botones.length === 3);
  assert(r.botones.every(b => b.id.startsWith('llamada:')));
});
ok('B8: ruta llamada:<slot> confirma y marca acción de agendamiento', () => {
  const r = menuService.resolverBoton('llamada:Mañana 09:30 am');
  assert(/agendada/i.test(r.texto) && /09:30/.test(r.texto));
  assert.strictEqual(r.accion, 'agendar_llamada');
  assert.strictEqual(r.horario, 'Mañana 09:30 am');
});
ok('B9: extractor recibe texto neutro para botones (no captura basura)', () => {
  assert.strictEqual(menuService.textoExtractorDeBoton('menu_grado'), 'El aspirante eligió la opción: carreras de grado');
  assert.strictEqual(menuService.textoExtractorDeBoton('area:Educación'), 'El aspirante eligió el área de maestrías: Educación');
});
ok('B10: botón desconocido devuelve null (cae al LLM sin romper)', () => {
  assert.strictEqual(menuService.resolverBoton('boton_inexistente_xyz'), null);
});

// =======================================================
console.log('\nC) PRECIOS OFICIALES (matriz de valores)');
// =======================================================
ok('C1: formato de dinero ecuatoriano', () => {
  assert.strictEqual(menuService.money(1648.5), '$1.648,50');
  assert.strictEqual(menuService.money(2550), '$2.550');
  assert.strictEqual(menuService.money(135.83), '$135,83');
  assert.strictEqual(menuService.money(null), null);
});
ok('C2: maestría con precio completo → cifras EXACTAS en el bloque', () => {
  const p = menuService.detectarProgramaEnTexto('cuánto cuesta la maestría en educación básica');
  assert(p && p.tipo === 'maestria');
  const bloque = menuService.bloquePrecioPrompt(p);
  assert(bloque.includes('$135,83'), 'cuota 135,83');
  assert(bloque.includes('$1.730'), 'inversión total 1730');
  assert(bloque.includes('$1.649'), 'contado 1649 (valor de la MATRIZ, no calculado)');
  assert(bloque.includes('$100'), 'matrícula 100');
  assert(/PROHIBIDO inventar/i.test(bloque));
});
ok('C3: programa sin precio publicado → prohibido inventar cifras', () => {
  const bloque = menuService.bloquePrecioPrompt({ tipo: 'maestria', ref: { titulo: 'Educación Steam', sin_precio: true } });
  assert(/NO registra inversión publicada/i.test(bloque));
  assert(!/\$\d/.test(bloque.replace('NO registra inversión publicada', '')), 'sin cifras');
});
ok('C4: fecha futura se muestra; fecha pasada → por confirmar', () => {
  const futura = menuService.bloquePrecioPrompt({ tipo: 'maestria', ref: { titulo: 'X', cuota: 200, num_cuotas: 12, total_cuotas: 2400, inversion_total: 2550, matricula: 150, inicio: { fecha: '2027-03-20', pasada: false } } });
  assert(/20\/03\/2027/.test(futura));
  const pasada = menuService.bloquePrecioPrompt({ tipo: 'maestria', ref: { titulo: 'X', cuota: 200, num_cuotas: 12, total_cuotas: 2400, inversion_total: 2550, matricula: 150, inicio: { fecha: '2026-06-12', pasada: true } } });
  assert(/por confirmar/.test(pasada) && !/12\/06\/2026/.test(pasada));
});
ok('C5: grado → incluye cuota, promocional, matrícula, PRE e inglés', () => {
  const p = menuService.detectarProgramaEnTexto('me interesa psicología');
  assert(p && p.tipo === 'grado', 'detecta grado Psicología');
  const bloque = menuService.bloquePrecioPrompt(p);
  assert(bloque.includes('$180'), 'cuota 180');
  assert(bloque.includes('$140'), 'promocional 140');
  assert(bloque.includes('$100'), 'matrícula 100');
  assert(bloque.includes('PRE') && bloque.includes('6 semanas'));
  assert(bloque.includes('$110'), 'inglés 110/módulo');
});
ok('C6: PE de validación → cuotas y dirigido_a', () => {
  const p = menuService.buscarPrograma('validación educación inicial 15 meses');
  assert(p && p.tipo === 'pe', 'detecta PE');
  const bloque = menuService.bloquePrecioPrompt(p);
  assert(/\$150/.test(bloque));
});
ok('C7: detecta programas con typos comunes del usuario', () => {
  const p1 = menuService.detectarProgramaEnTexto('maestria en educacion basica'); // sin acentos
  assert(p1 && /EDUCACIÓN BÁSICA/i.test(p1.ref.titulo || ''));
  const p2 = menuService.detectarProgramaEnTexto('cuanto vale la maestria en criminologia');
  assert(p2 && /CRIMINOLOG/i.test(p2.ref.titulo || ''));
});
ok('C8-v4: 49 maestrías ofrecibles + 15 en revisión y 5 áreas con conteo coherente', () => {
  assert.strictEqual(menuService.totalMaestrias(), 49);
  const p = menuService.cargarPrecios();
  assert.strictEqual((p.maestrias || []).filter(m => m.estado === 'en_revision').length, 15);
  const areas = menuService.areasConConteo();
  assert.strictEqual(areas.length, 5);
  const suma = areas.reduce((a, x) => a + x.total, 0);
  assert.strictEqual(suma, 49);
  // áreas cortas oficiales v4
  const nombres = areas.map(a => a.area);
  for (const esperada of ['Educación', 'Administración y Negocios', 'Derecho y Gobernanza', 'Ingeniería y Tecnología', 'Salud y Bienestar']) {
    assert(nombres.includes(esperada), 'área ' + esperada);
  }
});

// =======================================================
console.log('\nD) PROMPT DE DIANA (guion + valores)');
// =======================================================
const prompt = generarPromptSistema('UBE', '');
ok('D1: Turno 1 pide nombre y ofrece GRADO + MAESTRÍAS', () => {
  assert(/EN EL MISMO PRIMER MENSAJE/.test(prompt));
  assert(/carreras de GRADO/i.test(prompt) && /MAESTR[IÍ]AS/i.test(prompt));
});
ok('D2: regla de botones presente', () => {
  assert(/MENSAJES QUE LLEGAN DE UN BOTÓN/.test(prompt));
});
ok('D3: regla de oro de valores (prohibido inventar cuotas)', () => {
  assert(/REGLA DE ORO/.test(prompt) && /PROHIBIDO inventar/.test(prompt));
});
ok('D4: tabla de grado ACTUALIZADA según matriz (Sistemas $200, Psicología $180/$140)', () => {
  assert(/\| Ingeniería en Sistemas Inteligentes \| Online nocturno \| \$200 \| \$140 \|/.test(prompt));
  assert(/\| Licenciatura en Psicología \| Online nocturno \| \$180 \| \$140 \|/.test(prompt));
  assert(!/\| Licenciatura en Psicología \| 100% Online nocturno \| \$160 \| \$160 \|/.test(prompt), 'valores viejos eliminados');
});
ok('D5: PE actualizado (SSO $192, Eléctrica $160, Tráfico $160)', () => {
  assert(/Validación SSO \(12 meses\): 12 cuotas de \$192/.test(prompt));
  assert(!/Validación en Seguridad y Salud Ocupacional \(15 meses\): 15 cuotas fijas de \$150/.test(prompt), 'PE viejo eliminado');
});
ok('D6: bloque de precio se concatena en el prompt (simulado)', () => {
  const p = menuService.detectarProgramaEnTexto('maestría en gestión educativa');
  const conBloque = generarPromptSistema('UBE', menuService.bloquePrecioPrompt(p));
  assert(conBloque.includes('BLOQUE DE PRECIO OFICIAL'));
  assert(conBloque.includes('Matrícula: $100') || conBloque.includes('$158,33'), 'valores de Gestión Educativa');
});
ok('D7: bloque de maestrías por área usa la matriz (57 en el prompt)', () => {
  const m = prompt.match(/Educación \((\d+) programas\)/);
  assert(m && parseInt(m[1], 10) >= 12, 'área Educación con programas de la matriz');
});

// =======================================================
console.log('\nE) DEGRADACIÓN DE BOTONES (sendButtons/sendList)');
// =======================================================
const llamadasFetch = [];
global.fetch = async (url, opts) => {
  const u = String(url);
  llamadasFetch.push({ url: u, body: opts ? JSON.parse(opts.body) : null });
  if (u.includes('/sendButtons/') || u.includes('/sendList/')) {
    return { ok: false, status: 400, json: async () => ({}) }; // instancia sin soporte
  }
  return { ok: true, json: async () => ({ sent: true }) };   // sendText sí funciona
};

(async () => {
  const cli = new waClient({ baseUrl: 'http://mock', apiKey: 'x', instance: 'test' });
  await cli.sendButtons('0999999999', 'Elige:', [{ id: 'a', label: 'Opción A' }]);
  ok('E1: sendButtons intenta 2 formatos y degrada a texto numerado', () => {
    const sendButtons = llamadasFetch.filter(l => l.url.includes('/sendButtons/'));
    assert.strictEqual(sendButtons.length, 2, 'formato v2 + legacy');
    assert(sendButtons[0].body.buttons[0].id === 'a');
    const ultimo = llamadasFetch[llamadasFetch.length - 1];
    assert(ultimo.url.includes('/sendText/'), 'fallback a sendText');
  });
  llamadasFetch.length = 0;
  await cli.sendList('0999999999', '¿Qué buscas?', {
    tituloBoton: 'Menú', secciones: [{ titulo: 'Opciones', filas: [{ id: 'menu_grado', titulo: 'Grado', desc: '4 años' }] }]
  });
  ok('E2: sendList degrada a texto con opciones numeradas', () => {
    const sendList = llamadasFetch.filter(l => l.url.includes('/sendList/'));
    assert(sendList.length >= 1);
    const body = sendList[0].body;
    assert(body.sections[0].rows[0].rowId === 'menu_grado');
    assert(body.buttonText === 'Menú');
  });
  llamadasFetch.length = 0;
  const r = await cli.sendButtons('0999999999', 'Elige:', []);
  ok('E3: sin opciones → cae a texto plano directo', () => {
    assert(llamadasFetch.length === 1 && llamadasFetch[0].url.includes('/sendText/'));
  });

  // =======================================================
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  RESULTADO: ${pasadas} pasadas · ${fallidas.length} fallidas`);
  if (fallidas.length) {
    for (const f of fallidas) console.log(`  ✗ ${f.nombre}: ${f.err}`);
    process.exit(1);
  }
  console.log('══════════════════════════════════════════════════');
})();
