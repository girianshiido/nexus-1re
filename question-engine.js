(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SKILLS = {
    proportions: "Proportions",
    evolutions: "Évolutions",
    units: "Unités",
    algebra: "Calcul algébrique",
    functions: "Fonctions",
    sequences: "Suites",
    derivatives: "Dérivation",
    statistics: "Statistiques",
    probability: "Probabilités"
  };

  function randInt(min, max, rng = Math.random) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(array, rng = Math.random) {
    return array[Math.floor(rng() * array.length)];
  }

  function shuffle(array, rng = Math.random) {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function formatNumber(value, digits = 2) {
    const rounded = Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
    return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(rounded);
  }

  function makeChoices(correct, distractors, rng = Math.random) {
    const values = [String(correct), ...distractors.map(String)];
    const unique = [...new Set(values)];
    let bump = 1;
    while (unique.length < 4) {
      const numeric = Number(String(correct).replace(",", "."));
      const candidate = Number.isFinite(numeric)
        ? String(numeric + bump)
        : ["Aucune de ces réponses", "Impossible à déterminer", "Toutes les réponses"][bump - 1];
      if (candidate && !unique.includes(candidate)) unique.push(candidate);
      bump += 1;
    }
    const choices = shuffle(unique.slice(0, 4), rng);
    return { choices, answer: choices.indexOf(String(correct)) };
  }

  function fingerprint(question) {
    return [
      question.kind,
      question.prompt,
      question.visual || "",
      question.choices.slice().sort().join("|")
    ].join("§");
  }

  function affineExpression(a, b) {
    if (b === 0) return `${a}x`;
    return `${a}x ${b > 0 ? "+" : "−"} ${Math.abs(b)}`;
  }

  function polynomialExpression(a, b, c) {
    const terms = [`${a}x²`];
    if (b !== 0) terms.push(`${b > 0 ? "+" : "−"} ${Math.abs(b)}x`);
    if (c !== 0) terms.push(`${c > 0 ? "+" : "−"} ${Math.abs(c)}`);
    return terms.join(" ");
  }

  function linearFactor(constant) {
    if (constant === 0) return "x";
    return `(x ${constant > 0 ? "+" : "−"} ${Math.abs(constant)})`;
  }

  function proportionValue(rng) {
    const item = pick([
      { singular: "panneau", plural: "panneaux", unit: "W" },
      { singular: "capteur", plural: "capteurs", unit: "mesures" },
      { singular: "module", plural: "modules", unit: "composants" }
    ], rng);
    const baseCount = randInt(2, 6, rng);
    const perItem = randInt(3, 15, rng);
    let targetCount = randInt(3, 10, rng);
    if (targetCount === baseCount) targetCount += 2;
    const baseValue = baseCount * perItem;
    const targetValue = targetCount * perItem;
    const { choices, answer } = makeChoices(targetValue, [
      baseValue + targetCount,
      baseValue * targetCount,
      targetValue + perItem
    ], rng);
    return {
      kind: "direct-proportion",
      skill: "proportions",
      prompt: `${baseCount} ${baseCount > 1 ? item.plural : item.singular} fournissent ${baseValue} ${item.unit}. Combien en fournissent ${targetCount} ${item.plural} dans la même situation ?`,
      choices: choices.map(value => `${value} ${item.unit}`), answer,
      explanation: `Une unité fournit ${baseValue} ÷ ${baseCount} = ${perItem} ${item.unit}. Donc ${targetCount} unités fournissent ${targetCount} × ${perItem} = ${targetValue} ${item.unit}.`
    };
  }

  function ratioShare(rng) {
    const ratioA = randInt(2, 5, rng);
    const ratioB = randInt(2, 6, rng);
    const multiplier = randInt(4, 15, rng);
    const total = (ratioA + ratioB) * multiplier;
    const askA = rng() < 0.5;
    const good = (askA ? ratioA : ratioB) * multiplier;
    const label = askA ? "A" : "B";
    const { choices, answer } = makeChoices(good, [
      (askA ? ratioB : ratioA) * multiplier,
      Math.round(total * (askA ? ratioA : ratioB) / 10),
      good + multiplier
    ], rng);
    return {
      kind: "ratio-share",
      skill: "proportions",
      prompt: `Un stock de ${total} composants est partagé entre les lignes A et B selon le ratio ${ratioA}:${ratioB}. Combien de composants reçoit la ligne ${label} ?`,
      choices, answer,
      explanation: `Le ratio comporte ${ratioA + ratioB} parts de ${multiplier} composants. La ligne ${label} reçoit ${askA ? ratioA : ratioB} parts, soit ${good} composants.`
    };
  }

  function metricConversion(rng) {
    const units = [
      { name: "mm", factor: 0.001 },
      { name: "cm", factor: 0.01 },
      { name: "m", factor: 1 },
      { name: "km", factor: 1000 }
    ];
    let fromIndex = randInt(0, units.length - 1, rng);
    let toIndex = randInt(0, units.length - 1, rng);
    if (fromIndex === toIndex) toIndex = (toIndex + 1) % units.length;
    const from = units[fromIndex];
    const to = units[toIndex];
    const baseMetres = pick([0.5, 1, 1.2, 2.5, 5, 12, 25, 50], rng);
    const given = baseMetres / from.factor;
    const good = baseMetres / to.factor;
    const { choices, answer } = makeChoices(formatNumber(good, 6), [
      formatNumber(good * 10, 6),
      formatNumber(good / 10, 6),
      formatNumber(given, 6)
    ], rng);
    return {
      kind: "metric-conversion",
      skill: "units",
      prompt: `Convertir ${formatNumber(given, 6)} ${from.name} en ${to.name}.`,
      choices: choices.map(value => `${value} ${to.name}`), answer,
      explanation: `${formatNumber(given, 6)} ${from.name} correspondent à ${formatNumber(baseMetres, 6)} m, donc à ${formatNumber(good, 6)} ${to.name}.`
    };
  }

  function durationConversion(rng) {
    const hours = randInt(1, 5, rng);
    const minutes = pick([10, 15, 20, 30, 40, 45, 50], rng);
    const totalMinutes = hours * 60 + minutes;
    const { choices, answer } = makeChoices(totalMinutes, [
      hours * 100 + minutes,
      hours * 60,
      totalMinutes + 60
    ], rng);
    return {
      kind: "duration-conversion",
      skill: "units",
      prompt: `Convertir ${hours} h ${minutes} min en minutes.`,
      choices: choices.map(value => `${value} min`), answer,
      explanation: `${hours} h = ${hours * 60} min. On ajoute ${minutes} min : ${hours * 60} + ${minutes} = ${totalMinutes} min.`
    };
  }

  function percentFinal(rng) {
    const initial = pick([80, 100, 120, 160, 200, 240, 320, 400, 500], rng);
    const rate = pick([-25, -20, -10, 5, 10, 15, 20, 25], rng);
    const final = initial * (1 + rate / 100);
    const { choices, answer } = makeChoices(formatNumber(final), [
      formatNumber(initial + rate),
      formatNumber(initial * (1 - rate / 100)),
      formatNumber(final + initial * 0.1)
    ], rng);
    return {
      kind: "percent-final",
      skill: "evolutions",
      prompt: `Une batterie stocke ${initial} Wh. Sa capacité ${rate >= 0 ? "augmente" : "diminue"} de ${Math.abs(rate)} %. Quelle est sa nouvelle capacité ?`,
      choices: choices.map(v => `${v} Wh`), answer,
      explanation: `On multiplie ${initial} par ${formatNumber(1 + rate / 100)} : on obtient ${formatNumber(final)} Wh.`
    };
  }

  function percentRate(rng) {
    const start = pick([80, 100, 120, 160, 200, 250, 400], rng);
    const rate = pick([-25, -20, -10, 10, 20, 25, 50], rng);
    const end = start * (1 + rate / 100);
    const sign = rate > 0 ? "+" : "−";
    const { choices, answer } = makeChoices(`${sign}${Math.abs(rate)} %`, [
      `${rate > 0 ? "+" : "−"}${Math.abs(rate / 2)} %`,
      `${rate > 0 ? "+" : "−"}${Math.abs(rate + (rate > 0 ? 10 : -10))} %`,
      `${rate < 0 ? "+" : "−"}${Math.abs(rate)} %`
    ], rng);
    return {
      kind: "percent-rate",
      skill: "evolutions",
      prompt: `Une production passe de ${start} à ${formatNumber(end)} unités. Quel est son taux d'évolution ?`,
      choices, answer,
      explanation: `(${formatNumber(end)} − ${start}) ÷ ${start} = ${formatNumber(rate / 100)} ; le taux est donc ${sign}${Math.abs(rate)} %.`
    };
  }

  function successiveRates(rng) {
    const r1 = pick([-20, -10, 10, 20, 25], rng);
    const r2 = pick([-20, -10, 10, 20, 25], rng);
    const total = ((1 + r1 / 100) * (1 + r2 / 100) - 1) * 100;
    const good = `${total >= 0 ? "+" : "−"}${formatNumber(Math.abs(total), 1)} %`;
    const sum = r1 + r2;
    const { choices, answer } = makeChoices(good, [
      `${sum >= 0 ? "+" : "−"}${Math.abs(sum)} %`,
      `${total >= 0 ? "+" : "−"}${formatNumber(Math.abs(total) + 2, 1)} %`,
      `${total < 0 ? "+" : "−"}${formatNumber(Math.abs(total), 1)} %`
    ], rng);
    return {
      kind: "successive-rates",
      skill: "evolutions",
      prompt: `Une valeur évolue de ${r1 >= 0 ? "+" : "−"}${Math.abs(r1)} %, puis de ${r2 >= 0 ? "+" : "−"}${Math.abs(r2)} %. Quelle est l'évolution globale ?`,
      choices, answer,
      explanation: `Les coefficients se multiplient : ${formatNumber(1 + r1 / 100)} × ${formatNumber(1 + r2 / 100)} = ${formatNumber(1 + total / 100, 3)}, soit ${good}.`
    };
  }

  function zeroProduct(rng) {
    let a = randInt(-6, 6, rng);
    let b = randInt(-6, 6, rng);
    if (a === b) b = b === 6 ? b - 2 : b + 2;
    const root1 = -a;
    const root2 = -b;
    const ordered = [root1, root2].sort((x, y) => x - y);
    const good = `x = ${ordered[0]} ou x = ${ordered[1]}`;
    const factors = [a, b].sort((x, y) => Number(x !== 0) - Number(y !== 0)).map(linearFactor);
    const wrongRoot = root => [1, -1, 2, -2]
      .map(offset => root + offset)
      .find(candidate => !ordered.includes(candidate));
    const wrongFirst = wrongRoot(ordered[0]);
    const wrongSecond = wrongRoot(ordered[1]);
    const { choices, answer } = makeChoices(good, [
      `x = ${wrongFirst} ou x = ${ordered[1]}`,
      `x = ${ordered[0]} ou x = ${wrongSecond}`,
      `x = ${root1 * root2}`
    ], rng);
    return {
      kind: "zero-product",
      skill: "algebra",
      prompt: `Résoudre ${factors.join("")} = 0.`,
      choices, answer,
      explanation: `Un produit est nul si l'un de ses facteurs est nul : les solutions sont ${good}.`
    };
  }

  function developExpression(rng) {
    const k = pick([2, 3, 4, 5], rng);
    const a = randInt(2, 7, rng);
    const m = randInt(1, 5, rng);
    const xcoef = k + m;
    const constant = k * a;
    const good = `${xcoef}x + ${constant}`;
    const { choices, answer } = makeChoices(good, [
      `${xcoef}x + ${a}`,
      `${k * m}x + ${constant}`,
      `${xcoef + a}x + ${constant}`
    ], rng);
    return {
      kind: "develop-expression",
      skill: "algebra",
      prompt: `Développer et réduire : ${k}(x + ${a}) + ${m}x.`,
      choices, answer,
      explanation: `${k}(x + ${a}) = ${k}x + ${constant}. En ajoutant ${m}x, on obtient ${good}.`
    };
  }

  function slopeFromPoints(rng) {
    const x1 = randInt(-3, 2, rng);
    const dx = pick([1, 2, 3], rng);
    const slope = pick([-4, -3, -2, 1, 2, 3, 4], rng);
    const y1 = randInt(-5, 5, rng);
    const x2 = x1 + dx;
    const y2 = y1 + slope * dx;
    const { choices, answer } = makeChoices(formatNumber(slope), [formatNumber(-slope), formatNumber(slope + 1), formatNumber(dx / (y2 - y1))], rng);
    return {
      kind: "line-slope",
      skill: "functions",
      prompt: `Une droite passe par A(${x1} ; ${y1}) et B(${x2} ; ${y2}). Quel est son coefficient directeur ?`,
      choices, answer,
      explanation: `m = (${y2} − ${y1}) ÷ (${x2} − ${x1}) = ${formatNumber(slope)}.`
    };
  }

  function functionImage(rng) {
    const a = pick([-4, -3, -2, 2, 3, 4], rng);
    const b = randInt(-6, 6, rng);
    const x = randInt(-4, 5, rng);
    const value = a * x + b;
    const expression = affineExpression(a, b);
    const { choices, answer } = makeChoices(value, [a + x + b, a * x - b, value + a], rng);
    return {
      kind: "affine-image",
      skill: "functions",
      prompt: `Soit f(x) = ${expression}. Quelle est l'image de ${x} par f ?`,
      choices, answer,
      explanation: `f(${x}) = ${a} × (${x})${b === 0 ? "" : ` ${b > 0 ? "+" : "−"} ${Math.abs(b)}`} = ${value}.`
    };
  }

  function nextSequence(rng) {
    const geometric = rng() > 0.5;
    if (geometric) {
      const q = pick([2, 3, 4], rng);
      const u0 = randInt(1, 5, rng);
      const values = [u0, u0 * q, u0 * q ** 2, u0 * q ** 3];
      const good = u0 * q ** 4;
      const { choices, answer } = makeChoices(good, [good + q, values[3] + q, values[3] * (q + 1)], rng);
      return { kind: "geometric-sequence", skill: "sequences", prompt: `Compléter la suite géométrique : ${values.join(" ; ")} ; …`, choices, answer, explanation: `Chaque terme est multiplié par ${q}. Le terme suivant vaut ${values[3]} × ${q} = ${good}.` };
    }
    const r = pick([-5, -3, 2, 4, 6, 8], rng);
    const u0 = randInt(-4, 12, rng);
    const values = [u0, u0 + r, u0 + 2 * r, u0 + 3 * r];
    const good = u0 + 4 * r;
    const { choices, answer } = makeChoices(good, [good + r, values[3] * r, good - 1], rng);
    return { kind: "arithmetic-sequence", skill: "sequences", prompt: `Compléter la suite arithmétique : ${values.join(" ; ")} ; …`, choices, answer, explanation: `On ajoute ${r} à chaque terme. Le terme suivant vaut ${values[3]} ${r >= 0 ? "+" : "−"} ${Math.abs(r)} = ${good}.` };
  }

  function derivativePolynomial(rng) {
    const a = pick([-4, -3, -2, 2, 3, 4], rng);
    const b = randInt(-6, 6, rng);
    const c = randInt(-8, 8, rng);
    const expression = polynomialExpression(a, b, c);
    const good = affineExpression(2 * a, b);
    const { choices, answer } = makeChoices(good, [
      affineExpression(a, b),
      polynomialExpression(2 * a, 0, b),
      affineExpression(2 * a, c)
    ], rng);
    return { kind: "polynomial-derivative", skill: "derivatives", prompt: `Soit f(x) = ${expression}. Quelle est sa fonction dérivée ?`, choices, answer, explanation: `La dérivée de ax² + bx + c est 2ax + b. Donc f′(x) = ${good}.` };
  }

  function meanSeries(rng) {
    const values = Array.from({ length: 4 }, () => randInt(4, 18, rng));
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const { choices, answer } = makeChoices(formatNumber(mean), [formatNumber(sum / 5), formatNumber(mean + 1), formatNumber(values.sort((a,b)=>a-b)[1])], rng);
    return { kind: "series-mean", skill: "statistics", prompt: `Quelle est la moyenne de la série : ${values.join(" ; ")} ?`, choices, answer, explanation: `La somme vaut ${sum}. La moyenne est ${sum} ÷ 4 = ${formatNumber(mean)}.` };
  }

  function conditionalProbability(rng) {
    const aYes = randInt(12, 28, rng);
    const aNo = randInt(6, 18, rng);
    const bYes = randInt(8, 22, rng);
    const bNo = randInt(10, 25, rng);
    const values = [[aYes, aNo], [bYes, bNo]];
    const rowTotals = [aYes + aNo, bYes + bNo];
    const columnTotals = [aYes + bYes, aNo + bNo];
    const total = rowTotals[0] + rowTotals[1];
    const conditionByLine = rng() < 0.5;
    const rowIndex = randInt(0, 1, rng);
    const statusIndex = randInt(0, 1, rng);
    const numerator = values[rowIndex][statusIndex];
    const denominator = conditionByLine ? rowTotals[rowIndex] : columnTotals[statusIndex];
    const probability = numerator / denominator;
    const percent = Math.round(probability * 1000) / 10;
    const line = rowIndex === 0 ? "A" : "B";
    const status = statusIndex === 0 ? "conforme" : "non conforme";
    const statusPlural = statusIndex === 0 ? "conformes" : "non conformes";
    const otherNumerator = conditionByLine
      ? values[rowIndex][1 - statusIndex]
      : values[1 - rowIndex][statusIndex];
    const alternateDenominator = conditionByLine ? columnTotals[statusIndex] : rowTotals[rowIndex];
    const { choices, answer } = makeChoices(`${formatNumber(percent, 1)} %`, [
      `${formatNumber(numerator / total * 100, 1)} %`,
      `${formatNumber(numerator / alternateDenominator * 100, 1)} %`,
      `${formatNumber(otherNumerator / denominator * 100, 1)} %`
    ], rng);
    const prompt = conditionByLine
      ? `On choisit une pièce au hasard parmi les pièces de la ligne ${line}. Quelle est la probabilité qu'elle soit ${status} ?`
      : `On choisit une pièce au hasard parmi les pièces ${statusPlural}. Quelle est la probabilité qu'elle provienne de la ligne ${line} ?`;
    const conditionDescription = conditionByLine
      ? `les ${denominator} pièces de la ligne ${line}`
      : `les ${denominator} pièces ${statusPlural}`;
    const targetDescription = conditionByLine
      ? `${numerator} sont ${statusPlural}`
      : `${numerator} proviennent de la ligne ${line}`;
    return {
      kind: "conditional-table",
      skill: "probability",
      prompt,
      choices, answer,
      visual: `<table aria-label="Tableau des pièces contrôlées"><tr><th></th><th>Conformes</th><th>Non conformes</th></tr><tr><th>Ligne A</th><td>${aYes}</td><td>${aNo}</td></tr><tr><th>Ligne B</th><td>${bYes}</td><td>${bNo}</td></tr></table>`,
      explanation: `Parmi ${conditionDescription}, ${targetDescription} : ${numerator} ÷ ${denominator} ≈ ${formatNumber(percent, 1)} %.`
    };
  }

  function independentEvents(rng) {
    const pA = pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8], rng);
    const pB = pick([0.2, 0.25, 0.4, 0.5, 0.6], rng);
    const good = pA * pB;
    const { choices, answer } = makeChoices(formatNumber(good, 2), [formatNumber(pA + pB, 2), formatNumber(1 - good, 2), formatNumber(pA / pB, 2)], rng);
    return { kind: "independent-events", skill: "probability", prompt: `Les événements A et B sont indépendants, avec P(A) = ${formatNumber(pA)} et P(B) = ${formatNumber(pB)}. Calculer P(A ∩ B).`, choices, answer, explanation: `Pour des événements indépendants, P(A ∩ B) = P(A) × P(B) = ${formatNumber(pA)} × ${formatNumber(pB)} = ${formatNumber(good, 2)}.` };
  }

  const GENERATORS = {
    energy: [proportionValue, ratioShare, percentFinal, percentRate, successiveRates, metricConversion, durationConversion, functionImage],
    factory: [zeroProduct, developExpression, slopeFromPoints, nextSequence, derivativePolynomial],
    data: [meanSeries, conditionalProbability, independentEvents]
  };

  const SKILL_GENERATORS = {
    proportions: [proportionValue, ratioShare],
    evolutions: [percentFinal, percentRate, successiveRates],
    units: [metricConversion, durationConversion],
    algebra: [zeroProduct, developExpression],
    functions: [slopeFromPoints, functionImage],
    sequences: [nextSequence],
    derivatives: [derivativePolynomial],
    statistics: [meanSeries],
    probability: [conditionalProbability, independentEvents]
  };

  function selectGenerated(generators, mastery, rng, exclusions) {
    const excludedKeys = new Set(exclusions.keys || []);
    const excludedKinds = new Set(exclusions.kinds || []);
    const generated = generators.map(generator => {
      let question;
      let attempts = 0;
      do {
        question = generator(rng);
        attempts += 1;
      } while (excludedKeys.has(fingerprint(question)) && attempts < 20);
      return question;
    });
    const newQuestions = generated.filter(question => !excludedKeys.has(fingerprint(question)));
    const variedQuestions = newQuestions.filter(question => !excludedKinds.has(question.kind));
    const candidates = variedQuestions.length ? variedQuestions : (newQuestions.length ? newQuestions : generated);
    const min = Math.min(...candidates.map(q => Number(mastery[q.skill] || 0)));
    const weak = candidates.filter(q => Number(mastery[q.skill] || 0) <= min + 1);
    return pick(rng() < 0.72 ? weak : candidates, rng);
  }

  function generate(worldId, mastery = {}, rng = Math.random, exclusions = {}) {
    const generators = GENERATORS[worldId] || GENERATORS.energy;
    return selectGenerated(generators, mastery, rng, exclusions);
  }

  function generateForSkills(skills, mastery = {}, rng = Math.random, exclusions = {}) {
    const selectedSkills = skills.filter(skill => SKILL_GENERATORS[skill]);
    const generators = selectedSkills.flatMap(skill => SKILL_GENERATORS[skill]);
    return selectGenerated(generators.length ? generators : SKILL_GENERATORS.proportions, mastery, rng, exclusions);
  }

  return { SKILLS, GENERATORS, SKILL_GENERATORS, generate, generateForSkills, fingerprint, affineExpression, linearFactor, formatNumber };
});
