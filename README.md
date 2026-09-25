# Buscador de CEP (programa desktop)

Sistema acadêmico: **programa de computador com janela própria** que
**recebe um CEP, joga no ViaCEP (programa de terceiros) e o endereço
volta para dentro do programa**. Também faz o caminho inverso
(endereço → CEP) e abre o endereço no mapa.

**Terceiro utilizado: ViaCEP (viacep.com.br)** — gratuito, sem chave de
API e sem cadastro. Cumpre o requisito do trabalho sem a burocracia do
Google Cloud.

**Artigo no LinkedIn:** https://www.linkedin.com/pulse/buscador-de-cep-desktop-e-mobile-com-api-viacep-estev%25C3%25A3o-ximenes-01w8c/?trackingId=N7W10lNcRya1Q4U7wbxtLA%3D%3D

## Rodar o programa

**Duplo clique** no atalho **"Buscador de CEP"** (Área de Trabalho): o
programa abre direto, sem janela preta. (O `RODAR_CEP.bat` continua
existindo como instalador/reparo para a primeira vez.)

Manual (PyCharm / terminal):

```bash
py -m pip install -r requirements.txt
py buscador_cep.py
```

## Versão celular (APK Android)

O mesmo sistema em **aplicativo de celular nativo** (Java/Kotlin-free, só
APIs do Android), feito no mesmo esquema do projeto detector_objetos:
pasta `android/` compilada com o Gradle + SDK já instalados na máquina.

- O app chama o **ViaCEP direto do celular** (só precisa de internet,
  não precisa do PC ligado — diferente do detector, que usava o PC).
- Tem as 2 telas: CEP → Endereço e Endereço → CEP, no tema bege/verde.

**Instalar no celular:**

1. Celular e PC no **mesmo Wi-Fi**.
2. Duplo clique em `INSTALAR_NO_CELULAR.bat` (mostra um QR Code).
3. Escaneie com a câmera do celular, baixe e permita
   "instalar apps desconhecidos".

**Recompilar o APK** (se mudar o código Java):

```powershell
$env:JAVA_HOME = "C:\Users\Estevão\.jdks\jbr-21.0.11"
<gradle 8.13 em .gradle>\bin\gradle.bat assembleDebug --offline
```

O APK sai em `android/app/build/outputs/apk/debug/app-debug.apk`
(~19 KB, já assinado como debug — pronto para instalar).

## Roteiro de demonstração para o professor

1. Abra o programa pelo atalho (janela desktop, sem navegador).
2. Aba **CEP → Endereço**: digite um CEP (ex: `01310-100`) e clique em **Buscar**:
   - o programa envia o CEP ao **ViaCEP**;
   - rua, bairro, cidade, UF, DDD e IBGE **voltam para o programa**.
3. Clique em **Ver no mapa** para abrir o endereço no mapa (prova extra da integração).
4. Aba **Endereço → CEP**: digite UF, cidade e rua para descobrir o CEP.
5. Teste um CEP inválido (ex: `00000-000`) para mostrar o tratamento de erro.

## Estrutura (arquivos deste projeto)

```
gps_simples/
├── buscador_cep.py  # O PROGRAMA (janela desktop + ViaCEP)
├── android/         # APP DE CELULAR (nativo, compila em app-debug.apk)
├── instalar_celular.py + INSTALAR_NO_CELULAR.bat  # instala o APK via QR
├── RODAR_CEP.bat    # Instalador da primeira vez (com janela)
├── README_CEP.md    # Este arquivo
└── requirements.txt # Dependências (PySide6 + requests)
```

(Os arquivos `gps_desktop.py`, `app.py`, `RODAR_GPS.bat` são do projeto
anterior do GPS e foram mantidos como referência.)
