#!/usr/bin/env python3
"""
Turn a Flighty CSV export into the route network the projection flies.

The map isn't a list of flights -- it's a network that spreads. Nothing
departs an airport until something has arrived there first, so the whole thing
grows outward from Seattle: SEA reaches Toronto, and only then does Toronto
start sending flights of its own. That ordering is computed here, breadth
first, and baked into the output as a dependency each flight waits on.

    python3 tools/build_routes.py [data/flights.csv]

Writes data/routes.js. Re-run it whenever the export changes.
"""

import collections
import csv
import datetime
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(ROOT, "data", "flights.csv")
OUT = os.path.join(ROOT, "data", "routes.js")

HOME = ["SEA", "PAE"]

# Airports to leave out entirely. Both ends of any leg touching one are dropped.
EXCLUDE = {"BCN", "LHR"}

# Airports that are really the same place. Billy Bishop and Pearson are both
# Toronto; kept apart they sit on top of each other at world scale, and Newark
# becomes unreachable because the only leg to it leaves from the smaller field.
MERGE = {"YTZ": "YYZ"}

COORDS = {
    "SEA": ("Seattle-Tacoma",   47.4502, -122.3088),
    "PAE": ("Paine Field",      47.9063, -122.2816),
    "BOS": ("Boston",           42.3656,  -71.0096),
    "CTS": ("Sapporo",          42.7752,  141.6923),
    "EWR": ("Newark",           40.6895,  -74.1745),
    "HKG": ("Hong Kong",        22.3080,  113.9185),
    "HND": ("Tokyo Haneda",     35.5494,  139.7798),
    "KEF": ("Reykjavik",        63.9850,  -22.6056),
    "LAS": ("Las Vegas",        36.0840, -115.1537),
    "LAX": ("Los Angeles",      33.9416, -118.4085),
    "MCO": ("Orlando",          28.4312,  -81.3081),
    "MIA": ("Miami",            25.7959,  -80.2870),
    "NRT": ("Tokyo Narita",     35.7647,  140.3864),
    "ORD": ("Chicago",          41.9742,  -87.9073),
    "SAN": ("San Diego",        32.7336, -117.1897),
    "SFO": ("San Francisco",    37.6213, -122.3790),
    "SNA": ("Orange County",    33.6757, -117.8682),
    "TPE": ("Taipei",           25.0777,  121.2328),
    "YEG": ("Edmonton",         53.3097, -113.5801),
    "YUL": ("Montreal",         45.4706,  -73.7408),
    "YVR": ("Vancouver",        49.1967, -123.1815),
    "YYC": ("Calgary",          51.1139, -114.0203),
    "YYZ": ("Toronto",          43.6777,  -79.6248),
}


def today():
    return datetime.date.today().isoformat()


def read_legs(path):
    legs = []
    with open(path) as fh:
        for row in csv.DictReader(fh):
            if not row.get("Date"):
                continue
            a = MERGE.get(row["From"], row["From"])
            b = MERGE.get(row["To"], row["To"])
            if a in EXCLUDE or b in EXCLUDE or a == b:
                continue
            legs.append({
                "a": a, "b": b, "date": row["Date"],
                "callsign": (row.get("Airline", "") + " " + row.get("Flight", "")).strip()
            })
    return legs


def collapse(legs, cutoff):
    """One arc per city pair. A round trip is the same line drawn twice, and
    twelve Vancouver-Toronto runs are the same line drawn twelve times."""
    routes = collections.OrderedDict()
    for leg in legs:
        key = tuple(sorted((leg["a"], leg["b"])))
        r = routes.setdefault(key, {"count": 0, "flown": False, "first": leg["date"],
                                    "last": leg["date"], "callsign": leg["callsign"]})
        r["count"] += 1
        r["first"] = min(r["first"], leg["date"])
        if leg["date"] <= cutoff:
            r["flown"] = True
            # Keep the most recent callsign that was actually flown.
            if leg["date"] >= r["last"]:
                r["last"] = leg["date"]
                r["callsign"] = leg["callsign"]
        elif not r["flown"]:
            r["callsign"] = leg["callsign"]
    return routes


def order(routes):
    """Breadth-first from the home fields, so every flight leaves from
    somewhere already reached.

    Flown routes expand the network first: a trip that's only booked should
    never be what discovers a place you've already been. Whatever the search
    doesn't need -- arcs between two airports both already reached, like the
    dozen Vancouver-Toronto runs -- follows as fill, and the booked routes come
    last, as their own beat."""
    flown = [k for k, v in routes.items() if v["flown"]]
    booked = [k for k, v in routes.items() if not v["flown"]]

    adj = collections.defaultdict(list)
    for a, b in flown:
        adj[a].append(b)
        adj[b].append(a)

    out = []
    reached = set(HOME)
    frontier = list(HOME)
    used = set()
    wave = 0
    while frontier:
        wave += 1
        hops, found = [], []
        for a in sorted(frontier):
            for b in sorted(adj[a]):
                key = tuple(sorted((a, b)))
                if key in used or b in reached:
                    continue
                used.add(key)
                hops.append((a, b, key))
                found.append(b)
        if not hops:
            break
        out.extend((a, b, key, "discover", wave) for a, b, key in hops)
        reached |= set(found)
        frontier = sorted(set(found))

    wave += 1
    for key in flown:
        if key not in used:
            a, b = key
            # Draw it in whichever direction leaves from the airport reached first.
            out.append((a, b, key, "fill", wave))

    wave += 1
    for key in booked:
        a, b = key
        if b in reached and a not in reached:
            a, b = b, a
        out.append((a, b, key, "booked", wave))
        reached.add(b)

    # The search's last pass produces nothing; renumber so the waves read 1..n.
    seen = []
    for _, _, _, _, w in out:
        if w not in seen:
            seen.append(w)
    renum = {w: i + 1 for i, w in enumerate(seen)}
    out = [(a, b, k, kind, renum[w]) for a, b, k, kind, w in out]

    return out, reached


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    cutoff = today()
    legs = read_legs(path)
    routes = collapse(legs, cutoff)
    ordered, reached = order(routes)

    missing = sorted({c for a, b, *_ in ordered for c in (a, b)} - set(COORDS))
    if missing:
        print("no coordinates for: %s -- add them to COORDS" % ", ".join(missing))
        return 1

    used_codes = []
    for a, b, *_ in ordered:
        for c in (a, b):
            if c not in used_codes:
                used_codes.append(c)

    payload = {
        "home": HOME,
        "cutoff": cutoff,
        "airports": {c: {"name": COORDS[c][0], "lat": COORDS[c][1], "lon": COORDS[c][2]}
                     for c in used_codes},
        "routes": [{
            "from": a, "to": b,
            "callsign": routes[key]["callsign"],
            "count": routes[key]["count"],
            "first": routes[key]["first"],
            "booked": kind == "booked",
            "wave": wave
        } for a, b, key, kind, wave in ordered]
    }

    with open(OUT, "w") as f:
        f.write("// Generated by tools/build_routes.py from data/flights.csv.\n")
        f.write("// Do not edit by hand -- re-run the script instead.\n")
        f.write("// Routes are listed in the order they should fly: every one departs\n")
        f.write("// an airport an earlier route has already reached.\n")
        f.write("window.ROUTE_DATA = ")
        json.dump(payload, f, indent=1)
        f.write(";\n")

    waves = collections.Counter(w for *_, w in ordered)
    print("%d legs -> %d routes across %d airports" % (len(legs), len(ordered), len(used_codes)))
    for w in sorted(waves):
        kinds = {k for *_, k, ww in ordered if ww == w}
        print("  wave %d: %2d flights (%s)" % (w, waves[w], ", ".join(sorted(kinds))))
    print("booked (not yet flown): %d" % sum(1 for r in payload["routes"] if r["booked"]))
    print("wrote %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
