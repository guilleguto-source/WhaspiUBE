require('dotenv').config();
const fs = require('fs');

class EvolutionClient {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || process.env.EVOLUTION_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
    this.apiKey = options.apiKey || process.env.EVOLUTION_API_KEY || '';
    this.instance = options.instance || process.env.EVOLUTION_INSTANCE || 'ube-bot';
  }

  async sendText(phone, text) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const url = `${this.baseUrl}/message/sendText/${this.instance}`;
    const payload = {
      number: cleanPhone,
      text: text,
      delay: 1200,
      linkPreview: true
    };

    try {
      const response = await fetch(url, {
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
    const cleanPhone = String(phone).replace(/\D/g, '');
    const url = `${this.baseUrl}/message/sendMedia/${this.instance}`;

    let mediaData = mediaUrlOrBase64;
    // Si es una ruta local en disco, convertir a Base64 para compatibilidad total con Docker/Linux
    if (typeof mediaUrlOrBase64 === 'string' && !mediaUrlOrBase64.startsWith('http') && !mediaUrlOrBase64.startsWith('data:')) {
      if (fs.existsSync(mediaUrlOrBase64)) {
        mediaData = fs.readFileSync(mediaUrlOrBase64).toString('base64');
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
      const response = await fetch(url, {
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

  async sendWhatsAppAudio(phone, audioUrlOrBase64) {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const url = `${this.baseUrl}/message/sendWhatsAppAudio/${this.instance}`;
    const payload = {
      number: cleanPhone,
      audio: audioUrlOrBase64,
      ptt: true
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Evolution API PTT Error [${response.status}]: ${errorBody}`);
      }

      return await response.json();
    } catch (err) {
      console.error(`[wa-client] Fallo enviando audio PTT a ${cleanPhone}:`, err.message);
      throw err;
    }
  }

  async sendPresence(phone, presence = 'composing') {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const url = `${this.baseUrl}/chat/sendPresence/${this.instance}`;
    const payload = {
      number: cleanPhone,
      presence: presence,
      delay: 1000
    };

    try {
      const response = await fetch(url, {
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
}

module.exports = EvolutionClient;
