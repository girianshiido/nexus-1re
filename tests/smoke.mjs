import assert from "node:assert/strict";
import engine from "../question-engine.js";

const worlds = ["energy", "factory", "data"];
let validatedQuestions = 0;

for (const world of worlds) {
  for (let i = 0; i < 500; i += 1) {
    const question = engine.generate(world, {});
    assert.ok(engine.validateQuestion(question).valid, `${world}: ${engine.validateQuestion(question).errors.join(", ")}`);
    validatedQuestions += 1;
    assert.ok(question.prompt.length > 10, `${world}: énoncé manquant`);
    assert.equal(question.choices.length, 4, `${world}: quatre choix attendus`);
    assert.equal(new Set(question.choices.map(engine.canonicalChoice)).size, 4, `${world}: choix équivalents`);
    assert.ok(question.answer >= 0 && question.answer < 4, `${world}: index de réponse invalide`);
    assert.ok(question.explanation.length > 10, `${world}: correction manquante`);
    assert.ok(engine.SKILLS[question.skill], `${world}: compétence inconnue`);
    assert.ok(question.kind, `${world}: format de question manquant`);
  }
}

assert.equal(engine.affineExpression(-2, 0), "-2x", "le terme constant nul doit être omis");
assert.equal(engine.affineExpression(3, 5), "3x + 5", "le terme constant non nul doit rester visible");
assert.equal(engine.affineExpression(1, -2), "x − 2", "le coefficient 1 ne doit pas être affiché devant x");
assert.equal(engine.affineExpression(-1, 0), "−x", "le coefficient -1 doit être écrit avec un simple signe moins");
assert.equal(engine.linearFactor(0), "x", "le facteur x + 0 doit être simplifié en x");
assert.equal(engine.linearFactor(5), "(x + 5)", "un facteur non nul doit rester entre parenthèses");
const lineEquation = engine.SKILL_GENERATORS.functions[2](() => 0.5);
assert.match(lineEquation.prompt, /équation réduite/, "la lecture graphique doit demander une équation réduite");
assert.ok(lineEquation.choices.every(choice => choice.startsWith("y = ")), "une équation réduite de droite doit être écrite sous la forme y = ax + b");
const variationQuestion = engine.SKILL_GENERATORS.functions[7](Math.random);
assert.match(variationQuestion.visual, /<svg class="variation-svg"/, "un tableau de variations doit utiliser un dessin vectoriel");
assert.match(variationQuestion.visual, /marker-end="url\(#variation-arrow-/, "les variations doivent être représentées par de vraies flèches");
assert.match(variationQuestion.visual, /x="221"/, "la valeur centrale doit être éloignée de la pointe de flèche");
assert.equal(engine.canonicalChoice("1/2"), engine.canonicalChoice("2/4"), "les fractions équivalentes doivent être reconnues");
const ratioQuestion = engine.SKILL_GENERATORS.proportions[1](Math.random);
assert.equal(ratioQuestion.kind, "ratio-comparison", "le ratio doit comparer deux quantités comme dans le programme de seconde 2026");
assert.doesNotMatch(ratioQuestion.prompt, /partag/i, "le jeu ne doit pas élargir le ratio à un partage non explicité dans la capacité officielle");

const affineRandomValues = [0, 0.5, 0.5];
const affineWithZero = engine.SKILL_GENERATORS.functions[1](() => affineRandomValues.shift() ?? 0.5);
assert.match(affineWithZero.prompt, /f\(x\) = -4x\./, "la fonction affine ne doit pas afficher + 0");

const explicitSequenceWithOne = engine.SKILL_GENERATORS.sequences[1](() => 0);
assert.match(explicitSequenceWithOne.prompt, /uₙ = 2ⁿ/, "un coefficient 1 doit être omis devant une puissance");
assert.doesNotMatch(explicitSequenceWithOne.prompt, /1 ×/, "aucune multiplication par 1 ne doit être affichée");

const scientificQuestion = engine.SKILL_GENERATORS.numeric[2](() => 0);
assert.ok(scientificQuestion.choices.some(choice => /^20 × 10/.test(choice)), "la notation scientifique doit proposer une écriture équivalente mais non normalisée");

const totalProbabilityQuestion = engine.SKILL_GENERATORS.probability[2](() => 0);
assert.doesNotMatch(totalProbabilityQuestion.prompt, /P\(B \|/, "les probabilités conditionnelles ne doivent pas contenir d'espace interne fragile");
const dataFilterQuestion = engine.SKILL_GENERATORS.algorithmics[4](() => 0);
assert.match(dataFilterQuestion.prompt, /colonnes/, "un tableau horizontal de capteurs doit parler de colonnes");

const developFamilies = new Set();
for (let i = 0; i < 300; i += 1) {
  const question = engine.SKILL_GENERATORS.algebra[1](Math.random);
  if (/\(x \+ \d+\)\(x − \d+\)/.test(question.prompt)) developFamilies.add("product");
  else if (/\) \+ \d+x\./.test(question.prompt)) developFamilies.add("reduction");
  else developFamilies.add("simple");
}
assert.deepEqual([...developFamilies].sort(), ["product", "reduction", "simple"], "les développements doivent couvrir trois familles complémentaires");

for (const [label, generator] of [
  ["signe affine", engine.SKILL_GENERATORS.algebra[3]],
  ["signe produit", engine.SKILL_GENERATORS.algebra[4]],
  ["signe graphique", engine.SKILL_GENERATORS.functions[4]]
]) {
  const signsAsked = new Set();
  for (let i = 0; i < 300; i += 1) {
    const question = generator(Math.random);
    signsAsked.add(question.prompt.includes("strictement négative") ? "negative" : "positive");
  }
  assert.deepEqual([...signsAsked].sort(), ["negative", "positive"], `${label} doit interroger les deux signes`);
}

const negativeCoefficientValues = [0, 0, 0.4, 0];
const factorizedWithNegativeCoefficient = engine.SKILL_GENERATORS.algebra[4](() => negativeCoefficientValues.shift() ?? 0);
assert.match(factorizedWithNegativeCoefficient.prompt, /−\(x \+ 6\)\(x − 1\)/, "le signe d'un coefficient -1 doit être visible devant un produit");

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

const invalidEquivalentQuestion = {
  kind: "test-equivalence",
  skill: "algebra",
  prompt: "Résoudre une équation produit pour ce test.",
  choices: ["x = -5 ou x = 5", "x = 5 ou x = -5", "x = 0", "x = 25"],
  answer: 0,
  explanation: "Les deux facteurs donnent les deux solutions attendues."
};
assert.equal(engine.validateQuestion(invalidEquivalentQuestion).valid, false, "le validateur doit détecter deux réponses équivalentes");

const conversionRandomValues = [0.9, 0.3, 0, 0.5, 0.5, 0.5];
const preciseConversion = engine.SKILL_GENERATORS.units[0](() => conversionRandomValues.shift() ?? 0.5);
assert.equal(preciseConversion.prompt, "Convertir 0,0005 km en cm.", "une petite mesure ne doit pas être arrondie dans l'énoncé");
assert.equal(preciseConversion.choices[preciseConversion.answer], "50 cm", "0,0005 km doit correspondre à 50 cm");

const inclusiveOrQuestion = engine.SKILL_GENERATORS.logic[1](() => 0.9);
assert.match(inclusiveOrQuestion.prompt, /est-elle fausse et la condition .* vraie/, "la question sur OU doit expliciter les valeurs de vérité attendues");
assert.doesNotMatch(inclusiveOrQuestion.prompt, /grâce uniquement/, "la formulation ne doit pas suggérer implicitement un OU exclusif");

let intersectionSeed = 987654321;
const intersectionRandom = () => {
  intersectionSeed = (1664525 * intersectionSeed + 1013904223) >>> 0;
  return intersectionSeed / 2 ** 32;
};
const intersectionSizes = new Set();
for (let i = 0; i < 500; i += 1) {
  const question = engine.SKILL_GENERATORS.logic[0](intersectionRandom);
  const sets = question.prompt.match(/A = (∅|\{[^}]*\}) et B = (∅|\{[^}]*\})/);
  assert.ok(sets, "les deux ensembles doivent être lisibles dans l'énoncé");
  const parseSet = text => text === "∅" ? [] : text.slice(1, -1).split(" ; ").map(Number);
  const [setA, setB] = [parseSet(sets[1]), parseSet(sets[2])];
  intersectionSizes.add(setA.filter(value => setB.includes(value)).length);
}
assert.deepEqual([...intersectionSizes].sort((a, b) => a - b), [0, 1, 2, 3], "les intersections doivent varier de vide à trois éléments");

for (let i = 0; i < 200; i += 1) {
  const question = engine.SKILL_GENERATORS.logic[2](Math.random);
  const content = [question.prompt, ...question.choices, question.explanation].join(" ");
  assert.doesNotMatch(content, /n'est pas pair|n'est pas impair/, "les contraposées sur la parité doivent employer pair ou impair sans négation");
}

const zeroEvolutionValues = [0.9, 0];
const zeroEvolution = engine.SKILL_GENERATORS.evolutions[2](() => zeroEvolutionValues.shift() ?? 0.5);
assert.equal(zeroEvolution.choices[zeroEvolution.answer], "Pas d'évolution", "un taux nul doit être formulé sans signe +");
assert.ok(zeroEvolution.choices.includes("+5 %"), "un taux strictement positif doit afficher le signe +");
assert.ok(!zeroEvolution.choices.includes("+0 %"), "la formulation +0 % doit être évitée");

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
  for (let i = 0; i < 200; i += 1) {
    const question = engine.generateForSkills([skill], {});
    validatedQuestions += 1;
    assert.equal(question.skill, skill, `${skill}: la question doit venir de la notion achetée`);
    assert.equal(question.choices.length, 4, `${skill}: quatre choix attendus`);
    assert.equal(new Set(question.choices.map(engine.canonicalChoice)).size, 4, `${skill}: choix équivalents`);
  }
}

const generatedKinds = new Set();
for (const [skill, generators] of Object.entries(engine.SKILL_GENERATORS)) {
  for (const generator of generators) {
    for (let i = 0; i < 100; i += 1) {
      const question = generator(Math.random);
      const validation = engine.validateQuestion(question);
      assert.ok(validation.valid, `${question.kind}: ${validation.errors.join(", ")}`);
      assert.equal(question.skill, skill, `${question.kind}: atelier incorrect`);
      generatedKinds.add(question.kind);
      validatedQuestions += 1;
    }
  }
}

assert.equal(engine.PROGRAMME_2026.length, 6, "six ensembles de capacités officielles sont attendus");
const capabilities = engine.PROGRAMME_2026.flatMap(section => section.capabilities);
assert.ok(capabilities.length >= 30, "la grille doit détailler les capacités du programme");
for (const capability of capabilities) {
  assert.ok(capability.skills.every(skill => engine.SKILLS[skill]), `${capability.label}: atelier inconnu`);
  assert.ok(capability.kinds.every(kind => generatedKinds.has(kind)), `${capability.label}: format non généré`);
}
assert.ok(!JSON.stringify(engine.PROGRAMME_2026).includes("STD2A"), "la géométrie spécifique à STD2A ne doit pas entrer dans les générateurs STI2D");

console.log(`${validatedQuestions} questions générées et validées dans ${generatedKinds.size} formats.`);
