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
  assert.match(indexHtml, /style\.css\?v=battle-context-ui-20260723b/);
});

test("命运桌不再显示累计次数和银色点击快捷提示", () => {
  assert.doesNotMatch(indexHtml, /fate-total-flips-display/);
  assert.doesNotMatch(indexHtml, /fate-skill-tree-btn/);
  assert.doesNotMatch(indexHtml, /查看银色点击/);
  assert.match(indexHtml, /main\.js\?v=battle-context-ui-20260723b/);
});

test("远征使用沉浸模式并通过 Esc 确认退出", () => {
  assert.match(styleCss, /body\[data-scene="dungeon"\] \.game-hud-controls\s*\{[^}]*display:\s*none/);
  assert.match(indexHtml, /id="expedition-exit-dialog"[^>]*role="dialog"[^>]*aria-modal="true"/s);
  assert.match(indexHtml, /id="expedition-exit-cancel"[^>]*>继续远征<\/button>/);
  assert.match(indexHtml, /id="expedition-exit-confirm"[^>]*>确认退出<\/button>/);
  assert.match(mainJs, /if \(this\.currentScene === "dungeon"\)[\s\S]*openExpeditionExitConfirm\(\)/);
  assert.match(mainJs, /battleSceneController\?\.backpackForced[\s\S]*请先处理背包中待取舍的战利品[\s\S]*return/);
  assert.match(mainJs, /runActive \? this\.combatSystem\.abandonRun\(\) : null/);
  assert.match(mainJs, /战斗或撤离守点[^]*?10% 金币与 20% 经验/);
  assert.match(mainJs, /安全止损[^]*?30% 金币与 40% 经验/);
  assert.match(mainJs, /另会遗失未保险配装/);
  assert.match(mainJs, /this\.handleNavigation\("territory"\)/);
});

test("远征从全局导航收拢到领地入口", () => {
  assert.doesNotMatch(indexHtml, /class="[^"]*nav-btn[^"]*"[^>]*data-tab="dungeon"/);
  assert.match(indexHtml, /data-territory-action="depart"[^>]*>进入远征<\/button>/);
  assert.match(mainJs, /territory-system\.js\?v=territory-expedition-entry-20260723a/);
  assert.match(mainJs, /shop-recommendation-controller\.js\?v=territory-expedition-entry-20260723a/);
});

test("发布入口使用新缓存键且成功撤离深度继续透传", () => {
  for (const modulePath of ["combat-system.js", "player-system.js"]) {
    assert.match(
      mainJs,
      new RegExp(`${modulePath.replace(".", "\\.")}\\?v=expedition-simplification-20260723b`),
    );
  }
  for (const modulePath of ["pet-system.js"]) {
    assert.match(
      mainJs,
      new RegExp(`${modulePath.replace(".", "\\.")}\\?v=expedition-simplification-20260723b`),
    );
  }
  assert.match(
    mainJs,
    /battle-scene-controller\.js\?v=battle-context-ui-20260723b/,
  );
  assert.match(mainJs, /save-system\.js\?v=review-fixes-20260722a/);
  assert.match(mainJs, /expedition-meta-system\.js\?v=expedition-simplification-20260723b/);
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

test("远征使用全屏战场和按情境出现的轻量交互", () => {
  assert.match(indexHtml, /class="battle-flow-layer" id="battle-flow-layer"/);
  assert.match(indexHtml, /id="battle-prep-panel"/);
  assert.match(indexHtml, /id="battle-context-dock"[^>]*hidden/);
  assert.match(indexHtml, /id="battle-pack-toggle"[^>]*aria-controls="battle-pack-drawer"/s);
  assert.match(indexHtml, /id="battle-pack-drawer"[^>]*hidden/);
  assert.match(indexHtml, /id="battle-target-cycle-btn"/);
  assert.match(indexHtml, /class="run-stat stat-survival"/);
  assert.match(indexHtml, /id="battle-action-status"[^>]*aria-live="polite"/);
  assert.doesNotMatch(indexHtml, /battle-terminal-toggle|battle-terminal-scroll|battle-terminal-footer/);
  assert.doesNotMatch(indexHtml, /远征战术终端|FIELD COMMAND|Tab \/ M/);
  assert.doesNotMatch(indexHtml, /id="battle-route-list"|id="battle-abandon-btn"|id="battle-extract-btn"/);
  assert.match(styleCss, /#battle-scene\[data-raid-active="true"\] \.battle-resource-strip/);
  assert.match(styleCss, /#battle-scene \.battle-board-panel \{[\s\S]*?width:\s*100%;[\s\S]*?flex:\s*1 1 100%;/);
  assert.match(styleCss, /\.battle-flow-layer \{[\s\S]*?position:\s*absolute;[\s\S]*?pointer-events:\s*none;/);
  assert.match(styleCss, /\.battle-context-dock\[hidden\][\s\S]*?display:\s*none !important;/);
  assert.match(styleCss, /\.battle-prep-card \{[\s\S]*?left:\s*50%;[\s\S]*?pointer-events:\s*auto;/);
  assert.match(indexHtml, /class="run-stat stat-depth">已清理 <b id="battle-depth-display">0 \/ 8<\/b>/);
  assert.match(indexHtml, /id="battle-threat-display">警戒 · 0<\/b>/);
});

test("远征风险面板只保留单一警戒指标", () => {
  assert.match(indexHtml, /id="battle-threat-tier-label"/);
  assert.match(indexHtml, /id="battle-threat-next"/);
  assert.doesNotMatch(indexHtml, /battle-return-pressure|返程压力|超限压力/);
});

test("远征局内只保留两种搜索、单武器提示和自动换弹", () => {
  assert.match(indexHtml, /data-search-mode="quick"[\s\S]*?快速拿取/);
  assert.match(indexHtml, /data-search-mode="thorough"[\s\S]*?彻底搜刮/);
  assert.doesNotMatch(indexHtml, /data-search-mode="pet"/);
  assert.match(indexHtml, /id="battle-search-pet-bonus">宠物侦察被动/);
  assert.match(indexHtml, /id="battle-skill-dock" aria-label="队伍协同技"/);
  assert.doesNotMatch(indexHtml, /id="battle-reload-btn"/);
  assert.match(indexHtml, /按住 · 自动换弹/);
  assert.match(indexHtml, /id="battle-success-preview">总价值 0/);
  assert.match(styleCss, /本局锁定武器 · 自动换弹/);
});

test("命运推荐栏包含随目标更新的下一里程碑卡", () => {
  assert.match(indexHtml, /id="fate-milestone-card"/);
  assert.match(indexHtml, /id="fate-milestone-route"/);
  assert.match(styleCss, /\.fate-milestone-card\[hidden\]/);
  assert.match(mainJs, /ShopRecommendationController/);
});
