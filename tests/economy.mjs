import assert from "node:assert/strict";
import model from "../game-model.js";

assert.equal(model.WORKSHOPS.length, 18, "douze ateliers initiaux et six ateliers de spécialité sont attendus");
assert.deepEqual(model.WORKSHOPS.slice(0, model.CORE_WORKSHOP_COUNT).map(item => item.id), [
  "proportions", "numeric", "evolutions", "units", "logic", "algebra",
  "functions", "sequences", "derivatives", "statistics", "probability", "algorithmics"
]);
assert.deepEqual(model.WORKSHOPS.slice(model.CORE_WORKSHOP_COUNT).map(item => item.id), [
  "trigonometry", "sinusoids", "vectors", "complexAlgebra", "complexTrig", "advancedAnalysis"
]);

for (const workshop of model.WORKSHOPS) {
  assert.ok(model.workshopCost(workshop.id, 1) > model.workshopCost(workshop.id, 0), `${workshop.id}: le coût doit croître`);
  assert.ok(model.workshopProduction(workshop.id, 2, 0, 0) > model.workshopProduction(workshop.id, 1, 0, 0), `${workshop.id}: la production doit croître`);
  assert.ok(model.workshopProduction(workshop.id, 1, 10) > model.workshopProduction(workshop.id, 1, 0), `${workshop.id}: la maîtrise doit renforcer la production`);
  model.MILESTONES.forEach((milestone, level) => {
    const productionBefore = model.workshopProduction(workshop.id, milestone, 0, level);
    const cost = model.workshopUpgradeCost(workshop.id, level);
    const seconds = (workshop.speciality ? model.SPECIALITY_UPGRADE_SECONDS : model.WORKSHOP_UPGRADE_SECONDS)[level];
    const target = productionBefore * seconds;
    assert.ok(Math.abs(cost - target) <= Math.max(1, target * 1e-12), `${workshop.id}: le prix de palier doit correspondre au temps de production visé`);
  });
}

assert.equal(model.milestoneMultiplier(9, 0), 1);
assert.equal(model.milestoneMultiplier(10, 0), 1, "un palier ne doit plus donner un bonus gratuit");
assert.equal(model.milestoneMultiplier(10, 1), 2, "la première amélioration achetée doit doubler la production");
assert.equal(model.milestoneMultiplier(25, 2), 4);
assert.equal(model.milestoneMultiplier(10, 1, "trigonometry"), 3, "la première amélioration de spécialité doit être un ×3");
assert.equal(model.milestoneMultiplier(25, 2, "complexTrig"), 20, "les améliorations de spécialité doivent utiliser des facteurs plus lourds");
assert.equal(model.nextMilestone(25), 50);
assert.equal(model.workshopUpgradeStatus("proportions", 9, 0).unlocked, false);
assert.equal(model.workshopUpgradeStatus("proportions", 10, 0).unlocked, true);
assert.ok(model.workshopUpgradeCost("proportions", 1) > model.workshopUpgradeCost("proportions", 0));

const quote = model.purchaseQuote("proportions", 0, 10, 100);
assert.ok(quote.quantity > 1 && quote.quantity < 10, "l'achat groupé doit prendre la quantité abordable");
assert.ok(quote.cost <= 100, "l'achat groupé ne doit jamais dépasser le flux disponible");
const twoUnitBudget = model.workshopCost("proportions", 0) + model.workshopCost("proportions", 1);
assert.equal(model.purchaseQuote("proportions", 0, "max", twoUnitBudget).quantity, 2, "MAX doit acheter toutes les unités abordables");
assert.equal(model.purchaseQuote("proportions", 0, "MAX", twoUnitBudget).quantity, 2, "le mode MAX importé doit être normalisé sans revenir à ×1");
assert.equal(model.normalizePurchaseMode("inconnu"), "1", "un ancien mode invalide doit revenir explicitement à ×1");
assert.deepEqual(
  model.purchaseQuote("proportions", 7, "milestone", Infinity).quantity,
  3,
  "le planificateur doit acheter exactement jusqu'au prochain palier"
);

const workshops = Object.fromEntries(model.WORKSHOPS.map(item => [item.id, 0]));
workshops.proportions = 10;
assert.ok(Math.abs(model.baseProduction(workshops, {}) - 1.8) < 1e-9, "le palier seul ne doit pas doubler la production");
assert.ok(Math.abs(model.baseProduction(workshops, {}, { proportions: 1 }) - 3.6) < 1e-9, "l'amélioration de palier doit doubler la production");
assert.ok(model.clickGain(250, workshops, 1) > model.clickGain(0, {}, 0), "les clics, le réseau et l'étalonnage doivent renforcer le noyau");

workshops.numeric = 10;
const synergyAtTen = model.workshopSynergyMultiplier("numeric", workshops, {});
workshops.proportions = 25;
const synergyAtTwentyFive = model.workshopSynergyMultiplier("numeric", workshops, {});
assert.ok(synergyAtTen > 1, "un ancien atelier au palier doit renforcer les ateliers suivants");
assert.ok(synergyAtTwentyFive > synergyAtTen, "chaque nouveau palier doit renforcer les ateliers suivants");
assert.equal(model.workshopSynergyMultiplier("proportions", workshops, {}), 1, "le premier atelier ne reçoit pas de renfort antérieur");
assert.ok(
  model.workshopSupportBonus("algorithmics", 100, 0) > 0,
  "la Console algorithmique doit pouvoir renforcer le secteur de spécialité"
);
assert.equal(
  model.workshopSupportBonus(model.WORKSHOPS.at(-1).id, 200, 100),
  0,
  "le dernier atelier ne doit annoncer aucun renfort vers un atelier inexistant"
);
assert.ok(
  model.clickGain(0, workshops, 5, {}, 1_000_000) >= 250_000,
  "le clic doit rester proportionnel à la production avancée"
);

const baseHyper = model.hyperStats({});
const advancedHyper = model.hyperStats({ hyperPower: 2, hyperStability: 2, hyperDuration: 2, hyperPulses: 2 });
assert.equal(baseHyper.multiplier, 2, "l'Hypercadence doit commencer à ×2");
assert.equal(baseHyper.pulsesPerSecond, 1, "une seule impulsion automatique doit être active au départ");
assert.ok(advancedHyper.multiplier > baseHyper.multiplier);
assert.ok(advancedHyper.decayPerSecond < baseHyper.decayPerSecond);
assert.ok(advancedHyper.durationMs > baseHyper.durationMs);
assert.ok(model.decayHyperCharge(20, 500, 1, {}) === 20, "la charge ne doit pas baisser immédiatement");
assert.ok(model.decayHyperCharge(20, 1500, 1, {}) < 20, "la charge doit baisser après l'arrêt des clics");

const calibrationLevels = { hyperPower: 2, corePower: 1 };
assert.equal(model.calibrationSpent(calibrationLevels), 4);
assert.equal(model.availableCalibration(7, calibrationLevels), 3);
assert.ok(model.clickGain(0, {}, 0, { corePower: 1 }) > model.clickGain(0, {}, 0, {}));
for (const upgrade of model.CALIBRATION_UPGRADES) {
  assert.ok(upgrade.costs.length >= (upgrade.protocol ? 1 : 4), `${upgrade.id}: au moins un niveau permanent est attendu`);
  assert.ok(upgrade.costs.every((cost, index) => index === 0 || cost >= upgrade.costs[index - 1]), `${upgrade.id}: les coûts doivent croître`);
}
const comfort = model.comfortStats({
  milestonePlanner: 1,
  fluxReserve: 2,
  autoUpgrades: 1,
  errorNotebook: 1,
  eventBeacon: 2
});
assert.equal(comfort.milestonePlanner, true);
assert.equal(comfort.autoUpgrades, true);
assert.equal(comfort.errorNotebook, true);
assert.equal(comfort.reserveSeconds, 90);
assert.equal(comfort.eventWindowMs, 60000);

const specialityWorkshops = Object.fromEntries(model.WORKSHOPS.map(item => [item.id, 0]));
let specialityRequirements = model.specialityRequirements(specialityWorkshops, 500, {});
assert.equal(specialityRequirements.met, false, "les points seuls ne doivent pas révéler la spécialité");
model.WORKSHOPS.slice(0, model.CORE_WORKSHOP_COUNT).forEach(workshop => { specialityWorkshops[workshop.id] = 100; });
specialityRequirements = model.specialityRequirements(specialityWorkshops, 199, {});
assert.equal(specialityRequirements.met, false, "199 points ne doivent pas suffire");
specialityRequirements = model.specialityRequirements(specialityWorkshops, 200, {});
assert.equal(specialityRequirements.met, true, "100 unités dans chaque atelier et 200 points doivent ouvrir le passage");
assert.equal(model.specialityUnlocked({ specialityAccess: 1 }), true);
assert.equal(model.availableCalibration(200, { specialityAccess: 1 }), 0, "l'ouverture doit dépenser les 200 points disponibles");
assert.ok(
  model.workshopCost("trigonometry", 0) > model.workshopCost("algorithmics", 100),
  "le premier atelier de spécialité doit être sensiblement plus difficile à atteindre"
);

assert.equal(model.cycleTarget(0), 50000, "le premier point doit demander 50 000 flux cumulés");
assert.equal(model.calibrationPotential(854810000), 25, "855 millions de flux ne doivent plus produire une centaine de points");
assert.equal(model.cycleGain(854810000, 0), 25);
assert.equal(model.cycleGain(854810000, 5), 20, "les points déjà obtenus ne doivent pas être gagnés une seconde fois");
assert.equal(model.cycleGain(854810000, 25), 0);
assert.equal(model.cycleProgress(0, 0), 0);
assert.equal(model.cycleProgress(model.cycleTarget(0), 0), 1);

let frequentCalibration = 0;
for (let point = 1; point <= 10; point += 1) {
  const lifetimeFlux = model.CALIBRATION_FLUX_BASE * point ** model.CALIBRATION_FLUX_EXPONENT;
  frequentCalibration += model.cycleGain(lifetimeFlux, frequentCalibration);
}
const delayedFlux = model.CALIBRATION_FLUX_BASE * 10 ** model.CALIBRATION_FLUX_EXPONENT;
const delayedCalibration = model.cycleGain(delayedFlux, 0);
assert.equal(frequentCalibration, delayedCalibration, "redémarrer souvent ou tard doit donner le même capital à production cumulée égale");
assert.equal(
  model.calibrationPotential(model.CALIBRATION_FLUX_BASE * 200 ** model.CALIBRATION_FLUX_EXPONENT),
  200
);
assert.match(model.formatCompactNumber(1e12), /^1\sBn$/);
assert.match(model.formatCompactNumber(1e15), /^1\sBd$/, "un billiard ne doit pas être affiché comme 1 000 billions");
assert.match(model.formatCompactNumber(1e18), /^1\sTn$/, "le trillion doit suivre le billiard");
assert.match(model.formatCompactNumber(1e21), /^1\sTd$/);
assert.match(model.formatCompactNumber(1e30), /^1\sQi$/);
assert.doesNotMatch(model.formatCompactNumber(1e15), /1000\s*Bn/);
assert.equal(model.formatCompactNumber(1e63), "1 e63", "au-delà des unités nommées, la notation d'ingénieur doit prendre le relais");

const minimumCoreFlux = model.WORKSHOPS
  .slice(0, model.CORE_WORKSHOP_COUNT)
  .reduce((total, workshop) => total + Array.from({ length: 100 }, (_, owned) => model.workshopCost(workshop.id, owned))
    .reduce((workshopTotal, cost) => workshopTotal + cost, 0), 0);
assert.ok(
  model.calibrationPotential(minimumCoreFlux) >= 400,
  "les 100 unités des douze ateliers doivent naturellement dépasser le prix du secteur de spécialité"
);
assert.equal(model.permanentMultiplier(5), 2);

console.log("Économie, paliers, clics et cycles validés.");
