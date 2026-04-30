"""Geospatial helpers: haversine distance + projected polyline math."""

from math import asin, cos, radians, sin, sqrt

import pyproj
from shapely.geometry import LineString, Point
from shapely.ops import transform

EARTH_RADIUS_M = 6_371_000.0

_to_metric = pyproj.Transformer.from_crs(4326, 3857, always_xy=True).transform


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = radians(lat1), radians(lat2)
    dp = radians(lat2 - lat1)
    dl = radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def project_route(route_latlng: list[list[float]]) -> LineString:
    """Project a [[lat,lng], ...] polyline into EPSG:3857 metres."""
    return transform(_to_metric, LineString([(lng, lat) for lat, lng in route_latlng]))


def project_point(lat: float, lng: float) -> Point:
    return transform(_to_metric, Point(lng, lat))
