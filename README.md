# NoorTime

NoorTime is a polished, mobile-friendly single-page Athan web app. It calculates daily Islamic prayer times from the user's location, shows the next prayer and live countdown, calculates qibla direction, supports manual prayer-time adjustments, and stores settings locally in the browser.

## Features

- Automatic GPS location using the browser geolocation API
- Manual city/address search using OpenStreetMap Nominatim
- Manual latitude and longitude entry
- Daily prayer times for Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha
- Next prayer highlight and live countdown
- Date picker for viewing another date
- Calculation method presets:
  - Muslim World League
  - ISNA / North America
  - Egyptian General Authority
  - Umm al-Qura / Makkah
  - University of Islamic Sciences Karachi
  - Shia Ithna-Ashari / Jafari
  - Custom
- Manual Fajr and Isha angle overrides
- Optional Isha fixed interval
- Standard or Hanafi Asr calculation
- High-latitude adjustment options
- Per-prayer minute offsets
- Qibla bearing to the Kaaba with a visual compass dial
- Optional live compass mode when supported by the device/browser
- Browser notifications while the app is open
- Test tone button with no autoplay
- Local settings persistence with localStorage
- Export and import settings as JSON
- Non-intrusive banner ad placeholders
- Responsive dark-mode glassmorphism design

## How to run locally

Option 1: Open directly

1. Download or clone this folder.
2. Open `index.html` in your browser.

Option 2: Run a simple local server

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

A local server is recommended because some browser APIs and external geocoding requests can behave differently when opened as a raw local file.

## How to deploy to GitHub Pages

1. Create a new GitHub repository, or use an existing one.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
3. In GitHub, go to **Settings** → **Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose your main branch and root folder.
6. Save, then open the GitHub Pages URL after deployment finishes.

## Features that require HTTPS

GitHub Pages uses HTTPS, which is good for NoorTime.

These features generally require HTTPS or localhost:

- Browser GPS/geolocation
- Browser notifications
- Device orientation/live compass permission

Manual latitude/longitude entry and prayer time calculation do not require HTTPS.

## Ads

The app includes small placeholder ad cards near the top and bottom of the page. They are intentionally non-intrusive and do not cover the content.

To replace them with real ad code later, edit the `<section class="ad-card">` blocks in `index.html` and insert your ad network code, such as Google AdSense. Avoid popups, autoplay videos, sticky overlays, or anything that blocks prayer times.

## Prayer time accuracy disclaimer

NoorTime calculates estimated prayer times using astronomical formulas and common calculation-method presets. Local masjids may use different conventions, safety margins, high-latitude rules, Ramadan timetables, or local adjustments.

Always confirm prayer times with your local masjid or trusted local Islamic authority.

## Privacy

NoorTime does not require a login or backend. Settings are stored in your own browser using localStorage. If you use city/address search, the search request is sent to OpenStreetMap Nominatim to convert the address into coordinates.
