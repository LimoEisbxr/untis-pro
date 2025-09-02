# Branding Assets Generation

`generate_logo.py` creates gradient ring logos with a centered letter (default **P**) for Periodix. It can output SVG (always) and optionally PNG renditions at multiple sizes. The letter can be drawn three different ways for best visual centering.

## Dependencies

Base (SVG only): Python 3.10+ (any recent Python 3 works)

Optional (for extra modes / PNG):

-   `fonttools` (required for `--letter-mode glyph`)
-   `cairosvg` (required when using `--png`)

Install (Windows cmd):

```
pip install fonttools cairosvg
```

## CLI Options

All options start with `--`.

| Option                 | Default                                        | Description                                                                                             |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--sizes <n...>`       | `256 512 1024`                                 | One or more square canvas sizes in px. Each size produces `logo_<size>.svg` (and `.png` if requested).  |
| `--out <dir>`          | `branding/dist`                                | Output directory (created if missing).                                                                  |
| `--png`                | (off)                                          | Also export PNG files for every requested size. Requires `cairosvg`.                                    |
| `--colors <c1 c2 c3>`  | Indigo→Sky→Emerald (`#4f46e5 #0284c7 #059669`) | Up to 3 hex colors for the gradient. 1 color = flat color; 2 colors = start/end + duplicated middle.    |
| `--ring <px>`          | `12.0`                                         | Thickness of the outer ring stroke (px) when not using `--profile icon`.                                |
| `--ring-margin <px>`   | `8.0`                                          | Margin between SVG edge and outer edge of the ring. Lower = bigger ring.                                |
| `--gap <px>`           | `10.0`                                         | Minimum clearance between the letter and inner edge of the ring.                                        |
| `--uweight <0-1>`      | `0.12`                                         | Letter stroke width as a fraction of total canvas size (applies to manual/text/glyph stroke).           |
| `--uscale <0-1>`       | `0.6`                                          | Relative size of letter compared to available inner circle area.                                        |
| `--only-canonical`     | (off)                                          | Only produce a single `logo.svg` (largest size chosen) instead of per-size variants.                    |
| `--profile <default    | icon>`                                         | `default`                                                                                               | Preset tuning. `icon` adjusts ring thickness, margin, letter size, weight, and gap proportionally per size. Manual numeric options are ignored for those values when `icon` is active. |
| `--letter <char>`      | `P`                                            | Single character to render. Use quotes if shell might interpret it.                                     |
| `--letter-mode <manual | text                                           | glyph>`                                                                                                 | `text`                                                                                                                                                                                 | How the letter is rendered: `manual` = legacy hand‑built P path; `text` = SVG `<text>` (fast, needs installed font at render time); `glyph` = converts glyph to an exact path using the font file (most consistent). |
| `--font-file <path>`   | (empty)                                        | Path to a `.ttf`/`.otf` file used only when `--letter-mode glyph` is selected. Raises error if missing. |

### Letter Modes Explained

-   `manual`: Uses scripted geometry (always available, but only for a stylized P; still works for other letters but shape is designed for P).
-   `text`: Simpler; relies on `font-family` string in SVG. Viewer must have a matching font; stroke alignment varies slightly across renderers.
-   `glyph`: Loads your font file, extracts the precise glyph outline, scales and centers it, and embeds it as a path (best visual consistency). Requires `fonttools` and `--font-file`.

## Common Use Cases

### 1. Quick SVGs (default gradient, sizes 256/512/1024)

```
python branding\generate_logo.py --sizes 256 512 1024
```

Produces:

-   `branding/dist/logo_256.svg`
-   `branding/dist/logo_512.svg`
-   `branding/dist/logo_1024.svg`
-   `branding/dist/logo.svg` (copy of largest for convenience)

### 2. Add PNG Exports

```
python branding\generate_logo.py --sizes 256 512 --png
```

Adds `logo_256.png`, `logo_512.png`.

### 3. Single Canonical Asset (largest size only)

```
python branding\generate_logo.py --sizes 512 1024 --only-canonical
```

Writes just `branding/dist/logo.svg` at 1024 px.

### 4. Custom Gradient & Ring Thickness

```
python branding\generate_logo.py --colors #6366f1 #3b82f6 #10b981 --ring 14 --sizes 256 512
```

### 5. Icon Profile (auto scaling for app icons) + PNG

```
python branding\generate_logo.py --profile icon --sizes 128 256 512 --png
```

### 6. Glyph Mode With Font File (best centering)

```
python branding\generate_logo.py --letter P --letter-mode glyph --font-file C:\path\to\Inter-SemiBold.ttf --sizes 256 512 1024
```

### 7. Just Change the Letter (e.g., debug or alt variant)

```
python branding\generate_logo.py --letter X --letter-mode text --sizes 512
```

### 8. Heavier Letter Stroke

```
python branding\generate_logo.py --uweight 0.18 --sizes 256 512
```

### 9. Tighter Ring (reduced margin) and Larger Letter

```
python branding\generate_logo.py --ring-margin 4 --uscale 0.7 --sizes 512
```

## Tips

-   When exporting PNGs at many sizes, consider running glyph mode so rasterization matches across platforms.
-   If the letter looks vertically off in `text` mode, try `glyph` mode which eliminates renderer baseline variance.
-   For a filled letter instead of an outline, you can post-edit the SVG: remove `stroke` and set `fill="url(#grad)"` on the letter element/group.

## Troubleshooting

| Issue                           | Cause                                 | Fix                                         |
| ------------------------------- | ------------------------------------- | ------------------------------------------- |
| Letter not centered (text mode) | Different renderer baseline handling  | Use `--letter-mode glyph` with a font file. |
| Error: fontTools missing        | Using `glyph` mode without dependency | `pip install fonttools`                     |
| Error: cairosvg missing         | Used `--png` without cairosvg         | `pip install cairosvg`                      |
| Font changes in viewer          | Viewer missing font (text mode)       | Switch to `glyph` mode.                     |

## Minimal Command (most common)

```
python branding\generate_logo.py --letter P --letter-mode glyph --font-file C:\fonts\Inter-SemiBold.ttf --sizes 256 512 1024 --png
```

Outputs consistent SVG + PNG assets for the letter P with gradient ring.
