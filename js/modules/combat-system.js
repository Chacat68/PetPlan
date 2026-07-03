/**
 * CombatSystem - 战斗系统
 * 管理怪物、子弹、碰撞检测、伤害计算
 */

import { TargetingSystem } from "./targeting-system.js?v=targeting-20260702a";

let instance = null;
const MONSTER_ASSET_VERSION = 'monster-actions-20260703a';

export class CombatSystem {
    constructor() {
        // 战斗实体
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.nextMonsterId = 1;
        this.targetingSystem = new TargetingSystem();
        
        // 怪物模板
        this.monsterTemplates = [
            {
                id: 'slime',
                name: '史莱姆',
                image: 'images/monsters/slime_table.png',
                walkSheet: 'images/sprites/monsters/slime_walk_sheet.png',
                baseHp: 30,
                baseAttack: 3,
                speed: 25,
                coinReward: 8,
                crystalReward: 1,
                expReward: 5,
                size: 35
            },
            {
                id: 'bat',
                name: '蝙蝠',
                image: 'images/monsters/bat_table.png',
                walkSheet: 'images/sprites/monsters/bat_fly_sheet.png',
                baseHp: 25,
                baseAttack: 5,
                speed: 45,
                coinReward: 12,
                crystalReward: 1,
                expReward: 8,
                size: 32
            },
            {
                id: 'skeleton',
                name: '骷髅战士',
                image: 'images/monsters/skeleton_table.png',
                walkSheet: 'images/sprites/monsters/skeleton_walk_sheet.png',
                baseHp: 50,
                baseAttack: 8,
                speed: 30,
                coinReward: 20,
                crystalReward: 2,
                expReward: 15,
                size: 40
            },
            {
                id: 'goblin',
                name: '哥布林',
                image: 'images/monsters/goblin_table.png',
                walkSheet: 'images/sprites/monsters/goblin_walk_sheet.png',
                baseHp: 40,
                baseAttack: 6,
                speed: 35,
                coinReward: 15,
                crystalReward: 2,
                expReward: 10,
                size: 36
            },
            {
                id: 'demon',
                name: '恶魔',
                image: 'images/monsters/demon_table.png',
                walkSheet: 'images/sprites/monsters/demon_walk_sheet.png',
                baseHp: 80,
                baseAttack: 12,
                speed: 28,
                coinReward: 35,
                crystalReward: 4,
                expReward: 25,
                size: 42
            },
            {
                id: 'dragon',
                name: 'Boss龙',
                image: 'images/monsters/dragon_table.png',
                walkSheet: 'images/sprites/monsters/dragon_walk_sheet.png',
                baseHp: 200,
                baseAttack: 25,
                speed: 20,
                coinReward: 100,
                crystalReward: 15,
                expReward: 80,
                size: 55,
                isBoss: true
            }
        ];
        
        // 怪物图片缓存
        this.monsterImages = {};
        this.monsterAnimationSheets = {};
        this.combatStates = ['idle', 'move', 'attack'];
        this.preloadImages();
        
        // 配置
        this.config = {
            monsterSpawnInterval: 2000,
            attackInterval: 800,
            bulletSpeed: 300,
            maxMonsters: 10
        };
        
        // 计时器
        this.spawnTimer = 0;
        this.attackTimer = 0;
        
        // 地图尺寸
        this.mapWidth = 400;
        this.mapHeight = 400;
        
        // 系统引用
        this.playerSystem = null;
        this.resourceSystem = null;
        this.territorySystem = null;
        
        console.log('[CombatSystem] 初始化完成');
    }
    
    /**
     * 预加载怪物图片
     */
    preloadImages() {
        this.monsterTemplates.forEach(template => {
            const img = new Image();
            img.onload = () => {
                this.monsterImages[template.id] = img;
            };
            img.onerror = () => {
                console.warn(`[CombatSystem] 图片加载失败: ${template.image}`);
            };
            img.src = `${template.image}?v=${MONSTER_ASSET_VERSION}`;
            if (img.complete && img.naturalWidth > 0) {
                this.monsterImages[template.id] = img;
            }

            this.monsterAnimationSheets[template.id] = {};
            this.combatStates.forEach(state => {
                const spritePath = this.getMonsterSpritePath(template, state);
                const sheet = new Image();
                sheet.onload = () => {
                    this.monsterAnimationSheets[template.id][state] = sheet;
                };
                sheet.onerror = () => {
                    console.warn(`[CombatSystem] 怪物 ${state} 序列帧加载失败: ${spritePath}`);
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
    
    /**
     * 设置玩家系统引用
     */
    setPlayerSystem(playerSystem) {
        this.playerSystem = playerSystem;
    }
    
    /**
     * 设置资源系统引用
     */
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
    }

    setTerritorySystem(territorySystem) {
        this.territorySystem = territorySystem;
    }
    
    /**
     * 更新逻辑
     */
    update(deltaTime) {
        // 更新怪物生成
        this.updateSpawn(deltaTime);
        
        // 更新攻击
        this.updateAttack(deltaTime);
        
        // 更新怪物移动
        this.updateMonsters(deltaTime);
        
        // 更新子弹
        this.updateBullets(deltaTime);
        
        // 更新爆炸效果
        this.updateExplosions(deltaTime);
        
        // 更新战斗文字
        this.updateCombatTexts(deltaTime);
        
        // 碰撞检测
        this.checkCollisions();
    }
    
    /**
     * 更新怪物生成
     */
    updateSpawn(deltaTime) {
        if (this.monsters.length >= this.config.maxMonsters) return;
        
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.config.monsterSpawnInterval) {
            this.spawnTimer = 0;
            this.spawnMonster();
        }
    }
    
    /**
     * 生成怪物
     */
    spawnMonster() {
        const playerLevel = this.playerSystem?.player.level || 1;
        
        // 根据玩家等级选择怪物类型
        let availableTemplates = this.monsterTemplates.filter(t => !t.isBoss);
        
        // 等级越高，出现更强怪物的概率越大
        if (playerLevel >= 10) {
            // 有概率刷出 Boss
            if (Math.random() < 0.05) {
                availableTemplates = this.monsterTemplates.filter(t => t.isBoss);
            }
        }
        
        // 随机选择一个怪物模板
        const template = availableTemplates[Math.floor(Math.random() * availableTemplates.length)];
        
        // 缩放系数
        const levelScale = 1 + (playerLevel - 1) * 0.15;
        
        const monster = {
            id: this.nextMonsterId++,
            templateId: template.id,
            x: this.mapWidth + 20,
            // 根据地图高度动态计算 y 位置（在地图高度的 55% - 75% 范围内）
            y: this.mapHeight * 0.55 + Math.random() * (this.mapHeight * 0.2),
            width: template.size,
            height: template.size,
            hp: Math.floor(template.baseHp * levelScale),
            maxHp: Math.floor(template.baseHp * levelScale),
            attack: Math.floor(template.baseAttack * levelScale),
            speed: template.speed + Math.random() * 10,
            coinReward: Math.floor(template.coinReward * levelScale),
            crystalReward: Math.max(0, Math.floor((template.crystalReward || 0) * levelScale)),
            expReward: Math.floor(template.expReward * levelScale),
            isBoss: template.isBoss || false,
            animationOffset: Math.random() * 400,
            combatState: 'idle',
            attackTimer: 0,
            attackDuration: template.isBoss ? 520 : 360,
            attackCooldown: 400 + Math.random() * 500
        };
        
        this.monsters.push(monster);
    }
    
    /**
     * 获取随机颜色（备用）
     */
    getRandomColor() {
        const colors = ['#ff4757', '#ff6b81', '#ff7f50', '#e74c3c', '#c0392b'];
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    /**
     * 更新攻击
     */
    updateAttack(deltaTime) {
        if (!this.playerSystem || this.monsters.length === 0) return;
        
        const player = this.playerSystem.player;
        const attackInterval = this.config.attackInterval / player.attackSpeed;
        
        this.attackTimer += deltaTime;
        if (this.attackTimer >= attackInterval) {
            this.attackTimer = 0;
            this.fireAtNearestMonsters();
        }
    }
    
    /**
     * 向最近的怪物发射子弹
     */
    fireAtNearestMonsters() {
        if (!this.playerSystem) return;
        
        const player = this.playerSystem.player;
        const multiShot = player.multiShot;
        const origin = this.getEntityCenter(player);
        const targets = this.getTargets(origin, {
            strategy: 'nearest',
            limit: multiShot
        });

        targets.forEach(target => this.fireBullet(target));
    }
    
    /**
     * 发射子弹
     */
    fireBullet(target) {
        if (!this.playerSystem) return;
        
        const player = this.playerSystem.player;
        if (typeof this.playerSystem.playAttackAnimation === 'function') {
            this.playerSystem.playAttackAnimation();
        }

        const targetPoint = this.getEntityCenter(target);
        const bulletOrigin = this.getPlayerBulletOrigin(targetPoint);
        
        const bullet = {
            x: bulletOrigin.x,
            y: bulletOrigin.y,
            targetX: targetPoint.x,
            targetY: targetPoint.y,
            speed: this.config.bulletSpeed,
            damage: this.getPlayerAttackDamage(),
            isCrit: Math.random() * 100 < player.crit,
            size: 6,
            color: '#FFD700'
        };
        
        // 暴击伤害
        if (bullet.isCrit) {
            bullet.damage *= player.critDamage / 100;
            bullet.color = '#FF4500';
            bullet.size = 8;
        }
        
        // 计算方向
        const dx = bullet.targetX - bullet.x;
        const dy = bullet.targetY - bullet.y;
        const dist = Math.hypot(dx, dy) || 1;
        bullet.vx = (dx / dist) * bullet.speed;
        bullet.vy = (dy / dist) * bullet.speed;
        
        this.bullets.push(bullet);
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
    
    /**
     * 更新怪物移动
     */
    updateMonsters(deltaTime) {
        const dt = deltaTime / 1000;
        
        this.monsters = this.monsters.filter(monster => {
            monster.attackCooldown = Math.max(0, (monster.attackCooldown || 0) - deltaTime);

            if (monster.attackTimer > 0) {
                monster.attackTimer = Math.max(0, monster.attackTimer - deltaTime);
                monster.combatState = 'attack';
            } else if (this.shouldMonsterAttack(monster)) {
                this.startMonsterAttack(monster);
            } else {
                monster.combatState = monster.speed > 0 ? 'move' : 'idle';
                monster.x -= monster.speed * dt;
            }
            
            // 移出屏幕则移除
            if (monster.x + monster.width < 0) {
                return false;
            }
            
            return true;
        });
    }

    shouldMonsterAttack(monster) {
        if (!this.playerSystem || monster.attackCooldown > 0) {
            return false;
        }

        const player = this.playerSystem.player;
        const monsterCenter = this.getEntityCenter(monster);
        const playerCenter = this.getEntityCenter(player);
        const attackRange = Math.max(58, monster.width * (monster.isBoss ? 2.3 : 1.85));

        return Math.hypot(monsterCenter.x - playerCenter.x, monsterCenter.y - playerCenter.y) <= attackRange;
    }

    startMonsterAttack(monster) {
        monster.combatState = 'attack';
        monster.attackTimer = monster.attackDuration || 360;
        monster.attackCooldown = monster.isBoss ? 1200 : 900;
    }
    
    /**
     * 更新子弹
     */
    updateBullets(deltaTime) {
        const dt = deltaTime / 1000;
        
        this.bullets = this.bullets.filter(bullet => {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
            
            // 移出屏幕则移除
            if (bullet.x < -10 || bullet.x > this.mapWidth + 10 ||
                bullet.y < -10 || bullet.y > this.mapHeight + 10) {
                return false;
            }
            
            return true;
        });
    }
    
    /**
     * 更新爆炸效果
     */
    updateExplosions(deltaTime) {
        this.explosions = this.explosions.filter(exp => {
            exp.life -= deltaTime;
            exp.radius += deltaTime * 0.05;
            return exp.life > 0;
        });
    }
    
    /**
     * 更新战斗文字
     */
    updateCombatTexts(deltaTime) {
        this.combatTexts = this.combatTexts.filter(text => {
            text.life -= deltaTime;
            text.y -= deltaTime * 0.05;
            return text.life > 0;
        });
    }
    
    /**
     * 碰撞检测
     */
    checkCollisions() {
        const bulletsToRemove = new Set();
        const monstersToRemove = new Set();
        
        this.bullets.forEach((bullet, bi) => {
            if (bulletsToRemove.has(bi)) return;

            this.monsters.forEach((monster, mi) => {
                if (bulletsToRemove.has(bi) || monstersToRemove.has(mi)) return;

                if (this.isColliding(bullet, monster)) {
                    bulletsToRemove.add(bi);
                    
                    // 造成伤害
                    monster.hp -= bullet.damage;
                    
                    // 添加伤害文字
                    this.addCombatText(
                        monster.x + monster.width / 2,
                        monster.y,
                        Math.floor(bullet.damage),
                        bullet.isCrit
                    );
                    
                    // 怪物死亡
                    if (monster.hp <= 0) {
                        monstersToRemove.add(mi);
                        this.onMonsterKilled(monster);
                    }
                }
            });
        });
        
        // 移除子弹和怪物
        this.bullets = this.bullets.filter((_, i) => !bulletsToRemove.has(i));
        this.monsters = this.monsters.filter((_, i) => !monstersToRemove.has(i));
    }
    
    /**
     * 碰撞检测辅助
     */
    isColliding(a, b) {
        const aSize = a.size || a.width;
        const bSize = b.size || b.width;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        return dist < (aSize + bSize) / 2;
    }
    
    /**
     * 添加战斗文字
     */
    addCombatText(x, y, damage, isCrit) {
        this.combatTexts.push({
            x,
            y,
            text: isCrit ? `${damage}!` : damage.toString(),
            color: isCrit ? '#FF4500' : '#FFD700',
            life: 800,
            size: isCrit ? 18 : 14
        });
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
            x: (entity?.x || 0) + (entity?.width || 0) / 2,
            y: (entity?.y || 0) + (entity?.height || 0) / 2
        };
    }

    applyPetDamage(monster, damage, isCrit = false) {
        if (!monster || monster.hp <= 0 || !this.monsters.includes(monster)) {
            return false;
        }

        monster.hp -= damage;
        this.addCombatText(
            monster.x + monster.width / 2,
            monster.y,
            Math.floor(damage),
            isCrit
        );

        if (monster.hp <= 0) {
            this.onMonsterKilled(monster);
            this.monsters = this.monsters.filter(item => item !== monster);
        }

        return true;
    }
    
    /**
     * 怪物被击杀
     */
    onMonsterKilled(monster) {
        // 添加爆炸效果
        this.explosions.push({
            x: monster.x + monster.width / 2,
            y: monster.y + monster.height / 2,
            radius: 10,
            life: 300,
            color: monster.color
        });
        
        // 奖励金币
        if (this.resourceSystem) {
            this.resourceSystem.addCoins(monster.coinReward);
            if (monster.crystalReward > 0) {
                this.resourceSystem.addCrystals(monster.crystalReward);
            }
        }
    }
    
    /**
     * 渲染
     */
    render(ctx) {
        this.renderWorld(ctx);
        this.renderFloatingTexts(ctx);
    }

    renderWorld(ctx) {
        // 渲染怪物
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        
        // 渲染子弹
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        
        // 渲染爆炸
        this.explosions.forEach(exp => this.renderExplosion(ctx, exp));
    }

    renderFloatingTexts(ctx) {
        // 渲染战斗文字
        this.combatTexts.forEach(text => this.renderCombatText(ctx, text));
    }
    
    /**
     * 渲染怪物
     */
    renderMonster(ctx, monster) {
        const img = this.monsterImages[monster.templateId];
        const animationState = this.getMonsterAnimationState(monster);
        const activeSheet = this.getMonsterStateSheet(monster.templateId, animationState);

        if (activeSheet && activeSheet.complete && activeSheet.naturalWidth > 0) {
            const visualScale = animationState === 'attack'
                ? (monster.isBoss ? 2.35 : 2.05)
                : (monster.isBoss ? 2.15 : 1.85);
            const renderWidth = monster.width * visualScale;
            const renderHeight = monster.height * visualScale;
            const renderX = monster.x + monster.width / 2 - renderWidth / 2;
            const renderY = monster.y + monster.height / 2 - renderHeight / 2;
            const frameSize = 512;
            const frameIndex = Math.floor((Date.now() + monster.animationOffset) / this.getMonsterFrameDuration(animationState)) % 4;

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            if (animationState === 'attack') {
                ctx.shadowColor = monster.isBoss ? '#ff4500' : '#ffd167';
                ctx.shadowBlur = monster.isBoss ? 18 : 11;
            }
            ctx.drawImage(
                activeSheet,
                frameIndex * frameSize,
                0,
                frameSize,
                frameSize,
                renderX,
                renderY,
                renderWidth,
                renderHeight
            );
            ctx.restore();
        } else if (img && img.complete && img.naturalWidth > 0) {
            // 使用图片渲染
            const visualScale = monster.isBoss ? 2.15 : 1.85;
            const renderWidth = monster.width * visualScale;
            const renderHeight = monster.height * visualScale;
            const renderX = monster.x + monster.width / 2 - renderWidth / 2;
            const renderY = monster.y + monster.height / 2 - renderHeight / 2;

            ctx.save();
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                img,
                renderX,
                renderY,
                renderWidth,
                renderHeight
            );
            
            // Boss 发光效果
            if (monster.isBoss) {
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 15;
                ctx.drawImage(img, renderX, renderY, renderWidth, renderHeight);
            }
            ctx.restore();
        } else {
            // 备用：绘制圆形
            ctx.fillStyle = '#ff4757';
            ctx.beginPath();
            ctx.arc(
                monster.x + monster.width / 2,
                monster.y + monster.height / 2,
                monster.width / 2,
                0, Math.PI * 2
            );
            ctx.fill();
        }
        
        // 生命条
        const barWidth = monster.width;
        const barHeight = monster.isBoss ? 6 : 4;
        const barX = monster.x;
        const barY = monster.y - 10;
        
        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);
        
        // 生命值
        const hpRatio = monster.hp / monster.maxHp;
        let hpColor = '#2ed573';
        if (hpRatio < 0.5) hpColor = '#ffa502';
        if (hpRatio < 0.25) hpColor = '#ff4757';
        if (monster.isBoss) hpColor = '#ff4500';
        
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barWidth * hpRatio, barHeight);
        
        // Boss 名称
        if (monster.isBoss) {
            ctx.font = 'bold 12px Arial';
            ctx.fillStyle = '#ff4500';
            ctx.textAlign = 'center';
            ctx.fillText('BOSS', monster.x + monster.width / 2, monster.y - 15);
        }
    }

    getMonsterAnimationState(monster) {
        if (monster.combatState === 'attack' || monster.attackTimer > 0) return 'attack';
        if (monster.combatState === 'idle') return 'idle';
        return 'move';
    }

    getMonsterStateSheet(templateId, state) {
        const sheets = this.monsterAnimationSheets[templateId];
        return sheets?.[state] || sheets?.move || sheets?.idle;
    }

    getMonsterFrameDuration(state) {
        if (state === 'attack') return 85;
        if (state === 'move') return 120;
        return 175;
    }
    
    /**
     * 渲染子弹
     */
    renderBullet(ctx, bullet) {
        const visualSize = bullet.isCrit ? 18 : 14;
        const angle = Math.atan2(bullet.vy || 0, bullet.vx || 1);

        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.rotate(angle);
        ctx.imageSmoothingEnabled = false;

        ctx.fillStyle = bullet.isCrit ? 'rgba(255, 69, 0, 0.35)' : 'rgba(255, 209, 103, 0.28)';
        ctx.fillRect(-visualSize * 1.65, -2, visualSize * 1.1, 4);

        this.renderPixelCoinBullet(ctx, visualSize, bullet.isCrit);
        ctx.restore();
    }

    renderPixelCoinBullet(ctx, size, isCrit) {
        const r = Math.round(size / 2);
        const rim = isCrit ? '#ff5a1f' : '#f6a936';
        const face = isCrit ? '#ffd167' : '#ffd86b';
        const shade = isCrit ? '#7a1d12' : '#7a4b18';
        const shine = '#fff0b8';

        ctx.fillStyle = '#1a0e08';
        ctx.fillRect(-r + 2, -r, r * 2 - 4, 2);
        ctx.fillRect(-r, -r + 2, r * 2, r * 2 - 4);
        ctx.fillRect(-r + 2, r - 2, r * 2 - 4, 2);

        ctx.fillStyle = rim;
        ctx.fillRect(-r + 3, -r + 2, r * 2 - 6, 3);
        ctx.fillRect(-r + 1, -r + 5, r * 2 - 2, r * 2 - 10);
        ctx.fillRect(-r + 3, r - 5, r * 2 - 6, 3);

        ctx.fillStyle = face;
        ctx.fillRect(-r + 5, -r + 5, r * 2 - 10, r * 2 - 10);

        ctx.fillStyle = shade;
        ctx.fillRect(-1, -r + 6, 2, r * 2 - 12);
        ctx.fillRect(-4, -3, 8, 2);
        ctx.fillRect(-4, 3, 8, 2);

        ctx.fillStyle = shine;
        ctx.fillRect(-r + 6, -r + 6, 4, 3);
        ctx.fillRect(-r + 10, -r + 9, 3, 2);
    }
    
    /**
     * 渲染爆炸
     */
    renderExplosion(ctx, exp) {
        const alpha = exp.life / 300;
        ctx.fillStyle = `rgba(255, 100, 50, ${alpha})`;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    /**
     * 渲染战斗文字
     */
    renderCombatText(ctx, text) {
        const alpha = text.life / 800;
        ctx.font = `bold ${text.size}px Arial`;
        ctx.fillStyle = text.color;
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.fillText(text.text, text.x, text.y);
        ctx.globalAlpha = 1;
    }
    
    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            // 战斗状态不需要保存
        };
    }
    
    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        // 重置战斗状态
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        this.nextMonsterId = 1;
    }
}

/**
 * 获取单例实例
 */
export function getCombatSystemInstance() {
    if (!instance) {
        instance = new CombatSystem();
    }
    return instance;
}
