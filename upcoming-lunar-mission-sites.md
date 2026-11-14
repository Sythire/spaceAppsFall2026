# Upcoming lunar mission sites

Research note for future map/model integration. **This is not wired into the website model.**

**Checked:** November 14, 2026  
**Scope:** Research for a future Missions page, plus named NASA/CLPS missions that could matter to a broader “what’s next for the Moon” view. A Missions page is not implemented in this repository yet. NASA and commercial schedules change; recheck before publishing or mapping.

## Site inventory

| Mission | Publicly announced destination | Destination status | Modeling guidance |
|---|---|---|---|
| Blue Origin Blue Moon Mark 1 MK1-101 **Endurance** / Moon Base I | Shackleton Connecting Ridge, lunar south pole | Named target; planned landing | Use as the named target, not as a precise coordinate. NASA’s 2026 Moon Base release identifies the ridge. |
| Astrobotic **Griffin-1** / Moon Base II (NASA event also brands it “Voyager Griffin-1”) | Nobile Crater, lunar south pole | Named target; planned landing | Use Nobile Crater at region/site level. Do not substitute Mons Mouton from older Griffin/VIPER materials: NASA’s current Griffin-1 event page specifies Nobile Crater for this Moon Base cargo flight. |
| Intuitive Machines **IM-3 / Trinity** / Moon Base III | Reiner Gamma, lunar near side | Named target; planned landing | Mark as Reiner Gamma (lunar swirl). NASA and Intuitive Machines both identify it. |
| Intuitive Machines **IM-4** | Lunar South Pole | Broad region only | Represent as a south-polar region, not a crater or point. NASA’s CLPS listing does not name a more specific site. |
| Firefly **Blue Ghost Mission 2** (“Riders on the Dark”) | Lunar far side; also delivers a relay satellite to lunar orbit | Broad region; surface landing plus orbital delivery | Keep surface destination and orbiting spacecraft destination as separate records. No named crater/landing site found in current official sources. |
| Blue Origin Blue Moon Mark 1 **MK1-102 / VIPER** | Lunar South Pole | Broad region only | Do not place at Endurance’s Connecting Ridge. VIPER is a later, separate Mark 1 flight. |
| Blue Origin Blue Moon Mark 1 **MK1-103 / MK1-104** with LTVs | Lunar South Pole | Broad region only | Two deliveries; specific sites not stated in the official company overview. |
| NASA **Artemis III** (2027) | Low Earth orbit; no lunar surface landing | Not a lunar destination | Show as an orbital systems demonstration, not a lunar surface pin. The mission architecture changed from the former landing plan. |
| NASA **Artemis IV** (2028) | Near the lunar South Pole | Broad region; exact site not selected | NASA lists nine candidate landing regions for its first crewed landing. Keep candidate regions as candidates, not a selected Artemis IV site. |
| NASA **Artemis V** (late 2028 target) | Lunar surface; planned Moon Base construction begins | Exact destination not announced | Current NASA event page does not specify a landing region or site. Avoid assuming it shares Artemis IV’s site. |
| NASA Moon Base late-2028 awards: two Astrobotic, one Firefly, one Intuitive Machines delivery | Not announced per delivery | Unknown | NASA announced provider/count/timing, but not individual mission names or landing sites. Keep four distinct TBD entries until assigned. |
| Firefly **Blue Ghost Mission 3** | Gruithuisen Domes | Named target in NASA CLPS listing | Include if expanding the model beyond current Missions page; verify schedule before adding. |
| Draper / ispace-US **Mission 1 (CP-12)** | Schrödinger Basin, lunar far side | Named target in NASA CLPS listing | Include if expanding the model beyond current Missions page; verify schedule before adding. |
| NASA/JPL **MoonFall** | Lunar South Pole region; surveys potential landing sites | Broad region; individual deployment sites not announced | Treat as a distributed survey/drone mission, not one landing pin. NASA describes four drones imaging candidate sites. |
| Blue Origin Blue Moon Mark 1 with NASA **PROMISE** rover | Lunar South Pole region | Broad region; specific flight/site not announced | PROMISE remains a planned rover delivery, not a currently named crater/site. Keep separate from Endurance/VIPER unless mission assignment is confirmed. |

## Artemis candidate-region caveat

NASA currently describes Artemis IV as a South Pole landing and publishes nine candidate landing regions for the first crewed landing. These are **regions under consideration**, each containing multiple potential sites; NASA has not named the selected touchdown site on the Artemis IV page. The list historically appeared in NASA materials under the earlier Artemis III landing plan, before Artemis III was redefined as the 2027 Earth-orbit test. Do not attach the old candidate list to Artemis IV as a confirmed final set without rechecking NASA’s latest site-selection release.

For reference, NASA’s **October 2024 Artemis III** candidate-region release named: Peak near Cabeus B, Haworth, Malapert Massif, Mons Mouton Plateau, Mons Mouton, Nobile Rim 1, Nobile Rim 2, de Gerlache Rim 2, and Slater Plain. Preserve these as historical candidates until NASA confirms the current Artemis IV set.

## Data handling for future model work

- Keep `destinationName`, `destinationType` (named site / broad region / orbit / no surface landing / unknown), `status` (target / candidate / TBD), and `sourceUrl` separate.
- Only create map coordinates when a primary source provides or endorses them. A region or crater label is not a precise landing coordinate.
- Preserve multiple destinations for missions that deliver both to the surface and orbit (for example Blue Ghost Mission 2).
- Keep provenance and a `lastVerified` date per mission/site record. Recheck status and dates before shipping the map.

## Official sources

- NASA, [Moon Base mission announcement (May 2026)](https://www.nasa.gov/news-release/nasa-provides-update-on-moon-base-rovers-landers-missions/): Moon Base I at Shackleton Connecting Ridge; Griffin Moon Base II and Trinity Moon Base III details.
- NASA, [Griffin-1 mission event](https://www.nasa.gov/event/clps-flight-astrobotics-griffin-mission-one/): Nobile Crater target for Griffin-1.
- NASA, [Moon Base phases](https://www.nasa.gov/moonbase-phases/): IM-3 at Reiner Gamma; Blue Ghost 2 far side; MoonFall south-pole survey; LTV deliveries; PROMISE region.
- NASA, [CLPS providers and mission sites](https://www.nasa.gov/commercial-lunar-payload-services/clps-providers/): Blue Ghost 2 far side, IM-3 Reiner Gamma, IM-4 South Pole, and Draper CP-12 at Schrödinger Basin. This page contains older schedule text, so use it for destination facts only where newer pages do not supersede it.
- NASA, [Blue Origin Blue Moon Mark 1](https://www.blueorigin.com/blue-moon/mark-1): Endurance, VIPER, and LTV mission sequence and broad South Pole destinations.
- NASA, [Artemis IV mission](https://www.nasa.gov/mission/artemis-iv/): South Pole region and candidate-region status.
- NASA, [2024 Artemis III candidate regions](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/): the nine named historical candidate regions; do not treat as a final Artemis IV selection.
- NASA, [Artemis III mission update (October 2026)](https://www.nasa.gov/missions/artemis/nasas-artemis-iii-mission-to-test-future-moon-lander-operations/): 2027 low Earth orbit lander systems demonstration.
- NASA, [Artemis V event](https://www.nasa.gov/event/artemis-v/): late-2028 target and Moon Base role; no exact landing site stated.
- NASA, [2028 Moon Base cargo awards](https://www.nasa.gov/news-release/nasa-awards-more-moon-base-science-previews-new-opportunities/): four deliveries, assigned by provider, sites not listed in the announcement.
- Firefly, [Blue Ghost Mission 3 / NASA CLPS provider listing](https://www.nasa.gov/commercial-lunar-payload-services/clps-providers/): Gruithuisen Domes appears in NASA’s CLPS material.
- Intuitive Machines, [IM-3 mission](https://www.intuitivemachines.com/missions/lunar/im-3-mission): Reiner Gamma target corroboration.
- NASA/JPL, [MoonFall](https://www.jpl.nasa.gov/missions/moonfall/): south-pole region and four-drone survey concept.

