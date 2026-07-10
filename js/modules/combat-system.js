/**
 * CombatSystem - 宠物防线（竖版塔防）
 * 负责波次、路径、基地、宠物塔、投射物、奖励结算和战斗渲染。
 */

import { TargetingSystem } from './targeting-system.js?v=tower-defense-20260710b';
import { WaveSystem } from './wave-system.js?v=tower-defense-20260710b';

let instance = null;
const MONSTER_ASSET_VERSION = 'tower-defense-20260710b';

const TOWER_ROLES = {
    fire: {
        name: '烈焰炮台',
        color: '#ff7043',
        rangeRatio: 0.31,
        damageScale: 1.05,
        intervalScale: 1,
        splashRadius: 54
    },
    phoenix: {
        name: '涅槃火雨',
        color: '#ff8a50',
        rangeRatio: 0.34,
        damageScale: 1.25,
        intervalScale: 1.18,
        splashRadius: 82
    },
    ice: {
        name: '寒霜控制',
        color: '#72d7ff',
        rangeRatio: 0.33,
        damageScale: 0.82,
        intervalScale: 0.9,
        slowFactor: 0.58,
        slowDuration: 1900
    },
    thunder: {
        name: '连锁闪电',
        color: '#ffe66d',
        rangeRatio: 0.34,
        damageScale: 0.95,
        intervalScale: 0.86,
        chainCount: 2
    },
    earth: {
        name: '大地震击',
        color: '#b58b5a',
        rangeRatio: 0.27,
        damageScale: 1.45,
        intervalScale: 1.32,
        stunDuration: 360
    },
    wind: {
        name: '风暴穿透',
        color: '#88f0d0',
        rangeRatio: 0.39,
        damageScale: 1.08,
        intervalScale: 0.8,
        chainCount: 1
    },
    light: {
        name: '圣光支援',
        color: '#fff4a8',
        rangeRatio: 0.35,
        damageScale: 0.72,
        intervalScale: 1.05,
        baseHeal: 4
    },
    dark: {
        name: '暗影收割',
        color: '#c38cff',
        rangeRatio: 0.32,
        damageScale: 1.12,
        intervalScale: 0.88,
        executeThreshold: 0.35,
        executeScale: 1.8
    },
    default: {
        name: '守卫炮台',
        color: '#ffd167',
        rangeRatio: 0.31,
        damageScale: 1,
        intervalScale: 1
    }
};

export class CombatSystem {
    constructor() {
        this.mode = 'towerDefense';
        this.isPaused = true;

        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.targetingSystem = new TargetingSystem();
        this.waveSystem = new WaveSystem({ totalWaves: 10 });

        this.monsterTemplates = [
            {
                id: 'slime', name: '史莱姆', image: 'images/monsters/slime_table.png',
                baseHp: 32, baseAttack: 7, speed: 42, coinReward: 8,
                crystalReward: 0, expReward: 5, size: 34
            },
            {
                id: 'bat', name: '疾风蝙蝠', image: 'images/monsters/bat_table.png',
                baseHp: 25, baseAttack: 8, speed: 70, coinReward: 11,
                crystalReward: 0, expReward: 7, size: 31
            },
            {
                id: 'skeleton', name: '重甲骷髅', image: 'images/monsters/skeleton_table.png',
                baseHp: 75, baseAttack: 13, speed: 34, coinReward: 19,
                crystalReward: 1, expReward: 14, size: 40
            },
            {
                id: 'goblin', name: '哥布林', image: 'images/monsters/goblin_table.png',
                baseHp: 43, baseAttack: 9, speed: 50, coinReward: 14,
                crystalReward: 0, expReward: 9, size: 36
            },
            {
                id: 'demon', name: '深渊恶魔', image: 'images/monsters/demon_table.png',
                baseHp: 105, baseAttack: 18, speed: 38, coinReward: 30,
                crystalReward: 2, expReward: 23, size: 44
            },
            {
                id: 'dragon', name: '防线终结者', image: 'images/monsters/dragon_table.png',
                baseHp: 520, baseAttack: 55, speed: 27, coinReward: 150,
                crystalReward: 15, expReward: 120, size: 62, isBoss: true
            }
        ];

        this.monsterImages = {};
        this.monsterAnimationSheets = {};
        this.combatStates = ['idle', 'move', 'attack'];
        this.preloadImages();

        this.config = {
            attackInterval: 760,
            bulletSpeed: 520,
            towerBulletSpeed: 460,
            maxMonsters: 40,
            initialEnergy: 100,
            waveEnergyBonus: 28,
            towerMaxLevel: 5
        };

        this.mapWidth = 750;
        this.mapHeight = 900;
        this.attackTimer = 0;
        this.baseRegenTimer = 0;
        this.playerSystem = null;
        this.resourceSystem = null;
        this.territorySystem = null;
        this.petSystem = null;
        this.onStateChange = null;

        this.towers = [];
        this.selectedTowerId = null;
        this.energy = this.config.initialEnergy;
        this.baseHp = 300;
        this.baseMaxHp = 300;
        this.runRewards = this.createEmptyRewards();
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = false;
        this.runSerial = 0;
        this.meta = {
            bestWave: 0,
            victories: 0,
            defeats: 0
        };

        console.log('[CombatSystem] 宠物防线模式初始化完成');
    }

    preloadImages() {
        this.monsterTemplates.forEach(template => {
            const image = new Image();
            image.onload = () => {
                this.monsterImages[template.id] = image;
            };
            image.onerror = () => {
                console.warn(`[CombatSystem] 图片加载失败: ${template.image}`);
            };
            image.src = `${template.image}?v=${MONSTER_ASSET_VERSION}`;
            if (image.complete && image.naturalWidth > 0) {
                this.monsterImages[template.id] = image;
            }

            this.monsterAnimationSheets[template.id] = {};
            this.combatStates.forEach(state => {
                const spritePath = this.getMonsterSpritePath(template, state);
                const sheet = new Image();
                sheet.onload = () => {
                    this.monsterAnimationSheets[template.id][state] = sheet;
                };
                sheet.onerror = () => {
                    console.warn(`[CombatSystem] 怪物序列帧加载失败: ${spritePath}`);
                };
                sheet.src = `${spritePath}?v=${MONSTER_ASSET_VERSION}`;
                if (sheet.complete && sheet.naturalWidth > 0) {
                    this.monsterAnimationSheets[template.id][state] = sheet;
                }
            });
        });
    }

    getMonsterSpritePath(template, state) {
        return `images/sprites/battle/monsters/${template.id}_${state}_sheet.png`;
    }

    setPlayerSystem(playerSystem) {
        this.playerSystem = playerSystem;
    }

    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    setTerritorySystem(territorySystem) {
        this.territorySystem = territorySystem;
    }

    setPetSystem(petSystem) {
        this.petSystem = petSystem;
        this.syncTowersWithPets();
    }

    setOnStateChange(callback) {
        this.onStateChange = typeof callback === 'function' ? callback : null;
    }

    prepareBattle() {
        if (!this.battleInitialized) {
            this.resetBattle();
        } else {
            this.syncTowersWithPets();
            this.placeHeroAtBase();
            this.notifyStateChange();
        }
        return this.getBattleState();
    }

    resetBattle() {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.attackTimer = 0;
        this.baseRegenTimer = 0;
        this.runSerial += 1;
        this.waveSystem.reset();
        this.energy = this.config.initialEnergy;
        this.baseMaxHp = this.calculateBaseMaxHp();
        this.baseHp = this.baseMaxHp;
        this.runRewards = this.createEmptyRewards();
        this.lastSettlement = null;
        this.settled = false;
        this.towers = [];
        this.selectedTowerId = null;
        this.syncTowersWithPets();
        this.placeHeroAtBase();
        this.battleInitialized = true;
        this.notifyStateChange();

        return { success: true, message: '防线已重整，可以开始第一波' };
    }

    createEmptyRewards() {
        return { coins: 0, crystals: 0, exp: 0, kills: 0 };
    }

    calculateBaseMaxHp() {
        const player = this.playerSystem?.player || {};
        const bonuses = this.territorySystem?.calculateBonuses?.() || {};
        const defense = (player.defense || 0) + (bonuses.defense || 0);
        return Math.max(250, Math.round(180 + (player.maxHp || 100) * 1.4 + defense * 8));
    }

    startNextWave() {
        this.prepareBattle();
        const result = this.waveSystem.startNextWave();
        if (result.success) {
            this.addBannerText(`第 ${result.wave} 波`, '#ffd167');
            this.notifyStateChange();
        }
        return result;
    }

    restartBattle() {
        return this.resetBattle();
    }

    update(deltaTime) {
        if (!this.battleInitialized) this.resetBattle();

        // 避免标签页休眠后恢复时整条怪物队伍瞬移到底线。
        const safeDelta = Math.max(0, Math.min(deltaTime, 100));
        this.syncTowersWithPets();
        this.placeHeroAtBase();

        const waveEvent = this.waveSystem.update(
            safeDelta,
            (spec, wave) => this.spawnMonster(spec, wave),
            this.monsters.length
        );

        if (waveEvent.spawned > 0) this.notifyStateChange();

        this.updateAttack(safeDelta);
        this.updateTowers(safeDelta);
        this.updateMonsters(safeDelta);
        this.updateBullets(safeDelta);
        this.updateBaseRegen(safeDelta);
        this.updateExplosions(safeDelta);
        this.updateCombatTexts(safeDelta);

        if (waveEvent.waveCompleted) {
            this.handleWaveCompleted(waveEvent.victory);
        }
    }

    updateSpawn(deltaTime) {
        const event = this.waveSystem.update(
            Math.max(0, Math.min(deltaTime, 100)),
            (spec, wave) => this.spawnMonster(spec, wave),
            this.monsters.length
        );
        if (event.waveCompleted) this.handleWaveCompleted(event.victory);
        return event;
    }

    spawnMonster(spec = null, waveNumber = null) {
        if (this.monsters.length >= this.config.maxMonsters) return null;

        const wave = waveNumber || Math.max(1, this.waveSystem.currentWave);
        const normalizedSpec = typeof spec === 'string'
            ? { templateId: spec }
            : (spec || { templateId: 'slime' });
        const template = this.monsterTemplates.find(item => item.id === normalizedSpec.templateId)
            || this.monsterTemplates[0];
        const playerLevel = this.playerSystem?.player?.level || 1;
        const waveScale = 1 + (wave - 1) * 0.18;
        const levelScale = 1 + (playerLevel - 1) * 0.06;
        const eliteScale = normalizedSpec.elite ? 1.6 : 1;
        const hpScale = waveScale * levelScale * eliteScale;
        const start = this.getPathPointAtDistance(0);
        const size = template.size * (normalizedSpec.elite && !template.isBoss ? 1.12 : 1);

        const monster = {
            id: this.nextMonsterId++,
            templateId: template.id,
            name: template.name,
            x: start.x - size / 2,
            y: start.y - size / 2,
            width: size,
            height: size,
            hp: Math.floor(template.baseHp * hpScale),
            maxHp: Math.floor(template.baseHp * hpScale),
            attack: Math.max(1, Math.floor(template.baseAttack * waveScale * eliteScale)),
            speed: template.speed * (1 + Math.min(0.24, wave * 0.012)),
            coinReward: Math.max(1, Math.floor(template.coinReward * waveScale)),
            crystalReward: Math.max(0, Math.floor((template.crystalReward || 0) * eliteScale)),
            expReward: Math.max(1, Math.floor(template.expReward * waveScale)),
            energyReward: template.isBoss ? 35 : (normalizedSpec.elite ? 15 : 7),
            isBoss: Boolean(template.isBoss || normalizedSpec.boss),
            isElite: Boolean(normalizedSpec.elite),
            pathDistance: 0,
            progress: 0,
            slowFactor: 1,
            slowTimer: 0,
            stunTimer: 0,
            animationOffset: Math.random() * 400,
            combatState: 'move',
            rewardGranted: false
        };

        this.monsters.push(monster);
        return monster;
    }

    updateAttack(deltaTime) {
        if (!this.playerSystem || this.monsters.length === 0 || !this.isWaveActive()) return;

        const player = this.playerSystem.player;
        const attackInterval = this.config.attackInterval / Math.max(0.1, player.attackSpeed || 1);
        this.attackTimer += deltaTime;

        if (this.attackTimer >= attackInterval) {
            this.attackTimer %= attackInterval;
            this.fireAtNearestMonsters();
        }
    }

    fireAtNearestMonsters() {
        if (!this.playerSystem) return;

        const player = this.playerSystem.player;
        const origin = this.getEntityCenter(player);
        const targets = this.getTargets(origin, {
            strategy: 'path-progress',
            limit: Math.max(1, player.multiShot || 1)
        });
        targets.forEach(target => this.fireBullet(target));
    }

    fireBullet(target) {
        if (!this.playerSystem || !target) return null;

        const player = this.playerSystem.player;
        this.playerSystem.playAttackAnimation?.();
        const targetPoint = this.getEntityCenter(target);
        const origin = this.getPlayerBulletOrigin(targetPoint);
        const isCrit = Math.random() * 100 < (player.crit || 0);
        let damage = this.getPlayerAttackDamage();
        if (isCrit) damage *= (player.critDamage || 150) / 100;

        const bullet = {
            id: this.nextBulletId++,
            source: 'hero',
            x: origin.x,
            y: origin.y,
            targetId: target.id,
            speed: this.config.bulletSpeed,
            damage,
            isCrit,
            size: isCrit ? 9 : 7,
            color: isCrit ? '#ff7043' : '#ffd167',
            effects: {}
        };
        this.bullets.push(bullet);
        return bullet;
    }

    getPlayerBulletOrigin(targetPoint) {
        if (typeof this.playerSystem?.getGunMuzzlePosition === 'function') {
            return this.playerSystem.getGunMuzzlePosition(targetPoint);
        }
        return this.getEntityCenter(this.playerSystem?.player);
    }

    getPlayerAttackDamage() {
        const baseAttack = this.playerSystem?.player?.attack || 1;
        const territoryBonuses = this.territorySystem?.calculateBonuses?.() || {};
        return baseAttack + (territoryBonuses.attack || 0);
    }

    syncTowersWithPets() {
        const equippedPets = this.petSystem?.equippedPets || [];
        const activeIds = new Set(equippedPets.map(pet => pet.instanceId));
        let changed = false;

        const retained = this.towers.filter(tower => activeIds.has(tower.petInstanceId));
        if (retained.length !== this.towers.length) changed = true;
        this.towers = retained;

        this.towers.forEach(tower => {
            const pet = equippedPets.find(item => item.instanceId === tower.petInstanceId);
            if (pet) {
                tower.petLevel = pet.level || 1;
                tower.templateId = pet.templateId;
            }
        });

        const preferredSlots = [0, 3, 2, 5, 1, 4];
        equippedPets.forEach(pet => {
            if (this.towers.some(tower => tower.petInstanceId === pet.instanceId)) return;

            const occupied = new Set(this.towers.map(tower => tower.slotIndex));
            const slotIndex = preferredSlots.find(index => !occupied.has(index));
            if (slotIndex === undefined) return;

            this.towers.push({
                id: `pet-tower-${pet.instanceId}`,
                petInstanceId: pet.instanceId,
                templateId: pet.templateId,
                petLevel: pet.level || 1,
                slotIndex,
                upgradeLevel: 1,
                cooldown: 250 + Math.random() * 250,
                attackAnimationTimer: 0
            });
            changed = true;
        });

        if (!this.towers.some(tower => tower.id === this.selectedTowerId)) {
            this.selectedTowerId = this.towers[0]?.id || null;
            changed = true;
        }

        if (changed && this.battleInitialized) this.notifyStateChange();
    }

    updateTowers(deltaTime) {
        if (!this.isWaveActive()) return;

        this.towers.forEach(tower => {
            tower.cooldown -= deltaTime;
            tower.attackAnimationTimer = Math.max(0, tower.attackAnimationTimer - deltaTime);
            if (tower.cooldown > 0) return;

            const stats = this.getTowerStats(tower);
            const position = this.getTowerSlotPosition(tower.slotIndex);
            const target = this.acquireTarget(position, {
                strategy: 'path-progress',
                maxRange: stats.range
            });

            if (!target) {
                tower.cooldown = 120;
                return;
            }

            tower.cooldown = stats.attackInterval;
            tower.attackAnimationTimer = 280;
            this.fireTowerBullet(tower, target, stats);
        });
    }

    getTowerStats(tower) {
        const template = this.petSystem?.getTemplate?.(tower.templateId);
        const role = this.getTowerRole(template?.type);
        const petLevelScale = 1 + Math.max(0, (tower.petLevel || 1) - 1) * 0.1;
        const upgradeScale = 1 + Math.max(0, (tower.upgradeLevel || 1) - 1) * 0.34;
        const attackSpeed = template?.baseStats?.attackSpeed || 1;
        const baseAttack = template?.baseStats?.attack || 10;
        const territoryAttack = this.territorySystem?.calculateBonuses?.().attack || 0;
        const boardSize = Math.max(280, Math.min(this.mapWidth, this.mapHeight));

        return {
            roleName: role.name,
            color: role.color,
            damage: Math.max(1, Math.floor((baseAttack * petLevelScale * upgradeScale + territoryAttack * 0.35) * role.damageScale)),
            range: Math.max(105, boardSize * role.rangeRatio),
            attackInterval: Math.max(260, (1050 / attackSpeed) * role.intervalScale / (1 + (tower.upgradeLevel - 1) * 0.08)),
            effects: {
                splashRadius: role.splashRadius || 0,
                slowFactor: role.slowFactor || 1,
                slowDuration: role.slowDuration || 0,
                stunDuration: role.stunDuration || 0,
                chainCount: role.chainCount || 0,
                baseHeal: role.baseHeal || 0,
                executeThreshold: role.executeThreshold || 0,
                executeScale: role.executeScale || 1
            }
        };
    }

    getTowerRole(type) {
        return TOWER_ROLES[type] || TOWER_ROLES.default;
    }

    fireTowerBullet(tower, target, stats) {
        const position = this.getTowerSlotPosition(tower.slotIndex);
        if (stats.effects.baseHeal > 0 && this.baseHp < this.baseMaxHp) {
            const heal = stats.effects.baseHeal + tower.upgradeLevel;
            this.baseHp = Math.min(this.baseMaxHp, this.baseHp + heal);
            this.addStatusText(position.x, position.y - 28, `+${heal}`, '#8dffb5');
        }

        this.bullets.push({
            id: this.nextBulletId++,
            source: 'tower',
            towerId: tower.id,
            x: position.x,
            y: position.y,
            targetId: target.id,
            speed: this.config.towerBulletSpeed,
            damage: stats.damage,
            isCrit: false,
            size: 7 + tower.upgradeLevel,
            color: stats.color,
            effects: { ...stats.effects }
        });
    }

    updateMonsters(deltaTime) {
        const dt = deltaTime / 1000;
        const pathLength = this.getPathLength();
        const reachedBase = [];

        this.monsters.forEach(monster => {
            monster.slowTimer = Math.max(0, (monster.slowTimer || 0) - deltaTime);
            monster.stunTimer = Math.max(0, (monster.stunTimer || 0) - deltaTime);
            if (monster.slowTimer <= 0) monster.slowFactor = 1;

            if (monster.stunTimer > 0) {
                monster.combatState = 'idle';
            } else {
                monster.combatState = 'move';
                monster.pathDistance += monster.speed * (monster.slowFactor || 1) * dt;
            }

            monster.progress = Math.max(0, Math.min(1, monster.pathDistance / pathLength));
            const point = this.getPathPointAtDistance(monster.pathDistance);
            monster.x = point.x - monster.width / 2;
            monster.y = point.y - monster.height / 2;

            if (monster.pathDistance >= pathLength) reachedBase.push(monster);
        });

        if (reachedBase.length > 0) {
            reachedBase.forEach(monster => this.damageBase(monster.attack, monster));
            const reachedIds = new Set(reachedBase.map(monster => monster.id));
            this.monsters = this.monsters.filter(monster => !reachedIds.has(monster.id));
            this.notifyStateChange();
        }
    }

    damageBase(rawDamage, monster = null) {
        if (this.waveSystem.phase === 'defeat') return 0;

        const playerDefense = this.playerSystem?.player?.defense || 0;
        const territoryDefense = this.territorySystem?.calculateBonuses?.().defense || 0;
        const damage = Math.max(1, Math.floor(rawDamage - (playerDefense + territoryDefense) * 0.25));
        this.baseHp = Math.max(0, this.baseHp - damage);
        const point = this.getBasePosition();
        this.addStatusText(point.x, point.y - 42, `-${damage}`, '#ff667d', true);
        this.explosions.push({
            x: point.x,
            y: point.y,
            radius: monster?.isBoss ? 30 : 18,
            life: 420,
            color: '#ff4757'
        });

        if (this.baseHp <= 0) this.finishBattle(false);
        this.notifyStateChange();
        return damage;
    }

    updateBaseRegen(deltaTime) {
        if (
            this.baseHp >= this.baseMaxHp ||
            this.waveSystem.phase === 'victory' ||
            this.waveSystem.phase === 'defeat'
        ) {
            return;
        }

        this.baseRegenTimer += deltaTime;
        if (this.baseRegenTimer < 1000) return;
        this.baseRegenTimer %= 1000;
        const regen = Math.max(0, Math.floor(this.playerSystem?.player?.hpRegen || 0));
        if (regen <= 0) return;
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + regen);
        this.notifyStateChange();
    }

    updateBullets(deltaTime) {
        const dt = deltaTime / 1000;
        const remaining = [];

        this.bullets.forEach(bullet => {
            const target = this.monsters.find(monster => monster.id === bullet.targetId && monster.hp > 0);
            if (!target) return;

            const targetPoint = this.getEntityCenter(target);
            const dx = targetPoint.x - bullet.x;
            const dy = targetPoint.y - bullet.y;
            const distance = Math.hypot(dx, dy);
            const travel = bullet.speed * dt;

            if (distance <= travel + Math.max(5, target.width * 0.25)) {
                bullet.x = targetPoint.x;
                bullet.y = targetPoint.y;
                this.resolveBulletHit(bullet, target);
                return;
            }

            const safeDistance = distance || 1;
            bullet.vx = (dx / safeDistance) * bullet.speed;
            bullet.vy = (dy / safeDistance) * bullet.speed;
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            remaining.push(bullet);
        });

        this.bullets = remaining;
    }

    resolveBulletHit(bullet, target) {
        const effects = bullet.effects || {};
        let damage = bullet.damage;
        if (
            effects.executeThreshold > 0 &&
            target.hp / target.maxHp <= effects.executeThreshold
        ) {
            damage *= effects.executeScale || 1;
        }

        this.applyDamage(target, damage, { isCrit: bullet.isCrit });

        if (effects.slowDuration > 0 && target.hp > 0) {
            target.slowFactor = Math.min(target.slowFactor || 1, effects.slowFactor || 1);
            target.slowTimer = Math.max(target.slowTimer || 0, effects.slowDuration);
        }
        if (effects.stunDuration > 0 && target.hp > 0) {
            target.stunTimer = Math.max(target.stunTimer || 0, effects.stunDuration);
        }

        if (effects.splashRadius > 0) {
            const center = this.getEntityCenter(target);
            this.monsters
                .filter(monster => monster !== target && monster.hp > 0)
                .filter(monster => {
                    const point = this.getEntityCenter(monster);
                    return Math.hypot(point.x - center.x, point.y - center.y) <= effects.splashRadius;
                })
                .forEach(monster => this.applyDamage(monster, damage * 0.48));
        }

        if (effects.chainCount > 0) {
            const center = this.getEntityCenter(target);
            this.monsters
                .filter(monster => monster !== target && monster.hp > 0)
                .map(monster => ({
                    monster,
                    distance: Math.hypot(
                        this.getEntityCenter(monster).x - center.x,
                        this.getEntityCenter(monster).y - center.y
                    )
                }))
                .filter(item => item.distance <= 150)
                .sort((a, b) => a.distance - b.distance)
                .slice(0, effects.chainCount)
                .forEach(item => this.applyDamage(item.monster, damage * 0.62));
        }

        this.explosions.push({
            x: bullet.x,
            y: bullet.y,
            radius: effects.splashRadius > 0 ? 18 : 9,
            life: 280,
            color: bullet.color
        });
    }

    checkCollisions() {
        // 投射物采用追踪 + 扫掠距离判定；保留方法供旧调用兼容。
        return this.bullets.length;
    }

    isColliding(a, b) {
        const aCenter = this.getEntityCenter(a);
        const bCenter = this.getEntityCenter(b);
        const aRadius = (a.size || Math.max(a.width || 0, a.height || 0)) / 2;
        const bRadius = (b.size || Math.max(b.width || 0, b.height || 0)) / 2;
        return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y) <= aRadius + bRadius;
    }

    applyDamage(monster, damage, options = {}) {
        if (!monster || monster.hp <= 0 || !this.monsters.includes(monster)) return false;

        const finalDamage = Math.max(1, Math.floor(damage));
        monster.hp -= finalDamage;
        this.addCombatText(
            monster.x + monster.width / 2,
            monster.y,
            finalDamage,
            Boolean(options.isCrit)
        );

        if (monster.hp <= 0) {
            this.onMonsterKilled(monster);
            this.monsters = this.monsters.filter(item => item !== monster);
        }
        return true;
    }

    applyPetDamage(monster, damage, isCrit = false) {
        return this.applyDamage(monster, damage, { isCrit });
    }

    onMonsterKilled(monster) {
        if (!monster || monster.rewardGranted) return;
        monster.rewardGranted = true;
        this.energy += monster.energyReward || 5;
        this.runRewards.coins += monster.coinReward || 0;
        this.runRewards.crystals += monster.crystalReward || 0;
        this.runRewards.exp += monster.expReward || 0;
        this.runRewards.kills += 1;
        this.explosions.push({
            x: monster.x + monster.width / 2,
            y: monster.y + monster.height / 2,
            radius: monster.isBoss ? 28 : 12,
            life: monster.isBoss ? 520 : 300,
            color: monster.isBoss ? '#ff7043' : '#ffd167'
        });
        this.notifyStateChange();
    }

    handleWaveCompleted(victory) {
        this.meta.bestWave = Math.max(this.meta.bestWave, this.waveSystem.currentWave);
        if (victory) {
            this.finishBattle(true);
            return;
        }

        const bonus = this.config.waveEnergyBonus + this.waveSystem.currentWave * 2;
        this.energy += bonus;
        this.addBannerText(`第 ${this.waveSystem.currentWave} 波守住了`, '#8dffb5');
        this.notifyStateChange();
    }

    finishBattle(victory) {
        if (this.settled) return this.lastSettlement;

        this.settled = true;
        this.waveSystem.phase = victory ? 'victory' : 'defeat';
        this.meta.bestWave = Math.max(this.meta.bestWave, this.waveSystem.currentWave);
        if (victory) this.meta.victories += 1;
        else this.meta.defeats += 1;

        const territoryExpBonus = this.territorySystem?.calculateBonuses?.().expBonus || 0;
        const rewardScale = victory ? 1 : 0.4;
        const crystalScale = victory ? 1 : 0.25;
        const settlement = {
            runId: this.runSerial,
            victory,
            wave: this.waveSystem.currentWave,
            coins: Math.floor(this.runRewards.coins * rewardScale),
            crystals: Math.floor(this.runRewards.crystals * crystalScale),
            exp: Math.floor(this.runRewards.exp * rewardScale * (1 + territoryExpBonus / 100)),
            kills: this.runRewards.kills
        };

        this.resourceSystem?.addCoins?.(settlement.coins);
        this.resourceSystem?.addCrystals?.(settlement.crystals);
        this.playerSystem?.addExperience?.(settlement.exp);
        this.lastSettlement = settlement;
        this.monsters = [];
        this.bullets = [];
        this.addBannerText(victory ? '防线胜利！' : '基地失守', victory ? '#ffd167' : '#ff667d');
        this.notifyStateChange();
        return settlement;
    }

    getTowerUpgradeCost(tower = this.getSelectedTower()) {
        if (!tower) return 0;
        return 40 + Math.max(0, tower.upgradeLevel - 1) * 35;
    }

    upgradeSelectedTower() {
        const tower = this.getSelectedTower();
        if (!tower) return { success: false, message: '请先点击一个宠物塔' };
        if (tower.upgradeLevel >= this.config.towerMaxLevel) {
            return { success: false, message: '该宠物塔已满级' };
        }

        const cost = this.getTowerUpgradeCost(tower);
        if (this.energy < cost) return { success: false, message: `战斗能量不足，需要 ${cost}` };

        this.energy -= cost;
        tower.upgradeLevel += 1;
        const position = this.getTowerSlotPosition(tower.slotIndex);
        this.addStatusText(position.x, position.y - 35, `塔 Lv.${tower.upgradeLevel}`, '#ffd167');
        this.notifyStateChange();
        return { success: true, message: `宠物塔升至 Lv.${tower.upgradeLevel}` };
    }

    repairBase() {
        const cost = 35;
        if (this.baseHp >= this.baseMaxHp) return { success: false, message: '基地生命已满' };
        if (this.energy < cost) return { success: false, message: `战斗能量不足，需要 ${cost}` };
        if (this.waveSystem.phase === 'defeat' || this.waveSystem.phase === 'victory') {
            return { success: false, message: '本局已经结束' };
        }

        const heal = Math.ceil(this.baseMaxHp * 0.22);
        const previousHp = this.baseHp;
        this.energy -= cost;
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + heal);
        const actualHeal = this.baseHp - previousHp;
        const base = this.getBasePosition();
        this.addStatusText(base.x, base.y - 45, `+${actualHeal}`, '#8dffb5');
        this.notifyStateChange();
        return { success: true, message: `基地恢复 ${actualHeal} 点生命` };
    }

    selectTowerAt(x, y) {
        const slotRadius = this.getTowerSlotRadius() * 1.25;
        let nearestSlot = null;
        let nearestDistance = Infinity;

        for (let index = 0; index < 6; index += 1) {
            const position = this.getTowerSlotPosition(index);
            const distance = Math.hypot(x - position.x, y - position.y);
            if (distance <= slotRadius && distance < nearestDistance) {
                nearestSlot = index;
                nearestDistance = distance;
            }
        }

        if (nearestSlot === null) return { success: false, message: '' };
        const clickedTower = this.towers.find(tower => tower.slotIndex === nearestSlot);
        if (clickedTower) {
            this.selectedTowerId = clickedTower.id;
            this.notifyStateChange();
            return { success: true, message: `${this.getTowerDetails(clickedTower).name} 已选中` };
        }

        const selected = this.getSelectedTower();
        if (!selected) return { success: false, message: '这是空塔位，请先选择一只宠物' };
        if (this.isWaveActive()) return { success: false, message: '战斗中不能移动宠物塔' };

        selected.slotIndex = nearestSlot;
        this.notifyStateChange();
        return { success: true, message: '宠物塔已移动到新塔位' };
    }

    getSelectedTower() {
        return this.towers.find(tower => tower.id === this.selectedTowerId) || null;
    }

    getTowerDetails(tower = this.getSelectedTower()) {
        if (!tower) return null;
        const template = this.petSystem?.getTemplate?.(tower.templateId);
        const stats = this.getTowerStats(tower);
        return {
            id: tower.id,
            name: template?.name || '宠物塔',
            role: stats.roleName,
            level: tower.upgradeLevel,
            petLevel: tower.petLevel,
            damage: stats.damage,
            range: Math.round(stats.range),
            attackSpeed: Number((1000 / stats.attackInterval).toFixed(2)),
            upgradeCost: this.getTowerUpgradeCost(tower),
            maxLevel: this.config.towerMaxLevel,
            color: stats.color,
            slotIndex: tower.slotIndex
        };
    }

    getTowerRenderData() {
        return this.towers.map(tower => ({
            ...tower,
            ...this.getTowerSlotPosition(tower.slotIndex),
            selected: tower.id === this.selectedTowerId,
            role: this.getTowerRole(this.petSystem?.getTemplate?.(tower.templateId)?.type)
        }));
    }

    getTowerSlotPosition(index) {
        const positions = [
            [0.18, 0.18], [0.82, 0.25], [0.16, 0.40],
            [0.84, 0.50], [0.18, 0.64], [0.82, 0.72]
        ];
        const point = positions[index] || positions[0];
        return { x: this.mapWidth * point[0], y: this.mapHeight * point[1] };
    }

    getTowerSlotRadius() {
        return Math.max(24, Math.min(42, Math.min(this.mapWidth, this.mapHeight) * 0.055));
    }

    getHeroPosition() {
        const width = this.playerSystem?.player?.width || 40;
        const height = this.playerSystem?.player?.height || 40;
        const base = this.getBasePosition();
        return {
            x: base.x - width / 2,
            y: base.y - height * 0.72
        };
    }

    getBasePosition() {
        return { x: this.mapWidth * 0.5, y: this.mapHeight * 0.92 };
    }

    placeHeroAtBase() {
        if (!this.playerSystem?.player) return;
        const position = this.getHeroPosition();
        this.playerSystem.player.x = position.x;
        this.playerSystem.player.y = position.y;
    }

    getPathPoints() {
        return [
            { x: this.mapWidth * 0.50, y: -this.mapHeight * 0.05 },
            { x: this.mapWidth * 0.50, y: this.mapHeight * 0.10 },
            { x: this.mapWidth * 0.38, y: this.mapHeight * 0.27 },
            { x: this.mapWidth * 0.62, y: this.mapHeight * 0.46 },
            { x: this.mapWidth * 0.40, y: this.mapHeight * 0.65 },
            { x: this.mapWidth * 0.55, y: this.mapHeight * 0.82 },
            this.getBasePosition()
        ];
    }

    getPathSegments() {
        const points = this.getPathPoints();
        const segments = [];
        let total = 0;
        for (let index = 1; index < points.length; index += 1) {
            const start = points[index - 1];
            const end = points[index];
            const length = Math.hypot(end.x - start.x, end.y - start.y);
            segments.push({ start, end, length, startDistance: total });
            total += length;
        }
        return { segments, total };
    }

    getPathLength() {
        return this.getPathSegments().total || 1;
    }

    getPathPointAtDistance(distance) {
        const { segments, total } = this.getPathSegments();
        const clamped = Math.max(0, Math.min(total, distance));
        const segment = segments.find(item => clamped <= item.startDistance + item.length)
            || segments[segments.length - 1];
        if (!segment) return this.getBasePosition();
        const ratio = segment.length > 0
            ? (clamped - segment.startDistance) / segment.length
            : 0;
        return {
            x: segment.start.x + (segment.end.x - segment.start.x) * ratio,
            y: segment.start.y + (segment.end.y - segment.start.y) * ratio
        };
    }

    getNearestMonster(x, y) {
        return this.acquireTarget({ x, y }, { strategy: 'nearest' });
    }

    acquireTarget(origin, options = {}) {
        return this.targetingSystem.acquireTarget(origin, this.monsters, options);
    }

    getTargets(origin, options = {}) {
        return this.targetingSystem.getTargets(origin, this.monsters, options);
    }

    getAliveMonsters() {
        return this.targetingSystem.getAliveTargets(this.monsters);
    }

    getEntityCenter(entity) {
        return {
            x: (Number.isFinite(entity?.x) ? entity.x : 0) + (entity?.width || 0) / 2,
            y: (Number.isFinite(entity?.y) ? entity.y : 0) + (entity?.height || 0) / 2
        };
    }

    isWaveActive() {
        return this.waveSystem.phase === 'spawning' || this.waveSystem.phase === 'combat';
    }

    getBattleState() {
        const tower = this.getTowerDetails();
        return {
            mode: this.mode,
            phase: this.waveSystem.phase,
            phaseLabel: this.getPhaseLabel(),
            currentWave: this.waveSystem.currentWave,
            totalWaves: this.waveSystem.totalWaves,
            baseHp: this.baseHp,
            baseMaxHp: this.baseMaxHp,
            energy: this.energy,
            activeEnemies: this.monsters.length,
            queuedEnemies: this.waveSystem.getRemainingSpawnCount(),
            selectedTower: tower,
            towerCount: this.towers.length,
            canStartWave: this.waveSystem.canStartNextWave(),
            isWaveActive: this.isWaveActive(),
            rewards: { ...this.runRewards },
            settlement: this.lastSettlement ? { ...this.lastSettlement } : null,
            meta: { ...this.meta }
        };
    }

    getPhaseLabel() {
        const labels = {
            ready: '布置防线',
            spawning: '敌军来袭',
            combat: '防守中',
            intermission: '波次间歇',
            victory: '防线胜利',
            defeat: '基地失守'
        };
        return labels[this.waveSystem.phase] || '防线待命';
    }

    notifyStateChange() {
        if (!this.onStateChange) return;
        try {
            this.onStateChange(this.getBattleState());
        } catch (error) {
            console.warn('[CombatSystem] 战斗状态回调失败:', error);
        }
    }

    addCombatText(x, y, damage, isCrit = false) {
        this.combatTexts.push({
            x,
            y,
            text: isCrit ? `${damage}!` : String(damage),
            color: isCrit ? '#ff7043' : '#ffd167',
            life: 800,
            maxLife: 800,
            size: isCrit ? 18 : 14
        });
    }

    addStatusText(x, y, text, color = '#ffffff', large = false) {
        this.combatTexts.push({
            x,
            y,
            text: String(text),
            color,
            life: 950,
            maxLife: 950,
            size: large ? 22 : 16
        });
    }

    addBannerText(text, color) {
        this.combatTexts.push({
            x: this.mapWidth / 2,
            y: this.mapHeight * 0.36,
            text,
            color,
            life: 1500,
            maxLife: 1500,
            size: Math.max(22, Math.min(34, this.mapWidth * 0.045))
        });
    }

    updateExplosions(deltaTime) {
        this.explosions = this.explosions.filter(explosion => {
            explosion.life -= deltaTime;
            explosion.radius += deltaTime * 0.045;
            return explosion.life > 0;
        });
    }

    updateCombatTexts(deltaTime) {
        this.combatTexts = this.combatTexts.filter(text => {
            text.life -= deltaTime;
            text.y -= deltaTime * 0.025;
            return text.life > 0;
        });
    }

    render(ctx) {
        this.renderWorld(ctx);
        this.renderFloatingTexts(ctx);
    }

    renderBattlefieldBackground(ctx) {
        const { mapWidth: width, mapHeight: height } = this;
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#111b27');
        gradient.addColorStop(0.55, '#182725');
        gradient.addColorStop(1, '#211a20');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        const tile = Math.max(34, Math.floor(Math.min(width, height) / 12));
        ctx.strokeStyle = 'rgba(123, 215, 255, 0.07)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= width; x += tile) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += tile) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        const points = this.getPathPoints();
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = Math.max(68, Math.min(width, height) * 0.16);
        ctx.stroke();
        ctx.strokeStyle = '#5d483d';
        ctx.lineWidth = Math.max(58, Math.min(width, height) * 0.135);
        ctx.stroke();
        ctx.setLineDash([12, 18]);
        ctx.strokeStyle = 'rgba(255, 209, 103, 0.28)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        const spawn = points[1];
        const portal = ctx.createRadialGradient(spawn.x, spawn.y, 3, spawn.x, spawn.y, 46);
        portal.addColorStop(0, 'rgba(195, 140, 255, 0.85)');
        portal.addColorStop(1, 'rgba(82, 34, 120, 0)');
        ctx.fillStyle = portal;
        ctx.fillRect(spawn.x - 50, spawn.y - 50, 100, 100);
    }

    renderWorld(ctx) {
        this.renderTowerSlots(ctx);
        this.renderBase(ctx);
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        this.explosions.forEach(explosion => this.renderExplosion(ctx, explosion));
        this.renderPhasePrompt(ctx);
    }

    renderFloatingTexts(ctx) {
        this.combatTexts.forEach(text => this.renderCombatText(ctx, text));
    }

    renderTowerSlots(ctx) {
        const radius = this.getTowerSlotRadius();
        const selected = this.getSelectedTower();
        if (selected) {
            const position = this.getTowerSlotPosition(selected.slotIndex);
            const range = this.getTowerStats(selected).range;
            ctx.save();
            ctx.fillStyle = 'rgba(255, 209, 103, 0.06)';
            ctx.strokeStyle = 'rgba(255, 209, 103, 0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(position.x, position.y, range, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        for (let index = 0; index < 6; index += 1) {
            const position = this.getTowerSlotPosition(index);
            const tower = this.towers.find(item => item.slotIndex === index);
            const role = tower
                ? this.getTowerRole(this.petSystem?.getTemplate?.(tower.templateId)?.type)
                : TOWER_ROLES.default;

            ctx.save();
            ctx.fillStyle = tower ? 'rgba(18, 20, 29, 0.92)' : 'rgba(18, 20, 29, 0.48)';
            ctx.strokeStyle = tower?.id === this.selectedTowerId ? '#fff1a7' : (tower ? role.color : '#66707c');
            ctx.lineWidth = tower?.id === this.selectedTowerId ? 4 : 2;
            ctx.beginPath();
            ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = tower ? role.color : '#77808a';
            ctx.font = `bold ${Math.max(10, radius * 0.42)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tower ? `Lv.${tower.upgradeLevel}` : '+', position.x, position.y + radius * 0.72);
            ctx.restore();
        }
    }

    renderBase(ctx) {
        const base = this.getBasePosition();
        const width = Math.max(130, this.mapWidth * 0.24);
        const height = Math.max(36, this.mapHeight * 0.045);
        ctx.save();
        ctx.fillStyle = 'rgba(17, 18, 25, 0.88)';
        ctx.strokeStyle = this.baseHp > this.baseMaxHp * 0.3 ? '#ffd167' : '#ff667d';
        ctx.lineWidth = 4;
        ctx.fillRect(base.x - width / 2, base.y - height / 2, width, height);
        ctx.strokeRect(base.x - width / 2, base.y - height / 2, width, height);

        const barY = base.y + height * 0.7;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(base.x - width / 2, barY, width, 10);
        ctx.fillStyle = this.baseHp > this.baseMaxHp * 0.3 ? '#63d471' : '#ff4757';
        ctx.fillRect(base.x - width / 2, barY, width * (this.baseHp / this.baseMaxHp), 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`基地 ${this.baseHp}/${this.baseMaxHp}`, base.x, barY + 24);
        ctx.restore();
    }

    renderMonster(ctx, monster) {
        const image = this.monsterImages[monster.templateId];
        const animationState = monster.stunTimer > 0 ? 'idle' : 'move';
        const sheet = this.getMonsterStateSheet(monster.templateId, animationState);
        const visualScale = monster.isBoss ? 2.05 : (monster.isElite ? 1.82 : 1.62);
        const renderWidth = monster.width * visualScale;
        const renderHeight = monster.height * visualScale;
        const renderX = monster.x + monster.width / 2 - renderWidth / 2;
        const renderY = monster.y + monster.height / 2 - renderHeight / 2;

        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
            const frameSize = 512;
            const frameIndex = Math.floor((Date.now() + monster.animationOffset) / this.getMonsterFrameDuration(animationState)) % 4;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (monster.isBoss || monster.isElite) {
                ctx.shadowColor = monster.isBoss ? '#ff7043' : '#c38cff';
                ctx.shadowBlur = monster.isBoss ? 20 : 11;
            }
            ctx.drawImage(sheet, frameIndex * frameSize, 0, frameSize, frameSize, renderX, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else if (image && image.complete && image.naturalWidth > 0) {
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(image, renderX, renderY, renderWidth, renderHeight);
            ctx.restore();
        } else {
            ctx.fillStyle = monster.isBoss ? '#ff7043' : (monster.isElite ? '#c38cff' : '#ff667d');
            ctx.beginPath();
            ctx.arc(monster.x + monster.width / 2, monster.y + monster.height / 2, monster.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const barWidth = monster.isBoss ? monster.width * 1.4 : monster.width;
        const barHeight = monster.isBoss ? 7 : 4;
        const barX = monster.x + monster.width / 2 - barWidth / 2;
        const barY = monster.y - 10;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        ctx.fillStyle = monster.isBoss ? '#ff7043' : (monster.slowTimer > 0 ? '#72d7ff' : '#63d471');
        ctx.fillRect(barX, barY, barWidth * Math.max(0, monster.hp / monster.maxHp), barHeight);

        if (monster.isBoss || monster.isElite) {
            ctx.fillStyle = monster.isBoss ? '#ffb36b' : '#d5a8ff';
            ctx.font = `bold ${monster.isBoss ? 13 : 10}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText(monster.isBoss ? 'BOSS' : '精英', monster.x + monster.width / 2, barY - 6);
        }
    }

    getMonsterStateSheet(templateId, state) {
        const sheets = this.monsterAnimationSheets[templateId];
        return sheets?.[state] || sheets?.move || sheets?.idle;
    }

    getMonsterFrameDuration(state) {
        return state === 'move' ? 115 : 175;
    }

    renderBullet(ctx, bullet) {
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        const angle = Math.atan2(bullet.vy || -1, bullet.vx || 0);
        ctx.rotate(angle);
        ctx.shadowColor = bullet.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(0, 0, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.fillRect(-bullet.size * 2.2, -1.5, bullet.size * 1.5, 3);
        ctx.restore();
    }

    renderExplosion(ctx, explosion) {
        const alpha = Math.max(0, Math.min(1, explosion.life / 300));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = explosion.color || '#ff7043';
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    renderCombatText(ctx, text) {
        const alpha = Math.max(0, Math.min(1, text.life / (text.maxLife || 800)));
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${text.size}px Arial`;
        ctx.fillStyle = text.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(text.text, text.x, text.y);
        ctx.restore();
    }

    renderPhasePrompt(ctx) {
        if (this.isWaveActive()) return;
        const messages = {
            ready: '点击“开始第一波”部署敌军',
            intermission: '调整塔位并升级，然后开始下一波',
            victory: '防线胜利，点击“重新挑战”再来一局',
            defeat: '基地失守，点击“重整防线”重新挑战'
        };
        const message = messages[this.waveSystem.phase];
        if (!message) return;

        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.74)';
        const boxWidth = Math.min(this.mapWidth * 0.72, 520);
        const boxHeight = 54;
        const x = (this.mapWidth - boxWidth) / 2;
        const y = this.mapHeight * 0.42;
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = '#ffd167';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(13, Math.min(18, this.mapWidth * 0.024))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, this.mapWidth / 2, y + boxHeight / 2);
        ctx.restore();
    }

    getSaveData() {
        return {
            mode: this.mode,
            meta: { ...this.meta }
        };
    }

    loadSaveData(data) {
        if (data?.meta) {
            this.meta.bestWave = Math.max(0, Number(data.meta.bestWave) || 0);
            this.meta.victories = Math.max(0, Number(data.meta.victories) || 0);
            this.meta.defeats = Math.max(0, Number(data.meta.defeats) || 0);
        }
        this.resetBattle();
    }
}

export function getCombatSystemInstance() {
    if (!instance) instance = new CombatSystem();
    return instance;
}
