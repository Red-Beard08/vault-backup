import esbuild from "esbuild";
import builtins from "builtin-modules";
const production = process.argv[2] === "production";
const context = await esbuild.context({ entryPoints: ["src/main.ts"], bundle: true, external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", "node:*", ...builtins], format: "cjs", target: "es2018", outfile: "main.js", sourcemap: production ? false : "inline", banner: { js: "/* Vault Backup by Red-Beard */" } });
if (production) { await context.rebuild(); await context.dispose(); } else await context.watch();
