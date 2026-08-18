#!/usr/bin/env python3
"""
Turn Natural Earth world boundaries into a plain .js file the page can load
straight off disk.

The page runs from file://, where fetch() is blocked by CORS -- so the geometry
ships as a script that assigns a global rather than as JSON we'd have to fetch.

Source: world-atlas (Natural Earth, public domain), 110m for the world view and
50m for anything closer.

    python3 tools/build_world.py
"""

import json
import math
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "world.js")
CACHE = os.path.join(ROOT, "tools", ".cache")

SOURCES = {
    "coarse": ("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json", 2),
    "fine": ("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json", 3),
}

# Lakes come from Natural Earth directly, as plain GeoJSON. Without them a
# continent is one flat grey shape; the Great Lakes and the Caspian are most of
# what makes a dark map read as a map at this scale.
LAKES = {
    "coarse": ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
               "master/geojson/ne_110m_lakes.geojson", 2),
    "fine": ("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/"
             "master/geojson/ne_50m_lakes.geojson", 3),
}


def fetch(url, name):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name + ".json")
    if not os.path.exists(path):
        print("  downloading %s" % url)
        with urllib.request.urlopen(url, timeout=60) as r:
            body = r.read()
        with open(path, "wb") as f:
            f.write(body)
    with open(path) as f:
        return json.load(f)


def decode_arcs(topo):
    """Undo topojson's quantized delta encoding into absolute lon/lat arcs."""
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    out = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring_coords(arcs, indices):
    """Stitch an arc index list into one coordinate ring."""
    pts = []
    for i in indices:
        arc = arcs[~i][::-1] if i < 0 else arcs[i]
        pts.extend(arc[1:] if pts else arc)
    return pts


def polygons_of(geom):
    """Every geometry as a list of arc-index rings, Polygon or Multi alike."""
    t = geom.get("type")
    if t == "Polygon":
        return [geom["arcs"]]
    if t == "MultiPolygon":
        return [rings for rings in geom["arcs"]]
    return []


def flatten(pts, precision):
    """[(lon,lat)...] -> flat rounded array, with consecutive duplicates dropped.

    Longitude is unwrapped as we go: a ring that crosses the antimeridian
    (Chukotka, Fiji, Antarctica) keeps counting past 180 instead of snapping to
    -179. Without this the renderer draws a straight line all the way back
    across the map, which shows up as a bright horizontal streak at that
    latitude. The drawing code already handles coordinates outside +/-180 -- it
    repeats the world sideways anyway."""
    out = []
    last = None
    prev_lon = None
    for lon, lat in pts:
        if prev_lon is not None:
            while lon - prev_lon > 180:
                lon -= 360
            while prev_lon - lon > 180:
                lon += 360
        prev_lon = lon
        lon = round(lon, precision)
        lat = round(lat, precision)
        if (lon, lat) != last:
            out.append(lon)
            out.append(lat)
            last = (lon, lat)
    return out


def build(topo, precision):
    arcs = decode_arcs(topo)

    land = []
    for geom in topo["objects"]["land"]["geometries"]:
        for rings in polygons_of(geom):
            poly = []
            for ring in rings:
                flat = flatten(ring_coords(arcs, ring), precision)
                if len(flat) >= 8:
                    poly.append(flat)
            if poly:
                land.append(poly)

    # An arc shared by two countries is an internal border; an arc used once is
    # coastline, which the filled land already draws for us.
    use = {}
    for geom in topo["objects"]["countries"]["geometries"]:
        for rings in polygons_of(geom):
            for ring in rings:
                for i in ring:
                    key = ~i if i < 0 else i
                    use[key] = use.get(key, 0) + 1

    borders = []
    for key, count in use.items():
        if count > 1:
            flat = flatten(arcs[key], precision)
            if len(flat) >= 4:
                borders.append(flat)

    return {"land": land, "borders": borders}


def build_lakes(geojson, precision, min_points):
    """GeoJSON polygons -> the same flat ring format the land uses."""
    out = []
    for feature in geojson["features"]:
        geom = feature.get("geometry") or {}
        if geom.get("type") == "Polygon":
            polys = [geom["coordinates"]]
        elif geom.get("type") == "MultiPolygon":
            polys = geom["coordinates"]
        else:
            continue
        for rings in polys:
            poly = []
            for ring in rings:
                flat = flatten([(c[0], c[1]) for c in ring], precision)
                if len(flat) >= min_points * 2:
                    poly.append(flat)
            if poly:
                out.append(poly)
    return out


def main():
    payload = {}
    for name, (url, precision) in SOURCES.items():
        print("building %s..." % name)
        topo = fetch(url, name)
        payload[name] = build(topo, precision)

        lake_url, lake_precision = LAKES[name]
        lakes = fetch(lake_url, name + "-lakes")
        # Drop the specks -- below a handful of points a lake is a dot of noise.
        payload[name]["lakes"] = build_lakes(lakes, lake_precision,
                                             8 if name == "fine" else 5)
        print("  %d land polygons, %d border lines, %d lakes"
              % (len(payload[name]["land"]), len(payload[name]["borders"]),
                 len(payload[name]["lakes"])))

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w") as f:
        f.write("// Generated by tools/build_world.py -- do not edit by hand.\n")
        f.write("// Natural Earth via world-atlas (public domain).\n")
        f.write("// Coordinates are flat [lon, lat, lon, lat, ...] arrays.\n")
        f.write("window.WORLD_DATA = ")
        json.dump(payload, f, separators=(",", ":"))
        f.write(";\n")

    print("wrote %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))


if __name__ == "__main__":
    sys.exit(main() or 0)
