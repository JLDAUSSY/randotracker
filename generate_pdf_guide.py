# -*- coding: utf-8 -*-
"""
Générateur du Guide & Mode d'Emploi RandoTracker en PDF
Conception : Jean-Luc DAUSSY - 2026
Mise en valeur GRAND FORMAT PLEINE LARGEUR de la nouvelle vue panoramique officielle (Figure 1).
"""

import os
import base64
import subprocess
import pypdfium2 as pdfium
import numpy as np
import shutil

base_dir = r"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker\captures_clean"
art_dir = r"C:\Users\lesda\.gemini\antigravity\brain\4db886ec-54b6-4986-b937-39488b9d32c3"

# Assurons-nous que la nouvelle vue panoramique est bien enregistrée
panoramic_src = os.path.join(art_dir, ".user_uploaded", "media_1790843499334.jpg")
if not os.path.exists(panoramic_src):
    panoramic_src = os.path.join(art_dir, ".user_uploaded", "media_1790842520132.jpg")

if os.path.exists(panoramic_src):
    shutil.copy2(panoramic_src, os.path.join(base_dir, "capture_10_map_panoramic.png"))
    print("Nouvelle capture panoramique copiée avec succès.")

imgs_dict = {
    'c10_panoramic': os.path.join(base_dir, 'capture_10_map_panoramic.png'),
    'c01_map': os.path.join(base_dir, 'capture_01.png'),
    'c02_traces_empty': os.path.join(base_dir, 'capture_02.png'),
    'c03_traces_list': os.path.join(base_dir, 'capture_03.png'),
    'c04_invite': os.path.join(base_dir, 'capture_04_clean.png'),
    'c05_profile': os.path.join(base_dir, 'capture_05.png'),
    'c06_emergency': os.path.join(base_dir, 'capture_06.png'),
    'c07_group': os.path.join(base_dir, 'capture_07.png'),
    'c08_broadcast': os.path.join(base_dir, 'capture_08.png'),
    'c09_profile_alt': os.path.join(base_dir, 'capture_09.png')
}

b64 = {}
for k, v in imgs_dict.items():
    if os.path.exists(v):
        with open(v, 'rb') as f:
            b64[k] = f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"
    else:
        print(f"Warning: image {v} not found : {k}")
        b64[k] = ""

html_content = f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>RandoTracker - Mode d'Emploi Officiel</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 9mm 10mm 9mm 10mm;
      @bottom-right {{
        content: counter(page);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 9.5px;
        font-weight: 700;
        color: #64748b;
      }}
    }}

    *, *:before, *:after {{
      box-sizing: border-box;
    }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.44;
      font-size: 11px;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}

    /* Headers */
    h1, h2, h3, h4 {{
      color: #0f172a;
      font-weight: 800;
      margin-top: 0;
      letter-spacing: -0.02em;
    }}

    h1 {{
      font-size: 24px;
      line-height: 1.15;
    }}

    h2 {{
      font-size: 14px;
      border-bottom: 2.5px solid #10b981;
      padding-bottom: 3px;
      margin-top: 9px;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
      color: #064e3b;
    }}

    h3 {{
      font-size: 12px;
      color: #0f172a;
      margin-top: 6px;
      margin-bottom: 3px;
    }}

    p {{
      margin: 0 0 5px 0;
    }}

    /* Page Breaks */
    .page-break {{
      page-break-after: always;
      break-after: page;
    }}

    .no-break {{
      break-inside: avoid;
      page-break-inside: avoid;
    }}

    /* Header & Cover Banner */
    .cover-header {{
      background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
      color: white;
      padding: 13px 18px;
      border-radius: 12px;
      margin-bottom: 8px;
      box-shadow: 0 8px 20px -4px rgba(6, 78, 59, 0.3);
      position: relative;
    }}

    .cover-header h1 {{
      color: #ffffff !important;
      font-size: 24px;
      font-weight: 900;
      margin: 2px 0 2px 0;
      letter-spacing: -0.02em;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }}

    .cover-title-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
    }}

    .cover-badge {{
      display: inline-block;
      background: rgba(16, 185, 129, 0.25);
      color: #6ee7b7;
      border: 1px solid #10b981;
      padding: 2px 9px;
      border-radius: 9999px;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }}

    .cover-subtitle {{
      font-size: 11.5px;
      color: #cbd5e1;
      font-weight: 500;
      margin-top: 1px;
      max-width: 82%;
    }}

    .meta-box {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 7px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 6px 12px;
      margin-bottom: 8px;
    }}

    .meta-item {{
      font-size: 9.5px;
    }}

    .meta-label {{
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 8px;
      letter-spacing: 0.03em;
    }}

    .meta-val {{
      color: #0f172a;
      font-weight: 800;
      font-size: 10px;
      margin-top: 1px;
    }}

    /* Callout Boxes */
    .callout {{
      padding: 6px 10px;
      border-radius: 8px;
      margin: 6px 0;
      font-size: 10.2px;
      border-left: 3.5px solid;
    }}

    .callout-info {{
      background: #f0fdf4;
      border-color: #10b981;
      color: #065f46;
    }}

    .callout-warning {{
      background: #fffbeb;
      border-color: #f59e0b;
      color: #92400e;
    }}

    .callout-alert {{
      background: #fef2f2;
      border-color: #ef4444;
      color: #991b1b;
    }}

    .callout-title {{
      font-weight: 800;
      margin-bottom: 2px;
      display: flex;
      align-items: center;
      gap: 5px;
    }}

    /* Figures & Screenshots */
    .figure-container {{
      margin: 6px 0;
      text-align: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 6px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .figure-container img {{
      max-width: 100%;
      height: auto;
      border-radius: 7px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.14);
      display: block;
      margin: 0 auto;
    }}

    .figure-caption {{
      font-size: 9.5px;
      color: #334155;
      font-weight: 600;
      margin-top: 5px;
      text-align: center;
      line-height: 1.28;
    }}

    .figure-grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin: 6px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .figure-grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin: 6px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    /* Tables */
    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      margin: 5px 0;
      font-size: 9.2px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    table.data-table th {{
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-align: left;
      padding: 4.5px 7px;
      border: 1px solid #334155;
    }}

    table.data-table td {{
      padding: 3.5px 7px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }}

    table.data-table tr:nth-child(even) {{
      background: #f8fafc;
    }}

    /* Badges & Tags */
    .badge {{
      display: inline-block;
      padding: 1.5px 5.5px;
      border-radius: 9999px;
      font-size: 8.2px;
      font-weight: 800;
    }}

    .badge-green {{ background: #dcfce7; color: #166534; }}
    .badge-blue {{ background: #dbeafe; color: #1e40af; }}
    .badge-amber {{ background: #fef3c7; color: #92400e; }}
    .badge-red {{ background: #fee2e2; color: #991b1b; }}
    .badge-purple {{ background: #f3e8ff; color: #6b21a8; }}

    /* Layout Grids */
    .grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin: 5px 0;
    }}

    .grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin: 5px 0;
    }}

    .card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 9px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      page-break-inside: avoid;
      break-inside: avoid;
    }}

    .card-title {{
      font-weight: 800;
      font-size: 10.5px;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }}

    .steps-list {{
      padding-left: 14px;
      margin: 2px 0;
    }}

    .steps-list li {{
      margin-bottom: 2px;
    }}

    /* Footer Banner */
    .footer-author {{
      background: #0f172a;
      color: white;
      padding: 8px 13px;
      border-radius: 9px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px solid #334155;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
  </style>
</head>
<body>

  <!-- ================================================================= -->
  <!-- PAGE 1 : COUVERTURE & VUE D'ENSEMBLE MULTI-GROUPES -->
  <!-- ================================================================= -->
  <div class="cover-header">
    <div class="cover-title-row">
      <div>
        <span class="cover-badge">MODE D'EMPLOI OFFICIEL • VERSION v1.3.5 (2026)</span>
        <h1>RandoTracker</h1>
        <div class="cover-subtitle">
          Plateforme collaborative de suivi en direct pour Clubs de Randonnée, Multi-Groupes de Niveaux & Sécurité Outdoor.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
        <div style="font-size: 8px; text-transform: uppercase; color: #a7f3d0; font-weight: 600; letter-spacing: 0.05em;">Auteur & Conception</div>
        <div style="font-size: 11.5px; font-weight: 600; color: #f8fafc; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY</div>
        <div style="font-size: 8.5px; color: #94a3b8; font-weight: 500;">2026</div>
      </div>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <div class="meta-label">Type d'Application</div>
      <div class="meta-val">Web PWA & Android (Play Store / APK)</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Multi-Traces GPX</div>
      <div class="meta-val">1 à 5 circuits simultanés</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Capacité Groupe</div>
      <div class="meta-val">Jusqu'à 10 marcheurs direct</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Dispositif Secours</div>
      <div class="meta-val">15 SAMU, 112, 114 & GPS DD/DMS</div>
    </div>
  </div>

  <h2>🌲 1. Vue d'Ensemble & Gestion Multi-Groupes de Niveaux</h2>
  <p>
    Dans les clubs de randonnée pédestre et associations de montagne (FFRandonnée, CAF, associations locales), les sorties dominicales rassemblent couramment des dizaines de marcheurs répartis en <b>plusieurs groupes de niveaux</b> : parcours Découverte/Santé (7 à 10 km), parcours Moyen (12 à 15 km) et parcours Sportif/Expert (18 à 25 km).
  </p>

  <div class="figure-container" style="margin: 6px 0;">
    <img src="{b64['c10_panoramic']}" alt="Vue panoramique Grand Angle Massif du Gros Cerveau et Sanary avec 3 traces" style="max-height: 380px;" />
    <div class="figure-caption">
      <b>Figure 1 :</b> Vue Panoramique Officielle — Massif du Gros Cerveau & Sanary-sur-Mer : 3 circuits GPX simultanés (Vert 8.5 km, Bleu 11.3 km, Rouge 17.0 km), Calque <b>Fortes Pentes IGN (>30°)</b> en surimpression orange/jaune, point de départ « D », position de l'animateur 👑 <b>Jean-Luc</b> et <b>Barre Basse 4 Touches Géantes</b> (🚨 SOS, 🎯 GPS, 🗺️ Traces, 👥 Groupe).
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🎯 Suivi Simultané Multi-Groupes</div>
      <p style="font-size: 9.8px; margin: 0;">
        Chargez jusqu'à <b>5 traces GPX en parallèle</b>. Chaque groupe suit son tracé identifié par une couleur dédiée, tout en visualisant la position des autres équipes et serre-files sur le massif.
      </p>
    </div>
    <div class="card">
      <div class="card-title">⏱️ Calcul Automatique d'ETA</div>
      <p style="font-size: 9.8px; margin: 0;">
        Rattachement automatique de chaque marcheur à son parcours. L'algorithme calcule l'avancement, la distance restante et <b>l'heure exacte d'arrivée estimée (ETA)</b> au terminus en fonction du rythme réel.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🔒 Confidentialité Totale & Zéro Compte</div>
      <p style="font-size: 9.8px; margin: 0;">
        Aucun compte à créer, aucun mot de passe, aucun tracking publicitaire. Les données de position sont temporaires et disparaissent automatiquement à la fin de la randonnée.
      </p>
    </div>
    <div class="card">
      <div class="card-title">📱 Ergonomie Outdoor & Lisibilité Renforcée</div>
      <p style="font-size: 9.8px; margin: 0;">
        Barre basse 4 touches géantes utilisable avec gants ou doigts humides, sélecteur de lisibilité (+15%, +30%), et fenêtres déplaçables (<i>Drag & Drop</i>) pour dégager la carte.
      </p>
    </div>
  </div>

  <div class="callout callout-info" style="margin-top: 5px;">
    <div class="callout-title">💡 Règle d'or pour l'encadrement en club :</div>
    L'animateur principal prend le rôle 👑 <b>Animateur</b> en tête de groupe. Le co-animateur ou bénévole fermant la marche sélectionne le rôle 🛡️ <b>Serre-file</b>. Cela permet à tout le groupe de repérer en 1 coup d'œil l'avant et l'arrière de la meute sur la carte IGN !
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 2 : CARTOGRAPHIE IGN, MULTI-TRACES & PROFIL ALTIMÉTRIQUE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🗺️ 2. Cartographie Internationale Topo, Multi-Traces & Profil Altimétrique</h2>
  <p>
    RandoTracker intègre nativement les meilleurs fonds cartographiques outdoor ainsi qu'un outil d'analyse du relief complet et interactif conçu pour la sécurité en montagne :
  </p>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🏔️ Fonds Officiels IGN, UK, Suisse & Calque Pentes</div>
      <ul class="steps-list" style="font-size: 9.8px;">
        <li><b>IGN France Plan v2 Topo</b> : Sentiers balisés GR/PR, courbes de niveau, toponymes et refuges avec rendu Rétina haute netteté.</li>
        <li><b>IGN España MTN Topo 1:25k</b> : Idéal pour les randonnées pyrénéennes et transfrontalières.</li>
        <li><b>UK Ordnance / Topo (Trails) & Swisstopo (Suisse Alpin)</b> : Cartes topographiques officielles pour la Grande-Bretagne et la Suisse avec détection automatique selon vos coordonnées GPS.</li>
        <li><b>Calque Fortes Pentes IGN (>30°)</b> : Surimpression de sécurité indispensable pour anticiper les passages escarpés et le risque d'avalanche.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🎨 Gestionnaire Multi-Traces GPX (1 à 5 traces)</div>
      <ul class="steps-list" style="font-size: 9.8px;">
        <li><b>Importation instantanée</b> : Chargez de 1 à 5 fichiers GPX (parcours principal, variantes courtes, échappatoires météo).</li>
        <li><b>Palette 10 Couleurs Outdoor</b> : Clic sur la pastille pour choisir (Émeraude, Azur, Corail, Orange Fluo, Violet, Jaune, Cyan, Rose, Blanc, Fauve).</li>
        <li><b>Contrôles individuels</b> : Masquer/afficher (icône œil), recentrer la vue sur une trace, ouvrir son profil ou supprimer une trace terminée.</li>
      </ul>
    </div>
  </div>

  <div class="figure-grid-3">
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c02_traces_empty']}" alt="Modale GPX vide avec bouton importer" style="max-height: 290px;" />
      <div class="figure-caption">
        <b>Figure 2 :</b> Modale Traces vide — Bouton <b>« + Importer un GPX »</b> (jusqu'à 5 traces).
      </div>
    </div>
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c03_traces_list']}" alt="Gestionnaire de traces GPX avec palette 10 couleurs" style="max-height: 290px;" />
      <div class="figure-caption">
        <b>Figure 3 :</b> Palette 10 Teintes — Sélection de couleur et gestion individuelle des parcours.
      </div>
    </div>
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c09_profile_alt']}" alt="Profil altimétrique interactif avec dénivelé" style="max-height: 290px;" />
      <div class="figure-caption">
        <b>Figure 4 :</b> Profil Altimétrique — Dénivelé cumulé (+D / -D), altitudes min/max et pente.
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 5px;">
    <div class="card-title">📈 Profil Altimétrique Interactif Zoomable (1x à 12x) & Déplacement de Fenêtres</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.8px; margin: 0;">
        <li><b>Zoom progressif 1x à 12x</b> : Loupe interactive pour analyser les montées raides, cols ardus et replats le long du parcours.</li>
        <li><b>Scrubber de position en direct</b> : En glissant le doigt sur le profil, le point correspondant s'illumine instantanément sur la carte IGN.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.8px; margin: 0;">
        <li><b>Fenêtres Déplaçables (Drag & Drop)</b> : Toutes les boîtes de dialogue disposent d'une poignée <code>⠿ Glisser pour déplacer</code> pour ne jamais masquer les sentiers.</li>
        <li><b>Mode Plein Écran</b> : Agrandissement instantané sans masquer la barre basse 4 touches.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="card">
      <div class="card-title">📶 Préchargement des Tuiles IGN à Domicile (100% Hors-Ligne)</div>
      <p style="font-size: 9.7px; margin: 0;">
        <b>Le réflexe à la maison (sur Wi-Fi) :</b> Ouvrez l'appli, chargez le GPX et survolez le tracé en zoomant (zoom 14 à 16) pendant 30 s. Toutes les dalles IGN Topo HD sont stockées de façon permanente en cache (<code>rando-tiles-v1</code>). Même en zone blanche totale à 200 km, la carte s'affiche à 0 ms !
      </p>
    </div>
    <div class="card">
      <div class="card-title">💡 Conseils de Préparation des GPX</div>
      <p style="font-size: 9.7px; margin: 0;">
        L'animateur prépare chez lui les variantes (ex: <i>Grand Tour 18km</i> et <i>Petite Boucle 10km</i>). Au parking, il charge les 2 traces dans RandoTracker en 5 secondes. Chaque marcheur sélectionne son groupe dans son profil !
      </p>
    </div>
  </div>

  <div class="callout callout-info" style="margin-top: 5px;">
    <div class="callout-title">🎨 Recommandation Couleurs de Traces :</div>
    Utilisez des teintes contrastées pour vos groupes : <b>Vert Émeraude</b> pour la boucle Découverte/Santé, <b>Bleu Azur</b> pour la boucle Moyenne, et <b>Rouge Corail</b> pour la boucle Sportive.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 3 : EMBARQUEMENT PARKING, PROFIL & COORDINATION GROUPE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>👥 3. Embarquement au Parking, Mon Profil & Suivi du Groupe</h2>
  <p>
    RandoTracker simplifie radicalement l'accueil des participants au parking de départ : aucun compte requis, aucun mot de passe, connexion en 3 secondes chrono !
  </p>

  <div class="figure-grid-3">
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c04_invite']}" alt="Modale invitation sécurisée au parking" style="max-height: 385px;" />
      <div class="figure-caption">
        <b>Figure 5 :</b> Invitation au parking — QR Code d'accès éphémère à scanner sur place et bouton de partage sécurisé WhatsApp/SMS.
      </div>
    </div>
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c05_profile']}" alt="Modale Mon Profil Randonneur" style="max-height: 385px;" />
      <div class="figure-caption">
        <b>Figure 6 :</b> Mon Profil Randonneur — Rôles (👑 Animateur, 🛡️ Serre-file, 🥾 Randonneur), trace suivie, zoom outdoor et 12 avatars.
      </div>
    </div>
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c07_group']}" alt="Tiroir Participants et télémétrie" style="max-height: 385px;" />
      <div class="figure-caption">
        <b>Figure 7 :</b> Tiroir Participants — Vitesse en direct, altitude, batterie %, écart trace (Cross-Track) et ETA d'arrivée au terminus.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📲 1. Embarquement Instantané au Parking</div>
      <ul class="steps-list" style="font-size: 9.8px;">
        <li>L'animateur ouvre la fenêtre <b>« Inviter »</b> affichant le QR Code sécurisé du salon.</li>
        <li>Chaque marcheur pointe l'appareil photo de son smartphone (ou utilise le scanner intégré) : l'application rejoint le salon en 1 clic.</li>
        <li>Option de partage direct par lien sécurisé via WhatsApp, SMS ou email.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🥾 2. Configuration Personnalisée du Profil</div>
      <ul class="steps-list" style="font-size: 9.8px;">
        <li><b>Prénom & Avatars Haute Définition</b> : Choix parmi 12 profils outdoor et avatars personnalisés (Chat Jaune, Chat Rose, Loup, Renard, Ours, etc.).</li>
        <li><b>Rôle dans la randonnée</b> : Animateur 👑, Co-animateur 🥈, Serre-file 🛡️, Randonneur 🥾, Secouriste 🩺, Photographe 📸.</li>
        <li><b>Trace suivie & ETA</b> : Rattachement au parcours choisi pour le calcul de fin de rando.</li>
        <li><b>Mode Poche (🔒) & Suivi Écran Éteint</b> : Protection anti-tactile avec déverrouillage sécurisé par appui maintenu 1.5s.</li>
      </ul>
    </div>
  </div>

  <div class="card" style="margin-top: 5px;">
    <div class="card-title">👥 3. Tiroir de Suivi des Participants & Distances Inter-Marcheurs</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.8px; margin: 0;">
        <li><b>Tableau de bord complet</b> : Distance parcourue (km), vitesse instantanée (km/h), altitude actuelle (m) et niveau de batterie restant (🔋%).</li>
        <li><b>Distances inter-marcheurs en 1 clic</b> : Cliquez sur n'importe quel marcheur sur la carte pour afficher immédiatement les distances à vol d'oiseau qui le séparent de chacun des autres coéquipiers.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.8px; margin: 0;">
        <li><b>Écart à la trace & Alerte Sonore (>50m)</b> : Détection immédiate avec bips audio si un marcheur quitte le sentier balisé.</li>
        <li><b>ETA dynamique</b> : Heure estimée d'arrivée calculée selon la vitesse réelle et le dénivelé restant sur la trace sélectionnée.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="card">
      <div class="card-title">🔒 Confidentialité du QR Code</div>
      <p style="font-size: 9.8px; margin: 0;">
        Le QR Code d'invitation est généré localement pour votre sortie. Il donne un accès direct en tant qu'invité au salon de votre club, sans nécessiter de mot de passe ni stocker de données nominatives sur un serveur tiers.
      </p>
    </div>
    <div class="card">
      <div class="card-title">🛡️ Sécurisation & Rôle du Serre-file</div>
      <p style="font-size: 9.8px; margin: 0;">
        Le serre-file surveille la distance d'écart à la trace dans le tiroir Participants : si un marcheur passe en alerte orange ou rouge, il peut l'appeler ou lui envoyer un broadcast d'avertissement immédiatement.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 4 : SECOURS 50/50, BROADCAST & ZONE BLANCHE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🚨 4. Dispositif Secours & Urgence Haute Sécurité 50/50 & Broadcast</h2>
  <p>
    En cas d'accident ou de malaise sur le terrain, chaque seconde compte. RandoTracker intègre un panneau de secours partitionné 50/50 accessible en 1 tapotement sur le bouton rouge <b>🚨 SOS</b> :
  </p>

  <div class="figure-grid-2">
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c06_emergency']}" alt="Écran Secours et Urgence 50/50 avec 15, 112 et 114" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 8 :</b> Dispositif Secours 50/50 — Moitié haute avec coordonnées GPS épinglées (DD et DMS) et guide vocal ; moitié basse avec appels direct <b>15 SAMU 🇫🇷</b>, <b>112 Pompiers & PGHM 🇪🇺</b>, <b>114 SMS 🇪🇺</b> et Alerte SOS Groupe.
      </div>
    </div>
    <div class="figure-container" style="margin: 0;">
      <img src="{b64['c08_broadcast']}" alt="Modale Broadcast Message au groupe avec presets rapides" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 9 :</b> Message Broadcast au Groupe — 8 boutons rapides 1-clic avec déclenchement sonore / vibreur + champ de texte personnalisé avec coordonnées GPS intégrées.
      </div>
    </div>
  </div>

  <div class="card" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 7px 10px;">
    <div class="card-title" style="color: #b91c1c; font-size: 11px; margin-bottom: 2px;">🚨 Dispositif de Secours Partitionné 50/50 (Conception Sanctuarisée pour l'Urgence) :</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.5px; margin: 0;">
        <li><b>Zone Haute (Localisation GPS Fixe)</b> : Coordonnées affichées en grand en <b>Degrés Décimaux (DD)</b> et en <b>Degrés Minutes Secondes (DMS)</b>.</li>
        <li><b>Guide de dictée vocale</b> : Texte phonétique prêt à être lu au régulateur des secours sans risque d'erreur d'inversion.</li>
        <li><b>Bouton 📋 Copier GPS</b> : Copie instantanée des coordonnées dans le presse-papier.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.5px; margin: 0;">
        <li><b>🇫🇷 15 SAMU</b> : Appel direct du SAMU pour urgence médicale vitale.</li>
        <li><b>🇪🇺 112 Pompiers & Secours Montagne / PGHM</b> : Numéro d'urgence européen fonctionnant même sans carte SIM ou sur réseau concurrent.</li>
        <li><b>🇪🇺 114 SMS d'Urgence</b> : Envoi par SMS silencieux avec position GPS lorsque la voix ne passe pas en zone de faible couverture.</li>
        <li><b>🚨 Alerte SOS Groupe</b> : Déclenche une sirène et vibreur sur tous les téléphones du club.</li>
      </ul>
    </div>
  </div>

  <h2>📢 5. Messages Broadcast, Résilience 5h en Zone Blanche & Autonomie</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📢 Messages Broadcast 1-Clic pour Tous</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>8 Presets Outdoor</b> : <i>« Regroupement général ! »</i>, <i>« Pause 10 min »</i>, <i>« Prudence passage délicat »</i>, <i>« Je m'arrête - incident »</i>, <i>« Ravitaillement eau »</i>, <i>« Changement d'itinéraire »</i>, <i>« Pause repas »</i>, <i>« Tout le monde est là »</i>.</li>
        <li><b>Alarme sonore & Vibreur</b> : Réveille instantanément les téléphones dans les sacs à dos.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🌲 Zone Blanche 5h & 🔋 Autonomie 8 à 10h</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>Puce GPS 100% Autonome</b> : Fonctionne par satellite sans réseau 4G avec mémoire tampon de 5h.</li>
        <li><b>Sobriété Batterie (3 à 5% / h)</b> : Thème sombre OLED noir (-45% de conso écran), télémétrie ultra-légère (<150 octets) et surveillance mutuelle avec alerte rouge sous 20%.</li>
      </ul>
    </div>
  </div>

  <div class="callout callout-alert" style="margin-top: 5px;">
    <div class="callout-title">⚠️ Protocole PAS en cas d'accident sur le sentier :</div>
    <b>1. Protéger :</b> Sécuriser la zone et le blessé (couverture de survie, mise à l'abri).<br/>
    <b>2. Alerter :</b> Ouvrir <b>🚨 SOS</b> sur RandoTracker, lire les coordonnées GPS en DMS au <b>15</b> ou <b>112</b>, et préciser l'état de la victime.<br/>
    <b>3. Secourir :</b> Prodiguer les gestes de premiers secours en attendant l'arrivée des secours ou de l'hélicoptère du PGHM.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 5 : TABLEAU COMPARATIF & GUIDE PRATIQUE PAS-À-PAS -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🏆 6. Tableau Comparatif Exhaustif : RandoTracker vs Autres Outils</h2>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Fonctionnalités & Critères</th>
        <th style="background: #047857; width: 27%;">RandoTracker (2026)</th>
        <th style="width: 24%;">Visorando / AllTrails</th>
        <th style="width: 24%;">WhatsApp / Partage GPS</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>Installation & Téléchargement</b></td>
        <td><span class="badge badge-green">❌ Zéro installation (PWA Web)</span></td>
        <td>⚠️ Téléchargement App Store / Play Store</td>
        <td>⚠️ Application obligatoire</td>
      </tr>
      <tr>
        <td><b>Création de Compte & Données</b></td>
        <td><span class="badge badge-green">❌ Aucun compte / Données éphémères</span></td>
        <td>⚠️ Email + Mot de passe + Publicité</td>
        <td>⚠️ Numéro de téléphone visible par tous</td>
      </tr>
      <tr>
        <td><b>Préchargement Cartes Hors-Ligne</b></td>
        <td><span class="badge badge-green">✅ Wi-Fi à domicile gratuit (0 ms)</span></td>
        <td>❌ Payant (Abonnement annuel requis)</td>
        <td>❌ Aucune mise en cache carto</td>
      </tr>
      <tr>
        <td><b>Consommation Batterie</b></td>
        <td><span class="badge badge-green">✅ Éco OLED (-45%) • 3 à 5% / heure</span></td>
        <td>⚠️ Énergivore (fonds blancs, pubs, SDK)</td>
        <td>⚠️ GPS continu très gourmand</td>
      </tr>
      <tr>
        <td><b>Multi-Traces GPX en Parallèle</b></td>
        <td><span class="badge badge-green">✅ 1 à 5 traces GPX simultanées</span></td>
        <td>❌ 1 seule trace active à la fois</td>
        <td>❌ Aucun support de fichier GPX</td>
      </tr>
      <tr>
        <td><b>Palette 10 Couleurs de Traces</b></td>
        <td><span class="badge badge-green">✅ Palette interactive 10 teintes</span></td>
        <td>⚠️ Couleur unique ou options limitées</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Cartes Topo IGN France & Espagne</b></td>
        <td><span class="badge badge-green">✅ Incluses & 100% Gratuites</span></td>
        <td>❌ Payant (Abonnement 25€ à 35€ / an)</td>
        <td>❌ Fonds routiers sommaires</td>
      </tr>
      <tr>
        <td><b>Calque Fortes Pentes IGN (>30°)</b></td>
        <td><span class="badge badge-green">✅ Inclus (Sécurité Avalanche/Pente)</span></td>
        <td>❌ Réservé aux formules Premium payantes</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Profil Altimétrique Zoomable</b></td>
        <td><span class="badge badge-green">✅ Zoom 1x à 12x + Dénivelé +D/-D</span></td>
        <td>⚠️ Profil fixe non zoomable en direct</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Suivi Multi-Marcheurs & Rôles</b></td>
        <td><span class="badge badge-green">✅ Meute entière, Rôles & 12 Avatars</span></td>
        <td>❌ Suivi individuel uniquement</td>
        <td>⚠️ Liste de contacts sans télémétrie</td>
      </tr>
      <tr>
        <td><b>Calcul Automatique d'ETA</b></td>
        <td><span class="badge badge-green">✅ ETA dynamique calculée par trace</span></td>
        <td>❌ Pas de calcul d'ETA pour le groupe</td>
        <td>❌ Aucun calcul d'arrivée</td>
      </tr>
      <tr>
        <td><b>Écart à la Trace (Cross-Track)</b></td>
        <td><span class="badge badge-green">✅ Distance d'éloignement en direct</span></td>
        <td>⚠️ Alerte sonore basique si configurée</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Dispositif Secours 50/50</b></td>
        <td><span class="badge badge-green">✅ GPS DD/DMS + 15 SAMU + 112 + 114</span></td>
        <td>❌ Aucun bouton de secours direct</td>
        <td>❌ Pas de coordonnées GPS formalisées</td>
      </tr>
      <tr>
        <td><b>Broadcast Groupe 1-Clic</b></td>
        <td><span class="badge badge-green">✅ 8 Presets outdoor + Son/Vibreur</span></td>
        <td>❌ Non disponible</td>
        <td>⚠️ Messages texte noyés dans le chat</td>
      </tr>
      <tr>
        <td><b>Maintien en Zone Blanche</b></td>
        <td><span class="badge badge-green">✅ 5 heures avec indicateur temps</span></td>
        <td>⚠️ Déconnexion sans heure de position</td>
        <td>❌ Disparaît dès la perte de réseau</td>
      </tr>
      <tr>
        <td><b>Fenêtres Déplaçables (Drag & Drop)</b></td>
        <td><span class="badge badge-green">✅ Poignées ⠿ sur toutes les boîtes</span></td>
        <td>❌ Fenêtres modales fixes et bloquantes</td>
        <td>❌ Interface rigide</td>
      </tr>
      <tr>
        <td><b>Sélecteur de Zoom Lisibilité</b></td>
        <td><span class="badge badge-green">✅ Standard (100%), Grand (+15%), Géant (+30%)</span></td>
        <td>❌ Dépend du zoom système global</td>
        <td>❌ Non disponible</td>
      </tr>
    </tbody>
  </table>

  <h2>📋 7. Guide Pratique Pas-à-Pas de la Sortie Club</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1️⃣ Avant de partir (À la maison en Wi-Fi)</div>
      <ol class="steps-list" style="font-size: 9.3px; padding-left: 14px; margin: 0;">
        <li>Ouvrez RandoTracker et chargez les GPX (<b>« TRACES »</b> $\rightarrow$ <b>« + Importer »</b>).</li>
        <li><b>Mise en cache 100% hors-ligne</b> : Survolez et zoomez (14-16) sur le parcours pendant 30 s pour stocker les dalles IGN Topo HD.</li>
        <li>Attribuez une couleur distincte à chaque circuit.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">2️⃣ Au parking de départ (Les Marcheurs)</div>
      <ol class="steps-list" style="font-size: 9.3px; padding-left: 14px; margin: 0;">
        <li>L'animateur ouvre <b>« Inviter »</b> et présente le <b>QR Code</b>.</li>
        <li>Chaque marcheur scanne le code pour entrer dans le salon.</li>
        <li>Dans <b>« Mon Profil »</b>, chacun renseigne son prénom, son rôle, sa trace et clique sur <b>« 🎯 MON GPS »</b>.</li>
      </ol>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="card">
      <div class="card-title">3️⃣ Pendant la randonnée (Suivi & Sécurité)</div>
      <ol class="steps-list" style="font-size: 9.3px; padding-left: 14px; margin: 0;">
        <li>Surveillez les écarts entre groupes et serre-files sur la carte.</li>
        <li>Utilisez <b>« Message au groupe »</b> pour avertir des pauses ou consignes avec GPS automatique.</li>
        <li>En cas d'urgence, appuyez sur <b>🚨 SOS</b> pour dicter le GPS et appeler le <b>15</b> ou <b>112</b>.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">4️⃣ Conseils Autonomie Batterie & Sérénité</div>
      <ul class="steps-list" style="font-size: 9.3px; padding-left: 14px; margin: 0;">
        <li><b>Suivi en poche sans écran allumé</b> : Sur l'app Android native, éteignez l'écran directement avec le bouton marche/arrêt physique (Service d'arrière-plan officiel). Sur le Web, activez le <b>Mode Poche (🔒)</b> anti-tactile.</li>
        <li><b>Consommation minimale (3% à 5% / h)</b> : 8 à 10h d'autonomie en continu.</li>
        <li><b>Batterie Android</b> : Régler la batterie sur « Non restreinte » pour un GPS ininterrompu.</li>
      </ul>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 6 : TROUBLESHOOTING & GUIDE DE DÉPANNAGE EXHAUSTIF -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🛠️ 8. Guide de Dépannage & Troubleshooting (Que faire si...)</h2>
  <p>
    RandoTracker a été conçu pour être ultra-résilient sur le terrain. Si vous rencontrez un comportement inattendu, voici la marche à suivre pas-à-pas pour chaque situation :
  </p>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📍 1. Mon GPS ne s'actualise plus ou s'arrête en veille</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> Votre position ne bouge plus quand le téléphone est verrouillé dans la poche ou le sac à dos.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Batterie Android (Crucial) :</b> Allez dans <i>Paramètres Android $\rightarrow$ Applications $\rightarrow$ RandoTracker (ou Chrome) $\rightarrow$ Batterie</i> et cochez <b>« Non restreinte »</b> (ou <i>« Illimitée »</i>). Évitez le mode <i>« Optimisée »</i> qui coupe le GPS en veille.</li>
        <li><b>Précision de Localisation :</b> Dans <i>Paramètres $\rightarrow$ Localisation $\rightarrow$ Autorisations $\rightarrow$ RandoTracker</i>, vérifiez que <b>« Utiliser la position exacte »</b> est bien activé.</li>
        <li><b>Économiseur d'énergie :</b> Désactivez l'économiseur de batterie général d'Android lors des sorties.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">👥 2. Je ne vois pas les autres marcheurs du groupe</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> Vous êtes seul sur la carte et la liste des participants est vide.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Vérification du Salon :</b> Ouvrez le panneau <i>Participants</i> et vérifiez que vous avez saisi le <b>même Code de Salon</b> que vos coéquipiers (ex: <code>RANDO-2026</code>).</li>
        <li><b>Reconnexion instantanée :</b> Cliquez sur le nom du salon en haut pour ressaisir le code ou rescanniez le QR Code de l'animateur.</li>
        <li><b>Témoin Réseau :</b> Le voyant en bas à gauche doit être vert <i>« Connecté »</i>. En zone blanche, les positions réapparaissent dès que l'un des téléphones capte à nouveau.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="card" style="border-left: 3.5px solid #f59e0b;">
      <div class="card-title">📢 3. Pas de son / vibration lors des annonces de groupe</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> Vous ne recevez pas le carillon sonore lors des messages diffusés par l'animateur.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Déverrouillage Audio Web :</b> Touchez au moins une fois l'écran au lancement pour autoriser le synthétiseur Web Audio du navigateur.</li>
        <li><b>Autorisations Notifications :</b> Dans <i>Paramètres Android $\rightarrow$ Applications $\rightarrow$ RandoTracker $\rightarrow$ Notifications</i>, assurez-vous qu'elles sont autorisées.</li>
        <li><b>Mode « Ne pas déranger » :</b> Vérifiez que votre smartphone n'est pas en mode silencieux strict ou <i>« Ne pas déranger »</i>.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #8b5cf6;">
      <div class="card-title">🗺️ 4. La carte est grise / dalles manquantes en montagne</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> La carte IGN n'affiche pas le fond topographique hors de portée du réseau 4G.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Réflexe Préchargement :</b> À la maison sur Wi-Fi, survolez le parcours en zoomant (zoom 14-16) pendant 30 s avant de partir.</li>
        <li><b>Basculement Calque :</b> Cliquez sur le sélecteur de couches (icône 🥞) et choisissez <b>OpenTopoMap</b> ou <b>OpenStreetMap</b> qui disposent souvent de dalles en mémoire tampon.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 5px;">
    <div class="card" style="border-left: 3.5px solid #06b6d4;">
      <div class="card-title">📱 5. L'application a été fermée accidentellement</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> Un balayage malencontreux a fermé l'onglet ou l'application.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Restauration 100% Automatique :</b> Rouvrez simplement RandoTracker. Votre session active, vos traces GPX, vos couleurs, votre prénom et votre salon sont immédiatement restaurés sans aucune manipulation.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #ec4899;">
      <div class="card-title">🔋 6. Optimisation Maximale de l'Autonomie (8h-10h)</div>
      <p style="font-size: 9.2px; margin-bottom: 3px;">
        <b>Symptôme :</b> Vous partez pour une longue randonnée de toute la journée.
      </p>
      <ul class="steps-list" style="font-size: 9.1px;">
        <li><b>Écran verrouillé :</b> Ne laissez pas l'écran allumé en continu. Rangez le téléphone dans la poche : RandoTracker continue d'émettre en arrière-plan (3 à 5% / h).</li>
        <li><b>Surveillance de la meute :</b> Le serre-file vérifie les % de batterie de chacun dans le tiroir Participants pour anticiper les recharges sur batterie externe.</li>
      </ul>
    </div>
  </div>

  <div class="callout callout-info" style="margin-top: 6px;">
    <div class="callout-title">💡 Synthèse Sécurité & Bonnes Pratiques en Randonnée :</div>
    <b>1. Téléphone chargé à 100% au départ</b> • <b>2. Batterie Android sur « Non restreinte »</b> • <b>3. Préchargement carto Wi-Fi effectué</b> • <b>4. Animateur 👑 et Serre-file 🛡️ identifiés au parking</b>. Vous êtes parés pour une sortie club en toute sérénité !
  </div>

  <!-- Footer officiel -->
  <div class="footer-author">
    <div>
      <div style="font-size: 11.5px; font-weight: 900; color: #34d399;">RandoTracker — Suivi de Randonnée, Multi-Groupes & Cartes IGN</div>
      <div style="font-size: 9.5px; color: #cbd5e1; margin-top: 1px;">Application Web Progressive (PWA) conçue pour la sécurité, l'encadrement et la convivialité des clubs outdoor.</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Conception & Développement</div>
      <div style="font-size: 11.5px; font-weight: 600; color: #ffffff; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY — 2026</div>
    </div>
  </div>

</body>
</html>

"""

html_path = os.path.abspath("mode_d_emploi.html")
pdf_path = os.path.abspath("RandoTracker_Mode_d_emploi.pdf")

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Fichier HTML généré : {html_path} ({os.path.getsize(html_path)} octets)")

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

cmd = [
    chrome_path,
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    html_path
]

print(f"Lancement de la compilation PDF avec {chrome_path}...")
res = subprocess.run(cmd, capture_output=True, text=True)

if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
    print(f"SUCCÈS : PDF créé avec succès : {pdf_path} ({os.path.getsize(pdf_path)} octets)")
else:
    print(f"Erreur lors de la création du PDF : {res.stderr}")

# Copie dans les artefacts
shutil.copy2(pdf_path, os.path.join(art_dir, "RandoTracker_Mode_d_emploi.pdf"))

pdf = pdfium.PdfDocument(pdf_path)
print(f"Nombre total de pages générées : {len(pdf)}")

for i, page in enumerate(pdf):
    image = page.render(scale=2).to_pil()
    out_path = rf"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker\page_{i+1}.png"
    image.save(out_path)
    shutil.copy2(out_path, os.path.join(art_dir, f"page_{i+1}.png"))
    
    arr = np.array(image.convert('RGB'))
    h, w, _ = arr.shape
    arr_content = arr[:h-50, :, :]
    non_white = np.where((arr_content < 245).any(axis=(1,2)))[0]
    if len(non_white) > 0:
        lowest_y = non_white.max()
        pct = (lowest_y / h) * 100
        print(f"-> Page {i+1} : contenu jusqu'à y={lowest_y}/{h} ({pct:.1f}% de la hauteur A4)")
    else:
        print(f"-> Page {i+1} : page vide !")
