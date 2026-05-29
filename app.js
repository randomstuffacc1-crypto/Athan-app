(() => {
  'use strict';

  const STORAGE_KEY = 'noortime.settings.v4';
  const KAABA = { lat: 21.4225, lon: 39.8262 };
  const PRAYERS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const PRAYER_LABELS = { fajr: 'Fajr', sunrise: 'Sunrise', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' };
  const METHODS = {
    mwl: { name: 'Muslim World League', fajrAngle: 18, ishaAngle: 17, ishaInterval: null },
    isna: { name: 'ISNA / North America', fajrAngle: 15, ishaAngle: 15, ishaInterval: null },
    egyptian: { name: 'Egyptian General Authority', fajrAngle: 19.5, ishaAngle: 17.5, ishaInterval: null },
    makkah: { name: 'Umm al-Qura / Makkah', fajrAngle: 18.5, ishaAngle: 0, ishaInterval: 90 },
    karachi: { name: 'University of Islamic Sciences Karachi', fajrAngle: 18, ishaAngle: 18, ishaInterval: null },
    jafari: { name: 'Shia Ithna-Ashari / Jafari', fajrAngle: 16, ishaAngle: 14, ishaInterval: null },
    custom: { name: 'Custom', fajrAngle: 15, ishaAngle: 15, ishaInterval: null }
  };

  const defaults = {
    version: 4,
    location: null,
    settings: {
      method: 'isna',
      fajrAngle: 15,
      ishaAngle: 15,
      ishaInterval: null,
      asrMethod: 'standard',
      highLatMethod: 'middle',
      offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      notificationsEnabled: false
    }
  };

  let state = structuredCloneSafe(defaults);
  let storageWorking = false;
  let activeTab = 'prayer';
  let selectedDate = new Date();
  let latestPrayerTimes = null;
  let notificationTimer = null;
  let liveCompass = { enabled: false, qibla: null, heading: null };

  const $ = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    storageWorking = testStorage();
    state = loadState();
    selectedDate = startOfLocalDay(new Date());
    bindNavigation();
    bindLocationPage();
    bindSettingsPage();
    bindMorePage();
    bindQiblaPage();
    $('dateSelector').value = formatDateInput(selectedDate);
    $('dateSelector').addEventListener('change', (e) => {
      const parsed = parseDateInput(e.target.value);
      if (parsed) selectedDate = parsed;
      renderAll();
    });
    document.querySelectorAll('[data-switch]').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.switch)));
    setInterval(tick, 1000);
    renderAll();
  }

  function structuredCloneSafe(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function testStorage() {
    try {
      const key = '__noortime_test__';
      localStorage.setItem(key, '1');
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadState() {
    const base = structuredCloneSafe(defaults);
    if (!storageWorking) return base;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;
      const saved = JSON.parse(raw);
      return mergeState(base, saved);
    } catch (error) {
      console.warn('NoorTime: could not read saved settings.', error);
      return base;
    }
  }

  function mergeState(base, saved) {
    const merged = structuredCloneSafe(base);
    if (saved && typeof saved === 'object') {
      if (saved.location && isFiniteNumber(saved.location.lat) && isFiniteNumber(saved.location.lon)) {
        merged.location = {
          name: String(saved.location.name || 'Saved location'),
          lat: Number(saved.location.lat),
          lon: Number(saved.location.lon),
          source: String(saved.location.source || 'saved'),
          savedAt: saved.location.savedAt || new Date().toISOString()
        };
      }
      if (saved.settings && typeof saved.settings === 'object') {
        merged.settings = { ...merged.settings, ...saved.settings };
        merged.settings.offsets = { ...base.settings.offsets, ...(saved.settings.offsets || {}) };
      }
    }
    if (!METHODS[merged.settings.method]) merged.settings.method = 'isna';
    merged.settings.fajrAngle = cleanNumber(merged.settings.fajrAngle, 15);
    merged.settings.ishaAngle = cleanNumber(merged.settings.ishaAngle, 15);
    merged.settings.ishaInterval = merged.settings.ishaInterval === null || merged.settings.ishaInterval === '' ? null : cleanNumber(merged.settings.ishaInterval, null);
    return merged;
  }

  function saveState() {
    if (!storageWorking) {
      showToast('Storage is blocked, so changes may not persist.');
      renderStorageStatus();
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      storageWorking = false;
      showToast('Could not save. Browser storage may be full or blocked.');
      renderStorageStatus();
      return false;
    }
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.dataset.page === tab));
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    renderAll();
  }

  function bindLocationPage() {
    $('useGpsBtn').addEventListener('click', useGpsLocation);
    $('clearLocationBtn').addEventListener('click', () => {
      state.location = null;
      saveState();
      renderAll();
      showToast('Location cleared.');
    });
    $('citySearchBtn').addEventListener('click', searchCity);
    $('citySearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') searchCity(); });
    $('saveManualBtn').addEventListener('click', saveManualLocation);
  }

  function useGpsLocation() {
    if (!navigator.geolocation) {
      $('gpsStatus').textContent = 'Geolocation is not supported in this browser. Use manual location instead.';
      return;
    }
    $('gpsStatus').textContent = 'Requesting location permission...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        const lat = Number(pos.coords.latitude);
        const lon = Number(pos.coords.longitude);
        state.location = { name: 'Current Location', lat, lon, source: 'gps', savedAt: new Date().toISOString() };
        saveState();
        $('gpsStatus').textContent = 'Location saved from GPS.';
        renderAll();
        showToast('Location saved.');
      },
      err => {
        const map = { 1: 'GPS permission was denied. Manual location still works.', 2: 'GPS position unavailable. Try manual location.', 3: 'GPS timed out. Try again or use manual location.' };
        $('gpsStatus').textContent = map[err.code] || 'Could not get GPS location.';
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  async function searchCity() {
    const query = $('citySearchInput').value.trim();
    const container = $('searchResults');
    if (!query) {
      container.innerHTML = '<p class="note">Enter a city or address first.</p>';
      return;
    }
    container.innerHTML = '<p class="note">Searching...</p>';
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('Geocoding request failed');
      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        container.innerHTML = '<p class="note">No location found. Try a more specific city, state, or country.</p>';
        return;
      }
      container.innerHTML = '';
      results.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'result-btn';
        btn.innerHTML = `<strong>${escapeHtml(shortPlaceName(item.display_name))}</strong><small>${escapeHtml(item.display_name)}</small>`;
        btn.addEventListener('click', () => {
          state.location = {
            name: shortPlaceName(item.display_name),
            lat: Number(item.lat),
            lon: Number(item.lon),
            source: 'nominatim',
            savedAt: new Date().toISOString()
          };
          saveState();
          renderAll();
          showToast('Location saved.');
        });
        container.appendChild(btn);
      });
    } catch (error) {
      container.innerHTML = '<p class="note">Search failed. Check your connection or enter coordinates manually.</p>';
    }
  }

  function saveManualLocation() {
    const lat = Number($('manualLat').value);
    const lon = Number($('manualLon').value);
    const name = $('manualName').value.trim() || 'Manual Location';
    if (!isFiniteNumber(lat) || lat < -90 || lat > 90 || !isFiniteNumber(lon) || lon < -180 || lon > 180) {
      showToast('Enter a valid latitude and longitude.');
      return;
    }
    state.location = { name, lat, lon, source: 'manual', savedAt: new Date().toISOString() };
    saveState();
    renderAll();
    showToast('Manual location saved.');
  }

  function bindSettingsPage() {
    const methodSelect = $('methodSelect');
    Object.entries(METHODS).forEach(([key, method]) => {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = method.name;
      methodSelect.appendChild(opt);
    });
    methodSelect.addEventListener('change', () => {
      const methodKey = methodSelect.value;
      const method = METHODS[methodKey];
      state.settings.method = methodKey;
      state.settings.fajrAngle = method.fajrAngle;
      state.settings.ishaAngle = method.ishaAngle;
      state.settings.ishaInterval = method.ishaInterval;
      saveState();
      renderAll();
      showToast('Calculation method saved.');
    });

    ['fajrAngle', 'ishaAngle', 'ishaInterval', 'asrMethod', 'highLatMethod'].forEach(id => {
      $(id).addEventListener('change', () => {
        state.settings.method = id === 'fajrAngle' || id === 'ishaAngle' || id === 'ishaInterval' ? 'custom' : state.settings.method;
        state.settings.fajrAngle = cleanNumber($('fajrAngle').value, 15);
        state.settings.ishaAngle = cleanNumber($('ishaAngle').value, 15);
        state.settings.ishaInterval = $('ishaInterval').value === '' ? null : cleanNumber($('ishaInterval').value, null);
        state.settings.asrMethod = $('asrMethod').value;
        state.settings.highLatMethod = $('highLatMethod').value;
        saveState();
        renderAll();
      });
    });

    const grid = $('offsetGrid');
    PRAYERS.forEach(key => {
      const label = document.createElement('label');
      label.className = 'offset-item';
      label.innerHTML = `<span>${PRAYER_LABELS[key]}</span><input id="offset-${key}" type="number" step="1" inputmode="numeric" />`;
      grid.appendChild(label);
      label.querySelector('input').addEventListener('change', (e) => {
        state.settings.offsets[key] = Math.round(cleanNumber(e.target.value, 0));
        saveState();
        renderAll();
      });
    });
  }

  function bindQiblaPage() {
    $('enableCompassBtn').addEventListener('click', enableCompass);
  }

  async function enableCompass() {
    if (!state.location) {
      $('compassStatus').textContent = 'Save a location first.';
      return;
    }
    if (!window.isSecureContext) {
      $('compassStatus').textContent = 'Live compass usually requires HTTPS. GitHub Pages works; opening index.html directly may not.';
    }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const response = await DeviceOrientationEvent.requestPermission();
        if (response !== 'granted') {
          $('compassStatus').textContent = 'Compass permission was denied.';
          return;
        }
      }
      if (!('DeviceOrientationEvent' in window)) {
        $('compassStatus').textContent = 'Compass/device orientation is not supported in this browser.';
        return;
      }
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
      liveCompass.enabled = true;
      $('compassStatus').textContent = 'Compass enabled. Move your phone in a figure-eight if heading seems inaccurate.';
    } catch (error) {
      $('compassStatus').textContent = 'Could not enable compass. Permission or browser support may be limited.';
    }
  }

  function handleOrientation(event) {
    let heading = null;
    if (typeof event.webkitCompassHeading === 'number') heading = event.webkitCompassHeading;
    else if (event.absolute && typeof event.alpha === 'number') heading = (360 - event.alpha + 360) % 360;
    else if (typeof event.alpha === 'number') heading = (360 - event.alpha + 360) % 360;
    if (heading === null || Number.isNaN(heading)) return;
    liveCompass.heading = heading;
    renderQibla();
  }

  function bindMorePage() {
    $('enableNotificationsBtn').addEventListener('click', enableNotifications);
    $('testToneBtn').addEventListener('click', playTestTone);
    $('exportBtn').addEventListener('click', exportSettings);
    $('importFile').addEventListener('change', importSettings);
    $('resetBtn').addEventListener('click', resetApp);
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      $('notificationStatus').textContent = 'This browser does not support notifications.';
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      state.settings.notificationsEnabled = true;
      saveState();
      scheduleNotificationCheck();
      $('notificationStatus').textContent = 'Notifications enabled while the app remains open.';
      new Notification('NoorTime notifications enabled', { body: 'Prayer alerts can appear while NoorTime is open.' });
    } else {
      state.settings.notificationsEnabled = false;
      saveState();
      $('notificationStatus').textContent = 'Notification permission was denied or dismissed.';
    }
  }

  function scheduleNotificationCheck() {
    if (notificationTimer) clearInterval(notificationTimer);
    notificationTimer = setInterval(() => {
      if (!state.settings.notificationsEnabled || Notification.permission !== 'granted' || !latestPrayerTimes) return;
      const now = new Date();
      PRAYERS.forEach(key => {
        const t = latestPrayerTimes[key]?.date;
        if (!t) return;
        const diff = Math.abs(t.getTime() - now.getTime());
        const stamp = `${formatDateInput(t)}-${key}-${t.getHours()}-${t.getMinutes()}`;
        if (diff < 30000 && sessionStorage.getItem(stamp) !== 'sent') {
          sessionStorage.setItem(stamp, 'sent');
          new Notification(`${PRAYER_LABELS[key]} time`, { body: `${PRAYER_LABELS[key]} is now at ${formatTime(t)}.` });
        }
      });
    }, 15000);
  }

  function playTestTone() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) {
        $('notificationStatus').textContent = 'AudioContext is not supported in this browser.';
        return;
      }
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1);
      $('notificationStatus').textContent = 'Test tone played.';
    } catch (error) {
      $('notificationStatus').textContent = 'Could not play test tone.';
    }
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `noortime-settings-${formatDateInput(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importSettings(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        state = mergeState(defaults, imported);
        saveState();
        renderAll();
        showToast('Settings imported.');
      } catch (error) {
        showToast('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  function resetApp() {
    const ok = confirm('Reset NoorTime settings and saved location?');
    if (!ok) return;
    state = structuredCloneSafe(defaults);
    if (storageWorking) localStorage.removeItem(STORAGE_KEY);
    renderAll();
    showToast('NoorTime reset.');
  }

  function renderAll() {
    renderStorageStatus();
    renderLocation();
    renderSettings();
    renderPrayer();
    renderQibla();
    renderNotifications();
  }

  function renderStorageStatus() {
    $('storageStatus').textContent = storageWorking ? 'yes' : 'no';
  }

  function renderLocation() {
    const loc = state.location;
    if (loc) {
      $('savedLocationTitle').textContent = loc.name;
      $('savedLocationDetails').textContent = `${loc.lat.toFixed(5)}, ${loc.lon.toFixed(5)} • ${loc.source} • saved ${new Date(loc.savedAt).toLocaleString()}`;
      $('homeLocationName').textContent = loc.name;
      $('manualLat').value = loc.lat;
      $('manualLon').value = loc.lon;
      $('manualName').value = loc.name;
    } else {
      $('savedLocationTitle').textContent = 'No location saved';
      $('savedLocationDetails').textContent = 'Prayer times and Qibla need a saved location.';
      $('homeLocationName').textContent = 'No location saved';
    }
  }

  function renderSettings() {
    const s = state.settings;
    $('methodSelect').value = s.method;
    $('fajrAngle').value = s.fajrAngle ?? '';
    $('ishaAngle').value = s.ishaAngle ?? '';
    $('ishaInterval').value = s.ishaInterval ?? '';
    $('asrMethod').value = s.asrMethod;
    $('highLatMethod').value = s.highLatMethod;
    PRAYERS.forEach(key => {
      const input = $(`offset-${key}`);
      if (input) input.value = s.offsets[key] ?? 0;
    });
  }

  function renderPrayer() {
    $('homeDateText').textContent = selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    $('timezoneText').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';

    if (!state.location) {
      $('prayerNoLocation').classList.remove('hidden');
      $('prayerContent').classList.add('hidden');
      latestPrayerTimes = null;
      return;
    }
    $('prayerNoLocation').classList.add('hidden');
    $('prayerContent').classList.remove('hidden');

    latestPrayerTimes = calculatePrayerTimes(selectedDate, state.location, state.settings);
    const next = getNextPrayer(latestPrayerTimes);
    $('nextPrayerName').textContent = PRAYER_LABELS[next.key];
    $('nextPrayerTime').textContent = formatTime(next.date);
    renderCountdown(next.date);

    const list = $('prayerList');
    list.innerHTML = '';
    PRAYERS.forEach(key => {
      const row = document.createElement('div');
      row.className = `prayer-row ${key === next.key ? 'active' : ''}`;
      row.innerHTML = `<strong>${PRAYER_LABELS[key]}</strong><span>${formatTime(latestPrayerTimes[key].date)}</span>`;
      list.appendChild(row);
    });
  }

  function renderCountdown(target) {
    const diff = Math.max(0, target.getTime() - Date.now());
    const total = Math.floor(diff / 1000);
    const h = String(Math.floor(total / 3600)).padStart(2, '0');
    const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    $('nextCountdown').textContent = `${h}:${m}:${s}`;
  }

  function tick() {
    const now = new Date();
    $('compactClock').textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (latestPrayerTimes) {
      const next = getNextPrayer(latestPrayerTimes);
      $('nextPrayerName').textContent = PRAYER_LABELS[next.key];
      $('nextPrayerTime').textContent = formatTime(next.date);
      renderCountdown(next.date);
    }
  }

  function renderQibla() {
    if (!state.location) {
      $('qiblaNoLocation').classList.remove('hidden');
      $('qiblaContent').classList.add('hidden');
      return;
    }
    $('qiblaNoLocation').classList.add('hidden');
    $('qiblaContent').classList.remove('hidden');
    const qibla = calculateQibla(state.location.lat, state.location.lon);
    liveCompass.qibla = qibla;
    $('qiblaDegrees').textContent = `${qibla.toFixed(1)}°`;
    $('qiblaText').textContent = `From ${state.location.name} toward the Kaaba.`;

    const heading = liveCompass.heading || 0;
    $('compassDial').style.transform = liveCompass.enabled && liveCompass.heading !== null ? `rotate(${-heading}deg)` : 'rotate(0deg)';
    $('qiblaMarker').style.transform = `translate(-50%, -100%) rotate(${qibla}deg)`;
    if (liveCompass.enabled && liveCompass.heading !== null) {
      const delta = smallestAngleDiff(qibla, heading);
      $('compassStatus').textContent = Math.abs(delta) <= 5 ? 'You are facing Qibla.' : `Turn ${delta > 0 ? 'right' : 'left'} about ${Math.abs(delta).toFixed(0)}°.`;
    }
  }

  function renderNotifications() {
    if (!('Notification' in window)) $('notificationStatus').textContent = 'This browser does not support notifications.';
    else if (Notification.permission === 'granted' && state.settings.notificationsEnabled) $('notificationStatus').textContent = 'Notifications enabled while NoorTime remains open.';
    else if (Notification.permission === 'denied') $('notificationStatus').textContent = 'Notification permission is denied in this browser.';
    if (state.settings.notificationsEnabled) scheduleNotificationCheck();
  }

  function calculatePrayerTimes(date, loc, settings) {
    const tz = -date.getTimezoneOffset();
    const solar = solarParams(date);
    const lat = loc.lat;
    const lon = loc.lon;
    const decl = solar.declination;
    const noon = 720 - 4 * lon - solar.equationOfTime + tz;
    const sunriseHA = hourAngle(lat, decl, -0.833);
    let sunrise = noon - 4 * sunriseHA;
    let sunset = noon + 4 * sunriseHA;

    if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
      sunrise = noon - 360;
      sunset = noon + 360;
    }

    const fajrHA = hourAngle(lat, decl, -Math.abs(settings.fajrAngle));
    let fajr = Number.isFinite(fajrHA) ? noon - 4 * fajrHA : highLatFajr(sunrise, sunset, settings);

    const factor = settings.asrMethod === 'hanafi' ? 2 : 1;
    const asrAltitude = radToDeg(Math.atan(1 / (factor + Math.tan(Math.abs(degToRad(lat - decl))))));
    const asrHA = hourAngle(lat, decl, asrAltitude);
    const asr = Number.isFinite(asrHA) ? noon + 4 * asrHA : noon + 240;

    let isha;
    if (settings.ishaInterval !== null && Number.isFinite(Number(settings.ishaInterval))) {
      isha = sunset + Number(settings.ishaInterval);
    } else {
      const ishaHA = hourAngle(lat, decl, -Math.abs(settings.ishaAngle));
      isha = Number.isFinite(ishaHA) ? noon + 4 * ishaHA : highLatIsha(sunrise, sunset, settings);
    }

    const raw = { fajr, sunrise, dhuhr: noon, asr, maghrib: sunset, isha };
    const out = {};
    PRAYERS.forEach(key => {
      const adjusted = raw[key] + (Number(settings.offsets[key]) || 0);
      out[key] = { minutes: adjusted, date: minutesToDate(date, adjusted) };
    });
    return out;
  }

  function solarParams(date) {
    const jd = julianDate(date);
    const t = (jd - 2451545.0) / 36525;
    const L0 = normalizeDegrees(280.46646 + t * (36000.76983 + t * 0.0003032));
    const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
    const M = normalizeDegrees(357.52911 + t * (35999.05029 - 0.0001537 * t));
    const obliq = 23 + (26 + ((21.448 - t * (46.815 + t * (0.00059 - t * 0.001813)))) / 60) / 60;
    const y = Math.tan(degToRad(obliq) / 2) ** 2;
    const eq = 4 * radToDeg(
      y * Math.sin(2 * degToRad(L0)) -
      2 * e * Math.sin(degToRad(M)) +
      4 * e * y * Math.sin(degToRad(M)) * Math.cos(2 * degToRad(L0)) -
      0.5 * y * y * Math.sin(4 * degToRad(L0)) -
      1.25 * e * e * Math.sin(2 * degToRad(M))
    );
    const C = Math.sin(degToRad(M)) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(degToRad(2 * M)) * (0.019993 - 0.000101 * t) + Math.sin(degToRad(3 * M)) * 0.000289;
    const trueLong = L0 + C;
    const omega = 125.04 - 1934.136 * t;
    const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
    const decl = radToDeg(Math.asin(Math.sin(degToRad(obliq)) * Math.sin(degToRad(lambda))));
    return { equationOfTime: eq, declination: decl };
  }

  function julianDate(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    return d.getTime() / 86400000 + 2440587.5;
  }

  function hourAngle(lat, decl, altitude) {
    const latR = degToRad(lat);
    const decR = degToRad(decl);
    const altR = degToRad(altitude);
    const cosH = (Math.sin(altR) - Math.sin(latR) * Math.sin(decR)) / (Math.cos(latR) * Math.cos(decR));
    if (cosH < -1 || cosH > 1) return NaN;
    return radToDeg(Math.acos(cosH));
  }

  function highLatFraction(settings, angle) {
    if (settings.highLatMethod === 'seventh') return 1 / 7;
    if (settings.highLatMethod === 'angle') return Math.abs(angle) / 60;
    return 1 / 2;
  }

  function highLatFajr(sunrise, sunset, settings) {
    const night = (1440 - sunset) + sunrise;
    return sunrise - night * highLatFraction(settings, settings.fajrAngle);
  }

  function highLatIsha(sunrise, sunset, settings) {
    const night = (1440 - sunset) + sunrise;
    return sunset + night * highLatFraction(settings, settings.ishaAngle);
  }

  function calculateQibla(lat, lon) {
    const phi1 = degToRad(lat);
    const phi2 = degToRad(KAABA.lat);
    const dLon = degToRad(KAABA.lon - lon);
    const y = Math.sin(dLon);
    const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(dLon);
    return normalizeDegrees(radToDeg(Math.atan2(y, x)));
  }

  function getNextPrayer(times) {
    const now = new Date();
    const todaySelected = formatDateInput(selectedDate) === formatDateInput(now);
    if (todaySelected) {
      for (const key of PRAYERS) {
        if (times[key].date > now) return { key, date: times[key].date };
      }
      const tomorrow = addDays(selectedDate, 1);
      const t = calculatePrayerTimes(tomorrow, state.location, state.settings);
      return { key: 'fajr', date: t.fajr.date };
    }
    return { key: 'fajr', date: times.fajr.date };
  }

  function minutesToDate(baseDate, minutes) {
    const d = startOfLocalDay(baseDate);
    d.setMinutes(Math.round(minutes));
    return d;
  }

  function startOfLocalDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function formatDateInput(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function parseDateInput(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function degToRad(deg) { return deg * Math.PI / 180; }
  function radToDeg(rad) { return rad * 180 / Math.PI; }
  function normalizeDegrees(deg) { return ((deg % 360) + 360) % 360; }
  function isFiniteNumber(n) { return typeof n === 'number' && Number.isFinite(n); }
  function cleanNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function smallestAngleDiff(target, current) { return ((target - current + 540) % 360) - 180; }
  function shortPlaceName(name) { return String(name || '').split(',').slice(0, 3).join(',').trim() || 'Selected location'; }
  function escapeHtml(str) { return String(str).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }

  let toastTimer;
  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }
})();
