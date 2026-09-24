# 🧭 GPS Simples com Google Maps (programa desktop)

Sistema acadêmico: **programa de computador com janela própria** que
**recebe endereços, joga no Google Maps (programa de terceiros) e o
trajeto volta para dentro do programa**.

Nada de navegador: ao clicar no atalho, abre uma janela com o
Google Maps embutido de um lado e os dados da rota do outro.

## Como funciona a ligação com o terceiro (Google Maps)

| Parte | Tecnologia do Google | O que faz |
|---|---|---|
| Buscar 1 endereço | URLs universais + mapa incorporado | joga o endereço no Google Maps dentro da janela |
| Trajeto (sem chave) | URL universal (`google.com/maps/dir/?api=1`) | rota interativa do Google desenhada dentro do programa + botão "Abrir no Google Maps" |
| Trajeto completo (com chave) | **Directions API** via Python (`requests`) | distância, tempo e passo a passo exibidos no painel do programa |

Isso cumpre o requisito do trabalho: **o sistema obrigatoriamente usa um programa de terceiros** (Google Maps Platform).

## Rodar o programa

**Duplo clique** no atalho **"GPS Simples"** (Área de Trabalho): o programa
abre direto, sem janela preta. (O `RODAR_GPS.bat` continua existindo como
instalador/reparo para a primeira vez.)

Manual (PyCharm / terminal):

```bash
py -m pip install -r requirements.txt
py gps_desktop.py
```

> **Sem chave** o programa já funciona: mostra endereço/rota no Google
> Maps embutido.
> **Com chave** ele libera o modo completo: distância, tempo estimado e
> passo a passo no painel.

## Gerar a chave do Google (grátis, ~5 min)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um projeto (ex: `gps-faculdade`).
2. Menu **APIs e serviços → Biblioteca** e ative: **Directions API**.
   (Só ela é usada pelo programa desktop; a chave fica no `.env`, não no código.)
3. Menu **APIs e serviços → Credenciais → Criar credenciais → Chave de API**.
4. Copie `.env.example` para `.env` e preencha `GOOGLE_MAPS_API_KEY=SUA_CHAVE`.

O Google dá **créditos gratuitos mensais** que cobrem com folga um trabalho de faculdade.

## Roteiro de demonstração para o professor

1. Abra o programa pelo atalho (janela desktop, sem navegador).
2. Digite a **origem** e o **destino** (o modo é sempre carro).
3. Clique em **Calcular rota**:
   - o programa envia origem/destino ao **Google Maps**;
   - a rota aparece desenhada no mapa embutido;
   - com chave, **distância, tempo e passo a passo** voltam para o painel do programa.
4. Clique em **Buscar endereco** para mostrar o fluxo "receber um endereço → jogar no Google Maps".
5. **Abrir no Google Maps** prova a integração: abre o mesmo trajeto no Google Maps oficial.

## Estrutura

```
gps_simples/
├── gps_desktop.py       # O PROGRAMA (janela desktop + Google Maps embutido)
├── RODAR_GPS.bat        # Atalho de duplo clique
├── app.py               # Versão alternativa em navegador (Flask) — opcional
├── templates/index.html # Tela da versão navegador
├── static/              # Visual da versão navegador
├── requirements.txt
├── .env.example
└── README.md
```
