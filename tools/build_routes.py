#!/usr/bin/env python3
"""
Turn a Flighty CSV export into the journeys the projection flies.

The unit here is a journey, not a leg. A trip that went Toronto - San Francisco
- Hong Kong - Taipei is one aircraft flying one path, and its second leg cannot
leave until its first has landed. Two separate trips never get their legs
shuffled together.

Journeys spread outward rather than all starting at once: none departs until
something has already arrived at its origin. Seattle reaches Toronto, and only
then do the Toronto trips begin.

    python3 tools/build_routes.py [data/flights.csv]

Writes data/routes.js. Re-run it whenever the export changes.
"""

import collections
import csv
import datetime
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CSV = os.path.join(ROOT, "data", "flights.csv")
OUT = os.path.join(ROOT, "data", "routes.js")

HOME = ["SEA", "PAE"]

# Airports to leave out entirely. Both ends of any leg touching one are dropped.
EXCLUDE = {"BCN", "LHR"}

# Airports that are really the same place. Billy Bishop becomes Pearson: both
# are Toronto, they'd sit on top of each other at world scale, and Newark is
# only reachable from the smaller field.
MERGE = {"YTZ": "YYZ"}

# A journey ends when the trail breaks or when a gap this long says you were
# plainly home in between.
MAX_GAP_DAYS = 30

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
                "a": a, "b": b,
                "date": datetime.date.fromisoformat(row["Date"]),
                "callsign": (row.get("Airline", "") + " " + row.get("Flight", "")).strip(),
            })
    legs.sort(key=lambda l: l["date"])
    return legs


def split_journeys(legs):
    """Cut the leg list into trips.

    A journey continues while each leg departs where the last one landed. It
    ends when that trail breaks, when the gap says you were home in between, or
    as soon as it arrives back where it started -- without that last rule a run
    of round trips out of one airport chains into a single implausible journey."""
    trips, cur = [], [legs[0]]
    for prev, leg in zip(legs, legs[1:]):
        home_again = prev["b"] == cur[0]["a"]
        continues = (leg["a"] == prev["b"] and
                     (leg["date"] - prev["date"]).days <= MAX_GAP_DAYS)
        if continues and not home_again:
            cur.append(leg)
        else:
            trips.append(cur)
            cur = [leg]
    trips.append(cur)
    return trips


def trim_return(trip):
    """Drop the flights home at the end of a journey.

    A return retraces a line already on the map and reveals nothing new, so each
    journey flies out and stops. Only trailing legs go: a trip that routed back
    through a hub on its way somewhere new -- Taipei, Hong Kong again, then
    Haneda -- keeps all of it, because Haneda is still ahead."""
    trip = list(trip)
    while len(trip) > 1:
        visited = [trip[0]["a"]] + [l["b"] for l in trip[:-1]]
        if trip[-1]["b"] in visited:
            trip.pop()
        else:
            break
    return trip


def dedupe(trips):
    """One journey per distinct shape, earliest first."""
    shapes = collections.OrderedDict()
    for trip in trips:
        key = tuple([trip[0]["a"]] + [l["b"] for l in trip])
        if key in shapes:
            shapes[key]["count"] += 1
        else:
            shapes[key] = {"legs": trip, "count": 1, "date": trip[0]["date"]}
    return shapes


def great_circle_km(a, b):
    lat1, lon1 = math.radians(COORDS[a][1]), math.radians(COORDS[a][2])
    lat2, lon2 = math.radians(COORDS[b][1]), math.radians(COORDS[b][2])
    d = (math.sin((lat2 - lat1) / 2) ** 2 +
         math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2)
    return 6371 * 2 * math.asin(min(1, math.sqrt(d)))


def journey_km(stops):
    return sum(great_circle_km(a, b) for a, b in zip(stops, stops[1:])
               if a in COORDS and b in COORDS)


def order(shapes, arc_first):
    """Sort journeys so each departs an airport already reached.

    Flown journeys expand the map first: a trip that is only booked should never
    be what discovers a place you have already been. A journey whose origin is
    never reachable gets turned around -- a one-way record of the flight home is
    still worth drawing as the flight out."""
    pending = []
    for key, info in shapes.items():
        booked = all(l["date"].isoformat() > TODAY for l in info["legs"])
        pending.append({"stops": list(key), "info": info, "booked": booked})

    reached = set(HOME)
    out = []
    # Flown journeys first, then the booked ones, so today's map is built from
    # what actually happened.
    for booked_pass in (False, True):
        wave = 0
        while True:
            wave += 1
            ready = [j for j in pending
                     if j["booked"] == booked_pass and j["stops"][0] in reached]
            if not ready:
                break
            # Longest first. The far side of the world takes the most time to
            # reach, so if those leave last the sequence ends with one lonely
            # aircraft still crossing the Pacific long after everything else
            # has landed.
            ready.sort(key=lambda j: -journey_km(j["stops"]))
            for j in ready:
                pending.remove(j)
                out.append(j)
                reached.update(j["stops"])

    # Whatever is left starts somewhere nothing ever reaches. Reverse it if that
    # makes it reachable, so the airport still appears on the map.
    for j in list(pending):
        if j["stops"][-1] in reached:
            j["stops"].reverse()
            j["reversed"] = True
            pending.remove(j)
            out.append(j)
            reached.update(j["stops"])

    for j in pending:
        print("  unreachable, dropped: %s" % " -> ".join(j["stops"]))

    # Each city pair is drawn once, however many times it was flown.
    #
    # A leading leg whose arc is already on the map is simply dropped and the
    # journey starts further along -- Seattle to Vancouver to Sapporo becomes
    # the Vancouver departure, once Vancouver is reached.
    #
    # An arc repeated in the MIDDLE of a journey has to stay: the aircraft
    # really did route back through Hong Kong to get from Taipei to Haneda, and
    # dropping that leg would teleport it. Those are marked instead, so the
    # plane flies but no second line is drawn over the first.
    seen = set()
    kept = []
    for j in out:
        pairs = [(a, b, tuple(sorted((a, b))))
                 for a, b in zip(j["stops"], j["stops"][1:])]
        # Nothing to show at either end of a journey if the line is already
        # there, so start later and stop earlier.
        while pairs and pairs[0][2] in seen:
            pairs.pop(0)
        while pairs and pairs[-1][2] in seen:
            pairs.pop()
        if not pairs:
            continue          # every leg already drawn -- the journey adds nothing
        j["legs"] = []
        for a, b, pair in pairs:
            j["legs"].append({"from": a, "to": b, "callsign": arc_first[pair],
                              "dup": pair in seen})
            seen.add(pair)
        kept.append(j)
    return kept


def main():
    global TODAY
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_CSV
    TODAY = datetime.date.today().isoformat()

    legs = read_legs(path)

    # The flight number shown for a city pair is the first one ever flown on it.
    arc_first = {}
    for leg in legs:
        pair = tuple(sorted((leg["a"], leg["b"])))
        if pair not in arc_first:
            arc_first[pair] = leg["callsign"]

    trips = [trim_return(t) for t in split_journeys(legs)]
    shapes = dedupe(trips)
    journeys = order(shapes, arc_first)

    codes = []
    for j in journeys:
        for leg in j["legs"]:
            for c in (leg["from"], leg["to"]):
                if c not in codes:
                    codes.append(c)

    missing = sorted(set(codes) - set(COORDS))
    if missing:
        print("no coordinates for: %s -- add them to COORDS" % ", ".join(missing))
        return 1

    payload = {
        "home": HOME,
        "cutoff": TODAY,
        "airports": {c: {"name": COORDS[c][0], "lat": COORDS[c][1], "lon": COORDS[c][2]}
                     for c in codes},
        "journeys": [{
            "callsign": j["legs"][0]["callsign"],
            "legs": j["legs"],
            "booked": j["booked"],
            "count": j["info"]["count"],
            "date": j["info"]["date"].isoformat(),
        } for j in journeys],
    }

    with open(OUT, "w") as f:
        f.write("// Generated by tools/build_routes.py from data/flights.csv.\n")
        f.write("// Do not edit by hand -- re-run the script instead.\n")
        f.write("// Journeys are listed in the order they fly: each one departs an\n")
        f.write("// airport an earlier journey has already reached.\n")
        f.write("window.ROUTE_DATA = ")
        json.dump(payload, f, indent=1)
        f.write(";\n")

    flown = sum(1 for j in payload["journeys"] if not j["booked"])
    print("%d legs -> %d journeys (%d flown, %d booked), %d legs drawn, %d airports"
          % (len(legs), len(payload["journeys"]), flown,
             len(payload["journeys"]) - flown,
             sum(len(j["legs"]) for j in payload["journeys"]), len(codes)))
    for j in payload["journeys"]:
        path_s = j["legs"][0]["from"]
        for leg in j["legs"]:
            path_s += (" =>" if leg["dup"] else " ->") + " " + leg["to"]
        print("   %-44s %s%s" % (path_s, j["callsign"],
                                 "  [booked]" if j["booked"] else ""))
    print("   (=> flies the leg but draws no second line over an arc already shown)")
    print("wrote %s" % OUT)
    return 0


if __name__ == "__main__":
    sys.exit(main())
