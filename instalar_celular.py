"""Serve o APK do Buscador de CEP via Wi-Fi com QR Code (igual ao detector_objetos).

Como instalar no celular:
  1. Celular e PC no mesmo Wi-Fi.
  2. Rode este script (ou INSTALAR_NO_CELULAR.bat).
  3. Escaneie o QR Code com a camera do celular.
  4. Baixe e permita "instalar apps desconhecidos".
"""
import http.server
import os
import socketserver
import subprocess

APK_DIR = r"C:\Users\Estevão\PycharmProjects\gps_simples\android\app\build\outputs\apk\debug"
APK_NAME = "app-debug.apk"

os.chdir(APK_DIR)
assert os.path.exists(APK_NAME), "APK nao encontrado! Compile antes (ver README_CEP.md)."

out = subprocess.check_output(["ipconfig"], text=True, encoding="cp850", errors="ignore")
ip = "127.0.0.1"
for line in out.splitlines():
    if "IPv4" in line:
        cand = line.split(":")[-1].strip()
        if cand.startswith(("192.168.", "10.", "172.")):
            ip = cand
            break

port = 8080
try:
    server = socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler)
except OSError:
    port = 8081
    server = socketserver.TCPServer(("", port), http.server.SimpleHTTPRequestHandler)

url = "http://%s:%d/%s" % (ip, port, APK_NAME)

import qrcode

print("=" * 50)
print("  Buscador de CEP - instalar no celular")
print("=" * 50)
print("URL: " + url)
print("Escaneie o QR Code com o celular (mesmo Wi-Fi):")
qr = qrcode.QRCode(border=1)
qr.add_data(url)
qr.make()
qr.print_ascii(invert=True)
qrcode.make(url).save("qr_cep.png")
print("(QR tambem salvo em qr_cep.png)")
print("Servidor rodando. Ctrl+C para parar.")

try:
    server.serve_forever()
except KeyboardInterrupt:
    server.shutdown()
