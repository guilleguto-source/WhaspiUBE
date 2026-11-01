import os
import sys
import re

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

import gdown

# Acceso correcto al módulo tras importación de gdown
df_module = sys.modules['gdown.download_folder']
original_download = df_module.download

def download_cortador(*args, **kwargs):
    output = kwargs.get('output')
    if output and isinstance(output, str):
        dir_name = os.path.dirname(output)
        file_name = os.path.basename(output)
        
        # Limitar longitud en Windows para evitar desbordamiento
        if len(file_name) > 60:
            name, ext = os.path.splitext(file_name)
            name_clean = re.sub(r'[^a-zA-Z0-9_\- ]', '', name)[:45].strip()
            output = os.path.join(dir_name, f"{name_clean}{ext}")
            
        if not output.startswith("\\\\?\\") and os.path.isabs(output):
            output = "\\\\?\\" + os.path.abspath(output)
            
        kwargs['output'] = output

    kwargs['verify'] = False

    try:
        return original_download(*args, **kwargs)
    except Exception as err:
        print(f"\n[!] Saltando archivo ({output}): {err}")
        return None

df_module.download = download_cortador

FOLDER_ID = "1MrVpWesCbgWR0FnmSq0qK8ZKaNL5fQdR"
DESTINO = r"C:\Users\Guill\Documents\UBE_Material\Drive_Oficial"

def main():
    print(f"[*] Sincronizando Drive UBE con normalizacion y captura de excepciones...")
    os.makedirs(DESTINO, exist_ok=True)

    try:
        gdown.download_folder(
            id=FOLDER_ID,
            output=DESTINO,
            quiet=False,
            use_cookies=False,
            verify=False
        )
        print("\n[OK] Sincronizacion de Google Drive completada al 100%.")
    except Exception as e:
        print(f"\n[!] Detalle final: {e}")

if __name__ == "__main__":
    main()
