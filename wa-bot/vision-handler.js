const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Ejecuta el script de Python RapidOCR y devuelve el análisis estructurado
 * @param {string|Buffer} imageInput - Ruta de archivo o Buffer binario
 * @returns {Promise<{ valido: boolean, relevante: boolean, texto: string, keywords: string[], confianza: number }>}
 */
async function procesarImagen(imageInput) {
  let tempPath = null;
  let targetPath = imageInput;

  // Si se pasa un Buffer, escribirlo a archivo temporal
  if (Buffer.isBuffer(imageInput)) {
    const tmpDir = path.join(__dirname, 'data', 'tmp');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    tempPath = path.join(tmpDir, `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`);
    fs.writeFileSync(tempPath, imageInput);
    targetPath = tempPath;
  }

  const scriptPath = path.join(__dirname, 'ocr-processor.py');

  return new Promise((resolve, reject) => {
    const proc = spawn('python', [scriptPath, targetPath]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString('utf-8');
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString('utf-8');
    });

    proc.on('close', (code) => {
      // Limpiar archivo temporal si se creó
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }

      if (code !== 0) {
        return reject(new Error(`Error en OCR Python [código ${code}]: ${stderr}`));
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Fallo parseando salida JSON de OCR: ${stdout}`));
      }
    });

    proc.on('error', (err) => {
      if (tempPath && fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
      reject(err);
    });
  });
}

module.exports = { procesarImagen };
