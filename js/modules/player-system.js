/**
 * PlayerSystem - 玩家系统
 * 管理玩家属性、升级和战力计算
 */

import { MovementSystem } from "./movement-system.js?v=movement-20260702a";

let instance = null;
const PLAYER_ASSET_VERSION = 'anime-gunner-20260702a';

export class PlayerSystem {
    constructor() {
        // 玩家数据
        this.player = {
            // 位置
            x: 160,
            y: 300,
            width: 40,
            height: 40,
            
            // 等级
            level: 1,
            exp: 0,
            expToNext: 100,
            
            // 战斗属性
            hp: 100,
            maxHp: 100,
            attack: 20,
            defense: 0,
            hpRegen: 1,
            critDamage: 150,
            attackSpeed: 1.0,
            crit: 5,
            multiShot: 1
        };
        
        // 升级成本
        this.upgradeCosts = {
            attack: 10,
            maxHp: 15,
            hpRegen: 20,
            critDamage: 25,
            attackSpeed: 30,
            crit: 35,
            multiShot: 40
        };
        
        // 升级增量
        this.upgradeIncrements = {
            attack: 5,
            maxHp: 20,
            hpRegen: 1,
            critDamage: 10,
            attackSpeed: 0.1,
            crit: 1,
            multiShot: 1
        };
        
        // 升级上限
        this.upgradeLimits = {
            attackSpeed: 10,
            crit: 100,
            multiShot: 10
        };
        
        // 系统引用
        this.resourceSystem = null;
        this.combatSystem = null;
        this.movementSystem = new MovementSystem();
        this.movementConfig = {
            homeRatioX: 0.24,
            homeRatioY: 0.64,
            engageOffsetX: 145,
            maxEngageRatioX: 0.42,
            moveSpeed: 135,
            attackSpeedBonus: 16
        };
        this.combatState = 'idle';

        // 角色贴图
        this.playerImage = new Image();
        this.playerImageLoaded = false;
        this.playerImage.onload = () => {
            this.playerImageLoaded = true;
        };
        this.playerImage.onerror = () => {
            console.warn('[PlayerSystem] 角色图片加载失败: images/player/table_hero.png');
        };
        this.playerImage.src = `images/player/table_hero.png?v=${PLAYER_ASSET_VERSION}`;

        this.spriteFrameSize = 512;
        this.playerSprites = {
            idle: this.loadSpriteSheet('images/sprites/battle/hero/hero_idle_sheet.png', 4, 190),
            move: this.loadSpriteSheet('images/sprites/battle/hero/hero_move_sheet.png', 4, 115),
            attack: this.loadSpriteSheet('images/sprites/battle/hero/hero_attack_sheet.png', 4, 75)
        };
        this.attackAnimationTimer = 0;
        this.attackAnimationDuration = 300;
        
        // 动画
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationTime = 0;
        
        // 生命恢复计时器
        this.regenTimer = 0;
        
        console.log('[PlayerSystem] 初始化完成');
    }

    loadSpriteSheet(src, frameCount, frameDuration) {
        const image = new Image();
        const sprite = {
            image,
            src,
            frameCount,
            frameDuration,
            loaded: false
        };

        image.onload = () => {
            sprite.loaded = true;
        };
        image.onerror = () => {
            console.warn(`[PlayerSystem] 序列帧加载失败: ${src}`);
        };
        image.src = `${src}?v=${PLAYER_ASSET_VERSION}`;

        return sprite;
    }
    
    /**
     * 设置资源系统引用
     */
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    setCombatSystem(combatSystem) {
        this.combatSystem = combatSystem;
    }
    
    /**
     * 升级属性
     */
    upgradeAttribute(attr) {
        const cost = this.upgradeCosts[attr];
        const increment = this.upgradeIncrements[attr];
        
        if (!cost || !increment) {
            return { success: false, message: '无效属性' };
        }
        
        // 检查上限
        if (this.upgradeLimits[attr] && this.player[attr] >= this.upgradeLimits[attr]) {
            return { success: false, message: '已达上限' };
        }
        
        // 检查金币
        if (!this.resourceSystem || !this.resourceSystem.hasEnoughCoins(cost)) {
            return { success: false, message: '金币不足' };
        }
        
        // 扣除金币
        this.resourceSystem.spendCoins(cost);
        
        // 增加属性
        this.player[attr] += increment;
        
        // 特殊处理：maxHp 增加时，hp 也增加
        if (attr === 'maxHp') {
            this.player.hp = Math.min(this.player.hp + increment, this.player.maxHp);
        }
        
        // 增加升级成本 (1.15 倍)
        this.upgradeCosts[attr] = Math.floor(cost * 1.15);
        
        // 更新显示
        this.updateDisplay();
        
        return { success: true, message: `${attr} +${increment}` };
    }

    applyFateTraining() {
        const attackGain = 5;
        const maxHpGain = 10;

        this.player.attack += attackGain;
        this.player.maxHp += maxHpGain;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + maxHpGain);

        this.updateDisplay();

        return {
            success: true,
            message: `主角训练: 攻击 +${attackGain}, 生命 +${maxHpGain}`,
            gains: {
                attack: attackGain,
                maxHp: maxHpGain
            }
        };
    }

    /**
     * 统一的经验结算入口。塔防胜负结算通过这里升级，避免直接改写存档字段。
     */
    addExperience(amount) {
        const gained = Math.max(0, Math.floor(Number(amount) || 0));
        if (gained <= 0) {
            return { gained: 0, levelsGained: 0, level: this.player.level };
        }

        this.player.exp += gained;
        let levelsGained = 0;

        while (this.player.exp >= this.player.expToNext) {
            this.player.exp -= this.player.expToNext;
            this.player.level += 1;
            this.player.expToNext = Math.max(100, Math.floor(this.player.expToNext * 1.22));
            this.player.attack += 2;
            this.player.maxHp += 5;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 5);
            levelsGained += 1;
        }

        this.updateDisplay();
        return { gained, levelsGained, level: this.player.level };
    }
    
    /**
     * 计算总战力
     */
    calculateTotalPower() {
        const p = this.player;
        return Math.floor(
            p.attack * 10 +
            p.maxHp * 0.5 +
            p.defense * 5 +
            p.hpRegen * 2 +
            p.critDamage * 0.1 +
            p.attackSpeed * 50 +
            p.crit * 3 +
            p.multiShot * 100
        );
    }
    
    /**
     * 更新逻辑
     */
    update(deltaTime) {
        // 生命恢复
        this.regenTimer += deltaTime;
        if (this.regenTimer >= 1000) {
            this.regenTimer = 0;
            if (this.player.hp < this.player.maxHp) {
                this.player.hp = Math.min(
                    this.player.hp + this.player.hpRegen,
                    this.player.maxHp
                );
            }
        }

        this.updateBattleMovement(deltaTime);
        
        // 动画帧更新
        this.animationTime += deltaTime;
        this.animationTimer += deltaTime;
        if (this.animationTimer >= 200) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }

        if (this.attackAnimationTimer > 0) {
            this.attackAnimationTimer = Math.max(0, this.attackAnimationTimer - deltaTime);
        }
    }

    playAttackAnimation() {
        this.attackAnimationTimer = this.attackAnimationDuration;
        this.setCombatState('attack');
    }

    updateBattleMovement(deltaTime) {
        if (!this.combatSystem || this.combatSystem.isPaused) {
            this.setCombatState('idle');
            return;
        }

        if (this.combatSystem.mode === 'towerDefense') {
            const position = this.combatSystem.getHeroPosition?.();
            if (position) {
                this.player.x = position.x;
                this.player.y = position.y;
            }
            this.setCombatState('idle');
            return;
        }

        const origin = this.movementSystem.getCenter(this.player);
        const target = typeof this.combatSystem.acquireTarget === 'function'
            ? this.combatSystem.acquireTarget(origin, { strategy: 'ahead' })
            : this.combatSystem.getNearestMonster?.(origin.x, origin.y);
        const destination = target
            ? this.getEngagePosition(target)
            : this.getHomePosition();

        const movement = this.movementSystem.moveToward(
            this.player,
            destination.x,
            destination.y,
            this.getMoveSpeed(),
            deltaTime,
            {
                bounds: this.getBattleBounds(),
                arriveDistance: 2,
                maxDeltaTime: 50
            }
        );

        this.setCombatState(movement.moved ? 'move' : 'idle');
    }

    getHomePosition() {
        const width = this.combatSystem?.mapWidth || 400;
        const height = this.combatSystem?.mapHeight || 400;

        return {
            x: width * this.movementConfig.homeRatioX - this.player.width / 2,
            y: height * this.movementConfig.homeRatioY - this.player.height / 2
        };
    }

    getEngagePosition(target) {
        const width = this.combatSystem?.mapWidth || 400;
        const height = this.combatSystem?.mapHeight || 400;
        const targetCenterY = target.y + target.height / 2;
        const maxX = width * this.movementConfig.maxEngageRatioX;

        return {
            x: Math.max(24, Math.min(maxX, target.x - this.movementConfig.engageOffsetX)),
            y: Math.max(70, Math.min(height - this.player.height - 24, targetCenterY - this.player.height / 2))
        };
    }

    getBattleBounds() {
        const width = this.combatSystem?.mapWidth || 400;
        const height = this.combatSystem?.mapHeight || 400;

        return {
            minX: 16,
            minY: 48,
            maxX: width - 16,
            maxY: height - 16
        };
    }

    getMoveSpeed() {
        return this.movementConfig.moveSpeed + this.player.attackSpeed * this.movementConfig.attackSpeedBonus;
    }

    setCombatState(state) {
        if (this.combatState === state) return;
        this.combatState = state;
    }

    getAnimationState() {
        if (this.attackAnimationTimer > 0) {
            return 'attack';
        }

        return this.combatState === 'move' ? 'move' : 'idle';
    }

    getGunMuzzlePosition(targetPoint = null) {
        const { x, y, width, height } = this.player;

        if (this.combatSystem?.mode === 'towerDefense') {
            const centerX = x + width / 2;
            const centerY = y + height / 2;
            const dx = (targetPoint?.x ?? centerX) - centerX;
            const dy = (targetPoint?.y ?? centerY - 1) - centerY;
            const distance = Math.hypot(dx, dy) || 1;
            return {
                x: centerX + (dx / distance) * width * 0.38,
                y: centerY + (dy / distance) * height * 0.38
            };
        }

        const spriteSize = Math.max(width, height) * 2.1;
        const spriteX = x + width / 2 - spriteSize / 2;
        const spriteY = y + height / 2 - spriteSize / 2 - height * 0.18;

        return {
            x: spriteX + spriteSize * 0.825,
            y: spriteY + spriteSize * 0.35
        };
    }
    
    /**
     * 渲染玩家
     */
    render(ctx) {
        const { x, y, width, height } = this.player;
        const runHero = this.combatSystem?.getRunHeroState?.();
        const hp = runHero?.hp ?? this.player.hp;
        const maxHp = runHero?.maxHp ?? this.player.maxHp;
        
        const imageReady = (
            this.playerImageLoaded ||
            (this.playerImage.complete && this.playerImage.naturalWidth > 0)
        );

        const animationState = this.getAnimationState();
        const activeSprite = this.playerSprites[animationState] || this.playerSprites.idle;
        const spriteReady = activeSprite && (
            activeSprite.loaded ||
            (activeSprite.image.complete && activeSprite.image.naturalWidth > 0)
        );

        if (spriteReady) {
            let frameIndex = Math.floor(this.animationTime / activeSprite.frameDuration) % activeSprite.frameCount;
            if (animationState === 'attack') {
                const elapsed = this.attackAnimationDuration - this.attackAnimationTimer;
                frameIndex = Math.min(
                    activeSprite.frameCount - 1,
                    Math.floor(elapsed / activeSprite.frameDuration)
                );
            }

            this.renderSpriteFrame(ctx, activeSprite, frameIndex, x, y, width, height);
        } else if (imageReady) {
            const spriteSize = Math.max(width, height) * 2.1;
            const spriteX = x + width / 2 - spriteSize / 2;
            const spriteY = y + height / 2 - spriteSize / 2 - height * 0.18;

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.playerImage, spriteX, spriteY, spriteSize, spriteSize);
            ctx.restore();
        } else {
            // 图片未加载时保留简单占位，避免战斗空角色。
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(x + width * 0.35, y + height * 0.4, 3, 0, Math.PI * 2);
            ctx.arc(x + width * 0.65, y + height * 0.4, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 塔防中主角是基地英雄塔，基地生命由 CombatSystem 单独绘制。
        if (this.combatSystem?.mode === 'towerDefense') return;
        
        // 绘制生命条
        const barWidth = 50;
        const barHeight = 6;
        const barX = x + (width - barWidth) / 2;
        const barY = y - 15;
        
        // 背景
        ctx.fillStyle = '#333';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // 生命值
        const hpRatio = hp / maxHp;
        ctx.fillStyle = hpRatio > 0.5 ? '#2ed573' : hpRatio > 0.25 ? '#ffa502' : '#ff4757';
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        
        // 边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    renderSpriteFrame(ctx, sprite, frameIndex, x, y, width, height) {
        const spriteSize = Math.max(width, height) * 2.1;
        const spriteX = x + width / 2 - spriteSize / 2;
        const spriteY = y + height / 2 - spriteSize / 2 - height * 0.18;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            sprite.image,
            frameIndex * (sprite.frameSize || this.spriteFrameSize),
            0,
            sprite.frameSize || this.spriteFrameSize,
            sprite.frameSize || this.spriteFrameSize,
            spriteX,
            spriteY,
            spriteSize,
            spriteSize
        );
        ctx.restore();
    }
    
    /**
     * 更新 UI 显示
     */
    updateDisplay() {
        // 更新属性值
        const attrs = ['attack', 'maxHp', 'hpRegen', 'critDamage', 'attackSpeed', 'crit', 'multiShot'];
        
        attrs.forEach(attr => {
            let value = this.player[attr];
            let displayValue = value;
            if (attr === 'critDamage' || attr === 'crit') {
                displayValue = `${value}%`;
            } else if (attr === 'attackSpeed') {
                displayValue = value.toFixed(1);
            }

            const valueEl = document.getElementById(`${attr}-value`);
            if (valueEl) {
                valueEl.textContent = displayValue;
            }

            document.querySelectorAll(`[data-player-value="${attr}"]`).forEach(valueNode => {
                valueNode.textContent = displayValue;
            });
            
            // 更新按钮成本
            if (this.resourceSystem) {
                document.querySelectorAll(`.upgrade-btn[data-attr="${attr}"] .cost`).forEach(costNode => {
                    costNode.textContent = `${this.resourceSystem.formatNumber(this.upgradeCosts[attr])}💰`;
                });
            }
        });
    }
    
    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            player: { ...this.player },
            upgradeCosts: { ...this.upgradeCosts }
        };
    }
    
    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (!data) return;
        
        if (data.player) {
            Object.assign(this.player, data.player);
        }
        if (data.upgradeCosts) {
            Object.assign(this.upgradeCosts, data.upgradeCosts);
        }
        
        this.updateDisplay();
    }
}

/**
 * 获取单例实例
 */
export function getPlayerSystemInstance() {
    if (!instance) {
        instance = new PlayerSystem();
    }
    return instance;
}
