"""
Generate an app logo SVG with a centered "P" and a circular ring around it, both filled with the app's 3-color gradient.
Optionally rasterize PNGs at multiple sizes (requires cairosvg and pillow).

Defaults follow the gradient used in the frontend: from indigo-600 via sky-600 to emerald-600.

Usage (Windows cmd):
  # Only SVGs at 256, 512, 1024 px
  python branding\generate_logo.py --sizes 256 512 1024

  # SVG + PNGs
  python branding\generate_logo.py --sizes 256 512 --png

  # Custom colors and ring width
  python branding\generate_logo.py --colors #4f46e5 #0284c7 #059669 --ring 10
"""
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Iterable, List, Optional

# Default gradient colors (Tailwind): indigo-600, sky-600, emerald-600
DEFAULT_COLORS = ("#4f46e5", "#0284c7", "#059669")


@dataclass
class LogoSpec:
    size: int = 512  # canvas width/height in px
    ring_thickness: float = 12.0  # thickness of the outer ring (as px)
    ring_margin: float = 8.0  # margin from the SVG edge to the OUTER edge of the ring (px)
    gap: float = 10.0  # gap between letter and ring (px)
    font_family: str = "Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    # Weight/thickness of the letter glyph as stroke-width (% of size)
    u_weight_pct: float = 0.12
    # Overall letter size scale relative to the available inner circle area (0-1)
    u_scale: float = 0.6

    def gradient_stops(self, colors: Iterable[str] = DEFAULT_COLORS) -> str:
        c = list(colors)
        if len(c) == 1:
            # Single color fallback: duplicate stops
            c = [c[0], c[0], c[0]]
        elif len(c) == 2:
            c = [c[0], c[1], c[1]]
        # 3 stops at 0%, 50%, 100%
        return "\n".join(
            [
                f'<stop offset="0%" stop-color="{c[0]}"/>',
                f'<stop offset="50%" stop-color="{c[1]}"/>',
                f'<stop offset="100%" stop-color="{c[2]}"/>'
            ]
        )


def _manual_letter_path(spec: LogoSpec, cx: float, cy: float, ring_inner_r: float, colors: Iterable[str], gradient_id: str) -> str:
    """Original handmade path for the P (kept for backwards compatibility)."""
    s = spec.size
    # gap logic reused here (gap already applied when computing available_d below)
    # Compute available square inside inner circle after accounting for gap
    available_d = max(0.0, 2 * ring_inner_r - 2 * spec.gap)
    u_box = max(0.0, available_d * max(0.0, min(1.0, spec.u_scale)))
    u_stroke = max(1.0, s * spec.u_weight_pct)
    u_box = max(u_box, u_stroke * 3)
    left_x = cx - u_box / 2
    right_x = cx + u_box / 2
    top_y = cy - u_box / 2
    bottom_y = cy + u_box / 2
    pad = u_box * 0.12
    eff_left = left_x + pad
    eff_right = right_x - pad
    eff_top = top_y + pad
    eff_bottom = bottom_y - pad
    eff_w = max(1.0, eff_right - eff_left)
    eff_h = max(1.0, eff_bottom - eff_top)
    stem_x = eff_left
    bowl_w = max(u_stroke * 2.0, eff_w * 0.60)
    x_right = eff_left + bowl_w
    r_w = bowl_w / 2.0
    r_h = (eff_h * 0.58) / 2.0
    r = max(1.0, min(r_w, r_h) - (u_stroke / 2.0))
    bowl_bottom_y = eff_top + 2.0 * r
    bowl_bottom_y = min(bowl_bottom_y, eff_bottom - u_stroke / 2.0)
    return f"""
<!-- P letter (manual path) -->
<path d="M {stem_x} {eff_bottom}
        L {stem_x} {eff_top}
        L {x_right - r} {eff_top}
        A {r} {r} 0 0 1 {x_right - r} {bowl_bottom_y}
        L {stem_x} {bowl_bottom_y}"
        fill="none" stroke="url(#{gradient_id})" stroke-width="{u_stroke}" stroke-linecap="round" stroke-linejoin="round"/>
""".rstrip()


def _text_letter(spec: LogoSpec, cx: float, cy: float, ring_inner_r: float, letter: str, gradient_id: str, fill_letter: bool) -> str:
        """Render the letter using an SVG <text> element.

        Centering: we rely on text-anchor and dominant-baseline. Some renderers differ,
        so a small dy tweak is applied to visually center the glyph (empirical ~0.05em).
        """
        available_d = max(0.0, 2 * ring_inner_r - 2 * spec.gap)
        font_size = available_d * max(0.0, min(1.0, spec.u_scale))
        stroke_w = max(1.0, spec.size * spec.u_weight_pct)
        # Fallback if extremely small
        font_size = max(font_size, stroke_w * 3)

        if fill_letter:
            return f"""
<!-- Letter (font text, filled) -->
<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="middle"
        font-family="{spec.font_family}" font-size="{font_size}" dy="0.05em"
        fill="url(#{gradient_id})">{letter}</text>
""".rstrip()

        return f"""
<!-- Letter (font text, stroked) -->
<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="middle"
        font-family="{spec.font_family}" font-size="{font_size}" dy="0.05em"
        fill="none" stroke="url(#{gradient_id})" stroke-width="{stroke_w}" stroke-linejoin="round" stroke-linecap="round">{letter}</text>
""".rstrip()


def _glyph_letter(spec: LogoSpec, cx: float, cy: float, ring_inner_r: float, letter: str, gradient_id: str, font_file: str, glyph_center: str = "advance", fill_letter: bool = False) -> str:
        """Convert the letter to an exact path using fontTools for perfect centering.
        This avoids renderer differences in baseline handling.
        """
        try:
            from fontTools.ttLib import TTFont  # type: ignore
            from fontTools.pens.svgPathPen import SVGPathPen  # type: ignore
        except Exception as e:  # pragma: no cover
            raise RuntimeError("Glyph mode requires fontTools. Install with: pip install fonttools") from e

        if not os.path.isfile(font_file):
            raise FileNotFoundError(f"Font file not found: {font_file}")

        font = TTFont(font_file)
        cmap = font.getBestCmap()
        codepoint = ord(letter)
        if codepoint not in cmap:
            raise ValueError(f"Letter '{letter}' not in font cmap")
        glyph_name = cmap[codepoint]
        glyph_set = font.getGlyphSet()
        glyph = glyph_set[glyph_name]
        pen = SVGPathPen(glyph_set)
        glyph.draw(pen)
        d = pen.getCommands()

        # Try to get a reliable bounding box from the font 'glyf' table (TTF)
        xmin = ymin = xmax = ymax = None
        try:
            glyf = font['glyf']
            g_raw = glyf[glyph_name]
            xmin = getattr(g_raw, "xMin", None)
            ymin = getattr(g_raw, "yMin", None)
            xmax = getattr(g_raw, "xMax", None)
            ymax = getattr(g_raw, "yMax", None)
        except Exception:
            pass

        if None in (xmin, ymin, xmax, ymax):
            # Fallback: use font units per em as a safe square
            units = font['head'].unitsPerEm
            xmin, ymin, xmax, ymax = 0, 0, units, units

        width = xmax - xmin
        height = ymax - ymin

        # Advance metrics for optional typographic centering
        advance_width, lsb = font['hmtx'][glyph_name]

        # Compute optional horizontal centering delta
        if glyph_center == "advance":
            cx_outline = xmin + width / 2.0
            cx_advance = advance_width / 2.0
            delta_x = cx_advance - cx_outline
        else:
            delta_x = 0.0

        available_d = max(0.0, 2 * ring_inner_r - 2 * spec.gap)
        target = available_d * max(0.0, min(1.0, spec.u_scale))
        # Use max dimension to scale uniformly
        scale = target / max(width, height, 1.0)
        stroke_w = max(1.0, spec.size * spec.u_weight_pct)

        # Compute glyph center (including advance delta) and build transform so glyph center maps to (cx,cy)
        center_x = xmin + width / 2.0 + delta_x
        center_y = ymin + height / 2.0
        # transform: translate(cx, cy) scale(scale, -scale) translate(-center_x, -center_y)
        transform = f"translate({cx},{cy}) scale({scale}, {-scale}) translate({-center_x},{-center_y})"

        if fill_letter:
            return f"""
<!-- Letter (glyph path, filled) -->
<g transform="{transform}">
    <path d="{d}" fill="url(#{gradient_id})" />
</g>
""".rstrip()

        # For stroked outlines we need to compensate stroke width for the applied scale
        # The stroke attribute is in pre-transform user units, so divide by scale to get desired final px width
        stroke_attr = max(0.5, stroke_w / max(scale, 1e-6))
        return f"""
<!-- Letter (glyph path, stroked) -->
<g transform="{transform}">
    <path d="{d}" fill="none" stroke="url(#{gradient_id})" stroke-width="{stroke_attr}" stroke-linecap="round" stroke-linejoin="round"/>
</g>
""".rstrip()


def make_svg(spec: LogoSpec, colors: Iterable[str] = DEFAULT_COLORS, letter: str = "P", letter_mode: str = "manual", font_file: Optional[str] = None, glyph_center: str = "advance", fill_letter: bool = False) -> str:
        s = spec.size
        cx = cy = s / 2
        # Make the ring hug the SVG bounds: outer edge is (s/2 - margin)
        ring_outer_r = max(0.0, (s / 2) - spec.ring_margin)
        ring_inner_r = max(0.0, ring_outer_r - spec.ring_thickness)

        gradient_id = "grad"

        svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {s} {s}" role="img" aria-label="Periodix logo">
<defs>
    <linearGradient id="{gradient_id}" x1="0%" y1="0%" x2="100%" y2="100%">
    {spec.gradient_stops(colors)}
    </linearGradient>
    <!-- Create a gradient stroke via a path painted once -->
    <linearGradient id="{gradient_id}-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
    {spec.gradient_stops(colors)}
    </linearGradient>
</defs>

<!-- Background transparent -->
<rect width="100%" height="100%" fill="none"/>

<!-- Outer ring using stroke -->
<circle cx="{cx}" cy="{cy}" r="{(ring_outer_r + ring_inner_r)/2}" fill="none" stroke="url(#{gradient_id}-stroke)" stroke-width="{(ring_outer_r - ring_inner_r)}" stroke-linecap="round"/>

{(
        _manual_letter_path(spec, cx, cy, ring_inner_r, colors, gradient_id)
        if letter_mode == "manual"
    else _text_letter(spec, cx, cy, ring_inner_r, letter, gradient_id, fill_letter)
        if letter_mode == "text"
    else _glyph_letter(spec, cx, cy, ring_inner_r, letter, gradient_id, font_file or "", glyph_center, fill_letter)
    )}
</svg>
""".strip()

        return svg


def write_svg(path: str, content: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)


def export_pngs(svg_content: str, size: int, out_path: str) -> None:
        try:
            import cairosvg  # type: ignore
        except Exception as e:
            raise RuntimeError(
                "PNG export requires 'cairosvg'. Install with: pip install cairosvg"
            ) from e

        # Export exact size raster
        cairosvg.svg2png(bytestring=svg_content.encode("utf-8"), write_to=out_path, output_width=size, output_height=size, background_color=None)


def parse_args(argv: List[str] | None = None) -> argparse.Namespace:
        p = argparse.ArgumentParser(description="Generate SVG/PNGs for the Periodix logo")
        p.add_argument("--sizes", type=int, nargs="*", default=[256, 512, 1024], help="Output sizes in px (canvas width/height)")
        p.add_argument("--out", type=str, default="branding/dist", help="Output directory")
        p.add_argument("--png", action="store_true", help="Also export PNGs for each size (requires cairosvg)")
        p.add_argument("--colors", type=str, nargs="*", default=list(DEFAULT_COLORS), help="Three hex colors for the gradient")
        p.add_argument("--ring", type=float, default=12.0, help="Ring thickness in px")
        p.add_argument("--ring-margin", type=float, default=8.0, help="Margin from SVG edge to ring outer edge in px")
        p.add_argument("--gap", type=float, default=10.0, help="Minimum gap between letter and ring in px")
        p.add_argument("--uweight", type=float, default=0.12, help="Letter stroke width as a fraction of size (0-1)")
        p.add_argument("--uscale", type=float, default=0.6, help="Overall letter size relative to inner circle area (0-1)")
        p.add_argument("--only-canonical", action="store_true", help="Write only a single 'logo.svg' without size-suffixed variants")
        p.add_argument("--profile", choices=["default", "icon"], default="default", help="Profile preset: 'icon' gives thicker ring & smaller letter for app icons")
        p.add_argument("--letter", type=str, default="P", help="Letter to render (single character)")
        p.add_argument("--letter-mode", choices=["manual", "text", "glyph"], default="text", help="How to render the central letter")
        p.add_argument("--font-file", type=str, default="", help="Font file path for glyph mode (e.g. path/to/Inter-SemiBold.ttf)")
        p.add_argument("--glyph-center", choices=["outline", "advance"], default="advance", help="Glyph mode horizontal centering: outline = geometric bbox center, advance = typographic advance center")
        p.add_argument("--fill-letter", action="store_true", help="Fill the letter with the gradient instead of stroke outline")
        return p.parse_args(argv)


def main() -> None:
    args = parse_args()

    colors = tuple(args.colors[:3]) if args.colors else DEFAULT_COLORS
    sizes = sorted(set(int(s) for s in args.sizes))

    # If only-canonical, ignore size-suffixed outputs and write one SVG
    if args.only_canonical:
        s = max(sizes) if sizes else 512
        spec = LogoSpec(size=s, ring_thickness=args.ring, ring_margin=args.ring_margin, gap=args.gap, u_weight_pct=args.uweight, u_scale=args.uscale)
        svg = make_svg(spec, colors, letter=args.letter, letter_mode=args.letter_mode, font_file=args.font_file or None, glyph_center=args.glyph_center, fill_letter=args.fill_letter)
        svg_path = os.path.join(args.out, "logo.svg")
        write_svg(svg_path, svg)
        print(f"Wrote {svg_path}")
        return

    # Otherwise, write variants plus a canonical convenience file
    largest = max(sizes) if sizes else 512

    for s in sizes:
        # Apply profile overrides per size if requested
        if args.profile == "icon":
            ring_thickness = s * 0.09
            ring_margin = s * 0.06
            u_scale = 0.50
            u_weight_pct = 0.10
            gap = max(4.0, s * 0.035)
        else:
            ring_thickness = args.ring
            ring_margin = args.ring_margin
            u_scale = args.uscale
            u_weight_pct = args.uweight
            gap = args.gap

        spec = LogoSpec(size=s, ring_thickness=ring_thickness, ring_margin=ring_margin, gap=gap, u_weight_pct=u_weight_pct, u_scale=u_scale)
        svg = make_svg(spec, colors, letter=args.letter, letter_mode=args.letter_mode, font_file=args.font_file or None, glyph_center=args.glyph_center, fill_letter=args.fill_letter)
        svg_path = os.path.join(args.out, f"logo_{s}.svg")
        write_svg(svg_path, svg)
        print(f"Wrote {svg_path}")

        if args.png:
            png_path = os.path.join(args.out, f"logo_{s}.png")
            export_pngs(svg, s, png_path)
            print(f"Wrote {png_path}")

    if args.profile == "icon":
        ring_thickness = largest * 0.09
        ring_margin = largest * 0.06
        u_scale = 0.50
        u_weight_pct = 0.10
        gap = max(4.0, largest * 0.035)
    else:
        ring_thickness = args.ring
        ring_margin = args.ring_margin
        u_scale = args.uscale
        u_weight_pct = args.uweight
        gap = args.gap

    spec = LogoSpec(size=largest, ring_thickness=ring_thickness, ring_margin=ring_margin, gap=gap, u_weight_pct=u_weight_pct, u_scale=u_scale)
    svg = make_svg(spec, colors, letter=args.letter, letter_mode=args.letter_mode, font_file=args.font_file or None, glyph_center=args.glyph_center, fill_letter=args.fill_letter)
    svg_path = os.path.join(args.out, "logo.svg")
    write_svg(svg_path, svg)
    print(f"Wrote {svg_path}")


if __name__ == "__main__":
    main()
