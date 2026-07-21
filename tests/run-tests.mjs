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
  "js/modules/achievement-config.js",
  "js/modules/achievement-system.js",
  "js/modules/combat-system.js",
  "js/modules/camera-system.js",
  "js/modules/expedition-run-system.js",
  "js/modules/expedition-meta-system.js",
  "js/modules/expedition-world-system.js",
  "js/modules/fate-coin-system.js",
  "js/modules/fate-shop-rules.js",
  "js/modules/game-core.js",
  "js/modules/modal-focus-manager.js",
  "js/modules/pet-system.js",
  "js/modules/player-system.js",
  "js/modules/progression-config.js",
  "js/modules/resource-system.js",
  "js/modules/save-system.js",
  "js/modules/scene-router.js",
  "js/modules/territory-art-config.js",
  "js/modules/territory-system.js",
  "js/modules/territory-world-system.js",
  ...controllerFiles,
];
const excludedTests = new Map([
  [
    "tower-defense-smoke.mjs",
    "旧版竖版塔防原型已由搜打撤远征取代，仅保留为历史诊断脚本",
  ],
]);
const testFiles = readdirSync(new URL("./", import.meta.url))
  .filter((fileName) => (
    (fileName.endsWith(".test.mjs") || fileName.endsWith("-smoke.mjs"))
    && !excludedTests.has(fileName)
  ))
  .sort()
  .map((fileName) => `tests/${fileName}`);

for (const [fileName, reason] of excludedTests) {
  console.log(`\n> skip tests/${fileName}: ${reason}`);
}

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
