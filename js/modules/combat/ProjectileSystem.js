/**
 * 投射物系统
 * 管理所有的子弹（玩家子弹、怪物子弹等）
 */
class ProjectileSystem {
    constructor() {
        this.bullets = [];
        this.pool = [];
    }

    /**
     * 创建并添加子弹 (通过对象池)
     */
    createBullet(x, y, width, height, speed, dirX, dirY, attackerStats, life = 2000) {
        let bullet;
        if (this.pool.length > 0) {
            bullet = this.pool.pop();
            // 重置属性
            bullet.x = x;
            bullet.y = y;
            bullet.width = width;
            bullet.height = height;
            bullet.speed = speed;
            bullet.dirX = dirX;
            bullet.dirY = dirY;
            bullet.attackerStats = attackerStats;
            bullet.life = life;
            bullet.trail.length = 0;
        } else {
            bullet = {
                x, y, width, height, speed, dirX, dirY,
                attackerStats,
                life,
                trail: []
            };
        }
        this.bullets.push(bullet);
        return bullet;
    }

    /**
     * 更新所有子弹
     * @param {number} deltaTime
     * @param {Object} mapSize {width, height}
     * @returns {Array} 返回已过期的子弹列表（用于后续处理，如果有需要）
     */
    update(deltaTime, mapSize) {
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];

            // 1. 轨迹记录
            // 简单优化：复用轨迹点对象需要更复杂的逻辑，暂且每次创建新点，但因为数量少 (8个)，GC影响可控
            bullet.trail.push({ x: bullet.x, y: bullet.y, life: 200 });
            if (bullet.trail.length > 8) {
                bullet.trail.shift();
            }

            // 2. 移动
            bullet.x += bullet.dirX * bullet.speed * (deltaTime / 1000);
            bullet.y += bullet.dirY * bullet.speed * (deltaTime / 1000);

            // 3. 生命周期减少
            bullet.life -= deltaTime;

            // 4. 更新轨迹点生命周期
            for (let j = bullet.trail.length - 1; j >= 0; j--) {
                bullet.trail[j].life -= deltaTime;
            }

            // 5. 检查边界和生命周期
            if (bullet.life <= 0 ||
                bullet.x < -50 || bullet.x > mapSize.width + 50 ||
                bullet.y < -50 || bullet.y > mapSize.height + 50) {
                this.returnToPool(bullet);
                this.bullets.splice(i, 1);
            }
        }
    }

    /**
     * 移除子弹并归还对象池
     */
    removeBullet(bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index > -1) {
            this.returnToPool(bullet);
            this.bullets.splice(index, 1);
        }
    }

    returnToPool(bullet) {
        this.pool.push(bullet);
    }

    getBullets() {
        return this.bullets;
    }

    render(ctx) {
        const len = this.bullets.length;
        for (let i = 0; i < len; i++) {
            const bullet = this.bullets[i];
            
            // 绘制轨迹
            this.drawTrail(ctx, bullet);

            // 绘制子弹本体
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 2, 0, Math.PI * 2);
            ctx.fill();

            // 发光效果
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 10;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2, bullet.width / 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    drawTrail(ctx, bullet) {
        const trailLength = Math.min(bullet.trail.length, 8);
        if (trailLength > 1) {
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let j = 0; j < trailLength; j++) {
                const point = bullet.trail[j];
                if (j === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            // 连接到当前位置
            ctx.lineTo(bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
            ctx.stroke();
        }
    }
}

export default ProjectileSystem;
