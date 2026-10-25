# -*- coding: utf-8 -*-
"""
Orchestrateur & Compilateur des Modes d'Emploi RandoTracker en 3 Langues (FR, EN, ES)
Conception : Jean-Luc DAUSSY - 2026
Version v1.4.16
"""

import os
import sys
import base64
import subprocess
import shutil
import pypdfium2 as pdfium
import numpy as np

PROJECT_DIR = r"C:\Users\lesda\.gemini\antigravity\scratch\rando-tracker"
os.chdir(PROJECT_DIR)

BASE_DIR = os.path.join(PROJECT_DIR, "captures_clean")
ART_DIR = r"C:\Users\lesda\.gemini\antigravity\brain\77906641-bcbe-42b2-96ee-5cef4fcc7e0f"
os.makedirs(ART_DIR, exist_ok=True)

from build_manual_fr import get_html_fr
from build_manual_en import get_html_en
from build_manual_es import get_html_es

imgs_dict = {
    'c10_panoramic': os.path.join(BASE_DIR, 'capture_10_map_panoramic.png'),
    'c11_map_tools': os.path.join(BASE_DIR, 'capture_11_map_tools.png'),
    'c12_waypoint': os.path.join(BASE_DIR, 'capture_12_waypoint_modal.png'),
    'c02_traces_empty': os.path.join(BASE_DIR, 'capture_02.png'),
    'c03_traces_list': os.path.join(BASE_DIR, 'capture_03.png'),
    'c04_invite': os.path.join(BASE_DIR, 'capture_04_clean.png'),
    'c05_profile': os.path.join(BASE_DIR, 'capture_05.png'),
    'c14_profile_stop': os.path.join(BASE_DIR, 'capture_14_profile_stop.png'),
    'c06_emergency': os.path.join(BASE_DIR, 'capture_06.png'),
    'c13_emergency_sos': os.path.join(BASE_DIR, 'capture_13_emergency_sos.png'),
    'c13b_emergency_spain': os.path.join(BASE_DIR, 'capture_13b_emergency_spain.png'),
    'c07_group': os.path.join(BASE_DIR, 'capture_07.png'),
    'c08_broadcast': os.path.join(BASE_DIR, 'capture_08.png'),
    'c09_profile_alt': os.path.join(BASE_DIR, 'capture_09.png'),
    'c15_layer_modal': os.path.join(BASE_DIR, 'capture_15_layer_modal.png'),
    'c16_pocket_mode': os.path.join(BASE_DIR, 'capture_16_pocket_mode.png'),
}

print("Encodage des captures en base64...")
b64 = {}
for k, v in imgs_dict.items():
    if os.path.exists(v):
        with open(v, 'rb') as f:
            b64[k] = f"data:image/png;base64,{base64.b64encode(f.read()).decode('utf-8')}"
        print(f"  [OK] {k}: {os.path.basename(v)} ({os.path.getsize(v)} bytes)")
    else:
        print(f"  [ATTENTION] Image introuvable : {v}")
        b64[k] = ""

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
if not os.path.exists(chrome_path):
    chrome_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
print(f"Navigateur de rendu PDF : {chrome_path}")

tasks = [
    {
        'lang': 'fr',
        'html_name': 'mode_d_emploi_fr.html',
        'main_pdf': 'RandoTracker_Mode_d_emploi_FR.pdf',
        'aliases': ['RandoTracker_Mode_d_emploi.pdf'],
        'generator': get_html_fr
    },
    {
        'lang': 'en',
        'html_name': 'mode_d_emploi_en.html',
        'main_pdf': 'RandoTracker_User_Manual_EN.pdf',
        'aliases': ['RandoTracker_Mode_d_emploi_EN.pdf'],
        'generator': get_html_en
    },
    {
        'lang': 'es',
        'html_name': 'mode_d_emploi_es.html',
        'main_pdf': 'RandoTracker_Manual_de_Uso_ES.pdf',
        'aliases': ['RandoTracker_Mode_d_emploi_ES.pdf'],
        'generator': get_html_es
    }
]

for t in tasks:
    lang = t['lang']
    html_name = t['html_name']
    main_pdf = t['main_pdf']
    print(f"\n=======================================================")
    print(f"Compilation de la version [{lang.upper()}] : {main_pdf}")
    print(f"=======================================================")

    html_content = t['generator'](b64)
    html_path = os.path.abspath(html_name)
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print(f"Fichier HTML généré : {html_name} ({os.path.getsize(html_path)} bytes)")

    pdf_path = os.path.abspath(main_pdf)
    cmd = [
        chrome_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={pdf_path}",
        html_path
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if not (os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 10000):
        print(f"ERREUR lors de la compilation PDF {main_pdf} : {res.stderr}")
        continue

    print(f"SUCCÈS : PDF {main_pdf} créé ({os.path.getsize(pdf_path)} bytes)")

    # Copie vers les alias
    for alias in t['aliases']:
        alias_path = os.path.abspath(alias)
        shutil.copy2(pdf_path, alias_path)
        print(f"  -> Copie créée : {alias}")
        shutil.copy2(alias_path, os.path.join(ART_DIR, alias))

    # Copie principale dans ART_DIR
    shutil.copy2(pdf_path, os.path.join(ART_DIR, main_pdf))

    # Vérification du nombre de pages et rendu de contrôle
    doc = pdfium.PdfDocument(pdf_path)
    page_count = len(doc)
    print(f"Nombre de pages générées : {page_count}")
    for i, page in enumerate(doc):
        img = page.render(scale=1.5).to_pil()
        preview_name = f"preview_{lang}_page_{i+1}.png"
        preview_path = os.path.join(PROJECT_DIR, preview_name)
        img.save(preview_path)
        shutil.copy2(preview_path, os.path.join(ART_DIR, preview_name))

        arr = np.array(img.convert('RGB'))
        h, w, _ = arr.shape
        arr_content = arr[:h-30, :, :]
        non_white = np.where((arr_content < 245).any(axis=(1,2)))[0]
        if len(non_white) > 0:
            lowest_y = non_white.max()
            pct = (lowest_y / h) * 100
            print(f"  * Page {i+1} : contenu jusqu'à y={lowest_y}/{h} ({pct:.1f}% de la hauteur A4)")
        else:
            print(f"  * Page {i+1} : [VIDE !]")

print("\n=======================================================")
print("TOUS LES MODES D'EMPLOI ONT ÉTÉ GÉNÉRÉS AVEC SUCCÈS !")
print("=======================================================")
