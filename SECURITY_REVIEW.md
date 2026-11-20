# SHEIKH WEATHER — Security & Quality Review

Review date: 2026-11-20. Scope: all files in this package (static front-end, no backend, no secrets).

## Issues found and fixed
| # | Issue | Fix |
|---|-------|-----|
| 1 | Security headers lived only in `_headers`/`vercel.json`, which **GitHub Pages ignores** → no CSP was actually active on the live site. | CSP added as `<meta>` in `index.html`; header files kept for hosts that support them. |
| 2 | Leaflet loaded from unpkg CDN (third-party script, availability and supply-chain risk). | Leaflet 1.9.4 bundled locally (files byte-identical to the SRI-pinned originals); CSP is now `script-src 'self'`, `style-src 'self'`. |
| 3 | OSM tile CSP pattern `*.tile.openstreetmap.org` did not match OSM's current host `tile.openstreetmap.org`. | Tile URL and CSP updated. |
| 4 | Radar tile host/path were taken from the API response unchecked. | Host pinned to `tilecache.rainviewer.com`; frame path/time validated. |
| 5 | Dialogs were built with `innerHTML` (and the Terms paragraph was unclosed). | Content moved to `<template>` elements and cloned; `innerHTML` no longer used. |
| 6 | Animation loop was restarted on every refresh → CPU use grew with each update. | Single `requestAnimationFrame` loop. |
| 7 | "Now" hour showed the *next* hour; alert window started at the next hour. | Index now uses the current hour slot. |
| 8 | "Latest radar frame" could be a *forecast* (nowcast) frame. | Newest observed frame is used. |
| 9 | Missing values (`null`) were displayed as `0°`. | Shown as `—`. |
| 10 | Exact GPS coordinates sent to third parties. | Rounded to ~1 km before requests. |
| 11 | AQI badge was always green. | Colour follows the European AQI band. |
| 12 | PWA: SVG-only icon, `any maskable` combined; no PNG icons. | PNG 192/512, maskable and apple-touch icons added; manifest cleaned. |
| 13 | Inline styles, no `<h1>`, no skip link, no `<noscript>`, buttons without `type`. | Fixed (also removes need for `unsafe-inline` styles). |
| 14 | ZIP used Windows `\` path separators (can break extraction on Linux/macOS). | Re-packaged with `/`. |
| 15 | Privacy policy out of date with the above changes. | Updated. |

## Security controls
- CSP: `default-src 'self'`, scripts/styles only from the site itself, `connect-src` limited to Open-Meteo and RainViewer, `object-src 'none'`, `base-uri 'self'`.
- All dynamic text is written with `textContent`/DOM nodes. No secrets or API keys exist in the code.
- Service worker only handles same-origin GET requests; API and tile responses are never cached.
- Theme choice is the only data stored (`localStorage`).

## Verified
- JavaScript syntax check (Node 22), JSON validity.
- Headless Chromium run with mocked APIs on desktop and mobile widths: no console errors or CSP violations; search, unit toggle, theme, geolocation, dialogs, radar and offline-shell registration exercised; only expected third-party origins contacted.

## Remaining notes / not covered
- **GitHub Pages cannot send `X-Frame-Options`/`frame-ancestors`** (meta CSP cannot set them). Use Netlify/Vercel/Cloudflare for full clickjacking protection. Impact for a weather page is low.
- HSTS is not set by default; enable it at the host once HTTPS is confirmed for the domain.
- The About dialog publicly shows the developer's phone, email and address (owner's choice). Consider removing the phone/address to reduce spam and privacy exposure.
- No live penetration test, accessibility certification or provider-uptime guarantee. Check Open-Meteo, RainViewer and OSM usage terms before high-traffic use. A software licence for this project's own code has not been chosen.
