/**
 * @file 离线系统模块
 * @description 计算玩家离线期间的收益并进行发放
 */

class OfflineSystem {
    constructor(territorySystem, resourceSystem, uiSystem, saveSystem) {
        this.territorySystem = territorySystem;
        this.resourceSystem = resourceSystem;
        this.uiSystem = uiSystem;
        this.saveSystem = saveSystem;

        console.log('离线系统初始化完成');
    }

    /**
     * 初始化并检查离线收益
     */
    init() {
        // 延迟一点执行，确保存档已完全加载
        setTimeout(() => {
            this.checkOfflineProgress();
        }, 1000);
    }

    /**
     * 检查离线进度
     */
    checkOfflineProgress() {
        try {
            // 获取最近一次存档的时间
            // 这里我们假设自动存档（槽位1）是主要进度
            // 也可以改进为在加载存档时通过参数传递最后保存时间

            const saveKey = `${this.saveSystem.savePrefix}slot1`;
            const saveDataStr = localStorage.getItem(saveKey);

            if (!saveDataStr) {
                console.log('没有找到存档，跳过离线计算');
                return;
            }

            const saveData = JSON.parse(saveDataStr);
            const lastTime = saveData.timestamp;

            if (!lastTime) {
                console.log('存档中没有时间戳');
                return;
            }

            const now = Date.now();
            // 毫秒转秒
            const diffSeconds = Math.floor((now - lastTime) / 1000);

            // 至少离线 60 秒才计算收益
            if (diffSeconds < 60) {
                console.log(`离线时间太短 (${diffSeconds}秒)，不计算收益`);
                return;
            }

            console.log(`离线时长: ${diffSeconds} 秒`);

            // 计算资源产出效率
            const productionRate = this.territorySystem.calculateTotalProduction();
            console.log('每秒产出:', productionRate);

            if (productionRate.gold === 0 && productionRate.crystal === 0) {
                console.log('没有资源产出，跳过');
                return;
            }

            // 计算总收益 (最大离线时长限制：比如 24 小时 = 86400 秒)
            const maxOfflineSeconds = 24 * 60 * 60;
            const effectiveSeconds = Math.min(diffSeconds, maxOfflineSeconds);

            const offlineGold = Math.floor(productionRate.gold * effectiveSeconds);
            const offlineCrystal = Math.floor(productionRate.crystal * effectiveSeconds);

            if (offlineGold > 0 || offlineCrystal > 0) {
                // 发放奖励
                this.resourceSystem.addCoins(offlineGold);
                this.resourceSystem.addCrystals(offlineCrystal); // 假设 resourceSystem 支持 addCrystals

                // 显示离线且收益弹窗
                if (this.uiSystem && this.uiSystem.showOfflineResult) {
                    this.uiSystem.showOfflineResult({
                        time: effectiveSeconds,
                        gold: offlineGold,
                        crystal: offlineCrystal
                    });
                } else {
                    console.warn('UI System 不支持 showOfflineResult');
                    // 临时的 fallback 提示
                    import('./ui-system.js').then(({ showToast }) => {
                        showToast(`欢迎回来！离线获得了 💰${offlineGold}, 💎${offlineCrystal}`);
                    });
                }
            }

        } catch (error) {
            console.error('检查离线收益失败:', error);
        }
    }
}

export default OfflineSystem;
