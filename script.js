// Weather Dashboard — vanilla JS + Open-Meteo (no API key needed)
const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

// WMO weather codes -> [description, emoji]
const CODES = {
  0: ["Clear sky", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  61: ["Light rain", "🌧️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"], 82: ["Violent showers", "⛈️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with hail", "⛈️"],
};
const describe = (code) => CODES[code] || ["Unknown", "❔"];

const $ = (id) => document.getElementById(id);
const els = {
  form: $("search-form"), city: $("city"), locate: $("locate"),
  unit: $("unit-toggle"), theme: $("theme-toggle"),
  status: $("status"), weather: $("weather"), recent: $("recent"),
  place: $("place"), temp: $("temp"), condition: $("condition"),
  feels: $("feels"), humidity: $("humidity"), wind: $("wind"), forecast: $("forecast"),
};

const state = { unit: "celsius", place: null }; // place = { name, latitude, longitude }

// ---------- storage helpers (wrapped: storage can fail) ----------
const load = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
};

// ---------- UI helpers ----------
function setStatus(message, isError = false) {
  els.status.textContent = message;
  els.status.classList.toggle("error", isError);
  els.status.hidden = !message;
}

function renderRecent() {
  const cities = load("recent", []);
  els.recent.innerHTML = "";
  cities.forEach((name) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = name;
    btn.addEventListener("click", () => searchCity(name));
    li.appendChild(btn);
    els.recent.appendChild(li);
  });
}

function addRecent(name) {
  const list = load("recent", []).filter((c) => c.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  save("recent", list.slice(0, 5));
  renderRecent();
}

// ---------- data fetching ----------
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Network error. Check your connection and try again.");
  return res.json();
}

async function searchCity(query) {
  setStatus("Loading…");
  els.weather.hidden = true;
  try {
    const geo = await getJSON(`${GEO_URL}?name=${encodeURIComponent(query)}&count=1`);
    if (!geo.results || geo.results.length === 0) {
      throw new Error(`No city found for "${query}". Check the spelling and try again.`);
    }
    const { name, country, latitude, longitude } = geo.results[0];
    state.place = { name: country ? `${name}, ${country}` : name, latitude, longitude };
    await loadWeather();
    addRecent(name);
  } catch (err) {
    setStatus(err.message, true);
  }
}

async function loadWeather() {
  const { latitude, longitude } = state.place;
  const imperial = state.unit === "fahrenheit";
  const params = new URLSearchParams({
    latitude, longitude, timezone: "auto", forecast_days: 5,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: state.unit,
    wind_speed_unit: imperial ? "mph" : "kmh",
  });
  const data = await getJSON(`${WEATHER_URL}?${params}`);
  render(data);
}

// ---------- rendering ----------
function render(data) {
  const c = data.current;
  const imperial = state.unit === "fahrenheit";
  const deg = imperial ? "°F" : "°C";
  const [text, icon] = describe(c.weather_code);

  els.place.textContent = state.place.name;
  els.temp.textContent = `${Math.round(c.temperature_2m)}${deg}`;
  els.condition.textContent = `${icon} ${text}`;
  els.feels.textContent = `${Math.round(c.apparent_temperature)}${deg}`;
  els.humidity.textContent = `${c.relative_humidity_2m}%`;
  els.wind.textContent = `${Math.round(c.wind_speed_10m)} ${imperial ? "mph" : "km/h"}`;

  els.forecast.innerHTML = "";
  data.daily.time.forEach((date, i) => {
    const [dayText, dayIcon] = describe(data.daily.weather_code[i]);
    const day = new Date(date + "T00:00").toLocaleDateString(undefined, { weekday: "short" });
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="day">${i === 0 ? "Today" : day}</div>
      <div class="icon" role="img" aria-label="${dayText}">${dayIcon}</div>
      <div class="range"><strong>${Math.round(data.daily.temperature_2m_max[i])}°</strong>
        / ${Math.round(data.daily.temperature_2m_min[i])}°</div>`;
    els.forecast.appendChild(li);
  });

  setStatus("");
  els.weather.hidden = false;
}

// ---------- events ----------
els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const q = els.city.value.trim();
  if (q) searchCity(q);
});

els.locate.addEventListener("click", () => {
  if (!navigator.geolocation) return setStatus("Your browser doesn't support location.", true);
  setStatus("Finding your location…");
  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      state.place = { name: "Your location", latitude: coords.latitude, longitude: coords.longitude };
      try { await loadWeather(); } catch (err) { setStatus(err.message, true); }
    },
    () => setStatus("Location access was denied. Search for a city instead.", true)
  );
});

els.unit.addEventListener("click", async () => {
  state.unit = state.unit === "celsius" ? "fahrenheit" : "celsius";
  els.unit.textContent = state.unit === "celsius" ? "°C" : "°F";
  save("unit", state.unit);
  if (state.place) {
    try { await loadWeather(); } catch (err) { setStatus(err.message, true); }
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  els.theme.textContent = theme === "dark" ? "Light" : "Dark";
  save("theme", theme);
}
els.theme.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

// ---------- init ----------
state.unit = load("unit", "celsius");
els.unit.textContent = state.unit === "celsius" ? "°C" : "°F";
applyTheme(load("theme", window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
renderRecent();