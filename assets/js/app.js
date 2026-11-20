"use strict";

/* SHEIKH WEATHER — application logic. No secrets are used; all data endpoints are public. */

const $ = (id) => document.getElementById(id);
const API = {
  geo: "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  air: "https://air-quality-api.open-meteo.com/v1/air-quality",
  radar: "https://api.rainviewer.com/public/weather-maps.json",
};
const RADAR_HOST = "https://tilecache.rainviewer.com";
const state = {
  lat: 23.8103,
  lon: 90.4125,
  city: "Dhaka",
  country: "Bangladesh",
  unit: "celsius",
  weather: null,
  requestId: 0,
  controller: null,
  map: null,
  radarLayer: null,
  installPrompt: null,
  modalReturn: null,
  sceneRender: null,
  themeMode: "auto",
};
const codes = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Dense drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Freezing drizzle", "🌧️"],
  61: ["Slight rain", "🌦️"],
  63: ["Moderate rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Slight snow", "🌨️"],
  73: ["Moderate snow", "🌨️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Violent rain showers", "⛈️"],
  85: ["Snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm with hail", "⛈️"],
  99: ["Thunderstorm with hail", "⛈️"],
};
const condition = (code) => codes[code] || ["Weather conditions", "🌡️"];
const text = (id, value) => {
  const el = $(id);
  if (el) el.textContent = String(value ?? "—");
};
function applyTheme(mode) {
  state.themeMode = mode;
  const effective =
    mode === "auto" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.body.classList.toggle("light", effective === "light");
  document.documentElement.style.colorScheme = effective;
  const labels = { auto: "◐ Auto", light: "☼ Light", dark: "☾ Dark" };
  text("themeBtn", labels[mode]);
  $("themeBtn").setAttribute("aria-label", `Theme mode: ${mode}. Click to change.`);
  $("themeBtn").title = `Theme: ${mode}`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = effective === "light" ? "#eef4fb" : "#0b1730";
}
const themeStorageKey = "saad-theme-mode";
let savedTheme = null;
try {
  const storedTheme = localStorage.getItem(themeStorageKey);
  if (storedTheme === "light" || storedTheme === "dark") savedTheme = storedTheme;
} catch (error) {
  console.warn("Theme preference storage is unavailable.", error);
}
applyTheme(savedTheme || "auto");
const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
if (colorSchemeQuery.addEventListener)
  colorSchemeQuery.addEventListener("change", () => {
    if (state.themeMode === "auto") applyTheme("auto");
  });
else if (colorSchemeQuery.addListener)
  colorSchemeQuery.addListener(() => {
    if (state.themeMode === "auto") applyTheme("auto");
  });
const temp = (v) =>
  typeof v === "number" && Number.isFinite(v) ? `${Math.round(v)}${state.unit === "celsius" ? "°C" : "°F"}` : "—";
// Coordinates are rounded (~1 km) before being sent to third-party APIs to limit location precision.
const roundCoord = (n) => String(Math.round(n * 100) / 100);
const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const compass = (deg) => COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
// Index of the hourly slot that contains the current time (hourly slots are "YYYY-MM-DDTHH:00").
function currentHourIndex(d) {
  const slot = `${String(d.current.time || "").slice(0, 13)}:00`;
  const i = d.hourly.time.findIndex((t) => String(t) >= slot);
  return i < 0 ? 0 : i;
}
const time = (v) => {
  const parts = String(v || "").match(/T(\d{2}):(\d{2})/);
  return parts
    ? new Date(Date.UTC(2000, 0, 1, Number(parts[1]), Number(parts[2]))).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "—";
};
const day = (v) =>
  v ? new Date(`${v}T12:00:00Z`).toLocaleDateString([], { weekday: "short", timeZone: "UTC" }) : "—";
function status(message, error = false) {
  text("status", message);
  $("status").classList.toggle("error", error);
}
function safeNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
function validateForecast(d) {
  return !!(
    d &&
    d.current &&
    d.daily &&
    d.hourly &&
    Array.isArray(d.daily.time) &&
    Array.isArray(d.hourly.time) &&
    safeNumber(d.current.temperature_2m) &&
    d.daily.time.length &&
    d.hourly.time.length
  );
}
async function fetchJSON(url, { signal, timeout = 12000 } = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeout);
  if (signal) {
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  }
  try {
    const r = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`Service returned ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abort);
  }
}
async function searchCity(raw) {
  const name = String(raw || "")
    .trim()
    .replace(/\s+/g, " ");
  if (!name) {
    status("Enter a city name to search.", true);
    return;
  }
  if (name.length > 80) {
    status("City name must be 80 characters or fewer.", true);
    return;
  }
  const id = ++state.requestId;
  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  status("Searching for location…");
  $("searchBtn").disabled = true;
  try {
    const url = new URL(API.geo);
    url.search = new URLSearchParams({ name, count: "1", language: "en", format: "json" });
    const d = await fetchJSON(url, { signal: state.controller.signal });
    if (id !== state.requestId) return;
    if (!Array.isArray(d.results) || !d.results.length)
      throw new Error("City not found. Try another spelling.");
    const p = d.results[0];
    if (!safeNumber(p.latitude) || !safeNumber(p.longitude))
      throw new Error("Location service returned invalid coordinates.");
    state.lat = p.latitude;
    state.lon = p.longitude;
    state.city = p.name;
    state.country = p.country || "";
    await loadWeather();
  } catch (e) {
    if (e.name !== "AbortError") status(e.message || "Unable to search location.", true);
  } finally {
    $("searchBtn").disabled = false;
  }
}
async function loadWeather() {
  const id = ++state.requestId;
  if (state.controller) state.controller.abort();
  const controller = new AbortController();
  state.controller = controller;
  $("app").classList.add("loading");
  status("Loading live weather…");
  const params = new URLSearchParams({
    latitude: roundCoord(state.lat),
    longitude: roundCoord(state.lon),
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,visibility,uv_index",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
    temperature_unit: state.unit,
    wind_speed_unit: "kmh",
    timezone: "auto",
    forecast_days: "7",
  });
  try {
    const d = await fetchJSON(`${API.forecast}?${params}`, { signal: controller.signal });
    if (id !== state.requestId) return;
    if (!validateForecast(d)) throw new Error("Weather service returned incomplete data. Please retry.");
    state.weather = d;
    renderWeather(d);
    loadAlerts(d);
    updateMap();
    const aq = new URLSearchParams({
      latitude: roundCoord(state.lat),
      longitude: roundCoord(state.lon),
      current: "european_aqi,pm2_5,pm10",
      timezone: "auto",
    });
    fetchJSON(`${API.air}?${aq}`, { signal: controller.signal })
      .then((data) => {
        if (id === state.requestId) renderAir(data);
      })
      .catch(() => {
        if (id === state.requestId) renderAir(null);
      });
    status(`Updated ${time(d.current.time)} · ${d.timezone || "location local time"}`);
  } catch (e) {
    if (e.name !== "AbortError")
      status(e.message || "Could not load weather. Check your connection and retry.", true);
  } finally {
    if (id === state.requestId) $("app").classList.remove("loading");
  }
}
function renderWeather(d) {
  const c = d.current,
    di = d.daily;
  const cond = condition(c.weather_code);
  text("place", `${state.city}${state.country ? ", " + state.country : ""}`);
  text("temp", temp(c.temperature_2m));
  text("condition", cond[0]);
  text("feels", temp(c.apparent_temperature));
  text("highlow", `H: ${temp(di.temperature_2m_max[0])}   L: ${temp(di.temperature_2m_min[0])}`);
  text("humidity", `${c.relative_humidity_2m ?? "—"}%`);
  text("wind", `${Math.round(c.wind_speed_10m ?? 0)} km/h`);
  text(
    "winddir",
    safeNumber(c.wind_direction_10m)
      ? `From ${compass(c.wind_direction_10m)} (${Math.round(c.wind_direction_10m)}°)`
      : "Direction unavailable",
  );
  const uv = safeNumber(c.uv_index) ? c.uv_index : null;
  text("uv", uv === null ? "—" : uv.toFixed(1));
  text(
    "uvlabel",
    uv === null
      ? "Current UV unavailable"
      : uv < 3
        ? "Low"
        : uv < 6
          ? "Moderate"
          : uv < 8
            ? "High"
            : uv < 11
              ? "Very high"
              : "Extreme",
  );
  text("visibility", safeNumber(c.visibility) ? `${(c.visibility / 1000).toFixed(1)} km` : "—");
  text("pressure", safeNumber(c.pressure_msl) ? `${Math.round(c.pressure_msl)} hPa` : "—");
  text("rain", `${c.precipitation ?? "—"} mm`);
  text("cloud", `${c.cloud_cover ?? "—"}%`);
  text("sun", `${time(di.sunrise?.[0])} / ${time(di.sunset?.[0])}`);
  state.sceneRender?.();
  const hourly = $("hourly");
  hourly.replaceChildren();
  const start = currentHourIndex(d);
  for (let i = start; i < Math.min(start + 24, d.hourly.time.length); i++) {
    const el = document.createElement("div");
    el.className = "hour";
    const t = document.createElement("small");
    t.textContent = i === start ? "Now" : time(d.hourly.time[i]);
    const ic = document.createElement("div");
    ic.className = "hicon";
    ic.textContent = condition(d.hourly.weather_code?.[i])[1];
    const v = document.createElement("div");
    v.className = "ht";
    v.textContent = temp(d.hourly.temperature_2m?.[i]);
    const rain = document.createElement("small");
    rain.textContent = `${d.hourly.precipitation_probability?.[i] ?? "—"}% rain`;
    el.append(t, ic, v, rain);
    hourly.append(el);
  }
  const days = $("days");
  days.replaceChildren();
  const mins = di.temperature_2m_min || [],
    maxs = di.temperature_2m_max || [];
  for (let i = 0; i < Math.min(7, di.time.length); i++) {
    const row = document.createElement("div");
    row.className = "day";
    const nm = document.createElement("div");
    nm.className = "dayname";
    nm.textContent = i === 0 ? "Today" : day(di.time[i]);
    const ic = document.createElement("div");
    ic.className = "daydesc";
    ic.textContent = `${condition(di.weather_code?.[i])[1]} ${condition(di.weather_code?.[i])[0]}`;
    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("i");
    const min = Math.min(...mins),
      max = Math.max(...maxs);
    fill.style.width = `${Math.max(12, ((maxs[i] - min) / (max - min || 1)) * 100)}%`;
    bar.append(fill);
    const temps = document.createElement("div");
    temps.className = "daytemps";
    temps.textContent = `${temp(maxs[i])} / ${temp(mins[i])}`;
    row.append(nm, ic, bar, temps);
    days.append(row);
  }
}
function initWeatherScene() {
  const canvas = $("weather3d");
  if (!canvas || state.sceneStarted) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  state.sceneStarted = true;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const drops = Array.from({ length: 46 }, (_, i) => ({
    x: (i * 67) % 1000,
    y: (i * 113) % 900,
    length: 9 + (i % 5) * 3,
    speed: 150 + (i % 8) * 34,
  }));
  let previousMode = "";
  function drawCloud(x, y, scale, tone) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = "rgba(20,40,75,.22)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 9;
    const g = ctx.createLinearGradient(0, -54, 0, 35);
    g.addColorStop(0, tone === "storm" ? "#e4edf7" : tone === "rain" ? "#edf3fa" : "#ffffff");
    g.addColorStop(0.45, tone === "storm" ? "#9fb1c5" : tone === "rain" ? "#b8c8d8" : "#eef7ff");
    g.addColorStop(1, tone === "storm" ? "#526a87" : tone === "rain" ? "#788da5" : "#b8d5ec");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-92, 22);
    ctx.bezierCurveTo(-112, 20, -117, -8, -101, -22);
    ctx.bezierCurveTo(-91, -33, -74, -33, -63, -25);
    ctx.bezierCurveTo(-58, -57, -20, -70, 5, -48);
    ctx.bezierCurveTo(22, -68, 58, -57, 62, -29);
    ctx.bezierCurveTo(92, -33, 110, -12, 104, 10);
    ctx.bezierCurveTo(101, 26, 87, 34, 68, 34);
    ctx.lineTo(-76, 34);
    ctx.bezierCurveTo(-87, 34, -93, 29, -92, 22);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-79, 1);
    ctx.bezierCurveTo(-75, -16, -62, -21, -48, -18);
    ctx.bezierCurveTo(-37, -48, -9, -53, 8, -34);
    ctx.stroke();
    ctx.restore();
  }
  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width,
      h = rect.height,
      t = reduceMotion ? 0 : performance.now() / 1000;
    ctx.clearRect(0, 0, w, h);
    const current = state.weather?.current || {};
    const code = current.weather_code;
    const rainy = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
    const snowy = [71, 73, 75, 77, 85, 86].includes(code);
    const storm = [95, 96, 99, 65, 67, 82].includes(code);
    const foggy = [45, 48].includes(code);
    const cloudy = [
      2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99,
    ].includes(code);
    const showSun = [0, 1, 2].includes(code);
    const night = current.is_day === 0;
    const mode = `${rainy}-${snowy}-${cloudy}-${night}`;
    if (mode !== previousMode) {
      canvas.setAttribute(
        "aria-label",
        rainy
          ? "Animated 3D-style clouds and falling rain"
          : snowy
            ? "Animated 3D-style clouds and falling snow"
            : cloudy
              ? "Animated 3D-style cloudy weather scene"
              : "Animated 3D-style sunny weather scene",
      );
      previousMode = mode;
    }
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, night ? "#101b3b" : storm ? "#607c9d" : cloudy ? "#80b7dc" : "#36b8f2");
    sky.addColorStop(0.62, night ? "#263c68" : storm ? "#9db4ca" : cloudy ? "#c5e1f3" : "#b9eaff");
    sky.addColorStop(1, night ? "#53668a" : "#e5f7ff");
    ctx.fillStyle = sky;
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.fill();
    const horizon = ctx.createLinearGradient(0, h * 0.64, 0, h);
    horizon.addColorStop(0, "rgba(255,255,255,.02)");
    horizon.addColorStop(1, night ? "rgba(12,29,60,.46)" : "rgba(255,255,255,.48)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);
    if (!night) {
      const sx = w * 0.72,
        sy = h * 0.25,
        sr = Math.min(w, h) * 0.105;
      if (showSun) {
        const halo = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 3.4);
        halo.addColorStop(0, cloudy ? "rgba(255,232,169,.46)" : "rgba(255,244,181,.83)");
        halo.addColorStop(1, "rgba(255,245,200,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, w, h);
        const sun = ctx.createRadialGradient(sx - sr * 0.25, sy - sr * 0.3, sr * 0.08, sx, sy, sr);
        sun.addColorStop(0, "#fffde5");
        sun.addColorStop(0.62, "#ffe99a");
        sun.addColorStop(1, "#ffc85c");
        ctx.fillStyle = sun;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#f8fbff";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#d6e7ff";
      ctx.beginPath();
      ctx.arc(w * 0.73, h * 0.25, Math.min(w, h) * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    const compact = w < 560;
    if (!cloudy) {
      const cloudCount = compact ? 3 : 5;
      for (let i = 0; i < cloudCount; i++) {
        const x = compact ? w * 0.58 + ((i * 73 + t * 5) % (w * 0.5)) : ((i * 91 + t * 7) % (w + 180)) - 90,
          y = h * (compact ? 0.18 + i * 0.055 : 0.2 + i * 0.075),
          s = compact ? 0.28 + i * 0.035 : 0.37 + i * 0.08;
        ctx.globalAlpha = 0.32;
        drawCloud(x, y, s, "soft");
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = compact ? 0.38 : 0.48;
      drawCloud(compact ? w * 0.83 : w * 0.28, compact ? h * 0.3 : h * 0.33, compact ? 0.4 : 0.67, "soft");
      ctx.globalAlpha = 1;
    }
    if (cloudy) {
      const cloudScale = Math.min(w / 310, h / 220) * (compact ? 0.74 : 1);
      drawCloud(
        w * (compact ? 0.82 : 0.7),
        h * (compact ? 0.6 : 0.53),
        cloudScale * (storm ? 1.12 : 1),
        storm ? "storm" : rainy ? "rain" : "soft",
      );
      if (rainy || snowy) {
        const rainTop = h * (compact ? 0.6 : 0.53);
        const rainLeft = compact ? w * 0.5 : 0;
        const rainWidth = w - rainLeft;
        ctx.save();
        ctx.beginPath();
        ctx.rect(rainLeft, rainTop, rainWidth, h - rainTop);
        ctx.clip();
        for (let i = 0; i < drops.length; i++) {
          if (compact && i % 2) continue;
          const p = drops[i];
          const x =
            rainLeft + (((p.x / 1000) * rainWidth + Math.sin(t * 1.4 + i) * 7 + rainWidth) % rainWidth);
          const y = rainTop + (((p.y / 900) * (h - rainTop) + t * p.speed) % (h - rainTop));
          if (snowy) {
            ctx.fillStyle = "rgba(255,255,255,.95)";
            ctx.beginPath();
            ctx.arc(x, y, compact ? 3 + (i % 3) * 0.8 : 2 + (i % 3) * 0.65, 0, Math.PI * 2);
            ctx.fill();
          } else {
            const rg = ctx.createLinearGradient(x, y, x - 5, y + p.length);
            rg.addColorStop(0, "rgba(210,240,255,.25)");
            rg.addColorStop(1, "rgba(218,245,255,1)");
            ctx.strokeStyle = rg;
            ctx.lineWidth = compact ? (i % 4 === 0 ? 2.2 : 1.4) : i % 4 === 0 ? 1.6 : 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 5, y + p.length);
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    if (foggy) {
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.16 + i * 0.035})`;
        ctx.beginPath();
        ctx.ellipse(
          compact ? w * 0.78 : w * 0.5,
          h * (0.58 + i * 0.105),
          compact ? w * 0.24 : w * 0.48,
          h * 0.035,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
  }
  // One animation loop only: weather updates are picked up on the next frame instead of starting a new loop.
  function loop() {
    draw();
    if (!reduceMotion) requestAnimationFrame(loop);
  }
  state.sceneRender = reduceMotion ? draw : null;
  loop();
}
function renderAir(d) {
  if (!d?.current || !safeNumber(d.current.european_aqi)) {
    text("aqi", "—");
    text("aqitag", "Unavailable");
    $("aqitag").className = "aqitag";
    text("aqinote", "Air quality data is not available right now.");
    return;
  }
  const n = Math.round(d.current.european_aqi);
  text("aqi", n);
  const levels = [
    [20, "Good", "aqi-good"],
    [40, "Fair", "aqi-fair"],
    [60, "Moderate", "aqi-moderate"],
    [80, "Poor", "aqi-poor"],
    [100, "Very poor", "aqi-vpoor"],
    [Infinity, "Extremely poor", "aqi-xpoor"],
  ];
  const [, label, cls] = levels.find(([max]) => n <= max);
  text("aqitag", label);
  $("aqitag").className = `aqitag ${cls}`;
  text("aqinote", `PM2.5: ${d.current.pm2_5 ?? "—"} · PM10: ${d.current.pm10 ?? "—"} μg/m³ · European AQI`);
}
function loadAlerts(d) {
  const list = $("alerts");
  list.replaceChildren();
  let alerts = [];
  const current = d.current;
  const offset = currentHourIndex(d);
  const next = (d.hourly.weather_code || []).slice(offset, offset + 24);
  const rain = (d.hourly.precipitation_probability || []).slice(offset, offset + 24);
  if (next.some((v) => [95, 96, 99].includes(v)))
    alerts.push([
      "danger",
      "Thunderstorm signal in forecast",
      "A thunderstorm code appears in the next 24 hours. Check official local warnings and shelter guidance.",
    ]);
  if (rain.some((v) => v >= 70))
    alerts.push([
      "warning",
      "High rain probability",
      "At least one upcoming hour has a 70% or higher precipitation probability.",
    ]);
  if ([65, 82, 86].includes(current.weather_code))
    alerts.push([
      "warning",
      "Severe current weather code",
      `${condition(current.weather_code)[0]} is currently reported by the forecast provider.`,
    ]);
  if (safeNumber(current.wind_speed_10m) && current.wind_speed_10m >= 50)
    alerts.push([
      "danger",
      "Strong wind indicator",
      `Current modelled wind speed is ${Math.round(current.wind_speed_10m)} km/h.`,
    ]);
  if (!alerts.length)
    alerts.push([
      "",
      "No major automated signals",
      "No configured high-risk signals were detected in the current conditions and next 24-hour forecast. This is not a guarantee of safe weather.",
    ]);
  for (const [level, title, desc] of alerts) {
    const el = document.createElement("div");
    el.className = `alert-item ${level}`.trim();
    const strong = document.createElement("strong");
    strong.textContent = title;
    const p = document.createElement("p");
    p.textContent = desc;
    el.append(strong, p);
    list.append(el);
  }
  text("alertStatus", "Forecast-based checks complete");
}
function initMap() {
  if (!window.L || state.map) return;
  if (!$("radarMap")) return;
  state.map = L.map("radarMap", { zoomControl: true, scrollWheelZoom: false }).setView(
    [state.lat, state.lon],
    7,
  );
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(state.map);
  L.control.scale({ imperial: false }).addTo(state.map);
  updateMap();
}
async function updateMap() {
  if (!window.L) return;
  initMap();
  if (!state.map) return;
  state.map.setView([state.lat, state.lon], 7);
  try {
    const data = await fetchJSON(API.radar, { timeout: 10000 });
    // Use the newest *observed* frame; nowcast frames are predictions and must not be shown as "latest".
    const past = Array.isArray(data.radar?.past) ? data.radar.past : [];
    const nowcast = Array.isArray(data.radar?.nowcast) ? data.radar.nowcast : [];
    const frame = past.length ? past[past.length - 1] : nowcast[0];
    if (!frame) throw new Error("No radar frames currently available.");
    // Never build tile URLs from unvalidated provider data.
    if (typeof frame.path !== "string" || !/^\/v\d+\/radar\/\d+$/.test(frame.path) || !safeNumber(frame.time))
      throw new Error("Radar service returned an unexpected frame.");
    const host = data.host === RADAR_HOST ? data.host : RADAR_HOST;
    if (state.radarLayer) state.map.removeLayer(state.radarLayer);
    state.radarLayer = L.tileLayer(`${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, {
      tileSize: 256,
      opacity: 0.65,
      attribution: "Radar &copy; RainViewer",
      maxNativeZoom: 7,
      maxZoom: 12,
    });
    state.radarLayer.addTo(state.map);
    text(
      "radarNote",
      `Latest observed radar frame: ${new Date(frame.time * 1000).toLocaleString()}. RainViewer coverage and update frequency vary by region.`,
    );
  } catch (e) {
    if (e.name !== "AbortError") text("radarNote", `Radar unavailable: ${e.message}. Base map remains available.`);
  }
}
function openModal(key, trigger) {
  const tpl = $(`tpl-${key}`);
  if (!tpl) return;
  $("modalContent").replaceChildren(tpl.content.cloneNode(true));
  state.modalReturn = trigger;
  $("modal").classList.add("open");
  $("modal").setAttribute("aria-hidden", "false");
  $("closeModal").focus();
}
function closeModal() {
  $("modal").classList.remove("open");
  $("modal").setAttribute("aria-hidden", "true");
  if (state.modalReturn?.focus) state.modalReturn.focus();
}
function trapFocus(e) {
  if (!$("modal").classList.contains("open") || e.key !== "Tab") return;
  const els = [...$("modal").querySelectorAll('button,a[href],input,[tabindex]:not([tabindex="-1"])')].filter(
    (x) => !x.disabled,
  );
  if (!els.length) return;
  const first = els[0],
    last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
$("searchBtn").addEventListener("click", () => searchCity($("cityInput").value));
$("cityInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchCity($("cityInput").value);
});
$("locBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    status("Geolocation is not supported by this browser.", true);
    return;
  }
  const id = ++state.requestId;
  if (state.controller) state.controller.abort();
  $("app").classList.remove("loading");
  status("Requesting location permission…");
  navigator.geolocation.getCurrentPosition(
    async (p) => {
      if (id !== state.requestId) return;
      if (!safeNumber(p.coords.latitude) || !safeNumber(p.coords.longitude)) {
        status("Location returned invalid coordinates.", true);
        return;
      }
      state.lat = p.coords.latitude;
      state.lon = p.coords.longitude;
      state.city = "Your location";
      state.country = "";
      await loadWeather();
    },
    () => {
      if (id === state.requestId)
        status("Location permission was denied or unavailable. Search for a city instead.", true);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
});
$("unitBtn").addEventListener("click", () => {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  text("unitBtn", state.unit === "celsius" ? "°C" : "°F");
  if (state.weather) loadWeather();
});
$("themeBtn").addEventListener("click", () => {
  const modes = ["auto", "light", "dark"];
  const next = modes[(modes.indexOf(state.themeMode) + 1) % modes.length];
  applyTheme(next);
  try {
    if (next === "auto") localStorage.removeItem(themeStorageKey);
    else localStorage.setItem(themeStorageKey, next);
  } catch (error) {
    console.warn("Could not save theme preference.", error);
  }
});
document
  .querySelectorAll("[data-modal]")
  .forEach((b) => b.addEventListener("click", () => openModal(b.dataset.modal, b)));
$("closeModal").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("modal").classList.contains("open")) closeModal();
  trapFocus(e);
});
$("radarRefresh").addEventListener("click", updateMap);
$("radarCenter").addEventListener("click", () => {
  if (state.map) state.map.setView([state.lat, state.lon], 7);
});
$("refreshBtn").addEventListener("click", () => loadWeather());
window.addEventListener("online", () => {
  $("offlineBanner").classList.remove("show");
  status("Connection restored. Refreshing weather…");
  loadWeather();
});
window.addEventListener("offline", () => {
  $("offlineBanner").classList.add("show");
  status("You are offline. Live weather is unavailable.", true);
});
if (!navigator.onLine) $("offlineBanner").classList.add("show");
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPrompt = e;
  $("installBtn").classList.add("visible");
});
$("installBtn").addEventListener("click", async () => {
  if (!state.installPrompt) return;
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  $("installBtn").classList.remove("visible");
});
window.addEventListener("appinstalled", () => {
  $("installBtn").classList.remove("visible");
});
text("year", new Date().getFullYear());
loadWeather();
if ("serviceWorker" in navigator && location.protocol !== "file:")
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./service-worker.js").catch(() => {}),
  );
initWeatherScene();
function updateLiveClock() {
  const timezone = state.weather?.timezone;
  const options = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
  if (timezone) options.timeZone = timezone;
  text("liveClock", `Live local time · ${new Date().toLocaleTimeString([], options)}`);
}
updateLiveClock();
setInterval(updateLiveClock, 1000);
