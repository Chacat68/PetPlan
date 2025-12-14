/**
 * 战斗系统模块
 * 负责管理怪物生成、子弹系统、碰撞检测、爆炸效果等战斗相关功能
 */

import { getTerritorySystemInstance } from './territory-system.js';

class CombatSystem {
    constructor(gameCore, playerSystem, resourceSystem) {
        this.gameCore = gameCore;
        this.playerSystem = playerSystem;
        this.resourceSystem = resourceSystem;
        this.petSystem = null; // 宠物系统引用，稍后设置
        this.achievementSystem = null; // 成就系统引用

        // 怪物系统
        this.monsters = [];
        this.monsterSpawnTimer = 0;
        this.monsterSpawnInterval = 2000; // 2秒生成一个怪物

        // 子弹系统
        this.bullets = [];
        this.attackTimer = 0;
        this.attackInterval = 800; // 攻击间隔（毫秒）
        this.attackRange = 500; // 攻击范围

        // 爆炸效果
        this.explosions = [];

        // 战斗文字
        this.combatTexts = [];

        console.log('战斗系统初始化完成');
    }

    /**
     * 设置宠物系统引用
     */
    setPetSystem(petSystem) {
        this.petSystem = petSystem;
        console.log('宠物系统已连接到战斗系统');
    }

    /**
     * 设置成就系统引用
     */
    setAchievementSystem(achievementSystem) {
        this.achievementSystem = achievementSystem;
        console.log('成就系统已连接到战斗系统');
    }

    /**
     * 更新战斗系统
     */
    update(deltaTime) {
        // 更新怪物生成
        this.updateMonsterSpawn(deltaTime);

        // 更新怪物
        this.updateMonsters(deltaTime);

        // 更新子弹
        this.updateBullets(deltaTime);

        // 更新爆炸效果
        this.updateExplosions(deltaTime);

        // 更新自动攻击
        this.updateAutoAttack(deltaTime);

        // 检测近战战斗
        this.checkCombat();

        // 更新战斗文字
        this.updateCombatTexts(deltaTime);

        // 更新宠物战斗（如果宠物系统已连接）
        if (this.petSystem) {
            this.updatePetCombat(deltaTime);
        }
    }

    /**
     * 更新宠物战斗
     */
    updatePetCombat(deltaTime) {
        // 更新宠物系统
        this.petSystem.update(deltaTime);

        // 处理宠物子弹与怪物的碰撞
        this.checkPetBulletCollisions();

        // 处理宠物技能效果
        this.applyPetSkillEffects();
    }

    /**
     * 检测宠物子弹碰撞
     */
    checkPetBulletCollisions() {
        if (!this.petSystem || !this.petSystem.petBullets) return;

        for (let i = this.petSystem.petBullets.length - 1; i >= 0; i--) {
            const bullet = this.petSystem.petBullets[i];

            // 检测与怪物的碰撞
            for (let j = this.monsters.length - 1; j >= 0; j--) {
                const monster = this.monsters[j];

                // 简单的距离碰撞检测
                const dx = bullet.x - (monster.x + monster.width / 2);
                const dy = bullet.y - (monster.y + monster.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < (bullet.size + monster.width / 2)) {
                    // 子弹命中怪物
                    monster.hp -= bullet.damage;

                    // 显示伤害文字
                    this.addCombatText(
                        monster.x + monster.width / 2,
                        monster.y - 10,
                        `-${this.resourceSystem.formatNumber(bullet.damage)}`,
                        '#ff6b9d'
                    );

                    // 创建爆炸效果
                    this.createExplosion(bullet.x, bullet.y);

                    // 移除子弹
                    this.petSystem.petBullets.splice(i, 1);

                    // 检查怪物是否死亡
                    if (monster.hp <= 0) {
                        // 奖励
                        this.resourceSystem.addCoins(monster.coinReward);
                        this.addCombatText(
                            monster.x + monster.width / 2,
                            monster.y - 20,
                            `+${this.resourceSystem.formatNumber(monster.coinReward)} 金币`,
                            '#ffd700'
                        );

                        // 红宝石掉落
                        if (Math.random() < 0.1) {
                            const rubyReward = 1 + Math.floor(Math.random() * 3);
                            this.resourceSystem.addRubies(rubyReward);
                            this.addCombatText(
                                monster.x + monster.width / 2,
                                monster.y - 35,
                                `+${rubyReward} 红宝石`,
                                '#ff4757'
                            );
                        }

                        // 触发成就事件
                        if (this.achievementSystem) {
                            this.achievementSystem.onEvent('kill', 1);
                        }

                        // 移除怪物
                        this.monsters.splice(j, 1);
                    }

                    break;
                }
            }
        }
    }

    /**
     * 应用宠物技能效果
     */
    applyPetSkillEffects() {
        if (!this.petSystem || !this.petSystem.petSkillEffects) return;

        this.petSystem.petSkillEffects.forEach(effect => {

            // 特殊技能逻辑：治疗和Buff（不针对怪物）
            if (effect.skillId === 'holy_light') {
                if (!effect.hasTriggered) {
                    // 治疗玩家
                    const playerData = this.playerSystem.getPlayerData();
                    const healAmount = effect.heal || 50;

                    // 实际应该检查谁血量最低，这里简单起见先治疗玩家
                    const newHp = Math.min(playerData.maxHp, playerData.hp + healAmount);
                    this.playerSystem.setPlayerData({ hp: newHp });

                    this.addCombatText(
                        playerData.x + playerData.width / 2,
                        playerData.y - 30,
                        `+${healAmount}`,
                        '#2ed573'
                    );

                    // 添加Buff (暂时简化为直接加攻击力，理想情况应该是在PlayerSystem中管理Buff列表)
                    // 由于PlayerSystem尚未支持Buff列表，这里暂时略过Buff的具体实现，留作后续任务
                    console.log('圣光治疗触发！');

                    effect.hasTriggered = true;
                }
                return; // 治疗技能不伤害怪物
            }

            // 伤害性技能逻辑
            this.monsters.forEach(monster => {
                // 范围判定（简单的距离检测）
                const dx = monster.x + monster.width / 2 - effect.x;
                const dy = monster.y + monster.height / 2 - effect.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                const skillRange = 150; // 技能影响范围 (扩大一点)
                if (distance < skillRange) {
                    // 对怪物造成技能伤害（每个effect只造成一次伤害）
                    if (!effect.appliedTo) effect.appliedTo = [];
                    if (!effect.appliedTo.includes(monster)) {

                        // 初始伤害
                        if (effect.damage) {
                            monster.hp -= effect.damage;
                            this.addCombatText(
                                monster.x + monster.width / 2,
                                monster.y - 10,
                                `-${this.resourceSystem.formatNumber(effect.damage)}`,
                                '#bb86fc'
                            );
                        }

                        // 附加效果
                        if (effect.skillId === 'frost_nova') {
                            // 减速
                            monster.speedMultiplier = effect.slow || 0.5;
                            monster.slowTimer = 3000; // 3秒
                            this.addCombatText(monster.x, monster.y - 30, '减速!', '#03a9f4');
                        }

                        if (effect.skillId === 'earthquake') {
                            // 眩晕
                            monster.isStunned = true;
                            monster.stunTimer = effect.stun || 1000;
                            this.addCombatText(monster.x, monster.y - 30, '眩晕!', '#8d6e63');
                        }

                        // 暗影突袭 - 高暴击
                        if (effect.skillId === 'shadow_strike') {
                            // 已经在damage中体现了，或者可以在这里额外处理
                        }

                        effect.appliedTo.push(monster);
                    }
                }
            });
        });
    }

    /**
     * 获取所有怪物（供宠物系统使用）
     */
    getMonsters() {
        return this.monsters;
    }

    /**
     * 渲染战斗系统
     */
    render(ctx) {
        // 绘制子弹
        this.drawBullets(ctx);

        // 绘制爆炸效果
        this.drawExplosions(ctx);

        // 绘制怪物
        this.drawMonsters(ctx);

        // 绘制战斗文字
        this.drawCombatTexts(ctx);
    }

    /**
     * 更新怪物生成
     */
    updateMonsterSpawn(deltaTime) {
        this.monsterSpawnTimer += deltaTime;

        if (this.monsterSpawnTimer >= this.monsterSpawnInterval) {
            this.spawnMonster();
            this.monsterSpawnTimer = 0;
        }
    }

    /**
     * 生成怪物
     */
    spawnMonster() {
        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const playerData = this.playerSystem.getPlayerData();
        const playerY = groundY - playerData.height;

        // 随机生成怪物的三维属性
        const levelFactor = playerData.level;
        const baseStr = 5 + Math.floor(Math.random() * levelFactor * 2);
        const baseAgi = 5 + Math.floor(Math.random() * levelFactor * 2);
        const baseInt = 5 + Math.floor(Math.random() * levelFactor * 2);

        // 根据三维属性计算怪物基础属性
        const monsterMaxHp = Math.floor(30 + levelFactor * 10 + baseStr * 8);
        const monsterAttack = Math.floor(8 + levelFactor * 2 + baseStr * 1.5);
        const monsterDefense = Math.floor(3 + levelFactor + baseStr * 0.5);
        const monsterSpeed = 30 + Math.random() * 20 + baseAgi * 0.3;
        const monsterDodge = baseAgi * 0.2;

        const monster = {
            x: mapSize.width, // 从屏幕右边生成
            y: playerY, // 与人物同一水平线
            width: 25,
            height: 25,

            // 三维属性
            strength: baseStr,
            agility: baseAgi,
            intelligence: baseInt,

            // 基础属性
            hp: monsterMaxHp,
            maxHp: monsterMaxHp,
            attack: monsterAttack,
            defense: monsterDefense,
            dodge: monsterDodge,
            speed: monsterSpeed,
            coinReward: 5 + levelFactor + Math.floor((baseStr + baseAgi + baseInt) / 3),
            color: this.getRandomMonsterColor(),
            invulnerable: true, // 初始无敌状态
            invulnerableDistance: 100, // 无敌距离（像素）
            spawnX: mapSize.width, // 记录生成位置

            // 状态效果
            speedMultiplier: 1.0,
            isStunned: false,
            stunTimer: 0,
            slowTimer: 0
        };

        this.monsters.push(monster);
    }

    /**
     * 获取随机怪物颜色
     */
    getRandomMonsterColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * 更新怪物
     */
    updateMonsters(deltaTime) {
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];

            // 处理眩晕状态
            if (monster.isStunned) {
                monster.stunTimer -= deltaTime;
                if (monster.stunTimer <= 0) {
                    monster.isStunned = false;
                } else {
                    // 眩晕中，跳过移动
                    // 但仍需绘制（在跳过移动后）
                }
            }

            // 处理减速状态
            if (monster.slowTimer > 0) {
                monster.slowTimer -= deltaTime;
                if (monster.slowTimer <= 0) {
                    monster.speedMultiplier = 1.0;
                }
            } else {
                monster.speedMultiplier = 1.0;
            }

            // 只有未眩晕时才移动
            if (!monster.isStunned) {
                // 怪物向左移动（向玩家方向），应用速度倍率
                const currentSpeed = monster.speed * monster.speedMultiplier;
                monster.x -= currentSpeed * (deltaTime / 1000);
            }

            // 移除死亡的怪物
            if (monster.hp <= 0) {
                this.monsters.splice(i, 1);
                continue;
            }

            // 移除超出屏幕左边的怪物
            if (monster.x + monster.width < 0) {
                this.monsters.splice(i, 1);
            }
        }
    }

    /**
     * 绘制怪物
     */
    drawMonsters(ctx) {
        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const len = this.monsters.length;

        for (let i = 0; i < len; i++) {
            const monster = this.monsters[i];
            // 确保怪物站在草地上
            const monsterY = groundY - monster.height;

            // 怪物身体
            ctx.fillStyle = monster.color;
            ctx.fillRect(monster.x, monsterY, monster.width, monster.height);

            // 怪物眼睛
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(monster.x + 5, monsterY + 5, 4, 4);
            ctx.fillRect(monster.x + 15, monsterY + 5, 4, 4);

            // 绘制怪物脚部阴影（在草地上）
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(monster.x - 2, groundY - 2, monster.width + 4, 4);

            // 生命值条 - 调整到怪物头顶上方
            this.drawHealthBar(ctx, monster.x, monsterY - 15, monster.width,
                monster.hp, monster.maxHp, '#ff4757', '#ff6b6b');
        }
    }

    /**
     * 绘制生命值条
     */
    drawHealthBar(ctx, x, y, width, currentHp, maxHp, bgColor, fillColor) {
        const barHeight = 6;
        const hpPercent = currentHp / maxHp;

        // 背景
        ctx.fillStyle = bgColor;
        ctx.fillRect(x, y, width, barHeight);

        // 生命值
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, width * hpPercent, barHeight);

        // 边框
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, barHeight);
    }

    /**
     * 自动攻击系统
     */
    updateAutoAttack(deltaTime) {
        this.attackTimer += deltaTime;

        if (this.attackTimer >= this.attackInterval && this.monsters.length > 0) {
            // 找到攻击范围内最近的怪物
            let targetMonster = null;
            let minDistance = Infinity;
            const playerData = this.playerSystem.getPlayerData();

            for (let monster of this.monsters) {
                const distance = this.getDistance(playerData, monster);
                if (distance <= this.attackRange && distance < minDistance) {
                    minDistance = distance;
                    targetMonster = monster;
                }
            }

            // 如果找到目标，发射子弹
            if (targetMonster) {
                this.fireBullet(targetMonster);
                this.attackTimer = 0;
            }
        }
    }

    /**
     * 计算距离
     */
    getDistance(obj1, obj2) {
        const dx = (obj1.x + obj1.width / 2) - (obj2.x + obj2.width / 2);
        const dy = (obj1.y + obj1.height / 2) - (obj2.y + obj2.height / 2);
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * 发射子弹
     */
    fireBullet(target) {
        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const playerData = this.playerSystem.getPlayerData();
        const playerY = groundY - playerData.height;

        const playerCenterX = playerData.x + playerData.width / 2;
        const playerCenterY = playerY + playerData.height / 2;

        // 应用领地属性加成
        const territorySystem = getTerritorySystemInstance(this.resourceSystem);
        const attributeBonuses = territorySystem.getTotalAttributeBonuses();

        // 获取玩家实际攻击力
        const actualAttack = this.playerSystem.getActualAttack() + (attributeBonuses.attackBonus || 0);

        // 水平射击：子弹只向右水平飞行
        const bullet = {
            x: playerCenterX,
            y: playerCenterY,
            width: 6,
            height: 6,
            speed: 300,
            dirX: 1, // 水平向右
            dirY: 0, // 垂直方向为0，保持水平
            damage: actualAttack, // 使用实际攻击力
            life: 2000, // 子弹存活时间2秒
            trail: [] // 子弹轨迹
        };

        this.bullets.push(bullet);
    }

    /**
     * 更新子弹
     */
    updateBullets(deltaTime) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // 添加轨迹点，限制最大数量为8个
            bullet.trail.push({ x: bullet.x, y: bullet.y, life: 200 });
            if (bullet.trail.length > 8) {
                bullet.trail.shift(); // 移除最旧的轨迹点
            }

            // 移动子弹
            bullet.x += bullet.dirX * bullet.speed * (deltaTime / 1000);
            bullet.y += bullet.dirY * bullet.speed * (deltaTime / 1000);

            // 减少子弹生命
            bullet.life -= deltaTime;

            // 更新轨迹（优化：只更新，不删除，用长度限制控制）
            for (let j = bullet.trail.length - 1; j >= 0; j--) {
                bullet.trail[j].life -= deltaTime;
            }

            // 检查子弹是否击中怪物
            let hitMonster = false;
            for (let j = this.monsters.length - 1; j >= 0; j--) {
                const monster = this.monsters[j];

                // 检测子弹和怪物的碰撞
                if (this.isColliding(bullet, monster)) {
                    const mapSize = this.gameCore.getMapSize();
                    const groundY = mapSize.height - 50;
                    const monsterY = groundY - monster.height;
                    const monsterCenterX = monster.x + monster.width / 2;
                    const monsterCenterY = monsterY + monster.height / 2;

                    // 添加轨迹点到怪物中心
                    bullet.trail.push({ x: monsterCenterX, y: monsterCenterY, life: 200 });

                    // 将子弹位置调整到怪物中心
                    bullet.x = monsterCenterX;
                    bullet.y = monsterCenterY;

                    // 创建爆炸效果
                    this.createExplosion(monsterCenterX, monsterCenterY);

                    // 造成伤害 - 考虑怪物防御和暴击
                    const playerActualCrit = this.playerSystem.getActualCrit();
                    const playerActualCritDamage = this.playerSystem.getActualCritDamage();

                    let damage = Math.max(1, bullet.damage - monster.defense);

                    // 暴击判定
                    const isCrit = Math.random() * 100 < playerActualCrit;
                    if (isCrit) {
                        damage = Math.floor(damage * (playerActualCritDamage / 100));
                    }

                    monster.hp -= damage;

                    // 显示伤害文字（暴击显示不同颜色）
                    const damageColor = isCrit ? '#ffaa00' : '#ff4757';
                    const damageText = isCrit ? `暴击! -${this.resourceSystem.formatNumber(damage)}` : `-${this.resourceSystem.formatNumber(damage)}`;
                    this.addCombatText(monsterCenterX, monsterY - 10, damageText, damageColor);

                    // 怪物死亡
                    if (monster.hp <= 0) {
                        this.resourceSystem.addCoins(monster.coinReward);
                        this.addCombatText(monsterCenterX, monsterY - 20, `+${this.resourceSystem.formatNumber(monster.coinReward)} 金币`, '#ffd700');

                        // 有概率获得红宝石
                        if (Math.random() < 0.1) { // 10%概率
                            const rubyReward = 1 + Math.floor(Math.random() * 3); // 1-3个红宝石
                            this.resourceSystem.addRubies(rubyReward);
                            this.addCombatText(monsterCenterX, monsterY - 35, `+${rubyReward} 红宝石`, '#ff4757');
                        }

                        // 触发成就事件
                        if (this.achievementSystem) {
                            this.achievementSystem.onEvent('kill', 1);
                        }

                        // 有概率获得水晶
                        if (Math.random() < 0.05) { // 5%概率
                            const crystalReward = 1 + Math.floor(Math.random() * 2); // 1-2个水晶
                            this.resourceSystem.addCrystals(crystalReward);
                            this.addCombatText(monsterCenterX, monsterY - 50, `+${crystalReward} 水晶`, '#00bfff');
                        }

                        // 移除怪物
                        this.monsters.splice(j, 1);
                    }

                    // 移除子弹
                    this.bullets.splice(i, 1);
                    hitMonster = true;
                    break;
                }
            }

            // 如果没有击中怪物，检查是否超出屏幕
            if (!hitMonster && (bullet.life <= 0 ||
                bullet.x < -50 || bullet.x > this.gameCore.getMapSize().width + 50 ||
                bullet.y < -50 || bullet.y > this.gameCore.getMapSize().height + 50)) {
                this.bullets.splice(i, 1);
            }
        }
    }

    /**
     * 绘制子弹
     */
    drawBullets(ctx) {
        const len = this.bullets.length;
        for (let i = 0; i < len; i++) {
            const bullet = this.bullets[i];
            // 绘制子弹轨迹 - 限制轨迹长度提升性能
            const trailLength = Math.min(bullet.trail.length, 8);
            if (trailLength > 1) {
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();

                // 绘制轨迹到子弹当前位置
                for (let j = 0; j < trailLength; j++) {
                    const point = bullet.trail[j];

                    if (j === 0) {
                        ctx.moveTo(point.x, point.y);
                    } else {
                        ctx.lineTo(point.x, point.y);
                    }
                }

                // 确保轨迹连接到子弹当前位置
                ctx.lineTo(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);

                ctx.stroke();
            }

            // 绘制子弹本体
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
            ctx.fill();

            // 子弹发光效果
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    /**
     * 创建爆炸效果
     */
    createExplosion(x, y) {
        const explosion = {
            x: x,
            y: y,
            radius: 0,
            maxRadius: 30,
            life: 300, // 爆炸持续时间
            particles: []
        };

        // 创建爆炸粒子
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            explosion.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * 100,
                vy: Math.sin(angle) * 100,
                life: 200,
                maxLife: 200
            });
        }

        this.explosions.push(explosion);
    }

    /**
     * 更新爆炸效果
     */
    updateExplosions(deltaTime) {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i];

            // 更新爆炸半径
            explosion.radius = (1 - explosion.life / 300) * explosion.maxRadius;

            // 更新粒子
            for (let j = explosion.particles.length - 1; j >= 0; j--) {
                const particle = explosion.particles[j];
                particle.x += particle.vx * (deltaTime / 1000);
                particle.y += particle.vy * (deltaTime / 1000);
                particle.life -= deltaTime;

                if (particle.life <= 0) {
                    explosion.particles.splice(j, 1);
                }
            }

            // 减少爆炸生命
            explosion.life -= deltaTime;

            // 移除过期的爆炸
            if (explosion.life <= 0) {
                this.explosions.splice(i, 1);
            }
        }
    }

    /**
     * 绘制爆炸效果
     */
    drawExplosions(ctx) {
        const len = this.explosions.length;
        for (let i = 0; i < len; i++) {
            const explosion = this.explosions[i];
            const alpha = explosion.life / 300;

            // 绘制爆炸圆圈
            ctx.strokeStyle = `rgba(255, 100, 0, ${alpha})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
            ctx.stroke();

            // 绘制内圈
            ctx.strokeStyle = `rgba(255, 255, 0, ${alpha * 0.8})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(explosion.x, explosion.y, explosion.radius * 0.6, 0, Math.PI * 2);
            ctx.stroke();

            // 绘制粒子
            for (let particle of explosion.particles) {
                const particleAlpha = particle.life / particle.maxLife;
                ctx.fillStyle = `rgba(255, 150, 0, ${particleAlpha})`;
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /**
     * 检测近战战斗
     */
    checkCombat() {
        const playerData = this.playerSystem.getPlayerData();

        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];

            // 检测玩家和怪物的碰撞
            if (this.isColliding(playerData, monster)) {
                this.combat(monster, i);
            }
        }
    }

    /**
     * 碰撞检测
     */
    isColliding(rect1, rect2) {
        // 如果是怪物，使用调整后的Y位置
        let rect2Y = rect2.y;
        if (rect2.hasOwnProperty('width') && rect2.hasOwnProperty('height') && rect2.hasOwnProperty('hp')) {
            // 这是怪物，使用调整后的Y位置
            const mapSize = this.gameCore.getMapSize();
            const groundY = mapSize.height - 50;
            rect2Y = groundY - rect2.height;
        }

        return rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2Y + rect2.height &&
            rect1.y + rect1.height > rect2Y;
    }

    /**
     * 近战战斗
     */
    combat(monster, monsterIndex) {
        const playerData = this.playerSystem.getPlayerData();

        // 应用领地属性加成
        const territorySystem = getTerritorySystemInstance(this.resourceSystem);
        const attributeBonuses = territorySystem.getTotalAttributeBonuses();

        // 获取玩家实际属性（包含三维属性加成）
        const playerActualAttack = this.playerSystem.getActualAttack() + (attributeBonuses.attackBonus || 0);
        const playerActualCrit = this.playerSystem.getActualCrit();
        const playerActualCritDamage = this.playerSystem.getActualCritDamage();

        // 玩家攻击怪物 - 考虑怪物防御
        let playerDamage = Math.max(1, playerActualAttack - monster.defense);

        // 暴击判定
        const isCrit = Math.random() * 100 < playerActualCrit;
        if (isCrit) {
            playerDamage = Math.floor(playerDamage * (playerActualCritDamage / 100));
        }

        monster.hp -= playerDamage;

        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const monsterY = groundY - monster.height;

        // 显示伤害文字（暴击显示不同颜色）
        const damageColor = isCrit ? '#ffaa00' : '#ff4757';
        const damageText = isCrit ? `暴击! -${this.resourceSystem.formatNumber(playerDamage)}` : `-${this.resourceSystem.formatNumber(playerDamage)}`;
        this.addCombatText(monster.x + monster.width / 2, monsterY - 10, damageText, damageColor);

        // 怪物死亡
        if (monster.hp <= 0) {
            this.resourceSystem.addCoins(monster.coinReward);
            this.addCombatText(monster.x + monster.width / 2, monsterY - 20, `+${this.resourceSystem.formatNumber(monster.coinReward)} 金币`, '#ffd700');

            // 有概率获得红宝石
            if (Math.random() < 0.1) { // 10%概率
                const rubyReward = 1 + Math.floor(Math.random() * 3); // 1-3个红宝石
                this.resourceSystem.addRubies(rubyReward);
                this.addCombatText(monster.x + monster.width / 2, monsterY - 35, `+${rubyReward} 红宝石`, '#ff4757');
            }

            // 触发成就事件
            if (this.achievementSystem) {
                this.achievementSystem.onEvent('kill', 1);
            }

            // 有概率获得水晶
            if (Math.random() < 0.05) { // 5%概率
                const crystalReward = 1 + Math.floor(Math.random() * 2); // 1-2个水晶
                this.resourceSystem.addCrystals(crystalReward);
                this.addCombatText(monster.x + monster.width / 2, monsterY - 50, `+${crystalReward} 水晶`, '#00bfff');
            }

            // 移除怪物
            this.monsters.splice(monsterIndex, 1);
        } else {
            // 怪物反击 - 应用防御加成和闪避判定
            const playerActualDodge = this.playerSystem.getActualDodge();
            const isDodge = Math.random() * 100 < playerActualDodge;

            const playerY = groundY - playerData.height;

            if (isDodge) {
                // 闪避成功
                this.addCombatText(playerData.x + playerData.width / 2, playerY - 10, '闪避!', '#00ff00');
            } else {
                // 计算怪物伤害 - 考虑玩家防御
                const playerDefense = playerData.defense + (attributeBonuses.defenseBonus || 0);
                const monsterDamage = Math.max(1, monster.attack - playerDefense);
                const newHp = playerData.hp - monsterDamage;
                this.playerSystem.setPlayerData({ hp: newHp });

                this.addCombatText(playerData.x + playerData.width / 2, playerY - 10, `-${this.resourceSystem.formatNumber(monsterDamage)}`, '#ff6b6b');

                // 玩家死亡检查
                if (newHp <= 0) {
                    const actualMaxHp = this.playerSystem.getActualMaxHp();
                    this.playerSystem.setPlayerData({ hp: actualMaxHp });
                    this.addCombatText(playerData.x + playerData.width / 2, playerY - 30, '复活!', '#2ed573');
                }
            }
        }
    }

    /**
     * 添加战斗文字
     */
    addCombatText(x, y, text, color) {
        this.combatTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 2000, // 2秒显示时间
            opacity: 1
        });
    }

    /**
     * 更新战斗文字
     */
    updateCombatTexts(deltaTime) {
        for (let i = this.combatTexts.length - 1; i >= 0; i--) {
            const text = this.combatTexts[i];
            text.life -= deltaTime;
            text.y -= 30 * (deltaTime / 1000); // 向上飘动
            text.opacity = text.life / 2000;

            if (text.life <= 0) {
                this.combatTexts.splice(i, 1);
            }
        }
    }

    /**
     * 绘制战斗文字
     */
    drawCombatTexts(ctx) {
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';

        const len = this.combatTexts.length;
        for (let i = 0; i < len; i++) {
            const text = this.combatTexts[i];
            ctx.globalAlpha = text.opacity;
            ctx.fillStyle = text.color;
            ctx.fillText(text.text, text.x, text.y);
        }

        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    /**
     * 获取怪物数量
     */
    getMonsterCount() {
        return this.monsters.length;
    }

    /**
     * 获取子弹数量
     */
    getBulletCount() {
        return this.bullets.length;
    }

    /**
     * 清除所有战斗对象
     */
    clearAll() {
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
    }

    /**
     * 获取存档数据
     * @returns {Object} 战斗系统的存档数据
     */
    getSaveData() {
        return {
            monsterSpawnInterval: this.monsterSpawnInterval,
            attackInterval: this.attackInterval,
            attackRange: this.attackRange
        };
    }

    /**
     * 加载存档数据
     * @param {Object} data 存档数据
     */
    loadSaveData(data) {
        if (data) {
            this.monsterSpawnInterval = data.monsterSpawnInterval !== undefined ? data.monsterSpawnInterval : this.monsterSpawnInterval;
            this.attackInterval = data.attackInterval !== undefined ? data.attackInterval : this.attackInterval;
            this.attackRange = data.attackRange !== undefined ? data.attackRange : this.attackRange;

            // 清除当前的战斗对象
            this.clearAll();
            console.log('战斗系统存档数据已加载');
        }
    }
}

export default CombatSystem;
