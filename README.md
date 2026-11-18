# Podestalia

A scroll-driven 3D showcase. A carbine pops in behind the title, comes apart into a labelled exploded view, and dissolves into particles that rebuild it as a GT3 race car. The car becomes an ocean liner, shown in four close-ups: bow, stern, broadside and top view. In the finale, a particle vortex and vector lines unveil all three objects on pedestals, where you can inspect them up close.

Every model is built in code at load time. There are no downloaded meshes.

## Run it

ES modules need a local server; opening the file directly won't work.

```sh
cd Podestalia
python3 -m http.server 8080
# open http://localhost:8080
```

There are no build steps and no dependencies to install. three.js (0.160.0) and the fonts are vendored.

## Controls

| Where | Input |
|---|---|
| Story | Scroll, the arrow keys or the chapter rail (00–11) |
| Header | Chapter shortcuts · **Motion** toggle (pauses ambient animation, and is remembered) |
| Gallery | Hover or click a pedestal, or Tab to its tag and press Enter |
| Inspect | Drag to orbit · scroll / pinch / `+` `−` to zoom · double-click to reset · `←` `→` to switch · `Esc` to close |
| Inspect tools | Explode · Blueprint · Turntable · Paint (GT3) · Lights (Voyager) |

## URL switches

- `?q=low|mid|high`: force a quality tier (particle count, resolution, bloom, MSAA)
- `?msaa=0`, `?bloom=0`: turn off individual effects
- `?debug`: exposes `window.__podestalia` (scene, director, scroll, gallery) for tweaking in the console

## Structure

```
index.html            chapters, cards, loader, inspector (semantic, readable without JS)
css/style.css         design system: charcoal / lime / orange / sage, cards, grid furniture
js/main.js            boot, quality tiers, loader, render loop, HUD
js/story.js           the Director: story time → camera, morphs, reveals, effects
js/models/            kit.js (parts, explode, edges, stats) · m16.js · gt3.js · ship.js
js/fx/                materials (reveal shader patch) · particles · lines · environment · post
js/ui/                scroll mapping · panels · overlay (grid, scribbles, callouts) · gallery · cursor
vendor/three/         three.js r160 build + the few addons used (MIT)
fonts/                Archivo + JetBrains Mono, Latin subset (SIL OFL 1.1)
tools/snapshot.mjs    headless-Chrome renders of any story time, for review
IDEAS.md              the 250-point plan (100 usability & safety, 150 full potential), with what's built ticked
```

Story time `T` is the chapter index plus progress through it. For example, `3.55` is the GT3 side view and `10.2` is the gallery. The whole timeline lives in `TL` and `CAM` in `js/story.js`.

## Design references

The visual language follows the reference boards you supplied:

- **Industrial boards (TRA / D350):** acid lime and orange on charcoal and sage, with modular spec cards.
- **Grid-based design:** construction grid, `+` crosshairs, `//` marks, and diagonal guides that draw in at every chapter change.
- **Stack Sans card:** the dot-matrix loader.
- **Délavé:** the numbered vertical tab strips that wipe away after loading.
- **MUSEUM / information architecture:** `OBJ-01` codes, side captions, corner registration marks, and the parchment inspector with its radar chart and vertex log.

## Before going live

1. **Contact address.** `studio@podestalia.example` is a placeholder on a reserved domain. Replace it in `index.html`.
2. **Security headers.** The page ships a CSP `<meta>` tag. Send these as real HTTP headers too, since `frame-ancestors` only works as a header:
   ```
   Content-Security-Policy: default-src 'self'; script-src 'self' 'sha256-UIiVg22PC4ABTdJ22WSTrliOLGvfsog+qnGKL+MGxbk='; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   X-Content-Type-Options: nosniff
   Referrer-Policy: strict-origin-when-cross-origin
   Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()
   ```
   If you edit the import map in `index.html`, recompute its hash (`sha256`, base64) and update the CSP.
3. **Caching.** Serve `vendor/` and `fonts/` with long-lived immutable caching.

## Credits

- three.js © three.js authors, MIT licence (`vendor/three/LICENSE`).
- Archivo by Omnibus-Type and JetBrains Mono by JetBrains, both under the SIL Open Font License 1.1.
- All objects, liveries and the vessel are fictional display pieces, not affiliated with any manufacturer.
