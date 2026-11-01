const readline = require('readline');
const HybridAIProvider = require('./ai-provider');
const { generarPromptSistema } = require('./prompt-engine');
require('dotenv').config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ai = new HybridAIProvider();
const promptSistema = generarPromptSistema();
const historial = [];

console.clear();
console.log('================================================================');
console.log('💬 SIMULADOR DE CHAT DE WHATSAPP - AGENTE DE VENTAS');
console.log('================================================================');
console.log(`📡 Proveedor configurado: ${process.env.AI_MODE || 'local'}`);
console.log(`🧠 Modelo activo: ${process.env.OLLAMA_MODEL || 'qwen2.5vl:7b'}`);
console.log('Escribe tus mensajes como si fueras un cliente. Escribe "salir" para terminar.\n');

function preguntar() {
  rl.question('👤 Tú (Cliente): ', async (mensaje) => {
    if (mensaje.trim().toLowerCase() === 'salir') {
      console.log('\n👋 Cerrando simulador.');
      rl.close();
      return;
    }

    if (!mensaje.trim()) {
      preguntar();
      return;
    }

    historial.push({ role: 'user', content: mensaje });

    try {
      const inicio = Date.now();
      process.stdout.write('🤖 Agente escribiendo...');
      const respuesta = await ai.generarRespuesta(promptSistema, historial);
      const latencia = ((Date.now() - inicio) / 1000).toFixed(2);

      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      console.log(`🤖 Agente (${latencia}s):\n${respuesta.texto}\n`);
      historial.push({ role: 'assistant', content: respuesta.texto });
    } catch (err) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      console.error(`❌ Error: ${err.message}\n`);
    }

    preguntar();
  });
}

preguntar();
