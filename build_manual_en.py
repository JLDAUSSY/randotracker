# -*- coding: utf-8 -*-
"""
Generator for RandoTracker Official User Guide in English
Design & Development: Jean-Luc DAUSSY - 2026
Version v1.4.16
"""

def get_html_en(b64):
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>RandoTracker - Official User Guide (English)</title>
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
  <!-- PAGE 1 : COVER & MULTI-GROUP OVERVIEW -->
  <!-- ================================================================= -->
  <div class="cover-header">
    <div class="cover-title-row">
      <div>
        <span class="cover-badge">EXHAUSTIVE OFFICIAL USER GUIDE • VERSION v1.4.16 (2026)</span>
        <h1>RandoTracker</h1>
        <div class="cover-subtitle">
          Collaborative Live GPS Tracking Platform for Hiking Clubs, Multi-Level Groups & Outdoor Mountain Safety.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
        <div style="font-size: 7.8px; text-transform: uppercase; color: #a7f3d0; font-weight: 600; letter-spacing: 0.05em;">Author & Design</div>
        <div style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY</div>
        <div style="font-size: 8px; color: #94a3b8; font-weight: 500;">Official 2026 Edition</div>
      </div>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <div class="meta-label">Application Type</div>
      <div class="meta-val">Web PWA & Android (Play Store / APK)</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Multi-Track GPX</div>
      <div class="meta-val">1 to 5 synchronized parallel circuits</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Topo Cartography</div>
      <div class="meta-val">IGN France, Esri Satellite, Swisstopo, UK Topo, Slopes >30°</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Rescue & Safety</div>
      <div class="meta-val">SAMU 15, 112, 999, 114 SMS & GPS DD / DMS</div>
    </div>
  </div>

  <h2>🌲 1. Overview & Multi-Level Group Management</h2>
  <p>
    In hiking clubs, mountaineering associations and ramblers groups, outdoor outings routinely gather dozens of participants divided into <b>multiple pace groups</b>: Discovery / Easy loop (7 to 10 km), Intermediate loop (12 to 15 km), and Expert / Sport trek (18 to 25 km). RandoTracker is the only purpose-built platform that unites all groups on a single high-security map.
  </p>

  <div class="figure-container">
    <img src="{b64['c10_panoramic']}" alt="Panoramic Wide View Massif du Gros Cerveau and Sanary with 3 GPX tracks" style="max-height: 340px;" />
    <div class="figure-caption">
      <b>Figure 1:</b> Official Panoramic View — Gros Cerveau Massif & Sanary-sur-Mer: 3 simultaneous GPX circuits (Green 8.5 km, Blue 11.3 km, Red 17.0 km), <b>Steep Slopes Overlay (>30°)</b> in orange/yellow, departure point "D", Leader 👑 <b>Jean-Luc</b> and <b>4 Giant Bottom Keys</b> (🚨 SOS, 🎯 GPS, 🗺️ Tracks, 👥 Group).
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🎯 Simultaneous Multi-Group Tracking & Parallel Tracks</div>
      <p style="font-size: 9.4px; margin: 0;">
        Load up to <b>5 GPX tracks in parallel</b>. Each team follows its route with a dedicated color. When multiple circuits share the same trail segment, RandoTracker applies the <b>PolylineOffset</b> algorithm to automatically display parallel offset tracks without overlaps.
      </p>
    </div>
    <div class="card">
      <div class="card-title">⏱️ Automatic ETA Calculation & Live Telemetry</div>
      <p style="font-size: 9.4px; margin: 0;">
        Automatic binding of each walker to their chosen track. Real-time computation of progress, remaining distance, current speed and <b>accurate Estimated Time of Arrival (ETA)</b> at the trail end, making group carpool rendezvous effortless.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🔒 Absolute Privacy & Zero Cloud Storage</div>
      <p style="font-size: 9.4px; margin: 0;">
        No account required, no passwords, zero advertising tracking. Operates on an ephemeral "Walkie-Talkie" model: GPS coordinates flow in real-time RAM and are never permanently recorded on any central database or on other members' smartphones.
      </p>
    </div>
    <div class="card">
      <div class="card-title">📱 Outdoor Ergonomics & Enhanced Readability</div>
      <p style="font-size: 9.4px; margin: 0;">
        High-visibility outdoor interface: 4 giant bottom buttons usable with wet fingers or winter gloves, text scale selector (+15%, +30%), and draggable dialog boxes (<i>Drag & Drop</i>) to prevent covering key trail junctions.
      </p>
    </div>
  </div>

  <div class="callout callout-info">
    <div class="callout-title">💡 Golden Rule for Club Leadership:</div>
    The lead guide takes the role 👑 <b>Hike Leader / Guide</b> at the front. The co-leader closing the group selects 🛡️ <b>Sweeper / Tailguide</b>. Regular participants choose 🥾 <b>Hiker</b>. This allows everyone to spot the head and tail of the group at a single glance.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 2 : CARTOGRAPHY, ALIGNED MAP TOOLS & ELEVATION PROFILE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🗺️ 2. Topo Cartography, Esri Satellite, Aligned Map Tools & Elevation Profile</h2>
  <p>
    RandoTracker bundles world-class topographic maps, advanced elevation analysis and a precision floating map toolbar:
  </p>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🏔️ Official Topo Maps & Esri World Imagery</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>IGN France Plan v2 Topo</b>: Marked GR/PR trails, contour lines, landmarks, and shelters with sharp Retina rendering.</li>
        <li><b>Esri World Imagery (HD Satellite)</b>: High-resolution global aerial imagery, ideal for inspecting tree cover and ridge terrain.</li>
        <li><b>Swisstopo & UK Topo</b>: Official Swiss and Great Britain maps with auto-detection based on current coordinates.</li>
        <li><b>IGN España MTN Topo</b>: Perfect for Pyrenees and cross-border expeditions.</li>
        <li><b>Steep Slopes Layer (>30°)</b>: Vital orange/yellow security overlay for avalanche prevention and rocky dropoffs.</li>
        <li><b>Dynamic Metric Scale Bar</b>: Continuous scale display (50m, 100m, 500m, 1km) at the bottom left.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🧭 Floating Map Toolbar Aligned with Zoom (+ -)</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>🧭 Google Maps Style Compass with Rotating North</b>: 3D faceted crimson needle with bold white <b>"N"</b>. Rotates dynamically with phone magnetometer and GPS heading. Tap once to instantly snap map to North.</li>
        <li><b>📍 Geocoded Waypoint Marker</b>: 1-tap button to drop a persistent point of interest at your GPS location (Parking, Water Spring, Hazard, Viewpoint, Picnic, etc.). Saves locally and syncs over MQTT in real-time to all group devices!</li>
        <li><b>🎯 Instant GPS Recenter</b>: Centers and fits the map to your exact position with one click.</li>
        <li><b>Strict Geometric Alignment</b>: All 3 buttons match Leaflet's zoom (+ / -) width (34px) and vertical center axis.</li>
      </ul>
    </div>
  </div>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c11_map_tools']}" alt="Live map with compass, waypoints, recenter and scale bar" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 2:</b> Live Map — Aligned floating tools (🧭 Compass N, 📍 Waypoints, 🎯 Recenter), waypoint pins and metric scale bar.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c15_layer_modal']}" alt="Layer selector modal with Esri Satellite and slopes" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 3:</b> Cartographic Layers — IGN France, Esri Satellite, Swisstopo, UK Topo, IGN Spain and Slopes >30°.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c12_waypoint']}" alt="Waypoint marker modal" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figure 4:</b> Mark a Waypoint — Icon picker (🅿️ Parking, 💧 Water, ⚠️ Hazard...), custom label and live group broadcast.
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">📈 Zoomable Elevation Profile (1x to 12x), Live Scrubber & Parallel Tracks</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Progressive Zoom 1x to 12x</b>: Interactive magnifying lens to analyze steep ascents, mountain passes, and flat breathers.</li>
        <li><b>Live Synchronized Scrubber</b>: Sliding your finger across the elevation profile lights up the exact location on the map.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Cumulative Gain (+D / -D) & Grade</b>: Accurate calculation of total climb, descent, min/max altitude and slope gradient.</li>
        <li><b>Parallel Track Offsetting</b>: Prevents overlapping trails when several teams share the same path.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📶 Offline Map Pre-Caching at Home (100% Offline)</div>
      <p style="font-size: 9.3px; margin: 0;">
        <b>The Wi-Fi Habit before leaving:</b> Open RandoTracker, import your GPX and pan across the trail zooming in (levels 14 to 16) for 30 seconds. Map tiles are permanently saved in local cache (<code>rando-tiles-v1</code>). Even in deep zero-reception canyons, the map renders at 0 ms!
      </p>
    </div>
    <div class="card">
      <div class="card-title">🔍 Global City & Summit Search with Country Flags</div>
      <p style="font-size: 9.3px; margin: 0;">
        Integrated search bar with international autocomplete: type <i>Ben Nevis</i> 🇬🇧, <i>Chamonix</i> 🇫🇷, <i>Zermatt</i> 🇨🇭 or <i>Ordesa</i> 🇪🇸 to instantly pan and auto-switch to that country's official topographic map.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 3 : PARKING ONBOARDING, PROFILE & GROUP TELEMETRY -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>👥 3. Trailhead Onboarding, My Profile, Stop Tracking & Group Telemetry</h2>
  <p>
    RandoTracker revolutionizes group gathering at the trailhead: zero account setup, zero passwords, instant 3-second QR pairing!
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c04_invite']}" alt="Trailhead invite modal with QR code" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 5:</b> Trailhead Invite — Ephemeral QR Code with automatic synchronization of tracks and waypoints.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c14_profile_stop']}" alt="User Profile modal with Stop Tracking button" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 6:</b> My Profile — Avatar picker, roles, sharing timer and red button <b>🛑 Stop Tracking & Close App</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c07_group']}" alt="Participants drawer with live telemetry" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figure 7:</b> Participants Drawer — Live speed, altitude, battery %, cross-track deviation and dynamic ETA.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📲 1. Instant Trailhead Onboarding & Auto-Sync</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li>The leader opens <b>"Invite"</b> showing the secure session QR Code.</li>
        <li>Each walker scans the code using their phone camera (or the app's built-in QR scanner): joins the room in 1 click.</li>
        <li><b>Automatic Track & Waypoint Sync</b>: New joiners instantly receive all active GPX circuits and waypoints without handling any files!</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🥾 2. User Profile & Complete Stop Tracking Control</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>First Name & 12 Outdoor Avatars</b>: Hiker, Yellow Cat, Pink Cat, Wolf, Fox, Bear, etc.</li>
        <li><b>Role in the Group</b>: Hike Leader 👑, Co-leader 🥈, Sweeper 🛡️, Regular Hiker 🥾, First Aid 🩺.</li>
        <li><b>GPS Sharing Duration (2h, 4h, 8h default, 12h, 24h)</b>: Automatic countdown to preserve battery and privacy.</li>
        <li><b>🛑 Stop Tracking & Close Button</b>: Immediately terminates GPS watching, releases screen wakelocks, and shuts down all background processes.</li>
      </ul>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">👥 3. Participants Drawer & Inter-Hiker Distance Matrix</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Live Telemetry Dashboard</b>: Traveled distance (km), current speed (km/h), elevation (m) and battery level (🔋%).</li>
        <li><b>1-Tap Inter-Walker Distances</b>: Tap any hiker on the map to instantly reveal exact straight-line distances to every other teammate.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Cross-Track Warning & Audio Chime (>50m)</b>: Instant audio/visual alert if a participant wanders off the designated trail.</li>
        <li><b>Dynamic ETA calculation</b>: Personalized arrival time calculated against terrain slope and actual walking pace.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📍 Waypoint Persistence & Live MQTT Synchronization</div>
      <p style="font-size: 9.2px; margin: 0;">
        All dropped waypoints (parking, drinking water, hazards, viewpoints) persist across app closures and browser reboots in local storage. When switching rooms or starting a new hike, they are automatically shared with everyone in the room via real-time MQTT.
      </p>
    </div>
    <div class="card">
      <div class="card-title">🛡️ Sweeper Safety Role on the Trail</div>
      <p style="font-size: 9.2px; margin: 0;">
        The sweeper monitors cross-track distances and battery levels in the Participants Drawer: if a hiker strays into yellow or red alert, or battery drops below 20%, the sweeper can contact them or broadcast an immediate audio callout.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 4 : INTERNATIONAL 50/50 EMERGENCY SOS & BROADCAST -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🚨 4. International 50/50 Emergency SOS Dispositif & Broadcast Messaging</h2>
  <p>
    In case of injury or distress in mountain terrain, every second counts. RandoTracker incorporates a 50/50 split emergency console accessible in 1 tap on the red <b>🚨 SOS</b> button:
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c13_emergency_sos']}" alt="Emergency SOS 50/50 France with DD, DMS and SAMU 15" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 8:</b> SOS 50/50 France — Pinned GPS coordinates (DD/DMS), phonetic voice dictation, <b>15 SAMU</b>, <b>112</b> and <b>114 SMS</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c13b_emergency_spain']}" alt="Emergency SOS Spain tab with 112 and 061" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 9:</b> Spain Tab 🇪🇸 — Automatic emergency numbers switch: <b>112</b> and <b>061 Urgencias</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c08_broadcast']}" alt="Group broadcast modal with quick outdoor presets" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figure 10:</b> Group Broadcast — 8 quick 1-tap presets with audio chime, vibration alert and embedded GPS link.
      </div>
    </div>
  </div>

  <div class="card" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 6px 9px;">
    <div class="card-title" style="color: #b91c1c; font-size: 10.5px; margin-bottom: 2px;">🚨 High-Security 50/50 Multi-Country Rescue Console:</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Fixed Top Half (Immediate Location)</b>: Giant GPS coordinates in both <b>Decimal Degrees (DD)</b> and <b>Degrees Minutes Seconds (DMS)</b>.</li>
        <li><b>Phonetic Voice Dictation Guide</b>: Pre-formatted script ready to be read aloud to emergency dispatchers without inversion mistakes.</li>
        <li><b>📋 Copy GPS Button</b>: Instant copy to clipboard for SMS or satellite messengers.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Dedicated Country Tabs</b>: 🇬🇧 UK (999, 112), 🇫🇷 France (15 SAMU, 112, 114 SMS), 🇨🇭 Switzerland (144 Medical, 1414 REGA Mountain Rescue), 🇪🇸 Spain (112, 061), 🇪🇺 Europe (112).</li>
        <li><b>1-Tap Direct Dialing</b>: Calls emergency services immediately without leaving coordinates screen.</li>
        <li><b>🚨 Group SOS Siren</b>: Triggers alarm and strong vibration on all club members' phones.</li>
      </ul>
    </div>
  </div>

  <h2>📢 5. Group Broadcast Messaging & Fast On-Trail Coordination</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📢 1-Click Broadcast Messages for All Walkers</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>8 Key Outdoor Presets</b>: <i>"⏸️ 10-minute break!"</i>, <i>"🚶‍♂️ Regroup at summit!"</i>, <i>"⚠️ Caution, slippery rocks"</i>, <i>"🐢 Need to slow down"</i>, <i>"💧 Water spring refuel"</i>, <i>"🥪 Lunch break"</i>, <i>"🔄 Route change"</i>, <i>"👍 All accounted for"</i>.</li>
        <li><b>Audio Chime & Vibration</b>: Wakes up phones inside backpacks or jackets.</li>
        <li><b>"View on map" Button</b>: One tap centers the map directly on the sender's location.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🌲 Total Zero-Reception Resilience & Local Caching</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>100% Autonomous GPS Chip</b>: Satellite positioning operates completely without cellular coverage.</li>
        <li><b>5-Hour Buffer Memory</b>: Last known positions remain visible with an indicator showing data age.</li>
        <li><b>Silent Auto-Reconnection</b>: As soon as any phone catches signal on a ridge, all pending positions and waypoints sync automatically.</li>
      </ul>
    </div>
  </div>

  <div class="callout callout-alert" style="margin-top: 4px;">
    <div class="callout-title">⚠️ Universal Trailside Accident Protocol:</div>
    <b>1. Protect:</b> Secure the scene and casualty (survival blanket, shelter from cold and wind).<br/>
    <b>2. Alert:</b> Open <b>🚨 SOS</b> on RandoTracker, read DMS coordinates to <b>999</b> or <b>112</b>, state injury details.<br/>
    <b>3. Assist:</b> Deliver first aid while awaiting mountain rescue or helicopter dispatch.
  </div>

  <!-- ================================================================= -->
  <!-- PAGE 5 : BATTERY AUTONOMY, POCKET MODE & COMPARISON -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🔋 6. Record Battery Autonomy, Background Service & Pocket Mode</h2>
  <p>
    Battery endurance is the #1 safety asset in the wilderness. RandoTracker is engineered for ultra-low power consumption:
  </p>

  <div class="figure-grid-2">
    <div class="figure-container">
      <img src="{b64['c16_pocket_mode']}" alt="Pocket Mode screen with giant clock and unlock slider" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figure 11:</b> Pocket Mode (🔒) — Pure OLED black theme, giant clock, anti-touch protection and 1.5s long-press unlock.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c09_profile_alt']}" alt="Elevation profile with zoom and gain" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figure 12:</b> Live Elevation Profile — Zero-drain vector graphic engine preserving phone power throughout the day.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📱 Real Field Test: < 1% Battery Consumed in 5 Hours!</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        Certified field measurement during a full-length mountain outing:<br/>
        • <b>1h22</b> active screen map consultation + <b>3h38</b> pocket background tracking = <b>less than 1% battery consumed</b>!<br/>
        • Full day of hiking (8 to 10 hours): only <b>2% to 3% total battery drain</b>.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">🔒 Android Screen-Off Service & Web / iOS Pocket Mode</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        • <b>Native Android App:</b> Simply turn off screen with physical power button. Certified Google Play background service maintains GPS with zero complex setup.<br/>
        • <b>Web & iPhone (PWA):</b> Tap <b>Pocket Mode (🔒)</b>. Displays OLED black screen with giant clock and 1.5s hold-to-unlock safety.
      </p>
    </div>
  </div>

  <h2>🏆 7. Exhaustive Feature Comparison: RandoTracker vs Alternatives</h2>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Features & Key Criteria</th>
        <th style="background: #047857; width: 27%;">RandoTracker (2026)</th>
        <th style="width: 24%;">AllTrails / Komoot</th>
        <th style="width: 24%;">WhatsApp / Live Location</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>Installation & Access</b></td>
        <td><span class="badge badge-green">✅ Instant Web PWA or Android App</span></td>
        <td>⚠️ Mandatory App Store installation</td>
        <td>⚠️ Third-party app required</td>
      </tr>
      <tr>
        <td><b>User Account & Privacy</b></td>
        <td><span class="badge badge-green">❌ Zero account / 100% ephemeral</span></td>
        <td>⚠️ Email + Password + Ads tracking</td>
        <td>⚠️ Phone number visible to all</td>
      </tr>
      <tr>
        <td><b>Offline Map Pre-Caching</b></td>
        <td><span class="badge badge-green">✅ Free home Wi-Fi caching (0 ms)</span></td>
        <td>❌ Paid feature ($30 to $40 / year)</td>
        <td>❌ No map caching capability</td>
      </tr>
      <tr>
        <td><b>Battery Efficiency</b></td>
        <td><span class="badge badge-green">✅ Record: <1% over 5h • OLED eco</span></td>
        <td>⚠️ Heavy drain (ads, white themes, SDKs)</td>
        <td>⚠️ High battery drain in live share</td>
      </tr>
      <tr>
        <td><b>Multi-Track GPX in Parallel</b></td>
        <td><span class="badge badge-green">✅ 1 to 5 GPX tracks simultaneously</span></td>
        <td>❌ 1 active track only</td>
        <td>❌ No GPX support</td>
      </tr>
      <tr>
        <td><b>Parallel Tracks (PolylineOffset)</b></td>
        <td><span class="badge badge-green">✅ Automatic offset on shared paths</span></td>
        <td>❌ Tracks overlap and hide each other</td>
        <td>❌ Not available</td>
      </tr>
      <tr>
        <td><b>Google Maps Compass & Waypoints</b></td>
        <td><span class="badge badge-green">✅ 3D N needle + MQTT synced pins</span></td>
        <td>⚠️ Basic compass / No live pin sync</td>
        <td>❌ Not available</td>
      </tr>
      <tr>
        <td><b>Official Topo Maps & Esri Satellite</b></td>
        <td><span class="badge badge-green">✅ Included & 100% Free (IGN, Esri, UK, CH)</span></td>
        <td>❌ Expensive annual subscription</td>
        <td>❌ Crude standard road maps</td>
      </tr>
      <tr>
        <td><b>Slopes >30° & Dynamic Metric Scale</b></td>
        <td><span class="badge badge-green">✅ Included (Steep slope safety + Scale)</span></td>
        <td>❌ Locked behind Premium tier</td>
        <td>❌ Not available</td>
      </tr>
      <tr>
        <td><b>Zoomable Elevation Profile</b></td>
        <td><span class="badge badge-green">✅ 1x to 12x Zoom + Gain + Scrubber</span></td>
        <td>⚠️ Static non-zoomable profile</td>
        <td>❌ Not available</td>
      </tr>
      <tr>
        <td><b>Group Telemetry & Pack Tracking</b></td>
        <td><span class="badge badge-green">✅ Entire pack, Roles, Avatars & ETA</span></td>
        <td>❌ Individual tracking only</td>
        <td>⚠️ Contact list without hiking telemetry</td>
      </tr>
      <tr>
        <td><b>50/50 Multi-Country SOS Console</b></td>
        <td><span class="badge badge-green">✅ GPS DD/DMS + 999 + 112 + 15 + 114</span></td>
        <td>❌ No dedicated emergency module</td>
        <td>❌ No formatted GPS coordinates</td>
      </tr>
      <tr>
        <td><b>Full Stop Tracking & Exit Button</b></td>
        <td><span class="badge badge-green">✅ Dedicated 🛑 Stop & Exit button</span></td>
        <td>⚠️ Persistent background service</td>
        <td>⚠️ Must remember to stop sharing manually</td>
      </tr>
    </tbody>
  </table>

  <!-- ================================================================= -->
  <!-- PAGE 6 : CHECKLIST, TROUBLESHOOTING & PLAY STORE SECURITY -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>📋 8. Step-by-Step Club Outing Checklist</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1️⃣ Before Leaving (At Home on Wi-Fi)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Open RandoTracker and load GPX files (<b>"TRACKS"</b> $\rightarrow$ <b>"+ Import"</b>).</li>
        <li><b>Map Pre-caching</b>: Pan and zoom (levels 14-16) along route for 30s to store Topo HD tiles.</li>
        <li>Assign distinct colors to each circuit (10-color outdoor palette).</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">2️⃣ At the Trailhead Parking (Leader & Group)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Leader opens <b>"Invite"</b> and presents the room's <b>QR Code</b>.</li>
        <li>Walkers scan the code: joins room and automatically receives tracks and waypoints.</li>
        <li>In <b>"My Profile"</b>, enter first name, select role, assign track and tap <b>"🎯 MY GPS"</b>.</li>
      </ol>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">3️⃣ On the Trail (Navigation & Safety)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Monitor group pace gaps and ETAs in the Participants Drawer.</li>
        <li>Use <b>"Broadcast Message"</b> to announce regroupings or stops with automatic GPS.</li>
        <li>Mark key landmarks, springs, or hazards using the <b>📍 Waypoint</b> button.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">4️⃣ Returning to Trailhead (End of Hike)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Verify all participants have safely reached the parking area.</li>
        <li>Open <b>My Profile</b> and tap the red <b>🛑 Stop Tracking & Close App</b> button.</li>
        <li>Session clears automatically: zero residual data stored anywhere.</li>
      </ol>
    </div>
  </div>

  <h2>🛠️ 9. Comprehensive Troubleshooting Guide (What to do if...)</h2>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📍 1. GPS stops updating when phone is in pocket</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Android Battery Setting:</b> Go to <i>Settings $\rightarrow$ Apps $\rightarrow$ RandoTracker $\rightarrow$ Battery</i> and select <b>"Unrestricted"</b>. Avoid "Optimized" which suspends standby GPS.</li>
        <li><b>Precise Location:</b> Under <i>Settings $\rightarrow$ Location $\rightarrow$ RandoTracker</i>, ensure <b>"Use precise location"</b> is enabled.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">👥 2. Cannot see other walkers in the room</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Same Room Code:</b> Ensure all teammates have entered the exact same room code (e.g., <code>RANDO-2026</code>).</li>
        <li><b>Refresh Button:</b> In the Participants Drawer, tap the 🔄 icon to force immediate MQTT resynchronization.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card" style="border-left: 3.5px solid #f59e0b;">
      <div class="card-title">📢 3. No sound chime for group broadcast messages</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Audio Unlock:</b> Tap the screen at least once upon launching the app to authorize browser Web Audio synthesis.</li>
        <li><b>Do Not Disturb:</b> Check that your phone is not in total silent mode or "Do Not Disturb".</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #8b5cf6;">
      <div class="card-title">🗺️ 4. Blank or grey map tiles in remote mountains</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Wi-Fi Habit:</b> Always remember to pan and zoom over the route at home before heading out.</li>
        <li><b>Layer Switch:</b> Open the layers menu (🥞) and switch to <b>Esri Satellite</b> or <b>OpenStreetMap</b> which frequently hold cached tiles.</li>
      </ul>
    </div>
  </div>

  <h2 style="margin-top: 6px;">🔒 10. Google Play Store Certified Security & Zero-Cloud Privacy</h2>
  <div class="grid-2" style="margin-top: 3px;">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">🛡️ 1. Zero Malware & Play Protect Certification</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>100% Safe App Delivery:</b> Every release (.aab) undergoes automated deep antiviral scans by Google Play Protect: zero malware, zero spyware, zero tracking bloatware. Cryptographically signed.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #06b6d4;">
      <div class="card-title">☁️ 2. Zero Central Database & Full GDPR Compliance</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>Ephemeral Architecture without History:</b> No GPS coordinates are stored on a cloud server. Positions flow live through volatile memory (RAM) and disappear instantly. Settings remain strictly on your own device.
      </p>
    </div>
  </div>

  <!-- Official Footer -->
  <div class="footer-author">
    <div>
      <div style="font-size: 11px; font-weight: 900; color: #34d399;">RandoTracker — Group Hiking Tracker, Multi-Pace & Topo Cartography</div>
      <div style="font-size: 9px; color: #cbd5e1; margin-top: 1px;">Progressive Web App (PWA) & Android App engineered for outdoor club safety, leadership and conviviality.</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 7.8px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Concept & Development</div>
      <div style="font-size: 11px; font-weight: 600; color: #ffffff; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY — 2026</div>
    </div>
  </div>

</body>
</html>
"""
