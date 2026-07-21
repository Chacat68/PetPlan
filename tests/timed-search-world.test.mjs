import assert from "node:assert/strict";
import test from "node:test";

import { ExpeditionRunSystem, SEARCH_PROFILES } from "../js/modules/expedition-run-system.js";
import { ExpeditionWorldSystem } from "../js/modules/expedition-world-system.js";

function enterFirstSearch(run, options = {}) {
  assert.equal(run.startRun(options).success, true);
  const node = run.getState().routeChoices.find((entry) => entry.type === "search");
  assert.ok(node, "第一层必须包含搜索地点");
  assert.equal(run.chooseNode(node.id).success, true);
  return node;
}

function createRouteNode(id, type = "search", depth = 1, branch = 0) {
  return {
    id,
    type,
    depth,
    branch,
    name: type === "cache" ? "测试仓库" : "测试搜索点",
    description: "用于逐容器搜索测试",
    icon: "▣",
    danger: "测试",
  };
}

test("计时搜索完成前不产生掉落、威胁、伏击或资源消耗", () => {
  let randomDraws = 0;
  const run = new ExpeditionRunSystem({
    random: () => {
      randomDraws += 1;
      return 0.99;
    },
  });
  enterFirstSearch(run, { supplies: 2 });
  const drawsBeforeSearch = randomDraws;
  const started = run.beginSearch("quick", { containerId: "crate-a", isLastContainer: false });

  assert.equal(started.success, true);
  assert.equal(started.search.durationMs, SEARCH_PROFILES.quick.durationSeconds * 1000);
  const waiting = run.updateSearch(started.search.durationMs - 1);
  assert.equal(waiting.completed, false);
  assert.equal(run.backpack.length, 0);
  assert.equal(run.threat, 0);
  assert.equal(run.exposure, 0);
  assert.equal(run.supplies, 2);
  assert.deepEqual(run.searchMetrics, { timeSeconds: 0, exposure: 0, suppliesSpent: 0 });
  assert.equal(randomDraws, drawsBeforeSearch, "搜索读条期间不能提前进行掉落或伏击随机判定");

  const completed = run.updateSearch(1);
  assert.equal(completed.success, true);
  assert.equal(completed.completed, true);
  assert.equal(completed.nodeCompleted, false, "单个容器完成后应允许继续搜索同一地点");
  assert.equal(run.backpack.length, 1);
  assert.equal(run.threat, SEARCH_PROFILES.quick.threat);
  assert.equal(run.searchMetrics.timeSeconds, SEARCH_PROFILES.quick.durationSeconds);
  assert.equal(run.getState().phase, "search");
  assert.equal(run.beginSearch("quick", { containerId: "crate-a" }).success, false, "容器不能重复结算");
});

test("受击和主动取消会中断搜索且完全不结算", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.99 });
  enterFirstSearch(run, { supplies: 2 });

  const first = run.beginSearch("thorough", { containerId: "sealed-a", isLastContainer: true });
  assert.equal(first.success, true);
  run.updateSearch(4500);
  const damaged = run.updateSearch(100, { tookDamage: true });
  assert.equal(damaged.cancelled, true);
  assert.equal(damaged.reason, "damage");
  assert.equal(run.getState().isSearching, false);
  assert.equal(run.backpack.length, 0);
  assert.equal(run.threat, 0);
  assert.equal(run.exposure, 0);
  assert.equal(run.supplies, 2, "被打断的仔细搜索不应消耗补给");
  assert.deepEqual(run.searchMetrics, { timeSeconds: 0, exposure: 0, suppliesSpent: 0 });

  assert.equal(run.beginSearch("quick", { containerId: "sealed-a" }).success, true);
  const cancelled = run.cancelSearch("cancelled");
  assert.equal(cancelled.cancelled, true);
  assert.equal(run.backpack.length, 0);
  assert.equal(run.searchedContainerIds.length, 0);
});

test("旧 resolveSearch 入口通过新计时状态机完成兼容结算", () => {
  const run = new ExpeditionRunSystem({ random: () => 0.99 });
  enterFirstSearch(run, { supplies: 0 });
  const result = run.resolveSearch("quick");
  assert.equal(result.success, true);
  assert.equal(result.completed, true);
  assert.equal(result.nodeCompleted, true);
  assert.equal(run.getState().isSearching, false);
  assert.equal(run.getState().phase, "route");
});

test("搜索地点生成逐个交互的容器，容器搜索状态可完整保存恢复", () => {
  const routes = [
    createRouteNode("route-search", "search", 1, 0),
    createRouteNode("route-cache", "cache", 1, 1),
  ];
  const world = new ExpeditionWorldSystem();
  world.startRun(routes, { seed: 7788 });
  const engaged = world.engageLocation("route-search");
  assert.equal(engaged.success, true);
  assert.equal(engaged.containers.length, 2);
  assert.ok(engaged.containers.every((container) => container.state === "available"));
  assert.equal(new Set(engaged.containers.map((container) => `${container.x},${container.y}`)).size, 2);

  const first = engaged.containers[0];
  world.updatePlayerPosition(first.x, first.y);
  assert.equal(world.getState(first).nearbyContainer.id, first.id);
  const began = world.beginContainerSearch(first.id);
  assert.equal(began.success, true);
  assert.equal(began.context.remainingContainerCount, 2);
  assert.equal(began.context.isLastContainer, false);

  const snapshot = JSON.parse(JSON.stringify(world.getRunSaveData()));
  const restored = new ExpeditionWorldSystem();
  assert.equal(restored.loadRunSaveData(snapshot).success, true);
  assert.equal(restored.getContainer(first.id).state, "searching");
  assert.equal(restored.getState(first).activeContainerSearch.id, first.id);

  assert.equal(restored.cancelContainerSearch(first.id, "damage").success, true);
  assert.equal(restored.getContainer(first.id).state, "available");
  assert.equal(restored.beginContainerSearch(first.id).success, true);
  assert.equal(restored.completeContainerSearch(first.id).remainingContainerCount, 1);

  const second = engaged.containers[1];
  restored.updatePlayerPosition(second.x, second.y);
  const lastContext = restored.beginContainerSearch(second.id).context;
  assert.equal(lastContext.isLastContainer, true);
  const completed = restored.completeContainerSearch(second.id);
  assert.equal(completed.allContainersSearched, true);
  assert.deepEqual(
    restored.getContainersForLocation("route-search").map((container) => container.state),
    ["searched", "searched"],
  );

  const finalSnapshot = restored.getRunSaveData();
  const finalRestore = new ExpeditionWorldSystem();
  assert.equal(finalRestore.loadRunSaveData(finalSnapshot).success, true);
  assert.deepEqual(
    finalRestore.getContainersForLocation("route-search").map((container) => container.state),
    ["searched", "searched"],
  );
});

test("侦察站 revealBoost 会执行一次扩大视野揭示", () => {
  const routes = [
    createRouteNode("route-search", "search", 1, 0),
    createRouteNode("route-cache", "cache", 1, 1),
  ];
  const world = new ExpeditionWorldSystem();
  world.startRun(routes, { seed: 9911 });
  const event = world.getState().locations.find((location) => location.kind === "world-event");
  assert.ok(event);
  const mutableEvent = world.getLocation(event.id);
  mutableEvent.type = "recon-beacon";
  mutableEvent.effect = { threatDelta: -5, revealBoost: 1 };
  world.updatePlayerPosition(event.x, event.y);
  const cellsBefore = world.revealedCells.size;

  const consumed = world.consumeWorldEvent(event.id);
  assert.equal(consumed.success, true);
  assert.equal(consumed.reveal.applied, true);
  assert.equal(consumed.reveal.radius, world.revealRadius * 2);
  assert.ok(consumed.reveal.revealedCells > 0);
  assert.ok(world.revealedCells.size > cellsBefore);
});

test("活动中的搜索读条可保存并从原进度继续", () => {
  const source = new ExpeditionRunSystem({ seed: 20260721 });
  enterFirstSearch(source, { seed: 20260721 });
  source.beginSearch("quick", { containerId: "resume-crate", isLastContainer: true });
  source.updateSearch(1250);
  const snapshot = JSON.parse(JSON.stringify(source.getRunSaveData()));

  const restored = new ExpeditionRunSystem({ seed: 1 });
  assert.equal(restored.loadRunSaveData(snapshot).success, true);
  assert.equal(restored.getState().searchState.elapsedMs, 1250);
  assert.equal(restored.getState().searchState.remainingMs, 1750);
  const completed = restored.updateSearch(1750);
  assert.equal(completed.success, true);
  assert.equal(completed.completed, true);
  assert.equal(restored.getState().phase, "route");
});
