"""
Generate an app logo SVG with a centered "U" and a circular ring around it, both filled with the app's 3-color gradient.
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
import math
import os
from dataclasses import dataclass
from typing import Iterable, List

# Default gradient colors (Tailwind): indigo-600, sky-600, emerald-600
DEFAULT_COLORS = ("#4f46e5", "#0284c7", "#059669")


@dataclass
class LogoSpec:
    size: int = 512  # canvas width/height in px
    ring_thickness: float = 12.0  # thickness of the outer ring (as px)
    ring_margin: float = 8.0  # margin from the SVG edge to the OUTER edge of the ring (px)
    gap: float = 10.0  # gap between U and ring (px)
    font_family: str = "Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, 'Helvetica Neue', Arial, 'Apple Color Emoji', 'Segoe UI Emoji'"
    # Weight/thickness of the U glyph as stroke-width (% of size)
    u_weight_pct: float = 0.12
    # Overall U size scale relative to the available inner circle area (0-1)
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


def make_svg(spec: LogoSpec, colors: Iterable[str] = DEFAULT_COLORS) -> str:
    s = spec.size
    cx = cy = s / 2
    # Make the ring hug the SVG bounds: outer edge is (s/2 - margin)
    ring_outer_r = max(0.0, (s / 2) - spec.ring_margin)
    ring_inner_r = max(0.0, ring_outer_r - spec.ring_thickness)

    # U geometry: small, centered U inside inner ring, with a minimum gap to the ring
    # Compute available square inside inner circle after accounting for gap
    available_d = max(0.0, 2 * ring_inner_r - 2 * spec.gap)
    # Target U box size (width/height) using u_scale; keep a square for aesthetics
    u_box = max(0.0, available_d * max(0.0, min(1.0, spec.u_scale)))

    # U stroke width based on spec percentage (relative to canvas size)
    u_stroke = max(1.0, s * spec.u_weight_pct)

    # Ensure U box is large enough to hold the stroke
    u_box = max(u_box, u_stroke * 3)

    # Centered bounding box
    left_x = cx - u_box / 2
    right_x = cx + u_box / 2
    top_y = cy - u_box / 2
    bottom_y = cy + u_box / 2

    # Bottom arc radius to create a rounded U; keep within box and account for stroke
    radius = max(1.0, u_box / 2 - u_stroke / 2)

    gradient_id = "grad"

    svg = f"""
<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 {s} {s}\" role=\"img\" aria-label=\"Untis Pro logo\">
  <defs>
    <linearGradient id=\"{gradient_id}\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">
      {spec.gradient_stops(colors)}
    </linearGradient>
    <!-- Create a gradient stroke via a path painted once -->
    <linearGradient id=\"{gradient_id}-stroke\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">
      {spec.gradient_stops(colors)}
    </linearGradient>
  </defs>

  <!-- Background transparent -->
  <rect width=\"100%\" height=\"100%\" fill=\"none\"/>

  <!-- Outer ring using stroke -->
  <circle cx=\"{cx}\" cy=\"{cy}\" r=\"{(ring_outer_r + ring_inner_r)/2}\" fill=\"none\" stroke=\"url(#{gradient_id}-stroke)\" stroke-width=\"{(ring_outer_r - ring_inner_r)}\" stroke-linecap=\"round\"/>

    <!-- U letter as a stroked path, centered -->
    <path d=\"M {left_x} {top_y}
                     L {left_x} {bottom_y - radius}
                     A {radius} {radius} 0 0 0 {right_x} {bottom_y - radius}
                     L {right_x} {top_y}\"
        fill=\"none\" stroke=\"url(#{gradient_id})\" stroke-width=\"{u_stroke}\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>
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
    p = argparse.ArgumentParser(description="Generate SVG/PNGs for the Untis Pro logo")
    p.add_argument("--sizes", type=int, nargs="*", default=[256, 512, 1024], help="Output sizes in px (canvas width/height)")
    p.add_argument("--out", type=str, default="branding/dist", help="Output directory")
    p.add_argument("--png", action="store_true", help="Also export PNGs for each size (requires cairosvg)")
    p.add_argument("--colors", type=str, nargs="*", default=list(DEFAULT_COLORS), help="Three hex colors for the gradient")
    p.add_argument("--ring", type=float, default=12.0, help="Ring thickness in px")
    p.add_argument("--ring-margin", type=float, default=8.0, help="Margin from SVG edge to ring outer edge in px")
    p.add_argument("--gap", type=float, default=10.0, help="Minimum gap between U and ring in px")
    p.add_argument("--uweight", type=float, default=0.12, help="U stroke width as a fraction of size (0-1)")
    p.add_argument("--uscale", type=float, default=0.6, help="Overall U size relative to inner circle area (0-1)")
    p.add_argument("--only-canonical", action="store_true", help="Write only a single 'logo.svg' without size-suffixed variants")
    return p.parse_args(argv)


def main() -> None:
    args = parse_args()

    colors = tuple(args.colors[:3]) if args.colors else DEFAULT_COLORS
    sizes = sorted(set(int(s) for s in args.sizes))

    # If only-canonical, ignore size-suffixed outputs and write one SVG
    if args.only_canonical:
        s = max(sizes) if sizes else 512
        spec = LogoSpec(size=s, ring_thickness=args.ring, ring_margin=args.ring_margin, gap=args.gap, u_weight_pct=args.uweight, u_scale=args.uscale)
        svg = make_svg(spec, colors)
        svg_path = os.path.join(args.out, "logo.svg")
        write_svg(svg_path, svg)
        print(f"Wrote {svg_path}")
        return

    # Otherwise, write variants plus a canonical convenience file
    largest = max(sizes) if sizes else 512

    for s in sizes:
        spec = LogoSpec(size=s, ring_thickness=args.ring, ring_margin=args.ring_margin, gap=args.gap, u_weight_pct=args.uweight, u_scale=args.uscale)
        svg = make_svg(spec, colors)
        svg_path = os.path.join(args.out, f"logo_{s}.svg")
        write_svg(svg_path, svg)
        print(f"Wrote {svg_path}")

        if args.png:
            png_path = os.path.join(args.out, f"logo_{s}.png")
            export_pngs(svg, s, png_path)
            print(f"Wrote {png_path}")

    spec = LogoSpec(size=largest, ring_thickness=args.ring, ring_margin=args.ring_margin, gap=args.gap, u_weight_pct=args.uweight, u_scale=args.uscale)
    svg = make_svg(spec, colors)
    svg_path = os.path.join(args.out, "logo.svg")
    write_svg(svg_path, svg)
    print(f"Wrote {svg_path}")


if __name__ == "__main__":
    main()
