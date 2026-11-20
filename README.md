# SHEIKH WEATHER — Professional Edition

A responsive weather dashboard with current conditions, city search, optional geolocation, hourly and 7-day forecasts, European AQI, precipitation radar, forecast-based heads-up alerts, system-aware theme and temperature controls, and PWA support.
The entire current-weather hero card is an animated 3D-style weather scene: sunlight for clear/partly cloudy weather, dimensional clouds, falling rain or snow, fog, and moonlight at night. The scene follows the selected location's current forecast, with the weather details layered over it. A live local clock and manual refresh control are included.
The SHEIKH WEATHER header logo and browser-tab icon are embedded in `index.html`, so they do not depend on a case-sensitive asset path on GitHub Pages. The installable app icon remains in `assets/icons/icon.svg`. Forecast times, alert windows, and the live clock follow the selected location's timezone.
On narrow screens, the weather scene keeps clouds and precipitation to the right side of the hero so the forecast text stays clear.
Theme defaults to the device preference and follows system changes while set to Auto. Use the theme button to cycle through Auto, Light, and Dark; a chosen Light/Dark mode is remembered.

## Run locally
Use a local web server (service workers and geolocation do not work reliably from `file://`):

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Keep internet access enabled for live data, map tiles and radar.

## Hosting
- Deploy the contents of this folder to a static host over HTTPS.
- `_headers` contains Netlify-style security headers. `vercel.json` contains a Vercel header example. Configure equivalent headers if using another host.
- Service worker and PWA install require HTTPS or localhost.
- Review `SECURITY_REVIEW.md` before public deployment.

## Data providers
- Weather, geocoding and air quality: Open-Meteo.
- Base map: OpenStreetMap contributors.
- Precipitation radar: RainViewer.

## Alert limitation
Weather alerts are simple forecast-derived heads-up signals, not official alerts. Consult your local meteorological authority for warnings and emergency instructions.

## Files
- `index.html` — application shell
- `assets/css/styles.css` — styles
- `assets/js/app.js` — application logic
- `manifest.webmanifest` — PWA metadata
- `service-worker.js` — same-origin app-shell caching
- `_headers`, `vercel.json` — hosting security-header examples
- `SECURITY_REVIEW.md` — security and deployment notes
