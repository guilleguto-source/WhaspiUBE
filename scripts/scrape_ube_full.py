import os
import sys
import json
import re
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://ube.edu.ec"
OFERTA_URL = "https://ube.edu.ec/Oferta_academica"
OUTPUT_DIR = r"C:\Users\Guill\Documents\UBE_Material"
DATA_OUTPUT = os.path.join(os.path.dirname(__file__), "..", "wa-bot", "data", "ube_web_scraped.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def obtener_html(url):
    try:
        resp = requests.get(url, headers=HEADERS, verify=False, timeout=15)
        if resp.status_code == 200:
            return resp.text
        print(f"[!] Error {resp.status_code} al consultar {url}")
    except Exception as e:
        print(f"[!] Excepción en {url}: {e}")
    return None

def limpiar_texto(txt):
    if not txt:
        return ""
    return re.sub(r'\s+', ' ', txt).strip()

def analizar_oferta():
    print(f"[*] Consultando oferta académica en {OFERTA_URL}...")
    html = obtener_html(OFERTA_URL)
    if not html:
        print("[!] No se pudo obtener la página de oferta académica.")
        return []

    soup = BeautifulSoup(html, "html.parser")
    programas = []

    # Buscar todos los enlaces que apunten a carreras o programas
    for a in soup.find_all("a", href=True):
        href = a['href']
        texto = limpiar_texto(a.get_text())
        full_url = urljoin(BASE_URL, href)
        
        # Filtros heurísticos para enlaces de carreras / maestrías
        if any(keyword in href.lower() for keyword in ["carrera", "maestria", "programa", "posgrado", "grado", "licenciatura", "ingenieria"]):
            if len(texto) > 3 and full_url not in [p['url'] for p in programas]:
                programas.append({
                    "nombre": texto,
                    "url": full_url,
                    "tipo_detectado": "Maestria" if "maestria" in href.lower() or "posgrado" in href.lower() else "Grado"
                })

    print(f"[+] Se encontraron {len(programas)} programas en la oferta inicial.")
    return programas

def scrape_detalle_programa(programa):
    url = programa['url']
    print(f"[*] Analizando detalle: {programa['nombre']} -> {url}")
    html = obtener_html(url)
    if not html:
        return programa

    soup = BeautifulSoup(html, "html.parser")
    
    # Extraer PDFs / Trípticos
    pdfs = []
    for a in soup.find_all("a", href=True):
        href = a['href']
        if href.lower().endswith(".pdf") or "triptico" in href.lower() or "malla" in href.lower():
            pdf_url = urljoin(url, href)
            if pdf_url not in pdfs:
                pdfs.append(pdf_url)
    
    programa['pdfs_encontrados'] = pdfs

    # Extraer videos (YouTube / Vimeo / mp4)
    videos = []
    for iframe in soup.find_all("iframe", src=True):
        src = iframe['src']
        if any(v in src.lower() for v in ["youtube", "youtu.be", "vimeo"]):
            videos.append(src)
    for video in soup.find_all("video"):
        for source in video.find_all("source", src=True):
            videos.append(urljoin(url, source['src']))
    
    programa['videos_encontrados'] = list(set(videos))

    # Extraer secciones de texto (Perfil de ingreso, perfil de egreso, etc.)
    secciones = {}
    encabezados = soup.find_all(["h1", "h2", "h3", "h4", "h5", "strong"])
    for h in encabezados:
        titulo = limpiar_texto(h.get_text())
        if any(k in titulo.lower() for k in ["perfil", "ingreso", "egreso", "objetivo", "campo", "duración", "modalidad", "requisitos"]):
            contenido = []
            sig = h.find_next_sibling()
            while sig and sig.name not in ["h1", "h2", "h3", "h4", "h5"]:
                txt = limpiar_texto(sig.get_text())
                if txt:
                    contenido.append(txt)
                sig = sig.find_next_sibling()
            if contenido:
                secciones[titulo] = " ".join(contenido)

    programa['secciones'] = secciones
    return programa

def main():
    programas = analizar_oferta()
    resultados = []
    
    # Analizar prioritariamente los programas de Educación primero
    programas_prioritarios = [p for p in programas if any(k in p['nombre'].lower() for k in ["educacion", "pedagogia", "basica", "inicial", "entornos", "gestion"])]
    otros = [p for p in programas if p not in programas_prioritarios]
    
    lista_ordenada = programas_prioritarios + otros
    print(f"[*] Procesando detalles de {len(lista_ordenada)} programas (con {len(programas_prioritarios)} en área Educación)...")

    for p in lista_ordenada[:25]: # Lote inicial para verificación
        detalles = scrape_detalle_programa(p)
        resultados.append(detalles)

    os.makedirs(os.path.dirname(DATA_OUTPUT), exist_ok=True)
    with open(DATA_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(resultados, f, ensure_ascii=False, indent=2)

    print(f"\n[+] Scraping inicial guardado en: {DATA_OUTPUT}")

if __name__ == "__main__":
    main()
