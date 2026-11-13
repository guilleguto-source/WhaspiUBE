process.env.NODE_ENV = 'test_dry_run'; // Evitar llamada HTTP real a Evolution API inexistente
const { app, sessionStore } = require('./server');

const TEST_PORT = 3099;
const TEST_PHONE = '593987654321';

async function runTest() {
  const server = app.listen(TEST_PORT, async () => {
    console.log(`[Test] Servidor de prueba levantado en puerto ${TEST_PORT}`);

    try {
      // 1. Test Health
      const resHealth = await fetch(`http://localhost:${TEST_PORT}/health`);
      const dataHealth = await resHealth.json();
      console.log('1. Health Check:', dataHealth.status === 'ok' ? 'PASÓ (OK)' : 'FALLÓ');

      // 2. Simular Mensaje Entrante 1 (Consulta de precios de Derecho Online)
      console.log('\n2. Simulando mensaje entrante de prospecto...');
      const payload1 = {
        event: 'messages.upsert',
        instance: 'ube-bot',
        data: {
          key: {
            remoteJid: `${TEST_PHONE}@s.whatsapp.net`,
            fromMe: false,
            id: `TEST_MSG_${Date.now()}`
          },
          pushName: 'Carlos Mendoza',
          message: {
            conversation: 'Buenas tardes, cuánto cuesta la carrera de Derecho en línea y cuánto tiempo dura?'
          },
          messageType: 'conversation'
        }
      };

      const headers = { 'Content-Type': 'application/json' };
      const tok = process.env.WEBHOOK_TOKEN || process.env.WEBHOOK_SECRET;
      if (tok) headers['x-webhook-token'] = tok;

      const resPost1 = await fetch(`http://localhost:${TEST_PORT}/webhook`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload1)
      });
      console.log('Envío Webhook 1 HTTP Status:', resPost1.status);

      // Esperar a que el pipeline asíncrono de IA complete y guarde en SQLite
      console.log('Esperando respuesta de IA y guardado en SQLite...');
      let intentos = 0;
      let history = [];
      while (intentos < 50) {
        await new Promise(r => setTimeout(r, 1000));
        process.stdout.write('.');
        history = sessionStore.getHistory(TEST_PHONE);
        if (history.length >= 2) break; // user + assistant
        intentos++;
      }
      console.log('');

      console.log(`Historial registrado en SQLite (${history.length} mensajes):`);
      history.forEach(m => {
        console.log(`  [${m.role.toUpperCase()}]: ${m.content}`);
      });

      if (history.length >= 2 && history[1].role === 'assistant') {
        console.log('\n>>> PRUEBA END-TO-END SUPERADA CON ÉXITO <<<');
      } else {
        console.error('\n>>> ERROR: No se completó la respuesta del bot en tiempo <<<');
      }

      // Limpiar datos de prueba
      sessionStore.clearSession(TEST_PHONE);
    } catch (err) {
      console.error('[Test] Error durante la prueba:', err);
    } finally {
      server.close();
      sessionStore.close();
      process.exit(0);
    }
  });
}

runTest();
