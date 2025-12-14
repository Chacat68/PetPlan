/**
 * 资源系统模块
 * 负责管理游戏货币、数字格式化等资源相关功能
 */

class ResourceSystem {
    constructor() {
        // 数字格式化系统
        this.numberSuffixes = ['', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        // 游戏资源
        this.coins = 1000; // 初始金币
        this.rubies = 50;  // 初始红宝石
        this.crystals = 200; // 初始水晶

        // 调试开关（仅在需要时输出日志）
        this.debug = false;

        // 记录最近一次展示的数值，避免重复 DOM 更新
        this._lastDisplay = {
            coins: null,
            rubies: null,
            crystals: null
        };
    }

    // 单例模式
    static getInstance() {
        if (!ResourceSystem.instance) {
            ResourceSystem.instance = new ResourceSystem();
        }
        return ResourceSystem.instance;
    }

    /**
     * 设置成就系统
     */
    setAchievementSystem(achievementSystem) {
        this.achievementSystem = achievementSystem;
    }

    /**
     * 数字格式化函数：1000=1A，1000A=1B，1000Z=1AA，1000AA=1AB，以此类推
     */
    formatNumber(num) {
        // 数字容错：非数字或无限，统一显示为 0
        if (!Number.isFinite(num)) {
            return '0';
        }

        // 负数处理：记录符号，按绝对值格式化，最终加符号
        const isNegative = num < 0;
        let abs = Math.abs(num);

        // 小于 1000 直接显示整数（向下取整，避免小数抖动）
        if (abs < 1000) {
            const base = Math.floor(abs).toString();
            return isNegative ? `-${base}` : base;
        }

        // 计算 1000 的幂次（每 1000 进一位）
        let value = abs;
        let power = 0;
        while (value >= 1000) {
            value /= 1000;
            power++;
        }

        // 后缀生成：A..Z, AA..AZ, BA..BZ, ...
        let suffix = '';
        if (power <= 26) {
            suffix = this.numberSuffixes[power];
        } else {
            const firstLetterIndex = Math.floor((power - 27) / 26) + 1; // 从 A 开始
            const secondLetterIndex = (power - 27) % 26 + 1; // 从 A 开始
            suffix = this.numberSuffixes[firstLetterIndex] + this.numberSuffixes[secondLetterIndex];
        }

        // 数值显示规则：>=100 取整；>=10 保留 1 位；否则保留 2 位
        let text;
        if (value >= 100) {
            text = String(Math.floor(value));
        } else if (value >= 10) {
            text = value.toFixed(1);
        } else {
            text = value.toFixed(2);
        }

        // 去除多余的尾随 0（如 12.0A -> 12A）
        if (text.includes('.')) {
            // 保留必要的小数，去除多余的 0：
            // 例："1.50" -> "1.5"，"12.00" -> "12"
            text = text
                .replace(/(\.\d*[1-9])0+$/, '$1')
                .replace(/\.0+$/, '');
        }

        const result = `${isNegative ? '-' : ''}${text}${suffix}`;
        return result;
    }

    /**
     * 添加金币
     */
    addCoins(amount) {
        // 输入校验：确保为非负有限数值
        const delta = this._sanitizeAmount(amount);
        this.coins = this._safeSum(this.coins, delta);
        this.updateCurrencyDisplay();

        if (this.achievementSystem && delta > 0) {
            this.achievementSystem.onEvent('coin', delta);
        }
    }

    /**
     * 添加红宝石
     */
    addRubies(amount) {
        const delta = this._sanitizeAmount(amount);
        this.rubies = this._safeSum(this.rubies, delta);
        this.updateCurrencyDisplay();

        if (this.achievementSystem && delta > 0) {
            this.achievementSystem.onEvent('ruby', delta);
        }
    }

    /**
     * 添加水晶
     */
    addCrystals(amount) {
        const delta = this._sanitizeAmount(amount);
        this.crystals = this._safeSum(this.crystals, delta);
        this.updateCurrencyDisplay();

        if (this.achievementSystem && delta > 0) {
            this.achievementSystem.onEvent('crystal', delta);
        }
    }

    /**
     * 消费金币
     */
    spendCoins(amount) {
        const cost = this._sanitizeAmount(amount);
        if (this.coins >= cost) {
            this.coins -= cost;
            this.updateCurrencyDisplay();
            return true;
        }
        return false;
    }

    /**
     * 消费红宝石
     */
    spendRubies(amount) {
        const cost = this._sanitizeAmount(amount);
        if (this.rubies >= cost) {
            this.rubies -= cost;
            this.updateCurrencyDisplay();
            return true;
        }
        return false;
    }

    /**
     * 消费水晶
     */
    spendCrystals(amount) {
        const cost = this._sanitizeAmount(amount);
        if (this.crystals >= cost) {
            this.crystals -= cost;
            this.updateCurrencyDisplay();
            return true;
        }
        return false;
    }

    /**
     * 检查金币是否足够
     */
    hasEnoughCoins(amount) {
        return this.coins >= amount;
    }

    /**
     * 检查红宝石是否足够
     */
    hasEnoughRubies(amount) {
        return this.rubies >= amount;
    }

    /**
     * 检查水晶是否足够
     */
    hasEnoughCrystals(amount) {
        return this.crystals >= amount;
    }

    /**
     * 获取金币数量
     */
    getCoins() {
        return this.coins;
    }

    /**
     * 获取红宝石数量
     */
    getRubies() {
        return this.rubies;
    }

    /**
     * 获取水晶数量
     */
    getCrystals() {
        return this.crystals;
    }

    /**
     * 设置金币数量
     */
    setCoins(amount) {
        this.coins = this._sanitizeAmount(amount);
        this.updateCurrencyDisplay();
    }

    /**
     * 设置红宝石数量
     */
    setRubies(amount) {
        this.rubies = this._sanitizeAmount(amount);
        this.updateCurrencyDisplay();
    }

    /**
     * 设置水晶数量
     */
    setCrystals(amount) {
        this.crystals = this._sanitizeAmount(amount);
        this.updateCurrencyDisplay();
    }

    /**
     * 更新货币显示
     */
    updateCurrencyDisplay() {
        // 计算格式化后的文本，若与上次一致则不更新 DOM
        const coinsText = this.formatNumber(this.coins);
        const rubiesText = this.formatNumber(this.rubies);
        const crystalsText = this.formatNumber(this.crystals);

        // 更新主界面的金币显示
        const coinsElement = document.getElementById('coins');
        if (coinsElement && this._lastDisplay.coins !== coinsText) {
            coinsElement.textContent = coinsText;
            this._lastDisplay.coins = coinsText;
        }

        // 更新主界面的红宝石显示
        const gemsElement = document.getElementById('gems');
        if (gemsElement && this._lastDisplay.rubies !== rubiesText) {
            gemsElement.textContent = rubiesText;
            this._lastDisplay.rubies = rubiesText;
        }

        // 更新主界面的水晶显示
        const crystalsElement = document.getElementById('crystals');
        if (crystalsElement && this._lastDisplay.crystals !== crystalsText) {
            crystalsElement.textContent = crystalsText;
            this._lastDisplay.crystals = crystalsText;
        }

        // 更新角色管理界面的货币显示
        this.updateCharacterManagementCurrency();
    }

    /**
     * 更新角色管理界面的货币显示
     */
    updateCharacterManagementCurrency() {
        // 更新角色管理界面的金币显示
        const characterCoinsElements = document.querySelectorAll('.character-management-modal .resource-value');
        if (characterCoinsElements.length > 0) {
            // 第一个是金币
            const t = this.formatNumber(this.coins);
            if (characterCoinsElements[0].textContent !== t) {
                characterCoinsElements[0].textContent = t;
            }
        }

        // 更新角色管理界面的红宝石显示
        if (characterCoinsElements.length > 1) {
            // 第二个是红宝石
            const t = this.formatNumber(this.rubies);
            if (characterCoinsElements[1].textContent !== t) {
                characterCoinsElements[1].textContent = t;
            }
        }

        // 更新角色管理界面的水晶显示
        if (characterCoinsElements.length > 2) {
            // 第三个是水晶
            const t = this.formatNumber(this.crystals);
            if (characterCoinsElements[2].textContent !== t) {
                characterCoinsElements[2].textContent = t;
            }
        }
    }

    /**
     * 保存资源数据到本地存储
     */
    saveToLocalStorage() {
        const resourceData = {
            coins: this.coins,
            rubies: this.rubies,
            crystals: this.crystals,
            timestamp: Date.now()
        };

        try {
            localStorage.setItem('pet-plan-resources', JSON.stringify(resourceData));
            if (this.debug) console.log('资源数据已保存');
        } catch (error) {
            console.error('保存资源数据失败:', error);
        }
    }

    /**
     * 从本地存储加载资源数据
     */
    loadFromLocalStorage() {
        try {
            const savedData = localStorage.getItem('pet-plan-resources');
            if (savedData) {
                const resourceData = JSON.parse(savedData);
                this.coins = resourceData.coins || 1000;
                this.rubies = resourceData.rubies || 50;
                this.crystals = resourceData.crystals || 0;
                this.updateCurrencyDisplay();
                if (this.debug) console.log('资源数据已加载');
                return true;
            }
        } catch (error) {
            console.error('加载资源数据失败:', error);
        }
        return false;
    }

    /**
     * 清除本地存储的资源数据
     */
    clearLocalStorage() {
        localStorage.removeItem('pet-plan-resources');
        if (this.debug) console.log('资源数据已清除');
    }

    /**
     * 获取资源数据对象
     */
    getResourceData() {
        return {
            coins: this.coins,
            rubies: this.rubies,
            crystals: this.crystals
        };
    }

    /**
     * 设置资源数据对象
     */
    setResourceData(data) {
        if (data.coins !== undefined) {
            this.coins = data.coins;
        }
        if (data.rubies !== undefined) {
            this.rubies = data.rubies;
        }
        if (data.crystals !== undefined) {
            this.crystals = data.crystals;
        }
        this.updateCurrencyDisplay();
    }

    // 领地系统兼容方法
    /**
     * 检查是否有足够的资源（领地系统使用）
     */
    hasEnoughResources(cost) {
        const gold = this._sanitizeAmount(cost && cost.gold);
        const crystal = this._sanitizeAmount(cost && cost.crystal);
        return this.coins >= gold && this.crystals >= crystal;
    }

    /**
     * 消费资源（领地系统使用）
     */
    spendResources(cost) {
        const gold = this._sanitizeAmount(cost && cost.gold);
        const crystal = this._sanitizeAmount(cost && cost.crystal);

        if (this.debug) {
            console.log('资源扣除前:', {
                coins: this.coins,
                crystals: this.crystals,
                cost: { gold, crystal }
            });
        }

        if (this.hasEnoughResources(cost)) {
            this.coins -= gold;
            this.crystals -= crystal;
            this.updateCurrencyDisplay();

            if (this.debug) {
                console.log('资源扣除后:', {
                    coins: this.coins,
                    crystals: this.crystals
                });
            }

            return true;
        }

        if (this.debug) console.log('资源不足，扣除失败');
        return false;
    }

    /**
     * 获取金币（领地系统使用gold名称）
     */
    get gold() {
        return this.coins;
    }

    /**
     * 获取宝石（领地系统使用crystal名称）
     */
    get crystal() {
        return this.crystals;
    }

    /**
     * 获取存档数据
     * @returns {Object} 资源系统的存档数据
     */
    getSaveData() {
        return {
            coins: this.coins,
            rubies: this.rubies,
            crystals: this.crystals
        };
    }

    /**
     * 加载存档数据
     * @param {Object} data 存档数据
     */
    loadSaveData(data) {
        if (data) {
            this.coins = data.coins !== undefined ? data.coins : this.coins;
            this.rubies = data.rubies !== undefined ? data.rubies : this.rubies;
            this.crystals = data.crystals !== undefined ? data.crystals : this.crystals;
            this.updateCurrencyDisplay();
            if (this.debug) console.log('资源系统存档数据已加载');
        }
    }

    /**
     * 内部工具：清洗数值
     * - 非数字/无限 → 0
     * - 负数 → 0（资源增减/设置不接受负值）
     */
    _sanitizeAmount(amount) {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) return 0;
        return Math.floor(n);
    }

    /**
     * 内部工具：安全加法（避免 NaN）
     */
    _safeSum(base, delta) {
        const b = Number.isFinite(base) ? base : 0;
        const d = Number.isFinite(delta) ? delta : 0;
        const sum = b + d;
        return sum < 0 ? 0 : sum;
    }
}

export default ResourceSystem;
