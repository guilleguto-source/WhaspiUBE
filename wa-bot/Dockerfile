FROM node:22-bookworm-slim

# Instalar dependencias de sistema para Python, OpenCV y Kokoro TTS (espeak-ng)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    libgl1 \
    libglib2.0-0 \
    espeak-ng \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Crear entorno virtual de Python para RapidOCR
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Instalar dependencias de Python (RapidOCR y OpenCV Headless)
RUN pip install --no-cache-dir rapidocr_onnxruntime opencv-python-headless numpy

# Copiar manifiesto de Node e instalar dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del código del bot
COPY . .

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Directorio de persistencia de SQLite y archivos temporales
VOLUME ["/app/data"]

EXPOSE 3000

CMD ["node", "server.js"]
