# Road Hazard

Browser-based map of crowdsourced road hazards with route analysis. Demo runs on a single laptop.

## Run

Backend uses [uv](https://docs.astral.sh/uv/) for dependency + interpreter management. Python pinned to 3.14 via `backend/.python-version`.

```bash
# Backend
cd backend && uv sync && uv run python app.py

# Frontend (separate terminal)
cd frontend && python3 -m http.server 8000
```

Open http://localhost:8000 in Chrome. Backend listens on :5001 (avoid :5000 — macOS AirPlay).

### IDE: add the Python interpreter

After `uv sync` creates `backend/.venv/`, point your IDE at it:

- **PyCharm** — Settings → Project → Python Interpreter → Add Interpreter → Existing → `backend/.venv/bin/python`.
- **VS Code** — `Python: Select Interpreter` → enter `backend/.venv/bin/python`.

## Demo flow

1. Page loads centered on downtown Toronto with 5 seeded hazards (🕳 🪨 💧 ⚠) along a CN Tower → Yonge-Dundas Square route.
2. Pick a hazard type; tap the FAB to report at your current location (uses Chrome DevTools Sensors for the demo) — appears immediately, visible in other tabs after refresh.
3. Search "Yonge-Dundas Square" → route is drawn and hazards within 50 m are highlighted with a pulsing icon and listed in the side panel sorted by distance along route.

## Endpoints

| | |
|---|---|
| `GET /api/health` | smoke check |
| `GET /api/hazards` | list all |
| `POST /api/hazards` | `{lat, lng, type ∈ {pothole,debris,flooding,other}}` → `201` |
| `GET /api/hazards/nearby?lat=&lng=&radius_m=` | Haversine filter |
| `POST /api/route/hazards` | `{route: [[lat,lng], ...]}` → hazards within 50 m |
| `GET /api/canned_route` | cached OSRM response (fallback) |

In-memory store, seeded from `backend/seed_hazards.json` on startup. No database, no auth.
