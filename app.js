/**
 * NoorTime - Core Logic
 */

const STORAGE_KEY = 'noortime.settings.v4';

// Default State (CRITICAL: ISNA is default)
const DEFAULT_STATE = {
    location: {
        saved: false, lat: null, lon: null, name: "No location saved", savedAt: null
    },
    settings: {
        method: "ISNA",
        asr: "STANDARD",
        highLat: "NONE",
        customAngles: { fajr: 15, isha: 15 },
        offsets: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }
    }
};

let appState = null;
let currentSelectedDate = new Date();
let countdownInterval = null;

// Method Parameters (Fajr Angle, Isha Angle/Interval)
const METHODS = {
    MWL: { fajr: 18, isha: 17, ishaIsInterval: false },
    ISNA: { fajr: 15, isha: 15, ishaIsInterval: false },
    EGYPT: { fajr: 19.5, isha: 17.5, ishaIsInterval: false },
    MAKKAH: { fajr: 18.5, isha: 90, ishaIsInterval: true },
    KARACHI: { fajr: 18, isha: 18, ishaIsInterval: false },
    JAFARI: { fajr: 16, isha: 14, ishaIsInterval: false },
};

/* ========================================================
   1. STORAGE & INITIALIZATION
======================================================== */
function init() {
    checkStorageDiagnostic();
    loadSettings();
    setupNavigation();
    setupBindings();

    // Set initial date picker
    document.getElementById('date-input').value = formatDateForInput(currentSelectedDate);

    applySettingsToUI();
    renderApp();

    // Start Clock
    if(countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(updateTick, 1000);
}

function checkStorageDiagnostic() {
    const el = document.getElementById('diag-storage');
    try {
        localStorage.setItem('test_noortime', '1');
        localStorage.removeItem('test_noortime');
        el.textContent = "Yes";
        el.className = "status-pill good";
    } catch(e) {
        el.textContent = "No (Blocked)";
        el.className = "status-pill bad";
    }
}

function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Deep merge to ensure no missing keys, preferring saved data but keeping ISNA default if new
            appState = {
                location: { ...DEFAULT_STATE.location, ...parsed.location },
                settings: { 
                    ...DEFAULT_STATE.settings, 
                    ...parsed.settings,
                    customAngles: { ...DEFAULT_STATE.settings.customAngles, ...(parsed.settings?.customAngles || {}) },
                    offsets: { ...DEFAULT_STATE.settings.offsets, ...(parsed.settings?.offsets || {}) }
                }
            };
        } else {
            appState = JSON.parse(JSON.stringify(DEFAULT_STATE)); // deep copy
        }
    } catch(e) {
        console.error("Storage load failed, using defaults", e);
        appState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
}

function saveSettings() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch(e) {
        console.error("Storage save failed", e);
    }
    renderApp();
}

/* ========================================================
   2. DOM & NAVIGATION
======================================================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');

            if(targetId === 'tab-qibla') updateQiblaUI();
        });
    });
}

function setupBindings() {
    // Location
    document.getElementById('btn-auto-loc').addEventListener('click', autoLocation);
    document.getElementById('btn-search-loc').addEventListener('click', searchLocation);
    document.getElementById('btn-save-manual-loc').addEventListener('click', manualLocation);
    document.getElementById('btn-clear-loc').addEventListener('click', () => {
        appState.location = JSON.parse(JSON.stringify(DEFAULT_STATE.location));
        saveSettings();
    });

    // Date
    document.getElementById('date-input').addEventListener('change', (e) => {
        if(!e.target.value) return;
        // Parse date carefully to avoid timezone shift
        const parts = e.target.value.split('-');
        currentSelectedDate = new Date(parts[0], parts[1]-1, parts[2]);
        renderApp();
    });

    // Settings
    const mSelect = document.getElementById('setting-method');
    mSelect.addEventListener('change', (e) => {
        appState.settings.method = e.target.value;
        document.getElementById('custom-angles').classList.toggle('hidden', e.target.value !== 'CUSTOM');
        saveSettings();
    });

    document.getElementById('setting-asr').addEventListener('change', (e) => { appState.settings.asr = e.target.value; saveSettings(); });
    document.getElementById('setting-highlat').addEventListener('change', (e) => { appState.settings.highLat = e.target.value; saveSettings(); });

    // Custom Angles & Offsets
    ['fajr', 'isha'].forEach(p => {
        document.getElementById(`custom-${p}`).addEventListener('change', (e) => {
            appState.settings.customAngles[p] = parseFloat(e.target.value) || 0;
            saveSettings();
        });
    });

    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        document.getElementById(`offset-${p}`).addEventListener('change', (e) => {
            appState.settings.offsets[p] = parseInt(e.target.value) || 0;
            saveSettings();
        });
    });

    // More
    document.getElementById('btn-reset').addEventListener('click', () => {
        if(confirm("Reset all settings and location?")) {
            localStorage.removeItem(STORAGE_KEY);
            init();
        }
    });

    document.getElementById('btn-export-json').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "noortime_settings.json");
        dlAnchorElem.click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if(imported && imported.location && imported.settings) {
                    appState = imported;
                    saveSettings();
                    alert("Settings imported successfully.");
                    applySettingsToUI();
                } else throw new Error("Invalid format");
            } catch(err) {
                alert("Failed to import settings. Invalid JSON.");
            }
        };
        reader.readAsText(file);
    });

    document.getElementById('btn-enable-notif').addEventListener('click', () => {
        if (!("Notification" in window)) {
            alert("This browser does not support notifications.");
        } else if (Notification.permission === "granted") {
            alert("Notifications already enabled!");
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then(permission => {
                if (permission === "granted") alert("Notifications enabled!");
            });
        } else {
            alert("Notifications are blocked by your browser settings.");
        }
    });

    document.getElementById('btn-test-tone').addEventListener('click', () => {
        playAthanAlert("Test Tone", "This is a test notification");
    });

    document.getElementById('btn-live-compass').addEventListener('click', enableLiveCompass);
}

function applySettingsToUI() {
    document.getElementById('setting-method').value = appState.settings.method;
    document.getElementById('setting-asr').value = appState.settings.asr;
    document.getElementById('setting-highlat').value = appState.settings.highLat;

    document.getElementById('custom-angles').classList.toggle('hidden', appState.settings.method !== 'CUSTOM');
    document.getElementById('custom-fajr').value = appState.settings.customAngles.fajr;
    document.getElementById('custom-isha').value = appState.settings.customAngles.isha;

    Object.keys(appState.settings.offsets).forEach(k => {
        document.getElementById(`offset-${k}`).value = appState.settings.offsets[k];
    });
}

function renderApp() {
    const loc = appState.location;

    // Update Headers & Text
    document.getElementById('header-location-name').textContent = loc.saved ? loc.name : "No location saved";
    document.getElementById('saved-loc-display').textContent = loc.saved ? loc.name : "None";
    document.getElementById('saved-coords-display').textContent = loc.saved ? `${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}` : "--";

    const isToday = currentSelectedDate.toDateString() === new Date().toDateString();
    document.getElementById('local-date-display').textContent = isToday ? "Today, " + formatDateStr(currentSelectedDate) : formatDateStr(currentSelectedDate);

    if (!loc.saved) {
        document.getElementById('next-prayer-name').textContent = "Set Location";
        document.getElementById('next-prayer-time').textContent = "--:--";
        resetList();
        return;
    }

    calculateAndRenderPrayers();
    if(document.getElementById('tab-qibla').classList.contains('active')) updateQiblaUI();
}

/* ========================================================
   3. LOCATION HANDLING
======================================================== */
function saveLocationState(name, lat, lon) {
    appState.location = { saved: true, name, lat: parseFloat(lat), lon: parseFloat(lon), savedAt: new Date().toISOString() };
    saveSettings();
}

function autoLocation() {
    const status = document.getElementById('loc-status');
    status.textContent = "Requesting GPS...";
    if (!navigator.geolocation) { status.textContent = "Geolocation not supported."; return; }

    navigator.geolocation.getCurrentPosition(
        async (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            status.textContent = "Reverse geocoding...";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
                const data = await res.json();
                const name = data.address.city || data.address.town || data.address.village || data.address.county || "Current Location";
                saveLocationState(name, lat, lon);
                status.textContent = "Location saved!";
            } catch(e) {
                saveLocationState(`Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`, lat, lon);
                status.textContent = "Coordinates saved (geocoding failed).";
            }
        },
        (err) => { status.textContent = `Error: ${err.message}`; }
    );
}

async function searchLocation() {
    const query = document.getElementById('loc-search-input').value.trim();
    const status = document.getElementById('loc-status');
    if(!query) return;

    status.textContent = "Searching...";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`);
        const data = await res.json();
        if(data && data.length > 0) {
            saveLocationState(data[0].display_name.split(',')[0], data[0].lat, data[0].lon);
            status.textContent = "Location saved!";
        } else {
            status.textContent = "City not found.";
        }
    } catch(e) {
        status.textContent = "Search failed.";
    }
}

function manualLocation() {
    const lat = document.getElementById('manual-lat').value;
    const lon = document.getElementById('manual-lon').value;
    const status = document.getElementById('loc-status');
    if(lat && lon && !isNaN(lat) && !isNaN(lon)) {
        saveLocationState(`Manual (${lat}, ${lon})`, lat, lon);
        status.textContent = "Location saved!";
    } else {
        status.textContent = "Invalid coordinates.";
    }
}

/* ========================================================
   4. PRAYER MATH & CALCULATION (Standalone, Accurate)
======================================================== */
let currentDayTimes = {}; // Stores precise Date objects for today's prayers

// Helper to convert decimal hours to Date object for the currentSelectedDate
function hoursToDate(decimalHours) {
    if (isNaN(decimalHours)) return null;
    const d = new Date(currentSelectedDate);
    const hrs = Math.floor(decimalHours);
    const mins = Math.floor((decimalHours - hrs) * 60);
    const secs = Math.floor((decimalHours - hrs - mins/60) * 3600);
    d.setHours(hrs, mins, secs, 0);
    return d;
}

// Math helpers
const dtr = d => (d * Math.PI) / 180.0;
const rtd = r => (r * 180.0) / Math.PI;
const fixAngle = a => { a = a - 360.0 * Math.floor(a / 360.0); return a < 0 ? a + 360.0 : a; };
const fixHour = h => { h = h - 24.0 * Math.floor(h / 24.0); return h < 0 ? h + 24.0 : h; };

function computeAstronomy(date, lat, lon) {
    // Julian Date for 12:00 UTC
    let year = date.getFullYear();
    let month = date.getMonth() + 1;
    let day = date.getDate();
    if (month <= 2) { year -= 1; month += 12; }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;

    const D = JD - 2451545.0; // Days since J2000

    // Sun position
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * Math.sin(dtr(g)) + 0.020 * Math.sin(dtr(2 * g)));
    const e = 23.439 - 0.00000036 * D;

    // Declination and Equation of Time
    const d = rtd(Math.asin(Math.sin(dtr(e)) * Math.sin(dtr(L))));
    const RA = rtd(Math.atan2(Math.cos(dtr(e)) * Math.sin(dtr(L)), Math.cos(dtr(L)))) / 15.0;
    const EqT = q/15.0 - fixHour(RA);

    return { declination: d, equationOfTime: EqT };
}

function calculateAndRenderPrayers() {
    const loc = appState.location;
    const settings = appState.settings;

    // 1. Astro params
    const astro = computeAstronomy(currentSelectedDate, loc.lat, loc.lon);

    // Timezone offset in hours
    const tzOffset = -currentSelectedDate.getTimezoneOffset() / 60;

    // 2. Base Dhuhr (Transit)
    const dhuhrTime = 12 + tzOffset - (loc.lon / 15.0) - astro.equationOfTime;

    // Helper: calculate time from transit based on sun angle
    const calcAngleTime = (angle) => {
        const num = Math.sin(dtr(-angle)) - Math.sin(dtr(loc.lat)) * Math.sin(dtr(astro.declination));
        const den = Math.cos(dtr(loc.lat)) * Math.cos(dtr(astro.declination));
        const cost = num / den;
        if (cost < -1 || cost > 1) return null; // Sun doesn't reach angle
        return rtd(Math.acos(cost)) / 15.0;
    };

    // 3. Sunrise and Sunset (angle 0.833 accounts for refraction and sun radius)
    const sunAngleTime = calcAngleTime(0.833);
    const sunriseTime = sunAngleTime ? dhuhrTime - sunAngleTime : null;
    const sunsetTime = sunAngleTime ? dhuhrTime + sunAngleTime : null;

    // 4. Asr
    const shadowFactor = settings.asr === 'HANAFI' ? 2 : 1;
    const asrAngle = rtd(Math.atan(1.0 / (shadowFactor + Math.tan(dtr(Math.abs(loc.lat - astro.declination))))));
    const asrAngleTime = calcAngleTime(asrAngle);
    const asrTime = asrAngleTime ? dhuhrTime + asrAngleTime : null;

    // 5. Fajr & Isha angles
    const params = settings.method === 'CUSTOM' ? settings.customAngles : METHODS[settings.method];
    let fajrAngleTime = calcAngleTime(params.fajr);
    let ishaAngleTime = params.ishaIsInterval ? null : calcAngleTime(params.isha);

    // Apply High Latitude Adjustments (Simplified Fallback)
    if (!fajrAngleTime || !ishaAngleTime || settings.highLat !== 'NONE') {
        const nightLen = sunsetTime && sunriseTime ? (sunriseTime + 24 - sunsetTime) : 12;
        if (settings.highLat === 'MIDNIGHT') {
            fajrAngleTime = fajrAngleTime || nightLen / 2;
            ishaAngleTime = ishaAngleTime || nightLen / 2;
        } else if (settings.highLat === 'ONESEVENTH') {
            fajrAngleTime = fajrAngleTime || nightLen / 7;
            ishaAngleTime = ishaAngleTime || nightLen / 7;
        }
    }

    const fajrTime = fajrAngleTime ? dhuhrTime - fajrAngleTime : null;
    let ishaTime = null;
    if (params.ishaIsInterval && sunsetTime) {
        ishaTime = sunsetTime + (params.isha / 60.0);
    } else if (ishaAngleTime) {
        ishaTime = dhuhrTime + ishaAngleTime;
    }

    // Apply Offsets & Build Date Objects
    const applyOffset = (decTime, offsetMins) => {
        if(!decTime) return null;
        return hoursToDate(decTime + (offsetMins / 60.0));
    };

    currentDayTimes = {
        fajr: applyOffset(fajrTime, settings.offsets.fajr),
        sunrise: applyOffset(sunriseTime, settings.offsets.sunrise),
        dhuhr: applyOffset(dhuhrTime, settings.offsets.dhuhr),
        asr: applyOffset(asrTime, settings.offsets.asr),
        maghrib: applyOffset(sunsetTime, settings.offsets.maghrib), // Maghrib = Sunset
        isha: applyOffset(ishaTime, settings.offsets.isha)
    };

    // Render to DOM
    Object.keys(currentDayTimes).forEach(key => {
        const el = document.getElementById(`time-${key}`);
        if(currentDayTimes[key]) {
            el.textContent = currentDayTimes[key].toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } else {
            el.textContent = "---";
        }
    });

    updateTick(); // Force immediate tick to highlight next prayer
}

/* ========================================================
   5. CLOCK & COUNTDOWN
======================================================== */
function updateTick() {
    if (!appState.location.saved || !currentDayTimes.fajr) return;

    const now = new Date();
    let nextPrayerName = null;
    let nextPrayerDate = null;

    // To find "next" prayer, we look at the list sequentially.
    // If we are looking at a different day, disable countdown
    const isToday = currentSelectedDate.toDateString() === now.toDateString();

    document.querySelectorAll('.prayer-item').forEach(el => el.classList.remove('active-prayer'));

    if (isToday) {
        const sequence = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
        for (let p of sequence) {
            if (currentDayTimes[p] && now < currentDayTimes[p]) {
                nextPrayerName = p;
                nextPrayerDate = currentDayTimes[p];
                break;
            }
        }

        // If all prayers today passed, next is Fajr tomorrow (simplification for UI)
        if (!nextPrayerName) {
            nextPrayerName = 'fajr';
            // We just show a fallback text, full accurate tomorrow math requires recalculating
            document.getElementById('next-prayer-name').textContent = "Fajr (Tomorrow)";
            document.getElementById('next-prayer-time').textContent = currentDayTimes.fajr ? currentDayTimes.fajr.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "--:--";
            document.getElementById('countdown').textContent = "--:--:--";
            return;
        }

        // Highlight
        document.querySelector(`.prayer-item[data-prayer="${nextPrayerName}"]`).classList.add('active-prayer');

        // Display Text
        document.getElementById('next-prayer-name').textContent = capitalize(nextPrayerName);
        document.getElementById('next-prayer-time').textContent = nextPrayerDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        // Countdown Math
        const diff = nextPrayerDate - now;
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        const pad = n => n.toString().padStart(2, '0');
        document.getElementById('countdown').textContent = `-${pad(h)}:${pad(m)}:${pad(s)}`;

        // Notification trigger (exactly on the minute)
        if (h === 0 && m === 0 && s === 0) {
            playAthanAlert("Prayer Time", `It is time for ${capitalize(nextPrayerName)}.`);
        }
    } else {
        // Viewing other date
        document.getElementById('next-prayer-name').textContent = "Viewing Date";
        document.getElementById('next-prayer-time').textContent = formatDateStr(currentSelectedDate);
        document.getElementById('countdown').textContent = "--:--:--";
    }
}

/* ========================================================
   6. QIBLA & COMPASS
======================================================== */
const KAABA_LAT = 21.4225;
const KAABA_LON = 39.8262;
let liveCompassActive = false;

function updateQiblaUI() {
    if (!appState.location.saved) {
        document.getElementById('qibla-status').textContent = "Save a location first to view Qibla.";
        document.getElementById('qibla-degree').textContent = "--";
        return;
    }

    document.getElementById('qibla-status').textContent = "";
    const loc = appState.location;

    // Bearing math
    const phiK = dtr(KAABA_LAT);
    const lambdaK = dtr(KAABA_LON);
    const phi = dtr(loc.lat);
    const lambda = dtr(loc.lon);

    const y = Math.sin(lambdaK - lambda);
    const x = Math.cos(phi)*Math.tan(phiK) - Math.sin(phi)*Math.cos(lambdaK - lambda);
    let qiblaBearing = rtd(Math.atan2(y, x));
    qiblaBearing = fixAngle(qiblaBearing);

    document.getElementById('qibla-degree').textContent = qiblaBearing.toFixed(1);

    // Initial static rotation
    if(!liveCompassActive) {
        document.getElementById('compass-dial').style.transform = `rotate(${qiblaBearing}deg)`;
    }
}

function enableLiveCompass() {
    const errorEl = document.getElementById('compass-error');
    if(liveCompassActive) return;

    const handleOrientation = (e) => {
        let compassHeading = e.webkitCompassHeading;
        if (!compassHeading && e.alpha !== null) {
            // Android fallback (alpha relative to earth requires absolute orientation, often unreliable without specific webkit API)
            compassHeading = 360 - e.alpha; 
        }

        if (compassHeading !== undefined && compassHeading !== null) {
            liveCompassActive = true;
            document.getElementById('btn-live-compass').classList.add('hidden');
            const qibla = parseFloat(document.getElementById('qibla-degree').textContent);
            if(!isNaN(qibla)) {
                // Rotate the dial opposite to the device heading, then add qibla offset
                // So when facing North (heading 0), dial points to Qibla.
                // When facing Qibla (heading = qibla), dial points straight UP (0 deg local).
                const rotation = -compassHeading + qibla;
                document.getElementById('compass-dial').style.transform = `rotate(${rotation}deg)`;
            }
        }
    };

    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(permissionState => {
            if (permissionState === 'granted') {
                window.addEventListener('deviceorientation', handleOrientation);
                errorEl.textContent = "";
            } else {
                errorEl.textContent = "Permission denied for compass.";
            }
        }).catch(console.error);
    } else if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientationabsolute', handleOrientation);
        window.addEventListener('deviceorientation', handleOrientation);
        errorEl.textContent = "Listening for compass data (requires HTTPS)...";
    } else {
        errorEl.textContent = "Device orientation not supported by browser.";
    }
}

/* ========================================================
   7. UTILITIES
======================================================== */
function playAthanAlert(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: body, icon: "favicon.ico" }); // Fallback icon
    }
    // Simple browser beep fallback using Web Audio API
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 1);
    } catch(e) { console.log("Audio not supported"); }
}

function formatDateForInput(d) {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function formatDateStr(d) {
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function resetList() {
    ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'].forEach(p => {
        document.getElementById(`time-${p}`).textContent = "--:--";
    });
}

// Boot
window.onload = init;
