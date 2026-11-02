const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const AUDIO_DIR = path.join(__dirname, 'data', 'audio');
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

/**
 * Genera una nota de voz corta (<15s) usando Kokoro-82M TTS Local
 * @param {string} text - Texto que pronunciará Diana
 * @param {string} [voice='ef_dora'] - Voz (por defecto voz femenina en español)
 * @returns {Promise<{ ok: boolean, audioUrl: string, duration: number, fileName: string }>}
 */
function generarNotaDeVoz(text, voice = 'ef_dora') {
  return new Promise((resolve, reject) => {
    if (!text || !text.trim()) {
      return reject(new Error('Texto vacío para síntesis de voz'));
    }

    const fileId = `diana_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`;
    const outputPath = path.join(AUDIO_DIR, fileId);
    const pythonCmd = process.env.PYTHON_CMD || (process.platform === 'win32' ? 'python' : 'python3');
    const scriptPath = path.join(__dirname, 'kokoro-tts.py');

    const args = [
      scriptPath,
      '--text', text,
      '--out', outputPath,
      '--voice', voice,
      '--speed', '1.05'
    ];

    const proc = spawn(pythonCmd, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString('utf-8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`[Kokoro TTS] Error ejecutando script (código ${code}):`, stderr);
        return reject(new Error(`Fallo en TTS Kokoro: ${stderr || 'código ' + code}`));
      }

      try {
        const json = JSON.parse(stdout.trim());
        if (json.ok) {
          resolve({
            ok: true,
            audioUrl: `/api/audio/${fileId}`,
            duration: json.duracion_segundos || 5,
            fileName: fileId,
            voz: json.voz_usada
          });
        } else {
          reject(new Error(json.error || 'Error desconocido en Kokoro TTS'));
        }
      } catch (err) {
        reject(new Error(`Salida no válida de Kokoro TTS: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`No se pudo invocar Python para Kokoro TTS: ${err.message}`));
    });
  });
}

module.exports = { generarNotaDeVoz, AUDIO_DIR };
