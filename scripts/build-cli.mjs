import { mkdir, cp, readFile, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const distDir = path.resolve(rootDir, "dist-cli");

const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
const version = pkg.version ?? "0.0.0";

await build({
  entry: {
    aibridge: path.resolve(rootDir, "aibridge/cli/bin/aibridge.ts"),
  },
  format: ["esm"],
  platform: "node",
  target: "node18",
  bundle: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: distDir,
  dts: false,
  minify: false,
  define: {
    __AIBRIDGE_CLI_VERSION__: JSON.stringify(version),
  },
});

const binPath = path.resolve(distDir, "aibridge.js");
const compiled = await readFile(binPath, "utf8");
const withoutShebang = compiled.replace(/^#!.*\r?\n/gm, "");
await writeFile(binPath, `#!/usr/bin/env node\n${withoutShebang}`, "utf8");
await chmod(binPath, 0o755);

await cp(
  path.resolve(rootDir, "aibridge/protocol/templates"),
  path.resolve(distDir, "aibridge/protocol/templates"),
  { recursive: true },
);

await cp(
  path.resolve(rootDir, "public/examples/aibridge/local-bridge"),
  path.resolve(distDir, "public/examples/aibridge/local-bridge"),
  { recursive: true },
);

try {
  await cp(
    path.resolve(rootDir, "dist"),
    path.resolve(distDir, "dashboard-app"),
    { recursive: true },
  );
} catch (error) {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    // Allow CLI-only local builds, but published packages should run the full build so dashboard assets are present.
  } else {
    throw error;
  }
}

await mkdir(path.resolve(distDir, "aibridge/cli/commands"), { recursive: true });
await cp(
  path.resolve(rootDir, "aibridge/cli/commands"),
  path.resolve(distDir, "aibridge/cli/commands"),
  { recursive: true },
);
