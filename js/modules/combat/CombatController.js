import EnemySystem from './EnemySystem.js';
import ProjectileSystem from './ProjectileSystem.js';
import VFXSystem from './VFXSystem.js';
import CollisionSystem from './CollisionSystem.js';
import DamageCalculator from './DamageCalculator.js';
import { getTerritorySystemInstance } from '../territory-system.js';

/**
 * 战斗控制器 (Mediator)
 * 协调各个子系统，管理战斗流程
 */
class CombatController {
    constructor(gameCore, playerSystem, resourceSystem) {
        this.gameCore = gameCore;
        this.playerSystem = playerSystem;
        this.resourceSystem = resourceSystem;
        this.petSystem = null;
        this.achievementSystem = null;

        // 初始化子系统
        this.enemySystem = new EnemySystem();
        this.projectileSystem = new ProjectileSystem();
        this.vfxSystem = new VFXSystem();

        // 自动攻击控制
        this.attackTimer = 0;
        this.attackInterval = 800;
        this.attackRange = 500;

        console.log('战斗控制器初始化完成 (New Architecture)');
    }

    setPetSystem(petSystem) {
        this.petSystem = petSystem;
    }

    setAchievementSystem(achievementSystem) {
        this.achievementSystem = achievementSystem;
    }

    update(deltaTime) {
        const mapSize = this.gameCore.getMapSize();
        const playerData = this.playerSystem.getPlayerData();

        // 1. 更新各个子系统
        this.enemySystem.update(deltaTime, playerData.level, mapSize);
        this.projectileSystem.update(deltaTime, mapSize);
        this.vfxSystem.update(deltaTime);

        // 2. 自动攻击逻辑
        this.updateAutoAttack(deltaTime);

        // 3. 碰撞检测
        this.checkCollisions();

        // 4. 宠物战斗更新
        if (this.petSystem) {
            this.updatePetCombat(deltaTime);
        }
    }

    render(ctx) {
        const mapSize = this.gameCore.getMapSize();
        
        // 渲染顺序：子弹 -> 怪物 -> 特效
        this.projectileSystem.render(ctx);
        this.enemySystem.render(ctx, mapSize);
        this.vfxSystem.render(ctx);
    }

    // --- 自动攻击逻辑 ---

    updateAutoAttack(deltaTime) {
        this.attackTimer += deltaTime;
        
        // 使用玩家实际攻速计算间隔 (攻速越高，间隔越小)
        // 假设 baseInterval = 1000 / attackSpeed
        const attackSpeed = this.playerSystem.getActualAttackSpeed ? 
            this.playerSystem.getActualAttackSpeed() : 1.0;
        
        const currentInterval = 1000 / attackSpeed;

        if (this.attackTimer >= currentInterval) {
            const target = this.findTarget();
            if (target) {
                this.fireBullet(target);
                this.attackTimer = 0;
            }
        }
    }

    findTarget() {
        const monsters = this.enemySystem.getMonsters();
        if (monsters.length === 0) return null;

        const playerData = this.playerSystem.getPlayerData();
        let target = null;
        let minDist = Infinity;

        for (const monster of monsters) {
            const dist = CollisionSystem.getDistance(playerData, monster); // 需在CollisionSystem补一个辅助方法或直接算
            // 这里为了方便直接算
            const dx = (playerData.x + playerData.width/2) - (monster.x + monster.width/2);
            const dy = (playerData.y + playerData.height/2) - (monster.y + monster.height/2);
            const d = Math.sqrt(dx*dx + dy*dy);

            if (d < this.attackRange && d < minDist) {
                minDist = d;
                target = monster;
            }
        }
        
        return target;
    }

    fireBullet(target) {
        const mapSize = this.gameCore.getMapSize();
        const groundY = mapSize.height - 50;
        const playerData = this.playerSystem.getPlayerData();
        const playerY = groundY - playerData.height;
        const playerCenterX = playerData.x + playerData.width / 2;
        const playerCenterY = playerY + playerData.height / 2;

        // 计算攻击力
        // 领地加成现在已集成在 getActualAttack() 中
        const actualAttack = this.playerSystem.getActualAttack();
        const actualCrit = this.playerSystem.getActualCrit();
        const actualCritDamage = this.playerSystem.getActualCritDamage();

        const attackerStats = {
            damage: actualAttack,
            crit: actualCrit,
            critDamage: actualCritDamage
        };

        this.projectileSystem.createBullet(
            playerCenterX,
            playerCenterY,
            6, // width
            6, // height
            300, // speed
            1, // dirX
            0, // dirY
            attackerStats
        );
    }

    // --- 碰撞检测逻辑 ---

    checkCollisions() {
        const bullets = this.projectileSystem.getBullets();
        const monsters = this.enemySystem.getMonsters();
        const playerData = this.playerSystem.getPlayerData();

        // 1. 子弹 vs 怪物
        // 倒序遍历以便删除
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            let hit = false;

            for (let j = monsters.length - 1; j >= 0; j--) {
                const monster = monsters[j];

                // 使用 CollisionSystem
                if (CollisionSystem.checkPointRect(bullet, monster, bullet.width)) {
                    this.handleHit(bullet, monster);
                    this.projectileSystem.removeBullet(bullet);
                    hit = true;
                    break;
                }
            }
        }

        // 2. 玩家 vs 怪物 (接触伤害)
        for (let monster of monsters) {
            // 需要构造rect
            const playerRect = {
                 x: playerData.x, 
                 y: this.gameCore.getMapSize().height - 50 - playerData.height, // 简化的Y计算
                 width: playerData.width,
                 height: playerData.height
            };
            
            if (CollisionSystem.checkRectRect(playerRect, monster)) {
                // 暂时简单的击退或扣血逻辑
                // 这里可以扩展为 PlayerTakeDamage
            }
        }
    }

    handleHit(bullet, monster) {
        // 1. 计算伤害
        // 构造防御者数据
        const defenderStats = {
            defense: monster.defense,
            dodge: monster.dodge
        };

        const result = DamageCalculator.calculateDamage(bullet.attackerStats, defenderStats);

        // 2. 应用伤害
        if (!result.isDodge) {
            monster.hp -= result.damage;
            
            // 3. 特效
            this.vfxSystem.createExplosion(monster.x + monster.width/2, monster.y + monster.height/2);
            
            const color = result.isCrit ? '#ffaa00' : '#ff4757';
            const text = result.isCrit ? `暴击! -${this.resourceSystem.formatNumber(result.damage)}` : `-${this.resourceSystem.formatNumber(result.damage)}`;
            
            this.vfxSystem.addCombatText(
                monster.x + monster.width/2, 
                monster.y - 10, 
                text, 
                color
            );

            // 4. 死亡判定
            if (monster.hp <= 0) {
                this.handleMonsterDeath(monster);
            }
        } else {
            this.vfxSystem.addCombatText(monster.x, monster.y - 10, "Miss", "#cccccc");
        }
    }

    handleMonsterDeath(monster) {
        // 奖励
        this.resourceSystem.addCoins(monster.coinReward);
        this.vfxSystem.addCombatText(monster.x, monster.y - 20, `+${monster.coinReward}`, '#ffd700');

        // 成就
        if (this.achievementSystem) {
            this.achievementSystem.onEvent('kill', 1);
        }
        
        // 从 EnemySystem 移除不需要手动做，因为 EnemySystem 在 update 里会检查 hp <= 0
        // 不过为了即时性，或者防止一帧内多次判定，最好标记一下
        monster.hp = -1; 
    }

    // --- 宠物战斗 (兼容旧逻辑) ---
    // 理想情况下，宠物子弹也应该走 ProjectileSystem，但为了兼容现有的 PetSystem 直接操作数组的逻辑，
    // 这里保留一个类似的更新循环，或者将 PetSystem 的子弹也纳入 ProjectileSystem 管理。
    // 考虑到 PetSystem 内部可能直接操作了 this.petBullets，与其强行接管，不如保留原有逻辑但使用新的工具类。
    
    updatePetCombat(deltaTime) {
        if (!this.petSystem) return;
        
        this.petSystem.update(deltaTime);
        
        // 处理宠物子弹碰撞
        const petBullets = this.petSystem.petBullets;
        const monsters = this.enemySystem.getMonsters();
        
        if (!petBullets) return;

        for (let i = petBullets.length - 1; i >= 0; i--) {
            const bullet = petBullets[i];
            
            for (let monster of monsters) {
               if (CollisionSystem.checkPointRect(bullet, monster, bullet.size)) {
                   // 宠物伤害逻辑简单处理
                   monster.hp -= bullet.damage;
                   this.vfxSystem.createExplosion(bullet.x, bullet.y);
                   this.vfxSystem.addCombatText(monster.x, monster.y, `-${bullet.damage}`, '#ff6b9d');
                   
                   petBullets.splice(i, 1);
                   
                   if (monster.hp <= 0) {
                       this.handleMonsterDeath(monster);
                   }
                   break;
               }
            }
        }
    }

    getMonsterCount() {
        return this.enemySystem.getMonsters().length;
    }

    getBulletCount() {
        return this.projectileSystem.getBullets().length;
    }

    // --- 兼容性接口 ---

    getMonsters() {
        return this.enemySystem.getMonsters();
    }

    addCombatText(x, y, text, color) {
        this.vfxSystem.addCombatText(x, y, text, color);
    }
}

export default CombatController;
