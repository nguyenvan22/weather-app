/**
 * Weather App (OpenWeather)
 * - Current weather: /data/2.5/weather
 * - Forecast (3-hour): /data/2.5/forecast
 *
 */

const OPEN_WEATHER_API_KEY = "6f61b7a1c43fa01e229e13030d5813f8";

const els = {
  form: document.getElementById("searchForm"),
  input: document.getElementById("cityInput"),
  geoBtn: document.getElementById("geoBtn"),
  unitBtn: document.getElementById("unitBtn"),

  toast: document.getElementById("toast"),

  place: document.getElementById("place"),
  localTime: document.getElementById("localTime"),
  condition: document.getElementById("condition"),

  tempValue: document.getElementById("tempValue"),
  tempUnit: document.getElementById("tempUnit"),
  icon: document.getElementById("icon"),

  feels: document.getElementById("feels"),
  humidity: document.getElementById("humidity"),
  wind: document.getElementById("wind"),

  high: document.getElementById("high"),
  low: document.getElementById("low"),
  clouds: document.getElementById("clouds"),

  friendlyTip: document.getElementById("friendlyTip"),
  forecastGrid: document.getElementById("forecastGrid"),
};

const state = {
  unit: "metric", // "metric" => °C, "imperial" => °F
  lastQuery: null, // { type: "city", value: "New York" } or { type:"coords", value:{lat,lon} }
};

function assertKey() {
  if (!OPEN_WEATHER_API_KEY || OPEN_WEATHER_API_KEY.includes("PASTE_YOUR")) {
    toast("Add your OpenWeather API key in app.js to start.", "warn");
    return false;
  }
  return true;
}

function toast(msg) {
  els.toast.textContent = msg;
}

function setUnit(unit) {
  state.unit = unit;
  const isMetric = unit === "metric";
  els.unitBtn.textContent = isMetric ? "°C" : "°F";
  els.unitBtn.setAttribute("aria-pressed", String(!isMetric));
  els.tempUnit.textContent = isMetric ? "°C" : "°F";
}

function formatTemp(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return Math.round(n).toString();
}

function formatWind(speed) {
  if (typeof speed !== "number" || Number.isNaN(speed)) return "—";
  // OpenWeather: m/s for metric, miles/hour for imperial
  return state.unit === "metric" ? `${Math.round(speed)} m/s` : `${Math.round(speed)} mph`;
}

function iconUrl(iconCode) {
  // Use @2x icons for better clarity
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

function niceCondition(weatherArr) {
  const main = weatherArr?.[0]?.main ?? "";
  const desc = weatherArr?.[0]?.description ?? "";
  // Capitalize first letter
  const prettyDesc = desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : "";
  return prettyDesc || main || "—";
}

function friendlyTipFrom(data) {
  const main = data?.weather?.[0]?.main || "";
  const temp = data?.main?.temp;

  if (main === "Rain") return "Rainy day: a hoodie + umbrella = unbeatable combo ☔️";
  if (main === "Snow") return "Snow vibes: warm layers and safe steps ❄️";
  if (main === "Thunderstorm") return "Stormy outside—stay indoors if you can ⚡️";
  if (main === "Clear") return "Clear skies! Perfect time for a quick walk 🌤️";
  if (main === "Clouds") return "Cloudy but comfy—still a good day to move a bit ☁️";
  if (typeof temp === "number") {
    if (state.unit === "metric") {
      if (temp >= 30) return "Hot out there—hydrate and take shade breaks 🧃";
      if (temp <= 5) return "Chilly! Layer up and keep your hands warm 🧤";
    } else {
      if (temp >= 86) return "Hot out there—hydrate and take shade breaks 🧃";
      if (temp <= 41) return "Chilly! Layer up and keep your hands warm 🧤";
    }
  }
  return "Tip: try searching a city like “Boston” or “Los Angeles” 🙂";
}

function localTimeString(timezoneOffsetSeconds) {
  // timezoneOffsetSeconds is seconds from UTC
  // We'll build a display time based on user's current UTC time + offset.
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const localMs = utcMs + timezoneOffsetSeconds * 1000;
  const d = new Date(localMs);

  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const month = d.toLocaleString(undefined, { month: "short" });
  const day = d.getDate();
  return `${month} ${day} • ${hh}:${mm}`;
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.message) msg = err.message;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function buildWeatherUrlByCity(city) {
  const q = encodeURIComponent(city.trim());
  return `https://api.openweathermap.org/data/2.5/weather?q=${q}&appid=${OPEN_WEATHER_API_KEY}&units=${state.unit}`;
}

function buildForecastUrlByCity(city) {
  const q = encodeURIComponent(city.trim());
  return `https://api.openweathermap.org/data/2.5/forecast?q=${q}&appid=${OPEN_WEATHER_API_KEY}&units=${state.unit}`;
}

function buildWeatherUrlByCoords(lat, lon) {
  return `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_API_KEY}&units=${state.unit}`;
}

function buildForecastUrlByCoords(lat, lon) {
  return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_API_KEY}&units=${state.unit}`;
}

function clearForecast() {
  els.forecastGrid.innerHTML = "";
}

function renderForecast(list, timezoneOffsetSeconds) {
  // list is 3-hour steps, show next ~6 items (~18 hours)
  clearForecast();
  const take = list.slice(0, 6);

  for (const item of take) {
    const icon = item?.weather?.[0]?.icon;
    const temp = item?.main?.temp;
    const desc = item?.weather?.[0]?.description ?? "";

    // item.dt is UTC seconds. Add city timezone offset to get local time.
    const utcMs = item.dt * 1000;
    const localMs = utcMs + timezoneOffsetSeconds * 1000;
    const d = new Date(localMs);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");

    const div = document.createElement("div");
    div.className = "forecastItem";
    div.innerHTML = `
      <div class="t">${hh}:${mm}</div>
      <div class="v">${formatTemp(temp)}${state.unit === "metric" ? "°C" : "°F"}</div>
      <div class="d">
        <img alt="" src="${icon ? iconUrl(icon) : ""}" />
        <span>${desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : "—"}</span>
      </div>
    `;
    els.forecastGrid.appendChild(div);
  }
}

function renderCurrent(data) {
  const name = data?.name ?? "—";
  const country = data?.sys?.country ?? "";
  const tz = data?.timezone ?? 0;

  els.place.textContent = country ? `${name}, ${country}` : name;
  els.localTime.textContent = localTimeString(tz);
  els.condition.textContent = niceCondition(data?.weather);

  const temp = data?.main?.temp;
  const feels = data?.main?.feels_like;
  const hum = data?.main?.humidity;
  const wind = data?.wind?.speed;
  const clouds = data?.clouds?.all;

  els.tempValue.textContent = formatTemp(temp);
  els.feels.textContent = feels == null ? "—" : `${formatTemp(feels)}${state.unit === "metric" ? "°C" : "°F"}`;
  els.humidity.textContent = hum == null ? "—" : `${Math.round(hum)}%`;
  els.wind.textContent = formatWind(wind);

  els.clouds.textContent = clouds == null ? "—" : `${Math.round(clouds)}%`;

  // High / Low (current endpoint has min/max sometimes)
  const hi = data?.main?.temp_max;
  const lo = data?.main?.temp_min;
  els.high.textContent = hi == null ? "—" : `${formatTemp(hi)}${state.unit === "metric" ? "°C" : "°F"}`;
  els.low.textContent = lo == null ? "—" : `${formatTemp(lo)}${state.unit === "metric" ? "°C" : "°F"}`;

  const iconCode = data?.weather?.[0]?.icon;
  if (iconCode) {
    els.icon.src = iconUrl(iconCode);
    els.icon.style.display = "block";
  } else {
    els.icon.removeAttribute("src");
    els.icon.style.display = "none";
  }

  els.friendlyTip.textContent = friendlyTipFrom(data);
}

async function loadByCity(city) {
  if (!assertKey()) return;
  const clean = city.trim();
  if (!clean) {
    toast("Type a city name first 🙂");
    return;
  }

  toast("Fetching weather…");
  state.lastQuery = { type: "city", value: clean };

  try {
    const [current, forecast] = await Promise.all([
      fetchJson(buildWeatherUrlByCity(clean)),
      fetchJson(buildForecastUrlByCity(clean)),
    ]);

    renderCurrent(current);

    const tz = forecast?.city?.timezone ?? current?.timezone ?? 0;
    renderForecast(forecast?.list ?? [], tz);

    toast(`Updated for ${current?.name ?? clean}.`);
  } catch (e) {
    toast(`Couldn’t load: ${e.message}`);
  }
}

async function loadByCoords(lat, lon) {
  if (!assertKey()) return;

  toast("Finding your weather…");
  state.lastQuery = { type: "coords", value: { lat, lon } };

  try {
    const [current, forecast] = await Promise.all([
      fetchJson(buildWeatherUrlByCoords(lat, lon)),
      fetchJson(buildForecastUrlByCoords(lat, lon)),
    ]);

    renderCurrent(current);

    const tz = forecast?.city?.timezone ?? current?.timezone ?? 0;
    renderForecast(forecast?.list ?? [], tz);

    toast(`Updated for your location.`);
  } catch (e) {
    toast(`Couldn’t load: ${e.message}`);
  }
}

function getCoords() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported in this
