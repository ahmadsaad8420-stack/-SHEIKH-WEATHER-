# SHEIKH WEATHER

A responsive, installable (PWA) weather dashboard: current conditions, city search, optional geolocation, hourly and 7-day forecast, European AQI, precipitation radar, forecast-based heads-up alerts, animated weather scene, °C/°F and Auto/Light/Dark theme.

## Run locally
Use a local web server (service workers and geolocation do not work from `file://`):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Internet access is needed for live data, map tiles and radar.

## Deploy
Static hosting over HTTPS (GitHub Pages, Netlify, Vercel, Cloudflare Pages). See `GITHUB_UPLOAD_BN.txt` for the GitHub Pages steps (Bengali).

- A Content-Security-Policy is embedded in `index.html`, so it is active even on GitHub Pages.
- Hosts that support custom headers (Netlify: `_headers`, Vercel: `vercel.json`) additionally get `frame-ancestors`/`X-Frame-Options` (clickjacking protection), COOP and `upgrade-insecure-requests`. GitHub Pages cannot send custom headers.
- See `SECURITY_REVIEW.md` for details and limitations.

## Data providers & credits
- Weather, geocoding, air quality: [Open-Meteo](https://open-meteo.com/)
- Radar: [RainViewer](https://www.rainviewer.com/) · Base map: © OpenStreetMap contributors
- Map library: [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause), bundled in `assets/vendor/leaflet/` — no third-party CDN scripts are loaded.

## Alert limitation
Alerts are simple forecast-derived signals, **not** official warnings. Follow your local meteorological authority in dangerous weather.

## Structure
```
index.html              page shell, CSP, legal-dialog templates
assets/css/styles.css   styles
assets/js/app.js        application logic
assets/vendor/leaflet/  Leaflet 1.9.4 (unmodified, with LICENSE)
assets/icons/           SVG + PNG (192/512/maskable/apple-touch) icons
manifest.webmanifest    PWA metadata
service-worker.js       same-origin app-shell cache (offline fallback)
_headers, vercel.json   optional security headers
```
