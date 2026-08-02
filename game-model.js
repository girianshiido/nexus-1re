(function (root, factory) {
  const model = factory();
  if (typeof module === "object" && module.exports) module.exports = model;
  else root.NexusModel = model;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WORKSHOPS = [
    { id: "proportions", name: "Répartiteur de proportions", icon: "∷", baseCost: 15, baseRate: 0.18, tier: 1, description: "Proportionnalité et rapport de quantités, rappel de seconde." },
    { id: "numeric", name: "Calculateur numérique", icon: "10ⁿ", baseCost: 35, baseRate: 0.38, tier: 1.5, description: "Fractions, priorités, puissances et notation scientifique." },
    { id: "evolutions", name: "Convertisseur de pourcentages", icon: "%", baseCost: 80, baseRate: 0.9, tier: 2, description: "Pourcentages et évolutions successives." },
    { id: "units", name: "Calibrateur d'unités", icon: "↔", baseCost: 420, baseRate: 4.2, tier: 3, description: "Longueurs, durées et conversions." },
    { id: "logic", name: "Circuit logique", icon: "∩", baseCost: 950, baseRate: 8.5, tier: 3.5, description: "Ensembles, connecteurs, réciproques et contre-exemples." },
    { id: "algebra", name: "Forge algébrique", icon: "x", baseCost: 2200, baseRate: 19, tier: 4, description: "Développer, factoriser, résoudre et étudier des signes." },
    { id: "functions", name: "Traceur de fonctions", icon: "ƒ", baseCost: 12000, baseRate: 86, tier: 5, description: "Droites, lectures graphiques et polynômes du second degré." },
    { id: "sequences", name: "Séquenceur numérique", icon: "uₙ", baseCost: 68000, baseRate: 390, tier: 6, description: "Suites explicites, récurrentes, variations et modèles." },
    { id: "derivatives", name: "Dérivateur cinétique", icon: "f′", baseCost: 390000, baseRate: 1750, tier: 7, description: "Dérivées jusqu'au degré 3, tangentes et variations." },
    { id: "statistics", name: "Analyseur statistique", icon: "x̄", baseCost: 2300000, baseRate: 7900, tier: 8, description: "Indicateurs, nuages de points et ajustements affines." },
    { id: "probability", name: "Simulateur probabiliste", icon: "P", baseCost: 14000000, baseRate: 36000, tier: 9, description: "Conditionnement, Bernoulli et variables aléatoires." },
    { id: "algorithmics", name: "Console algorithmique", icon: "</>", baseCost: 75000000, baseRate: 165000, tier: 10, description: "Python, listes, fonctions, données et tableur." },
    { id: "trigonometry", name: "Convertisseur angulaire", icon: "π", baseCost: 8e14, baseRate: 1.6e9, costGrowth: 1.05, tier: 12, speciality: true, upgradeFactors: [3, 3, 4, 4, 5], description: "Radians, cercle trigonométrique, angles associés et équations." },
    { id: "sinusoids", name: "Oscillateur harmonique", icon: "∿", baseCost: 1.4e16, baseRate: 2.8e10, costGrowth: 1.05, tier: 13, speciality: true, upgradeFactors: [3, 4, 4, 5, 5], description: "Amplitude, période, fréquence et phase des signaux sinusoïdaux." },
    { id: "vectors", name: "Projecteur vectoriel", icon: "u·v", baseCost: 3e17, baseRate: 6e11, costGrowth: 1.05, tier: 14, speciality: true, upgradeFactors: [3, 4, 5, 5, 6], description: "Produit scalaire, projections, orthogonalité et théorème d'Al-Kashi." },
    { id: "complexAlgebra", name: "Forge complexe", icon: "a+bi", baseCost: 7e18, baseRate: 1.4e13, costGrowth: 1.05, tier: 15, speciality: true, upgradeFactors: [4, 4, 5, 6, 6], description: "Forme algébrique, conjugué, module, affixes et opérations." },
    { id: "complexTrig", name: "Polariseur complexe", icon: "[ρ,θ]", baseCost: 1.8e20, baseRate: 3.6e14, costGrowth: 1.05, tier: 16, speciality: true, upgradeFactors: [4, 5, 6, 7, 8], description: "Argument et passages entre formes algébrique et trigonométrique." },
    { id: "advancedAnalysis", name: "Intégrateur différentiel", icon: "∫", baseCost: 5e21, baseRate: 1e16, costGrowth: 1.05, tier: 18, speciality: true, upgradeFactors: [5, 6, 7, 8, 10], description: "Dérivées approfondies, approximation affine, primitives et méthode d'Euler." }
  ];

  const CORE_WORKSHOP_COUNT = 12;
  const SPECIALITY_UNLOCK_COST = 200;
  const MILESTONES = [10, 25, 50, 100, 200];
  const WORKSHOP_UPGRADE_SECONDS = [90, 180, 360, 720, 1440];
  const SPECIALITY_UPGRADE_SECONDS = [600, 1200, 2400, 4800, 9600];
  const SYNERGY_PER_MILESTONE = 0.08;
  const CALIBRATION_FLUX_BASE = 50000;
  const CALIBRATION_FLUX_EXPONENT = 3;
  const CALIBRATION_STEEPENING_POINT = 50;
  const CALIBRATION_LATE_EXPONENT = 3.75;
  const MAX_CYCLE_GAIN_RATIO = 0.75;
  const COMPACT_NUMBER_UNITS = [
    { value: 1e60, suffix: "Dc" },
    { value: 1e57, suffix: "Nod" },
    { value: 1e54, suffix: "No" },
    { value: 1e51, suffix: "Ocd" },
    { value: 1e48, suffix: "Oc" },
    { value: 1e45, suffix: "Spd" },
    { value: 1e42, suffix: "Sp" },
    { value: 1e39, suffix: "Sxd" },
    { value: 1e36, suffix: "Sx" },
    { value: 1e33, suffix: "Qid" },
    { value: 1e30, suffix: "Qi" },
    { value: 1e27, suffix: "Qad" },
    { value: 1e24, suffix: "Qa" },
    { value: 1e21, suffix: "Td" },
    { value: 1e18, suffix: "Tn" },
    { value: 1e15, suffix: "Bd" },
    { value: 1e12, suffix: "Bn" },
    { value: 1e9, suffix: "Md" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "k" }
  ];
  const CALIBRATION_UPGRADES = [
    { id: "corePower", name: "Noyau renforcé", icon: "+", costs: [1, 2, 4, 7], description: "+25 % de flux par clic et par niveau." },
    { id: "hyperPower", name: "Amplificateur", icon: "×", costs: [1, 2, 3, 5, 8, 12], description: "+0,5 au multiplicateur d'Hypercadence." },
    { id: "hyperStability", name: "Condensateur", icon: "≈", costs: [1, 2, 4, 7], description: "La charge se dissipe moins rapidement." },
    { id: "hyperDuration", name: "Rotor temporel", icon: "s", costs: [1, 2, 4, 7], description: "+1,5 seconde d'Hypercadence." },
    { id: "hyperPulses", name: "Impulsions fantômes", icon: "⚡", costs: [1, 3, 5, 9], description: "+1 impulsion automatique par seconde." },
    { id: "milestonePlanner", name: "Planificateur de paliers", icon: "⌁", costs: [12], protocol: true, description: "Ajoute l'achat exact jusqu'au prochain palier." },
    { id: "fluxReserve", name: "Réserve de sécurité", icon: "◇", costs: [8, 16, 28], protocol: true, description: "Protège une réserve de flux contre les achats automatiques." },
    { id: "autoUpgrades", name: "Collecteur autonome", icon: "↻", costs: [30], protocol: true, description: "Achète automatiquement les améliorations ×2 disponibles." },
    { id: "errorNotebook", name: "Carnet d'erreurs", icon: "≠", costs: [18], protocol: true, description: "Crée un entraînement court à partir de tes erreurs récentes." },
    { id: "eventBeacon", name: "Balise de perturbation", icon: "!", costs: [10, 20], protocol: true, description: "Allonge les signaux et renforce leur alerte visuelle et tactile." },
    { id: "specialityAccess", name: "Secteur de spécialité", icon: "✦", costs: [SPECIALITY_UNLOCK_COST], hidden: true, protocol: true, description: "Ouvre définitivement le secteur mathématique de la spécialité physique-chimie et mathématiques." }
  ];

  function workshopById(id) {
    return WORKSHOPS.find(workshop => workshop.id === id);
  }

  function workshopCost(id, owned) {
    const workshop = workshopById(id);
    if (!workshop) return Infinity;
    return Math.ceil(workshop.baseCost * Math.pow(workshop.costGrowth || 1.16, Math.max(0, owned)));
  }

  function normalizePurchaseMode(requested) {
    const mode = String(requested ?? "1").toLowerCase();
    return ["1", "10", "max", "milestone"].includes(mode) ? mode : "1";
  }

  function purchaseQuote(id, owned, requested, available = Infinity) {
    const mode = normalizePurchaseMode(requested);
    const milestone = mode === "milestone" ? nextMilestone(owned) : null;
    const limit = mode === "max"
      ? 10000
      : mode === "milestone"
        ? Math.max(0, (milestone || owned) - owned)
        : Math.max(0, Number(mode) || 0);
    let quantity = 0;
    let cost = 0;
    while (quantity < limit) {
      const next = workshopCost(id, owned + quantity);
      if (cost + next > available || !Number.isFinite(next)) break;
      cost += next;
      quantity += 1;
    }
    return { quantity, cost, mode };
  }

  function unlockedMilestoneCount(count) {
    return MILESTONES.filter(milestone => count >= milestone).length;
  }

  function workshopUpgradeFactor(id, level = 0) {
    const workshop = workshopById(id);
    return workshop?.upgradeFactors?.[level] || 2;
  }

  function milestoneMultiplier(count, purchasedUpgrades = 0, id = null) {
    const levels = Math.min(unlockedMilestoneCount(count), Math.max(0, purchasedUpgrades));
    let multiplier = 1;
    for (let level = 0; level < levels; level += 1) multiplier *= id ? workshopUpgradeFactor(id, level) : 2;
    return multiplier;
  }

  function nextMilestone(count) {
    return MILESTONES.find(milestone => count < milestone) || null;
  }

  function workshopUpgradeCost(id, upgradeLevel = 0) {
    const workshop = workshopById(id);
    const milestone = MILESTONES[upgradeLevel];
    const seconds = (workshop?.speciality ? SPECIALITY_UPGRADE_SECONDS : WORKSHOP_UPGRADE_SECONDS)[upgradeLevel];
    if (!workshop || !milestone || !seconds) return Infinity;
    const productionBeforeUpgrade = workshop.baseRate * milestone * milestoneMultiplier(milestone, upgradeLevel, id);
    return Math.ceil(productionBeforeUpgrade * seconds);
  }

  function workshopUpgradeStatus(id, count, upgradeLevel = 0) {
    const milestone = MILESTONES[upgradeLevel] || null;
    return {
      level: upgradeLevel,
      milestone,
      unlocked: milestone !== null && count >= milestone,
      completed: milestone === null,
      cost: milestone === null ? Infinity : workshopUpgradeCost(id, upgradeLevel)
    };
  }

  function workshopSupportBonus(id, count, mastery = 0) {
    const index = WORKSHOPS.findIndex(workshop => workshop.id === id);
    if (index < 0 || index >= WORKSHOPS.length - 1 || count <= 0) return 0;
    const milestoneBonus = unlockedMilestoneCount(count) * SYNERGY_PER_MILESTONE;
    const masteryBonus = Math.min(0.06, Math.sqrt(Math.max(0, mastery)) * 0.01);
    return milestoneBonus + masteryBonus;
  }

  function workshopSynergyMultiplier(id, workshops = {}, mastery = {}) {
    const targetIndex = WORKSHOPS.findIndex(workshop => workshop.id === id);
    if (targetIndex <= 0) return 1;
    const support = WORKSHOPS
      .slice(0, targetIndex)
      .reduce((total, workshop) => total + workshopSupportBonus(
        workshop.id,
        workshops[workshop.id] || 0,
        mastery[workshop.id] || 0
      ), 0);
    return 1 + support;
  }

  function workshopProduction(id, count, mastery = 0, upgradeLevel = 0, workshops = null, allMastery = null) {
    const workshop = workshopById(id);
    if (!workshop || count <= 0) return 0;
    const masteryMultiplier = 1 + Math.sqrt(Math.max(0, mastery)) * 0.06;
    const synergyMultiplier = workshops ? workshopSynergyMultiplier(id, workshops, allMastery || {}) : 1;
    return workshop.baseRate * count * milestoneMultiplier(count, upgradeLevel, id) * masteryMultiplier * synergyMultiplier;
  }

  function baseProduction(workshops = {}, mastery = {}, workshopUpgrades = {}) {
    return WORKSHOPS.reduce((total, workshop) => total + workshopProduction(
      workshop.id,
      workshops[workshop.id] || 0,
      mastery[workshop.id] || 0,
      workshopUpgrades[workshop.id] || 0,
      workshops,
      mastery
    ), 0);
  }

  function permanentMultiplier(calibration = 0) {
    const points = Math.max(0, calibration);
    return 1 + (0.2 * points) / (1 + points / 1000);
  }

  function totalOwned(workshops = {}) {
    return WORKSHOPS.reduce((total, workshop) => total + (workshops[workshop.id] || 0), 0);
  }

  function calibrationUpgradeById(id) {
    return CALIBRATION_UPGRADES.find(upgrade => upgrade.id === id);
  }

  function calibrationUpgradeCost(id, currentLevel = 0) {
    return calibrationUpgradeById(id)?.costs[currentLevel] ?? Infinity;
  }

  function calibrationSpent(levels = {}) {
    return CALIBRATION_UPGRADES.reduce((total, upgrade) => {
      const level = Math.min(upgrade.costs.length, Math.max(0, levels[upgrade.id] || 0));
      return total + upgrade.costs.slice(0, level).reduce((sum, cost) => sum + cost, 0);
    }, 0);
  }

  function availableCalibration(total = 0, levels = {}) {
    return Math.max(0, total - calibrationSpent(levels));
  }

  function specialityUnlocked(levels = {}) {
    return (levels.specialityAccess || 0) > 0;
  }

  function specialityRequirements(workshops = {}, calibration = 0, levels = {}) {
    const completed = WORKSHOPS
      .slice(0, CORE_WORKSHOP_COUNT)
      .filter(workshop => (workshops[workshop.id] || 0) >= 100)
      .length;
    const available = availableCalibration(calibration, levels);
    return {
      completed,
      workshopTarget: CORE_WORKSHOP_COUNT,
      calibrationAvailable: available,
      calibrationTarget: SPECIALITY_UNLOCK_COST,
      met: completed === CORE_WORKSHOP_COUNT && available >= SPECIALITY_UNLOCK_COST
    };
  }

  function hyperStats(levels = {}) {
    const powerLevel = Math.min(6, Math.max(0, levels.hyperPower || 0));
    const stabilityLevel = Math.min(4, Math.max(0, levels.hyperStability || 0));
    const durationLevel = Math.min(4, Math.max(0, levels.hyperDuration || 0));
    const pulseLevel = Math.min(4, Math.max(0, levels.hyperPulses || 0));
    return {
      chargeTarget: 40,
      idleDelayMs: 800,
      decayPerSecond: Math.max(1.6, 4 - stabilityLevel * 0.6),
      multiplier: 2 + powerLevel * 0.5,
      durationMs: 8000 + durationLevel * 1500,
      pulsesPerSecond: 1 + pulseLevel
    };
  }

  function comfortStats(levels = {}) {
    const reserveLevel = Math.min(3, Math.max(0, levels.fluxReserve || 0));
    const beaconLevel = Math.min(2, Math.max(0, levels.eventBeacon || 0));
    return {
      milestonePlanner: (levels.milestonePlanner || 0) > 0,
      autoUpgrades: (levels.autoUpgrades || 0) > 0,
      errorNotebook: (levels.errorNotebook || 0) > 0,
      reserveSeconds: [0, 30, 90, 180][reserveLevel],
      eventWindowMs: [30000, 45000, 60000][beaconLevel],
      eventBeaconLevel: beaconLevel
    };
  }

  function decayHyperCharge(charge = 0, idleForMs = 0, deltaSeconds = 0, levels = {}) {
    const stats = hyperStats(levels);
    if (idleForMs <= stats.idleDelayMs) return Math.max(0, charge);
    return Math.max(0, charge - stats.decayPerSecond * Math.max(0, deltaSeconds));
  }

  function clickGain(totalClicks = 0, workshops = {}, calibration = 0, calibrationUpgrades = {}, passiveProduction = 0) {
    const practicePower = 1 + Math.floor(Math.max(0, totalClicks) / 250);
    const networkPower = 1 + Math.floor(totalOwned(workshops) / 10);
    const coreMultiplier = 1 + Math.min(4, Math.max(0, calibrationUpgrades.corePower || 0)) * 0.25;
    const permanent = permanentMultiplier(calibration);
    const incrementalPower = practicePower * networkPower * permanent * coreMultiplier;
    const productionAnchor = Math.max(0, passiveProduction) * permanent * 0.25 * coreMultiplier;
    return Math.max(incrementalPower, productionAnchor);
  }

  function formatCompactNumber(value, maximumFractionDigits = 2) {
    if (!Number.isFinite(value)) return "∞";
    const absolute = Math.abs(value);
    if (absolute < 1000) {
      return new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value);
    }
    let unit = COMPACT_NUMBER_UNITS.find(candidate => absolute >= candidate.value);
    if (!unit) {
      const exponent = Math.floor(Math.log10(absolute) / 3) * 3;
      const scaled = value / Math.pow(10, exponent);
      return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(scaled)} e${exponent}`;
    }
    const unitIndex = COMPACT_NUMBER_UNITS.indexOf(unit);
    const scaledAbsolute = absolute / unit.value;
    const roundedScaled = Math.round(scaledAbsolute * Math.pow(10, maximumFractionDigits))
      / Math.pow(10, maximumFractionDigits);
    if (roundedScaled >= 1000) {
      if (unitIndex > 0) {
        unit = COMPACT_NUMBER_UNITS[unitIndex - 1];
      } else {
        const exponent = Math.floor(Math.log10(absolute) / 3) * 3;
        const engineeringValue = value / Math.pow(10, exponent);
        return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(engineeringValue)} e${exponent}`;
      }
    }
    const scaled = value / unit.value;
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(scaled)} ${unit.suffix}`;
  }

  function calibrationFluxForPoints(points = 0) {
    const bounded = Math.max(0, points);
    if (bounded <= CALIBRATION_STEEPENING_POINT) {
      return CALIBRATION_FLUX_BASE * Math.pow(bounded, CALIBRATION_FLUX_EXPONENT);
    }
    const transitionFlux = CALIBRATION_FLUX_BASE
      * Math.pow(CALIBRATION_STEEPENING_POINT, CALIBRATION_FLUX_EXPONENT);
    return transitionFlux * Math.pow(
      bounded / CALIBRATION_STEEPENING_POINT,
      CALIBRATION_LATE_EXPONENT
    );
  }

  function potentialFromTotalFlux(totalFlux = 0) {
    const bounded = Math.max(0, totalFlux);
    const transitionFlux = calibrationFluxForPoints(CALIBRATION_STEEPENING_POINT);
    if (bounded <= transitionFlux) {
      return Math.floor(Math.pow(bounded / CALIBRATION_FLUX_BASE, 1 / CALIBRATION_FLUX_EXPONENT) + 1e-9);
    }
    return Math.floor(CALIBRATION_STEEPENING_POINT * Math.pow(
      bounded / transitionFlux,
      1 / CALIBRATION_LATE_EXPONENT
    ) + 1e-9);
  }

  function calibrationPotential(cycleFlux = 0, calibration = 0) {
    const earned = Math.floor(Math.max(0, calibration));
    return Math.max(earned, potentialFromTotalFlux(calibrationFluxForPoints(earned) + Math.max(0, cycleFlux)));
  }

  function maxCycleGain(calibration = 0) {
    return Math.max(1, Math.ceil(Math.max(1, calibration) * MAX_CYCLE_GAIN_RATIO));
  }

  function cycleFluxTarget(calibration = 0, requestedGain = 1) {
    const earned = Math.floor(Math.max(0, calibration));
    const gain = Math.min(maxCycleGain(earned), Math.max(1, Math.floor(requestedGain)));
    return calibrationFluxForPoints(earned + gain) - calibrationFluxForPoints(earned);
  }

  function cycleGain(cycleFlux = 0, calibration = 0) {
    const rawGain = calibrationPotential(cycleFlux, calibration) - Math.floor(Math.max(0, calibration));
    return Math.max(0, Math.min(rawGain, maxCycleGain(calibration)));
  }

  function cycleTarget(calibration = 0, cycleFlux = 0) {
    const rawGain = calibrationPotential(cycleFlux, calibration) - Math.floor(Math.max(0, calibration));
    return cycleFluxTarget(calibration, Math.min(maxCycleGain(calibration), rawGain + 1));
  }

  function cycleProgress(cycleFlux = 0, calibration = 0) {
    const earnedThisCycle = cycleGain(cycleFlux, calibration);
    if (earnedThisCycle >= maxCycleGain(calibration)) return 1;
    const previousTarget = earnedThisCycle > 0 ? cycleFluxTarget(calibration, earnedThisCycle) : 0;
    const nextTarget = cycleFluxTarget(calibration, earnedThisCycle + 1);
    if (nextTarget <= previousTarget) return 0;
    return Math.max(0, Math.min(1, (Math.max(0, cycleFlux) - previousTarget) / (nextTarget - previousTarget)));
  }

  return {
    WORKSHOPS,
    CORE_WORKSHOP_COUNT,
    SPECIALITY_UNLOCK_COST,
    MILESTONES,
    WORKSHOP_UPGRADE_SECONDS,
    SPECIALITY_UPGRADE_SECONDS,
    SYNERGY_PER_MILESTONE,
    CALIBRATION_FLUX_BASE,
    CALIBRATION_FLUX_EXPONENT,
    CALIBRATION_STEEPENING_POINT,
    CALIBRATION_LATE_EXPONENT,
    MAX_CYCLE_GAIN_RATIO,
    COMPACT_NUMBER_UNITS,
    CALIBRATION_UPGRADES,
    workshopById,
    workshopCost,
    normalizePurchaseMode,
    purchaseQuote,
    milestoneMultiplier,
    workshopUpgradeFactor,
    unlockedMilestoneCount,
    nextMilestone,
    workshopUpgradeCost,
    workshopUpgradeStatus,
    workshopSupportBonus,
    workshopSynergyMultiplier,
    workshopProduction,
    baseProduction,
    permanentMultiplier,
    totalOwned,
    calibrationUpgradeById,
    calibrationUpgradeCost,
    calibrationSpent,
    availableCalibration,
    specialityUnlocked,
    specialityRequirements,
    hyperStats,
    comfortStats,
    decayHyperCharge,
    clickGain,
    formatCompactNumber,
    calibrationFluxForPoints,
    calibrationPotential,
    maxCycleGain,
    cycleFluxTarget,
    cycleTarget,
    cycleProgress,
    cycleGain
  };
});
