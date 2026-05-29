# NoorTime

NoorTime is a premium, static, mobile-first Athan web app for Islamic prayer times and Qibla direction. It is designed to feel clean, minimal, fast, and polished, with a bottom-tab mobile app layout.

## Features

- Frontend only: HTML, CSS, and vanilla JavaScript
- No backend, login, framework, build system, or paid API
- Works by opening `index.html` in a browser
- Works on GitHub Pages
- Bottom navigation tabs: Prayer, Location, Qibla, Settings, More
- Prayer time calculation in the browser using solar position formulas
- Prayer times for Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha
- Date selector for viewing another day
- Saved location with persistent `localStorage`
- GPS location support when available
- Manual city/address search using OpenStreetMap Nominatim
- Manual latitude/longitude entry
- Qibla bearing from saved location to the Kaaba
- Optional live compass/device orientation support
- Calculation method settings, Asr method, high-latitude adjustment, and prayer offsets
- Browser notification support while the app is open
- Export/import settings JSON
- Storage diagnostic screen
- Small non-intrusive sponsored placeholder cards

## How to run locally

1. Download the project files.
2. Open `index.html` in a modern browser.

No install step is required.

Some browser APIs may be limited when opening a local file directly. Prayer calculations, saved settings, manual location, and Qibla numeric direction should still work.

## How to deploy on GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. In GitHub, open **Settings**.
4. Go to **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and root folder.
7. Save.
8. Open the GitHub Pages URL after deployment finishes.

## Features that may require HTTPS

The following browser features usually require HTTPS and may not work when opening `index.html` directly as a file:

- Geolocation / GPS
- Browser notifications
- Compass / device orientation

GitHub Pages uses HTTPS, so these features are more likely to work there. iPhone Safari may also require a manual permission request for device orientation.

## Calculation methods included

Default method: **ISNA / North America**

Available methods:

- Muslim World League: Fajr 18, Isha 17
- ISNA / North America: Fajr 15, Isha 15
- Egyptian General Authority: Fajr 19.5, Isha 17.5
- Umm al-Qura / Makkah: Fajr 18.5, Isha 90 minutes after Maghrib
- University of Islamic Sciences Karachi: Fajr 18, Isha 18
- Shia Ithna-Ashari / Jafari: Fajr 16, Isha 14
- Custom: user-defined

## localStorage

NoorTime stores settings locally in the browser using this key:

```text
noortime.settings.v4
```

Saved data includes:

- Location name
- Latitude
- Longitude
- Location source
- Saved timestamp
- Calculation method
- Fajr/Isha angles
- Isha fixed interval
- Asr method
- High-latitude adjustment
- Manual offsets
- Notification preference

No account or server is used.

## How to reset settings

Open the **More** tab and press **Reset App / Settings**.

You can also clear the app data manually in your browser settings by deleting site data for the domain where NoorTime is hosted.

## Ad placeholder replacement

The included sponsored cards are only placeholders. To replace them with AdSense or another ad network:

1. Find the elements with class `ad-card` in `index.html`.
2. Replace the placeholder text inside the card with your approved ad network code.
3. Keep ads small and non-intrusive for the best user experience.

Avoid popups, overlays, autoplay video, or anything that blocks prayer time content.

## Important disclaimer

Prayer times are estimates calculated in the browser. Users should confirm times with their local masjid or trusted local authority, especially when traveling, living in high-latitude areas, or following a community-specific timetable.

