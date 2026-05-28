/*
  NoorTime prayer calculation notes:
  This app implements common open-source style astronomical prayer formulas:
  - Solar declination and equation of time use NOAA-style approximations.
  - Fajr/Isha are calculated when the sun reaches the selected twilight angle below the horizon.
  - Dhuhr is solar noon adjusted for longitude/time zone/equation of time.
  - Asr uses the shadow-factor formula with Standard = 1 and Hanafi = 2.
  - High-latitude adjustments limit Fajr/Isha using night portions when twilight times are invalid or extreme.
  Prayer times vary by local convention. Always confirm with a local masjid.
*/

const STORAGE_KEY = "noortime.settings.v1";
const KAABA = { lat: 21.422487, lng: 39.826206 };
const PRAYERS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
const ICONS = { Fajr: "🌅", Sunrise: "☀️", Dhuhr: "🌤️", Asr: "🌇", Maghrib: "🌆", Isha: "🌙" };

const METHODS = {
  MWL: { label: "Muslim World League", fajrAngle: 18, ishaAngle: 17, ishaInterval: "" },
  ISNA: { label: "ISNA / North America", fajrAngle: 15, ishaAngle: 15, ishaInterval: "" },
  EGYPT: { label: "Egyptian General Authority", fajrAngle: 19.5, ishaAngle: 17.5, ishaInterval: "" },
  MAKKAH: { label: "Umm al-Qura / Makkah", fajrAngle: 18.5, ishaAngle: 0, ishaInterval: 90 },
  KARACHI: { label: "University of Islamic Sciences Karachi", fajrAngle: 18, ishaAngle: 18, ishaInterval: "" },
  JAFARI: { label: "Shia Ithna-Ashari / Jafari", fajrAngle: 16, ishaAngle: 14, ishaInterval: "" },
  CUSTOM: { label: "Custom", fajrAngle: 18, ishaAngle: 17, ishaInterval: "" }
};

const defaultSettings = {
  location: null,
  method: "MWL",
  fajrAngle: 18,
  ishaAngle: 17,
  ishaInterval: "",
  asrMethod: "standard",
  highLatitudeRule: "middle",
  offsets: { Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0 },
  notificationsEnabled: false
};

let settings = loadSettings();
let todaysTimes = null;
let notifiedKeySet = new Set();
let qiblaBearing = null;
let compassHeading = 0;
let countdownTimer = null;

const $ = (id) => document.getElementById(id);

window.addEventListener("DOMContentLoaded", () => {
  initializeControls();
  bindEvents();
  renderAll();
  countdownTimer = setInterval(() => {
    updateClock();
    updateNextPrayer();
    checkPrayerNotifications();
  }, 1000);
});

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return deepMerge(defaultSettings, saved || {});
  } catch {
    return structuredClone(defaultSettings);
  }
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function deepMerge(base, update) {
  const output = structuredClone(base);
  for (const key in update) {
    if (update[key] && typeof update[key] === "object" && !Array.isArray(update[key]) && key in output) {
      output[key] = deepMerge(output[key], update[key]);
    } else {
      output[key] = update[key];
    }
  }
  return output;
}

function initializeControls() {
  const today = new Date();
  $("datePicker").value = toDateInput(today);
  $("methodSelect").value = settings.method;
  $("fajrAngle").value = settings.fajrAngle;
  $("ishaAngle").value = settings.ishaAngle;
  $("ishaInterval").value = settings.ishaInterval;
  $("asrMethod").value = settings.asrMethod;
  $("highLatitudeRule").value = settings.highLatitudeRule;

  if (settings.location) {
    $("manualName").value = settings.location.name || "Saved location";
    $("manualLat").value = settings.location.lat;
    $("manualLng").value = settings.location.lng;
  }

  const offsetGrid = $("offsetGrid");
  offsetGrid.innerHTML = "";
  PRAYERS.forEach((name) => {
    const label = document.createElement("label");
    label.innerHTML = `${name} offset, minutes <input id="offset-${name}" type="number" step="1" value="${settings.offsets[name] || 0}" />`;
    offsetGrid.appendChild(label);
  });
}

function bindEvents() {
  $("useLocationBtn").addEventListener("click", useCurrentLocation);
  $("saveManualLocationBtn").addEventListener("click", saveManualLocation);
  $("searchAddressBtn").addEventListener("click", searchAddress);
  $("addressInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") searchAddress();
  });
  $("datePicker").addEventListener("change", renderAll);
  $("enableCompassBtn").addEventListener("click", enableCompass);
  $("enableNotificationsBtn").addEventListener("click", enableNotifications);
  $("testToneBtn").addEventListener("click", playTestTone);
  $("exportBtn").addEventListener("click", exportSettings);
  $("importFile").addEventListener("change", importSettings);
  $("resetOffsetsBtn").addEventListener("click", () => {
    settings.offsets = structuredClone(defaultSettings.offsets);
    saveSettings();
    initializeControls();
    bindOffsetInputs();
    renderAll();
    showMessage("Offsets reset.", "success");
  });

  ["methodSelect", "fajrAngle", "ishaAngle", "ishaInterval", "asrMethod", "highLatitudeRule"].forEach((id) => {
    $(id).addEventListener("change", onSettingsChanged);
    $(id).addEventListener("input", onSettingsChanged);
  });
  bindOffsetInputs();
}

function bindOffsetInputs() {
  PRAYERS.forEach((name) => {
    const input = $(`offset-${name}`);
    if (!input) return;
    input.addEventListener("input", () => {
      settings.offsets[name] = parseInt(input.value || "0", 10);
      saveSettings();
      renderAll();
    });
  });
}

function onSettingsChanged(event) {
  const method = $("methodSelect").value;
  const previous = settings.method;
  settings.method = method;

  if (event.target.id === "methodSelect" && method !== "CUSTOM") {
    const methodDefaults = METHODS[method];
    settings.fajrAngle = methodDefaults.fajrAngle;
    settings.ishaAngle = methodDefaults.ishaAngle;
    settings.ishaInterval = methodDefaults.ishaInterval;
    $("fajrAngle").value = settings.fajrAngle;
    $("ishaAngle").value = settings.ishaAngle;
    $("ishaInterval").value = settings.ishaInterval;
  } else if (previous !== method || event.target.id !== "methodSelect") {
    settings.fajrAngle = numberOrDefault($("fajrAngle").value, METHODS[method].fajrAngle);
    settings.ishaAngle = numberOrDefault($("ishaAngle").value, METHODS[method].ishaAngle);
    settings.ishaInterval = $("ishaInterval").value === "" ? "" : Math.max(0, parseInt($("ishaInterval").value, 10));
  }
  settings.asrMethod = $("asrMethod").value;
  settings.highLatitudeRule = $("highLatitudeRule").value;
  saveSettings();
  renderAll();
}

function renderAll() {
  updateClock();
  renderLocation();
  if (settings.location) {
    calculateAndRenderPrayers();
    calculateAndRenderQibla();
  } else {
    renderEmptyPrayerList();
  }
}

function renderLocation() {
  $("locationName").textContent = settings.location ? settings.location.name : "No location saved";
}

function updateClock() {
  const now = new Date();
  $("localTime").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  $("todayDate").textContent = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function renderEmptyPrayerList() {
  $("prayerList").innerHTML = `<div class="prayer-row"><div class="prayer-icon">📍</div><div><div class="prayer-name">Choose a location</div><div class="prayer-note">Use GPS, city search, or latitude/longitude.</div></div><div class="prayer-time">--:--</div></div>`;
  $("nextPrayerName").textContent = "Set location";
  $("nextPrayerTime").textContent = "--:--";
  $("countdown").textContent = "--:--:--";
}

function calculateAndRenderPrayers() {
  const selectedDate = parseDateInput($("datePicker").value) || new Date();
  todaysTimes = getPrayerTimes(selectedDate, settings.location.lat, settings.location.lng, settings);
  const next = getNextPrayer(todaysTimes);
  const list = $("prayerList");
  list.innerHTML = "";
  PRAYERS.forEach((name) => {
    const row = document.createElement("div");
    row.className = `prayer-row ${next && next.name === name && isSameDate(selectedDate, new Date()) ? "next" : ""}`;
    row.innerHTML = `
      <div class="prayer-icon">${ICONS[name]}</div>
      <div>
        <div class="prayer-name">${name}</div>
        <div class="prayer-note">${settings.offsets[name] ? `${settings.offsets[name] > 0 ? "+" : ""}${settings.offsets[name]} min adjustment` : "Local calculated time"}</div>
      </div>
      <div class="prayer-time">${formatTime(todaysTimes[name])}</div>`;
    list.appendChild(row);
  });
  updateNextPrayer();
}

function updateNextPrayer() {
  if (!settings.location || !todaysTimes) return;
  const selectedDate = parseDateInput($("datePicker").value) || new Date();
  if (!isSameDate(selectedDate, new Date())) {
    $("nextPrayerName").textContent = "Selected date";
    $("nextPrayerTime").textContent = selectedDate.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    $("countdown").textContent = "View only";
    return;
  }

  let next = getNextPrayer(todaysTimes);
  if (!next) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowTimes = getPrayerTimes(tomorrow, settings.location.lat, settings.location.lng, settings);
    next = { name: "Fajr", time: tomorrowTimes.Fajr };
  }

  $("nextPrayerName").textContent = next.name;
  $("nextPrayerTime").textContent = formatTime(next.time);
  const diff = Math.max(0, next.time.getTime() - Date.now());
  $("countdown").textContent = msToCountdown(diff);
}

function getNextPrayer(times) {
  const now = new Date();
  return PRAYERS.map((name) => ({ name, time: times[name] })).find((item) => item.time > now);
}

function checkPrayerNotifications() {
  if (!settings.notificationsEnabled || Notification.permission !== "granted" || !todaysTimes) return;
  const now = new Date();
  PRAYERS.forEach((name) => {
    const time = todaysTimes[name];
    const diff = Math.abs(now.getTime() - time.getTime());
    const key = `${toDateInput(now)}-${name}`;
    if (diff < 1000 && !notifiedKeySet.has(key)) {
      notifiedKeySet.add(key);
      new Notification(`NoorTime: ${name}`, { body: `${name} time is now: ${formatTime(time)}` });
      playTestTone(true);
    }
  });
}

async function useCurrentLocation() {
  if (!navigator.geolocation) {
    showMessage("Geolocation is not supported by this browser. Enter your location manually.", "error");
    return;
  }
  showMessage("Requesting GPS location...");
  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    let name = `Current location (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`;
    try {
      const reverse = await reverseGeocode(latitude, longitude);
      if (reverse) name = reverse;
    } catch {}
    settings.location = { name, lat: latitude, lng: longitude };
    saveSettings();
    initializeControls();
    bindOffsetInputs();
    renderAll();
    showMessage("Location saved from GPS.", "success");
  }, (error) => {
    const reason = error.code === 1 ? "GPS permission was denied." : "Unable to get GPS location.";
    showMessage(`${reason} You can still enter a city or latitude/longitude manually.`, "error");
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
}

async function searchAddress() {
  const query = $("addressInput").value.trim();
  if (!query) {
    showMessage("Enter a city or address to search.", "error");
    return;
  }
  showMessage("Searching location...");
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!response.ok) throw new Error("Search failed");
    const results = await response.json();
    if (!results.length) {
      showMessage("City or address not found. Try a more specific search or enter coordinates manually.", "error");
      return;
    }
    const place = results[0];
    $("manualName").value = place.display_name.split(",").slice(0, 3).join(",");
    $("manualLat").value = parseFloat(place.lat).toFixed(6);
    $("manualLng").value = parseFloat(place.lon).toFixed(6);
    showMessage("Location found. Review it, then press Save Manual Location.", "success");
  } catch {
    showMessage("Location search failed. Nominatim may block local file requests in some browsers. Enter latitude/longitude manually or deploy to HTTPS.", "error");
  }
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`;
  const response = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!response.ok) return null;
  const data = await response.json();
  return data.display_name ? data.display_name.split(",").slice(0, 3).join(",") : null;
}

function saveManualLocation() {
  const lat = parseFloat($("manualLat").value);
  const lng = parseFloat($("manualLng").value);
  const name = $("manualName").value.trim() || "Manual location";
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    showMessage("Invalid latitude or longitude. Latitude must be -90 to 90 and longitude must be -180 to 180.", "error");
    return;
  }
  settings.location = { name, lat, lng };
  saveSettings();
  renderAll();
  showMessage("Manual location saved.", "success");
}

function calculateAndRenderQibla() {
  qiblaBearing = calculateBearing(settings.location.lat, settings.location.lng, KAABA.lat, KAABA.lng);
  $("qiblaDegrees").textContent = `${qiblaBearing.toFixed(1)}°`;
  $("qiblaStatus").textContent = `${qiblaBearing.toFixed(1)}° clockwise from true north toward the Kaaba.`;
  updateCompassVisual();
}

function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = degToRad(lat1), phi2 = degToRad(lat2);
  const deltaLambda = degToRad(lon2 - lon1);
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return normalizeDegrees(radToDeg(Math.atan2(y, x)));
}

async function enableCompass() {
  if (!window.DeviceOrientationEvent) {
    showMessage("Compass/device orientation is not supported on this browser. Numeric qibla direction still works.", "error");
    return;
  }
  try {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        showMessage("Compass permission was denied. Numeric qibla direction still works.", "error");
        return;
      }
    }
    window.addEventListener("deviceorientation", handleOrientation, true);
    showMessage("Live compass mode enabled. Calibrate your phone by moving it in a figure-eight motion.", "success");
  } catch {
    showMessage("Could not enable compass permission. Numeric qibla direction still works.", "error");
  }
}

function handleOrientation(event) {
  let heading = null;
  if (typeof event.webkitCompassHeading === "number") heading = event.webkitCompassHeading;
  else if (typeof event.alpha === "number") heading = 360 - event.alpha;
  if (heading !== null) {
    compassHeading = normalizeDegrees(heading);
    updateCompassVisual();
    $("qiblaStatus").textContent = `Turn until the green arrow points upward. Current heading: ${compassHeading.toFixed(0)}°.`;
  }
}

function updateCompassVisual() {
  if (qiblaBearing === null) return;
  const relative = normalizeDegrees(qiblaBearing - compassHeading);
  $("qiblaArrow").style.transform = `rotate(${relative}deg)`;
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showMessage("This browser does not support notifications.", "error");
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") {
    settings.notificationsEnabled = true;
    saveSettings();
    showMessage("Prayer notifications enabled while NoorTime is open.", "success");
  } else {
    settings.notificationsEnabled = false;
    saveSettings();
    showMessage("Notification permission was denied. Alerts will not show.", "error");
  }
}

function playTestTone(quiet = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audio = new AudioContext();
    const gain = audio.createGain();
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, audio.currentTime);
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(quiet ? 0.04 : 0.09, audio.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.9);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 1);
    if (!quiet) showMessage("Test tone played.", "success");
  } catch {
    showMessage("Audio test failed in this browser.", "error");
  }
}

function exportSettings() {
  const data = JSON.stringify(settings, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `noortime-settings-${toDateInput(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importSettings(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      settings = deepMerge(defaultSettings, imported);
      saveSettings();
      initializeControls();
      bindOffsetInputs();
      renderAll();
      showMessage("Settings imported successfully.", "success");
    } catch {
      showMessage("Invalid settings JSON file.", "error");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function getPrayerTimes(date, lat, lng, config) {
  const baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = dayOfYear(baseDate);
  const tz = -baseDate.getTimezoneOffset() / 60;
  const solar = solarParams(day);
  const noonHours = 12 + tz - (lng / 15) - (solar.eqTime / 60);
  const dhuhr = dateAtHours(baseDate, noonHours);
  const sunriseHourAngle = hourAngleForSunAltitude(lat, solar.declination, -0.833);
  let sunrise = dateAtHours(baseDate, noonHours - sunriseHourAngle / 15);
  let maghrib = dateAtHours(baseDate, noonHours + sunriseHourAngle / 15);

  const fajrHA = hourAngleForSunAltitude(lat, solar.declination, -Math.abs(config.fajrAngle));
  const ishaHA = hourAngleForSunAltitude(lat, solar.declination, -Math.abs(config.ishaAngle));
  let fajr = Number.isFinite(fajrHA) ? dateAtHours(baseDate, noonHours - fajrHA / 15) : null;
  let isha = "" !== config.ishaInterval && Number.isFinite(Number(config.ishaInterval))
    ? addMinutes(maghrib, Number(config.ishaInterval))
    : Number.isFinite(ishaHA) ? dateAtHours(baseDate, noonHours + ishaHA / 15) : null;

  const asrFactor = config.asrMethod === "hanafi" ? 2 : 1;
  const asrAltitude = radToDeg(Math.atan(1 / (asrFactor + Math.tan(Math.abs(degToRad(lat - solar.declination))))));
  const asrHA = hourAngleForSunAltitude(lat, solar.declination, asrAltitude);
  let asr = Number.isFinite(asrHA) ? dateAtHours(baseDate, noonHours + asrHA / 15) : dateAtHours(baseDate, noonHours + 4);

  ({ fajr, isha } = applyHighLatitudeAdjustments({ fajr, sunrise, maghrib, isha, baseDate, config }));

  const times = { Fajr: fajr, Sunrise: sunrise, Dhuhr: dhuhr, Asr: asr, Maghrib: maghrib, Isha: isha };
  PRAYERS.forEach((name) => { times[name] = addMinutes(times[name], parseInt(config.offsets[name] || 0, 10)); });
  return times;
}

function applyHighLatitudeAdjustments({ fajr, sunrise, maghrib, isha, baseDate, config }) {
  const nightLength = minutesBetween(maghrib, addMinutes(sunrise, 24 * 60));
  let fajrPortion, ishaPortion;
  if (config.highLatitudeRule === "seventh") {
    fajrPortion = ishaPortion = nightLength / 7;
  } else if (config.highLatitudeRule === "angle") {
    fajrPortion = nightLength * Math.abs(config.fajrAngle) / 60;
    ishaPortion = nightLength * Math.max(1, Math.abs(config.ishaAngle || 17)) / 60;
  } else {
    fajrPortion = ishaPortion = nightLength / 2;
  }
  const latestFajr = addMinutes(sunrise, -fajrPortion);
  const earliestIsha = addMinutes(maghrib, ishaPortion);

  if (!fajr || !Number.isFinite(fajr.getTime()) || fajr < new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0) || minutesBetween(fajr, sunrise) > fajrPortion) {
    fajr = latestFajr;
  }
  if (!isha || !Number.isFinite(isha.getTime()) || minutesBetween(maghrib, isha) > ishaPortion) {
    isha = earliestIsha;
  }
  return { fajr, isha };
}

function solarParams(dayOfYearValue) {
  const gamma = 2 * Math.PI / 365 * (dayOfYearValue - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = radToDeg(0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma));
  return { eqTime, declination };
}

function hourAngleForSunAltitude(lat, declination, altitude) {
  const latRad = degToRad(lat);
  const decRad = degToRad(declination);
  const altRad = degToRad(altitude);
  const cosH = (Math.sin(altRad) - Math.sin(latRad) * Math.sin(decRad)) / (Math.cos(latRad) * Math.cos(decRad));
  if (cosH < -1 || cosH > 1) return NaN;
  return radToDeg(Math.acos(cosH));
}

function dateAtHours(baseDate, hours) {
  const normalized = ((hours % 24) + 24) % 24;
  const date = new Date(baseDate);
  const wholeHours = Math.floor(normalized);
  const minutesFloat = (normalized - wholeHours) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  date.setHours(wholeHours, minutes, seconds, 0);
  if (hours < 0) date.setDate(date.getDate() - 1);
  if (hours >= 24) date.setDate(date.getDate() + 1);
  return date;
}

function showMessage(message, type = "") {
  const box = $("messageBox");
  box.className = `message-box ${type}`;
  box.textContent = message;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date - start) / 86400000);
}
function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function toDateInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function msToCountdown(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}
function minutesBetween(a, b) {
  return (b.getTime() - a.getTime()) / 60000;
}
function degToRad(deg) { return deg * Math.PI / 180; }
function radToDeg(rad) { return rad * 180 / Math.PI; }
function normalizeDegrees(deg) { return ((deg % 360) + 360) % 360; }
function numberOrDefault(value, fallback) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}
