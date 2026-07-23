(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuestionEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SKILLS = {
    proportions: "Proportions",
    numeric: "Calcul numérique",
    evolutions: "Évolutions",
    units: "Unités",
    logic: "Logique",
    algebra: "Calcul algébrique",
    functions: "Fonctions",
    sequences: "Suites",
    derivatives: "Dérivation",
    statistics: "Statistiques",
    probability: "Probabilités",
    algorithmics: "Algorithmique"
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

  function formatEvolutionRate(value, digits = 1) {
    if (Math.abs(value) < 1e-9) return "Pas d'évolution";
    return `${value > 0 ? "+" : "−"}${formatNumber(Math.abs(value), digits)} %`;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) [x, y] = [y, x % y];
    return x || 1;
  }

  function fraction(numerator, denominator) {
    const sign = denominator < 0 ? -1 : 1;
    const divisor = gcd(numerator, denominator);
    const n = sign * numerator / divisor;
    const d = Math.abs(denominator) / divisor;
    return d === 1 ? String(n) : `${n}/${d}`;
  }

  function superscript(value) {
    const glyphs = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    return String(value).split("").map(character => glyphs[character]).join("");
  }

  function subscript(value) {
    const glyphs = { "-": "₋", "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };
    return String(value).split("").map(character => glyphs[character]).join("");
  }

  function coefficientTimes(coefficient, term) {
    if (coefficient === 1) return String(term);
    if (coefficient === -1) return `−${term}`;
    return `${coefficient} × ${term}`;
  }

  function canonicalChoice(value) {
    const normalized = String(value)
      .trim()
      .toLowerCase()
      .replace(/[−–—]/g, "-")
      .replace(/,/g, ".")
      .replace(/\s+/g, " ");
    const compact = normalized.replace(/\s/g, "");
    if (compact === "pasd'évolution" || compact === "pasdevolution") return "number:0:%";
    const fractional = compact.match(/^([+-]?\d+)\/([+-]?\d+)$/);
    if (fractional && Number(fractional[2]) !== 0) return `fraction:${fraction(Number(fractional[1]), Number(fractional[2]))}`;
    const solutionPair = compact.match(/^x=([+-]?\d+(?:\.\d+)?)oux=([+-]?\d+(?:\.\d+)?)$/);
    if (solutionPair) {
      return `solutions:${solutionPair.slice(1).map(Number).sort((a, b) => a - b).join("|")}`;
    }
    const numeric = normalized.match(/^([+-]?\d+(?:\.\d+)?)\s*(.*)$/);
    if (numeric) return `number:${Number(numeric[1])}:${numeric[2].replace(/\s/g, "")}`;
    return compact;
  }

  function validateQuestion(question) {
    const errors = [];
    if (!question || typeof question !== "object") return { valid: false, errors: ["question absente"] };
    if (typeof question.prompt !== "string" || question.prompt.trim().length < 10) errors.push("énoncé manquant");
    if (!Array.isArray(question.choices) || question.choices.length !== 4) errors.push("quatre choix attendus");
    else if (new Set(question.choices.map(canonicalChoice)).size !== 4) errors.push("choix mathématiquement équivalents");
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) errors.push("réponse invalide");
    if (typeof question.explanation !== "string" || question.explanation.trim().length < 10) errors.push("correction manquante");
    if (!SKILLS[question.skill]) errors.push("compétence inconnue");
    if (!question.kind) errors.push("format manquant");
    const serialized = JSON.stringify(question);
    if (/NaN|undefined|Infinity/.test(serialized)) errors.push("valeur numérique invalide");
    return { valid: errors.length === 0, errors };
  }

  function makeChoices(correct, distractors, rng = Math.random) {
    const values = [String(correct), ...distractors.map(String)];
    const unique = [];
    const seen = new Set();
    values.forEach(value => {
      const canonical = canonicalChoice(value);
      if (!seen.has(canonical)) {
        seen.add(canonical);
        unique.push(value);
      }
    });
    let bump = 1;
    while (unique.length < 4) {
      const source = String(correct);
      const numeric = Number(source.replace(",", "."));
      const embedded = source.match(/[+-]?\d+(?:[.,]\d+)?/);
      let candidate;
      if (Number.isFinite(numeric)) {
        candidate = String(numeric + bump);
      } else if (embedded) {
        const changedValue = Number(embedded[0].replace(",", ".")) + bump;
        let changed = String(changedValue).replace(".", embedded[0].includes(",") ? "," : ".");
        if (embedded[0].startsWith("+") && changedValue >= 0) changed = `+${changed}`;
        candidate = `${source.slice(0, embedded.index)}${changed}${source.slice(embedded.index + embedded[0].length)}`;
      } else {
        candidate = bump === 1 ? `Ni ${source.toLowerCase()}` : bump === 2 ? `L'inverse de « ${source} »` : `Cas alternatif ${bump}`;
      }
      if (candidate && !seen.has(canonicalChoice(candidate))) {
        seen.add(canonicalChoice(candidate));
        unique.push(candidate);
      }
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
      question.choices.map(canonicalChoice).sort().join("|")
    ].join("§");
  }

  function affineExpression(a, b) {
    if (a === 0) return String(b);
    const linearTerm = a === 1 ? "x" : a === -1 ? "−x" : `${a}x`;
    if (b === 0) return linearTerm;
    return `${linearTerm} ${b > 0 ? "+" : "−"} ${Math.abs(b)}`;
  }

  function polynomialExpression(a, b, c) {
    const terms = [`${a === 1 ? "" : a === -1 ? "−" : a}x²`];
    if (b !== 0) terms.push(`${b > 0 ? "+" : "−"} ${Math.abs(b)}x`);
    if (c !== 0) terms.push(`${c > 0 ? "+" : "−"} ${Math.abs(c)}`);
    return terms.join(" ");
  }

  function cubicExpression(a, b, c, d) {
    const terms = [`${a === 1 ? "" : a === -1 ? "−" : a}x³`];
    if (b !== 0) terms.push(`${b > 0 ? "+" : "−"} ${Math.abs(b)}x²`);
    if (c !== 0) terms.push(`${c > 0 ? "+" : "−"} ${Math.abs(c)}x`);
    if (d !== 0) terms.push(`${d > 0 ? "+" : "−"} ${Math.abs(d)}`);
    return terms.join(" ");
  }

  function linearFactor(constant) {
    if (constant === 0) return "x";
    return `(x ${constant > 0 ? "+" : "−"} ${Math.abs(constant)})`;
  }

  function fractionCalculation(rng) {
    const denominator = pick([4, 5, 6, 8, 10, 12], rng);
    const first = randInt(1, denominator - 1, rng);
    const second = randInt(1, denominator - 1, rng);
    const good = fraction(first + second, denominator);
    const { choices, answer } = makeChoices(good, [
      fraction(first + second, denominator * 2),
      fraction(first * second, denominator),
      fraction(Math.abs(first - second), denominator)
    ], rng);
    return {
      kind: "fraction-calculation",
      skill: "numeric",
      prompt: `Calculer et simplifier : ${first}/${denominator} + ${second}/${denominator}.`,
      choices, answer,
      explanation: `Les dénominateurs sont identiques : (${first} + ${second})/${denominator} = ${good}.`
    };
  }

  function operationPriority(rng) {
    const a = randInt(2, 12, rng);
    const b = randInt(2, 9, rng);
    const c = randInt(2, 8, rng);
    const good = a + b * c;
    const { choices, answer } = makeChoices(good, [(a + b) * c, a * b + c, a + b + c], rng);
    return {
      kind: "operation-priority",
      skill: "numeric",
      prompt: `Calculer mentalement : ${a} + ${b} × ${c}.`,
      choices, answer,
      explanation: `La multiplication est prioritaire : ${b} × ${c} = ${b * c}, puis ${a} + ${b * c} = ${good}.`
    };
  }

  function scientificNotation(rng) {
    const coefficient = randInt(2, 9, rng);
    const exponent = pick([-5, -4, -3, 3, 4, 5], rng);
    const value = coefficient * 10 ** exponent;
    const good = `${coefficient} × 10${superscript(exponent)}`;
    const equivalentButNotScientific = `${coefficient * 10} × 10${superscript(exponent - 1)}`;
    const { choices, answer } = makeChoices(good, [
      `${coefficient} × 10${superscript(exponent + (exponent > 0 ? -1 : 1))}`,
      equivalentButNotScientific,
      `${coefficient} × 10${superscript(-exponent)}`
    ], rng);
    return {
      kind: "scientific-notation",
      skill: "numeric",
      prompt: `Écrire ${formatNumber(value, 8)} en notation scientifique.`,
      choices, answer,
      explanation: `La mantisse doit être comprise entre 1 et 10 : ${formatNumber(value, 8)} = ${good}. ${equivalentButNotScientific} représente le même nombre, mais sa mantisse vaut ${coefficient * 10} : ce n'est donc pas une notation scientifique.`
    };
  }

  function powerRule(rng) {
    const first = randInt(-4, 6, rng);
    const second = randInt(-4, 6, rng);
    const exponent = first + second;
    const good = `10${superscript(exponent)}`;
    const { choices, answer } = makeChoices(good, [
      `10${superscript(first * second)}`,
      `10${superscript(first - second)}`,
      `20${superscript(exponent)}`
    ], rng);
    return {
      kind: "power-rule",
      skill: "numeric",
      prompt: `Simplifier : 10${superscript(first)} × 10${superscript(second)}.`,
      choices, answer,
      explanation: `Pour des puissances de même base, on additionne les exposants : ${first} + (${second}) = ${exponent}.`
    };
  }

  function setIntersection(rng) {
    const commonCount = pick([0, 1, 2, 3], rng);
    const common = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], rng).slice(0, commonCount).sort((a, b) => a - b);
    const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(value => !common.includes(value));
    const onlyA = remaining.slice(0, 2);
    const onlyB = remaining.slice(2, 4);
    const setA = [...common, ...onlyA].sort((a, b) => a - b);
    const setB = [...common, ...onlyB].sort((a, b) => a - b);
    const writeSet = values => values.length ? `{${values.join(" ; ")}}` : "∅";
    const union = [...new Set([...setA, ...setB])].sort((a, b) => a - b);
    const mode = pick(["intersection", "union", "cardinal"], rng);
    const good = mode === "intersection" ? writeSet(common) : mode === "union" ? writeSet(union) : String(common.length);
    const distractors = mode === "cardinal"
      ? [setA.length, union.length, common.length + 1]
      : [writeSet(setA), writeSet(setB), writeSet([...onlyA, ...onlyB].sort((a, b) => a - b))];
    const { choices, answer } = makeChoices(good, distractors, rng);
    return {
      kind: "set-intersection",
      skill: "logic",
      prompt: `A = ${writeSet(setA)} et B = ${writeSet(setB)}. ${mode === "intersection" ? "Quel est l'ensemble A ∩ B ?" : mode === "union" ? "Quel est l'ensemble A ∪ B ?" : "Quelle est la valeur de Card(A ∩ B) ?"}`,
      choices, answer,
      explanation: mode === "union"
        ? `A ∪ B rassemble tous les éléments appartenant à A ou à B : ${good}.`
        : mode === "cardinal"
          ? common.length
            ? `A ∩ B contient ${common.join(" et ")}, soit ${good} éléments.`
            : "A ∩ B ne contient aucun élément, donc Card(A ∩ B) = 0."
          : `A ∩ B contient uniquement les éléments communs aux deux ensembles : ${good}.`
    };
  }

  function logicalCondition(rng) {
    const thresholdA = randInt(3, 7, rng);
    const thresholdB = randInt(8, 13, rng);
    const useAnd = rng() < 0.5;
    const candidates = [
      [thresholdA + 1, thresholdB - 1],
      [thresholdA - 1, thresholdB + 1],
      [thresholdA - 1, thresholdB - 1],
      [thresholdA + 1, thresholdB + 1]
    ];
    const satisfies = ([x, y]) => useAnd ? x > thresholdA && y < thresholdB : x > thresholdA || y < thresholdB;
    const correctCandidates = candidates.filter(satisfies);
    const selectedGood = useAnd ? correctCandidates[0] : candidates.find(candidate => satisfies(candidate) && candidate[0] <= thresholdA);
    const good = `x = ${selectedGood[0]} et y = ${selectedGood[1]}`;
    const distractors = candidates.filter(candidate => candidate !== selectedGood).map(candidate => `x = ${candidate[0]} et y = ${candidate[1]}`);
    const { choices, answer } = makeChoices(good, distractors, rng);
    return {
      kind: "logical-condition",
      skill: "logic",
      prompt: useAnd
        ? `Quelle paire vérifie la condition « x > ${thresholdA} ET y < ${thresholdB} » ?`
        : `Pour quelle paire la condition x > ${thresholdA} est-elle fausse et la condition y < ${thresholdB} vraie ?`,
      choices, answer,
      explanation: useAnd
        ? `${good} vérifie simultanément les deux conditions.`
        : `${good} rend x > ${thresholdA} fausse et y < ${thresholdB} vraie. L'affirmation avec OU est donc vraie grâce à sa seconde condition.`
    };
  }

  function reciprocalStatement(rng) {
    const variant = pick([
      {
        statement: "Si un entier est divisible par 4, alors il est pair.",
        reciprocal: "Si un entier est pair, alors il est divisible par 4.",
        contrapositive: "Si un entier est impair, alors il n'est pas divisible par 4.",
        other: "Si un entier est divisible par 2, alors il est impair."
      },
      {
        statement: "Si x > 5, alors x > 2.",
        reciprocal: "Si x > 2, alors x > 5.",
        contrapositive: "Si x ≤ 2, alors x ≤ 5.",
        other: "Si x < 5, alors x < 2."
      }
    ], rng);
    const askReciprocal = rng() < 0.5;
    const target = askReciprocal ? variant.reciprocal : variant.contrapositive;
    const { choices, answer } = makeChoices(target, [variant.reciprocal, variant.contrapositive, variant.other, `${variant.statement} et sa réciproque sont équivalentes.`], rng);
    return {
      kind: "statement-reciprocal",
      skill: "logic",
      prompt: `Quelle est la ${askReciprocal ? "réciproque" : "contraposée"} de la proposition : « ${variant.statement} » ?`,
      choices, answer,
      explanation: askReciprocal
        ? `La réciproque échange l'hypothèse et la conclusion : « ${variant.reciprocal} »`
        : `La contraposée nie puis échange la conclusion et l'hypothèse : « ${variant.contrapositive} »`
    };
  }

  function counterexample(rng) {
    const variant = pick([
      { statement: "Pour tout entier n, n² > n.", good: "n = 1", wrong: ["n = 2", "n = 3", "n = 4"], explanation: "Pour n = 1, on a 1² = 1, donc l'inégalité stricte est fausse." },
      { statement: "Tout multiple de 3 est impair.", good: "n = 6", wrong: ["n = 3", "n = 9", "n = 15"], explanation: "6 est multiple de 3 mais il est pair." },
      { statement: "Si x² = 9, alors x = 3.", good: "x = −3", wrong: ["x = 0", "x = 2", "x = 4"], explanation: "(−3)² = 9 mais −3 n'est pas égal à 3." }
    ], rng);
    const { choices, answer } = makeChoices(variant.good, variant.wrong, rng);
    return {
      kind: "counterexample",
      skill: "logic",
      prompt: `Quel contre-exemple suffit à infirmer la proposition « ${variant.statement} » ?`,
      choices, answer,
      explanation: variant.explanation
    };
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
    const factorValue = randInt(2, 6, rng);
    const smaller = randInt(3, 15, rng);
    const larger = factorValue * smaller;
    const askLargerFirst = rng() < 0.5;
    const good = askLargerFirst ? String(factorValue) : fraction(1, factorValue);
    const { choices, answer } = makeChoices(good, [
      askLargerFirst ? fraction(1, factorValue) : String(factorValue),
      String(larger - smaller),
      fraction(larger + smaller, smaller)
    ], rng);
    return {
      kind: "ratio-comparison",
      skill: "proportions",
      prompt: `Une ligne produit ${larger} pièces et une autre ${smaller}. Quel est le rapport ${askLargerFirst ? `${larger}/${smaller}` : `${smaller}/${larger}`} ?`,
      choices, answer,
      explanation: `${askLargerFirst ? larger : smaller} ÷ ${askLargerFirst ? smaller : larger} = ${good}. Ce rapport compare les deux quantités de manière multiplicative.`
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
    const good = formatEvolutionRate(total);
    const sum = r1 + r2;
    const { choices, answer } = makeChoices(good, [
      formatEvolutionRate(sum),
      formatEvolutionRate(total + (total >= 0 ? 2 : -2)),
      formatEvolutionRate(Math.abs(total) < 1e-9 ? -2 : -total)
    ], rng);
    return {
      kind: "successive-rates",
      skill: "evolutions",
      prompt: `Une valeur évolue de ${r1 >= 0 ? "+" : "−"}${Math.abs(r1)} %, puis de ${r2 >= 0 ? "+" : "−"}${Math.abs(r2)} %. Quelle est l'évolution globale ?`,
      choices, answer,
      explanation: Math.abs(total) < 1e-9
        ? `Les coefficients se multiplient : ${formatNumber(1 + r1 / 100)} × ${formatNumber(1 + r2 / 100)} = 1. La valeur finale est égale à la valeur initiale : il n'y a pas d'évolution.`
        : `Les coefficients se multiplient : ${formatNumber(1 + r1 / 100)} × ${formatNumber(1 + r2 / 100)} = ${formatNumber(1 + total / 100, 3)}, soit ${good}.`
    };
  }

  function percentInitial(rng) {
    const initial = pick([80, 100, 120, 160, 200, 240, 400, 500], rng);
    const rate = pick([-25, -20, -10, 10, 20, 25, 50], rng);
    const final = initial * (1 + rate / 100);
    const { choices, answer } = makeChoices(initial, [final, initial + rate, Math.round(final / (1 - rate / 100))], rng);
    return {
      kind: "percent-initial",
      skill: "evolutions",
      prompt: `Après une évolution de ${rate >= 0 ? "+" : "−"}${Math.abs(rate)} %, une valeur vaut ${formatNumber(final)}. Quelle était sa valeur initiale ?`,
      choices, answer,
      explanation: `La valeur finale est égale à la valeur initiale multipliée par ${formatNumber(1 + rate / 100)}. Donc ${formatNumber(final)} ÷ ${formatNumber(1 + rate / 100)} = ${initial}.`
    };
  }

  function reciprocalRate(rng) {
    const rate = pick([-50, -25, -20, -10, 10, 20, 25, 50], rng);
    const coefficient = 1 + rate / 100;
    const reciprocal = (1 / coefficient - 1) * 100;
    const good = `${reciprocal >= 0 ? "+" : "−"}${formatNumber(Math.abs(reciprocal), 1)} %`;
    const { choices, answer } = makeChoices(good, [
      `${rate >= 0 ? "−" : "+"}${Math.abs(rate)} %`,
      `${reciprocal >= 0 ? "+" : "−"}${formatNumber(Math.abs(reciprocal) + 10, 1)} %`,
      `${rate >= 0 ? "+" : "−"}${Math.abs(rate)} %`
    ], rng);
    return {
      kind: "reciprocal-rate",
      skill: "evolutions",
      prompt: `Quel taux permet d'annuler exactement une évolution de ${rate >= 0 ? "+" : "−"}${Math.abs(rate)} % ?`,
      choices, answer,
      explanation: `Le coefficient réciproque est 1 ÷ ${formatNumber(coefficient)} = ${formatNumber(1 / coefficient, 3)}, soit un taux de ${good}.`
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
    const family = pick(["simple", "reduction", "product"], rng);
    if (family === "simple") {
      const k = pick([2, 3, 4, 5], rng);
      const a = randInt(2, 5, rng);
      const constant = pick([-6, -4, 2, 3, 5], rng);
      const good = affineExpression(k * a, k * constant);
      const { choices, answer } = makeChoices(good, [
        affineExpression(k * a, constant),
        affineExpression(a, k * constant),
        affineExpression(k + a, constant)
      ], rng);
      return {
        kind: "develop-expression",
        skill: "algebra",
        prompt: `Développer et réduire : ${k}(${affineExpression(a, constant)}).`,
        choices, answer,
        explanation: `On distribue ${k} à chacun des termes : ${k}(${affineExpression(a, constant)}) = ${good}.`
      };
    }

    if (family === "reduction") {
      const k = pick([2, 3, 4, 5], rng);
      const a = randInt(2, 5, rng);
      const constant = pick([-6, -4, 2, 3, 5], rng);
      const m = randInt(2, 5, rng);
      const good = affineExpression(k * a + m, k * constant);
      const { choices, answer } = makeChoices(good, [
        affineExpression(k * a, k * constant),
        affineExpression(k * a + m, constant),
        affineExpression(k + a + m, k * constant)
      ], rng);
      return {
        kind: "develop-expression",
        skill: "algebra",
        prompt: `Développer et réduire : ${k}(${affineExpression(a, constant)}) + ${m}x.`,
        choices, answer,
        explanation: `${k}(${affineExpression(a, constant)}) = ${affineExpression(k * a, k * constant)} ; puis on réduit les termes en x : ${good}.`
      };
    }

    const firstConstant = randInt(2, 6, rng);
    const secondConstant = randInt(1, 5, rng);
    const good = polynomialExpression(1, firstConstant - secondConstant, -firstConstant * secondConstant);
    const { choices, answer } = makeChoices(good, [
      polynomialExpression(1, firstConstant + secondConstant, -firstConstant * secondConstant),
      polynomialExpression(1, firstConstant - secondConstant, firstConstant * secondConstant),
      affineExpression(firstConstant - secondConstant, -firstConstant * secondConstant)
    ], rng);
    return {
      kind: "develop-expression",
      skill: "algebra",
      prompt: `Développer et réduire : (x + ${firstConstant})(x − ${secondConstant}).`,
      choices, answer,
      explanation: `(x + ${firstConstant})(x − ${secondConstant}) = x² − ${secondConstant}x + ${firstConstant}x − ${firstConstant * secondConstant} = ${good}.`
    };
  }

  function factorExpression(rng) {
    const factorValue = pick([2, 3, 4, 5, 6], rng);
    const constant = randInt(2, 8, rng);
    const good = `${factorValue}(x + ${constant})`;
    const { choices, answer } = makeChoices(good, [
      `${factorValue}(x + ${factorValue * constant})`,
      `x(${factorValue} + ${factorValue * constant})`,
      `${factorValue}x(x + ${constant})`
    ], rng);
    return {
      kind: "factor-expression",
      skill: "algebra",
      prompt: `Factoriser : ${factorValue}x + ${factorValue * constant}.`,
      choices, answer,
      explanation: `${factorValue} est un facteur commun : ${factorValue}x + ${factorValue * constant} = ${good}.`
    };
  }

  function linearSign(rng) {
    const coefficient = pick([-5, -4, -3, -2, 2, 3, 4, 5], rng);
    const root = randInt(-5, 5, rng);
    const constant = -coefficient * root;
    const expression = affineExpression(coefficient, constant);
    const askPositive = rng() < 0.5;
    const greater = askPositive ? coefficient > 0 : coefficient < 0;
    const good = `x ${greater ? ">" : "<"} ${root}`;
    const { choices, answer } = makeChoices(good, [
      `x ${greater ? "<" : ">"} ${root}`,
      `x ${greater ? "≥" : "≤"} ${root}`,
      `x ${greater ? ">" : "<"} ${-root}`
    ], rng);
    return {
      kind: "linear-sign",
      skill: "algebra",
      prompt: `Pour quelles valeurs de x l'expression ${expression} est-elle strictement ${askPositive ? "positive" : "négative"} ?`,
      choices, answer,
      explanation: `${expression} s'annule en ${root}. Son coefficient directeur est ${coefficient > 0 ? "positif" : "négatif"}, donc l'expression est ${askPositive ? "positive" : "négative"} pour ${good}.`
    };
  }

  function factorizedSign(rng) {
    const firstRoot = randInt(-6, -1, rng);
    const secondRoot = randInt(1, 6, rng);
    const coefficient = pick([-3, -2, -1, 1, 2, 3], rng);
    const leading = coefficient === 1 ? "" : coefficient === -1 ? "−" : String(coefficient);
    const expression = `${leading}(x ${firstRoot < 0 ? "+" : "−"} ${Math.abs(firstRoot)})(x − ${secondRoot})`;
    const askPositive = rng() < 0.5;
    const exterior = `x < ${firstRoot} ou x > ${secondRoot}`;
    const interior = `${firstRoot} < x < ${secondRoot}`;
    const good = askPositive === (coefficient > 0) ? exterior : interior;
    const { choices, answer } = makeChoices(good, askPositive
      ? [interior, `x > ${firstRoot}`, `x < ${secondRoot}`]
      : [exterior, `x > ${firstRoot}`, `x < ${secondRoot}`], rng);
    return {
      kind: "factorized-sign",
      skill: "algebra",
      prompt: `Quand l'expression ${expression} est-elle strictement ${askPositive ? "positive" : "négative"} ?`,
      choices, answer,
      explanation: `Les deux facteurs ont le même signe à l'extérieur des racines ${firstRoot} et ${secondRoot}, et des signes contraires entre elles.${coefficient < 0 ? " Le coefficient négatif inverse le signe du produit." : ""} L'expression est donc ${askPositive ? "positive" : "négative"} pour ${good}.`
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

  function graphLineEquation(rng) {
    const slope = pick([-2, -1, 1, 2], rng);
    const intercept = randInt(-2, 2, rng);
    const good = `y = ${affineExpression(slope, intercept)}`;
    const { choices, answer } = makeChoices(good, [
      `y = ${affineExpression(-slope, intercept)}`,
      `y = ${affineExpression(slope, intercept + (intercept === 2 ? -1 : 1))}`,
      `y = ${affineExpression(slope + (slope > 0 ? 1 : -1), intercept)}`
    ], rng);
    return {
      kind: "graph-line-equation",
      skill: "functions",
      prompt: "Quelle équation réduite correspond à la droite représentée ?",
      choices, answer,
      visual: `<canvas class="question-plot" data-plot="line" data-slope="${slope}" data-intercept="${intercept}" role="img" aria-label="Droite d'équation à déterminer dans un repère gradué"></canvas>`,
      explanation: `La droite coupe l'axe des ordonnées en ${intercept} et monte de ${slope} quand x augmente de 1 : ${good}.`
    };
  }

  function graphEquationReading(rng) {
    const slope = pick([-2, -1, 1, 2], rng);
    const intercept = randInt(-2, 2, rng);
    const solution = randInt(-3, 3, rng);
    const level = slope * solution + intercept;
    const { choices, answer } = makeChoices(solution, [-solution, solution + 1, level], rng);
    return {
      kind: "graph-equation-reading",
      skill: "functions",
      prompt: `À l'aide du graphique, résoudre f(x) = ${level}.`,
      choices, answer,
      visual: `<canvas class="question-plot" data-plot="line" data-slope="${slope}" data-intercept="${intercept}" data-level="${level}" role="img" aria-label="Graphique d'une fonction affine et niveau horizontal ${level}"></canvas>`,
      explanation: `La droite horizontale d'ordonnée ${level} rencontre la courbe au point d'abscisse ${solution}.`
    };
  }

  function graphSign(rng) {
    const slope = pick([-2, -1, 1, 2], rng);
    const root = randInt(-3, 3, rng);
    const intercept = -slope * root;
    const askPositive = rng() < 0.5;
    const greater = askPositive ? slope > 0 : slope < 0;
    const good = `x ${greater ? ">" : "<"} ${root}`;
    const { choices, answer } = makeChoices(good, [
      `x ${greater ? "<" : ">"} ${root}`,
      `x ${greater ? "≥" : "≤"} ${root}`,
      `x ${greater ? ">" : "<"} ${-root}`
    ], rng);
    return {
      kind: "graph-sign-reading",
      skill: "functions",
      prompt: `Pour quelles valeurs de x la fonction représentée est-elle strictement ${askPositive ? "positive" : "négative"} ?`,
      choices, answer,
      visual: `<canvas class="question-plot" data-plot="line" data-slope="${slope}" data-intercept="${intercept}" role="img" aria-label="Graphique d'une fonction affine dans un repère gradué"></canvas>`,
      explanation: `La courbe coupe l'axe des abscisses en ${root} et se trouve ${askPositive ? "au-dessus" : "au-dessous"} de cet axe pour ${good}.`
    };
  }

  function quadraticVertex(rng) {
    const coefficient = pick([-2, -1, 1, 2], rng);
    const abscissa = randInt(-4, 4, rng);
    const ordinate = randInt(-5, 5, rng);
    const shifted = abscissa === 0 ? "x" : `(x ${abscissa > 0 ? "−" : "+"} ${Math.abs(abscissa)})`;
    const leading = coefficient === 1 ? "" : coefficient === -1 ? "−" : String(coefficient);
    const expression = `${leading}${shifted}²${ordinate === 0 ? "" : ` ${ordinate > 0 ? "+" : "−"} ${Math.abs(ordinate)}`}`;
    const good = `S(${abscissa} ; ${ordinate})`;
    const { choices, answer } = makeChoices(good, [
      `S(${-abscissa} ; ${ordinate})`,
      `S(${abscissa} ; ${-ordinate})`,
      `S(${ordinate} ; ${abscissa})`
    ], rng);
    return {
      kind: "quadratic-vertex",
      skill: "functions",
      prompt: `Quel est le sommet de la parabole représentant f(x) = ${expression} ?`,
      choices, answer,
      explanation: `La forme ${coefficient}(x − ${abscissa})² + ${ordinate} donne directement le sommet ${good}.`
    };
  }

  function quadraticRoots(rng) {
    const firstRoot = randInt(-6, -1, rng);
    const secondRoot = randInt(1, 6, rng);
    const coefficient = pick([-2, -1, 1, 2], rng);
    const expression = `${coefficient === 1 ? "" : coefficient === -1 ? "−" : coefficient}${linearFactor(-firstRoot)}${linearFactor(-secondRoot)}`;
    const good = `x = ${firstRoot} ou x = ${secondRoot}`;
    const { choices, answer } = makeChoices(good, [
      `x = ${-firstRoot} ou x = ${-secondRoot}`,
      `x = ${firstRoot + 1} ou x = ${secondRoot}`,
      `x = ${firstRoot * secondRoot}`
    ], rng);
    return {
      kind: "quadratic-roots",
      skill: "functions",
      prompt: `Quelles sont les racines de f(x) = ${expression} ?`,
      choices, answer,
      explanation: `Chaque facteur s'annule pour l'une des deux valeurs : ${good}. Aucun discriminant n'est nécessaire.`
    };
  }

  function variationTable(rng) {
    const vertex = randInt(-3, 3, rng);
    const minimum = rng() < 0.5;
    const leftValue = randInt(5, 12, rng);
    const centerValue = minimum ? randInt(-4, 2, rng) : leftValue;
    const edgeValue = minimum ? leftValue : randInt(-4, 2, rng);
    const values = minimum ? [leftValue, centerValue, leftValue + 2] : [edgeValue, leftValue, edgeValue - 2];
    const good = minimum ? `]−∞ ; ${vertex}]` : `[${vertex} ; +∞[`;
    const { choices, answer } = makeChoices(good, [
      minimum ? `[${vertex} ; +∞[` : `]−∞ ; ${vertex}]`,
      "Sur ℝ tout entier",
      "Sur aucun intervalle"
    ], rng);
    const arrowId = `variation-arrow-${vertex}-${minimum ? "min" : "max"}`;
    const layout = minimum
      ? {
          arrows: { leftY: 56, centerY: 86, rightY: 38 },
          labels: { leftY: 44, centerY: 111, rightY: 26 }
        }
      : {
          arrows: { leftY: 94, centerY: 56, rightY: 102 },
          labels: { leftY: 82, centerY: 25, rightY: 90 }
        };
    const variationVisual = `<svg class="variation-svg" viewBox="0 0 430 128" role="img" aria-label="Tableau de variations : f décroît ${minimum ? "jusqu'à" : "après"} ${vertex}">
      <defs><marker id="${arrowId}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" /></marker></defs>
      <path class="variation-grid" d="M56 10V118 M56 42H420" />
      <text class="variation-axis" x="24" y="31">x</text>
      <text class="variation-axis" x="18" y="91">f(x)</text>
      <text class="variation-x" x="92" y="31">−∞</text>
      <text class="variation-x" x="214" y="31">${vertex}</text>
      <text class="variation-x" x="357" y="31">+∞</text>
      <line class="variation-arrow" x1="100" y1="${layout.arrows.leftY}" x2="207" y2="${layout.arrows.centerY}" marker-end="url(#${arrowId})" />
      <line class="variation-arrow" x1="235" y1="${layout.arrows.centerY}" x2="350" y2="${layout.arrows.rightY}" marker-end="url(#${arrowId})" />
      <text class="variation-value" x="76" y="${layout.labels.leftY}">${values[0]}</text>
      <text class="variation-value" x="221" y="${layout.labels.centerY}">${values[1]}</text>
      <text class="variation-value" x="362" y="${layout.labels.rightY}">${values[2]}</text>
    </svg>`;
    return {
      kind: "variation-reading",
      skill: "functions",
      prompt: "Sur quel intervalle la fonction est-elle décroissante d'après ce tableau de variations ?",
      choices, answer,
      visual: variationVisual,
      explanation: `Les flèches montrent que f décroît sur ${good}.`
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

  function explicitSequenceTerm(rng) {
    const geometric = rng() < 0.5;
    const rank = randInt(3, 7, rng);
    if (geometric) {
      const start = randInt(1, 4, rng);
      const ratio = pick([2, 3], rng);
      const good = start * ratio ** rank;
      const { choices, answer } = makeChoices(good, [start * ratio * rank, start + ratio ** rank, start * ratio ** (rank - 1)], rng);
      return {
        kind: "explicit-sequence-term",
        skill: "sequences",
        prompt: `La suite est définie par uₙ = ${coefficientTimes(start, `${ratio}ⁿ`)}. Calculer u${subscript(rank)}.`,
        choices, answer,
        explanation: `u${subscript(rank)} = ${coefficientTimes(start, `${ratio}${superscript(rank)}`)} = ${good}.`
      };
    }
    const start = randInt(-5, 8, rng);
    const step = pick([-4, -3, 2, 3, 5], rng);
    const good = start + step * rank;
    const { choices, answer } = makeChoices(good, [start + step * (rank - 1), (start + step) * rank, start + step + rank], rng);
    return {
      kind: "explicit-sequence-term",
      skill: "sequences",
      prompt: `La suite est définie par uₙ = ${start} ${step >= 0 ? "+" : "−"} ${Math.abs(step)}n. Calculer u${subscript(rank)}.`,
      choices, answer,
      explanation: `On remplace n par ${rank} : ${start} ${step >= 0 ? "+" : "−"} ${Math.abs(step)} × ${rank} = ${good}.`
    };
  }

  function recurrentSequenceTerm(rng) {
    const start = randInt(1, 8, rng);
    const step = pick([-3, -2, 2, 3, 4], rng);
    const rank = randInt(3, 6, rng);
    const good = start + rank * step;
    const { choices, answer } = makeChoices(good, [start + (rank - 1) * step, start + (rank + 1) * step, start * step * rank], rng);
    return {
      kind: "recurrent-sequence-term",
      skill: "sequences",
      prompt: `On a u₀ = ${start} et uₙ₊₁ = uₙ ${step >= 0 ? "+" : "−"} ${Math.abs(step)}. Calculer u${subscript(rank)}.`,
      choices, answer,
      explanation: `Entre u₀ et u${subscript(rank)}, on ajoute ${step} exactement ${rank} fois : ${start} ${step >= 0 ? "+" : "−"} ${rank * Math.abs(step)} = ${good}.`
    };
  }

  function sequenceNature(rng) {
    const geometric = rng() < 0.5;
    const start = randInt(1, 5, rng);
    const reason = geometric ? pick([2, 3, 4], rng) : pick([2, 3, 5, 7], rng);
    const values = Array.from({ length: 4 }, (_, index) => geometric ? start * reason ** index : start + reason * index);
    const good = geometric ? `Géométrique de raison ${reason}` : `Arithmétique de raison ${reason}`;
    const { choices, answer } = makeChoices(good, [
      geometric ? `Arithmétique de raison ${reason}` : `Géométrique de raison ${reason}`,
      geometric ? `Géométrique de raison ${reason + 1}` : `Arithmétique de raison ${reason + 1}`,
      "Ni arithmétique ni géométrique"
    ], rng);
    return {
      kind: "sequence-nature",
      skill: "sequences",
      prompt: `Identifier la nature de la suite : ${values.join(" ; ")} ; …`,
      choices, answer,
      explanation: geometric
        ? `Chaque terme est obtenu en multipliant le précédent par ${reason}.`
        : `La différence entre deux termes consécutifs vaut toujours ${reason}.`
    };
  }

  function sequenceVariation(rng) {
    const geometric = rng() < 0.5;
    if (geometric) {
      const ratio = pick([0.5, 0.8, 1.2, 1.5, 2], rng);
      const good = ratio > 1 ? "Strictement croissante" : "Strictement décroissante";
      const { choices, answer } = makeChoices(good, [good === "Strictement croissante" ? "Strictement décroissante" : "Strictement croissante", "Constante", "On ne peut pas savoir"], rng);
      return { kind: "sequence-variation", skill: "sequences", prompt: `Une suite géométrique à termes strictement positifs a pour raison q = ${formatNumber(ratio)}. Quel est son sens de variation ?`, choices, answer, explanation: `Comme q est ${ratio > 1 ? "supérieur" : "compris entre 0 et"} 1, la suite est ${good.toLowerCase()}.` };
    }
    const reason = pick([-5, -3, 2, 4, 7], rng);
    const good = reason > 0 ? "Strictement croissante" : "Strictement décroissante";
    const { choices, answer } = makeChoices(good, [good === "Strictement croissante" ? "Strictement décroissante" : "Strictement croissante", "Constante", "On ne peut pas savoir"], rng);
    return { kind: "sequence-variation", skill: "sequences", prompt: `Une suite arithmétique a pour raison r = ${reason}. Quel est son sens de variation ?`, choices, answer, explanation: `Le signe de la raison donne le sens de variation : r est ${reason > 0 ? "positif" : "négatif"}, donc la suite est ${good.toLowerCase()}.` };
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

  function cubicDerivative(rng) {
    const a = pick([-3, -2, -1, 1, 2, 3], rng);
    const b = pick([-4, -3, -2, 2, 3, 4], rng);
    const c = randInt(-6, 6, rng);
    const d = randInt(-8, 8, rng);
    const expression = cubicExpression(a, b, c, d);
    const good = polynomialExpression(3 * a, 2 * b, c);
    const { choices, answer } = makeChoices(good, [
      polynomialExpression(a, 2 * b, c),
      polynomialExpression(3 * a, b, d),
      cubicExpression(3 * a, 2 * b, c, 0)
    ], rng);
    return {
      kind: "cubic-derivative",
      skill: "derivatives",
      prompt: `Soit f(x) = ${expression}. Quelle est sa fonction dérivée ?`,
      choices, answer,
      explanation: `On dérive terme à terme : (ax³)' = 3ax², (bx²)' = 2bx et la constante disparaît. Ainsi f′(x) = ${good}.`
    };
  }

  function tangentEquation(rng) {
    const a = pick([-2, -1, 1, 2], rng);
    const b = randInt(-4, 4, rng);
    const c = randInt(-5, 5, rng);
    const x0 = randInt(-3, 3, rng);
    const y0 = a * x0 ** 2 + b * x0 + c;
    const slope = 2 * a * x0 + b;
    const intercept = y0 - slope * x0;
    const good = `y = ${affineExpression(slope, intercept)}`;
    const { choices, answer } = makeChoices(good, [
      `y = ${affineExpression(-slope, intercept)}`,
      `y = ${affineExpression(slope, y0)}`,
      `y = ${affineExpression(2 * a, c)}`
    ], rng);
    return {
      kind: "tangent-equation",
      skill: "derivatives",
      prompt: `Pour f(x) = ${polynomialExpression(a, b, c)}, déterminer l'équation de la tangente au point d'abscisse ${x0}.`,
      choices, answer,
      explanation: `f′(${x0}) = ${slope} et f(${x0}) = ${y0}. La tangente vérifie y = ${slope}(x − ${x0}) + ${y0}, soit ${good}.`
    };
  }

  function derivativeVariation(rng) {
    const coefficient = pick([-4, -3, -2, 2, 3, 4], rng);
    const root = randInt(-4, 4, rng);
    const derivative = `${coefficient}${linearFactor(-root)}`;
    const good = coefficient > 0
      ? `Décroissante sur ]−∞ ; ${root}] puis croissante sur [${root} ; +∞[`
      : `Croissante sur ]−∞ ; ${root}] puis décroissante sur [${root} ; +∞[`;
    const { choices, answer } = makeChoices(good, [
      coefficient > 0
        ? `Croissante sur ]−∞ ; ${root}] puis décroissante sur [${root} ; +∞[`
        : `Décroissante sur ]−∞ ; ${root}] puis croissante sur [${root} ; +∞[`,
      "Croissante sur ℝ",
      "Décroissante sur ℝ"
    ], rng);
    return {
      kind: "derivative-variation",
      skill: "derivatives",
      prompt: `On sait que f′(x) = ${derivative}. Quelles sont les variations de f ?`,
      choices, answer,
      explanation: `La dérivée s'annule en ${root} et change de signe à cette valeur. On obtient : ${good.toLowerCase()}.`
    };
  }

  function meanSeries(rng) {
    const values = Array.from({ length: 4 }, () => randInt(4, 18, rng));
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const { choices, answer } = makeChoices(formatNumber(mean), [formatNumber(sum / 5), formatNumber(mean + 1), formatNumber(values.sort((a,b)=>a-b)[1])], rng);
    return { kind: "series-mean", skill: "statistics", prompt: `Quelle est la moyenne de la série : ${values.join(" ; ")} ?`, choices, answer, explanation: `La somme vaut ${sum}. La moyenne est ${sum} ÷ 4 = ${formatNumber(mean)}.` };
  }

  function histogramReading(rng) {
    const values = Array.from({ length: 4 }, () => randInt(3, 12, rng));
    const labels = ["A", "B", "C", "D"];
    const good = values.reduce((sum, value) => sum + value, 0);
    const { choices, answer } = makeChoices(good, [Math.max(...values), Math.round(good / 4), good - values[0]], rng);
    const maximum = Math.max(...values);
    return {
      kind: "histogram-reading",
      skill: "statistics",
      prompt: "Combien d'éléments sont représentés au total par ce diagramme en barres ?",
      choices, answer,
      visual: `<div class="mini-bars" role="img" aria-label="Diagramme en barres : ${values.map((value, index) => `${labels[index]} ${value}`).join(", ")}">${values.map((value, index) => `<div><span style="--bar-height:${Math.round(value / maximum * 100)}%"><b>${value}</b></span><small>${labels[index]}</small></div>`).join("")}</div>`,
      explanation: `On additionne les quatre effectifs : ${values.join(" + ")} = ${good}.`
    };
  }

  function meanPoint(rng) {
    const meanX = randInt(-2, 6, rng);
    const meanY = randInt(2, 12, rng);
    const points = [[meanX - 3, meanY - 1], [meanX - 1, meanY + 2], [meanX + 1, meanY - 2], [meanX + 3, meanY + 1]];
    const good = `G(${meanX} ; ${meanY})`;
    const { choices, answer } = makeChoices(good, [
      `G(${meanY} ; ${meanX})`,
      `G(${meanX + 1} ; ${meanY})`,
      `G(${meanX} ; ${meanY + 1})`
    ], rng);
    return {
      kind: "bivariate-mean-point",
      skill: "statistics",
      prompt: `Quel est le point moyen du nuage constitué des points ${points.map(([x, y]) => `(${x} ; ${y})`).join(", ")} ?`,
      choices, answer,
      explanation: `La moyenne des abscisses vaut ${meanX} et celle des ordonnées vaut ${meanY}. Le point moyen est ${good}.`
    };
  }

  function affineAdjustment(rng) {
    const slope = pick([1, 2, 3, 4], rng);
    const intercept = randInt(-4, 8, rng);
    const input = randInt(5, 15, rng);
    const good = slope * input + intercept;
    const { choices, answer } = makeChoices(formatNumber(good), [
      formatNumber(slope + input + intercept),
      formatNumber(slope * (input + intercept)),
      formatNumber(good + slope)
    ], rng);
    return {
      kind: "affine-adjustment",
      skill: "statistics",
      prompt: `Un ajustement affine d'un nuage est donné par y = ${affineExpression(slope, intercept)}. Quelle valeur estime-t-il pour x = ${input} ?`,
      choices, answer,
      explanation: `On remplace x par ${input} : y = ${coefficientTimes(slope, input)}${intercept === 0 ? "" : ` ${intercept > 0 ? "+" : "−"} ${Math.abs(intercept)}`} = ${formatNumber(good)}.`
    };
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

  function totalProbability(rng) {
    const pA = pick([0.2, 0.3, 0.4, 0.6, 0.7], rng);
    const pGivenA = pick([0.2, 0.4, 0.5, 0.7, 0.8], rng);
    const pGivenNotA = pick([0.1, 0.3, 0.5, 0.6], rng);
    const good = pA * pGivenA + (1 - pA) * pGivenNotA;
    const { choices, answer } = makeChoices(formatNumber(good, 2), [
      formatNumber(pA * pGivenA, 2),
      formatNumber(pGivenA + pGivenNotA, 2),
      formatNumber(1 - good, 2)
    ], rng);
    return {
      kind: "total-probability",
      skill: "probability",
      prompt: `P(A) = ${formatNumber(pA)}, P(B|A) = ${formatNumber(pGivenA)} et P(B|Ā) = ${formatNumber(pGivenNotA)}. Calculer P(B).`,
      choices, answer,
      explanation: `P(B) = P(A)P(B|A) + P(Ā)P(B|Ā) = ${formatNumber(pA)} × ${formatNumber(pGivenA)} + ${formatNumber(1 - pA)} × ${formatNumber(pGivenNotA)} = ${formatNumber(good, 2)}.`
    };
  }

  function bernoulliRepetition(rng) {
    const probability = pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8], rng);
    const repetitions = randInt(2, 4, rng);
    const askSuccesses = rng() < 0.5;
    const base = askSuccesses ? probability : 1 - probability;
    const good = base ** repetitions;
    const { choices, answer } = makeChoices(formatNumber(good, 4), [
      formatNumber(base * repetitions, 4),
      formatNumber(1 - good, 4),
      formatNumber(probability * (1 - probability), 4)
    ], rng);
    return {
      kind: "bernoulli-repetition",
      skill: "probability",
      prompt: `Une épreuve de Bernoulli de probabilité de succès p = ${formatNumber(probability)} est répétée ${repetitions} fois indépendamment. Quelle est la probabilité de n'obtenir ${askSuccesses ? "que des succès" : "aucun succès"} ?`,
      choices, answer,
      explanation: `Les épreuves sont indépendantes : on multiplie ${formatNumber(base)} par lui-même ${repetitions} fois, soit ${formatNumber(good, 4)}.`
    };
  }

  function randomExpectation(rng) {
    const p0 = pick([0.2, 0.3, 0.4], rng);
    const p1 = pick([0.2, 0.3, 0.4], rng);
    const p2 = Math.round((1 - p0 - p1) * 10) / 10;
    if (p2 <= 0) return randomExpectation(rng);
    const values = [0, 2, 5];
    const expectation = values[1] * p1 + values[2] * p2;
    const { choices, answer } = makeChoices(formatNumber(expectation, 2), [
      formatNumber((values[0] + values[1] + values[2]) / 3, 2),
      formatNumber(p1 + p2, 2),
      formatNumber(expectation + 1, 2)
    ], rng);
    return {
      kind: "random-expectation",
      skill: "probability",
      prompt: "Calculer l'espérance de la variable aléatoire X donnée par cette loi.",
      choices, answer,
      visual: `<table aria-label="Loi de probabilité de X"><tr><th>x</th>${values.map(value => `<td>${value}</td>`).join("")}</tr><tr><th>P(X = x)</th><td>${formatNumber(p0)}</td><td>${formatNumber(p1)}</td><td>${formatNumber(p2)}</td></tr></table>`,
      explanation: `E(X) = 0 × ${formatNumber(p0)} + 2 × ${formatNumber(p1)} + 5 × ${formatNumber(p2)} = ${formatNumber(expectation, 2)}.`
    };
  }

  function randomEvent(rng) {
    const p0 = pick([0.1, 0.2, 0.3], rng);
    const p1 = pick([0.2, 0.3, 0.4], rng);
    const p2 = Math.round((1 - p0 - p1) * 10) / 10;
    const good = p0 + p1;
    const { choices, answer } = makeChoices(formatNumber(good, 2), [formatNumber(p1, 2), formatNumber(p2, 2), formatNumber(1 - good, 2)], rng);
    return {
      kind: "random-event",
      skill: "probability",
      prompt: "D'après cette loi, calculer P(X ≤ 1).",
      choices, answer,
      visual: `<table aria-label="Loi de probabilité de X"><tr><th>x</th><td>0</td><td>1</td><td>2</td></tr><tr><th>P(X = x)</th><td>${formatNumber(p0)}</td><td>${formatNumber(p1)}</td><td>${formatNumber(p2)}</td></tr></table>`,
      explanation: `L'événement X ≤ 1 regroupe X = 0 et X = 1 : ${formatNumber(p0)} + ${formatNumber(p1)} = ${formatNumber(good, 2)}.`
    };
  }

  function pythonAccumulator(rng) {
    const limit = randInt(4, 8, rng);
    const good = limit * (limit + 1) / 2;
    const { choices, answer } = makeChoices(good, [limit ** 2, good - limit, good + 1], rng);
    return {
      kind: "python-accumulator",
      skill: "algorithmics",
      prompt: "Quelle valeur ce programme affiche-t-il ?",
      choices, answer,
      visual: `<pre class="code-panel" aria-label="Programme Python">total = 0\nfor n in range(1, ${limit + 1}):\n    total = total + n\nprint(total)</pre>`,
      explanation: `L'accumulateur additionne les entiers de 1 à ${limit} : ${Array.from({ length: limit }, (_, index) => index + 1).join(" + ")} = ${good}.`
    };
  }

  function pythonList(rng) {
    const limit = randInt(7, 12, rng);
    const values = Array.from({ length: limit - 1 }, (_, index) => index + 1).filter(value => value % 2 === 0);
    const good = `[${values.join(", ")}]`;
    const { choices, answer } = makeChoices(good, [
      `[${values.map(value => value - 1).join(", ")}]`,
      `[${[...values, limit % 2 === 0 ? limit : limit + 1].join(", ")}]`,
      `[${Array.from({ length: limit }, (_, index) => index + 1).join(", ")}]`
    ], rng);
    return {
      kind: "python-list",
      skill: "algorithmics",
      prompt: "Quelle liste est créée par cette instruction Python ?",
      choices, answer,
      visual: `<pre class="code-panel" aria-label="Instruction Python">valeurs = [n for n in range(1, ${limit}) if n % 2 == 0]</pre>`,
      explanation: `La compréhension conserve les entiers pairs de 1 inclus à ${limit} exclu : ${good}.`
    };
  }

  function pythonFunction(rng) {
    const power = randInt(2, 8, rng);
    const duration = randInt(2, 6, rng);
    const offset = randInt(1, 5, rng);
    const good = power * duration + offset;
    const { choices, answer } = makeChoices(good, [power + duration + offset, power * (duration + offset), power * duration], rng);
    return {
      kind: "python-function",
      skill: "algorithmics",
      prompt: `Quelle valeur renvoie energie(${power}, ${duration}) ?`,
      choices, answer,
      visual: `<pre class="code-panel" aria-label="Fonction Python">def energie(puissance, duree):\n    resultat = puissance * duree + ${offset}\n    return resultat</pre>`,
      explanation: `Les entrées sont puissance = ${power} et duree = ${duration}. La sortie vaut ${power} × ${duration} + ${offset} = ${good}.`
    };
  }

  function spreadsheetFormula(rng) {
    const row = randInt(2, 6, rng);
    const good = `=B${row}*C${row}`;
    const { choices, answer } = makeChoices(good, [`=B${row}+C${row}`, `=B${row - 1}*C${row - 1}`, `B${row}*C${row}`], rng);
    return {
      kind: "spreadsheet-formula",
      skill: "algorithmics",
      prompt: `Dans un tableur, la colonne B contient une quantité et la colonne C un prix unitaire. Quelle formule calcule le coût total à la ligne ${row} ?`,
      choices, answer,
      explanation: `Une formule commence par = et multiplie les deux cellules de la même ligne : ${good}.`
    };
  }

  function dataFilter(rng) {
    const threshold = randInt(50, 80, rng);
    const values = [threshold - 15, threshold + 5, threshold + 18, threshold - 2, threshold + 11];
    const good = values.filter(value => value >= threshold).length;
    const { choices, answer } = makeChoices(good, [good - 1, good + 1, values.length], rng);
    return {
      kind: "data-filter",
      skill: "algorithmics",
      prompt: `On filtre les mesures supérieures ou égales à ${threshold}. Combien de colonnes seront conservées ?`,
      choices, answer,
      visual: `<table aria-label="Données brutes"><tr><th>Capteur</th>${values.map((_, index) => `<td>C${index + 1}</td>`).join("")}</tr><tr><th>Mesure</th>${values.map(value => `<td>${value}</td>`).join("")}</tr></table>`,
      explanation: `${values.filter(value => value >= threshold).join(", ")} sont supérieures ou égales à ${threshold}, soit ${good} colonnes.`
    };
  }

  function pythonBernoulli(rng) {
    const probability = pick([0.2, 0.3, 0.4, 0.6, 0.8], rng);
    const pythonProbability = String(probability);
    const good = `random() < ${pythonProbability}`;
    const { choices, answer } = makeChoices(good, [
      `random() > ${pythonProbability}`,
      `random() == ${pythonProbability}`,
      `random() < ${String(Math.round((1 - probability) * 10) / 10)}`
    ], rng);
    return {
      kind: "python-bernoulli",
      skill: "algorithmics",
      prompt: `Quelle condition Python simule un succès de probabilité ${formatNumber(probability)} avec random(), qui renvoie un réel uniforme entre 0 et 1 ?`,
      choices, answer,
      explanation: `L'intervalle [0 ; ${formatNumber(probability)}[ occupe une proportion ${formatNumber(probability)} de [0 ; 1[ : la condition correcte est ${good}.`
    };
  }

  function rawDataCrossTable(rng) {
    const rows = shuffle([
      ["A", "Conforme"], ["A", "Conforme"], ["A", "Non conforme"],
      ["B", "Conforme"], ["B", "Non conforme"], ["B", "Non conforme"]
    ], rng);
    const askLine = rng() < 0.5 ? "A" : "B";
    const askStatus = rng() < 0.5 ? "Conforme" : "Non conforme";
    const good = rows.filter(([line, status]) => line === askLine && status === askStatus).length;
    const { choices, answer } = makeChoices(good, [good + 1, Math.max(0, good - 1), rows.filter(([line]) => line === askLine).length], rng);
    return {
      kind: "raw-data-cross-table",
      skill: "algorithmics",
      prompt: `Dans un tableau croisé « ligne × conformité », quel effectif placer dans la case Ligne ${askLine} / ${askStatus} ?`,
      choices, answer,
      visual: `<table aria-label="Données brutes à croiser"><tr><th>Pièce</th><th>Ligne</th><th>Contrôle</th></tr>${rows.map(([line, status], index) => `<tr><td>${index + 1}</td><td>${line}</td><td>${status}</td></tr>`).join("")}</table>`,
      explanation: `On compte les lignes vérifiant simultanément les deux critères : il y en a ${good}.`
    };
  }

  const GENERATORS = {
    energy: [proportionValue, ratioShare, fractionCalculation, operationPriority, scientificNotation, powerRule, percentFinal, percentRate, successiveRates, percentInitial, reciprocalRate, metricConversion, durationConversion, functionImage],
    factory: [zeroProduct, developExpression, slopeFromPoints, nextSequence, derivativePolynomial, setIntersection, logicalCondition, reciprocalStatement, counterexample, factorExpression, linearSign, factorizedSign, graphLineEquation, graphEquationReading, graphSign, quadraticVertex, quadraticRoots, variationTable, explicitSequenceTerm, recurrentSequenceTerm, sequenceNature, sequenceVariation, cubicDerivative, tangentEquation, derivativeVariation],
    data: [meanSeries, conditionalProbability, independentEvents, histogramReading, meanPoint, affineAdjustment, totalProbability, bernoulliRepetition, randomExpectation, randomEvent, pythonAccumulator, pythonList, pythonFunction, spreadsheetFormula, dataFilter, pythonBernoulli, rawDataCrossTable]
  };

  const SKILL_GENERATORS = {
    proportions: [proportionValue, ratioShare],
    numeric: [fractionCalculation, operationPriority, scientificNotation, powerRule],
    evolutions: [percentFinal, percentRate, successiveRates, percentInitial, reciprocalRate],
    units: [metricConversion, durationConversion],
    logic: [setIntersection, logicalCondition, reciprocalStatement, counterexample],
    algebra: [zeroProduct, developExpression, factorExpression, linearSign, factorizedSign],
    functions: [slopeFromPoints, functionImage, graphLineEquation, graphEquationReading, graphSign, quadraticVertex, quadraticRoots, variationTable],
    sequences: [nextSequence, explicitSequenceTerm, recurrentSequenceTerm, sequenceNature, sequenceVariation],
    derivatives: [derivativePolynomial, cubicDerivative, tangentEquation, derivativeVariation],
    statistics: [meanSeries, histogramReading, meanPoint, affineAdjustment],
    probability: [conditionalProbability, independentEvents, totalProbability, bernoulliRepetition, randomExpectation, randomEvent],
    algorithmics: [pythonAccumulator, pythonList, pythonFunction, spreadsheetFormula, dataFilter, pythonBernoulli, rawDataCrossTable]
  };

  const PROGRAMME_2026 = [
    {
      id: "automatismes",
      title: "Automatismes et calcul",
      capabilities: [
        { label: "Proportionnalité, conversions et rapport de quantités", origin: "Rappel de seconde 2026", skills: ["proportions", "units"], kinds: ["direct-proportion", "ratio-comparison", "metric-conversion", "duration-conversion"] },
        { label: "Fractions et priorités opératoires", origin: "Rappel de seconde 2026", skills: ["numeric"], kinds: ["fraction-calculation", "operation-priority"] },
        { label: "Puissances et notation scientifique", origin: "Rappel de seconde 2026", skills: ["numeric"], kinds: ["power-rule", "scientific-notation"] },
        { label: "Valeur finale, initiale et taux d'évolution", skills: ["evolutions"], kinds: ["percent-final", "percent-initial", "percent-rate"] },
        { label: "Évolutions successives et réciproques", skills: ["evolutions"], kinds: ["successive-rates", "reciprocal-rate"] },
        { label: "Développer, factoriser et réduire", skills: ["algebra"], kinds: ["develop-expression", "factor-expression"] },
        { label: "Produit nul et signes d'expressions", skills: ["algebra"], kinds: ["zero-product", "linear-sign", "factorized-sign"] },
        { label: "Droites, équations, signes et variations graphiques", skills: ["functions"], kinds: ["graph-line-equation", "graph-equation-reading", "graph-sign-reading", "variation-reading"] },
        { label: "Indicateurs et représentations statistiques", skills: ["statistics"], kinds: ["series-mean", "histogram-reading"] },
        { label: "Probabilités conditionnelles sur tableau", skills: ["probability"], kinds: ["conditional-table"] }
      ]
    },
    {
      id: "logic",
      title: "Ensembles et logique",
      capabilities: [
        { label: "Intersection, réunion, appartenance et cardinal", skills: ["logic"], kinds: ["set-intersection"] },
        { label: "Connecteurs ET et OU", skills: ["logic"], kinds: ["logical-condition"] },
        { label: "Proposition réciproque et contraposée", skills: ["logic"], kinds: ["statement-reciprocal"] },
        { label: "Contre-exemple", skills: ["logic"], kinds: ["counterexample"] }
      ]
    },
    {
      id: "algorithmics",
      title: "Algorithmique, Python et tableur",
      capabilities: [
        { label: "Compteur et accumulateur", skills: ["algorithmics"], kinds: ["python-accumulator"] },
        { label: "Fonctions : entrées et sorties", skills: ["algorithmics"], kinds: ["python-function"] },
        { label: "Générer, filtrer et parcourir des listes", skills: ["algorithmics"], kinds: ["python-list", "data-filter"] },
        { label: "Simuler une loi de Bernoulli", skills: ["algorithmics"], kinds: ["python-bernoulli"] },
        { label: "Formules de tableur", skills: ["algorithmics"], kinds: ["spreadsheet-formula"] },
        { label: "Sélectionner et croiser des données", skills: ["algorithmics"], kinds: ["raw-data-cross-table"] }
      ]
    },
    {
      id: "analysis",
      title: "Suites, fonctions et dérivation",
      capabilities: [
        { label: "Suites explicites et définies par récurrence", skills: ["sequences"], kinds: ["explicit-sequence-term", "recurrent-sequence-term"] },
        { label: "Reconnaître un modèle arithmétique ou géométrique", skills: ["sequences"], kinds: ["arithmetic-sequence", "geometric-sequence", "sequence-nature"] },
        { label: "Sens de variation d'une suite", skills: ["sequences"], kinds: ["sequence-variation"] },
        { label: "Images et taux de variation", skills: ["functions"], kinds: ["affine-image", "line-slope"] },
        { label: "Sommet, racines et forme factorisée d'un degré 2", skills: ["functions"], kinds: ["quadratic-vertex", "quadratic-roots"] },
        { label: "Dérivée d'un polynôme de degré au plus 3", skills: ["derivatives"], kinds: ["polynomial-derivative", "cubic-derivative"] },
        { label: "Tangente, signe de la dérivée et variations", skills: ["derivatives"], kinds: ["tangent-equation", "derivative-variation"] }
      ]
    },
    {
      id: "statistics",
      title: "Statistiques à deux variables",
      capabilities: [
        { label: "Point moyen d'un nuage", skills: ["statistics"], kinds: ["bivariate-mean-point"] },
        { label: "Déterminer et utiliser un ajustement affine", skills: ["statistics"], kinds: ["affine-adjustment"] },
        { label: "Interpolation et extrapolation", skills: ["statistics"], kinds: ["affine-adjustment"] }
      ]
    },
    {
      id: "probability",
      title: "Probabilités et variables aléatoires",
      capabilities: [
        { label: "Indépendance et formule des probabilités totales", skills: ["probability"], kinds: ["independent-events", "total-probability"] },
        { label: "Répétitions indépendantes de Bernoulli", skills: ["probability"], kinds: ["bernoulli-repetition"] },
        { label: "Événements liés à une variable aléatoire", skills: ["probability"], kinds: ["random-event"] },
        { label: "Loi discrète et espérance", skills: ["probability"], kinds: ["random-expectation"] }
      ]
    }
  ];

  const CAPABILITY_BY_KIND = new Map();
  PROGRAMME_2026.forEach(section => section.capabilities.forEach(capability => {
    capability.kinds.forEach(kind => {
      if (!CAPABILITY_BY_KIND.has(kind)) {
        CAPABILITY_BY_KIND.set(kind, {
          label: capability.label,
          origin: capability.origin || "Première 2026",
          section: section.title
        });
      }
    });
  }));

  const KIND_GENERATORS = {};
  const KIND_SKILLS = {};
  const MULTI_KIND_GENERATORS = new Map([
    [nextSequence, ["arithmetic-sequence", "geometric-sequence"]]
  ]);
  Object.entries(SKILL_GENERATORS).forEach(([skill, generators]) => {
    generators.forEach(generator => {
      const kinds = MULTI_KIND_GENERATORS.get(generator) || [generator(Math.random).kind];
      kinds.forEach(kind => {
        KIND_GENERATORS[kind] = generator;
        KIND_SKILLS[kind] = skill;
        if (!CAPABILITY_BY_KIND.has(kind)) {
          CAPABILITY_BY_KIND.set(kind, {
            label: SKILLS[skill],
            origin: "Première 2026",
            section: "Automatismes"
          });
        }
      });
    });
  });

  const SUBSKILLS = Object.keys(KIND_GENERATORS).map(id => {
    return {
      id,
      skill: KIND_SKILLS[id],
      ...CAPABILITY_BY_KIND.get(id)
    };
  });

  function selectGenerated(generators, mastery, rng, exclusions) {
    const excludedKeys = new Set(exclusions.keys || []);
    const excludedKinds = new Set(exclusions.kinds || []);
    const generated = generators.map(generator => {
      let question;
      let attempts = 0;
      do {
        question = generator(rng);
        attempts += 1;
      } while ((!validateQuestion(question).valid || excludedKeys.has(fingerprint(question))) && attempts < 40);
      const validation = validateQuestion(question);
      if (!validation.valid) throw new Error(`Question invalide (${question?.kind || "inconnue"}) : ${validation.errors.join(", ")}`);
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

  function generateForKinds(kinds, mastery = {}, rng = Math.random, exclusions = {}) {
    const generators = kinds.map(kind => KIND_GENERATORS[kind]).filter(Boolean);
    const wanted = new Set(kinds);
    let question;
    let attempts = 0;
    do {
      question = selectGenerated(generators.length ? generators : SKILL_GENERATORS.proportions, mastery, rng, exclusions);
      attempts += 1;
    } while (generators.length && !wanted.has(question.kind) && attempts < 50);
    return question;
  }

  function subskillForQuestion(question) {
    return SUBSKILLS.find(subskill => subskill.id === question?.kind) || null;
  }

  return {
    SKILLS,
    GENERATORS,
    SKILL_GENERATORS,
    KIND_GENERATORS,
    SUBSKILLS,
    PROGRAMME_2026,
    generate,
    generateForSkills,
    generateForKinds,
    subskillForQuestion,
    fingerprint,
    canonicalChoice,
    validateQuestion,
    affineExpression,
    linearFactor,
    formatNumber
  };
});
