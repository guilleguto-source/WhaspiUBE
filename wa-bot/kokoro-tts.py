#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WhaspiUBE · Generador de Notas de Voz Cortas con Kokoro-82M TTS Local
Voz femenina en español: 'ef_dora' (Dora)
Limita la respuesta a <15 segundos de locución.
"""

import sys
import os
import re
import json
import argparse
import time
import soundfile as sf
from kokoro_onnx import Kokoro

DIR_ACTUAL = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(DIR_ACTUAL, 'models', 'kokoro', 'kokoro-v1.0.onnx')
if not os.path.exists(MODEL_PATH):
    MODEL_PATH = os.path.join(DIR_ACTUAL, 'models', 'kokoro', 'kokoro-v0_19.onnx')
VOICES_PATH = os.path.join(DIR_ACTUAL, 'models', 'kokoro', 'voices-v1.0.bin')

# Fallback si v1.0 no está presente
if not os.path.exists(VOICES_PATH):
    VOICES_PATH = os.path.join(DIR_ACTUAL, 'models', 'kokoro', 'voices.bin')

_kokoro_instance = None

def get_kokoro():
    global _kokoro_instance
    if _kokoro_instance is None:
        if not os.path.exists(MODEL_PATH) or not os.path.exists(VOICES_PATH):
            raise FileNotFoundError(f"Archivos de Kokoro no encontrados en {MODEL_PATH}")
        _kokoro_instance = Kokoro(MODEL_PATH, VOICES_PATH)
    return _kokoro_instance

def limpiar_texto_para_voz(texto: str) -> str:
    """Elimina formato markdown, tags [PDF:...] y acorta a <15 segundos"""
    # Eliminar tags [PDF:...]
    t = re.sub(r'\[PDF:[^\]]+\]', '', texto, flags=re.IGNORECASE)
    # Eliminar links y urls
    t = re.sub(r'https?://\S+', '', t)
    # Eliminar negritas, cursivas y tags html
    t = re.sub(r'[*_~`#>]', '', t)
    t = re.sub(r'<[^>]+>', '', t)
    # Normalizar signos y precios
    t = t.replace('$', ' dólares ').replace('/', ' por ')
    # Reemplazar números con formato x140 a por 140
    t = re.sub(r'(\d+)×', r'\1 por ', t)
    t = re.sub(r'\s+', ' ', t).strip()

    # Recortar a máx 35 palabras para asegurar <15 segundos de audio
    palabras = t.split()
    if len(palabras) > 35:
        # Tomar hasta el último punto dentro de las 35 palabras o cortar con cortesía
        candidato = " ".join(palabras[:35])
        if '.' in candidato:
            candidato = candidato.rsplit('.', 1)[0] + '.'
        t = candidato
    return t

def sintetizar(texto: str, output_path: str, voz: str = 'ef_dora', velocidad: float = 1.0):
    t_limpio = limpiar_texto_para_voz(texto)
    if not t_limpio:
        t_limpio = "Hola, soy Diana de la Universidad Bolivariana del Ecuador. ¿En qué puedo ayudarte?"

    k = get_kokoro()
    voices = k.get_voices()
    
    # Si ef_dora no está en el binario, usar af_sarah o primera voz femenina disponible
    voz_seleccionada = voz if voz in voices else ('af_sarah' if 'af_sarah' in voices else voices[0])
    lang = 'es' if voz_seleccionada.startswith('e') else 'en'

    samples, sample_rate = k.create(t_limpio, voice=voz_seleccionada, speed=velocidad, lang=lang)
    duracion = len(samples) / float(sample_rate)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, samples, sample_rate)

    return {
        "ok": True,
        "texto_sintetizado": t_limpio,
        "duracion_segundos": round(duracion, 2),
        "archivo": output_path,
        "sample_rate": sample_rate,
        "voz_usada": voz_seleccionada
    }

def main():
    parser = argparse.ArgumentParser(description="Kokoro-82M TTS local")
    parser.add_argument("--text", type=str, required=True, help="Texto a sintetizar")
    parser.add_argument("--out", type=str, required=True, help="Ruta del archivo de salida (.wav)")
    parser.add_argument("--voice", type=str, default="ef_dora", help="Voz (ej. ef_dora, af_sarah)")
    parser.add_argument("--speed", type=float, default=1.05, help="Velocidad (1.0 = normal)")

    args = parser.parse_args()

    try:
        resultado = sintetizar(args.text, args.out, voz=args.voice, velocidad=args.speed)
        print(json.dumps(resultado))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
