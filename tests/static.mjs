import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [html, app, manifestText, serviceWorker] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  readFile(new URL("../service-worker.js", import.meta.url), "utf8")
]);

const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
assert.equal(ids.size, [...html.matchAll(/\bid="([^"]+)"/g)].length, "les identifiants HTML doivent être uniques");

const requiredIds = [...app.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]);
for (const id of requiredIds) assert.ok(ids.has(id), `élément #${id} manquant dans index.html`);

assert.match(html, /question-engine\.js[^]*game-model\.js[^]*app\.js/, "les scripts doivent être chargés dans le bon ordre");
assert.match(html, /viewport-fit=cover/, "la vue mobile doit être configurée");
assert.match(html, /rel="manifest"/, "le manifeste d'installation doit être relié");
assert.match(html, /rel="apple-touch-icon"/, "l'icône iPhone doit être reliée");
assert.match(app, /serviceWorker\.register/, "le service worker doit être enregistré");
assert.match(app, /AudioContext/, "les bruitages doivent être générés par le navigateur");

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
