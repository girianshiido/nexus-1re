# NEXUS 1re — Automatismes STI2D

Prototype de jeu incrémental pédagogique destiné aux élèves de **première STI2D**. Le jeu génère ses questions à partir de modèles paramétrés : les nombres et les réponses changent à chaque partie.

## Référence pédagogique

Le contenu suit le **programme d'enseignement de mathématiques de la classe de première de la voie technologique**, publié au Bulletin officiel n° 14 du 2 avril 2026 et applicable à la rentrée 2026-2027.

Le jeu travaille notamment :

- proportionnalité, ratios et conversions d'unités ;
- évolutions en pourcentage et évolutions successives ;
- calcul algébrique, équations produit nul ;
- fonctions affines et coefficient directeur ;
- suites arithmétiques et géométriques ;
- dérivation de polynômes de degré inférieur ou égal à 3 ;
- statistiques et probabilités conditionnelles ou indépendantes.

Les questions sont générées à partir de modèles paramétriques. Un historique récent évite les répétitions strictes et varie les formats proposés.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur ou servir le dossier avec un serveur statique. Aucune compilation et aucune dépendance ne sont nécessaires.

Le jeu peut être installé sur l'écran d'accueil : via le menu du navigateur sur Android, ou avec **Partager → Sur l'écran d'accueil** dans Safari sur iPhone. Une icône dédiée et un mode autonome sont déclarés dans le manifeste web.

## Boucle de jeu

- Le noyau central produit du flux à chaque clic.
- L'**Hypercadence** commence à ×2. Sa charge redescend rapidement quand les clics s'arrêtent ; les points d'étalonnage permettent ensuite d'améliorer sa puissance, sa stabilité, sa durée et ses impulsions.
- Neuf ateliers mathématiques s'achètent progressivement et produisent du flux passivement. Leurs paliers 10, 25, 50, 100 et 200 débloquent des améliorations ×2 qu'il faut financer.
- Des perturbations occasionnelles proposent de une à trois questions uniquement parmi les notions achetées. Une réponse rapide améliore la récompense, mais une erreur ne retire aucune ressource.
- Chaque bonne réponse augmente la maîtrise de la notion et renforce légèrement son atelier.
- Un nouveau cycle remet à zéro le flux et les ateliers, conserve la maîtrise et accorde un multiplicateur permanent.
- Les points d'étalonnage peuvent être investis sans réduire le multiplicateur déjà gagné.
- Chaque question possède une référence et peut être signalée localement après la réponse.
- La progression est enregistrée localement dans le navigateur.

## Vérifications

```sh
node tests/smoke.mjs
node tests/economy.mjs
node tests/static.mjs
```
