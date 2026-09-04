import { brotliCompressSync, gzipSync } from "node:zlib";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { chromium } from "playwright";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const targetUrl = args.get("--url") ?? "http://127.0.0.1:4173/#/login";
const iterations = Number(args.get("--iterations") ?? 5);
const label = args.get("--label") ?? "benchmark";
const outputPath = args.get("--output");
const distDir = resolve(args.get("--dist") ?? "dist");

if (!Number.isInteger(iterations) || iterations < 1) {
  throw new Error("--iterations debe ser un entero positivo");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : path;
    })
  );
  return files.flat();
}

async function measureDist() {
  const indexHtml = await readFile(join(distDir, "index.html"), "utf8");
  const entryMatch = indexHtml.match(/<script[^>]+src="\.\/([^\"]+\.js)"/);
  const files = await walk(distDir);
  const assets = [];

  for (const path of files) {
    const extension = extname(path).toLowerCase();
    if (![".js", ".mjs", ".css", ".woff", ".woff2"].includes(extension)) continue;

    const content = await readFile(path);
    assets.push({
      path: relative(distDir, path).replaceAll("\\", "/"),
      type: extension.slice(1),
      rawBytes: content.byteLength,
      gzipBytes: gzipSync(content, { level: 9 }).byteLength,
      brotliBytes: brotliCompressSync(content).byteLength,
    });
  }

  const entry = entryMatch ? assets.find((asset) => asset.path === entryMatch[1]) : undefined;
  const total = assets.reduce(
    (sum, asset) => ({
      rawBytes: sum.rawBytes + asset.rawBytes,
      gzipBytes: sum.gzipBytes + asset.gzipBytes,
      brotliBytes: sum.brotliBytes + asset.brotliBytes,
    }),
    { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 }
  );

  return {
    entry: entry ?? null,
    total,
    largestAssets: assets.sort((a, b) => b.rawBytes - a.rawBytes).slice(0, 15),
  };
}

function percentile(values, ratio) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarize(runs, key) {
  const values = runs.map((run) => run[key]).filter(Number.isFinite);
  return {
    median: Math.round(percentile(values, 0.5) * 10) / 10,
    p75: Math.round(percentile(values, 0.75) * 10) / 10,
    min: Math.round(Math.min(...values) * 10) / 10,
    max: Math.round(Math.max(...values) * 10) / 10,
  };
}

const browser = await chromium.launch({ headless: true });
const runs = [];

try {
  for (let run = 0; run < iterations; run += 1) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);

    await session.send("Network.enable");
    await session.send("Network.setCacheDisabled", { cacheDisabled: true });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      connectionType: "cellular4g",
    });
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });

    await page.addInitScript(() => {
      window.__perfAudit = { cls: 0, lcp: 0, longTasks: [] };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        window.__perfAudit.lcp = entries.at(-1)?.startTime ?? window.__perfAudit.lcp;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__perfAudit.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__perfAudit.longTasks.push(entry.duration);
        }
      }).observe({ type: "longtask", buffered: true });
    });

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(4_000);

    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paints = Object.fromEntries(
        performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime])
      );
      const resources = performance.getEntriesByType("resource");
      const ownResources = resources.filter((entry) => entry.name.startsWith(location.origin));
      const audit = window.__perfAudit;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd,
        load: navigation.loadEventEnd,
        fcp: paints["first-contentful-paint"] ?? 0,
        lcp: audit.lcp,
        cls: audit.cls,
        longTaskCount: audit.longTasks.length,
        totalBlockingTime: audit.longTasks.reduce(
          (sum, duration) => sum + Math.max(0, duration - 50),
          0
        ),
        requestCount: resources.length,
        ownRequestCount: ownResources.length,
        transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
        ownTransferBytes: ownResources.reduce((sum, entry) => sum + entry.transferSize, 0),
      };
    });

    runs.push(metrics);
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  label,
  generatedAt: new Date().toISOString(),
  targetUrl,
  profile: {
    viewport: "390x844 @2x",
    cpuSlowdown: 4,
    latencyMs: 150,
    downloadMbps: 1.6,
    uploadKbps: 750,
    cache: "cold",
  },
  iterations,
  summary: Object.fromEntries(
    [
      "fcp",
      "lcp",
      "cls",
      "domContentLoaded",
      "load",
      "totalBlockingTime",
      "longTaskCount",
      "requestCount",
      "transferBytes",
      "ownTransferBytes",
    ].map((key) => [key, summarize(runs, key)])
  ),
  runs,
  dist: await measureDist(),
};

const serialized = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) {
  const resolvedOutputPath = resolve(outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, serialized, "utf8");
}
process.stdout.write(serialized);
