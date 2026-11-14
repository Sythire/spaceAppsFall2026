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
SITES += [{"id": "polar-reference", "name": "South-pole test location (hypothetical)",
           "latitudeDeg": -89.5, "longitudeDeg": 32, "frame": "MOON_ME",
           "kind": "exploratory", "source": None,
           "coordinateNote": "User-selected test coordinates; not a NASA landing-site designation."}]

LAYERS = [{"id": key, "name": name, "available": False} for key, name in (
    ("illumination", "Illumination"), ("earth-visibility", "Earth visibility"), ("elevation", "Elevation"))]
