require('dotenv').config();

const GROQ_AUDIO_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const UBE_INITIAL_PROMPT = 'Universidad Bolivariana del Ecuador, UBE, Senescyt, IESS, mecanizado, Durán, maestría, validación de experiencia, arancel, matrícula, cuota.';

/**
 * Transcribe un buffer de audio a texto usando Groq Whisper Turbo
 * @param {Buffer} audioBuffer - Buffer binario del archivo de audio (.ogg / .mp3 / .wav)
 * @param {string} fileName - Nombre del archivo temporal (ej. audio.ogg)
 * @returns {Promise<string>} Texto transcrito
 */
async function transcribirAudio(audioBuffer, fileName = 'audio.ogg') {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey || apiKey.includes('tu_api_key')) {
    throw new Error('GROQ_API_KEY no configurada para transcripción de audio.');
  }

  const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`;
  const ext = fileName.split('.').pop() || 'ogg';
  const contentType = ext === 'm4a' ? 'audio/mp4' : (ext === 'mp3' ? 'audio/mpeg' : (ext === 'wav' ? 'audio/wav' : 'audio/ogg'));
  
  // Construir multipart/form-data manualmente usando Buffers nativos
  const headerPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`
  );

  const modelPart = Buffer.from(
    `\r\n--${boundary}\r\n` +
    `Content-Disposition: form-data; name="model"\r\n\r\n` +
    `whisper-large-v3-turbo\r\n`
  );

  const promptPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="prompt"\r\n\r\n` +
    `${UBE_INITIAL_PROMPT}\r\n`
  );

  const langPart = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="language"\r\n\r\n` +
    `es\r\n` +
    `--${boundary}--\r\n`
  );

  const body = Buffer.concat([headerPart, audioBuffer, modelPart, promptPart, langPart]);

  const response = await fetch(GROQ_AUDIO_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    },
    body: body
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Error en Groq Whisper [${response.status}]: ${errorBody}`);
  }

  const data = await response.json();
  return (data.text || '').trim();
}

module.exports = { transcribirAudio, UBE_INITIAL_PROMPT };
