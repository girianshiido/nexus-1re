import assert from "node:assert/strict";

import model from "../game-model.js";

const cycle14Target = model.cycleTarget(0, 14);
const cycle14Reward = model.cycleReward(14);

assert.equal(cycle14Reward, 14, "le cycle 14 doit rapporter exactement 14 points");
assert.equal(model.cumulativeCycleReward(14), 105, "les gains de cycle doivent suivre la somme 1 + 2 + ... + n");
assert.ok(cycle14Target > model.cycleTarget(0, 1), "les seuils doivent devenir plus exigeants avec les cycles");
assert.equal(model.cycleGain(cycle14Target, 0, 14), cycle14Reward, "atteindre le seuil doit fixer la récompense du cycle");
assert.equal(
  model.cycleGain(cycle14Target * 500, 0, 14),
  cycle14Reward,
  "un dépassement massif du seuil ne doit jamais remplir plusieurs fois la barre"
);
assert.equal(model.cycleProgress(cycle14Target * 500, 0, 14), 1, "la barre doit rester simplement pleine après le seuil");

const cycle20Total = model.cumulativeCycleReward(20);
assert.ok(cycle20Total >= model.SPECIALITY_UNLOCK_COST, "les 200 points de spécialité doivent rester atteignables par les cycles progressifs");

console.log("Progression des cycles verrouillée et validée.");
