# -*- coding: utf-8 -*-
"""
Générateur du Mode d'Emploi RandoTracker en Français
Conception & Réalisation : Jean-Luc DAUSSY - 2026
Version v1.4.16
"""

def get_html_fr(b64):
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>RandoTracker - Mode d'Emploi Officiel (Français)</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 8mm 9mm 8mm 9mm;
      @bottom-right {{
        content: counter(page);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 9px;
        font-weight: 700;
        color: #64748b;
      }}
    }}
    *, *:before, *:after {{ box-sizing: border-box; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      line-height: 1.40;
      font-size: 10.5px;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    h1, h2, h3, h4 {{
      color: #0f172a;
      font-weight: 800;
      margin-top: 0;
      letter-spacing: -0.02em;
    }}
    h1 {{ font-size: 23px; line-height: 1.15; }}
    h2 {{
      font-size: 13.2px;
      border-bottom: 2.5px solid #10b981;
      padding-bottom: 2.5px;
      margin-top: 7px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 5px;
      color: #064e3b;
    }}
    h3 {{ font-size: 11.2px; color: #0f172a; margin-top: 5px; margin-bottom: 2px; }}
    p {{ margin: 0 0 4px 0; }}
    .page-break {{ page-break-after: always; break-after: page; }}
    .no-break {{ break-inside: avoid; page-break-inside: avoid; }}

    .cover-header {{
      background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%);
      color: white;
      padding: 11px 16px;
      border-radius: 11px;
      margin-bottom: 6px;
      box-shadow: 0 6px 18px -4px rgba(6, 78, 59, 0.35);
      position: relative;
    }}
    .cover-header h1 {{
      color: #ffffff !important;
      font-size: 22px;
      font-weight: 900;
      margin: 2px 0;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    }}
    .cover-title-row {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }}
    .cover-badge {{
      display: inline-block;
      background: rgba(16, 185, 129, 0.25);
      color: #6ee7b7;
      border: 1px solid #10b981;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }}
    .cover-subtitle {{
      font-size: 11px;
      color: #cbd5e1;
      font-weight: 500;
      margin-top: 1px;
      max-width: 82%;
    }}
    .meta-box {{
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 9px;
      padding: 5px 10px;
      margin-bottom: 6px;
    }}
    .meta-item {{ font-size: 9px; }}
    .meta-label {{
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 7.8px;
      letter-spacing: 0.03em;
    }}
    .meta-val {{
      color: #0f172a;
      font-weight: 800;
      font-size: 9.6px;
      margin-top: 1px;
    }}
    .callout {{
      padding: 5px 9px;
      border-radius: 7px;
      margin: 5px 0;
      font-size: 9.8px;
      border-left: 3.5px solid;
    }}
    .callout-info {{ background: #f0fdf4; border-color: #10b981; color: #065f46; }}
    .callout-warning {{ background: #fffbeb; border-color: #f59e0b; color: #92400e; }}
    .callout-alert {{ background: #fef2f2; border-color: #ef4444; color: #991b1b; }}
    .callout-title {{ font-weight: 800; margin-bottom: 1.5px; display: flex; align-items: center; gap: 4px; }}

    .figure-container {{
      margin: 5px 0;
      text-align: center;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 9px;
      padding: 5px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    .figure-container img {{
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
      display: block;
      margin: 0 auto;
    }}
    .figure-caption {{
      font-size: 9px;
      color: #334155;
      font-weight: 600;
      margin-top: 4px;
      text-align: center;
      line-height: 1.25;
    }}
    .figure-grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin: 5px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    .figure-grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 6px;
      margin: 5px 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    table.data-table {{
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 8.8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    table.data-table th {{
      background: #0f172a;
      color: #ffffff;
      font-weight: 800;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #334155;
    }}
    table.data-table td {{
      padding: 3px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: middle;
    }}
    table.data-table tr:nth-child(even) {{ background: #f8fafc; }}
    .badge {{
      display: inline-block;
      padding: 1.5px 5px;
      border-radius: 9999px;
      font-size: 8px;
      font-weight: 800;
    }}
    .badge-green {{ background: #dcfce7; color: #166534; }}
    .badge-blue {{ background: #dbeafe; color: #1e40af; }}
    .badge-amber {{ background: #fef3c7; color: #92400e; }}
    .badge-red {{ background: #fee2e2; color: #991b1b; }}

    .grid-2 {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin: 4px 0;
    }}
    .grid-3 {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 5px;
      margin: 4px 0;
    }}
    .card {{
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 7px;
      padding: 5px 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
      page-break-inside: avoid;
      break-inside: avoid;
    }}
    .card-title {{
      font-weight: 800;
      font-size: 10px;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 2px;
    }}
    .steps-list {{
      padding-left: 13px;
      margin: 2px 0;
    }}
    .steps-list li {{ margin-bottom: 1.5px; }}
    .footer-author {{
      background: #0f172a;
      color: white;
      padding: 7px 12px;
      border-radius: 8px;
      margin-top: 6px;
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
        <span class="cover-badge">MODE D'EMPLOI OFFICIEL EXHAUSTIF • VERSION v1.4.16 (2026)</span>
        <h1>RandoTracker</h1>
        <div class="cover-subtitle">
          Plateforme collaborative de suivi en direct pour Clubs de Randonnée, Multi-Groupes de Niveaux & Sécurité Outdoor.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
        <div style="font-size: 7.8px; text-transform: uppercase; color: #a7f3d0; font-weight: 600; letter-spacing: 0.05em;">Auteur & Conception</div>
        <div style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY</div>
        <div style="font-size: 8px; color: #94a3b8; font-weight: 500;">Édition Officielle 2026</div>
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
      <div class="meta-val">1 à 5 circuits parallèles synchronisés</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Cartographie Topo</div>
      <div class="meta-val">IGN France, Esri Satellite, Swisstopo, UK Topo, Pentes >30°</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Sécurité & Secours</div>
      <div class="meta-val">15 SAMU, 112, 114 SMS & GPS DD / DMS</div>
    </div>
  </div>

  <h2>🌲 1. Vue d'Ensemble & Gestion Multi-Groupes de Niveaux</h2>
  <p>
    Dans les clubs de randonnée pédestre et associations de montagne (FFRandonnée, CAF, associations locales), les sorties dominicales rassemblent couramment des dizaines de marcheurs répartis en <b>plusieurs groupes de niveaux</b> : parcours Découverte/Santé (7 à 10 km), parcours Moyen (12 à 15 km) et parcours Sportif/Expert (18 à 25 km). RandoTracker est la seule application permettant de fédérer l'ensemble de ces groupes au sein d'une même carte interactive sécurisée.
  </p>

  <div class="figure-container">
    <img src="{b64['c10_panoramic']}" alt="Vue panoramique Grand Angle Massif du Gros Cerveau et Sanary avec 3 traces" style="max-height: 340px;" />
    <div class="figure-caption">
      <b>Figure 1 :</b> Vue Panoramique Officielle — Massif du Gros Cerveau & Sanary-sur-Mer : 3 circuits GPX simultanés (Vert 8.5 km, Bleu 11.3 km, Rouge 17.0 km), Calque <b>Fortes Pentes IGN (>30°)</b> en surimpression orange/jaune, point de départ « D », position de l'animateur 👑 <b>Jean-Luc</b> et <b>Barre Basse 4 Touches Géantes</b> (🚨 SOS, 🎯 GPS, 🗺️ Traces, 👥 Groupe).
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🎯 Suivi Simultané Multi-Groupes & Traces Parallèles</div>
      <p style="font-size: 9.4px; margin: 0;">
        Chargez jusqu'à <b>5 traces GPX en parallèle</b>. Chaque groupe suit son parcours avec une couleur distincte. Lorsque plusieurs circuits empruntent le même sentier, RandoTracker applique l'algorithme <b>PolylineOffset</b> pour décaler automatiquement les tracés en parallèle sans superposition.
      </p>
    </div>
    <div class="card">
      <div class="card-title">⏱️ Calcul Automatique d'ETA & Télémesure</div>
      <p style="font-size: 9.4px; margin: 0;">
        Rattachement automatique de chaque marcheur à sa trace. L'application calcule en temps réel l'avancement, la distance restante, la vitesse moyenne et <b>l'heure exacte d'arrivée estimée (ETA)</b> au terminus, facilitant la synchronisation du covoiturage de retour.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🔒 Confidentialité Totale & Zéro Stockage Cloud</div>
      <p style="font-size: 9.4px; margin: 0;">
        Aucun compte à créer, aucun mot de passe, aucun tracking publicitaire. Fonctionnement éphémère type « Talkie-Walkie » : les positions transitent en direct et ne sont jamais enregistrées sur un serveur central ni conservées sur les smartphones des autres marcheurs.
      </p>
    </div>
    <div class="card">
      <div class="card-title">📱 Ergonomie Outdoor & Lisibilité Renforcée</div>
      <p style="font-size: 9.4px; margin: 0;">
        Interface outdoor haute visibilité : barre basse 4 touches géantes utilisable avec des doigts humides ou gantés, sélecteur d'échelle textuelle (+15%, +30%), et fenêtres déplaçables (<i>Drag & Drop</i>) avec poignée pour ne jamais masquer les sentiers.
      </p>
    </div>
  </div>

  <div class="callout callout-info">
    <div class="callout-title">💡 Règle d'or de coordination en club :</div>
    L'animateur principal prend le rôle 👑 <b>Guide / Animateur</b> en tête de file. Le co-animateur ou bénévole fermant la marche sélectionne le rôle 🛡️ <b>Serre-file</b>. Les participants choisissent 🥾 <b>Randonneur</b>. Cela permet à tout le groupe de repérer immédiatement la tête et la fin de file sur la carte.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 2 : CARTOGRAPHIE, OUTILS ALIGNÉS & PROFIL ALTIMÉTRIQUE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🗺️ 2. Cartographie Topo, Esri Satellite, Traces Parallèles & Profil Altimétrique</h2>
  <p>
    RandoTracker intègre nativement les meilleurs fonds cartographiques mondiaux, un outil d'analyse du relief de pointe et une barre d'action flottante ultra-précise :
  </p>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🏔️ Cartes Officielles & Nouvelle Couche Satellite Esri</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>IGN France Plan v2 Topo</b> : Sentiers balisés GR/PR, courbes de niveau, toponymes et refuges avec rendu Rétina haute netteté.</li>
        <li><b>Esri World Imagery (Satellite HD)</b> : Vue photo satellite mondiale haute résolution, idéale pour inspecter le couvert végétal et les passages rocheux.</li>
        <li><b>Swisstopo & UK Topo</b> : Cartes officielles Suisse et Grande-Bretagne avec auto-commutation selon vos coordonnées.</li>
        <li><b>IGN España MTN Topo</b> : Idéal pour les traversées pyrénéennes et transfrontalières.</li>
        <li><b>Calque Fortes Pentes IGN (>30°)</b> : Surimpression orange/jaune indispensable pour la sécurité alpine et l'anticipation du dévers.</li>
        <li><b>Échelle Métrique Dynamique Leaflet</b> : Affichage continu 50m, 100m, 500m, 1km en bas à gauche de la carte.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🧭 Outils Carte Flottants Aligné au Zoom (+ -)</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>🧭 Boussole Google Maps avec flèche Nord rotative</b> : Aiguille 3D facettée rouge avec grand <b>« N »</b> blanc. La boussole pivote en direct selon le cap GPS et le magnétomètre. Un tapotement réoriente instantanément la carte plein Nord.</li>
        <li><b>📍 Repères & Waypoints Géolocalisés</b> : Bouton direct pour marquer un point d'intérêt à votre position (Parking, Source, Danger, Point de vue, Pique-nique, etc.). Enregistrement persistant et synchronisation MQTT en direct à tous les membres du salon !</li>
        <li><b>🎯 Recentrage Immédiat</b> : Recentre et cadre la carte sur votre position GPS exacte en 1 clic.</li>
        <li><b>Alignement parfait</b> : Les 3 boutons partagent la même largeur (34px) et le même axe vertical que le zoom Leaflet (+ / -).</li>
      </ul>
    </div>
  </div>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c11_map_tools']}" alt="Carte mobile avec boussole, waypoints, recentrage et échelle" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 2 :</b> Carte en direct — Outils flottants alignés (🧭 Boussole N, 📍 Repère, 🎯 Recentrage), repères sur carte et échelle métrique.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c15_layer_modal']}" alt="Sélecteur de calques avec Esri Satellite et pentes" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 3 :</b> Fonds Cartographiques — IGN France, Satellite Esri, Swisstopo, UK Topo, IGN Espagne et Pentes >30°.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c12_waypoint']}" alt="Modale de création de repère géolocalisé" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 4 :</b> Enregistrer un Repère — Choix d'icône (🅿️ Parking, 💧 Source, ⚠️ Danger...), nommage et diffusion au groupe.
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">📈 Profil Altimétrique Zoomable (1x à 12x), Scrubber & Traces Parallèles</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Zoom progressif 1x à 12x</b> : Loupe interactive pour analyser les montées raides, cols ardus et replats sur le tracé.</li>
        <li><b>Scrubber synchronisé en direct</b> : Glisser le doigt sur la courbe altimétrique illumine le point correspondant sur la carte IGN.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Dénivelé cumulé (+D / -D) & Pente</b> : Calcul précis du dénivelé positif, négatif, altitudes min/max et inclinaison en %.</li>
        <li><b>Traces Parallèles (PolylineOffset)</b> : Aucun sentier masqué lors des tronçons communs de 2 ou 3 groupes.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📶 Préchargement des Tuiles IGN à Domicile (100% Hors-Ligne)</div>
      <p style="font-size: 9.3px; margin: 0;">
        <b>Le réflexe à la maison (sur Wi-Fi) :</b> Ouvrez l'appli, chargez le GPX et survolez le tracé en zoomant (zoom 14 à 16) pendant 30 s. Les dalles cartographiques sont stockées dans le cache sécurisé (<code>rando-tiles-v1</code>). En zone blanche totale, la carte s'affiche instantanément à 0 ms !
      </p>
    </div>
    <div class="card">
      <div class="card-title">🔍 Recherche Géographique Mondiale & Drapeaux</div>
      <p style="font-size: 9.3px; margin: 0;">
        Barre de recherche intégrée avec auto-complétion mondiale : tapez <i>Chamonix</i> 🇫🇷, <i>Zermatt</i> 🇨🇭, <i>Ordesa</i> 🇪🇸 ou <i>Ben Nevis</i> 🇬🇧 pour cadrer immédiatement la carte avec commutation automatique de la carte officielle du pays.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 3 : EMBARQUEMENT AU PARKING, PROFIL & SUIVI GROUPE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>👥 3. Embarquement au Parking, Mon Profil, Arrêt du Suivi & Tiroir Participants</h2>
  <p>
    RandoTracker simplifie radicalement l'accueil des participants au parking de départ : aucun compte requis, aucun mot de passe, synchronisation automatique en 3 secondes chrono !
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c04_invite']}" alt="Modale invitation sécurisée au parking avec QR code" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 5 :</b> Invitation au parking — QR Code d'accès éphémère et synchronisation automatique des traces et repères.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c14_profile_stop']}" alt="Modale Mon Profil avec bouton arrêt du suivi" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 6 :</b> Mon Profil Randonneur — Choix d'avatar, rôles, durée de partage et bouton rouge <b>🛑 Arrêter le suivi et fermer</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c07_group']}" alt="Tiroir Participants et télémétrie en direct" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 7 :</b> Tiroir Participants — Vitesse en direct, altitude, batterie %, écart trace (Cross-Track) et calcul d'ETA.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📲 1. Embarquement Instantané & Partage Automatique</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li>L'animateur ouvre la fenêtre <b>« Inviter »</b> affichant le QR Code sécurisé du salon.</li>
        <li>Chaque marcheur pointe l'appareil photo de son smartphone (ou le scanner QR intégré de l'app) : l'application rejoint le salon instantanément.</li>
        <li><b>Partage automatique des traces et waypoints</b> : Les nouveaux arrivants reçoivent automatiquement les circuits GPX et repères sans manipulation de fichiers !</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🥾 2. Mon Profil & Bouton d'Arrêt Total du Suivi</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>Prénom & 12 Avatars Outdoor</b> : Randonneur, Chat Jaune, Chat Rose, Loup, Renard, Ours, etc.</li>
        <li><b>Rôle dans la sortie</b> : Guide / Animateur 👑, Co-animateur 🥈, Serre-file 🛡️, Randonneur 🥾, Secours 🩺.</li>
        <li><b>Durée de Partage GPS (2h, 4h, 8h par défaut, 12h, 24h)</b> : Compte à rebours automatique pour préserver la vie privée et la batterie.</li>
        <li><b>🛑 Bouton Arrêter le suivi et fermer</b> : Stoppe immédiatement la géolocalisation, libère le wakelock et clôt tous les processus d'arrière-plan.</li>
      </ul>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">👥 3. Tiroir de Suivi des Participants & Distances Inter-Marcheurs</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Télémétrie complète en direct</b> : Distance parcourue (km), vitesse instantanée (km/h), altitude (m) et niveau de batterie restant (🔋%).</li>
        <li><b>Distances inter-marcheurs en 1 clic</b> : Cliquez sur n'importe quel marcheur pour afficher instantanément les distances qui le séparent de chacun des autres coéquipiers.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Écart à la trace & Alerte Sonore (>50m)</b> : Détection d'éloignement en temps réel avec alerte audio et visuelle pour prévenir les égarements.</li>
        <li><b>ETA dynamique d'arrivée</b> : Estimation affichée sur la fiche de chaque marcheur selon son rythme réel et la pente restante.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📍 Persistance & Synchronisation des Repères / Waypoints</div>
      <p style="font-size: 9.2px; margin: 0;">
        Tous les repères enregistrés sur le terrain (parking, eau potable, intersection, danger) restent conservés en mémoire locale même après fermeture complète de l'application. Lors d'un changement de salon ou d'une nouvelle rando, ils sont synchronisés en direct avec l'ensemble des membres du groupe.
      </p>
    </div>
    <div class="card">
      <div class="card-title">🛡️ Sécurisation & Rôle Clé du Serre-file</div>
      <p style="font-size: 9.2px; margin: 0;">
        Le serre-file surveille la distance d'écart à la trace et l'état de batterie dans le tiroir Participants : si un randonneur s'éloigne du parcours ou si sa batterie passe sous les 20%, il peut le contacter ou déclencher une alerte sonore immédiatement.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 4 : SECOURS SOS 50/50 & MESSAGES BROADCAST -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🚨 4. Dispositif Secours & Urgence Multi-Pays 50/50 & Messages Broadcast</h2>
  <p>
    En cas d'accident ou de malaise sur le terrain, chaque seconde compte. RandoTracker intègre un panneau de secours partitionné 50/50 accessible en 1 tapotement sur le bouton rouge <b>🚨 SOS</b> :
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c13_emergency_sos']}" alt="Écran Secours 50/50 France avec DD, DMS et 15 SAMU" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 8 :</b> Secours 50/50 France — Coordonnées GPS épinglées (DD/DMS), guide vocal phonétique, <b>15 SAMU</b>, <b>112</b> et <b>114 SMS</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c13b_emergency_spain']}" alt="Écran Secours Espagne avec 112 et 061" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 9 :</b> Onglet Pays Espagne 🇪🇸 — Commutation automatique des numéros d'urgence : <b>112</b> et <b>061 Urgencias</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c08_broadcast']}" alt="Modale Broadcast Message au groupe avec presets rapides" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 10 :</b> Message Broadcast au Groupe — 8 boutons rapides 1-clic avec carillon sonore / vibreur et géolocalisation intégrée.
      </div>
    </div>
  </div>

  <div class="card" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 6px 9px;">
    <div class="card-title" style="color: #b91c1c; font-size: 10.5px; margin-bottom: 2px;">🚨 Dispositif de Secours Sanctuarisé 50/50 Multi-Pays :</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Moitié Haute Fixe (Localisation Instantanée)</b> : Coordonnées GPS géantes en <b>Degrés Décimaux (DD)</b> et en <b>Degrés Minutes Secondes (DMS)</b>.</li>
        <li><b>Guide de dictée vocale phonétique</b> : Texte clair prêt à être lu au médecin régulateur des secours sans risque d'erreur d'inversion latitude/longitude.</li>
        <li><b>Bouton 📋 Copier GPS</b> : Copie instantanée dans le presse-papier pour envoi SMS.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Onglets Pays Dédiés</b> : 🇫🇷 France (15 SAMU, 112, 114 SMS), 🇬🇧 UK (999, 112), 🇨🇭 Suisse (144 Urgences, 1414 REGA Montagne), 🇪🇸 Espagne (112, 061), 🇪🇺 Europe (112).</li>
        <li><b>Appel direct 1-clic</b> : Numérote directement sans quitter l'écran de coordonnées.</li>
        <li><b>🚨 Sirène SOS Groupe</b> : Déclenche une sirène et vibreur sur tous les smartphones du club pour regrouper les secouristes.</li>
      </ul>
    </div>
  </div>

  <h2>📢 5. Messages Broadcast & Communication Rapide sur le Sentier</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📢 Messages Broadcast 1-Clic pour Tous les Marcheurs</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>8 Presets Outdoor Clés</b> : <i>« ⏸️ Pause de 10 minutes ! »</i>, <i>« 🚶‍♂️ Regroupement au sommet ! »</i>, <i>« ⚠️ Prudence, passage glissant »</i>, <i>« 🐢 Besoin de ralentir »</i>, <i>« 💧 Point d'eau / Ravitaillement »</i>, <i>« 🥪 Pause pique-nique »</i>, <i>« 🔄 Changement d'itinéraire »</i>, <i>« 👍 Tout le monde est là »</i>.</li>
        <li><b>Carillon d'alerte & Vibreur</b> : Réveille instantanément les téléphones rangés dans les poches ou les sacs à dos.</li>
        <li><b>Bouton « Voir sur la carte »</b> : Permet à tous les participants de centrer la carte sur l'émetteur du message en un seul tapotement.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🌲 Résilience Totale en Zone Blanche & Sauvegarde Locale</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>Puce GPS 100% Autonome</b> : La géolocalisation fonctionne par satellites sans aucune couverture réseau 4G/5G requise.</li>
        <li><b>Mémoire Tampon 5 Heures</b> : Les dernières positions restent affichées avec indication de l'âge de la donnée.</li>
        <li><b>Reconnexion Silencieuse</b> : Dès qu'un randonneur retrouve du réseau sur une crête, ses positions et ses waypoints sont automatiquement diffusés à la meute.</li>
      </ul>
    </div>
  </div>

  <div class="callout callout-alert" style="margin-top: 4px;">
    <div class="callout-title">⚠️ Protocole PAS en cas d'accident sur le sentier :</div>
    <b>1. Protéger :</b> Sécuriser la zone et la victime (couverture de survie, mise à l'abri du vent et du froid).<br/>
    <b>2. Alerter :</b> Ouvrir <b>🚨 SOS</b> sur RandoTracker, lire les coordonnées GPS en DMS au <b>15</b> ou <b>112</b>, et préciser l'état de la victime.<br/>
    <b>3. Secourir :</b> Prodiguer les gestes de premiers secours en attendant l'arrivée de l'hélicoptère du PGHM ou des pompiers.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 5 : AUTONOMIE BATTERIE, MODE POCHE & COMPARATIF -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🔋 6. Autonomie Batterie Record, Service Arrière-Plan & Mode Poche</h2>
  <p>
    L'autonomie de la batterie est le critère de sécurité numéro un en montagne. RandoTracker a été optimisé pour garantir une consommation minimale record tout au long de la journée :
  </p>

  <div class="figure-grid-2">
    <div class="figure-container">
      <img src="{b64['c16_pocket_mode']}" alt="Mode poche anti-tactile avec horloge géante et déverrouillage" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figure 11 :</b> Mode Poche (🔒) — Écran noir OLED économe, horloge géante, protection anti-tactile et déverrouillage par appui long 1.5s.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c09_profile_alt']}" alt="Profil altimétrique avec zoom et dénivelé" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figure 12 :</b> Profil de Dénivelé en Direct — Analyse du relief sans impacter la batterie grâce au moteur graphique vectoriel épuré.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📱 Mesure Réelle Terrain : < 1% en 5 Heures de Rando !</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        Lors des tests de certification sur un parcours complet :<br/>
        • <b>1h22</b> d'écran actif pour consulter la carte + <b>3h38</b> de suivi en poche écran éteint = <b>moins de 1% de batterie consommée</b> !<br/>
        • Sur une journée entière de 8h à 10h de marche : seulement <b>2% à 3% de batterie</b> consommée.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">🔒 Suivi Écran Éteint sur Android & Mode Poche Web/iPhone</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        • <b>Android Natif :</b> Éteignez directement l'écran avec le bouton physique. Le service d'arrière-plan officiel Google Play maintient le GPS sans interruption ni réglage complexe.<br/>
        • <b>Web & iPhone (PWA) :</b> Activez le <b>Mode Poche (🔒)</b>. L'écran passe en noir OLED avec horloge géante et verrouillage tactile sécurisé par appui maintenu 1.5 s.
      </p>
    </div>
  </div>

  <h2>🏆 7. Tableau Comparatif Exhaustif : RandoTracker vs Autres Solutions</h2>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Fonctionnalités & Critères Clés</th>
        <th style="background: #047857; width: 27%;">RandoTracker (2026)</th>
        <th style="width: 24%;">Visorando / AllTrails</th>
        <th style="width: 24%;">WhatsApp / Partage GPS</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>Installation & Téléchargement</b></td>
        <td><span class="badge badge-green">✅ Web PWA immédiate ou App Android</span></td>
        <td>⚠️ Téléchargement App Store obligatoire</td>
        <td>⚠️ Application tierce obligatoire</td>
      </tr>
      <tr>
        <td><b>Création de Compte & Données</b></td>
        <td><span class="badge badge-green">❌ Zéro compte / Données 100% éphémères</span></td>
        <td>⚠️ Email + Mot de passe + Publicité</td>
        <td>⚠️ Numéro de téléphone visible par tous</td>
      </tr>
      <tr>
        <td><b>Préchargement Cartes Hors-Ligne</b></td>
        <td><span class="badge badge-green">✅ Wi-Fi à domicile gratuit (0 ms)</span></td>
        <td>❌ Payant (Abonnement 25€ à 35€ / an)</td>
        <td>❌ Aucune mise en cache carto</td>
      </tr>
      <tr>
        <td><b>Consommation Batterie</b></td>
        <td><span class="badge badge-green">✅ Record : <1% pour 5h • OLED éco</span></td>
        <td>⚠️ Énergivore (pubs, fonds blancs, SDK)</td>
        <td>⚠️ Très gourmand en partage direct</td>
      </tr>
      <tr>
        <td><b>Multi-Traces GPX en Parallèle</b></td>
        <td><span class="badge badge-green">✅ 1 à 5 traces GPX simultanées</span></td>
        <td>❌ 1 seule trace active à la fois</td>
        <td>❌ Aucun support de fichier GPX</td>
      </tr>
      <tr>
        <td><b>Traces Parallèles (PolylineOffset)</b></td>
        <td><span class="badge badge-green">✅ Décalage auto des tronçons communs</span></td>
        <td>❌ Superposition masquante</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Boussole Google Maps & Repères</b></td>
        <td><span class="badge badge-green">✅ Flèche N 3D + Waypoints MQTT sync</span></td>
        <td>⚠️ Boussole basique / Pas de sync directe</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Cartes IGN France & Esri Satellite</b></td>
        <td><span class="badge badge-green">✅ Incluses & 100% Gratuites</span></td>
        <td>❌ Payant avec abonnement annuel</td>
        <td>❌ Fonds routiers sommaires</td>
      </tr>
      <tr>
        <td><b>Calque Pentes >30° & Échelle Métrique</b></td>
        <td><span class="badge badge-green">✅ Inclus (Sécurité Pente & Échelle dynamique)</span></td>
        <td>❌ Réservé aux options Premium</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Profil Altimétrique Zoomable</b></td>
        <td><span class="badge badge-green">✅ Zoom 1x à 12x + Dénivelé + Scrubber</span></td>
        <td>⚠️ Profil fixe non zoomable en direct</td>
        <td>❌ Non disponible</td>
      </tr>
      <tr>
        <td><b>Suivi de la Meute & Télémesure</b></td>
        <td><span class="badge badge-green">✅ Meute entière, Rôles, Avatars & ETA</span></td>
        <td>❌ Suivi individuel uniquement</td>
        <td>⚠️ Liste de contacts sans télémétrie</td>
      </tr>
      <tr>
        <td><b>Dispositif Secours Sanctuarisé 50/50</b></td>
        <td><span class="badge badge-green">✅ GPS DD/DMS + 15 SAMU + 112 + 114 Multi-Pays</span></td>
        <td>❌ Aucun bouton de secours direct</td>
        <td>❌ Pas de coordonnées GPS formalisées</td>
      </tr>
      <tr>
        <td><b>Arrêt Total du Suivi & Fermeture</b></td>
        <td><span class="badge badge-green">✅ Bouton dédié 🛑 Arrêter et fermer</span></td>
        <td>⚠️ Processus persistant en mémoire</td>
        <td>⚠️ Doit couper le partage à la main</td>
      </tr>
    </tbody>
  </table>

  <!-- ================================================================= -->
  <!-- PAGE 6 : CHECKLIST, DÉPANNAGE & SÉCURITÉ PLAY STORE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>📋 8. Guide Pratique Pas-à-Pas de la Sortie Club</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1️⃣ Avant de partir (À la maison sur Wi-Fi)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Ouvrez RandoTracker et chargez les GPX (<b>« TRACES »</b> $\rightarrow$ <b>« + Importer »</b>).</li>
        <li><b>Préchargement carto</b> : Survolez et zoomez (14 à 16) sur le parcours pendant 30 s pour stocker les dalles IGN HD.</li>
        <li>Attribuez une couleur distincte à chaque circuit (palette 10 teintes).</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">2️⃣ Au parking de départ (L'Animateur & la Meute)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>L'animateur ouvre <b>« Inviter »</b> et présente le <b>QR Code</b> du salon.</li>
        <li>Chaque marcheur scanne le code : il rejoint le salon et reçoit automatiquement les traces et les repères.</li>
        <li>Dans <b>« Mon Profil »</b>, chacun renseigne son prénom, son rôle, sa trace et clique sur <b>« 🎯 MON GPS »</b>.</li>
      </ol>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">3️⃣ Pendant la randonnée (Suivi & Sécurité)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Surveillez les écarts de groupe et les ETA dans le tiroir Participants.</li>
        <li>Utilisez <b>« Message au groupe »</b> pour avertir des pauses ou consignes avec position GPS automatique.</li>
        <li>Marquez les points d'intérêt ou dangers avec le bouton <b>📍 Repère</b>.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">4️⃣ Au retour au parking (Fin de Sortie)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Vérifiez l'arrivée de tous les participants grâce aux ETA et à la carte.</li>
        <li>Ouvrez <b>Mon Profil</b> et cliquez sur le bouton rouge <b>🛑 Arrêter le suivi et fermer</b> pour couper net la géolocalisation.</li>
        <li>La session s'efface automatiquement : zéro donnée résiduelle.</li>
      </ol>
    </div>
  </div>

  <h2>🛠️ 9. Guide de Dépannage & Troubleshooting (Que faire si...)</h2>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📍 1. Mon GPS s'arrête lorsque le téléphone est en poche</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Batterie Android :</b> Allez dans <i>Paramètres $\rightarrow$ Applications $\rightarrow$ RandoTracker $\rightarrow$ Batterie</i> et cochez <b>« Non restreinte »</b>. Évitez le mode « Optimisée » qui bride le GPS en veille.</li>
        <li><b>Position exacte :</b> Dans <i>Paramètres $\rightarrow$ Localisation $\rightarrow$ RandoTracker</i>, vérifiez que <b>« Position exacte »</b> est bien activé.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">👥 2. Je ne vois pas les autres marcheurs du salon</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Code Salon identique :</b> Vérifiez que tous les marcheurs ont rejoint exactement le même salon (ex : <code>RANDO-2026</code>).</li>
        <li><b>Bouton Actualiser :</b> Dans le tiroir Participants, cliquez sur l'icône de rafraîchissement 🔄 pour forcer la synchronisation.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card" style="border-left: 3.5px solid #f59e0b;">
      <div class="card-title">📢 3. Pas de carillon sonore lors des messages de groupe</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Autorisation Audio :</b> Touchez l'écran au moins une fois après ouverture pour débloquer le synthétiseur audio du navigateur.</li>
        <li><b>Mode Ne pas déranger :</b> Assurez-vous que le smartphone n'est pas en silencieux total ou en mode « Ne pas déranger ».</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #8b5cf6;">
      <div class="card-title">🗺️ 4. Dalles de carte blanches ou grises en montagne</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Préchargement Wi-Fi :</b> Pensez toujours à survoler le parcours en zoom 14-16 chez vous avant de partir.</li>
        <li><b>Basculement Satellite / OpenTopoMap :</b> Dans le sélecteur de calques, basculez sur <b>Satellite Esri</b> ou <b>OpenStreetMap</b> qui disposent de dalles en mémoire tampon.</li>
      </ul>
    </div>
  </div>

  <h2 style="margin-top: 6px;">🔒 10. Sécurité Certifiée Google Play Store & Confidentialité Totale (Vie Privée)</h2>
  <div class="grid-2" style="margin-top: 3px;">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">🛡️ 1. Absence Totale de Virus & Certification Play Protect</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>Validation Play Store 100% Sécurisée :</b> L'application (.aab) fait l'objet de contrôles antiviraux automatisés stricts de Google : zéro malware, zéro spyware, zéro composant intrusif. Signature cryptographique officielle certifiée.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #06b6d4;">
      <div class="card-title">☁️ 2. Zéro Base de Données Cloud & Respect RGPD</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>Architecture éphémère sans historique :</b> Aucune coordonnée GPS n'est conservée sur un serveur cloud. Les positions transitent en direct en mémoire vive (RAM) et disparaissent automatiquement. Vos réglages restent strictement sur votre propre téléphone.
      </p>
    </div>
  </div>

  <!-- Footer officiel -->
  <div class="footer-author">
    <div>
      <div style="font-size: 11px; font-weight: 900; color: #34d399;">RandoTracker — Suivi de Randonnée, Multi-Groupes & Cartes IGN Topo</div>
      <div style="font-size: 9px; color: #cbd5e1; margin-top: 1px;">Application Web Progressive (PWA) & Android conçue pour la sécurité, l'encadrement et la convivialité des clubs outdoor.</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 7.8px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Conception & Développement</div>
      <div style="font-size: 11px; font-weight: 600; color: #ffffff; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY — 2026</div>
    </div>
  </div>

</body>
</html>
"""
