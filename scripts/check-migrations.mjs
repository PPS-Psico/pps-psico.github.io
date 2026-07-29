import { readdir, stat } from "node:fs/promises";

const migrationsDir = new URL("../supabase/migrations/", import.meta.url);
const overlaysDir = new URL("../supabase/reference/bootstrap/overlays/", import.meta.url);
const filenamePattern = /^(\d{14})_[a-z0-9][a-z0-9_]*\.sql$/;
const versions = new Map();
const errors = [];

async function validateDirectory(directory, label, { canonical = false } = {}) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();

  for (const file of files) {
    const match = filenamePattern.exec(file);
    if (!match) {
      errors.push(`${label}/${file}: debe usar YYYYMMDDHHMMSS_nombre_en_snake_case.sql`);
      continue;
    }

    const version = match[1];
    const previous = versions.get(version);
    if (previous) {
      errors.push(`${label}/${file}: repite la versión de ${previous}`);
    } else {
      versions.set(version, `${label}/${file}`);
    }

    const metadata = await stat(new URL(file, directory));
    if (metadata.size === 0) errors.push(`${label}/${file}: el archivo está vacío`);
  }

  return { files, canonical };
}

const migrations = await validateDirectory(migrationsDir, "migrations", { canonical: true });
const overlays = await validateDirectory(overlaysDir, "bootstrap/overlays");

if (errors.length > 0) {
  console.error("Historial local de migraciones inválido:\n- " + errors.join("\n- "));
  process.exit(1);
}

console.log(
  `${migrations.files.length} migraciones canónicas y ${overlays.files.length} overlays locales: nombres, versiones y contenido válidos.`
);
