import assert from "node:assert/strict";
import test from "node:test";

import { CameraSystem } from "../js/modules/camera-system.js";
import { ExpeditionWorldSystem } from "../js/modules/expedition-world-system.js";
import { getPlayerVisualBounds } from "../js/modules/player-system.js";

globalThis.Image = class ImageStub {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    this.onload = null;
    this.onerror = null;
  }

  set src(value) {
    this._src = value;
  }

  get src() {
    return this._src;
  }
};

const { CombatSystem } = await import("../js/modules/combat-system.js");

const fixedRandom = () => 0.5;

function assertClose(actual, expected, tolerance = 1e-7, message = "数值不在允许误差内") {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: ${actual} !== ${expected}`,
  );
}

function createRouteNode(id, type, depth, branch) {
  return {
    id,
    type,
    depth,
    branch,
    name: `${type}-${branch}`,
    description: `${type} location`,
    icon: "◇",
    danger: "测试",
  };
}

function createCombatHarness() {
  const playerSystem = {
    player: {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      level: 1,
      hp: 100,
      maxHp: 100,
      attack: 24,
      defense: 2,
      attackSpeed: 1,
      crit: 0,
      critDamage: 150,
      multiShot: 1,
    },
    playAttackAnimation() {},
    getGunMuzzlePosition() {
      return {
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
      };
    },
    addExperience() {},
  };

  const combat = new CombatSystem({
    random: fixedRandom,
    runOptions: { maxDepth: 4, minExtractionDepth: 1 },
  });
  combat.setPlayerSystem(playerSystem);
  combat.setResourceSystem({ addCoins() {}, addCrystals() {} });
  combat.setTerritorySystem({
    calculateBonuses() {
      return { attack: 0, defense: 0, expBonus: 0 };
    },
  });
  const petSystem = {
    equippedPets: [],
    battleResetCount: 0,
    getTemplate() { return null; },
    resetBattleStates() { this.battleResetCount += 1; },
  };
  combat.setPetSystem(petSystem);
  combat.setViewportSize(600, 400);
  combat.resetBattle();
  combat.isPaused = false;

  return { combat, playerSystem, petSystem };
}

test("CameraSystem 坐标往返、世界边界和视口 resize 保持一致", () => {
  const camera = new CameraSystem({
    worldWidth: 3000,
    worldHeight: 1900,
    viewportWidth: 600,
    viewportHeight: 400,
    smoothing: 1,
  });

  camera.snapTo(1500, 900);
  assert.deepEqual(camera.getState(), {
    x: 1200,
    y: 700,
    width: 600,
    height: 400,
    worldWidth: 3000,
    worldHeight: 1900,
  });

  const worldPoint = { x: 1675.5, y: 1042.25 };
  const screenPoint = camera.worldToScreen(worldPoint.x, worldPoint.y);
  const roundTrip = camera.screenToWorld(screenPoint.x, screenPoint.y);
  assertClose(roundTrip.x, worldPoint.x);
  assertClose(roundTrip.y, worldPoint.y);

  camera.snapTo(-100, -100);
  assert.deepEqual(
    { x: camera.getState().x, y: camera.getState().y },
    { x: 0, y: 0 },
    "相机不能越过世界左上边界",
  );

  camera.snapTo(5000, 5000);
  assert.deepEqual(
    { x: camera.getState().x, y: camera.getState().y },
    { x: 2400, y: 1500 },
    "相机不能越过世界右下边界",
  );

  camera.setViewportSize(1000, 800);
  assert.deepEqual(
    camera.getState(),
    {
      x: 2000,
      y: 1100,
      width: 1000,
      height: 800,
      worldWidth: 3000,
      worldHeight: 1900,
    },
    "resize 只能改变视口及其边界，不能改变世界尺寸",
  );

  camera.setViewportSize(4000, 2500);
  assert.deepEqual(
    { x: camera.getState().x, y: camera.getState().y },
    { x: 0, y: 0 },
    "视口大于世界时相机应固定在原点",
  );
});

test("世界移动限制边界，斜向输入等速，障碍碰撞允许沿墙滑动", () => {
  const world = new ExpeditionWorldSystem();
  const boundaryActor = { x: 18, y: 18, width: 40, height: 40 };
  world.moveEntity(boundaryActor, -200, -200);
  assert.deepEqual(
    { x: boundaryActor.x, y: boundaryActor.y },
    { x: 18, y: 18 },
    "角色不能离开世界边界",
  );

  const slidingActor = { x: 360, y: 850, width: 40, height: 40 };
  const slide = world.moveEntity(slidingActor, 80, 30);
  assert.equal(slide.blockedX, true, "朝废墟的横向位移应被阻挡");
  assert.equal(slide.blockedY, false, "未被阻挡的纵向位移应继续执行");
  assert.deepEqual(
    { x: slidingActor.x, y: slidingActor.y },
    { x: 360, y: 880 },
    "碰撞后应沿障碍边缘滑动",
  );

  const { combat, playerSystem } = createCombatHarness();
  assert.equal(combat.startRun().success, true);
  const start = { x: playerSystem.player.x, y: playerSystem.player.y };

  combat.setMovementInput(1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  const cardinalDistance = Math.hypot(
    playerSystem.player.x - start.x,
    playerSystem.player.y - start.y,
  );

  playerSystem.player.x = start.x;
  playerSystem.player.y = start.y;
  const diagonalInput = combat.setMovementInput(1, 1);
  assertClose(Math.hypot(diagonalInput.x, diagonalInput.y), 1);
  combat.updateHeroMovement(playerSystem.player, 100);
  const diagonalDistance = Math.hypot(
    playerSystem.player.x - start.x,
    playerSystem.player.y - start.y,
  );
  assertClose(diagonalDistance, cardinalDistance, 1e-7, "斜向移动不能比单轴移动更快");
});

test("角色撞到世界四边时完整贴图仍保留在画面内", () => {
  const viewports = [
    [750, 900],
    [1280, 720],
    [390, 844],
    [1600, 500],
    [500, 1600],
  ];
  const directions = [
    { name: "left", x: 18, y: 760, inputX: -1, inputY: 0 },
    { name: "right", x: 2942, y: 760, inputX: 1, inputY: 0 },
    { name: "top", x: 120, y: 18, inputX: 0, inputY: -1 },
    { name: "bottom", x: 120, y: 1842, inputX: 0, inputY: 1 },
  ];

  viewports.forEach(([width, height]) => {
    const { combat, playerSystem } = createCombatHarness();
    assert.equal(combat.startRun().success, true);
    combat.worldSystem.obstacles = [];
    combat.setViewportSize(width, height);

    directions.forEach((direction) => {
      const hero = playerSystem.player;
      hero.x = direction.x;
      hero.y = direction.y;
      combat.setMovementInput(direction.inputX, direction.inputY);
      combat.updateHeroMovement(hero, 100);
      combat.clearMovementInput();

      const center = combat.getHeroCenter();
      combat.cameraSystem.snapTo(center.x, center.y);
      const camera = combat.cameraSystem.getState();
      const visual = getPlayerVisualBounds(hero);
      const screenBounds = {
        left: visual.left - camera.x,
        top: visual.top - camera.y,
        right: visual.right - camera.x,
        bottom: visual.bottom - camera.y,
      };
      const label = `${direction.name} @ ${width}x${height}`;

      assert.ok(screenBounds.left >= -1e-7, `${label}: 角色左侧越出画面 ${screenBounds.left}`);
      assert.ok(screenBounds.top >= -1e-7, `${label}: 角色顶部越出画面 ${screenBounds.top}`);
      assert.ok(screenBounds.right <= width + 1e-7, `${label}: 角色右侧越出画面 ${screenBounds.right}`);
      assert.ok(screenBounds.bottom <= height + 1e-7, `${label}: 角色底部越出画面 ${screenBounds.bottom}`);
    });
  });
});

test("调整视口不会传送世界边界内的角色", () => {
  const { combat, playerSystem } = createCombatHarness();
  assert.equal(combat.startRun().success, true);
  const hero = playerSystem.player;
  hero.x = 72;
  hero.y = 84;
  combat.worldSystem.obstacles = [
    { id: "legacy-overlap", x: 70, y: 80, width: 80, height: 80, type: "ruin" },
  ];

  combat.setViewportSize(390, 844);

  assert.deepEqual(
    { x: hero.x, y: hero.y },
    { x: 72, y: 84 },
    "视口变化只能修复世界越界坐标，不能把合法位置传送回营地",
  );
});

test("每个确定性种子都保留出生点东向出口和通往地图东侧的可行通道", () => {
  const seeds = [1, 2, 7, 42, 99, 1234, 2468, 7788, 9876, 20260721, 0xffffffff];
  seeds.forEach((seed) => {
    const world = new ExpeditionWorldSystem();
    world.startRun([], { seed });
    assert.equal(
      world.hasNavigableChannelToEast(),
      true,
      `种子 ${seed} 必须能从出生点抵达地图东侧`,
    );

    const actor = {
      x: world.spawnPoint.x - 20,
      y: world.spawnPoint.y - 20,
      width: 40,
      height: 40,
    };
    const startX = actor.x;
    const egress = world.moveEntity(actor, 360, 0);
    assert.equal(egress.blockedX, false, `种子 ${seed} 的西侧废墟不能直接封住首段东向出口`);
    assert.ok(actor.x >= startX + 350, `种子 ${seed} 应保留清晰的首屏东向移动距离`);
  });

  const first = new ExpeditionWorldSystem();
  const second = new ExpeditionWorldSystem();
  first.startRun([], { seed: 424242 });
  second.startRun([], { seed: 424242 });
  assert.deepEqual(first.obstacles, second.obstacles, "通道修正不能破坏相同种子的确定性");
});

test("POI 可追踪、进入发现范围并只允许近距离交互", () => {
  const world = new ExpeditionWorldSystem();
  const routes = [
    createRouteNode("route-search", "search", 1, 0),
    createRouteNode("route-combat", "combat", 1, 1),
  ];
  world.startRun(routes);

  const location = world.getLocationByNodeId("route-combat");
  assert.ok(location, "路线节点应映射为世界 POI");
  assert.equal(location.discovered, false, "远处 POI 初始不应被发现");
  const tracked = world.trackLocation("route-combat");
  assert.equal(tracked.success, true);
  assert.equal(tracked.navigationTargetId, location.id);
  assert.equal(tracked.navigationTarget.id, location.id);
  assert.equal(tracked.location.id, location.id);
  assert.equal(tracked.navigationTarget.name, "未知信号", "追踪返回值不能提前泄露未知地点名称");
  assert.equal(tracked.navigationTarget.known, false);
  const trackedState = world.getState(world.spawnPoint).navigationTarget;
  assert.equal(trackedState.id, location.id);
  assert.equal(trackedState.name, "未知信号");
  assert.equal(trackedState.known, false, "追踪不能把未知地点提前标记为已知");
  assert.equal(
    world.findNearbyLocation(world.spawnPoint.x, world.spawnPoint.y)?.id,
    "extraction-beacon",
    "出生点只应就近发现开局可用的入口撤离，不能隔空交互远处 POI",
  );

  const nearby = world.updatePlayerPosition(location.x, location.y);
  assert.equal(nearby?.id, location.id);
  assert.equal(world.getLocation(location.id).discovered, true, "进入发现范围后 POI 应显形");
  assert.equal(world.getState(location).navigationTarget.name, location.name, "发现后导航应恢复真实地点名称");

  const engaged = world.engageLocation("route-combat");
  assert.equal(engaged.success, true);
  assert.equal(world.getLocation(location.id).state, "engaged");
  assert.equal(
    world.getLocationByNodeId("route-search").state,
    "available",
    "进入一个热点不得让同深度的其他热点失效",
  );
  assert.equal(world.engageLocation("route-combat").success, false, "行动进行中不能重复触发");
  const disengaged = world.disengageActiveLocation("route-combat");
  assert.equal(disengaged.success, true);
  assert.equal(world.getLocation(location.id).state, "available", "脱战地点必须重新进入近距交互集合");
  assert.equal(world.activeLocationId, null);
  assert.equal(world.engageLocation("route-combat").success, true, "脱战后可重返同一地点");
  world.completeActiveLocation();
  assert.equal(world.getLocation(location.id).state, "visited");
  assert.equal(world.engageLocation("route-combat").revisited, true, "完成后的 POI 仍可回访");
});

test("迷雾只揭开走过的地图格，未发现地形不会提前暴露", () => {
  const world = new ExpeditionWorldSystem();
  const routes = [
    createRouteNode("route-search", "search", 1, 0),
    createRouteNode("route-combat", "combat", 1, 1),
  ];
  world.startRun(routes);

  const farObstacle = world.obstacles.find((obstacle) => obstacle.id === "ruin-final");
  const alternateLocation = world.getLocationByNodeId("route-combat");
  assert.ok(farObstacle && alternateLocation);
  assert.equal(world.isAreaRevealed(farObstacle), false, "远端障碍不应在出生时揭开");
  assert.equal(alternateLocation.known, false, "未追踪的远端 POI 不应提前标记为已知");

  assert.equal(world.trackLocation(alternateLocation.id).success, true);
  assert.equal(world.getLocation(alternateLocation.id).known, false, "追踪只提供方向，不应直接泄露地点情报");
  world.updatePlayerPosition(alternateLocation.x, alternateLocation.y);
  assert.equal(world.getLocation(alternateLocation.id).known, true, "接近地点后才显示完整情报");
  world.updatePlayerPosition(farObstacle.x, farObstacle.y);
  assert.equal(world.isAreaRevealed(farObstacle), true, "走到远端后应揭开对应小地图格");
});

test("远征世界按种子稳定变化，并包含可发现的一次性支线事件", () => {
  const routes = [
    createRouteNode("seed-search", "search", 1, 0),
    createRouteNode("seed-combat", "combat", 1, 1),
  ];
  const first = new ExpeditionWorldSystem();
  const second = new ExpeditionWorldSystem();
  const third = new ExpeditionWorldSystem();
  first.startRun(routes, { seed: 1234 });
  second.startRun(routes, { seed: 1234 });
  third.startRun(routes, { seed: 9876 });

  const firstRoute = first.getLocationByNodeId("seed-search");
  const secondRoute = second.getLocationByNodeId("seed-search");
  const thirdRoute = third.getLocationByNodeId("seed-search");
  assert.deepEqual(
    { x: firstRoute.x, y: firstRoute.y },
    { x: secondRoute.x, y: secondRoute.y },
    "相同种子必须生成相同地点布局",
  );
  assert.notDeepEqual(
    { x: firstRoute.x, y: firstRoute.y },
    { x: thirdRoute.x, y: thirdRoute.y },
    "不同种子应改变地点布局",
  );

  const event = first.getState(first.spawnPoint).locations.find((location) => location.kind === "world-event");
  assert.ok(event, "每局应生成可选的支线探索事件");
  first.updatePlayerPosition(event.x, event.y);
  assert.equal(first.findNearbyLocation(event.x, event.y)?.id, event.id);
  const consumed = first.consumeWorldEvent(event.id);
  assert.equal(consumed.success, true);
  assert.ok(consumed.effect && typeof consumed.effect === "object");
  assert.equal(first.consumeWorldEvent(event.id).success, false, "支线事件只能结算一次");
});

test("每局最多生成一个免费安全袋，且启用安全袋会真实提高威胁", () => {
  let foundInsuredStash = false;
  for (let seed = 1; seed <= 80; seed += 1) {
    const world = new ExpeditionWorldSystem();
    world.startRun([], { seed });
    const stashes = world.getState(world.spawnPoint).locations.filter((location) => (
      location.kind === "world-event" && location.type === "insured-stash"
    ));
    assert.ok(stashes.length <= 1, `种子 ${seed} 不能生成多个免费安全袋`);
    if (stashes.length === 0) continue;
    foundInsuredStash = true;
    assert.equal(stashes[0].effect.insurance, 1);
    assert.equal(stashes[0].effect.threatDelta, 5, "安全袋应以定位脉冲提高威胁作为一次性风险");
  }
  assert.equal(foundInsuredStash, true, "测试种子集合应覆盖至少一个安全袋事件");
});

test("远征世界快照可恢复迷雾、地点和支线进度", () => {
  const routes = [
    createRouteNode("save-search", "search", 1, 0),
    createRouteNode("save-combat", "combat", 1, 1),
  ];
  const world = new ExpeditionWorldSystem();
  world.startRun(routes, { seed: 2468 });
  const event = world.getState(world.spawnPoint).locations.find((location) => location.kind === "world-event");
  world.updatePlayerPosition(event.x, event.y);
  world.consumeWorldEvent(event.id);
  const snapshot = world.getRunSaveData();
  const discoveredEvent = snapshot.locations.find((location) => location.id === event.id);
  const unknownRoute = snapshot.locations.find((location) => location.kind === "route" && !location.discovered);
  delete discoveredEvent.known;
  if (unknownRoute) delete unknownRoute.known;
  const westRuin = snapshot.obstacles.find((obstacle) => obstacle.id === "ruin-west");
  westRuin.y = world.spawnPoint.y - Math.floor(westRuin.height / 2);

  const restored = new ExpeditionWorldSystem();
  assert.equal(restored.loadRunSaveData(snapshot).success, true);
  assert.equal(restored.runSeed, 2468);
  assert.equal(restored.getLocation(event.id).state, "cleared");
  assert.equal(restored.getLocation(event.id).known, true, "旧存档中已发现地点应恢复为已知");
  if (unknownRoute) {
    assert.equal(restored.getLocation(unknownRoute.id).known, false, "旧存档中的未知地点不能被提前揭示");
  }
  assert.equal(restored.consumedWorldEvents, 1);
  assert.deepEqual(restored.getState(event).revealedCells, snapshot.revealedCells);
  assert.equal(restored.hasNavigableChannelToEast(), true, "旧存档障碍也应执行出生通道兼容修正");
  assert.equal(
    restored.obstacles.find((obstacle) => obstacle.id === "ruin-west").y,
    westRuin.y,
    "仍有可行通路的旧存档应保持原有障碍布局",
  );
});

test("撤离只能在信标近距启动，离开撤离圈时倒计时暂停", () => {
  const { combat, playerSystem } = createCombatHarness();
  assert.equal(combat.startRun().success, true);

  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  combat.runSystem.phase = "route";
  combat.syncWorldWithRunState();

  playerSystem.player.x = combat.worldSystem.width - 180;
  playerSystem.player.y = 80;
  combat.updateWorldAwareness();
  assert.equal(combat.requestExtraction().success, false, "远离信标时不能隔空撤离");

  const beacon = combat.worldSystem.getLocation("extraction-beacon");
  playerSystem.player.x = beacon.x + beacon.radius + combat.worldSystem.interactionRadius - 1
    - playerSystem.player.width / 2;
  playerSystem.player.y = beacon.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();
  const extraction = combat.requestExtraction();
  assert.equal(extraction.success, true);
  assert.equal(
    combat.getBattleState().extraction.inZone,
    true,
    "可交互范围的边缘也必须计入有效撤离圈",
  );

  combat.extractionTimer = 1000;
  combat.update(100);
  assert.equal(combat.extractionTimer, 900, "位于信标圈内时撤离倒计时应推进");

  playerSystem.player.x = beacon.x + beacon.radius + 180;
  playerSystem.player.y = beacon.y;
  combat.updateWorldAwareness();
  assert.equal(combat.getBattleState().extraction.inZone, false);
  combat.update(100);
  assert.equal(combat.extractionTimer, 900, "离开信标圈后撤离倒计时应暂停");
});

test("新一局会重置宠物战斗坐标，最终阶段自动追踪入口信标", () => {
  const { combat, petSystem } = createCombatHarness();
  const resetsBeforeStart = petSystem.battleResetCount;
  assert.equal(combat.startRun().success, true);
  assert.equal(
    petSystem.battleResetCount,
    resetsBeforeStart + 1,
    "开始新一局时必须清空上一局宠物战斗状态",
  );

  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  combat.runSystem.phase = "extraction-ready";
  combat.syncWorldWithRunState();
  const state = combat.getBattleState();
  assert.equal(state.world.navigationTarget?.id, "extraction-beacon");
  assert.equal(state.actions.canTrackMap, true, "最终阶段应保留地图追踪面板");
});

test("非零相机偏移下，屏幕坐标仍能锁定世界中的正确敌人", () => {
  const { combat, playerSystem } = createCombatHarness();
  combat.runSystem.active = true;
  combat.runSystem.phase = "combat";
  combat.worldSystem.startRun([]);
  playerSystem.player.x = 1450;
  playerSystem.player.y = 850;
  combat.cameraSystem.snapTo(1470, 870);

  const monster = {
    id: 77,
    name: "坐标测试怪物",
    x: 1600,
    y: 900,
    width: 40,
    height: 40,
    hp: 100,
    maxHp: 100,
  };
  combat.monsters = [monster];
  const camera = combat.cameraSystem.getState();
  assert.ok(camera.x > 0 && camera.y > 0, "测试必须在非零相机偏移下运行");

  const targetCenter = combat.getEntityCenter(monster);
  const screen = combat.cameraSystem.worldToScreen(targetCenter.x, targetCenter.y);
  const result = combat.selectTargetAt(screen.x, screen.y);
  assert.equal(result.success, true);
  assert.equal(combat.focusTargetId, monster.id);
  assert.deepEqual(combat.screenToWorld(screen.x, screen.y), targetCenter);
});

test("从地图 POI 开战并完成战斗时，玩家世界坐标不会被传送", () => {
  const { combat, playerSystem } = createCombatHarness();
  assert.equal(combat.startRun().success, true);

  const combatNode = combat
    .getBattleState()
    .routeChoices.find((node) => node.type === "combat");
  assert.ok(combatNode, "首层路线应提供战斗 POI");
  const location = combat.worldSystem.getLocationByNodeId(combatNode.id);
  assert.ok(location);
  const trackedCombatNode = combat.trackLocation(combatNode.id);
  assert.equal(trackedCombatNode.success, true);
  assert.match(trackedCombatNode.message, /东|南|西|北/);
  assert.doesNotMatch(trackedCombatNode.message, /\d+\s*(?:米|m)/i, "导航应使用方位与区域，不泄露精确距离");
  assert.doesNotMatch(combat.getInteractionState().detail, /\d+\s*(?:米|m)/i);
  playerSystem.player.x = 80;
  playerSystem.player.y = 80;
  combat.updateWorldAwareness();
  assert.equal(
    combat.interactWithNearbyLocation().success,
    false,
    "未到达 POI 前不能触发战斗",
  );

  playerSystem.player.x = location.x - playerSystem.player.width / 2;
  playerSystem.player.y = location.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();
  assert.equal(combat.worldSystem.getLocation(location.id).discovered, true);
  assert.equal(combat.getInteractionState().available, true);

  const positionBeforeCombat = {
    x: playerSystem.player.x,
    y: playerSystem.player.y,
  };
  const interaction = combat.interactWithNearbyLocation();
  assert.equal(interaction.success, true);
  assert.equal(combat.getBattleState().phase, "combat");
  assert.deepEqual(
    { x: playerSystem.player.x, y: playerSystem.player.y },
    positionBeforeCombat,
    "开始遭遇时不得传送玩家",
  );

  combat.monsters = [];
  combat.encounterQueue = [];
  combat.encounterRewards = { coins: 0, crystals: 0, exp: 0, kills: 0 };
  const completed = combat.finishEncounter();
  assert.equal(completed.success, true);
  assert.equal(combat.getBattleState().phase, "route");
  assert.deepEqual(
    { x: playerSystem.player.x, y: playerSystem.player.y },
    positionBeforeCombat,
    "完成遭遇后不得将玩家传回营地",
  );
  assert.equal(combat.worldSystem.getLocation(location.id).state, "visited");
});
