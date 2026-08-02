import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [html, app, learning, styles, manifestText, serviceWorker, exerciseLabHtml, exerciseLabApp, exerciseLabStyles] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../learning-model.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8"),
  readFile(new URL("../exerciseurs/index.html", import.meta.url), "utf8"),
  readFile(new URL("../exerciseurs/app.js", import.meta.url), "utf8"),
  readFile(new URL("../exerciseurs/styles.css", import.meta.url), "utf8")
]);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
assert.equal(ids.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "les identifiants HTML doivent être uniques");

const requiredIds = [...app.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]);
for (const id of requiredIds) assert.ok(ids.has(id), `élément #${id} manquant dans index.html`);

const exerciseLabIds = new Set([...exerciseLabHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
assert.equal(exerciseLabIds.size, [...exerciseLabHtml.matchAll(/\bid="([^"]+)"/g)].length, "les identifiants du laboratoire doivent être uniques");
const requiredExerciseLabIds = [...exerciseLabApp.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]);
for (const id of requiredExerciseLabIds) assert.ok(exerciseLabIds.has(id), `élément #${id} manquant dans exerciseurs/index.html`);

assert.match(html, /question-engine\.js[^]*learning-model\.js[^]*game-model\.js[^]*app\.js/, "les scripts doivent être chargés dans le bon ordre");
assert.match(html, /viewport-fit=cover/, "la vue mobile doit être configurée");
assert.match(html, /maximum-scale=1/, "le zoom par pincement doit être désactivé");
assert.match(html, /user-scalable=no/, "le zoom tactile doit être verrouillé");
assert.match(styles, /touch-action:\s*pan-x pan-y/, "le défilement doit rester autorisé sans zoom tactile");
assert.match(styles, /user-select:\s*none/, "la sélection de texte doit être désactivée");
assert.match(html, /rel="manifest"/, "le manifeste d'installation doit être relié");
assert.match(html, /rel="apple-touch-icon"/, "l'icône iPhone doit être reliée");
assert.match(html, /NEXUS 1re — Mathématiques STI2D/, "le titre partagé doit refléter l'ensemble du programme");
assert.match(html, /property="og:title" content="NEXUS 1re — Mathématiques STI2D"/, "l'aperçu des messageries doit porter le bon titre");
assert.match(html, /og:description/, "l'aperçu des messageries doit décrire l'ensemble du jeu");
assert.match(app, /serviceWorker\.register/, "le service worker doit être enregistré");
assert.match(app, /AudioContext/, "les bruitages doivent être générés par le navigateur");
assert.match(app, /gesturestart/, "les gestes de pincement iOS doivent être bloqués explicitement");
assert.match(app, /touches\.length > 1/, "les mouvements à plusieurs doigts doivent être bloqués");
assert.match(app, /isDoubleTap/, "le double tap iOS doit être intercepté sans bloquer le défilement");
assert.match(app, /questionReports/, "les questions signalées doivent être mémorisées localement");
assert.match(app, /buyWorkshopUpgrade/, "les améliorations d'atelier doivent être achetables");
assert.match(app, /buyCalibrationUpgrade/, "les points d'étalonnage doivent financer des améliorations permanentes");
assert.match(app, /cycleGain\(state\.lifetimeFlux, state\.calibration\)/, "les points doivent dépendre de la production cumulée et du capital déjà obtenu");
assert.doesNotMatch(app, /cycleGain\(state\.cycleFlux/, "le flux du seul cycle ne doit plus permettre de multiplier les points");
assert.match(html, /flux produit depuis le début/, "l'interface doit expliquer la progression cumulative de l'étalonnage");
assert.match(app, /Model\.formatCompactNumber/, "les grands nombres doivent employer les unités étendues du jeu");
assert.match(app, /runAutomation/, "le collecteur autonome doit acheter les améliorations d'atelier");
assert.match(app, /protectedFlux/, "la réserve doit protéger du flux contre l'automatisation");
assert.match(app, /recentMistakes/, "le carnet d'erreurs doit mémoriser les notions manquées");
assert.match(app, /navigator\.vibrate/, "la balise de perturbation doit pouvoir produire une alerte tactile");
assert.match(app, /createProgrammeCoverage/, "la grille du programme 2026 doit être affichée dans le jeu");
assert.match(app, /renderQuestionCanvases/, "les lectures graphiques doivent être dessinées dans le navigateur");
assert.match(app, /clickValue\(\) \* \(hyper \? stats\.multiplier : 1\) \* boostMultiplier\(\)/, "les bonus de production et d'Hypercadence doivent se cumuler sur un clic");
assert.match(app, /clickValue\(\) \* hyperStats\(\)\.pulsesPerSecond \* boost/, "le bonus de production doit aussi s'appliquer aux impulsions Hypercadence");
assert.match(app, /renderMathText/, "les formules doivent être rendues dans des groupes insécables");
assert.match(app, /SUBSCRIPT_CHARACTERS/, "les indices doivent être redessinés avec la police du jeu");
assert.match(app, /appendRadical/, "les racines doivent disposer d'un rendu couvrant tout le radicande");
assert.match(app, /appendFraction/, "les quotients mathématiques doivent disposer de vraies barres de fraction");
assert.match(app, /appendVector/, "les vecteurs doivent être surmontés d'une flèche");
assert.match(styles, /\.math-inline[^]*white-space:\s*nowrap/, "une formule ne doit pas être coupée à l'intérieur sur mobile");
assert.match(styles, /\.math-radicand[^}]*border-top/, "le trait d'une racine doit recouvrir le radicande");
assert.match(styles, /\.math-fraction[^}]*grid-template-rows/, "les quotients doivent être empilés en fractions");
assert.match(styles, /\.math-vector::before[^}]*content:\s*"→"/, "une flèche doit être dessinée au-dessus des vecteurs");
assert.equal((html.match(/data-tab="[^"]+"[^>]*role="tab"/g) || []).length, 4, "quatre onglets doivent séparer le noyau, les ateliers, les améliorations et le réseau");
assert.equal((html.match(/data-protocol-view="[^"]+"/g) || []).length, 2, "les protocoles doivent être séparés entre puissance et confort");
assert.match(app, /EVENT_WINDOW_MS/, "les perturbations doivent avoir une durée de disponibilité limitée");
assert.match(app, /https:\/\/gettimeapi\.dev\/v1\/time\?timezone=UTC/, "le gain hors ligne doit utiliser une horloge UTC externe");
assert.match(app, /trustedNow/, "les sauvegardes doivent employer l'horloge UTC vérifiée");
assert.match(app, /SESSION_STARTED_AT/, "un rattrapage UTC tardif ne doit pas recompter le temps de jeu de la session");
assert.match(app, /Connexion UTC indisponible/, "un gain non vérifié ne doit pas être accordé silencieusement");
assert.match(html, /id="event-dismiss"/, "une perturbation doit pouvoir être ignorée");
assert.match(app, /dismissPendingEvent/, "l'action Ignorer doit masquer la perturbation sans lancer de questions");
assert.match(app, /requestSessionExit/, "fermer un entraînement doit proposer une sortie réelle");
assert.match(app, /quit-session/, "quitter un entraînement doit nécessiter une confirmation");
assert.match(app, /abandonLearningSession/, "une session abandonnée ne doit pas reprendre automatiquement");
assert.match(styles, /\.event-card[^}]*pointer-events:\s*none/, "le bandeau ne doit pas intercepter les clics destinés à l'interface");
assert.match(styles, /\.event-card button[^}]*pointer-events:\s*auto/, "les actions propres au bandeau doivent rester cliquables");
assert.match(app, /workshopReveal/, "les ateliers doivent être révélés progressivement");
assert.match(app, /Ateliers suivants \+/, "le bonus sortant doit être nommé explicitement");
assert.match(app, /supportDetails[^]*% paliers[^]*% maîtrise/, "le bonus sortant doit distinguer les paliers de la maîtrise");
assert.match(app, /index < lastAccessibleWorkshopIndex/, "le dernier atelier accessible ne doit pas annoncer de bonus sortant");
assert.doesNotMatch(app, /Passerelle \+\$\{/, "le terme ambigu « Passerelle » ne doit plus être affiché");
assert.match(html, /id="speciality-gate"[^>]*hidden/, "le passage vers la spécialité doit être invisible avant son éligibilité");
assert.match(html, /id="speciality-dialog"/, "la révélation de la spécialité doit disposer d'une fenêtre spectaculaire");
assert.doesNotMatch(html, /Spécialité\s*:\s*0\//, "aucun compteur ne doit divulguer le secteur verrouillé");
assert.match(app, /specialityRequirements/, "les 100 unités et 200 points doivent être contrôlés avant la révélation");
assert.match(app, /accessibleSubskills/, "les compteurs pédagogiques doivent exclure la spécialité tant qu'elle est verrouillée");
assert.match(app, /coreSkills/, "le mode épreuve anticipée doit rester limité aux douze ateliers initiaux");
assert.match(styles, /@keyframes speciality-reveal/, "l'ouverture du nouveau secteur doit être mise en scène");
assert.match(styles, /#event-next:not\(\[hidden\]\)[^]*position:\s*fixed/, "l'action de fin d'intervention doit rester visible");
assert.match(html, /id="reset-mobile-button"/, "la réinitialisation doit être disponible dans l'onglet Réseau sur mobile");
assert.match(html, /id="export-save-button"/, "la partie doit pouvoir être exportée depuis la version ordinateur");
assert.match(html, /id="import-save-button"/, "une partie exportée doit pouvoir être importée depuis la version ordinateur");
assert.match(html, /id="import-save-file"[^>]*accept="application\/json,.json"/, "l'import doit limiter le sélecteur aux fichiers de sauvegarde JSON");
assert.match(app, /SAVE_EXPORT_FORMAT/, "les exports doivent employer un format explicitement identifié");
assert.match(app, /prepareImport/, "les fichiers importés doivent être validés avant de remplacer la partie");
assert.match(app, /Remplacer la partie actuelle/, "l'import doit demander confirmation avant d'écraser la sauvegarde locale");
assert.equal((html.match(/id="calibration-open-upgrades"/g) || []).length, 1, "les protocoles permanents doivent avoir un seul point d'accès");
assert.doesNotMatch(html, /calibration-open-network|id="calibration-open"/, "les protocoles ne doivent pas être dupliqués dans le Réseau ou la barre de cycle");
assert.match(html, /Diagnostic · 12 questions/, "le diagnostic adaptatif doit être accessible");
assert.match(html, /Automatismes épreuve · 12 QCM/, "le mode automatismes de l'épreuve doit être accessible");
assert.match(app, /recordAnswer/, "chaque réponse doit alimenter le modèle d'apprentissage");
assert.match(app, /startLearningSession/, "les parcours ciblés doivent être câblés");
assert.match(html, /id="milestone-bulk-button"/, "l'achat jusqu'au prochain palier doit avoir une commande dédiée");
assert.match(app, /syncBulkSelection/, "le mode d'achat affiché et le mode réellement utilisé doivent rester synchronisés");
assert.match(app, /MAX · ×/, "un achat MAX limité à une unité doit rester identifié comme un achat MAX");
assert.match(html, /id="mistake-button"/, "le carnet d'erreurs doit être accessible depuis le parcours adaptatif");
assert.match(learning, /remedialAt/, "une erreur doit programmer une reprise différée");
assert.match(learning, /stageFor/, "les niveaux de consolidation doivent être calculés");
assert.match(html, /Programme de première technologique 2026/, "le dialogue de couverture 2026 doit être présent");
assert.match(html, /0\/12/, "les douze ateliers doivent être annoncés dès le chargement");
assert.match(serviceWorker, /event\.request\.mode === "navigate"/, "les navigations de l'application installée doivent être actualisées en priorité");
assert.match(serviceWorker, /cache: "reload"/, "le cache HTTP ne doit pas masquer les mises à jour installées");
assert.match(serviceWorker, /origin !== self\.location\.origin/, "les requêtes vers l'horloge UTC ne doivent pas être mises en cache");
assert.match(exerciseLabHtml, /Laboratoire des exerciseurs/, "la page autonome de contrôle des exerciseurs doit exister");
assert.match(exerciseLabHtml, /noindex, nofollow/, "la page de contrôle ne doit pas être proposée aux moteurs de recherche");
assert.match(exerciseLabHtml, /maximum-scale=1/, "le laboratoire doit désactiver le zoom par pincement");
assert.match(exerciseLabHtml, /user-scalable=no/, "le laboratoire doit verrouiller le niveau de zoom tactile");
assert.doesNotMatch(html, /exerciseurs/, "le jeu ne doit pas encore contenir de lien vers le laboratoire des exerciseurs");
assert.match(exerciseLabApp, /Engine\.SUBSKILLS/, "le laboratoire doit énumérer automatiquement tous les exerciseurs du jeu");
assert.match(exerciseLabApp, /Engine\.generateForKinds/, "le laboratoire doit utiliser le même générateur que le jeu");
assert.match(exerciseLabApp, /copyDiagnostic/, "le laboratoire doit permettre de copier le diagnostic d'une question");
assert.match(exerciseLabApp, /gesturestart/, "le laboratoire doit bloquer les gestes de zoom Safari");
assert.match(exerciseLabApp, /isDoubleTap/, "le laboratoire doit neutraliser le zoom par double tap");
assert.match(exerciseLabApp, /selectstart/, "le laboratoire doit bloquer la sélection de texte");
assert.match(exerciseLabApp, /format \$\{related\.indexOf\(subskill\) \+ 1\}/, "les formats homonymes doivent être numérotés en français");
assert.doesNotMatch(exerciseLabApp, /\$\{subskill\.label\} — \$\{subskill\.id\}/, "les identifiants techniques anglais ne doivent pas apparaître dans le sélecteur");
assert.match(exerciseLabStyles, /\.math-radicand[^}]*border-top/, "le laboratoire doit partager le rendu complet des racines");
assert.match(exerciseLabStyles, /\.math-fraction[^}]*grid-template-rows/, "le laboratoire doit partager le rendu des fractions");
assert.match(exerciseLabStyles, /\.math-vector::before[^}]*content:\s*"→"/, "le laboratoire doit partager le rendu des vecteurs");

const manifest = JSON.parse(manifestText);
assert.equal(manifest.display, "standalone", "le jeu installé doit s'ouvrir en mode autonome");
assert.deepEqual(manifest.icons.map(icon => icon.sizes), ["192x192", "512x512"]);
for (const icon of manifest.icons) assert.ok(serviceWorker.includes(icon.src), `${icon.src} doit être disponible hors ligne`);
await Promise.all([
  ...manifest.icons.map(icon => icon.src),
  "assets/apple-touch-icon.png",
  "assets/favicon-64.png"
].map(path => access(new URL(`../${path}`, import.meta.url))));

console.log(`${requiredIds.length} liaisons d'interface et la structure statique validées.`);
