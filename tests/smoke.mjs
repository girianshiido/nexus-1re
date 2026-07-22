import assert from "node:assert/strict";
import engine from "../question-engine.js";

const worlds = ["energy", "factory", "data"];

for (const world of worlds) {
  for (let i = 0; i < 300; i += 1) {
    const question = engine.generate(world, {});
    assert.ok(question.prompt.length > 10, `${world}: énoncé manquant`);
    assert.equal(question.choices.length, 4, `${world}: quatre choix attendus`);
    assert.equal(new Set(question.choices).size, 4, `${world}: choix dupliqués`);
    assert.ok(question.answer >= 0 && question.answer < 4, `${world}: index de réponse invalide`);
    assert.ok(question.explanation.length > 10, `${world}: correction manquante`);
    assert.ok(engine.SKILLS[question.skill], `${world}: compétence inconnue`);
    assert.ok(question.kind, `${world}: format de question manquant`);
  }
}

assert.equal(engine.affineExpression(-2, 0), "-2x", "le terme constant nul doit être omis");
assert.equal(engine.affineExpression(3, 5), "3x + 5", "le terme constant non nul doit rester visible");
assert.equal(engine.linearFactor(0), "x", "le facteur x + 0 doit être simplifié en x");
assert.equal(engine.linearFactor(5), "(x + 5)", "un facteur non nul doit rester entre parenthèses");

const affineRandomValues = [0, 0.5, 0.5];
const affineWithZero = engine.SKILL_GENERATORS.functions[1](() => affineRandomValues.shift() ?? 0.5);
assert.match(affineWithZero.prompt, /f\(x\) = -4x\./, "la fonction affine ne doit pas afficher + 0");

const productRandomValues = [0.86, 0.5];
const productWithZero = engine.GENERATORS.factory[0](() => productRandomValues.shift() ?? 0.5);
assert.match(productWithZero.prompt, /Résoudre x\(x \+ 5\) = 0\./, "le facteur x + 0 doit être écrit x et placé en premier");

const symmetricProductRandomValues = [0.9, 0.1, 0.5, 0.5, 0.5];
const symmetricProduct = engine.GENERATORS.factory[0](() => symmetricProductRandomValues.shift() ?? 0.5);
assert.match(symmetricProduct.prompt, /Résoudre \(x \+ 5\)\(x − 5\) = 0\./, "le produit symétrique doit être généré");
const normalizePair = choice => {
  const pair = choice.match(/^x = (-?\d+) ou x = (-?\d+)$/);
  return pair ? pair.slice(1).map(Number).sort((a, b) => a - b).join("|") : choice;
};
assert.equal(new Set(symmetricProduct.choices.map(normalizePair)).size, 4, "les solutions inversées ne doivent pas être proposées deux fois");

const conversionRandomValues = [0.9, 0.3, 0, 0.5, 0.5, 0.5];
const preciseConversion = engine.SKILL_GENERATORS.units[0](() => conversionRandomValues.shift() ?? 0.5);
assert.equal(preciseConversion.prompt, "Convertir 0,0005 km en cm.", "une petite mesure ne doit pas être arrondie dans l'énoncé");
assert.equal(preciseConversion.choices[preciseConversion.answer], "50 cm", "0,0005 km doit correspondre à 50 cm");

let randomSeed = 123456789;
const seededRandom = () => {
  randomSeed = (1664525 * randomSeed + 1013904223) >>> 0;
  return randomSeed / 2 ** 32;
};
const conditionalVariants = new Set();
for (let i = 0; i < 500; i += 1) {
  const question = engine.GENERATORS.data[1](seededRandom);
  const byLine = question.prompt.match(/parmi les pièces de la ligne ([AB]).*soit (conforme|non conforme)/);
  const byStatus = question.prompt.match(/parmi les pièces (conformes|non conformes).*ligne ([AB])/);
  if (byLine) conditionalVariants.add(`ligne-${byLine[1]}-${byLine[2]}`);
  if (byStatus) conditionalVariants.add(`statut-${byStatus[1]}-${byStatus[2]}`);
}
assert.equal(conditionalVariants.size, 8, "les huit formulations du tableau conditionnel doivent être générées");

for (const world of worlds) {
  const recentKeys = [];
  const recentKinds = [];
  for (let i = 0; i < 150; i += 1) {
    const question = engine.generate(world, {}, Math.random, {
      keys: recentKeys,
      kinds: recentKinds
    });
    const key = engine.fingerprint(question);
    assert.ok(!recentKeys.includes(key), `${world}: répétition stricte dans la fenêtre récente`);
    assert.ok(!recentKinds.includes(question.kind), `${world}: format répété trop tôt`);
    recentKeys.push(key);
    recentKinds.push(question.kind);
    if (recentKeys.length > 12) recentKeys.shift();
    if (recentKinds.length > 2) recentKinds.shift();
  }
}

for (let i = 0; i < 500; i += 1) {
  const question = engine.GENERATORS.factory[0]();
  assert.equal(new Set(question.choices.map(normalizePair)).size, 4, "une équation produit ne doit jamais avoir deux choix équivalents");
}

for (const skill of Object.keys(engine.SKILL_GENERATORS)) {
  for (let i = 0; i < 100; i += 1) {
    const question = engine.generateForSkills([skill], {});
    assert.equal(question.skill, skill, `${skill}: la question doit venir de la notion achetée`);
    assert.equal(question.choices.length, 4, `${skill}: quatre choix attendus`);
    assert.equal(new Set(question.choices).size, 4, `${skill}: choix dupliqués`);
  }
}

console.log("1800 questions générées et validées.");
