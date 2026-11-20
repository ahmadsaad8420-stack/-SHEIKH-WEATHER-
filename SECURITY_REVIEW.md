# SHEIKH WEATHER — Upgrade & Security Notes

## Upgrade contents
- Preserved the original current conditions, city search, geolocation, °C/°F, theme, hourly and 7-day forecast, air quality, sunrise/sunset, About, Privacy and Terms concepts.
- Split CSS and JavaScript into external files to support a restrictive Content Security Policy.
- Added request cancellation, request sequencing, fetch timeouts, city input bounds, coordinate checks and required forecast payload validation.
- Corrected UV display to use current `uv_index`; daily maximum UV remains available in the provider response but is not mislabeled as current.
- Added forecast-derived heads-up signals, precipitation radar map, installable PWA shell and offline shell fallback.
- Improved dialog focus return/trapping and status announcements.
- Added the developer contact details requested by the owner to the About Developer dialog.
- Added the existing weather logo to the page header and honored reduced-motion preferences.
- Fixed forecast time displays and alert windows to use the selected location's local time; prevented stale air-quality and geolocation responses from replacing newer selections.
- Ensured aborted fetch signals are handled and detached after each request.
- Reworked the mobile weather scene to keep effects visible without covering the forecast text.

## Security controls included
- `_headers` (Netlify-compatible) and `vercel.json` examples for CSP, frame protection, MIME sniffing, referrer and permissions policies.
- No API secret is embedded; Open-Meteo endpoints are public data endpoints.
- Service worker caches only same-origin app shell resources; third-party API responses and location-specific data are not cached.
- Dynamic city/weather values are rendered with `textContent` and DOM node creation. Modal HTML is fixed developer-authored markup only.

## Important deployment steps
1. Deploy on HTTPS. HSTS is intentionally not enabled by default; enable it at the host only after confirming HTTPS across the intended domain/subdomains.
2. Configure the included headers for your actual hosting provider. `_headers` is suitable for Netlify-style static hosting; `vercel.json` is a Vercel example. Other hosts need equivalent server/CDN configuration.
3. Review Open-Meteo, RainViewer and OpenStreetMap usage/attribution terms and service limits before public or high-traffic use.
4. The radar uses Leaflet from unpkg and RainViewer radar tiles. If either provider/CDN is unavailable, weather dashboard remains usable; radar may not load.
5. Automated “Weather alerts” are heuristic forecast signals, NOT official meteorological or emergency alerts. Never rely on them for life-safety decisions.
6. PWA install and service worker require HTTPS (localhost is acceptable for development). Offline mode provides the app shell only; live weather/radar require connectivity.
7. Developer contact details are displayed publicly in the About Developer dialog; verify them before deployment.

## Validation performed
- Static checks after these edits: duplicate HTML IDs, local asset links, manifest and Vercel JSON, SVG, and targeted timezone/weather fixes.
- ZIP integrity test; the `.nojekyll` GitHub Pages marker is included.
- JavaScript syntax validation could not run because Node.js is unavailable in the editing environment.

## Not performed / limitations
No live penetration test, hosting-header verification, automated browser test, dependency vulnerability scan, accessibility certification or API uptime guarantee was performed. This package is hardened as a static front-end starter, not certified production-secure. Test on the actual deployment domain and browsers before release.
