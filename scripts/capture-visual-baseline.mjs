import { spawn } from "node:child_process";
import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { format } from "prettier";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = resolve(rootDir, "artifacts/visual-baseline");
const baseUrl = process.env.VISUAL_BASE_URL ?? "http://127.0.0.1:4178";
const baseOrigin = new URL(baseUrl).origin;
const fixedBrowserTime = "2026-01-15T12:00:00-03:00";
const checkOnly = process.argv.includes("--check");
const captures = [
  ["01-login-desktop.png", "Público", "Login", "1440x900", "light"],
  ["02-login-mobile.png", "Público", "Login", "390x844", "light"],
  ["03-student-home-desktop.png", "Estudiante", "Inicio", "1440x900", "light"],
  ["04-student-practicas-desktop.png", "Estudiante", "Prácticas", "1440x900", "light"],
  ["05-student-solicitudes-desktop.png", "Estudiante", "Solicitudes", "1440x900", "light"],
  ["06-student-home-dark-desktop.png", "Estudiante", "Inicio", "1440x900", "dark"],
  ["07-student-home-tablet.png", "Estudiante", "Inicio", "1024x768", "light"],
  ["08-student-home-mobile.png", "Estudiante", "Inicio", "390x844", "light"],
  ["09-admin-lanzador-overview.png", "Admin", "Lanzador vacío", "1440x900", "light"],
  ["10-admin-lanzador-seleccion.png", "Admin", "Lanzador selección", "1440x900", "light"],
  ["11-admin-lanzador-seguro.png", "Admin", "Lanzador seguro", "1440x900", "light"],
];

async function verifyBaseline() {
  const manifest = JSON.parse(await readFile(resolve(outputDir, "manifest.json"), "utf8"));
  if (manifest.captures.length !== captures.length) throw new Error("Manifest visual incompleto.");
  for (const [file] of captures) {
    const bytes = await readFile(resolve(outputDir, file));
    if (bytes.length < 8 || bytes.subarray(1, 4).toString() !== "PNG") {
      throw new Error(`Captura inválida: ${file}`);
    }
  }
  console.log(`Baseline visual válido: ${captures.length} capturas.`);
}

if (checkOnly) {
  await verifyBaseline();
  process.exit(0);
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite todavía está iniciando.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`Vite no respondió en ${baseUrl}.`);
}

const viteBin = resolve(rootDir, "node_modules/vite/bin/vite.js");
await access(viteBin);
const server = process.env.VISUAL_BASE_URL
  ? null
  : spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "4178", "--strictPort"], {
      cwd: rootDir,
      env: {
        ...process.env,
        VITE_SUPABASE_URL: "https://visual-baseline.invalid",
        VITE_SUPABASE_ANON_KEY: "visual-baseline-placeholder",
        VITE_TURNSTILE_SITE_KEY: "",
        VITE_ENABLE_MONITORING_IN_DEV: "false",
        VITE_VISUAL_BASELINE: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
let serverLog = "";
server?.stdout?.on("data", (chunk) => (serverLog += chunk.toString()));
server?.stderr?.on("data", (chunk) => (serverLog += chunk.toString()));

const blockedOrigins = new Set();
const localFailures = [];
const browserErrors = [];
let browser;

async function createPage(viewport) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  await page.addInitScript(
    ({ fixedTime }) => {
      const NativeDate = Date;
      const timestamp = new NativeDate(fixedTime).getTime();
      class FixedDate extends NativeDate {
        constructor(...args) {
          if (args.length === 0) super(timestamp);
          else super(...args);
        }

        static now() {
          return timestamp;
        }
      }
      globalThis.Date = FixedDate;
    },
    { fixedTime: fixedBrowserTime }
  );
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === baseOrigin || url.protocol === "data:" || url.protocol === "blob:") {
      await route.continue();
      return;
    }
    blockedOrigins.add(url.origin);
    await route.abort("blockedbyclient");
  });
  page.on("response", (response) => {
    if (response.url().startsWith(baseOrigin) && response.status() >= 400) {
      localFailures.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });
  await page.goto(`${baseUrl}/#/login`, { waitUntil: "commit", timeout: 30000 });
  await page
    .locator("#legajo:visible, #m-legajo:visible")
    .waitFor({ state: "visible", timeout: 30000 });
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}

async function loginMock(page) {
  await page.locator("#legajo:visible, #m-legajo:visible").fill("testing");
  await page.locator("#password:visible, #m-pass:visible").fill("testing");
  await page.getByRole("button", { name: /Iniciar Sesión|Entrar a mi panel/ }).click();
  await page.evaluate(() => {
    window.location.hash = "#/testing";
  });
  await page.getByText("Entorno de Simulación").waitFor({ state: "visible" });
}

async function clickVisible(page, name) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    for (const locator of [
      page.getByRole("button", { name, exact: true }),
      page.getByText(name, { exact: true }),
    ]) {
      for (let index = 0; index < (await locator.count()); index += 1) {
        const candidate = locator.nth(index);
        if (await candidate.isVisible()) {
          await candidate.click();
          return;
        }
      }
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`No se encontró un control visible: ${name}`);
}

async function clickLaunch(page, name) {
  const row = page.locator(".lv4-row").filter({ hasText: name }).first();
  try {
    await row.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    const visibleLabels = await page
      .locator(".lv4-row")
      .evaluateAll((rows) => rows.map((item) => item.getAttribute("aria-label")));
    throw new Error(
      `No se encontró la convocatoria "${name}". Filas visibles: ${JSON.stringify(visibleLabels)}`
    );
  }
  await row.click();
}

async function shot(page, file) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(outputDir, file), fullPage: true });
}

try {
  await waitForServer();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  browser = await chromium.launch({ headless: true });

  const desktop = await createPage({ width: 1440, height: 900 });
  await desktop.page.getByText("Hola de nuevo.").waitFor();
  await shot(desktop.page, captures[0][0]);
  await loginMock(desktop.page);
  await shot(desktop.page, captures[2][0]);
  await clickVisible(desktop.page, "Prácticas");
  await shot(desktop.page, captures[3][0]);
  await clickVisible(desktop.page, "Solicitudes");
  await shot(desktop.page, captures[4][0]);
  await clickVisible(desktop.page, "Inicio");
  const themeButton = desktop.page.getByRole("button", { name: "Cambiar tema" });
  if ((await themeButton.count()) > 0) await themeButton.first().click();
  else await desktop.page.evaluate(() => document.documentElement.classList.add("dark"));
  await shot(desktop.page, captures[5][0]);
  if ((await themeButton.count()) > 0) await themeButton.first().click();
  else await desktop.page.evaluate(() => document.documentElement.classList.remove("dark"));
  await desktop.context.close();

  console.log("  estudiante desktop: OK");
  const admin = await createPage({ width: 1440, height: 900 });
  await loginMock(admin.page);
  const adminSwitch = admin.page.locator('button:has-text("Vista Admin")');
  await adminSwitch.first().click({ force: true });
  const launcherTab = admin.page.locator('button:has-text("Lanzador")');
  await launcherTab.last().click({ force: true });
  await admin.page.getByText("Seleccioná una convocatoria").waitFor();
  await shot(admin.page, captures[8][0]);
  await clickLaunch(admin.page, "Hospital Garrahan - Guardia Pediátrica");
  await admin.page.getByText("Cerrar inscripción").first().waitFor();
  await admin.page.locator(".lv4-meta").filter({ hasText: "Postulantes: 3" }).waitFor();
  await shot(admin.page, captures[9][0]);
  await clickLaunch(admin.page, "Clínica San Jorge - Admisiones");
  await admin.page.getByText("Mesa de selección abierta").waitFor();
  await shot(admin.page, captures[10][0]);
  await admin.context.close();
  console.log("  admin Lanzador: OK");

  const tablet = await createPage({ width: 1024, height: 768 });
  await loginMock(tablet.page);
  await shot(tablet.page, captures[6][0]);
  await tablet.context.close();

  const mobile = await createPage({ width: 390, height: 844 });
  await shot(mobile.page, captures[1][0]);
  await loginMock(mobile.page);
  await shot(mobile.page, captures[7][0]);
  await mobile.context.close();

  if (localFailures.length > 0) {
    throw new Error(`Fallaron recursos locales: ${[...new Set(localFailures)].join(", ")}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    isolation: {
      data: "mockDb + login testing/testing",
      clock: fixedBrowserTime,
      productionRequests: "blocked",
      blockedOrigins: [...blockedOrigins].sort(),
    },
    captures: captures.map(([file, role, state, viewport, theme]) => ({
      file,
      role,
      state,
      viewport,
      theme,
    })),
  };
  await writeFile(
    resolve(outputDir, "manifest.json"),
    await format(JSON.stringify(manifest), { parser: "json" })
  );
  await writeFile(
    resolve(outputDir, "README.md"),
    "# Baseline visual — Fase 0F\n\n" +
      "Capturas deterministas del modo de simulación. No contienen datos productivos. " +
      "Toda solicitud que no apunta al servidor Vite local se bloquea antes de salir del navegador.\n\n" +
      "Regenerar: `npm run visual:baseline`\n\n" +
      "Verificar artefactos: `npm run visual:baseline:check`\n"
  );
  await verifyBaseline();
  console.log(`Orígenes externos bloqueados: ${blockedOrigins.size}.`);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  const browserDetail = browserErrors.length
    ? `\nBrowser:\n${[...new Set(browserErrors)].slice(-20).join("\n")}`
    : "";
  throw new Error(
    `${detail}${browserDetail}${serverLog ? `\nVite:\n${serverLog.slice(-2000)}` : ""}`
  );
} finally {
  await browser?.close();
  server?.kill();
}
