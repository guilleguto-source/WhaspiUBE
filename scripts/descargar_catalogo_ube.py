import os
import sys
import json
import re
from urllib.parse import urljoin
import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

URL_LISTADO = "https://ube.edu.ec/Oferta_academica/detalle?filtrar=2"
OUTPUT_BASE = r"C:\Users\Guill\Documents\UBE_Material"
JSON_OUT = os.path.join(os.path.dirname(__file__), "..", "wa-bot", "data", "ube_catalogo_web_completo.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
}

def limpiar(txt):
    if not txt:
        return ""
    # Reemplazar caracteres especiales y acentos para evitar problemas de ruta en Windows
    txt = re.sub(r'\s+', ' ', txt).strip()
    return txt

def sanitizar_nombre_archivo(txt):
    if not txt:
        return "archivo"
    # Normalizar acentos
    reemplazos = {
        'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
        'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
        'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U'
    }
    for orig, rep in reemplazos.items():
        txt = txt.replace(orig, rep)
    txt = re.sub(r'[^a-zA-Z0-9_\- ]', '', txt).strip().replace(" ", "_")
    return txt[:80] # Limitar longitud de ruta en Windows

def mapear_categoria_carpeta(titulo, etiqueta):
    t = titulo.lower()
    if any(k in t for k in ["educación", "educacion", "pedagogía", "pedagogia", "básica", "inicial", "entornos", "gestión educativa", "ia para la educación", "orientación"]):
        return "01_Educacion"
    elif any(k in t for k in ["derecho", "constitucionalismo", "criminología", "penal", "procesal", "notarial", "gobernanza", "derechos humanos"]):
        return "02_Derecho_y_Gobernanza"
    elif any(k in t for k in ["odontología", "odontologia", "enfermería", "fisioterapia", "biomedicina", "salud", "psicología", "hospitales"]):
        return "03_Salud_y_Bienestar"
    elif any(k in t for k in ["sistemas", "inteligencia artificial", "ciberseguridad", "tráfico", "eléctrica", "blockchain", "datos", "bim", "tecnología"]):
        return "04_Ingenieria_y_Tecnologia"
    else:
        return "05_Administracion_y_Economia"

def descargar_pdf(url_pdf, carpeta_destino, nombre_sugerido):
    try:
        os.makedirs(carpeta_destino, exist_ok=True)
        nombre_limpio = sanitizar_nombre_archivo(nombre_sugerido)
        ruta_archivo = os.path.join(carpeta_destino, f"{nombre_limpio}.pdf")
        
        if os.path.exists(ruta_archivo) and os.path.getsize(ruta_archivo) > 5000:
            return ruta_archivo

        resp = requests.get(url_pdf, headers=HEADERS, verify=False, timeout=30)
        if resp.status_code == 200 and len(resp.content) > 1000:
            with open(ruta_archivo, "wb") as f:
                f.write(resp.content)
            print(f"      [OK PDF Descargado] {nombre_limpio}.pdf")
            return ruta_archivo
    except Exception as e:
        print(f"      [!] Error descargando PDF {url_pdf}: {e}")
    return None

def main():
    print(f"[*] Obteniendo lista de carreras desde: {URL_LISTADO}")
    resp = requests.get(URL_LISTADO, headers=HEADERS, verify=False, timeout=20)
    soup = BeautifulSoup(resp.text, "html.parser")

    items = soup.find_all("div", class_="oferta-body")
    print(f"[+] Total de programas detectados en la página: {len(items)}")

    programas = []
    vistos = set()

    for item in items:
        etiqueta_elem = item.find("span", class_="oferta-etiqueta")
        titulo_elem = item.find("h4", class_="oferta-titulo")
        btn_elem = item.find("a", class_="oferta-btn")

        if not titulo_elem or not btn_elem:
            continue

        titulo = limpiar(titulo_elem.get_text())
        etiqueta = limpiar(etiqueta_elem.get_text()) if etiqueta_elem else "General"
        url_detalle = urljoin("https://ube.edu.ec", btn_elem.get("href", ""))

        clave = f"{titulo}_{etiqueta}"
        if clave in vistos:
            continue
        vistos.add(clave)

        categoria = mapear_categoria_carpeta(titulo, etiqueta)
        
        tipo_subcarpeta = "Grado"
        if "maestr" in etiqueta.lower() or "maestr" in titulo.lower():
            tipo_subcarpeta = "Maestrias"
        elif "validaci" in etiqueta.lower() or "especial" in etiqueta.lower() or "12 meses" in titulo.lower() or "15 meses" in titulo.lower():
            tipo_subcarpeta = "Validacion"

        nombre_carpeta = sanitizar_nombre_archivo(titulo)
        carpeta_local = os.path.join(OUTPUT_BASE, categoria, tipo_subcarpeta, nombre_carpeta)

        meta_spans = item.find_all("span")
        modalidad = ""
        area = ""
        for s in meta_spans:
            txt = limpiar(s.get_text())
            if any(m in txt.lower() for m in ["online", "presencial", "híbrida", "hibrida"]):
                modalidad = txt
            elif txt != etiqueta and txt != titulo:
                area = txt

        programas.append({
            "titulo": titulo,
            "etiqueta": etiqueta,
            "modalidad": modalidad,
            "area": area,
            "url_detalle": url_detalle,
            "categoria": categoria,
            "tipo_subcarpeta": tipo_subcarpeta,
            "carpeta_local": carpeta_local
        })

    print(f"[+] Procesando detalles y descargando trípticos para {len(programas)} programas...")

    catalogo_final = []

    for i, prog in enumerate(programas, 1):
        print(f"\n[{i}/{len(programas)}] {prog['titulo']} ({prog['etiqueta']})")
        detalles = {
            "perfil_ingreso": "",
            "perfil_egreso": "",
            "campo_ocupacional": "",
            "malla_curricular": [],
            "duracion": "",
            "tripticos_pdf": [],
            "videos": []
        }

        try:
            r = requests.get(prog['url_detalle'], headers=HEADERS, verify=False, timeout=20)
            if r.status_code == 200:
                s_prog = BeautifulSoup(r.text, "html.parser")

                # 1. Buscar PDFs / Trípticos
                for a in s_prog.find_all("a", href=True):
                    href = a['href']
                    if ".pdf" in href.lower() or "triptico" in href.lower() or "malla" in href.lower() or "brochure" in href.lower():
                        full_pdf = urljoin(prog['url_detalle'], href)
                        if full_pdf not in detalles['tripticos_pdf']:
                            detalles['tripticos_pdf'].append(full_pdf)
                            # Descargar PDF a carpeta organizada
                            descargar_pdf(full_pdf, prog['carpeta_local'], f"Triptico_{prog['titulo']}")

                # 2. Buscar videos
                for iframe in s_prog.find_all("iframe", src=True):
                    src = iframe['src']
                    if any(v in src.lower() for v in ["youtube", "youtu.be", "vimeo"]):
                        detalles['videos'].append(src)

                # 3. Extraer textos de perfiles y requisitos
                for h in s_prog.find_all(["h2", "h3", "h4", "h5", "strong"]):
                    ht = limpiar(h.get_text()).lower()
                    if "ingreso" in ht or "aspirante" in ht:
                        p = h.find_next(["p", "div", "ul"])
                        if p:
                            detalles['perfil_ingreso'] = limpiar(p.get_text())
                    elif "egreso" in ht or "profesional" in ht:
                        p = h.find_next(["p", "div", "ul"])
                        if p:
                            detalles['perfil_egreso'] = limpiar(p.get_text())
                    elif "campo" in ht or "ocupacional" in ht or "laboral" in ht:
                        p = h.find_next(["p", "div", "ul"])
                        if p:
                            detalles['campo_ocupacional'] = limpiar(p.get_text())
                    elif "duración" in ht or "duracion" in ht:
                        p = h.find_next(["p", "div", "span"])
                        if p:
                            detalles['duracion'] = limpiar(p.get_text())
        except Exception as e:
            print(f"   [!] Error procesando página {prog['url_detalle']}: {e}")

        prog.update(detalles)
        catalogo_final.append(prog)

    os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)
    with open(JSON_OUT, "w", encoding="utf-8") as f:
        json.dump(catalogo_final, f, ensure_ascii=False, indent=2)

    print(f"\n========================================================")
    print(f"[OK] EXTRACCION Y DESCARGA COMPLETADA")
    print(f"Total de programas procesados: {len(catalogo_final)}")
    print(f"Tripticos guardados en: {OUTPUT_BASE}")
    print(f"Datos estructurados en: {JSON_OUT}")
    print(f"========================================================")

if __name__ == "__main__":
    main()
