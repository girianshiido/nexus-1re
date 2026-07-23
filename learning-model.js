(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.NexusLearning = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STAGES = {
    discovery: { label: "Découverte", weight: 0 },
    training: { label: "En entraînement", weight: 1 },
    fragile: { label: "Acquis fragile", weight: 0.5 },
    mastered: { label: "Maîtrisé", weight: 3 },
    review: { label: "À réviser", weight: 2 }
  };

  const REVIEW_DELAYS = [
    5 * 60 * 1000,
    30 * 60 * 1000,
    6 * 60 * 60 * 1000,
    24 * 60 * 60 * 1000,
    3 * 24 * 60 * 60 * 1000,
    7 * 24 * 60 * 60 * 1000
  ];

  function freshRecord() {
    return {
      attempts: 0,
      correct: 0,
      streak: 0,
      lapses: 0,
      stability: 0,
      lastCorrect: null,
      lastSeen: 0,
      lastSequence: -100,
      nextDue: 0,
      remedialAt: null
    };
  }

  function normalizeRecord(record = {}) {
    const fresh = freshRecord();
    const merged = { ...fresh, ...record };
    ["attempts", "correct", "streak", "lapses", "stability", "lastSeen", "lastSequence", "nextDue"].forEach(key => {
      merged[key] = Number.isFinite(Number(merged[key])) ? Number(merged[key]) : fresh[key];
    });
    merged.attempts = Math.max(0, Math.floor(merged.attempts));
    merged.correct = Math.min(merged.attempts, Math.max(0, Math.floor(merged.correct)));
    merged.streak = Math.max(0, Math.floor(merged.streak));
    merged.lapses = Math.max(0, Math.floor(merged.lapses));
    merged.stability = Math.max(0, Math.min(8, merged.stability));
    merged.lastCorrect = merged.lastCorrect === null ? null : Boolean(merged.lastCorrect);
    merged.remedialAt = Number.isFinite(Number(merged.remedialAt)) ? Number(merged.remedialAt) : null;
    return merged;
  }

  function stageFor(record = {}, nowValue = Date.now()) {
    const item = normalizeRecord(record);
    if (item.attempts === 0) return "discovery";
    if (item.lastCorrect === false || (item.attempts >= 2 && item.correct / item.attempts < 0.6)) return "fragile";
    const consolidated = item.attempts >= 4 && item.stability >= 4 && item.correct / item.attempts >= 0.7;
    if (consolidated && item.nextDue > 0 && item.nextDue <= nowValue) return "review";
    if (consolidated) return "mastered";
    return "training";
  }

  function recordAnswer(record, correct, sequence, nowValue = Date.now(), rng = Math.random) {
    const item = normalizeRecord(record);
    const spacing = Math.max(0, sequence - item.lastSequence);
    item.attempts += 1;
    item.lastSeen = nowValue;
    item.lastSequence = sequence;
    item.lastCorrect = Boolean(correct);
    if (correct) {
      item.correct += 1;
      item.streak += 1;
      const spacedGain = spacing >= 2 ? 1 : 0.5;
      item.stability = Math.min(8, item.stability + spacedGain);
      item.remedialAt = null;
      const delayIndex = Math.min(REVIEW_DELAYS.length - 1, Math.max(0, Math.floor(item.stability) - 1));
      item.nextDue = nowValue + REVIEW_DELAYS[delayIndex];
    } else {
      item.streak = 0;
      item.lapses += 1;
      item.stability = Math.max(0, item.stability - 1.5);
      item.nextDue = nowValue;
      item.remedialAt = sequence + 2 + Math.floor(rng() * 3);
    }
    return item;
  }

  function priority(record, sequence, nowValue = Date.now()) {
    const item = normalizeRecord(record);
    const stage = stageFor(item, nowValue);
    if (item.remedialAt !== null && item.remedialAt <= sequence) return 120 + Math.min(20, sequence - item.remedialAt);
    if (stage === "review") return 95;
    if (stage === "fragile") return item.remedialAt === null ? 82 : 45;
    if (stage === "discovery") return 58;
    if (stage === "training") return 42 - Math.min(18, item.stability * 3);
    return 8;
  }

  function summarize(subskills = [], records = {}, nowValue = Date.now()) {
    const counts = Object.fromEntries(Object.keys(STAGES).map(stage => [stage, 0]));
    subskills.forEach(subskill => { counts[stageFor(records[subskill.id], nowValue)] += 1; });
    return counts;
  }

  function scoreForSkill(subskills = [], records = {}, skill, nowValue = Date.now()) {
    return subskills
      .filter(subskill => subskill.skill === skill)
      .reduce((sum, subskill) => sum + STAGES[stageFor(records[subskill.id], nowValue)].weight, 0);
  }

  function pickSubskill(subskills, records, sequence, rng = Math.random, options = {}) {
    let candidates = subskills.filter(subskill => !options.allowedSkills || options.allowedSkills.includes(subskill.skill));
    if (options.allowedKinds?.length) candidates = candidates.filter(subskill => options.allowedKinds.includes(subskill.id));
    if (options.avoidKinds?.length) {
      const varied = candidates.filter(subskill => !options.avoidKinds.includes(subskill.id));
      if (varied.length) candidates = varied;
    }
    if (options.preferUnusedSkills?.length) {
      const preferred = candidates.filter(subskill => options.preferUnusedSkills.includes(subskill.skill));
      if (preferred.length) candidates = preferred;
    }
    if (!candidates.length) return null;
    const ranked = candidates.map(subskill => ({
      subskill,
      score: priority(records[subskill.id], sequence, options.nowValue) + rng() * 7
    })).sort((a, b) => b.score - a.score);
    const pool = ranked.slice(0, Math.min(4, ranked.length));
    return pool[Math.floor(rng() * pool.length)].subskill;
  }

  return {
    STAGES,
    REVIEW_DELAYS,
    freshRecord,
    normalizeRecord,
    stageFor,
    recordAnswer,
    priority,
    summarize,
    scoreForSkill,
    pickSubskill
  };
});
