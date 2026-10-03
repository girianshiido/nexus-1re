import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.NEXUS_PLAYWRIGHT_PATH || "playwright");
const url = process.env.NEXUS_GAME_AUDIT_URL;
assert.ok(url, "Définir NEXUS_GAME_AUDIT_URL avec le serveur local.");
const browser = await chromium.launch({ headless: true, executablePath: process.env.NEXUS_CHROME_PATH || undefined });
const errors = [];
const saveKey = "nexus-sti2d-laboratoire-v2";

async function load(page) {
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://gettimeapi.dev/**", route => route.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.NexusGameDebug);
}

function mutations(value, path = []) {
  if (value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length) {
    return Object.entries(value).flatMap(([key, child]) => mutations(child, [...path, key]));
  }
  return [{ path, value: typeof value === "number" ? value + Math.max(1, Math.abs(value) * 0.1) : typeof value === "boolean" ? !value
    : typeof value === "string" ? `${value}edited` : Array.isArray(value) ? [...value, "edited"] : { edited: true } }];
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block", acceptDownloads: true });
  const page = await desktop.newPage();
  await load(page);
  const seed = await page.evaluate(() => window.NexusGameDebug.getState());
  seed.soundEnabled = false;
  seed.flux = 1e18;
  seed.cycleFlux = 1e18;
  seed.lifetimeFlux = 1e18;
  seed.workshopReveal = 11;
  seed.nextEventAt = Date.now() + 60 * 60 * 1000;
  for (const id of Object.keys(seed.workshops).slice(0, 12)) seed.workshops[id] = 5;
  seed.learning = { fractions: { attempts: 7, correct: 5, streak: 2, lastSeen: Date.now(), dueAt: Date.now() + 60000 } };
  await page.addInitScript(({ seed, saveKey }) => localStorage.setItem(saveKey, JSON.stringify(seed)), { seed, saveKey });
  await page.reload();
  const downloadReady = page.waitForEvent("download");
  await page.locator("#export-save-button").click();
  const download = await downloadReady;
  const exported = JSON.parse(await readFile(await download.path(), "utf8"));
  assert.equal(exported.exportVersion, 2);
  assert.match(exported.checksum, /^[a-f0-9]{64}$/);

  async function importFile(payload) {
    await page.evaluate(() => { document.querySelector("#toast").textContent = ""; });
    await page.locator("#import-save-file").setInputFiles({ name: "partie.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(payload, null, 2)) });
    await page.waitForFunction(() => document.querySelector("#confirm-dialog").open || /Import refusé|Ancien export/.test(document.querySelector("#toast").textContent));
  }

  // Verify on a second browser context, including whitespace/key reordering.
  const receiverContext = await browser.newContext({ serviceWorkers: "block" });
  const receiver = await receiverContext.newPage();
  await load(receiver);
  const reordered = Object.fromEntries(Object.entries(exported).reverse());
  reordered.state = Object.fromEntries(Object.entries(exported.state).reverse());
  await receiver.locator("#import-save-file").setInputFiles({ name: "partie.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(reordered, null, 2)) });
  await receiver.locator("#confirm-dialog[open]").waitFor();
  await receiver.locator("#confirm-action").click();
  assert.equal(await receiver.evaluate(() => window.NexusGameDebug.getState().workshops.proportions), 5);

  const changedFields = mutations(exported).filter(item => item.path[0] !== "checksum");
  for (const change of changedFields) {
    const altered = structuredClone(exported);
    let parent = altered;
    for (const key of change.path.slice(0, -1)) parent = parent[key];
    parent[change.path.at(-1)] = change.value;
    await importFile(altered);
    assert.equal(await page.locator("#confirm-dialog").evaluate(dialog => dialog.open), false, change.path.join("."));
    assert.match(await page.locator("#toast").textContent(), /Import refusé|Ancien export/);
  }
  const missingSignature = structuredClone(exported);
  delete missingSignature.checksum;
  await importFile(missingSignature);
  assert.equal(await page.locator("#confirm-dialog").evaluate(dialog => dialog.open), false);
  await importFile({ ...exported, checksum: "0".repeat(64) });
  assert.equal(await page.locator("#confirm-dialog").evaluate(dialog => dialog.open), false);
  await importFile({ ...missingSignature, exportVersion: 1 });
  assert.match(await page.locator("#toast").textContent(), /Ancien export/);
  assert.equal(await page.evaluate(() => window.NexusGameDebug.getState().workshops.proportions), 5);
  console.log(`Sauvegarde transférée entre navigateurs ; ${changedFields.length} champs modifiés et exports non signés refusés.`);

  for (const deviceName of ["Pixel 7", "iPhone 13"]) {
    const context = await browser.newContext({ ...devices[deviceName], serviceWorkers: "block" });
    const mobile = await context.newPage();
    await mobile.addInitScript(({ seed, saveKey }) => localStorage.setItem(saveKey, JSON.stringify(seed)), { seed, saveKey });
    await load(mobile);
    await mobile.locator("#core-button").tap();
    const tapStyle = await mobile.locator("#core-button").evaluate(button => ({
      highlight: getComputedStyle(button).webkitTapHighlightColor,
      outline: getComputedStyle(button).outlineStyle,
      count: window.NexusGameDebug.getState().totalClicks
    }));
    assert.equal(tapStyle.highlight, "rgba(0, 0, 0, 0)");
    assert.equal(tapStyle.outline, "none");
    assert.ok(tapStyle.count > 0);
    await mobile.locator("#tab-workshops").tap();
    await mobile.locator('[data-buy="proportions"]').tap();
    await mobile.clock.install();
    await mobile.clock.pauseAt(new Date(Date.now() + 1000));
    const minutes = deviceName === "Pixel 7" ? Number(process.env.NEXUS_ANDROID_MINUTES || 35) : 2;
    for (let minute = 0; minute < minutes; minute++) {
      await mobile.clock.runFor(60000);
      await mobile.evaluate(() => {
        window.NexusGameDebug.addFlux(1e18);
        for (const button of document.querySelectorAll(".workshop-card:not([hidden]) .workshop-buy")) button.click();
      });
      const buttons = await mobile.locator(".workshop-card:not([hidden]) .workshop-buy").evaluateAll(buttons => buttons.map(button => {
        const style = getComputedStyle(button);
        const rect = button.getBoundingClientRect();
        return { text: button.textContent, width: rect.width, height: rect.height, visibility: style.visibility, opacity: style.opacity, filter: style.filter, cardOpacity: getComputedStyle(button.closest(".workshop-card")).opacity };
      }));
      assert.equal(buttons.length, 12);
      for (const button of buttons) {
        assert.ok(button.width > 0 && button.height > 0 && button.text.includes("Acheter"));
        assert.equal(button.visibility, "visible");
        assert.equal(button.opacity, "1");
        assert.equal(button.cardOpacity, "1");
        assert.equal(button.filter, "none");
      }
      if ((minute + 1) % 5 === 0) console.log(`${deviceName} : ${minute + 1} minutes simulées, 12 boutons visibles.`);
    }
    const finalCount = await mobile.evaluate(() => window.NexusGameDebug.getState().workshops.proportions);
    assert.ok(finalCount >= 6 + minutes);
    // Exhaust the budget through MAX: disabled buttons must remain painted.
    await mobile.evaluate(() => {
      document.querySelector('[data-bulk="max"]').click();
      document.querySelector('[data-buy="proportions"]').click();
    });
    const disabledStyle = await mobile.locator('[data-buy="proportions"]').evaluate(button => ({
      disabled: button.disabled, background: getComputedStyle(button).backgroundColor,
      opacity: getComputedStyle(button.closest(".workshop-card")).opacity,
      width: button.getBoundingClientRect().width
    }));
    assert.equal(disabledStyle.disabled, true);
    assert.equal(disabledStyle.background, "rgb(16, 41, 54)");
    assert.equal(disabledStyle.opacity, "1");
    assert.ok(disabledStyle.width > 0);
    await mobile.screenshot({ path: `/tmp/nexus-${deviceName.replaceAll(" ", "-")}-workshops.png`, fullPage: true });
    console.log(`${deviceName} : achats et affichage validés après ${minutes} minutes simulées.`);
    await context.close();
  }

  // The public origin must not expose the local debugging shortcuts.
  const publicContext = await browser.newContext({ serviceWorkers: "block" });
  const publicPage = await publicContext.newPage();
  await publicPage.route("https://nexus.example/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const response = await publicContext.request.get(`${url}${path.replace(/^\//, "")}${new URL(route.request().url()).search}`);
    await route.fulfill({ response });
  });
  await publicPage.route("https://gettimeapi.dev/**", route => route.abort());
  await publicPage.goto("https://nexus.example/");
  assert.equal(await publicPage.evaluate(() => typeof window.NexusGameDebug), "undefined");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
