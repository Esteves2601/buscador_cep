/* Buscador de CEP — versão web estática.
   O navegador fala direto com o ViaCEP (programa de terceiros).
   Não precisa de servidor de aplicação nem de chave de API. */

const $ = (id) => document.getElementById(id);
const TEMPO_LIMITE = 12000;

const el = {
  abaCep: $("aba-cep"),
  abaEnd: $("aba-end"),
  painelCep: $("painel-cep"),
  painelEnd: $("painel-end"),
  formCep: $("form-cep"),
  formEnd: $("form-end"),
  cep: $("cep"),
  uf: $("uf"),
  cidade: $("cidade"),
  rua: $("rua"),
  statusCep: $("status-cep"),
  statusEnd: $("status-end"),
  resultado: $("resultado"),
  btnCep: $("btn-cep"),
  btnEnd: $("btn-end"),
  btnMapa: $("btn-mapa"),
  btnCopiar: $("btn-copiar"),
  lista: $("lista"),
};

const somenteDigitos = (t) => (t || "").replace(/\D/g, "");
const formatarCep = (d) => {
  const v = somenteDigitos(d).slice(0, 8);
  return v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v;
};

function status(elStatus, msg, tipo = "") {
  elStatus.textContent = msg;
  elStatus.className = `status${tipo ? " " + tipo : ""}`;
}

function mudarAba(mostrarCep) {
  el.painelCep.classList.toggle("oculto", !mostrarCep);
  el.painelEnd.classList.toggle("oculto", mostrarCep);
  el.abaCep.classList.toggle("ativa", mostrarCep);
  el.abaEnd.classList.toggle("ativa", !mostrarCep);
  el.abaCep.setAttribute("aria-selected", String(mostrarCep));
  el.abaEnd.setAttribute("aria-selected", String(!mostrarCep));
}

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

/* ---------- Aba 1: CEP -> Endereço ---------- */

function preencher(d) {
  $("r-rua").textContent = d.logradouro || "—";
  $("r-bairro").textContent = d.bairro || "—";
  $("r-cidade").textContent = d.localidade || "—";
  $("r-uf").textContent = d.uf || "—";
  $("r-ddd").textContent = d.ddd || "—";
  $("r-ibge").textContent = d.ibge || "—";
  $("r-cep").textContent = formatarCep(d.cep) || "—";

  const endereco = [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean).join(", ");
  el.btnMapa.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(endereco);
  el.btnCopiar.dataset.texto = `${endereco} — CEP ${formatarCep(d.cep)}`;
}

async function consultarCep(valor) {
  const digitos = somenteDigitos(valor ?? el.cep.value);
  if (digitos.length !== 8) {
    status(el.statusCep, "Digite um CEP com 8 dígitos.", "erro");
    el.cep.focus();
    return;
  }

  el.btnCep.disabled = true;
  el.btnCep.textContent = "Buscando…";
  status(el.statusCep, "Consultando o ViaCEP…");

  try {
    const dados = await buscarJson(`https://viacep.com.br/ws/${digitos}/json/`);
    if (dados.erro) {
      el.resultado.classList.add("oculto");
      status(el.statusCep, "CEP não encontrado. Confira os números.", "erro");
      return;
    }
    preencher(dados);
    el.resultado.classList.remove("oculto");
    status(el.statusCep, "Endereço encontrado!", "ok");
  } catch (erro) {
    el.resultado.classList.add("oculto");
    status(el.statusCep, erro.message, "erro");
  } finally {
    el.btnCep.disabled = false;
    el.btnCep.textContent = "Buscar";
  }
}

/* ---------- Aba 2: Endereço -> CEP ---------- */

async function consultarEndereco() {
  const uf = el.uf.value.trim().toUpperCase();
  const cidade = el.cidade.value.trim();
  const rua = el.rua.value.trim();

  if (!/^[A-Z]{2}$/.test(uf)) {
    status(el.statusEnd, "Informe a UF com 2 letras (ex: SP).", "erro");
    el.uf.focus();
    return;
  }
  if (!cidade) {
    status(el.statusEnd, "Informe a cidade.", "erro");
    el.cidade.focus();
    return;
  }
  if (rua.length < 3) {
    status(el.statusEnd, "Informe a rua com pelo menos 3 letras.", "erro");
    el.rua.focus();
    return;
  }

  el.btnEnd.disabled = true;
  el.btnEnd.textContent = "Buscando…";
  el.lista.innerHTML = "";
  status(el.statusEnd, "Consultando o ViaCEP…");

  try {
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(cidade)}/${encodeURIComponent(rua)}/json/`;
    const dados = await buscarJson(url);

    if (!Array.isArray(dados) || dados.length === 0 || dados.erro) {
      status(el.statusEnd, "Nenhum endereço encontrado. Tente outro nome de rua.", "erro");
      return;
    }

    status(el.statusEnd, `${dados.length} resultado(s). Toque em um item para ver o endereço.`, "ok");
    dados.slice(0, 50).forEach((item) => {
      const li = document.createElement("li");
      const cep = formatarCep(item.cep);
      li.innerHTML = `<span class="cep-item">${cep}</span>` +
        `<span>${item.logradouro || ""}</span><br>` +
        `<small>${item.bairro || ""} · ${item.localidade || ""}/${item.uf || ""}</small>`;
      li.addEventListener("click", () => {
        mudarAba(true);
        el.cep.value = cep;
        consultarCep(cep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      el.lista.appendChild(li);
    });
  } catch (erro) {
    status(el.statusEnd, erro.message, "erro");
  } finally {
    el.btnEnd.disabled = false;
    el.btnEnd.textContent = "Buscar CEP";
  }
}

/* ---------- Eventos ---------- */

el.abaCep.addEventListener("click", () => mudarAba(true));
el.abaEnd.addEventListener("click", () => mudarAba(false));

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
});

el.uf.addEventListener("input", () => {
  el.uf.value = el.uf.value.replace(/[^a-zA-Z]/g, "").toUpperCase();
});

$("btn-limpar").addEventListener("click", () => {
  el.formCep.reset();
  el.resultado.classList.add("oculto");
  status(el.statusCep, "Digite um CEP e clique em Buscar.");
  el.cep.focus();
});

el.btnCopiar.addEventListener("click", async () => {
  const texto = el.btnCopiar.dataset.texto || "";
  try {
    await navigator.clipboard.writeText(texto);
    el.btnCopiar.textContent = "Copiado!";
  } catch {
    const area = document.createElement("textarea");
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    el.btnCopiar.textContent = "Copiado!";
  }
  setTimeout(() => { el.btnCopiar.textContent = "Copiar endereço"; }, 2000);
});

/* Permite abrir por atalho do app: ?aba=endereco e ?cep=01310100 */
const parametros = new URLSearchParams(location.search);

if (parametros.get("aba") === "endereco") {
  mudarAba(false);
}

const cepDaUrl = parametros.get("cep");
if (cepDaUrl && somenteDigitos(cepDaUrl).length === 8) {
  el.cep.value = formatarCep(cepDaUrl);
  consultarCep(cepDaUrl);
}

/* ---------- App instalável (PWA) ---------- */

const painelInstalar = $("instalar");
const textoInstalar = $("instalar-texto");
const btnInstalar = $("btn-instalar");
const btnFecharInstalar = $("btn-fechar-instalar");

let promptInstalar = null;
let instalado = window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;
const instalacaoDispensada = () => localStorage.getItem("ocultarInstalar") === "1";

function mostrarInstalar() {
  if (!instalado && !instalacaoDispensada()) painelInstalar.classList.remove("oculto");
}
function esconderInstalar() {
  painelInstalar.classList.add("oculto");
}

window.addEventListener("beforeinstallprompt", (evento) => {
  evento.preventDefault();
  promptInstalar = evento;
  mostrarInstalar();
});

btnInstalar.addEventListener("click", async () => {
  if (promptInstalar) {
    promptInstalar.prompt();
    const escolha = await promptInstalar.userChoice;
    promptInstalar = null;
    if (escolha && escolha.outcome === "accepted") {
      instalado = true;
      esconderInstalar();
    }
    return;
  }
  textoInstalar.textContent =
    'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
});

btnFecharInstalar.addEventListener("click", () => {
  localStorage.setItem("ocultarInstalar", "1");
  esconderInstalar();
});

window.addEventListener("appinstalled", () => {
  instalado = true;
  esconderInstalar();
});

// iPhone não tem instalação automática: mostramos as instruções
if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !instalado) {
  textoInstalar.textContent =
    'Instale no iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
  btnInstalar.textContent = "Entendi";
  mostrarInstalar();
}

// Service worker (permite abrir o app offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
