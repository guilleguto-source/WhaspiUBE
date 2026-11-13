const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

class HybridAIProvider {
  constructor(config = {}) {
    this.mode = config.mode || process.env.AI_MODE || 'hybrid';
    this.aiStrategy = config.aiStrategy || process.env.AI_STRATEGY || 'alternar'; // 'alternar' o 'failover'
    this.alternanciaTurno = 0;
    
    // Config Groq (soporta pool de claves separadas por coma para rotación/failover)
    const rawGroq = config.groqApiKey || process.env.GROQ_API_KEY || '';
    this.groqApiKeys = rawGroq
      .split(',')
      .map(k => k.trim())
      .filter(k => k && !k.includes('tu_api_key'));
    this.groqKeyIndex = 0;
    this.groqBaseUrl = config.groqBaseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
    this.groqModel = config.groqModel || process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

    // Config Gemini
    this.geminiApiKey = config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    this.geminiModel = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    // Config Local (Ollama)
    this.ollamaBaseUrl = config.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1';
    this.ollamaModel = config.ollamaModel || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  }

  async _llamarGeminiDirecto(promptSistema, messages, externalSignal = null) {
    if (!this.geminiApiKey || this.geminiApiKey.includes('tu_api_key')) {
      throw new Error('GEMINI_API_KEY no configurada');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
    
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
        maxOutputTokens: 450
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
      const texto = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      return {
        texto,
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

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          max_tokens: 450
        }),
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
          // Si tenemos Gemini como respaldo activo y la espera supera 3s, conmutamos de inmediato sin bloquear al usuario
          if (this.geminiApiKey && !this.geminiApiKey.includes('tu_api_key') && waitMs > 3000 && !baseUrl.includes('11434')) {
            throw new Error(`Rate limit 429 en Groq (${errText}). Conmutando inmediatamente a respaldo Gemini sin esperar ${waitMs}ms...`);
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
                max_tokens: 450
              }),
              signal: controller.signal
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              return {
                texto: retryData.choices[0]?.message?.content?.trim() || '',
                modeloUsado: model,
                proveedor: baseUrl.includes('11434') ? 'local-ollama' : 'cloud-groq'
              };
            }
          }
        }
        throw new Error(`HTTP ${response.status} en ${baseUrl}: ${errText}`);
      }

      const data = await response.json();
      return {
        texto: data.choices[0]?.message?.content?.trim() || '',
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
    const tieneGemini = Boolean(this.geminiApiKey && !this.geminiApiKey.includes('tu_api_key'));

    // Determinar orden de llamada según la estrategia configurada:
    // 'alternar': Round-robin (50/50) entre Groq y Gemini para no saturar cuotas TPM ni RPM
    // 'failover' o default: Priorizar Groq con respaldo inmediato en Gemini
    const orden = [];
    if (this.aiStrategy === 'alternar' && tieneGroq && tieneGemini) {
      const turnoPar = (this.alternanciaTurno++ % 2) === 0;
      if (turnoPar) {
        orden.push('groq', 'gemini');
      } else {
        orden.push('gemini', 'groq');
      }
    } else {
      if (tieneGroq) orden.push('groq');
      if (tieneGemini) orden.push('gemini');
    }

    // 2. Intentar proveedores en orden con failover automático e instantáneo
    for (const prov of orden) {
      if (prov === 'groq') {
        for (let i = 0; i < this.groqApiKeys.length; i++) {
          const keyIdx = (this.groqKeyIndex + i) % this.groqApiKeys.length;
          const currentKey = this.groqApiKeys[keyIdx];
          try {
            const res = await this._llamarEndpointOpenAI(
              this.groqBaseUrl,
              currentKey,
              this.groqModel,
              fullMessages,
              15000,
              externalSignal
            );
            this.groqKeyIndex = (keyIdx + 1) % this.groqApiKeys.length;
            return res;
          } catch (errGroq) {
            if (errGroq.name === 'AbortError') throw errGroq;
            console.warn(`[HybridAI] Groq (Key #${keyIdx + 1}) falló (${errGroq.message}), probando siguiente opción...`);
          }
        }
      } else if (prov === 'gemini') {
        try {
          return await this._llamarGeminiDirecto(promptSistema, messages, externalSignal);
        } catch (errGemini) {
          if (errGemini.name === 'AbortError') throw errGemini;
          console.warn(`[HybridAI] Gemini falló (${errGemini.message}), probando siguiente opción...`);
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
