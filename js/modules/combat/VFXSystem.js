/**
 * 特效系统
 * 管理爆炸、漂浮文字等视觉效果
 */
class VFXSystem {
    constructor() {
        this.explosions = [];
        this.combatTexts = [];
    }

    update(deltaTime) {
        this.updateExplosions(deltaTime);
        this.updateCombatTexts(deltaTime);
    }

    render(ctx) {
        this.drawExplosions(ctx);
        this.drawCombatTexts(ctx);
    }

    // --- 爆炸效果 ---

    createExplosion(x, y, color = null) {
        const explosion = {
            x: x,
            y: y,
            radius: 0,
            maxRadius: 30,
            life: 300, // 爆炸持续时间
            particles: [],
            baseColor: color // 可选的特定颜色
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

    // --- 战斗文字 ---

    addCombatText(x, y, text, color) {
        this.combatTexts.push({
            x: x,
            y: y,
            text: text,
            color: color,
            life: 800, // 持续时间
            velocity: -30 // 向上飘动速度
        });
    }

    updateCombatTexts(deltaTime) {
        for (let i = this.combatTexts.length - 1; i >= 0; i--) {
            const text = this.combatTexts[i];
            text.life -= deltaTime;
            text.y += text.velocity * (deltaTime / 1000);

            if (text.life <= 0) {
                this.combatTexts.splice(i, 1);
            }
        }
    }

    drawCombatTexts(ctx) {
        ctx.textAlign = 'center';
        ctx.font = 'bold 16px Arial';
        
        const len = this.combatTexts.length;
        for (let i = 0; i < len; i++) {
            const text = this.combatTexts[i];
            const alpha = text.life / 800;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = text.color;
            ctx.fillText(text.text, text.x, text.y);
            
            // 文字描边
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.strokeText(text.text, text.x, text.y);
        }
        ctx.globalAlpha = 1;
    }
}

export default VFXSystem;
