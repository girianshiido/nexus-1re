import assert from "node:assert/strict";
import { createRequire } from "node:module";

if (!process.env.NEXUS_GAME_AUDIT_URL) {
  console.log("Audit de la fenêtre du jeu ignoré (définir NEXUS_GAME_AUDIT_URL pour l'exécuter).");
  process.exit(0);
}

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NEXUS_PLAYWRIGHT_PATH || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXUS_CHROME_PATH || undefined });
const failures = [];
let inspected = 0;

try {
  for (const viewport of [
    { name: "projecteur 16:9", width: 1366, height: 768 },
    { name: "ordinateur Full HD", width: 1920, height: 1080 }
  ]) {
    const context = await browser.newContext({ viewport, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.goto(process.env.NEXUS_GAME_AUDIT_URL, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.NexusGameDebug);
    const seededState = await page.evaluate(() => window.NexusGameDebug.getState());
    Object.keys(seededState.workshops).forEach(skill => { seededState.workshops[skill] = Math.max(1, seededState.workshops[skill] || 0); });
    seededState.workshopReveal = 11;
    seededState.activeTab = "network";
    await page.addInitScript(state => {
      localStorage.setItem("nexus-sti2d-laboratoire-v2", JSON.stringify(state));
    }, seededState);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.NexusGameDebug && document.querySelector("#learning-workshops"));
    await page.locator("#tab-network").click();
    const functionPractice = page.locator('[data-practice-skill="functions"]');
    if (await functionPractice.count() !== 1) {
      const setup = await page.evaluate(() => ({
        reveal: window.NexusGameDebug.getState().workshopReveal,
        available: [...document.querySelectorAll("[data-practice-skill]")].map(button => button.dataset.practiceSkill)
      }));
      throw new Error(`Atelier fonctions absent du test : ${JSON.stringify(setup)}`);
    }
    await functionPractice.click();

    let graphSeen = false;
    for (let question = 0; question < 16; question += 1) {
      await page.locator("#event-dialog[open]").waitFor();
      const result = await page.evaluate(() => {
        const tolerance = 2;
        const dialog = document.querySelector("#event-dialog");
        const answers = document.querySelector("#answers");
        const dialogRect = dialog.getBoundingClientRect();
        const answersRect = answers.getBoundingClientRect();
        const visible = [...dialog.querySelectorAll(".event-dialog-head, .question-meta:not([hidden]), .question-visual:not([hidden]), .question-text:not([hidden]), .answers:not([hidden])")];
        const contentBottom = Math.max(...visible.map(element => element.getBoundingClientRect().bottom));
        return {
          kindHasGraph: Boolean(dialog.querySelector("canvas[data-plot='line']")),
          overflow: dialog.scrollHeight > dialog.clientHeight + tolerance,
          answersOutside: answersRect.bottom > dialogRect.bottom + tolerance,
          contentOutside: contentBottom > dialogRect.bottom + tolerance
        };
      });
      inspected += 1;
      graphSeen ||= result.kindHasGraph;
      if (result.kindHasGraph && process.env.NEXUS_GAME_CAPTURE_DIR) {
        const filename = viewport.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        await page.screenshot({ path: `${process.env.NEXUS_GAME_CAPTURE_DIR}/nexus-dialog-${filename}.png` });
      }
      if (result.overflow || result.answersOutside || result.contentOutside) {
        failures.push(`${viewport.name} · question ${question + 1} : contenu plus haut que la fenêtre`);
      }
      if (graphSeen) break;
      await page.locator(".answer-button").first().click();
      await page.locator("#event-next").click();
    }
    if (!graphSeen) failures.push(`${viewport.name} : aucun graphique obtenu pendant le parcours ciblé`);
    await context.close();
  }
} finally {
  await browser.close();
}

assert.deepEqual(failures, [], failures.join("\n"));
console.log(`${inspected} questions du jeu contrôlées : graphiques, énoncés et réponses tiennent dans deux écrans projetés.`);
