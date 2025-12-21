/**
 * 怪物系统
 * 管理怪物的生成、移动和生命周期
 */
class EnemySystem {
    constructor() {
        this.monsters = [];
        this.spawnTimer = 0;
        this.spawnInterval = 2000; // 默认2秒
    }

    update(deltaTime, playerLevel, mapSize) {
        // 更新生成计时器
        this.updateSpawn(deltaTime, playerLevel, mapSize);

        // 更新怪物状态
        for (let i = this.monsters.length - 1; i >= 0; i--) {
            const monster = this.monsters[i];

            // 状态效果更新 (眩晕/减速)
            this.updateStatusEffects(monster, deltaTime);

            // 移动 (只有未眩晕时)
            if (!monster.isStunned) {
                const currentSpeed = monster.speed * monster.speedMultiplier;
                monster.x -= currentSpeed * (deltaTime / 1000);
            }

            // 边界检查 (移除超出屏幕左边的怪物)
            if (monster.x + monster.width < 0) {
                this.monsters.splice(i, 1);
                continue;
            }

            // 死亡检查
            if (monster.hp <= 0) {
                this.monsters.splice(i, 1);
            }
        }
    }

    updateSpawn(deltaTime, playerLevel, mapSize) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnMonster(playerLevel, mapSize);
            this.spawnTimer = 0;
        }
    }

    updateStatusEffects(monster, deltaTime) {
        // 眩晕
        if (monster.isStunned) {
            monster.stunTimer -= deltaTime;
            if (monster.stunTimer <= 0) {
                monster.isStunned = false;
            }
        }

        // 减速
        if (monster.slowTimer > 0) {
            monster.slowTimer -= deltaTime;
            if (monster.slowTimer <= 0) {
                monster.speedMultiplier = 1.0;
            }
        } else {
            monster.speedMultiplier = 1.0;
        }
    }

    spawnMonster(playerLevel, mapSize) {
        const groundY = mapSize.height - 50;
        // 假设玩家高度约为50，用于对齐
        const monsterY = groundY - 25; // 怪物高度25

        // 三维属性随机生成
        const levelFactor = playerLevel || 1;
        const baseStr = 5 + Math.floor(Math.random() * levelFactor * 2);
        const baseAgi = 5 + Math.floor(Math.random() * levelFactor * 2);
        const baseInt = 5 + Math.floor(Math.random() * levelFactor * 2);

        // 属性计算
        const monsterMaxHp = Math.floor(30 + levelFactor * 10 + baseStr * 8);
        const monsterAttack = Math.floor(8 + levelFactor * 2 + baseStr * 1.5);
        const monsterDefense = Math.floor(3 + levelFactor + baseStr * 0.5);
        const monsterSpeed = 30 + Math.random() * 20 + baseAgi * 0.3;

        const monster = {
            x: mapSize.width,
            y: monsterY,
            width: 25, // 宽
            height: 25, // 高
            
            // 属性
            hp: monsterMaxHp,
            maxHp: monsterMaxHp,
            attack: monsterAttack,
            defense: monsterDefense,
            speed: monsterSpeed,
            coinReward: 5 + levelFactor + Math.floor((baseStr + baseAgi + baseInt) / 3),
            
            color: this.getRandomColor(),
            
            // 状态
            speedMultiplier: 1.0,
            isStunned: false,
            stunTimer: 0,
            slowTimer: 0
        };

        this.monsters.push(monster);
    }

    getRandomColor() {
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    removeMonster(monster) {
        const index = this.monsters.indexOf(monster);
        if (index > -1) {
            this.monsters.splice(index, 1);
        }
    }

    getMonsters() {
        return this.monsters;
    }

    render(ctx, mapSize) {
        const groundY = mapSize.height - 50;
        
        for (let monster of this.monsters) {
            const monsterY = groundY - monster.height;

            // 身体
            ctx.fillStyle = monster.color;
            ctx.fillRect(monster.x, monsterY, monster.width, monster.height);

            // 眼睛
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(monster.x + 5, monsterY + 5, 4, 4);
            ctx.fillRect(monster.x + 15, monsterY + 5, 4, 4);

            // 阴影
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(monster.x - 2, groundY - 2, monster.width + 4, 4);

            // 血条
            this.drawHealthBar(ctx, monster.x, monsterY - 15, monster.width, monster.hp, monster.maxHp);
        }
    }

    drawHealthBar(ctx, x, y, width, hp, maxHp) {
        const barHeight = 6;
        const percent = Math.max(0, hp / maxHp);

        ctx.fillStyle = '#ff4757'; // 背景红
        ctx.fillRect(x, y, width, barHeight);

        ctx.fillStyle = '#ff6b6b'; //前景
        ctx.fillRect(x, y, width * percent, barHeight);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, barHeight);
    }
}

export default EnemySystem;
