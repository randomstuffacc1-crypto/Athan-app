# NoorTime

NoorTime is a premium, static, mobile-first web app for tracking Islamic prayer times and the Qibla. It features a clean, minimal "Apple-like" design and requires absolutely no backend, build system, or paid APIs. 

## Features
- **Frontend Only:** Pure HTML, CSS, and vanilla JS. Works immediately by opening `index.html`.
- **Accurate Calculations:** Computes astronomical equations directly in the browser. 
- **Persisted Storage:** Reliably saves your location and settings to `localStorage`. Refreshing the app will never lose your data.
- **ISNA Default:** Designed specifically with North American default parameters.
- **Qibla Compass:** Uses standard coordinates and device orientation APIs to point to the Kaaba.
- **Tab Navigation:** Polished mobile-app style bottom navigation bar.

## How to Run Locally
Because this app is entirely static, running it is as simple as:
1. Downloading the files.
2. Double-clicking `index.html` to open it in any modern browser.

## How to Deploy on GitHub Pages
1. Create a new repository on GitHub.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md`.
3. Go to Repo **Settings > Pages**.
4. Select `main` branch as the source and click Save.
5. In a few minutes, your site will be live!

## Features Requiring HTTPS
If you are running the app locally using a `file://` URL, some features may be blocked by your browser's security policies. For full functionality, deploy the app via GitHub Pages (which provides HTTPS automatically).
- **Geolocation:** Browsers require HTTPS to request user GPS data.
- **Live Compass:** iOS Safari (`DeviceOrientationEvent`) and Chrome require HTTPS to access accelerometer and gyroscope data.
- **Notifications:** The Web Notifications API requires HTTPS.

## Adding Ads
In `index.html`, there is a `.ad-placeholder` section on the Prayer tab. You can safely replace this `<div>` with standard Google AdSense code `<ins>` tags and the required AdSense script in the `<head>`.

## Data Management & Storage
NoorTime utilizes a robust unified local storage key (`noortime.settings.v4`) to ensure your configurations never reset. If you ever experience data corruption, you can wipe it by clicking **"Reset App to Defaults"** in the **More** tab.

**Disclaimer:** Prayer times calculated astronomically are highly accurate estimates, but exact minute-to-minute timing can vary based on geography, weather, and specific Islamic jurisprudential interpretations. Always confirm times with your local masjid or trusted authority.
