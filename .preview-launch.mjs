import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
process.chdir(dir);
await import(pathToFileURL(path.join(dir, "node_modules", "vite", "bin", "vite.js")).href);
