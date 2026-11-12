#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
WhaspiUBE · Generador de Notas de Voz Humanas con Edge-TTS (es-EC-AndreaNeural)
Voz femenina ecuatoriana oficial con calidad de estudio.
"""

import sys
import os
import re
import json
import argparse
import asyncio

try:
    import truststore
    truststore.inject_into_ssl()
except Exception:
    pass

import edge_tts

def limpiar_texto_para_voz(texto: str) -> str:
    """Elimina formato markdown, tags [PDF:...] y acorta a <15 segundos"""
    t = re.sub(r'\[PDF:[^\]]+\]', '', texto, flags=re.IGNORECASE)
    t = re.sub(r'https?://\S+', '', t)
    t = re.sub(r'[*_~`#>]', '', t)
    t = re.sub(r'<[^>]+>', '', t)
    t = t.replace('$', ' dólares ').replace('/', ' por ')
    t = re.sub(r'(\d+)×', r'\1 por ', t)
    t = re.sub(r'\s+', ' ', t).strip()

    palabras = t.split()
    if len(palabras) > 35:
        candidato = " ".join(palabras[:35])
        if '.' in candidato:
            candidato = candidato.rsplit('.', 1)[0] + '.'
        t = candidato
    return t

async def sintetizar_async(texto: str, output_path: str, voz: str = "es-EC-AndreaNeural"):
    t_limpio = limpiar_texto_para_voz(texto)
    if not t_limpio:
        t_limpio = "Hola, soy Diana de la Universidad Bolivariana del Ecuador. ¿En qué puedo ayudarte?"

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    com = edge_tts.Communicate(t_limpio, voz)
    await com.save(output_path)

    # Estimar duración aproximada en base a palabras (promedio 130 palabras/min)
    duracion = max(2.5, round(len(t_limpio.split()) / 2.5, 2))

    return {
        "ok": True,
        "texto_sintetizado": t_limpio,
        "duracion_segundos": duracion,
        "archivo": output_path,
        "voz_usada": voz
    }

def main():
    parser = argparse.ArgumentParser(description="Edge-TTS generador de voz ecuatoriana")
    parser.add_argument("--text", type=str, required=True, help="Texto a sintetizar")
    parser.add_argument("--out", type=str, required=True, help="Ruta de salida (.mp3)")
    parser.add_argument("--voice", type=str, default="es-EC-AndreaNeural", help="Voz neural")

    args = parser.parse_args()

    try:
        resultado = asyncio.run(sintetizar_async(args.text, args.out, voz=args.voice))
        print(json.dumps(resultado))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
