"""Buscador de CEP — programa desktop com ViaCEP (programa de terceiros).

Trabalho de faculdade: o sistema recebe um CEP, joga no ViaCEP
(https://viacep.com.br — programa de terceiros, sem chave e sem cadastro)
e o endereco volta para dentro do programa. Tambem faz o caminho inverso:
endereco -> CEP.

Execucao:  py buscador_cep.py
"""

import sys
import webbrowser
from pathlib import Path

from cep_core import (  # noqa: F401  (re-export para compatibilidade)
    CepError,
    address_to_text,
    clean_cep,
    format_cep,
    lookup_address,
    lookup_cep,
    maps_url_for,
)

BASE_DIR = Path(__file__).resolve().parent


# ----------------------------------------------------------------------------
# Tema visual: fundo bege, botoes e destaques em verde
# ----------------------------------------------------------------------------
STYLESHEET = """
QMainWindow, QWidget {
    background: #F3EDE0;
    color: #4A3F30;
    font-family: 'Segoe UI';
    font-size: 13px;
}
QLabel#header {
    background: #2F7D33;
    color: white;
    font-size: 20px;
    font-weight: bold;
    padding: 12px;
    border-bottom: 3px solid #1D5220;
}
QLabel#subtitle {
    color: #6B5D4D;
    font-size: 12px;
    padding-bottom: 4px;
}
QTabWidget::pane {
    border: 1px solid #D8CBB2;
    border-radius: 8px;
    background: #F3EDE0;
}
QTabBar::tab {
    background: #E7DCC3;
    color: #4A3F30;
    padding: 8px 18px;
    margin-right: 4px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
}
QTabBar::tab:selected {
    background: #FFFDF6;
    color: #2F7D33;
    font-weight: bold;
}
QLineEdit {
    background: white;
    border: 2px solid #D8CBB2;
    border-radius: 8px;
    padding: 8px;
    selection-background-color: #2F7D33;
}
QLineEdit:focus {
    border: 2px solid #2F7D33;
}
QPushButton {
    background: #2F7D33;
    color: white;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    padding: 9px 18px;
}
QPushButton:hover { background: #256628; }
QPushButton:pressed { background: #1D5220; }
QPushButton:disabled { background: #B9C4B1; color: #F3EDE0; }
QPushButton#secondary {
    background: #FFFDF6;
    color: #2F7D33;
    border: 2px solid #2F7D33;
}
QPushButton#secondary:hover { background: #E9F3E9; }
QFrame#card {
    background: #FFFDF6;
    border: 1px solid #D8CBB2;
    border-radius: 10px;
}
QListWidget {
    background: white;
    border: 2px solid #D8CBB2;
    border-radius: 8px;
    padding: 4px;
}
QLabel#field {
    font-weight: bold;
    color: black;
    padding: 3px 6px;
}
QLabel#value, QLabel#valueAlt {
    color: black;
    padding: 3px 8px;
    border-radius: 5px;
}
QLabel#valueAlt {
    background: #F1E9D6;
}
QLabel#info {
    color: #6B5D4D;
    font-size: 11px;
}
"""


# ----------------------------------------------------------------------------
# Interface desktop (PySide6)
# ----------------------------------------------------------------------------
from PySide6.QtCore import Qt, QThread, Signal, Slot
from PySide6.QtWidgets import (
    QApplication,
    QFrame,
    QGridLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QMainWindow,
    QPushButton,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)


class Worker(QThread):
    done = Signal(tuple)  # ("ok", dados) ou ("error", mensagem)

    def __init__(self, fn, *args):
        super().__init__()
        self.fn = fn
        self.args = args

    def run(self):
        try:
            self.done.emit(("ok", self.fn(*self.args)))
        except Exception as exc:  # noqa: BLE001
            self.done.emit(("error", str(exc)))


class CepWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Buscador de CEP — integrado ao ViaCEP")
        self.resize(580, 540)
        icon = BASE_DIR / "cep.ico"
        if icon.exists():
            from PySide6.QtGui import QIcon
            self.setWindowIcon(QIcon(str(icon)))
        self.worker = None
        self.last_address = ""

        central = QWidget()
        vbox = QVBoxLayout(central)
        vbox.setContentsMargins(12, 12, 12, 12)

        header = QLabel("Buscador de CEP")
        header.setObjectName("header")
        header.setAlignment(Qt.AlignCenter)
        vbox.addWidget(header)

        subtitle = QLabel("Consulta de endereços via ViaCEP (programa de terceiros)")
        subtitle.setObjectName("subtitle")
        subtitle.setAlignment(Qt.AlignCenter)
        vbox.addWidget(subtitle)

        tabs = QTabWidget()
        tabs.addTab(self._build_cep_tab(), "CEP -> Endereco")
        tabs.addTab(self._build_address_tab(), "Endereco -> CEP")
        vbox.addWidget(tabs)
        self.setCentralWidget(central)

    # -- aba 1 -----------------------------------------------------------
    def _build_cep_tab(self):
        tab = QWidget()
        lay = QVBoxLayout(tab)

        lay.addWidget(QLabel("CEP:"))
        self.cep_input = QLineEdit()
        self.cep_input.setPlaceholderText("Ex: 01310-100")
        self.cep_input.setMaxLength(9)
        self.cep_input.returnPressed.connect(self.on_search_cep)
        lay.addWidget(self.cep_input)

        row = QHBoxLayout()
        self.btn_search = QPushButton("Buscar")
        self.btn_search.setDefault(True)
        self.btn_search.clicked.connect(self.on_search_cep)
        row.addWidget(self.btn_search)
        btn_clear = QPushButton("Limpar")
        btn_clear.setObjectName("secondary")
        btn_clear.clicked.connect(self.on_clear_cep)
        row.addWidget(btn_clear)
        lay.addLayout(row)

        self.status1 = QLabel("Digite um CEP e clique em Buscar.")
        self.status1.setWordWrap(True)
        lay.addWidget(self.status1)

        card = QFrame()
        card.setObjectName("card")
        grid = QGridLayout(card)
        grid.setSpacing(4)
        grid.setContentsMargins(12, 10, 12, 10)
        self.res_labels = {}
        for i, campo in enumerate(
            ["Rua", "Bairro", "Cidade", "UF", "DDD", "IBGE", "CEP"]
        ):
            lab = QLabel(campo + ":")
            lab.setObjectName("field")
            val = QLabel("—")
            val.setObjectName("value" if i % 2 == 0 else "valueAlt")
            val.setWordWrap(True)
            grid.addWidget(lab, i, 0)
            grid.addWidget(val, i, 1)
            self.res_labels[campo] = val
        lay.addWidget(card)

        self.btn_map = QPushButton("Ver no mapa")
        self.btn_map.setObjectName("secondary")
        self.btn_map.setEnabled(False)
        self.btn_map.clicked.connect(self.on_open_map)
        lay.addWidget(self.btn_map)
        lay.addStretch(1)

        info = QLabel("Terceiro utilizado: ViaCEP (viacep.com.br) — sem chave, sem cadastro.")
        info.setObjectName("info")
        info.setWordWrap(True)
        lay.addWidget(info)
        return tab

    # -- aba 2 -----------------------------------------------------------
    def _build_address_tab(self):
        tab = QWidget()
        lay = QVBoxLayout(tab)

        lay.addWidget(QLabel("UF (2 letras):"))
        self.uf_input = QLineEdit()
        self.uf_input.setPlaceholderText("Ex: SP")
        self.uf_input.setMaxLength(2)
        lay.addWidget(self.uf_input)

        lay.addWidget(QLabel("Cidade:"))
        self.city_input = QLineEdit()
        self.city_input.setPlaceholderText("Ex: Sao Paulo")
        lay.addWidget(self.city_input)

        lay.addWidget(QLabel("Rua (min. 3 letras):"))
        self.street_input = QLineEdit()
        self.street_input.setPlaceholderText("Ex: Avenida Paulista")
        self.street_input.returnPressed.connect(self.on_search_address)
        lay.addWidget(self.street_input)

        self.btn_search2 = QPushButton("Buscar CEP")
        self.btn_search2.clicked.connect(self.on_search_address)
        lay.addWidget(self.btn_search2)

        self.status2 = QLabel("Digite UF, cidade e rua.")
        self.status2.setWordWrap(True)
        lay.addWidget(self.status2)

        self.addr_list = QListWidget()
        lay.addWidget(self.addr_list, stretch=1)
        return tab

    # -- acoes -----------------------------------------------------------
    def on_search_cep(self):
        cep = self.cep_input.text().strip()
        if len(clean_cep(cep)) != 8:
            self.set_status(self.status1, "Digite um CEP com 8 digitos.", mode="error")
            return
        self.set_status(self.status1, "Consultando o ViaCEP...")
        self.btn_search.setEnabled(False)
        self.worker = Worker(lookup_cep, cep)
        self.worker.done.connect(self.on_cep_done)
        self.worker.start()

    @Slot(tuple)
    def on_cep_done(self, result):
        self.btn_search.setEnabled(True)
        kind, data = result
        if kind == "error":
            self.set_status(self.status1, data, mode="error")
            return
        self.res_labels["Rua"].setText(data.get("logradouro") or "—")
        self.res_labels["Bairro"].setText(data.get("bairro") or "—")
        self.res_labels["Cidade"].setText(data.get("localidade") or "—")
        self.res_labels["UF"].setText(data.get("uf") or "—")
        self.res_labels["DDD"].setText(data.get("ddd") or "—")
        self.res_labels["IBGE"].setText(data.get("ibge") or "—")
        self.res_labels["CEP"].setText(format_cep(data.get("cep", "")))
        self.last_address = address_to_text(data)
        self.btn_map.setEnabled(bool(self.last_address))
        self.set_status(self.status1, "Endereco retornado pelo ViaCEP.", mode="ok")

    def on_clear_cep(self):
        self.cep_input.clear()
        for lab in self.res_labels.values():
            lab.setText("—")
        self.btn_map.setEnabled(False)
        self.last_address = ""
        self.set_status(self.status1, "Digite um CEP e clique em Buscar.")

    def on_open_map(self):
        if self.last_address:
            webbrowser.open(maps_url_for(self.last_address))

    def on_search_address(self):
        self.addr_list.clear()
        self.set_status(self.status2, "Consultando o ViaCEP...")
        self.btn_search2.setEnabled(False)
        self.worker = Worker(
            lookup_address,
            self.uf_input.text(), self.city_input.text(), self.street_input.text(),
        )
        self.worker.done.connect(self.on_address_done)
        self.worker.start()

    @Slot(tuple)
    def on_address_done(self, result):
        self.btn_search2.setEnabled(True)
        kind, data = result
        if kind == "error":
            self.set_status(self.status2, data, mode="error")
            return
        for item in data:
            self.addr_list.addItem(
                "%s — %s, %s (%s/%s)"
                % (format_cep(item.get("cep", "")), item.get("logradouro", ""),
                   item.get("bairro", ""), item.get("localidade", ""), item.get("uf", ""))
            )
        self.set_status(self.status2, "%d resultado(s) retornado(s) pelo ViaCEP." % len(data), mode="ok")

    @staticmethod
    def set_status(label, msg, mode="info"):
        colors = {"info": "#6B5D4D", "ok": "#2F7D33", "error": "#C0392B"}
        weight = "font-weight: bold;" if mode in ("ok", "error") else ""
        label.setText(msg)
        label.setStyleSheet("color: %s; %s" % (colors.get(mode, "#6B5D4D"), weight))


def main():
    app = QApplication(sys.argv)
    app.setStyleSheet(STYLESHEET)
    win = CepWindow()
    win.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
