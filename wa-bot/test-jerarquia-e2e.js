const http = require('http');

function post(urlPath, data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get({
      hostname: '127.0.0.1',
      port: 3000,
      path: urlPath
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ raw: body, statusCode: res.statusCode });
        }
      });
    }).on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  const phone = 'simulador_e2e_test';
  console.log('--- 1. Resetear sesión y lead ---');
  await post('/api/clear', { phone, borrarCrm: true });

  console.log('\n--- 2. Turno 1: Saludo ---');
  const r1 = await post('/api/chat', { phone, message: 'Hola buenas tardes' });
  console.log('Diana T1:', r1.reply);

  console.log('\n--- 3. Turno 2: "Estoy buscando maestrías" (anti-nombre test) ---');
  const r2 = await post('/api/chat', { phone, message: 'Estoy buscando maestrías' });
  console.log('Diana T2:', r2.reply);

  const leadsRes1 = await get('/api/leads');
  const leadT2 = (leadsRes1.leads || []).find(l => l.phone === phone);
  console.log('CRM tras T2:', {
    nombre: leadT2?.nombre,
    carrera: leadT2?.carrera,
    ruta: leadT2?.ruta
  });

  if (leadT2?.nombre && leadT2.nombre.toLowerCase().includes('buscando')) {
    console.error('❌ ERROR GRAVE: "Estoy buscando maestrías" se capturó como nombre');
    process.exit(1);
  } else {
    console.log('✅ PASS: No capturó la frase de intención como nombre');
  }

  console.log('\n--- 4. Turno 3: Nombre + Ciudad + Maestría ---');
  const r3 = await post('/api/chat', { phone, message: 'Me llamo Carlos Mendoza, soy de Guayaquil y me interesa la maestría en Educación' });
  console.log('Diana T3:', r3.reply);

  const leadsRes2 = await get('/api/leads');
  const leadT3 = (leadsRes2.leads || []).find(l => l.phone === phone);
  console.log('CRM tras T3:', {
    nombre: leadT3?.nombre,
    ciudad: leadT3?.ciudad,
    carrera: leadT3?.carrera,
    ruta: leadT3?.ruta
  });

  console.log('\n--- 5. Turno 4: Cédula ---');
  const r4 = await post('/api/chat', { phone, message: 'Mi cédula es 0928374651' });
  console.log('Diana T4:', r4.reply);

  const leadsRes3 = await get('/api/leads');
  const leadT4 = (leadsRes3.leads || []).find(l => l.phone === phone);
  console.log('CRM tras T4:', {
    nombre: leadT4?.nombre,
    cedula: leadT4?.cedula,
    etapa: leadT4?.etapa
  });

  // Limpieza final
  await post('/api/clear', { phone, borrarCrm: true });
  console.log('\n✅ Prueba E2E completada con éxito.');
}

run().catch(err => {
  console.error('Error en test E2E:', err);
  process.exit(1);
});
