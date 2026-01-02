/**
 * ResourceSystem - 资源系统
 * 管理金币、红宝石、水晶等货币
 */

let instance = null;

export class ResourceSystem {
    constructor() {
        // 货币
        this.coins = 1000;
        this.rubies = 50;
        this.crystals = 100;
        
        // 数字格式化后缀
        this.suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];
        
        // DOM 元素缓存
        this.elements = {
            coins: document.getElementById('coins-display'),
            rubies: document.getElementById('rubies-display'),
            crystals: document.getElementById('crystals-display')
        };
        
        console.log('[ResourceSystem] 初始化完成');
    }
    
    // ==================== 金币 ====================
    
    addCoins(amount) {
        if (amount <= 0) return;
        this.coins = this.safeAdd(this.coins, amount);
        this.updateDisplay();
    }
    
    spendCoins(amount) {
        if (amount <= 0 || this.coins < amount) return false;
        this.coins -= amount;
        this.updateDisplay();
        return true;
    }
    
    hasEnoughCoins(amount) {
        return this.coins >= amount;
    }
    
    // ==================== 红宝石 ====================
    
    addRubies(amount) {
        if (amount <= 0) return;
        this.rubies = this.safeAdd(this.rubies, amount);
        this.updateDisplay();
    }
    
    spendRubies(amount) {
        if (amount <= 0 || this.rubies < amount) return false;
        this.rubies -= amount;
        this.updateDisplay();
        return true;
    }
    
    hasEnoughRubies(amount) {
        return this.rubies >= amount;
    }
    
    // ==================== 水晶 ====================
    
    addCrystals(amount) {
        if (amount <= 0) return;
        this.crystals = this.safeAdd(this.crystals, amount);
        this.updateDisplay();
    }
    
    spendCrystals(amount) {
        if (amount <= 0 || this.crystals < amount) return false;
        this.crystals -= amount;
        this.updateDisplay();
        return true;
    }
    
    hasEnoughCrystals(amount) {
        return this.crystals >= amount;
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 安全加法，避免溢出
     */
    safeAdd(current, amount) {
        const result = current + amount;
        if (result > Number.MAX_SAFE_INTEGER) {
            return Number.MAX_SAFE_INTEGER;
        }
        return result;
    }
    
    /**
     * 格式化大数字
     */
    formatNumber(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }
        
        num = Math.floor(num);
        
        if (num < 1000) {
            return num.toString();
        }
        
        let suffixIndex = 0;
        let value = num;
        
        while (value >= 1000 && suffixIndex < this.suffixes.length - 1) {
            value /= 1000;
            suffixIndex++;
        }
        
        // 保留一位小数
        if (value >= 100) {
            return Math.floor(value) + this.suffixes[suffixIndex];
        } else if (value >= 10) {
            return value.toFixed(1) + this.suffixes[suffixIndex];
        } else {
            return value.toFixed(2) + this.suffixes[suffixIndex];
        }
    }
    
    /**
     * 更新货币显示
     */
    updateDisplay() {
        if (this.elements.coins) {
            this.elements.coins.textContent = this.formatNumber(this.coins);
        }
        if (this.elements.rubies) {
            this.elements.rubies.textContent = this.formatNumber(this.rubies);
        }
        if (this.elements.crystals) {
            this.elements.crystals.textContent = this.formatNumber(this.crystals);
        }
    }
    
    // ==================== 存档接口 ====================
    
    getSaveData() {
        return {
            coins: this.coins,
            rubies: this.rubies,
            crystals: this.crystals
        };
    }
    
    loadSaveData(data) {
        if (!data) return;
        
        this.coins = data.coins || 1000;
        this.rubies = data.rubies || 50;
        this.crystals = data.crystals || 100;
        
        this.updateDisplay();
    }
}

/**
 * 获取单例实例
 */
export function getResourceSystemInstance() {
    if (!instance) {
        instance = new ResourceSystem();
    }
    return instance;
}
