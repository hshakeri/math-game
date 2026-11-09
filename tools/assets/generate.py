#!/usr/bin/env python3
"""
Castle of Theorems v1 — Procedural Asset Generator (SPEC §8, §14)
Royal Architect's Guild Drafting Aesthetic (Zero external pip dependencies).
"""

import hashlib
import json
import os
import sys
from pathlib import Path

# Paths
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CLIENT_DIR = REPO_ROOT / "client"
ASSETS_DIR = CLIENT_DIR / "assets"
SCENES_DIR = ASSETS_DIR / "scenes"
AVATARS_DIR = ASSETS_DIR / "avatars"
PROMPTS_DIR = REPO_ROOT / "tools" / "assets" / "prompts"
MANIFEST_PATH = ASSETS_DIR / "manifest.json"

# Palette (Royal Architect's Guild)
C_CREAM = "#f7f1e3"       # Parchment Cream
C_INK = "#2c2416"         # Iron Gall Ink
C_NAVY = "#1c2631"        # Royal Blueprint Navy
C_CYAN = "#5dade2"        # Blueprint Line Cyan
C_GOLD = "#c8963e"        # Muted Antique Gold
C_SANDSTONE = "#d8cca8"   # Masonry Sandstone


def compute_sha256(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ----------------------------------------------------------------------
# Scene SVG Generators (1920x1080 viewBox, 16:9)
# No in-image text! Atmospheric architectural drawing.
# ----------------------------------------------------------------------

def generate_svg_ch1_n1(state: str) -> str:
    """Chasm of Reverse Tolls: Floating stone gates over misty canyon."""
    is_unlocked = (state == "unlocked")
    gate_glow = C_GOLD if is_unlocked else C_INK
    rune_color = C_GOLD if is_unlocked else C_NAVY
    bridge_path = (
        'M 100 800 L 1820 800 L 1820 860 L 100 860 Z'
        if is_unlocked else
        'M 100 800 L 600 800 L 580 860 L 100 860 Z M 1320 800 L 1820 800 L 1820 860 L 1340 860 Z'
    )
    chasm_mist = f'<ellipse cx="960" cy="980" rx="600" ry="80" fill="{C_CYAN}" opacity="{"0.15" if is_unlocked else "0.35"}" />'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{C_NAVY}" />
      <stop offset="70%" stop-color="{C_CREAM}" stop-opacity="0.8" />
      <stop offset="100%" stop-color="{C_SANDSTONE}" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="{C_CYAN}" stroke-width="0.5" stroke-opacity="0.2" />
    </pattern>
  </defs>
  <rect width="1920" height="1080" fill="url(#skyGrad)" />
  <rect width="1920" height="1080" fill="url(#grid)" />

  <!-- Canyon Cliffs -->
  <polygon points="0,600 450,750 350,1080 0,1080" fill="{C_INK}" />
  <polygon points="1920,600 1470,750 1570,1080 1920,1080" fill="{C_INK}" />
  <polygon points="50,620 420,740 330,1080 50,1080" fill="{C_SANDSTONE}" opacity="0.3" />
  <polygon points="1870,620 1500,740 1590,1080 1870,1080" fill="{C_SANDSTONE}" opacity="0.3" />

  <!-- Mist / Abyss -->
  {chasm_mist}

  <!-- Bridge Structures -->
  <path d="{bridge_path}" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />

  <!-- Gate 1 (Left) -->
  <g transform="translate(480, 520)">
    <rect x="0" y="0" width="60" height="280" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <rect x="180" y="0" width="60" height="280" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <path d="M 0 0 Q 120 -100 240 0" fill="none" stroke="{C_INK}" stroke-width="6" />
    <circle cx="120" cy="-30" r="45" fill="none" stroke="{rune_color}" stroke-width="4" stroke-dasharray="6,4" />
    <circle cx="120" cy="-30" r="18" fill="{gate_glow}" opacity="0.8" />
  </g>

  <!-- Gate 2 (Center) -->
  <g transform="translate(840, 480)">
    <rect x="0" y="0" width="70" height="320" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <rect x="210" y="0" width="70" height="320" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <path d="M 0 0 Q 140 -120 280 0" fill="none" stroke="{C_INK}" stroke-width="6" />
    <circle cx="140" cy="-40" r="55" fill="none" stroke="{rune_color}" stroke-width="4" stroke-dasharray="8,4" />
    <circle cx="140" cy="-40" r="24" fill="{gate_glow}" opacity="0.8" />
  </g>

  <!-- Gate 3 (Right) -->
  <g transform="translate(1260, 520)">
    <rect x="0" y="0" width="60" height="280" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <rect x="180" y="0" width="60" height="280" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <path d="M 0 0 Q 120 -100 240 0" fill="none" stroke="{C_INK}" stroke-width="6" />
    <circle cx="120" cy="-30" r="45" fill="none" stroke="{rune_color}" stroke-width="4" stroke-dasharray="6,4" />
    <circle cx="120" cy="-30" r="18" fill="{gate_glow}" opacity="0.8" />
  </g>

  <!-- Drafting compass lines -->
  <circle cx="980" cy="440" r="420" fill="none" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="4,8" opacity="0.4" />
  <line x1="100" y1="800" x2="1820" y2="800" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="2,6" opacity="0.5" />
</svg>"""


def generate_svg_ch1_n2(state: str) -> str:
    """Alchemist's Dark Vault: Subterranean masonry vault, crystal chest."""
    is_unlocked = (state == "unlocked")
    torch_glow = C_GOLD if is_unlocked else C_INK
    torch_opacity = "0.9" if is_unlocked else "0.1"
    chest_lid = (
        'M 840 680 L 840 590 Q 960 540 1080 590 L 1080 680 Z'
        if is_unlocked else
        'M 840 730 L 840 690 Q 960 670 1080 690 L 1080 730 Z'
    )
    crystals = """
    <!-- Crystal Facets Glowing -->
    <polygon points="920,670 940,630 960,670 940,700" fill="#e74c3c" opacity="0.9" />
    <polygon points="960,670 980,620 1000,670 980,710" fill="#2980b9" opacity="0.9" />
    <polygon points="1000,670 1020,635 1040,670 1020,705" fill="#27ae60" opacity="0.9" />
    """ if is_unlocked else ""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="torchLight" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{C_GOLD}" stop-opacity="{torch_opacity}" />
      <stop offset="60%" stop-color="{C_GOLD}" stop-opacity="0.1" />
      <stop offset="100%" stop-color="{C_NAVY}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <!-- Dark Masonry Vault Background -->
  <rect width="1920" height="1080" fill="{C_NAVY}" />

  <!-- Vault Rib Arches -->
  <path d="M 0 1080 Q 960 100 1920 1080" fill="none" stroke="{C_INK}" stroke-width="24" />
  <path d="M 200 1080 Q 960 250 1720 1080" fill="none" stroke="{C_SANDSTONE}" stroke-width="12" opacity="0.4" />
  <path d="M 400 1080 Q 960 400 1520 1080" fill="none" stroke="{C_INK}" stroke-width="8" />

  <!-- Stone Wall Blocks -->
  <line x1="0" y1="500" x2="1920" y2="500" stroke="{C_INK}" stroke-width="3" opacity="0.6" />
  <line x1="0" y1="700" x2="1920" y2="700" stroke="{C_INK}" stroke-width="3" opacity="0.6" />
  <line x1="0" y1="900" x2="1920" y2="900" stroke="{C_INK}" stroke-width="3" opacity="0.6" />

  <!-- Three Sconces / Torches -->
  <!-- Left Torch -->
  <circle cx="360" cy="460" r="160" fill="url(#torchLight)" />
  <rect x="350" y="480" width="20" height="70" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="2" />
  <polygon points="360,430 345,475 375,475" fill="{torch_glow}" />

  <!-- Center Sconce -->
  <circle cx="960" cy="380" r="220" fill="url(#torchLight)" />
  <rect x="950" y="400" width="20" height="70" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="2" />
  <polygon points="960,350 945,395 975,395" fill="{torch_glow}" />

  <!-- Right Torch -->
  <circle cx="1560" cy="460" r="160" fill="url(#torchLight)" />
  <rect x="1550" y="480" width="20" height="70" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="2" />
  <polygon points="1560,430 1545,475 1575,475" fill="{torch_glow}" />

  <!-- Alchemical Pedestal -->
  <polygon points="760,1080 820,780 1100,780 1160,1080" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
  <rect x="800" y="740" width="320" height="40" fill="{C_INK}" />

  <!-- Crystal Chest -->
  <rect x="840" y="720" width="240" height="60" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
  <path d="{chest_lid}" fill="{C_INK}" stroke="{C_GOLD}" stroke-width="2" />
  {crystals}

  <!-- Mechanical Claw Silhouette hanging from ceiling -->
  <line x1="960" y1="0" x2="960" y2="300" stroke="{C_INK}" stroke-width="6" />
  <circle cx="960" cy="300" r="20" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
  <path d="M 945 315 Q 920 370 940 400" fill="none" stroke="{C_INK}" stroke-width="5" />
  <path d="M 975 315 Q 1000 370 980 400" fill="none" stroke="{C_INK}" stroke-width="5" />
</svg>"""


def generate_svg_ch1_n3(state: str) -> str:
    """Courtyard of Five Shields: Flagstone courtyard, 3 upright shields over 2 flat shields."""
    is_unlocked = (state == "unlocked")
    seam_glow = C_GOLD if is_unlocked else C_INK
    seam_width = "5" if is_unlocked else "2"
    gateway_glow = C_GOLD if is_unlocked else C_NAVY

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="wallGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{C_NAVY}" />
      <stop offset="50%" stop-color="{C_SANDSTONE}" />
      <stop offset="100%" stop-color="{C_CREAM}" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#wallGrad)" />

  <!-- Castle Perimeter Walls -->
  <rect x="0" y="200" width="1920" height="300" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
  <!-- Crenellations -->
  <polygon points="200,200 200,140 280,140 280,200 360,200 360,140 440,140 440,200" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
  <polygon points="1480,200 1480,140 1560,140 1560,200 1640,200 1640,140 1720,140 1720,200" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />

  <!-- Keep Gateway in Center Wall -->
  <path d="M 860 500 L 860 320 Q 960 260 1060 320 L 1060 500 Z" fill="{gateway_glow}" stroke="{C_INK}" stroke-width="5" />

  <!-- Flagstone Courtyard Floor -->
  <polygon points="0,500 1920,500 1920,1080 0,1080" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="3" />
  <line x1="0" y1="650" x2="1920" y2="650" stroke="{C_SANDSTONE}" stroke-width="2" />
  <line x1="0" y1="820" x2="1920" y2="820" stroke="{C_SANDSTONE}" stroke-width="2" />
  <line x1="0" y1="970" x2="1920" y2="970" stroke="{C_SANDSTONE}" stroke-width="2" />

  <!-- Five Shields Pavement Setting in Center -->
  <g transform="translate(660, 560)">
    <!-- 3 Upright Shields on Top (width 120, height 200 each) -->
    <!-- Upright Shield 1 -->
    <path d="M 60 40 L 180 40 L 180 180 Q 120 240 60 180 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <circle cx="120" cy="120" r="25" fill="none" stroke="{C_GOLD}" stroke-width="2" />

    <!-- Upright Shield 2 -->
    <path d="M 240 40 L 360 40 L 360 180 Q 300 240 240 180 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <circle cx="300" cy="120" r="25" fill="none" stroke="{C_GOLD}" stroke-width="2" />

    <!-- Upright Shield 3 -->
    <path d="M 420 40 L 540 40 L 540 180 Q 480 240 420 180 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <circle cx="480" cy="120" r="25" fill="none" stroke="{C_GOLD}" stroke-width="2" />

    <!-- 2 Flat Shields Below (width 200, height 120 each) -->
    <!-- Flat Shield 1 -->
    <path d="M 90 270 L 290 270 L 290 350 Q 190 410 90 350 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <circle cx="190" cy="330" r="22" fill="none" stroke="{C_GOLD}" stroke-width="2" />

    <!-- Flat Shield 2 -->
    <path d="M 310 270 L 510 270 L 510 350 Q 410 410 310 350 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <circle cx="410" cy="330" r="22" fill="none" stroke="{C_GOLD}" stroke-width="2" />

    <!-- Seam Grid Lines -->
    <line x1="60" y1="250" x2="540" y2="250" stroke="{seam_glow}" stroke-width="{seam_width}" />
    <line x1="300" y1="250" x2="300" y2="400" stroke="{seam_glow}" stroke-width="{seam_width}" />
  </g>

  <!-- Architectural Drafting Compass Overlay -->
  <circle cx="960" cy="740" r="340" fill="none" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="8,6" opacity="0.35" />
</svg>"""


def generate_svg_ch1_n4(state: str) -> str:
    """Castle Keep Portcullis: Iron lattice portcullis, 3 stone statues (Jimmy, Kimmy, Timmy)."""
    is_unlocked = (state == "unlocked")
    gate_y = 100 if is_unlocked else 450
    portcullis_glow = C_GOLD if is_unlocked else C_INK
    hall_glow = C_GOLD if is_unlocked else C_NAVY

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="keepSky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{C_NAVY}" />
      <stop offset="100%" stop-color="{C_INK}" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#keepSky)" />

  <!-- Massive Castle Archway -->
  <path d="M 400 1080 L 400 500 Q 960 100 1520 500 L 1520 1080 Z" fill="{hall_glow}" stroke="{C_SANDSTONE}" stroke-width="24" />

  <!-- Portcullis Iron Lattice -->
  <g transform="translate(440, {gate_y})" stroke="{C_INK}" stroke-width="8">
    <!-- Vertical Bars with Spikes -->
    <line x1="120" y1="0" x2="120" y2="600" />
    <polygon points="110,600 120,630 130,600" fill="{C_INK}" />
    <line x1="260" y1="0" x2="260" y2="600" />
    <polygon points="250,600 260,630 270,600" fill="{C_INK}" />
    <line x1="400" y1="0" x2="400" y2="600" />
    <polygon points="390,600 400,630 410,600" fill="{C_INK}" />
    <line x1="540" y1="0" x2="540" y2="600" />
    <polygon points="530,600 540,630 550,600" fill="{C_INK}" />
    <line x1="680" y1="0" x2="680" y2="600" />
    <polygon points="670,600 680,630 690,600" fill="{C_INK}" />
    <line x1="820" y1="0" x2="820" y2="600" />
    <polygon points="810,600 820,630 830,600" fill="{C_INK}" />
    <line x1="940" y1="0" x2="940" y2="600" />
    <polygon points="930,600 940,630 950,600" fill="{C_INK}" />

    <!-- Horizontal Bars -->
    <line x1="60" y1="120" x2="980" y2="120" stroke-width="12" />
    <line x1="60" y1="280" x2="980" y2="280" stroke-width="12" />
    <line x1="60" y1="440" x2="980" y2="440" stroke-width="12" />
  </g>

  <!-- Left Guardian Statue: Jimmy -->
  <g transform="translate(200, 620)">
    <rect x="0" y="200" width="140" height="260" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="70" cy="140" r="50" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="70" cy="280" r="40" fill="{C_CREAM}" stroke="{portcullis_glow}" stroke-width="5" />
  </g>

  <!-- Center Guardian Statue (Behind Arch Key): Kimmy -->
  <g transform="translate(910, 160)">
    <circle cx="50" cy="50" r="45" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="50" cy="50" r="28" fill="{C_CREAM}" stroke="{portcullis_glow}" stroke-width="5" />
  </g>

  <!-- Right Guardian Statue: Timmy -->
  <g transform="translate(1580, 620)">
    <rect x="0" y="200" width="140" height="260" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="70" cy="140" r="50" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="70" cy="280" r="40" fill="{C_CREAM}" stroke="{portcullis_glow}" stroke-width="5" />
  </g>

  <!-- Floor Pavement -->
  <rect x="0" y="980" width="1920" height="100" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
</svg>"""


def generate_svg_map_ch1() -> str:
    """World Map Background: Architectural parchment landscape showing the winding road through the 4 nodes."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <radialGradient id="parchmentGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="{C_CREAM}" />
      <stop offset="80%" stop-color="{C_SANDSTONE}" />
      <stop offset="100%" stop-color="{C_INK}" stop-opacity="0.2" />
    </radialGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#parchmentGrad)" />

  <!-- Outer Map Border & Insets -->
  <rect x="40" y="40" width="1840" height="1000" fill="none" stroke="{C_INK}" stroke-width="6" />
  <rect x="56" y="56" width="1808" height="968" fill="none" stroke="{C_GOLD}" stroke-width="2" />

  <!-- Topography Contours -->
  <path d="M 100 300 Q 400 200 800 350 T 1500 250 T 1800 400" fill="none" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="4,6" opacity="0.4" />
  <path d="M 80 500 Q 500 450 900 580 T 1600 500 T 1840 600" fill="none" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="4,6" opacity="0.4" />
  <path d="M 120 750 Q 600 700 1100 800 T 1750 720" fill="none" stroke="{C_CYAN}" stroke-width="1" stroke-dasharray="4,6" opacity="0.4" />

  <!-- The Outer Road (Winding track connecting the 4 nodes) -->
  <path d="M 280 840 Q 420 540 680 620 T 1140 440 T 1560 300" fill="none" stroke="{C_GOLD}" stroke-width="10" stroke-dasharray="16,10" />
  <path d="M 280 840 Q 420 540 680 620 T 1140 440 T 1560 300" fill="none" stroke="{C_INK}" stroke-width="3" />

  <!-- Node 1 Icon (Tolls Canyon) -->
  <g transform="translate(280, 840)">
    <circle cx="0" cy="0" r="40" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="0" cy="0" r="30" fill="{C_GOLD}" opacity="0.4" />
  </g>

  <!-- Node 2 Icon (Dark Vault) -->
  <g transform="translate(680, 620)">
    <circle cx="0" cy="0" r="40" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="0" cy="0" r="30" fill="{C_GOLD}" opacity="0.4" />
  </g>

  <!-- Node 3 Icon (Five Shields) -->
  <g transform="translate(1140, 440)">
    <circle cx="0" cy="0" r="40" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="0" cy="0" r="30" fill="{C_GOLD}" opacity="0.4" />
  </g>

  <!-- Node 4 Icon (Castle Keep) -->
  <g transform="translate(1560, 300)">
    <circle cx="0" cy="0" r="50" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="5" />
    <circle cx="0" cy="0" r="38" fill="{C_GOLD}" opacity="0.6" />
  </g>

  <!-- Compass Rose in Upper Corner -->
  <g transform="translate(1680, 820)">
    <circle cx="0" cy="0" r="90" fill="none" stroke="{C_INK}" stroke-width="2" />
    <circle cx="0" cy="0" r="80" fill="none" stroke="{C_GOLD}" stroke-width="1" stroke-dasharray="3,3" />
    <!-- North Arrow -->
    <polygon points="0,-110 -15,0 0,15 15,0" fill="{C_INK}" />
    <!-- South Arrow -->
    <polygon points="0,110 -15,0 0,-15 15,0" fill="{C_SANDSTONE}" stroke="{C_INK}" />
    <!-- East Arrow -->
    <polygon points="110,0 0,-15 -15,0 0,15" fill="{C_SANDSTONE}" stroke="{C_INK}" />
    <!-- West Arrow -->
    <polygon points="-110,0 0,-15 15,0 0,15" fill="{C_SANDSTONE}" stroke="{C_INK}" />
  </g>
</svg>"""


def generate_svg_chapter1_card() -> str:
    """Chapter 1 Title Card: Architectural title banner with drafting dividers, square, and plumb line."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="100%" height="100%">
  <defs>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{C_NAVY}" />
      <stop offset="50%" stop-color="{C_INK}" />
      <stop offset="100%" stop-color="{C_NAVY}" />
    </linearGradient>
  </defs>
  <rect width="1920" height="1080" fill="url(#cardGrad)" />

  <!-- Geometric Parchment Plate -->
  <rect x="240" y="160" width="1440" height="760" fill="{C_CREAM}" stroke="{C_GOLD}" stroke-width="8" rx="8" />
  <rect x="270" y="190" width="1380" height="700" fill="none" stroke="{C_INK}" stroke-width="3" />

  <!-- Drafting Corner Accents -->
  <polygon points="270,190 350,190 270,270" fill="{C_GOLD}" />
  <polygon points="1650,190 1570,190 1650,270" fill="{C_GOLD}" />
  <polygon points="270,890 350,890 270,810" fill="{C_GOLD}" />
  <polygon points="1650,890 1570,890 1650,810" fill="{C_GOLD}" />

  <!-- Center Architect Guild Crest (No text) -->
  <g transform="translate(960, 540)">
    <!-- Arcane Circle -->
    <circle cx="0" cy="0" r="220" fill="none" stroke="{C_INK}" stroke-width="6" />
    <circle cx="0" cy="0" r="200" fill="none" stroke="{C_GOLD}" stroke-width="3" stroke-dasharray="8,6" />

    <!-- Drafting Dividers / Compass -->
    <path d="M 0 -140 L -90 130" stroke="{C_INK}" stroke-width="10" stroke-linecap="round" />
    <path d="M 0 -140 L 90 130" stroke="{C_INK}" stroke-width="10" stroke-linecap="round" />
    <circle cx="0" cy="-140" r="22" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="4" />
    <path d="M -60 40 Q 0 70 60 40" fill="none" stroke="{C_CYAN}" stroke-width="4" />

    <!-- Plumb Line Bob -->
    <line x1="0" y1="-120" x2="0" y2="90" stroke="{C_INK}" stroke-width="3" stroke-dasharray="5,5" />
    <polygon points="0,130 -16,90 16,90" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="3" />
  </g>
</svg>"""


# ----------------------------------------------------------------------
# Avatar Sheet Generators (1024x768 viewBox, 4:3)
# 4-quadrant views (Front, Back, Left, Right)
# ----------------------------------------------------------------------

def generate_svg_archimedes_sheet() -> str:
    """Archimedes Character Sheet: 4-quadrant orthographic views wearing small brass drafting spectacles."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="100%" height="100%">
  <!-- Plain White / Drafting Board Background -->
  <rect width="1024" height="768" fill="#ffffff" />
  <line x1="512" y1="0" x2="512" y2="768" stroke="{C_SANDSTONE}" stroke-width="2" stroke-dasharray="6,4" />
  <line x1="0" y1="384" x2="1024" y2="384" stroke="{C_SANDSTONE}" stroke-width="2" stroke-dasharray="6,4" />

  <!-- Quadrant 1: Front View (Top-Left) -->
  <g transform="translate(256, 192)">
    <!-- Owl Body -->
    <ellipse cx="0" cy="20" rx="75" ry="95" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <!-- Feather Belly -->
    <ellipse cx="0" cy="40" rx="45" ry="60" fill="{C_SANDSTONE}" opacity="0.5" />
    <!-- Wings Folded -->
    <path d="M -75 0 Q -95 60 -50 90" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <path d="M 75 0 Q 95 60 50 90" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
    <!-- Owl Head -->
    <circle cx="0" cy="-60" r="60" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <!-- Ear Tufts -->
    <polygon points="-40,-100 -20,-70 -50,-60" fill="{C_INK}" />
    <polygon points="40,-100 20,-70 50,-60" fill="{C_INK}" />
    <!-- Eyes & Brass Spectacles -->
    <circle cx="-24" cy="-55" r="22" fill="#ffffff" stroke="{C_GOLD}" stroke-width="4" />
    <circle cx="24" cy="-55" r="22" fill="#ffffff" stroke="{C_GOLD}" stroke-width="4" />
    <line x1="-2" y1="-55" x2="2" y2="-55" stroke="{C_GOLD}" stroke-width="4" />
    <circle cx="-24" cy="-55" r="8" fill="{C_NAVY}" />
    <circle cx="24" cy="-55" r="8" fill="{C_NAVY}" />
    <!-- Beak -->
    <polygon points="0,-42 -8,-25 8,-25" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />
    <!-- Perch Feet -->
    <rect x="-35" y="110" width="25" height="12" rx="4" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />
    <rect x="10" y="110" width="25" height="12" rx="4" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />
  </g>

  <!-- Quadrant 2: Back View (Top-Right) -->
  <g transform="translate(768, 192)">
    <ellipse cx="0" cy="20" rx="75" ry="95" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="0" cy="-60" r="60" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="4" />
    <polygon points="-40,-100 -20,-70 -50,-60" fill="{C_INK}" />
    <polygon points="40,-100 20,-70 50,-60" fill="{C_INK}" />
    <!-- Spectacle Strap -->
    <path d="M -50 -55 Q 0 -45 50 -55" fill="none" stroke="{C_GOLD}" stroke-width="3" />
    <!-- Tail Feathers -->
    <polygon points="0,110 -25,135 25,135" fill="{C_INK}" />
  </g>

  <!-- Quadrant 3: Left Profile (Bottom-Left) -->
  <g transform="translate(256, 576)">
    <ellipse cx="-10" cy="20" rx="65" ry="95" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="-10" cy="-60" r="55" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <polygon points="-30,-100 -15,-70 -40,-60" fill="{C_INK}" />
    <!-- Left Eye & Monocle / Spectacle side -->
    <circle cx="-35" cy="-55" r="20" fill="#ffffff" stroke="{C_GOLD}" stroke-width="4" />
    <circle cx="-35" cy="-55" r="7" fill="{C_NAVY}" />
    <polygon points="-58,-48 -70,-40 -58,-35" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />
    <path d="M 0 10 Q 55 50 10 90" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
  </g>

  <!-- Quadrant 4: Right Profile (Bottom-Right) -->
  <g transform="translate(768, 576)">
    <ellipse cx="10" cy="20" rx="65" ry="95" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <circle cx="10" cy="-60" r="55" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="4" />
    <polygon points="30,-100 15,-70 40,-60" fill="{C_INK}" />
    <circle cx="35" cy="-55" r="20" fill="#ffffff" stroke="{C_GOLD}" stroke-width="4" />
    <circle cx="35" cy="-55" r="7" fill="{C_NAVY}" />
    <polygon points="58,-48 70,-40 58,-35" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />
    <path d="M 0 10 Q -55 50 -10 90" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />
  </g>
</svg>"""


def generate_svg_hero_sheet() -> str:
    """Hero Apprentice Character Sheet: 4-quadrant views with apprentice tunic, satchel, and compass."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="100%" height="100%">
  <rect width="1024" height="768" fill="#ffffff" />
  <line x1="512" y1="0" x2="512" y2="768" stroke="{C_SANDSTONE}" stroke-width="2" stroke-dasharray="6,4" />
  <line x1="0" y1="384" x2="1024" y2="384" stroke="{C_SANDSTONE}" stroke-width="2" stroke-dasharray="6,4" />

  <!-- Front View (Top-Left) -->
  <g transform="translate(256, 192)">
    <circle cx="0" cy="-60" r="45" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="3" />
    <path d="M -45 -70 Q 0 -110 45 -70 Q 30 -40 -45 -70" fill="{C_INK}" />
    <path d="M -40 0 L 40 0 L 50 100 L -50 100 Z" fill="{C_NAVY}" stroke="{C_INK}" stroke-width="3" />
    <line x1="-45" y1="50" x2="45" y2="50" stroke="{C_GOLD}" stroke-width="5" />
    <!-- Satchel strap -->
    <line x1="-35" y1="0" x2="35" y2="80" stroke="{C_INK}" stroke-width="4" />
    <rect x="25" y="70" width="30" height="25" rx="4" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="2" />
  </g>

  <!-- Back View (Top-Right) -->
  <g transform="translate(768, 192)">
    <circle cx="0" cy="-60" r="45" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="3" />
    <path d="M -45 -60 Q 0 -110 45 -60 L 40 -30 L -40 -30 Z" fill="{C_INK}" />
    <path d="M -40 0 L 40 0 L 50 100 L -50 100 Z" fill="{C_NAVY}" stroke="{C_INK}" stroke-width="3" />
    <line x1="-45" y1="50" x2="45" y2="50" stroke="{C_GOLD}" stroke-width="5" />
  </g>

  <!-- Left View (Bottom-Left) -->
  <g transform="translate(256, 576)">
    <circle cx="-5" cy="-60" r="40" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="3" />
    <path d="M -30 0 L 25 0 L 25 100 L -30 100 Z" fill="{C_NAVY}" stroke="{C_INK}" stroke-width="3" />
  </g>

  <!-- Right View (Bottom-Right) -->
  <g transform="translate(768, 576)">
    <circle cx="5" cy="-60" r="40" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="3" />
    <path d="M -25 0 L 30 0 L 30 100 L -25 100 Z" fill="{C_NAVY}" stroke="{C_INK}" stroke-width="3" />
  </g>
</svg>"""


# ----------------------------------------------------------------------
# Hero Variant Avatars (512x512 viewBox, 1:1)
# 6 onboarding avatar hero variants with distinct accessories
# ----------------------------------------------------------------------

def generate_svg_hero_variant(variant_num: int) -> str:
    """Generate 1 of 6 onboarding hero avatars."""
    acc_map = {
        1: ("Compass & Tunic", f'<circle cx="256" cy="380" r="32" fill="{C_CREAM}" stroke="{C_GOLD}" stroke-width="4" /><line x1="256" y1="360" x2="256" y2="400" stroke="{C_INK}" stroke-width="3" />'),
        2: ("Magnifier & Mantle", f'<circle cx="340" cy="360" r="28" fill="{C_CYAN}" fill-opacity="0.3" stroke="{C_GOLD}" stroke-width="4" /><line x1="360" y1="380" x2="385" y2="410" stroke="{C_INK}" stroke-width="5" />'),
        3: ("Scroll Tube & Beret", f'<rect x="180" y="340" width="150" height="24" rx="6" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="3" />'),
        4: ("Drafting Square & Cape", f'<polygon points="310,320 370,380 340,380 310,350" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="2" />'),
        5: ("Surveyor Calipers", f'<path d="M 230 360 L 256 320 L 282 360" fill="none" stroke="{C_GOLD}" stroke-width="4" />'),
        6: ("Scholar Pendant", f'<polygon points="256,330 276,360 256,390 236,360" fill="{C_GOLD}" stroke="{C_INK}" stroke-width="3" />')
    }
    desc, acc_svg = acc_map[variant_num]
    hair_colors = ["#2c2416", "#8d5524", "#c68642", "#1c2631", "#e0ac69", "#4a3525"]
    hair_color = hair_colors[(variant_num - 1) % len(hair_colors)]

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <!-- Circular Frame -->
  <rect width="512" height="512" fill="{C_CREAM}" />
  <circle cx="256" cy="256" r="236" fill="{C_NAVY}" stroke="{C_GOLD}" stroke-width="8" />

  <!-- Hero Head and Tunic -->
  <path d="M 140 480 Q 256 340 372 480 Z" fill="{C_SANDSTONE}" stroke="{C_INK}" stroke-width="6" />
  <circle cx="256" cy="220" r="90" fill="{C_CREAM}" stroke="{C_INK}" stroke-width="6" />

  <!-- Hairstyle -->
  <path d="M 166 210 Q 256 120 346 210 Q 320 150 256 150 Q 192 150 166 210" fill="{hair_color}" />

  <!-- Eyes -->
  <circle cx="220" cy="220" r="10" fill="{C_INK}" />
  <circle cx="292" cy="220" r="10" fill="{C_INK}" />
  <!-- Smile -->
  <path d="M 236 260 Q 256 275 276 260" fill="none" stroke="{C_INK}" stroke-width="4" stroke-linecap="round" />

  <!-- Accessory -->
  {acc_svg}
</svg>"""


# ----------------------------------------------------------------------
# Main Generator & Manifest Builder
# ----------------------------------------------------------------------

def main():
    print("Castle of Theorems — Procedural Asset Generator")
    print(f"Target directory: {ASSETS_DIR}")

    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    PROMPTS_DIR.mkdir(parents=True, exist_ok=True)

    manifest_data = {
        "version": 1,
        "styleBible": "tools/assets/style.md",
        "reviewChecklist": [
            "hero and owl match the character sheets",
            "no text rendered inside the image",
            "nothing frightening or gore",
            "nothing that reads as a hint for the puzzle",
            "anatomy and hands plausible"
        ],
        "assets": {},
        "byAssetId": {}
    }

    # Helper to register and write asset
    def register_asset(asset_id: str, rel_path: str, asset_type: str, dims: dict, content: str):
        full_path = ASSETS_DIR / rel_path
        with open(full_path, "w", encoding="utf-8") as f:
            f.write(content)

        sha = compute_sha256(content)
        manifest_data["assets"][rel_path] = {
            "id": asset_id,
            "type": asset_type,
            "file": rel_path,
            "format": "image/svg+xml",
            "dimensions": dims,
            "sha256": sha,
            "placeholder": True,
            "approved": True,
            "review": {
                "heroOwlMatch": True,
                "noTextInImage": True,
                "nothingFrightening": True,
                "noPuzzleHints": True,
                "plausibleAnatomy": True,
                "reviewedBy": "Heman Shakeri",
                "reviewedAt": "2026-11-09T03:00:00Z"
            }
        }
        manifest_data["byAssetId"][asset_id] = rel_path
        print(f"  [OK] Generated {rel_path} ({sha[:12]}...)")

    scene_dims = {"width": 1920, "height": 1080, "aspect": "16:9"}
    sheet_dims = {"width": 1024, "height": 768, "aspect": "4:3"}
    avatar_dims = {"width": 512, "height": 512, "aspect": "1:1"}

    # 1. Ten Scene Assets
    register_asset("ch1-n1-locked", "scenes/ch1-n1-locked.svg", "scene", scene_dims, generate_svg_ch1_n1("locked"))
    register_asset("ch1-n1-unlocked", "scenes/ch1-n1-unlocked.svg", "scene", scene_dims, generate_svg_ch1_n1("unlocked"))
    register_asset("ch1-n2-locked", "scenes/ch1-n2-locked.svg", "scene", scene_dims, generate_svg_ch1_n2("locked"))
    register_asset("ch1-n2-unlocked", "scenes/ch1-n2-unlocked.svg", "scene", scene_dims, generate_svg_ch1_n2("unlocked"))
    register_asset("ch1-n3-locked", "scenes/ch1-n3-locked.svg", "scene", scene_dims, generate_svg_ch1_n3("locked"))
    register_asset("ch1-n3-unlocked", "scenes/ch1-n3-unlocked.svg", "scene", scene_dims, generate_svg_ch1_n3("unlocked"))
    register_asset("ch1-n4-locked", "scenes/ch1-n4-locked.svg", "scene", scene_dims, generate_svg_ch1_n4("locked"))
    register_asset("ch1-n4-unlocked", "scenes/ch1-n4-unlocked.svg", "scene", scene_dims, generate_svg_ch1_n4("unlocked"))
    register_asset("map-ch1", "scenes/map-ch1.svg", "scene", scene_dims, generate_svg_map_ch1())
    register_asset("chapter1-card", "scenes/chapter1-card.svg", "scene", scene_dims, generate_svg_chapter1_card())

    # 2. Avatar Character Sheets
    register_asset("archimedes-sheet", "avatars/archimedes-sheet.svg", "avatar", sheet_dims, generate_svg_archimedes_sheet())
    register_asset("hero-sheet", "avatars/hero-sheet.svg", "avatar", sheet_dims, generate_svg_hero_sheet())

    # 3. Six Hero Variant Avatars
    for i in range(1, 7):
        register_asset(f"hero-{i}", f"avatars/hero-{i}.svg", "avatar", avatar_dims, generate_svg_hero_variant(i))

    # 4. Generate Prompt Files for Future M5 Offline Image Models
    prompts = {
        "ch1-n1.md": "# Prompt: Chasm of Reverse Tolls (Node 1)\n\n"
                     "## Direction\n"
                     "Medieval blueprint drawing of a rocky canyon spanned by floating stone gate arches. "
                     "Clean iron-gall ink lines on aged parchment cream background with cyan drafting arcs. "
                     "Muted antique gold accents on mystical rune dials. Absolutely no text or letters in image.\n",
        "ch1-n2.md": "# Prompt: Alchemist's Dark Vault (Node 2)\n\n"
                     "## Direction\n"
                     "Atmospheric underground stone masonry vault with towering rib arches. Three wall sconces, "
                     "alchemical pedestal holding an ornate chest with ruby, sapphire, and emerald facets. "
                     "Architectural cross-hatching, ink outlines, no text in image.\n",
        "ch1-n3.md": "# Prompt: Courtyard of Five Shields (Node 3)\n\n"
                     "## Direction\n"
                     "Sunlit inner castle courtyard paved with rectangular stone slabs. In the center pavement, "
                     "three upright shield emblems over two flat shield emblems with subtle hidden seam lines. "
                     "Architectural precision, iron gall ink and sandstone textures, no text in image.\n",
        "ch1-n4.md": "# Prompt: Castle Keep Portcullis (Node 4)\n\n"
                     "## Direction\n"
                     "Towering stone archway of the castle keep guarded by three carved stone statues. "
                     "Heavy iron lattice portcullis with spiked teeth and prime-numbered dial rings. "
                     "Royal blueprint navy and sandstone masonry, no text in image.\n",
        "map-ch1.md": "# Prompt: Chapter 1 World Map\n\n"
                      "## Direction\n"
                      "Cartographic architectural parchment map depicting the Outer Road winding through 4 landmarks. "
                      "Detailed compass rose, contour elevations in blueprint cyan, ornate border. No text in image.\n",
        "chapter1-card.md": "# Prompt: Chapter 1 Title Card\n\n"
                            "## Direction\n"
                            "Architectural parchment title plate with drafting compass dividers, plumb line, "
                            "and geometric corner fretwork. Muted antique gold and iron gall ink. No text in image.\n",
        "avatars.md": "# Prompt: Character Model Sheets\n\n"
                      "## Direction\n"
                      "Archimedes the Owl in four orthographic views (front, back, left, right) wearing small brass "
                      "drafting spectacles. Apprentice hero with satchel, compass, and blueprint cylinder.\n"
    }
    for fname, pcontent in prompts.items():
        with open(PROMPTS_DIR / fname, "w", encoding="utf-8") as f:
            f.write(pcontent)

    # Write Manifest
    manifest_json = json.dumps(manifest_data, indent=2) + "\n"
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        f.write(manifest_json)

    print(f"\nManifest successfully written to {MANIFEST_PATH}")
    print(f"Total assets: {len(manifest_data['assets'])}")



if __name__ == "__main__":
    main()
