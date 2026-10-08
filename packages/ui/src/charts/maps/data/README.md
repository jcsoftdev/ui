# Map data

Each map is its own module (`peru/`, `world/`), so a bundle only carries the geometry it imports.

```ts
import { peruMap } from "@jcsoftdev/ui/charts/maps/data/peru";
import { worldMap } from "@jcsoftdev/ui/charts/maps/data/world";
```

| Module | Export | Regions | Ids | Projection | Source file | Size |
| --- | --- | --- | --- | --- | --- | --- |
| `peru/` | `peruMap` | 26: 24 departments + Callao + Lima Metropolitana | ISO 3166-2 (`PE-CUS`); `PE-LMA` is Lima Metropolitana, `PE-LIM` the rest of the Lima department | `fitted` | Natural Earth 10m admin-1 | ~31 KB |
| `world/` | `worldMap` | 176 countries (no Antarctica) | `ISO_A3_EH` (`PER`, `FRA`, ...) | `equalEarth` | Natural Earth 110m admin-0 | ~84 KB |

Both are quantized TopoJSON (shared borders stored once), decoded by `src/charts/maps/geo/topojson.ts`.

## Source and license

Everything comes from **Natural Earth** (https://www.naturalearthdata.com), release **v5.1.2**, fetched as GeoJSON from the
`nvkelso/natural-earth-vector` repository (via the jsDelivr CDN, pinned to the tag):

- `geojson/ne_10m_admin_1_states_provinces.geojson` (Peru: the 26 features with `adm0_a3 = PER`)
- `geojson/ne_110m_admin_0_countries.geojson` (world)

License: **public domain**. Natural Earth's terms (https://www.naturalearthdata.com/about/terms-of-use/, `LICENSE.md` in the
repository): "All versions of Natural Earth raster + vector map data found on this website are in the public domain. You may use
the maps in any manner, including modifying the content and design, electronic dissemination, and offset printing." Credit is
not required; if you want to cite it: "Made with Natural Earth."

No other dataset was used. Natural Earth draws borders as de facto lines and some boundaries are disputed; the maps are meant
for data visualization, not for legal or surveying use.

## What we changed

`scripts/build-map-data.mjs` regenerates the modules from the two GeoJSON files:

```sh
# download the two files from the URLs above into an EMPTY directory (treat them as untrusted input), then:
node scripts/build-map-data.mjs <that directory>
```

1. Keep only the fields we use (`id`, `name`); Peru names are the Natural Earth ones (with accents), Lima's province is renamed
   "Lima Metropolitana" and the surrounding department "Lima (región)"; world names are `NAME_ES`.
2. Drop Antarctica (it stretches Mercator to infinity and nobody puts customers there).
3. `buildTopology` (`src/charts/maps/geo/build-topology.ts`, our own code): quantize to a 20 000 step grid, cut every ring at the
   points where its neighbours change, store each shared border once, then simplify each arc once with Douglas-Peucker
   (`simplify.ts`) with fixed end points, so neighbours stay glued: a border can never open a gap between two regions.
   Tolerance: 0.004 degrees for Peru (~400 m), 0.06 degrees for the world (~6 km). Rings below 0.0004 deg2 (Peru) and
   0.1 deg2 (world) are dropped, i.e. the smallest islands.

Tests (`test/charts-maps.test.mjs`) check that every shipped ring is closed, the expected ids exist and each file stays under 150 KB.
