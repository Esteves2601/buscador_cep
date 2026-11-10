"""Núcleo do Buscador de CEP — usado pelo desktop e pelo site.

Toda a ligação com o ViaCEP (programa de terceiros) fica aqui.
Sem dependência de interface, para poder rodar em servidor web.
"""

import re
import urllib.parse

import requests

VIA_CEP_CEP = "https://viacep.com.br/ws/{cep}/json/"
VIA_CEP_ENDERECO = "https://viacep.com.br/ws/{uf}/{cidade}/{rua}/json/"
TIMEOUT = 12

ERRO_CONEXAO = (
    "Nao foi possivel conectar ao ViaCEP agora. "
    "Verifique sua internet e tente de novo."
)


class CepError(ValueError):
    """Erro amigavel para mostrar ao usuario."""


def clean_cep(text):
    """Tira tudo que nao e digito: '01310-100' -> '01310100'."""
    return re.sub(r"\D", "", text or "")


def format_cep(digits):
    """'01310100' -> '01310-100'."""
    d = clean_cep(digits)
    return d[:5] + "-" + d[5:] if len(d) == 8 else d


def _get_json(url, params=None):
    """GET que devolve JSON, convertendo falhas em mensagens amigaveis."""
    try:
        resp = requests.get(
            url,
            params=params,
            timeout=TIMEOUT,
            headers={"User-Agent": "BuscadorCEP/2.0 (+https://estevetec.com.br)"},
        )
        resp.raise_for_status()
        return resp.json()
    except requests.Timeout:
        raise CepError("O ViaCEP demorou para responder. Tente novamente.")
    except requests.RequestException:
        raise CepError(ERRO_CONEXAO)
    except ValueError:
        raise CepError("Resposta inesperada do ViaCEP. Tente novamente.")


def lookup_cep(cep):
    """CEP -> dicionario com rua, bairro, cidade, uf, ddd, ibge."""
    digits = clean_cep(cep)
    if len(digits) != 8:
        raise CepError("Digite um CEP com 8 digitos.")
    data = _get_json(VIA_CEP_CEP.format(cep=digits))
    if not isinstance(data, dict) or data.get("erro"):
        raise CepError("CEP nao encontrado.")
    return data


def lookup_address(uf, cidade, rua):
    """Endereco -> lista de CEPs encontrados."""
    uf = (uf or "").strip().upper()
    cidade = (cidade or "").strip()
    rua = (rua or "").strip()
    if len(uf) != 2 or not uf.isalpha():
        raise CepError("Informe a UF com 2 letras (ex: SP).")
    if not cidade:
        raise CepError("Informe a cidade.")
    if len(rua) < 3:
        raise CepError("Informe a rua com pelo menos 3 letras.")
    url = VIA_CEP_ENDERECO.format(
        uf=urllib.parse.quote(uf),
        cidade=urllib.parse.quote(cidade),
        rua=urllib.parse.quote(rua),
    )
    data = _get_json(url)
    if isinstance(data, dict) and data.get("erro"):
        raise CepError("Nenhum endereco encontrado.")
    if not data:
        raise CepError("Nenhum endereco encontrado.")
    return data


def address_to_text(data):
    """Monta o endereco em uma linha, para exibir/usar no mapa."""
    partes = [
        data.get("logradouro", ""),
        data.get("bairro", ""),
        data.get("localidade", ""),
        data.get("uf", ""),
    ]
    return ", ".join(p for p in partes if p)


def maps_url_for(address):
    """Link do endereco no mapa (URL universal, sem chave)."""
    return "https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote_plus(address)
