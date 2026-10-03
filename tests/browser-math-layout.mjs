import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NEXUS_PLAYWRIGHT_PATH || "playwright");
const url = process.env.NEXUS_GAME_AUDIT_URL;
assert.ok(url, "Définir NEXUS_GAME_AUDIT_URL avec le serveur local.");
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXUS_CHROME_PATH || undefined });
const fixture = {
  kind: "quadratic-vertex", skill: "functions",
  prompt: "Quel est le sommet de la parabole représentant f(x) = 2(x − 3)² − 2 ?",
  choices: ["S(3 ; −2)", "S(−3 ; −2)", "S(3 ; 2)", "S(−2 ; 3)"], answer: 0,
  explanation: "La forme canonique 2(x − 3)² − 2 donne directement le sommet S(3 ; −2)."
};
const errors = [];
let checks = 0;

async function settled(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
}

async function check(page, explanationSelector) {
  await settled(page);
  const issues = await page.evaluate(({ explanationSelector }) => {
    const problems = [];
    const prompt = document.querySelector("#question-text");
    const expected = prompt.textContent.slice(prompt.textContent.indexOf("f(x)"), prompt.textContent.lastIndexOf(" ?"));
    const block = [...prompt.querySelectorAll(".math-inline")].find(span => span.textContent === expected);
    if (!block) problems.push(`Formule incomplète : ${prompt.innerHTML}`);
    for (const element of document.querySelectorAll(`#question-text, .answer-button, ${explanationSelector}`)) {
      if (!element.getBoundingClientRect().width) continue;
      if (element.scrollWidth > element.clientWidth + 1.5) problems.push(`${element.id || element.className}: débordement`);
      for (const formula of element.querySelectorAll(".math-inline")) {
        if (getComputedStyle(formula).whiteSpace !== "nowrap") problems.push("Formule sécable");
        if (formula.getClientRects().length !== 1) problems.push("Formule répartie sur plusieurs lignes");
        const rect = formula.getBoundingClientRect();
        const outer = element.getBoundingClientRect();
        if (rect.left < outer.left - 1.5 || rect.right > outer.right + 1.5) problems.push("Formule hors de son conteneur");
      }
    }
    for (const button of document.querySelectorAll(".answer-button")) {
      if (![...button.querySelectorAll(".math-inline")].some(span => span.textContent === button.textContent)) {
        problems.push("Coordonnées du sommet protégées seulement en partie");
      }
    }
    return problems;
  }, { explanationSelector });
  assert.deepEqual(issues, []);
  checks++;
}

try {
  for (const width of [1366, 768, 390, 320]) {
    for (const mode of ["game", "lab"]) {
      const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 768 : 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://gettimeapi.dev/**", route => route.abort());
      if (mode === "game") await page.addInitScript(() => localStorage.setItem("nexus-sti2d-laboratoire-v2", JSON.stringify({
        version: 2, workshops: { functions: 1 }, workshopReveal: 6, activeTab: "network", soundEnabled: false, lastSeen: Date.now()
      })));
      await page.goto(`${url}${mode === "lab" ? "exerciseurs/" : ""}`);
      await page.evaluate(fixture => { window.QuestionEngine.generateForKinds = () => structuredClone(fixture); }, fixture);
      if (mode === "game") await page.locator('[data-practice-skill="functions"]').click();
      else await page.selectOption("#kind-select", "quadratic-vertex");
      await check(page, mode === "game" ? "#feedback p" : "#explanation");
      if (mode === "game") await page.locator(".answer-button").first().click();
      else await page.locator("#reveal-answer").click();
      await check(page, mode === "game" ? "#feedback p" : "#explanation");
      if (width === 1366 && mode === "game") {
        await page.locator("#event-dialog").screenshot({ path: "/tmp/nexus-math-fixed-desktop.png" });
        await page.setViewportSize({ width: 320, height: 900 });
        await check(page, "#feedback p");
        await page.setViewportSize({ width: 1366, height: 768 });
        await check(page, "#feedback p");
      }
      if (width === 390 && mode === "game") await page.locator("#event-dialog").screenshot({ path: "/tmp/nexus-math-fixed-mobile.png" });
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  console.log(`${checks} contrôles : formule exacte, coordonnées, correction et redimensionnement, de 320 à 1366 px.`);
} finally {
  await browser.close();
}
