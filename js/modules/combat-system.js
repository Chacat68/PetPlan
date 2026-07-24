/**
 * CombatSystem - 宠物远征（单局 RPG 搜打撤）
 *
 * ExpeditionRunSystem 负责路线和结算，本类负责战斗实体、主动技能与 Canvas 渲染。
 */

import { ExpeditionRunSystem } from './expedition-run-system.js?v=expedition-simplification-20260723b';
import { ExpeditionWorldSystem } from './expedition-world-system.js?v=expedition-simplification-20260723b';
import { CameraSystem } from './camera-system.js?v=expedition-simplification-20260723b';
import { getPlayerVisualBounds } from './player-system.js?v=expedition-simplification-20260723b';
import { TargetingSystem } from './targeting-system.js?v=tower-defense-20260710b';
import {
    CHARACTER_ART_VERSION,
    CHARACTER_FRAME_COUNT,
    CHARACTER_FRAME_SIZE,
    MONSTER_CHARACTER_ART,
} from './character-art-config.js?v=stable-actions-20260721c';

let instance = null;
const MONSTER_ASSET_VERSION = CHARACTER_ART_VERSION;
const MONSTER_FRAME_SIZE = CHARACTER_FRAME_SIZE;
const MONSTER_FRAME_COUNT = CHARACTER_FRAME_COUNT;

const PET_ROLE_COLORS = Object.freeze({
    fire: '#ff7043',
    phoenix: '#ff8a50',
    ice: '#72d7ff',
    thunder: '#ffe66d',
    earth: '#b58b5a',
    wind: '#88f0d0',
    light: '#fff4a8',
    dark: '#c38cff',
    default: '#ffd167'
});

/**
 * 远征武器的局内基准配置。
 *
 * 武器伤害由 baseDamage 主导，旧版永久 attack 只经过对数软缩放后参与，
 * 避免高等级存档把所有早期敌人压缩成一次自动攻击。
 */
export const EXPEDITION_WEAPON_CONFIGS = Object.freeze({
    rifle: Object.freeze({
        id: 'rifle',
        name: '巡林步枪',
        category: 'rifle',
        magazineSize: 24,
        reserveAmmo: 96,
        reloadMs: 1450,
        fireIntervalMs: 175,
        bulletSpeed: 760,
        range: 610,
        baseDamage: 8,
        attributeScaling: 0.7,
        spreadDegrees: 2.2,
        movingSpreadDegrees: 6.5,
        // 旧字段继续保留给存档与界面读取；移动时只扩大散布，不再降伤害或射速。
        movingDamageMultiplier: 1,
        movingFireIntervalMultiplier: 1,
        pellets: 1,
        color: '#ffd167'
    }),
    shotgun: Object.freeze({
        id: 'shotgun',
        name: '拓荒霰弹枪',
        category: 'shotgun',
        magazineSize: 6,
        reserveAmmo: 30,
        reloadMs: 1950,
        fireIntervalMs: 690,
        bulletSpeed: 650,
        range: 315,
        baseDamage: 6.6,
        attributeScaling: 0.18,
        spreadDegrees: 10,
        movingSpreadDegrees: 17,
        movingDamageMultiplier: 1,
        movingFireIntervalMultiplier: 1,
        pellets: 6,
        color: '#ffb36b'
    }),
    marksman: Object.freeze({
        id: 'marksman',
        name: '哨卫精确枪',
        category: 'marksman',
        magazineSize: 5,
        reserveAmmo: 25,
        reloadMs: 2250,
        fireIntervalMs: 920,
        bulletSpeed: 1040,
        range: 880,
        baseDamage: 56,
        attributeScaling: 0.75,
        spreadDegrees: 0.65,
        movingSpreadDegrees: 4.8,
        movingDamageMultiplier: 1,
        movingFireIntervalMultiplier: 1,
        pellets: 1,
        color: '#72d7ff'
    })
});

export class CombatSystem {
    constructor({ random = Math.random, runOptions = {}, worldOptions = {} } = {}) {
        this.mode = 'extractionRpg';
        this.isPaused = true;
        this.random = typeof random === 'function' ? random : Math.random;
        this.targetingSystem = new TargetingSystem();
        this.runSystem = new ExpeditionRunSystem({ random: this.random, ...runOptions });
        this.worldSystem = new ExpeditionWorldSystem(worldOptions);
        this.cameraSystem = new CameraSystem({
            worldWidth: this.worldSystem.width,
            worldHeight: this.worldSystem.height,
            viewportWidth: 750,
            viewportHeight: 900
        });
        this.movementInput = { x: 0, y: 0 };
        this.nearbyLocation = null;
        this.lastNearbyLocationId = null;
        this.worldRevision = 0;
        this.runPreparation = { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        this.runLoadoutEffects = { armorDefense: 0, petGuard: 0, consumableSupplies: 0, consumed: [] };

        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        this.uiNotifyTimer = 0;
        this.extractionTimer = 0;
        this.extractionTotalDuration = 0;
        this.extractionOutOfZoneTimer = 0;
        this.extractionReinforcementTimer = 0;
        this.extractionReinforcementIntervalMs = 0;
        this.guardTimer = 0;
        this.supplyCooldownTimer = 0;
        this.timeSinceDamage = Infinity;
        this.runRegenTimer = 0;
        this.runDamageTaken = 0;
        this.returnPressure = { distance: 0, level: 0, triggers: 0 };
        this.petSquadSnapshot = null;
        this.petGuardHp = 0;
        this.petGuardMaxHp = 0;
        this.petRescueUsed = false;
        this.petRescueInvulnerabilityTimer = 0;
        this.runBossKills = 0;
        this.runEliteKills = 0;
        this.focusTargetId = null;
        this.weaponOrder = Object.keys(EXPEDITION_WEAPON_CONFIGS);
        this.activeWeaponId = this.weaponOrder[0];
        this.lockedWeaponId = null;
        this.weaponStates = this.createFreshWeaponStates();
        this.aimDirection = { x: 1, y: 0 };
        this.aimWorldPoint = null;
        this.firingHeld = false;
        // shotCooldownTimer 作为旧存档/旧调用的活动武器镜像保留；
        // 真正的射速约束记录在各 weaponState 上，切枪不能再清掉上一把枪的冷却。
        this.shotCooldownTimer = 0;
        this.weaponSwapLockTimer = 0;
        this.manualAimEnabled = true;
        this.legacyAutoAimEnabled = false;
        this.firstStrikePending = false;
        this.firstStrikeBonus = 0;

        this.monsterTemplates = [
            {
                id: 'slime', name: '史莱姆', image: MONSTER_CHARACTER_ART.slime.portrait,
                baseHp: 34, baseAttack: 7, speed: 54, coinReward: 8,
                crystalReward: 0, expReward: 5, size: 34, attackInterval: 1250
            },
            {
                id: 'bat', name: '疾风蝙蝠', image: MONSTER_CHARACTER_ART.bat.portrait,
                baseHp: 27, baseAttack: 8, speed: 82, coinReward: 11,
                crystalReward: 0, expReward: 7, size: 31, attackInterval: 1250,
                combatStyle: 'ranged', rangedRange: 280
            },
            {
                id: 'goblin', name: '哥布林', image: MONSTER_CHARACTER_ART.goblin.portrait,
                baseHp: 46, baseAttack: 10, speed: 62, coinReward: 14,
                crystalReward: 0, expReward: 9, size: 36, attackInterval: 1120,
                combatStyle: 'charger'
            },
            {
                id: 'skeleton', name: '重甲骷髅', image: MONSTER_CHARACTER_ART.skeleton.portrait,
                baseHp: 78, baseAttack: 14, speed: 42, coinReward: 20,
                crystalReward: 1, expReward: 14, size: 40, attackInterval: 1380
            },
            {
                id: 'demon', name: '深渊恶魔', image: MONSTER_CHARACTER_ART.demon.portrait,
                baseHp: 112, baseAttack: 19, speed: 48, coinReward: 32,
                crystalReward: 2, expReward: 24, size: 46, attackInterval: 1420,
                combatStyle: 'ranged', rangedRange: 330
            },
            {
                id: 'dragon', name: '核心守卫', image: MONSTER_CHARACTER_ART.dragon.portrait,
                baseHp: 560, baseAttack: 45, speed: 35, coinReward: 150,
                crystalReward: 10, expReward: 120, size: 64, attackInterval: 1550,
                isBoss: true, combatStyle: 'boss'
            }
        ];

        this.monsterImages = {};
        this.monsterAnimationSheets = {};
        this.monsterSpriteFrameSize = MONSTER_FRAME_SIZE;
        this.monsterSpriteFrameCount = MONSTER_FRAME_COUNT;
        this.combatStates = ['idle', 'move', 'attack'];
        this.preloadImages();

        this.config = {
            attackInterval: 720,
            bulletSpeed: 560,
            maxMonsters: 32,
            spawnInterval: 460,
            heroEngageRange: 64,
            skillGuardReduction: 0.42,
            heroMoveSpeed: 174,
            heroAttackRange: 475,
            // 旧自动瞄准字段保留为中性值；移动射击唯一惩罚由武器散布承担。
            heroMovingAttackRange: 475,
            movingAttackIntervalMultiplier: 1,
            movingDamageMultiplier: 1,
            petAcquireRange: 430,
            extractionOutOfZoneGraceMs: 750,
            extractionDecayMultiplier: 1.4,
            extractionReinforcementIntervalMs: 2600,
            supplyCooldownMs: 5000,
            supplyCombatSafeWindowMs: 1100,
            weaponSwapLockMs: 350,
            bossDamageRadius: 145,
            bossWarningRadius: 150,
            monsterHitboxVisualCoverage: 0.75
        };

        this.mapWidth = 750;
        this.mapHeight = 900;
        this.playerSystem = null;
        this.resourceSystem = null;
        this.territorySystem = null;
        this.petSystem = null;
        this.expeditionMetaSystem = null;
        this.onStateChange = null;
        this.skillCooldowns = new Map();

        this.runHp = 100;
        this.runMaxHp = 100;
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = false;
        this.meta = {
            bestDepth: 0,
            bestExtractedDepth: 0,
            extractions: 0,
            losses: 0,
            bossKills: 0,
            flawlessExtractions: 0,
            bestValue: 0,
            maxExpeditionPetCount: 0,
            contractFragments: 0,
            deepMaterials: 0
        };
        this.runSnapshot = null;

        console.log('[CombatSystem] 宠物远征模式初始化完成');
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
            if (image.complete && image.naturalWidth > 0) this.monsterImages[template.id] = image;

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
        return MONSTER_CHARACTER_ART[template.id]?.sprites?.[state]
            || `images/sprites/battle/monsters/${template.id}_${state}_sheet.png`;
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
    }

    setExpeditionMetaSystem(expeditionMetaSystem) {
        this.expeditionMetaSystem = expeditionMetaSystem || null;
    }

    setOnStateChange(callback) {
        this.onStateChange = typeof callback === 'function' ? callback : null;
    }

    setViewportSize(width, height) {
        this.mapWidth = Math.max(1, Math.floor(Number(width) || 1));
        this.mapHeight = Math.max(1, Math.floor(Number(height) || 1));
        this.cameraSystem.setViewportSize(this.mapWidth, this.mapHeight);
        if (this.playerSystem?.player && this.worldSystem.initialized) {
            this.constrainHeroToWorld(this.playerSystem.player);
            const center = this.getHeroCenter();
            this.cameraSystem.snapTo(center.x, center.y);
        }
    }

    getHeroVisualBounds(player = this.playerSystem?.player) {
        return getPlayerVisualBounds(player || this.getHeroPosition());
    }

    getHeroWorldPadding(player = this.playerSystem?.player) {
        if (!player) return 18;
        const visual = this.getHeroVisualBounds(player);
        const x = Number.isFinite(Number(player.x)) ? Number(player.x) : 0;
        const y = Number.isFinite(Number(player.y)) ? Number(player.y) : 0;
        const width = Math.max(0, Number(player.width) || 0);
        const height = Math.max(0, Number(player.height) || 0);
        const overflow = Math.max(
            18,
            x - visual.left,
            visual.right - (x + width),
            y - visual.top,
            visual.bottom - (y + height)
        );
        return Math.ceil(overflow + 2);
    }

    getHeroCameraInsets(player = this.playerSystem?.player) {
        const visual = this.getHeroVisualBounds(player);
        const center = this.getEntityCenter(player || this.getHeroPosition());
        return {
            left: Math.max(0, center.x - visual.left),
            right: Math.max(0, visual.right - center.x),
            top: Math.max(0, center.y - visual.top),
            bottom: Math.max(0, visual.bottom - center.y)
        };
    }

    constrainHeroToWorld(player = this.playerSystem?.player) {
        if (!player || !this.worldSystem.initialized) {
            return { moved: false, x: player?.x ?? 0, y: player?.y ?? 0 };
        }
        const result = this.worldSystem.clampEntityToBounds(player, {
            padding: this.getHeroWorldPadding(player)
        });

        return {
            moved: result.moved,
            x: player.x,
            y: player.y,
            clamped: result.moved
        };
    }

    getWorldBounds() {
        const padding = this.getHeroWorldPadding();
        return {
            minX: padding,
            minY: padding,
            maxX: this.worldSystem.width - padding,
            maxY: this.worldSystem.height - padding,
            width: this.worldSystem.width,
            height: this.worldSystem.height
        };
    }

    canMoveHero() {
        return Boolean(
            this.runSystem.active &&
            ['route', 'search', 'combat', 'extraction-ready', 'extracting'].includes(this.runSystem.phase)
        );
    }

    setMovementInput(x = 0, y = 0) {
        const safeX = Number.isFinite(Number(x)) ? Number(x) : 0;
        const safeY = Number.isFinite(Number(y)) ? Number(y) : 0;
        const length = Math.hypot(safeX, safeY);
        this.movementInput = length > 1
            ? { x: safeX / length, y: safeY / length }
            : { x: safeX, y: safeY };
        return { ...this.movementInput };
    }

    clearMovementInput() {
        this.movementInput = { x: 0, y: 0 };
        return { ...this.movementInput };
    }

    updateHeroMovement(player, deltaTime) {
        if (!player || this.isPaused || !this.canMoveHero()) {
            return { moved: false, blockedX: false, blockedY: false };
        }
        const length = Math.hypot(this.movementInput.x, this.movementInput.y);
        if (length <= 0.001) {
            this.updateWorldAwareness();
            return { moved: false, blockedX: false, blockedY: false };
        }

        const safeDelta = Math.max(0, Math.min(Number(deltaTime) || 0, 100));
        // 攻速不再大幅转化为移动速度，避免成长后重新形成永久风筝。
        const attackSpeed = this.runSnapshot?.player?.attackSpeed ?? player.attackSpeed ?? 1;
        const petMoveMultiplier = 1 + Math.max(0, Number(this.petSquadSnapshot?.auras?.moveSpeedPercent) || 0) / 100;
        const speed = (this.config.heroMoveSpeed + Math.min(24, Math.max(0, attackSpeed - 1) * 5)) * petMoveMultiplier;
        const scale = (speed * safeDelta) / 1000;
        const previousX = player.x;
        const previousY = player.y;
        const result = this.worldSystem.moveEntity(
            player,
            this.movementInput.x * scale,
            this.movementInput.y * scale,
            { padding: this.getHeroWorldPadding(player) }
        );
        if (result.moved && this.runSystem.activeSearch) {
            this.interruptSearch('movement');
        }
        // 返程压力只统计真正朝已解锁撤离点靠近的路程。
        // 解锁判断刻意忽略 pendingLootChoice 等临时操作门槛，避免带着待选物品返程时绕过压力；
        // 反向继续深入或尚未解锁任何撤离点时则不应被误算为返程。
        if (result.moved && this.isMovementTowardUnlockedExtraction(
            previousX,
            previousY,
            player.x,
            player.y,
            player
        )) {
            this.updateReturnPressure(Math.hypot(player.x - previousX, player.y - previousY));
        }
        this.updateWorldAwareness();
        return result;
    }

    getUnlockedExtractionLocationsForReturnPressure() {
        if (!this.runSystem.active) return [];
        return ['entry', 'emergency'].flatMap(extractionType => {
            const rule = this.runSystem.getExtractionRule?.(extractionType);
            if (!rule || this.runSystem.depth < rule.minDepth) return [];
            if ((Number(this.runSystem.supplies) || 0) < (Number(rule.supplyCost) || 0)) return [];
            const location = this.worldSystem.getLocation?.(rule.locationId);
            return location ? [location] : [];
        });
    }

    isMovementTowardUnlockedExtraction(previousX, previousY, nextX, nextY, entity = this.playerSystem?.player) {
        const targets = this.getUnlockedExtractionLocationsForReturnPressure();
        if (targets.length === 0) return false;
        const halfWidth = (Number(entity?.width) || 0) / 2;
        const halfHeight = (Number(entity?.height) || 0) / 2;
        const previousCenter = { x: previousX + halfWidth, y: previousY + halfHeight };
        const nextCenter = { x: nextX + halfWidth, y: nextY + halfHeight };
        return targets.some(location => {
            const before = Math.hypot(previousCenter.x - location.x, previousCenter.y - location.y);
            const after = Math.hypot(nextCenter.x - location.x, nextCenter.y - location.y);
            return after < before - 0.01;
        });
    }

    updateReturnPressure(distance) {
        const relief = Math.max(0, Number(this.runSystem.worldEventState?.returnPressureReduction) || 0);
        const stealth = Math.max(0, Number(this.runSystem.stealthCharges) || 0);
        const multiplier = Math.max(0.35, 1 - relief / 100 - stealth * 0.12);
        this.returnPressure.distance += Math.max(0, distance) * multiplier;
        this.returnPressure.level = Math.min(100, Math.floor(this.returnPressure.distance / 12));
        const nextTrigger = (this.returnPressure.triggers + 1) * 420;
        if (this.returnPressure.distance >= nextTrigger && this.returnPressure.triggers < 3) {
            this.returnPressure.triggers += 1;
            const threatGain = 3 + this.returnPressure.triggers * 2;
            this.runSystem.addThreat?.(threatGain);
            this.addBannerText(`返程巡逻警戒：威胁 +${threatGain}`, '#ffb36b');
        }
    }

    createFreshWeaponStates() {
        return Object.fromEntries(Object.values(EXPEDITION_WEAPON_CONFIGS).map(weapon => [
            weapon.id,
            {
                magazine: weapon.magazineSize,
                reserve: weapon.reserveAmmo,
                reloadRemainingMs: 0,
                shotCooldownRemainingMs: 0
            }
        ]));
    }

    resetWeaponLoadout() {
        this.activeWeaponId = this.weaponOrder[0];
        this.lockedWeaponId = null;
        this.weaponStates = this.createFreshWeaponStates();
        this.firingHeld = false;
        this.shotCooldownTimer = 0;
        this.weaponSwapLockTimer = 0;
        this.aimWorldPoint = null;
        this.aimDirection = { x: 1, y: 0 };
        return this.getWeaponState();
    }

    getWeaponConfig(weaponId = this.activeWeaponId) {
        return EXPEDITION_WEAPON_CONFIGS[weaponId] || null;
    }

    getEquippedWeaponProfile() {
        const metaState = this.expeditionMetaSystem?.getState?.();
        return metaState?.activeRaid?.loadoutSnapshot?.mainWeapon
            || metaState?.loadout?.mainWeapon
            || null;
    }

    getAllowedWeaponIds() {
        if (this.runSystem.active && this.getWeaponConfig(this.lockedWeaponId)) {
            return [this.lockedWeaponId];
        }
        const profile = this.getEquippedWeaponProfile();
        if (!profile) return [...this.weaponOrder];
        const configured = Array.isArray(profile.combatWeaponIds) && profile.combatWeaponIds.length
            ? profile.combatWeaponIds
            : [profile.combatWeaponId];
        const allowed = [...new Set(configured.map(String))]
            .filter(weaponId => this.getWeaponConfig(weaponId));
        return allowed.length ? allowed : [this.weaponOrder[0]];
    }

    getWeaponState() {
        const allowedWeaponIds = new Set(this.getAllowedWeaponIds());
        const weapons = this.weaponOrder.map(id => {
            const config = this.getWeaponConfig(id);
            const runtime = this.weaponStates[id] || {};
            return {
                ...config,
                magazine: Math.max(0, Math.floor(Number(runtime.magazine) || 0)),
                reserve: Math.max(0, Math.floor(Number(runtime.reserve) || 0)),
                reloadRemainingMs: Math.max(0, Number(runtime.reloadRemainingMs) || 0),
                shotCooldownRemainingMs: Math.max(0, Number(runtime.shotCooldownRemainingMs) || 0),
                reloading: (Number(runtime.reloadRemainingMs) || 0) > 0,
                available: allowedWeaponIds.has(id),
                active: id === this.activeWeaponId
            };
        });
        return {
            manualAim: this.manualAimEnabled,
            legacyAutoAim: this.legacyAutoAimEnabled,
            firing: this.firingHeld,
            activeWeaponId: this.activeWeaponId,
            allowedWeaponIds: [...allowedWeaponIds],
            shotCooldownMs: Math.max(0, Number(this.weaponStates[this.activeWeaponId]?.shotCooldownRemainingMs) || 0),
            swapLockRemainingMs: Math.max(0, this.weaponSwapLockTimer),
            fireBlockedRemainingMs: this.getActiveFireBlockMs(),
            aimDirection: { ...this.aimDirection },
            aimWorldPoint: this.aimWorldPoint ? { ...this.aimWorldPoint } : null,
            weapons,
            active: weapons.find(weapon => weapon.active) || null
        };
    }

    setAimWorldPosition(x, y, { screenSpace = false } = {}) {
        const safeX = Number(x);
        const safeY = Number(y);
        if (!Number.isFinite(safeX) || !Number.isFinite(safeY)) {
            return { success: false, message: '瞄准坐标无效' };
        }
        const point = screenSpace ? this.screenToWorld(safeX, safeY) : { x: safeX, y: safeY };
        const origin = this.getHeroCenter();
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;
        const length = Math.hypot(dx, dy);
        if (length <= 0.001) return { success: false, message: '瞄准方向无效' };
        this.aimWorldPoint = { x: point.x, y: point.y };
        this.aimDirection = { x: dx / length, y: dy / length };
        return { success: true, point: { ...this.aimWorldPoint }, direction: { ...this.aimDirection } };
    }

    setAimScreenPosition(x, y) {
        return this.setAimWorldPosition(x, y, { screenSpace: true });
    }

    setAimDirection(x, y) {
        const safeX = Number(x);
        const safeY = Number(y);
        const length = Math.hypot(safeX, safeY);
        if (!Number.isFinite(length) || length <= 0.001) {
            return { success: false, message: '瞄准方向无效' };
        }
        this.aimDirection = { x: safeX / length, y: safeY / length };
        this.aimWorldPoint = null;
        return { success: true, direction: { ...this.aimDirection } };
    }

    setFiring(held = false) {
        this.firingHeld = Boolean(held);
        return { success: true, firing: this.firingHeld };
    }

    startFiring() {
        return this.setFiring(true);
    }

    stopFiring() {
        return this.setFiring(false);
    }

    setLegacyAutoAim(enabled = false) {
        this.legacyAutoAimEnabled = Boolean(enabled);
        this.manualAimEnabled = !this.legacyAutoAimEnabled;
        if (this.legacyAutoAimEnabled) this.firingHeld = false;
        return { success: true, enabled: this.legacyAutoAimEnabled };
    }

    switchWeapon(weaponIdOrIndex) {
        const weaponId = Number.isInteger(weaponIdOrIndex)
            ? this.weaponOrder[weaponIdOrIndex]
            : String(weaponIdOrIndex || '');
        if (!this.getWeaponConfig(weaponId)) {
            return { success: false, message: '未知武器' };
        }
        if (
            this.runSystem.active
            && this.getWeaponConfig(this.lockedWeaponId)
            && weaponId !== this.lockedWeaponId
        ) {
            return {
                success: false,
                code: 'weapon-locked',
                message: `本次远征已锁定${this.getWeaponConfig(this.lockedWeaponId).name}`
            };
        }
        if (!this.getAllowedWeaponIds().includes(weaponId)) {
            return { success: false, message: '当前配装未携带该武器' };
        }
        if (weaponId === this.activeWeaponId) {
            if (!this.runSystem.active && !this.expeditionMetaSystem?.getState?.()?.activeRaid) {
                this.expeditionMetaSystem?.setWeaponMode?.(weaponId);
            }
            return { success: true, message: `当前已装备${this.getWeaponConfig(weaponId).name}`, weapon: this.getWeaponState().active };
        }
        const previousWeaponId = this.activeWeaponId;
        const previousState = this.weaponStates[previousWeaponId];
        const cancelledReload = (Number(previousState?.reloadRemainingMs) || 0) > 0;
        if (previousState) previousState.reloadRemainingMs = 0;
        this.activeWeaponId = weaponId;
        // 出发前的模式选择属于配装；远征中的切换只改变当前手持模式，不能回写
        // 局外配装或活动远征快照，否则“出发后锁定”会成为错误承诺。
        if (!this.runSystem.active && !this.expeditionMetaSystem?.getState?.()?.activeRaid) {
            this.expeditionMetaSystem?.setWeaponMode?.(weaponId);
        }
        // 每次真实切枪都需要完成举枪动作。各武器自己的射击冷却继续按真实时间推进，
        // 因此来回切枪既不能缩短精确枪射速，也不能让非当前武器在后台换弹。
        this.weaponSwapLockTimer = Math.max(
            this.weaponSwapLockTimer,
            Math.max(0, Number(this.config.weaponSwapLockMs) || 350)
        );
        this.cancelInactiveReloads();
        this.syncLegacyShotCooldownTimer();
        this.notifyStateChange();
        return {
            success: true,
            message: `已切换为${this.getWeaponConfig(weaponId).name}${cancelledReload ? '，原武器换弹已取消' : ''}`,
            weapon: this.getWeaponState().active,
            swapLockMs: this.weaponSwapLockTimer,
            cancelledReload
        };
    }

    reloadWeapon(weaponId = this.activeWeaponId) {
        const config = this.getWeaponConfig(weaponId);
        const state = this.weaponStates[weaponId];
        if (!config || !state) return { success: false, message: '未知武器' };
        if (weaponId !== this.activeWeaponId) {
            return { success: false, message: '只能为当前武器换弹' };
        }
        if (state.reloadRemainingMs > 0) return { success: false, message: '正在换弹' };
        if (state.magazine >= config.magazineSize) return { success: false, message: '弹匣已满' };
        if (state.reserve <= 0) return { success: false, message: '没有备用弹药' };
        state.reloadRemainingMs = config.reloadMs;
        this.notifyStateChange();
        return { success: true, message: `${config.name}开始换弹`, reloadMs: config.reloadMs };
    }

    updateWeaponTimers(deltaTime) {
        const safeDelta = Math.max(0, Number(deltaTime) || 0);
        this.weaponSwapLockTimer = Math.max(0, this.weaponSwapLockTimer - safeDelta);
        Object.entries(this.weaponStates).forEach(([weaponId, state]) => {
            state.shotCooldownRemainingMs = Math.max(
                0,
                (Number(state.shotCooldownRemainingMs) || 0) - safeDelta
            );
            if (weaponId !== this.activeWeaponId) {
                // 切走即取消换弹：不扣备用弹药，也不会在背包里自动完成。
                state.reloadRemainingMs = 0;
                return;
            }
            if ((state.reloadRemainingMs || 0) <= 0) return;
            const previous = state.reloadRemainingMs;
            state.reloadRemainingMs = Math.max(0, previous - safeDelta);
            if (previous > 0 && state.reloadRemainingMs <= 0) {
                const config = this.getWeaponConfig(weaponId);
                const needed = Math.max(0, config.magazineSize - state.magazine);
                const loaded = Math.min(needed, state.reserve);
                state.magazine += loaded;
                state.reserve -= loaded;
            }
        });
        this.syncLegacyShotCooldownTimer();
    }

    cancelInactiveReloads() {
        Object.entries(this.weaponStates).forEach(([weaponId, state]) => {
            if (weaponId !== this.activeWeaponId && state) state.reloadRemainingMs = 0;
        });
    }

    syncLegacyShotCooldownTimer() {
        this.shotCooldownTimer = Math.max(
            0,
            Number(this.weaponStates[this.activeWeaponId]?.shotCooldownRemainingMs) || 0
        );
        return this.shotCooldownTimer;
    }

    getActiveFireBlockMs() {
        const weaponCooldown = Math.max(
            0,
            Number(this.weaponStates[this.activeWeaponId]?.shotCooldownRemainingMs) || 0
        );
        return Math.max(weaponCooldown, Math.max(0, Number(this.weaponSwapLockTimer) || 0));
    }

    updateWorldAwareness() {
        if (!this.playerSystem?.player || !this.worldSystem.initialized) return null;
        const center = this.getHeroCenter();
        const nearby = this.worldSystem.updatePlayerPosition(center.x, center.y);
        const nearbyId = nearby?.id || null;
        this.nearbyLocation = nearby;
        if (nearbyId !== this.lastNearbyLocationId) {
            this.lastNearbyLocationId = nearbyId;
            this.worldRevision += 1;
            if (nearby) this.addStatusText(center.x, center.y - 54, `发现：${nearby.name}`, nearby.color || '#ffd167');
        }
        return nearby;
    }

    syncWorldWithRunState() {
        const run = this.runSystem.getState();
        this.worldSystem.syncRouteChoices(run.routeChoices);
        this.worldSystem.updateExtractionAvailability?.(run);
        if (run.phase === 'extraction-ready') {
            const preferredExtraction = run.extractionAvailability?.emergency?.canExtract
                ? 'emergency-extraction'
                : 'extraction-beacon';
            this.worldSystem.trackLocation(preferredExtraction);
        }
        this.worldRevision += 1;
        this.updateWorldAwareness();
        return this.worldSystem.getState(this.getHeroCenter());
    }

    trackLocation(nodeId) {
        const result = this.worldSystem.trackLocation(nodeId);
        if (result.success) {
            const center = this.getHeroCenter();
            const distance = this.worldSystem.getDistanceToLocation(result.location.id, center.x, center.y);
            const displayName = result.location.discovered || result.location.known || result.location.kind === 'extraction'
                ? result.location.name
                : '未知信号';
            result.message = `已追踪 ${displayName}，距离 ${Math.round(distance)} 米`;
            this.worldRevision += 1;
            this.notifyStateChange();
        }
        return result;
    }

    interactWithNearbyLocation() {
        if (!this.runSystem.active) return { success: false, message: '请先开始远征' };
        if (this.runSystem.pendingLootChoice) return { success: false, message: '请先处理背包中待取舍的战利品' };
        const nearby = this.updateWorldAwareness();
        const nearbyContainer = this.worldSystem.getContainer?.(this.worldSystem.nearbyContainerId);
        if (this.runSystem.phase === 'search' && nearbyContainer) {
            if (this.runSystem.activeSearch) {
                return { success: false, message: '搜索正在进行中' };
            }
            return this.searchArea('quick');
        }
        if (!nearby) return { success: false, message: '附近没有可交互地点' };
        if (nearby.kind === 'extraction') {
            const availability = this.runSystem.getExtractionAvailability?.(nearby.extractionType || nearby.id)
                || { canExtract: this.runSystem.canExtract?.(), message: '当前无法撤离' };
            if (!availability.canExtract) return { success: false, message: availability.message };
            return this.requestExtraction({ extractionType: nearby.extractionType || nearby.id });
        }
        if (nearby.kind === 'world-event') {
            if (!['route', 'extraction-ready'].includes(this.runSystem.phase)) {
                return { success: false, message: '战斗中无法调查支线信号' };
            }
            const consumed = this.worldSystem.consumeWorldEvent(nearby.id);
            if (!consumed.success) return consumed;
            const resolved = this.runSystem.resolveWorldEvent?.({
                ...(consumed.effect || {}),
                source: nearby.type || nearby.id
            }) || consumed;
            this.syncWorldWithRunState();
            this.notifyStateChange();
            return {
                ...resolved,
                success: true,
                message: `${consumed.message}。${resolved.message || ''}`.trim()
            };
        }
        if (this.runSystem.phase !== 'route') {
            return { success: false, message: '请先完成当前地点事件' };
        }
        return this.chooseRoute(nearby.nodeId, { requireProximity: true });
    }

    screenToWorld(x, y) {
        return this.cameraSystem.screenToWorld(x, y);
    }

    getInteractionState() {
        const center = this.getHeroCenter();
        const nearby = this.nearbyLocation;
        const nearbyContainer = this.worldSystem.getContainer?.(this.worldSystem.nearbyContainerId);
        if (this.runSystem.phase === 'search' && nearbyContainer) {
            const activeSearch = this.runSystem.getSearchState?.();
            return {
                available: !activeSearch && nearbyContainer.state === 'available',
                label: activeSearch ? `正在搜索 ${nearbyContainer.name}` : `搜索 ${nearbyContainer.name}`,
                detail: activeSearch
                    ? `进度 ${Math.floor((activeSearch.progress || 0) * 100)}%`
                    : '按 E 快速搜索，或在面板选择搜索方式',
                location: { ...nearbyContainer }
            };
        }
        if (this.runSystem.phase === 'search') {
            const targetContainer = this.worldSystem.getContainersForLocation?.(
                this.worldSystem.activeLocationId,
                { includeFinished: false }
            )?.[0] || null;
            const distance = targetContainer
                ? Math.max(0, Math.round(Math.hypot(targetContainer.x - center.x, targetContainer.y - center.y)))
                : null;
            return {
                available: false,
                label: '靠近搜索点',
                detail: targetContainer
                    ? `继续向地点内的容器移动 · ${distance}m`
                    : '当前地点没有可用的搜索点',
                location: targetContainer ? { ...targetContainer } : null
            };
        }
        if (!nearby) {
            const target = this.worldSystem.getState(center).navigationTarget;
            return {
                available: false,
                label: '靠近地点后交互',
                detail: target ? `追踪 ${target.name} · ${target.distance}m` : 'WASD / 方向键移动',
                location: null
            };
        }
        const extractionAvailability = nearby.kind === 'extraction'
            ? this.runSystem.getExtractionAvailability?.(nearby.extractionType || nearby.id)
            : null;
        const extractionBlocked = nearby.kind === 'extraction' && !extractionAvailability?.canExtract;
        const eventLocation = nearby.kind === 'world-event';
        const validPhase = nearby.kind === 'extraction' || eventLocation
            ? ['route', 'extraction-ready'].includes(this.runSystem.phase)
            : this.runSystem.phase === 'route';
        return {
            available: !extractionBlocked && validPhase,
            label: extractionBlocked
                ? '撤离信标尚未解锁'
                : nearby.kind === 'extraction'
                    ? '启动撤离信标'
                    : eventLocation
                        ? `调查 ${nearby.name}`
                    : `进入 ${nearby.name}`,
            detail: extractionBlocked
                ? (extractionAvailability?.message || '当前撤离点不可用')
                : eventLocation ? `${nearby.danger || '可选支线'} · 按 E 调查` : '按 E 或点击交互',
            location: { ...nearby }
        };
    }

    prepareBattle() {
        if (!this.battleInitialized) this.resetBattle();
        else {
            this.updateWorldAwareness();
            this.notifyStateChange();
        }
        return this.getBattleState();
    }

    resetBattle() {
        this.clearEncounter();
        this.resetWeaponLoadout();
        const loadoutWeaponId = this.expeditionMetaSystem?.getLoadout?.()?.mainWeapon?.combatWeaponId;
        if (loadoutWeaponId && this.getWeaponConfig(loadoutWeaponId)) {
            this.activeWeaponId = loadoutWeaponId;
        }
        this.petSystem?.resetBattleStates?.();
        this.runSystem.reset();
        this.worldSystem.reset();
        this.clearMovementInput();
        this.nearbyLocation = null;
        this.lastNearbyLocationId = null;
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.runSnapshot = null;
        this.runPreparation = { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        this.runLoadoutEffects = { armorDefense: 0, petGuard: 0, consumableSupplies: 0, consumed: [] };
        this.skillCooldowns.clear();
        this.guardTimer = 0;
        this.supplyCooldownTimer = 0;
        this.timeSinceDamage = Infinity;
        this.runRegenTimer = 0;
        this.runDamageTaken = 0;
        this.returnPressure = { distance: 0, level: 0, triggers: 0 };
        this.petSquadSnapshot = null;
        this.petGuardHp = 0;
        this.petGuardMaxHp = 0;
        this.petRescueUsed = false;
        this.petRescueInvulnerabilityTimer = 0;
        this.runBossKills = 0;
        this.runEliteKills = 0;
        this.lastSettlement = null;
        this.settled = false;
        this.battleInitialized = true;
        this.placeHeroAtCamp({ force: true });
        this.notifyStateChange();
        return { success: true, message: '远征已就绪' };
    }

    startRun() {
        const requestedWeaponId = this.activeWeaponId;
        const staleMetaRaid = this.expeditionMetaSystem?.getState?.()?.activeRaid || null;
        if (!this.battleInitialized) this.resetBattle();
        const phase = this.runSystem.phase;
        if (phase === 'extracted' || phase === 'defeat') this.resetBattle();
        if (this.runSystem.active) return { success: false, message: '远征已经开始' };
        if (staleMetaRaid) {
            this.expeditionMetaSystem?.resolveRaidLoadout?.({ extracted: false });
        }

        const permanentBonuses = this.territorySystem?.calculateBonuses?.() || {};
        const preparedBonuses = this.territorySystem?.getPreparedBonuses?.()
            || { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        const metaLoadout = this.expeditionMetaSystem?.getLoadout?.() || null;
        const equippedConsumables = (metaLoadout?.consumables || [])
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item && Number(item.supplyValue) > 0);
        const consumableSupplies = equippedConsumables.reduce(
            (sum, { item }) => sum + Math.max(0, Math.floor(Number(item.supplyValue) || 0)),
            0
        );
        const result = this.runSystem.startRun({
            supplies: 2 + (permanentBonuses.supplyBonus || 0) + (preparedBonuses.supplies || 0) + consumableSupplies,
            backpackCapacity: 8
        });
        if (!result.success) return result;
        const consumedPreparation = this.territorySystem?.consumePreparedBonuses?.()
            || { ...preparedBonuses };
        const armorDefense = Math.max(0, Math.floor(Number(metaLoadout?.armor?.defenseBonus) || 0));
        const petGuardBonus = Math.max(0, Math.floor(Number(metaLoadout?.petLinker?.guardBonus) || 0));
        this.runPreparation = {
            ...consumedPreparation,
            defense: Math.max(0, Number(consumedPreparation.defense) || 0) + armorDefense
        };
        this.runLoadoutEffects = {
            armorDefense,
            petGuard: petGuardBonus,
            consumableSupplies,
            consumed: []
        };
        this.runSnapshot = this.captureRunSnapshot(permanentBonuses, this.runPreparation);
        this.clearEncounter();
        this.resetWeaponLoadout();
        const loadoutWeaponId = metaLoadout?.mainWeapon?.combatWeaponId
            || (this.getWeaponConfig(requestedWeaponId) ? requestedWeaponId : this.weaponOrder[0]);
        if (loadoutWeaponId && this.getWeaponConfig(loadoutWeaponId)) {
            this.activeWeaponId = loadoutWeaponId;
        }
        this.lockedWeaponId = this.activeWeaponId;
        this.petSystem?.resetBattleStates?.();
        this.runMaxHp = this.calculateRunMaxHp();
        this.runHp = this.runMaxHp;
        this.skillCooldowns.clear();
        this.supplyCooldownTimer = 0;
        this.timeSinceDamage = Infinity;
        this.runRegenTimer = 0;
        this.runDamageTaken = 0;
        this.returnPressure = { distance: 0, level: 0, triggers: 0 };
        this.petSquadSnapshot = this.petSystem?.getCombatSupportSnapshot?.()
            || this.petSystem?.getExpeditionSquadSnapshot?.()
            || null;
        this.meta.maxExpeditionPetCount = Math.max(
            this.meta.maxExpeditionPetCount || 0,
            Number(this.petSquadSnapshot?.count ?? this.petSquadSnapshot?.members?.length) || 0
        );
        this.petGuardMaxHp = Math.max(
            0,
            Math.floor(this.petSquadSnapshot?.guardCapacity || 0) + petGuardBonus
        );
        this.petGuardHp = this.petGuardMaxHp;
        this.petRescueUsed = false;
        this.petRescueInvulnerabilityTimer = 0;
        this.runBossKills = 0;
        this.runEliteKills = 0;
        this.lastSettlement = null;
        this.settled = false;
        this.worldSystem.startRun(this.runSystem.getState().routeChoices);
        const metaRaid = this.expeditionMetaSystem?.startRaid?.();
        if (metaRaid?.success) {
            this.runLoadoutEffects.consumed = equippedConsumables.map(({ item, index }) => {
                const used = this.expeditionMetaSystem.markConsumableUsed?.(index, 1);
                return {
                    instanceId: item.instanceId,
                    name: item.name,
                    index,
                    quantity: used?.used || 0,
                    supplyValue: Math.max(0, Math.floor(Number(item.supplyValue) || 0))
                };
            }).filter(item => item.quantity > 0);
        }
        this.placeHeroAtCamp({ force: true });
        this.syncWorldWithRunState();
        this.addBannerText('远征开始', '#ffd167');
        this.notifyStateChange();
        return result;
    }

    startExpedition() {
        return this.startRun();
    }

    chooseRoute(nodeId, { requireProximity = false } = {}) {
        if (this.runSystem.pendingLootChoice) return { success: false, message: '请先处理背包中待取舍的战利品' };
        if (requireProximity && this.nearbyLocation?.nodeId !== nodeId) {
            return { success: false, message: '请先走到目标地点附近' };
        }
        const result = this.runSystem.chooseNode(nodeId);
        if (result.success) {
            this.worldSystem.engageLocation(nodeId);
            this.worldRevision += 1;
            if (result.encounter) this.beginEncounter(result.encounter);
        }
        this.notifyStateChange();
        return result;
    }

    searchArea(mode) {
        if (this.runSystem.pendingLootChoice) return { success: false, message: '请先处理背包中待取舍的战利品' };
        if (this.runSystem.activeSearch) return { success: false, message: '搜索正在进行中' };
        const nearbyContainerId = this.worldSystem.nearbyContainerId || null;
        const activeContainers = this.worldSystem.getContainersForLocation?.(
            this.worldSystem.activeLocationId,
            { includeFinished: false }
        ) || [];
        let containerResult = null;
        if (activeContainers.length > 0) {
            containerResult = this.worldSystem.beginContainerSearch?.(nearbyContainerId);
            if (!containerResult?.success) {
                return containerResult || { success: false, message: '需要靠近容器才能搜索' };
            }
        }
        const context = containerResult?.context || {};
        const result = this.runSystem.beginSearch(mode, {
            hasPet: Boolean(this.petSystem?.equippedPets?.length),
            searchBonuses: this.petSystem?.getExplorationSearchBonuses?.(mode) || {},
            containerId: context.containerId || null,
            completeNode: context.completeNode,
            isLastContainer: context.isLastContainer
        });
        if (!result.success && containerResult?.success) {
            this.worldSystem.cancelContainerSearch?.(context.containerId, 'start-failed');
        }
        this.notifyStateChange();
        return result;
    }

    updateActiveSearch(deltaTime) {
        if (!this.runSystem.activeSearch) return null;
        const result = this.runSystem.updateSearch(deltaTime);
        if (!result?.completed) return result;
        if (result.containerId) {
            this.worldSystem.completeContainerSearch?.(result.containerId);
            this.worldRevision += 1;
        }
        if (result.encounter) {
            this.beginEncounter(result.encounter);
        } else if (result.nodeCompleted) {
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        } else {
            this.updateWorldAwareness();
        }
        this.notifyStateChange();
        return result;
    }

    cancelSearch(reason = 'cancelled') {
        const activeSearch = this.runSystem.getSearchState?.();
        const result = this.runSystem.cancelSearch?.(reason)
            || { success: false, message: '当前没有进行中的搜索' };
        if (result.success && activeSearch?.containerId) {
            this.worldSystem.cancelContainerSearch?.(activeSearch.containerId, reason);
            this.worldRevision += 1;
        }
        this.notifyStateChange();
        return result;
    }

    interruptSearch(reason = 'damage') {
        const activeSearch = this.runSystem.getSearchState?.();
        const result = this.runSystem.interruptSearch?.(reason)
            || { success: false, message: '当前没有进行中的搜索' };
        if (result.success && activeSearch?.containerId) {
            this.worldSystem.cancelContainerSearch?.(activeSearch.containerId, reason);
            this.worldRevision += 1;
        }
        this.notifyStateChange();
        return result;
    }

    searchCurrentArea(mode = 'quick') {
        return this.searchArea(mode);
    }

    restAtCamp() {
        const result = this.runSystem.restAtCamp();
        if (result.success) {
            const heal = Math.max(1, Math.ceil(this.runMaxHp * result.healRatio));
            this.healHero(heal);
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        }
        this.notifyStateChange();
        return result;
    }

    leaveCamp() {
        const result = this.runSystem.leaveCamp();
        if (result.success) {
            this.worldSystem.completeActiveLocation();
            this.syncWorldWithRunState();
        }
        this.notifyStateChange();
        return result;
    }

    requestExtraction(options = {}) {
        if (this.runSystem.pendingLootChoice) return { success: false, message: '请先处理背包中待取舍的战利品' };
        const nearby = this.updateWorldAwareness();
        if (this.worldSystem.initialized && nearby?.kind !== 'extraction') {
            return { success: false, message: '请先靠近一个可用撤离点' };
        }
        const requestedType = typeof options === 'string'
            ? options
            : options.extractionType || options.locationId || nearby?.extractionType || nearby?.id || 'entry';
        if (
            this.worldSystem.initialized
            && nearby?.kind === 'extraction'
            && this.runSystem.normalizeExtractionType?.(requestedType) !== this.runSystem.normalizeExtractionType?.(nearby.extractionType || nearby.id)
        ) {
            return { success: false, message: '当前所在位置与选择的撤离点不符' };
        }
        const result = this.runSystem.startExtraction({ extractionType: requestedType });
        if (result.success) {
            this.worldSystem.activateExtraction(result.extractionType || requestedType);
            this.extractionTimer = result.durationMs;
            this.extractionTotalDuration = result.durationMs;
            this.extractionOutOfZoneTimer = 0;
            this.extractionReinforcementIntervalMs = Math.max(
                1200,
                Number(result.encounter?.reinforcementIntervalMs) || this.config.extractionReinforcementIntervalMs
            );
            this.extractionReinforcementTimer = this.extractionReinforcementIntervalMs;
            this.beginEncounter({ ...result.encounter, durationMs: result.durationMs });
            this.addBannerText(
                result.extractionType === 'emergency' ? '应急撤离启动' : '入口信标启动',
                result.extractionType === 'emergency' ? '#ffb36b' : '#72d7ff'
            );
        }
        this.notifyStateChange();
        return result;
    }

    useSupply() {
        if (this.runHp >= this.runMaxHp) return { success: false, message: '远征生命已满' };
        if (this.supplyCooldownTimer > 0) {
            return { success: false, message: `补给冷却中（${Math.ceil(this.supplyCooldownTimer / 1000)}秒）` };
        }
        if (this.isCombatActive() && this.timeSinceDamage < this.config.supplyCombatSafeWindowMs) {
            return { success: false, message: '刚受到攻击，先脱离火力再使用补给' };
        }
        const result = this.runSystem.spendSupply();
        if (result.success) {
            const hpRegen = Math.max(
                0,
                Number(this.runSnapshot?.player?.hpRegen ?? this.playerSystem?.player?.hpRegen) || 0
            );
            const regenBonus = Math.min(0.2, hpRegen * 0.01);
            const heal = Math.max(1, Math.ceil(this.runMaxHp * result.healRatio * (1 + regenBonus)));
            const actualHeal = this.healHero(heal);
            result.regenBonusPercent = Math.round(regenBonus * 100);
            result.message = `使用补给，恢复 ${actualHeal} 点生命`;
            this.supplyCooldownTimer = this.config.supplyCooldownMs;
            this.worldSystem.updateExtractionAvailability?.(this.runSystem.getState());
            this.worldRevision += 1;
        }
        this.notifyStateChange();
        return result;
    }

    useMedkit() {
        return this.useSupply();
    }

    resolveLootChoice(action, replaceItemId = null) {
        const result = this.runSystem.resolveLootChoice?.(action, replaceItemId)
            || { success: false, message: '背包取舍功能不可用' };
        this.notifyStateChange();
        return result;
    }

    toggleLootInsurance(itemId) {
        const item = this.runSystem.backpack?.find(entry => entry.id === itemId);
        const result = item?.insured
            ? this.runSystem.unprotectLoot?.(itemId)
            : this.runSystem.protectLoot?.(itemId);
        this.notifyStateChange();
        return result || { success: false, message: '未找到该战利品' };
    }

    usePetSkill(instanceId) {
        if (!this.isCombatActive()) return { success: false, message: '宠物技能只能在战斗中使用' };
        const leaderInstanceId = this.petSquadSnapshot?.members?.[0]?.instanceId
            ?? this.petSystem?.equippedPets?.[0]?.instanceId
            ?? null;
        if (leaderInstanceId === null || String(instanceId) !== String(leaderInstanceId)) {
            return { success: false, code: 'leader-skill-only', message: '本次远征只能使用队长宠物的主动技能' };
        }
        const pet = this.petSystem?.equippedPets?.find(item => String(item.instanceId) === String(instanceId));
        if (!pet) return { success: false, message: '该宠物未上阵' };
        const template = this.petSystem?.getTemplate?.(pet.templateId);
        if (!template) return { success: false, message: '宠物数据不存在' };

        const remaining = this.skillCooldowns.get(pet.instanceId) || 0;
        if (remaining > 0) {
            return { success: false, message: `${template.skill.name}还需 ${(remaining / 1000).toFixed(1)} 秒` };
        }

        const targets = this.getTargets(this.getHeroCenter(), {
            strategy: 'nearest',
            limit: 4,
            maxRange: this.config.petAcquireRange
        });
        const type = template.type || 'default';
        const levelScale = 1 + Math.max(0, (pet.level || 1) - 1) * 0.1;
        const baseDamage = Math.max(
            1,
            Math.floor(((template.skill?.damage || template.baseStats?.attack * 2 || 20) * levelScale))
        );
        let affected = 0;

        if (type === 'light') {
            const heal = Math.max(12, Math.floor((template.skill?.heal || 50) * levelScale));
            affected = this.healHero(heal);
            this.addBannerText(`${template.name} · ${template.skill.name}`, PET_ROLE_COLORS.light);
        } else if (targets.length === 0) {
            return { success: false, message: '当前没有可攻击的目标' };
        } else if (type === 'fire' || type === 'phoenix') {
            targets.forEach((target, index) => {
                if (this.applyDamage(target, baseDamage * (index === 0 ? 1.25 : 0.72))) affected += 1;
            });
        } else if (type === 'ice') {
            targets.forEach(target => {
                if (this.applyDamage(target, baseDamage * 0.72)) affected += 1;
                target.slowFactor = 0.48;
                target.slowTimer = Math.max(target.slowTimer || 0, 3200);
            });
        } else if (type === 'earth') {
            targets.forEach(target => {
                if (this.applyDamage(target, baseDamage * 0.82)) affected += 1;
                target.stunTimer = Math.max(target.stunTimer || 0, 700);
            });
            this.guardTimer = 4200;
        } else if (type === 'thunder' || type === 'wind') {
            targets.slice(0, 3).forEach((target, index) => {
                if (this.applyDamage(target, baseDamage * Math.max(0.55, 1 - index * 0.2))) affected += 1;
                if (type === 'wind') target.stunTimer = Math.max(target.stunTimer || 0, 320);
            });
        } else if (type === 'dark') {
            const target = targets[0];
            const executeScale = target.hp / target.maxHp <= 0.35 ? 1.8 : 1;
            if (this.applyDamage(target, baseDamage * executeScale, { isCrit: executeScale > 1 })) affected = 1;
        } else if (this.applyDamage(targets[0], baseDamage)) {
            affected = 1;
        }

        const cooldownReduction = Math.min(
            0.2,
            Math.max(0, (this.runSnapshot?.territory?.petCooldownReduction || 0) / 100)
        );
        const cooldown = Math.max(
            3000,
            Math.floor((template.skill?.cooldown || 6000) * (1 - cooldownReduction))
        );
        this.skillCooldowns.set(pet.instanceId, cooldown);
        const color = PET_ROLE_COLORS[type] || PET_ROLE_COLORS.default;
        this.addBannerText(`${template.name} · ${template.skill?.name || '伙伴技能'}`, color);
        this.notifyStateChange();
        return {
            success: true,
            message: type === 'light'
                ? `${template.skill.name}恢复 ${affected} 点生命`
                : `${template.skill?.name || '伙伴技能'}命中 ${affected} 个目标`
        };
    }

    abandonRun() {
        if (!this.runSystem.active) return { success: false, message: '当前没有进行中的远征' };
        const dangerousExit = this.isCombatActive();
        const settlement = this.finishExpedition(false, dangerousExit ? 'defeated' : 'abandoned');
        return {
            success: true,
            message: dangerousExit ? '战斗中撤退，按战败结算' : '已放弃本局并结算保底收益',
            settlement
        };
    }

    restartBattle() {
        if (this.runSystem.active) {
            return { success: false, message: '远征进行中，请先使用“放弃本局”' };
        }
        return this.resetBattle();
    }

    // 旧入口兼容：不再存在波次、塔位和基地升级。
    startNextWave() {
        return this.startRun();
    }

    upgradeSelectedTower() {
        return { success: false, message: '远征模式中请使用宠物主动技能' };
    }

    repairBase() {
        return this.useSupply();
    }

    selectTowerAt(x, y) {
        return this.selectTargetAt(x, y);
    }

    selectTargetAt(x, y, { screenSpace = true } = {}) {
        if (!this.isCombatActive()) return { success: false, message: '' };
        const point = screenSpace ? this.screenToWorld(x, y) : { x, y };
        const target = this.monsters
            .map(monster => ({
                monster,
                hitbox: this.getMonsterHitbox(monster),
                distance: Math.hypot(
                    point.x - (monster.x + monster.width / 2),
                    point.y - (monster.y + monster.height / 2)
                )
            }))
            .filter(item => item.distance <= Math.max(34, item.hitbox.width / 2, item.hitbox.height / 2))
            .sort((a, b) => a.distance - b.distance)[0]?.monster;
        if (!target) return { success: false, message: '' };
        this.focusTargetId = target.id;
        this.notifyStateChange();
        return { success: true, message: `已锁定 ${target.name}` };
    }

    selectTargetAtWorld(x, y) {
        return this.selectTargetAt(x, y, { screenSpace: false });
    }

    update(deltaTime) {
        if (!this.battleInitialized) this.resetBattle();
        const safeDelta = Math.max(0, Math.min(deltaTime, 100));
        this.guardTimer = Math.max(0, this.guardTimer - safeDelta);
        this.petRescueInvulnerabilityTimer = Math.max(0, this.petRescueInvulnerabilityTimer - safeDelta);
        this.supplyCooldownTimer = Math.max(0, this.supplyCooldownTimer - safeDelta);
        this.timeSinceDamage = Math.min(60000, this.timeSinceDamage + safeDelta);
        this.uiNotifyTimer += safeDelta;
        const movement = this.updateHeroMovement(this.playerSystem?.player, safeDelta);
        this.playerSystem?.setCombatState?.(movement.moved ? 'move' : 'idle');

        if (this.runSystem.active && !this.isPaused) {
            this.updateWeaponTimers(safeDelta);
            this.updateRunRegeneration(safeDelta);
            this.updateActiveSearch(safeDelta);
        }

        if (this.isCombatActive()) {
            // 宠物技能只在真实战斗时间推进，路线规划/切场景不能白等冷却。
            this.updateSkillCooldowns(safeDelta);
            this.updateEncounterSpawns(safeDelta);
            this.updateAttack(safeDelta);
            this.updateMonsters(safeDelta);
            this.updateBullets(safeDelta);

            if (this.runSystem.phase === 'extracting') {
                const inZone = this.isHeroInExtractionZone();
                const contested = this.isExtractionContested();
                if (inZone && !contested) {
                    this.extractionOutOfZoneTimer = 0;
                    this.extractionTimer = Math.max(0, this.extractionTimer - safeDelta);
                } else if (!inZone) {
                    this.extractionOutOfZoneTimer += safeDelta;
                } else {
                    this.extractionOutOfZoneTimer = 0;
                }
                this.updateExtractionPressure(safeDelta);
                if (this.extractionTimer <= 0 && !this.settled) this.finishExpedition(true, 'extracted');
            } else if (
                this.runSystem.phase === 'combat' &&
                this.currentEncounter &&
                this.encounterQueue.length === 0 &&
                this.monsters.length === 0
            ) {
                this.finishEncounter();
            }
        }

        this.updateExplosions(safeDelta);
        this.updateCombatTexts(safeDelta);
        if (this.playerSystem?.player && this.worldSystem.initialized) {
            const center = this.getHeroCenter();
            this.cameraSystem.follow(
                center.x,
                center.y,
                safeDelta,
                this.getHeroCameraInsets(this.playerSystem.player)
            );
        }
        if (this.uiNotifyTimer >= 250) {
            this.uiNotifyTimer %= 250;
            this.notifyStateChange();
        }
    }

    isHeroInExtractionZone() {
        const location = this.getActiveExtractionLocation();
        if (!location) return false;
        const hero = this.getHeroCenter();
        return Math.hypot(hero.x - location.x, hero.y - location.y)
            <= location.radius + this.worldSystem.interactionRadius;
    }

    isExtractionContested() {
        const location = this.getActiveExtractionLocation();
        if (!location) return false;
        return this.monsters.some(monster => {
            const center = this.getEntityCenter(monster);
            return Math.hypot(center.x - location.x, center.y - location.y)
                <= location.radius + this.worldSystem.interactionRadius * 0.65;
        });
    }

    getActiveExtractionLocation() {
        const activeLocationId = this.worldSystem.activeExtractionLocationId
            || this.runSystem.getExtractionRule?.(this.runSystem.activeExtractionType)?.locationId
            || 'extraction-beacon';
        return this.worldSystem.getLocation(activeLocationId);
    }

    updateExtractionPressure(deltaTime) {
        this.extractionReinforcementTimer -= deltaTime;
        if (this.extractionReinforcementTimer > 0) return;
        const depth = Math.max(1, this.runSystem.depth || 1);
        const threat = this.runSystem.threat || 0;
        const count = 1 + Math.floor(threat / 45);
        const available = depth >= 5 ? ['bat', 'goblin', 'demon'] : ['bat', 'goblin'];
        for (let index = 0; index < count && this.monsters.length < this.config.maxMonsters; index += 1) {
            this.spawnMonster({
                templateId: available[Math.floor(this.random() * available.length)],
                elite: threat >= 70 && index === 0,
                depth
            }, depth);
        }
        this.extractionReinforcementTimer = Math.max(
            1200,
            (this.extractionReinforcementIntervalMs || this.config.extractionReinforcementIntervalMs) - threat * 4
        );
    }

    beginEncounter(spec = {}) {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.focusTargetId = null;
        this.currentEncounter = { ...spec };
        this.encounterQueue = this.buildEncounterQueue(spec);
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        Object.values(this.weaponStates).forEach(state => {
            state.shotCooldownRemainingMs = 0;
        });
        this.shotCooldownTimer = 0;
        this.weaponSwapLockTimer = 0;
        this.firingHeld = false;
        this.firstStrikeBonus = Math.max(0, Math.min(1, Number(spec.playerAdvantage?.firstStrikeBonus) || 0));
        this.firstStrikePending = this.firstStrikeBonus > 0;
        this.uiNotifyTimer = 0;
        this.addBannerText(this.getEncounterTitle(spec.type), spec.boss ? '#ff7043' : '#ffd167');
    }

    buildEncounterQueue(spec = {}) {
        const depth = Math.max(1, Math.floor(spec.depth || 1));
        const enemyCount = Math.max(1, Math.floor(spec.enemyCount || 3));
        const eliteCount = Math.max(0, Math.floor(spec.eliteCount || 0));
        const available = ['slime', 'bat', 'goblin'];
        if (depth >= 3) available.push('skeleton');
        if (depth >= 5 || spec.type === 'elite' || spec.type === 'extraction') available.push('demon');

        const queue = [];
        const normalCount = Math.max(0, enemyCount - (spec.boss ? 1 : 0));
        for (let index = 0; index < normalCount; index += 1) {
            queue.push({
                templateId: available[Math.floor(this.random() * available.length)],
                elite: index < eliteCount,
                depth
            });
        }
        if (spec.boss) queue.push({ templateId: 'dragon', boss: true, depth });
        return queue;
    }

    updateEncounterSpawns(deltaTime) {
        if (this.encounterQueue.length === 0 || this.monsters.length >= this.config.maxMonsters) return;
        this.encounterSpawnTimer -= deltaTime;
        if (this.encounterSpawnTimer > 0) return;
        const spec = this.encounterQueue.shift();
        this.spawnMonster(spec, spec.depth);
        this.encounterSpawnTimer = this.config.spawnInterval;
        this.notifyStateChange();
    }

    spawnMonster(spec = null, depthNumber = null) {
        if (this.monsters.length >= this.config.maxMonsters) return null;
        const normalizedSpec = typeof spec === 'string' ? { templateId: spec } : (spec || { templateId: 'slime' });
        const template = this.monsterTemplates.find(item => item.id === normalizedSpec.templateId)
            || this.monsterTemplates[0];
        const depth = Math.max(1, depthNumber || normalizedSpec.depth || this.runSystem.depth + 1);
        const threat = this.runSystem.threat || 0;
        const depthScale = 1 + (depth - 1) * 0.16;
        const threatScale = 1 + threat * 0.006;
        const eliteScale = normalizedSpec.elite ? 1.65 : 1;
        const bossScale = template.isBoss ? 1 + Math.max(0, depth - 5) * 0.08 : 1;
        const size = template.size * (normalizedSpec.elite && !template.isBoss ? 1.14 : 1);
        const maxHp = Math.max(1, Math.floor(template.baseHp * depthScale * threatScale * eliteScale * bossScale));
        const activeLocation = this.worldSystem.getLocation(this.worldSystem.activeLocationId);
        const hero = this.getHeroCenter();
        const spawnOrigin = activeLocation
            ? { x: activeLocation.x, y: activeLocation.y }
            : hero;
        const spawnPosition = this.worldSystem.findOpenPositionNear(
            spawnOrigin,
            260 + this.random() * 170,
            this.random() * Math.PI * 2,
            size
        );

        const monster = {
            id: this.nextMonsterId++,
            templateId: template.id,
            name: template.name,
            x: spawnPosition.x,
            y: spawnPosition.y,
            width: size,
            height: size,
            hp: maxHp,
            maxHp,
            attack: Math.max(1, Math.floor(template.baseAttack * depthScale * threatScale * eliteScale)),
            speed: template.speed * (1 + Math.min(0.28, threat * 0.0025)),
            coinReward: Math.max(1, Math.floor(template.coinReward * depthScale * eliteScale)),
            crystalReward: Math.max(0, Math.floor((template.crystalReward || 0) * eliteScale)),
            expReward: Math.max(1, Math.floor(template.expReward * depthScale * eliteScale)),
            attackInterval: Math.max(620, template.attackInterval / (1 + threat * 0.002)),
            attackCooldown: 260 + this.random() * 420,
            engageRange: Math.max(42, size * 0.9),
            isBoss: Boolean(template.isBoss || normalizedSpec.boss),
            isElite: Boolean(normalizedSpec.elite),
            combatStyle: template.combatStyle || 'melee',
            rangedRange: template.rangedRange || 0,
            chargeCooldown: 900 + this.random() * 700,
            chargeTelegraph: 0,
            chargeVector: null,
            bossAbilityTimer: template.isBoss ? 1800 : 0,
            bossTelegraphTimer: 0,
            bossTarget: null,
            pathDirection: this.random() < 0.5 ? -1 : 1,
            slowFactor: 1,
            slowTimer: 0,
            stunTimer: 0,
            animationOffset: this.random() * 400,
            animationStateTime: 0,
            combatState: 'move',
            progress: 0,
            rewardGranted: false
        };
        this.monsters.push(monster);
        return monster;
    }

    updateAttack(deltaTime) {
        if (!this.playerSystem || this.isPaused) return;
        if (!this.legacyAutoAimEnabled) {
            if (!this.firingHeld || this.getActiveFireBlockMs() > 0) return;
            this.fireCurrentWeapon();
            return;
        }
        if (this.monsters.length === 0) return;
        const player = this.runSnapshot?.player || this.playerSystem.player;
        const attackInterval = this.config.attackInterval / Math.max(0.1, player.attackSpeed || 1);
        this.attackTimer += deltaTime;
        if (this.attackTimer < attackInterval) return;
        this.attackTimer %= attackInterval;
        this.fireAtNearestMonsters({ consumeAmmo: true });
    }

    fireAtNearestMonsters({ consumeAmmo = false } = {}) {
        if (!this.playerSystem) return;
        const weaponState = this.weaponStates[this.activeWeaponId];
        if (consumeAmmo && (!weaponState || weaponState.reloadRemainingMs > 0 || weaponState.magazine <= 0)) {
            if (weaponState?.magazine <= 0) this.reloadWeapon();
            return;
        }
        const livePlayer = this.playerSystem.player;
        const player = this.runSnapshot?.player || livePlayer;
        const origin = this.getEntityCenter(livePlayer);
        const attackRange = this.config.heroAttackRange;
        const limit = Math.max(1, player.multiShot || 1);
        const targets = [];
        const focus = this.monsters.find(monster => {
            if (monster.id !== this.focusTargetId || monster.hp <= 0) return false;
            const point = this.getEntityCenter(monster);
            return Math.hypot(point.x - origin.x, point.y - origin.y) <= attackRange
                && !this.isLineBlocked(origin, point);
        });
        if (focus) targets.push(focus);
        this.getTargets(origin, {
            strategy: 'nearest',
            limit: limit + 1,
            maxRange: attackRange
        }).forEach(target => {
            if (
                !targets.includes(target) &&
                targets.length < limit &&
                !this.isLineBlocked(origin, this.getEntityCenter(target))
            ) targets.push(target);
        });
        if (targets.length > 0 && consumeAmmo) weaponState.magazine -= 1;
        targets.forEach(target => this.fireBullet(target));
    }

    fireBullet(target) {
        if (!this.playerSystem || !target) return null;
        const player = this.runSnapshot?.player || this.playerSystem.player;
        const targetPoint = this.getEntityCenter(target);
        const origin = this.getPlayerBulletOrigin(targetPoint);
        const petCritChance = Math.max(0, Number(this.petSquadSnapshot?.auras?.critChance) || 0) * 100;
        const isCrit = this.random() * 100 < ((player.crit || 0) + petCritChance);
        let damage = this.getPlayerAttackDamage();
        if (isCrit) {
            const petCritDamage = Math.max(0, Number(this.petSquadSnapshot?.auras?.critDamagePercent) || 0);
            damage *= ((player.critDamage || 150) + petCritDamage) / 100;
        }
        damage *= this.consumeFirstStrikeMultiplier();
        this.playerSystem.playAttackAnimation?.();
        const dx = targetPoint.x - origin.x;
        const dy = targetPoint.y - origin.y;
        const distance = Math.hypot(dx, dy) || 1;
        const bullet = {
            id: this.nextBulletId++,
            source: 'hero',
            x: origin.x,
            y: origin.y,
            targetId: target.id,
            speed: this.config.bulletSpeed,
            vx: (dx / distance) * this.config.bulletSpeed,
            vy: (dy / distance) * this.config.bulletSpeed,
            remainingRange: Math.max(this.config.heroAttackRange, distance + 30),
            damage,
            isCrit,
            size: isCrit ? 9 : 7,
            color: isCrit ? '#ff7043' : '#ffd167',
            effects: {}
        };
        this.bullets.push(bullet);
        return bullet;
    }

    fireCurrentWeapon() {
        if (!this.playerSystem || !this.isCombatActive()) {
            return { success: false, code: 'inactive', message: '当前无法开火' };
        }
        const weapon = this.getWeaponConfig();
        const state = this.weaponStates[this.activeWeaponId];
        if (!weapon || !state) return { success: false, code: 'invalid-weapon', message: '武器状态无效' };
        if (this.weaponSwapLockTimer > 0) {
            return {
                success: false,
                code: 'swapping',
                message: '正在切换武器',
                remainingMs: this.weaponSwapLockTimer
            };
        }
        if ((Number(state.shotCooldownRemainingMs) || 0) > 0) {
            return {
                success: false,
                code: 'cooldown',
                message: '武器尚未完成射击循环',
                remainingMs: state.shotCooldownRemainingMs
            };
        }
        if (state.reloadRemainingMs > 0) return { success: false, code: 'reloading', message: '正在换弹' };
        if (state.magazine <= 0) {
            const reload = this.reloadWeapon();
            return { success: false, code: 'empty', message: reload.success ? '弹匣为空，自动换弹' : reload.message };
        }

        const moving = Math.hypot(this.movementInput.x, this.movementInput.y) > 0.01;
        const originCenter = this.getHeroCenter();
        const direction = this.getCurrentAimDirection(originCenter);
        const targetPoint = {
            x: originCenter.x + direction.x * 100,
            y: originCenter.y + direction.y * 100
        };
        const origin = this.getPlayerBulletOrigin(targetPoint);
        const player = this.runSnapshot?.player || this.playerSystem.player;
        const attackSpeed = Math.max(0.65, Math.min(1.65, Number(player.attackSpeed) || 1));
        const firstStrikeMultiplier = this.consumeFirstStrikeMultiplier();
        const baseDamage = this.getWeaponShotDamage(weapon, { moving }) * firstStrikeMultiplier;
        const spreadDegrees = moving ? weapon.movingSpreadDegrees : weapon.spreadDegrees;
        const projectiles = [];

        for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
            const spreadRadians = (this.random() * 2 - 1) * spreadDegrees * Math.PI / 180;
            const cos = Math.cos(spreadRadians);
            const sin = Math.sin(spreadRadians);
            const shotDirection = {
                x: direction.x * cos - direction.y * sin,
                y: direction.x * sin + direction.y * cos
            };
            const petCritChance = Math.max(0, Number(this.petSquadSnapshot?.auras?.critChance) || 0) * 100;
            const isCrit = this.random() * 100 < ((player.crit || 0) + petCritChance);
            const petCritDamage = Math.max(0, Number(this.petSquadSnapshot?.auras?.critDamagePercent) || 0);
            const damage = isCrit
                ? baseDamage * ((player.critDamage || 150) + petCritDamage) / 100
                : baseDamage;
            const bullet = {
                id: this.nextBulletId++,
                source: 'hero',
                weaponId: weapon.id,
                x: origin.x,
                y: origin.y,
                targetId: null,
                speed: weapon.bulletSpeed,
                vx: shotDirection.x * weapon.bulletSpeed,
                vy: shotDirection.y * weapon.bulletSpeed,
                remainingRange: weapon.range,
                damage,
                isCrit,
                size: isCrit ? 7 : 5,
                color: isCrit ? '#ff7043' : weapon.color,
                effects: {}
            };
            this.bullets.push(bullet);
            projectiles.push(bullet);
        }

        state.magazine -= 1;
        state.shotCooldownRemainingMs = weapon.fireIntervalMs / attackSpeed;
        this.syncLegacyShotCooldownTimer();
        this.playerSystem.playAttackAnimation?.();
        return {
            success: true,
            weaponId: weapon.id,
            projectiles,
            magazine: state.magazine,
            reserve: state.reserve,
            firstStrike: firstStrikeMultiplier > 1
        };
    }

    getCurrentAimDirection(origin = this.getHeroCenter()) {
        if (this.aimWorldPoint) {
            const dx = this.aimWorldPoint.x - origin.x;
            const dy = this.aimWorldPoint.y - origin.y;
            const length = Math.hypot(dx, dy);
            if (length > 0.001) return { x: dx / length, y: dy / length };
        }
        const length = Math.hypot(this.aimDirection.x, this.aimDirection.y) || 1;
        return { x: this.aimDirection.x / length, y: this.aimDirection.y / length };
    }

    getWeaponShotDamage(weapon = this.getWeaponConfig(), { moving = false } = {}) {
        if (!weapon) return 0;
        const playerAttack = this.runSnapshot?.player?.attack ?? this.playerSystem?.player?.attack ?? 1;
        const territoryBonuses = this.runSnapshot?.territory || this.territorySystem?.calculateBonuses?.() || {};
        const attackRating = Math.max(
            0,
            Number(playerAttack) + Number(territoryBonuses.attack || 0) + Number(this.runPreparation.attack || 0)
        );
        const softGrowth = Math.log2(1 + attackRating / 20) * 5;
        const petAttackPercent = Math.max(
            0,
            Math.min(35, Number(this.petSquadSnapshot?.auras?.attackPercent) || 0)
        );
        return (weapon.baseDamage + softGrowth * weapon.attributeScaling) * (1 + petAttackPercent / 100);
    }

    consumeFirstStrikeMultiplier() {
        if (!this.firstStrikePending || this.firstStrikeBonus <= 0) return 1;
        this.firstStrikePending = false;
        const multiplier = 1 + this.firstStrikeBonus;
        const hero = this.getHeroCenter();
        this.addStatusText(hero.x, hero.y - 42, '隐蔽先手', '#8dffb5', true);
        return multiplier;
    }

    getPlayerBulletOrigin(targetPoint) {
        if (typeof this.playerSystem?.getGunMuzzlePosition === 'function') {
            return this.playerSystem.getGunMuzzlePosition(targetPoint);
        }
        return this.getHeroCenter();
    }

    getPlayerAttackDamage() {
        const baseAttack = this.runSnapshot?.player?.attack ?? this.playerSystem?.player?.attack ?? 1;
        const territoryBonuses = this.runSnapshot?.territory || this.territorySystem?.calculateBonuses?.() || {};
        const rawAttack = baseAttack + (territoryBonuses.attack || 0) + (this.runPreparation.attack || 0);
        const petAttackPercent = Math.max(0, Number(this.petSquadSnapshot?.auras?.attackPercent) || 0);
        return rawAttack * (1 + petAttackPercent / 100);
    }

    getBossAreaAttackGeometry() {
        const damageRadius = Math.max(1, Number(this.config.bossDamageRadius) || 145);
        const warningRadius = Math.max(
            damageRadius,
            Number(this.config.bossWarningRadius) || 150
        );
        return { damageRadius, warningRadius };
    }

    getMonsterVisualScale(monster = {}) {
        return monster.isBoss ? 2.05 : (monster.isElite ? 1.8 : 1.58);
    }

    getMonsterHitbox(monster = {}, padding = 0) {
        const visualScale = this.getMonsterVisualScale(monster);
        const coverage = Math.max(
            0.5,
            Math.min(1, Number(this.config.monsterHitboxVisualCoverage) || 0.75)
        );
        // 原始逻辑盒通常只覆盖放大后贴图的 49%~63%。命中盒至少保留原尺寸，
        // 并扩展到可见贴图约 75%，让打中躯干外缘的弹道不再被判空。
        const width = Math.max(Number(monster.width) || 0, (Number(monster.width) || 0) * visualScale * coverage);
        const height = Math.max(Number(monster.height) || 0, (Number(monster.height) || 0) * visualScale * coverage);
        const safePadding = Math.max(0, Number(padding) || 0);
        const center = this.getEntityCenter(monster);
        return {
            x: center.x - width / 2 - safePadding,
            y: center.y - height / 2 - safePadding,
            width: width + safePadding * 2,
            height: height + safePadding * 2,
            visualScale,
            coverage
        };
    }

    updateMonsters(deltaTime) {
        const dt = deltaTime / 1000;
        const hero = this.getHeroCenter();
        this.monsters.slice().forEach(monster => {
            monster.animationStateTime = Math.max(0, Number(monster.animationStateTime) || 0) + deltaTime;
            monster.slowTimer = Math.max(0, (monster.slowTimer || 0) - deltaTime);
            monster.stunTimer = Math.max(0, (monster.stunTimer || 0) - deltaTime);
            if (monster.slowTimer <= 0) monster.slowFactor = 1;
            if (monster.stunTimer > 0) {
                this.setMonsterCombatState(monster, 'idle');
                return;
            }

            if (monster.bossTelegraphTimer > 0) {
                const previous = monster.bossTelegraphTimer;
                monster.bossTelegraphTimer = Math.max(0, previous - deltaTime);
                monster.combatState = 'attack';
                if (previous > 0 && monster.bossTelegraphTimer <= 0 && monster.bossTarget) {
                    const target = monster.bossTarget;
                    const currentHero = this.getHeroCenter();
                    const { damageRadius } = this.getBossAreaAttackGeometry();
                    this.explosions.push({ x: target.x, y: target.y, radius: damageRadius, life: 520, color: '#ff7043' });
                    if (Math.hypot(currentHero.x - target.x, currentHero.y - target.y) <= damageRadius) {
                        this.damageHero(monster.attack * 1.25, monster);
                    }
                    monster.bossTarget = null;
                }
                return;
            }

            if (monster.chargeTelegraph > 0) {
                const previous = monster.chargeTelegraph;
                monster.chargeTelegraph = Math.max(0, previous - deltaTime);
                monster.combatState = 'attack';
                if (previous > 0 && monster.chargeTelegraph <= 0 && monster.chargeVector) {
                    const chargeDistance = monster.speed * 1.9;
                    this.moveMonsterWithAvoidance(
                        monster,
                        monster.chargeVector.x,
                        monster.chargeVector.y,
                        chargeDistance
                    );
                    const chargedCenter = this.getEntityCenter(monster);
                    const currentHero = this.getHeroCenter();
                    if (Math.hypot(currentHero.x - chargedCenter.x, currentHero.y - chargedCenter.y) <= monster.engageRange + 24) {
                        this.damageHero(monster.attack * 1.35, monster);
                    }
                    monster.chargeVector = null;
                }
                return;
            }

            const center = this.getEntityCenter(monster);
            const dx = hero.x - center.x;
            const dy = hero.y - center.y;
            const distance = Math.hypot(dx, dy);
            monster.progress = Math.max(0, Math.min(1, 1 - distance / Math.max(1, this.worldSystem.width)));

            if (monster.isBoss) {
                monster.bossAbilityTimer -= deltaTime;
                if (monster.bossAbilityTimer <= 0 && distance <= 420) {
                    monster.bossTarget = { ...hero };
                    monster.bossTelegraphTimer = 900;
                    monster.bossAbilityTimer = 5000;
                    this.addStatusText(hero.x, hero.y - 48, '危险区域！', '#ff7043', true);
                    return;
                }
            }

            if (monster.combatStyle === 'charger') {
                monster.chargeCooldown -= deltaTime;
                if (monster.chargeCooldown <= 0 && distance > 105 && distance < 360) {
                    const safeDistance = distance || 1;
                    monster.chargeVector = { x: dx / safeDistance, y: dy / safeDistance };
                    monster.chargeTelegraph = 520;
                    monster.chargeCooldown = 3600;
                    this.addStatusText(center.x, center.y - 30, '冲锋！', '#ffd167');
                    return;
                }
            }

            const hasLineOfSight = !this.isLineBlocked(center, hero);
            const ranged = monster.combatStyle === 'ranged';
            const engageRange = ranged ? monster.rangedRange : monster.engageRange;
            if (ranged && distance < 125) {
                const safeDistance = distance || 1;
                const travel = monster.speed * (monster.slowFactor || 1) * dt;
                this.moveMonsterWithAvoidance(
                    monster,
                    -dx / safeDistance,
                    -dy / safeDistance,
                    travel
                );
                this.setMonsterCombatState(monster, 'move');
                return;
            }

            if (distance > engageRange || (ranged && !hasLineOfSight)) {
                const safeDistance = distance || 1;
                const maxTravel = monster.speed * (monster.slowFactor || 1) * dt;
                const desiredDistance = ranged && !hasLineOfSight
                    ? maxTravel
                    : Math.max(0, distance - engageRange);
                const travel = Math.min(desiredDistance, maxTravel);
                this.moveMonsterWithAvoidance(
                    monster,
                    dx / safeDistance,
                    dy / safeDistance,
                    travel
                );
                this.setMonsterCombatState(monster, 'move');
                return;
            }

            this.setMonsterCombatState(monster, 'attack');
            monster.attackCooldown -= deltaTime;
            if (monster.attackCooldown <= 0) {
                monster.attackCooldown += monster.attackInterval;
                if (ranged) this.fireEnemyBullet(monster, hero);
                else this.damageHero(monster.attack, monster);
            }
        });
    }

    moveMonsterWithAvoidance(monster, directionX, directionY, travel) {
        const result = this.worldSystem.moveEntity(
            monster,
            directionX * travel,
            directionY * travel,
            { padding: 10 }
        );
        if (!result.blockedX && !result.blockedY) return result;

        // 无网格寻路时采用稳定的贴墙转向；实体会沿障碍边缘滑行，而非永久卡住。
        const side = monster.pathDirection || 1;
        const alternate = this.worldSystem.moveEntity(
            monster,
            -directionY * travel * side,
            directionX * travel * side,
            { padding: 10 }
        );
        if (!alternate.moved) monster.pathDirection = -side;
        return alternate;
    }

    setMonsterCombatState(monster, state) {
        if (!monster || monster.combatState === state) return;
        monster.combatState = state;
        monster.animationStateTime = 0;
    }

    fireEnemyBullet(monster, targetPoint = this.getHeroCenter()) {
        if (!monster || monster.hp <= 0 || !targetPoint) return null;
        const origin = this.getEntityCenter(monster);
        const dx = targetPoint.x - origin.x;
        const dy = targetPoint.y - origin.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0.001 || this.isLineBlocked(origin, targetPoint, 3)) return null;
        const speed = monster.isElite ? 380 : 330;
        const bullet = {
            id: this.nextBulletId++,
            source: 'enemy',
            sourceMonsterId: monster.id,
            x: origin.x,
            y: origin.y,
            targetId: null,
            speed,
            vx: (dx / distance) * speed,
            vy: (dy / distance) * speed,
            remainingRange: Math.max(monster.rangedRange || 280, distance + 45),
            damage: monster.attack,
            isCrit: false,
            size: monster.isElite ? 7 : 6,
            color: monster.isElite ? '#c38cff' : '#ff667d',
            effects: {}
        };
        this.bullets.push(bullet);
        return bullet;
    }

    damageHero(rawDamage, monster = null) {
        if (this.settled || this.runHp <= 0) return 0;
        if (this.petRescueInvulnerabilityTimer > 0) return 0;
        if (this.runSystem.activeSearch) this.interruptSearch('damage');
        const playerDefense = this.runSnapshot?.player?.defense ?? this.playerSystem?.player?.defense ?? 0;
        const territoryDefense = this.runSnapshot?.territory?.defense ?? this.territorySystem?.calculateBonuses?.().defense ?? 0;
        let damage = Math.max(
            1,
            Math.floor(rawDamage - (playerDefense + territoryDefense + (this.runPreparation.defense || 0)) * 0.32)
        );
        if (this.guardTimer > 0) damage = Math.max(1, Math.floor(damage * (1 - this.config.skillGuardReduction)));
        const petReduction = Math.max(0, Math.min(0.28, Number(this.petSquadSnapshot?.damageReduction) || 0));
        damage = Math.max(1, Math.floor(damage * (1 - petReduction)));
        const guardAbsorbed = Math.min(this.petGuardHp, Math.max(0, Math.ceil(damage * 0.5)));
        this.petGuardHp = Math.max(0, this.petGuardHp - guardAbsorbed);
        damage = Math.max(0, damage - guardAbsorbed);
        this.runHp = Math.max(0, this.runHp - damage);
        this.runDamageTaken += damage;
        this.timeSinceDamage = 0;
        const hero = this.getHeroCenter();
        this.addStatusText(
            hero.x,
            hero.y - 34,
            guardAbsorbed > 0 ? `护卫 -${guardAbsorbed} / 生命 -${damage}` : `-${damage}`,
            guardAbsorbed > 0 ? '#72d7ff' : '#ff667d',
            true
        );
        this.explosions.push({
            x: hero.x,
            y: hero.y,
            radius: monster?.isBoss ? 25 : 14,
            life: 340,
            color: '#ff4757'
        });
        if (this.runHp <= 0 && !this.tryPetRescue()) this.finishExpedition(false, 'defeated');
        this.notifyStateChange();
        return damage;
    }

    tryPetRescue() {
        const rescue = this.petSquadSnapshot?.rescue;
        if (!rescue || this.petRescueUsed) return false;
        this.petRescueUsed = true;
        this.runHp = Math.max(1, Math.floor(this.runMaxHp * Math.max(0.05, Number(rescue.restoreHpRatio) || 0.25)));
        this.petRescueInvulnerabilityTimer = Math.max(0, Number(rescue.invulnerabilityMs) || 1200);
        this.addBannerText(`${rescue.petName || '伙伴'} · ${rescue.skillName || '浴火重生'}`, '#ff8a50');
        return true;
    }

    damageBase(rawDamage, monster = null) {
        return this.damageHero(rawDamage, monster);
    }

    healHero(amount) {
        const previous = this.runHp;
        const petHealingPercent = Math.max(0, Number(this.petSquadSnapshot?.auras?.healingPercent) || 0);
        const scaledAmount = Math.floor(Math.max(0, Number(amount) || 0) * (1 + petHealingPercent / 100));
        this.runHp = Math.min(this.runMaxHp, this.runHp + scaledAmount);
        const actual = this.runHp - previous;
        if (actual > 0) {
            const hero = this.getHeroCenter();
            this.addStatusText(hero.x, hero.y - 34, `+${actual}`, '#8dffb5', true);
        }
        return actual;
    }

    updateRunRegeneration(deltaTime) {
        if (this.runSystem.active) {
            this.runRegenTimer = 0;
            return 0;
        }
        const regen = Math.max(0, this.runSnapshot?.player?.hpRegen ?? this.playerSystem?.player?.hpRegen ?? 0);
        if (regen <= 0 || this.runHp >= this.runMaxHp || this.timeSinceDamage < 1800) {
            this.runRegenTimer = 0;
            return;
        }
        this.runRegenTimer += deltaTime;
        while (this.runRegenTimer >= 1000) {
            this.runRegenTimer -= 1000;
            this.healHero(regen);
        }
        return regen;
    }

    updateBullets(deltaTime) {
        const dt = deltaTime / 1000;
        const remaining = [];
        this.bullets.forEach(bullet => {
            const travel = Math.min(
                Math.max(0, Number(bullet.remainingRange) || 0),
                Math.max(0, Number(bullet.speed) || 0) * dt
            );
            if (travel <= 0) return;
            const velocityLength = Math.hypot(bullet.vx || 0, bullet.vy || 0);
            if (velocityLength <= 0.001) return;
            const directionX = bullet.vx / velocityLength;
            const directionY = bullet.vy / velocityLength;
            const start = { x: bullet.x, y: bullet.y };
            const end = {
                x: bullet.x + directionX * travel,
                y: bullet.y + directionY * travel
            };
            if (this.isLineBlocked(start, end, Math.max(2, bullet.size * 0.55))) {
                this.explosions.push({ x: end.x, y: end.y, radius: 6, life: 160, color: '#9aa6b2' });
                return;
            }

            if (bullet.source === 'enemy') {
                if (this.doesProjectileHitHero(start, end, bullet.size || 5)) {
                    bullet.x = end.x;
                    bullet.y = end.y;
                    const source = this.monsters.find(monster => monster.id === bullet.sourceMonsterId) || null;
                    this.damageHero(bullet.damage, source);
                    this.explosions.push({ x: end.x, y: end.y, radius: 8, life: 220, color: bullet.color });
                    return;
                }
            } else {
                const target = this.findProjectileMonsterHit(start, end, bullet.size || 5);
                if (target) {
                    bullet.x = end.x;
                    bullet.y = end.y;
                    this.resolveBulletHit(bullet, target);
                    return;
                }
            }

            bullet.x = end.x;
            bullet.y = end.y;
            bullet.remainingRange = Math.max(0, bullet.remainingRange - travel);
            if (bullet.remainingRange > 0) {
                remaining.push(bullet);
            } else {
                this.explosions.push({ x: end.x, y: end.y, radius: 4, life: 120, color: bullet.color });
            }
        });
        this.bullets = remaining;
    }

    findProjectileMonsterHit(start, end, radius = 5) {
        return this.monsters
            .filter(monster => {
                if (monster.hp <= 0) return false;
                const hitbox = this.getMonsterHitbox(monster, radius);
                return this.segmentIntersectsRect(
                    start.x,
                    start.y,
                    end.x,
                    end.y,
                    hitbox.x,
                    hitbox.y,
                    hitbox.width,
                    hitbox.height
                );
            })
            .sort((left, right) => {
                const leftCenter = this.getEntityCenter(left);
                const rightCenter = this.getEntityCenter(right);
                return Math.hypot(leftCenter.x - start.x, leftCenter.y - start.y)
                    - Math.hypot(rightCenter.x - start.x, rightCenter.y - start.y);
            })[0] || null;
    }

    doesProjectileHitHero(start, end, radius = 5) {
        const hero = this.playerSystem?.player;
        if (!hero) return false;
        return this.segmentIntersectsRect(
            start.x,
            start.y,
            end.x,
            end.y,
            hero.x - radius,
            hero.y - radius,
            hero.width + radius * 2,
            hero.height + radius * 2
        );
    }

    isLineBlocked(start, end, padding = 4) {
        if (!start || !end) return false;
        return (this.worldSystem.obstacles || []).some(obstacle => this.segmentIntersectsRect(
            start.x,
            start.y,
            end.x,
            end.y,
            obstacle.x - padding,
            obstacle.y - padding,
            obstacle.width + padding * 2,
            obstacle.height + padding * 2
        ));
    }

    segmentIntersectsRect(x1, y1, x2, y2, rectX, rectY, rectWidth, rectHeight) {
        const minX = rectX;
        const maxX = rectX + rectWidth;
        const minY = rectY;
        const maxY = rectY + rectHeight;
        if ((x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY)
            || (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY)) return true;

        const dx = x2 - x1;
        const dy = y2 - y1;
        let tMin = 0;
        let tMax = 1;
        for (const [origin, direction, low, high] of [[x1, dx, minX, maxX], [y1, dy, minY, maxY]]) {
            if (Math.abs(direction) < 1e-9) {
                if (origin < low || origin > high) return false;
                continue;
            }
            let near = (low - origin) / direction;
            let far = (high - origin) / direction;
            if (near > far) [near, far] = [far, near];
            tMin = Math.max(tMin, near);
            tMax = Math.min(tMax, far);
            if (tMin > tMax) return false;
        }
        return true;
    }

    resolveBulletHit(bullet, target) {
        this.applyDamage(target, bullet.damage, { isCrit: bullet.isCrit });
        this.explosions.push({
            x: bullet.x,
            y: bullet.y,
            radius: bullet.isCrit ? 13 : 8,
            life: 260,
            color: bullet.color
        });
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
            if (this.focusTargetId === monster.id) this.focusTargetId = null;
        }
        return true;
    }

    applyPetDamage(monster, damage, isCrit = false) {
        return this.applyDamage(monster, damage, { isCrit });
    }

    onMonsterKilled(monster) {
        if (!monster || monster.rewardGranted) return;
        monster.rewardGranted = true;
        this.encounterRewards.coins += monster.coinReward || 0;
        this.encounterRewards.crystals += monster.crystalReward || 0;
        this.encounterRewards.exp += monster.expReward || 0;
        this.encounterRewards.kills += 1;
        if (monster.isBoss) {
            this.meta.bossKills += 1;
            this.runBossKills += 1;
        }
        if (monster.isElite) this.runEliteKills += 1;
        this.explosions.push({
            x: monster.x + monster.width / 2,
            y: monster.y + monster.height / 2,
            radius: monster.isBoss ? 30 : 13,
            life: monster.isBoss ? 520 : 300,
            color: monster.isBoss ? '#ff7043' : '#ffd167'
        });
        this.notifyStateChange();
    }

    finishEncounter() {
        if (!this.currentEncounter || this.runSystem.phase !== 'combat') return null;
        const type = this.currentEncounter.type;
        const lootQuality = type === 'boss' ? 5 : type === 'elite' ? 3 : type === 'ambush' ? 1 : 0;
        const lootCount = type === 'boss' ? 3 : type === 'elite' ? 2 : 1;
        const rewards = { ...this.encounterRewards };
        const result = this.runSystem.completeCombat(rewards, { lootQuality, lootCount });
        this.encounterRewardsCommitted = true;
        this.currentEncounter = null;
        this.encounterQueue = [];
        this.bullets = [];
        this.addBannerText(type === 'boss' ? '核心守卫已击败' : '区域清理完成', '#8dffb5');
        this.worldSystem.completeActiveLocation();
        this.syncWorldWithRunState();
        this.notifyStateChange();
        return result;
    }

    commitEncounterRewards() {
        if (this.encounterRewardsCommitted) return;
        if (this.encounterRewards.kills > 0) {
            const multiplier = this.getThreatRewardMultiplier();
            this.runSystem.addPendingRewards({
                coins: Math.floor(this.encounterRewards.coins * multiplier),
                crystals: Math.floor(this.encounterRewards.crystals * multiplier),
                exp: Math.floor(this.encounterRewards.exp * multiplier),
                kills: this.encounterRewards.kills
            });
        }
        this.encounterRewardsCommitted = true;
    }

    getThreatRewardMultiplier() {
        if (typeof this.runSystem.getThreatRewardMultiplier === 'function') {
            return this.runSystem.getThreatRewardMultiplier();
        }
        return 1 + Math.min(0.75, Math.max(0, this.runSystem.threat || 0) * 0.0075);
    }

    finishExpedition(extracted, reason) {
        if (this.settled) return this.lastSettlement;
        const runBeforeSettlement = this.runSystem.getState();
        const protectedLoot = this.runSystem.getProtectedLoot?.().map(item => ({ ...item })) || [];
        // 主动放弃不能通过刷一半遭遇带走击杀收益；战败仍沿用原有保底规则。
        if (reason !== 'abandoned') this.commitEncounterRewards();
        else {
            this.encounterRewards = this.createEmptyRewards();
            this.encounterRewardsCommitted = true;
        }
        this.settled = true;
        const baseSettlement = this.runSystem.finishRun({ extracted, reason });
        const territoryBonuses = this.runSnapshot?.territory || this.territorySystem?.calculateBonuses?.() || {};
        const territoryExpBonus = (territoryBonuses.expBonus || 0) + (this.runPreparation.expBonus || 0);
        const settlement = {
            ...baseSettlement,
            coins: Math.floor(baseSettlement.coins * (1 + (territoryBonuses.coinBonus || 0) / 100)),
            crystals: Math.floor(baseSettlement.crystals * (1 + (territoryBonuses.crystalBonus || 0) / 100)),
            exp: Math.floor(baseSettlement.exp * (1 + territoryExpBonus / 100))
        };
        settlement.bossKills = this.runBossKills;
        settlement.eliteKills = this.runEliteKills;
        settlement.participantIds = (this.petSquadSnapshot?.members || []).map(member => member.instanceId);
        settlement.petBond = this.petSystem?.awardExpeditionProgress?.(settlement)
            || this.petSystem?.applyExpeditionBond?.(settlement) || {
            plannedGain: 0,
            totalGain: 0,
            count: 0,
            gainedCount: 0,
            cappedCount: 0,
            pets: []
        };
        settlement.petProgress = settlement.petBond;
        settlement.petIds = [...settlement.participantIds];

        const completedLocations = this.worldSystem.getState?.(this.getHeroCenter())?.locations
            ?.filter(location => location.completed || location.state === 'cleared')
            .map(location => ({
                id: location.nodeId || location.id,
                type: location.type,
            })) || [];
        const activeMetaRaidId = this.expeditionMetaSystem?.getState?.()?.activeRaid?.raidId || null;
        settlement.metaSettlement = this.expeditionMetaSystem?.applySettlement?.({
            settlement,
            settlementId: activeMetaRaidId,
            loot: runBeforeSettlement.backpack || [],
            recoveredLoot: protectedLoot,
            runStats: {
                petIds: settlement.participantIds,
                eliteKills: this.runEliteKills,
                investigatedLocations: completedLocations
            }
        }) || null;

        this.resourceSystem?.addCoins?.(settlement.coins);
        this.resourceSystem?.addCrystals?.(settlement.crystals);
        this.resourceSystem?.addRubies?.(settlement.rubyReward || 0);
        this.playerSystem?.addExperience?.(settlement.exp);
        this.meta.bestDepth = Math.max(this.meta.bestDepth, settlement.depth);
        this.meta.contractFragments += Math.max(0, Number(settlement.contractFragments) || 0);
        this.meta.deepMaterials += Math.max(0, Number(settlement.deepMaterials) || 0);
        if (settlement.extracted) {
            this.meta.extractions += 1;
            this.meta.bestExtractedDepth = Math.max(this.meta.bestExtractedDepth, settlement.depth);
            this.meta.bestValue = Math.max(this.meta.bestValue, Number(settlement.value) || 0);
            if (this.runDamageTaken <= 0) this.meta.flawlessExtractions += 1;
        }
        else this.meta.losses += 1;
        this.lastSettlement = settlement;
        this.monsters = [];
        this.bullets = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.extractionTimer = 0;
        this.extractionTotalDuration = 0;
        this.extractionOutOfZoneTimer = 0;
        this.extractionReinforcementTimer = 0;
        this.extractionReinforcementIntervalMs = 0;
        this.runPreparation = { attack: 0, defense: 0, supplies: 0, expBonus: 0 };
        this.runLoadoutEffects = { armorDefense: 0, petGuard: 0, consumableSupplies: 0, consumed: [] };
        this.runSnapshot = null;
        this.clearMovementInput();
        this.worldSystem.completeActiveLocation();
        this.addBannerText(settlement.extracted ? '撤离成功！' : '远征失败', settlement.extracted ? '#72d7ff' : '#ff667d');
        this.notifyStateChange();
        return settlement;
    }

    clearEncounter() {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.encounterQueue = [];
        this.currentEncounter = null;
        this.encounterRewards = this.createEmptyRewards();
        this.encounterRewardsCommitted = false;
        this.nextMonsterId = 1;
        this.nextBulletId = 1;
        this.encounterSpawnTimer = 0;
        this.attackTimer = 0;
        this.extractionTimer = 0;
        this.extractionTotalDuration = 0;
        this.extractionOutOfZoneTimer = 0;
        this.extractionReinforcementTimer = 0;
        this.extractionReinforcementIntervalMs = 0;
        this.focusTargetId = null;
    }

    createEmptyRewards() {
        return { coins: 0, crystals: 0, exp: 0, kills: 0 };
    }

    calculateRunMaxHp() {
        const player = this.runSnapshot?.player || this.playerSystem?.player || {};
        const bonuses = this.runSnapshot?.territory || this.territorySystem?.calculateBonuses?.() || {};
        return Math.max(
            80,
            Math.floor((player.maxHp || 100) + ((bonuses.defense || 0) + (this.runPreparation.defense || 0)) * 3)
        );
    }

    captureRunSnapshot(territoryBonuses = null, preparation = null) {
        const player = this.playerSystem?.player || {};
        const bonuses = territoryBonuses || this.territorySystem?.calculateBonuses?.() || {};
        return {
            player: {
                level: Math.max(1, Number(player.level) || 1),
                maxHp: Math.max(1, Number(player.maxHp) || 100),
                attack: Math.max(1, Number(player.attack) || 1),
                defense: Math.max(0, Number(player.defense) || 0),
                hpRegen: Math.max(0, Number(player.hpRegen) || 0),
                attackSpeed: Math.max(0.1, Number(player.attackSpeed) || 1),
                crit: Math.max(0, Number(player.crit) || 0),
                critDamage: Math.max(100, Number(player.critDamage) || 150),
                multiShot: Math.max(1, Math.floor(Number(player.multiShot) || 1))
            },
            territory: { ...bonuses },
            preparation: { ...(preparation || this.runPreparation) }
        };
    }

    getRunHeroState() {
        return {
            hp: this.runHp,
            maxHp: this.runMaxHp,
            guardActive: this.guardTimer > 0
        };
    }

    getPetSkillsState() {
        const leaderInstanceId = this.petSquadSnapshot?.members?.[0]?.instanceId
            ?? this.petSystem?.equippedPets?.[0]?.instanceId
            ?? null;
        return (this.petSystem?.equippedPets || [])
            .filter(pet => leaderInstanceId !== null && String(pet.instanceId) === String(leaderInstanceId))
            .slice(0, 1)
            .map(pet => {
            const template = this.petSystem?.getTemplate?.(pet.templateId);
            const cooldownMs = Math.max(0, this.skillCooldowns.get(pet.instanceId) || 0);
            return {
                instanceId: pet.instanceId,
                name: template?.name || '宠物',
                emoji: template?.emoji || '●',
                type: template?.type || 'default',
                color: PET_ROLE_COLORS[template?.type] || PET_ROLE_COLORS.default,
                skillName: template?.skill?.name || '伙伴技能',
                cooldownMs,
                cooldownSeconds: Math.ceil(cooldownMs / 1000),
                ready: cooldownMs <= 0 && this.isCombatActive()
            };
            });
    }

    updateSkillCooldowns(deltaTime) {
        for (const [instanceId, remaining] of this.skillCooldowns.entries()) {
            const next = Math.max(0, remaining - deltaTime);
            if (next <= 0) this.skillCooldowns.delete(instanceId);
            else this.skillCooldowns.set(instanceId, next);
        }
    }

    isCombatActive() {
        return this.runSystem.phase === 'combat' || this.runSystem.phase === 'extracting';
    }

    isWaveActive() {
        return this.isCombatActive();
    }

    getBattleState() {
        const run = this.runSystem.getState();
        const heroCenter = this.getHeroCenter();
        const world = this.worldSystem.getState(heroCenter);
        const camera = this.cameraSystem.getState();
        const interaction = this.getInteractionState();
        const nearExtraction = interaction.location?.kind === 'extraction';
        const nearExtractionType = nearExtraction
            ? (interaction.location.extractionType || interaction.location.id)
            : null;
        const nearExtractionAvailability = nearExtractionType
            ? this.runSystem.getExtractionAvailability?.(nearExtractionType)
            : null;
        const activeExtractionType = run.activeExtractionType || null;
        const activeExtractionRule = activeExtractionType
            ? this.runSystem.getExtractionRule?.(activeExtractionType)
            : null;
        const pendingRewards = {
            coins: run.pendingRewards.coins + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.coins),
            crystals: run.pendingRewards.crystals + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.crystals),
            exp: run.pendingRewards.exp + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.exp),
            kills: run.pendingRewards.kills + (this.encounterRewardsCommitted ? 0 : this.encounterRewards.kills)
        };
        const projectedRubies = Math.max(
            0,
            Math.floor(run.depth / 3) + (run.bossDefeated ? 3 : 0) + (run.threat >= 75 ? 1 : 0)
        );
        const pendingValue = pendingRewards.coins
            + pendingRewards.crystals * 35
            + pendingRewards.exp * 2
            + run.backpackRewards.score
            + run.backpackRewards.contractFragments * 45
            + run.backpackRewards.deepMaterials * 120
            + projectedRubies * 100;
        const phase = run.phase;
        return {
            mode: this.mode,
            phase,
            phaseLabel: this.getPhaseLabel(phase),
            depth: run.depth,
            maxDepth: run.maxDepth,
            currentWave: run.depth,
            totalWaves: run.maxDepth,
            hp: this.runHp,
            maxHp: this.runMaxHp,
            baseHp: this.runHp,
            baseMaxHp: this.runMaxHp,
            threat: run.threat,
            threatForecast: run.threatForecast || {
                current: run.threat,
                nextTier: Math.min(100, Math.ceil((run.threat + 1) / 20) * 20),
                rewardMultiplier: this.getThreatRewardMultiplier()
            },
            rewardMultiplier: run.rewardMultiplier || this.getThreatRewardMultiplier(),
            overpressure: run.overpressure || 0,
            returnPressure: run.returnPressure || { ...this.returnPressure },
            threatPreview: run.threatPreview || null,
            searchProfiles: run.searchProfiles || null,
            activeSearch: run.activeSearch || null,
            searchState: run.searchState || run.activeSearch || null,
            isSearching: Boolean(run.isSearching || run.activeSearch),
            insuredSlotCount: run.insuredSlotCount || 0,
            searchMetrics: run.searchMetrics || null,
            supplies: run.supplies,
            energy: run.supplies,
            activeEnemies: this.monsters.length,
            queuedEnemies: this.encounterQueue.length,
            backpack: run.backpack,
            backpackCount: run.backpack.length,
            backpackCapacity: run.backpackCapacity,
            backpackRewards: run.backpackRewards,
            pendingLootChoice: run.pendingLootChoice || null,
            pendingValue,
            rewards: pendingRewards,
            currentNode: run.currentNode,
            routeChoices: run.routeChoices,
            lastAction: run.lastAction,
            world: {
                ...world,
                revision: this.worldRevision,
                player: {
                    x: heroCenter.x,
                    y: heroCenter.y,
                    moving: Math.hypot(this.movementInput.x, this.movementInput.y) > 0.01
                },
                camera,
                canMove: this.canMoveHero()
            },
            interaction,
            weapon: this.getWeaponState(),
            loadoutEffects: JSON.parse(JSON.stringify(this.runLoadoutEffects)),
            petSkills: this.getPetSkillsState(),
            petGuard: {
                hp: this.petGuardHp,
                maxHp: this.petGuardMaxHp,
                damageReduction: this.petSquadSnapshot?.damageReduction || 0,
                rescueReady: Boolean(this.petSquadSnapshot?.rescue && !this.petRescueUsed)
            },
            searchBonuses: {
                quick: this.petSystem?.getExplorationSearchBonuses?.('quick') || {},
                thorough: this.petSystem?.getExplorationSearchBonuses?.('thorough') || {},
                pet: this.petSystem?.getExplorationSearchBonuses?.('pet') || {}
            },
            extraction: {
                unlocked: Object.values(run.extractionAvailability || {}).some(item => item?.canExtract),
                canExtract: Boolean(nearExtractionAvailability?.canExtract),
                nearType: nearExtractionType,
                activeType: activeExtractionType,
                activeLocationId: activeExtractionRule?.locationId || world.activeExtractionLocationId || null,
                activeRule: activeExtractionRule,
                rules: run.extractionRules || {},
                availability: run.extractionAvailability || {},
                inZone: this.isHeroInExtractionZone(),
                contested: this.isExtractionContested(),
                outOfZoneMs: this.extractionOutOfZoneTimer,
                reinforcementMs: Math.max(0, this.extractionReinforcementTimer),
                remainingMs: this.extractionTimer,
                remainingSeconds: Math.ceil(this.extractionTimer / 1000),
                totalMs: this.extractionTotalDuration
            },
            actions: {
                blockedByLootChoice: Boolean(run.pendingLootChoice),
                canStart: phase === 'briefing' || phase === 'extracted' || phase === 'defeat',
                canChooseRoute: phase === 'route' && !run.pendingLootChoice,
                canTrackMap: phase === 'route' || phase === 'extraction-ready',
                canSearch: phase === 'search'
                    && interaction.available
                    && interaction.location?.kind === 'container'
                    && !run.pendingLootChoice
                    && !run.isSearching
                    && !run.activeSearch,
                canRest: phase === 'camp',
                canExtract: Boolean(nearExtractionAvailability?.canExtract),
                canInteract: interaction.available,
                canMove: this.canMoveHero(),
                canHeal: run.active && run.supplies > 0 && this.runHp < this.runMaxHp
                    && this.supplyCooldownTimer <= 0
                    && (!this.isCombatActive() || this.timeSinceDamage >= this.config.supplyCombatSafeWindowMs),
                canAbandon: run.active,
                canRestart: !run.active
            },
            canStartWave: phase === 'briefing',
            isWaveActive: this.isCombatActive(),
            settlement: this.lastSettlement ? { ...this.lastSettlement } : null,
            raidMeta: this.expeditionMetaSystem?.getState?.() || null,
            meta: { ...this.meta }
        };
    }

    getPhaseLabel(phase = this.runSystem.phase) {
        const labels = {
            briefing: '远征整备',
            route: '大地图探索',
            search: '搜索区域',
            camp: '安全休整',
            combat: '遭遇战斗',
            'extraction-ready': '等待撤离',
            extracting: '撤离守点',
            extracted: '撤离成功',
            defeat: '远征失败'
        };
        return labels[phase] || '远征';
    }

    getEncounterTitle(type) {
        const labels = {
            combat: '巡逻队来袭',
            elite: '精英遭遇',
            boss: '核心守卫出现',
            ambush: '搜索遭伏击',
            extraction: '撤离守点开始'
        };
        return labels[type] || '遭遇战斗';
    }

    notifyStateChange() {
        if (!this.onStateChange) return;
        try {
            this.onStateChange(this.getBattleState());
        } catch (error) {
            console.warn('[CombatSystem] 战斗状态回调失败:', error);
        }
    }

    acquireTarget(origin, options = {}) {
        return this.targetingSystem.acquireTarget(origin, this.monsters, options);
    }

    getTargets(origin, options = {}) {
        return this.targetingSystem.getTargets(origin, this.monsters, options);
    }

    getNearestMonster(x, y) {
        return this.acquireTarget({ x, y }, { strategy: 'nearest' });
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

    getHeroCenter() {
        return this.getEntityCenter(this.playerSystem?.player || this.getHeroPosition());
    }

    getHeroPosition() {
        const width = this.playerSystem?.player?.width || 40;
        const height = this.playerSystem?.player?.height || 40;
        return {
            x: this.worldSystem.spawnPoint.x - width / 2,
            y: this.worldSystem.spawnPoint.y - height / 2,
            width,
            height
        };
    }

    getBasePosition() {
        const hero = this.getHeroPosition();
        return { x: hero.x + hero.width / 2, y: hero.y + hero.height / 2 };
    }

    placeHeroAtCamp({ force = false } = {}) {
        if (!this.playerSystem?.player) return;
        if (!force && this.runSystem.active && this.worldSystem.initialized) return;
        const position = this.getHeroPosition();
        this.playerSystem.player.x = position.x;
        this.playerSystem.player.y = position.y;
        if (this.worldSystem.initialized) {
            this.worldSystem.updatePlayerPosition(
                position.x + position.width / 2,
                position.y + position.height / 2
            );
        }
        this.cameraSystem.snapTo(
            position.x + position.width / 2,
            position.y + position.height / 2
        );
    }

    placeHeroAtBase() {
        this.placeHeroAtCamp();
    }

    getTowerRenderData() {
        return [];
    }

    getTowerSlotRadius() {
        return 0;
    }

    checkCollisions() {
        return this.bullets.length;
    }

    isColliding(a, b) {
        const aCenter = this.getEntityCenter(a);
        const bCenter = this.getEntityCenter(b);
        const aRadius = (a.size || Math.max(a.width || 0, a.height || 0)) / 2;
        const bRadius = (b.size || Math.max(b.width || 0, b.height || 0)) / 2;
        return Math.hypot(aCenter.x - bCenter.x, aCenter.y - bCenter.y) <= aRadius + bRadius;
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
            text,
            color,
            life: large ? 1050 : 800,
            maxLife: large ? 1050 : 800,
            size: large ? 22 : 15
        });
    }

    addBannerText(text, color = '#ffd167') {
        this.combatTexts.push({
            x: this.mapWidth / 2,
            y: this.mapHeight * 0.28,
            text,
            color,
            life: 1500,
            maxLife: 1500,
            size: Math.max(20, Math.min(34, this.mapWidth * 0.035)),
            banner: true
        });
    }

    updateExplosions(deltaTime) {
        this.explosions = this.explosions.filter(explosion => {
            explosion.life -= deltaTime;
            explosion.radius += deltaTime * 0.025;
            return explosion.life > 0;
        });
    }

    updateCombatTexts(deltaTime) {
        this.combatTexts = this.combatTexts.filter(text => {
            text.life -= deltaTime;
            if (!text.banner) text.y -= deltaTime * 0.035;
            return text.life > 0;
        });
    }

    render(ctx) {
        this.renderExplorationFrame(ctx);
    }

    renderExplorationFrame(ctx) {
        this.renderBattlefieldBackground(ctx);
        const camera = this.cameraSystem.getState();
        ctx.save();
        ctx.translate(-camera.x, -camera.y);
        this.renderWorldTerrain(ctx);
        this.renderWorldLocations(ctx);
        this.playerSystem?.render?.(ctx);
        this.renderWorld(ctx);
        if (this.petSystem && this.playerSystem?.player) {
            const player = this.playerSystem.player;
            this.petSystem.render(
                ctx,
                player.x + player.width / 2,
                player.y + player.height / 2
            );
        }
        this.renderFloatingTexts(ctx, { screenSpace: false });
        ctx.restore();
        this.renderScreenOverlay(ctx);
    }

    renderBattlefieldBackground(ctx) {
        const width = this.mapWidth;
        const height = this.mapHeight;
        const threatRatio = (this.runSystem.threat || 0) / 100;
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#101b24');
        gradient.addColorStop(0.56, '#182726');
        gradient.addColorStop(1, threatRatio > 0.6 ? '#3a1d25' : '#211b24');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    renderWorldTerrain(ctx) {
        const width = this.worldSystem.width;
        const height = this.worldSystem.height;
        ctx.fillStyle = '#172522';
        ctx.fillRect(0, 0, width, height);

        const tile = 96;
        ctx.strokeStyle = 'rgba(123, 215, 255, 0.045)';
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

        this.renderWorldPaths(ctx);
        this.renderWorldObstacles(ctx);
    }

    renderWorld(ctx) {
        this.renderFocusTarget(ctx);
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        this.explosions.forEach(explosion => this.renderExplosion(ctx, explosion));
    }

    renderFloatingTexts(ctx, { screenSpace = false } = {}) {
        this.combatTexts
            .filter(text => Boolean(text.banner) === Boolean(screenSpace))
            .forEach(text => {
                if (screenSpace) {
                    this.renderCombatText(ctx, {
                        ...text,
                        x: this.mapWidth / 2,
                        y: this.mapHeight * 0.25
                    });
                } else {
                    this.renderCombatText(ctx, text);
                }
            });
    }

    renderWorldPaths(ctx) {
        const locations = Array.from(this.worldSystem.locations.values())
            // 已放弃的分支仍属于地形的一部分，保留它可避免选择路线后道路突然位移。
            .filter(location => location.kind === 'route')
            .sort((a, b) => (a.depth || 0) - (b.depth || 0) || (a.branch || 0) - (b.branch || 0));
        const depthCenters = new Map();
        locations.forEach(location => {
            const depth = location.depth || 0;
            if (!depthCenters.has(depth)) depthCenters.set(depth, []);
            depthCenters.get(depth).push(location);
        });
        const points = [{ ...this.worldSystem.spawnPoint }];
        for (const [, group] of Array.from(depthCenters.entries()).sort((a, b) => a[0] - b[0])) {
            points.push({
                x: group.reduce((sum, location) => sum + location.x, 0) / group.length,
                y: group.reduce((sum, location) => sum + location.y, 0) / group.length
            });
        }
        if (points.length < 2) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 58;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(92, 72, 55, 0.8)';
        ctx.lineWidth = 48;
        ctx.stroke();
        ctx.setLineDash([12, 18]);
        ctx.strokeStyle = 'rgba(255, 209, 103, 0.18)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
    }

    renderWorldObstacles(ctx) {
        this.worldSystem.obstacles.forEach(obstacle => {
            ctx.save();
            if (obstacle.type === 'water') {
                ctx.fillStyle = '#183844';
                ctx.strokeStyle = '#2e6570';
            } else if (obstacle.type === 'rocks') {
                ctx.fillStyle = '#343a3d';
                ctx.strokeStyle = '#5b6265';
            } else {
                ctx.fillStyle = '#302725';
                ctx.strokeStyle = '#705044';
            }
            ctx.lineWidth = 4;
            ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            for (let x = obstacle.x + 14; x < obstacle.x + obstacle.width; x += 34) {
                ctx.fillRect(x, obstacle.y + 12, 8, Math.max(8, obstacle.height - 24));
            }
            ctx.restore();
        });
    }

    renderWorldLocations(ctx) {
        const pulse = 1 + Math.sin(Date.now() / 260) * 0.08;
        for (const location of this.worldSystem.locations.values()) {
            if (location.state === 'missed') continue;
            const isTarget = location.id === this.worldSystem.navigationTargetId;
            if (!location.discovered && !isTarget && location.kind !== 'extraction') continue;
            const isLocked = location.state === 'locked';
            const isCleared = location.state === 'cleared';
            const radius = location.radius * (isTarget ? pulse : 1);

            ctx.save();
            ctx.globalAlpha = isLocked ? 0.38 : isCleared ? 0.45 : 1;
            if (isTarget && !isLocked) {
                ctx.strokeStyle = location.color || '#ffd167';
                ctx.lineWidth = 3;
                ctx.setLineDash([9, 7]);
                ctx.beginPath();
                ctx.arc(location.x, location.y, radius + 22, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(7, 10, 14, 0.9)';
            ctx.strokeStyle = isCleared ? '#59616a' : (location.color || '#ffd167');
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(location.x, location.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isCleared ? '#7f8790' : (location.color || '#ffd167');
            ctx.font = `bold ${Math.max(22, radius * 0.62)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isCleared ? '✓' : isLocked ? '×' : (location.icon || '◇'), location.x, location.y);

            if (location.discovered || isTarget || location.kind === 'extraction') {
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 14px Arial';
                ctx.shadowColor = '#000000';
                ctx.shadowBlur = 4;
                ctx.fillText(location.name, location.x, location.y + radius + 22);
            }
            ctx.restore();
        }
    }

    renderScreenOverlay(ctx) {
        this.renderFogOfWar(ctx);
        this.renderNavigationGuide(ctx);
        this.renderAimGuide(ctx);
        this.renderMinimap(ctx);
        this.renderExtractionProgress(ctx);
        this.renderPhasePrompt(ctx);
        this.renderFloatingTexts(ctx, { screenSpace: true });
    }

    renderAimGuide(ctx) {
        if (!this.runSystem.active || !this.manualAimEnabled) return;
        const origin = this.getHeroCenter();
        const direction = this.getCurrentAimDirection(origin);
        const weaponRange = Math.max(80, Number(this.getWeaponConfig()?.range) || 420);
        let distance = Math.min(weaponRange, 220);
        if (this.aimWorldPoint) {
            distance = Math.min(
                weaponRange,
                Math.max(24, Math.hypot(this.aimWorldPoint.x - origin.x, this.aimWorldPoint.y - origin.y))
            );
        }
        const target = {
            x: origin.x + direction.x * distance,
            y: origin.y + direction.y * distance
        };
        const originScreen = this.cameraSystem.worldToScreen(origin.x, origin.y);
        const targetScreen = this.cameraSystem.worldToScreen(target.x, target.y);
        const pulse = 1 + Math.sin(Date.now() / 120) * 0.08;
        const radius = 10 * pulse;

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 241, 167, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(originScreen.x + direction.x * 24, originScreen.y + direction.y * 24);
        ctx.lineTo(targetScreen.x - direction.x * radius, targetScreen.y - direction.y * radius);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#fff1a7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(targetScreen.x, targetScreen.y, radius, 0, Math.PI * 2);
        ctx.moveTo(targetScreen.x - radius - 6, targetScreen.y);
        ctx.lineTo(targetScreen.x - radius + 1, targetScreen.y);
        ctx.moveTo(targetScreen.x + radius - 1, targetScreen.y);
        ctx.lineTo(targetScreen.x + radius + 6, targetScreen.y);
        ctx.moveTo(targetScreen.x, targetScreen.y - radius - 6);
        ctx.lineTo(targetScreen.x, targetScreen.y - radius + 1);
        ctx.moveTo(targetScreen.x, targetScreen.y + radius - 1);
        ctx.lineTo(targetScreen.x, targetScreen.y + radius + 6);
        ctx.stroke();
        ctx.restore();
    }

    renderFogOfWar(ctx) {
        if (!this.runSystem.active) return;
        const hero = this.getHeroCenter();
        const screen = this.cameraSystem.worldToScreen(hero.x, hero.y);
        const outerRadius = Math.max(this.mapWidth, this.mapHeight) * 0.78;
        const gradient = ctx.createRadialGradient(
            screen.x,
            screen.y,
            95,
            screen.x,
            screen.y,
            outerRadius
        );
        gradient.addColorStop(0, 'rgba(4, 8, 12, 0)');
        gradient.addColorStop(0.42, 'rgba(4, 8, 12, 0.04)');
        gradient.addColorStop(0.74, 'rgba(4, 8, 12, 0.24)');
        gradient.addColorStop(1, 'rgba(4, 8, 12, 0.58)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);
    }

    renderNavigationGuide(ctx) {
        if (!this.runSystem.active) return;
        const state = this.worldSystem.getState(this.getHeroCenter());
        const target = state.navigationTarget;
        if (!target) return;
        const screen = this.cameraSystem.worldToScreen(target.x, target.y);
        const margin = 54;
        const visible = (
            screen.x >= margin && screen.x <= this.mapWidth - margin &&
            screen.y >= margin && screen.y <= this.mapHeight - margin
        );
        if (visible) return;

        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const angle = Math.atan2(screen.y - centerY, screen.x - centerX);
        const radiusX = Math.max(20, this.mapWidth / 2 - margin);
        const radiusY = Math.max(20, this.mapHeight / 2 - margin);
        const scale = Math.min(
            Math.abs(radiusX / (Math.cos(angle) || 0.0001)),
            Math.abs(radiusY / (Math.sin(angle) || 0.0001))
        );
        const x = centerX + Math.cos(angle) * scale;
        const y = centerY + Math.sin(angle) * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = target.color || '#ffd167';
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-7, 0);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    renderMinimap(ctx) {
        if (!this.worldSystem.initialized) return;
        const width = Math.min(190, Math.max(126, this.mapWidth * 0.19));
        const height = width * 0.62;
        const x = this.mapWidth - width - 14;
        const y = 112;
        const scaleX = width / this.worldSystem.width;
        const scaleY = height / this.worldSystem.height;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.86)';
        ctx.strokeStyle = '#72d7ff';
        ctx.lineWidth = 2;
        ctx.fillRect(x - 6, y - 22, width + 12, height + 30);
        ctx.strokeRect(x - 6, y - 22, width + 12, height + 30);
        ctx.fillStyle = '#dff7ff';
        ctx.font = 'bold 11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`探索 ${this.worldSystem.getExplorationPercent().toFixed(0)}%`, x, y - 7);
        ctx.fillStyle = '#0b1517';
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = '#17302d';
        this.worldSystem.revealedCells.forEach(cell => {
            const [column, row] = cell.split(',').map(Number);
            const cellX = column * this.worldSystem.cellSize;
            const cellY = row * this.worldSystem.cellSize;
            ctx.fillRect(
                x + cellX * scaleX,
                y + cellY * scaleY,
                Math.min(width - cellX * scaleX, this.worldSystem.cellSize * scaleX + 0.7),
                Math.min(height - cellY * scaleY, this.worldSystem.cellSize * scaleY + 0.7)
            );
        });

        this.worldSystem.obstacles.forEach(obstacle => {
            if (!this.worldSystem.isAreaRevealed(obstacle)) return;
            ctx.fillStyle = obstacle.type === 'water' ? '#285a68' : '#4b4542';
            ctx.fillRect(
                x + obstacle.x * scaleX,
                y + obstacle.y * scaleY,
                Math.max(2, obstacle.width * scaleX),
                Math.max(2, obstacle.height * scaleY)
            );
        });
        for (const location of this.worldSystem.locations.values()) {
            if (location.state === 'missed') continue;
            const isTarget = location.id === this.worldSystem.navigationTargetId;
            if (!location.discovered && !isTarget && location.kind !== 'extraction') continue;
            ctx.fillStyle = location.state === 'locked'
                ? '#5b6268'
                : location.state === 'cleared'
                    ? '#748078'
                    : (location.color || '#ffd167');
            ctx.beginPath();
            ctx.arc(x + location.x * scaleX, y + location.y * scaleY, location.kind === 'extraction' ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();
        }
        const hero = this.getHeroCenter();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x + hero.x * scaleX, y + hero.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();

        const camera = this.cameraSystem.getState();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
            x + camera.x * scaleX,
            y + camera.y * scaleY,
            Math.min(width, camera.width * scaleX),
            Math.min(height, camera.height * scaleY)
        );
        ctx.restore();
    }

    renderFocusTarget(ctx) {
        const target = this.monsters.find(monster => monster.id === this.focusTargetId);
        if (!target) return;
        const center = this.getEntityCenter(target);
        ctx.save();
        ctx.strokeStyle = '#fff1a7';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(center.x, center.y, Math.max(target.width, target.height) * 0.72, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    renderMonster(ctx, monster) {
        if (monster.bossTelegraphTimer > 0 && monster.bossTarget) {
            const pulse = (Math.sin(Date.now() / 70) + 1) / 2;
            const { warningRadius } = this.getBossAreaAttackGeometry();
            ctx.save();
            ctx.fillStyle = `rgba(255, 80, 55, ${0.1 + pulse * 0.08})`;
            ctx.strokeStyle = '#ff7043';
            ctx.lineWidth = 4;
            ctx.setLineDash([12, 8]);
            ctx.beginPath();
            // 外圈始终准确标出安全边界；脉冲只作用于透明度和内部提示圈。
            ctx.arc(monster.bossTarget.x, monster.bossTarget.y, warningRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.strokeStyle = `rgba(255, 178, 120, ${0.35 + pulse * 0.45})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(
                monster.bossTarget.x,
                monster.bossTarget.y,
                Math.max(1, warningRadius - 24 + pulse * 12),
                0,
                Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
        }
        if (monster.chargeTelegraph > 0 && monster.chargeVector) {
            const center = this.getEntityCenter(monster);
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 209, 103, 0.82)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(center.x + monster.chargeVector.x * 150, center.y + monster.chargeVector.y * 150);
            ctx.stroke();
            ctx.restore();
        }
        const image = this.monsterImages[monster.templateId];
        const animationState = monster.stunTimer > 0 ? 'idle' : monster.combatState;
        const sheet = this.getMonsterStateSheet(monster.templateId, animationState);
        const visualScale = this.getMonsterVisualScale(monster);
        const renderWidth = monster.width * visualScale;
        const renderHeight = monster.height * visualScale;
        const renderX = monster.x + monster.width / 2 - renderWidth / 2;
        const renderY = monster.y + monster.height / 2 - renderHeight / 2;

        if (sheet && sheet.complete && sheet.naturalWidth > 0) {
            const frameIndex = Math.floor(
                Math.max(0, Number(monster.animationStateTime) || 0) /
                this.getMonsterFrameDuration(animationState)
            ) % this.monsterSpriteFrameCount;
            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (monster.isBoss || monster.isElite) {
                ctx.shadowColor = monster.isBoss ? '#ff7043' : '#c38cff';
                ctx.shadowBlur = monster.isBoss ? 20 : 11;
            }
            ctx.drawImage(
                sheet,
                frameIndex * this.monsterSpriteFrameSize,
                0,
                this.monsterSpriteFrameSize,
                this.monsterSpriteFrameSize,
                renderX,
                renderY,
                renderWidth,
                renderHeight
            );
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

        const barWidth = monster.isBoss ? monster.width * 1.5 : monster.width;
        const barHeight = monster.isBoss ? 7 : 5;
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
        if (state === 'attack') return 27;
        return state === 'move' ? 38 : 58;
    }

    renderBullet(ctx, bullet) {
        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(Math.atan2(bullet.vy || 0, bullet.vx || 1));
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

    renderExtractionProgress(ctx) {
        if (this.runSystem.phase !== 'extracting') return;
        const state = this.getBattleState();
        const total = Math.max(1, this.extractionTotalDuration || this.currentEncounter?.durationMs || 1);
        const ratio = 1 - Math.min(1, this.extractionTimer / total);
        const width = Math.min(this.mapWidth * 0.54, 430);
        const x = (this.mapWidth - width) / 2;
        const y = this.mapHeight * 0.12;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.82)';
        ctx.fillRect(x - 12, y - 24, width + 24, 48);
        ctx.fillStyle = '#1f2935';
        ctx.fillRect(x, y, width, 10);
        ctx.fillStyle = '#72d7ff';
        ctx.fillRect(x, y, width * ratio, 10);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            state.extraction.contested
                ? `敌人占据信标 · 清除后继续 (${state.extraction.remainingSeconds} 秒)`
                : state.extraction.inZone
                    ? `撤离倒计时 ${state.extraction.remainingSeconds} 秒`
                    : `离开信标范围 · 进度已暂停 (${state.extraction.remainingSeconds} 秒)`,
            this.mapWidth / 2,
            y - 7
        );
        ctx.restore();
    }

    renderPhasePrompt(ctx) {
        if (this.isCombatActive() || this.runSystem.phase === 'route') return;
        const messages = {
            briefing: '开始远征：用 WASD / 方向键探索大地图，靠近地点后按 E 交互',
            search: '选择搜索方式：收益越高，伏击与威胁也越高',
            camp: '安全屋可以恢复生命并降低威胁',
            'extraction-ready': '核心区域已清理，返回地图西侧入口启动撤离信标',
            extracted: '撤离成功，奖励已经结算',
            defeat: '远征失败，点击“再次远征”重新整备'
        };
        const message = messages[this.runSystem.phase];
        if (!message) return;
        ctx.save();
        ctx.fillStyle = 'rgba(5, 7, 12, 0.76)';
        const boxWidth = Math.min(this.mapWidth * 0.72, 560);
        const boxHeight = 58;
        const x = (this.mapWidth - boxWidth) / 2;
        const y = this.mapHeight * 0.43;
        ctx.fillRect(x, y, boxWidth, boxHeight);
        ctx.strokeStyle = this.runSystem.canExtract() ? '#72d7ff' : '#ffd167';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, boxWidth, boxHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(12, Math.min(17, this.mapWidth * 0.023))}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, this.mapWidth / 2, y + boxHeight / 2);
        ctx.restore();
    }

    getSaveData() {
        const player = this.playerSystem?.player;
        const activeRun = this.runSystem.active ? {
            run: this.runSystem.getRunSaveData?.() || null,
            world: this.worldSystem.getRunSaveData?.() || null,
            hero: player ? { x: player.x, y: player.y } : null,
            runHp: this.runHp,
            runMaxHp: this.runMaxHp,
            runSnapshot: this.runSnapshot ? JSON.parse(JSON.stringify(this.runSnapshot)) : null,
            runPreparation: { ...this.runPreparation },
            runLoadoutEffects: JSON.parse(JSON.stringify(this.runLoadoutEffects)),
            runDamageTaken: this.runDamageTaken,
            returnPressure: { ...this.returnPressure },
            petSquadSnapshot: this.petSquadSnapshot ? JSON.parse(JSON.stringify(this.petSquadSnapshot)) : null,
            petGuardHp: this.petGuardHp,
            petGuardMaxHp: this.petGuardMaxHp,
            petRescueUsed: this.petRescueUsed,
            petRescueInvulnerabilityTimer: this.petRescueInvulnerabilityTimer,
            runBossKills: this.runBossKills,
            runEliteKills: this.runEliteKills,
            supplyCooldownTimer: this.supplyCooldownTimer,
            timeSinceDamage: Number.isFinite(this.timeSinceDamage) ? this.timeSinceDamage : 60000,
            skillCooldowns: Array.from(this.skillCooldowns.entries()),
            extractionTimer: this.extractionTimer,
            extractionTotalDuration: this.extractionTotalDuration,
            extractionOutOfZoneTimer: this.extractionOutOfZoneTimer,
            extractionReinforcementTimer: this.extractionReinforcementTimer,
            extractionReinforcementIntervalMs: this.extractionReinforcementIntervalMs,
            currentEncounter: this.currentEncounter ? { ...this.currentEncounter } : null,
            encounterQueue: this.encounterQueue.map(item => ({ ...item })),
            encounterRewards: { ...this.encounterRewards },
            encounterRewardsCommitted: this.encounterRewardsCommitted,
            monsters: this.monsters.map(monster => ({ ...monster })),
            bullets: this.bullets.map(bullet => ({ ...bullet })),
            activeWeaponId: this.activeWeaponId,
            lockedWeaponId: this.lockedWeaponId,
            weaponStates: Object.fromEntries(Object.entries(this.weaponStates).map(([id, state]) => [id, { ...state }])),
            aimDirection: { ...this.aimDirection },
            aimWorldPoint: this.aimWorldPoint ? { ...this.aimWorldPoint } : null,
            // 旧字段继续写入，便于旧客户端读取当前武器冷却；新客户端以 weaponStates 为准。
            shotCooldownTimer: Math.max(
                0,
                Number(this.weaponStates[this.activeWeaponId]?.shotCooldownRemainingMs) || 0
            ),
            weaponSwapLockTimer: Math.max(0, Number(this.weaponSwapLockTimer) || 0),
            legacyAutoAimEnabled: this.legacyAutoAimEnabled,
            firstStrikePending: this.firstStrikePending,
            firstStrikeBonus: this.firstStrikeBonus,
            nextMonsterId: this.nextMonsterId,
            nextBulletId: this.nextBulletId,
            settled: this.settled
        } : null;
        return {
            mode: this.mode,
            meta: { ...this.meta },
            activeRun
        };
    }

    loadSaveData(data) {
        if (data?.meta) {
            this.meta.bestDepth = Math.max(0, Number(data.meta.bestDepth ?? data.meta.bestWave) || 0);
            this.meta.bestExtractedDepth = Math.max(
                0,
                Number(data.meta.bestExtractedDepth) || 0
            );
            this.meta.extractions = Math.max(0, Number(data.meta.extractions ?? data.meta.victories) || 0);
            this.meta.losses = Math.max(0, Number(data.meta.losses ?? data.meta.defeats) || 0);
            this.meta.bossKills = Math.max(0, Number(data.meta.bossKills) || 0);
            this.meta.flawlessExtractions = Math.max(0, Number(data.meta.flawlessExtractions) || 0);
            this.meta.bestValue = Math.max(0, Number(data.meta.bestValue) || 0);
            this.meta.maxExpeditionPetCount = Math.max(0, Number(data.meta.maxExpeditionPetCount) || 0);
            this.meta.contractFragments = Math.max(0, Number(data.meta.contractFragments) || 0);
            this.meta.deepMaterials = Math.max(0, Number(data.meta.deepMaterials) || 0);
        }
        this.resetBattle();
        const active = data?.activeRun;
        if (!active || !active.run || typeof this.runSystem.loadRunSaveData !== 'function') return;
        const runLoaded = this.runSystem.loadRunSaveData(active.run);
        if (runLoaded === false || runLoaded?.success === false) return;
        if (active.world && typeof this.worldSystem.loadRunSaveData === 'function') {
            this.worldSystem.loadRunSaveData(active.world);
        }
        if (active.hero && this.playerSystem?.player) {
            this.playerSystem.player.x = Number(active.hero.x) || 0;
            this.playerSystem.player.y = Number(active.hero.y) || 0;
        }
        this.runHp = Math.max(0, Number(active.runHp) || 0);
        this.runMaxHp = Math.max(1, Number(active.runMaxHp) || 100);
        this.runSnapshot = active.runSnapshot || this.captureRunSnapshot();
        this.runPreparation = { ...this.runPreparation, ...(active.runPreparation || {}) };
        this.runLoadoutEffects = {
            ...this.runLoadoutEffects,
            ...(active.runLoadoutEffects || {}),
            consumed: Array.isArray(active.runLoadoutEffects?.consumed)
                ? active.runLoadoutEffects.consumed.map(item => ({ ...item }))
                : []
        };
        this.runDamageTaken = Math.max(0, Number(active.runDamageTaken) || 0);
        this.returnPressure = {
            distance: Math.max(0, Number(active.returnPressure?.distance) || 0),
            level: Math.max(0, Number(active.returnPressure?.level) || 0),
            triggers: Math.max(0, Number(active.returnPressure?.triggers) || 0)
        };
        this.petSquadSnapshot = active.petSquadSnapshot || null;
        this.petGuardHp = Math.max(0, Number(active.petGuardHp) || 0);
        this.petGuardMaxHp = Math.max(this.petGuardHp, Number(active.petGuardMaxHp) || 0);
        this.petRescueUsed = Boolean(active.petRescueUsed);
        this.petRescueInvulnerabilityTimer = Math.max(0, Number(active.petRescueInvulnerabilityTimer) || 0);
        this.runBossKills = Math.max(0, Number(active.runBossKills) || 0);
        this.runEliteKills = Math.max(0, Number(active.runEliteKills) || 0);
        this.supplyCooldownTimer = Math.max(0, Number(active.supplyCooldownTimer) || 0);
        this.timeSinceDamage = Math.max(0, Number(active.timeSinceDamage) || 0);
        this.skillCooldowns = new Map(Array.isArray(active.skillCooldowns) ? active.skillCooldowns : []);
        this.extractionTimer = Math.max(0, Number(active.extractionTimer) || 0);
        this.extractionTotalDuration = Math.max(this.extractionTimer, Number(active.extractionTotalDuration) || 0);
        this.extractionOutOfZoneTimer = Math.max(0, Number(active.extractionOutOfZoneTimer) || 0);
        this.extractionReinforcementTimer = Math.max(0, Number(active.extractionReinforcementTimer) || 0);
        this.extractionReinforcementIntervalMs = Math.max(
            0,
            Number(active.extractionReinforcementIntervalMs)
                || Number(active.currentEncounter?.reinforcementIntervalMs)
                || this.config.extractionReinforcementIntervalMs
        );
        this.currentEncounter = active.currentEncounter ? { ...active.currentEncounter } : null;
        this.encounterQueue = Array.isArray(active.encounterQueue) ? active.encounterQueue.map(item => ({ ...item })) : [];
        this.encounterRewards = { ...this.createEmptyRewards(), ...(active.encounterRewards || {}) };
        this.encounterRewardsCommitted = Boolean(active.encounterRewardsCommitted);
        this.monsters = Array.isArray(active.monsters) ? active.monsters.map(monster => ({ ...monster })) : [];
        this.bullets = Array.isArray(active.bullets) ? active.bullets.map(bullet => ({ ...bullet })) : [];
        const restoredWeaponId = String(active.lockedWeaponId || active.activeWeaponId || '');
        this.activeWeaponId = this.getWeaponConfig(restoredWeaponId) ? restoredWeaponId : this.weaponOrder[0];
        this.lockedWeaponId = this.activeWeaponId;
        const legacyShotCooldown = Math.max(0, Number(active.shotCooldownTimer) || 0);
        if (active.weaponStates && typeof active.weaponStates === 'object') {
            this.weaponOrder.forEach(weaponId => {
                const config = this.getWeaponConfig(weaponId);
                const saved = active.weaponStates[weaponId] || {};
                const hasPerWeaponCooldown = Object.prototype.hasOwnProperty.call(saved, 'shotCooldownRemainingMs');
                this.weaponStates[weaponId] = {
                    magazine: Math.max(0, Math.min(config.magazineSize, Math.floor(Number(saved.magazine) || 0))),
                    reserve: Math.max(0, Math.floor(Number(saved.reserve) || 0)),
                    reloadRemainingMs: weaponId === this.activeWeaponId
                        ? Math.max(0, Number(saved.reloadRemainingMs) || 0)
                        : 0,
                    shotCooldownRemainingMs: hasPerWeaponCooldown
                        ? Math.max(0, Number(saved.shotCooldownRemainingMs) || 0)
                        : weaponId === this.activeWeaponId ? legacyShotCooldown : 0
                };
            });
        } else {
            this.weaponStates[this.activeWeaponId].shotCooldownRemainingMs = legacyShotCooldown;
        }
        const aimX = Number(active.aimDirection?.x);
        const aimY = Number(active.aimDirection?.y);
        if (Number.isFinite(aimX) && Number.isFinite(aimY) && Math.hypot(aimX, aimY) > 0.001) {
            this.setAimDirection(aimX, aimY);
        }
        if (Number.isFinite(Number(active.aimWorldPoint?.x)) && Number.isFinite(Number(active.aimWorldPoint?.y))) {
            this.aimWorldPoint = { x: Number(active.aimWorldPoint.x), y: Number(active.aimWorldPoint.y) };
        }
        this.firingHeld = false;
        this.weaponSwapLockTimer = Math.max(0, Number(active.weaponSwapLockTimer) || 0);
        this.cancelInactiveReloads();
        this.syncLegacyShotCooldownTimer();
        this.legacyAutoAimEnabled = Boolean(active.legacyAutoAimEnabled);
        this.manualAimEnabled = !this.legacyAutoAimEnabled;
        this.firstStrikePending = Boolean(active.firstStrikePending);
        this.firstStrikeBonus = Math.max(0, Math.min(1, Number(active.firstStrikeBonus) || 0));
        this.nextMonsterId = Math.max(1, Number(active.nextMonsterId) || 1);
        this.nextBulletId = Math.max(1, Number(active.nextBulletId) || 1);
        this.settled = Boolean(active.settled);
        this.battleInitialized = true;
        if (this.runSystem.active && !this.expeditionMetaSystem?.getState?.()?.activeRaid) {
            this.expeditionMetaSystem?.startRaid?.();
        }
        this.worldSystem.updateExtractionAvailability?.(this.runSystem.getState());
        this.constrainHeroToWorld(this.playerSystem?.player);
        if (this.playerSystem?.player && this.worldSystem.initialized) {
            const center = this.getHeroCenter();
            this.cameraSystem.snapTo(center.x, center.y);
        }
        this.updateWorldAwareness();
    }
}

export function getCombatSystemInstance() {
    if (!instance) instance = new CombatSystem();
    return instance;
}
