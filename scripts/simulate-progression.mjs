import { pathToFileURL } from "node:url";

import Model from "../game-model.js";

const MAX_ACTIONS = 250_000;
const MAX_SECONDS = 365 * 24 * 60 * 60;
const DEFAULT_BALANCE = {
  cycleGain: Model.cycleGain,
  cycleFluxTarget: Model.cycleFluxTarget,
  cycleReward: Model.cycleReward,
  maxCycleGain: Model.maxCycleGain,
  permanentMultiplier: Model.permanentMultiplier,
  resetFactor: null,
  specialityCostGrowth: null,
  specialityBaseCosts: null
};

const PROFILES = {
  tranquille: {
    label: "Tranquille",
    mastery: 3,
    eventSuccess: 0.55,
    fastAnswers: 0.25,
    prestigeFactor: 1.8,
    investmentWindow: 8 * 60,
    plannedUpgradeSpend: 55,
    clicksPerSecond(runElapsed) {
      if (runElapsed < 5 * 60) return 0.8;
      if (runElapsed < 30 * 60) return 0.08;
      return 0.015;
    }
  },
  regulier: {
    label: "Régulier",
    mastery: 7,
    eventSuccess: 0.78,
    fastAnswers: 0.8,
    prestigeFactor: 1.7,
    investmentWindow: 15 * 60,
    plannedUpgradeSpend: 125,
    clicksPerSecond(runElapsed) {
      if (runElapsed < 5 * 60) return 1.8;
      if (runElapsed < 30 * 60) return 0.2;
      return 0.035;
    }
  },
  completiste: {
    label: "Complétiste",
    mastery: 12,
    eventSuccess: 0.92,
    fastAnswers: 1.5,
    prestigeFactor: 1.6,
    investmentWindow: 25 * 60,
    plannedUpgradeSpend: 233,
    clicksPerSecond(runElapsed) {
      if (runElapsed < 10 * 60) return 3;
      if (runElapsed < 60 * 60) return 0.45;
      return 0.07;
    }
  }
};

const UPGRADE_PRIORITY = [
  "corePower", "hyperPower", "hyperPulses", "hyperDuration", "hyperStability",
  "milestonePlanner", "autoUpgrades", "fluxReserve", "eventBeacon", "errorNotebook"
];

function emptyWorkshopMap(value = 0) {
  return Object.fromEntries(Model.WORKSHOPS.map(workshop => [workshop.id, value]));
}

function freshState(profile, balance) {
  return {
    profile,
    balance,
    flux: 0,
    cycleFlux: 0,
    lifetimeFlux: 0,
    elapsed: 0,
    runElapsed: 0,
    totalClicks: 0,
    calibration: 0,
    calibrationUpgrades: Object.fromEntries(Model.CALIBRATION_UPGRADES.map(upgrade => [upgrade.id, 0])),
    workshops: emptyWorkshopMap(),
    workshopUpgrades: emptyWorkshopMap(),
    mastery: emptyWorkshopMap(profile.mastery),
    reveal: 1,
    specialityUnlocked: false,
    cycles: 1,
    actions: 0,
    milestones: [],
    specialityGateRuns: 0
  };
}

function accessibleCount(state) {
  return state.specialityUnlocked ? Model.WORKSHOPS.length : Model.CORE_WORKSHOP_COUNT;
}

function baseProduction(state) {
  return Model.baseProduction(state.workshops, state.mastery, state.workshopUpgrades);
}

function clickRate(state) {
  return state.profile.clicksPerSecond(state.runElapsed);
}

function hyperAverages(state, clicksPerSecond) {
  if (clicksPerSecond < 1) return { clickMultiplier: 1, pulsesPerSecond: 0 };
  const stats = Model.hyperStats(state.calibrationUpgrades);
  const chargingSeconds = stats.chargeTarget / clicksPerSecond;
  const activeSeconds = stats.durationMs / 1000;
  const activeShare = activeSeconds / (chargingSeconds + activeSeconds);
  return {
    clickMultiplier: 1 + activeShare * (stats.multiplier - 1),
    pulsesPerSecond: activeShare * stats.pulsesPerSecond
  };
}

function productionRate(state) {
  const passive = baseProduction(state) * state.balance.permanentMultiplier(state.calibration);
  const clicks = clickRate(state);
  const click = Model.clickGain(
    state.totalClicks,
    state.workshops,
    state.calibration,
    state.calibrationUpgrades,
    baseProduction(state)
  );
  const hyper = hyperAverages(state, clicks);
  const manual = click * (clicks * hyper.clickMultiplier + hyper.pulsesPerSecond);
  if (Model.totalOwned(state.workshops) <= 0) return manual;

  const highestTier = Model.WORKSHOPS.reduce(
    (tier, workshop) => state.workshops[workshop.id] > 0 ? Math.max(tier, workshop.tier) : tier,
    0
  );
  const questionCount = highestTier >= 7 ? 3 : highestTier >= 4 ? 2 : 1;
  const eventBase = Math.max(120, baseProduction(state) * 60, click * 80);
  const averageTypeMultiplier = (0.9 + 1.5 + 1) / 3;
  const eventReward = eventBase * averageTypeMultiplier * (1 + (questionCount - 1) * 0.25)
    * (1 + state.profile.fastAnswers * 0.25);
  const eventInterval = 80;
  const eventIncome = state.profile.eventSuccess * eventReward / eventInterval;
  const surgeShare = state.profile.eventSuccess / 3;
  const averageSurgeMultiplier = 2 + Math.min(1, state.profile.fastAnswers * 0.25);
  const boostShare = Math.min(1, surgeShare * 45 / eventInterval);
  const boostedPassive = passive * (1 + boostShare * (averageSurgeMultiplier - 1));
  return boostedPassive + manual + eventIncome;
}

function advance(state, seconds) {
  const bounded = Math.max(1e-9, seconds);
  const gain = productionRate(state) * bounded;
  state.flux += gain;
  state.cycleFlux += gain;
  state.lifetimeFlux += gain;
  state.totalClicks += clickRate(state) * bounded;
  state.elapsed += bounded;
  state.runElapsed += bounded;
}

function plannedUpgradeCost(state) {
  return Math.min(state.profile.plannedUpgradeSpend, 233);
}

function spendCalibrationUpgrades(state) {
  let spent = Model.calibrationSpent(state.calibrationUpgrades);
  let purchased = true;
  while (purchased && spent < plannedUpgradeCost(state)) {
    purchased = false;
    for (const id of UPGRADE_PRIORITY) {
      const level = state.calibrationUpgrades[id] || 0;
      const cost = Model.calibrationUpgradeCost(id, level);
      if (!Number.isFinite(cost) || spent + cost > plannedUpgradeCost(state)) continue;
      if (Model.availableCalibration(state.calibration, state.calibrationUpgrades) < cost) continue;
      state.calibrationUpgrades[id] = level + 1;
      spent += cost;
      purchased = true;
      break;
    }
  }
}

function resetCycle(state) {
  const gain = state.balance.cycleGain(state.cycleFlux, state.calibration, state.cycles);
  if (gain <= 0) return false;
  state.milestones.push({
    type: "cycle",
    id: `cycle-${state.cycles + 1}`,
    label: `Cycle ${state.cycles + 1}`,
    seconds: state.elapsed,
    cycles: state.cycles + 1,
    cycleBefore: state.cycles,
    calibrationBefore: state.calibration,
    gain
  });
  state.calibration += gain;
  state.flux = state.calibration * 25;
  state.cycleFlux = 0;
  state.workshops = emptyWorkshopMap();
  state.workshopUpgrades = emptyWorkshopMap();
  state.reveal = state.specialityUnlocked ? Model.CORE_WORKSHOP_COUNT : 1;
  state.runElapsed = 0;
  state.cycles += 1;
  spendCalibrationUpgrades(state);
  return true;
}

function requiredCalibrationBeforeGate(state) {
  return plannedUpgradeCost(state) + Model.SPECIALITY_UNLOCK_COST;
}

function readyForGateRun(state) {
  return state.calibration >= requiredCalibrationBeforeGate(state);
}

function coreAtGateTarget(state) {
  return Model.WORKSHOPS.slice(0, Model.CORE_WORKSHOP_COUNT)
    .every(workshop => state.workshops[workshop.id] >= 100);
}

function finalTargetReached(state) {
  return Model.WORKSHOPS.every(workshop =>
    state.workshops[workshop.id] >= 200
    && state.workshopUpgrades[workshop.id] >= Model.MILESTONES.length
  );
}

function shouldReset(state) {
  if (!state.specialityUnlocked && readyForGateRun(state)) return false;
  const gain = state.balance.cycleGain(state.cycleFlux, state.calibration, state.cycles);
  if (gain <= 0) return false;
  if (!state.specialityUnlocked) {
    return Model.availableCalibration(state.calibration, state.calibrationUpgrades) < Model.SPECIALITY_UNLOCK_COST;
  }
  return false;
}

function actionProductionDelta(state, action) {
  const before = baseProduction(state);
  if (action.type === "workshop") state.workshops[action.id] += action.quantity;
  else state.workshopUpgrades[action.id] += 1;
  const after = baseProduction(state);
  if (action.type === "workshop") state.workshops[action.id] -= action.quantity;
  else state.workshopUpgrades[action.id] -= 1;
  return after - before;
}

function availableActions(state) {
  const actions = [];
  const count = accessibleCount(state);
  for (let index = 0; index < count; index += 1) {
    const workshop = Model.WORKSHOPS[index];
    if (index > state.reveal) continue;
    const owned = state.workshops[workshop.id];
    if (owned < 200) {
      const quantity = owned < 10 ? 1 : owned < 100 ? 10 : 25;
      const cappedQuantity = Math.min(quantity, 200 - owned);
      const quote = purchaseQuote(state, workshop, owned, cappedQuantity);
      actions.push({ type: "workshop", id: workshop.id, index, quantity: quote.quantity, cost: quote.cost });
    }
    const level = state.workshopUpgrades[workshop.id];
    const status = Model.workshopUpgradeStatus(workshop.id, owned, level);
    if (status.unlocked && !status.completed) {
      actions.push({ type: "upgrade", id: workshop.id, index, quantity: 1, cost: status.cost });
    }
  }
  return actions.map(action => ({ ...action, productionDelta: actionProductionDelta(state, action) }));
}

function purchaseQuote(state, workshop, owned, quantity) {
  const growthOverride = typeof state.balance.specialityCostGrowth === "number"
    ? state.balance.specialityCostGrowth
    : state.balance.specialityCostGrowth?.[workshop.id];
  const growth = workshop.speciality && growthOverride
    ? growthOverride
    : (workshop.costGrowth || 1.16);
  const baseCost = workshop.speciality
    ? (state.balance.specialityBaseCosts?.[workshop.id] || workshop.baseCost)
    : workshop.baseCost;
  let cost = 0;
  for (let offset = 0; offset < quantity; offset += 1) {
    cost += Math.ceil(baseCost * Math.pow(growth, owned + offset));
  }
  return { quantity, cost };
}

function applyAction(state, action) {
  state.flux -= action.cost;
  if (action.type === "upgrade") {
    state.workshopUpgrades[action.id] += 1;
    state.actions += 1;
    return;
  }
  const first = state.workshops[action.id] === 0;
  state.workshops[action.id] += action.quantity;
  if (first) {
    const workshop = Model.WORKSHOPS[action.index];
    state.milestones.push({ type: "workshop", id: action.id, label: workshop.name, seconds: state.elapsed, cycles: state.cycles });
    if (action.index === state.reveal && state.reveal < accessibleCount(state) - 1) state.reveal += 1;
  }
  state.actions += 1;
}

function chooseAction(state, actions) {
  const affordable = actions.filter(action => action.productionDelta > 0 && action.cost <= state.flux);
  const firstWorkshop = affordable
    .filter(action => action.type === "workshop" && state.workshops[action.id] === 0)
    .sort((left, right) => left.index - right.index)[0];
  if (firstWorkshop) return firstWorkshop;

  const forcingCoreGate = !state.specialityUnlocked && readyForGateRun(state);
  const candidates = affordable.sort((left, right) =>
    left.cost / left.productionDelta - right.cost / right.productionDelta
  );
  if (!candidates.length) return null;
  if (forcingCoreGate) {
    const required = candidates.filter(action =>
      action.index < Model.CORE_WORKSHOP_COUNT
      && state.workshops[action.id] < 100
    );
    if (required.length) return required[0];
  }
  return candidates[0];
}

function unlockSpecialityIfReady(state) {
  if (state.specialityUnlocked || !coreAtGateTarget(state)) return false;
  const available = Model.availableCalibration(state.calibration, state.calibrationUpgrades);
  if (available < Model.SPECIALITY_UNLOCK_COST) return false;
  state.calibrationUpgrades.specialityAccess = 1;
  state.specialityUnlocked = true;
  state.reveal = Math.max(state.reveal, Model.CORE_WORKSHOP_COUNT);
  state.specialityGateRuns += 1;
  state.milestones.push({ type: "speciality", id: "speciality", label: "Secteur Spécialité", seconds: state.elapsed, cycles: state.cycles });
  return true;
}

function timeToNextReset(state, rate) {
  if (!state.specialityUnlocked && readyForGateRun(state)) return Infinity;
  const targetFlux = state.balance.cycleFluxTarget(state.calibration, state.cycles);
  return Math.max(0, targetFlux - state.cycleFlux) / rate;
}

export function simulateProgression(profileName = "regulier", balanceOverrides = {}) {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Profil inconnu : ${profileName}`);
  const state = freshState(profile, { ...DEFAULT_BALANCE, ...balanceOverrides });

  while (state.elapsed < MAX_SECONDS && state.actions < MAX_ACTIONS && !finalTargetReached(state)) {
    if (unlockSpecialityIfReady(state)) continue;
    const actions = availableActions(state);
    const action = chooseAction(state, actions);
    if (shouldReset(state)) {
      const actualDelta = action?.productionDelta * state.balance.permanentMultiplier(state.calibration);
      const payback = action && actualDelta > 0 ? action.cost / actualDelta : Infinity;
      if (!action || payback > state.profile.investmentWindow) {
        resetCycle(state);
        continue;
      }
    }
    if (action) {
      applyAction(state, action);
      continue;
    }

    const rate = productionRate(state);
    if (!(rate > 0) || !Number.isFinite(rate)) break;
    const nextCost = actions
      .filter(actionItem => actionItem.productionDelta > 0 && actionItem.cost > state.flux)
      .reduce((minimum, actionItem) => Math.min(minimum, actionItem.cost), Infinity);
    const toAction = Number.isFinite(nextCost) ? Math.max(0, nextCost - state.flux) / rate : Infinity;
    const toReset = timeToNextReset(state, rate);
    const seconds = Math.max(1e-9, Math.min(toAction, toReset));
    if (!Number.isFinite(seconds)) break;
    advance(state, Math.min(seconds, MAX_SECONDS - state.elapsed));
  }

  return {
    profile: profile.label,
    completed: finalTargetReached(state),
    elapsed: state.elapsed,
    cycles: state.cycles,
    calibration: state.calibration,
    availableCalibration: Model.availableCalibration(state.calibration, state.calibrationUpgrades),
    specialityUnlocked: state.specialityUnlocked,
    specialityGateRuns: state.specialityGateRuns,
    actions: state.actions,
    lifetimeFlux: state.lifetimeFlux,
    milestones: state.milestones,
    workshops: state.workshops,
    workshopUpgrades: state.workshopUpgrades
  };
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds.toFixed(0)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} j`;
}

function report(results) {
  console.log("NEXUS 1re — simulation de progression économique");
  console.table(results.map(result => {
    const speciality = result.milestones.find(milestone => milestone.type === "speciality");
    const last = [...result.milestones].reverse().find(milestone => milestone.type === "workshop");
    return {
      profil: result.profile,
      terminé: result.completed ? "oui" : "non",
      spécialité: speciality ? formatDuration(speciality.seconds) : "—",
      dernier_atelier: last ? formatDuration(last.seconds) : "—",
      fin: result.completed ? formatDuration(result.elapsed) : `>${formatDuration(result.elapsed)}`,
      cycles: result.cycles,
      étalonnage: result.calibration,
      actions: result.actions
    };
  }));
  for (const result of results) {
    console.log(`\n${result.profile}`);
    const firstMilestones = result.milestones.filter((milestone, index, milestones) =>
      (milestone.type === "speciality" || Model.WORKSHOPS.find(workshop => workshop.id === milestone.id)?.speciality)
      && milestones.findIndex(candidate => candidate.id === milestone.id) === index
    );
    console.table(firstMilestones
      .map(milestone => ({ étape: milestone.label, temps: formatDuration(milestone.seconds), cycle: milestone.cycles }))
    );
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  report(Object.keys(PROFILES).map(simulateProgression));
}
