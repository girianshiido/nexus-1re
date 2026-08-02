import assert from "node:assert/strict";
import engine from "../question-engine.js";

let seed = 135792468;
const rng = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

function sample(kind, count = 800) {
  return Array.from({ length: count }, () => engine.generateForKinds([kind], {}, rng));
}

function correctAnswer(question) {
  return question.choices[question.answer];
}

function expectVariety(kind, minimumAnswers, minimumFingerprints) {
  const questions = sample(kind);
  const answers = new Set(questions.map(correctAnswer));
  const fingerprints = new Set(questions.map(engine.fingerprint));
  assert.ok(
    answers.size >= minimumAnswers,
    `${kind}: seulement ${answers.size} réponses correctes distinctes`
  );
  assert.ok(
    fingerprints.size >= minimumFingerprints,
    `${kind}: seulement ${fingerprints.size} questions complètes distinctes`
  );
  return questions;
}

const counterexamples = expectVariety("counterexample", 15, 20);
assert.ok(
  new Set(counterexamples.map(question => {
    if (/n² >/.test(question.prompt)) return "inequality";
    if (/est impair/.test(question.prompt)) return "parity";
    if (/x² =/.test(question.prompt)) return "square";
    return "divisibility";
  })).size === 4,
  "les contre-exemples doivent couvrir quatre raisonnements"
);

expectVariety("statement-reciprocal", 40, 50);

const accumulators = expectVariety("python-accumulator", 35, 140);
const accumulatorFamilies = new Set(accumulators.map(question => {
  if (/produit =/.test(question.visual)) return "product";
  if (/compteur =/.test(question.visual)) return "fixed-increment";
  if (/range\([^)]*, 2\)/.test(question.visual)) return "even-sum";
  return "sum";
}));
assert.deepEqual(
  [...accumulatorFamilies].sort(),
  ["even-sum", "fixed-increment", "product", "sum"],
  "l'accumulateur doit varier sa valeur initiale et son opération"
);
assert.ok(
  accumulators.some(question => /= 0\n/.test(question.visual))
    && accumulators.some(question => /= -?[1-9]\d*\n/.test(question.visual)),
  "la valeur initiale d'un accumulateur doit pouvoir être nulle ou non nulle"
);

const pythonLists = expectVariety("python-list", 40, 100);
assert.ok(
  pythonLists.every(question => !/[+−-] 0 for/.test(question.visual)),
  "une transformation de liste ne doit pas afficher une addition nulle"
);
assert.deepEqual(
  [...new Set(pythonLists.map(question => {
    if (/\.append/.test(question.visual)) return "append";
    if (/\[2 \* n/.test(question.visual)) return "transform";
    return "filter";
  }))].sort(),
  ["append", "filter", "transform"],
  "les listes Python doivent couvrir filtrage, transformation et ajout"
);

expectVariety("python-function", 45, 200);
const spreadsheets = expectVariety("spreadsheet-formula", 80, 300);
assert.ok(
  spreadsheets.every(question => question.choices.every(choice => choice.startsWith("="))),
  "tous les distracteurs de tableur doivent être des formules syntaxiquement plausibles"
);
assert.deepEqual(
  [...new Set(spreadsheets.map(question => {
    if (/terme suivant/.test(question.prompt)) return "sequence";
    if (/renvoie VRAI/.test(question.prompt)) return "filter";
    if (/deux produits/.test(question.prompt)) return "two-products";
    if (/taux d'évolution/.test(question.prompt)) return "evolution-rate";
    if (/valeur finale/.test(question.prompt)) return "percentage";
    if (/toutes les cellules/.test(question.prompt)) return "aggregate";
    return "row-operation";
  }))].sort(),
  ["aggregate", "evolution-rate", "filter", "percentage", "row-operation", "sequence", "two-products"],
  "les formules de tableur doivent couvrir sept raisonnements différents"
);
const spreadsheetSequences = spreadsheets.filter(question => /terme suivant/.test(question.prompt));
assert.deepEqual(
  [...new Set(spreadsheetSequences.map(question => /arithmétique/.test(question.prompt) ? "arithmetic" : "geometric"))].sort(),
  ["arithmetic", "geometric"],
  "le tableur doit traiter les suites arithmétiques et géométriques"
);
const spreadsheetFilters = spreadsheets.filter(question => /renvoie VRAI/.test(question.prompt));
assert.deepEqual(
  [...new Set(spreadsheetFilters.map(question => {
    if (/comprise entre/.test(question.prompt)) return "between";
    if (/strictement inférieure/.test(question.prompt)) return "below";
    return "above";
  }))].sort(),
  ["above", "below", "between"],
  "les critères de filtre doivent couvrir une borne basse, une borne haute et un intervalle"
);
const rowOperations = spreadsheets.filter(question => /Quelle formule calcule (?:le|la) /.test(question.prompt) && /à la ligne/.test(question.prompt));
assert.deepEqual(
  [...new Set(rowOperations.map(correctAnswer).map(answer => answer.match(/[+*/-]/)?.[0]))].sort(),
  ["*", "+", "-", "/"],
  "la lecture d'une ligne doit varier entre produit, somme, différence et quotient"
);

const sequenceVariations = sample("sequence-variation");
const geometricVariations = sequenceVariations.filter(question => /suite géométrique/.test(question.prompt));
assert.deepEqual(
  [...new Set(geometricVariations.map(question => {
    const sign = /strictement négatifs/.test(question.prompt) ? "negative" : "positive";
    const direction = correctAnswer(question) === "Strictement croissante" ? "increasing" : "decreasing";
    return `${sign}-${direction}`;
  }))].sort(),
  ["negative-decreasing", "negative-increasing", "positive-decreasing", "positive-increasing"],
  "les suites géométriques doivent couvrir les deux signes et les deux sens de variation"
);

const filters = expectVariety("data-filter", 6, 500);
assert.deepEqual(
  [...new Set(filters.map(question => {
    if (/comprises entre/.test(question.prompt)) return "between";
    if (/strictement inférieures/.test(question.prompt)) return "below";
    return "above";
  }))].sort(),
  ["above", "below", "between"],
  "les filtres doivent employer trois types de critères"
);

const bernoulli = expectVariety("python-bernoulli", 10, 10);
const answersAtSixTenths = new Set(
  bernoulli
    .filter(question => /probabilité 0,6/.test(question.prompt))
    .map(correctAnswer)
);
assert.ok(
  answersAtSixTenths.has("random() < 0.6") && answersAtSixTenths.has("random() > 0.4"),
  "une probabilité 0,6 doit être représentée par les deux intervalles possibles"
);

expectVariety("raw-data-cross-table", 7, 500);
expectVariety("random-expectation", 60, 400);

const randomEvents = expectVariety("random-event", 8, 400);
assert.deepEqual(
  [...new Set(randomEvents.map(question => {
    if (/P\(X ≤/.test(question.prompt)) return "at-most";
    if (/P\(X ≥/.test(question.prompt)) return "at-least";
    return "equal";
  }))].sort(),
  ["at-least", "at-most", "equal"],
  "les événements aléatoires doivent varier l'événement demandé"
);

const fractions = expectVariety("fraction-calculation", 60, 300);
assert.ok(
  fractions.some(question => / × /.test(question.prompt))
    && fractions.some(question => / \+ /.test(question.prompt))
    && fractions.some(question => / − /.test(question.prompt)),
  "les fractions doivent couvrir addition, soustraction et multiplication"
);

const percentageRates = sample("percent-rate");
assert.ok(
  percentageRates.some(question => question.choices.some(choice => /12,5 %/.test(choice))),
  "les taux décimaux doivent employer la virgule française"
);
assert.ok(
  percentageRates.every(question => !/\d+\.\d+\s*%/.test(JSON.stringify(question))),
  "aucun pourcentage décimal ne doit employer un point"
);

const dotProductAngles = sample("dot-product-angle");
assert.ok(
  dotProductAngles.every(question => /norm\(vec\(u\)\)/.test(question.prompt) && /norm\(vec\(v\)\)/.test(question.prompt)),
  "les normes des vecteurs doivent utiliser les marqueurs de rendu mathématique"
);
assert.ok(
  dotProductAngles.every(question => !/°/.test(`${question.prompt} ${question.explanation}`)),
  "les angles du produit scalaire doivent être exprimés en radians sans unité"
);
assert.deepEqual(
  [...new Set(dotProductAngles.map(question => question.prompt.match(/vaut ([^.]+)\./)?.[1])).values()].sort(),
  ["0", "2π/3", "π", "π/2", "π/3"].sort(),
  "le produit scalaire doit couvrir les cinq angles remarquables en radians"
);

const alKashiQuestions = sample("al-kashi");
assert.ok(
  alKashiQuestions.every(question => !/°/.test(`${question.prompt} ${question.explanation}`)),
  "les angles d'Al-Kashi doivent être exprimés en radians sans unité"
);
assert.deepEqual(
  [...new Set(alKashiQuestions.map(question => question.prompt.match(/vaut ([^.]+)\./)?.[1])).values()].sort(),
  ["2π/3", "π/2", "π/3"].sort(),
  "Al-Kashi doit varier entre trois angles remarquables en radians"
);

const priorities = expectVariety("operation-priority", 100, 500);
assert.ok(
  priorities.some(question => /\(/.test(question.prompt))
    && priorities.some(question => / × .* − .* × /.test(question.prompt)),
  "les priorités doivent couvrir parenthèses et produits multiples"
);

const powers = expectVariety("power-rule", 20, 100);
assert.ok(
  powers.some(question => / ÷ /.test(question.prompt))
    && powers.some(question => /\)[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/.test(question.prompt))
    && powers.some(question => / × /.test(question.prompt)),
  "les puissances doivent couvrir produit, quotient et puissance de puissance"
);

const factorizations = expectVariety("factor-expression", 80, 250);
assert.ok(
  factorizations.some(question => /x²/.test(question.prompt))
    && factorizations.some(question => /Factoriser par −/.test(question.prompt)),
  "les factorisations doivent varier le facteur commun"
);

const recurrences = expectVariety("recurrent-sequence-term", 55, 180);
assert.ok(
  recurrences.some(question => /= uₙ /.test(question.prompt))
    && recurrences.some(question => /= [23]uₙ\./.test(question.prompt))
    && recurrences.some(question => /= [23]uₙ [+−]/.test(question.prompt)),
  "les suites récurrentes doivent couvrir addition, multiplication et relation affine"
);

const eulerSteps = sample("euler-step");
assert.ok(
  eulerSteps.every(question => /Pour y′ = (?:1\/t|1\/\(1 \+ t²\))/.test(question.prompt)),
  "la méthode d'Euler doit rester limitée aux équations y′ = f(t) du programme"
);
assert.ok(
  eulerSteps.every(question => !/y′ = [^,]*\by\b/.test(question.prompt)),
  "le second membre des questions d'Euler ne doit pas dépendre de y"
);
assert.deepEqual(
  [...new Set(eulerSteps.map(question => /y′ = 1\/t,/.test(question.prompt) ? "inverse" : "cauchy"))].sort(),
  ["cauchy", "inverse"],
  "les questions d'Euler doivent couvrir les deux familles de primitives proposées"
);

console.log("La diversité structurelle des générateurs sensibles est validée.");
