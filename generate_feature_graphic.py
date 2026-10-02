import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_feature_graphic():
    width, height = 1024, 500
    img = Image.new('RGB', (width, height), '#090d16')
    draw = ImageDraw.Draw(img)

    # Dégradé de fond moderne outdoor (bleu nuit vers émeraude profond)
    for y in range(height):
        ratio = y / height
        r = int(10 + (6 - 10) * ratio)
        g = int(22 + (45 - 22) * ratio)
        b = int(35 + (35 - 35) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Ajouter une texture cartographique / relief en arrière plan si dispo
    map_path = r"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker\captures\Capture d'écran 2026-10-01 101440.png"
    if os.path.exists(map_path):
        try:
            bg_map = Image.open(map_path).convert('RGB')
            # Crop center
            mw, mh = bg_map.size
            bg_crop = bg_map.crop((mw // 4, mh // 6, mw * 3 // 4, mh * 5 // 6))
            bg_crop = bg_crop.resize((width, height), Image.Resampling.LANCZOS)
            bg_crop = bg_crop.filter(ImageFilter.GaussianBlur(radius=3))
            img = Image.blend(img, bg_crop, 0.40)
            draw = ImageDraw.Draw(img)
        except Exception as e:
            print("Map bg error:", e)

    # Voile sombre pour lisibilité
    overlay = Image.new('RGBA', (width, height), (9, 13, 22, 175))
    img.paste(Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB'), (0, 0))
    draw = ImageDraw.Draw(img)

    # Charger le logo
    logo_path = r"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker\icon-512.png"
    if os.path.exists(logo_path):
        try:
            logo = Image.open(logo_path).convert('RGBA')
            logo = logo.resize((170, 170), Image.Resampling.LANCZOS)
            img.paste(logo, (60, (height - 170) // 2), logo)
        except Exception as e:
            print("Logo error:", e)

    # Textes
    try:
        font_title = ImageFont.truetype("arialbd.ttf", 54)
        font_sub = ImageFont.truetype("arialbd.ttf", 24)
        font_desc = ImageFont.truetype("arial.ttf", 18)
        font_tag = ImageFont.truetype("arialbd.ttf", 15)
    except:
        font_title = font_sub = font_desc = font_tag = ImageFont.load_default()

    # Titre principal
    draw.text((260, 135), "RandoTracker", font=font_title, fill="#ffffff")
    
    # Badge Outdoor / Cartes IGN
    draw.rounded_rectangle([(260, 205), (550, 242)], radius=10, fill="#059669")
    draw.text((275, 212), "CARTOGRAPHIE IGN & SECOURS", font=font_tag, fill="#ffffff")

    # Sous-titre descriptif
    draw.text((260, 260), "Suivi de Groupe en Direct • Multi-Traces GPX • Altitude & ETA", font=font_sub, fill="#34d399")
    draw.text((260, 305), "100% Hors-Réseau • 0 Publicité • Conçu pour Clubs de Randonnée", font=font_desc, fill="#94a3b8")
    
    # Signature
    draw.text((260, 355), "Édition JLD Apps • 2026", font=font_tag, fill="#64748b")

    out_path = r"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker\feature-graphic-1024x500.png"
    img.save(out_path, quality=95)
    print("Feature graphic generated successfully at:", out_path)

if __name__ == "__main__":
    create_feature_graphic()
