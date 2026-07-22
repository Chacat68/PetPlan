import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styleCss = readFileSync(
  new URL("../css/style.css", import.meta.url),
  "utf8",
);
const mainJs = readFileSync(new URL("../js/main.js", import.meta.url), "utf8");

test("窄竖屏使用可恢复的横屏引导而不是压缩玩法舞台", () => {
  assert.match(indexHtml, /id="orientation-guide"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(indexHtml, /id="orientation-guide-check"/);
  assert.match(indexHtml, /旋转设备后会保留当前场景、远征进度与操作位置/);
  assert.match(styleCss, /\.orientation-guide\[hidden\]/);
  assert.match(mainJs, /OrientationController/);
  assert.match(indexHtml, /style\.css\?v=territory-controls-compact-20260722a/);
});

test("命运桌不再显示累计次数和银色点击快捷提示", () => {
  assert.doesNotMatch(indexHtml, /fate-total-flips-display/);
  assert.doesNotMatch(indexHtml, /fate-skill-tree-btn/);
  assert.doesNotMatch(indexHtml, /查看银色点击/);
  assert.match(indexHtml, /main\.js\?v=onboarding-removed-20260722a/);
});

test("发布入口使用新缓存键且成功撤离深度继续透传", () => {
  for (const modulePath of [
    "combat-system.js",
    "pet-system.js",
    "player-system.js",
    "save-system.js",
  ]) {
    assert.match(
      mainJs,
      new RegExp(`${modulePath.replace(".", "\\.")}\\?v=review-fixes-20260722a`),
    );
  }
  assert.match(
    mainJs,
    /battle-scene-controller\.js\?v=experience-ux-20260722a/,
  );
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
  const headingStart = indexHtml.indexOf('<div class="territory-scorebar-heading">');
  const titleStart = indexHtml.indexOf('<span class="territory-scorebar-title">');
  const rankStart = indexHtml.indexOf('id="territory-rank-badge"');
  const resourceStart = indexHtml.indexOf('<div class="territory-resource-strip"');
  const surfaceStart = indexHtml.indexOf('<div class="territory-world-surface">');
  assert.ok(scorebarStart >= 0);
  assert.ok(headingStart > scorebarStart);
  assert.ok(titleStart > headingStart);
  assert.ok(rankStart > titleStart);
  assert.ok(resourceStart > rankStart);
  assert.ok(resourceStart < surfaceStart);
  assert.match(styleCss, /\.territory-world-panel \.territory-scorebar \{[\s\S]*?grid-template-columns:/);
  assert.match(styleCss, /\.territory-scorebar-heading \{[\s\S]*?display: flex;/);
  assert.match(styleCss, /\.territory-resource-strip \{[\s\S]*?justify-content: flex-end;/);
});

test("领地移动与交互控件使用紧凑但可触控的尺寸", () => {
  assert.match(styleCss, /\.territory-move-btn \{[\s\S]*?width: 44px;[\s\S]*?min-height: 44px;/);
  assert.match(styleCss, /\.territory-interact-btn \{[\s\S]*?min-width: min\(220px, 24vw\);[\s\S]*?min-height: 44px;/);
  assert.match(styleCss, /\.territory-interact-btn strong \{[\s\S]*?font-size: clamp\(11px, 1\.1vw, 14px\);/);
});

test("首轮成长引导入口和浮层已从当前版本移除", () => {
  assert.doesNotMatch(indexHtml, /id="onboarding-|class="[^"]*onboarding-/);
  assert.doesNotMatch(styleCss, /\.onboarding-/);
});

test("远征终端和战斗 HUD 使用阶段化减负结构", () => {
  assert.match(indexHtml, /id="battle-terminal-toggle"/);
  assert.match(indexHtml, /class="run-stat stat-survival"/);
  assert.match(indexHtml, /id="battle-terminal-status"[^>]*aria-live="polite"/);
  assert.match(styleCss, /#battle-scene\[data-raid-active="true"\] \.battle-resource-strip/);
  assert.match(styleCss, /#upgrade-panel\[data-raid-active="true"\]\[data-compact-open="false"\]/);
});

test("命运推荐栏包含随目标更新的下一里程碑卡", () => {
  assert.match(indexHtml, /id="fate-milestone-card"/);
  assert.match(indexHtml, /id="fate-milestone-route"/);
  assert.match(styleCss, /\.fate-milestone-card\[hidden\]/);
  assert.match(mainJs, /ShopRecommendationController/);
});
