#!/usr/bin/env python3
import os
import sys
import json
import time
import re
import subprocess
import urllib.request

TOKEN = "9243076632:AAFvjgxexAACGk-51Xh337kt9h_Djvmg6iw"
PORT = 3000

def update_telegram(url):
    api = f"https://api.telegram.org/bot{TOKEN}/setChatMenuButton"
    payload = {
        "menu_button": {
            "type": "web_app",
            "text": "📊 CRM y Calendario",
            "web_app": {"url": url}
        }
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(api, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read().decode())
            if res.get("ok"):
                print(f"✅ Bot Telegram (@assistantUBE_bot) actualizado con URL: {url}")
            else:
                print(f"❌ Error al actualizar Telegram: {res}")
    except Exception as e:
        print(f"❌ Error en petición Telegram: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1].startswith("http"):
        update_telegram(sys.argv[1])
    else:
        print("Uso: python3 telegram_tunnel.py <URL>")
