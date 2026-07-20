import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createServer } from "vite";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const outputDir = resolve(rootDir, "output/pdf");
const allFixtures = [
  {
    query: "",
    outputPath: resolve(outputDir, "informe-pps-sede-comahue-2024-fixture.pdf"),
  },
  {
    query: "?kind=management",
    outputPath: resolve(outputDir, "informe-gestion-pps-sede-comahue-2024-2026-fixture.pdf"),
  },
  {
    query: "?kind=annual2026",
    outputPath: resolve(outputDir, "informe-pps-sede-comahue-2026-fixture.pdf"),
  },
  {
    query: "?kind=annual2025",
    outputPath: resolve(outputDir, "informe-pps-sede-comahue-2025-fixture.pdf"),
  },
  {
    query: "?kind=director",
    outputPath: resolve(
      outputDir,
      "informe-direccion-pps-agostina-reale-berrueta-2026-fixture.pdf"
    ),
  },
];
const fixtures = process.argv.includes("--management")
  ? [allFixtures[1]]
  : process.argv.includes("--director")
    ? [allFixtures[4]]
    : process.argv.includes("--annual-2025")
      ? [allFixtures[3]]
      : process.argv.includes("--annual-2026")
        ? [allFixtures[2]]
        : process.argv.includes("--annual")
          ? [allFixtures[0]]
          : allFixtures;

await mkdir(outputDir, { recursive: true });

const server = await createServer({
  root: rootDir,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});

let browser;
try {
  await server.listen();
  const baseUrl = server.resolvedUrls?.local[0];
  if (!baseUrl) throw new Error("Vite no informó la URL local del fixture.");

  browser = await chromium.launch({ headless: true });
  for (const fixture of fixtures) {
    const page = await browser.newPage();
    await page.goto(
      `${baseUrl}scripts/analytics/fixtures/professional-report-fixture.html${fixture.query}`,
      { waitUntil: "networkidle" }
    );
    await page.waitForFunction(
      () => document.querySelector("#pdf-ready") || document.querySelector("#pdf-error"),
      undefined,
      { timeout: 120000 }
    );
    const error = await page
      .locator("#pdf-error")
      .textContent()
      .catch(() => null);
    if (error) throw new Error(error);

    const base64 = await page.locator("#pdf-ready").evaluate(async (element) => {
      const response = await fetch(element.href);
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
      }
      return btoa(binary);
    });
    await writeFile(fixture.outputPath, Buffer.from(base64, "base64"));
    process.stdout.write(`${fixture.outputPath}\n`);
    await page.close();
  }
} finally {
  if (browser) await browser.close();
  await server.close();
}
