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

  combat.shotCooldownTimer = 0;
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

test("撤离解锁后处于普通 route 阶段的返程移动也累计压力", () => {
  const { combat, playerSystem } = createHarness();
  combat.runSystem.phase = "route";
  combat.runSystem.depth = combat.runSystem.minExtractionDepth;
  assert.equal(combat.runSystem.canExtract(), true);
  const beforeX = playerSystem.player.x;
  combat.setMovementInput(1, 0);
  combat.updateHeroMovement(playerSystem.player, 100);
  assert.ok(playerSystem.player.x > beforeX);
  assert.ok(combat.returnPressure.distance > 0);
});

test("活动远征存档可恢复武器弹药、瞄准与飞行中的固定弹丸", () => {
  const { combat } = createHarness();
  combat.switchWeapon("marksman");
  combat.setAimDirection(0, -1);
  combat.weaponStates.marksman.magazine = 3;
  combat.fireCurrentWeapon();
  const save = combat.getSaveData();

  const restored = createHarness().combat;
  restored.loadSaveData(save);
  const state = restored.getWeaponState();
  assert.equal(state.activeWeaponId, "marksman");
  assert.equal(state.active.magazine, 2);
  assert.ok(Math.abs(state.aimDirection.y + 1) < 0.001);
  assert.equal(restored.bullets.length, 1);
  assert.equal(restored.bullets[0].targetId, null);
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
