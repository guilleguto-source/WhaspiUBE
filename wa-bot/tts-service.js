const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const AUDIO_DIR = path.join(__dirname, 'data', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function generarConKokoro(text, voice = 'ef_dora') {
  return new Promise((resolve, reject) => {
    const fileId = `diana_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
    const outputPath = path.join(AUDIO_DIR, fileId);
    const pythonCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
    const scriptPath = path.join(__dirname, 'kokoro-tts.py');

    const args = [
      scriptPath,
      '--text', text,
      '--out', outputPath,
      '--voice', voice,
      '--speed', '1.0'
    ];

    const proc = spawn(pythonCmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Fallo Kokoro TTS (código ${code}): ${stderr}`));
      }
      try {
        const json = JSON.parse(stdout.trim());
        if (json.ok) {
          resolve({
            ok: true,
            audioUrl: `/api/audio/${fileId}`,
            duration: json.duracion_segundos || 5,
            fileName: fileId,
            voz: json.voz_usada || voice,
            engine: 'kokoro'
          });
        } else {
          reject(new Error(json.error || 'Error en Kokoro TTS'));
        }
      } catch (err) {
        reject(new Error(`Salida no válida Kokoro: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Error invocando Python para Kokoro: ${err.message}`));
    });
  });
}

function generarConEdge(text, voice = 'es-EC-AndreaNeural') {
  return new Promise((resolve, reject) => {
    const fileId = `diana_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
    const outputPath = path.join(AUDIO_DIR, fileId);
    const pythonCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
    const scriptPath = path.join(__dirname, 'edge-tts-gen.py');

    const args = [
      scriptPath,
      '--text', text,
      '--out', outputPath,
      '--voice', voice
    ];

    const proc = spawn(pythonCmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Fallo Edge-TTS (código ${code}): ${stderr}`));
      }
      try {
        const json = JSON.parse(stdout.trim());
        if (json.ok) {
          resolve({
            ok: true,
            audioUrl: `/api/audio/${fileId}`,
            duration: json.duracion_segundos || 5,
            fileName: fileId,
            voz: json.voz_usada || voice,
            engine: 'edge'
          });
        } else {
          reject(new Error(json.error || 'Error en Edge-TTS'));
        }
      } catch (err) {
        reject(new Error(`Salida no válida Edge-TTS: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Error invocando Python para Edge-TTS: ${err.message}`));
    });
  });
}

/**
 * Genera una nota de voz corta (<15s) usando Edge-TTS (Andrea Ecuador) por defecto,
 * con conmutación transparente a Kokoro local ante fallos de red.
 */
async function generarNotaDeVoz(text, voiceOverride = null) {
  if (!text || !text.trim()) {
    throw new Error('Texto vacío para síntesis de voz');
  }

  const engine = (process.env.TTS_ENGINE || 'edge').toLowerCase();
  const edgeVoice = voiceOverride || process.env.EDGE_VOICE || 'es-EC-AndreaNeural';
  const kokoroVoice = voiceOverride || process.env.KOKORO_VOICE || 'ef_dora';

  if (engine === 'kokoro') {
    return await generarConKokoro(text, kokoroVoice);
  }

  try {
    return await generarConEdge(text, edgeVoice);
  } catch (errEdge) {
    console.warn('[TTS] Edge-TTS no disponible, conmutando a Kokoro local:', errEdge.message);
    return await generarConKokoro(text, kokoroVoice);
  }
}

module.exports = { generarNotaDeVoz, AUDIO_DIR };
