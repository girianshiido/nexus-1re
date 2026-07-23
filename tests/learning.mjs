import assert from "node:assert/strict";
import learning from "../learning-model.js";
import engine from "../question-engine.js";

const start = Date.UTC(2026, 6, 23, 10);
let record = learning.freshRecord();
assert.equal(learning.stageFor(record, start), "discovery", "une notion jamais vue doit être à découvrir");

record = learning.recordAnswer(record, false, 1, start, () => 0);
assert.equal(learning.stageFor(record, start), "fragile", "une erreur doit rendre l'acquis fragile");
assert.equal(record.remedialAt, 3, "la reprise doit arriver après deux autres questions au minimum");
assert.ok(learning.priority(record, 3, start) >= 120, "une reprise arrivée à échéance doit passer en priorité");

record = learning.recordAnswer(record, true, 3, start + 1000, () => 0);
record = learning.recordAnswer(record, true, 6, start + 2000, () => 0);
record = learning.recordAnswer(record, true, 9, start + 3000, () => 0);
record = learning.recordAnswer(record, true, 12, start + 4000, () => 0);
assert.equal(learning.stageFor(record, start + 4000), "mastered", "plusieurs réussites espacées doivent consolider la notion");
assert.equal(learning.stageFor(record, record.nextDue + 1), "review", "une notion consolidée doit revenir à échéance");

const instant = learning.recordAnswer(learning.freshRecord(), true, 1, start, () => 0);
const instantAgain = learning.recordAnswer(instant, true, 1, start + 50, () => 0);
assert.ok(instantAgain.stability < 2, "répéter instantanément ne doit pas valoir deux consolidations espacées");

assert.equal(Object.keys(engine.KIND_GENERATORS).length, engine.SUBSKILLS.length, "chaque format généré doit avoir une sous-compétence");
for (const subskill of engine.SUBSKILLS) {
  assert.ok(engine.SKILLS[subskill.skill], `${subskill.id}: atelier inconnu`);
  assert.ok(subskill.label, `${subskill.id}: libellé pédagogique manquant`);
  const question = engine.generateForKinds([subskill.id]);
  assert.equal(question.kind, subskill.id, `${subskill.id}: le ciblage doit conserver le format demandé`);
}

const allSummary = learning.summarize(engine.SUBSKILLS, {}, start);
assert.equal(allSummary.discovery, engine.SUBSKILLS.length, "toutes les notions doivent commencer en découverte");

console.log(`${engine.SUBSKILLS.length} sous-compétences et la reprise espacée validées.`);
