# NoorTime

NoorTime is a static, mobile-first Athan web app for daily prayer times, qibla direction, calculation settings, reminders, and backup/import settings.

## What changed in this build

- App-style bottom navigation: Prayer, Location, Qibla, Settings, More.
- Home screen only shows the next prayer countdown and daily prayer list.
- Default calculation method is ISNA / North America.
- Settings and location are saved in `localStorage` using `noortime.settings.v3`.
- Legacy settings from earlier NoorTime builds are migrated.
- Smaller, iPhone-friendly typography and spacing.
- Numeric qibla bearing always works after location is saved.
- Live compass is optional and depends on browser/device support.

## Run locally

Open `index.html` in a browser.

Some browser features are limited when opened as a local file:

- GPS may work inconsistently.
- Compass may not work.
- Notifications may be blocked.

For best testing, deploy to GitHub Pages or run a local server.

## Deploy to GitHub Pages

1. Upload `index.html`, `styles.css`, `app.js`, and this `README.md` to the root of your GitHub repository.
2. Go to repository Settings.
3. Open Pages.
4. Select your branch, usually `main`.
5. Select root folder.
6. Save.
7. Open the GitHub Pages URL after deployment finishes.

GitHub Pages uses HTTPS, which helps with GPS, compass permissions, and notifications.

## Features that require HTTPS

- Browser GPS/geolocation works best on HTTPS.
- Live compass/device orientation often requires HTTPS and user permission.
- Browser notifications usually require HTTPS and manual user approval.

## Location storage

Location and app settings are saved locally in the browser using `localStorage`. They are not sent to a backend because this app has no backend.

If location resets after refresh, check:

- You are not in private browsing mode.
- Browser storage/site data is not blocked.
- You uploaded the latest `app.js` file.
- You hard refreshed the GitHub Pages site after uploading the update.

## Ads

The ad cards are placeholders. Replace the contents of the `.ad-card` sections in `index.html` with your future ad code, such as Google AdSense. Avoid popups, autoplay video, and overlays.

## Disclaimer

Prayer times are estimates based on location, calculation method, and astronomical formulas. Users should confirm prayer times with their local masjid or trusted Islamic authority, especially during Ramadan, for high-latitude locations, or where local conventions differ.
