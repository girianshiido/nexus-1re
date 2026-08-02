# Courbe de progression économique

## Définition de la fin simulée

Le jeu reste rejouable après ce point. Pour disposer d'une borne mesurable, la « fin économique » correspond ici à :

- 200 unités dans chacun des 18 ateliers ;
- les cinq améliorations de palier achetées dans chaque atelier ;
- le secteur Spécialité ouvert.

## Hypothèses

Le simulateur `scripts/simulate-progression.mjs` reproduit les coûts exponentiels, les productions, les paliers, les renforts entre ateliers, les cycles, les points d'étalonnage, les clics, l'Hypercadence et une valeur moyenne des perturbations. Il privilégie les nouveaux ateliers puis les achats dont le temps d'amortissement est le plus court. Le prototype gratuit n'est pas compté : les durées restent donc prudentes.

Les durées sont des heures de progression effective avec production continue. Elles ne sont pas des durées calendaires pour un joueur qui ferme le jeu au-delà de la limite de production hors ligne.

## Diagnostic avant recalibrage

| Profil | Ouverture Spécialité | Premier Intégrateur différentiel | Fin économique |
|---|---:|---:|---:|
| Tranquille | 16,9 h | 267 jours | non atteinte en 365 jours |
| Régulier | 15,9 h | 127 jours | non atteinte en 365 jours |
| Complétiste | 11,6 h | 118 jours | non atteinte en 365 jours |

La racine quatrième appliquée au flux cumulé ralentissait trop fortement les cycles avancés. Les coefficients de coût des trois derniers ateliers, allant jusqu'à `1,205^n`, transformaient ensuite les unités 100 à 200 en mur presque infranchissable.

## Recalibrage retenu

- La courbe d'étalonnage utilise une racine cubique au lieu d'une racine quatrième. Le premier point demande toujours 50 000 flux.
- À 854,81 millions de flux cumulés, le capital potentiel passe de 11 à 25 points : l'ancienne faille à plus de cent points ne revient pas.
- Les croissances de coût de la Forge complexe, du Polariseur complexe et de l'Intégrateur différentiel passent respectivement de 1,195 / 1,200 / 1,205 à 1,190 / 1,191 / 1,192.
- Les prix de départ et les multiplicateurs d'amélioration ×3 à ×10 de la Spécialité sont conservés.

## Courbe après recalibrage

| Profil | Ouverture Spécialité | Premier Intégrateur différentiel | Fin économique | Cycles |
|---|---:|---:|---:|---:|
| Tranquille | 13,0 h | 15,0 h | 50,0 h | 39 |
| Régulier | 5,4 h | 6,5 h | 37,6 h | 45 |
| Complétiste | 3,7 h | 4,1 h | 19,1 h | 50 |

La fin reste nettement plus longue que l'ouverture de la Spécialité, mais aucun profil ne rencontre désormais un mur de plusieurs mois. Le test `tests/progression.mjs` protège une cible de 24 à 60 heures pour le profil régulier.

