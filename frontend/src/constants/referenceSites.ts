import type {LunarLocation} from '../types';

// Sourced catalogue snapshot from backend/api/catalog.py (2026-11-14). Metadata only; never simulated geometry.
export const referenceSites:LunarLocation[]=[
  {
    "id": "apollo-11",
    "name": "Apollo 11 Lunar Module",
    "latitudeDeg": 0.67416,
    "longitudeDeg": 23.47314,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "apollo-12",
    "name": "Apollo 12 Lunar Module",
    "latitudeDeg": -3.0128,
    "longitudeDeg": -23.4219,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "apollo-14",
    "name": "Apollo 14 Lunar Module",
    "latitudeDeg": -3.64589,
    "longitudeDeg": -17.47194,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "apollo-15",
    "name": "Apollo 15 Lunar Module",
    "latitudeDeg": 26.13239,
    "longitudeDeg": 3.6333,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "apollo-16",
    "name": "Apollo 16 Lunar Module",
    "latitudeDeg": -8.9734,
    "longitudeDeg": 15.5011,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "apollo-17",
    "name": "Apollo 17 Lunar Module",
    "latitudeDeg": 20.1911,
    "longitudeDeg": 30.7723,
    "frame": "MOON_ME",
    "kind": "historical",
    "source": "https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html",
    "coordinateFrame": "DE421 Mean Earth / polar axis",
    "coordinateNote": "NASA NSSDCA coordinates based on LRO images (Wagner et al., 2017)."
  },
  {
    "id": "clps-im-1",
    "name": "IM-1 Odysseus (Intuitive Machines)",
    "latitudeDeg": -80.13,
    "longitudeDeg": 1.44,
    "frame": "MOON_ME",
    "kind": "clps-landed",
    "status": "Landed 2024-02-22 near Malapert A; tipped over, operated ~7 days",
    "source": "https://en.wikipedia.org/wiki/IM-1",
    "coordinateNote": "Landing site coordinates.",
    "program": "NASA CLPS"
  },
  {
    "id": "clps-blue-ghost-1",
    "name": "Blue Ghost Mission 1 (Firefly)",
    "latitudeDeg": 18.56,
    "longitudeDeg": 61.81,
    "frame": "MOON_ME",
    "kind": "clps-landed",
    "status": "Landed 2025-03-02 in Mare Crisium near Mons Latreille; full success",
    "source": "https://en.wikipedia.org/wiki/Blue_Ghost_Mission_1",
    "coordinateNote": "Landing site coordinates.",
    "program": "NASA CLPS"
  },
  {
    "id": "clps-im-2",
    "name": "IM-2 Athena (Intuitive Machines)",
    "latitudeDeg": -84.7906,
    "longitudeDeg": 29.1957,
    "frame": "MOON_ME",
    "kind": "clps-landed",
    "status": "Landed 2025-03-06 on Mons Mouton; tipped over, mission ended next day",
    "source": "https://en.wikipedia.org/wiki/IM-2",
    "coordinateNote": "Landing site coordinates.",
    "program": "NASA CLPS"
  },
  {
    "id": "clps-im-3",
    "name": "IM-3 (Intuitive Machines) · Reiner Gamma",
    "latitudeDeg": 7.5,
    "longitudeDeg": -59.0,
    "frame": "MOON_ME",
    "kind": "clps-planned",
    "status": "Planned, first part of 2027",
    "source": "https://en.wikipedia.org/wiki/Reiner_Gamma",
    "coordinateNote": "Target feature centre (Reiner Gamma swirl), not a landing point.",
    "program": "NASA CLPS"
  },
  {
    "id": "clps-griffin-1",
    "name": "Griffin Mission 1 (Astrobotic) · Nobile region",
    "latitudeDeg": -85.28,
    "longitudeDeg": 53.27,
    "frame": "MOON_ME",
    "kind": "clps-planned",
    "status": "Planned (date TBA)",
    "source": "https://en.wikipedia.org/wiki/Nobile_(crater)",
    "coordinateNote": "Target feature centre (Nobile crater), not a landing point.",
    "program": "NASA CLPS"
  },
  {
    "id": "clps-blue-ghost-3",
    "name": "Blue Ghost Mission 3 (Firefly) · Gruithuisen domes",
    "latitudeDeg": 36.56,
    "longitudeDeg": -40.72,
    "frame": "MOON_ME",
    "kind": "clps-planned",
    "status": "Planned, 2028",
    "source": "https://en.wikipedia.org/wiki/Mons_Gruithuisen_Gamma",
    "coordinateNote": "Target feature centre (Mons Gruithuisen Gamma), not a landing point.",
    "program": "NASA CLPS"
  },
  {
    "id": "polar-reference",
    "name": "South-pole test location (hypothetical)",
    "latitudeDeg": -89.5,
    "longitudeDeg": 32,
    "frame": "MOON_ME",
    "kind": "exploratory",
    "source": null,
    "coordinateNote": "User-selected test coordinates; not a NASA landing-site designation."
  }
];
