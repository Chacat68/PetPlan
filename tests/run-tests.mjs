import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const controllerFiles = readdirSync(
  new URL("../js/controllers/", import.meta.url)
)
  .filter((fileName) => fileName.endsWith(".js"))
  .sort()
  .map((fileName) => `js/controllers/${fileName}`);
const sourceFiles = [
  "js/main.js",
  "js/modules/combat-system.js",
  "js/modules/expedition-run-system.js",
  "js/modules/fate-coin-system.js",
  "js/modules/fate-shop-rules.js",
  "js/modules/game-core.js",
  "js/modules/modal-focus-manager.js",
  "js/modules/player-system.js",
  "js/modules/scene-router.js",
  ...controllerFiles,
];
const testFiles = [
  "tests/controller-contracts.test.mjs",
  "tests/core-logic.test.mjs",
  "tests/phase-one-smoke.mjs",
  "tests/extraction-rpg-smoke.mjs",
];

for (const sourceFile of sourceFiles) {
  console.log(`\n> node --check ${sourceFile}`);

  const result = spawnSync(process.execPath, ["--check", sourceFile], {
    cwd: projectRoot,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`无法检查 ${sourceFile}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const testFile of testFiles) {
  console.log(`\n> node --test ${testFile}`);

  const result = spawnSync(process.execPath, ["--test", testFile], {
    cwd: projectRoot,
    shell: false,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`无法运行 ${testFile}:`, result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (result.signal) {
      console.error(`${testFile} 被信号 ${result.signal} 中止。`);
    }
    process.exit(result.status ?? 1);
  }
}

console.log("\n全部源码检查和 Node 测试已通过。");
