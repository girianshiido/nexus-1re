import assert from "node:assert/strict";

import { simulateProgression } from "../scripts/simulate-progression.mjs";

const report = simulateProgression("regulier");
const speciality = report.milestones.find(milestone => milestone.type === "speciality");
const advancedAnalysis = report.milestones.find(milestone => milestone.id === "advancedAnalysis");

assert.equal(report.completed, true, "un joueur régulier doit pouvoir achever la progression économique simulée");
assert.ok(speciality, "le secteur Spécialité doit être atteint dans la simulation");
assert.ok(speciality.seconds >= 4 * 3600 && speciality.seconds <= 9 * 3600, "la Spécialité doit rester un objectif de plusieurs heures");
assert.ok(advancedAnalysis, "le dernier atelier doit être débloqué avant la fin économique");
assert.ok(advancedAnalysis.seconds > speciality.seconds, "les ateliers de Spécialité doivent se débloquer après l'ouverture du secteur");
assert.ok(report.elapsed >= 24 * 3600 && report.elapsed <= 60 * 3600, "la progression complète régulière doit viser environ 25 à 60 heures effectives");
assert.ok(report.cycles >= 30 && report.cycles <= 60, "les cycles doivent rester fréquents sans devenir innombrables");

console.log(`Progression régulière validée en ${(report.elapsed / 3600).toFixed(1)} h et ${report.cycles} cycles.`);

