/* Buscador de CEP — lógica do app.
   Consulta o ViaCEP (programa de terceiros) direto do navegador. */

const $ = (id) => document.getElementById(id);
const TEMPO_LIMITE = 12000;
const CHAVE_TEMA = "tema";
const CHAVE_PWA = "ocultarInstalar";

const REGIOES = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const el = {
  tabCep: $("tab-cep"),
  tabEnd: $("tab-end"),
  formCep: $("form-cep"),
  formEnd: $("form-end"),
  cep: $("cep"),
  uf: $("uf"),
  cidade: $("cidade"),
  rua: $("rua"),
  status: $("status"),
  statusTexto: $("status-texto"),
  resultado: $("resultado"),
  estado: $("estado"),
  estadoTitulo: $("estado-titulo"),
  estadoTexto: $("estado-texto"),
  carregando: $("carregando"),
  lista: $("lista"),
  btnBuscar: $("btn-buscar"),
  btnBuscarEnd: $("btn-buscar-end"),
  btnMapa: $("btn-mapa"),
  btnCopiar: $("btn-copiar"),
  btnTema: $("btn-tema"),
  conexao: $("conexao"),
  pwa: $("pwa"),
  pwaTitulo: $("pwa-titulo"),
  pwaSub: $("pwa-sub"),
  btnInstalar: $("btn-instalar"),
  btnFecharPwa: $("btn-fechar-pwa"),
};

const somenteDigitos = (t) => (t || "").replace(/\D/g, "");

function formatarCep(valor) {
  const v = somenteDigitos(valor).slice(0, 8);
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
}

/* ---------------- Status e estados ---------------- */

function status(mensagem, tipo = "info") {
  el.statusTexto.textContent = mensagem;
  el.status.classList.remove("success", "error");
  if (tipo === "ok") el.status.classList.add("success");
  if (tipo === "erro") el.status.classList.add("error");
}

function esconderPainéis() {
  el.resultado.classList.add("oculto");
  el.estado.classList.add("oculto");
  el.carregando.classList.add("oculto");
}

function mostrarEstado(titulo, texto) {
  esconderPainéis();
  el.estadoTitulo.textContent = titulo;
  el.estadoTexto.textContent = texto;
  el.estado.classList.remove("oculto");
}

function mostrarErro(titulo, texto) {
  mostrarEstado(titulo, texto);
  el.estado.classList.add("error");
}

function mostrarCarregando() {
  esconderPainéis();
  el.estado.classList.remove("error");
  el.carregando.classList.remove("oculto");
}

function limparLista() {
  el.lista.innerHTML = "";
}

/* ---------------- Tema (claro / escuro) ---------------- */

let metaTema = null;

function aplicarTema(tema, salvar = true) {
  const escuro = tema === "escuro";
  document.documentElement.classList.toggle("dark-mode", escuro);
  el.btnTema.setAttribute("aria-pressed", String(escuro));

  if (!metaTema) {
    metaTema = document.createElement("meta");
    metaTema.name = "theme-color";
    metaTema.dataset.dinamico = "1";
    document.head.appendChild(metaTema);
  }
  metaTema.content = escuro ? "#0C120E" : "#236B32";

  if (salvar) localStorage.setItem(CHAVE_TEMA, tema);
}

function temaInicial() {
  const salvo = localStorage.getItem(CHAVE_TEMA);
  if (salvo === "claro" || salvo === "escuro") return salvo;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

aplicarTema(temaInicial(), false);

el.btnTema.addEventListener("click", () => {
  const escuroAtual = document.documentElement.classList.contains("dark-mode");
  aplicarTema(escuroAtual ? "claro" : "escuro");
});

/* ---------------- Conexão ---------------- */

function atualizarConexao() {
  const online = navigator.onLine;
  el.conexao.classList.toggle("offline", !online);
  el.conexao.innerHTML = '<span class="conn-dot" aria-hidden="true"></span> ' +
    (online ? "ViaCEP Online" : "Sem conexão");
}

window.addEventListener("online", atualizarConexao);
window.addEventListener("offline", atualizarConexao);
atualizarConexao();

/* ---------------- Abas ---------------- */

function mudarAba(mostrarCep) {
  el.formCep.classList.toggle("oculto", !mostrarCep);
  el.formEnd.classList.toggle("oculto", mostrarCep);
  el.tabCep.classList.toggle("active", mostrarCep);
  el.tabEnd.classList.toggle("active", !mostrarCep);
  el.tabCep.setAttribute("aria-selected", String(mostrarCep));
  el.tabEnd.setAttribute("aria-selected", String(!mostrarCep));
}

el.tabCep.addEventListener("click", () => mudarAba(true));
el.tabEnd.addEventListener("click", () => mudarAba(false));

/* ---------------- Rede ---------------- */

async function buscarJson(url) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE);
  try {
    const resp = await fetch(url, { signal: controle.signal });
    if (!resp.ok) throw new Error("http");
    return await resp.json();
  } catch (erro) {
    if (erro.name === "AbortError") {
      throw new Error("O ViaCEP demorou para responder. Tente novamente.");
    }
    throw new Error("Não foi possível consultar o ViaCEP. Verifique sua internet.");
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- Consulta por CEP ---------------- */

function preencher(dados) {
  const uf = dados.uf || "";
  el.resultado.querySelector(".result-cep").textContent = formatarCep(dados.cep) || "—";
  $("r-rua").textContent = dados.logradouro || "—";
  $("r-bairro").textContent = dados.bairro || "—";
  $("r-cidade").textContent = dados.localidade
    ? `${dados.localidade}${uf ? " — " + uf : ""}`
    : "—";
  $("r-ddd").textContent = dados.ddd ? `(${dados.ddd})` : "—";
  $("r-ibge").textContent = dados.ibge || "—";

  const regiao = REGIOES[uf];
  $("r-tag").textContent = uf ? `${uf}${regiao ? " · " + regiao : ""}` : "Brasil";

  const endereco = [dados.logradouro, dados.bairro, dados.localidade, uf]
    .filter(Boolean)
    .join(", ");
  el.btnMapa.href =
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco);
  el.btnCopiar.dataset.texto = `${endereco} — CEP ${formatarCep(dados.cep)}`;
}

async function consultarCep(valor) {
  const digitos = somenteDigitos(valor ?? el.cep.value);

  if (digitos.length !== 8) {
    el.cep.classList.add("erro");
    status("Digite um CEP com 8 dígitos válidos.", "erro");
    mostrarErro(
      "Formato incompleto",
      "Certifique-se de digitar o CEP com todos os 8 números antes de acionar a busca."
    );
    el.cep.focus();
    return;
  }

  el.cep.classList.remove("erro");
  el.btnBuscar.disabled = true;
  el.btnBuscar.textContent = "Buscando…";
  status("Consultando o ViaCEP…");
  mostrarCarregando();
  limparLista();

  try {
    const dados = await buscarJson(`https://viacep.com.br/ws/${digitos}/json/`);
    if (dados.erro) {
      status("CEP não encontrado. Confira os números.", "erro");
      mostrarErro(
        "CEP não encontrado",
        "Não há endereço cadastrado para esse CEP. Verifique os números e tente novamente."
      );
      return;
    }
    preencher(dados);
    esconderPainéis();
    el.estado.classList.remove("error");
    el.resultado.classList.remove("oculto");
    status("Endereço localizado com sucesso no ViaCEP.", "ok");
  } catch (erro) {
    status(erro.message, "erro");
    mostrarErro("Falha na consulta", erro.message);
  } finally {
    el.btnBuscar.disabled = false;
    el.btnBuscar.innerHTML =
      '<svg fill="none" height="16" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" width="16" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg> Buscar';
  }
}

/* ---------------- Consulta por endereço ---------------- */

async function consultarEndereco() {
  const uf = el.uf.value.trim().toUpperCase();
  const cidade = el.cidade.value.trim();
  const rua = el.rua.value.trim();

  if (!/^[A-Z]{2}$/.test(uf)) {
    status("Informe a UF com 2 letras (ex: SP).", "erro");
    el.uf.focus();
    return;
  }
  if (!cidade) {
    status("Informe a cidade.", "erro");
    el.cidade.focus();
    return;
  }
  if (rua.length < 3) {
    status("Informe a rua com pelo menos 3 letras.", "erro");
    el.rua.focus();
    return;
  }

  el.btnBuscarEnd.disabled = true;
  el.btnBuscarEnd.textContent = "Buscando…";
  status("Consultando o ViaCEP…");
  mostrarCarregando();
  limparLista();

  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(
      cidade
    )}/${encodeURIComponent(rua)}/json/`;
    const dados = await buscarJson(url);

    if (!Array.isArray(dados) || dados.length === 0 || dados.erro) {
      status("Nenhum endereço encontrado. Tente outro nome de rua.", "erro");
      mostrarErro(
        "Nenhum resultado",
        "Não encontramos endereços com esses dados. Confira a cidade e o nome da rua."
      );
      return;
    }

    esconderPainéis();
    el.estado.classList.remove("error");
    status(`${dados.length} resultado(s) encontrados. Toque para ver o endereço.`, "ok");

    dados.slice(0, 50).forEach((item) => {
      const cep = formatarCep(item.cep);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cep-card-item";
      btn.innerHTML =
        `<span>` +
        `<span class="cep-item-cep">${cep}</span><br>` +
        `<span class="cep-item-rua">${item.logradouro || ""}</span><br>` +
        `<span class="cep-item-local">${item.bairro || ""} · ${item.localidade || ""}/${item.uf || ""}</span>` +
        `</span>` +
        `<svg fill="none" height="16" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="16" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;
      btn.addEventListener("click", () => {
        mudarAba(true);
        el.cep.value = cep;
        consultarCep(cep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      el.lista.appendChild(btn);
    });
  } catch (erro) {
    status(erro.message, "erro");
    mostrarErro("Falha na consulta", erro.message);
  } finally {
    el.btnBuscarEnd.disabled = false;
    el.btnBuscarEnd.textContent = "Buscar CEP";
  }
}

/* ---------------- Eventos ---------------- */

el.formCep.addEventListener("submit", (e) => {
  e.preventDefault();
  consultarCep();
});

el.formEnd.addEventListener("submit", (e) => {
  e.preventDefault();
  consultarEndereco();
});

el.cep.addEventListener("input", () => {
  el.cep.value = formatarCep(el.cep.value);
  el.cep.classList.remove("erro");
});

el.uf.addEventListener("input", () => {
  el.uf.value = el.uf.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
});

$("btn-limpar").addEventListener("click", () => {
  el.cep.value = "";
  el.cep.classList.remove("erro");
  limparLista();
  el.estado.classList.remove("error");
  status("Digite um CEP e clique em Buscar.");
  mostrarEstado(
    "Pronto para consultar",
    "Informe o CEP para carregar logradouro, bairro, cidade, DDD e código IBGE oficial."
  );
  el.cep.focus();
});

el.btnCopiar.addEventListener("click", async () => {
  const texto = el.btnCopiar.dataset.texto || "";
  if (!texto) return;
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  const original = el.btnCopiar.innerHTML;
  el.btnCopiar.textContent = "Copiado!";
  setTimeout(() => { el.btnCopiar.innerHTML = original; }, 2000);
});

/* ---------------- Atalhos de URL ---------------- */

const parametros = new URLSearchParams(location.search);

if (parametros.get("aba") === "endereco") mudarAba(false);

const cepDaUrl = parametros.get("cep");
if (cepDaUrl && somenteDigitos(cepDaUrl).length === 8) {
  el.cep.value = formatarCep(cepDaUrl);
  consultarCep(cepDaUrl);
}

/* ---------------- PWA ---------------- */

let promptInstalar = null;
let instalado =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

function podeMostrarPwa() {
  return !instalado && localStorage.getItem(CHAVE_PWA) !== "1";
}

function mostrarPwa() {
  if (podeMostrarPwa()) el.pwa.classList.remove("oculto");
}

function esconderPwa() {
  el.pwa.classList.add("oculto");
}

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  promptInstalar = evento;
  mostrarPwa();
});

el.btnInstalar.addEventListener("click", async () => {
  if (!promptInstalar) {
    esconderPwa();
    return;
  }
  promptInstalar.prompt();
  const escolha = await promptInstalar.userChoice;
  promptInstalar = null;
  if (escolha && escolha.outcome === "accepted") {
    instalado = true;
    esconderPwa();
  }
});

el.btnFecharPwa.addEventListener("click", () => {
  localStorage.setItem(CHAVE_PWA, "1");
  esconderPwa();
});

window.addEventListener("appinstalled", () => {
  instalado = true;
  esconderPwa();
});

if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !instalado) {
  el.pwaTitulo.textContent = "Instalar no iPhone";
  el.pwaSub.textContent = 'Toque em Compartilhar → "Adicionar à Tela de Início"';
  el.btnInstalar.textContent = "Entendi";
  mostrarPwa();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
