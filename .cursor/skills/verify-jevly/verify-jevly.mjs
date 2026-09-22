#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const repoRoot = path.resolve(scriptDir, "../../..");
const runsRoot = "/tmp/jevly-verify-runs";
const evidenceRoot = "/tmp/jevly-verify-evidence";
const pwPrefix = "/tmp/jevly-verify-playwright";
const VERIFY_KEY = "verify-not-a-real-key";

const blockAnswer = {
  model: "jev-1.13.0",
  answers: {
    audience: {
      type: "choice",
      choice: "public",
      probabilities: { colleague: 0.1, customer: 0.16, public: 0.74 },
      confidence: 0.74,
    },
    directness: {
      type: "score",
      score: 2,
      confidence: 0.83,
      legend: { "0": "hedged", "1": "plain", "2": "blunt" },
      probabilities: { "0": 0, "1": 0.17, "2": 0.83 },
    },
    ready: { type: "noul", noul: 0.19 },
  },
};

const passAnswer = {
  model: "jev-1.13.0",
  answers: {
    audience: {
      type: "choice",
      choice: "colleague",
      probabilities: { colleague: 0.88, customer: 0.1, public: 0.02 },
      confidence: 0.88,
    },
    directness: {
      type: "score",
      score: 1,
      confidence: 0.77,
      legend: { "0": "hedged", "1": "plain", "2": "blunt" },
      probabilities: { "0": 0.1, "1": 0.77, "2": 0.13 },
    },
    ready: { type: "noul", noul: 0.91 },
  },
};

function usage() {
  console.log(`usage:
  node .cursor/skills/verify-jevly/verify-jevly.mjs launch
  node .cursor/skills/verify-jevly/verify-jevly.mjs doctor --run <id>
  node .cursor/skills/verify-jevly/verify-jevly.mjs drive <draft-mark|send-gate|save-api-key|password-field> --run <id>
  node .cursor/skills/verify-jevly/verify-jevly.mjs cleanup --run <id>`);
}

function flag(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? "" : args[index + 1] || "";
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOk(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitUntil(label, fn, ms = 20000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < ms) {
    last = await fn();
    if (last) return last;
    await sleep(150);
  }
  throw new Error(`${label} timed out: ${JSON.stringify(last)}`);
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runPaths(runId) {
  return {
    dir: path.join(runsRoot, runId),
    evidence: path.join(evidenceRoot, runId),
    file: path.join(runsRoot, runId, "run.json"),
  };
}

function readRun(runId) {
  const id = runId || (fs.existsSync(path.join(runsRoot, "latest"))
    ? fs.readFileSync(path.join(runsRoot, "latest"), "utf8").trim()
    : "");
  if (!id) throw new Error("no run id");
  const file = runPaths(id).file;
  if (!fs.existsSync(file)) throw new Error(`no run ${id}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensurePlaywright() {
  const pkg = path.join(pwPrefix, "node_modules", "playwright", "package.json");
  if (!fs.existsSync(pkg)) {
    fs.mkdirSync(pwPrefix, { recursive: true });
    const init = spawnSync("npm", ["init", "-y"], { cwd: pwPrefix, stdio: "inherit" });
    if (init.status !== 0) throw new Error("npm init for the verification Playwright failed");
    const install = spawnSync("npm", ["install", "playwright@1.55.0", "--no-fund", "--no-audit"], {
      cwd: pwPrefix,
      stdio: "inherit",
    });
    if (install.status !== 0) throw new Error("npm install playwright failed");
  }
  const bin = path.join(pwPrefix, "node_modules", ".bin", "playwright");
  const browsers = spawnSync(bin, ["install", "chromium"], { cwd: pwPrefix, stdio: "inherit" });
  if (browsers.status !== 0) throw new Error("playwright install chromium failed");
}

function playwright() {
  const pkg = path.join(pwPrefix, "node_modules", "playwright", "package.json");
  const require = createRequire(pkg);
  return require("playwright");
}

function buildExtension() {
  const built = spawnSync("npm", ["run", "build"], { cwd: repoRoot, stdio: "inherit" });
  if (built.status !== 0) throw new Error("npm run build failed");
  const manifestPath = path.join(repoRoot, ".output", "chrome-mv3", "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.name !== "Jevly") throw new Error(`built manifest name is ${manifest.name}`);
  return path.join(repoRoot, ".output", "chrome-mv3");
}

function fixtureHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Jevly verification compose</title>
<style>
  body { margin: 0; background: #e4ddd2; font: 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1c1915; }
  form { width: 640px; margin: 48px auto; background: #fbf9f5; border: 1px solid #e7dfd4; border-radius: 12px; padding: 8px 0 16px; box-shadow: 0 18px 50px rgba(48, 36, 22, 0.12); }
  label { display: grid; grid-template-columns: 72px 1fr; gap: 8px; align-items: center; padding: 8px 18px; border-top: 1px solid #e4dbd0; color: #746c63; }
  input, textarea { font: inherit; color: #1c1915; border: 0; background: transparent; width: 100%; }
  textarea { min-height: 140px; resize: none; padding-top: 8px; }
  #send { margin: 12px 18px 0 auto; display: block; border: 0; border-radius: 999px; background: #1c1915; color: #fbf9f5; font: inherit; font-weight: 650; padding: 8px 16px; }
</style>
</head>
<body>
  <form id="compose">
    <label>To <input id="to" type="text" value="Maya Chen"></label>
    <label>Secret <input id="secret" type="password" value="fixture-secret"></label>
    <label>Draft <textarea id="draft">Hello.</textarea></label>
    <button id="send" type="submit">Send</button>
  </form>
  <script>
    document.body.dataset.sent = "0";
    document.getElementById("compose").addEventListener("submit", (event) => {
      event.preventDefault();
      document.body.dataset.sent = "1";
    });
  </script>
</body>
</html>`;
}

function startFixture(port, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "index.html");
  fs.writeFileSync(file, fixtureHtml());
  return http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.readFileSync(file));
  }).listen(port, "127.0.0.1");
}

function startStub(port, runDir, evidenceDir) {
  fs.mkdirSync(evidenceDir, { recursive: true });
  const log = path.join(evidenceDir, "stub.jsonl");
  return http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const mode = fs.readFileSync(path.join(runDir, "mode"), "utf8").trim();
      fs.appendFileSync(log, JSON.stringify({ mode, body }) + "\n");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(mode === "pass" ? passAnswer : blockAnswer));
    });
  }).listen(port, "127.0.0.1");
}

function stubLog(run) {
  const file = path.join(run.evidence, "stub.jsonl");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function writeEvidence(run, feature, name, value) {
  const dir = path.join(run.evidence, feature);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), typeof value === "string" ? value : JSON.stringify(value, null, 2));
}

async function pointStub(worker, run) {
  await worker.evaluate(async (url) => {
    const api = globalThis.browser ?? globalThis.chrome;
    await api.storage.local.set({ jevEndpoint: url });
  }, run.stubUrl);
}

async function saveKeyThroughPopup(context, worker) {
  const id = worker.url().split("/")[2];
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.getByLabel("API key").fill(VERIFY_KEY);
  await page.getByRole("button", { name: "Save" }).click();
  await page.locator(".status").filter({ hasText: "Saved." }).waitFor({ timeout: 5000 });
  const status = (await page.locator(".status").textContent())?.trim();
  await page.close();
  return status;
}

function texts(page) {
  return page.evaluate(() => {
    const host = document.querySelector("jevly-overlay");
    const root = host?.shadowRoot;
    const read = (selector) => (root?.querySelector(selector)?.textContent || "").replace(/\s+/g, " ").trim();
    const on = (selector) => root?.querySelector(selector)?.classList.contains("on") === true;
    return {
      found: Boolean(root),
      badgeOn: on(".badge"),
      badge: read(".badge"),
      cardOn: on(".card"),
      card: read(".card"),
      sheetOn: on(".sheet"),
      sheet: read(".sheet"),
      sent: document.body.dataset.sent || "",
    };
  });
}

async function openCompose(context, run, value) {
  const page = await context.newPage();
  await page.goto(run.fixtureUrl);
  await page.locator("#draft").fill(value);
  return page;
}

async function waitBadge(page, pattern) {
  return waitUntil(`badge ${pattern}`, async () => {
    const state = await texts(page);
    return pattern.test(state.badge) ? state : false;
  });
}

async function workerOf(context) {
  let worker = context.serviceWorkers().find((item) => item.url().includes("/background.js"));
  if (!worker) worker = await context.waitForEvent("serviceworker", { timeout: 15000 });
  return worker;
}

async function driveFeature(context, run, feature) {
  const worker = await workerOf(context);
  await pointStub(worker, run);
  if (feature === "save-api-key") {
    const status = await saveKeyThroughPopup(context, worker);
    const again = await context.newPage();
    const id = worker.url().split("/")[2];
    await again.goto(`chrome-extension://${id}/popup.html`);
    await again.locator(".status").filter({ hasText: "Saved." }).waitFor({ timeout: 5000 });
    const second = (await again.locator(".status").textContent())?.trim();
    fs.mkdirSync(path.join(run.evidence, "save-api-key"), { recursive: true });
    await again.screenshot({ path: path.join(run.evidence, "save-api-key", "popup.png") });
    writeEvidence(run, "save-api-key", "status.json", { first: status, second });
    if (status !== "Saved." || second !== "Saved.") throw new Error(`popup status ${status} then ${second}`);
    return "PASS save-api-key";
  }
  await saveKeyThroughPopup(context, worker);
  if (feature === "draft-mark") {
    fs.writeFileSync(path.join(runPaths(run.runId).dir, "mode"), "block\n");
    const page = await openCompose(context, run, "Your pricing is way off, and we should talk before this gets embarrassing in front of the whole team.");
    const state = await waitBadge(page, /blunt/);
    await page.locator("jevly-overlay").locator(".badge").click();
    const open = await waitUntil("card", async () => {
      const next = await texts(page);
      return next.cardOn && next.card.includes("public") ? next : false;
    });
    fs.mkdirSync(path.join(run.evidence, "draft-mark"), { recursive: true });
    await page.screenshot({ path: path.join(run.evidence, "draft-mark", "card.png") });
    writeEvidence(run, "draft-mark", "state.json", { before: state, card: open });
    return "PASS draft-mark";
  }
  if (feature === "password-field") {
    fs.writeFileSync(path.join(runPaths(run.runId).dir, "mode"), "block\n");
    const page = await openCompose(context, run, "Hi Maya. Can we talk Thursday?");
    await waitBadge(page, /blunt/);
    const before = stubLog(run).length;
    await page.locator("#secret").click();
    await sleep(700);
    const state = await texts(page);
    const after = stubLog(run).slice(before);
    fs.mkdirSync(path.join(run.evidence, "password-field"), { recursive: true });
    await page.screenshot({ path: path.join(run.evidence, "password-field", "hidden.png") });
    const leaked = after.some((row) => String(row.body).includes("fixture-secret"));
    writeEvidence(run, "password-field", "state.json", { badgeOn: state.badgeOn, leaked });
    if (state.badgeOn) throw new Error("badge stayed visible on the password field");
    if (leaked) throw new Error("stub saw the password");
    return "PASS password-field";
  }
  if (feature !== "send-gate") throw new Error(`unknown feature ${feature}`);
  fs.writeFileSync(path.join(runPaths(run.runId).dir, "mode"), "block\n");
  const page = await openCompose(context, run, "Your pricing is way off, and we should talk before this gets embarrassing in front of the whole team.");
  await waitBadge(page, /blunt/);
  fs.mkdirSync(path.join(run.evidence, "send-gate"), { recursive: true });
  await page.screenshot({ path: path.join(run.evidence, "send-gate", "mark.png") });
  await page.evaluate(() => { document.body.dataset.sent = "0"; });
  await page.locator("#send").click();
  const held = await waitUntil("sheet", async () => {
    const state = await texts(page);
    return state.sheetOn && state.sheet.includes("block this send") ? state : false;
  });
  await page.screenshot({ path: path.join(run.evidence, "send-gate", "sheet.png") });
  if (held.sent !== "0") throw new Error(`send was not held, sent=${held.sent}`);
  await page.locator("jevly-overlay").locator(".anyway").click();
  const sent = await waitUntil("sent", async () => {
    const state = await texts(page);
    return state.sent === "1" ? state : false;
  });
  fs.writeFileSync(path.join(runPaths(run.runId).dir, "mode"), "pass\n");
  await page.locator("#draft").fill("Hi Maya. Can we talk Thursday?");
  await waitBadge(page, /plain/);
  await page.evaluate(() => { document.body.dataset.sent = "0"; });
  await page.locator("#send").click();
  const clear = await waitUntil("clear send", async () => {
    const state = await texts(page);
    return state.sent === "1" && state.sheetOn === false ? state : false;
  });
  await page.screenshot({ path: path.join(run.evidence, "send-gate", "clear.png") });
  const bodies = stubLog(run).map((row) => String(row.body));
  writeEvidence(run, "send-gate", "result.json", {
    held: held.sent,
    anyway: sent.sent,
    clear: clear.sent,
    sheet: held.sheet,
    sawDraft: bodies.some((body) => body.includes("embarrassing")),
    sawPassword: bodies.some((body) => body.includes("fixture-secret")),
  });
  if (!bodies.some((body) => body.includes("embarrassing"))) throw new Error("stub did not see the draft");
  if (bodies.some((body) => body.includes("fixture-secret"))) throw new Error("stub saw the password");
  return "PASS send-gate";
}

async function launch() {
  ensurePlaywright();
  const ext = buildExtension();
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const paths = runPaths(runId);
  fs.mkdirSync(paths.dir, { recursive: true });
  fs.mkdirSync(paths.evidence, { recursive: true });
  const spec = {
    runId,
    ext,
    dir: paths.dir,
    evidence: paths.evidence,
    file: paths.file,
    profile: path.join(paths.dir, "profile"),
    fixturePort: await freePort(),
    stubPort: await freePort(),
    controlPort: await freePort(),
  };
  fs.writeFileSync(path.join(paths.dir, "spec.json"), JSON.stringify(spec));
  fs.writeFileSync(path.join(paths.dir, "mode"), "block\n");
  const log = fs.openSync(path.join(paths.dir, "session.log"), "a");
  const child = spawn(process.execPath, [scriptPath, "_session", path.join(paths.dir, "spec.json")], {
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();
  const healthUrl = `http://127.0.0.1:${spec.controlPort}/health`;
  await waitUntil("verification session", () => fetchOk(healthUrl));
  const run = readRun(runId);
  console.log(`READY run=${run.runId} fixture=${run.fixtureUrl} evidence=${run.evidence}`);
}

async function session(specPath) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  startFixture(spec.fixturePort, spec.dir);
  startStub(spec.stubPort, spec.dir, spec.evidence);
  const { chromium } = playwright();
  const context = await chromium.launchPersistentContext(spec.profile, {
    headless: true,
    channel: "chromium",
    viewport: { width: 1100, height: 820 },
    args: [
      `--disable-extensions-except=${spec.ext}`,
      `--load-extension=${spec.ext}`,
    ],
  });
  const worker = await workerOf(context);
  const run = {
    runId: spec.runId,
    ext: spec.ext,
    profile: spec.profile,
    fixturePort: spec.fixturePort,
    stubPort: spec.stubPort,
    controlPort: spec.controlPort,
    fixtureUrl: `http://127.0.0.1:${spec.fixturePort}/`,
    stubUrl: `http://127.0.0.1:${spec.stubPort}/v1/systemone`,
    evidence: spec.evidence,
    sessionPid: process.pid,
    extensionId: worker.url().split("/")[2],
  };
  fs.writeFileSync(spec.file, JSON.stringify(run, null, 2));
  fs.mkdirSync(runsRoot, { recursive: true });
  fs.writeFileSync(path.join(runsRoot, "latest"), spec.runId);
  const control = http.createServer(async (req, res) => {
    try {
      if (req.url === "/health") {
        const manifest = JSON.parse(fs.readFileSync(path.join(spec.ext, "manifest.json"), "utf8"));
        const workers = context.serviceWorkers().map((item) => item.url());
        const body = {
          runId: spec.runId,
          ok: manifest.name === "Jevly" && workers.some((url) => url.includes("/background.js")),
          checks: {
            session: true,
            manifestName: manifest.name === "Jevly",
            serviceWorker: workers.some((url) => url.includes("/background.js")),
            extensionId: run.extensionId,
          },
          evidence: spec.evidence,
        };
        res.writeHead(body.ok ? 200 : 500, { "Content-Type": "application/json" });
        res.end(JSON.stringify(body));
        return;
      }
      if (req.url === "/shutdown") {
        res.end("bye");
        setTimeout(() => {
          context.close().finally(() => process.exit(0));
        }, 30);
        return;
      }
      if (req.url?.startsWith("/drive/")) {
        const feature = req.url.slice("/drive/".length);
        const message = await driveFeature(context, run, feature);
        res.end(message + "\n");
        return;
      }
      res.writeHead(404);
      res.end("not found");
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end(error instanceof Error ? error.stack || error.message : String(error));
    }
  });
  control.listen(spec.controlPort, "127.0.0.1");
}

async function doctor(runId) {
  const run = readRun(runId);
  const sessionUp = alive(run.sessionPid);
  let health = null;
  try {
    const response = await fetch(`http://127.0.0.1:${run.controlPort}/health`);
    health = await response.json();
  } catch {
    health = null;
  }
  const ok = sessionUp && health?.ok === true;
  console.log(JSON.stringify({ runId: run.runId, ok, sessionUp, health, evidence: run.evidence }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function drive(feature, runId) {
  const known = ["draft-mark", "send-gate", "save-api-key", "password-field"];
  if (!known.includes(feature)) throw new Error(`unknown feature ${feature}`);
  const run = readRun(runId);
  const response = await fetch(`http://127.0.0.1:${run.controlPort}/drive/${feature}`);
  const text = await response.text();
  if (!response.ok) throw new Error(text);
  process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
}

async function cleanup(runId) {
  const run = readRun(runId);
  await fetch(`http://127.0.0.1:${run.controlPort}/shutdown`).catch(() => {});
  await sleep(400);
  if (alive(run.sessionPid)) {
    try { process.kill(run.sessionPid, "SIGKILL"); } catch { /* already gone */ }
  }
  const evidence = run.evidence;
  fs.rmSync(runPaths(run.runId).dir, { recursive: true, force: true });
  const latest = path.join(runsRoot, "latest");
  if (fs.existsSync(latest) && fs.readFileSync(latest, "utf8").trim() === run.runId) fs.rmSync(latest);
  console.log(`CLEANED run=${run.runId} evidence=${evidence}`);
}

const [cmd, ...rest] = process.argv.slice(2);
try {
  if (cmd === "launch") await launch();
  else if (cmd === "doctor") await doctor(flag(rest, "--run"));
  else if (cmd === "drive") await drive(rest[0], flag(rest, "--run"));
  else if (cmd === "cleanup") await cleanup(flag(rest, "--run"));
  else if (cmd === "_session") await session(rest[0]);
  else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
}
