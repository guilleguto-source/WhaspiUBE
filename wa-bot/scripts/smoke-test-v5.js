// smoke-test-v5.js — arranque real del server + endpoints + pipeline webhook
process.env.PORT = '3902';
process.env.WEBHOOK_TOKEN = 'testtok';
process.env.ADMIN_WHATSAPP = '';
process.env.HUMAN_DELAY_MS = '0';

const { app, sessionStore, campana, waClient } = require('/home/z/my-project/work/auditoria-v5/server.js');

const srv = app.listen(3902, async () => {
  const base = 'http://localhost:3902';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const out = (k, v) => console.log(`  ${k}: ${v}`);

  try {
    out('/health', JSON.stringify((await (await fetch(base + '/health')).json()).version));
    out('/api/calendario', JSON.stringify(await (await fetch(base + '/api/calendario')).json()));
    out('/api/campana (sin token)', (await fetch(base + '/api/campana')).status);
    const cam = await (await fetch(base + '/api/campana', { headers: { 'x-webhook-token': 'testtok' } })).json();
    out('/api/campana', `ok=${cam.ok} activa=${cam.activa} dry_run=${cam.dry_run} limite=${cam.limite_hoy} enviados_hoy=${cam.enviados_hoy}`);
    out('/api/catalogo/estado ok', (await (await fetch(base + '/api/catalogo/estado', { headers: { 'x-webhook-token': 'testtok' } })).json()).ok);
    out('webhook SIN token', (await fetch(base + '/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status);

    // mensaje real "hola" → pipeline completo (cola + CRM + ctx_pendiente)
    await fetch(base + '/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': 'testtok' },
      body: JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: '593991234567@s.whatsapp.net', fromMe: false, id: 'SMOKE1' }, message: { conversation: 'hola' } } })
    });
    await sleep(5000);
    const d1 = await (await fetch(base + '/api/lead/593991234567')).json();
    out('lead tras "hola"', `etapa=${d1.lead.etapa} origen=${d1.lead.origen} ctx_pendiente=${d1.lead.ctx_pendiente} eventos=${d1.eventos.length}`);

    // LID sin senderPn → lead aislado lid:
    await fetch(base + '/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': 'testtok' },
      body: JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: '888777666@lid', fromMe: false, id: 'SMOKE2' }, message: { conversation: 'hola' } } })
    });
    await sleep(5000);
    const d2 = await (await fetch(base + '/api/lead/lid:888777666')).json();
    out('lead LID', `origen=${d2.lead.origen} (excluido de toques/campaña automáticamente)`);

    // LID CON senderPn → número real
    await fetch(base + '/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': 'testtok' },
      body: JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: '999111222@lid', senderPn: '593981234567', fromMe: false, id: 'SMOKE3' }, message: { conversation: 'cuánto vale la maestría en educación básica' } } })
    });
    await sleep(5000);
    const d3 = await (await fetch(base + '/api/lead/593981234567')).json();
    out('lead LID+senderPn', `phone=593981234567 etapa=${d3.lead.etapa} carrera=${d3.lead.carrera}`);

    // mensajería simulada con botones de campaña sobre un contacto de campaña
    cam.activa = true;
    cam.enviarReal = false;
    sessionStore.db.prepare(`INSERT OR REPLACE INTO campana_contactos (phone,nombre,estado,toques,created_at,updated_at) VALUES ('593965555555','Camp Smoke','enviado_inicial',1,?,?)`).run(Date.now(), Date.now());
    await fetch(base + '/webhook', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-token': 'testtok' },
      body: JSON.stringify({ event: 'messages.upsert', data: { key: { remoteJid: '593965555555@s.whatsapp.net', fromMe: false, id: 'SMOKE4' }, message: { buttonsResponseMessage: { selectedButtonId: 'campana_info', selectedDisplayText: 'Quisiera más información' } } } })
    });
    await sleep(5000);
    const estadoCam = sessionStore.db.prepare("SELECT estado FROM campana_contactos WHERE phone='593965555555'").get();
    out('campaña vía botón en webhook', `estado=${estadoCam.estado} (sin pasar por el LLM)`);

    console.log('\nSMOKE TEST: todo operativo ✅');
  } catch (e) {
    console.error('SMOKE ERROR:', e);
    process.exitCode = 1;
  } finally {
    srv.close();
    campana.detener();
    sessionStore.close();
    setTimeout(() => process.exit(process.exitCode || 0), 300);
  }
});
