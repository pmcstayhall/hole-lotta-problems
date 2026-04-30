# Road Hazard Alert & Navigation System

**For Drivers and Cyclists — 4-Hour Hackathon Implementation Plan (Agent Edition)**

---

## Description

Build a mobile-first, browser-based application that combines navigation with crowdsourced road-hazard reporting. A user
opens the app, sees hazards reported by others on a live map, can search for a destination and have a route drawn, and
can report a new hazard at their current location with a single tap. Newly reported hazards appear on every other user's
map immediately.

This document is the implementation plan for a developer agent executing the build in a single 4-hour session, starting
from an empty repository. It is structured as a sequence of imperative tasks with locked data schemas, exact API
contracts, library choices, and explicit fallback branches at each checkpoint.

### Intent

- Optimise for a working live demo at the 4-hour mark, not for production-readiness.
- Prefer reliability over feature breadth. Cut anything whose failure mode would derail the demo.
- Land an end-to-end working slice early (the MVP, by the 90-minute mark) before adding any further capability.
- Keep all dependencies free, public, and CDN- or pip-installable. No build step, no bundler, no auth, no database.
- Design every feature to degrade gracefully. If geolocation is denied, the app still works. If routing fails, the map
  still works. If voice fails, text still works.

### Constraints

- Total wall-clock budget: 4 hours, single agent.
- Stack: Python 3.10+ / Flask backend, vanilla-JS / Leaflet frontend, in-memory data store seeded from JSON.
- No build step. Frontend is a single `index.html` plus static assets served by `python -m http.server`.
- Demo must run on a single laptop. No phone, no HTTPS, no tunnelling required for the critical path.
- Cut from scope: PWA, Service Worker, offline tiles, authentication, persistent database, websockets, turn-by-turn
  voice navigation.

### Definition of Done

- Two browser tabs open against the same backend show the same hazard set on a Leaflet map.
- Clicking the report FAB in either tab posts a hazard to the backend; refreshing the other tab shows it.
- A search bar geocodes a destination string via Nominatim and recenters the map on the result.
- *(Stretch)* Submitting a destination draws an OSRM route and highlights hazards within 50 m of that route.
- All four hour-boundary exit criteria below pass before declaring done.

---

## Repository Layout

Create exactly this structure at Hour 0. Do not deviate.

```
road-hazard/
├── backend/
│   ├── app.py              # Flask app, all endpoints
│   ├── geo.py              # Haversine, polyline-distance helpers
│   ├── seed_hazards.json   # 5 demo hazards near venue
│   └── requirements.txt    # flask, flask-cors, shapely, pyproj
├── frontend/
│   ├── index.html          # Map, FAB, search bar
│   ├── app.js              # All JS logic
│   ├── styles.css          # Layout + FAB + sheet styles
│   └── config.js           # API_BASE_URL constant
├── demo/
│   ├── screencast.mp4      # Recorded fallback (Hour 4)
│   └── canned_route.json   # OSRM fallback (Hour 3)
└── README.md               # 5-line run instructions
```

---

## Locked Data Schemas

Lock these at Hour 0 and do not modify mid-session. Schema drift is the #1 time sink.

### Hazard object

```json
{
  "id": "string (UUID4, assigned by backend)",
  "lat": "number (WGS84, 6 decimal places)",
  "lng": "number (WGS84, 6 decimal places)",
  "type": "pothole | debris | flooding | other",
  "reportedAt": "string (ISO 8601 UTC, e.g. 2026-04-30T14:32:01Z)"
}
```

### `POST /api/hazards` request body

```json
{
  "lat": 0.0,
  "lng": 0.0,
  "type": "pothole"
}
```

- Response: `201 Created` with the full Hazard object.
- Validation: `type` must be in the allowed set; `lat`/`lng` must be valid floats. Reject with `400` otherwise.

### `POST /api/route/hazards` request body (stretch)

```json
{
  "route": [
    [
      lat,
      lng
    ],
    [
      lat,
      lng
    ],
    "..."
  ]
}
```

Response: `200` with an array:

```json
[
  {
    "hazard": {
      "...Hazard": "..."
    },
    "distanceAlongRouteM": 0.0,
    "perpendicularDistanceM": 0.0
  }
]
```

### `seed_hazards.json`

Five hand-picked coordinates within 1 km of the demo venue, mixed types. Loaded by `app.py` at startup into the
in-memory list.

---

## Hour 0 (0–30 min): Setup

Create the structure above and verify both servers run. Treat this hour as load-bearing — the rest of the plan assumes
it succeeded.

### Backend setup

1. Create `/backend` with the file layout above.
2. Write `requirements.txt`: `flask>=3.0`, `flask-cors>=4.0`, `shapely>=2.0`, `pyproj>=3.6`.
3. Create venv and install:
   ```bash
   python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
   ```
4. Write a minimal `app.py` exposing `GET /api/health` → `{"ok": true}`. CORS enabled for all origins (dev only).
5. Run: `flask --app app run --port 5001`. Confirm `curl http://localhost:5001/api/health` returns `ok`.

> **Use port `5001`, not `5000`.** Port 5000 conflicts with macOS AirPlay Receiver and is the most common silent failure
> on this stack.

### Frontend setup

1. Create `/frontend` with `index.html`. Include Leaflet 1.9.4 from CDN, a full-viewport `<div id="map">`, and a script
   tag for `app.js`.
2. Write `app.js` to instantiate `L.map('map')`, add the OSM tile layer, and drop one hardcoded marker. This is the
   smoke test that tiles load.
3. Serve: `python -m http.server 8000` from `/frontend`.
4. Open `http://localhost:8000` in Chrome. Verify the map renders and the marker is visible. **If tiles do not load, fix
   this now — no later step works without it.**

### Hour 0 exit criteria

- [ ] `curl GET http://localhost:5001/api/health` returns 200.
- [ ] Browser at `http://localhost:8000` shows a Leaflet map with one marker.
- [ ] `/backend/seed_hazards.json` exists with 5 entries matching the Hazard schema.

---

## Hour 1 (30–90 min): MVP — Reporting + Shared Map

**Goal:** by the 90-minute mark, two browser tabs against the same backend can each create hazards and see each other's
hazards after refresh. This is the contract. If anything in this hour slips, do not proceed to Hour 2 until it is met.

### Backend tasks

1. Implement the in-memory store: load `seed_hazards.json` into a module-level list at app start.
2. Implement `GET /api/hazards` — return the list as a JSON array. No pagination, no GeoJSON wrapping.
3. Implement `POST /api/hazards` — validate body against the locked schema, generate UUID and timestamp, append, return
   `201` with the full object.
4. Implement `GET /api/hazards/nearby?lat=&lng=&radius_m=` — Haversine filter. Default radius 1000 m. Needed in Hour 3
   but cheap to add now.

Place all distance math in `geo.py` so it is reusable in Hour 3.

### Frontend tasks

1. On page load, fetch `GET /api/hazards` and drop a marker per hazard. Marker colour by type: pothole=red,
   debris=orange, flooding=blue, other=grey.
2. Add a fixed bottom-right FAB. On click, attempt `navigator.geolocation.getCurrentPosition` with a 5-second timeout.
3. On geolocation success, POST to `/api/hazards` with the user's coordinates and type `"pothole"` (default for MVP). On
   failure or denial, fall back to the current map center and toast `"Using map center"`. **Never block on this.**
4. On a successful POST response, add the returned hazard to the map without a full refetch.

### Hour 1 exit criteria

- [ ] Five seeded hazards visible on map load.
- [ ] FAB click in Tab A creates a hazard; refreshing Tab B shows it.
- [ ] Geolocation denial does not error — it falls back to map center silently.

> **If exit criteria are not met by 1:30:** stop, do not start Hour 2. Spend Hour 2 hardening this MVP. The MVP alone is
> a defensible demo.

---

## Hour 2 (90–150 min): Geocoding & Hazard Typing

Adds a search bar (so the demo isn't "a map of one neighbourhood") and a hazard-type picker (so the user-facing feature
matches the data model). Lower-risk than routing; do this before Hour 3 even if you have spare time.

### Backend tasks

1. Tighten `POST /api/hazards` validation: reject unknown `type` values with `400` and a JSON error body
   `{ "error": "invalid type" }`.
2. Add a 30-second sliding-window rate limit on POST (max 10/min from one IP) using an in-memory deque. Prevents
   accidental floods during demo.

### Frontend tasks

1. Add a search input in the top bar. On submit, query Nominatim:
   ```
   GET https://nominatim.openstreetmap.org/search?format=json&limit=1&q=<query>
   ```
2. Set a `User-Agent` header (Nominatim requires it). Recenter the map on the first result and drop a destination
   marker.
3. Replace the single FAB with a sheet that exposes the four hazard types as buttons. Tap-type-then-confirm pattern:
   select type, then tap the FAB at current location.
4. Add `navigator.vibrate(200)` on successful report. Cheap, works on Android, harmless elsewhere.

### Hour 2 exit criteria

- [ ] Searching `"Federation Square"` recenters the map there.
- [ ] Reporting now records the selected type; the map renders the correct colour.
- [ ] POSTing an invalid type returns `400` (test with curl).

> **Decision point at 2:25:** if Hour 2 is done and stable, continue to Hour 3 routing. If anything is shaky, skip Hour
> 3 entirely and go straight to Hour 4 polish.

---

## Hour 3 (150–210 min): Routing & Hazards Along Route — Stretch

**Optional.** The single most likely point of failure is the polyline-distance math; do not write it from scratch. Use
shapely with a projected CRS, or skip this hour entirely.

### Backend tasks

Implement `POST /api/route/hazards` using shapely:

```python
from shapely.geometry import LineString, Point
from shapely.ops import transform
import pyproj

# Project to a metric CRS for accurate distance
project = pyproj.Transformer.from_crs(4326, 3857, always_xy=True).transform
route_m = transform(project, LineString([(lng, lat) for lat, lng in route]))

results = []
for hz in hazards:
    pt_m = transform(project, Point(hz["lng"], hz["lat"]))
    perp = route_m.distance(pt_m)
    if perp < 50:
        along = route_m.project(pt_m)
        results.append({
            "hazard": hz,
            "perpendicularDistanceM": perp,
            "distanceAlongRouteM": along,
        })

results.sort(key=lambda r: r["distanceAlongRouteM"])
```

### Frontend tasks

1. On search submit, after Nominatim returns a destination, also call OSRM:
   ```
   https://router.project-osrm.org/route/v1/driving/{fromLng},{fromLat};{toLng},{toLat}?overview=full&geometries=geojson
   ```
2. Use the user's current location as the origin; if unavailable, use the map center.
3. Draw the returned coordinates as a Leaflet polyline.
4. POST the same coordinate list to `/api/route/hazards`. Render the returned hazards with a larger pulsing icon and
   list them in a side panel sorted by `distanceAlongRouteM`.

### OSRM fallback

OSRM's public demo API is rate-limited and occasionally returns `429`. Cache one full route response as
`/demo/canned_route.json`. If the live call fails, swap to the cached response. The demo route should be the same one
used in the screencast.

### Hour 3 exit criteria

- [ ] A search-and-route flow draws a polyline and highlights any seeded hazards within 50 m.
- [ ] OSRM `429` falls back to `canned_route.json` silently.

> **If exit criteria are not met by 3:30:** revert all Hour 3 changes (`git checkout main`) and ship Hour 2 + polish.

---

## Hour 4 (210–240 min): Polish, Demo Recording, Stop

This hour is about reliability, not features. **Do not start any new functionality after the 215-minute mark.**

### Polish tasks

- Replace default Leaflet markers with `divIcon`s containing emoji per type (🕳 pothole, 🪨 debris, 💧 flooding, ⚠ other).
  Fastest path to visual differentiation.
- Add a top-bar header with app name and a small "X hazards reported" counter.
- Add toast UI for: report success, geolocation denied, backend unreachable. One-line each, never a stack trace.
- *Optional:* `speechSynthesis.speak("Hazard reported")` on successful POST. Test once on the demo machine. If it does
  not fire reliably, remove the line — do not debug.

### Demo recording

Record a 60-second screencast of the full demo flow on the demo machine. Save to `/demo/screencast.mp4`. **This is the
ultimate fallback if the live demo breaks.**

### Practice and stop

- Run the demo end-to-end three times against the locked script (next section). Time each pass. If any pass exceeds 4
  minutes, cut a step.
- Write the README — five lines: how to start backend, how to start frontend, how to open the demo URL.
- Stop committing at the 230-minute mark. Late commits break demos.

---

## Backend API Reference

| Endpoint              | Method | Behaviour                                                                                                                                                      |
|-----------------------|--------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `/api/health`         | GET    | Returns `{ "ok": true }`. Used for Hour 0 smoke test.                                                                                                          |
| `/api/hazards`        | GET    | Returns all hazards as a JSON array of Hazard objects.                                                                                                         |
| `/api/hazards`        | POST   | Body: `{ lat, lng, type }`. Returns `201` with the full Hazard. Validates `type ∈ {pothole, debris, flooding, other}`.                                         |
| `/api/hazards/nearby` | GET    | Query params: `lat`, `lng`, `radius_m` (default 1000). Haversine filter. Returns array of Hazards sorted ascending by distance.                                |
| `/api/route/hazards`  | POST   | **Stretch (Hour 3).** Body: `{ route: [[lat,lng],...] }`. Returns hazards within 50 m of the polyline with `distanceAlongRouteM` and `perpendicularDistanceM`. |

---

## Tech Stack & Dependencies

### Frontend

- Leaflet 1.9.4 from unpkg CDN
- Vanilla JavaScript — no framework, no bundler, no transpilation
- Geolocation API + Vibration API — best-effort, with fallbacks
- `speechSynthesis` — Hour 4 polish only, behind feature detection
- OSRM public demo for routing (Hour 3 stretch only)
- Nominatim for geocoding (Hour 2)

### Backend

- Python 3.10+, Flask 3.x, Flask-CORS 4.x
- shapely 2.x + pyproj for route-segment distance
- In-memory list seeded from `seed_hazards.json` on startup

### Cut from scope (do not implement)

- Service Worker / PWA / offline tile caching
- Websockets / Server-Sent Events / push notifications
- Authentication, accounts, gamification
- Persistent database (SQLite, Postgres, etc.)
- Turn-by-turn voice navigation
- Photo uploads on hazard reports

---

## Risks & Mitigations

| Risk                                            | Likelihood / Impact  | Mitigation                                                                                               |
|-------------------------------------------------|----------------------|----------------------------------------------------------------------------------------------------------|
| OSRM public API rate-limits during demo         | Medium / High        | Cache one demo route as `canned_route.json`. On `429`, swap to cached response.                          |
| Geolocation denied or unavailable               | High / High          | Fall back to map center for reporting. Use Chrome DevTools Sensors for the demo.                         |
| Polyline-distance math bug                      | High / Medium        | Use shapely + pyproj. Do not roll the math by hand. Skip Hour 3 entirely if shapely cannot be installed. |
| Port 5000 collision with macOS AirPlay          | High / High (silent) | Backend on 5001. Documented in setup.                                                                    |
| In-memory data lost on backend restart          | Medium / Medium      | Reseed from JSON on startup. Optionally append-write to `hazards_log.json` on each POST (5 lines).       |
| Conference Wi-Fi blocks API calls               | Low / High           | Pre-cache OSM tiles for the demo viewport via `leaflet-offline`. Have a phone hotspot ready.             |
| Scope creep — adding features past the cut line | High / High          | Honour the hour-boundary go/no-go gates. After the 215-minute mark, no new functionality may start.      |

---

## Demo Script (3 minutes, laptop only)

Demo runs on a single laptop in Chrome. Two tabs side by side. Use Chrome DevTools → Sensors to override location. No
phone, no HTTPS, no tunnelling — `localhost` is exempt from secure-context requirements for geolocation in Chrome.

1. Open Tab A (Driver) and Tab B (Reporter) side by side. Both load the seeded hazards on the same backend.
2. In Tab A, search the demo destination string. The map recenters; if Hour 3 is built, a route polyline is drawn and
   matching hazards are highlighted.
3. In Tab B, set a custom location via DevTools Sensors near the route. Pick "Pothole" in the type sheet, tap the FAB,
   observe the toast and vibration.
4. Refresh Tab A. The new pothole appears on the map (and in the route's hazard list, if Hour 3 is built).
5. Briefly walk through the data model and one architecture slide.
6. If anything breaks at any step, switch to `/demo/screencast.mp4` and continue narrating.

---

## Post-Hackathon Roadmap

### Phase 1

- Persistent storage (SQLite); migrate the in-memory list.
- PWA + Service Worker for offline tile caching.
- Photo uploads on hazard reports.
- Hazard expiry / staleness (auto-remove after 7 days).

### Phase 2

- Routing weighted by hazard density ("safer route" toggle).
- Voice-first navigation experience.
- Accounts and lightweight gamification.
- Push reports to municipal work-order systems.
