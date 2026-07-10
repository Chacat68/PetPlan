import assert from 'node:assert/strict';

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

const { CombatSystem } = await import('../js/modules/combat-system.js');
const { WaveSystem } = await import('../js/modules/wave-system.js');

function createHarness() {
    const resourceTotals = { coins: 0, crystals: 0 };
    const experience = { total: 0 };
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
            multiShot: 1
        },
        playAttackAnimation() {},
        getGunMuzzlePosition() {
            return { x: this.player.x + 20, y: this.player.y + 20 };
        },
        addExperience(amount) {
            experience.total += amount;
        }
    };
    const resourceSystem = {
        addCoins(amount) {
            resourceTotals.coins += amount;
        },
        addCrystals(amount) {
            resourceTotals.crystals += amount;
        }
    };
    const pet = {
        instanceId: 101,
        templateId: 1,
        level: 1,
        equipped: true
    };
    const petTemplate = {
        id: 1,
        name: '火焰犬',
        type: 'fire',
        baseStats: { attack: 15, attackSpeed: 1 }
    };
    const petSystem = {
        equippedPets: [pet],
        getTemplate(id) {
            return id === petTemplate.id ? petTemplate : null;
        }
    };
    const territorySystem = {
        calculateBonuses() {
            return { attack: 3, defense: 4, expBonus: 10 };
        }
    };

    const combat = new CombatSystem();
    combat.mapWidth = 480;
    combat.mapHeight = 800;
    combat.setPlayerSystem(playerSystem);
    combat.setResourceSystem(resourceSystem);
    combat.setTerritorySystem(territorySystem);
    combat.setPetSystem(petSystem);
    combat.resetBattle();

    return {
        combat,
        playerSystem,
        petSystem,
        resourceTotals,
        experience
    };
}

{
    const waves = new WaveSystem({ totalWaves: 10 });
    const first = waves.buildWavePlan(1);
    const final = waves.buildWavePlan(10);
    assert.equal(first.enemies.length, 7, '第一波应有固定数量的敌人');
    assert.equal(final.enemies.at(-1).templateId, 'dragon', '第十波最后应生成 Boss 龙');
    assert.equal(final.enemies.filter(enemy => enemy.boss).length, 1, '最终波只应有一个 Boss 标记');
}

{
    const { combat } = createHarness();
    const state = combat.getBattleState();
    assert.equal(state.phase, 'ready');
    assert.equal(state.currentWave, 0);
    assert.equal(state.energy, 100);
    assert.equal(state.towerCount, 1, '上阵宠物应自动映射为宠物塔');
    assert.equal(state.baseHp, state.baseMaxHp);

    const startResult = combat.startNextWave();
    assert.equal(startResult.success, true);
    combat.update(16);
    assert.ok(combat.monsters.length > 0, '开波后应立即出现首只敌人');
    const monster = combat.monsters[0];
    const progressBefore = monster.progress;
    combat.updateMonsters(100);
    assert.ok(monster.progress > progressBefore, '敌人应沿纵向路线推进');
}

{
    const { combat } = createHarness();
    const selectedBefore = combat.getSelectedTower();
    const originalSlot = selectedBefore.slotIndex;
    const emptySlot = originalSlot === 1 ? 2 : 1;
    const emptyPosition = combat.getTowerSlotPosition(emptySlot);
    const moveResult = combat.selectTowerAt(emptyPosition.x, emptyPosition.y);
    assert.equal(moveResult.success, true, '备战阶段应可把选中的塔移到空塔位');
    assert.equal(combat.getSelectedTower().slotIndex, emptySlot);

    const upgradeResult = combat.upgradeSelectedTower();
    assert.equal(upgradeResult.success, true);
    assert.equal(combat.getSelectedTower().upgradeLevel, 2);
    assert.equal(combat.energy, 60, '首次升级应消耗 40 点局内能量');
}

{
    const { combat } = createHarness();
    combat.monsters = [];
    const leaked = combat.spawnMonster('slime', 1);
    const baseHpBefore = combat.baseHp;
    const killsBefore = combat.runRewards.kills;
    leaked.pathDistance = combat.getPathLength() - 1;
    leaked.speed = 100;
    combat.updateMonsters(100);
    assert.ok(combat.baseHp < baseHpBefore, '漏怪应扣除基地生命');
    assert.equal(combat.runRewards.kills, killsBefore, '漏怪不能计为击杀');
    assert.equal(combat.monsters.includes(leaked), false, '漏怪结算后应移出战场');
}

{
    const { combat } = createHarness();
    combat.monsters = [];
    const monster = combat.spawnMonster('goblin', 2);
    const energyBefore = combat.energy;
    combat.applyDamage(monster, monster.hp + 99);
    const rewardsAfterKill = { ...combat.runRewards };
    const energyAfterKill = combat.energy;
    combat.onMonsterKilled(monster);
    assert.deepEqual(combat.runRewards, rewardsAfterKill, '同一敌人的奖励只能结算一次');
    assert.equal(combat.energy, energyAfterKill);
    assert.ok(energyAfterKill > energyBefore);
}

{
    const { combat, resourceTotals, experience } = createHarness();
    combat.runRewards = { coins: 100, crystals: 8, exp: 50, kills: 5 };
    combat.waveSystem.currentWave = 10;
    const firstSettlement = combat.finishBattle(true);
    const secondSettlement = combat.finishBattle(true);
    assert.deepEqual(secondSettlement, firstSettlement, '重复结束战斗应返回同一份结算');
    assert.equal(resourceTotals.coins, 100, '胜利金币不能重复发放');
    assert.equal(resourceTotals.crystals, 8, '胜利水晶不能重复发放');
    assert.equal(experience.total, 55, '经验应应用领地图书馆百分比加成');
}

{
    const { combat } = createHarness();
    const target = { x: 100, y: 100, width: 40, height: 40 };
    const centeredBullet = { x: 115, y: 115, size: 10 };
    const distantBullet = { x: 40, y: 40, size: 10 };
    assert.equal(combat.isColliding(centeredBullet, target), true, '碰撞应比较实体中心点');
    assert.equal(combat.isColliding(distantBullet, target), false);
}

{
    const { combat, playerSystem, resourceTotals } = createHarness();
    playerSystem.player.attack = 800;
    playerSystem.player.attackSpeed = 5;
    playerSystem.player.multiShot = 3;
    combat.resetBattle();

    let guard = 0;
    while (combat.waveSystem.phase !== 'victory' && combat.waveSystem.phase !== 'defeat') {
        if (combat.waveSystem.canStartNextWave()) combat.startNextWave();
        combat.update(50);
        guard += 1;
        assert.ok(guard < 10000, '十波完整流程不应卡死');
    }

    assert.equal(combat.waveSystem.phase, 'victory', '完整十波应能进入胜利结算');
    assert.equal(combat.meta.bestWave, 10);
    assert.equal(combat.meta.victories, 1);
    assert.ok(resourceTotals.coins > 0, '自然通关后应发放累计金币');
}

console.log('tower-defense smoke: ok');
