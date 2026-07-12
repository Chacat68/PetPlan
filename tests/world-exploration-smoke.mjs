import assert from "node:assert/strict";
import test from "node:test";

import { CameraSystem } from "../js/modules/camera-system.js";
import { ExpeditionWorldSystem } from "../js/modules/expedition-world-system.js";

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
  assert.equal(world.trackLocation("route-combat").success, true);
  assert.equal(world.getState(world.spawnPoint).navigationTarget.id, location.id);
  assert.equal(
    world.findNearbyLocation(world.spawnPoint.x, world.spawnPoint.y),
    null,
    "出生点不能隔空交互远处 POI",
  );

  const nearby = world.updatePlayerPosition(location.x, location.y);
  assert.equal(nearby?.id, location.id);
  assert.equal(world.getLocation(location.id).discovered, true, "进入发现范围后 POI 应显形");

  const engaged = world.engageLocation("route-combat");
  assert.equal(engaged.success, true);
  assert.equal(world.getLocation(location.id).state, "engaged");
  assert.equal(
    world.getLocationByNodeId("route-search").state,
    "missed",
    "同深度另一分支应在地点交互后失效",
  );
  assert.equal(world.engageLocation("route-combat").success, false, "POI 不得重复交互");
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
  assert.equal(world.getLocation(alternateLocation.id).known, true, "主动追踪后才显示目标情报");
  world.updatePlayerPosition(farObstacle.x, farObstacle.y);
  assert.equal(world.isAreaRevealed(farObstacle), true, "走到远端后应揭开对应小地图格");
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
  assert.equal(combat.trackLocation(combatNode.id).success, true);
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
  assert.equal(combat.worldSystem.getLocation(location.id).state, "cleared");
});
