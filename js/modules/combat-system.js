/**
 * CombatSystem - 战斗系统
 * 管理怪物、子弹、碰撞检测、伤害计算
 */

let instance = null;

export class CombatSystem {
    constructor() {
        // 战斗实体
        this.monsters = [];
        this.bullets = [];
        this.explosions = [];
        this.combatTexts = [];
        
        // 怪物模板
        this.monsterTemplates = [
            {
                id: 'slime',
                name: '史莱姆',
                image: 'images/monsters/slime.png',
                baseHp: 30,
                baseAttack: 3,
                speed: 25,
                coinReward: 8,
                expReward: 5,
                size: 35
            },
            {
                id: 'bat',
                name: '蝙蝠',
                image: 'images/monsters/bat.png',
                baseHp: 25,
                baseAttack: 5,
                speed: 45,
                coinReward: 12,
                expReward: 8,
                size: 32
            },
            {
                id: 'skeleton',
                name: '骷髅战士',
                image: 'images/monsters/skeleton.png',
                baseHp: 50,
                baseAttack: 8,
                speed: 30,
                coinReward: 20,
                expReward: 15,
                size: 40
            },
            {
                id: 'goblin',
                name: '哥布林',
                image: 'images/monsters/goblin.png',
                baseHp: 40,
                baseAttack: 6,
                speed: 35,
                coinReward: 15,
                expReward: 10,
                size: 36
            },
            {
                id: 'demon',
                name: '恶魔',
                image: 'images/monsters/demon.png',
                baseHp: 80,
                baseAttack: 12,
                speed: 28,
                coinReward: 35,
                expReward: 25,
                size: 42
            },
            {
                id: 'dragon',
                name: 'Boss龙',
                image: 'images/monsters/dragon.png',
                baseHp: 200,
                baseAttack: 25,
                speed: 20,
                coinReward: 100,
                expReward: 80,
                size: 55,
                isBoss: true
            }
        ];
        
        // 怪物图片缓存
        this.monsterImages = {};
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
        
        console.log('[CombatSystem] 初始化完成');
    }
    
    /**
     * 预加载怪物图片
     */
    preloadImages() {
        this.monsterTemplates.forEach(template => {
            const img = new Image();
            img.src = template.image;
            img.onload = () => {
                this.monsterImages[template.id] = img;
            };
            img.onerror = () => {
                console.warn(`[CombatSystem] 图片加载失败: ${template.image}`);
            };
        });
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
            expReward: Math.floor(template.expReward * levelScale),
            isBoss: template.isBoss || false
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
        
        // 按距离排序怪物
        const sortedMonsters = [...this.monsters].sort((a, b) => {
            const distA = Math.hypot(a.x - player.x, a.y - player.y);
            const distB = Math.hypot(b.x - player.x, b.y - player.y);
            return distA - distB;
        });
        
        // 发射多个子弹
        for (let i = 0; i < Math.min(multiShot, sortedMonsters.length); i++) {
            this.fireBullet(sortedMonsters[i]);
        }
    }
    
    /**
     * 发射子弹
     */
    fireBullet(target) {
        if (!this.playerSystem) return;
        
        const player = this.playerSystem.player;
        
        const bullet = {
            x: player.x + player.width / 2,
            y: player.y + player.height / 2,
            targetX: target.x + target.width / 2,
            targetY: target.y + target.height / 2,
            speed: this.config.bulletSpeed,
            damage: player.attack,
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
        const dist = Math.hypot(dx, dy);
        bullet.vx = (dx / dist) * bullet.speed;
        bullet.vy = (dy / dist) * bullet.speed;
        
        this.bullets.push(bullet);
    }
    
    /**
     * 更新怪物移动
     */
    updateMonsters(deltaTime) {
        const dt = deltaTime / 1000;
        
        this.monsters = this.monsters.filter(monster => {
            monster.x -= monster.speed * dt;
            
            // 移出屏幕则移除
            if (monster.x + monster.width < 0) {
                return false;
            }
            
            return true;
        });
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
            this.monsters.forEach((monster, mi) => {
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
        }
    }
    
    /**
     * 渲染
     */
    render(ctx) {
        // 渲染怪物
        this.monsters.forEach(monster => this.renderMonster(ctx, monster));
        
        // 渲染子弹
        this.bullets.forEach(bullet => this.renderBullet(ctx, bullet));
        
        // 渲染爆炸
        this.explosions.forEach(exp => this.renderExplosion(ctx, exp));
        
        // 渲染战斗文字
        this.combatTexts.forEach(text => this.renderCombatText(ctx, text));
    }
    
    /**
     * 渲染怪物
     */
    renderMonster(ctx, monster) {
        const img = this.monsterImages[monster.templateId];
        
        if (img && img.complete) {
            // 使用图片渲染
            ctx.drawImage(
                img,
                monster.x,
                monster.y,
                monster.width,
                monster.height
            );
            
            // Boss 发光效果
            if (monster.isBoss) {
                ctx.shadowColor = '#ff4500';
                ctx.shadowBlur = 15;
                ctx.drawImage(img, monster.x, monster.y, monster.width, monster.height);
                ctx.shadowBlur = 0;
            }
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
    
    /**
     * 渲染子弹
     */
    renderBullet(ctx, bullet) {
        ctx.fillStyle = bullet.color;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size, 0, Math.PI * 2);
        ctx.fill();
        
        // 发光效果
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
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
