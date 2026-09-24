"""
GPS Simples com Google Maps
Trabalho de faculdade — Sistema que recebe endereços,
envia para o Google Maps (programa de terceiros) e
retorna o trajeto para o sistema.

Como usar:
    1. pip install -r requirements.txt
    2. Copie .env.example para .env e coloque sua chave:
       GOOGLE_MAPS_API_KEY=SUA_CHAVE_AQUI
    3. py app.py
    4. Abra http://127.0.0.1:5000

Obtenção da chave (gratuita): veja o README.md
"""

import os
import urllib.parse

import requests
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Tenta carregar .env sem obrigar python-dotenv instalado
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except ImportError:
    pass

GOOGLE_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
if GOOGLE_KEY == "SUA_CHAVE_AQUI":
    GOOGLE_KEY = ""  # valor de exemplo do .env — trata como sem chave

MODOS_VALIDOS = {"driving", "walking", "bicycling", "transit"}


@app.get("/")
def index():
    """Página principal. Injeta a chave (se houver) no frontend."""
    return render_template("index.html", google_maps_api_key=GOOGLE_KEY)


@app.get("/api/config")
def config():
    """Diz ao frontend se há chave configurada."""
    return jsonify({"has_key": bool(GOOGLE_KEY)})


def google_directions_url(origin: str, destination: str, mode: str = "driving") -> str:
    """Monta a URL universal do Google Maps (funciona SEM chave — abre no navegador/app)."""
    base = "https://www.google.com/maps/dir/?api=1"
    params = urllib.parse.urlencode(
        {"origin": origin, "destination": destination, "travelmode": mode}
    )
    return f"{base}&{params}"


@app.post("/api/route")
def route():
    """
    Recebe {origin, destination, mode} do sistema,
    joga no Google Maps (Directions API — programa de terceiros)
    e devolve o trajeto para o sistema.
    """
    data = request.get_json(force=True, silent=True) or {}
    origin = (data.get("origin") or "").strip()
    destination = (data.get("destination") or "").strip()
    mode = (data.get("mode") or "driving").strip().lower()

    if not origin or not destination:
        return jsonify({"error": "Informe origem e destino."}), 400
    if mode not in MODOS_VALIDOS:
        return jsonify({"error": f"Modo inválido. Use: {sorted(MODOS_VALIDOS)}"}), 400

    maps_url = google_directions_url(origin, destination, mode)

    # SEM chave: ainda retorna a ligação com o Google Maps (URL universal),
    # o frontend exibe via iframe + botão "Abrir no Google Maps".
    if not GOOGLE_KEY:
        return jsonify(
            {
                "no_key": True,
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "maps_url": maps_url,
                "message": (
                    "Sem GOOGLE_MAPS_API_KEY configurada. "
                    "Exibindo rota via Google Maps incorporado. "
                    "Para distância/tempo/passo a passo no sistema, configure a chave (ver README)."
                ),
            }
        )

    # COM chave: consulta o Google Maps Directions API e retorna o trajeto.
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "language": "pt-BR",
                "units": "metric",
                "key": GOOGLE_KEY,
            },
            timeout=15,
        )
        payload = resp.json()
    except requests.RequestException as exc:
        return jsonify({"error": f"Falha ao contatar Google Maps: {exc}"}), 502

    status = payload.get("status")
    if status != "OK":
        msg = payload.get("error_message") or f"Google retornou status: {status}"
        return jsonify({"error": msg, "status": status, "maps_url": maps_url}), 400

    leg = payload["routes"][0]["legs"][0]
    steps = [
        {
            "instruction": s.get("html_instructions", ""),
            "distance": s.get("distance", {}).get("text", ""),
            "duration": s.get("duration", {}).get("text", ""),
        }
        for s in leg.get("steps", [])
    ]

    return jsonify(
        {
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "start_address": leg.get("start_address", ""),
            "end_address": leg.get("end_address", ""),
            "distance": leg.get("distance", {}).get("text", ""),
            "distance_meters": leg.get("distance", {}).get("value", 0),
            "duration": leg.get("duration", {}).get("text", ""),
            "duration_seconds": leg.get("duration", {}).get("value", 0),
            "steps": steps,
            "polyline": payload["routes"][0].get("overview_polyline", {}).get("points", ""),
            "bounds": payload["routes"][0].get("bounds", {}),
            "maps_url": maps_url,  # ligação direta com o Google Maps
        }
    )


@app.get("/api/search")
def search():
    """Recebe UM endereço, joga no Google Maps e devolve link + iframe para o sistema."""
    address = (request.args.get("address") or "").strip()
    if not address:
        return jsonify({"error": "Informe ?address=..."}), 400
    q = urllib.parse.quote_plus(address)
    return jsonify(
        {
            "address": address,
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={q}",
            "embed_url": f"https://maps.google.com/maps?q={q}&t=&z=15&ie=UTF8&iwloc=&output=embed",
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
