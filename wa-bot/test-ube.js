const HybridAIProvider = require('./ai-provider');
const { generarPromptSistema } = require('./prompt-engine');
require('dotenv').config();

async function probarAsesorUBE() {
  console.log('================================================================');
  console.log('🎓 SIMULACIÓN: ASESOR DE ADMISIONES UBE POR WHATSAPP');
  console.log('================================================================\n');

  const ai = new HybridAIProvider();
  const promptSistema = generarPromptSistema();

  const casos = [
    {
      titulo: 'CASO 1: Consulta inicial sobre carreras de Educación',
      mensaje: 'Hola buenas tardes, soy docente de escuela pero aún no tengo título universitario. ¿Qué opciones tienen para mí en Educación?'
    },
    {
      titulo: 'CASO 2: Consulta sobre Maestría en Educación Básica y facilidad de pago',
      mensaje: 'Hola, ya soy licenciado. ¿Cuánto cuesta la Maestría en Educación Básica y en cuántas cuotas se puede pagar?'
    }
  ];

  for (const c of casos) {
    console.log(`📌 ${c.titulo}`);
    console.log(`👤 Prospecto: "${c.mensaje}"`);

    const historial = [{ role: 'user', content: c.mensaje }];
    try {
      const inicio = Date.now();
      const resp = await ai.generarRespuesta(promptSistema, historial);
      const latencia = ((Date.now() - inicio) / 1000).toFixed(2);
      console.log(`🤖 Asesor UBE (${latencia}s):\n"${resp.texto}"\n`);
    } catch (err) {
      console.error(`❌ Error: ${err.message}\n`);
    }
  }
}

probarAsesorUBE();
