(() => {
  "use strict";

  const Engine = window.QuestionEngine;
  if (!Engine) throw new Error("Le générateur de questions NEXUS n'a pas été chargé.");

  const $ = selector => document.querySelector(selector);
  const SPECIALITY_ORIGIN = "Spécialité mathématiques STI2D";
  const SUBSCRIPT_CHARACTERS = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "−", "ₙ": "n" };
  const SUPERSCRIPT_CHARACTERS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "−" };
  const MATH_INLINE_PATTERN = /(?:√?\d+|ρ)\(cos\([^()]+\)\s*\+\s*sin\([^()]+\)i\)|\[(?:√?\d+|ρ)\s*,\s*[^,\]]+\]|(?:cos|sin)\([^()]+\)|P\([^()]*\)(?:\s*=\s*[−-]?\d+(?:[,.]\d+)?)?|u[₀₁₂₃₄₅₆₇₈₉₊₋ₙ]+(?:\s*=\s*(?:u[₀₁₂₃₄₅₆₇₈₉₊₋ₙ]+|[−-]?\d+)(?:\s*[+−-]\s*\d+)?)?|(?:[−-]?\d*)?\(x\s*[+−-]\s*\d+\)(?:\(x\s*[+−-]\s*\d+\))+(?:\s*=\s*0)?|(?:f′?\(x\)|[xy])\s*[=<>≤≥]\s*[−-]?\d+(?:\s+(?:ou|et)\s*[xy]\s*[=<>≤≥]\s*[−-]?\d+)?|\d+\s*×\s*10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g;

  const dom = {
    catalogueTotal: $("#catalog-total"), programmeSwitch: $("#programme-switch"),
    skillSelect: $("#skill-select"), kindSelect: $("#kind-select"), kindDescription: $("#kind-description"),
    previousKind: $("#previous-kind"), nextKind: $("#next-kind"), kindPosition: $("#kind-position"),
    visitedCount: $("#visited-count"), visitedBar: $("#visited-bar"), resetSession: $("#reset-session"),
    questionSkill: $("#question-skill"), questionKind: $("#question-kind"), questionOrigin: $("#question-origin"),
    questionReference: $("#question-reference"), questionValidation: $("#question-validation"),
    questionVisual: $("#question-visual"), questionText: $("#question-text"), answers: $("#answers"),
    feedback: $("#feedback"), feedbackMark: $("#feedback-mark"), feedbackLabel: $("#feedback-label"),
    correctAnswer: $("#correct-answer"), explanation: $("#explanation"), revealAnswer: $("#reveal-answer"),
    copyDiagnostic: $("#copy-diagnostic"), newVariant: $("#new-variant"), successRate: $("#success-rate"),
    generatedCount: $("#generated-count"), answeredCount: $("#answered-count"), correctCount: $("#correct-count"),
    toast: $("#toast")
  };

  let programme = "all";
  let currentQuestion = null;
  let selectedAnswer = null;
  let revealed = false;
  let generated = 0;
  let answered = 0;
  let correct = 0;
  let toastTimer = 0;
  const visitedKinds = new Set();
  const recentKeys = [];

  function appendMathCharacters(target, text) {
    String(text).split(/([₀₁₂₃₄₅₆₇₈₉₊₋ₙ]+|[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+)/g).forEach(fragment => {
      if (!fragment) return;
      const subscript = [...fragment].every(character => SUBSCRIPT_CHARACTERS[character] !== undefined);
      const superscript = [...fragment].every(character => SUPERSCRIPT_CHARACTERS[character] !== undefined);
      if (!subscript && !superscript) return target.append(document.createTextNode(fragment));
      const modifier = document.createElement("span");
      modifier.className = subscript ? "math-sub" : "math-sup";
      modifier.textContent = [...fragment].map(character => (subscript ? SUBSCRIPT_CHARACTERS : SUPERSCRIPT_CHARACTERS)[character]).join("");
      target.append(modifier);
    });
  }

  function renderMathText(target, text) {
    const fragment = document.createDocumentFragment();
    const source = String(text);
    let cursor = 0;
    for (const match of source.matchAll(MATH_INLINE_PATTERN)) {
      appendMathCharacters(fragment, source.slice(cursor, match.index));
      const formula = document.createElement("span");
      formula.className = "math-inline";
      appendMathCharacters(formula, match[0]);
      fragment.append(formula);
      cursor = match.index + match[0].length;
    }
    appendMathCharacters(fragment, source.slice(cursor));
    target.replaceChildren(fragment);
  }

  function programmeSubskills() {
    return Engine.SUBSKILLS.filter(subskill => programme === "all"
      || (programme === "speciality" ? subskill.origin === SPECIALITY_ORIGIN : subskill.origin !== SPECIALITY_ORIGIN));
  }

  function filteredSubskills() {
    return programmeSubskills().filter(subskill => dom.skillSelect.value === "all" || subskill.skill === dom.skillSelect.value);
  }

  function option(value, label) {
    const element = document.createElement("option");
    element.value = value;
    element.textContent = label;
    return element;
  }

  function populateSkills() {
    const previous = dom.skillSelect.value || "all";
    const skills = [...new Set(programmeSubskills().map(subskill => subskill.skill))];
    dom.skillSelect.replaceChildren(option("all", `Tous les ateliers (${skills.length})`));
    skills.forEach(skill => dom.skillSelect.append(option(skill, Engine.SKILLS[skill])));
    dom.skillSelect.value = skills.includes(previous) ? previous : "all";
  }

  function selectedSubskill() {
    return Engine.SUBSKILLS.find(subskill => subskill.id === dom.kindSelect.value) || null;
  }

  function updateKindDetails() {
    const subskills = filteredSubskills();
    const selected = selectedSubskill();
    if (selected) {
      dom.kindDescription.innerHTML = `${selected.section}<br><code>${selected.id}</code> · ${selected.origin}`;
      dom.kindPosition.textContent = `${subskills.findIndex(subskill => subskill.id === selected.id) + 1}/${subskills.length}`;
    } else {
      dom.kindDescription.textContent = "Les variantes sont tirées parmi tous les formats visibles dans les filtres actuels.";
      dom.kindPosition.textContent = `Mélange · ${subskills.length}`;
    }
  }

  function populateKinds({ preserve = true } = {}) {
    const previous = preserve ? dom.kindSelect.value : "all";
    const subskills = filteredSubskills();
    dom.kindSelect.replaceChildren(option("all", `Mélange automatique (${subskills.length} formats)`));
    subskills.forEach(subskill => dom.kindSelect.append(option(subskill.id, `${subskill.label} — ${subskill.id}`)));
    dom.kindSelect.value = subskills.some(subskill => subskill.id === previous) ? previous : "all";
    updateKindDetails();
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

  function renderQuestionCanvases() {
    dom.questionVisual.querySelectorAll("canvas[data-plot='line']").forEach(canvas => {
      const width = Math.max(260, Math.min(780, Math.round(canvas.getBoundingClientRect().width || 620)));
      const height = Math.round(Math.max(210, width * 0.48));
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext("2d");
      context.scale(ratio, ratio);
      const margin = 28;
      const xMin = -4, xMax = 4, yMin = -6, yMax = 6;
      const px = x => margin + (x - xMin) / (xMax - xMin) * (width - margin * 2);
      const py = y => height - margin - (y - yMin) / (yMax - yMin) * (height - margin * 2);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "rgba(4, 20, 29, 0.78)";
      context.fillRect(0, 0, width, height);
      context.lineWidth = 1;
      context.font = "10px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "top";
      for (let x = xMin; x <= xMax; x += 1) {
        context.strokeStyle = x === 0 ? "rgba(220, 246, 250, 0.62)" : "rgba(125, 196, 210, 0.13)";
        context.beginPath(); context.moveTo(px(x), margin); context.lineTo(px(x), height - margin); context.stroke();
        if (x !== 0) { context.fillStyle = "rgba(190, 218, 225, 0.7)"; context.fillText(String(x), px(x), py(0) + 5); }
      }
      context.textAlign = "right";
      context.textBaseline = "middle";
      for (let y = yMin; y <= yMax; y += 1) {
        context.strokeStyle = y === 0 ? "rgba(220, 246, 250, 0.62)" : "rgba(125, 196, 210, 0.13)";
        context.beginPath(); context.moveTo(margin, py(y)); context.lineTo(width - margin, py(y)); context.stroke();
        if (y !== 0 && y % 2 === 0) { context.fillStyle = "rgba(190, 218, 225, 0.7)"; context.fillText(String(y), px(0) - 5, py(y)); }
      }
      if (canvas.dataset.level !== undefined) {
        const level = Number(canvas.dataset.level);
        context.setLineDash([6, 5]); context.strokeStyle = "rgba(255, 186, 107, 0.85)";
        context.beginPath(); context.moveTo(margin, py(level)); context.lineTo(width - margin, py(level)); context.stroke(); context.setLineDash([]);
      }
      const slope = Number(canvas.dataset.slope), intercept = Number(canvas.dataset.intercept);
      context.save(); context.beginPath(); context.rect(margin, margin, width - margin * 2, height - margin * 2); context.clip();
      context.lineWidth = 3; context.strokeStyle = "#c47cff"; context.beginPath();
      context.moveTo(px(xMin), py(slope * xMin + intercept)); context.lineTo(px(xMax), py(slope * xMax + intercept)); context.stroke(); context.restore();
      context.fillStyle = "#66e4e7"; context.beginPath(); context.arc(px(0), py(intercept), 4, 0, Math.PI * 2); context.fill();
    });
  }

  function updateURL() {
    const url = new URL(window.location.href);
    if (dom.kindSelect.value === "all") url.searchParams.delete("kind");
    else url.searchParams.set("kind", dom.kindSelect.value);
    history.replaceState(null, "", url);
  }

  function newQuestion() {
    const kinds = dom.kindSelect.value === "all" ? filteredSubskills().map(subskill => subskill.id) : [dom.kindSelect.value];
    if (!kinds.length) return;
    currentQuestion = Engine.generateForKinds(kinds, {}, Math.random, { keys: recentKeys });
    recentKeys.push(Engine.fingerprint(currentQuestion));
    if (recentKeys.length > 12) recentKeys.shift();
    generated += 1;
    visitedKinds.add(currentQuestion.kind);
    selectedAnswer = null;
    revealed = false;
    renderCurrentQuestion();
    updateSession();
    updateURL();
  }

  function renderCurrentQuestion() {
    const subskill = Engine.subskillForQuestion(currentQuestion);
    const validation = Engine.validateQuestion(currentQuestion);
    dom.questionSkill.textContent = Engine.SKILLS[currentQuestion.skill];
    dom.questionKind.textContent = subskill?.label || currentQuestion.kind;
    dom.questionOrigin.textContent = `${subskill?.section || "Programme"} · ${subskill?.origin || "Première 2026"}`;
    dom.questionReference.textContent = `Réf. ${questionReference(currentQuestion)}`;
    dom.questionValidation.textContent = validation.valid ? "Génération valide" : validation.errors.join(" · ");
    dom.questionValidation.classList.toggle("error", !validation.valid);
    renderMathText(dom.questionText, currentQuestion.prompt);
    dom.questionVisual.innerHTML = currentQuestion.visual || "";
    dom.questionVisual.hidden = !currentQuestion.visual;
    renderQuestionCanvases();
    dom.answers.replaceChildren();
    currentQuestion.choices.forEach((choice, index) => {
      const button = document.createElement("button");
      button.className = "answer-button";
      button.type = "button";
      renderMathText(button, choice);
      button.addEventListener("click", () => chooseAnswer(index));
      dom.answers.append(button);
    });
    dom.feedback.hidden = true;
    dom.feedback.classList.remove("wrong");
    dom.revealAnswer.disabled = false;
  }

  function showCorrection({ wasCorrect = null } = {}) {
    revealed = true;
    [...dom.answers.querySelectorAll(".answer-button")].forEach((button, index) => {
      button.disabled = true;
      button.classList.toggle("correct", index === currentQuestion.answer);
      button.classList.toggle("wrong", selectedAnswer === index && index !== currentQuestion.answer);
    });
    dom.feedback.hidden = false;
    dom.feedback.classList.toggle("wrong", wasCorrect === false);
    dom.feedbackMark.textContent = wasCorrect === false ? "×" : "✓";
    dom.feedbackLabel.textContent = wasCorrect === null ? "Correction révélée" : wasCorrect ? "Réponse exacte" : "Réponse à reprendre";
    renderMathText(dom.correctAnswer, `Bonne réponse : ${currentQuestion.choices[currentQuestion.answer]}`);
    renderMathText(dom.explanation, currentQuestion.explanation);
    dom.revealAnswer.disabled = true;
  }

  function chooseAnswer(index) {
    if (revealed || selectedAnswer !== null) return;
    selectedAnswer = index;
    answered += 1;
    const wasCorrect = index === currentQuestion.answer;
    if (wasCorrect) correct += 1;
    showCorrection({ wasCorrect });
    updateSession();
  }

  function moveKind(direction) {
    const subskills = filteredSubskills();
    if (!subskills.length) return;
    const anchor = dom.kindSelect.value === "all" ? currentQuestion?.kind : dom.kindSelect.value;
    const currentIndex = Math.max(0, subskills.findIndex(subskill => subskill.id === anchor));
    dom.kindSelect.value = subskills[(currentIndex + direction + subskills.length) % subskills.length].id;
    updateKindDetails();
    newQuestion();
  }

  function updateSession() {
    dom.catalogueTotal.textContent = Engine.SUBSKILLS.length;
    dom.generatedCount.textContent = generated;
    dom.answeredCount.textContent = answered;
    dom.correctCount.textContent = correct;
    dom.successRate.textContent = answered ? `${Math.round(correct / answered * 100)} %` : "—";
    dom.visitedCount.textContent = `${visitedKinds.size}/${Engine.SUBSKILLS.length}`;
    dom.visitedBar.style.width = `${visitedKinds.size / Engine.SUBSKILLS.length * 100}%`;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => dom.toast.classList.remove("show"), 2400);
  }

  async function copyDiagnostic() {
    const subskill = Engine.subskillForQuestion(currentQuestion);
    const diagnostic = [
      `[NEXUS ${questionReference(currentQuestion)}]`,
      `${Engine.SKILLS[currentQuestion.skill]} · ${subskill?.label || currentQuestion.kind} (${currentQuestion.kind})`,
      currentQuestion.prompt,
      `Choix : ${currentQuestion.choices.join(" | ")}`,
      `Réponse attendue : ${currentQuestion.choices[currentQuestion.answer]}`,
      `Correction : ${currentQuestion.explanation}`
    ].join("\n");
    try { await navigator.clipboard.writeText(diagnostic); showToast("Diagnostic copié dans le presse-papiers."); }
    catch { showToast("Copie impossible dans ce navigateur."); }
  }

  function selectProgramme(nextProgramme) {
    programme = nextProgramme;
    dom.programmeSwitch.querySelectorAll("[data-programme]").forEach(button => {
      const active = button.dataset.programme === programme;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    populateSkills();
    populateKinds({ preserve: false });
    newQuestion();
  }

  dom.programmeSwitch.addEventListener("click", event => {
    const button = event.target.closest("[data-programme]");
    if (button) selectProgramme(button.dataset.programme);
  });
  dom.skillSelect.addEventListener("change", () => { populateKinds({ preserve: false }); newQuestion(); });
  dom.kindSelect.addEventListener("change", () => { updateKindDetails(); newQuestion(); });
  dom.previousKind.addEventListener("click", () => moveKind(-1));
  dom.nextKind.addEventListener("click", () => moveKind(1));
  dom.newVariant.addEventListener("click", newQuestion);
  dom.revealAnswer.addEventListener("click", () => showCorrection());
  dom.copyDiagnostic.addEventListener("click", copyDiagnostic);
  dom.resetSession.addEventListener("click", () => {
    generated = 0; answered = 0; correct = 0; visitedKinds.clear(); recentKeys.length = 0;
    updateSession(); showToast("Compteurs remis à zéro.");
  });
  window.addEventListener("resize", () => currentQuestion?.visual && renderQuestionCanvases());
  document.addEventListener("keydown", event => {
    if (event.target instanceof HTMLSelectElement || event.metaKey || event.ctrlKey || event.altKey) return;
    if (["1", "2", "3", "4"].includes(event.key)) chooseAnswer(Number(event.key) - 1);
    if (event.key.toLowerCase() === "n") newQuestion();
    if (event.key === "ArrowRight") moveKind(1);
    if (event.key === "ArrowLeft") moveKind(-1);
  });

  populateSkills();
  populateKinds({ preserve: false });
  const requestedKind = new URL(window.location.href).searchParams.get("kind");
  const requested = Engine.SUBSKILLS.find(subskill => subskill.id === requestedKind);
  if (requested) {
    programme = requested.origin === SPECIALITY_ORIGIN ? "speciality" : "core";
    dom.programmeSwitch.querySelectorAll("[data-programme]").forEach(button => {
      const active = button.dataset.programme === programme;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    populateSkills();
    dom.skillSelect.value = requested.skill;
    populateKinds({ preserve: false });
    dom.kindSelect.value = requested.id;
    updateKindDetails();
  }
  updateSession();
  newQuestion();
})();
