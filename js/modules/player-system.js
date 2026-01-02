/**
 * PlayerSystem - 玩家系统
 * 管理玩家属性、升级和战力计算
 */

let instance = null;

export class PlayerSystem {
    constructor() {
        // 玩家数据
        this.player = {
            // 位置
            x: 60,
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
        
        // 动画
        this.animationFrame = 0;
        this.animationTimer = 0;
        
        // 生命恢复计时器
        this.regenTimer = 0;
        
        console.log('[PlayerSystem] 初始化完成');
    }
    
    /**
     * 设置资源系统引用
     */
    setResourceSystem(resourceSystem) {
        this.resourceSystem = resourceSystem;
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
        
        // 动画帧更新
        this.animationTimer += deltaTime;
        if (this.animationTimer >= 200) {
            this.animationTimer = 0;
            this.animationFrame = (this.animationFrame + 1) % 4;
        }
    }
    
    /**
     * 渲染玩家
     */
    render(ctx) {
        const { x, y, width, height, hp, maxHp } = this.player;
        
        // 绘制角色（简单的圆形）
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height / 2, width / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制眼睛
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x + width * 0.35, y + height * 0.4, 3, 0, Math.PI * 2);
        ctx.arc(x + width * 0.65, y + height * 0.4, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // 绘制嘴巴
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + width / 2, y + height * 0.5, 8, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
        
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
    
    /**
     * 更新 UI 显示
     */
    updateDisplay() {
        // 更新属性值
        const attrs = ['attack', 'maxHp', 'hpRegen', 'critDamage', 'attackSpeed', 'crit', 'multiShot'];
        
        attrs.forEach(attr => {
            const valueEl = document.getElementById(`${attr}-value`);
            if (valueEl) {
                let value = this.player[attr];
                if (attr === 'critDamage' || attr === 'crit') {
                    valueEl.textContent = `${value}%`;
                } else if (attr === 'attackSpeed') {
                    valueEl.textContent = value.toFixed(1);
                } else {
                    valueEl.textContent = value;
                }
            }
            
            // 更新按钮成本
            const btn = document.querySelector(`.upgrade-btn[data-attr="${attr}"] .cost`);
            if (btn && this.resourceSystem) {
                btn.textContent = `${this.resourceSystem.formatNumber(this.upgradeCosts[attr])}💰`;
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
