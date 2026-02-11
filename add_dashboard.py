#!/usr/bin/env python3
"""
add_dashboard.py — Agrega el dashboard al Pod Maestro
Uso: python3 add_dashboard.py
"""
import os

# Patch main.py to serve dashboard
main_path = "/workspace/orquestador/main.py"

with open(main_path, "r") as f:
    content = f.read()

# Only patch if not already patched
if "dashboard.html" not in content:
    patch = '''
# ─── DASHBOARD ───
from fastapi.responses import HTMLResponse

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    html_path = os.path.join(os.path.dirname(__file__), "dashboard.html")
    if os.path.exists(html_path):
        with open(html_path) as f:
            return f.read()
    return "<h1>Dashboard no encontrado</h1><p>Copia dashboard.html a /workspace/orquestador/</p>"
'''
    # Insert before the __main__ block
    if 'if __name__' in content:
        content = content.replace('if __name__', patch + '\nif __name__')
    else:
        content += patch

    with open(main_path, "w") as f:
        f.write(content)
    print("OK  main.py parcheado con ruta /dashboard")
else:
    print("OK  main.py ya tiene ruta /dashboard")

print()
print("Dashboard listo!")
print("Reinicia el orquestador y abre:")
print("  http://localhost:8000/dashboard")
print("  o via RunPod proxy")
