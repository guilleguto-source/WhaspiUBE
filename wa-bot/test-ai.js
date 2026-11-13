const HybridAIProvider = require('./ai-provider');
const { generarPromptSistema } = require('./prompt-engine');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
if (!process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY) {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
}

async function ejecutarPrueba() {
  console.log('========================================================');
  console.log('🤖 INICIANDO PRUEBA DE CONVERSACIÓN CON AGENTE DE VENTAS');
  console.log('========================================================\n');

  const ai = new HybridAIProvider({
    geminiApiKey: process.env.GEMINI_API_KEY
  });

  const promptSistema = generarPromptSistema();

  // Simulación de interacción de un cliente potencial en WhatsApp
  const preguntasCliente = [
    'Hola buenas tardes, me interesa saber qué planes de facturación tienen y cuánto cuestan?',
    'Y la firma electrónica viene incluida o se compra por separado? Cuánto tarda?'
  ];

  const historial = [];

  for (const pregunta of preguntasCliente) {
    console.log(`👤 CLIENTE (WhatsApp): "${pregunta}"`);
    historial.push({ role: 'user', content: pregunta });

    try {
      const inicio = Date.now();
      const resultado = await ai.generarRespuesta(promptSistema, historial);
      const latencia = ((Date.now() - inicio) / 1000).toFixed(2);

      console.log(`🤖 AGENTE [${resultado.proveedor} | ${resultado.modeloUsado} | ${latencia}s]:`);
      console.log(`"${resultado.texto}"\n`);

      historial.push({ role: 'assistant', content: resultado.texto });
    } catch (err) {
      console.error('❌ Error al generar respuesta:', err.message);
    }
  }

  console.log('========================================================');
  console.log('✅ PRUEBA COMPLETADA EXITOSAMENTE');
  console.log('========================================================');
}

ejecutarPrueba();
