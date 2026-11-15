# Stargazing Planner — Frontend

This directory contains the three-page static frontend for the Stargazing Planner CS 310 project. It uses plain HTML, CSS, and JavaScript; **no npm install or build step is required**.

## Quick start

Prerequisites: Python 3 (or any static HTTP server) and a modern browser.

From the repository root:

```bash
cd stargazing-frontend
python -m http.server 8000
```

On Windows, if `python` is unavailable, use `py -m http.server 8000` instead.

Open **http://localhost:8000** in your browser. Stop the server with **Ctrl+C**.

> Do not open `index.html` using a `file://` URL. Serve the files over HTTP so the browser can load external resources consistently.

## API configuration

Set the deployed API Gateway stage URL in `config.js`:

```js
window.STARGAZING_CONFIG = {
  API_BASE_URL: 'https://rtjjaqk68j.execute-api.us-east-2.amazonaws.com/test',
  REQUEST_TIMEOUT_MS: 45000
};
```

The frontend calls two endpoints under this base URL:

1. `POST /stargazing/plan` with `location_type`, `location`, `state`, `date`, `start_time`, and `end_time`.
2. `POST /stargazing/nearby` with the `latitude`, `longitude`, `timezone`, `start_utc`, and `end_utc` returned by Plan. When present, the unrounded Plan `baseline_score` is included as well.

**Important:** The JSON sent by the browser is the API payload, **not** the Lambda console testing envelope containing `isBase64Encoded` and a serialized `body` string.

## Using the site

1. On the home page, search for a **U.S. city** (Open-Meteo suggestions) or a **U.S. street address** (Photon suggestions). Select a suggestion; incomplete free text is not submitted as a verified location.
2. Choose a date and local start/end times. Time inputs use the browser computer's timezone. The frontend converts the interval to the selected place's local wall-clock time for Plan. UTC values returned by Plan are used for Nearby.
3. Press **Find stargazing conditions** to open the nearby-results page. Its map shows a 50 km radius and candidates in the order returned by the API. The main location can also be opened.
4. Click a map marker or location chip to view a site's score, sky brightness, best observation window, and detail map. Times on the detail page are shown in the browser's local time using numeric English formatting.

The backend's scoring window is currently **60 minutes**. Address geocoding relies on source-data coverage, and a site may not have an eligible observation window.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Three page sections, forms, and data-source attribution |
| `styles.css` | Responsive layout and the dark-night theme |
| `app.js` | Autocomplete, API requests, time handling, results, and Leaflet maps |
| `config.js` | API Gateway base URL and timeout |
| `assets/night-sky.png` | Full-page background image |
| `assets/favicon.svg` | Browser tab icon |

## External services and internet access

- Leaflet JavaScript/CSS: `unpkg.com`
- Map tiles: `tile.openstreetmap.org`
- City autocomplete: `geocoding-api.open-meteo.com`
- Street-address autocomplete and reverse address lookup: `photon.komoot.io`
- Stargazing results: the configured AWS API Gateway URL

The public Photon service can throttle heavy request volumes. The app also requires network access to the external map and geocoding domains.

Photon street-address suggestions do not currently supply a verified IANA timezone. For addresses outside your computer's timezone, confirm time conversion with the backend before using the displayed observation times; city suggestions include a location timezone.

## Troubleshooting

**Network/CORS error when searching:** Check the browser DevTools **Network** tab for `OPTIONS` and `POST` requests. API Gateway must allow the frontend's origin, `Content-Type`, `POST`, and `OPTIONS`. Client-side JavaScript cannot fix a CORS denial.

**`Missing Authentication Token`:** Opening a POST-only API endpoint directly in the browser sends GET. Check that the URL, stage, and route are correct and test with POST.

**Map does not appear:** Check DevTools **Console** and **Network** for blocked Leaflet scripts, map tiles, or initialization errors. The map uses OpenStreetMap tiles and does not require a CARTO API key.

**No nearby locations:** This can be a valid API response. `candidate_count`, `shortlisted_count`, and `evaluated_count` count backend processing stages, not the number of items in `alternatives`. The UI renders the `alternatives` that were actually returned.

**Street address has no suggestions:** Try entering the house number, street, city, and state. Photon relies on OpenStreetMap coverage and may not return every address.

## Deploying the frontend to S3

Upload the **contents** of this folder (not the containing folder itself) to the S3 website bucket/prefix used for your site:

```text
index.html
styles.css
app.js
config.js
assets/night-sky.png
assets/favicon.svg
```

Make sure S3 serves `index.html` as the index document, public access is configured according to your project's hosting arrangement, and the API Gateway CORS allowed-origin matches the deployed web origin. When updating the files, refresh the browser cache if an old version is still displayed.

## Source attribution

The site's footer credits Open-Meteo (cloud forecasts, CC BY 4.0), Open-Meteo/GeoNames (city geocoding), U.S. Census Geocoder (backend U.S. addresses), DarkSkySites (modeled SQM/Bortle), Overture Maps (observatory candidates), and Astronomy Engine (Sun/Moon calculations). Photon and OpenStreetMap are also used by the frontend for address suggestions and maps.
