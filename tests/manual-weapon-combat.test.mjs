import assert from "node:assert/strict";
import test from "node:test";

globalThis.Image = class ImageStub {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }
  set src(value) { this._src = value; }
  get src() { return this._src; }
};

const {
  CombatSystem,
  EXPEDITION_WEAPON_CONFIGS,
} = await import("../js/modules/combat-system.js");

function createHarness({ attack = 20, random = () => 0.5 } = {}) {
  const playerSystem = {
    player: {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      level: 1,
      hp: 100,
      maxHp: 100,
      hpRegen: 0,
      attack,
      defense: 0,
      attackSpeed: 1,
      crit: 0,
      critDamage: 150,
      multiShot: 1,
    },
    playAttackAnimation() {},
    setCombatState() {},
    getGunMuzzlePosition() {
      return {
        x: this.player.x + this.player.width / 2,
        y: this.player.y + this.player.height / 2,
      };
    },
    addExperience() {},
  };
  const combat = new CombatSystem({
    random,
    runOptions: { maxDepth: 4, minExtractionDepth: 1 },
  });
  combat.setPlayerSystem(playerSystem);
  combat.setTerritorySystem({
    calculateBonuses() { return { attack: 0, defense: 0, expBonus: 0 }; },
  });
  combat.setResourceSystem({ addCoins() {}, addCrystals() {}, addRubies() {} });
  combat.setPetSystem({
    equippedPets: [],
    resetBattleStates() {},
    applyExpeditionBond() { return { totalGain: 0, pets: [] }; },
  });
  combat.resetBattle();
  combat.isPaused = false;
  assert.equal(combat.startRun().success, true);
  combat.runSystem.phase = "combat";
  combat.currentEncounter = { type: "combat", depth: 1 };
  combat.worldSystem.obstacles = [];
  return { combat, playerSystem };
}

function addMonster(combat, { x, y, hp = 100 } = {}) {
  const hero = combat.getHeroCenter();
  const monster = {
    id: combat.nextMonsterId++,
    x: x ?? hero.x + 120,
    y: y ?? hero.y - 15,
    width: 30,
    height: 30,
    hp,
    maxHp: hp,
    coinReward: 0,
    crystalReward: 0,
    expReward: 0,
    rewardGranted: false,
  };
  combat.monsters.push(monster);
  return monster;
}

test("三类武器具有独立弹匣、射速、散布、射程与移动惩罚", () => {
  const { combat } = createHarness();
  const configs = Object.values(EXPEDITION_WEAPON_CONFIGS);
  assert.deepEqual(configs.map(item => item.category), ["rifle", "shotgun", "marksman"]);
  assert.equal(new Set(configs.map(item => item.magazineSize)).size, 3);
  assert.equal(new Set(configs.map(item => item.fireIntervalMs)).size, 3);
  assert.equal(new Set(configs.map(item => item.range)).size, 3);
  configs.forEach(config => {
    assert.ok(config.reserveAmmo > 0);
    assert.ok(config.reloadMs > 0);
    assert.ok(config.movingSpreadDegrees > config.spreadDegrees);
    assert.ok(config.movingDamageMultiplier < 1);
    assert.ok(config.movingFireIntervalMultiplier > 1);
  });
  assert.equal(combat.getWeaponState().manualAim, true);
  assert.equal(combat.getWeaponState().legacyAutoAim, false);
});

test("按住开火沿指定方向发射固定弹道，子弹可打空且不会追踪目标", () => {
  const { combat } = createHarness();
  const hero = combat.getHeroCenter();
  const monster = addMonster(combat, { x: hero.x + 150, y: hero.y - 15 });
  assert.equal(combat.setAimDirection(1, 0).success, true);
  combat.startFiring();
  combat.updateAttack(1);
  combat.stopFiring();

  assert.equal(combat.bullets.length, 1);
  const bullet = combat.bullets[0];
  assert.equal(bullet.targetId, null);
  const initialVx = bullet.vx;
  monster.y += 140;
  combat.updateBullets(1000);
  assert.equal(bullet.vx, initialVx, "目标移动不能改变子弹方向");
  assert.equal(monster.hp, monster.maxHp, "玩家瞄偏后子弹应允许打空");
  assert.equal(combat.bullets.length, 0, "子弹飞满射程后应销毁");
});

test("世界坐标瞄准可命中弹道上的敌人并消耗弹匣", () => {
  const { combat } = createHarness();
  const hero = combat.getHeroCenter();
  const monster = addMonster(combat, { x: hero.x + 110, y: hero.y - 15 });
  const rifleBefore = combat.getWeaponState().active.magazine;
  assert.equal(combat.setAimWorldPosition(hero.x + 300, hero.y).success, true);
  const shot = combat.fireCurrentWeapon();
  assert.equal(shot.success, true);
  assert.equal(combat.getWeaponState().active.magazine, rifleBefore - 1);
  combat.updateBullets(200);
  assert.ok(monster.hp < monster.maxHp);
});

test("武器切换与手动换弹保留各自弹药状态", () => {
  const { combat } = createHarness();
  assert.equal(combat.switchWeapon("shotgun").success, true);
  const shotgun = combat.weaponStates.shotgun;
  shotgun.magazine = 0;
  shotgun.reserve = 4;
  const reload = combat.reloadWeapon();
  assert.equal(reload.success, true);
  combat.updateWeaponTimers(EXPEDITION_WEAPON_CONFIGS.shotgun.reloadMs - 1);
  assert.equal(shotgun.magazine, 0);
  combat.updateWeaponTimers(1);
  assert.equal(shotgun.magazine, 4);
  assert.equal(shotgun.reserve, 0);
  assert.equal(combat.switchWeapon(2).weapon.id, "marksman");
  assert.equal(combat.switchWeapon("missing").success, false);
});

test("切枪保留各武器独立射击冷却并施加换枪锁，不能绕过精确枪射速", () => {
  const { combat } = createHarness();
  assert.equal(combat.switchWeapon("marksman").success, true);
  assert.equal(combat.getWeaponState().swapLockRemainingMs, combat.config.weaponSwapLockMs);
  assert.equal(combat.fireCurrentWeapon().code, "swapping");
  combat.updateWeaponTimers(combat.config.weaponSwapLockMs);

  const first = combat.fireCurrentWeapon();
  assert.equal(first.success, true);
  const marksmanCooldown = combat.weaponStates.marksman.shotCooldownRemainingMs;
  assert.equal(marksmanCooldown, EXPEDITION_WEAPON_CONFIGS.marksman.fireIntervalMs);

  assert.equal(combat.switchWeapon("rifle").success, true);
  assert.equal(
    combat.weaponStates.marksman.shotCooldownRemainingMs,
    marksmanCooldown,
    "切走不能清除精确枪自身冷却"
  );
  combat.updateWeaponTimers(combat.config.weaponSwapLockMs);
  assert.equal(combat.fireCurrentWeapon().success, true, "换枪锁结束后步枪可以开火");

  assert.equal(combat.switchWeapon("marksman").success, true);
  combat.updateWeaponTimers(combat.config.weaponSwapLockMs);
  const tooSoon = combat.fireCurrentWeapon();
  assert.equal(tooSoon.success, false);
  assert.equal(tooSoon.code, "cooldown", "来回切枪后仍须等满精确枪的真实射击间隔");
  combat.updateWeaponTimers(tooSoon.remainingMs);
  assert.equal(combat.fireCurrentWeapon().success, true);
});

test("切走正在换弹的武器会取消换弹，非当前武器不会后台装填", () => {
  const { combat } = createHarness();
  combat.switchWeapon("shotgun");
  combat.updateWeaponTimers(combat.config.weaponSwapLockMs);
  const shotgun = combat.weaponStates.shotgun;
  shotgun.magazine = 0;
  shotgun.reserve = 4;
  assert.equal(combat.reloadWeapon().success, true);
  combat.updateWeaponTimers(600);
  assert.ok(shotgun.reloadRemainingMs > 0);

  const switched = combat.switchWeapon("rifle");
  assert.equal(switched.cancelledReload, true);
  assert.equal(shotgun.reloadRemainingMs, 0);
  assert.equal(shotgun.magazine, 0);
  assert.equal(shotgun.reserve, 4, "取消换弹不能提前扣除备用弹药");
  combat.updateWeaponTimers(5000);
  assert.equal(shotgun.magazine, 0, "非当前武器等待再久也不能后台完成换弹");
  assert.equal(combat.reloadWeapon("shotgun").success, false, "不能直接给非当前武器换弹");
});

test("远程敌人改为可见弹丸，玩家侧移可闪避且障碍能截停", () => {
  const { combat, playerSystem } = createHarness();
  const hero = combat.getHeroCenter();
  const ranged = combat.spawnMonster({ templateId: "bat", depth: 1 }, 1);
  ranged.x = hero.x + 210;
  ranged.y = hero.y - ranged.height / 2;
  ranged.attackCooldown = 0;
  const hpBefore = combat.runHp;
  combat.updateMonsters(1);
  assert.equal(combat.runHp, hpBefore, "远程攻击触发时不能立即扣血");
  assert.equal(combat.bullets.some(bullet => bullet.source === "enemy"), true);

  playerSystem.player.y += 150;
  combat.updateBullets(1000);
  assert.equal(combat.runHp, hpBefore, "离开原瞄准线后应躲过敌方弹丸");

  playerSystem.player.y -= 150;
  const blocked = combat.fireEnemyBullet(ranged, combat.getHeroCenter());
  assert.ok(blocked);
  const middleX = (blocked.x + combat.getHeroCenter().x) / 2;
  combat.worldSystem.obstacles = [{ x: middleX - 12, y: hero.y - 35, width: 24, height: 70 }];
  combat.updateBullets(1000);
  assert.equal(combat.runHp, hpBefore, "后置掩体应在飞行中截停敌方弹丸");
  assert.equal(combat.bullets.some(bullet => bullet.id === blocked.id), false);
});

test("敌人命中盒覆盖约四分之三可见贴图，Boss 躯干外缘不再出现视觉命中却判空", () => {
  const { combat } = createHarness();
  const hero = combat.getHeroCenter();
  const normal = addMonster(combat, { x: hero.x + 100, y: hero.y - 15 });
  const normalHitbox = combat.getMonsterHitbox(normal);
  assert.ok(Math.abs(normalHitbox.width - normal.width * 1.58 * 0.75) < 0.001);

  const boss = addMonster(combat, { x: hero.x + 260, y: hero.y - 32, hp: 500 });
  boss.isBoss = true;
  boss.width = 64;
  boss.height = 64;
  const hitbox = combat.getMonsterHitbox(boss);
  assert.ok(Math.abs(hitbox.width - 64 * 2.05 * 0.75) < 0.001);
  assert.ok(hitbox.width > boss.width, "Boss 命中盒应覆盖放大后可见躯干，而非停留在原逻辑尺寸");

  combat.monsters = [boss];
  const center = combat.getEntityCenter(boss);
  const visualTorsoEdgeY = center.y + hitbox.height * 0.45;
  const hit = combat.findProjectileMonsterHit(
    { x: center.x - 100, y: visualTorsoEdgeY },
    { x: center.x + 100, y: visualTorsoEdgeY },
    0
  );
  assert.equal(hit, boss);
});

test("Boss 危险区固定显示 150 半径，实际伤害严格限制在 145 半径内", () => {
  const inside = createHarness();
  const geometry = inside.combat.getBossAreaAttackGeometry();
  assert.deepEqual(geometry, { damageRadius: 145, warningRadius: 150 });

  const triggerAreaAttack = ({ combat, playerSystem }, distance) => {
    const target = { x: 1000, y: 800 };
    playerSystem.player.x = target.x + distance - playerSystem.player.width / 2;
    playerSystem.player.y = target.y - playerSystem.player.height / 2;
    const boss = combat.spawnMonster({ templateId: "dragon", boss: true, depth: 1 }, 1);
    combat.monsters = [boss];
    boss.attack = 20;
    boss.bossTarget = target;
    boss.bossTelegraphTimer = 1;
    const hpBefore = combat.runHp;
    combat.updateMonsters(1);
    return { hpBefore, hpAfter: combat.runHp };
  };

  const innerResult = triggerAreaAttack(inside, 144);
  assert.ok(innerResult.hpAfter < innerResult.hpBefore, "145 半径内应受到伤害");
  const outside = createHarness();
  const outerResult = triggerAreaAttack(outside, 146);
  assert.equal(outerResult.hpAfter, outerResult.hpBefore, "145 半径外必须安全");

  const boss = outside.combat.monsters[0];
  boss.bossTarget = { x: 400, y: 500 };
  boss.bossTelegraphTimer = 500;
  const arcRadii = [];
  const ctx = {
    save() {}, restore() {}, beginPath() {}, fill() {}, stroke() {}, setLineDash() {},
    fillRect() {}, fillText() {}, drawImage() {},
    arc(_x, _y, radius) { arcRadii.push(radius); },
  };
  outside.combat.renderMonster(ctx, boss);
  assert.ok(arcRadii.includes(150), "渲染外圈必须始终包含固定 150 半径");
});

test("隐蔽先手只强化遭遇中的第一枪", () => {
  const { combat } = createHarness();
  combat.beginEncounter({
    type: "combat",
    depth: 1,
    enemyCount: 1,
    playerAdvantage: { firstStrikeBonus: 0.18 },
  });
  combat.runSystem.phase = "combat";
  combat.setAimDirection(1, 0);
  const baseDamage = combat.getWeaponShotDamage();
  const first = combat.fireCurrentWeapon();
  assert.equal(first.success, true);
  assert.ok(Math.abs(first.projectiles[0].damage - baseDamage * 1.18) < 0.001);
  assert.equal(first.firstStrike, true);

  combat.updateWeaponTimers(combat.getWeaponState().active.shotCooldownRemainingMs);
  const second = combat.fireCurrentWeapon();
  assert.equal(second.success, true);
  assert.ok(Math.abs(second.projectiles[0].damage - baseDamage) < 0.001);
  assert.equal(second.firstStrike, false);
});

test("旧存档高攻击值经过软上限后仍保留早期敌人数发击杀窗口", () => {
  const normal = createHarness({ attack: 20 }).combat;
  const legacyHigh = createHarness({ attack: 130 }).combat;
  const normalDamage = normal.getWeaponShotDamage(EXPEDITION_WEAPON_CONFIGS.rifle);
  const highDamage = legacyHigh.getWeaponShotDamage(EXPEDITION_WEAPON_CONFIGS.rifle);
  assert.ok(highDamage > normalDamage, "永久攻击升级仍应提供成长收益");
  assert.ok(highDamage < 34, "攻击 130 的步枪不能一枪秒杀基础史莱姆");
  assert.ok(highDamage / normalDamage < 1.6, "旧攻击属性不能继续线性放大武器伤害");
  assert.ok(Math.ceil(34 / highDamage) >= 2);
});

test("撤离解锁后只有实际靠近撤离点的移动才累计返程压力", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  assert.equal(combat.runSystem.canExtract(), true);
  combat.worldSystem.obstacles = [];
  const beacon = combat.worldSystem.getLocation("extraction-beacon");
  playerSystem.player.x = beacon.x + 400;
  playerSystem.player.y = beacon.y - playerSystem.player.height / 2;
  const beforeX = playerSystem.player.x;
  combat.setMovementInput(-1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  assert.ok(playerSystem.player.x < beforeX);
  assert.ok(combat.returnPressure.distance > 0);
});

test("待选战利品虽然阻止撤离操作，但不能绕过真实返程移动压力", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  combat.runSystem.pendingLootChoice = { id: "pending-loot", item: { id: "loot" } };
  assert.equal(combat.runSystem.canExtract(), false, "待选物品会临时阻止启动撤离");
  combat.worldSystem.obstacles = [];
  const beacon = combat.worldSystem.getLocation("extraction-beacon");
  playerSystem.player.x = beacon.x + 400;
  playerSystem.player.y = beacon.y - playerSystem.player.height / 2;
  combat.setMovementInput(-1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  assert.ok(combat.returnPressure.distance > 0);
});

test("向地图深区移动且远离所有已解锁撤离点时不累计返程压力", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  combat.worldSystem.obstacles = [];
  const beacon = combat.worldSystem.getLocation("extraction-beacon");
  playerSystem.player.x = beacon.x + 400;
  playerSystem.player.y = beacon.y - playerSystem.player.height / 2;
  combat.setMovementInput(1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  assert.equal(combat.returnPressure.distance, 0);
});

test("活动远征存档可恢复武器弹药、瞄准与飞行中的固定弹丸", () => {
  const { combat } = createHarness();
  combat.switchWeapon("marksman");
  combat.updateWeaponTimers(combat.config.weaponSwapLockMs);
  combat.setAimDirection(0, -1);
  combat.weaponStates.marksman.magazine = 3;
  assert.equal(combat.fireCurrentWeapon().success, true);
  const save = combat.getSaveData();

  const restored = createHarness().combat;
  restored.loadSaveData(save);
  const state = restored.getWeaponState();
  assert.equal(state.activeWeaponId, "marksman");
  assert.equal(state.active.magazine, 2);
  assert.equal(
    state.active.shotCooldownRemainingMs,
    EXPEDITION_WEAPON_CONFIGS.marksman.fireIntervalMs,
    "每武器射击冷却必须随活动局存档恢复"
  );
  assert.ok(Math.abs(state.aimDirection.y + 1) < 0.001);
  assert.equal(restored.bullets.length, 1);
  assert.equal(restored.bullets[0].targetId, null);
});

test("旧存档的共享射击冷却会迁移到当时活动武器", () => {
  const { combat } = createHarness();
  combat.switchWeapon("marksman");
  const save = combat.getSaveData();
  Object.values(save.activeRun.weaponStates).forEach(state => {
    delete state.shotCooldownRemainingMs;
  });
  save.activeRun.shotCooldownTimer = 444;
  delete save.activeRun.weaponSwapLockTimer;

  const restored = createHarness().combat;
  restored.loadSaveData(save);
  assert.equal(restored.activeWeaponId, "marksman");
  assert.equal(restored.weaponStates.marksman.shotCooldownRemainingMs, 444);
  assert.equal(restored.weaponStates.rifle.shotCooldownRemainingMs, 0);
  assert.equal(restored.getWeaponState().shotCooldownMs, 444);
});

test("实体容器搜索由 CombatSystem 按帧推进并在完成后同步世界状态", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.currentEncounter = null;
  const searchNode = combat.runSystem.routeChoices.find(node => node.type === "search");
  assert.ok(searchNode);
  assert.equal(combat.chooseRoute(searchNode.id).success, true);
  const container = combat.worldSystem.getContainersForLocation(searchNode.id, { includeFinished: false })[0];
  assert.ok(container);
  playerSystem.player.x = container.x - playerSystem.player.width / 2;
  playerSystem.player.y = container.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();

  const started = combat.searchArea("quick");
  assert.equal(started.success, true);
  assert.equal(started.started, true);
  assert.equal(combat.getBattleState().isSearching, true);
  combat.updateActiveSearch(started.search.durationMs - 1);
  assert.equal(combat.worldSystem.getContainer(container.id).state, "searching");
  combat.updateActiveSearch(1);
  assert.equal(combat.worldSystem.getContainer(container.id).state, "searched");
  assert.equal(combat.getBattleState().isSearching, false);
});

test("搜索期间受伤会同时中断规则计时与世界容器占用", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.currentEncounter = null;
  const searchNode = combat.runSystem.routeChoices.find(node => node.type === "search");
  combat.chooseRoute(searchNode.id);
  const container = combat.worldSystem.getContainersForLocation(searchNode.id, { includeFinished: false })[0];
  playerSystem.player.x = container.x - playerSystem.player.width / 2;
  playerSystem.player.y = container.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();
  assert.equal(combat.searchArea("quick").success, true);
  combat.damageHero(1);
  assert.equal(combat.runSystem.activeSearch, null);
  assert.equal(combat.worldSystem.getContainer(container.id).state, "available");
  assert.equal(combat.getBattleState().actions.canSearch, true);
});

test("进入搜索地点后仍可走近实体容器，移动会取消正在进行的搜索", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.currentEncounter = null;
  const searchNode = combat.runSystem.routeChoices.find(node => node.type === "search");
  assert.ok(searchNode);
  assert.equal(combat.chooseRoute(searchNode.id).success, true);
  assert.equal(combat.runSystem.phase, "search");
  assert.equal(combat.canMoveHero(), true, "搜索区域必须允许玩家移动到散布的容器旁");

  const container = combat.worldSystem.getContainersForLocation(searchNode.id, { includeFinished: false })[0];
  playerSystem.player.x = container.x - playerSystem.player.width / 2;
  playerSystem.player.y = container.y - playerSystem.player.height / 2;
  combat.updateWorldAwareness();
  assert.equal(combat.searchArea("quick").success, true);

  combat.setMovementInput(1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  assert.equal(combat.runSystem.activeSearch, null);
  assert.equal(combat.worldSystem.getContainer(container.id).state, "available");
});
