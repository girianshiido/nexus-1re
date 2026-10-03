# NEXUS 1re — Mathématiques STI2D

Prototype de jeu incrémental pédagogique destiné aux élèves de **première STI2D**. Le jeu génère ses questions à partir de modèles paramétrés : les nombres et les réponses changent à chaque partie.

## Référence pédagogique

Le contenu suit le **programme d'enseignement de mathématiques de la classe de première de la voie technologique**, publié au Bulletin officiel n° 14 du 2 avril 2026 et applicable à la rentrée 2026-2027.

Le jeu travaille notamment :

- fractions, puissances, priorités et notation scientifique ;
- proportionnalité, rapport de quantités (rappel de seconde entretenu en première) et conversions d'unités ;
- évolutions en pourcentage et évolutions successives ;
- ensembles, logique et contre-exemples ;
- calcul algébrique, factorisation, produit nul et signes ;
- fonctions affines, lectures graphiques et fonctions du second degré ;
- suites explicites ou récurrentes, arithmétiques ou géométriques ;
- dérivation, tangentes et variations des polynômes de degré inférieur ou égal à 3 ;
- statistiques à deux variables, ajustements affines et interpolations ;
- probabilités conditionnelles, Bernoulli et variables aléatoires ;
- algorithmique, Python, listes, données et tableur.

Les questions sont générées à partir de 90 modèles paramétriques produisant 91 formats. Un historique récent évite les répétitions strictes et varie les formats proposés. La correspondance détaillée avec les capacités officielles figure dans [la grille de couverture 2026](COUVERTURE-PROGRAMME-2026.md).

Un secteur avancé, invisible au début de la partie, ajoute ensuite uniquement la composante **mathématiques** du programme de première STI2D « physique-chimie et mathématiques » : trigonométrie, signaux sinusoïdaux, produit scalaire, nombres complexes, primitives et méthode d'Euler. Il s'ouvre définitivement lorsque les douze ateliers initiaux possèdent chacun 100 unités et que 200 points d'étalonnage sont disponibles.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur ou servir le dossier avec un serveur statique. Aucune compilation et aucune dépendance ne sont nécessaires.

Le jeu peut être installé sur l'écran d'accueil : via le menu du navigateur sur Android, ou avec **Partager → Sur l'écran d'accueil** dans Safari sur iPhone. Une icône dédiée et un mode autonome sont déclarés dans le manifeste web.

## Boucle de jeu

- Le noyau central produit du flux à chaque clic.
- L'**Hypercadence** commence à ×2. Sa charge redescend rapidement quand les clics s'arrêtent ; les points d'étalonnage permettent ensuite d'améliorer sa puissance, sa stabilité, sa durée et ses impulsions.
- Douze ateliers mathématiques s'achètent progressivement et produisent du flux passivement. Leurs paliers 10, 25, 50, 100 et 200 débloquent des améliorations ×2 qu'il faut financer.
- Après son déblocage, le secteur de spécialité ajoute six ateliers plus coûteux dont les améliorations utilisent des facteurs ×3 à ×10.
- Des perturbations occasionnelles proposent de une à trois questions uniquement parmi les notions achetées. Une réponse rapide améliore la récompense, mais une erreur ne retire aucune ressource.
- Chaque bonne réponse augmente la maîtrise de la notion et renforce légèrement son atelier.
- Un nouveau cycle remet à zéro le flux et les ateliers, conserve la maîtrise et accorde un multiplicateur permanent. Les points disponibles dépendent du flux cumulé depuis le début : redémarrer tôt ou tard donne le même capital à production totale égale.
- La courbe complète est contrôlée par `scripts/simulate-progression.mjs` et documentée dans `PROGRESSION-ECONOMIE.md` ; le profil régulier vise environ 38 heures de progression effective jusqu'aux 18 ateliers à 200 unités.
- Les points d'étalonnage peuvent être investis sans réduire le multiplicateur déjà gagné.
- Chaque question possède une référence et peut être signalée localement après la réponse.
- La progression est enregistrée localement dans le navigateur.

## Sauvegardes exportées

Les nouveaux exports (format 2) portent une empreinte HMAC-SHA-256 couvrant tout l'état du jeu et les métadonnées du fichier. L'import vérifie cette empreinte avant de proposer le remplacement de la partie ; une modification des valeurs, un fichier endommagé ou une empreinte manquante entraîne un refus. Les espaces et l'ordre des clés JSON peuvent changer sans invalider le fichier.

Les anciens exports non signés ne sont plus importables : réexporter la partie depuis le navigateur qui la possède. Les sauvegardes locales existantes sont conservées. Export et import protégé nécessitent HTTPS ou localhost.

Cette protection freine l'édition manuelle des fichiers. Le jeu et sa clé s'exécutant côté navigateur, elle ne peut pas empêcher un utilisateur de modifier le code ou le stockage local. Une garantie contre la triche nécessiterait une progression validée par un serveur. Les outils de diagnostic permettant d'ajouter du flux sont désormais réservés aux adresses locales.

L'audit `tests/browser-android-saves.mjs` vérifie le transfert entre navigateurs, l'altération de chaque champ et les achats sur écran tactile avec 35 minutes de jeu simulées. Il utilise Playwright et les variables `NEXUS_GAME_AUDIT_URL`, `NEXUS_PLAYWRIGHT_PATH` et `NEXUS_CHROME_PATH`.

## Expressions mathématiques

Le jeu et le laboratoire partagent `math-layout.js` pour regrouper les expressions entières : égalités, polynômes, produits de facteurs, suites, coordonnées et notations trigonométriques. Les fractions, exposants et racines conservent leur rendu. Une formule trop large pour son conteneur est réduite juste assez pour tenir sur une seule ligne ; la prose peut revenir à la ligne autour d'elle.

`tests/math-layout.mjs` vérifie des expressions témoins et 400 variantes de paraboles. `tests/browser-math-layout.mjs` reproduit une formule canonique complète dans le jeu et le laboratoire de 320 à 1366 px, avant et après correction, ainsi qu'au redimensionnement. L'audit général vérifie aussi que chaque formule de parabole est couverte en entier, plutôt que seulement les fragments déjà reconnus.

## Vérifications

```sh
node tests/smoke.mjs
node tests/diversity.mjs
node tests/economy.mjs
node tests/static.mjs
```
