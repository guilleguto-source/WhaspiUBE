import os
import sys
import json
import re
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

JSON_IN = os.path.join(os.path.dirname(__file__), "..", "wa-bot", "data", "ube_catalogo_web_completo.json")
JSON_OUT = os.path.join(os.path.dirname(__file__), "..", "wa-bot", "data", "ube_catalogo_web_con_perfiles.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
}

def limpiar(txt):
    if not txt:
        return ""
    txt = re.sub(r'<[^>]+>', ' ', txt)
    return re.sub(r'\s+', ' ', txt).strip()

def extraer_acordeones(html):
    soup = BeautifulSoup(html, "html.parser")
    datos = {
        "perfil_profesional": "",
        "ocupaciones_profesionales": "",
        "requisitos_admision": "",
        "detalle_carrera": ""
    }

    # Los textos están dentro de acordeones Bootstrap (.accordion-item / .accordion-collapse)
    for collapse in soup.find_all(class_=lambda x: x and "accordion-collapse" in x):
        texto = limpiar(collapse.get_text())
        texto_lower = texto.lower()

        if "perfil profesional" in texto_lower:
            datos["perfil_profesional"] = texto.replace("Perfil profesional", "").strip()
        elif "ocupaciones" in texto_lower or "campo laboral" in texto_lower:
            datos["ocupaciones_profesionales"] = texto.replace("Ocupaciones profesionales", "").strip()
        elif "admisiones" in texto_lower or "requisitos" in texto_lower or "documentación" in texto_lower:
            datos["requisitos_admision"] = texto.replace("Admisiones", "").strip()
        elif "detalle de la carrera" in texto_lower or "modalidad" in texto_lower:
            datos["detalle_carrera"] = texto

    return datos

def main():
    with open(JSON_IN, "r", encoding="utf-8") as f:
        programas = json.load(f)

    print(f"[*] Enriqueciendo {len(programas)} programas con perfiles y campos ocupacionales...")

    for i, p in enumerate(programas, 1):
        url = p.get("url_detalle")
        if not url:
            continue

        try:
            r = requests.get(url, headers=HEADERS, verify=False, timeout=15)
            if r.status_code == 200:
                html = r.content.decode("utf-8", errors="ignore")
                extraidos = extraer_acordeones(html)
                p.update(extraidos)
                
                # Feedback de progreso
                if extraidos["perfil_profesional"]:
                    print(f"[{i}/{len(programas)}] [OK Perfil] {p['titulo']}")
                else:
                    print(f"[{i}/{len(programas)}] [- Sin acordeón] {p['titulo']}")
        except Exception as e:
            print(f"[!] Error en {url}: {e}")

    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(programas, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] Enriquecimiento completado en: {JSON_OUT}")

if __name__ == "__main__":
    main()
