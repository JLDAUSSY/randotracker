# -*- coding: utf-8 -*-
"""
Générateur d'icônes haute définition Full-Bleed et Maskable pour RandoTracker
Garantit 100% de remplissage dans les lanceurs d'applications Android (Pixel, Samsung, etc.)
et conformité stricte PWA Maskable Icon (W3C Web App Manifest).
"""

import os
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

def create_full_bleed_icons():
    # 1. Charger l'icône source
    src_icon_path = os.path.abspath("icon-512.png")
    if not os.path.exists(src_icon_path):
        src_icon_path = os.path.abspath("logo_raw_crop.png")
    
    src_img = Image.open(src_icon_path).convert("RGBA")
    
    # 2. Créer le fond full-bleed 512x512 (aucun coin transparent)
    bg_size = 512
    full_bg = Image.new("RGBA", (bg_size, bg_size), (15, 23, 42, 255)) # #0f172a (Dark Slate)
    
    # Gradient subtil émeraude vers slate sombre
    draw_bg = ImageDraw.Draw(full_bg)
    for y in range(bg_size):
        ratio = y / bg_size
        r = int(5 * (1 - ratio) + 15 * ratio)
        g = int(150 * (1 - ratio) + 23 * ratio)
        b = int(105 * (1 - ratio) + 42 * ratio)
        draw_bg.line([(0, y), (bg_size, y)], fill=(r, g, b, 255))
    
    # 3. Redimensionner l'emblème pour remplir parfaitement la zone sûre (Safe-Zone 75-80%)
    # Diamètre environ 410px sur 512px
    emblem_size = 416
    emblem = src_img.resize((emblem_size, emblem_size), Image.Resampling.LANCZOS)
    
    # Ombre portée douce sous l'emblème
    shadow = Image.new("RGBA", (bg_size, bg_size), (0, 0, 0, 0))
    shadow_offset = (bg_size - emblem_size) // 2
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        [shadow_offset + 4, shadow_offset + 8, shadow_offset + emblem_size - 4, shadow_offset + emblem_size],
        fill=(0, 0, 0, 160)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    
    # Fusionner le fond, l'ombre et l'emblème
    icon_512 = Image.alpha_composite(full_bg, shadow)
    paste_pos = ((bg_size - emblem_size) // 2, (bg_size - emblem_size) // 2)
    icon_512.paste(emblem, paste_pos, emblem)
    
    # Sauvegarde des formats PWA (Full-Bleed 100%)
    icon_512.save("icon-512.png", "PNG", optimize=True)
    icon_512.save("icon-maskable-512.png", "PNG", optimize=True)
    
    icon_192 = icon_512.resize((192, 192), Image.Resampling.LANCZOS)
    icon_192.save("icon-192.png", "PNG", optimize=True)
    icon_192.save("icon-maskable-192.png", "PNG", optimize=True)
    
    favicon = icon_512.resize((64, 64), Image.Resampling.LANCZOS)
    favicon.save("favicon.png", "PNG", optimize=True)
    
    print("[OK] Icones Web & PWA generees avec succes (Full-Bleed 512 & 192 & Favicon).")
    
    # 4. Generation des assets Android (Projet TWA)
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
            
        # S'assurer que ic_launcher_background est defini dans colors.xml
        colors_xml_path = os.path.join(res_dir, "values", "colors.xml")
        colors_content = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#059669</color>
    <color name="colorPrimaryDark">#0f172a</color>
    <color name="navigationColor">#0f172a</color>
    <color name="ic_launcher_background">#0f172a</color>
</resources>
"""
        with open(colors_xml_path, "w", encoding="utf-8") as f:
            f.write(colors_content)
            
        # B. Generation des icones mipmap par resolution
        # Format Adaptive Icon : canvas 108dp, premier plan centre dans la zone de 72dp (ratio 72/108 = 0.666)
        # Format Legacy : image pleine (Full-Bleed) pour ic_launcher et ic_launcher_round
        densities = {
            'mipmap-mdpi': {'total': 48, 'fg_total': 108, 'fg_icon': 72},
            'mipmap-hdpi': {'total': 72, 'fg_total': 162, 'fg_icon': 108},
            'mipmap-xhdpi': {'total': 96, 'fg_total': 216, 'fg_icon': 144},
            'mipmap-xxhdpi': {'total': 144, 'fg_total': 324, 'fg_icon': 216},
            'mipmap-xxxhdpi': {'total': 192, 'fg_total': 432, 'fg_icon': 288}
        }
        
        for folder, d in densities.items():
            folder_path = os.path.join(res_dir, folder)
            os.makedirs(folder_path, exist_ok=True)
            
            # 1. Legacy ic_launcher.png (Full-Bleed carre)
            legacy_img = icon_512.resize((d['total'], d['total']), Image.Resampling.LANCZOS)
            legacy_img.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
            
            # 2. Legacy ic_launcher_round.png (Decoupe en cercle propre)
            round_mask = Image.new("L", (d['total'], d['total']), 0)
            round_draw = ImageDraw.Draw(round_mask)
            round_draw.ellipse([0, 0, d['total'] - 1, d['total'] - 1], fill=255)
            round_img = legacy_img.copy()
            round_img.putalpha(round_mask)
            round_img.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
            
            # 3. Adaptive Foreground ic_launcher_foreground.png (108dp canvas avec embleme centre)
            fg_canvas = Image.new("RGBA", (d['fg_total'], d['fg_total']), (0, 0, 0, 0))
            fg_emb = src_img.resize((d['fg_icon'], d['fg_icon']), Image.Resampling.LANCZOS)
            fg_offset = (d['fg_total'] - d['fg_icon']) // 2
            fg_canvas.paste(fg_emb, (fg_offset, fg_offset), fg_emb)
            fg_canvas.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
            
        print("[OK] Assets Android Adaptive Icons (anydpi-v26 + foregrounds) generes avec succes.")

if __name__ == "__main__":
    create_full_bleed_icons()
