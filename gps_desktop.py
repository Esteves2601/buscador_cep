"""GPS Simples — programa desktop com Google Maps embutido.

Trabalho de faculdade: o sistema recebe enderecos, joga no Google Maps
(programa de terceiros) e o trajeto volta para dentro do programa.

Execucao:  py gps_desktop.py
"""

import os
import sys
import urllib.parse

import requests

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "").strip()
if API_KEY == "SUA_CHAVE_AQUI":
    API_KEY = ""

# Modo de trajeto fixo: carro
MODO_PADRAO = "driving"

# ----------------------------------------------------------------------------
# Funcoes puras (ligacao com o Google Maps) — testaveis sem abrir janela
# ----------------------------------------------------------------------------

def build_search_urls(address):
    """Joga UM endereco no Google Maps: devolve link + pagina incorporada."""
    q = urllib.parse.quote_plus(address)
    return {
        "maps_url": "https://www.google.com/maps/search/?api=1&query=" + q,
        "embed_url": "https://maps.google.com/maps?q=" + q
        + "&t=&z=15&ie=UTF8&iwloc=&output=embed",
    }


def build_route_url(origin, destination, mode="driving"):
    """URL universal do Google Maps com o trajeto (abre no Maps ou incorporada)."""
    params = urllib.parse.urlencode(
        {"origin": origin, "destination": destination, "travelmode": mode}
    )
    return "https://www.google.com/maps/dir/?api=1&" + params


def parse_directions(payload):
    """Extrai distancia, duracao e passo a passo da resposta do Directions API."""
    leg = payload["routes"][0]["legs"][0]
    steps = [
        {
            "instruction": s.get("html_instructions", ""),
            "distance": s.get("distance", {}).get("text", ""),
            "duration": s.get("duration", {}).get("text", ""),
        }
        for s in leg.get("steps", [])
    ]
    return {
        "start_address": leg.get("start_address", ""),
        "end_address": leg.get("end_address", ""),
        "distance": leg.get("distance", {}).get("text", ""),
        "duration": leg.get("duration", {}).get("text", ""),
        "steps": steps,
    }


def fetch_route(origin, destination, mode, api_key, timeout=15):
    """Envia origem/destino ao Google Maps e devolve o trajeto para o sistema."""
    result = {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "maps_url": build_route_url(origin, destination, mode),
    }
    if not api_key:
        result["no_key"] = True
        result["message"] = (
            "Rota exibida no Google Maps incorporado. "
            "Para ver distancia, tempo e passo a passo aqui no programa, "
            "configure a chave (GOOGLE_MAPS_API_KEY no arquivo .env)."
        )
        return result
    try:
        resp = requests.get(
            "https://maps.googleapis.com/maps/api/directions/json",
            params={
                "origin": origin,
                "destination": destination,
                "mode": mode,
                "language": "pt-BR",
                "units": "metric",
                "key": api_key,
            },
            timeout=timeout,
        )
        payload = resp.json()
    except requests.RequestException as exc:
        result["error"] = "Falha ao contatar o Google Maps: " + str(exc)
        return result
    if payload.get("status") != "OK":
        result["error"] = payload.get("error_message") or (
            "Google retornou status: " + str(payload.get("status"))
        )
        return result
    result.update(parse_directions(payload))
    return result


# ----------------------------------------------------------------------------
# Interface desktop (PySide6)
# ----------------------------------------------------------------------------
from PySide6.QtCore import QThread, QUrl, Signal, Slot
from PySide6.QtGui import QDesktopServices
from PySide6.QtWebEngineWidgets import QWebEngineView
from PySide6.QtWidgets import (
    QApplication,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QPushButton,
    QSplitter,
    QTextBrowser,
    QVBoxLayout,
    QWidget,
)


class RouteWorker(QThread):
    finished = Signal(dict)

    def __init__(self, origin, destination, mode, api_key):
        super().__init__()
        self.origin = origin
        self.destination = destination
        self.mode = mode
        self.api_key = api_key

    def run(self):
        self.finished.emit(
            fetch_route(self.origin, self.destination, self.mode, self.api_key)
        )


class GpsWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("GPS Simples — integrado ao Google Maps")
        self.resize(1120, 700)
        self.current_maps_url = ""
        self.worker = None

        splitter = QSplitter()
        splitter.addWidget(self._build_panel())
        self.web = QWebEngineView()
        self.web.setUrl(QUrl("https://maps.google.com/maps?q=Brasil&t=&z=4&output=embed"))
        splitter.addWidget(self.web)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        self.setCentralWidget(splitter)

    def _build_panel(self):
        panel = QWidget()
        panel.setFixedWidth(360)
        lay = QVBoxLayout(panel)

        title = QLabel("GPS Simples")
        title.setStyleSheet("font-size: 20px; font-weight: bold;")
        lay.addWidget(title)
        sub = QLabel("Enderecos -> Google Maps -> trajeto de volta")
        sub.setWordWrap(True)
        sub.setStyleSheet("color: gray;")
        lay.addWidget(sub)

        lay.addWidget(QLabel("Origem:"))
        self.origin = QLineEdit()
        self.origin.setPlaceholderText("Ex: Av. Paulista, 1000 - Sao Paulo")
        lay.addWidget(self.origin)

        lay.addWidget(QLabel("Destino:"))
        self.destination = QLineEdit()
        self.destination.setPlaceholderText("Ex: Rua Augusta, 500 - Sao Paulo")
        lay.addWidget(self.destination)

        row = QHBoxLayout()
        self.btn_route = QPushButton("Calcular rota")
        self.btn_route.setDefault(True)
        self.btn_route.clicked.connect(self.on_route)
        row.addWidget(self.btn_route)
        self.btn_search = QPushButton("Buscar endereco")
        self.btn_search.clicked.connect(self.on_search)
        row.addWidget(self.btn_search)
        lay.addLayout(row)

        self.btn_open = QPushButton("Abrir no Google Maps")
        self.btn_open.setEnabled(False)
        self.btn_open.clicked.connect(self.on_open_external)
        lay.addWidget(self.btn_open)

        self.status = QLabel("Digite origem e destino e clique em Calcular rota.")
        self.status.setWordWrap(True)
        self.status.setStyleSheet("color: gray;")
        lay.addWidget(self.status)

        self.lbl_dist = QLabel("Distancia: —")
        self.lbl_time = QLabel("Tempo: —")
        lay.addWidget(self.lbl_dist)
        lay.addWidget(self.lbl_time)

        lay.addWidget(QLabel("Passo a passo:"))
        self.steps = QTextBrowser()
        self.steps.setPlaceholderText("O passo a passo aparece aqui (requer chave da API).")
        lay.addWidget(self.steps, stretch=1)

        key_info = QLabel(
            "Chave do Google: CONFIGURADA" if API_KEY
            else "Chave do Google: ausente (modo incorporado). Veja o README."
        )
        key_info.setWordWrap(True)
        key_info.setStyleSheet("color: gray; font-size: 11px;")
        lay.addWidget(key_info)
        return panel

    # -- acoes -----------------------------------------------------------
    def on_search(self):
        address = self.destination.text().strip() or self.origin.text().strip()
        if not address:
            self.set_status("Digite ao menos um endereco para buscar.", error=True)
            return
        urls = build_search_urls(address)
        self.current_maps_url = urls["maps_url"]
        self.web.setUrl(QUrl(urls["embed_url"]))
        self.btn_open.setEnabled(True)
        self.set_status('Endereco "' + address + '" jogado no Google Maps.')

    def on_route(self):
        origin = self.origin.text().strip()
        destination = self.destination.text().strip()
        mode = MODO_PADRAO  # carro, fixo
        if not origin or not destination:
            self.set_status("Digite a origem e o destino.", error=True)
            return
        self.set_status("Consultando o Google Maps...")
        self.btn_route.setEnabled(False)
        self.worker = RouteWorker(origin, destination, mode, API_KEY)
        self.worker.finished.connect(self.on_route_done)
        self.worker.start()

    @Slot(dict)
    def on_route_done(self, data):
        self.btn_route.setEnabled(True)
        self.current_maps_url = data.get("maps_url", "")
        self.btn_open.setEnabled(bool(self.current_maps_url))
        if self.current_maps_url:
            self.web.setUrl(QUrl(self.current_maps_url))
        if data.get("error"):
            self.set_status(data["error"], error=True)
            return
        if data.get("no_key"):
            self.lbl_dist.setText("Distancia: —")
            self.lbl_time.setText("Tempo: —")
            self.steps.clear()
            self.set_status(data.get("message", ""))
            return
        self.lbl_dist.setText("Distancia: " + data.get("distance", "—"))
        self.lbl_time.setText("Tempo: " + data.get("duration", "—"))
        items = "".join(
            "<li>%s <small>(%s · %s)</small></li>"
            % (s["instruction"], s["distance"], s["duration"])
            for s in data.get("steps", [])
        )
        self.steps.setHtml(
            "<p><b>%s</b> &#8594; <b>%s</b></p><ol>%s</ol>"
            % (data.get("start_address", ""), data.get("end_address", ""), items)
        )
        self.set_status(
            "Trajeto retornado pelo Google Maps: %s · %s"
            % (data.get("distance", ""), data.get("duration", ""))
        )

    def on_open_external(self):
        if self.current_maps_url:
            QDesktopServices.openUrl(QUrl(self.current_maps_url))

    def set_status(self, msg, error=False):
        self.status.setText(msg)
        self.status.setStyleSheet("color: red;" if error else "color: gray;")


def main():
    app = QApplication(sys.argv)
    win = GpsWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
