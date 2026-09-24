/* GPS Simples — lógica de ligação com o Google Maps */
let map = null;
let directionsRenderer = null;

const $ = (id) => document.getElementById(id);
const originEl = $("origin"), destEl = $("destination"), modeEl = $("mode");
const statusEl = $("status"), mapsLink = $("maps-link");
const resultBox = $("result"), mapDiv = $("map"), frame = $("map-frame");

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = "status" + (isError ? " error" : "");
}

// Chamado pelo Google Maps JS (callback=initMap) quando há chave
function initMap() {
  map = new google.maps.Map(mapDiv, {
    center: { lat: -23.5558, lng: -46.6396 }, // São Paulo
    zoom: 12,
  });
  directionsRenderer = new google.maps.DirectionsRenderer({ map });
  mapDiv.style.display = "block";
  frame.style.display = "none";
}

// Modo sem chave: mostra iframe incorporado
function showEmbed(embedUrl) {
  if (window.HAS_GOOGLE_KEY && map) return; // com chave o mapa JS já mostra
  mapDiv.style.display = "none";
  frame.style.display = "block";
  if (embedUrl) frame.src = embedUrl;
}

function showMapsLink(url) {
  mapsLink.href = url;
  mapsLink.classList.remove("hidden");
}

// Inicial: sem chave, esconde div do mapa JS e mostra iframe do Brasil
if (!window.HAS_GOOGLE_KEY) {
  mapDiv.style.display = "none";
  frame.src = "https://maps.google.com/maps?q=Brasil&t=&z=4&ie=UTF8&iwloc=&output=embed";
} else {
  frame.style.display = "none";
}

async function calcularRota() {
  const origin = originEl.value.trim();
  const destination = destEl.value.trim();
  const mode = modeEl.value;
  if (!origin || !destination) {
    setStatus("Digite a origem e o destino.", true);
    return;
  }
  setStatus("Consultando o Google Maps...");
  resultBox.classList.add("hidden");

  try {
    const resp = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, mode }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      setStatus(data.error || "Erro ao calcular rota.", true);
      if (data.maps_url) showMapsLink(data.maps_url);
      return;
    }

    showMapsLink(data.maps_url);

    // CASO 1: com chave → trajeto completo volta para o sistema
    if (!data.no_key) {
      $("r-distance").textContent = data.distance;
      $("r-duration").textContent = data.duration;
      $("r-start").textContent = data.start_address;
      $("r-end").textContent = data.end_address;
      const ol = $("r-steps");
      ol.innerHTML = "";
      data.steps.forEach((s) => {
        const li = document.createElement("li");
        li.innerHTML = `${s.instruction} <small>(${s.distance} · ${s.duration})</small>`;
        ol.appendChild(li);
      });
      resultBox.classList.remove("hidden");
      setStatus(`Trajeto retornado pelo Google Maps: ${data.distance} · ${data.duration}`);

      // Desenha a rota no mapa interativo
      if (window.HAS_GOOGLE_KEY && directionsRenderer) {
        const dirService = new google.maps.DirectionsService();
        dirService.route(
          {
            origin: data.start_address || origin,
            destination: data.end_address || destination,
            travelMode: { driving: "DRIVING", walking: "WALKING", bicycling: "BICYCLING", transit: "TRANSIT" }[mode],
          },
          (result, status) => {
            if (status === "OK") directionsRenderer.setDirections(result);
          }
        );
      }
    } else {
      // CASO 2: sem chave → rota incorporada (iframe + link)
      setStatus(data.message);
      const q = encodeURIComponent(origin + " to " + destination);
      showEmbed(`https://maps.google.com/maps?q=${q}&t=&z=13&ie=UTF8&iwloc=&output=embed`);
    }
  } catch (e) {
    setStatus("Erro de conexão com o servidor.", true);
  }
}

async function buscarUmEndereco() {
  const addr = (originEl.value.trim() + " " + destEl.value.trim()).trim();
  const endereco = destEl.value.trim() || originEl.value.trim();
  if (!endereco) {
    setStatus("Digite ao menos um endereço para buscar.", true);
    return;
  }
  setStatus(`Buscando "${endereco}" no Google Maps...`);
  const resp = await fetch(`/api/search?address=${encodeURIComponent(endereco)}`);
  const data = await resp.json();
  showMapsLink(data.maps_url);
  showEmbed(data.embed_url);
  setStatus(`Endereço jogado no Google Maps. Link disponível acima.`);
  void addr;
}

$("btn-route").addEventListener("click", calcularRota);
$("btn-only-search").addEventListener("click", buscarUmEndereco);
$("btn-clear").addEventListener("click", () => {
  originEl.value = ""; destEl.value = "";
  resultBox.classList.add("hidden");
  mapsLink.classList.add("hidden");
  setStatus("");
});
$("btn-geo").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Geolocalização não suportada.", true);
    return;
  }
  setStatus("Obtendo sua localização...");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      originEl.value = `${pos.coords.latitude},${pos.coords.longitude}`;
      setStatus("Localização preenchida como origem.");
    },
    () => setStatus("Não foi possível obter a localização.", true)
  );
});
