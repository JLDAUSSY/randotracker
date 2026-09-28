import math
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TRACKS_DIR = os.path.join(BASE_DIR, "tracks")
os.makedirs(TRACKS_DIR, exist_ok=True)

def generate_loop_gpx(filepath, track_name, center_lat, center_lon, radius_km, num_points, base_ele, max_ele, irregularity=0.3):
    pts = []
    for i in range(num_points):
        t = (2 * math.pi * i) / (num_points - 1)
        # Deform the circle into a realistic mountain trail
        r = radius_km * (1 + irregularity * math.sin(3 * t) + 0.18 * math.cos(5 * t) - 0.1 * math.sin(7 * t))
        dlat = (r * math.cos(t)) / 111.0
        dlon = (r * math.sin(t)) / (111.0 * math.cos(math.radians(center_lat)))
        lat = center_lat + dlat
        lon = center_lon + dlon
        
        # Elevation profile
        ele_ratio = 0.5 * (1 - math.cos(2 * t)) + 0.25 * math.sin(3 * t)
        ele = base_ele + (max_ele - base_ele) * max(0.0, min(1.0, ele_ratio))
        pts.append((lat, lon, ele))
    
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RandoTracker" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>{track_name}</name>
  </metadata>
  <trk>
    <name>{track_name}</name>
    <trkseg>
"""
    for lat, lon, ele in pts:
        xml += f'      <trkpt lat="{lat:.6f}" lon="{lon:.6f}"><ele>{ele:.1f}</ele></trkpt>\n'
    
    xml += """    </trkseg>
  </trk>
</gpx>"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(xml)

# Generate 3 realistic demo GPX tracks
generate_loop_gpx(
    os.path.join(TRACKS_DIR, "parcours_1_vert_6km.gpx"),
    "Niveau 1 - Boucle Découverte (6 km)",
    center_lat=45.8920,
    center_lon=6.1550,
    radius_km=1.1,
    num_points=90,
    base_ele=450,
    max_ele=690,
    irregularity=0.25
)

generate_loop_gpx(
    os.path.join(TRACKS_DIR, "parcours_2_bleu_12km.gpx"),
    "Niveau 2 - Balcon Panoramique (12 km)",
    center_lat=45.8960,
    center_lon=6.1700,
    radius_km=2.2,
    num_points=150,
    base_ele=450,
    max_ele=1030,
    irregularity=0.35
)

generate_loop_gpx(
    os.path.join(TRACKS_DIR, "parcours_3_rouge_18km.gpx"),
    "Niveau 3 - Traversée des Crêtes (18 km)",
    center_lat=45.9010,
    center_lon=6.1850,
    radius_km=3.4,
    num_points=220,
    base_ele=450,
    max_ele=1600,
    irregularity=0.45
)

print("Demo GPX tracks successfully generated in tracks/")
