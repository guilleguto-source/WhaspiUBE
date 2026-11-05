require('dotenv').config();
const fs = require('fs');

// v5 (auditoría): TODAS las llamadas a Evolution API llevan timeout para que
// un cuelgue de la API no congele el pipeline de mensajes.
const HTTP_TIMEOUT_MS = parseInt(process.env.EVOLUTION_TIMEOUT_MS, 10) || 20000;

function fetchConTimeout(url, opciones = {}) {
  return fetch(url, { ...opciones, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
}

// v5.2 (regresión): antes TODOS los envíos hacían replace(/\D/g,''), lo que
// DESTRUIA los JIDs de grupo ('120363...@g.us' → '120363'). Ahora si el destino
// trae @ (grupo o JID directo) se respeta tal cual; si es un número, se limpia.
function destinoWa(phone) {
  const s = String(phone || '').trim();
  return /@[a-z]/i.test(s) ? s : s.replace(/\D/g, '');
}

class EvolutionClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.EVOLUTION_API_KEY || '';
    this.instance = options.instance || process.env.EVOLUTION_INSTANCE || 'ube-bot';
  }

  async sendText(phone, text) {
    const cleanPhone = destinoWa(phone);
    const url = `${this.baseUrl}/message/sendText/${this.instance}`;
    const payload = {
      number: cleanPhone,
      text: text,
      delay: 1200,
      linkPreview: true
    };

    try {
      const response = await fetchConTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Evolution API Error [${response.status}]: ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[wa-client] Fallo enviando texto a ${cleanPhone}:`, err.message);
      throw err;
    }
  }

  async sendMedia(phone, mediaUrlOrBase64, options = {}) {
    const cleanPhone = destinoWa(phone);
    const url = `${this.baseUrl}/message/sendMedia/${this.instance}`;

    let mediaData = mediaUrlOrBase64;
    // Si es una ruta local en disco, convertir a Base64 para compatibilidad total con Docker/Linux
    if (typeof mediaUrlOrBase64 === 'string' && !mediaUrlOrBase64.startsWith('http') && !mediaUrlOrBase64.startsWith('data:')) {
      if (fs.existsSync(mediaUrlOrBase64)) {
        mediaData = fs.readFileSync(mediaUrlOrBase64).toString('base64');
      } else {
        // v5 (auditoría): antes enviaba la RUTA como media (basura al cliente);
        // ahora falla con un error claro y el llamador decide qué hacer.
        throw new Error(`[wa-client] Archivo local no encontrado para sendMedia: ${mediaUrlOrBase64}`);
      }
    }

    const payload = {
      number: cleanPhone,
      media: mediaData,
      mediatype: options.mediaType || 'document',
      caption: options.caption || '',
      fileName: options.fileName || 'documento_ube.pdf'
    };

    try {
      const response = await fetchConTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Evolution API Media Error [${response.status}]: ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[wa-client] Fallo enviando media a ${cleanPhone}:`, err.message);
      throw err;
    }
  }

  // v5.2: sendWhatsAppAudio ELIMINADO — Diana vuelve a ser 100% texto (la
  // síntesis de voz (Kokoro/Edge-TTS) quedó fuera del proyecto y este método
  // era su único llamador).

  async sendPresence(phone, presence = 'composing') {
    const cleanPhone = destinoWa(phone);
    const url = `${this.baseUrl}/chat/sendPresence/${this.instance}`;
    const payload = {
      number: cleanPhone,
      presence: presence,
      delay: 1000
    };

    try {
      const response = await fetchConTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify(payload)
      });
      return response.ok ? await response.json() : null;
    } catch (err) {
      return null;
    }
  }

  // v5.2: lista los grupos donde está el bot (para resolver el JID del grupo
  // de asesores "UBE - Better Together" por nombre). Tolerante a ambas formas
  // de respuesta de Evolution (array directo o {groups:[...]}).
  async listarGrupos() {
    const url = `${this.baseUrl}/group/fetchGroups/${this.instance}?getParticipants=false`;
    try {
      const response = await fetchConTimeout(url, {
        method: 'GET',
        headers: { 'apikey': this.apiKey }
      });
      if (!response.ok) return [];
      const j = await response.json();
      return Array.isArray(j) ? j : (j.groups || j.data || []);
    } catch (err) {
      console.warn('[wa-client] listarGrupos falló:', err.message);
      return [];
    }
  }

  // =======================================================
  // v3 · MENSAJES INTERACTIVOS (botones y listas)
  // WhatsApp nativo permite máx. 3 botones reply; para más
  // opciones usar sendList (hasta 10 filas por sección).
  // Si la instancia no soporta interactivos → degradación a
  // texto numerado para que la conversación nunca se caiga.
  // =======================================================
  async sendButtons(phone, texto, opciones = [], extras = {}) {
    const cleanPhone = destinoWa(phone);
    if (!opciones.length) return this.sendText(cleanPhone, texto);

    const url = `${this.baseUrl}/message/sendButtons/${this.instance}`;
    // Formato Evolution API v2 (reply buttons)
    const payloadV2 = {
      number: cleanPhone,
      text: texto,
      title: extras.titulo || undefined,
      footer: extras.footer || undefined,
      buttons: opciones.map(o => ({ type: 'reply', id: o.id, label: o.label }))
    };
    // Formato legacy Baileys
    const payloadLegacy = {
      number: cleanPhone,
      text: texto,
      title: extras.titulo || undefined,
      footer: extras.footer || undefined,
      buttons: opciones.map(o => ({ buttonId: o.id, buttonText: { displayText: o.label }, type: 1 }))
    };

    for (const payload of [payloadV2, payloadLegacy]) {
      try {
        const response = await fetchConTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
          body: JSON.stringify(payload)
        });
        if (response.ok) return await response.json();
      } catch (err) { /* intentar siguiente formato */ }
    }

    // Degradación: texto numerado con la misma pregunta
    const listaTexto = opciones.map((o, i) => `${i + 1}. ${o.label}`).join('\n');
    return this.sendText(cleanPhone, `${texto}\n\nResponde con el número o el nombre de la opción:\n${listaTexto}`);
  }

  async sendList(phone, texto, { tituloBoton = 'Ver opciones', footer = '', secciones = [] } = {}) {
    const cleanPhone = destinoWa(phone);
    const filasTotales = secciones.reduce((acc, s) => acc + (s.filas?.length || 0), 0);
    if (!filasTotales) return this.sendText(phone, texto);

    const url = `${this.baseUrl}/message/sendList/${this.instance}`;
    const payload = {
      number: cleanPhone,
      text: texto,
      description: texto, // compatibilidad con versiones nuevas
      title: tituloBoton,
      buttonText: tituloBoton,
      footer: footer || undefined,
      // v5 (auditoría): límites duros de WhatsApp — título de fila ≤24 chars,
      // descripción ≤72 (un título largo hace que Evolution rechace el envío
      // y degradar a texto NUMERADO pierde los botones).
      sections: secciones.map(s => ({
        title: String(s.titulo || 'Opciones').slice(0, 24),
        rows: (s.filas || []).slice(0, 10).map(f => ({
          rowId: f.id,
          title: String(f.titulo || '').slice(0, 24),
          description: String(f.desc || '').slice(0, 72) || ''
        }))
      }))
    };

    try {
      const response = await fetchConTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': this.apiKey },
        body: JSON.stringify(payload)
      });
      if (response.ok) return await response.json();
    } catch (err) { /* degradar */ }

    // Degradación: texto numerado con todas las opciones
    const lineas = [];
    for (const s of secciones) {
      if (s.titulo) lineas.push(`*${s.titulo}*`);
      (s.filas || []).forEach((f, i) => lineas.push(`${i + 1}. ${f.titulo}${f.desc ? ` — ${f.desc}` : ''}`));
    }
    return this.sendText(cleanPhone, `${texto}\n\n${lineas.join('\n')}\n\nResponde con el número o el nombre de la opción 🙌`);
  }
}

module.exports = EvolutionClient;
module.exports.destinoWa = destinoWa;   // expuesto para tests
