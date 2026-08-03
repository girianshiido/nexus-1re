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

- Chaque cycle possède désormais un seul objectif : une fois la barre pleine, elle reste pleine et le surplus de flux ne donne aucun point supplémentaire.
- La récompense est déterministe : cycle 1 = +1 point, cycle 2 = +2 points, cycle 3 = +3 points, etc.
- Le seuil du cycle `n` est calculé sur le cumul théorique `1 + 2 + ... + n`, afin que les cycles progressent sans permettre de remplir la même barre des centaines de fois.
- À la sauvegarde de test du 3 août, le cycle 14 rapporte donc +14 points, même si le flux produit dépasse très largement le seuil.

La simulation complète de fin économique doit être recalibrée séparément, car l'ancien simulateur supposait des cycles à gains variables et une stratégie d'attente du plafond.
