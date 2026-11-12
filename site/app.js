/* Buscador de CEP — lógica do app.
   Consulta o ViaCEP (programa de terceiros) direto do navegador. */

const $ = (id) => document.getElementById(id);
const TEMPO_LIMITE = 12000;
const CHAVE_TEMA = "tema";
const CHAVE_PWA = "ocultarInstalar";
const CHAVE_HISTORICO = "historico-cep";
const LIMITE_HISTORICO = 6;

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
  limparCampo: $("btn-limpar-campo"),
  uf: $("uf"),
  cidade: $("cidade"),
  rua: $("rua"),
  status: $("status"),
  statusTexto: $("status-texto"),
  resultado: $("resultado"),
  estado: $("estado"),
  estadoTitulo: $("estado-titulo"),
  estadoTexto: $("estado-texto"),
  estadoChips: $("estado-chips"),
  carregando: $("carregando"),
  lista: $("lista"),
  btnBuscar: $("btn-buscar"),
  btnLimpar: $("btn-limpar"),
  btnBuscarEnd: $("btn-buscar-end"),
  btnMapa: $("btn-mapa"),
  btnCopiar: $("btn-copiar"),
  btnMapaEmbed: $("btn-mapa-embed"),
  mapaContainer: $("mapa-container"),
  mapaIframe: $("mapa-iframe"),
  tempo: $("r-tempo"),
  linhaComplemento: $("linha-complemento"),
  btnTema: $("btn-tema"),
  conexao: $("conexao"),
  historico: $("historico"),
  historicoLista: $("historico-lista"),
  btnLimparHistorico: $("btn-limpar-historico"),
  toast: $("toast"),
  toastTexto: $("toast-texto"),
  modal: $("modal-sobre"),
  btnSobre: $("btn-sobre"),
  btnFecharSobre: $("btn-fechar-sobre"),
  pwa: $("pwa"),
  pwaTitulo: $("pwa-titulo"),
  pwaSub: $("pwa-sub"),
  btnInstalar: $("btn-instalar"),
  btnFecharPwa: $("btn-fechar-pwa"),
};

let ultimoDados = null;

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

/* ---------------- Tema ---------------- */

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

function alternarTema() {
  const escuroAtual = document.documentElement.classList.contains("dark-mode");
  aplicarTema(escuroAtual ? "claro" : "escuro");
}

aplicarTema(temaInicial(), false);
el.btnTema.addEventListener("click", alternarTema);

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

/* ---------------- Utilidades ---------------- */

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { document.execCommand("copy"); } catch { /* ignora */ }
    area.remove();
  }
}

let toastTimer = null;
function mostrarToast(mensagem) {
  el.toastTexto.textContent = mensagem;
  el.toast.classList.add("visivel");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("visivel"), 2200);
}

function textoEndereco(d) {
  const linhas = [];
  const rua = [d.logradouro, d.complemento].filter(Boolean).join(", ");
  if (rua) linhas.push(rua);
  if (d.bairro) linhas.push(d.bairro);
  linhas.push([d.localidade, d.uf].filter(Boolean).join(" - "));
  linhas.push("CEP: " + formatarCep(d.cep));
  if (d.ddd) linhas.push("DDD: (" + d.ddd + ")");
  if (d.ibge) linhas.push("IBGE: " + d.ibge);
  if (d.regiao) linhas.push("Região: " + d.regiao);
  return linhas.filter(Boolean).join("\n");
}

/* ---------------- Histórico local ---------------- */

function lerHistorico() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]");
    return Array.isArray(bruto) ? bruto : [];
  } catch {
    return [];
  }
}

function salvarHistorico(lista) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(lista.slice(0, LIMITE_HISTORICO)));
  } catch { /* ignora */ }
}

function registrarHistorico(d) {
  const item = {
    cep: formatarCep(d.cep),
    endereco: [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean).join(" · "),
    quando: Date.now(),
  };
  if (!item.cep) return;
  const lista = lerHistorico().filter((x) => x.cep !== item.cep);
  lista.unshift(item);
  salvarHistorico(lista);
  renderHistorico();
}

function renderHistorico() {
  const lista = lerHistorico();
  if (!lista.length) {
    el.historico.classList.add("oculto");
    return;
  }
  el.historico.classList.remove("oculto");
  el.historicoLista.innerHTML = "";

  lista.forEach((item) => {
    const li = document.createElement("li");
    li.className = "historico-item";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "historico-btn";

    const cep = document.createElement("span");
    cep.className = "historico-cep";
    cep.textContent = item.cep;

    const end = document.createElement("span");
    end.className = "historico-end";
    end.textContent = item.endereco || "";

    btn.append(cep, end);
    btn.addEventListener("click", () => {
      mudarAba(true);
      el.cep.value = item.cep;
      consultarCep(item.cep);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    li.appendChild(btn);
    el.historicoLista.appendChild(li);
  });
}

el.btnLimparHistorico.addEventListener("click", () => {
  localStorage.removeItem(CHAVE_HISTORICO);
  renderHistorico();
  mostrarToast("Histórico limpo");
});

/* ---------------- Mapa ---------------- */

function resetarMapa() {
  el.mapaContainer.classList.add("oculto");
  el.mapaIframe.src = "about:blank";
  el.btnMapaEmbed.textContent = "Ver mapa aqui";
  el.btnMapaEmbed.setAttribute("aria-expanded", "false");
  el.btnMapaEmbed.dataset.endereco = "";
}

el.btnMapaEmbed.addEventListener("click", () => {
  const endereco = el.btnMapaEmbed.dataset.endereco;
  if (!endereco) return;

  const aberto = !el.mapaContainer.classList.contains("oculto");
  if (aberto) {
    el.mapaContainer.classList.add("oculto");
    el.btnMapaEmbed.textContent = "Ver mapa aqui";
    el.btnMapaEmbed.setAttribute("aria-expanded", "false");
    return;
  }

  if (!String(el.mapaIframe.src).includes("maps.google.com")) {
    el.mapaIframe.src =
      "https://maps.google.com/maps?q=" + encodeURIComponent(endereco) + "&z=16&output=embed";
  }
  el.mapaContainer.classList.remove("oculto");
  el.btnMapaEmbed.textContent = "Ocultar mapa";
  el.btnMapaEmbed.setAttribute("aria-expanded", "true");
});

/* ---------------- Consulta por CEP ---------------- */

function preencher(dados, ms) {
  const uf = dados.uf || "";
  const regiao = dados.regiao || REGIOES[uf] || "";

  $("r-cep").textContent = formatarCep(dados.cep) || "—";
  $("r-rua").textContent = dados.logradouro || "—";
  $("r-bairro").textContent = dados.bairro || "—";
  $("r-cidade").textContent = dados.localidade
    ? `${dados.localidade}${uf ? " — " + uf : ""}`
    : "—";
  $("r-estado").textContent = dados.estado || "";
  $("r-ddd").textContent = dados.ddd ? `(${dados.ddd})` : "—";
  $("r-ibge").textContent = dados.ibge || "—";
  $("r-siafi").textContent = dados.siafi ? `SIAFI: ${dados.siafi}` : "";
  $("r-tag").textContent = uf ? `${uf}${regiao ? " · " + regiao : ""}` : "Brasil";

  const complemento = (dados.complemento || "").trim();
  $("r-complemento").textContent = complemento || "—";
  el.linhaComplemento.classList.toggle("oculto", !complemento);

  const endereco = [dados.logradouro, dados.bairro, dados.localidade, uf]
    .filter(Boolean)
    .join(", ");

  el.btnMapa.href =
    "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco);
  el.btnMapaEmbed.dataset.endereco = endereco;
  el.tempo.textContent = ms ? `Consultado em ${ms} ms` : "";
  ultimoDados = dados;
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
  resetarMapa();

  const inicio = performance.now();
  try {
    const dados = await buscarJson(`https://viacep.com.br/ws/${digitos}/json/`);
    const ms = Math.round(performance.now() - inicio);

    if (dados.erro) {
      status("CEP não encontrado. Confira os números.", "erro");
      mostrarErro(
        "CEP não encontrado",
        "Não há endereço cadastrado para esse CEP. Verifique os números e tente novamente."
      );
      return;
    }

    preencher(dados, ms);
    esconderPainéis();
    el.estado.classList.remove("error");
    el.resultado.classList.remove("oculto");
    status("Endereço localizado com sucesso no ViaCEP.", "ok");
    registrarHistorico(dados);
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
  resetarMapa();

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

      const li = document.createElement("li");
      li.className = "cep-card-item";

      const principal = document.createElement("button");
      principal.type = "button";
      principal.className = "cep-item-main";

      const cepEl = document.createElement("span");
      cepEl.className = "cep-item-cep";
      cepEl.textContent = cep;

      const ruaEl = document.createElement("span");
      ruaEl.className = "cep-item-rua";
      ruaEl.textContent = item.logradouro || "";

      const localEl = document.createElement("span");
      localEl.className = "cep-item-local";
      localEl.textContent = `${item.bairro || ""} · ${item.localidade || ""}/${item.uf || ""}`;

      principal.append(cepEl, document.createElement("br"), ruaEl,
                       document.createElement("br"), localEl);
      principal.addEventListener("click", () => {
        mudarAba(true);
        el.cep.value = cep;
        consultarCep(cep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      const copiar = document.createElement("button");
      copiar.type = "button";
      copiar.className = "cep-item-copy";
      copiar.setAttribute("aria-label", `Copiar o CEP ${cep}`);
      copiar.innerHTML =
        '<svg fill="none" height="16" width="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
      copiar.addEventListener("click", async () => {
        await copiarTexto(cep);
        mostrarToast(`CEP ${cep} copiado`);
      });

      li.append(principal, copiar);
      el.lista.appendChild(li);
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

function atualizarBotaoLimparCampo() {
  el.limparCampo.classList.toggle("visivel", el.cep.value.length > 0);
}

el.cep.addEventListener("input", () => {
  el.cep.value = formatarCep(el.cep.value);
  el.cep.classList.remove("erro");
  atualizarBotaoLimparCampo();
});

el.uf.addEventListener("input", () => {
  el.uf.value = el.uf.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
});

function limparFormulario() {
  el.cep.value = "";
  el.cep.classList.remove("erro");
  limparLista();
  el.estado.classList.remove("error");
  el.tempo.textContent = "";
  resetarMapa();
  atualizarBotaoLimparCampo();
  status("Digite um CEP e clique em Buscar.");
  mostrarEstado(
    "Pronto para consultar",
    "Informe o CEP para carregar logradouro, bairro, cidade, DDD e código IBGE oficial."
  );
  el.cep.focus();
}

el.btnLimpar.addEventListener("click", limparFormulario);
el.limparCampo.addEventListener("click", limparFormulario);

document.querySelectorAll(".chip[data-cep]").forEach((chip) => {
  chip.addEventListener("click", () => {
    el.cep.value = formatarCep(chip.dataset.cep);
    atualizarBotaoLimparCampo();
    consultarCep(chip.dataset.cep);
  });
});

el.btnCopiar.addEventListener("click", async () => {
  if (!ultimoDados) return;
  await copiarTexto(textoEndereco(ultimoDados));
  const original = el.btnCopiar.innerHTML;
  el.btnCopiar.textContent = "Copiado!";
  mostrarToast("Endereço copiado");
  setTimeout(() => { el.btnCopiar.innerHTML = original; }, 2000);
});

/* ---------------- Atalhos de teclado ---------------- */

document.addEventListener("keydown", (evento) => {
  if (el.modal.open) return;
  if (evento.key === "Escape") {
    evento.preventDefault();
    limparFormulario();
    return;
  }
  if (evento.altKey && (evento.key === "t" || evento.key === "T")) {
    evento.preventDefault();
    alternarTema();
  }
});

/* ---------------- Modal Sobre ---------------- */

el.btnSobre.addEventListener("click", () => {
  if (typeof el.modal.showModal === "function") {
    el.modal.showModal();
  } else {
    el.modal.setAttribute("open", "");
  }
});

el.btnFecharSobre.addEventListener("click", () => el.modal.close());

el.modal.addEventListener("click", (evento) => {
  if (evento.target === el.modal) el.modal.close();
});

/* ---------------- Atalhos de URL ---------------- */

const parametros = new URLSearchParams(location.search);

if (parametros.get("aba") === "endereco") mudarAba(false);

const cepDaUrl = parametros.get("cep");
if (cepDaUrl && somenteDigitos(cepDaUrl).length === 8) {
  el.cep.value = formatarCep(cepDaUrl);
  atualizarBotaoLimparCampo();
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
  el.pwaSub.textContent = 'Compartilhar → "Adicionar à Tela de Início"';
  el.btnInstalar.textContent = "Entendi";
  mostrarPwa();
}

if ("serviceWorker" in navigator) {
  const tinhaController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (tinhaController) location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js", { updateViaCache: "none" })
      .catch(() => {});
  });
}

/* ---------------- Inicialização ---------------- */

renderHistorico();
atualizarBotaoLimparCampo();
