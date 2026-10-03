# -*- coding: utf-8 -*-
"""
Générateur d'icônes haute définition Full-Bleed et Maskable pour RandoTracker
Garantit 100% de remplissage dans les lanceurs d'applications Android (Pixel, Samsung, etc.)
et conformité stricte PWA Maskable Icon (W3C Web App Manifest).
"""

import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

def generate_all_icons():
    # 1. Source image haute résolution de l'écusson boussole épuré
    src_path = os.path.abspath("randotracker_compass_clean_1791014259377.jpg")
    if not os.path.exists(src_path):
        brain_dir = r"C:\Users\lesda\.gemini\antigravity\brain\77906641-bcbe-42b2-96ee-5cef4fcc7e0f"
        src_path = os.path.join(brain_dir, "randotracker_compass_clean_1791014259377.jpg")
    
    if not os.path.exists(src_path):
        src_path = os.path.abspath("icon_option_C_compass_clean.png")
        
    print(f"Chargement de l'image source : {src_path}")
    src_img = Image.open(src_path).convert("RGBA")
    
    # 2. Découpe exacte du cadran circulaire (Center=511.5, 513.3, Radius=411.5)
    # L'anneau extérieur de la boussole touche exactement les 4 bords du canvas 512x512
    xc, yc, r = 511.47, 513.29, 411.5
    crop_box = (xc - r, yc - r, xc + r, yc + r)
    badge_full = src_img.crop(crop_box).resize((512, 512), Image.Resampling.LANCZOS)
    
    # Masque circulaire pour l'écusson
    circle_mask_512 = Image.new("L", (512, 512), 0)
    draw_mask = ImageDraw.Draw(circle_mask_512)
    draw_mask.ellipse((0, 0, 511, 511), fill=255)
    
    badge_circle_512 = badge_full.copy()
    badge_circle_512.putalpha(circle_mask_512)
    
    # Fond sombre marine/alpin pour les coins des launchers squircle (#0d273a)
    bg_color = (13, 39, 58, 255)
    full_bg_512 = Image.new("RGBA", (512, 512), bg_color)
    icon_512_full_bleed = Image.alpha_composite(full_bg_512, badge_circle_512)
    
    # A. Sauvegarde des icônes Web & Google Play Store (512x512)
    icon_512_full_bleed.convert("RGB").save("RandoTracker_Icon_Final_512.png", "PNG", optimize=True)
    icon_512_full_bleed.convert("RGB").save("RandoTracker_Icon_512.png", "PNG", optimize=True)
    icon_512_full_bleed.save("icon-512.png", "PNG", optimize=True)
    
    # B. Icônes PWA Standard (192x192 & Favicon)
    icon_192 = icon_512_full_bleed.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save("icon-192.png", "PNG", optimize=True)
    
    favicon = icon_512_full_bleed.resize((64, 64), Image.Resampling.LANCZOS)
    favicon.save("favicon.png", "PNG", optimize=True)
    
    logo = icon_512_full_bleed.resize((128, 128), Image.Resampling.LANCZOS)
    logo.save("logo.png", "PNG", optimize=True)
    
    # C. Icônes PWA Maskable (W3C Standard : Safe zone 80% pour remplir 100% de la pastille Android Chrome)
    # Dans un masque circulaire WebAPK, la zone visible est un cercle de diamètre ~440px sur 512px
    maskable_size = 460
    maskable_offset = (512 - maskable_size) // 2
    maskable_badge = badge_circle_512.resize((maskable_size, maskable_size), Image.Resampling.LANCZOS)
    
    maskable_512 = Image.new("RGBA", (512, 512), bg_color)
    maskable_512.paste(maskable_badge, (maskable_offset, maskable_offset), maskable_badge)
    maskable_512.save("icon-maskable-512.png", "PNG", optimize=True)
    
    maskable_192 = maskable_512.resize((192, 192), Image.Resampling.LANCZOS)
    maskable_192.save("icon-maskable-192.png", "PNG", optimize=True)
    
    print("[OK] Icônes Web, PWA Maskable et Play Store générées (Full-Bleed 100%).")
    
    # 3. Génération des assets Android Natifs (Projet Android / TWA)
    res_dir = os.path.abspath("android-project/app/src/main/res")
    if os.path.exists(res_dir):
        # A. Dossier anydpi-v26 pour Adaptive Icons Android 8.0+
        anydpi_dir = os.path.join(res_dir, "mipmap-anydpi-v26")
        os.makedirs(anydpi_dir, exist_ok=True)
        
        adaptive_xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
        with open(os.path.join(anydpi_dir, "ic_launcher.xml"), "w", encoding="utf-8") as f:
            f.write(adaptive_xml)
        with open(os.path.join(anydpi_dir, "ic_launcher_round.xml"), "w", encoding="utf-8") as f:
            f.write(adaptive_xml)
            
        # Couleur d'arrière-plan de l'Adaptive Icon (#0d273a)
        colors_xml_path = os.path.join(res_dir, "values", "colors.xml")
        colors_content = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#059669</color>
    <color name="colorPrimaryDark">#0d273a</color>
    <color name="navigationColor">#0d273a</color>
    <color name="ic_launcher_background">#0d273a</color>
</resources>
"""
        with open(colors_xml_path, "w", encoding="utf-8") as f:
            f.write(colors_content)
            
        # B. Densités Android mipmap
        # Total canvas = 108dp, premier plan = 74dp (ratio 74/108 pour remplir 100% de la pastille circulaire)
        densities = {
            'mipmap-mdpi': {'total': 48, 'fg_total': 108, 'fg_icon': 74},
            'mipmap-hdpi': {'total': 72, 'fg_total': 162, 'fg_icon': 111},
            'mipmap-xhdpi': {'total': 96, 'fg_total': 216, 'fg_icon': 148},
            'mipmap-xxhdpi': {'total': 144, 'fg_total': 324, 'fg_icon': 222},
            'mipmap-xxxhdpi': {'total': 192, 'fg_total': 432, 'fg_icon': 296}
        }
        
        for folder, d in densities.items():
            folder_path = os.path.join(res_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            
            # 1. Legacy ic_launcher.png (Full-Bleed)
            legacy_img = icon_512_full_bleed.resize((d['total'], d['total']), Image.Resampling.LANCZOS)
            legacy_img.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
            
            # 2. Legacy ic_launcher_round.png (Pastille circulaire pleine)
            round_mask = Image.new("L", (d['total'], d['total']), 0)
            round_draw = ImageDraw.Draw(round_mask)
            round_draw.ellipse([0, 0, d['total'] - 1, d['total'] - 1], fill=255)
            round_img = legacy_img.copy()
            round_img.putalpha(round_mask)
            round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
            
            # 3. Adaptive Foreground ic_launcher_foreground.png (108dp canvas avec cadran remplissant le masque)
            fg_canvas = Image.new("RGBA", (d['fg_total'], d['fg_total']), (0, 0, 0, 0))
            fg_emb = badge_circle_512.resize((d['fg_icon'], d['fg_icon']), Image.Resampling.LANCZOS)
            fg_offset = (d['fg_total'] - d['fg_icon']) // 2
            fg_canvas.paste(fg_emb, (fg_offset, fg_offset), fg_emb)
            fg_canvas.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
            
        print("[OK] Assets Android Natifs mipmap & anydpi-v26 générés avec succès.")

create_full_bleed_icons = generate_all_icons

if __name__ == "__main__":
    generate_all_icons()
