import react from "@vitejs/plugin-react";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import ts from "typescript";
import { defineConfig, loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function sandboxTypeScriptTransform() {
  return {
    name: "sandbox-typescript-transform",
    enforce: "pre",
    transform(code, id) {
      const [filename] = id.split("?");
      if (!filename || filename.includes("/node_modules/") || !/\.[cm]?[tj]sx?$/.test(filename)) {
        return null;
      }

      const result = ts.transpileModule(code, {
        fileName: filename,
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ESNext,
          useDefineForClassFields: true,
          importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
          sourceMap: true,
          importHelpers: true,
        },
      });

      return {
        code: result.outputText,
        map: result.sourceMapText ? JSON.parse(result.sourceMapText) : null,
      };
    },
  };
}
export default defineConfig(({ mode }) => {
  loadEnv(mode, process.cwd(), "");
  return {
    base: "./",
    plugins: [
      sandboxTypeScriptTransform(),
      react(
        mode === "production"
          ? { babel: { plugins: [["babel-plugin-react-compiler", {}]] } }
          : undefined
      ),
    ],
    esbuild: false,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    optimizeDeps: { noDiscovery: true, include: [] },
    build: {
      minify: false,
      cssMinify: false,
      outDir: "dist",
      assetsDir: "assets",
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
        },
      },
      copyPublicDir: true,
    },
    publicDir: "public",
  };
});
