import assert from "node:assert/strict";
import { createRequire } from "node:module";

if (!process.env.NEXUS_AUDIT_URL) {
  console.log("Audit navigateur ignoré (définir NEXUS_AUDIT_URL pour l'exécuter).");
  process.exit(0);
}

const require = createRequire(import.meta.url);
const playwrightPath = process.env.NEXUS_PLAYWRIGHT_PATH || "playwright";
const { chromium } = require(playwrightPath);

const baseUrl = process.env.NEXUS_AUDIT_URL;
const executablePath = process.env.NEXUS_CHROME_PATH || undefined;
const variantsPerFormat = Number(process.env.NEXUS_AUDIT_VARIANTS || 20);
const viewports = [
  { name: "ordinateur", width: 1440, height: 1000 },
  { name: "projecteur", width: 1366, height: 768 },
  { name: "tablette", width: 768, height: 900 },
  { name: "telephone", width: 390, height: 844 },
  { name: "largeur-minimale", width: 320, height: 720 }
];

const browser = await chromium.launch({ headless: true, executablePath });
const failures = [];
let renderedQuestions = 0;

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", error => failures.push(`${viewport.name}: erreur JavaScript : ${error.message}`));
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    const kinds = await page.evaluate(() => window.QuestionEngine.SUBSKILLS.map(subskill => subskill.id));

    for (const kind of kinds) {
      await page.selectOption("#kind-select", kind);
      for (let variant = 0; variant < variantsPerFormat; variant += 1) {
        await page.evaluate(generateNewVariant => {
          if (generateNewVariant) document.querySelector("#new-variant").click();
          document.querySelector("#reveal-answer").click();
        }, variant > 0);
        renderedQuestions += 1;

        const problems = await page.evaluate(() => {
          const tolerance = 1.5;
          const issues = [];
          const rect = element => element.getBoundingClientRect();
          const contains = (outer, inner) => inner.left >= outer.left - tolerance
            && inner.right <= outer.right + tolerance
            && inner.top >= outer.top - tolerance
            && inner.bottom <= outer.bottom + tolerance;

          if (document.documentElement.scrollWidth > window.innerWidth + tolerance) {
            issues.push(`débordement horizontal de ${Math.round(document.documentElement.scrollWidth - window.innerWidth)} px`);
          }

          const card = document.querySelector(".question-card");
          const cardRect = rect(card);
          document.querySelectorAll(".question-text, .answer-button, #correct-answer, #explanation").forEach(element => {
            if (element.scrollWidth > element.clientWidth + tolerance) {
              issues.push(`${element.id || element.className}: contenu rogné horizontalement`);
            }
            element.querySelectorAll(".math-inline, .math-fraction, .math-radical, .math-vector, .math-norm").forEach(math => {
              const mathRect = rect(math);
              if (!mathRect.width || !mathRect.height) issues.push(`${math.className}: dimensions nulles`);
              if (!contains(cardRect, mathRect)) issues.push(`${math.className}: formule hors de la carte`);
            });
          });

          document.querySelectorAll(".math-fraction").forEach(fraction => {
            const [numerator, denominator] = fraction.children;
            if (!numerator || !denominator) {
              issues.push("fraction incomplète");
              return;
            }
            const top = rect(numerator);
            const bottom = rect(denominator);
            if (top.bottom > bottom.top + 2) issues.push("numérateur et dénominateur se chevauchent");
            if (Math.abs((top.left + top.right) / 2 - (bottom.left + bottom.right) / 2) > 1.5) {
              issues.push("fraction non centrée horizontalement");
            }
          });

          document.querySelectorAll(".math-radical").forEach(radical => {
            const sign = radical.querySelector(".math-radical-sign");
            const radicand = radical.querySelector(".math-radicand");
            if (!sign || !radicand) {
              issues.push("racine incomplète");
              return;
            }
            const signRect = rect(sign);
            const radicandRect = rect(radicand);
            if (signRect.width < 5 || signRect.height < 5) issues.push("signe radical invisible");
            if (radicandRect.width < 5) issues.push("radicande trop étroit");
            if (Math.abs(signRect.top - radicandRect.top) > 8) issues.push("racine désalignée verticalement");
            const signShape = getComputedStyle(sign, "::before");
            if (signShape.content === "none" || signShape.clipPath === "none") issues.push("tracé CSS du radical absent");
          });

          const visibleText = ["#question-text", ".answer-button", "#correct-answer", "#explanation"]
            .flatMap(selector => [...document.querySelectorAll(selector)].map(element => element.textContent))
            .join(" ");
          if (/\b(?:vec|norm)\(/.test(visibleText)) issues.push("notation technique vec()/norm() encore visible");
          const renderedZone = document.querySelector(".question-card");
          const renderedText = renderedZone.textContent;
          const radicalSigns = (renderedText.match(/√/g) || []).length;
          if (radicalSigns !== renderedZone.querySelectorAll(".math-radical-sign").length) {
            issues.push("racine carrée restée en texte brut");
          }
          const currentKind = document.querySelector("#kind-select").value;
          if (currentKind === "operation-priority") {
            const mentalText = document.querySelector("#question-text").textContent;
            if (!mentalText.includes("\u2060") || !mentalText.includes("\u00a0")) {
              issues.push("calcul mental encore sécable");
            }
          }
          if (!["spreadsheet-formula", "raw-data-cross-table"].includes(currentKind) && renderedText.includes("/")) {
            issues.push("fraction restée en écriture oblique");
          }
          if (currentKind !== "python-bernoulli" && /\d+\.\d+/.test(renderedText)) {
            issues.push("point décimal affiché à la place d'une virgule");
          }
          const nonCodeText = [...renderedZone.querySelectorAll("#question-text, .question-visual :not(.code-panel), .answer-button, #correct-answer, #explanation")]
            .filter(element => !element.closest(".code-panel"))
            .map(element => element.textContent)
            .join(" ");
          if (/(^|[\s=(;,])-\d/.test(nonCodeText)) issues.push("trait d'union utilisé à la place du signe moins");

          const plot = document.querySelector("canvas[data-level]");
          if (plot && Math.abs(Number(plot.dataset.level)) > 5) {
            issues.push(`niveau horizontal hors cadre : ${plot.dataset.level}`);
          }

          const question = rect(document.querySelector("#question-text"));
          const answers = rect(document.querySelector("#answers"));
          if (question.bottom > answers.top + tolerance) issues.push("l'énoncé chevauche les réponses");
          return issues;
        });

        if (problems.length) {
          failures.push(`${viewport.name} · ${kind} · variante ${variant + 1} : ${[...new Set(problems)].join(" ; ")}`);
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

assert.deepEqual(failures, [], failures.slice(0, 30).join("\n"));
console.log(`${renderedQuestions} rendus contrôlés dans ${viewports.length} largeurs (${variantsPerFormat} variantes par format).`);
