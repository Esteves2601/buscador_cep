"""Publica uma pasta no Cloudflare Pages pelo fluxo oficial de Direct Upload.

Uso:
    set CLOUDFLARE_API_TOKEN=...
    set CLOUDFLARE_ACCOUNT_ID=...
    py tools/deploy_pages.py --dir site --project buscador-cep

O token precisa das permissoes:
  - Account > Cloudflare Pages > Edit
"""

import argparse
import base64
import hashlib
import json
import mimetypes
import os
import sys

import requests

try:
    from blake3 import blake3
except ImportError:
    sys.exit("Instale a dependencia: py -m pip install blake3")

API = "https://api.cloudflare.com/client/v4"


def hash_arquivo(caminho):
    """Mesmo algoritmo do Wrangler: blake3(base64(conteudo) + extensao)[:32]."""
    with open(caminho, "rb") as fh:
        conteudo = fh.read()
    ext = os.path.splitext(caminho)[1][1:]
    return blake3(base64.b64encode(conteudo) + ext.encode()).hexdigest()[:32]


def coletar(pasta):
    arquivos = []
    for raiz, _, nomes in os.walk(pasta):
        for nome in nomes:
            caminho = os.path.join(raiz, nome)
            rel = "/" + os.path.relpath(caminho, pasta).replace(os.sep, "/")
            tipo = mimetypes.guess_type(caminho)[0] or "application/octet-stream"
            if tipo.startswith("text/") or tipo in ("application/javascript", "application/json"):
                tipo += "; charset=utf-8"
            with open(caminho, "rb") as fh:
                dados = fh.read()
            arquivos.append(
                {
                    "path": rel,
                    "hash": hash_arquivo(caminho),
                    "bytes": dados,
                    "contentType": tipo,
                }
            )
    return arquivos


def publicar(pasta, projeto, token, conta, branch="main"):
    h = {"Authorization": "Bearer " + token}

    r = requests.get(f"{API}/accounts/{conta}/pages/projects/{projeto}", headers=h, timeout=30)
    if r.status_code == 404:
        r = requests.post(
            f"{API}/accounts/{conta}/pages/projects",
            headers={**h, "Content-Type": "application/json"},
            json={"name": projeto, "production_branch": branch},
            timeout=60,
        )
        print("Projeto criado:", projeto)
        if not r.ok:
            sys.exit("Falha ao criar projeto: " + r.text)
    elif not r.ok:
        sys.exit("Falha ao consultar projeto: " + r.text)

    arquivos = coletar(pasta)
    manifest = {a["path"]: a["hash"] for a in arquivos}
    print(f"{len(arquivos)} arquivo(s) para publicar")

    jwt = requests.get(
        f"{API}/accounts/{conta}/pages/projects/{projeto}/upload-token", headers=h, timeout=30
    ).json()["result"]["jwt"]
    ha = {"Authorization": "Bearer " + jwt}

    faltando = requests.post(
        f"{API}/pages/assets/check-missing",
        headers=ha,
        json={"hashes": list(manifest.values())},
        timeout=60,
    ).json()["result"]

    if faltando:
        payload = [
            {
                "base64": True,
                "key": a["hash"],
                "metadata": {"contentType": a["contentType"]},
                "value": base64.b64encode(a["bytes"]).decode(),
            }
            for a in arquivos
            if a["hash"] in faltando
        ]
        r = requests.post(f"{API}/pages/assets/upload", headers=ha, json=payload, timeout=180)
        print("Upload:", r.status_code, r.json().get("result"))

    requests.post(
        f"{API}/pages/assets/upsert-hashes",
        headers=ha,
        json={"hashes": list(manifest.values())},
        timeout=60,
    )

    r = requests.post(
        f"{API}/accounts/{conta}/pages/projects/{projeto}/deployments",
        headers=h,
        files={
            "manifest": (None, json.dumps(manifest)),
            "branch": (None, branch),
        },
        timeout=180,
    )
    if not r.ok:
        sys.exit("Falha no deploy: " + r.text)
    return r.json()["result"]["url"]


def main():
    p = argparse.ArgumentParser(description="Publica uma pasta no Cloudflare Pages")
    p.add_argument("--dir", required=True, help="pasta com os arquivos do site")
    p.add_argument("--project", required=True, help="nome do projeto no Pages")
    p.add_argument("--branch", default="main")
    args = p.parse_args()

    token = os.getenv("CLOUDFLARE_API_TOKEN")
    conta = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    if not token or not conta:
        sys.exit("Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID")

    url = publicar(args.dir, args.project, token, conta, args.branch)
    print("Deploy concluido:", url)


if __name__ == "__main__":
    main()
