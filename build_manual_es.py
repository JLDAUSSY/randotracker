# -*- coding: utf-8 -*-
"""
Generador del Manual de Uso Oficial de RandoTracker en Español
Diseño & Desarrollo: Jean-Luc DAUSSY - 2026
Versión v1.4.16
"""

def get_html_es(b64):
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>RandoTracker - Manual de Uso Oficial (Español)</title>
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
  <!-- PÁGINA 1 : PORTADA & VISIÓN GENERAL MULTI-GRUPO -->
  <!-- ================================================================= -->
  <div class="cover-header">
    <div class="cover-title-row">
      <div>
        <span class="cover-badge">MANUAL DE USO OFICIAL EXHAUSTIVO • VERSIÓN v1.4.16 (2026)</span>
        <h1>RandoTracker</h1>
        <div class="cover-subtitle">
          Plataforma colaborativa de seguimiento GPS en vivo para Clubes de Senderismo, Multi-Grupos de Niveles & Seguridad Outdoor.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
        <div style="font-size: 7.8px; text-transform: uppercase; color: #a7f3d0; font-weight: 600; letter-spacing: 0.05em;">Autor & Concepción</div>
        <div style="font-size: 11px; font-weight: 600; color: #f8fafc; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY</div>
        <div style="font-size: 8px; color: #94a3b8; font-weight: 500;">Edición Oficial 2026</div>
      </div>
    </div>
  </div>

  <div class="meta-box">
    <div class="meta-item">
      <div class="meta-label">Tipo de Aplicación</div>
      <div class="meta-val">Web PWA & Android (Play Store / APK)</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Multi-Rutas GPX</div>
      <div class="meta-val">1 a 5 rutas paralelas sincronizadas</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Cartografía Topográfica</div>
      <div class="meta-val">IGN España MTN, Esri Satélite, IGN Francia, Swisstopo, Pendientes >30°</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Seguridad & Rescate</div>
      <div class="meta-val">112, 061 Urgencias, SAMU 15, 114 SMS & GPS DD / DMS</div>
    </div>
  </div>

  <h2>🌲 1. Visión General & Gestión Multi-Grupo de Niveles</h2>
  <p>
    En los clubes de senderismo, montañismo y asociaciones de naturaleza, las salidas de fin de semana reúnen habitualmente a decenas de participantes organizados en <b>múltiples grupos de ritmo y dificultad</b>: ruta Fácil / Iniciación (7 a 10 km), ruta Media (12 a 15 km) y ruta Experta / Deportiva (18 a 25 km). RandoTracker es la única solución que permite supervisar a todos los grupos en un mapa interactivo común y seguro.
  </p>

  <div class="figure-container">
    <img src="{b64['c10_panoramic']}" alt="Vista panorámica gran angular Massif du Gros Cerveau y Sanary con 3 rutas" style="max-height: 340px;" />
    <div class="figure-caption">
      <b>Figura 1:</b> Vista Panorámica Oficial — Macizo del Gros Cerveau & Sanary-sur-Mer: 3 rutas GPX simultáneas (Verde 8.5 km, Azul 11.3 km, Roja 17.0 km), Capa de <b>Fuertes Pendientes (>30°)</b> en naranja/amarillo, punto de salida « D », posición del guía 👑 <b>Jean-Luc</b> y <b>Barra Inferior de 4 Botones Gigantes</b> (🚨 SOS, 🎯 GPS, 🗺️ Rutas, 👥 Grupo).
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🎯 Seguimiento Simultáneo Multi-Grupo & Rutas Paralelas</div>
      <p style="font-size: 9.4px; margin: 0;">
        Cargue hasta <b>5 rutas GPX en paralelo</b>. Cada grupo sigue su trazado con un color identificativo. Cuando varios circuitos comparten el mismo sendero o pista forestal, RandoTracker activa el algoritmo <b>PolylineOffset</b> para separar visualmente los tracks en paralelo sin superposiciones.
      </p>
    </div>
    <div class="card">
      <div class="card-title">⏱️ Cálculo Automático de ETA & Telemetría en Vivo</div>
      <p style="font-size: 9.4px; margin: 0;">
        Vinculación automática de cada caminante a su trazado. La plataforma calcula en tiempo real el avance, la distancia restante, la velocidad media y la <b>hora estimada de llegada (ETA)</b> al final de la ruta, facilitando la coordinación de los vehículos y autobuses de regreso.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🔒 Privacidad Absoluta & Cero Registro en la Nube</div>
      <p style="font-size: 9.4px; margin: 0;">
        Sin cuentas obligatorias, sin contraseñas, cero publicidad. Arquitectura efímera tipo «Walkie-Talkie»: las coordenadas GPS se transmiten en vivo a través de memoria volátil (RAM) y nunca se almacenan en servidores centrales ni se guardan en los teléfonos de otros participantes.
      </p>
    </div>
    <div class="card">
      <div class="card-title">📱 Ergonomía Outdoor & Alta Visibilidad</div>
      <p style="font-size: 9.4px; margin: 0;">
        Diseño optimizado para la montaña: barra inferior de 4 botones gigantes utilizable con guantes o dedos húmedos, selector de tamaño de letra (+15%, +30%), y paneles desplazables (<i>Drag & Drop</i>) para no tapar los senderos críticos.
      </p>
    </div>
  </div>

  <div class="callout callout-info">
    <div class="callout-title">💡 Regla de oro para el liderazgo en clubes:</div>
    El guía principal asume el rol 👑 <b>Guía / Monitor</b> al frente del grupo. El voluntario que cierra la marcha selecciona 🛡️ <b>Cierre / Cola</b>. Los participantes eligen 🥾 <b>Senderista</b>. De este modo, todo el club visualiza al instante la cabeza y la cola de la expedición en el mapa.
  </div>

  <!-- ================================================================= -->
  <!-- PÁGINA 2 : CARTOGRAFÍA, HERRAMIENTAS ALINEADAS & PERFIL ALTIMÉTRICO -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🗺️ 2. Cartografía Topográfica, Esri Satélite, Herramientas Alineadas & Perfil</h2>
  <p>
    RandoTracker reúne la mejor cartografía de montaña, análisis de desnivel de alta precisión y una barra de herramientas flotante unificada:
  </p>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">🏔️ Mapas Oficiales Topo & Nueva Capa Esri Satélite HD</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>IGN España MTN Topo 1:25k</b>: Curvas de nivel, senderos PR/GR, fuentes y refugios del Instituto Geográfico Nacional.</li>
        <li><b>Esri World Imagery (Satélite HD)</b>: Fotografía aérea satelital mundial de alta resolución para examinar vegetación y roquedos.</li>
        <li><b>IGN Francia Plan v2 Topo & Swisstopo</b>: Mapas oficiales franceses y suizos con auto-detección según coordenadas GPS.</li>
        <li><b>UK Topo & OpenTopoMap</b>: Cartografía de senderismo internacional detallada.</li>
        <li><b>Capa de Fuertes Pendientes (>30°)</b>: Sobreimpresión de seguridad en naranja y amarillo para prever pendientes escarpadas.</li>
        <li><b>Escala Métrica Dinámica Leaflet</b>: Escala métrica visual permanente (50m, 100m, 500m, 1km) en la esquina inferior izquierda.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🧭 Herramientas Flotantes Alineadas con el Zoom (+ -)</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>🧭 Brújula Estilo Google Maps con Aguja Norte Rotativa</b>: Aguja 3D roja facetada con gran letra <b>«N»</b> blanca. Gira dinámicamente según el magnetómetro y rumbo GPS. Un toque reorienta de inmediato el mapa hacia el Norte.</li>
        <li><b>📍 Marcador de Puntos de Interés / Waypoints</b>: Botón de acceso directo para marcar un hito en su posición (Parking, Fuente, Peligro, Mirador, Almuerzo, etc.). ¡Persistencia local y sincronización MQTT en vivo para todo el grupo!</li>
        <li><b>🎯 Recentrado Inmediato GPS</b>: Centra y ajusta el mapa a su posición actual con 1 clic.</li>
        <li><b>Alineación Matemática Perfecta</b>: Mismo ancho (34px), mismo margen derecho y eje central unificado con el zoom (+ / -).</li>
      </ul>
    </div>
  </div>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c11_map_tools']}" alt="Mapa móvil con brújula, waypoints, recentrado y escala" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figura 2:</b> Mapa en vivo — Herramientas flotantes alineadas (🧭 Brújula N, 📍 Waypoints, 🎯 Recentrado), hitos y escala métrica.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c15_layer_modal']}" alt="Selector de capas con Esri Satélite y pendientes" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figura 3:</b> Fondos Cartográficos — IGN España, Esri Satélite, Swisstopo, IGN Francia y Pendientes >30°.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c12_waypoint']}" alt="Modal para crear un hito geolocalizado" style="max-height: 275px;" />
      <div class="figure-caption">
        <b>Figura 4:</b> Registrar un Waypoint — Iconos (🅿️ Parking, 💧 Fuente, ⚠️ Peligro...), nombre y difusión al grupo.
      </div>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">📈 Perfil Altimétrico con Zoom (1x a 12x), Cursor en Vivo & Rutas Paralelas</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Zoom progresivo 1x a 12x</b>: Lupa interactiva para examinar repechos duros, puertos y collados a lo largo del sendero.</li>
        <li><b>Cursor interactivo sincronizado</b>: Deslizar el dedo sobre la gráfica ilumina la posición exacta en el mapa.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Desnivel acumulado (+D / -D) & Pendiente</b>: Cálculo preciso de subida, bajada, cotas mín/máx e inclinación en %.</li>
        <li><b>Separación de Rutas Compartidas</b>: Trazados paralelos automáticos para no ocultar senderos confluentes.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📶 Precarga de Mapas en Casa con Wi-Fi (100% Sin Cobertura)</div>
      <p style="font-size: 9.3px; margin: 0;">
        <b>El hábito en casa antes de salir:</b> Abra RandoTracker, cargue el GPX y recorra la ruta haciendo zoom (niveles 14 a 16) durante 30 segundos. Las teselas del mapa quedan guardadas de forma permanente en la memoria caché (<code>rando-tiles-v1</code>). ¡En montaña profunda sin cobertura, el mapa carga a 0 ms!
      </p>
    </div>
    <div class="card">
      <div class="card-title">🔍 Buscador Mundial de Poblaciones & Cumbres</div>
      <p style="font-size: 9.3px; margin: 0;">
        Barra de búsqueda integrada con autocompletado internacional: escriba <i>Ordesa</i> 🇪🇸, <i>Aneto</i> 🇪🇸, <i>Chamonix</i> 🇫🇷 o <i>Zermatt</i> 🇨🇭 para centrar el mapa al instante con cambio automático al mapa topográfico oficial del país.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PÁGINA 3 : EMBARQUE EN EL PARKING, PERFIL & SEGUIMIENTO GRUPO -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>👥 3. Salida en el Parking, Mi Perfil, Parada de Seguimiento & Grupo</h2>
  <p>
    RandoTracker agiliza la bienvenida de los senderistas en el punto de encuentro: ¡sin registros engorrosos, conexión por QR en 3 segundos!
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c04_invite']}" alt="Modal invitación en el parking con código QR" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figura 5:</b> Invitación en el Parking — Código QR seguro con sincronización automática de rutas y waypoints.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c14_profile_stop']}" alt="Modal Mi Perfil con botón de parada del seguimiento" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figura 6:</b> Mi Perfil — Selección de avatar, rol, temporizador y botón rojo <b>🛑 Detener seguimiento y cerrar</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c07_group']}" alt="Panel de Participantes y telemetría en vivo" style="max-height: 360px;" />
      <div class="figure-caption">
        <b>Figura 7:</b> Panel de Participantes — Velocidad, altitud, batería %, desviación de ruta (Cross-Track) y ETA.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📲 1. Acceso Inmediato & Sincronización Automática</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li>El guía abre la ventana <b>«Invitar»</b> mostrando el Código QR exclusivo de la salida.</li>
        <li>Cada senderista escanea el código con su cámara o el lector QR integrado en la app: entra a la sala de inmediato.</li>
        <li><b>Envío automático de rutas y waypoints</b>: ¡Los nuevos integrantes reciben todas las rutas GPX y puntos de interés activos sin manipular archivos!</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🥾 2. Mi Perfil & Control Total de Parada de Seguimiento</div>
      <ul class="steps-list" style="font-size: 9.3px;">
        <li><b>Nombre & 12 Avatares Montañeros</b>: Senderista, Gato Amarillo, Gato Rosa, Lobo, Zorro, Oso, etc.</li>
        <li><b>Rol en la Marcha</b>: Guía / Monitor 👑, Colaborador 🥈, Cierre / Cola 🛡️, Senderista 🥾, Socorrista 🩺.</li>
        <li><b>Duración de Compartición GPS (2h, 4h, 8h por defecto, 12h, 24h)</b>: Temporizador para proteger batería y privacidad.</li>
        <li><b>🛑 Botón Detener Seguimiento y Cerrar</b>: Finaliza de inmediato la geolocalización, libera bloqueos de pantalla y detiene todos los procesos en segundo plano.</li>
      </ul>
    </div>
  </div>

  <div class="card" style="margin-top: 4px;">
    <div class="card-title">👥 3. Panel de Participantes & Matriz de Distancias Inter-Senderistas</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Telemetría completa en vivo</b>: Distancia recorrida (km), velocidad actual (km/h), altitud (m) y nivel de batería (🔋%).</li>
        <li><b>Distancias entre caminantes con 1 toque</b>: Toque sobre cualquier compañero en el mapa para ver la distancia en línea recta hacia los demás.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.3px; margin: 0;">
        <li><b>Desviación de Ruta & Alerta Sonora (>50m)</b>: Detección instantánea con alarma acústica si un compañero se aleja del sendero.</li>
        <li><b>ETA personalizada de llegada</b>: Estimación calculada según el ritmo real de caminata y el desnivel pendiente.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">📍 Persistencia & Sincronización MQTT de Waypoints</div>
      <p style="font-size: 9.2px; margin: 0;">
        Todos los hitos creados durante la marcha (aparcamiento, fuentes potables, cruces dudosos, zonas resbaladizas) se guardan en el almacenamiento local permanente. Al reiniciar la app o cambiar de sala, se sincronizan de inmediato con el resto del grupo a través de MQTT.
      </p>
    </div>
    <div class="card">
      <div class="card-title">🛡️ Seguridad en Marcha: Rol del Cierre de Grupo</div>
      <p style="font-size: 9.2px; margin: 0;">
        El responsable de cierre supervisa la separación de los miembros y la batería en el Panel de Participantes: si alguien se queda rezagado o su batería cae por debajo del 20%, puede llamarle o lanzarle un aviso sonoro al instante.
      </p>
    </div>
  </div>

  <!-- ================================================================= -->
  <!-- PÁGINA 4 : SOCORRO Y RESCATE 50/50 & MENSAJES BROADCAST -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🚨 4. Dispositivo de Rescate y Urgencia 50/50 & Mensajes a Todo el Grupo</h2>
  <p>
    En caso de accidente o emergencia en montaña, cada segundo cuenta. RandoTracker cuenta con un panel de socorro dividido 50/50 accesible en 1 pulsación sobre el botón rojo <b>🚨 SOS</b>:
  </p>

  <div class="figure-grid-3">
    <div class="figure-container">
      <img src="{b64['c13b_emergency_spain']}" alt="Pantalla Socorro España con 112 y 061" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figura 8:</b> Pestaña España 🇪🇸 — Coordenadas GPS fijas (DD/DMS), guía fonética de dictado, <b>112 Emergencias</b> y <b>061 Urgencias</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c13_emergency_sos']}" alt="Pantalla Socorro Francia con 15 SAMU" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figura 9:</b> Pestaña Francia 🇫🇷 — Cambio instantáneo a servicios de rescate galos: <b>15 SAMU</b>, <b>112</b> y <b>114 SMS</b>.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c08_broadcast']}" alt="Modal Broadcast Mensaje al grupo con opciones rápidas" style="max-height: 340px;" />
      <div class="figure-caption">
        <b>Figura 10:</b> Mensaje a Todo el Grupo — 8 botones rápidos de 1 toque con timbre acústico, vibración y GPS automático.
      </div>
    </div>
  </div>

  <div class="card" style="border-left: 4px solid #ef4444; background: #fff5f5; padding: 6px 9px;">
    <div class="card-title" style="color: #b91c1c; font-size: 10.5px; margin-bottom: 2px;">🚨 Dispositivo de Rescate Sanitizado 50/50 Multi-País:</div>
    <div class="grid-2" style="margin: 0;">
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Mitad Superior Fija (Localización Rápida)</b>: Coordenadas GPS gigantes en <b>Grados Decimales (DD)</b> y en <b>Grados Minutos Segundos (DMS)</b>.</li>
        <li><b>Guía fonética para dictar por voz</b>: Texto formateado para leerlo con calma al operador del 112 sin riesgo de invertir latitud y longitud.</li>
        <li><b>Botón 📋 Copiar GPS</b>: Copia rápida al portapapeles para enviar por SMS o mensajería satelital.</li>
      </ul>
      <ul class="steps-list" style="font-size: 9.2px; margin: 0;">
        <li><b>Pestañas de Países Específicas</b>: 🇪🇸 España (112, 061 Urgencias Sanitarias), 🇫🇷 Francia (15 SAMU, 112, 114 SMS), 🇬🇧 Reino Unido (999, 112), 🇨🇭 Suiza (144, 1414 REGA Rescate Aéreo), 🇪🇺 Europa (112).</li>
        <li><b>Llamada directa en 1 toque</b>: Marca el número sin abandonar la pantalla de coordenadas.</li>
        <li><b>🚨 Alarma SOS al Grupo</b>: Activa sirena y vibración en todos los móviles del club para acudir en auxilio.</li>
      </ul>
    </div>
  </div>

  <h2>📢 5. Mensajes a Todo el Grupo & Comunicación Rápida en Ruta</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">📢 Mensajes Broadcast de 1 Clic para Todos</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>8 Avisos Clave Predefinidos</b>: <i>« ⏸️ ¡Pausa de 10 minutos! »</i>, <i>« 🚶‍♂️ ¡Reagrupamiento en cumbre! »</i>, <i>« ⚠️ ¡Precaución, paso resbaladizo! »</i>, <i>« 🐢 Necesidad de aminorar ritmo »</i>, <i>« 💧 Punto de agua / Fuente »</i>, <i>« 🥪 Parada para almorzar »</i>, <i>« 🔄 Cambio de itinerario »</i>, <i>« 👍 Todos presentes »</i>.</li>
        <li><b>Timbre de Alerta & Vibración</b>: Hace sonar los teléfonos guardados en mochilas o bolsillos.</li>
        <li><b>Botón «Ver en el mapa»</b>: Centra de inmediato la vista sobre el compañero que envía el mensaje.</li>
      </ul>
    </div>

    <div class="card">
      <div class="card-title">🌲 Cobertura Cero & Almacenamiento Local Seguro</div>
      <ul class="steps-list" style="font-size: 9.2px;">
        <li><b>Chip GPS 100% Autónomo</b>: El posicionamiento por satélites no requiere cobertura móvil 4G/5G.</li>
        <li><b>Memoria Tampón de 5 Horas</b>: Mantiene las últimas posiciones conocidas con la antigüedad de la lectura.</li>
        <li><b>Reconexión Automática</b>: En cuanto un senderista alcanza una loma con señal, sus datos y waypoints se difunden al resto.</li>
      </ul>
    </div>
  </div>

  <div class="callout callout-alert" style="margin-top: 4px;">
    <div class="callout-title">⚠️ Protocolo PAS en caso de emergencia en montaña:</div>
    <b>1. Proteger:</b> Asegurar la zona y al accidentado (manta térmica, resguardo del viento y frío).<br/>
    <b>2. Avisar:</b> Pulsar <b>🚨 SOS</b> en RandoTracker, leer las coordenadas en DMS al <b>112</b> y describir el estado de la víctima.<br/>
    <b>3. Socorrer:</b> Aplicar primeros auxilios hasta la llegada del equipo de rescate de montaña o helicóptero.
  </div>

  <!-- ================================================================= -->
  <!-- PÁGINA 5 : AUTONOMÍA BATERÍA, MODO BOLSILLO & COMPARATIVA -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>🔋 6. Autonomía Récord de Batería, Segundo Plano & Modo Bolsillo</h2>
  <p>
    La autonomía energética es el elemento de seguridad primordial en senderismo. RandoTracker ofrece un consumo ultrabajo certificado:
  </p>

  <div class="figure-grid-2">
    <div class="figure-container">
      <img src="{b64['c16_pocket_mode']}" alt="Modo Bolsillo con reloj gigante y desbloqueo seguro" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figura 11:</b> Modo Bolsillo (🔒) — Fondo negro OLED de mínimo consumo, reloj gigante, bloqueo táctil y desbloqueo por pulsación de 1.5s.
      </div>
    </div>
    <div class="figure-container">
      <img src="{b64['c09_profile_alt']}" alt="Perfil altimétrico con zoom y desnivel" style="max-height: 250px;" />
      <div class="figure-caption">
        <b>Figura 12:</b> Perfil de Desnivel en Vivo — Motor vectorial ligero que no consume recursos de procesador ni agota la batería.
      </div>
    </div>
  </div>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📱 Medición Real en Terreno: ¡Menos del 1% en 5 Horas de Marcha!</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        Certificado durante pruebas de campo completas en montaña:<br/>
        • <b>1h22</b> de pantalla encendida consultando el mapa + <b>3h38</b> en el bolsillo con pantalla apagada = <b>¡menos del 1% de batería consumida!</b><br/>
        • En una travesía completa de 8h a 10h: tan solo <b>2% a 3% de consumo total</b>.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">🔒 Pantalla Apagada en Android & Modo Bolsillo Web/iPhone</div>
      <p style="font-size: 9.1px; margin-bottom: 3px;">
        • <b>App Android Nativa:</b> Apague la pantalla con el botón físico. El servicio oficial en segundo plano certificado por Google Play mantiene el GPS activo sin configuraciones complejas.<br/>
        • <b>Web & iPhone (PWA):</b> Active el <b>Modo Bolsillo (🔒)</b>. La pantalla se vuelve negra OLED con reloj gigante y bloqueo táctil para evitar pulsaciones accidentales.
      </p>
    </div>
  </div>

  <h2>🏆 7. Tabla Comparativa Exhaustiva: RandoTracker vs Otras Soluciones</h2>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Características & Criterios Clave</th>
        <th style="background: #047857; width: 27%;">RandoTracker (2026)</th>
        <th style="width: 24%;">Wikiloc / AllTrails</th>
        <th style="width: 24%;">WhatsApp / Ubicación en Vivo</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>Instalación & Descarga</b></td>
        <td><span class="badge badge-green">✅ Web PWA inmediata o App Android</span></td>
        <td>⚠️ Descarga obligatoria desde tienda</td>
        <td>⚠️ Requiere app de terceros</td>
      </tr>
      <tr>
        <td><b>Registro de Cuenta & Privacidad</b></td>
        <td><span class="badge badge-green">❌ Cero cuenta / 100% datos efímeros</span></td>
        <td>⚠️ Email + Contraseña + Publicidad</td>
        <td>⚠️ Teléfono visible para todos</td>
      </tr>
      <tr>
        <td><b>Descarga de Mapas Sin Cobertura</b></td>
        <td><span class="badge badge-green">✅ Gratis con Wi-Fi en casa (0 ms)</span></td>
        <td>❌ De pago (Suscripción 25€ a 35€ / año)</td>
        <td>❌ Sin mapas sin conexión</td>
      </tr>
      <tr>
        <td><b>Eficiencia de Batería</b></td>
        <td><span class="badge badge-green">✅ Récord: <1% en 5h • Eco OLED</span></td>
        <td>⚠️ Gran gasto (anuncios, temas blancos)</td>
        <td>⚠️ Consumo elevado en compartir</td>
      </tr>
      <tr>
        <td><b>Multi-Rutas GPX en Paralelo</b></td>
        <td><span class="badge badge-green">✅ 1 a 5 rutas GPX simultáneas</span></td>
        <td>❌ Solo 1 ruta activa</td>
        <td>❌ Sin compatibilidad GPX</td>
      </tr>
      <tr>
        <td><b>Rutas Paralelas (PolylineOffset)</b></td>
        <td><span class="badge badge-green">✅ Separación automática en tramos comunes</span></td>
        <td>❌ Superposición de líneas</td>
        <td>❌ No disponible</td>
      </tr>
      <tr>
        <td><b>Brújula Google Maps & Waypoints</b></td>
        <td><span class="badge badge-green">✅ Aguja N 3D + Hitos sincronizados MQTT</span></td>
        <td>⚠️ Brújula simple / Sin sync en vivo</td>
        <td>❌ No disponible</td>
      </tr>
      <tr>
        <td><b>Mapas Topo Oficiales & Esri Satélite</b></td>
        <td><span class="badge badge-green">✅ Incluidos y 100% Gratuitos (IGN, Esri, etc.)</span></td>
        <td>❌ Requiere suscripción anual de pago</td>
        <td>❌ Mapas de carreteras básicos</td>
      </tr>
      <tr>
        <td><b>Pendientes >30° & Escala Métrica</b></td>
        <td><span class="badge badge-green">✅ Incluido (Seguridad de pendientes y escala)</span></td>
        <td>❌ Restringido a versiones Premium</td>
        <td>❌ No disponible</td>
      </tr>
      <tr>
        <td><b>Perfil Altimétrico con Zoom</b></td>
        <td><span class="badge badge-green">✅ Zoom 1x a 12x + Desnivel + Cursor</span></td>
        <td>⚠️ Gráfica estática sin zoom</td>
        <td>❌ No disponible</td>
      </tr>
      <tr>
        <td><b>Supervisión de Todo el Grupo</b></td>
        <td><span class="badge badge-green">✅ Grupo entero, Roles, Avatares y ETA</span></td>
        <td>❌ Seguimiento individual únicamente</td>
        <td>⚠️ Lista sin telemetría de montaña</td>
      </tr>
      <tr>
        <td><b>Dispositivo Rescate 50/50 Multi-País</b></td>
        <td><span class="badge badge-green">✅ GPS DD/DMS + 112 + 061 + 15 + 114</span></td>
        <td>❌ Sin consola directa de socorro</td>
        <td>❌ Sin coordenadas GPS normalizadas</td>
      </tr>
      <tr>
        <td><b>Botón de Parada Total & Cierre</b></td>
        <td><span class="badge badge-green">✅ Botón dedicado 🛑 Detener y salir</span></td>
        <td>⚠️ Proceso persistente en memoria</td>
        <td>⚠️ Detención manual confusa</td>
      </tr>
    </tbody>
  </table>

  <!-- ================================================================= -->
  <!-- PÁGINA 6 : LISTA DE CONTROL, RESOLUCIÓN & SEGURIDAD PLAY STORE -->
  <!-- ================================================================= -->
  <div class="page-break"></div>

  <h2>📋 8. Guía Práctica Paso a Paso para Salidas de Club</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1️⃣ Antes de Salir (En Casa con Wi-Fi)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Abra RandoTracker y cargue los tracks (<b>«RUTAS»</b> $\rightarrow$ <b>«+ Importar GPX»</b>).</li>
        <li><b>Precarga de mapas</b>: Recorra la ruta haciendo zoom (niveles 14 a 16) durante 30s para guardar las teselas IGN HD.</li>
        <li>Asigne un color diferenciado a cada itinerario (paleta de 10 tonos).</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">2️⃣ En el Aparcamiento de Salida (El Guía & el Grupo)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>El guía abre <b>«Invitar»</b> y muestra el <b>Código QR</b> de la sala.</li>
        <li>Los senderistas escanean el código: entran a la sala y reciben las rutas y waypoints automáticamente.</li>
        <li>En <b>«Mi Perfil»</b>, cada uno indica su nombre, rol, ruta asignada y pulsa <b>«🎯 MI GPS»</b>.</li>
      </ol>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card">
      <div class="card-title">3️⃣ Durante la Marcha (Navegación & Seguridad)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Supervise la separación entre caminantes y los tiempos estimados de llegada (ETA).</li>
        <li>Utilice <b>«Mensaje al grupo»</b> para notificar descansos o indicaciones con posición GPS adjunta.</li>
        <li>Marque hitos o zonas delicadas con el botón flotante <b>📍 Waypoint</b>.</li>
      </ol>
    </div>

    <div class="card">
      <div class="card-title">4️⃣ Al Finalizar la Actividad (Llegada al Parking)</div>
      <ol class="steps-list" style="font-size: 9.1px; padding-left: 13px; margin: 0;">
        <li>Compruebe la llegada de todos los senderistas mediante el mapa y el panel de participantes.</li>
        <li>Abra <b>Mi Perfil</b> y pulse el botón rojo <b>🛑 Detener seguimiento y cerrar</b> para detener el GPS.</li>
        <li>La sesión se borra automáticamente: cero datos residuales en ningún sitio.</li>
      </ol>
    </div>
  </div>

  <h2>🛠️ 9. Guía de Solución de Problemas (Qué hacer si...)</h2>

  <div class="grid-2">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">📍 1. El GPS se detiene al llevar el móvil en el bolsillo</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Batería Android:</b> Entre en <i>Ajustes $\rightarrow$ Aplicaciones $\rightarrow$ RandoTracker $\rightarrow$ Batería</i> y elija <b>«Sin restricciones»</b>. Evite el modo «Optimizado» que suspende el GPS.</li>
        <li><b>Ubicación precisa:</b> En <i>Ajustes $\rightarrow$ Ubicación $\rightarrow$ RandoTracker</i>, verifique que <b>«Ubicación precisa»</b> esté activada.</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #3b82f6;">
      <div class="card-title">👥 2. No veo a los demás compañeros en el mapa</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Mismo Código de Sala:</b> Asegúrese de que todos los integrantes han introducido el mismo nombre de sala (ej: <code>RANDO-2026</code>).</li>
        <li><b>Botón Actualizar:</b> En el Panel de Participantes, pulse el icono 🔄 para forzar una sincronización inmediata por MQTT.</li>
      </ul>
    </div>
  </div>

  <div class="grid-2" style="margin-top: 4px;">
    <div class="card" style="border-left: 3.5px solid #f59e0b;">
      <div class="card-title">📢 3. No suena el aviso acústico de los mensajes grupales</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Desbloqueo de Audio:</b> Toque la pantalla al menos una vez tras abrir la aplicación para autorizar la síntesis Web Audio del navegador.</li>
        <li><b>Modo No Molestar:</b> Compruebe que el teléfono no esté en modo silencio estricto o «No Molestar».</li>
      </ul>
    </div>

    <div class="card" style="border-left: 3.5px solid #8b5cf6;">
      <div class="card-title">🗺️ 4. Aparecen zonas grises o sin mapa en la montaña</div>
      <ul class="steps-list" style="font-size: 8.9px;">
        <li><b>Hábito Wi-Fi:</b> Recuerde siempre recorrer la ruta haciendo zoom en casa antes de iniciar el viaje.</li>
        <li><b>Cambio de Capa:</b> En el menú de mapas (icono 🥞), cambie a <b>Esri Satélite</b> u <b>OpenStreetMap</b> que suelen conservar mapas en caché.</li>
      </ul>
    </div>
  </div>

  <h2 style="margin-top: 6px;">🔒 10. Seguridad Certificada Google Play Store & Cero Nube (Privacidad Total)</h2>
  <div class="grid-2" style="margin-top: 3px;">
    <div class="card" style="border-left: 3.5px solid #10b981;">
      <div class="card-title">🛡️ 1. Cero Virus & Certificación Play Protect</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>Entrega 100% Segura:</b> Cada versión (.aab) es analizada minuciosamente por los sistemas de Google Play Protect: cero software malicioso, cero espionaje, cero consumo oculto. Firma criptográfica oficial verificada.
      </p>
    </div>

    <div class="card" style="border-left: 3.5px solid #06b6d4;">
      <div class="card-title">☁️ 2. Sin Base de Datos en la Nube & Cumplimiento RGPD</div>
      <p style="font-size: 8.8px; margin-bottom: 2px;">
        <b>Estructura efímera sin histórico:</b> Ninguna coordenada GPS se almacena en servidores centrales. Las posiciones viajan en tiempo real y desaparecen de inmediato. Sus datos personales permanecen en su propio teléfono.
      </p>
    </div>
  </div>

  <!-- Pie de página oficial -->
  <div class="footer-author">
    <div>
      <div style="font-size: 11px; font-weight: 900; color: #34d399;">RandoTracker — Seguimiento de Senderismo, Multi-Grupo & Mapas Topográficos</div>
      <div style="font-size: 9px; color: #cbd5e1; margin-top: 1px;">Aplicación Web Progresiva (PWA) & Android diseñada para la seguridad, coordinación y compañerismo en montaña.</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 7.8px; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.05em;">Diseño & Desarrollo</div>
      <div style="font-size: 11px; font-weight: 600; color: #ffffff; margin-top: 1px; letter-spacing: 0.02em;">Jean-Luc DAUSSY — 2026</div>
    </div>
  </div>

</body>
</html>
"""
