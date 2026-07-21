import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleCss = readFileSync(
  new URL("../css/style.css", import.meta.url),
  "utf8",
);
const mainJs = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");

test("竖屏不会被方向遮罩阻止进入游戏", () => {
  assert.doesNotMatch(indexHtml, /orientation-lock/);
  assert.doesNotMatch(styleCss, /\.orientation-lock/);
  assert.doesNotMatch(
    styleCss,
    /@media\s*\(orientation:\s*portrait\)[\s\S]*?\.game-container\s*\{[\s\S]*?visibility:\s*hidden/,
  );
  assert.match(indexHtml, /style\.css\?v=review-fixes-20260722a/);
});

test("命运桌不再显示累计次数和银色点击快捷提示", () => {
  assert.doesNotMatch(indexHtml, /fate-total-flips-display/);
  assert.doesNotMatch(indexHtml, /fate-skill-tree-btn/);
  assert.doesNotMatch(indexHtml, /查看银色点击/);
  assert.match(indexHtml, /main\.js\?v=review-fixes-20260722a/);
});

test("发布入口使用新缓存键且成功撤离深度继续透传", () => {
  for (const modulePath of [
    "combat-system.js",
    "pet-system.js",
    "player-system.js",
    "save-system.js",
    "battle-scene-controller.js",
  ]) {
    assert.match(
      mainJs,
      new RegExp(`${modulePath.replace(".", "\\.")}\\?v=review-fixes-20260722a`),
    );
  }
  assert.match(
    mainJs,
    /bestExtractedDepth:\s*this\.combatSystem\?\.meta\?\.bestExtractedDepth\s*\|\|\s*0/,
  );
});

test("领地目标使用默认收起的紧凑详情结构", () => {
  assert.match(indexHtml, /id="territory-objective-toggle"/);
  assert.match(indexHtml, /id="territory-objective-more" hidden/);
});

test("领地不再显示靠近建筑时的浮动标签", () => {
  assert.doesNotMatch(indexHtml, /territory-nearby-prompt/);
});

test("领地不再显示常驻操作提示栏", () => {
  assert.doesNotMatch(indexHtml, /territory-event-feed/);
  assert.doesNotMatch(styleCss, /\.territory-event-feed/);
});

test("领地资源信息位于标题栏而不是场景画布", () => {
  const scorebarStart = indexHtml.indexOf('<div class="territory-scorebar">');
  const resourceStart = indexHtml.indexOf('<div class="territory-resource-strip"');
  const surfaceStart = indexHtml.indexOf('<div class="territory-world-surface">');
  assert.ok(scorebarStart >= 0);
  assert.ok(resourceStart > scorebarStart);
  assert.ok(resourceStart < surfaceStart);
  assert.match(styleCss, /\.territory-world-panel \.territory-scorebar \{[\s\S]*?grid-template-columns:/);
});

test("首轮成长引导可跳过、可重播并包含六段闭环", () => {
  assert.match(indexHtml, /id="onboarding-replay-btn"/);
  assert.match(indexHtml, /id="onboarding-layer"[^>]*hidden/);
  assert.match(indexHtml, /id="onboarding-skip-btn"/);
  assert.match(indexHtml, /id="onboarding-stepper"/);
  assert.match(indexHtml, /新手引导 · 1\/6/);
  assert.match(styleCss, /\.onboarding-focus-ring/);
});
