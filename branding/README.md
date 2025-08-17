# Branding assets

This folder contains a small generator to create the app logo as SVG (and optionally PNG) with the same 3‑color gradient used in the UI.

Default gradient: indigo‑600 → sky‑600 → emerald‑600 (Tailwind): `#4f46e5`, `#0284c7`, `#059669`.

Notes

-   SVGs are resolution‑independent. The generator can emit one canonical `logo.svg` or multiple size‑suffixed variants for convenience.
-   Outputs go to `branding/dist` by default.

## Flags (all options)

-   `--sizes <int...>`: List of output sizes (for size‑suffixed SVG/PNG variants). Default: `256 512 1024`.
-   `--out <path>`: Output directory. Default: `branding/dist`.
-   `--png`: Also export PNGs for each size (requires `cairosvg`).
-   `--colors <hex hex hex>`: Three hex colors for the gradient. Default: `#4f46e5 #0284c7 #059669`.
-   `--ring <px>`: Ring thickness in pixels. Default: `12`.
-   `--ring-margin <px>`: Margin from SVG edge to the ring’s outer edge in pixels. Default: `8`.
-   `--gap <px>`: Minimum gap between the U and the ring in pixels. Default: `10`.
-   `--uweight <0–1>`: U stroke width as a fraction of the canvas size. Default: `0.12`.
-   `--uscale <0–1>`: Overall U size relative to the inner ring area. Default: `0.6`.
-   `--only-canonical`: Write only a single `logo.svg` (no size‑suffixed variants).

## Common recipes

-   Single canonical SVG (recommended)

```cmd
python branding\generate_logo.py --only-canonical
```

-   Multiple SVG variants (no PNG)

```cmd
python branding\generate_logo.py --sizes 256 512 1024
```

-   SVG + PNG variants

```cmd
pip install cairosvg
python branding\generate_logo.py --sizes 256 512 --png
```

-   Custom colors and geometry

```cmd
python branding\generate_logo.py --colors #4f46e5 #0284c7 #059669 --ring 24 --ring-margin 4 --gap 10 --uweight 0.12 --uscale 0.5
```

## Current logo command

The following command was used to generate the current logo asset:

```cmd
python branding\generate_logo.py --only-canonical --out branding\dist --uscale 0.5 --ring 80 --ring-margin 2
Wrote branding\dist\logo.svg
```

This produces `branding/dist/logo.svg`, which is copied to `untis-pro-frontend/src/assets/logo.svg` and referenced in `untis-pro-frontend/index.html` as the favicon.
