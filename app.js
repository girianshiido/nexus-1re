(() => {
  "use strict";

  const Engine = window.QuestionEngine;
  const Model = window.NexusModel;
  if (!Engine || !Model) throw new Error("Les modules du jeu n'ont pas été chargés.");

  const SAVE_KEY = "nexus-sti2d-laboratoire-v2";
  const FAST_TIME = 8000;
  const MAX_QUESTION_TIME = 20000;
  const OFFLINE_LIMIT = 4 * 60 * 60;
  const REPORT_LIMIT = 50;

  const EVENT_TYPES = [
    {
      id: "surge",
      title: "Surcharge du réseau",
      description: "Stabilise les notions actives avant que le surplus ne se dissipe.",
      preview: "Récompense : multiplicateur de production temporaire"
    },
    {
      id: "cache",
      title: "Fenêtre d'optimisation",
      description: "Résous le diagnostic pour récupérer un important paquet de flux.",
      preview: "Récompense : réserve instantanée de flux"
    },
    {
      id: "prototype",
      title: "Prototype inattendu",
      description: "Valide les calculs du prototype avant son intégration au laboratoire.",
      preview: "Récompense : une unité d'atelier gratuite"
    }
  ];

  const $ = selector => document.querySelector(selector);
  const dom = {
    flux: $("#flux-value"),
    production: $("#production-value"),
    calibration: $("#calibration-value"),
    cycle: $("#cycle-value"),
    cycleRing: $("#cycle-ring"),
    cycleProgressText: $("#cycle-progress-text"),
    cycleProgressBar: $("#cycle-progress-bar"),
    cycleGain: $("#cycle-gain"),
    permanentMultiplier: $("#permanent-multiplier"),
    cycleButton: $("#cycle-button"),
    calibrationAvailable: $("#calibration-available"),
    calibrationUpgradeList: $("#calibration-upgrade-list"),
    masteryTotal: $("#mastery-total"),
    corePanel: $(".core-panel"),
    coreButton: $("#core-button"),
    floatLayer: $("#float-layer"),
    clickGain: $("#click-gain"),
    totalClicks: $("#total-clicks"),
    cadenceTitle: $("#cadence-title"),
    cadenceHint: $("#cadence-hint"),
    cadenceCount: $("#cadence-count"),
    cadenceBar: $("#cadence-bar"),
    boostPill: $("#boost-pill"),
    eventCard: $("#event-card"),
    eventTitle: $("#event-title"),
    eventDescription: $("#event-description"),
    eventReward: $("#event-reward"),
    eventStart: $("#event-start"),
    eventCountdown: $("#event-countdown"),
    ownedTotal: $("#owned-total"),
    correctTotal: $("#correct-total"),
    accuracy: $("#accuracy-value"),
    bestStreak: $("#best-streak"),
    activeEffect: $("#active-effect"),
    unlockedCount: $("#unlocked-count"),
    unlockedSkills: $("#unlocked-skills"),
    workshopList: $("#workshop-list"),
    helpButton: $("#help-button"),
    soundButton: $("#sound-button"),
    helpDialog: $("#help-dialog"),
    eventDialog: $("#event-dialog"),
    eventClose: $("#event-close"),
    eventKicker: $("#event-kicker"),
    eventDialogTitle: $("#event-dialog-title"),
    eventScore: $("#event-score"),
    skillChip: $("#skill-chip"),
    timerLabel: $("#timer-label"),
    timerBar: $("#timer-bar"),
    questionVisual: $("#question-visual"),
    questionText: $("#question-text"),
    answers: $("#answers"),
    feedback: $("#feedback"),
    reportQuestion: $("#report-question"),
    questionReference: $("#question-reference"),
    eventNext: $("#event-next"),
    resetButton: $("#reset-button"),
    confirmDialog: $("#confirm-dialog"),
    confirmKicker: $("#confirm-kicker"),
    confirmTitle: $("#confirm-title"),
    confirmText: $("#confirm-text"),
    confirmAction: $("#confirm-action"),
    toast: $("#toast")
  };

  function freshState() {
    const workshops = {};
    const workshopUpgrades = {};
    const mastery = {};
    Model.WORKSHOPS.forEach(workshop => {
      workshops[workshop.id] = 0;
      workshopUpgrades[workshop.id] = 0;
      mastery[workshop.id] = 0;
    });
    const calibrationUpgrades = {};
    Model.CALIBRATION_UPGRADES.forEach(upgrade => { calibrationUpgrades[upgrade.id] = 0; });
    return {
      version: 2,
      flux: 0,
      cycleFlux: 0,
      lifetimeFlux: 0,
      totalClicks: 0,
      chargeClicks: 0,
      lastManualClickAt: 0,
      hyperUntil: 0,
      boostUntil: 0,
      boostMultiplier: 1,
      workshops,
      workshopUpgrades,
      mastery,
      totalAnswered: 0,
      totalCorrect: 0,
      currentStreak: 0,
      bestStreak: 0,
      cycle: 1,
      calibration: 0,
      calibrationUpgrades,
      nextEventAt: Date.now() + 25000,
      eventWins: 0,
      soundEnabled: true,
      bulk: "1",
      recentKeys: [],
      recentKinds: [],
      questionReports: [],
      lastSeen: Date.now()
    };
  }

  function loadState() {
    const initial = freshState();
    try {
      const parsed = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!parsed || parsed.version !== 2) return initial;
      const merged = { ...initial, ...parsed };
      merged.workshops = { ...initial.workshops, ...(parsed.workshops || {}) };
      merged.workshopUpgrades = { ...initial.workshopUpgrades, ...(parsed.workshopUpgrades || {}) };
      merged.mastery = { ...initial.mastery, ...(parsed.mastery || {}) };
      merged.calibrationUpgrades = { ...initial.calibrationUpgrades, ...(parsed.calibrationUpgrades || {}) };
      Model.WORKSHOPS.forEach(workshop => {
        merged.workshopUpgrades[workshop.id] = Math.min(Model.MILESTONES.length, Math.max(0, Math.floor(Number(merged.workshopUpgrades[workshop.id]) || 0)));
      });
      Model.CALIBRATION_UPGRADES.forEach(upgrade => {
        merged.calibrationUpgrades[upgrade.id] = Math.min(upgrade.costs.length, Math.max(0, Math.floor(Number(merged.calibrationUpgrades[upgrade.id]) || 0)));
      });
      merged.recentKeys = Array.isArray(parsed.recentKeys) ? parsed.recentKeys.slice(-12) : [];
      merged.recentKinds = Array.isArray(parsed.recentKinds) ? parsed.recentKinds.slice(-2) : [];
      merged.questionReports = Array.isArray(parsed.questionReports) ? parsed.questionReports.slice(-REPORT_LIMIT) : [];
      return merged;
    } catch {
      return initial;
    }
  }

  let state = loadState();
  let pendingEvent = null;
  let eventRun = null;
  let currentQuestion = null;
  let questionStartedAt = 0;
  let currentAnswered = false;
  let confirmMode = null;
  let toastTimer = 0;
  let audioContext = null;
  let lastFrame = performance.now();
  let lastRender = 0;
  let lastSave = 0;

  function format(value, options = {}) {
    if (!Number.isFinite(value)) return "∞";
    const absolute = Math.abs(value);
    const digits = options.digits ?? (absolute < 10 ? 1 : 0);
    if (absolute < 1000) return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(value);
    return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  }

  function plural(value, singular, pluralForm = `${singular}s`) {
    return `${format(value, { digits: 0 })} ${value === 1 ? singular : pluralForm}`;
  }

  function now() { return Date.now(); }
  function isHyper() { return state.hyperUntil > now(); }
  function isBoosted() { return state.boostUntil > now(); }
  function hyperStats() { return Model.hyperStats(state.calibrationUpgrades); }
  function permanentMultiplier() { return Model.permanentMultiplier(state.calibration); }
  function baseProduction() { return Model.baseProduction(state.workshops, state.mastery, state.workshopUpgrades); }
  function clickValue() { return Model.clickGain(state.totalClicks, state.workshops, state.calibration, state.calibrationUpgrades); }
  function productionRate() {
    const passive = baseProduction() * permanentMultiplier() * (isBoosted() ? state.boostMultiplier : 1);
    const hyperPulses = isHyper() ? clickValue() * hyperStats().pulsesPerSecond : 0;
    return passive + hyperPulses;
  }

  function addFlux(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    state.flux += amount;
    state.cycleFlux += amount;
    state.lifetimeFlux += amount;
  }

  function save() {
    state.lastSeen = now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* sauvegarde indisponible */ }
  }

  function applyOfflineProgress() {
    const elapsed = Math.min(OFFLINE_LIMIT, Math.max(0, (now() - Number(state.lastSeen || now())) / 1000));
    const rate = baseProduction() * permanentMultiplier();
    const gain = rate * elapsed;
    if (gain >= 1 && elapsed > 15) {
      addFlux(gain);
      setTimeout(() => showToast(`Le laboratoire a produit ${format(gain)} flux pendant ton absence.`), 350);
    }
    state.lastSeen = now();
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2800);
  }

  function questionReference(question) {
    const source = Engine.fingerprint(question);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${question.kind.slice(0, 4).toUpperCase()}-${(hash >>> 0).toString(36).toUpperCase().slice(0, 6)}`;
  }

  function reportCurrentQuestion() {
    if (!currentQuestion) return;
    const reference = questionReference(currentQuestion);
    if (!state.questionReports.some(report => report.reference === reference)) {
      state.questionReports.push({
        reference,
        kind: currentQuestion.kind,
        skill: currentQuestion.skill,
        prompt: currentQuestion.prompt,
        choices: currentQuestion.choices,
        answer: currentQuestion.choices[currentQuestion.answer],
        explanation: currentQuestion.explanation,
        reportedAt: new Date().toISOString()
      });
      if (state.questionReports.length > REPORT_LIMIT) state.questionReports.shift();
    }
    const diagnostic = `[NEXUS ${reference}] ${currentQuestion.prompt} | Réponse attendue : ${currentQuestion.choices[currentQuestion.answer]}`;
    navigator.clipboard?.writeText?.(diagnostic)?.catch(() => {});
    dom.reportQuestion.disabled = true;
    dom.reportQuestion.textContent = "Question signalée";
    save();
    showToast(`Question ${reference} signalée et enregistrée.`);
  }

  function playTone(frequency, duration, options = {}) {
    if (!state.soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === "suspended") audioContext.resume();
      const start = audioContext.currentTime + (options.delay || 0);
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = options.type || "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(options.volume || 0.025, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch { /* les sons restent facultatifs */ }
  }

  function playSound(name) {
    if (name === "click") playTone(170, 0.045, { type: "triangle", endFrequency: 115, volume: 0.018 });
    if (name === "buy") {
      playTone(390, 0.11, { volume: 0.025 });
      playTone(620, 0.14, { delay: 0.07, volume: 0.023 });
    }
    if (name === "event") {
      playTone(300, 0.16, { type: "triangle", volume: 0.026 });
      playTone(450, 0.2, { delay: 0.12, type: "triangle", volume: 0.024 });
    }
    if (name === "correct") {
      playTone(520, 0.12, { volume: 0.026 });
      playTone(780, 0.18, { delay: 0.08, volume: 0.025 });
    }
    if (name === "wrong") playTone(180, 0.2, { type: "square", endFrequency: 125, volume: 0.015 });
    if (name === "hyper") playTone(220, 0.42, { type: "sawtooth", endFrequency: 820, volume: 0.022 });
    if (name === "cycle") {
      playTone(260, 0.18, { volume: 0.026 });
      playTone(390, 0.2, { delay: 0.1, volume: 0.025 });
      playTone(580, 0.25, { delay: 0.2, volume: 0.024 });
    }
  }

  function updateSoundButton() {
    dom.soundButton.textContent = state.soundEnabled ? "♪" : "×";
    dom.soundButton.setAttribute("aria-pressed", String(state.soundEnabled));
    dom.soundButton.setAttribute("aria-label", state.soundEnabled ? "Désactiver les sons" : "Activer les sons");
  }

  function installTouchGuards() {
    let touchStart = null;
    let lastTap = null;
    const pointOf = touch => ({ x: touch.clientX, y: touch.clientY });
    const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    document.addEventListener("touchstart", event => {
      if (event.touches.length > 1) {
        event.preventDefault();
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      touchStart = touch ? { ...pointOf(touch), time: performance.now(), moved: false } : null;
    }, { passive: false });

    document.addEventListener("touchmove", event => {
      if (event.touches.length > 1) {
        event.preventDefault();
        touchStart = null;
        return;
      }
      const touch = event.touches[0];
      if (touchStart && touch && distance(touchStart, pointOf(touch)) > 12) touchStart.moved = true;
    }, { passive: false });

    document.addEventListener("touchend", event => {
      const touch = event.changedTouches[0];
      if (!touch || !touchStart || touchStart.moved || performance.now() - touchStart.time > 450) {
        touchStart = null;
        return;
      }
      const tap = { ...pointOf(touch), time: performance.now() };
      const isDoubleTap = lastTap && tap.time - lastTap.time < 330 && distance(lastTap, tap) < 32;
      if (isDoubleTap) {
        event.preventDefault();
        const target = event.target instanceof Element ? event.target.closest("button, a") : null;
        if (target && !target.matches(":disabled")) target.click();
        lastTap = null;
      } else {
        lastTap = tap;
      }
      touchStart = null;
    }, { passive: false });

    document.addEventListener("touchcancel", () => { touchStart = null; }, { passive: true });
    document.addEventListener("dblclick", event => event.preventDefault(), { passive: false });
    ["gesturestart", "gesturechange", "gestureend"].forEach(type => {
      document.addEventListener(type, event => event.preventDefault(), { passive: false });
    });
  }

  function spawnFloat(amount) {
    const gain = document.createElement("span");
    gain.className = "float-gain";
    gain.textContent = `+${format(amount)}`;
    gain.style.setProperty("--drift", `${Math.round(Math.random() * 54 - 27)}px`);
    dom.floatLayer.append(gain);
    setTimeout(() => gain.remove(), 900);
  }

  function activateHyper() {
    const stats = hyperStats();
    state.hyperUntil = now() + stats.durationMs;
    state.chargeClicks = 0;
    playSound("hyper");
    showToast(`Hypercadence ! Clics ×${format(stats.multiplier)} et ${plural(stats.pulsesPerSecond, "impulsion")} automatique${stats.pulsesPerSecond > 1 ? "s" : ""}/s.`);
  }

  function clickCore() {
    const hyper = isHyper();
    const stats = hyperStats();
    const gain = clickValue() * (hyper ? stats.multiplier : 1);
    state.totalClicks += 1;
    state.lastManualClickAt = now();
    addFlux(gain);
    playSound("click");
    spawnFloat(gain);
    dom.coreButton.classList.add("pulse");
    setTimeout(() => dom.coreButton.classList.remove("pulse"), 90);
    if (!hyper) {
      state.chargeClicks += 1;
      if (state.chargeClicks >= stats.chargeTarget) activateHyper();
    }
  }

  function workshopQuote(workshop) {
    const owned = state.workshops[workshop.id] || 0;
    return Model.purchaseQuote(workshop.id, owned, state.bulk, state.flux);
  }

  function buyWorkshop(id) {
    const workshop = Model.workshopById(id);
    if (!workshop) return;
    const quote = workshopQuote(workshop);
    if (!quote.quantity || quote.cost > state.flux) return;
    const previousCount = state.workshops[id] || 0;
    const first = previousCount === 0;
    state.flux -= quote.cost;
    state.workshops[id] += quote.quantity;
    playSound("buy");
    if (first) {
      state.nextEventAt = Math.min(state.nextEventAt, now() + 12000);
      showToast(`${workshop.name} activé : les questions de ${Engine.SKILLS[id].toLowerCase()} sont débloquées.`);
    }
    const count = state.workshops[id];
    const nextUpgradeMilestone = Model.MILESTONES[state.workshopUpgrades[id] || 0];
    if (nextUpgradeMilestone && previousCount < nextUpgradeMilestone && count >= nextUpgradeMilestone) {
      showToast(`Palier ${nextUpgradeMilestone} atteint : une amélioration ×2 est disponible pour ${workshop.name}.`);
    }
    renderWorkshops();
  }

  function buyWorkshopUpgrade(id) {
    const workshop = Model.workshopById(id);
    if (!workshop) return;
    const level = state.workshopUpgrades[id] || 0;
    const status = Model.workshopUpgradeStatus(id, state.workshops[id] || 0, level);
    if (!status.unlocked || status.completed || status.cost > state.flux) return;
    state.flux -= status.cost;
    state.workshopUpgrades[id] = level + 1;
    playSound("buy");
    showToast(`${workshop.name} amélioré : sa production est doublée.`);
    renderWorkshops();
  }

  function calibrationEffect(id, level) {
    const stats = Model.hyperStats({ ...state.calibrationUpgrades, [id]: level });
    if (id === "corePower") return `Clics ×${format(1 + level * 0.25)}`;
    if (id === "hyperPower") return `Hypercadence ×${format(stats.multiplier)}`;
    if (id === "hyperStability") return `Perte ${format(stats.decayPerSecond)} charge/s`;
    if (id === "hyperDuration") return `Durée ${format(stats.durationMs / 1000)} s`;
    if (id === "hyperPulses") return `${format(stats.pulsesPerSecond)} impulsion${stats.pulsesPerSecond > 1 ? "s" : ""}/s`;
    return "";
  }

  function buyCalibrationUpgrade(id) {
    const upgrade = Model.calibrationUpgradeById(id);
    if (!upgrade) return;
    const level = state.calibrationUpgrades[id] || 0;
    const cost = Model.calibrationUpgradeCost(id, level);
    const available = Model.availableCalibration(state.calibration, state.calibrationUpgrades);
    if (!Number.isFinite(cost) || cost > available) return;
    state.calibrationUpgrades[id] = level + 1;
    playSound("buy");
    save();
    renderCalibrationUpgrades();
    showToast(`${upgrade.name} passe au niveau ${level + 1}.`);
  }

  function unlockedWorkshops() {
    return Model.WORKSHOPS.filter(workshop => (state.workshops[workshop.id] || 0) > 0);
  }

  function createPendingEvent() {
    const unlocked = unlockedWorkshops();
    if (!unlocked.length) {
      state.nextEventAt = now() + 10000;
      return;
    }
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const maxTier = Math.max(...unlocked.map(workshop => workshop.tier));
    const questionCount = maxTier >= 7 ? 3 : maxTier >= 4 ? 2 : 1;
    pendingEvent = {
      ...type,
      skills: unlocked.map(workshop => workshop.id),
      questionCount
    };
    playSound("event");
  }

  function scheduleNextEvent() {
    pendingEvent = null;
    state.nextEventAt = now() + (50000 + Math.random() * 30000);
  }

  function startEvent() {
    if (eventRun) {
      if (!dom.eventDialog.open) dom.eventDialog.showModal();
      return;
    }
    if (!pendingEvent) return;
    eventRun = {
      event: pendingEvent,
      index: 0,
      correct: 0,
      fast: 0
    };
    dom.eventKicker.textContent = `Perturbation · ${pendingEvent.questionCount} ${pendingEvent.questionCount === 1 ? "question" : "questions"}`;
    dom.eventDialogTitle.textContent = pendingEvent.title;
    dom.eventNext.hidden = true;
    dom.eventDialog.showModal();
    nextQuestion();
  }

  function nextQuestion() {
    if (!eventRun) return;
    eventRun.index += 1;
    currentAnswered = false;
    currentQuestion = Engine.generateForSkills(
      eventRun.event.skills,
      state.mastery,
      Math.random,
      { keys: state.recentKeys, kinds: state.recentKinds }
    );
    const key = Engine.fingerprint(currentQuestion);
    state.recentKeys.push(key);
    state.recentKinds.push(currentQuestion.kind);
    if (state.recentKeys.length > 12) state.recentKeys.shift();
    if (state.recentKinds.length > 2) state.recentKinds.shift();

    dom.eventScore.textContent = `${eventRun.correct}/${eventRun.event.questionCount}`;
    dom.skillChip.textContent = Engine.SKILLS[currentQuestion.skill];
    dom.questionText.textContent = currentQuestion.prompt;
    const reference = questionReference(currentQuestion);
    const alreadyReported = state.questionReports.some(report => report.reference === reference);
    dom.questionReference.textContent = `Réf. ${reference}`;
    dom.reportQuestion.disabled = true;
    dom.reportQuestion.textContent = alreadyReported ? "Question signalée" : "Signaler après avoir répondu";
    dom.questionVisual.innerHTML = currentQuestion.visual || "";
    dom.questionVisual.hidden = !currentQuestion.visual;
    dom.feedback.hidden = true;
    dom.feedback.classList.remove("wrong");
    dom.eventNext.hidden = true;
    dom.answers.replaceChildren();
    currentQuestion.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "answer-button";
      button.type = "button";
      button.textContent = choice;
      button.addEventListener("click", () => answerQuestion(index));
      dom.answers.append(button);
    });
    questionStartedAt = performance.now();
  }

  function answerQuestion(index) {
    if (!currentQuestion || currentAnswered || !eventRun) return;
    currentAnswered = true;
    const elapsed = performance.now() - questionStartedAt;
    const correct = index === currentQuestion.answer;
    state.totalAnswered += 1;
    if (correct) {
      state.totalCorrect += 1;
      state.currentStreak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.currentStreak);
      state.mastery[currentQuestion.skill] = (state.mastery[currentQuestion.skill] || 0) + 1;
      eventRun.correct += 1;
      if (elapsed <= FAST_TIME) eventRun.fast += 1;
      playSound("correct");
    } else {
      state.currentStreak = 0;
      playSound("wrong");
    }

    [...dom.answers.children].forEach((button, buttonIndex) => {
      button.disabled = true;
      if (buttonIndex === currentQuestion.answer) button.classList.add("correct");
      if (buttonIndex === index && !correct) button.classList.add("wrong");
    });
    dom.feedback.hidden = false;
    dom.feedback.classList.toggle("wrong", !correct);
    const speedText = correct && elapsed <= FAST_TIME ? " Réponse rapide : récompense améliorée." : "";
    dom.feedback.innerHTML = `<strong>${correct ? "Bonne réponse." : "Pas cette fois."}</strong> ${currentQuestion.explanation}${speedText}`;
    const reference = questionReference(currentQuestion);
    const alreadyReported = state.questionReports.some(report => report.reference === reference);
    dom.reportQuestion.disabled = alreadyReported;
    dom.reportQuestion.textContent = alreadyReported ? "Question signalée" : "Signaler cette question";
    dom.eventScore.textContent = `${eventRun.correct}/${eventRun.event.questionCount}`;
    dom.eventNext.hidden = false;
    dom.eventNext.textContent = eventRun.index >= eventRun.event.questionCount ? "Terminer l'intervention" : "Question suivante";
  }

  function rewardEvent(run) {
    const successNeeded = Math.ceil(run.event.questionCount * 0.6);
    if (run.correct < successNeeded) {
      showToast("Intervention terminée. Aucun flux perdu : une autre perturbation viendra.");
      return;
    }
    state.eventWins += 1;
    if (run.event.id === "surge") {
      state.boostMultiplier = 2 + Math.min(1, run.fast * 0.25);
      state.boostUntil = now() + 45000;
      showToast(`Réseau stabilisé : production ×${format(state.boostMultiplier)} pendant 45 s !`);
      return;
    }
    if (run.event.id === "cache") {
      const gain = Math.max(120, baseProduction() * 75, clickValue() * 80) * (1 + run.fast * 0.25);
      addFlux(gain);
      showToast(`Optimisation réussie : +${format(gain)} flux !`);
      return;
    }
    const candidates = run.event.skills.filter(skill => (state.workshops[skill] || 0) > 0);
    const id = candidates[Math.floor(Math.random() * candidates.length)];
    state.workshops[id] += 1;
    showToast(`Prototype validé : +1 ${Model.workshopById(id).name} !`);
  }

  function advanceEvent() {
    if (!eventRun || !currentAnswered) return;
    if (eventRun.index < eventRun.event.questionCount) {
      nextQuestion();
      return;
    }
    rewardEvent(eventRun);
    eventRun = null;
    currentQuestion = null;
    scheduleNextEvent();
    dom.eventDialog.close();
    renderWorkshops();
  }

  function showConfirm(mode) {
    confirmMode = mode;
    if (mode === "cycle") {
      const gain = Model.cycleGain(state.cycleFlux, state.cycle);
      const availableAfter = Model.availableCalibration(state.calibration + gain, state.calibrationUpgrades);
      dom.confirmKicker.textContent = "Cycle d'étalonnage";
      dom.confirmTitle.textContent = "Reconfigurer le laboratoire ?";
      dom.confirmText.textContent = `Tu gagneras ${plural(gain, "point")} d'étalonnage et disposeras alors de ${plural(availableAfter, "point")} à investir. Le flux, les ateliers et leurs améliorations repartiront de zéro. Ta maîtrise, tes protocoles permanents et tes statistiques seront conservés. Le multiplicateur permanent passera à ×${format(Model.permanentMultiplier(state.calibration + gain))}.`;
      dom.confirmAction.textContent = "Lancer le nouveau cycle";
    } else {
      dom.confirmKicker.textContent = "Réinitialisation";
      dom.confirmTitle.textContent = "Effacer cette partie ?";
      dom.confirmText.textContent = "Toute la progression de cette nouvelle version sera supprimée. Cette action est définitive.";
      dom.confirmAction.textContent = "Tout recommencer";
    }
    dom.confirmDialog.showModal();
  }

  function startNewCycle() {
    const gain = Model.cycleGain(state.cycleFlux, state.cycle);
    if (gain < 1) return;
    state.calibration += gain;
    state.cycle += 1;
    state.flux = state.calibration * 25;
    state.cycleFlux = 0;
    state.chargeClicks = 0;
    state.lastManualClickAt = 0;
    state.hyperUntil = 0;
    state.boostUntil = 0;
    state.boostMultiplier = 1;
    Model.WORKSHOPS.forEach(workshop => {
      state.workshops[workshop.id] = 0;
      state.workshopUpgrades[workshop.id] = 0;
    });
    eventRun = null;
    currentQuestion = null;
    scheduleNextEvent();
    save();
    renderWorkshops();
    renderCalibrationUpgrades();
    playSound("cycle");
    showToast(`Cycle ${state.cycle} lancé avec un multiplicateur permanent ×${format(permanentMultiplier())}.`);
  }

  function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    state = freshState();
    pendingEvent = null;
    eventRun = null;
    currentQuestion = null;
    renderWorkshops();
    renderCalibrationUpgrades();
    save();
    showToast("Nouvelle partie créée.");
  }

  function createWorkshopCards() {
    const fragment = document.createDocumentFragment();
    Model.WORKSHOPS.forEach(workshop => {
      const card = document.createElement("article");
      card.className = "workshop-card";
      card.dataset.workshop = workshop.id;
      card.innerHTML = `
        <span class="workshop-count" id="count-bg-${workshop.id}">0</span>
        <div class="workshop-icon" aria-hidden="true">${workshop.icon}</div>
        <div class="workshop-info">
          <h3>${workshop.name}</h3>
          <p>${workshop.description}</p>
          <div class="workshop-meta">
            <span id="rate-${workshop.id}">0/s</span>
            <span id="mastery-${workshop.id}">Maîtrise 0</span>
            <span id="milestone-${workshop.id}">Palier à 10</span>
          </div>
        </div>
        <button class="workshop-buy" data-buy="${workshop.id}" type="button"><span>Acheter</span><small>${format(workshop.baseCost)} flux</small></button>
        <button class="workshop-upgrade" data-upgrade="${workshop.id}" type="button"><span>Amélioration ×2</span><small>Débloquée au palier 10</small></button>`;
      fragment.append(card);
    });
    dom.workshopList.replaceChildren(fragment);
    dom.workshopList.addEventListener("click", event => {
      const upgradeButton = event.target.closest("[data-upgrade]");
      if (upgradeButton) {
        buyWorkshopUpgrade(upgradeButton.dataset.upgrade);
        return;
      }
      const button = event.target.closest("[data-buy]");
      if (button) buyWorkshop(button.dataset.buy);
    });
  }

  function renderWorkshops() {
    Model.WORKSHOPS.forEach(workshop => {
      const count = state.workshops[workshop.id] || 0;
      const card = dom.workshopList.querySelector(`[data-workshop="${workshop.id}"]`);
      if (!card) return;
      const quote = workshopQuote(workshop);
      const button = card.querySelector(".workshop-buy");
      const upgradeButton = card.querySelector(".workshop-upgrade");
      const upgradeLevel = state.workshopUpgrades[workshop.id] || 0;
      const upgradeStatus = Model.workshopUpgradeStatus(workshop.id, count, upgradeLevel);
      const rate = Model.workshopProduction(workshop.id, count, state.mastery[workshop.id], upgradeLevel) * permanentMultiplier() * (isBoosted() ? state.boostMultiplier : 1);
      card.classList.toggle("owned", count > 0);
      card.classList.toggle("unaffordable", !quote.quantity && !(upgradeStatus.unlocked && state.flux >= upgradeStatus.cost));
      card.querySelector(`#count-bg-${workshop.id}`).textContent = count;
      card.querySelector(`#rate-${workshop.id}`).innerHTML = `<b>${format(rate)}/s</b>`;
      card.querySelector(`#mastery-${workshop.id}`).textContent = `Maîtrise ${state.mastery[workshop.id] || 0}`;
      card.querySelector(`#milestone-${workshop.id}`).textContent = upgradeStatus.completed
        ? "Toutes les améliorations achetées"
        : upgradeStatus.unlocked
          ? `Palier ${upgradeStatus.milestone} atteint · amélioration disponible`
          : `Prochain palier : ${upgradeStatus.milestone} (${count}/${upgradeStatus.milestone})`;
      button.disabled = !quote.quantity;
      button.querySelector("span").textContent = quote.quantity ? `Acheter ×${quote.quantity}` : "Acheter";
      button.querySelector("small").textContent = quote.quantity ? `${format(quote.cost)} flux` : `${format(Model.workshopCost(workshop.id, count))} flux`;
      upgradeButton.hidden = upgradeStatus.completed;
      upgradeButton.disabled = !upgradeStatus.unlocked || upgradeStatus.cost > state.flux;
      upgradeButton.classList.toggle("ready", upgradeStatus.unlocked && upgradeStatus.cost <= state.flux);
      upgradeButton.querySelector("span").textContent = upgradeStatus.unlocked ? `Doubler · niveau ${upgradeLevel + 1}` : `Amélioration ×2`;
      upgradeButton.querySelector("small").textContent = upgradeStatus.unlocked
        ? `${format(upgradeStatus.cost)} flux`
        : `Débloquée au palier ${upgradeStatus.milestone}`;
    });
  }

  function createCalibrationCards() {
    const fragment = document.createDocumentFragment();
    Model.CALIBRATION_UPGRADES.forEach(upgrade => {
      const card = document.createElement("article");
      card.className = "calibration-upgrade";
      card.dataset.calibrationCard = upgrade.id;
      card.innerHTML = `
        <span class="calibration-icon" aria-hidden="true">${upgrade.icon}</span>
        <div><strong>${upgrade.name}</strong><p>${upgrade.description}</p><small id="calibration-effect-${upgrade.id}"></small></div>
        <button data-calibration-buy="${upgrade.id}" type="button"><span>Niv. 0</span><small>1 pt</small></button>`;
      fragment.append(card);
    });
    dom.calibrationUpgradeList.replaceChildren(fragment);
    dom.calibrationUpgradeList.addEventListener("click", event => {
      const button = event.target.closest("[data-calibration-buy]");
      if (button) buyCalibrationUpgrade(button.dataset.calibrationBuy);
    });
  }

  function renderCalibrationUpgrades() {
    const available = Model.availableCalibration(state.calibration, state.calibrationUpgrades);
    dom.calibrationAvailable.textContent = `${plural(available, "pt")} disponible${available === 1 ? "" : "s"}`;
    Model.CALIBRATION_UPGRADES.forEach(upgrade => {
      const card = dom.calibrationUpgradeList.querySelector(`[data-calibration-card="${upgrade.id}"]`);
      if (!card) return;
      const level = state.calibrationUpgrades[upgrade.id] || 0;
      const cost = Model.calibrationUpgradeCost(upgrade.id, level);
      const button = card.querySelector("button");
      const maxed = !Number.isFinite(cost);
      card.classList.toggle("maxed", maxed);
      card.querySelector(`#calibration-effect-${upgrade.id}`).textContent = calibrationEffect(upgrade.id, level);
      button.disabled = maxed || cost > available;
      button.querySelector("span").textContent = maxed ? "MAX" : `Niv. ${level} → ${level + 1}`;
      button.querySelector("small").textContent = maxed ? "Terminé" : plural(cost, "pt");
    });
  }

  function renderEvent(nowValue) {
    if (!pendingEvent && nowValue >= state.nextEventAt && !eventRun) createPendingEvent();
    const visibleEvent = eventRun?.event || pendingEvent;
    dom.eventCard.hidden = !visibleEvent;
    if (visibleEvent) {
      dom.eventTitle.textContent = visibleEvent.title;
      dom.eventDescription.textContent = visibleEvent.description;
      dom.eventReward.textContent = visibleEvent.preview;
      dom.eventStart.textContent = eventRun ? "Reprendre" : "Intervenir";
      dom.eventCountdown.textContent = eventRun ? "Intervention en cours — le noyau continue de produire." : "La perturbation attend ton intervention ; tu peux continuer à produire.";
      return;
    }
    const unlocked = unlockedWorkshops();
    if (!unlocked.length) {
      dom.eventCountdown.textContent = "Achète un atelier pour rendre les perturbations disponibles.";
    } else {
      const seconds = Math.max(0, Math.ceil((state.nextEventAt - nowValue) / 1000));
      dom.eventCountdown.textContent = `Signal calme · prochaine perturbation possible dans environ ${seconds} s.`;
    }
  }

  function renderQuestionTimer() {
    if (!dom.eventDialog.open || !currentQuestion || currentAnswered) return;
    const elapsed = performance.now() - questionStartedAt;
    const remaining = Math.max(0, 1 - elapsed / MAX_QUESTION_TIME);
    dom.timerBar.style.width = `${remaining * 100}%`;
    if (elapsed <= FAST_TIME) dom.timerLabel.textContent = `Bonus rapide · ${Math.max(0, (FAST_TIME - elapsed) / 1000).toFixed(1).replace(".", ",")} s`;
    else dom.timerLabel.textContent = "Prends le temps de raisonner";
  }

  function render(nowValue = now()) {
    const hyper = state.hyperUntil > nowValue;
    const boost = state.boostUntil > nowValue;
    const cadence = hyperStats();
    const owned = Model.totalOwned(state.workshops);
    const cycleTarget = Model.cycleTarget(state.cycle);
    const cycleGain = Model.cycleGain(state.cycleFlux, state.cycle);
    const masteryTotal = Object.values(state.mastery).reduce((sum, value) => sum + Number(value || 0), 0);
    const unlocked = unlockedWorkshops();
    const click = clickValue();
    const availableCalibration = Model.availableCalibration(state.calibration, state.calibrationUpgrades);

    dom.flux.textContent = format(state.flux);
    dom.production.textContent = `${format(productionRate())}/s`;
    dom.calibration.textContent = `${format(availableCalibration, { digits: 0 })}/${format(state.calibration, { digits: 0 })} pts`;
    dom.cycle.textContent = state.cycle;
    dom.cycleRing.textContent = state.cycle;
    dom.cycleProgressText.textContent = `${format(state.cycleFlux)} / ${format(cycleTarget)}`;
    dom.cycleProgressBar.style.width = `${Math.min(100, state.cycleFlux / cycleTarget * 100)}%`;
    dom.cycleGain.textContent = plural(cycleGain, "point");
    dom.permanentMultiplier.textContent = `Production permanente ×${format(permanentMultiplier())}`;
    dom.cycleButton.disabled = cycleGain < 1;
    dom.masteryTotal.textContent = masteryTotal;

    dom.corePanel.classList.toggle("hyper", hyper);
    dom.clickGain.textContent = `+${format(click * (hyper ? cadence.multiplier : 1))} flux par clic${hyper ? ` · ×${format(cadence.multiplier)}` : ""}`;
    dom.totalClicks.textContent = plural(state.totalClicks, "activation");
    if (hyper) {
      const remaining = Math.max(0, (state.hyperUntil - nowValue) / 1000);
      dom.cadenceTitle.textContent = "HYPERCADENCE ACTIVE";
      dom.cadenceHint.textContent = `Clics ×${format(cadence.multiplier)} et ${format(cadence.pulsesPerSecond)} impulsion${cadence.pulsesPerSecond > 1 ? "s" : ""}/s`;
      dom.cadenceCount.textContent = `${remaining.toFixed(1).replace(".", ",")} s`;
      dom.cadenceBar.style.width = `${remaining / (cadence.durationMs / 1000) * 100}%`;
      dom.boostPill.classList.add("hot");
      dom.boostPill.innerHTML = `<span></span>Hypercadence ×${format(cadence.multiplier)}`;
    } else {
      dom.cadenceTitle.textContent = "Charge d'Hypercadence";
      const decaying = state.chargeClicks > 0 && nowValue - state.lastManualClickAt > cadence.idleDelayMs;
      dom.cadenceHint.textContent = decaying
        ? `Charge en baisse · −${format(cadence.decayPerSecond)} par seconde`
        : `${cadence.chargeTarget} clics réguliers pour accélérer le noyau`;
      dom.cadenceCount.textContent = `${format(state.chargeClicks)} / ${cadence.chargeTarget}`;
      dom.cadenceBar.style.width = `${state.chargeClicks / cadence.chargeTarget * 100}%`;
      dom.boostPill.classList.toggle("hot", boost);
      dom.boostPill.innerHTML = boost ? `<span></span>Production ×${format(state.boostMultiplier)}` : "<span></span>Régime normal";
    }

    dom.ownedTotal.textContent = owned;
    dom.correctTotal.textContent = state.totalCorrect;
    dom.accuracy.textContent = state.totalAnswered ? `${Math.round(state.totalCorrect / state.totalAnswered * 100)} %` : "—";
    dom.bestStreak.textContent = state.bestStreak;
    if (hyper) dom.activeEffect.textContent = `Hypercadence · ${Math.ceil((state.hyperUntil - nowValue) / 1000)} s`;
    else if (boost) dom.activeEffect.textContent = `Production ×${format(state.boostMultiplier)} · ${Math.ceil((state.boostUntil - nowValue) / 1000)} s`;
    else dom.activeEffect.textContent = "Aucun";
    dom.unlockedCount.textContent = `${unlocked.length}/${Model.WORKSHOPS.length}`;
    dom.unlockedSkills.innerHTML = unlocked.length
      ? unlocked.map(workshop => `<span class="skill-mini">${Engine.SKILLS[workshop.id]}</span>`).join("")
      : '<span class="empty-chip">Achète un atelier</span>';

    renderEvent(nowValue);
    renderQuestionTimer();
  }

  function frame(timestamp) {
    const delta = Math.min(0.25, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    addFlux(productionRate() * delta);
    const cadence = hyperStats();
    if (!isHyper() && state.chargeClicks > 0 && now() - state.lastManualClickAt > cadence.idleDelayMs) {
      state.chargeClicks = Model.decayHyperCharge(state.chargeClicks, now() - state.lastManualClickAt, delta, state.calibrationUpgrades);
    }
    if (!isHyper() && state.hyperUntil !== 0) state.hyperUntil = 0;
    if (!isBoosted() && state.boostUntil !== 0) {
      state.boostUntil = 0;
      state.boostMultiplier = 1;
    }
    if (timestamp - lastRender > 100) {
      render();
      renderWorkshops();
      lastRender = timestamp;
    }
    if (timestamp - lastSave > 3000) {
      save();
      lastSave = timestamp;
    }
    requestAnimationFrame(frame);
  }

  dom.coreButton.addEventListener("click", clickCore);
  dom.helpButton.addEventListener("click", () => dom.helpDialog.showModal());
  dom.soundButton.addEventListener("click", () => {
    state.soundEnabled = !state.soundEnabled;
    updateSoundButton();
    if (state.soundEnabled) playTone(520, 0.12, { volume: 0.025 });
    save();
  });
  dom.eventStart.addEventListener("click", startEvent);
  dom.eventClose.addEventListener("click", () => dom.eventDialog.close());
  dom.eventNext.addEventListener("click", advanceEvent);
  dom.reportQuestion.addEventListener("click", reportCurrentQuestion);
  dom.cycleButton.addEventListener("click", () => showConfirm("cycle"));
  dom.resetButton.addEventListener("click", () => showConfirm("reset"));
  dom.confirmAction.addEventListener("click", event => {
    event.preventDefault();
    dom.confirmDialog.close();
    if (confirmMode === "cycle") startNewCycle();
    if (confirmMode === "reset") resetGame();
    confirmMode = null;
  });
  document.querySelectorAll(".bulk-button").forEach(button => button.addEventListener("click", () => {
    state.bulk = button.dataset.bulk;
    document.querySelectorAll(".bulk-button").forEach(item => item.classList.toggle("active", item === button));
    renderWorkshops();
  }));
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) save();
    else {
      applyOfflineProgress();
      lastFrame = performance.now();
    }
  });

  installTouchGuards();
  createWorkshopCards();
  createCalibrationCards();
  updateSoundButton();
  document.querySelectorAll(".bulk-button").forEach(button => button.classList.toggle("active", button.dataset.bulk === String(state.bulk)));
  applyOfflineProgress();
  renderWorkshops();
  renderCalibrationUpgrades();
  render();
  showToast("Clique sur le noyau pour produire tes premiers flux.");
  requestAnimationFrame(frame);

  window.NexusGameDebug = {
    getState: () => JSON.parse(JSON.stringify(state)),
    addFlux,
    createPendingEvent,
    productionRate
  };

  if ("serviceWorker" in navigator) {
    let reloadingForUpdate = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForUpdate) return;
      reloadingForUpdate = true;
      window.location.reload();
    });
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { updateViaCache: "none" })
        .then(registration => registration.update())
        .catch(() => { /* jeu utilisable sans mode hors ligne */ });
    });
  }
})();
