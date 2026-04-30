// Road Hazard — full app: hazards + reporting + search + routing.
const DEFAULT_CENTER = [43.6532, -79.3832]; // Toronto City Hall / Nathan Phillips Square
const TYPE_COLOR = { pothole: "#d32f2f", debris: "#f57c00", flooding: "#1976d2", other: "#616161" };
const TYPE_EMOJI = { pothole: "🕳", debris: "🪨", flooding: "💧", other: "⚠" };
const CANNED_ROUTE_URL = `${window.API_BASE_URL ?? ""}/api/canned_route`;

let destinationMarker = null;
let routeLine = null;
const routeHazardLayer = L.layerGroup();

const map = L.map("map").setView(DEFAULT_CENTER, 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const hazardLayer = L.layerGroup().addTo(map);
routeHazardLayer.addTo(map);

function emojiIcon(hz) {
  return L.divIcon({
    className: "",
    html: `<div class="hazard-emoji">${TYPE_EMOJI[hz.type] ?? TYPE_EMOJI.other}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function renderHazard(hz) {
  L.marker([hz.lat, hz.lng], { icon: emojiIcon(hz) })
    .addTo(hazardLayer)
    .bindPopup(`<b>${hz.type}</b><br>${hz.reportedAt}`);
}

function updateHazardCount(n) {
  document.getElementById("hazard-count").textContent =
    `${n} hazard${n === 1 ? "" : "s"} reported`;
}

async function loadHazards() {
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/hazards`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    hazardLayer.clearLayers();
    list.forEach(renderHazard);
    knownHazardCount = list.length;
    updateHazardCount(knownHazardCount);
  } catch (err) {
    toast("Backend unreachable");
    console.error("loadHazards failed", err);
  }
}

let knownHazardCount = 0;

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}

function getCurrentPosition(timeoutMs = 5000) {
  // Resolve to {lat, lng, source: "geo" | "map"}. Never rejects.
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const c = map.getCenter();
      resolve({ lat: c.lat, lng: c.lng, source: "map" });
      return;
    }
    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      const c = map.getCenter();
      resolve({ lat: c.lat, lng: c.lng, source: "map" });
    };
    const timer = setTimeout(fallback, timeoutMs);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, source: "geo" });
      },
      () => { clearTimeout(timer); fallback(); },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

async function reportHazard(type) {
  const fab = document.getElementById("fab");
  fab.disabled = true;
  try {
    const loc = await getCurrentPosition();
    if (loc.source === "map") toast("Using map center");

    const res = await fetch(`${window.API_BASE_URL}/api/hazards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: loc.lat, lng: loc.lng, type }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(err.error ?? `Report failed (${res.status})`);
      return;
    }
    const hz = await res.json();
    renderHazard(hz);
    knownHazardCount += 1;
    updateHazardCount(knownHazardCount);
    if (navigator.vibrate) navigator.vibrate(200);
    toast(`Reported ${hz.type}`);
  } catch (err) {
    toast("Backend unreachable");
    console.error("reportHazard failed", err);
  } finally {
    fab.disabled = false;
  }
}

// Type-picker modal: FAB opens it; tapping a type closes it and submits the report.
const typeModal = document.getElementById("type-modal");
function openTypeModal() { typeModal.hidden = false; }
function closeTypeModal() { typeModal.hidden = true; }

document.getElementById("fab").addEventListener("click", openTypeModal);
document.getElementById("type-modal-backdrop").addEventListener("click", closeTypeModal);
document.getElementById("type-modal-cancel").addEventListener("click", closeTypeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !typeModal.hidden) closeTypeModal();
});
document.querySelectorAll(".type-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.type;
    closeTypeModal();
    reportHazard(type);
  });
});

// --- Search + routing -------------------------------------------------------

async function nominatimSearch(q, limit = 1) {
  // Bias to the current map viewport so local landmarks rank first.
  const b = map.getBounds();
  const vb = `${b.getWest()},${b.getNorth()},${b.getEast()},${b.getSouth()}`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=${limit}` +
              `&viewbox=${vb}&bounded=0&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

async function geocode(q) {
  const arr = await nominatimSearch(q, 1);
  return arr[0] ?? null;
}

async function fetchRoute(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (res.status === 429) throw new Error("rate limited");
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("OSRM no route");
    return { coords: data.routes[0].geometry.coordinates, source: "live" };
  } catch (err) {
    console.warn("OSRM failed, using canned route:", err.message);
    const res = await fetch(CANNED_ROUTE_URL);
    if (!res.ok) throw new Error("no canned route available");
    const data = await res.json();
    if (!data.routes?.length) throw new Error("malformed canned route");
    return { coords: data.routes[0].geometry.coordinates, source: "canned" };
  }
}

function clearRoute() {
  if (routeLine) { routeLine.remove(); routeLine = null; }
  routeHazardLayer.clearLayers();
  const panel = document.getElementById("route-panel");
  panel.classList.remove("open");
  document.getElementById("route-list").innerHTML = "";
}

document.getElementById("route-panel-close").addEventListener("click", clearRoute);

function pulseIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div class="pulse-icon" style="background:${color}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

async function showHazardsAlongRoute(routeLatLng) {
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/route/hazards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ route: routeLatLng }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const hits = await res.json();
    routeHazardLayer.clearLayers();
    const list = document.getElementById("route-list");
    list.innerHTML = "";
    document.getElementById("route-panel-title").textContent =
      hits.length ? `${hits.length} hazard${hits.length === 1 ? "" : "s"} on route` : "No hazards on route";
    document.getElementById("route-panel").classList.add("open");

    hits.forEach((h) => {
      const color = TYPE_COLOR[h.hazard.type] ?? TYPE_COLOR.other;
      L.marker([h.hazard.lat, h.hazard.lng], { icon: pulseIcon(color) })
        .addTo(routeHazardLayer)
        .bindPopup(
          `<b>${h.hazard.type}</b><br>` +
          `${Math.round(h.distanceAlongRouteM)} m along route<br>` +
          `${Math.round(h.perpendicularDistanceM)} m off centreline`,
        );

      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "route-dot";
      dot.style.background = color;
      const label = document.createElement("span");
      label.textContent = h.hazard.type;
      label.style.textTransform = "capitalize";
      const meta = document.createElement("span");
      meta.className = "route-meta";
      meta.textContent = `${Math.round(h.distanceAlongRouteM)} m`;
      li.append(dot, label, meta);
      list.appendChild(li);
    });
  } catch (err) {
    console.error("route/hazards failed", err);
    toast("Couldn't analyse route");
  }
}

// Origin can be: a Nominatim hit (user picked / typed), or null (use geolocation).
let originPicked = null;
let originMarker = null;

async function resolveOrigin() {
  // Priority: explicit origin pick > free-text geocode > device geolocation > map center.
  if (originPicked) {
    return { lat: parseFloat(originPicked.lat), lng: parseFloat(originPicked.lon), source: "explicit" };
  }
  const text = document.getElementById("origin-input").value.trim();
  if (text) {
    try {
      const hit = await geocode(text);
      if (hit) {
        originPicked = hit;
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), source: "explicit" };
      }
    } catch { /* fall through */ }
    toast("Couldn't find origin, using current location");
  }
  return await getCurrentPosition(3000);
}

function paintOriginMarker(lat, lng, label) {
  if (originMarker) originMarker.remove();
  originMarker = L.circleMarker([lat, lng], {
    radius: 7, color: "#fff", weight: 2, fillColor: "#2e7d32", fillOpacity: 0.95,
  }).addTo(map).bindPopup(label);
}

async function routeToHit(destHit) {
  const destLat = parseFloat(destHit.lat), destLng = parseFloat(destHit.lon);

  if (destinationMarker) destinationMarker.remove();
  destinationMarker = L.marker([destLat, destLng]).addTo(map).bindPopup(destHit.display_name).openPopup();

  const origin = await resolveOrigin();
  paintOriginMarker(origin.lat, origin.lng, origin.source === "explicit" ? "Origin" : "Current location");

  let route;
  try {
    route = await fetchRoute(origin.lat, origin.lng, destLat, destLng);
  } catch (err) {
    map.setView([destLat, destLng], 15);
    toast("Routing unavailable");
    return;
  }
  if (route.source === "canned") toast("Using cached route");

  const latlng = route.coords.map(([lng, lat]) => [lat, lng]);
  if (routeLine) routeLine.remove();
  routeLine = L.polyline(latlng, { color: "#1976d2", weight: 5, opacity: 0.75 }).addTo(map);
  map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

  await showHazardsAlongRoute(latlng);
}

async function searchAndRoute(query) {
  const hit = await geocode(query);
  if (!hit) { toast("No results"); return; }
  await routeToHit(hit);
}

// --- Search bar + autocomplete suggestions ---------------------------------

function makeSuggester({ inputEl, listEl, onPick }) {
  let debounceTimer = null;
  let seq = 0;
  let activeIndex = -1;
  let lastResults = [];

  function setExpanded(expanded) {
    listEl.hidden = !expanded;
    inputEl.setAttribute("aria-expanded", expanded ? "true" : "false");
  }

  function clear() {
    lastResults = [];
    activeIndex = -1;
    listEl.innerHTML = "";
    setExpanded(false);
  }

  function render(results) {
    listEl.innerHTML = "";
    if (!results.length) {
      const empty = document.createElement("li");
      empty.className = "sugg-empty";
      empty.textContent = "No matches";
      listEl.appendChild(empty);
      setExpanded(true);
      return;
    }
    results.forEach((r, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      const parts = (r.display_name ?? "").split(", ");
      const primary = document.createElement("div");
      primary.className = "sugg-primary";
      primary.textContent = parts[0] ?? r.display_name;
      const secondary = document.createElement("div");
      secondary.className = "sugg-secondary";
      secondary.textContent = parts.slice(1).join(", ");
      li.append(primary);
      if (secondary.textContent) li.append(secondary);
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pick(i);
      });
      listEl.appendChild(li);
    });
    setExpanded(true);
  }

  function highlight(idx) {
    activeIndex = idx;
    [...listEl.children].forEach((el, i) => {
      el.setAttribute("aria-selected", i === idx ? "true" : "false");
    });
  }

  function pick(idx) {
    const hit = lastResults[idx];
    if (!hit) return;
    inputEl.value = hit.display_name;
    clear();
    onPick(hit);
  }

  inputEl.addEventListener("input", () => {
    const q = inputEl.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < 3) { clear(); return; }
    const mySeq = ++seq;
    debounceTimer = setTimeout(async () => {
      try {
        const results = await nominatimSearch(q, 5);
        if (mySeq !== seq) return;
        lastResults = results;
        render(results);
      } catch (err) {
        console.warn("suggestions failed", err);
      }
    }, 350);
  });

  inputEl.addEventListener("focus", () => {
    if (lastResults.length) setExpanded(true);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (listEl.hidden || !lastResults.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlight(Math.min(activeIndex + 1, lastResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlight(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      pick(activeIndex);
    } else if (e.key === "Escape") {
      clear();
    }
  });

  return { clear, isInside: (target) => target === inputEl || listEl.contains(target) };
}

const originInput = document.getElementById("origin-input");
const originClear = document.getElementById("origin-clear");
const searchInput = document.getElementById("search-input");

const originSugg = makeSuggester({
  inputEl: originInput,
  listEl: document.getElementById("origin-suggestions"),
  onPick: (hit) => {
    originPicked = hit;
    originClear.hidden = false;
  },
});

const destSugg = makeSuggester({
  inputEl: searchInput,
  listEl: document.getElementById("search-suggestions"),
  onPick: (hit) => {
    routeToHit(hit).catch((err) => { toast("Search failed"); console.error(err); });
  },
});

// Typing in origin invalidates a previously picked suggestion (so free text gets re-geocoded).
originInput.addEventListener("input", () => {
  originPicked = null;
  originClear.hidden = !originInput.value.trim();
});

originClear.addEventListener("click", () => {
  originInput.value = "";
  originPicked = null;
  originClear.hidden = true;
  originSugg.clear();
  originInput.focus();
});

document.addEventListener("click", (e) => {
  if (!originSugg.isInside(e.target)) originSugg.clear();
  if (!destSugg.isInside(e.target)) destSugg.clear();
});

document.getElementById("search-bar").addEventListener("submit", async (e) => {
  e.preventDefault();
  originSugg.clear();
  destSugg.clear();
  const q = searchInput.value.trim();
  if (!q) { toast("Enter a destination"); return; }
  try {
    await searchAndRoute(q);
  } catch (err) {
    toast("Search failed");
    console.error(err);
  }
});

loadHazards();
