/**
 * @file 任务与成就系统
 * @description 管理每日任务和长期成就的进度、完成状态及奖励领取
 */

class AchievementSystem {
    constructor(resourceSystem) {
        this.resourceSystem = resourceSystem;

        // 统计数据 (用于追踪进度)
        this.stats = {
            totalKills: 0,
            totalCoins: 0,
            totalClicks: 0, // 如果有点击相关
            loginDays: 1,
            buildingUpgrades: 0,
            petUpgrades: 0,
            dungeonClears: 0
        };

        // 每日任务配置
        this.dailyQuests = {
            "daily_kill_10": { id: "daily_kill_10", type: "kill", target: 10, title: "小试牛刀", desc: "击杀10只怪物", reward: { coins: 100 }, progress: 0, claimed: false },
            "daily_kill_100": { id: "daily_kill_100", type: "kill", target: 100, title: "怪物猎人", desc: "击杀100只怪物", reward: { rubies: 10 }, progress: 0, claimed: false },
            "daily_login": { id: "daily_login", type: "login", target: 1, title: "每日签到", desc: "登录游戏", reward: { crystals: 5 }, progress: 0, claimed: false }
        };

        // 长期成就配置
        this.achievements = {
            "ach_coin_1k": { id: "ach_coin_1k", type: "collect_coin", target: 1000, title: "第一桶金", desc: "累计获得1000金币", reward: { rubies: 50 }, progress: 0, claimed: false },
            "ach_kill_1k": { id: "ach_kill_1k", type: "kill_total", target: 1000, title: "千人斩", desc: "累计击杀1000只怪物", reward: { crystals: 100 }, progress: 0, claimed: false },
            "ach_upgrade_50": { id: "ach_upgrade_50", type: "upgrade", target: 50, title: "强化大师", desc: "累计强化属性50次", reward: { rubies: 100 }, progress: 0, claimed: false }
        };

        this.lastLoginDate = new Date().toDateString();

        // UI 回调，用于更新界面
        this.onProgressUpdate = null;
    }

    init() {
        console.log("成就系统初始化完成");
        // 检查每日重置
        this.checkDailyReset();
    }

    /**
     * 检查每日任务重置
     */
    checkDailyReset() {
        const today = new Date().toDateString();
        if (this.lastLoginDate !== today) {
            console.log("每日任务重置");
            this.lastLoginDate = today;
            for (let key in this.dailyQuests) {
                this.dailyQuests[key].progress = 0;
                this.dailyQuests[key].claimed = false;
            }
            // 自动完成登录任务
            this.onEvent('login', 1);
        }
    }

    /**
     * 通用事件触发接口
     * @param {string} eventType - 事件类型 (kill, coin, level, etc.)
     * @param {number} amount - 数量
     */
    onEvent(eventType, amount = 1) {
        let updated = false;

        // 更新统计 (部分类型)
        if (eventType === 'kill') this.stats.totalKills += amount;
        if (eventType === 'coin') this.stats.totalCoins += amount;

        // 检查每日任务
        for (let key in this.dailyQuests) {
            const quest = this.dailyQuests[key];
            if (!quest.claimed && quest.type === eventType) {
                // 如果是覆盖型进度（如等级），直接设置；如果是累加型（如击杀），累加
                if (eventType === 'level') {
                    if (amount > quest.progress) {
                        quest.progress = amount;
                        updated = true;
                    }
                } else {
                    if (quest.progress < quest.target) {
                        quest.progress += amount;
                        updated = true;
                    }
                }
            }
        }

        // 检查成就
        for (let key in this.achievements) {
            const ach = this.achievements[key];
            if (!ach.claimed) {
                // 映射事件类型到成就类型
                let match = false;
                if (ach.type === 'kill_total' && eventType === 'kill') match = true;
                if (ach.type === 'collect_coin' && eventType === 'coin') match = true;
                if (ach.type === 'upgrade' && eventType === 'upgrade') match = true;

                if (match) {
                    if (ach.type === 'level') { // Legacy support or if added later
                        if (amount > ach.progress) {
                            ach.progress = amount;
                            updated = true;
                        }
                    } else {
                        // 累加
                        if (ach.progress < ach.target) {
                            ach.progress += amount;
                            updated = true;
                        }
                    }
                }
            }
        }

        if (updated && this.onProgressUpdate) {
            this.onProgressUpdate();
        }
    }

    /**
     * 领取奖励
     * @param {string} id - 任务或成就ID
     * @param {boolean} isDaily - 是否为每日任务
     */
    claimReward(id, isDaily) {
        const item = isDaily ? this.dailyQuests[id] : this.achievements[id];
        if (!item) return { success: false, msg: "任务不存在" };
        if (item.claimed) return { success: false, msg: "已领取" };
        if (item.progress < item.target) return { success: false, msg: "未完成" };

        // 发放奖励
        if (item.reward.coins) this.resourceSystem.addCoins(item.reward.coins);
        if (item.reward.rubies) this.resourceSystem.addRubies(item.reward.rubies);
        if (item.reward.crystals) this.resourceSystem.addCrystals(item.reward.crystals);

        item.claimed = true;
        console.log(`领取奖励: ${item.title}`);

        if (this.onProgressUpdate) this.onProgressUpdate();
        return { success: true, msg: "领取成功", reward: item.reward };
    }

    /**
     * 获取存档数据
     */
    getSaveData() {
        return {
            stats: this.stats,
            dailyQuests: this.dailyQuests,
            achievements: this.achievements,
            lastLoginDate: this.lastLoginDate
        };
    }

    /**
     * 加载存档数据
     */
    loadSaveData(data) {
        if (data) {
            this.stats = { ...this.stats, ...data.stats };
            // 合并任务状态，保留配置中的静态文本，只更新进度和状态
            if (data.dailyQuests) {
                for (let box in data.dailyQuests) {
                    if (this.dailyQuests[box]) {
                        this.dailyQuests[box].progress = data.dailyQuests[box].progress;
                        this.dailyQuests[box].claimed = data.dailyQuests[box].claimed;
                    }
                }
            }
            if (data.achievements) {
                for (let box in data.achievements) {
                    if (this.achievements[box]) {
                        this.achievements[box].progress = data.achievements[box].progress;
                        this.achievements[box].claimed = data.achievements[box].claimed;
                    }
                }
            }
            this.lastLoginDate = data.lastLoginDate || new Date().toDateString();
            this.checkDailyReset(); // 加载后再次检查日期
        }
    }
}

export default AchievementSystem;
