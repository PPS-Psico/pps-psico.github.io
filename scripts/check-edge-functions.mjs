/**
 * Verifica las Edge Functions antes de que lleguen a producción.
 *
 * POR QUÉ EXISTE
 *
 * Las funciones de `supabase/functions/` no las miraba nada: `tsconfig.json`
 * sólo incluye `src`, ESLint las ignora y no tienen tests. La única
 * "verificación" era desplegarlas y ver qué pasaba.
 *
 * Eso tuvo costo real. `restore-backup` tenía un ternario que devolvía
 * `"completed"` en las dos ramas, así que una restauración a medias se
 * registraba como exitosa; sobrevivió meses porque no había nada mirando. Y dos
 * funciones (`restore-backup`, `ingest-moodle-grade-export`) estaban en disco y
 * declaradas en `config.toml` pero el workflow nunca las nombraba, así que lo
 * mergeado a main no llegaba a producción: la copia desplegada quedó seis meses
 * atrás.
 *
 * QUÉ CHEQUEA
 *
 * 1. Tipos, con `deno check` sobre las 19 funciones en una sola invocación.
 * 2. Que las tres listas coincidan: carpetas en disco, funciones declaradas en
 *    `config.toml`, y funciones nombradas en el workflow de deploy. Si alguna
 *    queda afuera de cualquiera de las tres, el despliegue miente en silencio.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const functionsDir = new URL("../supabase/functions/", import.meta.url);
const configPath = new URL("../supabase/config.toml", import.meta.url);
const workflowPath = new URL("../.github/workflows/deploy-edge-functions.yml", import.meta.url);

const errors = [];

// --- 1. Inventario en disco -------------------------------------------------
// Las carpetas con guion bajo son código compartido, no funciones desplegables.
const entries = await readdir(functionsDir, { withFileTypes: true });
const onDisk = entries
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => entry.name)
  .sort();

if (onDisk.length === 0) {
  console.error("No se encontró ninguna Edge Function en supabase/functions/.");
  process.exit(1);
}

// --- 2. Las tres listas tienen que coincidir --------------------------------
const configText = await readFile(configPath, "utf8");
const declared = new Set(
  [...configText.matchAll(/^\[functions\.([a-z0-9-]+)\]/gm)].map((match) => match[1])
);

const workflowText = await readFile(workflowPath, "utf8");
const deployed = new Set(
  [...workflowText.matchAll(/supabase functions deploy ([a-z0-9-]+)/g)].map((match) => match[1])
);

for (const name of onDisk) {
  if (!declared.has(name)) {
    errors.push(`${name}: existe en disco pero no está declarada en config.toml`);
  }
  if (!deployed.has(name)) {
    errors.push(
      `${name}: existe en disco pero el workflow de deploy no la nombra, así que nunca llega a producción`
    );
  }
}

for (const name of declared) {
  if (!onDisk.includes(name)) {
    errors.push(`${name}: declarada en config.toml pero no existe la carpeta`);
  }
}

for (const name of deployed) {
  if (!onDisk.includes(name)) {
    errors.push(`${name}: el workflow la despliega pero no existe la carpeta`);
  }
}

if (errors.length > 0) {
  console.error("Inventario de Edge Functions inconsistente:\n- " + errors.join("\n- "));
  process.exit(1);
}

// --- 3. Chequeo de tipos ----------------------------------------------------
// `--node-modules-dir=auto` es necesario porque `send-email` y
// `request-password-reset` importan `npm:nodemailer`; sin eso Deno no lo
// resuelve y falla por dependencias, no por el código.
const targets = onDisk.map((name) => `supabase/functions/${name}/index.ts`);

// Se invoca el entrypoint del paquete `deno` con node en vez de el shim de
// `.bin`: evita depender de la extension `.cmd` en Windows y de `shell: true`.
// Si el binario todavia no esta bajado, ese entrypoint lo descarga solo, asi
// que funciona aunque el `postinstall` este bloqueado por allow-scripts.
const denoEntry = fileURLToPath(new URL("../node_modules/deno/bin.cjs", import.meta.url));
if (!existsSync(denoEntry)) {
  console.error("Falta la dependencia `deno`. Corré `npm install` antes de este chequeo.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [denoEntry, "check", "--node-modules-dir=auto", ...targets],
  { stdio: "inherit" }
);

if (result.status !== 0) {
  console.error("\n`deno check` encontró errores en las Edge Functions.");
  process.exit(result.status ?? 1);
}

console.log(
  `\n${onDisk.length} Edge Functions verificadas: tipos correctos, y todas declaradas en config.toml y en el workflow de deploy.`
);
