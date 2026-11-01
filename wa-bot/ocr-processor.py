#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Módulo OCR para el Chatbot UBE
Utiliza RapidOCR (PP-OCRv4 ONNX) + Preprocesamiento OpenCV
Filtra documentos y afiches educativos/laborales para evitar inyección de basura al LLM.
"""

import sys
import json
import os

# Asegurar salida UTF-8 en Windows para evitar UnicodeEncodeError con caracteres especiales
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

KEYWORDS_UBE = [
    "ube", "universidad", "bolivariana", "ecuador",
    "licenciatura", "educacion", "derecho", "enfermeria", "psicologia",
    "maestria", "posgrado", "arancel", "matricula", "cuota", "preuniversitario",
    "senescyt", "iess", "mecanizado", "certificado", "laboral",
    "bachiller", "acta", "cedula", "promocion", "descuento", "duran"
]

def preprocesar_imagen(ruta_imagen):
    """
    Mejora el contraste y legibilidad para fotos tomadas con móvil en WhatsApp.
    """
    img = cv2.imread(ruta_imagen)
    if img is None:
        raise ValueError(f"No se pudo cargar la imagen: {ruta_imagen}")

    # Escala de grises
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Si la imagen es muy pequeña, redimensionar para mejorar detección de texto
    h, w = gray.shape
    if max(h, w) < 1000:
        factor = 1200.0 / max(h, w)
        gray = cv2.resize(gray, (int(w * factor), int(h * factor)), interpolation=cv2.INTER_CUBIC)

    # Normalización de iluminación (CLAHE - Contrast Limited Adaptive Histogram Equalization)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    return enhanced

def procesar_ocr(ruta_imagen):
    """
    Ejecuta RapidOCR sobre la imagen y analiza la relevancia.
    """
    if not os.path.exists(ruta_imagen):
        return {
            "valido": False,
            "error": f"Archivo no encontrado: {ruta_imagen}",
            "texto": "",
            "keywords": [],
            "confianza": 0.0
        }

    try:
        preprocessed = preprocesar_imagen(ruta_imagen)
        engine = RapidOCR()
        result, elapse_list = engine(preprocessed)

        if not result:
            return {
                "valido": False,
                "texto": "",
                "keywords": [],
                "confianza": 0.0,
                "mensaje": "No se detectó texto en la imagen"
            }

        lineas = []
        confianzas = []
        for line in result:
            texto_linea = line[1]
            conf = float(line[2])
            lineas.append(texto_linea)
            confianzas.append(conf)

        texto_completo = "\n".join(lineas)
        confianza_promedio = float(np.mean(confianzas)) if confianzas else 0.0

        # Análisis de relevancia por palabras clave
        texto_lower = texto_completo.lower()
        encontradas = [k for k in KEYWORDS_UBE if k in texto_lower]

        # Consideramos relevante si tiene al menos 1 palabra clave educativa/institucional
        es_relevante = len(encontradas) > 0

        return {
            "valido": True,
            "relevante": es_relevante,
            "texto": texto_completo,
            "keywords": encontradas,
            "confianza": round(confianza_promedio, 3)
        }
    except Exception as e:
        return {
            "valido": False,
            "error": str(e),
            "texto": "",
            "keywords": [],
            "confianza": 0.0
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Uso: python ocr-processor.py <ruta_imagen>"}))
        sys.exit(1)

    ruta = sys.argv[1]
    res = procesar_ocr(ruta)
    print(json.dumps(res, ensure_ascii=False, indent=2))
