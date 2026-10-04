# 🌍 Feuille de Route & Spécifications Internationales pour RandoTracker

Date : 4 octobre 2026

---

## 1. 🏗️ Architecture du Moteur Multilingue (i18n)

### A. Structure de la Table Centralisée (`app_i18n.js` ou dictionnaire direct)
Toutes les chaînes de l'application sont centralisées dans une table miroir multilingue :
* Langues prioritaires Phase 1 : **Français (`fr`)**, **Anglais (`en`)**, **Espagnol (`es`)**, **Italien (`it`)**, **Allemand (`de`)**.
* Extension Phase 2 : **Néerlandais (`nl`)**, **Portugais (`pt`)**, **Norvégien (`no`)**, **Suédois (`sv`)**, **Polonais (`pl`)**, **Tchèque (`cs`)**.

### B. Détection & Préférence Utilisateur
* Détection automatique au premier lancement via `navigator.language` (ex: `es-ES` -> `es`).
* Possibilité de changement manuel instantané dans le modal Profil avec persistance `localStorage.getItem('rando_user_lang')`.
* Injection automatique dans le DOM via l'attribut `data-i18n="cle_traduction"`.

---

## 2. 🗺️ Prédisposition Cartographique Automatique selon le Pays

RandoTracker analyse les coordonnées GPS actuelles (ou les coordonnées de départ de la trace GPX) pour activer par défaut le fond cartographique officiel le plus détaillé du pays :

| Pays / Région | Institut / Fournisseur | Type d'accès | Qualité / Rendu |
| :--- | :--- | :--- | :--- |
| **France (FR)** | **IGN France (Plan v2 & Ortho)** | Flux Géoplateforme `data.geopf.fr` | Référence nationale |
| **Espagne (ES)** | **IGN España (CNIG / Topo)** | WMTS public libre `ign.es` | Cartes topographiques officielles d'Espagne |
| **Suisse (CH)** | **Swisstopo (GeoAdmin)** | WMTS Open Data Fédéral public | Référence mondiale de cartographie alpine |
| **Royaume-Uni (UK)** | **Ordnance Survey / OpenTopo UK** | Tuiles Topo plein air | Courbes de niveau & sentiers balisés |
| **Italie (IT)** | **OpenTopoMap Italia / IGM** | Tuiles Topo alpines et apennines | Reliefs détaillés et courbes de niveau |
| **Norvège (NO)** | **Kartverket (Topo4)** | Open Data officiel public gratuit | Cartes scandinaves officielles |
| **Rép. Tchèque (CZ) / Slovaquie (SK)** | **ČÚZK / OpenTopoMap CZ** | Open Data | Système de sentiers le plus dense d'Europe |
| **Allemagne / Autriche (DE/AT)** | **OpenTopoMap / BKG** | Tuiles Topo européennes | Sentiers balisés et refuges alpins |
| **Reste du Monde** | **OpenTopoMap & OSM Monde** | WMTS mondial | Couverture mondiale continue |

---

## 3. 🚨 Adaptation Automatique des Numéros de Secours

| Pays | Numéro Européen / Général | Numéro Spécifique Montagne / Médical | SMS Urgence |
| :--- | :--- | :--- | :--- |
| **France** | `112` | `15` (SAMU) | `114` (SMS) |
| **Royaume-Uni** | `999` (Principal) | `112` (Mountain Rescue via 999) | `999` (SMS) |
| **Espagne** | `112` | `062` (Guardia Civil - GREIM Montagne) | `112` |
| **Italie** | `112` | `118` (Soccorso Sanitario / CNSAS Alpin) | `112` |
| **Suisse** | `112` | `144` (Ambulance) / `1414` (REGA Hélicoptère) | `144` |
| **Norvège** | `112` (Police / Sauvetage) | `113` (Secours médical d'urgence) | `112` |
| **Pologne** | `112` | `601 100 300` (TOPR / GOPR Secours Montagne) | `112` |

---

## 4. 📈 Marchés Stratégiques Européens pour la Randonnée

1. **Zone Alpine & Europe Centrale :** France, Suisse, Italie, Allemagne, Autriche, Slovénie.
2. **Zone Péninsule Ibérique :** Espagne, Portugal, Andorre (Chemins de Compostelle, GR11, Canaries).
3. **Zone Scandinave :** Norvège, Suède, Finlande (Grande culture outdoor *Friluftsliv*).
4. **Zone Îles Britanniques :** Royaume-Uni, Irlande (Sentiers nationaux, Highlands).
