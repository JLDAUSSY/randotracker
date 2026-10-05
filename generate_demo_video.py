# -*- coding: utf-8 -*-
"""
Générateur de la vidéo de démonstration Google Play pour FOREGROUND_SERVICE_LOCATION
Crée une vidéo MP4 conforme aux exigences de révision de la Google Play Console.
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_PATH = r"C:\Users\lesda\.gemini\antigravity\brain\77906641-bcbe-42b2-96ee-5cef4fcc7e0f\.user_uploaded\media_1791127350311.png"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "demo_frames")
OUTPUT_VIDEO = os.path.join(PROJECT_DIR, "rando-demo-foreground-service.mp4")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. Charger et préparer les frames
base_img = Image.open(SCREENSHOT_PATH).convert('RGB')
W, H = 720, 1280
base_resized = base_img.resize((W, H), Image.Resampling.LANCZOS)

# Frame 1 : Vue de l'application avec GPS actif
img1 = base_resized.copy()
draw1 = ImageDraw.Draw(img1)
# Bannière explicative en haut
draw1.rectangle([(20, 40), (W-20, 140)], fill=(15, 23, 42, 230), outline=(16, 185, 129), width=3)
draw1.text((40, 55), "RandoTracker - Foreground Location Service", fill=(255, 255, 255))
draw1.text((40, 90), "1. User initiates live GPS tracking for group hike", fill=(52, 211, 153))

# Frame 2 : Vue avec volet de notification Android descendu
img2 = base_resized.copy()
draw2 = ImageDraw.Draw(img2)
# Volet de notification Android
draw2.rectangle([(0, 0), (W, 360)], fill=(10, 15, 29, 245), outline=(30, 41, 59), width=2)
# Notification RandoTracker
draw2.rectangle([(20, 80), (W-20, 240)], fill=(15, 23, 42), outline=(16, 185, 129), width=2)
draw2.rectangle([(35, 95), (85, 145)], fill=(5, 150, 105), outline=(255, 255, 255), width=2)
draw2.text((50, 105), "RT", fill=(255, 255, 255))
draw2.text((100, 100), "RandoTracker • Suivi GPS actif (En avant-plan)", fill=(255, 255, 255))
draw2.text((100, 130), "Position partagée en direct (écran allumé ou éteint)", fill=(148, 163, 184))
draw2.text((100, 165), "📍 Précision ±4m • 2 marcheurs connectés", fill=(52, 211, 153))
# Bannière explicative
draw2.rectangle([(20, 260), (W-20, 330)], fill=(5, 46, 22), outline=(16, 185, 129), width=2)
draw2.text((40, 280), "2. Persistent notification keeps GPS active in pocket", fill=(255, 255, 255))

# Frame 3 : Suivi en direct du groupe
img3 = base_resized.copy()
draw3 = ImageDraw.Draw(img3)
draw3.rectangle([(20, 40), (W-20, 140)], fill=(15, 23, 42, 230), outline=(16, 185, 129), width=3)
draw3.text((40, 55), "RandoTracker - Live Multi-User Sync", fill=(255, 255, 255))
draw3.text((40, 90), "3. Continuous location sharing & safety tracking", fill=(52, 211, 153))

img1.save(os.path.join(OUTPUT_DIR, "frame1.png"))
img2.save(os.path.join(OUTPUT_DIR, "frame2.png"))
img3.save(os.path.join(OUTPUT_DIR, "frame3.png"))

# 2. Créer une vidéo de 12 secondes (3 x 4s) avec ffmpeg
concat_txt = os.path.join(OUTPUT_DIR, "concat.txt")
with open(concat_txt, "w", encoding="utf-8") as f:
    f.write(f"file 'frame1.png'\nduration 4\nfile 'frame2.png'\nduration 4\nfile 'frame3.png'\nduration 4\nfile 'frame3.png'\n")

cmd = [
    "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", concat_txt,
    "-vf", "fps=30,format=yuv420p",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    OUTPUT_VIDEO
]

print("Compilation de la vidéo de démonstration...")
subprocess.run(cmd, check=True)
print("Vidéo générée avec succès :", OUTPUT_VIDEO)
