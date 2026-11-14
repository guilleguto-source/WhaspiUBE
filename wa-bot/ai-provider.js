const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function sanitizarRespuestaTruncada(texto) {
  if (!texto || typeof texto !== 'string') return texto;
  let limpio = texto.trim();
  const palabrasColgantes = /\b(con|de|en|para|por|sin|sobre|hacia|desde|hasta|que|cual|como|donde|cuando|y|o|pero|he|ha|has|ya|tu|su|mi|un|una|el|la|los|las|al|del)\s*$/i;
  if (palabrasColgantes.test(limpio) || /¿[^?]*$/.test(limpio)) {
    limpio = limpio.replace(/\s*¿[^?]*$/, '').trim();
    limpio = limpio.replace(palabrasColgantes, '').trim();
    if (limpio && !/[.!?:]$/.test(limpio)) limpio += '.';
  }
  return limpio;
}

function esConsultaCompleja(messages, tokensEstimados) {
  const ultMsg = messages[messages.length - 1]?.content || '';
  const ultMsgNorm = ultMsg.toLowerCase();

  // 1. Contexto volumétrico alto o conversación avanzada
  if (tokensEstimados > 3200 || messages.length > 6) return true;

  // 2. Mensaje largo o nota de voz transcrita con mucho contenido
  if (ultMsg.length > 220) return true;

  // 3. Consultas que requieren razonamiento contextual profundo
  const patronesComplejos = [
    /diferencia entre/i,
    /cu[aá]l (es mejor|me conviene|recomiendas)/i,
    /homolog/i,
    /convalid/i,
    /t[ií]tulo del exterior|extranjero|apostill/i,
    /senescyt.*(reconoc|registr|valida)/i,
    /\?.*\?/, // Múltiples preguntas en un mensaje
    /por qu[eé] tan caro/i,
    /otra universidad/i,
    /malla.*completa|todas las materias/i
  ];

  return patronesComplejos.some(p => p.test(ultMsgNorm));
}

class HybridAIProvider {
  constructor(config = {}) {
    this.mode = config.mode || process.env.AI_MODE || 'hybrid';
    this.aiStrategy = config.aiStrategy || process.env.AI_STRATEGY || 'inteligente'; // 'inteligente', 'alternar' o 'failover'
    this.alternanciaTurno = 0;
    this.groqCooldownUntil = 0; // Fallback legacy
    this.groqKeyCooldowns = new Map(); // Cooldown independiente por API key
    this.geminiCooldownUntil = 0; // Cooldown si Gemini agota cuota RPD
    
    // Config Groq (soporta pool de claves separadas por coma para rotación/failover)
    const rawGroq = config.groqApiKey || process.env.GROQ_API_KEY || '';
    this.groqApiKeys = rawGroq
      .split(',')
      .map(k => k.trim())
      .filter(k => k && !k.includes('tu_api_key'));
    this.groqKeyIndex = 0;
    this.groqBaseUrl = config.groqBaseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = config.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

    // Config Gemini (soporta pool de claves separadas por coma para rotación/failover)
    const rawGemini = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.geminiApiKeys = rawGemini
      .split(',')
      .map(k => k.trim())
      .filter(k => k && !k.includes('tu_api_key'));
    this.geminiKeyIndex = 0;
    this.geminiKeyCooldowns = new Map();
    this.geminiModel = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

    // Config Local (Ollama)
    this.ollamaBaseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
    this.ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  }

  async _llamarGeminiDirecto(promptSistema, messages, externalSignal = null, apiKey = null) {
    const keyToUse = apiKey || this.geminiApiKeys[0];
    if (!keyToUse) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${keyToUse}`;
    
    // Transformar historial al formato de Gemini
    let contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content || '' }]
      }));

    if (contents.length === 0) {
      contents = [{ role: 'user', parts: [{ text: 'Hola' }] }];
    }

    const body = {
      system_instruction: {
        parts: [{ text: promptSistema }]
      },
      contents,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 800
      }
    };

    const controller = new AbortController();
    let fueTimeoutInterno = false;
    const timeout = setTimeout(() => {
      fueTimeoutInterno = true;
      controller.abort();
    }, 12000);

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Gemini HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const candidate = data.candidates?.[0];
      const texto = candidate?.content?.parts?.[0]?.text?.trim() || '';
      if (!texto) {
        throw new Error(`Gemini devolvió respuesta vacía (finishReason: ${candidate?.finishReason || 'UNKNOWN'})`);
      }
      return {
        texto: sanitizarRespuestaTruncada(texto),
        modeloUsado: this.geminiModel,
        proveedor: 'cloud-gemini'
      };
    } catch (err) {
      clearTimeout(timeout);
      if (externalSignal && externalSignal.aborted && !fueTimeoutInterno) {
        throw err;
      }
      if (fueTimeoutInterno || err.name === 'AbortError') {
        throw new Error(`Timeout de inferencia en Gemini: ${err.message}`);
      }
      throw err;
    }
  }

  async _llamarEndpointOpenAI(baseUrl, apiKey, model, messages, timeoutMs = 12000, externalSignal = null) {
    const controller = new AbortController();
    let fueTimeoutInterno = false;
    const timeout = setTimeout(() => {
      fueTimeoutInterno = true;
      controller.abort();
    }, timeoutMs);

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const requestPayload = {
      model,
      messages,
      temperature: 0.5,
      max_tokens: 800
    };
    if (baseUrl.includes('groq.com')) {
      requestPayload.reasoning_effort = 'low';
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 429) {
          const match = errText.match(/try again in ([\d\.]+)\s*(ms|s)/i);
          let waitMs = 1500;
          if (match) {
            const val = parseFloat(match[1]);
            const unit = match[2].toLowerCase();
            waitMs = unit === 'ms' ? Math.ceil(val) + 100 : Math.ceil(val * 1000) + 200;
          }
          // Si Groq entra en 429, activar cooldown por clave
          if (baseUrl.includes('groq.com') && apiKey) {
            const cooldownMs = Math.max(25000, waitMs);
            this.groqKeyCooldowns.set(apiKey, Date.now() + cooldownMs);
            console.warn(`[HybridAI] Circuit Breaker: Clave Groq (...${apiKey.slice(-6)}) en cooldown por ${Math.round(cooldownMs / 1000)}s debido a 429.`);
          }
          // Si tenemos Gemini como respaldo activo, conmutamos de inmediato sin bloquear al usuario
          if (this.geminiApiKey && !this.geminiApiKey.includes('tu_api_key') && !baseUrl.includes('11434')) {
            throw new Error(`Rate limit 429 en Groq (${errText}). Conmutando inmediatamente a respaldo Gemini...`);
          }
          if (waitMs <= 25000 && !externalSignal?.aborted) {
            console.warn(`[HybridAI] Rate limit 429 en Groq, pausando ${waitMs}ms antes de reintentar...`);
            await new Promise(r => setTimeout(r, waitMs));
            const retryRes = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model,
                messages,
                temperature: 0.5,
                max_tokens: 800
              }),
              signal: controller.signal
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              const retryTexto = retryData.choices[0]?.message?.content?.trim() || '';
              if (retryTexto) {
                return {
                  texto: sanitizarRespuestaTruncada(retryTexto),
                  modeloUsado: model,
                  proveedor: baseUrl.includes('11434') ? 'local-ollama' : 'cloud-groq'
                };
              }
            }
          }
        }
        throw new Error(`HTTP ${response.status} en ${baseUrl}: ${errText}`);
      }

      const data = await response.json();
      const texto = data.choices[0]?.message?.content?.trim() || '';
      if (!texto) {
        throw new Error(`Endpoint ${baseUrl} devolvió contenido vacío`);
      }
      return {
        texto: sanitizarRespuestaTruncada(texto),
        modeloUsado: model,
        proveedor: baseUrl.includes('11434') ? 'local-ollama' : 'cloud-groq'
      };
    } catch (err) {
      clearTimeout(timeout);
      if (externalSignal && externalSignal.aborted && !fueTimeoutInterno) {
        throw err;
      }
      if (fueTimeoutInterno || err.name === 'AbortError') {
        throw new Error(`Timeout de inferencia (${timeoutMs}ms) en ${baseUrl}: ${err.message}`);
      }
      throw err;
    }
  }

  async generarRespuesta(promptSistema, messages, externalSignal = null) {
    const fullMessages = [
      { role: 'system', content: promptSistema },
      ...messages
    ];

    // 1. Modo Forzado Local
    if (this.mode === 'local') {
      return await this._llamarEndpointOpenAI(
        this.ollamaBaseUrl,
        null,
        this.ollamaModel,
        fullMessages,
        90000, // 90s para primer arranque en frío en CPU
        externalSignal
      );
    }

    const tieneGroq = this.groqApiKeys.length > 0;
    const tieneGemini = this.geminiApiKeys.length > 0;

    // Estimación rápida de tokens (prompt + historial de mensajes)
    const totalCaracteres = promptSistema.length + messages.reduce((acc, m) => acc + (m.content ? m.content.length : 0), 0);
    const tokensEstimados = Math.round(totalCaracteres / 3.8);

    // Claves Groq activas (excluyendo las que estén en cooldown por 429 reciente)
    const clavesGroqDisponibles = this.groqApiKeys.filter(k => {
      const cd = this.groqKeyCooldowns.get(k) || 0;
      return Date.now() >= cd;
    });
    const groqTotalmenteEnCooldown = tieneGroq && clavesGroqDisponibles.length === 0;

    // Claves Gemini activas
    const clavesGeminiDisponibles = this.geminiApiKeys.filter(k => {
      const cd = this.geminiKeyCooldowns.get(k) || 0;
      return Date.now() >= cd;
    });
    const geminiTotalmenteEnCooldown = tieneGemini && clavesGeminiDisponibles.length === 0;
    const geminiEnCooldown = geminiTotalmenteEnCooldown || Boolean(this.geminiCooldownUntil && Date.now() < this.geminiCooldownUntil);

    // Determinar orden según la estrategia:
    // 'inteligente': 
    //    - Mensajes complejos / largos / comparaciones → Gemini primero (1M contexto, razonamiento superior).
    //    - Mensajes estándar de embudo → Groq primero (<500ms latencia ultra-rápida).
    //    - Si cualquiera se satura → Failover automático e instantáneo al otro pool.
    // 'alternar': Round-robin 50/50 balanceado.
    // 'failover': Groq siempre primero, Gemini de respaldo.
    const orden = [];
    const esComplejo = esConsultaCompleja(messages, tokensEstimados);

    if (this.aiStrategy === 'inteligente' && tieneGroq && tieneGemini) {
      if (groqTotalmenteEnCooldown && !geminiEnCooldown) {
        orden.push('gemini', 'groq');
      } else if (geminiEnCooldown) {
        orden.push('groq', 'gemini');
      } else if (esComplejo) {
        orden.push('gemini', 'groq');
      } else {
        orden.push('groq', 'gemini');
      }
    } else if (this.aiStrategy === 'alternar' && tieneGroq && tieneGemini) {
      const turnoPar = (this.alternanciaTurno++ % 2) === 0;
      if (turnoPar) {
        orden.push('groq', 'gemini');
      } else {
        orden.push('gemini', 'groq');
      }
    } else {
      if (tieneGroq && !groqTotalmenteEnCooldown) orden.push('groq');
      if (tieneGemini && !geminiEnCooldown) orden.push('gemini');
      if (tieneGroq && groqTotalmenteEnCooldown) orden.push('groq');
      if (tieneGemini && geminiEnCooldown) orden.push('gemini');
    }

    // 2. Intentar proveedores en orden con failover automático e instantáneo
    for (const prov of orden) {
      if (prov === 'groq') {
        const clavesAIntentar = clavesGroqDisponibles.length > 0 ? clavesGroqDisponibles : this.groqApiKeys;
        for (let i = 0; i < clavesAIntentar.length; i++) {
          const keyIdx = (this.groqKeyIndex + i) % clavesAIntentar.length;
          const currentKey = clavesAIntentar[keyIdx];
          try {
            const res = await this._llamarEndpointOpenAI(
              this.groqBaseUrl,
              currentKey,
              this.groqModel,
              fullMessages,
              15000,
              externalSignal
            );
            this.groqKeyIndex = (keyIdx + 1) % clavesAIntentar.length;
            return res;
          } catch (errGroq) {
            if (errGroq.name === 'AbortError') throw errGroq;
            console.warn(`[HybridAI] Groq (Key ...${currentKey.slice(-6)}) falló (${errGroq.message}), probando siguiente opción...`);
          }
        }
      } else if (prov === 'gemini') {
        const clavesAIntentar = clavesGeminiDisponibles.length > 0 ? clavesGeminiDisponibles : this.geminiApiKeys;
        for (let i = 0; i < clavesAIntentar.length; i++) {
          const keyIdx = (this.geminiKeyIndex + i) % clavesAIntentar.length;
          const currentKey = clavesAIntentar[keyIdx];
          try {
            const res = await this._llamarGeminiDirecto(promptSistema, messages, externalSignal, currentKey);
            this.geminiKeyIndex = (keyIdx + 1) % clavesAIntentar.length;
            return res;
          } catch (errGemini) {
            if (errGemini.name === 'AbortError') throw errGemini;
            if (errGemini.message && (errGemini.message.includes('429') || errGemini.message.includes('limit exceeded') || errGemini.message.includes('ResourceExhausted'))) {
              this.geminiKeyCooldowns.set(currentKey, Date.now() + (30 * 1000));
              console.warn(`[HybridAI] Gemini (Key ...${currentKey.slice(-6)}) 429. Cooldown activado por 30s.`);
            }
            console.warn(`[HybridAI] Gemini (Key ...${currentKey.slice(-6)}) falló (${errGemini.message}), probando siguiente opción...`);
          }
        }
      }
    }

    // 3. Modo Respaldo Final: Ollama local o contingencia institucional
    try {
      return await this._llamarEndpointOpenAI(
        this.ollamaBaseUrl,
        null,
        this.ollamaModel,
        fullMessages,
        this.mode === 'local' ? 90000 : 5000,
        externalSignal
      );
    } catch (errOllama) {
      if (errOllama.name === 'AbortError') throw errOllama;
      console.warn(`[HybridAI] Respaldo final Ollama falló (${errOllama.message}). Emitiendo respuesta institucional de contingencia.`);
      return {
        texto: '¡Hola! Justo en este instante estoy actualizando la información de admisiones en el sistema institucional. 😊 Por favor déjame tu nombre y qué carrera o maestría te interesa, y enseguida te comparto los valores oficiales y su tríptico.',
        modeloUsado: 'fallback-institucional',
        proveedor: 'sistema-local'
      };
    }
  }
}

module.exports = HybridAIProvider;
