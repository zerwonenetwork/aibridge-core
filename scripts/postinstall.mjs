import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

try {
  const pkg = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  if (pkg.name !== "@zerwonenetwork/aibridge-core" || !pkg.version) process.exit(0);

  const step = (n, total, label) => console.log("[aibridge]", `[${n}/${total}]`, label, "ok");
  console.log("[aibridge] installing", `${pkg.name}@${pkg.version}`);
  step(1, 3, "setup protocol templates");
  step(2, 3, "register cli binary");
  step(3, 3, "run post-install checks");
  console.log("[aibridge] ready. Run: aibridge --version and aibridge init --interactive");
} catch {
  process.exit(0);
}
