# Hole Lotta Problems

Mobile-first PWA for crowdsourced road-hazard reporting in Toronto. Map view with live hazards along your route, plus
pages for community shame & gamification.

## Stack

- **Frontend** — React 18 + Vite + Tailwind + react-leaflet, multi-page (BrowserRouter)
- **Backend** — Flask + uv-managed Python 3.14, in-memory hazard store
- **External** — Nominatim for geocoding, OSRM (with cached fallback) for routing, CARTO Voyager tiles

## Run

Two terminals from the repo root:

```bash
# Terminal 1 — backend (port 5001)
cd backend && uv sync && uv run python app.py

# Terminal 2 — frontend (port 5173)
cd frontend && npm install && npm run dev
```

Then open **http://localhost:5173** in Chrome. Vite proxies `/api/*` to the Flask backend, so no CORS configuration is
required during dev.

> Backend listens on **:5001** — avoid :5000 (collides with macOS AirPlay).

### IDE: add the Python interpreter

After `uv sync` creates `backend/.venv/`, point your IDE at `backend/.venv/bin/python` (PyCharm: Settings → Project →
Python Interpreter → Add Existing; VS Code: `Python: Select Interpreter`).

## Pages

| Route            | What it does                                                                                                                                                                                                                                                                               |
|------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/map`           | Toronto-centred Leaflet map. Lists hazards from `/api/hazards`. Search bar with viewport-biased Nominatim autocomplete (origin + destination). Drawing a route via OSRM highlights hazards within 50 m and lists them in order. Locate-me control pulses a blue dot at your real position. |
| `/report`        | Form-driven hazard submission: type (Pothole/Debris/Flooding/Other), severity (Minor/Moderate/Severe), description, location captured via `navigator.geolocation`. Submits to `POST /api/hazards`.                                                                                         |
| `/hall-of-shame` | Static UI: leaderboard of T<br/>oronto's worst potholes (mocks).                                                                                                                                                                                                                           |
| `/council`       | Static UI: ward-by-ward shame scoreboard with X/Twitter share links (mocks).                                                                                                                                                                                                               |
| `/rewards`       | Static UI: gamification — points, levels, weekly streak, top reporters (mocks).                                                                                                                                                                                                            |

`/hall-of-shame`, `/council`, `/rewards` are intentionally mock-only for now — wiring them to real data is a follow-up.

## Hazard schema

```json
{
  "id": "uuid (assigned by backend)",
  "lat": "number, WGS84",
  "lng": "number, WGS84",
  "type": "pothole | debris | flooding | other",
  "severity": "Minor | Moderate | Severe (default: Moderate)",
  "description": "string, ≤500 chars (optional)",
  "reportedAt": "ISO 8601 UTC"
}
```

## Endpoints

|                                               |                                                                                                       |
|-----------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `GET /api/health`                             | Smoke check                                                                                           |
| `GET /api/hazards`                            | List all hazards                                                                                      |
| `POST /api/hazards`                           | Body `{lat, lng, type, severity?, description?}` → `201` with full hazard. Validates type + severity. |
| `GET /api/hazards/nearby?lat=&lng=&radius_m=` | Haversine filter (default 1 km)                                                                       |
| `POST /api/route/hazards`                     | Body `{route: [[lat,lng], ...]}` → hazards within 50 m, sorted by distance along route                |
| `GET /api/canned_route`                       | Cached OSRM response (fallback when public OSRM 429s)                                                 |

## Demo flow

1. Open **http://localhost:5173** — defaults to `/map`.
2. Two ways to report a hazard:
    - **Quick FAB** — orange `+` button hovering above the bottom nav. Opens a 4-button type sheet; pick one and it
      submits at your current location with severity Moderate.
    - **Report tab** — full form with severity choice and optional description.
3. Type a destination in the **B** input — autocomplete suggestions appear; pick one, route draws, "On Your Route"
   panel populates.
4. **Show your location** button (bottom-right of the map) drops a pulsing blue dot at your real position.
5. **Hall of Shame**, **Council**, **Rewards** are mock UIs — useful for the demo narrative, not wired to live data.

## Backend state

In-memory list. Seeded from `backend/seed_hazards.json` on startup *if* seed loading is enabled in `app.py` (currently
disabled — the running store starts empty so the demo can be driven entirely by the Report flow). Restart the backend to
reset state.
