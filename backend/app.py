"""Road Hazard backend — Flask app, in-memory store."""

import json
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

from geo import haversine_m, project_point, project_route

ALLOWED_TYPES = {"pothole", "debris", "flooding", "other"}
SEED_PATH = Path(__file__).parent / "seed_hazards.json"
CANNED_ROUTE_PATH = Path(__file__).parent.parent / "demo" / "canned_route.json"
RATE_LIMIT_WINDOW_S = 60
RATE_LIMIT_MAX = 10
ROUTE_BUFFER_M = 50.0

app = Flask(__name__)
CORS(app)

# with SEED_PATH.open() as f:
#     hazards: list[dict] = json.load(f)
hazards: list[dict] = []

_post_log: dict[str, deque] = defaultdict(deque)


def _rate_limited(ip: str) -> bool:
    now = time.monotonic()
    q = _post_log[ip]
    while q and now - q[0] > RATE_LIMIT_WINDOW_S:
        q.popleft()
    if len(q) >= RATE_LIMIT_MAX:
        return True
    q.append(now)
    return False


@app.get("/api/health")
def health():
    return jsonify(ok=True)


@app.get("/api/canned_route")
def canned_route():
    if not CANNED_ROUTE_PATH.exists():
        return jsonify(error="canned route not available"), 404
    with CANNED_ROUTE_PATH.open() as f:
        return jsonify(json.load(f))


@app.get("/api/hazards")
def list_hazards():
    return jsonify(hazards)


@app.post("/api/hazards")
def create_hazard():
    if _rate_limited(request.remote_addr or "unknown"):
        return jsonify(error="rate limited"), 429

    body = request.get_json(silent=True) or {}
    htype = body.get("type")
    lat, lng = body.get("lat"), body.get("lng")

    if htype not in ALLOWED_TYPES:
        return jsonify(error="invalid type"), 400
    if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
        return jsonify(error="invalid coordinates"), 400
    if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
        return jsonify(error="coordinates out of range"), 400

    hazard = {
        "id": str(uuid.uuid4()),
        "lat": round(float(lat), 6),
        "lng": round(float(lng), 6),
        "type": htype,
        "reportedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    hazards.append(hazard)
    return jsonify(hazard), 201


@app.get("/api/hazards/nearby")
def nearby_hazards():
    try:
        lat = float(request.args["lat"])
        lng = float(request.args["lng"])
    except (KeyError, ValueError):
        return jsonify(error="lat and lng required"), 400
    radius_m = float(request.args.get("radius_m", 1000))

    out = []
    for hz in hazards:
        d = haversine_m(lat, lng, hz["lat"], hz["lng"])
        if d <= radius_m:
            out.append({**hz, "distanceM": round(d, 1)})
    out.sort(key=lambda h: h["distanceM"])
    return jsonify(out)


@app.post("/api/route/hazards")
def hazards_along_route():
    body = request.get_json(silent=True) or {}
    route = body.get("route")
    if not isinstance(route, list) or len(route) < 2:
        return jsonify(error="route must be a list of >=2 [lat,lng] pairs"), 400
    try:
        line_m = project_route(route)
    except Exception:
        return jsonify(error="invalid route geometry"), 400

    out = []
    for hz in hazards:
        pt = project_point(hz["lat"], hz["lng"])
        perp = line_m.distance(pt)
        if perp < ROUTE_BUFFER_M:
            along = line_m.project(pt)
            out.append({
                "hazard": hz,
                "perpendicularDistanceM": round(perp, 1),
                "distanceAlongRouteM": round(along, 1),
            })
    out.sort(key=lambda r: r["distanceAlongRouteM"])
    return jsonify(out)


if __name__ == "__main__":
    app.run(port=5001, debug=False, use_reloader=False)
