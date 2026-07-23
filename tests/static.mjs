import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [html, app, styles, manifestText, serviceWorker] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../styles.css", import.meta.url), "utf8"),
  readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8")
]);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
assert.equal(ids.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "les identifiants HTML doivent être uniques");

const requiredIds = [...app.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]);
for (const id of requiredIds) assert.ok(ids.has(id), `élément #${id} manquant dans index.html`);

assert.match(html, /question-engine\.js[^]*game-model\.js[^]*app\.js/, "les scripts doivent être chargés dans le bon ordre");
assert.match(html, /viewport-fit=cover/, "la vue mobile doit être configurée");
assert.match(html, /maximum-scale=1/, "le zoom par pincement doit être désactivé");
assert.match(html, /user-scalable=no/, "le zoom tactile doit être verrouillé");
assert.match(styles, /touch-action:\s*pan-x pan-y/, "le défilement doit rester autorisé sans zoom tactile");
assert.match(styles, /user-select:\s*none/, "la sélection de texte doit être désactivée");
assert.match(html, /rel="manifest"/, "le manifeste d'installation doit être relié");
assert.match(html, /rel="apple-touch-icon"/, "l'icône iPhone doit être reliée");
assert.match(app, /serviceWorker\.register/, "le service worker doit être enregistré");
assert.match(app, /AudioContext/, "les bruitages doivent être générés par le navigateur");
assert.match(app, /gesturestart/, "les gestes de pincement iOS doivent être bloqués explicitement");
assert.match(app, /touches\.length > 1/, "les mouvements à plusieurs doigts doivent être bloqués");
assert.match(app, /isDoubleTap/, "le double tap iOS doit être intercepté sans bloquer le défilement");
assert.match(app, /questionReports/, "les questions signalées doivent être mémorisées localement");
assert.match(app, /buyWorkshopUpgrade/, "les améliorations d'atelier doivent être achetables");
assert.match(app, /buyCalibrationUpgrade/, "les points d'étalonnage doivent financer des améliorations permanentes");
assert.match(app, /createProgrammeCoverage/, "la grille du programme 2026 doit être affichée dans le jeu");
assert.match(app, /renderQuestionCanvases/, "les lectures graphiques doivent être dessinées dans le navigateur");
assert.equal((html.match(/role="tab"/g) || []).length, 4, "quatre onglets doivent séparer le noyau, les ateliers, les améliorations et le réseau");
assert.match(app, /EVENT_WINDOW_MS/, "les perturbations doivent avoir une durée de disponibilité limitée");
assert.match(app, /workshopReveal/, "les ateliers doivent être révélés progressivement");
assert.match(styles, /#event-next:not\(\[hidden\]\)[^]*position:\s*fixed/, "l'action de fin d'intervention doit rester visible");
assert.match(html, /Programme de première technologique 2026/, "le dialogue de couverture 2026 doit être présent");
assert.match(html, /0\/12/, "les douze ateliers doivent être annoncés dès le chargement");
assert.match(serviceWorker, /event\.request\.mode === "navigate"/, "les navigations de l'application installée doivent être actualisées en priorité");
assert.match(serviceWorker, /cache: "reload"/, "le cache HTTP ne doit pas masquer les mises à jour installées");

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
