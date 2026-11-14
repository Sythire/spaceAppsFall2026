"""Sourced reference sites plus explicitly hypothetical polar test coordinates."""
APOLLO_SOURCE = "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html"
_APOLLO = [(11, 0.67416, 23.47314), (12, -3.0128, -23.4219),
           (14, -3.64589, -17.47194), (15, 26.13239, 3.63330),
           (16, -8.9734, 15.5011), (17, 20.1911, 30.7723)]
SITES = [{"id": f"apollo-{n}", "name": f"Apollo {n} Lunar Module", "latitudeDeg": lat,
          "longitudeDeg": lon, "frame": "MOON_ME", "kind": "historical",
          "source": APOLLO_SOURCE, "coordinateFrame": "DE421 Mean Earth / polar axis",
          "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."}
         for n, lat, lon in _APOLLO]
# NASA Commercial Lunar Payload Services (CLPS), checked 2026-11-14.
# Landed missions: landing coordinates from the mission articles (which cite LROC imaging).
# Planned missions: only the target *feature centre* is published, so those pins are approximate regions,
# not landing points. Missions with no published target coordinates (Blue Ghost 2 "far side", IM-4 and
# Blue Moon Pathfinder 2 "South Pole") are listed without a pin in CLPS_UNPLACED.
_CLPS = [
    ("clps-im-1", "IM-1 Odysseus (Intuitive Machines)", -80.13, 1.44, "clps-landed",
     "Landed 2024-02-22 near Malapert A; tipped over, operated ~7 days", "https://en.wikipedia.org/wiki/IM-1",
     "Landing site coordinates."),
    ("clps-blue-ghost-1", "Blue Ghost Mission 1 (Firefly)", 18.56, 61.81, "clps-landed",
     "Landed 2025-03-02 in Mare Crisium near Mons Latreille; full success", "https://en.wikipedia.org/wiki/Blue_Ghost_Mission_1",
     "Landing site coordinates."),
    ("clps-im-2", "IM-2 Athena (Intuitive Machines)", -84.7906, 29.1957, "clps-landed",
     "Landed 2025-03-06 on Mons Mouton; tipped over, mission ended next day", "https://en.wikipedia.org/wiki/IM-2",
     "Landing site coordinates."),
    ("clps-im-3", "IM-3 (Intuitive Machines) · Reiner Gamma", 7.5, -59.0, "clps-planned",
     "Planned, first part of 2027", "https://en.wikipedia.org/wiki/Reiner_Gamma",
     "Target feature centre (Reiner Gamma swirl), not a landing point."),
    ("clps-griffin-1", "Griffin Mission 1 (Astrobotic) · Nobile region", -85.28, 53.27, "clps-planned",
     "Planned (date TBA)", "https://en.wikipedia.org/wiki/Nobile_(crater)",
     "Target feature centre (Nobile crater), not a landing point."),
    ("clps-blue-ghost-3", "Blue Ghost Mission 3 (Firefly) · Gruithuisen domes", 36.56, -40.72, "clps-planned",
     "Planned, 2028", "https://en.wikipedia.org/wiki/Mons_Gruithuisen_Gamma",
     "Target feature centre (Mons Gruithuisen Gamma), not a landing point."),
]
SITES += [{"id": i, "name": n, "latitudeDeg": lat, "longitudeDeg": lon, "frame": "MOON_ME", "kind": kind,
           "status": status, "source": src, "coordinateNote": note,
           "program": "NASA CLPS"} for i, n, lat, lon, kind, status, src, note in _CLPS]
CLPS_UNPLACED = [
    {"name": "Peregrine Mission One (Astrobotic)", "status": "Failed before landing (Jan 2024); target was Gruithuisen Gamma"},
    {"name": "Blue Ghost Mission 2 (Firefly)", "status": "Planned, early 2027; lunar far side (no published coordinates)"},
    {"name": "IM-4 (Intuitive Machines)", "status": "Planned, 2027; South Pole (no published coordinates)"},
    {"name": "Blue Moon Pathfinder 1 (Blue Origin)", "status": "Planned, early 2027; Shackleton connecting ridge (no published coordinates)"},
]

SITES += [{"id": "polar-reference", "name": "South-pole test location (hypothetical)",
           "latitudeDeg": -89.5, "longitudeDeg": 32, "frame": "MOON_ME",
           "kind": "exploratory", "source": None,
           "coordinateNote": "User-selected test coordinates; not a NASA landing-site designation."}]

LAYERS = [{"id": key, "name": name, "available": False} for key, name in (
    ("illumination", "Illumination"), ("elevation", "Elevation"),
    ("power", "Solar power (terrain-aware)"), ("earth-visibility", "Earth communication (terrain-aware)"),
    ("psr", "Permanent shadow (LOLA PSR)"), ("thermal", "Surface temperature (Diviner)"))]
